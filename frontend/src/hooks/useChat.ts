import { useCallback } from "react";
import toast from "react-hot-toast";
import { chatApi, sessionsApi, type MessageOut } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";

let msgIdCounter = Date.now();
const tempId = () => ++msgIdCounter;

export function useChat() {
  const {
    activeSessionId,
    selectedModel,
    appendMessage,
    updateLastAssistantMessage,
    setLoading,
    setSessions,
    updateSession,
    sessions,
    addSession,
    setActiveSession,
    setMessages,
  } = useChatStore();

  const user = useAuthStore((s) => s.user);
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

  const deleteSession = useCallback(
    async (id: string) => {
      await sessionsApi.remove(id);
      useChatStore.getState().removeSession(id);
      toast.success("Session deleted");
    },
    []
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const { data } = await sessionsApi.update(id, { title });
      updateSession(data);
    },
    [updateSession]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let sessionId = activeSessionId;

      // Auto-create session if none active
      if (!sessionId) {
        const session = await createSession();
        sessionId = session.id;
      }

      setLoading(true);

      // Optimistic user message
      const userMsg: MessageOut = {
        id: tempId(),
        role: "user",
        content: text,
        tool_name: null,
        created_at: new Date().toISOString(),
      };
      appendMessage(userMsg);

      // Placeholder assistant message for streaming
      const assistantPlaceholder: MessageOut = {
        id: tempId(),
        role: "assistant",
        content: "",
        tool_name: null,
        created_at: new Date().toISOString(),
      };
      appendMessage(assistantPlaceholder);

      try {
        // Try streaming first via EventSource-compatible fetch
        const streamed = await streamMessage(
          sessionId,
          text,
          selectedModel,
          accessToken,
          updateLastAssistantMessage
        );

        if (!streamed) {
          // Non-streaming fallback
          const { data } = await chatApi.send(sessionId, text, selectedModel);
          updateLastAssistantMessage(data.content);
        }

        // Refresh session list to update title + message count
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
      activeSessionId,
      selectedModel,
      accessToken,
      appendMessage,
      createSession,
      setLoading,
      setSessions,
      updateLastAssistantMessage,
    ]
  );

  return {
    loadSessions,
    loadMessages,
    createSession,
    deleteSession,
    renameSession,
    sendMessage,
  };
}

async function streamMessage(
  sessionId: string,
  message: string,
  model: string,
  token: string | null,
  onDelta: (content: string) => void
): Promise<boolean> {
  try {
    const resp = await fetch("/api/chat/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ session_id: sessionId, message, model, stream: true }),
    });

    if (!resp.ok || !resp.body) return false;

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
          if (json.delta) {
            accumulated += json.delta;
            onDelta(accumulated);
          }
        } catch {}
      }
    }
    return true;
  } catch {
    return false;
  }
}
