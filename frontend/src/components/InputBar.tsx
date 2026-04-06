import { useEffect, useRef, useState } from "react";
import { SendHorizonal, Square } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import styles from "./InputBar.module.css";

export default function InputBar() {
  const [text, setText] = useState("");
  const { isLoading } = useChatStore();
  const { sendMessage } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen for quick prompt events from ChatArea
  useEffect(() => {
    function handler(e: Event) {
      const value = (e as CustomEvent<string>).detail;
      setText(value);
      textareaRef.current?.focus();
      // Auto-send quick prompts
      setTimeout(() => {
        sendMessage(value);
        setText("");
      }, 80);
    }
    window.addEventListener("adk:quickprompt", handler);
    return () => window.removeEventListener("adk:quickprompt", handler);
  }, [sendMessage]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(trimmed);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const approxTokens = Math.ceil(text.length / 4);

  return (
    <div className={styles.bar}>
      <div className={`${styles.wrapper} ${isLoading ? styles.wrapperLoading : ""}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Message your agent… (Shift+Enter for new line)"
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />

        <div className={styles.actions}>
          {text.length > 0 && (
            <span className={styles.tokenHint}>~{approxTokens} tokens</span>
          )}
          <button
            className={`${styles.sendBtn} ${isLoading ? styles.sendBtnLoading : ""}`}
            onClick={handleSend}
            disabled={!text.trim() && !isLoading}
            title={isLoading ? "Generating…" : "Send (Enter)"}
          >
            {isLoading ? <Square size={14} fill="currentColor" /> : <SendHorizonal size={15} />}
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        ADK Studio · google-adk 1.25.1 · litellm 1.82.0 · Enter to send, Shift+Enter for newline
      </p>
    </div>
  );
}
