import { useState } from "react";
import { Copy, RotateCcw, Wrench } from "lucide-react";
import type { MessageWithSteps } from "../store/chatStore";
import AgentSteps from "./AgentSteps";
import ResponseRenderer from "./ResponseRenderer";
import styles from "./MessageBubble.module.css";

interface Props {
  message: MessageWithSteps;
  username: string;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, username, isStreaming }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const abbr = isUser ? username.slice(0, 1).toUpperCase() : "AI";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function handleReusePrompt() {
    window.dispatchEvent(new CustomEvent("adk:quickprompt", {
      detail: { text: message.content, autoSend: false },
    }));
  }

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.botAvatar}`}>
        {abbr}
      </div>

      <div className={styles.group}>
        {!isUser && (message.steps?.length ?? 0) > 0 && (
          <AgentSteps
            steps={message.steps ?? []}
            isStreaming={isStreaming === true && message.content === ""}
          />
        )}

        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
          {isStreaming && message.content === "" ? (
            <div className={styles.streamingDots}>
              <span />
              <span />
              <span />
            </div>
          ) : isUser ? (
            <span className={styles.userText}>{message.content}</span>
          ) : (
            <>
              <ResponseRenderer content={message.content} />
              {isStreaming && <span className={styles.cursor} />}
            </>
          )}
        </div>

        <div className={styles.meta}>
          <span>{isUser ? username : "assistant"}</span>
          <span className={styles.dot}>·</span>
          <span>{time}</span>
          {message.tool_name && (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.toolBadge}>
                <Wrench size={10} /> {message.tool_name}
              </span>
            </>
          )}
          {message.content && (
            <>
              <span className={styles.dot}>·</span>
              <button className={styles.metaAction} onClick={() => void handleCopy()}>
                <Copy size={11} />
                {copied ? "Copied" : "Copy"}
              </button>
            </>
          )}
          {isUser && message.content && (
            <>
              <span className={styles.dot}>·</span>
              <button className={styles.metaAction} onClick={handleReusePrompt}>
                <RotateCcw size={11} />
                Reuse
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
