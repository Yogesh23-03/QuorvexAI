import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Coins, Cpu, LogOut, Mail, Shield, Sparkles, User } from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import GlowButton from "../components/ui/GlowButton";
import HudFrame from "../components/ui/HudFrame";
import StatusPill from "../components/ui/StatusPill";
import Footer from "../components/layout/Footer";
import { logout } from "../features/auth";
import { resetConversations } from "../redux/conversationSlice";
import { resetConversationState } from "../redux/messageSlice";
import { pushToast, setBillingOpen } from "../redux/uiSlice";
import { setUserdata } from "../redux/userSlice";
import { AGENTS } from "../lib/agents";
import { API_BASE_URL } from "../lib/api";
import { formatCredits } from "../lib/utils";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500">
        <Icon size={13} className="text-neon" aria-hidden="true" />
        {label}
      </span>
      <span className="truncate text-[13px] text-slate-200">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      dispatch(setUserdata(null));
      dispatch(resetConversations());
      dispatch(resetConversationState());
      dispatch(pushToast({ tone: "success", message: "Signed out." }));
      navigate("/");
    }
  };

  const creditRatio = Math.min(
    100,
    Math.round(((userData?.credits || 0) / (userData?.totalCredits || 1)) * 100),
  );

  return (
    <>
      <section className="mx-auto w-full max-w-[1100px] px-4 pt-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-50">Settings</h1>
            <p className="mt-1 text-[13px] text-slate-400">
              Your account, plan, usage and session controls.
            </p>
          </div>
          <StatusPill label="SESSION ACTIVE" />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <GlassCard hud padding="p-6" tilt>
            <div className="flex items-center gap-4">
              {userData?.avatar ? (
                <img
                  src={userData.avatar}
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-neon/25 object-cover"
                />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-tint-2 text-neon">
                  <User size={20} aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-slate-100">
                  {userData?.name || "Explorer"}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500">{userData?.email}</p>
              </div>
            </div>

            <div className="mt-5">
              <Row icon={Mail} label="email" value={userData?.email || "—"} />
              <Row
                icon={Shield}
                label="plan"
                value={`${userData?.plan || "free"}${
                  userData?.planExpiresAt
                    ? ` · renews ${new Date(userData.planExpiresAt).toLocaleDateString()}`
                    : ""
                }`}
              />
              <Row icon={Cpu} label="api base" value={API_BASE_URL} />
              <Row
                icon={Sparkles}
                label="agents"
                value={`${AGENTS.length - 1} specialists + auto router`}
              />
            </div>
          </GlassCard>

          <div className="space-y-5">
            <GlassCard hud padding="p-6" tilt>
              <HudFrame label="credits" hint={userData?.plan || "free"}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-3xl text-slate-50">
                    {formatCredits(userData?.credits)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    of {formatCredits(userData?.totalCredits)}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-tint-3">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#FF6A2B,#2563EB)] transition-all duration-500"
                    style={{ width: `${creditRatio}%` }}
                  />
                </div>
              </HudFrame>
              <GlowButton
                fullWidth
                icon={Coins}
                className="mt-4"
                onClick={() => dispatch(setBillingOpen(true))}
              >
                Buy more credits
              </GlowButton>
            </GlassCard>

            <GlassCard hud padding="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neon/80">
                agent costs
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {AGENTS.map((agent) => (
                  <li
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-tint-1 px-2.5 py-1.5"
                  >
                    <span className="inline-flex items-center gap-2 text-[12px] text-slate-300">
                      <agent.icon size={12} className="text-neon" aria-hidden="true" />
                      {agent.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">{agent.cost}c</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard hud padding="p-6" className="border-rose-400/25 bg-rose-500/[0.05]">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-rose-300">
                session
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                Signing out clears the Redis session and the httpOnly cookie on this device.
              </p>
              <GlowButton variant="danger" icon={LogOut} className="mt-4" onClick={handleLogout}>
                Sign out
              </GlowButton>
            </GlassCard>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
