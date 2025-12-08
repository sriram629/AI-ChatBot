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
  const { token } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const pendingMessage = useRef<{ content: string; attachment: any } | null>(
    null
  );

  const [connectionKey, setConnectionKey] = useState(0);

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
          content: pendingMessage.current.content,
          attachments: pendingMessage.current.attachment
            ? [pendingMessage.current.attachment]
            : [],
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
          attachments: m.attachments || [],
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
        ws.send(
          JSON.stringify({
            type: "message",
            message: pendingMessage.current.content,
            attachment: pendingMessage.current.attachment,
            tempId: tempId,
          })
        );

        setMessages([
          {
            id: tempId,
            role: "user",
            content: pendingMessage.current.content,
            attachments: pendingMessage.current.attachment
              ? [pendingMessage.current.attachment]
              : [],
          },
        ]);

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
        setIsStreaming(true);
        if (!data.isEdit)
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

    socketRef.current = ws;
    return () => ws.close();
  }, [token, chatId, connectionKey]);

  const sendMessage = useCallback(
    async (content: string, attachment: any = null) => {
      const tempId = Date.now().toString();

      const newMsg: Message = {
        id: tempId,
        role: "user",
        content,
        attachments: attachment ? [attachment] : [],
      };

      setMessages((prev) => [...prev, newMsg]);
      setIsStreaming(true);

      if (chatId && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "message",
            message: content,
            attachment: attachment,
            tempId: tempId,
          })
        );
        return;
      }

      if (chatId && socketRef.current?.readyState !== WebSocket.OPEN) {
        pendingMessage.current = { content, attachment };
        setConnectionKey((prev) => prev + 1);
        return;
      }

      if (!chatId) {
        try {
          pendingMessage.current = { content, attachment };
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
      toast.error("Connection lost. Refreshing...");
      setConnectionKey((prev) => prev + 1);
      return;
    }
    setIsStreaming(true);
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
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Connection lost. Try again.");
      setConnectionKey((prev) => prev + 1);
      return;
    }
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

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const lastMsg = prev[prev.length - 1];

        if (lastMsg.role === "assistant") {
          const newContent =
            lastMsg.content.trim() === ""
              ? "Generation stopped by user."
              : lastMsg.content;
          const newArr = [...prev];
          newArr[newArr.length - 1] = { ...lastMsg, content: newContent };
          return newArr;
        }

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
