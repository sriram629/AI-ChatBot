/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import logo from "@/assets/transparent-logo.png";
import { useChatSocket } from "@/hooks/useChatSocket";
import { Skeleton } from "@/components/ui/skeleton";

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { isAuthenticated, logout, firstName, userEmail } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    editMessage,
    regenerateResponse,
    stopGeneration,
    isStreaming,
    isConnecting,
    status,
  } = useChatSocket(chatId);

  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  // Trigger sidebar refresh when the first message is successfully added
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "user") {
      window.dispatchEvent(new Event("refresh-sessions"));
    }
  }, [messages.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
    setAutoScroll(isNearBottom);
  };

  const handleSendMessage = async (content: string, attachment?: any) => {
    await sendMessage(content, attachment);
    window.dispatchEvent(new Event("refresh-sessions"));
  };

  if (!isAuthenticated) return null;

  const isNewChat = !chatId || (messages.length === 0 && !isConnecting);
  const userInitial = firstName
    ? firstName[0].toUpperCase()
    : userEmail?.[0].toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentChatId={chatId}
      />

      {sidebarOpen && window.innerWidth < 1024 && (
        <div
          className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-300 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative transition-all duration-300 ease-in-out">
        <header className="flex items-center justify-between px-4 h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[140px] sm:max-w-[300px]">
              {chatId ? "Conversation" : "New Chat"}
            </h1>
          </div>
          <div className="relative" ref={profileRef}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 bg-secondary border border-border"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <span className="text-xs font-bold">{userInitial}</span>
            </Button>
            {isProfileOpen && (
              <div className="absolute right-0 top-10 w-56 bg-card border border-border shadow-xl rounded-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="font-semibold text-sm truncate">
                    {firstName || "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
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
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 relative flex flex-col min-h-0">
          {isConnecting && chatId ? (
            <div className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-6 space-y-12 mt-4">
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-col items-end gap-2 w-full max-w-[90%] sm:max-w-[85%]">
                  <Skeleton className="h-3 w-24 rounded-full bg-blue-500/10" />
                  <Skeleton className="h-16 w-full rounded-2xl rounded-tr-sm bg-blue-500/10" />
                </div>
              </div>

              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0 bg-muted/50" />
                <div className="flex flex-col gap-2 w-full max-w-[90%] sm:max-w-[85%]">
                  <Skeleton className="h-3 w-32 rounded-full bg-muted/50" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full rounded-full bg-muted/50" />
                    <Skeleton className="h-3 w-[70%] rounded-full bg-muted/50" />
                  </div>
                </div>
              </div>
            </div>
          ) : isNewChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-2xl flex flex-col items-center gap-6 sm:gap-8 text-center animate-in fade-in duration-700">
                <img
                  src={logo}
                  alt="AI"
                  className="w-16 h-16 sm:w-20 sm:h-20"
                />
                <h2 className="text-2xl sm:text-4xl font-bold tracking-tight px-4">
                  What can I help with, {firstName || "today"}?
                </h2>
                <div className="w-full px-2">
                  <ChatInput
                    onSend={handleSendMessage}
                    disabled={isConnecting}
                    className="shadow-2xl sm:scale-105"
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
                <div className="w-full max-w-3xl mx-auto px-4 py-8 pb-40 flex flex-col gap-2">
                  {messages.map((m, i) => (
                    <ChatMessage
                      key={m.id || i}
                      role={m.role}
                      content={m.content}
                      attachments={m.attachments}
                      isLoading={
                        isStreaming &&
                        i === messages.length - 1 &&
                        m.role === "assistant"
                      }
                      status={i === messages.length - 1 ? status : null}
                      onEdit={
                        m.role === "user"
                          ? (val) => editMessage(m.id, val)
                          : undefined
                      }
                      onRegenerate={
                        i === messages.length - 1 &&
                        m.role === "assistant" &&
                        !isStreaming
                          ? regenerateResponse
                          : undefined
                      }
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {showScrollButton && (
                <Button
                  onClick={() =>
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                  size="icon"
                  className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-30 bg-background border border-border hover:bg-blue-500/10 hover:border-blue-500/50 group"
                >
                  <ArrowDown className="h-4 w-4 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                </Button>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-background via-background/95 to-transparent z-20">
                <div className="max-w-3xl mx-auto w-full">
                  <ChatInput
                    onSend={handleSendMessage}
                    isStreaming={isStreaming}
                    onStop={stopGeneration}
                    className="shadow-xl"
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Chat;
