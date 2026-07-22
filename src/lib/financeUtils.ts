// ==================== الموقف المالي (FINANCIAL HEALTH) ====================
// حدود افتراضية لتصنيف كل نسبة (أخضر/أصفر/أحمر) — قابلة للتعديل من واجهة الإعدادات وتُخزَّن في financial_settings
export const DEFAULT_FIN_THRESHOLDS = {
  quick_ratio:         { label: "نسبة السيولة السريعة",      unit: "×",        direction: "higher_better", healthyMin: 1,  warningMin: 0.7 },
  gross_margin:        { label: "هامش الربح الإجمالي",       unit: "%",        direction: "higher_better", healthyMin: 20, warningMin: 10 },
  net_margin:          { label: "هامش الربح الصافي",         unit: "%",        direction: "higher_better", healthyMin: 10, warningMin: 5 },
  inventory_turnover:  { label: "معدل دوران المخزون (سنويًا)", unit: "×",       direction: "higher_better", healthyMin: 6,  warningMin: 3 },
  dso:                 { label: "متوسط تحصيل مديونية العملاء (DSO)", unit: "يوم", direction: "lower_better",  healthyMax: 30, warningMax: 45 },
  dpo:                 { label: "متوسط سداد الموردين (DPO)",  unit: "يوم",      direction: "range",         healthyMin: 30, healthyMax: 60, warningMin: 15, warningMax: 75 },
};



export const FIN_METRIC_ORDER = ["quick_ratio", "gross_margin", "net_margin", "inventory_turnover", "dso", "dpo"];



export const FIN_STATUS_COLOR = { green: "#2e7d32", yellow: "#c9a227", red: "#c0392b", gray: "#8a8a8a" };


export const FIN_STATUS_LABEL = { green: "صحي", yellow: "تحت المراقبة", red: "خطر", gray: "لا يمكن الحساب" };



export function classifyFinMetric(value, cfg) {
  if (value === null || value === undefined || isNaN(value)) return "gray";
  if (cfg.direction === "higher_better") {
    if (value >= cfg.healthyMin) return "green";
    if (value >= cfg.warningMin) return "yellow";
    return "red";
  }
  if (cfg.direction === "lower_better") {
    if (value <= cfg.healthyMax) return "green";
    if (value <= cfg.warningMax) return "yellow";
    return "red";
  }
  // range (أعلى وأقل من الازم كلاهما مشكلة — مثال DPO)
  if (value >= cfg.healthyMin && value <= cfg.healthyMax) return "green";
  if (value >= cfg.warningMin && value <= cfg.warningMax) return "yellow";
  return "red";
}



// حساب النسب الست الأساسية من بيانات سناب-شوت شهر واحد
export function calculateFinancialHealth(snap, thresholds) {
  if (!snap) return [];
  const days = snap.days_in_period || 30;
  const inventoryValue = snap.inventory_value || 0;
  const currentLiabilities = snap.accounts_payable || 0;
  const totalSales = snap.total_sales || 0;
  const totalCogs = snap.total_cogs || 0;
  const grossProfit = snap.gross_profit ?? (totalSales - totalCogs);
  const netProfit = snap.net_profit ?? (grossProfit - (snap.operating_expenses || 0));

  const raw = {
    quick_ratio: currentLiabilities > 0
      ? ((snap.cash_balance || 0) + (snap.accounts_receivable || 0)) / currentLiabilities
      : null,
    gross_margin: totalSales > 0 ? (grossProfit / totalSales) * 100 : null,
    net_margin: totalSales > 0 ? (netProfit / totalSales) * 100 : null,
    inventory_turnover: inventoryValue > 0 ? (totalCogs / inventoryValue) * (365 / days) : null,
    dso: totalSales > 0 ? ((snap.accounts_receivable || 0) / totalSales) * days : null,
    dpo: totalCogs > 0 ? ((snap.accounts_payable || 0) / totalCogs) * days : null,
  };

  return FIN_METRIC_ORDER.map((key) => {
    const cfg = { ...DEFAULT_FIN_THRESHOLDS[key], ...(thresholds?.[key] || {}) };
    const value = raw[key];
    return { key, value, cfg, status: classifyFinMetric(value, cfg) };
  });
}



// مقارنة نسب الشهر الحالي بالشهر السابق — تحسّنت / اتدهورت / ثابتة
export function compareFinTrend(curVal, prevVal, direction) {
  if (curVal === null || prevVal === null || prevVal === undefined || curVal === undefined) return null;
  const diffPct = prevVal !== 0 ? ((curVal - prevVal) / Math.abs(prevVal)) * 100 : 0;
  if (Math.abs(diffPct) < 3) return "stable";
  const improved = direction === "lower_better" ? diffPct < 0 : diffPct > 0;
  return improved ? "improved" : "worsened";
}
