import { forwardRef } from "react";
import { useTilt } from "../../lib/hooks";
import { cx } from "../../lib/utils";

/**
 * The workhorse surface: translucent glass, optional HUD brackets and an
 * optional 3D tilt with a light sheen that follows the pointer.
 */
const GlassCard = forwardRef(function GlassCard(
  { as: Tag = "div", tilt = false, hud = false, padding = "p-5", className, children, ...rest },
  forwardedRef,
) {
  const tiltProps = useTilt({ max: tilt ? 7 : 0, disabled: !tilt });

  const setRefs = (node) => {
    tiltProps.ref.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  return (
    <Tag
      ref={setRefs}
      onMouseMove={tilt ? tiltProps.onMouseMove : undefined}
      onMouseLeave={tilt ? tiltProps.onMouseLeave : undefined}
      className={cx(
        "group relative overflow-hidden rounded-2xl glass",
        hud && "hud-corners",
        tilt && "tilt-card",
        padding,
        className,
      )}
      {...rest}
    >
      {tilt && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 tilt-sheen opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}
      {children}
    </Tag>
  );
});

export default GlassCard;
