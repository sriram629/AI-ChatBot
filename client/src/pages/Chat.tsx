/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, LogOut, Loader2, PanelLeftOpen } from "lucide-react";
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isMobile && sidebarOpen) contentRef.current?.setAttribute('inert', '');
    else contentRef.current?.removeAttribute('inert');
  }, [isMobile, sidebarOpen]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<{ text: string; id: number }>();
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
    model,
    connection,
    error,
    dismissError,
  } = useChatSocket(chatId);

  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
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
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentChatId={chatId}
        isMobile={isMobile}
        onNavigate={() => { if (isMobile) setSidebarOpen(false); }}
      />

      {sidebarOpen && isMobile && (
        <button aria-label="Close sidebar" tabIndex={-1}
          className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-300 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div ref={contentRef} className="flex flex-col flex-1 h-full min-w-0 bg-background relative transition-all duration-300 ease-in-out">
        <header className="flex items-center justify-between px-4 h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && <Button variant="ghost" size="icon" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}><PanelLeftOpen className="h-5 w-5" /></Button>}
            <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[140px] sm:max-w-[300px]">
              {chatId ? "Conversation" : "New Chat"}
            </h1>
            {model && <span aria-label="Response provider" className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">{model}{model !== "Gemini" ? " · backup" : ""}</span>}
          </div>
          <div className="relative" ref={profileRef}>
            <Button
              variant="ghost"
              aria-label="Account menu" aria-expanded={isProfileOpen}
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
          {chatId && connection !== "connected" && (
            <div role="status" className="shrink-0 border-b border-border bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-300">
              {connection === "offline" ? "You’re offline. Your conversation stays here." : connection === "closed" ? "Sign in again to reconnect." : "Connecting to your conversation…"}
              {connection === "closed" && <a href="/login" className="ml-2 underline">Sign in</a>}
            </div>
          )}
          {error && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"><span>{error}</span><button onClick={dismissError} aria-label="Dismiss chat error" className="shrink-0 underline">Dismiss</button></div>}
          {status && (
            <div role="status" aria-live="polite" className="flex shrink-0 items-center justify-center gap-2 border-b border-border/50 bg-primary/5 px-4 py-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />
              {status}
            </div>
          )}
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
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center p-4">
              <div className="my-auto w-full max-w-2xl flex flex-col items-center gap-5 sm:gap-8 py-6 text-center animate-in fade-in duration-700">
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
                    suggestion={suggestion}
                    onSend={handleSendMessage}
                    disabled={isConnecting}
                    className="shadow-2xl sm:scale-105"
                  />
                </div>
                <div aria-label="Ideas to get started" className="grid w-full grid-cols-2 gap-2 text-left">
                  {[
                    ["Understand a document", "Summarize the document I attach and list its key takeaways."],
                    ["Explain a concept", "Explain how neural networks learn, using a simple everyday example."],
                    ["Explore the web", "/search What are the latest developments in renewable energy?"],
                    ["Create an image", "Generate an image of a cozy reading nook beside a rainy window."],
                  ].map(([label, text]) => <button key={label} onClick={() => setSuggestion({ text, id: Date.now() })}
                    className="rounded-xl border border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">{label}</button>)}
                </div>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea
                className="flex-1 min-h-0 w-full"
                onScroll={handleScroll}
                viewportRef={scrollViewportRef}
              >
                <div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col gap-2">
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
                  aria-label="Scroll to latest message"
                  className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-full shadow-lg z-30 bg-background border border-border hover:bg-blue-500/10 hover:border-blue-500/50 group"
                >
                  <ArrowDown className="h-4 w-4 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                </Button>
              )}
              <div className="shrink-0 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/40 bg-background z-20">
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
