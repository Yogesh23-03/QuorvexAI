import { cx } from "../../lib/utils";

/**
 * QuorvexAI mark: a robotic "Q" — outer ring chassis, visor slit and a
 * single glowing eye, with the tail as a servo arm.
 */
function LogoMark({ size = 34, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="QuorvexAI logo"
      className={cx("shrink-0", className)}
    >
      <defs>
        <linearGradient id="q-shell" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A4C" />
          <stop offset="1" stopColor="#FF6A2B" />
        </linearGradient>
      </defs>
      <rect
        x="7"
        y="7"
        width="44"
        height="44"
        rx="14"
        fill="none"
        stroke="url(#q-shell)"
        strokeWidth="3.2"
      />
      <rect x="16" y="21" width="26" height="13" rx="6.5" fill="#111722" />
      <circle cx="24" cy="27.5" r="3.1" fill="var(--hud)" />
      <circle cx="34" cy="27.5" r="3.1" fill="#FF6A2B" />
      <path
        d="M21 41h14"
        stroke="var(--hud)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path d="M40 40l11 11" stroke="url(#q-shell)" strokeWidth="5" strokeLinecap="round" />
      <rect x="28" y="3" width="2" height="5" rx="1" fill="#FF6A2B" />
      <circle cx="29" cy="2.6" r="1.9" fill="#FF6A2B" />
    </svg>
  );
}

export default function Logo({ compact = false, className }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={compact ? 28 : 34} />
      {!compact && (
        <span className="hidden flex-col leading-none sm:flex">
          <span className="font-display text-[17px] font-bold tracking-[0.08em] text-ink-strong">
            QUORVEX<span className="text-neon">AI</span>
          </span>
          <span className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.3em] text-ink-faint">
            robotic agent lab
          </span>
        </span>
      )}
    </span>
  );
}
