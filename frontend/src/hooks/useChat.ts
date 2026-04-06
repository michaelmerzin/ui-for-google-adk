import { useCallback } from "react";
import toast from "react-hot-toast";
import { chatApi, sessionsApi, type MessageOut } from "../api/client";
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
  } = useChatStore();

  const accessToken = useAuthStore((s) => s.accessToken);

  const loadSessions = useCallback(async () => {
    const { data } = await sessionsApi.list();
    setSessions(data);
  }, [setSessions]);

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
    setMessages([]);
    return data;
  }, [addSession, selectedModel, setActiveSession, setMessages]);

  const deleteSession = useCallback(async (id: string) => {
    await sessionsApi.remove(id);
    useChatStore.getState().removeSession(id);
    toast.success("Session deleted");
  }, []);

  const renameSession = useCallback(async (id: string, title: string) => {
    const { data } = await sessionsApi.update(id, { title });
    useChatStore.getState().updateSession(data);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let sessionId = activeSessionId;
      if (!sessionId) {
        const session = await createSession();
        sessionId = session.id;
      }

      setLoading(true);

      // Optimistic user message
      const userMsg: MessageWithSteps = {
        id: tempId(),
        role: "user",
        content: text,
        tool_name: null,
        created_at: new Date().toISOString(),
      };
      appendMessage(userMsg);

      // Assistant placeholder
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
          appendStepToLastMessage
        );

        const { data: updatedSessions } = await sessionsApi.list();
        setSessions(updatedSessions);
      } catch (err: any) {
        const errMsg = err?.response?.data?.detail ?? err?.message ?? "Unknown error";
        updateLastAssistantMessage(`⚠️ ${errMsg}`);
        toast.error("Failed to get response");
      } finally {
        setLoading(false);
      }
    },
    [
      activeSessionId, selectedModel, accessToken,
      appendMessage, appendStepToLastMessage,
      createSession, setLoading, setSessions, updateLastAssistantMessage,
    ]
  );

  return { loadSessions, loadMessages, createSession, deleteSession, renameSession, sendMessage };
}

// ── SSE streaming with ADK step parsing ───────────────────────────────────────

async function streamMessage(
  sessionId: string,
  message: string,
  model: string,
  token: string | null,
  onDelta: (content: string) => void,
  onStep: (step: AgentStep) => void
): Promise<void> {
  const resp = await fetch("/api/chat/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId, message, model, stream: true }),
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`Server error ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      try {
        const json = JSON.parse(raw);

        if (json.done) break;

        // ── Text delta ──
        if (json.delta) {
          accumulated += json.delta;
          onDelta(accumulated);
        }

        // ── ADK step events ──
        if (json.step) {
          onStep(json.step as AgentStep);
        }

      } catch {}
    }
  }
}