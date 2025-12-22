import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatSession {
  session_id: string;
  user_email: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const useSessions = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get("/api/chat/sessions");
      setSessions(res.data);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchSessions();
    };

    window.addEventListener("session-updated", handleUpdate);
    return () => window.removeEventListener("session-updated", handleUpdate);
  }, [fetchSessions]);

  return { sessions, isLoading, refetch: fetchSessions };
};
