import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/transparent-logo.png";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessions } from "@/hooks/useSessions";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentChatId?: string;
}

const ChatSidebar = ({ isOpen, onToggle, currentChatId }: ChatSidebarProps) => {
  const navigate = useNavigate();
  const { sessions } = useSessions();

  const handleNewChat = () => {
    navigate("/chat");
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar border-r border-border transition-all duration-300 h-full shrink-0 overflow-hidden",
        isOpen ? "w-72" : "w-[60px]"
      )}
    >
      <div
        className={cn(
          "h-16 flex items-center border-b border-border/50 transition-all duration-300",
          isOpen ? "px-4 justify-between" : "justify-center px-0"
        )}
      >
        {isOpen ? (
          <>
            <div className="flex items-center gap-3 font-semibold text-lg animate-in fade-in duration-300 min-w-0">
              <img src={logo} alt="Logo" className="w-8 h-8 shrink-0" />
              <span className="truncate">AI Chat</span>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close Sidebar</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Open Sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div
        className={cn(
          "py-3 border-b border-border/40 transition-all",
          isOpen ? "px-3" : "px-0 flex justify-center"
        )}
      >
        <Tooltip delayDuration={isOpen ? 1000 : 0}>
          <TooltipTrigger asChild>
            <Button
              className={cn(
                "transition-all shadow-sm",
                !isOpen ? "h-10 w-10 p-0 rounded-full" : "w-full justify-start"
              )}
              variant="default"
              size={isOpen ? "default" : "icon"}
              onClick={handleNewChat}
            >
              <Plus className={cn("h-5 w-5", isOpen && "mr-2")} />
              {isOpen && "New Chat"}
            </Button>
          </TooltipTrigger>
          {!isOpen && <TooltipContent side="right">New Chat</TooltipContent>}
        </Tooltip>
      </div>

      <ScrollArea className="flex-1">
        {isOpen ? (
          <div className="p-3 space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
              Recent
            </p>
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => navigate(`/chat/${session.session_id}`)}
                title={session.title || "New Chat"}
                className={cn(
                  "group flex items-center gap-3 w-full text-left rounded-lg transition-all px-3 py-2.5",
                  currentChatId === session.session_id
                    ? "bg-sidebar-accent text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />

                <div className="flex-1 min-w-0 grid gap-0.5">
                  <span className="text-sm truncate font-medium">
                    {session.title || "New Chat"}
                  </span>
                  <span className="text-[10px] opacity-50 truncate font-normal">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="w-full h-full" />
        )}
      </ScrollArea>
    </aside>
  );
};

export default ChatSidebar;
