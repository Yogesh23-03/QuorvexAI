import { AlertTriangle, RefreshCw } from "lucide-react";
import GlassCard from "./GlassCard";
import GlowButton from "./GlowButton";
import { cx } from "../../lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 text-center", className)}>
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-tint-1 text-neon">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-slate-100">{title}</h3>
      {description && (
        <p className="max-w-sm text-[13px] leading-relaxed text-slate-400">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({ error, title = "Something went wrong", onRetry, className }) {
  const message = error?.message || "Please try again.";

  return (
    <GlassCard
      hud
      className={cx("border-rose-400/25 bg-rose-500/[0.06]", className)}
      role="alert"
      data-testid="error-state"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300">
          <AlertTriangle size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13px] uppercase tracking-[0.14em] text-rose-200">
            {title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{message}</p>
          {error?.requestId && (
            <p className="mt-1 font-mono text-[10px] text-slate-500">ref: {error.requestId}</p>
          )}
          {onRetry && (
            <GlowButton
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              className="mt-3"
              onClick={onRetry}
            >
              Try again
            </GlowButton>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
