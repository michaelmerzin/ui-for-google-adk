import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, PencilLine, PanelRightOpen } from "lucide-react";
import { chatApi, systemApi, type DependencyHealth, type HealthOut } from "../api/client";
import { useChatStore } from "../store/chatStore";
import { useChat } from "../hooks/useChat";
import styles from "./Topbar.module.css";

interface Props {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export default function Topbar({ inspectorOpen, onToggleInspector }: Props) {
  const { sessions, activeSessionId, messages, isLoading, selectedModel, setModel } = useChatStore();
  const { renameSession, updateSessionModel } = useChat();
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const [draftTitle, setDraftTitle] = useState(activeSession?.title ?? "ADK Studio");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [runtimeHealth, setRuntimeHealth] = useState<HealthOut | null>(null);
  const [healthError, setHealthError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(activeSession?.title ?? "ADK Studio");
  }, [activeSession?.title]);

  useEffect(() => {
    setIsLoadingModels(true);
    chatApi.models()
      .then(({ data }) => setModels(data.models))
      .catch(() => toast.error("Could not load models"))
      .finally(() => setIsLoadingModels(false));
  }, []);

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

  async function handleModelChange(nextModel: string) {
    setModel(nextModel);
    if (!activeSession) return;

    try {
      await updateSessionModel(activeSession.id, nextModel);
      toast.success("Model updated");
    } catch {
      setModel(activeSession.model);
      toast.error("Could not update the model");
    }
  }

  return (
    <div className={styles.topbar}>
      <div className={styles.left}>
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

        <label className={styles.modelWrap}>
          <span className={styles.modelLabel}>Model</span>
          <div className={styles.modelSelectWrap}>
            <select
              className={styles.modelSelect}
              value={activeSession?.model ?? selectedModel}
              onChange={(event) => void handleModelChange(event.target.value)}
              disabled={isLoadingModels}
            >
              {(models.length > 0 ? models : [selectedModel]).map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className={styles.modelChevron} />
          </div>
        </label>

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
