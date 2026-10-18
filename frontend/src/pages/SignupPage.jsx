import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AlertCircle, Check } from "lucide-react";
import AuthShell, { GoogleIcon } from "../components/auth/AuthShell";
import Field from "../components/auth/Field";
import GlowButton from "../components/ui/GlowButton";
import {
  loginWithGoogle,
  passwordIssues,
  passwordStrength,
  registerWithPassword,
} from "../features/auth";
import { setUserdata } from "../redux/userSlice";
import { pushToast } from "../redux/uiSlice";
import { cx } from "../lib/utils";

const STRENGTH_COLORS = ["bg-danger", "bg-danger", "bg-amber-400", "bg-lime"];

export default function SignupPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const issues = useMemo(() => passwordIssues(form.password), [form.password]);

  useEffect(() => {
    if (userData) navigate("/chat", { replace: true });
  }, [userData, navigate]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Tell us your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email.";
    if (issues.length) next.password = `Password needs: ${issues.join(", ").toLowerCase()}.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy("password");
    try {
      const user = await registerWithPassword({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      dispatch(setUserdata(user));
      dispatch(
        pushToast({
          tone: "success",
          title: "Account created",
          message: "100 credits loaded. Welcome aboard.",
        }),
      );
      navigate("/chat", { replace: true });
    } catch (error) {
      setFormError(error?.message || "We could not create that account.");
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
      navigate("/chat", { replace: true });
    } catch (error) {
      setFormError(error?.message || "Google sign-in could not be completed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="100 credits on the house. No card, no trial timer."
      footer={
        <p className="text-[13px] text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="text-neon hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {formError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-3.5">
        <Field
          label="Name"
          value={form.name}
          onChange={set("name")}
          error={errors.name}
          autoComplete="name"
          placeholder="Ada Lovelace"
          disabled={Boolean(busy)}
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          autoComplete="email"
          placeholder="you@company.com"
          disabled={Boolean(busy)}
        />
        <Field
          label="Password"
          type="password"
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={Boolean(busy)}
        >
          <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors",
                  index < strength.score ? STRENGTH_COLORS[strength.score] : "bg-tint-3",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
            <span>{form.password ? strength.label : "8+ chars · letter · number"}</span>
            {issues.length === 0 && form.password ? (
              <span className="inline-flex items-center gap-1 text-lime">
                <Check size={10} /> ready
              </span>
            ) : null}
          </p>
        </Field>

        <GlowButton
          type="submit"
          fullWidth
          size="lg"
          loading={busy === "password"}
          disabled={Boolean(busy)}
        >
          Create account
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
    </AuthShell>
  );
}
