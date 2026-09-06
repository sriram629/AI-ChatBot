/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api, getSocketUrl } from "@/lib/api";

export interface Attachment {
  type: "image" | "file";
  url?: string;
  filename: string;
  preview?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export const useChatSocket = (chatId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const { token } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionKey, setConnectionKey] = useState(0);
  const pendingMessage = useRef<{ content: string; attachment: any; tempId: string } | null>(
    null
  );

  useEffect(() => {
    if (!token || !chatId) {
      setMessages([]);
      return;
    }
    if (pendingMessage.current) return;

    let active = true;
    setIsConnecting(true);
    api
      .get(`/api/chat/sessions/${chatId}/messages`)
      .then((res) => {
        if (!active) return;
        const formatted = res.data.map((m: any) => ({
          id: m._id || m.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments || [],
        }));
        setMessages(formatted);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 404) {
          toast.error("Conversation not found");
          navigate("/chat", { replace: true });
        } else {
          toast.error("Failed to load history");
        }
      })
      .finally(() => { if (active) setIsConnecting(false); });
    return () => { active = false; };
  }, [chatId, token, navigate]);

  useEffect(() => {
    if (!token || !chatId) return;
    if (socketRef.current) socketRef.current.close();

    const url = getSocketUrl(`/api/chat/ws/${chatId}?token=${token}`);
    setConnection(navigator.onLine ? "connecting" : "offline");
    const ws = new WebSocket(url);
    setModel(null);

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    ws.onopen = () => {
      if (disposed) return;
      setConnection("connected");
      setIsConnecting(false);
      if (pendingMessage.current) {
        setIsStreaming(true);
        ws.send(
          JSON.stringify({
            type: "message",
            message: pendingMessage.current.content,
            attachment: pendingMessage.current.attachment,
            tempId: pendingMessage.current.tempId,
          })
        );
        pendingMessage.current = null;
      }
    };

    ws.onmessage = (event) => {
      if (disposed) return;
      let data;
      try { data = JSON.parse(event.data); } catch { setError("An unreadable response arrived. Please try again."); setIsStreaming(false); return; }
      if (data.type === "model") {
        if (["Gemini", "Groq", "Mistral"].includes(data.content)) setModel(data.content);
        setStatus(null);
        return;
      }
      if (data.type === "error") {
        setIsStreaming(false);
        setStatus(null);
        setError(data.content || "Chat failed. Please try again.");
        return;
      }
      if (data.type === "start") {
        setError(null);
        setIsStreaming(true);
        setStatus(null);
        setMessages((prev) => [
          ...prev,
          { id: "ai-response", role: "assistant", content: "" },
        ]);
      } else if (data.type === "status") {
        setStatus(data.content);
      } else if (data.type === "chunk") {
        setStatus(null);
        setMessages((prev) => {
          const newArr = [...prev];
          const lastMsg = newArr[newArr.length - 1];
          if (lastMsg && lastMsg.role === "assistant")
            newArr[newArr.length - 1] = { ...lastMsg, content: lastMsg.content + data.content };
          return newArr;
        });
      } else if (data.type === "end") {
        setIsStreaming(false);
        setStatus(null);
      } else if (data.type === "id_update") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.tempId ? { ...m, id: data.realId } : m
          )
        );
      } else if (data.type === "title_update") {
        window.dispatchEvent(new Event("session-updated"));
      }
    };

    ws.onclose = (event) => {
      if (disposed) return;
      setIsStreaming(false);
      setStatus(null);
      setConnection(navigator.onLine ? "reconnecting" : "offline");
      if (event.code !== 1008) {
        reconnectTimer = setTimeout(() => setConnectionKey((key) => key + 1), 3000);
      } else {
        setConnection("closed");
        setError("Session access denied. Please sign in again.");
      }
    };

    const offline = () => setConnection("offline");
    const online = () => { if (ws.readyState !== WebSocket.OPEN) setConnectionKey(key => key + 1); else setConnection("connected"); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    socketRef.current = ws;
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      disposed = true;
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, [token, chatId, connectionKey]);

  const sendMessage = useCallback(
    async (content: string, attachment: any = null) => {
      if ((!content.trim() && !attachment) || isStreaming || pendingMessage.current) return;
      setError(null);
      const tempId = Date.now().toString();

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          role: "user",
          content,
          attachments: attachment ? [attachment] : [],
        },
      ]);
      setIsStreaming(true);

      if (chatId && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "message",
            message: content,
            attachment,
            tempId,
          })
        );
      } else {
        try {
          pendingMessage.current = { content, attachment, tempId };
          if (chatId) {
            setStatus("Reconnecting...");
            if (socketRef.current?.readyState !== WebSocket.CONNECTING) {
              setConnectionKey((key) => key + 1);
            }
            return;
          }
          const res = await api.post("/api/chat/sessions");
          navigate(`/chat/${res.data.session_id}`, { replace: true });
          window.dispatchEvent(new Event("session-updated"));
        } catch (e) {
          toast.error("Failed to start session");
          setIsStreaming(false);
          pendingMessage.current = null;
        }
      }
    },
    [chatId, navigate, isStreaming]
  );

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (isStreaming || socketRef.current?.readyState !== WebSocket.OPEN) {
      toast.error("Wait for the current response or reconnect");
      return;
    }

    setIsStreaming(true);
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      if (index === -1) return prev;
      const truncated = prev.slice(0, index + 1);
      truncated[index] = { ...truncated[index], content: newContent };
      return truncated;
    });

    socketRef.current.send(
      JSON.stringify({ type: "edit", messageId, newContent })
    );
  }, [isStreaming]);

  const regenerateResponse = useCallback(() => {
    if (isStreaming || socketRef.current?.readyState !== WebSocket.OPEN) return;
    setIsStreaming(true);
    setMessages((prev) =>
      prev.length > 0 && prev[prev.length - 1].role === "assistant"
        ? prev.slice(0, -1)
        : prev
    );
    socketRef.current.send(JSON.stringify({ type: "regenerate" }));
  }, [isStreaming]);

  const stopGeneration = useCallback(() => {
    pendingMessage.current = null;
    setIsStreaming(false);
    setStatus(null);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  return {
    messages,
    sendMessage,
    editMessage,
    regenerateResponse,
    stopGeneration,
    isStreaming,
    isConnecting,
    status,
    model,
    connection,
    error,
    dismissError: () => setError(null),
  };
};
