import { useEffect, useState } from "react";
import { useMediaQuery, useReducedMotion } from "../../lib/hooks";

/**
 * Desktop-only cursor halo. Pointer-fine devices get the glow; touch devices
 * and reduced-motion users get nothing at all.
 */
export default function CursorGlow() {
  const reduced = useReducedMotion();
  const pointerFine = useMediaQuery("(pointer: fine)");
  const [position, setPosition] = useState({ x: -400, y: -400 });

  useEffect(() => {
    if (!pointerFine || reduced) return undefined;
    const onMove = (event) => setPosition({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerFine, reduced]);

  if (!pointerFine || reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="cursor-glow"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    />
  );
}
