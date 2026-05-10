import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./StateInspector.module.css";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { API_BASE_URL } from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StateEntry {
  key: string;
  value: unknown;
  prefix: "user" | "app" | "temp" | "none";
  changedAt?: number; // timestamp of last change
}

export interface ADKEvent {
  id: string;
  type: "user" | "agent" | "tool_call" | "tool_result" | "state_delta" | "transfer" | "error";
  label: string;
  detail?: string;
  timestamp: number;
  invocation_id?: string;
}

export interface MemoryEntry {
  content: string;
  session_id: string;
  created_at: string;
}

interface SessionState {
  state: Record<string, unknown>;
  events: ADKEvent[];
  memory: MemoryEntry[];
  last_update: number;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onToggle: () => void;
}

export default function StateInspector({ isOpen, onToggle }: Props) {
  const [activeTab, setActiveTab] = useState<"state" | "events" | "memory">("state");
  const [sessionData, setSessionData] = useState<SessionState | null>(null);
  const [prevState, setPrevState] = useState<Record<string, unknown>>({});
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [isLive, setIsLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { activeSessionId } = useChatStore();
  const { accessToken } = useAuthStore();

  // ── Fetch session state from ADK via our backend ──
  const fetchState = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/${activeSessionId}/adk-state`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data: SessionState = await res.json();

      // Detect changed keys
      const changed = new Set<string>();
      Object.entries(data.state).forEach(([k, v]) => {
        if (JSON.stringify(prevState[k]) !== JSON.stringify(v)) {
          changed.add(k);
        }
      });
      if (changed.size > 0) {
        setChangedKeys(changed);
        setTimeout(() => setChangedKeys(new Set()), 3000);
      }
      setPrevState(data.state);
      setSessionData(data);
      setIsLive(true);
    } catch {
      setIsLive(false);
    }
  }, [activeSessionId, accessToken, prevState]);

  // ── Poll every 2s when a session is active ──
  useEffect(() => {
    if (!isOpen || !activeSessionId) return;
    fetchState();
    pollRef.current = setInterval(fetchState, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOpen, activeSessionId, fetchState]);

  // ── Refresh on new message ──
  const { isLoading } = useChatStore();
  useEffect(() => {
    if (!isLoading && isOpen && activeSessionId) {
      setTimeout(fetchState, 500);
    }
  }, [isLoading, isOpen, activeSessionId, fetchState]);

  if (!isOpen) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.title}>State Inspector</span>
          <div className={styles.headerRight}>
            {isLive && activeSessionId && (
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />live
              </span>
            )}
            <button className={styles.closeBtn} onClick={onToggle} title="Close inspector">✕</button>
          </div>
        </div>
        <div className={styles.tabs}>
          {(["state", "events", "memory"] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === "events" && sessionData && sessionData.events.length > 0 && (
                <span className={styles.tabCount}>{sessionData.events.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {!activeSessionId ? (
          <EmptyState icon="⬡" text="Start a session to inspect state" />
        ) : !sessionData ? (
          <EmptyState icon="⟳" text="Connecting to ADK..." />
        ) : activeTab === "state" ? (
          <StateTab state={sessionData.state} changedKeys={changedKeys} />
        ) : activeTab === "events" ? (
          <EventsTab events={sessionData.events} />
        ) : (
          <MemoryTab memory={sessionData.memory} />
        )}
      </div>
    </div>
  );
}

// ── State Tab ─────────────────────────────────────────────────────────────────

function StateTab({ state, changedKeys }: { state: Record<string, unknown>; changedKeys: Set<string> }) {
  const entries = Object.entries(state);

  // Group by prefix
  const groups: Record<string, [string, unknown][]> = {
    none: [],
    user: [],
    app: [],
    temp: [],
  };

  entries.forEach(([k, v]) => {
    if (k.startsWith("user:")) groups.user.push([k, v]);
    else if (k.startsWith("app:")) groups.app.push([k, v]);
    else if (k.startsWith("temp:")) groups.temp.push([k, v]);
    else groups.none.push([k, v]);
  });

  const groupConfig = [
    { key: "none",  label: "session state",                    badge: null },
    { key: "user",  label: "user: — persists across sessions", badge: "user" },
    { key: "app",   label: "app: — global across all users",   badge: "app" },
    { key: "temp",  label: "temp: — discarded on next turn",   badge: "temp" },
  ] as const;

  if (entries.length === 0) {
    return <EmptyState icon="∅" text="No state written yet" />;
  }

  return (
    <>
      {groupConfig.map(({ key, label, badge }) => {
        const rows = groups[key];
        if (rows.length === 0) return null;
        return (
          <div key={key} className={styles.stateGroup}>
            <div className={styles.groupLabel}>{label}</div>
            {rows.map(([k, v]) => (
              <StateRow
                key={k}
                stateKey={k}
                value={v}
                badge={badge}
                isChanged={changedKeys.has(k)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function StateRow({
  stateKey, value, badge, isChanged,
}: {
  stateKey: string;
  value: unknown;
  badge: "user" | "app" | "temp" | null;
  isChanged: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isObject = typeof value === "object" && value !== null;
  const displayKey = stateKey.replace(/^(user:|app:|temp:)/, "");
  const displayVal = isObject
    ? JSON.stringify(value)
    : String(value);
  const valType = typeof value === "number" ? "num"
    : typeof value === "boolean" ? "bool"
    : "str";

  return (
    <div
      className={`${styles.stateRow} ${isChanged ? styles.stateRowChanged : ""}`}
      onClick={() => isObject && setExpanded(e => !e)}
    >
      <div className={styles.stateRowTop}>
        {badge && <span className={`${styles.prefixBadge} ${styles["prefix_" + badge]}`}>{badge}:</span>}
        <span className={styles.stateKey}>{displayKey}</span>
        <span className={`${styles.stateVal} ${styles["val_" + valType]}`}>
          {isObject ? (expanded ? "▲ collapse" : `{…} ${Object.keys(value as object).length} keys`) : displayVal}
        </span>
        {isChanged && <span className={styles.deltaBadge}>Δ</span>}
      </div>
      {expanded && isObject && (
        <pre className={styles.stateExpanded}>{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  );
}

// ── Events Tab ────────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  user:        { icon: "U", cls: "eventUser",   label: "user" },
  agent:       { icon: "A", cls: "eventAgent",  label: "agent" },
  tool_call:   { icon: "T", cls: "eventTool",   label: "tool" },
  tool_result: { icon: "R", cls: "eventResult", label: "result" },
  state_delta: { icon: "S", cls: "eventState",  label: "state" },
  transfer:    { icon: "→", cls: "eventXfer",   label: "transfer" },
  error:       { icon: "!", cls: "eventError",  label: "error" },
} as const;

function EventsTab({ events }: { events: ADKEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return <EmptyState icon="○" text="No events yet" />;
  }

  return (
    <>
      {events.map(ev => {
        const cfg = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.agent;
        const time = new Date(ev.timestamp).toLocaleTimeString([], {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        return (
          <div key={ev.id} className={styles.eventRow}>
            <div className={`${styles.eventIcon} ${styles[cfg.cls]}`}>{cfg.icon}</div>
            <div className={styles.eventBody}>
              <div className={styles.eventLabel}>{ev.label}</div>
              {ev.detail && <div className={styles.eventDetail}>{ev.detail}</div>}
            </div>
            <div className={styles.eventTime}>{time}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </>
  );
}

// ── Memory Tab ────────────────────────────────────────────────────────────────

function MemoryTab({ memory }: { memory: MemoryEntry[] }) {
  if (memory.length === 0) {
    return <EmptyState icon="◇" text="No cross-session memories yet" />;
  }
  return (
    <>
      {memory.map((m, i) => (
        <div key={i} className={styles.memoryCard}>
          <div className={styles.memoryMeta}>
            {new Date(m.created_at).toLocaleDateString()} · session {m.session_id.slice(0, 8)}…
          </div>
          <div className={styles.memoryContent}>{m.content}</div>
        </div>
      ))}
    </>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>{icon}</div>
      <div className={styles.emptyText}>{text}</div>
    </div>
  );
}
