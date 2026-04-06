import { useEffect, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { chatApi } from "../api/client";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const { activeSessionId, sessions, selectedModel, setModel } = useChatStore();
  const [models, setModels] = useState<string[]>([]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  useEffect(() => {
    chatApi.models().then(({ data }) => setModels(data.models)).catch(() => {
      setModels([
        "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo",
        "claude-3-5-sonnet-20241022",
        "gemini-1.5-pro", "gemini-2.0-flash",
        "llama-3-70b-instruct", "mistral-large-latest",
      ]);
    });
  }, []);

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.sessionName}>
          {activeSession?.title ?? "ADK Studio"}
        </span>
        {activeSession && (
          <span className={styles.msgCount}>
            {activeSession.message_count} messages
          </span>
        )}
      </div>

      <div className={styles.right}>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          ADK Ready
        </div>

        <select
          className={styles.modelSelect}
          value={selectedModel}
          onChange={(e) => setModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
