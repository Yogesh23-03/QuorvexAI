import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme-context";

const THEME_STORAGE_KEY = "quorvex-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const isTheme = (value) => value === "light" || value === "dark";

/**
 * The visitor's OS preference. It only seeds the very first visit: once a
 * light/dark choice is stored the toggle is the single source of truth.
 */
function systemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readStored() {
  if (typeof window === "undefined") return "dark";
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : systemTheme();
  } catch {
    return systemTheme();
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);

  // The only side effect: keep <html> in sync with the chosen theme.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!isTheme(next)) return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage blocked — the theme still applies for this session */
    }
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolved: theme, setTheme, isDark: theme === "dark" }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
