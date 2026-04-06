import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Plus, LogOut, Users, Settings, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../hooks/useChat";
import UserMgmtModal from "./UserMgmtModal";
import ConfigModal from "./ConfigModal";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const navigate = useNavigate();
  const { sessions, activeSessionId, setActiveSession } = useChatStore();
  const { user, logout } = useAuthStore();
  const { createSession, deleteSession, loadMessages } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleNewSession() {
    await createSession();
  }

  async function handleSelectSession(id: string) {
    setActiveSession(id);
    await loadMessages(id);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteSession(id);
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
    toast.success("Signed out");
  }

  function openUsers() {
    setMenuOpen(false);
    setShowUsers(true);
  }

  function openConfig() {
    setMenuOpen(false);
    setShowConfig(true);
  }

  const abbr = user?.username.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      <aside className={styles.sidebar}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>⬡</div>
            <span className={styles.logoName}>ADK Studio</span>
          </div>

          {/* User menu */}
          <div ref={menuRef} className={styles.userMenuWrap}>
            <div className={styles.userMenu} onClick={() => setMenuOpen((o) => !o)}>
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
                {user !== null && user?.role === "admin" && (
                  <>
                    <button className={styles.dropdownItem} onClick={openUsers}>
                      <Users size={14} /> Manage Users
                    </button>
                    <button className={styles.dropdownItem} onClick={openConfig}>
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

        {/* Sessions */}
        <div className={styles.sessionsHeader}>
          <span className={styles.sessionsLabel}>Sessions</span>
          <button className={styles.newBtn} onClick={handleNewSession}>
            <Plus size={13} /> New
          </button>
        </div>

        <div className={styles.sessionsList}>
          {sessions.length === 0 ? (
            <div className={styles.empty}>
              No sessions yet.<br />Click "+ New" to start.
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`${styles.sessionItem} ${s.id === activeSessionId ? styles.active : ""}`}
                onClick={() => handleSelectSession(s.id)}
              >
                <div className={`${styles.sessionDot} ${s.id === activeSessionId ? styles.activeDot : ""}`} />
                <div className={styles.sessionInfo}>
                  <div className={styles.sessionTitle}>{s.title}</div>
                  <div className={styles.sessionMeta}>
                    <span>{s.message_count} msg{s.message_count !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{s.model}</span>
                    <span>·</span>
                    <span>{relTime(s.updated_at)}</span>
                  </div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => handleDelete(e, s.id)}
                  title="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom */}
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
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
