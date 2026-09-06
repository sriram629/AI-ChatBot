import { useEffect, useRef, useState, useId } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import type { Session } from "./ChatSidebar";
export default function SessionRename({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [title, setTitle] = useState(session.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} onClose={onClose}
    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/60">
    <form onSubmit={async e => {
      e.preventDefault(); if (!title.trim() || busy) return;
      setBusy(true); setError("");
      try { await api.patch("/api/chat/sessions/" + session.session_id, { title: title.trim() }); onSaved(); }
      catch { setError("Couldn’t rename this conversation. Please try again."); }
      finally { setBusy(false); }
    }}>
      <h2 id={id} className="text-lg font-semibold">Rename conversation</h2>
      <label className="mt-4 block text-sm" htmlFor={id + "-input"}>Conversation name</label>
      <input autoFocus id={id + "-input"} value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary" />
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save name"}</Button></div>
    </form>
  </dialog>;
}

