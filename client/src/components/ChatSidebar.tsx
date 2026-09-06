import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/transparent-logo.png";
import { api } from "@/lib/api";
import SessionRename from "./SessionRename";
import SessionDelete from "./SessionDelete";

export interface Session { session_id: string; title: string; updated_at: string; }
interface Props { isOpen: boolean; onToggle: () => void; currentChatId?: string; isMobile: boolean; onNavigate: () => void; }
const ChatSidebar = ({ isOpen, onToggle, currentChatId, isMobile, onNavigate }: Props) => {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const previous = document.activeElement as HTMLElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { requestAnimationFrame(() => {
      const trigger = document.getElementById('open-conversations');
      if (trigger) trigger.focus(); else if (previous?.isConnected) previous.focus();
    }); };
  }, [isMobile, isOpen]);
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
    <aside ref={panel} role={isMobile ? "dialog" : undefined} aria-modal={isMobile && isOpen ? true : undefined} aria-label="Conversations"
      onKeyDown={e => {
        if (!isMobile || !isOpen || document.querySelector('dialog[open]')) return;
        if (e.key === 'Escape') { e.preventDefault(); onToggle(); }
        if (e.key === 'Tab') {
          const buttons = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
          if (!buttons?.length) return;
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }}
      className={cn("h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar-background", isMobile ? (isOpen ? "fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] shadow-2xl" : "hidden") : (isOpen ? "flex w-72" : "flex w-16"))}>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-border px-3", isOpen ? "justify-between" : "justify-center")}>
        {isOpen && <div className="flex items-center gap-2"><img src={logo} alt="" className="h-8 w-8" /><span className="font-semibold">AI Chat</span></div>}
        <Button variant="ghost" size="icon" aria-label={isOpen ? "Collapse sidebar" : "Open sidebar"} onClick={onToggle}>
          {isOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </Button>
      </div>
      <div className="p-3"><Button onClick={() => { navigate("/chat"); onNavigate(); }} aria-label="New chat" className={cn("gap-2", isOpen ? "w-full justify-start" : "h-10 w-10 p-0")}><Plus className="h-4 w-4" />{isOpen && "New chat"}</Button></div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {isOpen && <p className="px-5 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Conversations</p>}
        {isLoading && <div role="status" className="flex justify-center p-5"><Loader2 aria-label="Loading conversations" className="h-5 w-5 animate-spin" /></div>}
        {loadError && isOpen && <div className="px-4 py-3 text-sm text-muted-foreground">Couldn’t load conversations.<button onClick={fetchSessions} className="ml-1 text-primary underline">Retry</button></div>}
        {!isLoading && !loadError && sessions.length === 0 && isOpen && <p className="px-5 py-4 text-sm leading-6 text-muted-foreground">Your conversations will appear here after your first message.</p>}
        <div className={cn("space-y-1 pb-4", isOpen ? "px-3" : "px-2")}>
          {sessions.map(session => (
            <div key={session.session_id} className={cn("group grid min-w-0 items-center rounded-xl", isOpen ? "grid-cols-[minmax(0,1fr)_auto] pr-1" : "grid-cols-1", currentChatId === session.session_id ? "bg-sidebar-accent" : "hover:bg-muted/50")}>
              <button aria-current={currentChatId === session.session_id ? "page" : undefined} aria-label={session.title || "New chat"} title={session.title} onClick={() => { navigate("/chat/" + session.session_id); onNavigate(); }} className={cn("flex min-w-0 items-center gap-2 rounded-xl p-3 text-left focus-visible:outline-2 focus-visible:outline-primary", !isOpen && "justify-center")}>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                {isOpen && <span className="min-w-0 flex-1"><span className="block truncate text-sm">{session.title.length > 24 ? session.title.slice(0, 24).trimEnd() + "…" : session.title || "New chat"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{new Date(session.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>}
              </button>
              {isOpen && <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon" title="Rename conversation" aria-label={"Rename " + session.title} onClick={() => setRenaming(session)} className="h-10 w-9 shrink-0"><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                <Button variant="ghost" size="icon" title="Delete conversation" aria-label={"Delete " + session.title} onClick={() => setDeleting(session)} className="h-10 w-9 shrink-0"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
              </div>}
            </div>
          ))}
        </div>
      </div>
      {renaming && <SessionRename session={renaming} onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); fetchSessions(); }} />}
      {deleting && <SessionDelete session={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
        if (deleting.session_id === currentChatId) navigate("/chat");
        setDeleting(null); fetchSessions();
      }} />}
    </aside>
  );
};
export default ChatSidebar;
