import { useEffect, useState } from "react";
import RobotGlyph from "../robot/RobotGlyph";
import { cx } from "../../lib/utils";

const LABELS = ["Thinking", "Analysing", "Reasoning", "Generating", "Rendering"];

export default function AICoreLoader({ label, sublabel, className }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (label) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % LABELS.length), 1700);
    return () => clearInterval(timer);
  }, [label]);

  const text = label || LABELS[index];

  return (
    <div className={cx("flex items-center gap-3", className)} role="status" aria-live="polite">
      <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-line bg-tint-1">
        <RobotGlyph state="thinking" size={34} showBody={false} />
      </span>
      <span className="flex flex-col">
        <span className="stream-text font-mono text-[12px] uppercase tracking-[0.2em] text-neon caret">
          {text}
        </span>
        {sublabel && <span className="mt-0.5 text-[11px] text-ink-faint">{sublabel}</span>}
      </span>
    </div>
  );
}
