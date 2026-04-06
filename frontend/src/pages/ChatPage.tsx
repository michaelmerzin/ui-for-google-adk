import { useEffect } from "react";
import { useChat } from "../hooks/useChat";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/client";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import InputBar from "../components/InputBar";
import Topbar from "../components/Topbar";
import styles from "./ChatPage.module.css";

export default function ChatPage() {
  const { loadSessions, loadMessages } = useChat();
  const { activeSessionId, setActiveSession } = useChatStore();
  const { setUser } = useAuthStore();

  // Load current user
  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data)).catch(() => {});
  }, [setUser]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
  }, [activeSessionId, loadMessages]);

  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar />
        <ChatArea />
        <InputBar />
      </div>
    </div>
  );
}
