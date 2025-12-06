import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDown, LogOut, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import logo from "@/assets/transparent-logo.png";
import { useChatSocket } from "@/hooks/useChatSocket";
import { cn } from "@/lib/utils";

const Chat = () => {
  const navigate = useNavigate();
  const { chatId } = useParams();
  // 🟢 Get firstName
  const { isAuthenticated, logout, firstName } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { messages, sendMessage, isStreaming, isConnecting } =
    useChatSocket(chatId);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
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
    setShowScrollButton(!isNearBottom);
    setAutoScroll(isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  const handleSendMessage = (content: string) => {
    sendMessage(content);
    setAutoScroll(true);
  };

  if (!isAuthenticated) return null;

  // 🟢 Logic to decide UI state
  const isNewChat = !isConnecting && messages.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* SIDEBAR */}
      {!isMobile && (
        <ChatSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          currentChatId={chatId}
        />
      )}

      {/* MOBILE OVERLAY */}
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

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-background relative transition-all duration-300">
        {/* Header (Fixed Height, No Shrink) */}
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

        {/* CONTENT BODY (Dynamic Layout) */}
        <div className="flex-1 relative flex flex-col min-h-0">
          {isNewChat ? (
            // 🟢 STATE 1: NEW CHAT (Centered View)
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-2xl">
                <img src={logo} alt="AI" className="w-20 h-20" />
                <h2 className="text-3xl font-semibold text-foreground">
                  Hi {firstName ? firstName.toUpperCase() : ""}
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
            // 🟢 STATE 2: ONGOING CHAT (Scrollable Messages + Floating Input)
            <>
              <ScrollArea
                className="flex-1 h-full w-full"
                onScroll={handleScroll}
                viewportRef={scrollViewportRef}
              >
                <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-6 pb-32 flex flex-col gap-6">
                  {/* Skeletons */}
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

                  {/* Message List */}
                  {messages.map((message, index) => (
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
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Scroll Button */}
              {showScrollButton && (
                <Button
                  onClick={scrollToBottom}
                  size="icon"
                  className="absolute bottom-28 right-8 rounded-full shadow-lg z-30 bg-secondary hover:bg-secondary/80 border border-border animate-in fade-in"
                >
                  <ArrowDown className="h-5 w-5" />
                </Button>
              )}

              {/* Floating Input Area */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-linear-to-t from-background via-background/90 to-transparent z-20 pb-6">
                <div className="max-w-5xl mx-auto w-full">
                  <ChatInput
                    onSend={handleSendMessage}
                    disabled={isStreaming}
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
