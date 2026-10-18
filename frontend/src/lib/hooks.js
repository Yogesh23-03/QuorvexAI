import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const hasMatchMedia = () => typeof window !== "undefined" && Boolean(window.matchMedia);

function subscribeToQuery(query, onChange) {
  if (!hasMatchMedia()) return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const readQuery = (query) => (hasMatchMedia() ? window.matchMedia(query).matches : false);

/** Media queries read through useSyncExternalStore: no setState inside effects. */
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => subscribeToQuery(query, onChange), [query]);
  const getSnapshot = useCallback(() => readQuery(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

/**
 * Heavy WebGL work is opt-out on small screens, low core counts and
 * reduced-motion preferences so the page never janks on low-end devices.
 */
export function useHeavyVisualsEnabled() {
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;

  return !reduced && isDesktop && cores > 3;
}

/** Mouse-following CSS 3D tilt with a light sheen, disabled for reduced motion. */
export function useTilt({ max = 8, disabled = false } = {}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const off = disabled || reduced;

  const onMouseMove = useCallback(
    (event) => {
      const element = ref.current;
      if (!element || off) return;
      const rect = element.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * max * 2;
      const rotateX = (0.5 - py) * max * 2;
      element.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
      element.style.setProperty("--sheen-x", `${(px * 100).toFixed(1)}%`);
      element.style.setProperty("--sheen-y", `${(py * 100).toFixed(1)}%`);
    },
    [max, off],
  );

  const onMouseLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

/**
 * Counts up to a value when scrolled into view — used for landing stats.
 * The target is the initial value whenever animation is not possible, so the
 * effect never needs to correct state synchronously.
 */
export function useCountUp(target, { duration = 1400, start = 0 } = {}) {
  const reduced = useReducedMotion();
  const hasObserver = typeof IntersectionObserver !== "undefined";
  const canAnimate = !reduced && hasObserver;

  const [value, setValue] = useState(canAnimate ? start : target);
  const ref = useRef(null);

  useEffect(() => {
    if (!canAnimate) return undefined;
    const element = ref.current;
    if (!element) return undefined;

    let frame;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const startedAt = performance.now();
          let lastPaint = 0;
          const tick = (now) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            // Cap updates at ~30 fps; the rounded value only changes so often.
            if (now - lastPaint >= 33 || progress === 1) {
              lastPaint = now;
              const next = Math.round(start + (target - start) * (1 - (1 - progress) ** 3));
              setValue((previous) => (previous === next ? previous : next));
            }
            if (progress < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
          observer.disconnect();
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration, start, canAnimate]);

  return useMemo(() => ({ ref, value }), [value]);
}
