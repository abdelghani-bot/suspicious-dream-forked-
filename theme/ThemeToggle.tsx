import { useTheme } from "./ThemeContext";

export function ThemeToggle() {
  const { mode, toggleTheme, C } = useTheme();
  const isDark = mode === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "التبديل للوضع النهاري" : "التبديل للوضع الليلي"}
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.text,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
      }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
