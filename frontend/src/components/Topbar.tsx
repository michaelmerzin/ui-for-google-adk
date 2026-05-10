import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { PencilLine, PanelRightOpen, PanelLeftOpen } from "lucide-react";
import { systemApi, type DependencyHealth, type HealthOut } from "../api/client";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { useChat } from "../hooks/useChat";
import styles from "./Topbar.module.css";

interface Props {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Topbar({ inspectorOpen, onToggleInspector, sidebarOpen, onToggleSidebar }: Props) {
  const { sessions, activeSessionId, messages, isLoading } = useChatStore();
  const { renameSession } = useChat();
  const user = useAuthStore((s) => s.user);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const [draftTitle, setDraftTitle] = useState(activeSession?.title ?? "ADK Studio");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [runtimeHealth, setRuntimeHealth] = useState<HealthOut | null>(null);
  const [healthError, setHealthError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(activeSession?.title ?? "ADK Studio");
  }, [activeSession?.title]);

  useEffect(() => {
    if (!isEditingTitle) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingTitle]);

  useEffect(() => {
    let active = true;

    async function pollHealth() {
      try {
        const { data } = await systemApi.health();
        if (!active) return;
        setRuntimeHealth(data);
        setHealthError(false);
      } catch {
        if (!active) return;
        setHealthError(true);
      }
    }

    void pollHealth();
    const intervalId = window.setInterval(() => {
      void pollHealth();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const assistantSteps = useMemo(
    () => messages.flatMap((message) => message.steps ?? []),
    [messages]
  );
  const toolCount = assistantSteps.filter((step) => step.type === "tool_call").length;
  const transferCount = assistantSteps.filter((step) => step.type === "agent_transfer").length;

  const runtimeStatus = useMemo(() => {
    if (isLoading) {
      return {
        label: "Agent working",
        tone: "busy" as const,
        detail: "The current request is still running.",
      };
    }

    if (healthError) {
      return {
        label: "Backend offline",
        tone: "down" as const,
        detail: "Cannot reach /health endpoint.",
      };
    }

    if (!runtimeHealth) {
      return {
        label: "Checking runtime",
        tone: "checking" as const,
        detail: "Checking ADK and LiteLLM health.",
      };
    }

    const adkUp = runtimeHealth.adk.healthy;
    const litellmUp = runtimeHealth.litellm.healthy;
    const detail = `${probeLabel("ADK", runtimeHealth.adk)} | ${probeLabel("LiteLLM", runtimeHealth.litellm)}`;

    if (adkUp && litellmUp) {
      return { label: "ADK + LiteLLM online", tone: "ok" as const, detail };
    }
    if (adkUp) {
      return { label: "ADK online", tone: "warn" as const, detail };
    }
    if (litellmUp) {
      return { label: "LiteLLM fallback online", tone: "warn" as const, detail };
    }
    return { label: "No AI runtime online", tone: "down" as const, detail };
  }, [isLoading, healthError, runtimeHealth]);

  const statusDotClass = [
    styles.statusDot,
    runtimeStatus.tone === "busy" ? styles.statusDotBusy : "",
    runtimeStatus.tone === "warn" ? styles.statusDotWarn : "",
    runtimeStatus.tone === "down" ? styles.statusDotDown : "",
    runtimeStatus.tone === "checking" ? styles.statusDotChecking : "",
  ]
    .filter(Boolean)
    .join(" ");

  async function commitTitle() {
    const nextTitle = draftTitle.trim();
    if (!activeSession || !nextTitle || nextTitle === activeSession.title) {
      setDraftTitle(activeSession?.title ?? "ADK Studio");
      setIsEditingTitle(false);
      return;
    }

    try {
      await renameSession(activeSession.id, nextTitle);
      toast.success("Session renamed");
    } catch {
      setDraftTitle(activeSession.title);
      toast.error("Rename failed");
    } finally {
      setIsEditingTitle(false);
    }
  }

  const userAbbr = user?.username.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
        {!sidebarOpen && (
          <button
            className={styles.sidebarToggle}
            onClick={onToggleSidebar}
            title="Open sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}

        <div className={styles.sessionBlock}>
          {isEditingTitle && activeSession ? (
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitTitle();
                if (event.key === "Escape") {
                  setDraftTitle(activeSession.title);
                  setIsEditingTitle(false);
                }
              }}
              className={styles.titleInput}
              maxLength={80}
            />
          ) : (
            <button
              className={styles.titleButton}
              onClick={() => activeSession && setIsEditingTitle(true)}
              disabled={!activeSession}
              title={activeSession ? "Rename session" : "Create a session to rename it"}
            >
              <span className={styles.sessionName}>
                {activeSession?.title ?? "ADK Studio"}
              </span>
              {activeSession && <PencilLine size={13} />}
            </button>
          )}

          <div className={styles.metaRow}>
            <span className={styles.msgCount}>
              {activeSession ? `${activeSession.message_count} messages` : "Ready for a new session"}
            </span>
            {toolCount > 0 && <span className={styles.metaBadge}>{toolCount} tool runs</span>}
            {transferCount > 0 && <span className={styles.metaBadge}>{transferCount} handoffs</span>}
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.statusPill} title={runtimeStatus.detail}>
          <span className={statusDotClass} />
          {runtimeStatus.label}
        </div>

        <div className={styles.userPill}>
          <div className={styles.userPillAvatar}>{userAbbr}</div>
          <span className={styles.userPillName}>{user?.username ?? "—"}</span>
        </div>

        <button
          className={`${styles.inspectorBtn} ${inspectorOpen ? styles.inspectorBtnActive : ""}`}
          onClick={onToggleInspector}
          title={inspectorOpen ? "Hide state inspector" : "Show state inspector"}
        >
          <PanelRightOpen size={14} />
          State
        </button>
      </div>
    </div>
  );
}

function probeLabel(name: string, probe: DependencyHealth): string {
  if (!probe.configured) {
    return `${name}: not configured`;
  }
  if (!probe.reachable) {
    return `${name}: unreachable`;
  }

  const code = probe.status_code ?? "n/a";
  const latency = probe.latency_ms != null ? `${probe.latency_ms}ms` : "n/a";
  return `${name}: ${code} (${latency})`;
}
