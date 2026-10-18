import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AlertCircle, ArrowRight } from "lucide-react";
import AuthShell, { GoogleIcon } from "../components/auth/AuthShell";
import Field from "../components/auth/Field";
import GlowButton from "../components/ui/GlowButton";
import { loginWithGoogle, loginWithPassword } from "../features/auth";
import { setUserdata } from "../redux/userSlice";
import { pushToast } from "../redux/uiSlice";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { userData } = useSelector((state) => state.user);
  const next = location.state?.from || "/chat";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");
  const info = location.state?.message || "";

  useEffect(() => {
    if (userData) navigate(next, { replace: true });
  }, [userData, navigate, next]);

  const validate = () => {
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy("password");
    try {
      const user = await loginWithPassword({ email: email.trim(), password });
      dispatch(setUserdata(user));
      dispatch(
        pushToast({
          tone: "success",
          title: "Welcome back",
          message: `${user?.credits ?? 0} credits available.`,
        }),
      );
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(error?.message || "Invalid email or password.");
    } finally {
      setBusy("");
    }
  };

  const google = async () => {
    setFormError("");
    setBusy("google");
    try {
      const user = await loginWithGoogle();
      dispatch(setUserdata(user));
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(error?.message || "Google sign-in could not be completed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AuthShell
      title="Authenticate"
      subtitle="Sign in with your email or continue with Google."
      footer={
        <div className="space-y-3">
          <p className="text-[13px] text-ink-soft">
            New to QuorvexAI?{" "}
            <Link to="/signup" className="text-neon hover:underline">
              Create an account
            </Link>
          </p>
          <p className="font-mono text-[9.5px] leading-relaxed text-ink-faint">
            Sessions use an httpOnly refresh cookie and rotate every 7 days. By continuing you agree
            to the acceptable use policy.
          </p>
        </div>
      }
    >
      {(info || formError) && (
        <div
          role="alert"
          className={
            formError
              ? "mb-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
              : "mb-4 rounded-xl border border-lime/35 bg-lime/10 px-3 py-2 text-[12.5px] text-ink"
          }
        >
          {formError ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : null}
          <span>{formError || info}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-3.5">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="you@company.com"
          disabled={Boolean(busy)}
        />

        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={Boolean(busy)}
        >
          <div className="mt-1.5 text-right">
            <Link
              to="/forgot-password"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-hud hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </Field>

        <GlowButton
          type="submit"
          fullWidth
          size="lg"
          loading={busy === "password"}
          disabled={Boolean(busy)}
        >
          Sign in
        </GlowButton>
      </form>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <GlowButton
        variant="ghost"
        fullWidth
        size="lg"
        loading={busy === "google"}
        disabled={Boolean(busy)}
        onClick={google}
      >
        <span className="inline-flex items-center gap-2.5">
          <GoogleIcon /> Continue with Google
        </span>
      </GlowButton>

      <p className="mt-4 text-center text-[12.5px] text-ink-soft">
        Need the plans first?{" "}
        <Link to="/pricing" className="inline-flex items-center gap-1 text-hud hover:underline">
          Compare pricing <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </p>
    </AuthShell>
  );
}
