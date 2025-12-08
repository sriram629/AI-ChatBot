/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, X, ArrowDown, LogOut, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import logo from "@/assets/transparent-logo.png";
import { useChatSocket } from "@/hooks/useChatSocket";
import axios from "axios";
import { cn } from "@/lib/utils";

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { isAuthenticated, logout, firstName, userEmail, token } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const {
    messages,
    sendMessage,
    editMessage,
    regenerateResponse,
    stopGeneration,
    isStreaming,
    isConnecting,
  } = useChatSocket(chatId);

  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && !chatId) {
      const createSession = async () => {
        try {
          const res = await axios.post(
            "http://127.0.0.1:8000/api/chat/sessions",
            {},
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          navigate(`/chat/${res.data.session_id}`, { replace: true });
        } catch (e) {
          console.error(e);
        }
      };
    }
  }, [isAuthenticated, chatId, navigate, token]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll, isAuthenticated]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
    setAutoScroll(isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  const handleSendMessage = (content: string, attachment: any) => {
    sendMessage(content, attachment);
    setAutoScroll(true);
  };

  const handleEditMessage = (id: string, newContent: string) => {
    editMessage(id, newContent);
    setAutoScroll(true);
  };

  if (!isAuthenticated) return null;

  const isNewChat = !isConnecting && messages.length === 0;
  const userInitial = firstName
    ? firstName.charAt(0).toUpperCase()
    : userEmail?.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {!isMobile && (
        <ChatSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={chatId}
        />
      )}

      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              isOpen={true}
              onToggle={() => setSidebarOpen(false)}
              currentChatId={chatId}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative transition-all duration-300">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20 h-16 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-lg font-semibold truncate">AI Chat</h1>
          </div>

          <div className="relative" ref={profileRef}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 bg-secondary/80 border border-border overflow-hidden"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <span className="text-sm font-semibold">{userInitial}</span>
            </Button>

            {isProfileOpen && (
              <div className="absolute right-0 top-12 w-64 bg-card border border-border shadow-lg rounded-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="font-semibold text-sm truncate">
                    {firstName || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userEmail}
                  </p>
                </div>

                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 relative flex flex-col min-h-0">
          {isNewChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl">
                <img src={logo} alt="AI" className="w-20 h-20" />
                <h2 className="text-3xl font-semibold text-foreground text-center">
                  Hi {firstName ? firstName.toUpperCase() : "THERE"}
                </h2>
                <div className="w-full mt-2">
                  <ChatInput
                    onSend={handleSendMessage}
                    disabled={isStreaming}
                    className="shadow-md"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea
                className="flex-1 h-full w-full"
                onScroll={handleScroll}
                viewportRef={scrollViewportRef}
              >
                <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 pb-32 flex flex-col gap-6">
                  {isConnecting && messages.length === 0 && (
                    <div className="space-y-8 p-4 opacity-50">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-muted shrink-0"></div>
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-muted rounded w-1/3"></div>
                            <div className="h-4 bg-muted rounded w-2/3"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {messages.map((message, index) => {
                    const isLastMessage = index === messages.length - 1;
                    const isLoading =
                      isStreaming &&
                      isLastMessage &&
                      message.role === "assistant";
                    const canRegenerate =
                      isLastMessage &&
                      message.role === "assistant" &&
                      !isStreaming;

                    return (
                      <ChatMessage
                        key={message.id || index}
                        role={message.role}
                        content={message.content}
                        attachments={message.attachments}
                        isLoading={isLoading}
                        onEdit={
                          message.role === "user"
                            ? (newContent) =>
                                handleEditMessage(message.id, newContent)
                            : undefined
                        }
                        onRegenerate={
                          canRegenerate ? regenerateResponse : undefined
                        }
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {showScrollButton && (
                <Button
                  onClick={scrollToBottom}
                  size="icon"
                  className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-30 bg-secondary hover:bg-secondary/80 border border-border animate-in fade-in"
                >
                  <ArrowDown className="h-5 w-5" />
                </Button>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-20 pb-6">
                <div className="max-w-5xl mx-auto w-full">
                  <ChatInput
                    onSend={handleSendMessage}
                    isStreaming={isStreaming}
                    onStop={stopGeneration}
                    className="shadow-lg"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
