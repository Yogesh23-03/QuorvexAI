import { Suspense, lazy, useEffect, useState } from "react";
import RobotGlyph from "./RobotGlyph";
import { useHeavyVisualsEnabled } from "../../lib/hooks";
import { useTheme } from "../../lib/theme-context";

const RobotScene = lazy(() => import("./RobotScene.jsx"));

/**
 * Mounts the WebGL scene only once the browser is idle, so three.js (~660 ms of
 * script bootup on desktop) never competes with the first paint or the hero
 * copy. The static glyph covers the gap.
 */
function useIdleMount(enabled) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [enabled]);

  return ready;
}

/**
 * Quor, the mascot. The WebGL scene is desktop-only, lazy and idle-mounted;
 * everything else gets the static SVG so mobile stays fast and readable.
 */
export default function RobotMascot({
  state = "idle",
  className = "",
  glyphSize = 120,
  showBody = true,
  forceStatic = false,
}) {
  const heavy = useHeavyVisualsEnabled();
  const { isDark } = useTheme();
  const webglReady = useIdleMount(heavy && !forceStatic);

  if (!heavy || forceStatic || !webglReady) {
    return <RobotGlyph state={state} size={glyphSize} showBody={showBody} className={className} />;
  }

  return (
    <Suspense
      fallback={
        <RobotGlyph state={state} size={glyphSize} showBody={showBody} className={className} />
      }
    >
      <RobotScene
        state={state}
        isDark={isDark}
        className={className}
        size={glyphSize}
        fill={Boolean(className)}
      />
    </Suspense>
  );
}
