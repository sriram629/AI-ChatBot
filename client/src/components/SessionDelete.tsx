import { useEffect, useRef, useState, useId } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import type { Session } from "./ChatSidebar";

export default function SessionDelete({ session, onClose, onDeleted }: { session: Session; onClose: () => void; onDeleted: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-labelledby={id} aria-describedby={id + "-description"}
    onCancel={e => { if (busy) e.preventDefault(); else onClose(); }} onClose={onClose}
    className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/60">
    <h2 id={id} className="text-lg font-semibold">Delete conversation?</h2>
    <p id={id + "-description"} className="mt-3 break-words text-sm leading-6 text-muted-foreground">“{session.title}” will be removed from your history. Stored records are retained; this does not permanently erase your data.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    <div className="mt-5 flex justify-end gap-2">
      <Button autoFocus variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="destructive" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await api.delete("/api/chat/sessions/" + session.session_id); onDeleted(); }
        catch { setError("Couldn’t delete this conversation. Please try again."); }
        finally { setBusy(false); }
      }}>{busy ? "Deleting…" : "Delete conversation"}</Button>
    </div>
  </dialog>;
}
