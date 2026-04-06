import { useState } from "react";
import styles from "./AgentSteps.module.css";

export interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "agent_transfer" | "error";
  label: string;       // e.g. "search_web"
  detail?: string;     // e.g. the args or result summary
  durationMs?: number;
}

interface Props {
  steps: AgentStep[];
  isStreaming: boolean;
}

export default function AgentSteps({ steps, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const toolCalls = steps.filter(s => s.type === "tool_call").length;
  const summary = toolCalls > 0
    ? `Used ${toolCalls} tool${toolCalls !== 1 ? "s" : ""}`
    : "Reasoning steps";

  return (
    <div className={styles.root}>
      {/* Collapsed toggle */}
      <button
        className={`${styles.toggle} ${isStreaming ? styles.streaming : ""}`}
        onClick={() => !isStreaming && setExpanded(e => !e)}
      >
        <div className={styles.toggleLeft}>
          {isStreaming ? (
            <span className={styles.spinnerWrap}>
              <span className={styles.spinner} />
            </span>
          ) : (
            <span className={styles.doneIcon}>✓</span>
          )}
          <span className={styles.toggleLabel}>
            {isStreaming ? "Working…" : summary}
          </span>
          {!isStreaming && (
            <span className={styles.stepCount}>{steps.length} steps</span>
          )}
        </div>
        {!isStreaming && (
          <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {/* Expanded steps list */}
      {(expanded || isStreaming) && (
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <StepRow key={i} step={step} isLast={i === steps.length - 1 && isStreaming} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);

  const icon = {
    thinking:       "💭",
    tool_call:      "🔧",
    tool_result:    "✓",
    agent_transfer: "→",
    error:          "⚠️",
  }[step.type];

  const colorClass = {
    thinking:       styles.colorThink,
    tool_call:      styles.colorTool,
    tool_result:    styles.colorResult,
    agent_transfer: styles.colorTransfer,
    error:          styles.colorError,
  }[step.type];

  return (
    <div className={`${styles.step} ${isLast ? styles.stepLast : ""}`}>
      <div className={styles.stepLine}>
        <span className={`${styles.stepIcon} ${colorClass}`}>{icon}</span>
        <span className={`${styles.stepLabel} ${colorClass}`}>{step.label}</span>
        {step.durationMs !== undefined && (
          <span className={styles.stepDuration}>{step.durationMs}ms</span>
        )}
        {step.detail && (
          <button
            className={styles.detailToggle}
            onClick={() => setDetailOpen(o => !o)}
          >
            {detailOpen ? "hide" : "details"}
          </button>
        )}
      </div>
      {detailOpen && step.detail && (
        <pre className={styles.stepDetail}>{step.detail}</pre>
      )}
    </div>
  );
}
