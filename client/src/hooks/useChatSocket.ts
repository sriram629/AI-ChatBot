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
          id: Date.now().toString(), // Temp ID
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
        const tempId = Date.now().toString();
        // Send pending message with tempId
        ws.send(
          JSON.stringify({
            type: "message",
            message: pendingMessage.current,
            tempId: tempId,
          })
        );

        // Update UI with tempId so we can swap it later
        setMessages([
          {
            id: tempId,
            role: "user",
            content: pendingMessage.current,
          },
        ]);

        pendingMessage.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 🟢 1. HANDLE ID UPDATE (Swap Temp ID -> Real ID)
      if (data.type === "id_update") {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === data.tempId) {
              return { ...msg, id: data.realId };
            }
            return msg;
          })
        );
      } else if (data.type === "start") {
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
      const tempId = Date.now().toString(); // Generate Temp ID

      // Optimistic Update
      setMessages((prev) => [...prev, { id: tempId, role: "user", content }]);

      if (chatId && socketRef.current?.readyState === WebSocket.OPEN) {
        // Send with Temp ID
        socketRef.current.send(
          JSON.stringify({
            type: "message",
            message: content,
            tempId: tempId,
          })
        );
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

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Connection lost.");
      return;
    }

    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      if (index === -1) return prev;
      const newHistory = prev.slice(0, index + 1);
      newHistory[index] = { ...newHistory[index], content: newContent };
      return newHistory;
    });

    socketRef.current.send(
      JSON.stringify({
        type: "edit",
        messageId: messageId,
        newContent: newContent,
      })
    );
  }, []);

  return { messages, sendMessage, editMessage, isStreaming, isConnecting };
};
