import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import { useAuthStore } from "../store/authStore";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setUser, accessToken } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (accessToken) navigate("/", { replace: true });
    userRef.current?.focus();
  }, [accessToken, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await authApi.login(username, password);
      setTokens(data.access_token, data.refresh_token);
      const { data: me } = await authApi.me();
      setUser(me);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Invalid credentials");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      <div className={`${styles.card} animate-fade-up`}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>⬡</div>
          <div>
            <div className={styles.logoName}>ADK Studio</div>
            <div className={styles.logoSub}>google-adk 1.25.1 · litellm 1.82.0</div>
          </div>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your agent workspace</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <label className={styles.field}>
            <span className={styles.label}>Username</span>
            <input
              ref={userRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className={styles.input}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className={styles.input}
              required
            />
          </label>

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              "Sign in →"
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.badge}>google-adk 1.25.1</span>
          <span className={styles.badge}>litellm 1.82.0</span>
          <span className={styles.badge}>FastAPI</span>
        </div>
      </div>
    </div>
  );
}
