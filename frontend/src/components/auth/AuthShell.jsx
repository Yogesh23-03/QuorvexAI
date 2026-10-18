import { Link } from "react-router-dom";
import { motion } from "motion/react";
import RobotMascot from "../robot/RobotMascot";
import GlassCard from "../ui/GlassCard";
import HudFrame from "../ui/HudFrame";
import Logo from "../ui/Logo";
import StatusPill from "../ui/StatusPill";

export function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export default function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="order-2 mx-auto w-full lg:order-1"
        style={{ maxWidth: wide ? 520 : 440 }}
      >
        <GlassCard padding="p-6" className="w-full">
          <Link to="/" className="inline-flex">
            <Logo />
          </Link>

          <div className="mt-5">
            <h1 className="font-display text-[22px] font-bold text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{subtitle}</p>
            )}
          </div>

          <div className="mt-5">{children}</div>

          {footer && <div className="mt-5">{footer}</div>}
        </GlassCard>
      </motion.div>

      <div className="order-1 hidden lg:order-2 lg:block">
        <div className="relative mx-auto max-w-[420px] text-center">
          <RobotMascot state="idle" glyphSize={150} />
          <StatusPill label="SECURE CHANNEL" className="mt-4" />
          <HudFrame label="handshake" hint="jwt · google" className="mt-5 text-left">
            <p className="font-mono text-[10.5px] leading-relaxed text-ink-soft">
              POST /api/auth/login → verify credentials or Firebase token → rotate refresh cookie →
              issue 15m access token
            </p>
          </HudFrame>
        </div>
      </div>
    </div>
  );
}
