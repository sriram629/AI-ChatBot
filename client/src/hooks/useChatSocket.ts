/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api, getSocketUrl } from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const useChatSocket = (chatId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { token } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const pendingMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !chatId) {
      setMessages([]);
      return;
    }

    if (pendingMessage.current) {
      setMessages([
        {
          id: Date.now().toString(),
          role: "user",
          content: pendingMessage.current,
        },
      ]);
      return;
    }

    setIsConnecting(true);
    api
      .get(`/api/chat/sessions/${chatId}/messages`)
      .then((res) => {
        const formatted = res.data.map((m: any) => ({
          id: m._id,
          role: m.role,
          content: m.content,
        }));
        setMessages(formatted);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsConnecting(false));
  }, [chatId, token]);

  useEffect(() => {
    if (!token || !chatId) return;

    if (socketRef.current) socketRef.current.close();

    const url = getSocketUrl(`/api/chat/ws/${chatId}`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (pendingMessage.current) {
        ws.send(JSON.stringify({ message: pendingMessage.current }));
        pendingMessage.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "start") {
        setIsStreaming(true);
        setMessages((prev) => [
          ...prev,
          { id: "ai-response", role: "assistant", content: "" },
        ]);
      } else if (data.type === "chunk") {
        setMessages((prev) => {
          const newArr = [...prev];
          const lastMsg = newArr[newArr.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content += data.content;
          }
          return newArr;
        });
      } else if (data.type === "end") {
        setIsStreaming(false);
      }
    };

    socketRef.current = ws;
    return () => ws.close();
  }, [token, chatId]);

  const sendMessage = useCallback(
    async (content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content },
      ]);

      if (chatId && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ message: content }));
        return;
      }

      if (!chatId) {
        try {
          pendingMessage.current = content;
          const res = await api.post("/api/chat/sessions");
          navigate(`/chat/${res.data.session_id}`, { replace: true });
        } catch (e) {
          toast.error("Failed to start chat");
          pendingMessage.current = null;
        }
      }
    },
    [chatId, token, navigate]
  );

  return { messages, sendMessage, isStreaming, isConnecting };
};
