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
//
// 🆕 إضافة: نظام "العمق" (DEPTH) — شيلنا إحساس "الرسم المسطح" بإضافة
// ظلال متعددة الطبقات + حدود إضاءة علوية/سفلية + تدرّجات خفيفة.
// ما اتغيّر أي لون أساسي قديم، فقط أُضيفت أدوات جديدة فوقه.
// ============================================================

export const COLORS = {
  // ---------- الخلفيات والسطوح ----------
  appBg: "#E8F7F4",        // الخلفية الأساسية للتطبيق — تيل فاتح جداً
  surface: "#F0FAF8",      // الكروت والبانلز — تيل ناعم مميز عن الخلفية
  surfaceAlt: "#D4F0EA",   // السطح الغاطس: بار البحث، صفوف الجداول، الخلفيات الثانوية
  border: "#7ECFC2",       // كل الحدود والفواصل الرفيعة
  borderStrong: "#4BB8A8", // حدود أوضح لكروت مهمة أو محتاجة تمييز إضافي

  // ---------- النصوص ----------
  textPrimary: "#0B2622",  // العناوين والنص الأساسي
  textDim: "#3F6B62",      // النص الثانوي، التسميات، الملاحظات — أغمق لقراءة أوضح

  // ---------- الألوان الدلالية (semantic) ----------
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
  greenSoft: "rgba(11,174,154,0.12)",
  blueSoft: "rgba(46,134,214,0.12)",
  redSoft: "rgba(224,85,107,0.12)",
  coralSoft: "rgba(224,138,79,0.12)",
  goldSoft: "rgba(214,154,11,0.12)",
  purpleSoft: "rgba(139,95,214,0.12)",
  tealSoft: "rgba(11,196,196,0.12)",

  // ---------- 🆕 خطوط الإضاءة (لإحساس العمق على أي كارد فاتح) ----------
  highlightTop: "rgba(255,255,255,0.65)",   // حد علوي فاتح — إحساس إن السطح "لامع من فوق"
  shadowBottom: "rgba(11,38,34,0.10)",      // حد سفلي غامق خفيف — إحساس ثقل تحت الكارد
} as const;

// ============================================================
// خريطة الحالات الشائعة في PharmacyPro
// ============================================================
export const STATUS_COLORS = {
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

// 🆕 نظام ظلال متعدد الطبقات — كل مستوى بيحاكي ارتفاع مختلف عن السطح
// الفكرة: ظل قريب + غامق خفيف (contact shadow) + ظل بعيد + واسع (ambient shadow)
// الجمع بينهم هو اللي بيدي إحساس "الارتفاع الحقيقي" مش خط تحديد بس
export const SHADOW = {
  // بطاقة عادية مستوية على السطح
  card: "0 1px 2px rgba(11,38,34,0.06), 0 2px 6px rgba(11,38,34,0.05)",
  // بطاقة مرفوعة شوية (كروت الداشبورد، الإحصائيات)
  raised: "0 2px 4px rgba(11,38,34,0.08), 0 8px 20px rgba(11,38,34,0.08)",
  // عناصر عائمة فوق المحتوى (مودال، قوائم منسدلة)
  floating: "0 4px 8px rgba(11,38,34,0.10), 0 16px 32px rgba(11,38,34,0.12)",
  // زر في وضعه الطبيعي
  button: "0 1px 2px rgba(11,38,34,0.10), 0 2px 4px rgba(11,38,34,0.08)",
  // زر عند التحويم — يرتفع
  buttonHover: "0 2px 4px rgba(11,38,34,0.12), 0 6px 14px rgba(11,38,34,0.14)",
  // زر عند الضغط — ينزل ويقل ظله (إحساس فعلي بالضغط)
  buttonActive: "0 1px 1px rgba(11,38,34,0.10) inset",
} as const;

// 🆕 حدود ثنائية الاتجاه — تُضاف مع SHADOW لإحساس "معدني/زجاجي" خفيف
// استخدم البوردر ده مع أي كارد بيضاوي/فاتح بدل الحد العادي الموحّد
export const EDGE = {
  card: `border-top: 1px solid ${COLORS.highlightTop}; border-bottom: 1px solid ${COLORS.shadowBottom};`,
} as const;

// 🆕 تدرّجات خفيفة للسطوح — بدل اللون المفرد المسطح
// الفرق بين surface و surfaceGradient بسيط جدًا (٤-٥٪) بس العين بتحسه فورًا
export const GRADIENT = {
  surface: `linear-gradient(165deg, #FFFFFF 0%, ${COLORS.surface} 100%)`,
  surfaceAlt: `linear-gradient(165deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
  accentButton: `linear-gradient(180deg, #0FC7B0 0%, ${COLORS.accent} 100%)`,
  header: `linear-gradient(135deg, #0BAE9A 0%, #0B8A78 100%)`, // لهيدر شاشة الدخول
} as const;

// 🆕 جاهز للّصق مباشرة على أي كارد لإحساس عمق فوري
// مثال: <div style={cardStyle3D}>...</div>
export const cardStyle3D = {
  background: GRADIENT.surface,
  borderRadius: RADIUS.lg,
  borderTop: `1px solid ${COLORS.highlightTop}`,
  borderBottom: `1px solid ${COLORS.shadowBottom}`,
  border: `1px solid ${COLORS.border}`,
  boxShadow: SHADOW.raised,
} as const;

// ============================================================
// 🆕 الطباعة (Typography) — يحل مشكلة "الخط رفيع وغير مميز"
// طبّق دي على العناوين والأرقام المهمة (أرصدة، إجماليات، أسماء كروت)
// ============================================================
export const TYPE = {
  cardTitle: { fontSize: "13px", fontWeight: 700, letterSpacing: "0.2px", color: COLORS.textDim },
  cardValue: { fontSize: "26px", fontWeight: 800, letterSpacing: "-0.3px", color: COLORS.textPrimary },
  sectionHeading: { fontSize: "20px", fontWeight: 800, color: COLORS.textPrimary },
  label: { fontSize: "12px", fontWeight: 600, color: COLORS.textDim },
} as const;

// ============================================================
// نسخة CSS Variables
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

  --shadow-card: ${SHADOW.card};
  --shadow-raised: ${SHADOW.raised};
  --shadow-floating: ${SHADOW.floating};
}
`;

// ============================================================
// tint() — يحوّل أي لون hex إلى rgba بشفافية معينة
// ============================================================
export function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
