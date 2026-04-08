import { useChatStore } from "../store/chatStore";
import styles from "./Topbar.module.css";

interface Props {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export default function Topbar({ inspectorOpen, onToggleInspector }: Props) {
  const { activeSessionId, sessions } = useChatStore();
  const activeSession = sessions.find((s: any) => s.id === activeSessionId);

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

        <button
          className={`${styles.inspectorBtn} ${inspectorOpen ? styles.inspectorBtnActive : ""}`}
          onClick={onToggleInspector}
          title={inspectorOpen ? "Hide state inspector" : "Show state inspector"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          State
        </button>
      </div>
    </div>
  );
}