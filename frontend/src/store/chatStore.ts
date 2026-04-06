import { create } from "zustand";
import type { MessageOut } from "../api/client";
import type { AgentStep } from "../components/AgentSteps";

export interface MessageWithSteps extends MessageOut {
  steps?: AgentStep[];
}

interface ChatState {
  sessions: any[];
  activeSessionId: string | null;
  messages: MessageWithSteps[];
  isLoading: boolean;
  selectedModel: string;

  setSessions: (sessions: any[]) => void;
  addSession: (session: any) => void;
  updateSession: (session: any) => void;
  removeSession: (id: string) => void;

  setActiveSession: (id: string | null) => void;
  setMessages: (messages: MessageOut[]) => void;
  appendMessage: (message: MessageWithSteps) => void;
  updateLastAssistantMessage: (content: string) => void;
  appendStepToLastMessage: (step: AgentStep) => void;

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
      sessions: s.sessions.map((x: any) => (x.id === session.id ? session : x)),
    })),
  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((x: any) => x.id !== id),
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

  appendStepToLastMessage: (step) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = {
            ...msgs[i],
            steps: [...(msgs[i].steps ?? []), step],
          };
          break;
        }
      }
      return { messages: msgs };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setModel: (selectedModel) => set({ selectedModel }),
}));