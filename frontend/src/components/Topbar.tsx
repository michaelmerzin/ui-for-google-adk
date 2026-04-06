import { useChatStore } from "../store/chatStore";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const { activeSessionId, sessions } = useChatStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId);

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
      </div>
    </div>
  );
}
