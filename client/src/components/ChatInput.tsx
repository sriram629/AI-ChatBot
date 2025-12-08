import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSend = () => {
    if (content.trim()) {
      onSend(content);
      setContent("");
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
    <div className={cn("relative flex items-end w-full", className)}>
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me anything..."
        className={cn(
          "min-h-[54px] w-full resize-none rounded-2xl border border-border bg-background py-4 pl-4 pr-12 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 scrollbar-hide transition-all",
          content.length > 0 ? "bg-background/80 backdrop-blur-sm" : ""
        )}
        disabled={disabled && !isStreaming}
        rows={1}
      />

      {isStreaming ? (
        <Button
          onClick={onStop}
          size="icon"
          className="absolute right-2 bottom-2 h-9 w-9 rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm"
        >
          <Square className="h-3 w-3 fill-current" />
          <span className="sr-only">Stop generating</span>
        </Button>
      ) : (
        <Button
          onClick={handleSend}
          disabled={disabled || !content.trim()}
          size="icon"
          className={cn(
            "absolute right-2 bottom-2 h-9 w-9 rounded-full transition-all shadow-sm",
            !content.trim()
              ? "opacity-0 scale-75 pointer-events-none"
              : "opacity-100 scale-100"
          )}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      )}
    </div>
  );
};

export default ChatInput;
