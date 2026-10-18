import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Radio } from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import GlowButton from "../components/ui/GlowButton";
import HudFrame from "../components/ui/HudFrame";
import StatusPill from "../components/ui/StatusPill";
import FloatingElements from "../components/fx/FloatingElements";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <section className="relative mx-auto flex w-full max-w-[900px] flex-1 items-center px-4 py-16 sm:px-6">
      <FloatingElements />

      <GlassCard hud padding="p-8" className="relative w-full text-center">
        <StatusPill tone="offline" label="SIGNAL LOST" className="mx-auto" />

        <h1 className="mt-6 font-display text-6xl font-black text-slate-50">404</h1>
        <p className="mt-3 font-display text-lg text-neon">Route not found in the command grid</p>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-slate-400">
          The path you requested is not mapped to any agent or page. Head back to base and pick an
          agent from the roster.
        </p>

        <HudFrame label="diagnostics" hint="trace" className="mx-auto mt-6 max-w-sm text-left">
          <p className="font-mono text-[11px] leading-relaxed text-slate-500">
            route: {typeof window !== "undefined" ? window.location.pathname : "/"} <br />
            status: 404 NOT_FOUND <br />
            suggestion: /chat · /pricing · /settings
          </p>
        </HudFrame>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <GlowButton icon={Home} onClick={() => navigate("/")}>
            Return home
          </GlowButton>
          <GlowButton variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go back
          </GlowButton>
          <GlowButton variant="outline" icon={Radio} onClick={() => navigate("/chat")}>
            Open command center
          </GlowButton>
        </div>

        <p className="mt-6 text-[12px] text-slate-500">
          Still stuck?{" "}
          <Link to="/pricing" className="text-neon hover:text-neon/80">
            Review plans and limits
          </Link>
        </p>
      </GlassCard>
    </section>
  );
}
