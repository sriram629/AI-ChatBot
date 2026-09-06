/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square, Paperclip, X, FileText, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ChatInputProps {
  onSend: (content: string, attachment: any) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  isStopping?: boolean;
  disabled?: boolean;
  className?: string;
  suggestion?: { text: string; id: number };
}
const extensions = /\.(pdf|txt|md|py|js|png|jpe?g|webp|gif)$/i;

const ChatInput = ({ onSend, onStop, isStreaming, isStopping, disabled, className, suggestion }: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<any>(null);
  const [upload, setUpload] = useState<{ name: string; percent: number } | null>(null);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const hintId = useId();
  useEffect(() => {
    if (suggestion) { setContent(suggestion.text); textareaRef.current?.focus(); }
  }, [suggestion]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + "px";
    }
  }, [content]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (!extensions.test(file.name)) { setError("Choose a PDF, image, TXT, Markdown, Python or JavaScript file."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("This file is too large. Choose a file smaller than 2 MB."); return; }
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setUpload({ name: file.name, percent: 0 });
    setAttachment(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/api/chat/upload", form, {
        headers: { "Content-Type": "multipart/form-data" }, signal: abort.signal,
        onUploadProgress: ({ loaded, total }) => setUpload({
          name: file.name, percent: total ? Math.min(100, Math.round(loaded / total * 100)) : 0,
        }),
      });
      if (res.data.error) throw new Error(res.data.error);
      if (!abort.signal.aborted) setAttachment({ ...res.data, filename: res.data.filename || file.name, size: file.size });
    } catch (err) {
      if (!abort.signal.aborted) {
        const problem = err as { response?: { data?: { detail?: unknown } }; message?: string };
        setError(typeof problem.response?.data?.detail === "string" ? problem.response.data.detail : problem.message || "Upload failed. Please try again.");
      }
    } finally {
      if (!abort.signal.aborted) setUpload(null);
    }
  };
  const handleSend = () => {
    if ((!content.trim() && !attachment) || disabled || isStreaming || upload) return;
    onSend(content, attachment);
    setContent(""); setAttachment(null); setError("");
  };

  return (
    <div className={cn("w-full rounded-2xl border border-border bg-card shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-primary/30", className)}>
      {(attachment || upload) && (
        <div className="m-3 mb-0 flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
          {attachment?.type === "image" && attachment.url ? (
            <img src={attachment.url} alt="Attachment preview" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          ) : <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><FileText className="h-5 w-5" /></div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={upload?.name || attachment?.filename}>{upload?.name || attachment?.filename}</p>
            {upload ? (
              <div role="status" className="mt-1 text-xs text-muted-foreground">
                {upload.percent === 100 ? "Reading file…" : `Uploading · ${upload.percent}%`}
                <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.percent} className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: upload.percent + "%" }} />
                </div>
              </div>
            ) : <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3 text-emerald-400" /> Ready to send · {Math.max(1, Math.round(attachment.size / 1024))} KB</p>}
          </div>
          {!upload && <Button variant="ghost" size="icon" aria-label="Remove attachment" onClick={() => setAttachment(null)}><X className="h-4 w-4" /></Button>}
          {upload && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />}
        </div>
      )}
      {error && <p role="alert" className="px-4 pt-3 text-sm text-red-400">{error}</p>}
      <textarea
        ref={textareaRef} aria-label="Message" aria-describedby={hintId} value={content}
        onChange={e => setContent(e.target.value)} maxLength={20000}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); }
        }}
        placeholder={attachment ? "Ask a question about this file…" : "Ask anything…"}
        className="block min-h-14 max-h-44 w-full resize-none rounded-none border-0 bg-transparent px-4 pt-4 pb-2 text-base shadow-none outline-none placeholder:text-muted-foreground focus:ring-0 focus:ring-offset-0 focus:shadow-none focus:outline-none disabled:opacity-50"
        disabled={disabled} rows={1}
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <input ref={fileInputRef} type="file" aria-label="Choose attachment" className="hidden"
          accept=".pdf,.txt,.md,.py,.js,.png,.jpg,.jpeg,.webp,.gif" onChange={handleFileChange} />
        <div className="flex min-w-0 items-center gap-2">
          <Button aria-label="Attach file" title="Attach file" variant="ghost" size="icon"
            disabled={!!upload || isStreaming || disabled} onClick={() => fileInputRef.current?.click()} className="rounded-full">
            <Paperclip className="h-5 w-5" />
          </Button>
          <span id={hintId} className="text-xs text-muted-foreground">PDF, images & text · 2 MB max</span>
        </div>
        {isStreaming ? (
          <Button aria-label={isStopping ? "Stopping" : "Stop generating"} title={isStopping ? "Stopping…" : "Stop generating"} disabled={isStopping} onClick={onStop} size="icon" className="shrink-0 rounded-full">{isStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3 w-3 fill-current" />}</Button>
        ) : (
          <Button aria-label="Send message" title="Send message" onClick={handleSend} size="icon"
            disabled={disabled || (!content.trim() && !attachment) || !!upload} className="shrink-0 rounded-full">
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
export default ChatInput;
