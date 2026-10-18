import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "motion/react";
import {
  ArrowRight,
  Blocks,
  Check,
  Code2,
  FileText,
  Gauge,
  Globe,
  ImageIcon,
  Presentation,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import RobotMascot from "../components/robot/RobotMascot";
import MachineParts from "../components/fx/MachineParts";
import GlassCard from "../components/ui/GlassCard";
import GlowButton from "../components/ui/GlowButton";
import HudFrame from "../components/ui/HudFrame";
import StatusPill from "../components/ui/StatusPill";
import AgentGlyph from "../components/ui/AgentGlyph";
import Footer from "../components/layout/Footer";
import { AGENTS } from "../lib/agents";
import { useCountUp } from "../lib/hooks";

const HERO_COPY =
  "QuorvexAI routes every request to the agent that can actually finish it — chat, live search, full code projects, PDFs, slide decks and images.";

const STATS = [
  { label: "specialist agents", value: 6, suffix: "" },
  { label: "credits on signup", value: 100, suffix: "" },
  { label: "median answer", value: 4, suffix: "s" },
  { label: "sandbox uptime", value: 99, suffix: "%" },
];

const STEPS = [
  {
    title: "Describe the outcome",
    body: "Type a prompt in plain language. The router reads intent, not keywords.",
    label: "01",
  },
  {
    title: "Auto picks a specialist",
    body: "Search feeds the writer, code gets a sandbox, documents get a renderer.",
    label: "02",
  },
  {
    title: "Take the artifact",
    body: "Copy, download a .zip, open the sandbox or export a signed PDF — one click.",
    label: "03",
  },
];

const FEATURES = [
  {
    icon: Blocks,
    title: "LangGraph orchestration",
    body: "A router classifies your intent and dispatches to the right specialist, with search results feeding the writer automatically.",
  },
  {
    icon: Code2,
    title: "Live code sandbox",
    body: "Multi-file projects arrive with a file viewer and an isolated iframe preview — no copy-paste, no local setup.",
  },
  {
    icon: FileText,
    title: "Documents that ship",
    body: "PDFs and PPTX decks are rendered server-side, stored in S3 and delivered through short-lived signed links.",
  },
  {
    icon: Gauge,
    title: "Credits you can trust",
    body: "One atomic charge per request, refunded automatically when a run fails. Your balance can never go negative.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    note: "forever",
    perks: ["100 credits", "All six agents", "Sandbox"],
  },
  {
    name: "Starter",
    price: "₹499",
    note: "/ month",
    perks: ["500 credits", "Priority queue", "All exports"],
    highlight: true,
  },
  {
    name: "Pro",
    price: "₹999",
    note: "/ month",
    perks: ["1,000 credits", "Commercial use", "Priority support"],
  },
];

function StatCard({ stat }) {
  const { ref, value } = useCountUp(stat.value);
  return (
    <div ref={ref} className="rounded-xl border border-line bg-tint-1 px-3 py-2.5">
      <p className="font-display text-xl text-ink">
        {value}
        {stat.suffix}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
        {stat.label}
      </p>
    </div>
  );
}

function Reveal({ children, delay = 0, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);

  return (
    <>
      <section className="relative overflow-hidden">
        <MachineParts />

        <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-16">
          <div>
            <StatusPill label="ROBOTIC AI COMMAND CENTER" />

            <h1 className="mt-5 max-w-2xl font-display text-4xl font-black leading-[1.04] text-ink-strong sm:text-5xl lg:text-[3.7rem]">
              Six specialist agents.
              <span className="block bg-[linear-gradient(100deg,var(--accent),var(--hud)_75%)] bg-clip-text text-transparent">
                One command center.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">{HERO_COPY}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <GlowButton
                size="lg"
                icon={Sparkles}
                magnetic
                onClick={() => navigate(userData ? "/chat" : "/signup")}
              >
                {userData ? "Open command center" : "Start free — 100 credits"}
              </GlowButton>
              <GlowButton
                size="lg"
                variant="ghost"
                icon={ArrowRight}
                onClick={() => navigate("/pricing")}
              >
                See pricing
              </GlowButton>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {STATS.map((stat) => (
                <StatCard key={stat.label} stat={stat} />
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto h-[320px] w-full max-w-[440px] sm:h-[400px]">
              <span className="absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line sm:h-[360px] sm:w-[360px]" />
              <span className="absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 animate-[sweep_34s_linear_infinite] rounded-full border border-dashed border-neon/25 sm:h-[290px] sm:w-[290px]" />
              <div className="absolute inset-0 grid place-items-center">
                <RobotMascot state="idle" glyphSize={150} className="h-full w-full" />
              </div>

              <div className="absolute -bottom-2 left-0 hidden w-[172px] rounded-xl border border-line bg-panel/85 p-2.5 backdrop-blur-md sm:block">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                  quor · status
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" /> idle · visor online
                </p>
                <p className="mt-1 font-mono text-[9.5px] text-ink-faint">6 agents standing by</p>
              </div>

              <div className="absolute -top-1 right-0 hidden rounded-lg border border-line bg-panel/85 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur-md sm:block">
                langgraph · auto
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="agents-heading"
        className="cv-auto mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6"
      >
        <Reveal className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">
            agent roster
          </span>
          <h2 id="agents-heading" className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Built like a robotics lab, priced like a tool
          </h2>
        </Reveal>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.filter((agent) => agent.id !== "auto").map((agent, index) => (
            <Reveal key={agent.id} delay={index * 0.04}>
              <GlassCard
                as="article"
                tilt
                padding="p-4"
                className="group h-full border-line hover:border-neon/35"
              >
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    style={{
                      borderColor: `color-mix(in srgb, ${agent.color} 40%, transparent)`,
                      background: `color-mix(in srgb, ${agent.color} 10%, transparent)`,
                    }}
                  >
                    <AgentGlyph agentId={agent.id} size={24} />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                    {agent.cost}c / run
                  </span>
                </div>
                <h3 className="mt-3.5 font-display text-[15px] font-semibold text-ink">
                  {agent.label}
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{agent.hint}</p>
              </GlassCard>
            </Reveal>
          ))}

          <Reveal delay={0.24}>
            <GlassCard
              tilt
              padding="p-4"
              className="flex h-full flex-col justify-between border-hud/30 bg-hud/[0.06]"
            >
              <div>
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-hud/40 bg-hud/10 text-hud">
                  <Workflow size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-3.5 font-display text-[15px] font-semibold text-ink">
                  Auto router
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  Not sure which specialist you need? Auto reads the prompt and picks.
                </p>
              </div>
              <Link
                to="/chat"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-hud hover:underline"
              >
                try it <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </GlassCard>
          </Reveal>
        </div>
      </section>

      <section
        aria-labelledby="how-heading"
        className="cv-auto mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6"
      >
        <Reveal>
          <h2 id="how-heading" className="font-display text-2xl font-bold text-ink sm:text-3xl">
            From prompt to artifact
          </h2>
          <p className="mt-2 max-w-lg text-[14px] text-ink-soft">
            Three steps, no configuration. Every run is traced and charged once.
          </p>
        </Reveal>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.label} delay={index * 0.06}>
              <div className="relative h-full rounded-2xl border border-line bg-tint-1 p-5">
                <span className="font-mono text-[11px] tracking-[0.2em] text-neon">
                  {step.label}
                </span>
                <h3 className="mt-2.5 font-display text-[16px] font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="cv-auto mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-hud">
              engineering
            </span>
            <h2
              id="features-heading"
              className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl"
            >
              Engineered for real work, not demos
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft">
              Every service is isolated, observable and rate limited. The gateway injects identity,
              forwards request IDs and keeps long LLM calls alive behind a load balancer.
            </p>
            <HudFrame label="stack" hint="production paths" className="mt-6">
              <ul className="grid grid-cols-2 gap-2 font-mono text-[11px] text-ink-soft">
                {[
                  "LangGraph",
                  "OpenRouter",
                  "Gemini",
                  "Tavily",
                  "Redis",
                  "MongoDB Atlas",
                  "AWS S3",
                  "Razorpay",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-lime" />
                    {item}
                  </li>
                ))}
              </ul>
            </HudFrame>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={index * 0.05}>
                  <GlassCard tilt padding="p-4.5" className="h-full border-line">
                    <span className="grid h-9 w-9 place-items-center rounded-lg border border-neon/30 bg-neon/10 text-neon">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 font-display text-[14.5px] font-semibold text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                      {feature.body}
                    </p>
                  </GlassCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="pricing-heading"
        className="cv-auto mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6"
      >
        <Reveal className="text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-neon">
            credit pricing
          </span>
          <h2
            id="pricing-heading"
            className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl"
          >
            Pay for outcomes, not seats
          </h2>
        </Reveal>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.05}>
              <div
                className={
                  plan.highlight
                    ? "relative h-full rounded-2xl border border-neon/45 bg-neon/[0.06] p-5"
                    : "relative h-full rounded-2xl border border-line bg-tint-1 p-5"
                }
              >
                {plan.highlight && (
                  <span className="absolute right-4 top-4 rounded-full border border-neon/40 bg-neon/15 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-neon">
                    popular
                  </span>
                )}
                <h3 className="font-display text-[15px] font-semibold text-ink">{plan.name}</h3>
                <p className="mt-2 font-display text-2xl text-ink-strong">
                  {plan.price}
                  <span className="ml-1 font-sans text-[11px] text-ink-faint">{plan.note}</span>
                </p>
                <ul className="mt-3 space-y-1.5">
                  {plan.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-center gap-1.5 text-[12.5px] text-ink-soft"
                    >
                      <Check size={12} className="text-lime" aria-hidden="true" /> {perk}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-5 flex justify-center">
          <GlowButton variant="outline" onClick={() => navigate("/pricing")}>
            Compare all plans
          </GlowButton>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
        <Reveal>
          <GlassCard
            padding="p-7"
            className="relative overflow-hidden border-neon/25 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--accent)_10%,transparent),color-mix(in_srgb,var(--hud)_10%,transparent))] text-center"
          >
            <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-50" />
            <div className="relative flex flex-col items-center gap-3.5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-neon/35 bg-panel/70 text-neon">
                <ShieldCheck size={19} aria-hidden="true" />
              </span>
              <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                100 free credits. No card required.
              </h2>
              <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
                Sign in with Google or create an account — the command center is yours, with code
                sandbox, document exports and live search included.
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2.5">
                <GlowButton
                  size="lg"
                  magnetic
                  onClick={() => navigate(userData ? "/chat" : "/signup")}
                >
                  {userData ? "Continue to chat" : "Claim 100 credits"}
                </GlowButton>
                <GlowButton size="lg" variant="ghost" onClick={() => navigate("/pricing")}>
                  Compare plans
                </GlowButton>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={11} aria-hidden="true" /> live web search
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Presentation size={11} aria-hidden="true" /> pptx export
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon size={11} aria-hidden="true" /> image studio
                </span>
              </div>
            </div>
          </GlassCard>
        </Reveal>
      </section>

      <Footer />
    </>
  );
}
