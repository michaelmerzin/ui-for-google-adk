import { useEffect, useRef } from "react";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import MessageBubble from "./MessageBubble";
import styles from "./ChatArea.module.css";

const QUICK_PROMPTS = [
  { icon: "🔧", label: "Available tools", text: "What tools do you have available?" },
  { icon: "📖", label: "About ADK + LiteLLM", text: "Explain how Google ADK works with LiteLLM" },
  { icon: "🔍", label: "Web search demo", text: "Run a web search for the latest AI news" },
  { icon: "🐍", label: "Code generation", text: "Write a Python function to generate Fibonacci numbers" },
];

export default function ChatArea() {
  const { messages, isLoading, activeSessionId } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const showWelcome = messages.length === 0 && !isLoading;

  function handleQuickPrompt(text: string) {
    // Dispatch to InputBar via a custom event
    window.dispatchEvent(new CustomEvent("adk:quickprompt", { detail: text }));
  }

  return (
    <div className={styles.area}>
      {showWelcome ? (
        <div className={styles.welcome}>
          <div className={styles.welcomeIcon}>⬡</div>
          <h2 className={styles.welcomeTitle}>
            {activeSessionId ? "Session ready" : "Start a conversation"}
          </h2>
          <p className={styles.welcomeSub}>
            Powered by Google ADK 1.25.1 + LiteLLM 1.82.0.
            Ask anything, run tools, or explore multi-agent workflows.
          </p>
          <div className={styles.quickGrid}>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.text}
                className={styles.quickBtn}
                onClick={() => handleQuickPrompt(p.text)}
              >
                <span className={styles.quickIcon}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              username={user?.username ?? "you"}
              isStreaming={
                isLoading &&
                i === messages.length - 1 &&
                msg.role === "assistant" &&
                msg.content === ""
              }
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className={`${styles.thinking} animate-fade-in`}>
              <div className={styles.thinkingAvatar}>⬡</div>
              <div className={styles.thinkingBubble}>
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
