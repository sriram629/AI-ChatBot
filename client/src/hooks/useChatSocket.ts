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
  const [connectionKey, setConnectionKey] = useState(0);

  // 1. Fetch History
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

  // 2. Socket Connection
  useEffect(() => {
    if (!token || !chatId) return;
    if (socketRef.current) socketRef.current.close();

    const url = getSocketUrl(`/api/chat/ws/${chatId}`);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (pendingMessage.current) {
        const tempId = Date.now().toString();
        ws.send(
          JSON.stringify({
            type: "message",
            message: pendingMessage.current,
            tempId,
          })
        );
        // We don't setMessages here because sendMessage already did it
        pendingMessage.current = null;
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "id_update") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.tempId ? { ...msg, id: data.realId } : msg
          )
        );
      } else if (data.type === "start") {
        // Backend confirms it started processing
        // We ensure a bubble exists (if not created by sendMessage logic yet)
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id === "ai-response")
            return prev; // Already there
          return [
            ...prev,
            { id: "ai-response", role: "assistant", content: "" },
          ];
        });
      } else if (data.type === "chunk") {
        setMessages((prev) => {
          const newArr = [...prev];
          const lastMsg = newArr[newArr.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content += data.content;
          }
          return newArr;
        });
      } else if (data.type === "edit_chunk") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.id
              ? { ...msg, content: msg.content + data.content }
              : msg
          )
        );
      } else if (data.type === "end") {
        setIsStreaming(false);
      }
    };

    ws.onerror = () => {
      setIsStreaming(false);
    };

    socketRef.current = ws;
    return () => ws.close();
  }, [token, chatId, connectionKey]);

  // 3. Send Message
  const sendMessage = useCallback(
    async (content: string) => {
      const tempId = Date.now().toString();
      setMessages((prev) => [...prev, { id: tempId, role: "user", content }]);

      // 🟢 START LOADING IMMEDIATELY (So Stop button appears)
      setIsStreaming(true);

      if (chatId && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({ type: "message", message: content, tempId })
        );
        return;
      }

      if (chatId && socketRef.current?.readyState !== WebSocket.OPEN) {
        pendingMessage.current = content;
        setConnectionKey((prev) => prev + 1);
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
          setIsStreaming(false);
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
    setIsStreaming(true); // Start loading UI
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      if (index === -1) return prev;
      const newHistory = prev.slice(0, index + 1);
      newHistory[index] = { ...newHistory[index], content: newContent };
      return newHistory;
    });
    socketRef.current.send(
      JSON.stringify({ type: "edit", messageId, newContent })
    );
  }, []);

  const regenerateResponse = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)
      return;
    setIsStreaming(true); // Start loading UI
    setMessages((prev) =>
      prev.length > 0 && prev[prev.length - 1].role === "assistant"
        ? prev.slice(0, -1)
        : prev
    );
    socketRef.current.send(JSON.stringify({ type: "regenerate" }));
  }, []);

  // 🟢 IMPROVED STOP FUNCTION
  const stopGeneration = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      setIsStreaming(false);

      setMessages((prev) => {
        if (prev.length === 0) return prev;

        const lastMsg = prev[prev.length - 1];

        // CASE 1: AI has started typing (or is just an empty bubble)
        if (lastMsg.role === "assistant") {
          // If it's empty, user stopped during "Thinking..."
          const newContent =
            lastMsg.content.trim() === ""
              ? "Generation stopped by user."
              : lastMsg.content;

          // Update the last message
          const newArr = [...prev];
          newArr[newArr.length - 1] = { ...lastMsg, content: newContent };
          return newArr;
        }

        // CASE 2: Last message was User (AI hasn't even started "Thinking" bubble yet)
        if (lastMsg.role === "user") {
          return [
            ...prev,
            {
              id: "stopped-" + Date.now(),
              role: "assistant",
              content: "Generation stopped by user.",
            },
          ];
        }

        return prev;
      });

      // Force reconnect for next message
      setConnectionKey((prev) => prev + 1);
      toast.info("Stopped");
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
  };
};
