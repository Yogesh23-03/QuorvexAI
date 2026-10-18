import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Check, Coins, Cpu, Minus, Sparkles } from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import GlowButton from "../components/ui/GlowButton";
import HudFrame from "../components/ui/HudFrame";
import StatusPill from "../components/ui/StatusPill";
import Footer from "../components/layout/Footer";
import { PLANS, openCheckout } from "../features/billing";
import { fetchCurrentUser } from "../features/auth";
import { AGENTS } from "../lib/agents";
import { pushToast, setBillingOpen } from "../redux/uiSlice";
import { setUserdata } from "../redux/userSlice";
import { cx, formatCredits } from "../lib/utils";

const COMPARISON = [
  { feature: "Monthly credits", free: "100", starter: "500", pro: "1,000" },
  { feature: "All six agents", free: true, starter: true, pro: true },
  { feature: "Live code sandbox", free: true, starter: true, pro: true },
  { feature: "PDF / PPTX exports", free: true, starter: true, pro: true },
  { feature: "Priority agent queue", free: false, starter: false, pro: true },
  { feature: "Commercial usage rights", free: false, starter: false, pro: true },
];

const Cell = ({ value }) => {
  if (value === true)
    return <Check size={14} className="mx-auto text-lime" aria-label="included" />;
  if (value === false)
    return <Minus size={14} className="mx-auto text-slate-600" aria-label="not included" />;
  return <span className="font-mono text-[12px] text-slate-200">{value}</span>;
};

export default function PricingPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);

  const startCheckout = async (plan) => {
    if (!userData) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }

    try {
      const result = await openCheckout({ plan: plan.id });
      if (result?.user) dispatch(setUserdata({ ...userData, ...result.user }));
      const fresh = await fetchCurrentUser().catch(() => null);
      if (fresh) dispatch(setUserdata(fresh));
      dispatch(
        pushToast({
          tone: "success",
          title: "Payment verified",
          message: `${formatCredits(plan.credits)} credits added.`,
        }),
      );
    } catch (error) {
      if (/cancelled/i.test(error?.message || "")) {
        dispatch(pushToast({ tone: "info", message: "Checkout cancelled." }));
        return;
      }
      dispatch(
        pushToast({
          tone: "error",
          title: "Payment failed",
          message: error?.message || "Try again.",
        }),
      );
    }
  };

  return (
    <>
      <section className="mx-auto w-full max-w-[1400px] px-4 pt-12 sm:px-6 lg:pt-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <StatusPill label="TRANSPARENT CREDIT PRICING" />
          <h1 className="max-w-2xl font-display text-4xl font-black leading-tight text-slate-50 sm:text-5xl">
            Pay for outcomes,
            <span className="block bg-[linear-gradient(110deg,#FF6A2B,#2563EB)] bg-clip-text text-transparent">
              not for seats
            </span>
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-slate-400">
            Every agent has a fixed credit cost. Failed runs are refunded automatically, so you only
            ever pay for work you receive.
          </p>
          {userData && (
            <button
              type="button"
              onClick={() => dispatch(setBillingOpen(true))}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-tint-1 px-3.5 py-1.5 font-mono text-[11px] text-slate-300 transition-colors hover:border-neon/40"
            >
              <Coins size={13} className="text-amber-300" aria-hidden="true" />
              balance: {formatCredits(userData.credits)} credits
            </button>
          )}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <GlassCard hud tilt padding="p-6" className="flex flex-col">
            <h2 className="font-display text-lg font-semibold text-slate-100">Free</h2>
            <p className="mt-1 text-[13px] text-slate-400">
              Kick the tyres, keep the chat history.
            </p>
            <p className="mt-4 font-display text-3xl text-slate-50">
              ₹0
              <span className="ml-1 font-sans text-[12px] text-slate-500">forever</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2">
              {[
                "100 credits on signup",
                "Chat, search and code agents",
                "Session history in Redis + Mongo",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] text-slate-300">
                  <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <GlowButton
              fullWidth
              variant="ghost"
              className="mt-6"
              onClick={() => navigate(userData ? "/chat" : "/login")}
            >
              {userData ? "Open command center" : "Start free"}
            </GlowButton>
          </GlassCard>

          {PLANS.map((plan) => (
            <GlassCard
              key={plan.id}
              hud
              tilt
              padding="p-6"
              className={cx(
                "relative flex flex-col",
                plan.highlighted
                  ? "border-violet/40 bg-[linear-gradient(160deg,rgba(37,99,235,0.16),rgba(255,106,43,0.08))] glow-violet"
                  : "",
              )}
            >
              {plan.highlighted && (
                <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full border border-violet/40 bg-violet/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-violet">
                  <Sparkles size={10} aria-hidden="true" /> best value
                </span>
              )}
              <h2 className="font-display text-lg font-semibold text-slate-100">{plan.name}</h2>
              <p className="mt-1 text-[13px] text-slate-400">{plan.tagline}</p>
              <p className="mt-4 font-display text-3xl text-slate-50">
                ₹{plan.amount}
                <span className="ml-1 font-sans text-[12px] text-slate-500">/ month</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-[13px] text-slate-300">
                    <Check size={13} className="mt-0.5 shrink-0 text-lime" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
              <GlowButton
                fullWidth
                className="mt-6"
                variant={plan.highlighted ? "primary" : "ghost"}
                magnetic={plan.highlighted}
                onClick={() => startCheckout(plan)}
              >
                Get {formatCredits(plan.credits)} credits
              </GlowButton>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <GlassCard padding="p-0" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <caption className="sr-only">Plan comparison</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      capability
                    </th>
                    {["free", "starter", "pro"].map((tier) => (
                      <th
                        key={tier}
                        className="px-5 py-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-neon/80"
                      >
                        {tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 text-[13px] text-slate-300">{row.feature}</td>
                      <td className="px-5 py-3 text-center">
                        <Cell value={row.free} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Cell value={row.starter} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Cell value={row.pro} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <HudFrame label="agent credit costs" hint="per run">
              <ul className="space-y-2">
                {AGENTS.map((agent) => (
                  <li key={agent.id} className="flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <agent.icon size={13} className="text-neon" aria-hidden="true" />
                      {agent.label}
                    </span>
                    <span className="font-mono text-[12px] text-slate-400">
                      {agent.cost} credits
                    </span>
                  </li>
                ))}
              </ul>
            </HudFrame>

            <GlassCard padding="p-5" hud>
              <p className="inline-flex items-center gap-2 font-display text-[15px] font-semibold text-slate-100">
                <Cpu size={15} className="text-violet" aria-hidden="true" /> How charging works
              </p>
              <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-slate-400">
                <li>1. Credits are reserved before an agent starts.</li>
                <li>2. If the run fails or times out, the reservation is refunded.</li>
                <li>3. Balances are updated atomically, so they never go negative.</li>
              </ol>
            </GlassCard>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
