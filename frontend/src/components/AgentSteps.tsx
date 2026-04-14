import { useState } from "react";
import styles from "./AgentSteps.module.css";

export interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "agent_transfer" | "error";
  label: string;
  detail?: string;
  durationMs?: number;
}

interface Props {
  steps: AgentStep[];
  isStreaming: boolean;
}

export default function AgentSteps({ steps, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const toolCalls = steps.filter((step) => step.type === "tool_call").length;
  const summary = toolCalls > 0
    ? `Used ${toolCalls} tool${toolCalls !== 1 ? "s" : ""}`
    : "Reasoning steps";

  return (
    <div className={styles.root}>
      <button
        className={`${styles.toggle} ${isStreaming ? styles.streaming : ""}`}
        onClick={() => !isStreaming && setExpanded((open) => !open)}
      >
        <div className={styles.toggleLeft}>
          {isStreaming ? (
            <span className={styles.spinnerWrap}>
              <span className={styles.spinner} />
            </span>
          ) : (
            <span className={styles.doneIcon}>OK</span>
          )}
          <span className={styles.toggleLabel}>
            {isStreaming ? "Working..." : summary}
          </span>
          {!isStreaming && (
            <span className={styles.stepCount}>{steps.length} steps</span>
          )}
        </div>
        {!isStreaming && (
          <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {(expanded || isStreaming) && (
        <div className={styles.steps}>
          {steps.map((step, index) => (
            <StepRow key={index} step={step} isLast={index === steps.length - 1 && isStreaming} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  const [detailOpen, setDetailOpen] = useState(false);

  const icon = {
    thinking: "TH",
    tool_call: "TL",
    tool_result: "OK",
    agent_transfer: "->",
    error: "!!",
  }[step.type];

  const colorClass = {
    thinking: styles.colorThink,
    tool_call: styles.colorTool,
    tool_result: styles.colorResult,
    agent_transfer: styles.colorTransfer,
    error: styles.colorError,
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
            onClick={() => setDetailOpen((open) => !open)}
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
