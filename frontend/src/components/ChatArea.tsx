import { useEffect, useMemo, useRef } from "react";
import { Sparkles, Wrench, GitBranch, Database } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import MessageBubble from "./MessageBubble";
import styles from "./ChatArea.module.css";

const QUICK_PROMPTS = [
  {
    icon: Wrench,
    label: "Audit my tools",
    text: "List the tools you have access to and explain when you would use each one.",
    autoSend: true,
  },
  {
    icon: GitBranch,
    label: "Plan with sub-agents",
    text: "If this task benefits from multiple agents, propose a parallel plan and explain what each agent should own.",
    autoSend: false,
  },
  {
    icon: Database,
    label: "Inspect session memory",
    text: "Tell me what session state or memory you can currently observe and how it affects your answer.",
    autoSend: false,
  },
  {
    icon: Sparkles,
    label: "Shape the UX",
    text: "Review this interface like a product designer and suggest the highest-impact UX improvements.",
    autoSend: false,
  },
];

export default function ChatArea() {
  const { messages, isLoading, activeSessionId } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const showWelcome = messages.length === 0 && !isLoading;
  const sessionStats = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const totalSteps = assistantMessages.reduce((count, message) => count + (message.steps?.length ?? 0), 0);
    return {
      assistantMessages: assistantMessages.length,
      totalSteps,
    };
  }, [messages]);

  function handleQuickPrompt(text: string, autoSend: boolean) {
    window.dispatchEvent(new CustomEvent("adk:quickprompt", { detail: { text, autoSend } }));
  }

  return (
    <div className={styles.area}>
      {showWelcome ? (
        <div className={styles.welcome}>
          <div className={styles.heroCard}>
            <div className={styles.welcomeIcon}>AI</div>
            <div className={styles.heroText}>
              <h2 className={styles.welcomeTitle}>
                {activeSessionId ? "Session ready for agent work" : "Start a conversation with your ADK agent"}
              </h2>
              <p className={styles.welcomeSub}>
                This workspace is built for tool use, multi-step reasoning, and session-aware state. Start with a quick prompt or ask the agent to inspect, plan, and act.
              </p>
            </div>
          </div>

          <div className={styles.capabilityRow}>
            <div className={styles.capabilityCard}>
              <span className={styles.capabilityLabel}>Agent UX</span>
              <span className={styles.capabilityValue}>Streaming responses with visible steps</span>
            </div>
            <div className={styles.capabilityCard}>
              <span className={styles.capabilityLabel}>State aware</span>
              <span className={styles.capabilityValue}>Inspector for state, events, and memory</span>
            </div>
            <div className={styles.capabilityCard}>
              <span className={styles.capabilityLabel}>Model flexible</span>
              <span className={styles.capabilityValue}>Switch providers per session</span>
            </div>
          </div>

          <div className={styles.quickGrid}>
            {QUICK_PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.label}
                  className={styles.quickBtn}
                  onClick={() => handleQuickPrompt(prompt.text, prompt.autoSend)}
                >
                  <Icon size={16} className={styles.quickIcon} />
                  <span className={styles.quickLabel}>{prompt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.messages}>
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              username={user?.username ?? "you"}
              isStreaming={
                isLoading &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className={`${styles.thinking} animate-fade-in`}>
              <div className={styles.thinkingAvatar}>AI</div>
              <div className={styles.thinkingBubble}>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {!isLoading && sessionStats.assistantMessages > 0 && (
            <div className={styles.sessionSummary}>
              <span>{sessionStats.assistantMessages} assistant replies</span>
              <span>·</span>
              <span>{sessionStats.totalSteps} visible agent steps</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
