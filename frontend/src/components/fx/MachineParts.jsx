import { useEffect, useRef } from "react";
import { cx } from "../../lib/utils";

const INK = "currentColor";

function Gear({ size = 90, teeth = 10, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      {Array.from({ length: teeth }).map((_, index) => (
        <rect
          key={index}
          x="46"
          y="2"
          width="8"
          height="14"
          rx="2"
          fill={INK}
          transform={`rotate(${(index * 360) / teeth} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="33" fill="none" stroke={INK} strokeWidth="7" />
      <circle cx="50" cy="50" r="12" fill="none" stroke={INK} strokeWidth="6" />
      <circle cx="50" cy="50" r="4" fill={INK} />
    </svg>
  );
}

function HexNut({ size = 46, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className={className} aria-hidden="true">
      <path d="M30 6l20 11v26L30 54 10 43V17z" fill="none" stroke={INK} strokeWidth="4" />
      <circle cx="30" cy="30" r="10" fill="none" stroke={INK} strokeWidth="3.5" />
      <path d="M30 20v20M20 30h20" stroke={INK} strokeWidth="1.4" opacity="0.4" />
    </svg>
  );
}

function Chip({ size = 84, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <g key={index}>
          <rect x={10 + index * 17} y="4" width="7" height="10" rx="1.5" fill={INK} opacity="0.8" />
          <rect
            x={10 + index * 17}
            y="86"
            width="7"
            height="10"
            rx="1.5"
            fill={INK}
            opacity="0.8"
          />
          <rect x="4" y={10 + index * 17} width="10" height="7" rx="1.5" fill={INK} opacity="0.8" />
          <rect
            x="86"
            y={10 + index * 17}
            width="10"
            height="7"
            rx="1.5"
            fill={INK}
            opacity="0.8"
          />
        </g>
      ))}
      <rect x="18" y="18" width="64" height="64" rx="7" fill="none" stroke={INK} strokeWidth="4" />
      <rect
        x="32"
        y="36"
        width="36"
        height="28"
        rx="3"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        opacity="0.7"
      />
      <circle cx="50" cy="50" r="3" fill={INK} />
    </svg>
  );
}

function Drone({ size = 96, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 110 90" className={className} aria-hidden="true">
      <ellipse
        cx="26"
        cy="26"
        rx="18"
        ry="4"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        opacity="0.8"
      />
      <ellipse
        cx="84"
        cy="26"
        rx="18"
        ry="4"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        opacity="0.8"
      />
      <path d="M26 30l18 16M84 30L66 46" stroke={INK} strokeWidth="3" />
      <rect
        x="38"
        y="42"
        width="34"
        height="24"
        rx="9"
        fill="none"
        stroke={INK}
        strokeWidth="3.4"
      />
      <rect x="45" y="50" width="20" height="8" rx="4" fill={INK} opacity="0.8" />
      <path d="M55 42v-9" stroke={INK} strokeWidth="2.4" />
      <circle cx="55" cy="31" r="3" fill={INK} />
      <path d="M42 66l-6 12M68 66l6 12" stroke={INK} strokeWidth="2.6" />
    </svg>
  );
}

function Arm({ size = 120, className }) {
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 160 120"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="96" r="14" fill="none" stroke={INK} strokeWidth="4" />
      <rect x="30" y="86" width="52" height="16" rx="8" fill="none" stroke={INK} strokeWidth="4" />
      <circle cx="88" cy="94" r="10" fill="none" stroke={INK} strokeWidth="4" />
      <path d="M92 88l28-38" stroke={INK} strokeWidth="10" strokeLinecap="round" opacity="0.75" />
      <circle cx="122" cy="46" r="9" fill="none" stroke={INK} strokeWidth="4" />
      <path d="M127 40l14-18" stroke={INK} strokeWidth="8" strokeLinecap="round" opacity="0.75" />
      <path d="M141 22l10-6M141 22l12 2" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

const PARTS = [
  { C: Gear, size: 110, className: "left-[2%] top-[24%] text-neon", rotate: 26, drift: 18 },
  { C: Gear, size: 58, className: "right-[5%] top-[62%] text-hud", rotate: -18, drift: 26 },
  { C: HexNut, size: 44, className: "left-[9%] top-[68%] text-ink-faint", rotate: 12, drift: 30 },
  { C: Chip, size: 92, className: "right-[3%] top-[16%] text-ink-soft", rotate: 10, drift: 20 },
  { C: Drone, size: 92, className: "left-[5%] top-[8%] text-hud", rotate: -8, drift: 36 },
  { C: Arm, size: 120, className: "right-[8%] bottom-[9%] text-ink-soft", rotate: 8, drift: 14 },
  { C: HexNut, size: 28, className: "left-[18%] top-[44%] text-neon", rotate: 40, drift: 24 },
  { C: Gear, size: 42, className: "right-[16%] top-[38%] text-ink-faint", rotate: -30, drift: 28 },
];

/**
 * Mechanical scenery pinned to the page edges. Purely decorative: never
 * captures pointers and never sits above content.
 */
export default function MachineParts({ className }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame = 0;
    const onMove = (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        element.style.setProperty("--px", x.toFixed(3));
        element.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block",
        className,
      )}
    >
      {PARTS.map(({ C, size, className: spot, rotate, drift }, index) => (
        <div
          key={index}
          className={cx("absolute opacity-[0.16] dark:opacity-[0.22]", spot)}
          style={{
            transform: `translate3d(calc(var(--px, 0) * ${drift}px), calc(var(--py, 0) * ${drift}px), 0) rotate(${rotate}deg)`,
            animation: `float ${8 + (index % 5)}s ease-in-out ${index * 0.4}s infinite`,
          }}
        >
          <C size={size} />
        </div>
      ))}
    </div>
  );
}
