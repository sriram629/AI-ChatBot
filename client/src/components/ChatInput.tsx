/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Paperclip, X, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (content: string, attachment: any) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  className?: string;
}

const ChatInput = ({
  onSend,
  onStop,
  isStreaming,
  disabled,
  className,
}: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/chat/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachment(res.data);
      toast.success("File attached");
    } catch (err) {
      toast.error("Upload failed");
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if ((content.trim() || attachment) && !disabled) {
      onSend(content, attachment);
      setContent("");
      setAttachment(null);
      if (textareaRef.current) textareaRef.current.style.height = "inherit";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col w-full bg-background rounded-2xl border border-border shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all",
        className
      )}
    >
      {attachment && (
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/20 rounded-t-2xl">
          {attachment.type === "image" ? (
            <ImageIcon className="h-4 w-4 text-blue-500" />
          ) : (
            <FileText className="h-4 w-4 text-orange-500" />
          )}
          <span className="text-xs font-medium truncate max-w-[200px]">
            {attachment.preview}
          </span>
          <button
            aria-label="Remove attachment"
            onClick={() => setAttachment(null)}
            className="ml-auto hover:bg-muted rounded-full p-1"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-end w-full p-2 gap-2">
        <input
          type="file"
          aria-label="Attach file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.txt,.md,.py,.js"
        />
        <Button
          size="icon"
          variant="ghost"
          disabled={isUploading || isStreaming}
          onClick={() => fileInputRef.current?.click()}
          className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isUploading ? "Uploading..." : "Ask anything..."}
          className="min-h-6 max-h-[200px] w-full resize-none bg-transparent border-0 p-2 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground scrollbar-hide"
          disabled={disabled && !isStreaming}
          rows={1}
        />

        {isStreaming ? (
          <Button
            onClick={onStop}
            size="icon"
            className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={
              disabled || (!content.trim() && !attachment) || isUploading
            }
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full shrink-0 transition-all",
              !content.trim() && !attachment ? "opacity-50" : "opacity-100"
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
