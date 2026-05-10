import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Plus, LogOut, Users, Settings, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../hooks/useChat";
import UserMgmtModal from "./UserMgmtModal";
import ConfigModal from "./ConfigModal";
import styles from "./Sidebar.module.css";

interface Props {
  onClose: () => void;
}

export default function Sidebar({ onClose }: Props) {
  const navigate = useNavigate();
  const { sessions, activeSessionId, setActiveSession } = useChatStore();
  const { user, logout } = useAuthStore();
  const { createSession, deleteSession, loadMessages } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleNewSession() {
    await createSession();
  }

  async function handleSelectSession(id: string) {
    setActiveSession(id);
    await loadMessages(id);
  }

  async function handleDelete(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    if (!window.confirm("Delete this session and its history?")) return;
    await deleteSession(id);
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
    toast.success("Signed out");
  }

  const abbr = user?.username.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>AI</div>
            <span className={styles.logoName}>ADK Studio</span>
          </div>

          <div ref={menuRef} className={styles.userMenuWrap}>
            <div className={styles.userMenu} onClick={() => setMenuOpen((open) => !open)}>
              <div className={styles.avatar}>{abbr}</div>
              <ChevronDown size={13} color="var(--text3)" />
            </div>

            {menuOpen && (
              <div className={styles.dropdown}>
                <div className={styles.dropdownUser}>
                  <div className={styles.dropdownAvatar}>{abbr}</div>
                  <div>
                    <div className={styles.dropdownName}>{user?.username}</div>
                    <div className={styles.dropdownRole}>{user?.role ?? "user"}</div>
                  </div>
                </div>
                <div className={styles.dropdownDivider} />
                {user?.role === "admin" && (
                  <>
                    <button className={styles.dropdownItem} onClick={() => { setMenuOpen(false); setShowUsers(true); }}>
                      <Users size={14} /> Manage Users
                    </button>
                    <button className={styles.dropdownItem} onClick={() => { setMenuOpen(false); setShowConfig(true); }}>
                      <Settings size={14} /> Configuration
                    </button>
                    <div className={styles.dropdownDivider} />
                  </>
                )}
                <button
                  className={`${styles.dropdownItem} ${styles.danger}`}
                  onClick={handleLogout}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.sessionsHeader}>
          <span className={styles.sessionsLabel}>Sessions</span>
          <div className={styles.sessionsActions}>
            <button className={styles.closeBtn} onClick={onClose} title="Close sidebar">
              <X size={13} />
            </button>
            <button className={styles.newBtn} onClick={handleNewSession}>
              <Plus size={13} /> New
            </button>
          </div>
        </div>

        <div className={styles.sessionsList}>
          {sessions.length === 0 ? (
            <div className={styles.empty}>
              No sessions yet.
              <br />
              Click "New" to start.
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`${styles.sessionItem} ${session.id === activeSessionId ? styles.active : ""}`}
                onClick={() => void handleSelectSession(session.id)}
              >
                <div className={`${styles.sessionDot} ${session.id === activeSessionId ? styles.activeDot : ""}`} />
                <div className={styles.sessionInfo}>
                  <div className={styles.sessionTitle}>{session.title}</div>
                  <div className={styles.sessionMeta}>
                    <span>{session.message_count} msg{session.message_count !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{session.model}</span>
                    <span>·</span>
                    <span>{relTime(session.updated_at)}</span>
                  </div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(event) => void handleDelete(event, session.id)}
                  title="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className={styles.bottom}>
          <div className={styles.versionRow}>
            <span className={styles.versionBadge}>adk 1.25.1</span>
            <span className={styles.versionBadge}>litellm 1.82.0</span>
          </div>
        </div>
      </aside>

      {showUsers && <UserMgmtModal onClose={() => setShowUsers(false)} />}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
