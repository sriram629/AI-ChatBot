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
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
}

const ChatMessage = ({
  role,
  content,
  attachments,
  isLoading,
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
      "Analyzing request...",
      "Generating response...",
      "Working on it...",
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
            <>
              {/* 🔵 BLUE SPINNER (Thin Border) */}
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_80deg,#0EA5E9_360deg)] animate-[spin_1s_linear_infinite]" />
            </>
          )}

          <div
            className={cn(
              "relative flex items-center justify-center rounded-full bg-background overflow-hidden z-10 transition-all",
              // 🟢 THIN BORDER FIX: Increased inner size to 38px (leaving 1px border space)
              isLoading
                ? "w-[38px] h-[38px]"
                : "w-full h-full border border-border"
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
                  className="relative rounded-xl overflow-hidden border border-border w-48 h-auto group/img bg-black/5"
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
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors cursor-default max-w-[240px]"
                >
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {att.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">Document</p>
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
              className="min-h-[100px]"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "text-sm overflow-hidden",
              isUser
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 leading-7"
                : "text-foreground w-full leading-7"
            )}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap">{displayContent}</div>
            ) : (
              <>
                {isLoading && displayContent.length === 0 ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2 px-1">
                    {/* 🌈 MULTI-COLOR TEXT GRADIENT */}
                    <span className="text-sm font-medium animate-pulse bg-gradient-to-r from-[#4285F4] via-[#9B72CB] to-[#D96570] bg-clip-text text-transparent">
                      {loadingText}
                    </span>
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[
                      [
                        rehypeKatex,
                        {
                          throwOnError: false,
                          strict: false,
                          trust: true,
                          output: "mathml",
                        },
                      ],
                    ]}
                    components={{
                      p({ children }) {
                        return (
                          <p className="mb-5 last:mb-0 leading-7">{children}</p>
                        );
                      },
                      ul({ children }) {
                        return (
                          <ul className="list-disc pl-6 mb-5 space-y-2">
                            {children}
                          </ul>
                        );
                      },
                      ol({ children }) {
                        return (
                          <ol className="list-decimal pl-6 mb-5 space-y-2">
                            {children}
                          </ol>
                        );
                      },
                      li({ children }) {
                        return <li className="leading-7 pl-1">{children}</li>;
                      },
                      h1({ children }) {
                        return (
                          <h1 className="text-2xl font-bold mt-8 mb-4">
                            {children}
                          </h1>
                        );
                      },
                      h2({ children }) {
                        return (
                          <h2 className="text-xl font-bold mt-6 mb-3 border-b pb-1 border-border/50">
                            {children}
                          </h2>
                        );
                      },
                      h3({ children }) {
                        return (
                          <h3 className="text-lg font-semibold mt-4 mb-2">
                            {children}
                          </h3>
                        );
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground">
                            {children}
                          </blockquote>
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="my-6 w-full overflow-y-auto rounded-lg border border-border">
                            <table className="w-full text-sm text-left">
                              {children}
                            </table>
                          </div>
                        );
                      },
                      thead({ children }) {
                        return (
                          <thead className="bg-muted text-muted-foreground uppercase text-xs">
                            {children}
                          </thead>
                        );
                      },
                      th({ children }) {
                        return (
                          <th className="px-4 py-3 font-semibold">
                            {children}
                          </th>
                        );
                      },
                      td({ children }) {
                        return (
                          <td className="px-4 py-3 border-t border-border">
                            {children}
                          </td>
                        );
                      },
                      img({ src, alt }) {
                        return (
                          <img
                            src={src}
                            alt={alt}
                            className="rounded-lg max-w-full h-auto my-4 border border-border"
                            loading="lazy"
                          />
                        );
                      },
                      pre({ children }) {
                        return (
                          <pre className="my-6 overflow-hidden rounded-lg">
                            {children}
                          </pre>
                        );
                      },
                      code({
                        node,
                        inline,
                        className,
                        children,
                        ...props
                      }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = String(children).replace(/\n$/, "");

                        return !inline && match ? (
                          <div className="rounded-md overflow-hidden border border-border bg-zinc-950 w-full shadow-sm">
                            <div className="flex items-center justify-between bg-zinc-900 px-4 py-2 border-b border-border/50">
                              <span className="text-xs font-mono text-zinc-400 lowercase">
                                {match[1]}
                              </span>
                              {!isLoading && (
                                <button
                                  onClick={() => handleCopy(codeString)}
                                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy
                                </button>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{
                                  margin: 0,
                                  padding: "1rem",
                                  background: "transparent",
                                }}
                                {...props}
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            </div>
                          </div>
                        ) : (
                          <code
                            className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono border border-border"
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
              </>
            )}
          </div>
        )}

        {!isEditing && !isLoading && content.length > 0 && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCopy(content)}
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
            </Button>

            {!isUser && onRegenerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}

            {isUser && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setEditedContent(content);
                  setIsEditing(true);
                }}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
