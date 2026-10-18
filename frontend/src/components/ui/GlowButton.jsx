import { useCallback, useRef, useState } from "react";
import { cx } from "../../lib/utils";

const VARIANTS = {
  primary:
    "bg-neon text-slate-950 font-semibold border border-transparent shadow-[0_10px_26px_-14px_color-mix(in_srgb,var(--accent)_85%,transparent)] hover:brightness-110 active:translate-y-px",
  ghost:
    "bg-tint-1 text-ink border border-line hover:border-line-strong hover:bg-tint-2 active:translate-y-px",
  outline:
    "bg-transparent text-neon border border-neon/45 hover:bg-neon/10 hover:shadow-[0_0_22px_color-mix(in_srgb,var(--accent)_28%,transparent)] active:translate-y-px",
  danger:
    "bg-rose-500/15 text-rose-500 border border-rose-500/35 hover:bg-rose-500/20 dark:text-rose-300",
};

const SIZES = {
  sm: "px-3 py-2 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-[15px] rounded-xl gap-2.5",
};

export default function GlowButton({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  magnetic = false,
  fullWidth = false,
  className,
  children,
  ...rest
}) {
  const buttonRef = useRef(null);
  const [ripples, setRipples] = useState([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleClick = useCallback(
    (event) => {
      const element = buttonRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        const id = Date.now() + Math.random();
        setRipples((current) => [
          ...current,
          { id, x: event.clientX - rect.left, y: event.clientY - rect.top },
        ]);
        setTimeout(() => setRipples((current) => current.filter((r) => r.id !== id)), 620);
      }
      rest.onClick?.(event);
    },
    [rest],
  );

  const handleMove = (event) => {
    if (!magnetic) return;
    const element = buttonRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
    setOffset({ x, y });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      {...rest}
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      disabled={rest.disabled || loading}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      className={cx(
        "relative inline-flex select-none items-center justify-center overflow-hidden transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        Icon && <Icon size={size === "lg" ? 18 : 15} aria-hidden="true" />
      )}
      <span className="relative z-10">{children}</span>
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-[pulseCore_620ms_ease-out_1] rounded-full bg-slate-950/20"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
    </button>
  );
}
