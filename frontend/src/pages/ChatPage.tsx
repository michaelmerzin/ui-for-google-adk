import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useChatStore } from "../store/chatStore";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/client";
import Sidebar from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import InputBar from "../components/InputBar";
import Topbar from "../components/Topbar";
import StateInspector from "../components/StateInspector";
import styles from "./ChatPage.module.css";

export default function ChatPage() {
  const navigate = useNavigate();
  const { loadSessions, loadMessages } = useChat();
  const { activeSessionId } = useChatStore();
  const { setUser, logout } = useAuthStore();
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    authApi.me()
      .then(({ data }) => setUser(data))
      .catch(() => { logout(); navigate("/login", { replace: true }); });
  }, [setUser, logout, navigate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
  }, [activeSessionId, loadMessages]);

  return (
    <div className={styles.root}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen(o => !o)}
        />
        <div className={styles.chatWrapper}>
          <div className={styles.chatCol}>
            <ChatArea />
            <InputBar />
          </div>
          <StateInspector
            isOpen={inspectorOpen}
            onToggle={() => setInspectorOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}