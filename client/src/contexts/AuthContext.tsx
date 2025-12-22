/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  userEmail: string | null;
  firstName: string | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (
    email: string,
    pass: string,
    first: string,
    last: string
  ) => Promise<void>;
  verifyEmail: (otp: string) => Promise<void>;
  requestPasswordReset: (email: string, newPass: string) => Promise<void>;
  confirmPasswordReset: (
    email: string,
    otp: string,
    newPass: string
  ) => Promise<void>;
  loginWithGoogle: (accessToken: string) => Promise<void>;
  loginWithGithub: (code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token;

  const fetchUser = async () => {
    try {
      const res = await api.get("/api/auth/me");
      setUserEmail(res.data.email);
      setFirstName(res.data.first_name);
    } catch (error) {
      console.error("Failed to fetch user details", error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (token) {
        await fetchUser();
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, [token]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await api.post("/api/auth/login", { email, password: pass });
      const accessToken = res.data.access_token;
      localStorage.setItem("token", accessToken);
      setToken(accessToken);

      await fetchUser();
      toast.success("Welcome back!");
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error("Please verify your email first.");
        setUserEmail(email);
      } else {
        toast.error("Invalid credentials");
      }
      throw error;
    }
  };

  const register = async (
    email: string,
    pass: string,
    first: string,
    last: string
  ) => {
    try {
      await api.post("/api/auth/register", {
        email,
        password: pass,
        first_name: first,
        last_name: last,
      });
      setUserEmail(email);
      toast.success("OTP sent to your email!");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Registration failed");
      throw error;
    }
  };

  const verifyEmail = async (otp: string) => {
    if (!userEmail) throw new Error("No email found");
    try {
      const res = await api.post("/api/auth/verify-email", {
        email: userEmail,
        otp,
      });
      const accessToken = res.data.access_token;
      localStorage.setItem("token", accessToken);
      setToken(accessToken);

      await fetchUser();
      toast.success("Verified! Logging in...");
    } catch (error: any) {
      toast.error("Invalid OTP");
      throw error;
    }
  };

  const requestPasswordReset = async (email: string, newPass: string) => {
    await api.post("/api/auth/forgot-password", {
      email,
      new_password: newPass,
    });
    setUserEmail(email);
    toast.success("OTP Sent!");
  };

  const confirmPasswordReset = async (
    email: string,
    otp: string,
    newPass: string
  ) => {
    await api.post("/api/auth/reset-password-confirm", {
      email,
      otp,
      new_password: newPass,
    });
    toast.success("Password Reset Successfully");
  };

  const loginWithGoogle = async (accessToken: string) => {
    try {
      const res = await api.post("/api/auth/google", { token: accessToken });
      const jwt = res.data.access_token;
      localStorage.setItem("token", jwt);
      setToken(jwt);
      await fetchUser();
      toast.success("Logged in with Google!");
    } catch (e) {
      toast.error("Google Login Failed");
      throw e;
    }
  };

  const loginWithGithub = async (code: string) => {
    try {
      const res = await api.post("/api/auth/github", { code });
      const jwt = res.data.access_token;
      localStorage.setItem("token", jwt);
      setToken(jwt);
      await fetchUser();
      toast.success("Logged in with GitHub!");
    } catch (e) {
      toast.error("GitHub Login Failed");
      throw e;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUserEmail(null);
    setFirstName(null);
    toast.info("Logged out");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        token,
        userEmail,
        firstName,
        login,
        register,
        verifyEmail,
        requestPasswordReset,
        confirmPasswordReset,
        loginWithGoogle,
        loginWithGithub,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
