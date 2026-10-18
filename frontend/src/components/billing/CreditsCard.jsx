import { useEffect, useState } from "react";
import { Clock, Coins } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import GlowButton from "../ui/GlowButton";
import HudFrame from "../ui/HudFrame";
import { fetchCurrentUser } from "../../features/auth";
import { setBillingOpen } from "../../redux/uiSlice";
import { setUserdata } from "../../redux/userSlice";
import { cx, formatCountdown, formatCredits } from "../../lib/utils";

export default function CreditsCard({ compact = false, className }) {
  const dispatch = useDispatch();
  const { userData } = useSelector((state) => state.user);
  const [tick, setTick] = useState(0);

  // Re-render every 30s so the countdown stays honest without hammering the API.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const credits = Number(userData?.credits ?? 0);
  const total = Number(userData?.totalCredits ?? 0) || 1;
  const ratio = Math.min(100, Math.round((credits / total) * 100));
  const nextResetAt = userData?.nextResetAt;

  // When the countdown elapses, pull fresh credits so the UI flips to 100.
  useEffect(() => {
    if (!nextResetAt) return;
    const remaining = new Date(nextResetAt).getTime() - Date.now();
    if (remaining > 0) return;
    let cancelled = false;
    (async () => {
      const fresh = await fetchCurrentUser().catch(() => null);
      if (!cancelled && fresh) dispatch(setUserdata(fresh));
    })();
    return () => {
      cancelled = true;
    };
  }, [nextResetAt, tick, dispatch]);

  return (
    <div className={cx("min-w-0", className)}>
      <HudFrame label="Credits" hint={userData?.plan || "free"}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-display text-xl text-ink">
            <Coins size={15} className="text-neon" aria-hidden="true" />
            {formatCredits(credits)}
          </span>
          <span className="font-mono text-[10px] text-ink-faint">/ {formatCredits(total)}</span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint-3">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--hud))] transition-all duration-500"
            style={{ width: `${ratio}%` }}
          />
        </div>

        {nextResetAt && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
            <Clock size={11} aria-hidden="true" />
            Resets in {formatCountdown(nextResetAt)}
          </p>
        )}

        {!compact && (
          <GlowButton
            size="sm"
            variant="outline"
            fullWidth
            className="mt-3"
            onClick={() => dispatch(setBillingOpen(true))}
          >
            Top up credits
          </GlowButton>
        )}
      </HudFrame>
    </div>
  );
}
