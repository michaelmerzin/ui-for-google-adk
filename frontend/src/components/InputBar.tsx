import { useEffect, useRef, useState } from "react";
import { SendHorizonal, Square, RotateCcw } from "lucide-react";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import styles from "./InputBar.module.css";

interface QuickPromptDetail {
  text: string;
  autoSend?: boolean;
}

export default function InputBar() {
  const [text, setText] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState("");
  const { isLoading } = useChatStore();
  const { sendMessage, cancelMessage } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<QuickPromptDetail>).detail;
      const value = detail?.text ?? "";
      setText(value);
      requestAnimationFrame(() => {
        autoResize();
        textareaRef.current?.focus();
      });

      if (detail?.autoSend) {
        window.setTimeout(() => {
          void submitMessage(value);
        }, 80);
      }
    }

    window.addEventListener("adk:quickprompt", handler);
    return () => window.removeEventListener("adk:quickprompt", handler);
  }, [sendMessage]);

  function autoResize() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }

  async function submitMessage(explicitText?: string) {
    const trimmed = (explicitText ?? text).trim();
    if (!trimmed || isLoading) return;
    setLastSubmitted(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(trimmed);
    textareaRef.current?.focus();
  }

  function handleSendButton() {
    if (isLoading) {
      cancelMessage();
      return;
    }
    void submitMessage();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  const approxTokens = Math.ceil(text.length / 4);

  return (
    <div className={styles.bar}>
      <div className={styles.utilityRow}>
        {lastSubmitted && !text && (
          <button className={styles.reuseBtn} onClick={() => setText(lastSubmitted)}>
            <RotateCcw size={12} />
            Reuse last prompt
          </button>
        )}
        <span className={styles.hint}>
          Enter to send, Shift+Enter for newline
        </span>
      </div>

      <div className={`${styles.wrapper} ${isLoading ? styles.wrapperLoading : ""}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Message your agent with a task, question, or instruction..."
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            autoResize();
          }}
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
            onClick={handleSendButton}
            disabled={!text.trim() && !isLoading}
            title={isLoading ? "Stop generation" : "Send"}
          >
            {isLoading ? <Square size={14} fill="currentColor" /> : <SendHorizonal size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
