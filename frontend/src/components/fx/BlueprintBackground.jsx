/**
 * Engineering blueprint backdrop: technical grid, faint circuit traces and a
 * couple of slow signal pulses. No stars, no planets, no nebulas.
 */
export default function BlueprintBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 blueprint-grid opacity-80" />
      <div className="absolute inset-0 circuit-traces opacity-70" />

      {/* conduits down the edges */}
      <div className="absolute left-[7%] top-0 hidden h-full w-px bg-[linear-gradient(180deg,transparent,var(--line-strong),transparent)] md:block" />
      <div className="absolute right-[7%] top-0 hidden h-full w-px bg-[linear-gradient(180deg,transparent,var(--line-strong),transparent)] md:block" />
      <span className="absolute left-[7%] top-[22%] hidden h-24 w-px bg-[linear-gradient(180deg,transparent,var(--accent),transparent)] opacity-60 animate-[scan_9s_linear_infinite] md:block" />
      <span className="absolute right-[7%] top-[58%] hidden h-32 w-px bg-[linear-gradient(180deg,transparent,var(--hud),transparent)] opacity-60 animate-[scan_12s_linear_infinite] md:block" />

      {/* corner registration marks */}
      <div className="absolute left-4 top-20 h-4 w-4 border-l border-t border-line-strong opacity-70" />
      <div className="absolute right-4 top-20 h-4 w-4 border-r border-t border-line-strong opacity-70" />
      <div className="absolute bottom-4 left-4 h-4 w-4 border-b border-l border-line-strong opacity-70" />
      <div className="absolute bottom-4 right-4 h-4 w-4 border-b border-r border-line-strong opacity-70" />
    </div>
  );
}
