import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Check } from "lucide-react";
import AuthShell from "../components/auth/AuthShell";
import Field from "../components/auth/Field";
import GlowButton from "../components/ui/GlowButton";
import { passwordIssues, resetPassword } from "../features/auth";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const issues = useMemo(() => passwordIssues(password), [password]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (issues.length) {
      setError(`Password needs: ${issues.join(", ").toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, password });
      navigate("/login", {
        replace: true,
        state: { message: "Password updated. Sign in with your new password." },
      });
    } catch (error_) {
      setError(error_?.message || "That reset link is invalid or expired.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs the token from your email.">
        <div className="rounded-xl border border-danger/35 bg-danger/10 p-4 text-[13px] text-danger">
          Open the reset link from your inbox, or request a new one.
        </div>
        <Link
          to="/forgot-password"
          className="mt-4 inline-flex text-[13px] text-neon hover:underline"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your reset token is single-use and expires shortly."
      footer={
        <Link to="/login" className="text-[13px] text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      }
    >
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
          label="New password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={busy}
          hint={
            issues.length ? (
              `Needs: ${issues.join(", ").toLowerCase()}.`
            ) : password ? (
              <span className="inline-flex items-center gap-1 text-lime">
                <Check size={10} /> strong enough
              </span>
            ) : null
          }
        />

        <Field
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          placeholder="Repeat it"
          disabled={busy}
        />

        <GlowButton type="submit" fullWidth size="lg" loading={busy} disabled={busy}>
          Update password
        </GlowButton>
      </form>
    </AuthShell>
  );
}
