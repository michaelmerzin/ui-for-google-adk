import { create } from "zustand";
import type { MessageOut, SessionOut } from "../api/client";

interface ChatState {
  sessions: SessionOut[];
  activeSessionId: string | null;
  messages: MessageOut[];
  isLoading: boolean;
  selectedModel: string;

  setSessions: (sessions: SessionOut[]) => void;
  addSession: (session: SessionOut) => void;
  updateSession: (session: SessionOut) => void;
  removeSession: (id: string) => void;

  setActiveSession: (id: string | null) => void;
  setMessages: (messages: MessageOut[]) => void;
  appendMessage: (message: MessageOut) => void;
  updateLastAssistantMessage: (content: string) => void;

  setLoading: (v: boolean) => void;
  setModel: (model: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isLoading: false,
  selectedModel: "gpt-4o",

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),
  updateSession: (session) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === session.id ? session : x)),
    })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
      messages: s.activeSessionId === id ? [] : s.messages,
    })),

  setActiveSession: (id) => set({ activeSessionId: id, messages: [] }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((s) => ({ messages: [...s.messages, message] })),
  updateLastAssistantMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      return { messages: msgs };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setModel: (selectedModel) => set({ selectedModel }),
}));
