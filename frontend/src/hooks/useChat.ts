import { useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { API_BASE_URL, sessionsApi } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useChatStore, type MessageWithSteps } from "../store/chatStore";
import type { AgentStep } from "../components/AgentSteps";

let msgIdCounter = Date.now();
const tempId = () => ++msgIdCounter;

export function useChat() {
  const {
    activeSessionId,
    selectedModel,
    appendMessage,
    updateLastAssistantMessage,
    appendStepToLastMessage,
    setLoading,
    setSessions,
    addSession,
    setActiveSession,
    setMessages,
    setModel,
  } = useChatStore();

  const accessToken = useAuthStore((s) => s.accessToken);
  const streamAbortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await sessionsApi.list();
    setSessions(data);

    const currentState = useChatStore.getState();
    const activeSession = data.find((session) => session.id === currentState.activeSessionId);
    const nextSession = activeSession ?? data[0];

    if (nextSession) {
      if (currentState.activeSessionId !== nextSession.id) {
        setActiveSession(nextSession.id);
      }
      setModel(nextSession.model);
    }
  }, [setActiveSession, setModel, setSessions]);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      const { data } = await sessionsApi.messages(sessionId);
      setMessages(data);
    },
    [setMessages]
  );

  const createSession = useCallback(async () => {
    const { data } = await sessionsApi.create("New Session", selectedModel);
    addSession(data);
    setActiveSession(data.id);
    setModel(data.model);
    setMessages([]);
    return data;
  }, [addSession, selectedModel, setActiveSession, setMessages, setModel]);

  const deleteSession = useCallback(async (id: string) => {
    await sessionsApi.remove(id);
    useChatStore.getState().removeSession(id);
    toast.success("Session deleted");
  }, []);

  const renameSession = useCallback(async (id: string, title: string) => {
    const { data } = await sessionsApi.update(id, { title });
    useChatStore.getState().updateSession(data);
  }, []);

  const updateSessionModel = useCallback(async (id: string, model: string) => {
    const { data } = await sessionsApi.update(id, { model });
    const state = useChatStore.getState();
    state.updateSession(data);
    state.setModel(model);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await createSession();
        sessionId = session.id;
      }

      const abortController = new AbortController();
      streamAbortRef.current = abortController;
      setLoading(true);

      const userMsg: MessageWithSteps = {
        id: tempId(),
        role: "user",
        content: text,
        tool_name: null,
        created_at: new Date().toISOString(),
      };
      appendMessage(userMsg);

      const assistantPlaceholder: MessageWithSteps = {
        id: tempId(),
        role: "assistant",
        content: "",
        tool_name: null,
        created_at: new Date().toISOString(),
        steps: [],
      };
      appendMessage(assistantPlaceholder);

      try {
        await streamMessage(
          sessionId,
          text,
          selectedModel,
          accessToken,
          updateLastAssistantMessage,
          appendStepToLastMessage,
          abortController.signal
        );

        const { data: updatedSessions } = await sessionsApi.list();
        setSessions(updatedSessions);
      } catch (err: any) {
        const wasAborted = err?.name === "AbortError" || abortController.signal.aborted;
        if (wasAborted) {
          const lastAssistant = [...useChatStore.getState().messages]
            .reverse()
            .find((message) => message.role === "assistant");
          if (lastAssistant && !lastAssistant.content.trim()) {
            updateLastAssistantMessage("Stopped.");
          }
          toast("Generation stopped");
          return;
        }

        const errMsg = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
        updateLastAssistantMessage(`Warning: ${errMsg}`);
        toast.error("Failed to get response");
      } finally {
        if (streamAbortRef.current === abortController) {
          streamAbortRef.current = null;
        }
        setLoading(false);
      }
    },
    [
      accessToken,
      activeSessionId,
      appendMessage,
      appendStepToLastMessage,
      createSession,
      selectedModel,
      setLoading,
      setSessions,
      updateLastAssistantMessage,
    ]
  );

  const cancelMessage = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  return {
    loadSessions,
    loadMessages,
    createSession,
    deleteSession,
    renameSession,
    sendMessage,
    cancelMessage,
    updateSessionModel,
  };
}

async function streamMessage(
  sessionId: string,
  message: string,
  model: string,
  token: string | null,
  onDelta: (content: string) => void,
  onStep: (step: AgentStep) => void,
  signal: AbortSignal
): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId, message, model, stream: true }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Server error ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (true) {
      if (signal.aborted) {
        throw abortError();
      }

      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const eventChunk of events) {
        const payload = eventChunk
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6).trim())
          .join("");

        if (!payload) continue;

        try {
          const json = JSON.parse(payload);

          if (json.done) {
            return;
          }

          if (json.delta) {
            accumulated += json.delta;
            onDelta(accumulated);
          }

          if (json.step) {
            onStep(json.step as AgentStep);
          }
        } catch {
          // Ignore malformed events so a partial chunk does not kill the stream.
        }
      }

      if (done) {
        break;
      }
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
  }
}

function abortError(): Error {
  const err = new Error("Request aborted");
  err.name = "AbortError";
  return err;
}
