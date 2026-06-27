// ==================== THEME DEFINITIONS ====================
// كل الألوان المستخدمة في التطبيق، لوضعين: dark (الافتراضي الحالي) و light

export type ThemeMode = "dark" | "light";

export interface AppTheme {
  mode: ThemeMode;
  // أساسيات
  bg: string;            // خلفية الصفحة الرئيسية
  bgAlt: string;         // خلفية بطاقات/صفوف متبادلة (كان #080e1a / #080e16)
  surface: string;       // خلفية البطاقات (كان VAR.bg / #0f1623)
  border: string;        // لون الحدود
  text: string;          // النص الأساسي
  muted: string;         // النص الثانوي
  accent: string;        // اللون المميز (الأزرق #3a9aff)

  // حالات
  success: string;
  successBg: string;
  successBorder: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;

  // عناصر خاصة
  rowAlt: string;        // صف زوجي/فردي في الجداول
  headerBg: string;      // رأس الجدول
  divider: string;       // فواصل داخلية
}

const dark: AppTheme = {
  mode: "dark",
  bg: "#0a0f1a",
  bgAlt: "#080e1a",
  surface: "#0f1623",
  border: "#1d2d4a",
  text: "#dde8ff",
  muted: "#4a6a9a",
  accent: "#3a9aff",

  success: "#44dd88",
  successBg: "#0a2a18",
  successBorder: "#1a5a30",
  danger: "#ff6a6a",
  dangerBg: "#1a0a0a",
  dangerBorder: "#4a1010",
  warning: "#ffaa44",
  warningBg: "#2a1a00",
  warningBorder: "#5a3a10",
  info: "#3a9aff",
  infoBg: "#0a1a30",
  infoBorder: "#1d3a6a",

  rowAlt: "#080e16",
  headerBg: "#080e1a",
  divider: "#0a1020",
};

const light: AppTheme = {
  mode: "light",
  bg: "#f4f6fb",
  bgAlt: "#ffffff",
  surface: "#ffffff",
  border: "#dde3ef",
  text: "#10182b",
  muted: "#5a6b8c",
  accent: "#2b6fd6",

  success: "#1a8a4a",
  successBg: "#e8f8ee",
  successBorder: "#b6e6c8",
  danger: "#cc2b2b",
  dangerBg: "#fdecec",
  dangerBorder: "#f3bcbc",
  warning: "#b5740a",
  warningBg: "#fff3e0",
  warningBorder: "#f0d4a0",
  info: "#2b6fd6",
  infoBg: "#eaf2ff",
  infoBorder: "#bcd6f7",

  rowAlt: "#f7f9fc",
  headerBg: "#eef1f7",
  divider: "#e8ecf4",
};

export const THEMES: Record<ThemeMode, AppTheme> = { dark, light };

export const THEME_STORAGE_KEY = "pharmacy_theme_mode";

export function getStoredThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" ? "light" : "dark"; // dark هو الافتراضي للحفاظ على الشكل الحالي
  } catch {
    return "dark";
  }
}
