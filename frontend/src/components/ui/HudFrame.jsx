import { cx } from "../../lib/utils";

export default function HudFrame({ label, hint, children, className, contentClassName }) {
  return (
    <div className={cx("relative", className)}>
      {(label || hint) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {label && (
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-neon">
              {label}
            </span>
          )}
          {hint && <span className="font-mono text-[10px] text-ink-faint">{hint}</span>}
        </div>
      )}
      <div
        className={cx(
          "relative rounded-xl border border-line bg-tint-1 p-3 hud-corners",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
