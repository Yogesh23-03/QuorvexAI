import { createContext, useContext } from "react";

export const ThemeContext = createContext(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: "dark", resolved: "dark", setTheme: () => {}, isDark: true };
  }
  return context;
}
