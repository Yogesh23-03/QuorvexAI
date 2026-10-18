import { useEffect, useState } from "react";
import { useReducedMotion } from "../../lib/hooks";
import { cx } from "../../lib/utils";

/**
 * Boot-up style typing effect. Reduced-motion users see the full text at once,
 * and all state changes happen inside timer callbacks rather than the effect body.
 */
export default function TypewriterText({
  text,
  speed = 26,
  className,
  startDelay = 0,
  onDone,
  as: Tag = "span",
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(() => (reduced ? text : ""));

  useEffect(() => {
    if (reduced) {
      onDone?.();
      return undefined;
    }

    // Several characters per tick keeps the effect smooth without one React
    // render per character, which matters on throttled mobile CPUs.
    const chunk = Math.max(2, Math.ceil(text.length / 45));
    let index = 0;
    let timer;

    const step = () => {
      index = Math.min(index + chunk, text.length);
      setShown(text.slice(0, index));
      if (index >= text.length) {
        onDone?.();
        return;
      }
      timer = setTimeout(step, speed);
    };

    timer = setTimeout(step, startDelay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay, reduced]);

  const complete = shown.length >= text.length;

  return (
    <Tag className={cx("stream-text", className)} data-testid="typewriter">
      {complete ? text : shown}
      {!reduced && !complete && <span className="caret" aria-hidden="true" />}
    </Tag>
  );
}
