import { useState } from "react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import AgentGlyph from "../ui/AgentGlyph";
import ArtifactCard from "./ArtifactCard";
import { agentById } from "../../lib/agents";
import { cx } from "../../lib/utils";

export default function MessageBubble({ role, content, images = [], agent, artifacts = [] }) {
  const isUser = role === "user";
  const [lightbox, setLightbox] = useState(null);
  const [copiedCode, setCopiedCode] = useState("");
  const activeAgent = agentById(agent || "chat");

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={cx("flex w-full gap-2.5 sm:gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
          style={{
            borderColor: `color-mix(in srgb, ${activeAgent.color} 45%, transparent)`,
            background: `color-mix(in srgb, ${activeAgent.color} 12%, transparent)`,
          }}
          aria-hidden="true"
        >
          <AgentGlyph agentId={activeAgent.id} size={22} />
        </span>
      )}

      <div
        className={cx(
          "flex min-w-0 flex-col gap-1.5",
          isUser
            ? "max-w-[85%] items-end sm:max-w-[75%]"
            : "max-w-[calc(100%-2.75rem)] items-start",
        )}
      >
        {!isUser && (
          <span className="flex items-center gap-1.5 pl-0.5">
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.18em]"
              style={{ color: activeAgent.color }}
            >
              {activeAgent.label}
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
              agent
            </span>
          </span>
        )}

        <div
          className={cx(
            "w-fit min-w-[7.5rem] max-w-full overflow-hidden rounded-2xl px-3.5 py-2.5",
            isUser
              ? "rounded-br-md border border-neon/30 bg-neon/[0.12] text-ink"
              : "rounded-bl-md border border-line bg-panel/70 text-ink backdrop-blur-md",
          )}
        >
          {images.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setLightbox(image)}
                  className="overflow-hidden rounded-lg border border-line"
                  aria-label="Open image preview"
                >
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    onError={(event) => event.currentTarget.closest("button")?.remove()}
                    className="h-28 w-40 object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {content ? (
            <div className="chat-markdown">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-2 mt-4 font-display text-lg font-bold text-ink">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-1.5 mt-4 font-display text-[15px] font-semibold text-ink">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1 mt-3 font-display text-[13.5px] font-semibold text-ink-soft">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 whitespace-pre-wrap break-words text-[14px] leading-[1.65]">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-2 list-disc space-y-1 pl-5 text-[14px]">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 list-decimal space-y-1 pl-5 text-[14px]">{children}</ol>
                  ),
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  hr: () => <hr className="my-4 border-line" />,
                  blockquote: ({ children }) => (
                    <blockquote className="my-3 border-l-2 border-neon/50 pl-3 text-ink-soft">
                      {children}
                    </blockquote>
                  ),
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-line">
                      <table className="min-w-full text-[13px]">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-line bg-tint-1 px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-soft">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-line px-3 py-2 align-top">{children}</td>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-violet underline decoration-violet/40 underline-offset-2 hover:decoration-violet"
                    >
                      {children}
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  ),
                  pre: ({ children }) => <>{children}</>,
                  code: ({ className, children }) => {
                    const value = String(children ?? "").replace(/\n$/, "");
                    if (!className) {
                      return (
                        <code className="rounded bg-tint-3 px-1.5 py-0.5 font-mono text-[12.5px] text-neon">
                          {value}
                        </code>
                      );
                    }
                    const language = className.replace("language-", "");
                    return (
                      <div className="my-3 max-w-full overflow-hidden rounded-xl border border-line bg-code">
                        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                            {language}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyCode(value)}
                            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white"
                          >
                            {copiedCode === value ? (
                              <>
                                <Check size={12} /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <div className="overflow-x-auto scrollbar-slim">
                          <SyntaxHighlighter
                            language={language}
                            style={oneDark}
                            customStyle={{
                              margin: 0,
                              padding: "12px 14px",
                              background: "transparent",
                              fontSize: "12.5px",
                            }}
                          >
                            {value}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    );
                  },
                  img: ({ src, alt }) => {
                    if (!src) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setLightbox(src)}
                        className="my-2 overflow-hidden rounded-xl border border-line"
                      >
                        <img
                          src={src}
                          alt={alt || "Generated output"}
                          loading="lazy"
                          className="max-h-96 w-auto object-contain"
                        />
                      </button>
                    );
                  },
                }}
              >
                {content}
              </Markdown>
            </div>
          ) : (
            <p className="text-[13px] italic text-ink-soft">No content returned.</p>
          )}

          {!isUser && artifacts.length > 0 && (
            <div className="mt-1 space-y-2">
              {artifacts.map((artifact, index) => (
                <ArtifactCard
                  key={artifact.id || `${artifact.type}-${index}`}
                  artifact={artifact}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image preview"
            className="absolute right-5 top-5 rounded-full border border-line bg-tint-3 p-2 text-ink hover:bg-tint-2"
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt="Expanded output"
            className="max-h-[85vh] max-w-[92vw] rounded-2xl border border-line object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
