import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AppTheme, ThemeMode, THEMES, THEME_STORAGE_KEY, getStoredThemeMode } from "./theme";

interface ThemeContextValue {
  mode: ThemeMode;
  C: AppTheme; // اختصار "Colors" يستخدم بدل VAR في كل المكونات
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredThemeMode());

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {}
    // يساعد في تنسيق عناصر المتصفح الافتراضية (scrollbars, inputs..)
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggleTheme = useCallback(
    () => setModeState((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );

  const value: ThemeContextValue = {
    mode,
    C: THEMES[mode],
    toggleTheme,
    setMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
