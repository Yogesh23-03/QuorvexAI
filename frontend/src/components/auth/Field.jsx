import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cx } from "../../lib/utils";

export default function Field({
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder,
  required = true,
  disabled,
  children,
}) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cx(
            "w-full rounded-xl border bg-void/60 px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint",
            "focus:border-neon/60 focus:ring-2 focus:ring-neon/20 disabled:opacity-60",
            error ? "border-danger/60" : "border-line",
            isPassword && "pr-10",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((state) => !state)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-faint transition-colors hover:text-ink"
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11.5px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1 text-[11.5px] text-ink-faint">
          {hint}
        </div>
      ) : null}
      {children}
    </div>
  );
}
