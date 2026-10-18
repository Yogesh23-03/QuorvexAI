import { cx } from "../../lib/utils";

const EYE = {
  idle: "var(--hud)",
  thinking: "var(--accent)",
  success: "var(--success)",
  error: "var(--danger)",
};

/**
 * "Quor" — static SVG fallback and chat avatar. The 3D scene reuses the same
 * proportions so switching between them feels seamless.
 */
export default function RobotGlyph({ state = "idle", size = 72, className, showBody = true }) {
  const eye = EYE[state] || EYE.idle;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Quor robot, ${state}`}
      className={cx(
        className,
        state === "thinking" && "animate-[pulseCore_2.4s_ease-in-out_infinite]",
      )}
    >
      {showBody && (
        <>
          <rect x="35" y="92" width="50" height="20" rx="9" fill="url(#quor-shell)" opacity="0.9" />
          <rect x="52" y="84" width="16" height="10" rx="4" fill="var(--steel)" />
          <circle cx="60" cy="101" r="3.4" fill={eye} />
        </>
      )}
      <path d="M60 24v-8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="13" r="4.2" fill={eye}>
        {state === "thinking" && (
          <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite" />
        )}
      </circle>
      <rect
        x="24"
        y="28"
        width="72"
        height="60"
        rx="20"
        fill="url(#quor-shell)"
        stroke="var(--line-strong)"
      />
      <rect x="38" y="46" width="44" height="22" rx="11" fill="#0B111B" />
      <g>
        <ellipse
          cx="49"
          cy="57"
          rx="4.6"
          ry="4.6"
          fill={eye}
          className={state === "thinking" ? "animate-[blink_2.2s_ease-in-out_infinite]" : undefined}
        />
        <ellipse cx="71" cy="57" rx="4.6" ry="4.6" fill={eye} />
        <ellipse cx="49" cy="55.6" rx="1.4" ry="1.4" fill="#fff" opacity="0.85" />
        <ellipse cx="71" cy="55.6" rx="1.4" ry="1.4" fill="#fff" opacity="0.85" />
      </g>
      <path
        d="M46 79h28"
        stroke="var(--hud)"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <rect x="14" y="44" width="7" height="22" rx="3.5" fill="var(--steel)" />
      <rect x="99" y="44" width="7" height="22" rx="3.5" fill="var(--steel)" />
      <defs>
        <linearGradient
          id="quor-shell"
          x1="24"
          y1="28"
          x2="96"
          y2="112"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#E8EDF5" />
          <stop offset="0.5" stopColor="#C8D2E0" />
          <stop offset="1" stopColor="#9FADBF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
