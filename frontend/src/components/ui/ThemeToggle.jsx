import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme-context";
import { useMediaQuery } from "../../lib/hooks";
import { cx } from "../../lib/utils";

const OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/**
 * Two explicit themes. Phones get a single cycling button (two buttons do not
 * fit next to the logo, credits and account pills); wider screens show both.
 */
export default function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();
  const compact = useMediaQuery("(max-width: 639px)");

  if (compact) {
    const active = OPTIONS.find((option) => option.id === theme) || OPTIONS[1];
    const Icon = active.icon;
    const next = theme === "dark" ? "light" : "dark";

    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
        className={cx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-tint-1 text-ink-soft transition-colors hover:text-ink",
          className,
        )}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cx(
        "relative inline-flex items-center gap-0.5 rounded-lg border border-line bg-tint-1 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            aria-label={`${option.label} theme`}
            aria-pressed={isActive}
            title={`${option.label} theme`}
            className={cx(
              "grid h-7 w-7 place-items-center rounded-md transition-all duration-200",
              isActive
                ? "bg-neon text-slate-950 shadow-[0_2px_8px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                : "text-ink-faint hover:text-ink",
            )}
          >
            <Icon size={13} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
