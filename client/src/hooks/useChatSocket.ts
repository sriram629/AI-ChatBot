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
  const { token } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionKey, setConnectionKey] = useState(0);
  const pendingMessage = useRef<{ content: string; attachment: any } | null>(
    null
  );

  useEffect(() => {
    if (!token || !chatId) {
      setMessages([]);
      return;
    }
    if (pendingMessage.current) return;

    setIsConnecting(true);
    api
      .get(`/api/chat/sessions/${chatId}/messages`)
      .then((res) => {
        const formatted = res.data.map((m: any) => ({
          id: m._id || m.id,
          role: m.role,
          content: m.content,
          attachments: m.attachments || [],
        }));
        setMessages(formatted);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          toast.error("Conversation not found");
          navigate("/chat", { replace: true });
        } else {
          toast.error("Failed to load history");
        }
      })
      .finally(() => setIsConnecting(false));
  }, [chatId, token, navigate]);

  useEffect(() => {
    if (!token || !chatId) return;
    if (socketRef.current) socketRef.current.close();

    const url = getSocketUrl(`/api/chat/ws/${chatId}?token=${token}`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (pendingMessage.current) {
        ws.send(
          JSON.stringify({
            type: "message",
            message: pendingMessage.current.content,
            attachment: pendingMessage.current.attachment,
          })
        );
        pendingMessage.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "start") {
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
            lastMsg.content += data.content;
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

    ws.onclose = () => {
      setIsStreaming(false);
      setStatus(null);
    };

    socketRef.current = ws;
    return () => ws.close();
  }, [token, chatId, connectionKey]);

  const sendMessage = useCallback(
    async (content: string, attachment: any = null) => {
      if (!content.trim() && !attachment) return;
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
          pendingMessage.current = { content, attachment };
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
    [chatId, navigate]
  );

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      toast.error("Connection lost");
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
  }, []);

  const regenerateResponse = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    setIsStreaming(true);
    setMessages((prev) =>
      prev.length > 0 && prev[prev.length - 1].role === "assistant"
        ? prev.slice(0, -1)
        : prev
    );
    socketRef.current.send(JSON.stringify({ type: "regenerate" }));
  }, []);

  const stopGeneration = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      setIsStreaming(false);
      setStatus(null);
      setConnectionKey((prev) => prev + 1);
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
  };
};
