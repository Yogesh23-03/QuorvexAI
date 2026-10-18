import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, MailCheck } from "lucide-react";
import AuthShell from "../components/auth/AuthShell";
import Field from "../components/auth/Field";
import GlowButton from "../components/ui/GlowButton";
import { forgotPassword } from "../features/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (error_) {
      setError(error_?.message || "We could not send that reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email a single-use link that expires in 30 minutes."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-lime/35 bg-lime/10 p-4">
          <p className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink">
            <MailCheck size={16} className="text-lime" /> Check your inbox
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            If an account exists for {email}, a reset link is on its way. In development the link is
            printed in the auth service log.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3.5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            disabled={busy}
          />

          <GlowButton type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
            Send reset link
          </GlowButton>
        </form>
      )}
    </AuthShell>
  );
}
