import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, LogOut, PanelLeftOpen } from "lucide-react"; // Removed Menu/X
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import logo from "@/assets/transparent-logo.png";
import { useChatSocket } from "@/hooks/useChatSocket";
import axios from "axios";

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { isAuthenticated, logout, token } = useAuth();

  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mobile check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && sidebarOpen) setSidebarOpen(false); // Auto-close on mobile
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { messages, sendMessage, isStreaming, isConnecting } =
    useChatSocket(chatId);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setAutoScroll(isNearBottom);
  };

  const handleSendMessage = (content: string) => {
    sendMessage(content);
    setAutoScroll(true);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* SIDEBAR LOGIC:
         - Hidden completely on mobile if closed (absolute position could be used for overlay)
         - Flex item on Desktop
      */}
      {!isMobile && (
        <ChatSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={chatId}
        />
      )}

      {/* MOBILE OVERLAY SIDEBAR */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="absolute left-0 top-0 h-full w-64 bg-background border-r border-border"
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

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative transition-all duration-300">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20 h-16">
          <div className="flex items-center gap-3">
            {/* Mobile Toggle */}
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            )}

            {/* Desktop: Show Logo only if sidebar is closed (optional, but looks nice) */}
            {!sidebarOpen && !isMobile && (
              <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in">
                <img
                  src={logo}
                  alt="Logo"
                  className="w-6 h-6 grayscale opacity-70"
                />
              </div>
            )}

            <h1 className="text-lg font-semibold truncate">
              {/* Dynamic Title could go here */}
              AI Chat
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 min-h-0 relative">
          <ScrollArea className="h-full w-full" onScroll={handleScroll}>
            <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 pb-32 flex flex-col gap-6">
              {isConnecting && messages.length === 0 ? (
                <div className="space-y-8 p-4 opacity-50">
                  {/* Skeletons */}
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
              ) : (
                messages.map((message, index) => (
                  <ChatMessage
                    key={message.id || index}
                    role={message.role}
                    content={message.content}
                    isLoading={
                      isStreaming &&
                      index === messages.length - 1 &&
                      message.role === "assistant"
                    }
                  />
                ))
              )}

              {!isConnecting && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground text-center p-4">
                  <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-4">
                    <img
                      src={logo}
                      alt="AI"
                      className="w-10 h-10 opacity-40 grayscale"
                    />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">
                    Welcome to AI Chat
                  </h3>
                  <p className="text-sm opacity-70 max-w-xs mt-2">
                    Ask me anything about coding, writing, or generating images.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-20">
            <div className="max-w-5xl mx-auto w-full">
              <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
