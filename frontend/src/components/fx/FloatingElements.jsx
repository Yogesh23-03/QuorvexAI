import { motion } from "motion/react";
import { Cpu, Hexagon, Radio, Sparkles, Terminal } from "lucide-react";
import { useMediaQuery, useReducedMotion } from "../../lib/hooks";
import { cx } from "../../lib/utils";

const CHIPS = [
  { label: "AGENTS ONLINE", icon: Radio, className: "left-[6%] top-[22%]", tone: "text-lime" },
  { label: "LANGGRAPH ROUTER", icon: Cpu, className: "right-[8%] top-[18%]", tone: "text-neon" },
  {
    label: "SANDBOX READY",
    icon: Terminal,
    className: "left-[12%] bottom-[18%]",
    tone: "text-violet",
  },
  {
    label: "6 SPECIALISTS",
    icon: Sparkles,
    className: "right-[10%] bottom-[24%]",
    tone: "text-magenta",
  },
];

export default function FloatingElements({ className }) {
  const reduced = useReducedMotion();
  // These chips are desktop-only; not mounting them keeps mobile JS work low.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const float = (delay, distance = 14) =>
    reduced
      ? {}
      : {
          animate: { y: [0, -distance, 0], x: [0, distance / 3, 0] },
          transition: { duration: 7 + delay, repeat: Infinity, ease: "easeInOut", delay },
        };

  if (!isDesktop) return null;

  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0", className)}>
      {CHIPS.map((chip, index) => {
        const Icon = chip.icon;
        return (
          <motion.span
            key={chip.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            {...float(index * 0.4)}
            className={cx(
              "absolute hidden items-center gap-2 rounded-full border border-line bg-tint-2 px-3 py-1.5",
              "font-mono text-[10px] uppercase tracking-[0.2em] backdrop-blur-md lg:inline-flex",
              chip.className,
            )}
          >
            <Icon size={12} className={chip.tone} />
            <span className="text-slate-300">{chip.label}</span>
          </motion.span>
        );
      })}

      <motion.div
        {...float(0.6, 20)}
        className="absolute left-[46%] top-[8%] hidden text-violet/40 lg:block"
      >
        <Hexagon size={54} strokeWidth={1} />
      </motion.div>
      <motion.div
        {...float(1.2, 16)}
        className="absolute right-[26%] bottom-[12%] hidden text-neon/40 lg:block"
      >
        <Hexagon size={38} strokeWidth={1} />
      </motion.div>

      {!reduced && (
        <>
          <span className="absolute left-1/2 top-1/2 hidden h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line lg:block" />
          <span className="absolute left-1/2 top-1/2 hidden h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 animate-[sweep_40s_linear_infinite] rounded-full border border-dashed border-neon/15 lg:block" />
          <span className="absolute left-1/2 top-1/2 hidden h-[740px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04] lg:block" />
        </>
      )}
    </div>
  );
}
