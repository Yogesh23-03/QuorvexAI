import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import { Check, Coins, Crown, Sparkles, X } from "lucide-react";
import GlowButton from "../ui/GlowButton";
import HudFrame from "../ui/HudFrame";
import { PLANS, openCheckout } from "../../features/billing";
import { fetchCurrentUser } from "../../features/auth";
import { setBillingOpen, pushToast } from "../../redux/uiSlice";
import { setUserdata } from "../../redux/userSlice";
import { cx, formatCredits } from "../../lib/utils";

export default function BillingDrawer() {
  const dispatch = useDispatch();
  const open = useSelector((state) => state.ui.billingOpen);
  const { userData } = useSelector((state) => state.user);
  const close = () => dispatch(setBillingOpen(false));

  const handleUpgrade = async (plan) => {
    try {
      const result = await openCheckout({
        plan: plan.id,
        onSuccess: () => undefined,
        onFailure: () => undefined,
      });
      dispatch(
        pushToast({
          tone: "success",
          title: "Payment verified",
          message: `${plan.credits} credits added to your account.`,
        }),
      );

      // Prefer the user returned by the billing service, then re-sync from the API.
      if (result?.user) dispatch(setUserdata({ ...userData, ...result.user }));
      const fresh = await fetchCurrentUser();
      if (fresh) dispatch(setUserdata(fresh));
    } catch (error) {
      if (/cancelled/i.test(error?.message || "")) {
        dispatch(pushToast({ tone: "info", message: "Checkout cancelled." }));
        return;
      }
      dispatch(
        pushToast({
          tone: "error",
          title: "Payment failed",
          message: error?.message || "We could not complete that payment.",
        }),
      );
    }
  };

  const creditRatio = userData
    ? Math.min(100, Math.round(((userData.credits || 0) / (userData.totalCredits || 1)) * 100))
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close billing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Billing and credits"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.26, ease: "easeInOut" }}
            className="fixed inset-y-0 right-0 z-[71] flex w-[min(94vw,420px)] flex-col border-l border-line bg-void/90 backdrop-blur-2xl"
          >
            <header className="flex items-center justify-between border-b border-line p-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-50">Billing</h2>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  plans &amp; credits
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close billing"
                className="rounded-lg border border-line bg-tint-1 p-2 text-slate-300 transition-colors hover:border-neon/40"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-slim">
              <HudFrame label="Current plan" hint={userData?.plan || "free"}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-xl text-slate-100 capitalize">
                      {userData?.plan || "free"}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {userData?.planExpiresAt
                        ? `renews ${new Date(userData.planExpiresAt).toLocaleDateString()}`
                        : "no expiry"}
                    </p>
                  </div>
                  <Crown className="text-amber-300" size={22} aria-hidden="true" />
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <Coins size={13} className="text-amber-300" aria-hidden="true" /> credits
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatCredits(userData?.credits)} / {formatCredits(userData?.totalCredits)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint-3">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#FF6A2B,#2563EB)] transition-all duration-500"
                      style={{ width: `${creditRatio}%` }}
                    />
                  </div>
                </div>
              </HudFrame>

              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={cx(
                    "relative overflow-hidden rounded-2xl border p-4 hud-corners",
                    plan.highlighted
                      ? "border-violet/40 bg-violet/[0.08] glow-violet"
                      : "border-line bg-tint-1",
                  )}
                >
                  {plan.highlighted && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-violet/40 bg-violet/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-violet">
                      <Sparkles size={10} aria-hidden="true" /> popular
                    </span>
                  )}
                  <h3 className="font-display text-base font-semibold text-slate-100">
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-400">{plan.tagline}</p>
                  <p className="mt-3 font-display text-2xl text-slate-50">
                    ₹{plan.amount}
                    <span className="ml-1 font-sans text-[12px] text-slate-500">/ month</span>
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {plan.perks.map((perk) => (
                      <li
                        key={perk}
                        className="flex items-start gap-2 text-[12.5px] text-slate-300"
                      >
                        <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <GlowButton
                    fullWidth
                    className="mt-4"
                    variant={plan.highlighted ? "primary" : "ghost"}
                    onClick={() => handleUpgrade(plan)}
                  >
                    Add {formatCredits(plan.credits)} credits
                  </GlowButton>
                </div>
              ))}

              <p className="font-mono text-[10px] leading-relaxed text-slate-600">
                Payments run through Razorpay in test mode. Credits are added only after the server
                verifies the payment signature.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
