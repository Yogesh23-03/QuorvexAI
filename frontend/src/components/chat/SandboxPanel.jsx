import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Check, Copy, Download, ExternalLink, MonitorPlay, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { closeSandbox } from "../../redux/messageSlice";
import { buildPreviewDocument, hasPreview } from "../../lib/preview";
import { createZip, downloadBlob } from "../../lib/zip";
import { cx } from "../../lib/utils";

function CodeView({ content }) {
  const lines = useMemo(() => String(content ?? "").split("\n"), [content]);

  return (
    <div className="h-full w-full overflow-auto scrollbar-slim bg-code">
      <div className="min-w-max">
        <pre className="flex py-4 font-mono text-[12.5px] leading-[1.6]">
          <code
            aria-hidden="true"
            className="sticky left-0 z-10 select-none border-r border-white/10 bg-code px-3 text-right text-white/30"
          >
            {lines.map((_, index) => `${index + 1}\n`).join("")}
          </code>
          <code className="block whitespace-pre px-4 text-[#e6edf3]">{content}</code>
        </pre>
      </div>
    </div>
  );
}

export default function SandboxPanel() {
  const dispatch = useDispatch();
  const { sandboxOpen, sandboxArtifact } = useSelector((state) => state.message);
  const files = useMemo(() => sandboxArtifact?.files || [], [sandboxArtifact]);
  const canPreview = hasPreview(files);

  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const panelRef = useRef(null);

  // Tab indexes shrink with the file list, so clamp instead of resetting state.
  const tabCount = files.length + (canPreview ? 1 : 0);
  const tab = Math.min(activeTab, Math.max(tabCount - 1, 0));

  const close = useCallback(() => {
    setPreviewError(null);
    dispatch(closeSandbox());
  }, [dispatch]);

  useEffect(() => {
    if (!sandboxOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [sandboxOpen, close]);

  const documentText = useMemo(
    () => (canPreview ? buildPreviewDocument(files) : null),
    [files, canPreview],
  );

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.__quorvexSandbox && event.data.type === "error") {
        setPreviewError(event.data.message);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const current = files[tab];
  const isPreviewTab = canPreview && tab === files.length;

  const copyCurrent = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadCurrent = () => {
    if (!current) return;
    downloadBlob([current.content || ""], current.name || "file.txt", "text/plain;charset=utf-8");
  };

  const downloadZip = () => {
    const safe = String(sandboxArtifact?.title || "quorvex-project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    downloadBlob(createZip(files), `${safe || "project"}.zip`);
  };

  const openInNewTab = () => {
    if (!documentText) return;
    const blob = new Blob([documentText], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      {sandboxOpen && sandboxArtifact && (
        <>
          <motion.button
            type="button"
            aria-label="Close sandbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 top-16 z-40 cursor-default bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          />

          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Sandbox: ${sandboxArtifact.title || "code artifact"}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 top-16 z-50 flex w-full flex-col border-l border-line bg-void shadow-[-30px_0_60px_-30px_rgba(0,0,0,0.6)] sm:max-w-[680px]"
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3">
              <span className="min-w-0 flex-1">
                <h2 className="truncate font-display text-[15px] font-semibold text-ink">
                  {sandboxArtifact.title || "Untitled project"}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  sandbox · {files.length} file{files.length === 1 ? "" : "s"}
                </p>
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close sandbox (Esc)"
                className="rounded-lg border border-line bg-tint-1 p-2 text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                <X size={16} />
              </button>
            </header>

            <div
              role="tablist"
              aria-label="Project files"
              className="scrollbar-none flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 py-2"
            >
              {files.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === index}
                  onClick={() => setActiveTab(index)}
                  className={cx(
                    "shrink-0 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                    tab === index
                      ? "bg-neon/15 text-neon"
                      : "text-ink-soft hover:bg-tint-2 hover:text-ink",
                  )}
                >
                  {file.name}
                </button>
              ))}
              {canPreview && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isPreviewTab}
                  onClick={() => setActiveTab(files.length)}
                  className={cx(
                    "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                    isPreviewTab
                      ? "bg-violet/15 text-violet"
                      : "text-ink-soft hover:bg-tint-2 hover:text-ink",
                  )}
                >
                  <MonitorPlay size={12} /> Preview
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
              {isPreviewTab ? (
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-soft transition-colors hover:text-ink"
                >
                  <ExternalLink size={12} /> New tab
                </button>
              ) : (
                <button
                  type="button"
                  onClick={copyCurrent}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-soft transition-colors hover:text-ink"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy file"}
                </button>
              )}
              <button
                type="button"
                onClick={isPreviewTab ? downloadZip : downloadCurrent}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-soft transition-colors hover:text-ink"
              >
                <Download size={12} /> {isPreviewTab ? "Download .zip" : "Save file"}
              </button>
              {!isPreviewTab && files.length > 1 && (
                <button
                  type="button"
                  onClick={downloadZip}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-soft transition-colors hover:text-ink"
                >
                  <Download size={12} /> .zip
                </button>
              )}
            </div>

            {isPreviewTab && previewError && (
              <div className="flex shrink-0 items-start gap-2 border-b border-danger/30 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span className="break-words">{previewError}</span>
              </div>
            )}

            <div className="min-h-0 flex-1">
              {isPreviewTab ? (
                <iframe
                  title="Live preview"
                  srcDoc={documentText || ""}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  className="h-full w-full border-0 bg-white"
                />
              ) : current ? (
                <CodeView content={current.content} />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center text-[13px] text-ink-soft">
                  This artifact has no files to display.
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
