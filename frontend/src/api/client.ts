import axios from "axios";
import { useAuthStore } from "../store/authStore";

const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
export const API_BASE_URL = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: try refresh token, retry once
let refreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    if (refreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    refreshing = true;
    try {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      setTokens(data.access_token, data.refresh_token);
      queue.forEach((cb) => cb(data.access_token));
      queue = [];

      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch {
      useAuthStore.getState().logout();
      return Promise.reject(err);
    } finally {
      refreshing = false;
    }
  }
);

export default api;

// ── typed helpers ─────────────────────────────────────────────────────────────

export interface UserOut {
  id: number;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  session_count: number;
}

export interface SessionOut {
  id: string;
  title: string;
  model: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface MessageOut {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_name: string | null;
  created_at: string;
}

export interface DependencyHealth {
  configured: boolean;
  reachable: boolean;
  healthy: boolean;
  status_code: number | null;
  latency_ms: number | null;
  checked_url: string | null;
  error: string | null;
}

export interface HealthOut {
  status: "ok" | "degraded" | "down";
  backend: {
    healthy: boolean;
    version: string;
  };
  adk: DependencyHealth;
  litellm: DependencyHealth;
  adk_version: string;
  litellm_version: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string }>("/auth/login", {
      username,
      password,
    }),
  me: () => api.get<UserOut>("/auth/me"),
};

export const usersApi = {
  list: () => api.get<UserOut[]>("/users/"),
  create: (body: { username: string; password: string; role: string }) =>
    api.post<UserOut>("/users/", body),
  update: (id: number, body: { role?: string; is_active?: boolean; password?: string }) =>
    api.patch<UserOut>(`/users/${id}`, body),
  remove: (id: number) => api.delete(`/users/${id}`),
};

export const sessionsApi = {
  list: () => api.get<SessionOut[]>("/sessions/"),
  create: (title?: string, model?: string) =>
    api.post<SessionOut>("/sessions/", { title: title ?? "New Session", model: model ?? "gpt-4o" }),
  update: (id: string, body: { title?: string; model?: string }) =>
    api.patch<SessionOut>(`/sessions/${id}`, body),
  remove: (id: string) => api.delete(`/sessions/${id}`),
  messages: (id: string) => api.get<MessageOut[]>(`/sessions/${id}/messages`),
};

export const chatApi = {
  models: () => api.get<{ models: string[] }>("/chat/models"),
  send: (session_id: string, message: string, model: string) =>
    api.post<{ content: string; tool_name: string | null }>("/chat/send", {
      session_id,
      message,
      model,
    }),
};

export const systemApi = {
  health: () => api.get<HealthOut>("/health"),
};
