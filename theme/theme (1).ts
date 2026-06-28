// ============================================================
// PharmacyPro — Daylight Lab Theme
// ملف ألوان واحد موحّد، يستبدل كل الـ hex المتفرقة في App.tsx
//
// طريقة الاستخدام:
//   import { COLORS } from "./theme";
//   <div style={{ background: COLORS.surface, color: COLORS.textPrimary }}>
//
// كل لون قديم اتكرر بنسخ مختلفة (#3a5a8a, #4a6a8a, #4a6a9a...) دلوقتي
// له قيمة واحدة بس هنا. لو احتجت تظبط اللون، تظبطه من هنا مرة واحدة
// وكل الشاشات تتحدث تلقائيًا.
// ============================================================

export const COLORS = {
  // ---------- الخلفيات والسطوح ----------
  appBg: "#FFFFFF",        // الخلفية الأساسية للتطبيق
  surface: "#FBFDFE",      // الكروت والبانلز (سطح مرفوع)
  surfaceAlt: "#EAFBF7",   // السطح الغاطس: بار البحث، صفوف الجداول، الخلفيات الثانوية
  border: "#9FDDD1",       // كل الحدود والفواصل الرفيعة — أقوى وضوحًا حول الكروت
  borderStrong: "#5FC4B0", // حدود أوضح لكروت مهمة أو محتاجة تمييز إضافي

  // ---------- النصوص ----------
  textPrimary: "#0B2622",  // العناوين والنص الأساسي
  textDim: "#3F6B62",      // النص الثانوي، التسميات، الملاحظات — أغمق لقراءة أوضح

  // ---------- الألوان الدلالية (semantic) ----------
  // كل لون مربوط بمعنى ثابت، استخدمه بنفس المعنى في كل الشاشات
  green: "#0BAE9A",        // مبيعات، إيجابي، نجاح، إتمام عملية
  blue: "#2E86D6",         // آجل، معلوماتي، حالات "قيد الانتظار" الحيادية
  red: "#E0556B",          // مرتجعات، سلبي، خطأ، حذف
  coral: "#E08A4F",        // فرص ضائعة، نواقص، إعادة طلب
  gold: "#D69A0B",         // تنبيهات، صلاحية قريبة، يحتاج مراجعة
  purple: "#8B5FD6",       // VIP، ولاء، عملاء مميزين
  teal: "#0BC4C4",         // أكسنت ثانوي، تمييز عناصر نشطة (تابات، مؤشرات)

  // ---------- الأكسنت الأساسي للأفعال ----------
  accent: "#0BAE9A",       // زر الفعل الأساسي (دفع، حفظ، تأكيد) = نفس الـ green
  accentText: "#FFFFFF",   // نص فوق الأكسنت

  // ---------- مساحات شفافة جاهزة (badges, soft backgrounds) ----------
  // استخدمها لخلفيات الشارات الناعمة بدل ما تكتب rgba بنفسك كل مرة
  greenSoft: "rgba(11,174,154,0.12)",
  blueSoft: "rgba(46,134,214,0.12)",
  redSoft: "rgba(224,85,107,0.12)",
  coralSoft: "rgba(224,138,79,0.12)",
  goldSoft: "rgba(214,154,11,0.12)",
  purpleSoft: "rgba(139,95,214,0.12)",
  tealSoft: "rgba(11,196,196,0.12)",
} as const;

// ============================================================
// خريطة الحالات الشائعة في PharmacyPro — استخدمها بدل تكرار
// نفس الـ if/else في كل مكون
// ============================================================
export const STATUS_COLORS = {
  // حالة العميل / الفاتورة / الشفت
  active: COLORS.green,
  pending: COLORS.gold,
  cancelled: COLORS.red,
  vip: COLORS.purple,
  inactive: COLORS.textDim,
} as const;

// ============================================================
// أنماط جاهزة (radius, shadows) — ثبات بصري إضافي غير اللون
// ============================================================
export const RADIUS = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "22px",
} as const;

export const SHADOW = {
  card: "0 1px 3px rgba(11,38,34,0.06)",
  raised: "0 4px 12px rgba(11,38,34,0.08)",
} as const;

// ============================================================
// نسخة CSS Variables — للاستخدام في أي مكان شغال بـ className
// لصق هذا الجزء داخل index.css أو أول ملف CSS عام في المشروع
// ============================================================
export const CSS_VARS_BLOCK = `
:root {
  --color-bg: ${COLORS.appBg};
  --color-surface: ${COLORS.surface};
  --color-surface-alt: ${COLORS.surfaceAlt};
  --color-border: ${COLORS.border};
  --color-border-strong: ${COLORS.borderStrong};

  --color-text-primary: ${COLORS.textPrimary};
  --color-text-dim: ${COLORS.textDim};

  --color-green: ${COLORS.green};
  --color-blue: ${COLORS.blue};
  --color-red: ${COLORS.red};
  --color-coral: ${COLORS.coral};
  --color-gold: ${COLORS.gold};
  --color-purple: ${COLORS.purple};
  --color-teal: ${COLORS.teal};

  --color-accent: ${COLORS.accent};
  --color-accent-text: ${COLORS.accentText};

  --radius-sm: ${RADIUS.sm};
  --radius-md: ${RADIUS.md};
  --radius-lg: ${RADIUS.lg};
  --radius-xl: ${RADIUS.xl};
}
`;
