import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/transparent-logo.png";
import { api } from "@/lib/api";
import SessionRename from "./SessionRename";
import SessionDelete from "./SessionDelete";

export interface Session { session_id: string; title: string; updated_at: string; }
interface Props { isOpen: boolean; onToggle: () => void; currentChatId?: string; }
const ChatSidebar = ({ isOpen, onToggle, currentChatId }: Props) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [renaming, setRenaming] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const fetchSessions = useCallback(async () => {
    try { const res = await api.get("/api/chat/sessions"); setSessions(res.data); setLoadError(false); }
    catch { setLoadError(true); }
    finally { setIsLoading(false); }
  }, []);
  useEffect(() => {
    fetchSessions();
    window.addEventListener("session-updated", fetchSessions);
    window.addEventListener("refresh-sessions", fetchSessions);
    return () => {
      window.removeEventListener("session-updated", fetchSessions);
      window.removeEventListener("refresh-sessions", fetchSessions);
    };
  }, [fetchSessions]);
  return (
    <aside aria-label="Conversations" className={cn("flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar-background", isOpen ? "w-72" : "w-16")}>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-border px-3", isOpen ? "justify-between" : "justify-center")}>
        {isOpen && <div className="flex items-center gap-2"><img src={logo} alt="" className="h-8 w-8" /><span className="font-semibold">AI Chat</span></div>}
        <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse sidebar" : "Open sidebar"} onClick={onToggle}>
          {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </Button>
      </div>
      <div className="p-3"><Button onClick={() => navigate("/chat")} aria-label="New chat" className={cn("gap-2", isOpen ? "w-full justify-start" : "h-10 w-10 p-0")}><Plus className="h-4 w-4" />{isOpen && "New chat"}</Button></div>
      <ScrollArea className="min-h-0 flex-1">
        {isOpen && <p className="px-5 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Conversations</p>}
        {isLoading && <div role="status" className="flex justify-center p-5"><Loader2 aria-label="Loading conversations" className="h-5 w-5 animate-spin" /></div>}
        {loadError && isOpen && <div className="px-4 py-3 text-sm text-muted-foreground">Couldn’t load conversations.<button onClick={fetchSessions} className="ml-1 text-primary underline">Retry</button></div>}
        {!isLoading && !loadError && sessions.length === 0 && isOpen && <p className="px-5 py-4 text-sm leading-6 text-muted-foreground">Your conversations will appear here after your first message.</p>}
        <div className="space-y-1 px-2 pb-4">
          {sessions.map(session => (
            <div key={session.session_id} className={cn("group flex min-w-0 items-center rounded-xl", currentChatId === session.session_id ? "bg-sidebar-accent" : "hover:bg-muted/50")}>
              <button aria-current={currentChatId === session.session_id ? "page" : undefined} title={session.title} onClick={() => navigate("/chat/" + session.session_id)} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-primary", !isOpen && "justify-center")}>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                {isOpen && <span className="min-w-0"><span className="block truncate text-sm">{session.title || "New chat"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{new Date(session.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>}
              </button>
              {isOpen && <Button variant="ghost" size="icon" aria-label={"Rename " + session.title} onClick={() => setRenaming(session)} className="mr-1 h-8 w-8 shrink-0"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>}
              {isOpen && <Button variant="ghost" size="icon" aria-label={"Delete " + session.title} onClick={() => setDeleting(session)} className="mr-1 h-8 w-8 shrink-0"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>}
            </div>
          ))}
        </div>
      </ScrollArea>
      {renaming && <SessionRename session={renaming} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); fetchSessions(); }} />}
      {deleting && <SessionDelete session={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
        if (deleting.session_id === currentChatId) navigate("/chat");
        setDeleting(null); fetchSessions();
      }} />}
    </aside>
  );
};
export default ChatSidebar;
