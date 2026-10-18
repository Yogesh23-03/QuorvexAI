import { cx } from "../../lib/utils";

const TONES = {
  online: { dot: "bg-lime", text: "text-lime", ring: "bg-lime/40", label: "ONLINE" },
  busy: { dot: "bg-neon", text: "text-neon", ring: "bg-neon/40", label: "WORKING" },
  offline: {
    dot: "bg-ink-faint",
    text: "text-ink-soft",
    ring: "bg-ink-faint/30",
    label: "OFFLINE",
  },
};

export default function StatusPill({ tone = "online", label, className }) {
  const style = TONES[tone] || TONES.online;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border border-line bg-tint-1 px-2.5 py-1",
        "font-mono text-[10px] uppercase tracking-[0.22em]",
        style.text,
        className,
      )}
      role="status"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cx("absolute inline-flex h-full w-full animate-ping rounded-full", style.ring)}
        />
        <span className={cx("relative inline-flex h-2 w-2 rounded-full", style.dot)} />
      </span>
      {label || style.label}
    </span>
  );
}
