/* eslint-disable @typescript-eslint/no-explicit-any */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Check, X, RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import logo from "@/assets/transparent-logo.png";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Attachment {
  type: "image" | "file";
  url?: string;
  filename: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  isLoading?: boolean;
  status?: string | null;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
}

const ChatMessage = ({
  role,
  content,
  attachments,
  isLoading,
  status,
  onEdit,
  onRegenerate,
}: ChatMessageProps) => {
  const { toast } = useToast();
  const isUser = role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [loadingText, setLoadingText] = useState("Thinking...");

  const cleanContent = (text: string) => {
    return text
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$")
      .replace(/\[Attached File\]:.*(\n|$)/g, "")
      .replace(/\[Attached Image\]:.*(\n|$)/g, "")
      .replace(/\[Attached File Content\]:[\s\S]*$/, "")
      .trim();
  };

  const displayContent = cleanContent(content);

  useEffect(() => {
    if (!isLoading || content.length > 0) return;
    const texts = [
      "Thinking...",
      "Processing...",
      "Analyzing...",
      "Working...",
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % texts.length;
      setLoadingText(texts[index]);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading, content]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copied to clipboard" });
  };

  const handleSaveEdit = () => {
    if (onEdit && editedContent.trim()) {
      onEdit(editedContent);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        "flex gap-4 px-4 py-6 group w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="shrink-0 relative w-10 h-10 flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_80deg,#0EA5E9_360deg)] animate-spin" />
          )}
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-background overflow-hidden z-10 transition-all",
              isLoading
                ? "w-[38px] h-[38px]"
                : "w-full h-full border border-border shadow-sm"
            )}
          >
            <img
              src={logo}
              alt="AI"
              className="w-full h-full object-cover p-0.5"
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 min-w-0 max-w-[90%] md:max-w-[85%]",
          isUser && "items-end"
        )}
      >
        {attachments && attachments.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-2 mb-1",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            {attachments.map((att, i) =>
              att.type === "image" ? (
                <div
                  key={i}
                  className="relative rounded-xl overflow-hidden border border-border w-48 h-auto bg-black/5 shadow-sm hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <img
                    src={att.url}
                    alt="Uploaded"
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors max-w-60 shadow-sm cursor-default"
                >
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {att.filename}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Document
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {isEditing ? (
          <div className="w-full space-y-2">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[120px] bg-background border-border shadow-inner focus-visible:ring-primary/20"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={handleSaveEdit}
              >
                <Check className="h-4 w-4 mr-1" /> Save changes
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "text-sm leading-7 selection:bg-primary/30",
              isUser
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-md"
                : "text-foreground w-full"
            )}
          >
            {isLoading && displayContent.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-semibold animate-pulse bg-linear-to-r from-[#4285F4] via-[#9B72CB] to-[#D96570] bg-clip-text text-transparent">
                    {status || loadingText}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full max-w-[300px] bg-muted animate-pulse rounded" />
                  <div className="h-2 w-full max-w-[200px] bg-muted animate-pulse rounded opacity-70" />
                </div>
              </div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                  [
                    rehypeKatex,
                    { throwOnError: false, strict: false, output: "mathml" },
                  ],
                ]}
                components={{
                  img: ({ src, alt }) => (
                    <img
                      src={src}
                      alt={alt}
                      className="rounded-lg border border-border my-4 max-w-full h-auto shadow-md transition-all hover:brightness-105"
                    />
                  ),
                  table: ({ children }) => (
                    <div className="my-6 w-full overflow-x-auto rounded-lg border border-border shadow-sm scrollbar-thin">
                      <table className="w-full text-sm border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/50 border-b border-border font-bold">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 text-left border-r last:border-0 border-border/50">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 border-t border-r last:border-0 border-border/30">
                      {children}
                    </td>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 my-4 space-y-2 marker:text-primary">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 my-4 space-y-2 marker:text-primary/70">
                      {children}
                    </ol>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary hover:underline underline-offset-4 decoration-2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  code({ inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");
                    return !inline && match ? (
                      <div className="rounded-lg overflow-hidden border border-border bg-[#0d1117] w-full shadow-xl my-6">
                        <div className="flex items-center justify-between bg-zinc-900/90 px-4 py-2.5 border-b border-border/40">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                            </div>
                            <span className="text-[11px] font-mono text-zinc-500 uppercase ml-2 tracking-widest">
                              {match[1]}
                            </span>
                          </div>
                          {!isLoading && (
                            <button
                              onClick={() => handleCopy(codeString)}
                              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-all bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1 rounded-md"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          )}
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            padding: "1.5rem",
                            background: "transparent",
                            fontSize: "13px",
                            lineHeight: "1.7",
                          }}
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code
                        className="bg-muted/80 px-1.5 py-0.5 rounded text-[13px] font-mono border border-border/50 text-primary-foreground dark:text-primary"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>
        )}

        {!isEditing && !isLoading && content.length > 0 && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all mt-2 ml-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-muted"
              onClick={() => handleCopy(content)}
              title="Copy message"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground/70" />
            </Button>
            {!isUser && onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-muted"
                onClick={onRegenerate}
                title="Regenerate response"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/70" />
              </Button>
            )}
            {isUser && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-muted"
                onClick={() => {
                  setEditedContent(content);
                  setIsEditing(true);
                }}
                title="Edit message"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground/70" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
