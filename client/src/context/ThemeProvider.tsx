import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  applyThemeToDocument,
  loadStoredTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from "@/context/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadStoredTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        setThemeState(next);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // storage unavailable (private mode) — theme still applies for the session
        }
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
