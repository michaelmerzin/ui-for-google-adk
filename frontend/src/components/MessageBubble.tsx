import { Wrench } from "lucide-react";
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
  const isUser = message.role === "user";
  const abbr = isUser ? username.slice(0, 1).toUpperCase() : "⬡";
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.botAvatar}`}>
        {abbr}
      </div>

      <div className={styles.group}>
        {/* ── Agent steps (only for assistant) ── */}
        {!isUser && (message.steps?.length ?? 0) > 0 && (
          <AgentSteps
            steps={message.steps!}
            isStreaming={isStreaming === true && message.content === ""}
          />
        )}

        {/* ── Bubble ── */}
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
          {isStreaming && message.content === "" ? (
            <div className={styles.streamingDots}>
              <span /><span /><span />
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

        {/* ── Meta ── */}
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
        </div>
      </div>
    </div>
  );
}