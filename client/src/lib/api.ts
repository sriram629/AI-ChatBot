import axios from "axios";
import { toast } from "sonner";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    if (!response) {
      toast.error("Network Error. Please check your connection.");
      return Promise.reject(error);
    }

    if (response.status === 401) {
      if (window.location.pathname !== "/login") {
        toast.error("Session expired. Please login again.");
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    } else if (response.status === 429) {
      toast.warning("You are sending messages too fast. Please wait a moment.");
    } else if (response.status >= 500) {
      toast.error("Server error. We are working on it.");
    } else {
      const message = response.data?.detail || "Something went wrong";
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export const getSocketUrl = (endpoint: string): string => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  if (BASE_URL.startsWith("http")) {
    const urlObj = new URL(BASE_URL);
    const wsProtocol = urlObj.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${urlObj.host}${endpoint}`;
  }

  return `${protocol}//${window.location.host}${endpoint}`;
};
