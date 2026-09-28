import { COLORS } from "../theme";

// ── تصنيفات العميل الجاهزة للعرض (ألوان/تسميات) — مشتركة بين قسم العملاء وقسم العروض ──
export const vipConfig = {
    vip: { label: "👑 VIP", color: COLORS.gold, bg: COLORS.goldSoft },
    excellent: { label: "⭐ ممتاز", color: COLORS.blue, bg: COLORS.blueSoft },
    good: { label: "✅ جيد", color: COLORS.green, bg: COLORS.greenSoft },
    weak: { label: "🔴 ضعيف", color: COLORS.red, bg: COLORS.redSoft },
};


export const statusConfig = {
    new: { label: "🆕 جديد", color: COLORS.green },
    regular: { label: "✅ منتظم", color: COLORS.blue },
    at_risk: { label: "⚠️ في خطر", color: COLORS.gold },
    inactive: { label: "💤 مختفي", color: COLORS.red },
};


export const trendConfig = {
    up: { label: "📈 صعودي", icon: "📈", color: COLORS.green, bg: COLORS.greenSoft },
    down: { label: "📉 نزولي", icon: "📉", color: COLORS.red, bg: COLORS.redSoft },
    stable: { label: "➖ ثابت", icon: "➖", color: COLORS.textDim, bg: COLORS.surfaceAlt },
};
