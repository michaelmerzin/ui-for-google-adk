import { useState, useEffect } from "react";
import { X, Settings, Save } from "lucide-react";
import toast from "react-hot-toast";
import styles from "./Modal.module.css";

const STORAGE_KEY = "adk-studio-config";

export interface AppConfig {
  litellmBaseUrl: string;
  litellmApiKey: string;
  adkBaseUrl: string;
  adkAgentName: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

const DEFAULTS: AppConfig = {
  litellmBaseUrl: "http://localhost:4000",
  litellmApiKey: "",
  adkBaseUrl: "http://localhost:8000",
  adkAgentName: "root_agent",
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: "You are a helpful AI assistant powered by Google ADK and LiteLLM.",
};

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

interface Props {
  onClose: () => void;
}

export default function ConfigModal({ onClose }: Props) {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULTS);

  useEffect(() => {
    setCfg(loadConfig());
  }, []);

  function set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    toast.success("Configuration saved");
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Settings size={16} /> Configuration
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.configBody}>
          {/* LiteLLM */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>LiteLLM</div>
            <div className={styles.configGrid}>
              <div className={styles.configField}>
                <label>Base URL</label>
                <input
                  value={cfg.litellmBaseUrl}
                  onChange={(e) => set("litellmBaseUrl", e.target.value)}
                  placeholder="http://localhost:4000"
                />
              </div>
              <div className={styles.configField}>
                <label>API Key</label>
                <input
                  type="password"
                  value={cfg.litellmApiKey}
                  onChange={(e) => set("litellmApiKey", e.target.value)}
                  placeholder="sk-••••••••"
                />
              </div>
            </div>
          </div>

          {/* Google ADK */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Google ADK</div>
            <div className={styles.configGrid}>
              <div className={styles.configField}>
                <label>API URL</label>
                <input
                  value={cfg.adkBaseUrl}
                  onChange={(e) => set("adkBaseUrl", e.target.value)}
                  placeholder="http://localhost:8000"
                />
              </div>
              <div className={styles.configField}>
                <label>Agent Name</label>
                <input
                  value={cfg.adkAgentName}
                  onChange={(e) => set("adkAgentName", e.target.value)}
                  placeholder="root_agent"
                />
              </div>
            </div>
          </div>

          {/* Generation params */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Generation</div>
            <div className={styles.configGrid}>
              <div className={styles.configField}>
                <label>Max Tokens</label>
                <input
                  type="number"
                  value={cfg.maxTokens}
                  onChange={(e) => set("maxTokens", Number(e.target.value))}
                  min={256}
                  max={32768}
                />
              </div>
              <div className={styles.configField}>
                <label>Temperature</label>
                <input
                  type="number"
                  value={cfg.temperature}
                  onChange={(e) => set("temperature", Number(e.target.value))}
                  min={0}
                  max={2}
                  step={0.05}
                />
              </div>
            </div>
          </div>

          {/* System prompt */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>System Prompt</div>
            <textarea
              className={styles.systemPrompt}
              value={cfg.systemPrompt}
              onChange={(e) => set("systemPrompt", e.target.value)}
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>
            <Save size={14} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
