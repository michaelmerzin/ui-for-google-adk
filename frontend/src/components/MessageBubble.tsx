import { useState } from "react";
import { Copy, Check, Wrench } from "lucide-react";
import type { MessageOut } from "../api/client";
import styles from "./MessageBubble.module.css";

interface Props {
  message: MessageOut;
  username: string;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, username, isStreaming }: Props) {
  const isUser = message.role === "user";
  const abbr = isUser
    ? username.slice(0, 1).toUpperCase()
    : "⬡";

  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`${styles.row} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={`${styles.avatar} ${isUser ? styles.userAvatar : styles.botAvatar}`}>
        {abbr}
      </div>

      <div className={styles.group}>
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
          {isStreaming && message.content === "" ? (
            <div className={styles.streamingDots}>
              <span /><span /><span />
            </div>
          ) : (
            <RenderedContent content={message.content} isUser={isUser} />
          )}
          {isStreaming && message.content !== "" && (
            <span className={styles.cursor} />
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
                <Wrench size={10} />
                {message.tool_name}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rendered content with markdown support ────────────────────────────────────

function RenderedContent({ content, isUser }: { content: string; isUser: boolean }) {
  const parts = parseContent(content);

  return (
    <div className={styles.content}>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return <CodeBlock key={i} lang={part.lang ?? ""} code={part.text} />;
        }
        if (part.type === "text") {
          return (
            <span
              key={i}
              className={styles.text}
              dangerouslySetInnerHTML={{ __html: renderInline(part.text) }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang || "code"}</span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Parse markdown into segments ──────────────────────────────────────────────

type Segment =
  | { type: "text"; text: string }
  | { type: "code"; lang: string; text: string };

function parseContent(raw: string): Segment[] {
  const parts: Segment[] = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRe.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: raw.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1], text: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    parts.push({ type: "text", text: raw.slice(lastIndex) });
  }

  return parts;
}

// Simple inline markdown → HTML (bold, italic, inline code, links, line breaks)
function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='inline-code'>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br />");
}
