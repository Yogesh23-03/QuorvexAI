import { useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Presentation,
  SquareArrowOutUpRight,
} from "lucide-react";
import { useDispatch } from "react-redux";
import AgentGlyph from "../ui/AgentGlyph";
import { openSandbox } from "../../redux/messageSlice";
import { createZip, downloadBlob } from "../../lib/zip";
import { cx, humanFileSize } from "../../lib/utils";

const TYPE_META = {
  web: { label: "Web project", icon: Code2, agent: "coding", accent: "#2563EB" },
  code: { label: "Code artifact", icon: Code2, agent: "coding", accent: "#2563EB" },
  pdf: { label: "PDF document", icon: FileText, agent: "pdf", accent: "#DC2626" },
  ppt: { label: "Slide deck", icon: Presentation, agent: "ppt", accent: "#D97706" },
  image: { label: "Generated image", icon: ImageIcon, agent: "vision", accent: "#0D9488" },
};

function Action({ icon: Icon, onClick, href, download, children, primary = false }) {
  const className = cx(
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
    primary
      ? "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20"
      : "border-line bg-tint-1 text-ink-soft hover:border-line-strong hover:text-ink",
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" download={download} className={className}>
        <Icon size={12} aria-hidden="true" /> {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon size={12} aria-hidden="true" /> {children}
    </button>
  );
}

export default function ArtifactCard({ artifact }) {
  const dispatch = useDispatch();
  const [copied, setCopied] = useState(false);
  const meta = TYPE_META[artifact?.type] || TYPE_META.code;
  const Icon = meta.icon;
  const files = artifact?.files || [];
  const fileName = artifact?.fileName || artifact?.title || "artifact";

  if (!artifact) return null;

  const copyAll = async () => {
    try {
      const text = files.map((file) => `/* ${file.name} */\n${file.content}`).join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const downloadZip = () => {
    if (!files.length) return;
    const safe = String(artifact.title || "quorvex-project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    downloadBlob(createZip(files), `${safe || "project"}.zip`);
  };

  return (
    <div className="mt-3 w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-tint-1">
      <div className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
          style={{
            borderColor: `${meta.accent}55`,
            background: `${meta.accent}14`,
            color: meta.accent,
          }}
        >
          <AgentGlyph agentId={meta.agent} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {artifact.title || "Untitled artifact"}
          </span>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
            {meta.label}
            {files.length ? ` · ${files.length} file${files.length > 1 ? "s" : ""}` : ""}
            {artifact.slides ? ` · ${artifact.slides} slides` : ""}
            {artifact.size ? ` · ${humanFileSize(artifact.size)}` : ""}
          </span>
        </span>
        <Icon size={15} className="text-ink-faint" aria-hidden="true" />
      </div>

      <div className="p-3">
        {(artifact.type === "web" || artifact.type === "code") && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {files.slice(0, 6).map((file) => (
                <span
                  key={file.name}
                  className="rounded-md border border-line bg-void px-2 py-1 font-mono text-[10px] text-ink-soft"
                >
                  {file.name}
                </span>
              ))}
            </div>

            {artifact.type === "image" && artifact.url ? (
              <a href={artifact.url} target="_blank" rel="noreferrer" className="mt-3 block">
                <img
                  src={artifact.url}
                  alt={artifact.title || "Generated image"}
                  className="max-h-64 w-full rounded-lg border border-line object-cover"
                />
              </a>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Action
                primary
                icon={SquareArrowOutUpRight}
                onClick={() => dispatch(openSandbox(artifact))}
              >
                Open in sandbox
              </Action>
              <Action icon={copied ? Check : Copy} onClick={copyAll}>
                {copied ? "Copied" : "Copy"}
              </Action>
              <Action icon={Download} onClick={downloadZip}>
                .zip
              </Action>
            </div>
          </>
        )}

        {artifact.type === "pdf" && (
          <div className="flex flex-wrap gap-2">
            <Action
              primary
              href={artifact.url}
              download={artifact.url ? fileName : undefined}
              icon={Download}
            >
              Download
            </Action>
            <Action href={artifact.url} icon={ExternalLink}>
              Preview
            </Action>
          </div>
        )}

        {artifact.type === "ppt" && (
          <div className="flex flex-wrap gap-2">
            <Action
              primary
              href={artifact.url}
              download={artifact.url ? fileName : undefined}
              icon={Download}
            >
              Download .pptx
            </Action>
          </div>
        )}

        {artifact.type === "image" && (
          <div className="space-y-3">
            {artifact.url && (
              <a href={artifact.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={artifact.url}
                  alt={artifact.title || "Generated image"}
                  className="max-h-64 w-full rounded-lg border border-line object-cover"
                />
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Action primary href={artifact.url} icon={ExternalLink}>
                View
              </Action>
              <Action
                href={artifact.url}
                download={artifact.url ? fileName : undefined}
                icon={Download}
              >
                Download
              </Action>
            </div>
          </div>
        )}

        {artifact.type === "ppt" && artifact.url && (
          <p className="mt-2 font-mono text-[10px] text-ink-faint">
            Signed link · {artifact.fileName || "presentation.pptx"}
          </p>
        )}
      </div>
    </div>
  );
}
