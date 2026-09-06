import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { todayLocal } from "../lib/dateUtils";
import { computeTreasuryBalance } from "../lib/treasuryUtils";
import { Badge, Btn, Table } from "../ui/primitives";

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 مخطط السيولة — 3 محركات:
// 1) التنبؤ بالسيولة: يبني جدول الاستحقاقات المعروفة (موردين/مصاريف ثابتة/تراخيص/رواتب)
//    ويقارنها بالدخل المتوقع (متوسط مبيعات + تحصيل آجل) يوم بيوم، ويوضح أول نقطة عجز.
// 2) ترتيب أولوية السداد: يرتب الاستحقاقات اللي قبل نقطة العجز حسب مدى إلحاحها.
// 3) اقتراح التمويل/تنشيط المبيعات: رقم التمويل المطلوب بالظبط + منتجات بطيئة الحركة
//    ممكن تتسيل قبل موعد العجز.
// ═══════════════════════════════════════════════════════════════════════════

const RECURRENCE_DIVISOR = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };

// أولوية السداد: رقم أصغر = أهم/أقل قابلية للتأجيل
const CATEGORY_PRIORITY = { salary: 1, license: 2, fixed: 3, supplier: 4 };
const CATEGORY_LABEL = { salary: "رواتب", license: "ترخيص", fixed: "مصروف ثابت", supplier: "مورد" };

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function CashFlowPlannerModule({
  sales = [],
  purchases = [],
  products = [],
  suppliers = [],
  customers = [],
  creditPayments = [],
  entries = [],
  promos = [], // 🆕 عروض PromotionsModule (posPromos في App.tsx) — لحساب معامل استجابة كل منتج للعروض
  enrichedCustomers = [], // 🆕 نفس المصدر المستخدم في PromotionsModule — لفحص هل قاعدة عملائك أصلاً مهتمة بفئة المنتج المقترح
  pharmacyId,
  showToast,
}) {
  const [horizon, setHorizon] = useState(60); // 30 / 60 / 90 يوم
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pharmacyId) return;
    setLoading(true);
    Promise.all([
      supabase.from("fixed_expenses").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("licenses").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("employees").select("*").eq("pharmacy_id", pharmacyId),
    ]).then(([{ data: fx }, { data: lic }, { data: emp }]) => {
      setFixedExpenses(fx || []);
      setLicenses(lic || []);
      setEmployees(emp || []);
      setLoading(false);
    });
  }, [pharmacyId]);

  const today = todayLocal();
  const endDate = addDays(today, horizon);

  // ── محرك ١: بناء قائمة الاستحقاقات (الخارج) ──
  const buildOutflowEvents = () => {
    const events = [];

    // فواتير الموردين — تاريخ الاستحقاق = تاريخ الفاتورة + شروط دفع المورد
    purchases.forEach((p) => {
      const remaining = (p.total || 0) - (p.paid || 0) - (p.returned_amount || 0);
      if (remaining <= 0.5) return;
      const supplier = suppliers.find((s) => s.id === p.supplier);
      const due = addDays(p.date, supplier?.payment_terms ?? 30);
      if (due <= endDate) {
        events.push({ date: due, amount: remaining, label: `فاتورة مورد — ${supplier?.name || "غير معروف"}`, category: "supplier", overdue: due < today });
      }
    });

    // مصاريف ثابتة — بتتكرر شهريًا/ربع سنوي/نصف سنوي/سنوي حسب due_day و due_month
    fixedExpenses.forEach((f) => {
      const rec = f.recurrence || "monthly";
      const interval = RECURRENCE_DIVISOR[rec] || 1;
      const startMonth = +f.due_month || 1;
      let cursor = new Date(today);
      cursor.setDate(1);
      const horizonEndDate = new Date(endDate);
      while (cursor <= horizonEndDate) {
        const monthNum = cursor.getMonth() + 1;
        if ((monthNum - startMonth + 12) % interval === 0) {
          const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), +f.due_day || 1);
          const dueStr = dueDate.toISOString().slice(0, 10);
          if (dueStr <= endDate) {
            const monthKey = dueStr.slice(0, 7);
            const alreadyPaid = entries.some((e) => e.type === "expense" && e.sub_type === "fixed" && e.note === f.name && e.date?.startsWith(monthKey));
            if (!alreadyPaid && dueStr >= addDays(today, -3)) {
              events.push({ date: dueStr, amount: +f.amount || 0, label: `مصروف ثابت — ${f.name}`, category: "fixed", overdue: dueStr < today });
            }
          }
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
    });

    // تراخيص
    licenses.forEach((l) => {
      if (l.renew_date && l.renew_date <= endDate) {
        events.push({ date: l.renew_date, amount: +l.amount || 0, label: `ترخيص — ${l.name}`, category: "license", overdue: l.renew_date < today });
      }
    });

    // رواتب — افتراض الصرف يوم 3 من كل شهر (حسب المتفق عليه)
    const activeEmployees = employees.filter((e) => e.active !== false);
    const monthlyWageBill = activeEmployees.reduce((s, e) => s + (+e.base_salary || 0) + (+e.allowances || 0), 0);
    if (monthlyWageBill > 0) {
      let mCursor = new Date(today);
      mCursor.setDate(1);
      const horizonEndDate = new Date(endDate);
      while (mCursor <= horizonEndDate) {
        const payDate = new Date(mCursor.getFullYear(), mCursor.getMonth(), 3);
        const payStr = payDate.toISOString().slice(0, 10);
        if (payStr <= endDate) {
          const monthKey = payStr.slice(0, 7);
          const paidThisMonth = entries.filter((e) => e.type === "expense" && e.sub_type === "salary" && e.date?.startsWith(monthKey)).reduce((s, e) => s + (e.amount || 0), 0);
          const remainingWage = Math.max(0, monthlyWageBill - paidThisMonth);
          if (remainingWage > 0.5 && payStr >= addDays(today, -5)) {
            events.push({ date: payStr, amount: remainingWage, label: "رواتب الموظفين", category: "salary", overdue: payStr < today });
          }
        }
        mCursor.setMonth(mCursor.getMonth() + 1);
      }
    }

    return events.sort((a, b) => (a.date < b.date ? -1 : 1));
  };

  // ── محرك ١ (تكملة): بناء الدخل المتوقع (الداخل) ──
  const buildInflowProjection = () => {
    const lookbackStart = addDays(today, -60);
    const recentCashSales = sales.filter((s) => s.date >= lookbackStart && s.date <= today && s.payment !== "آجل");
    const avgDaily = recentCashSales.reduce((a, s) => a + (s.total || 0), 0) / 60;

    const collections = [];
    customers.forEach((c) => {
      const terms = c.payment_terms ?? 30;
      sales.filter((s) => s.customer === c.id && s.payment === "آجل").forEach((inv) => {
        const paid = creditPayments.filter((p) => p.invoice_id === inv.id).reduce((s2, p) => s2 + (p.amount || 0), 0);
        const remaining = (inv.total || 0) - paid;
        if (remaining <= 0.5) return;
        const due = addDays(inv.created_at || inv.date, terms);
        if (due <= endDate) collections.push({ date: due, amount: remaining, label: `تحصيل آجل — ${c.name}`, overdue: due < today });
      });
    });

    return { avgDaily, collections };
  };

  // ── محرك ١ (الدمج): تسقيط الرصيد يوم بيوم ──
  const runForecast = () => {
    const startingBalance =
      computeTreasuryBalance("نقدي", { sales, creditPayments, entries }) +
      computeTreasuryBalance("بطاقة", { sales, creditPayments, entries }) +
      computeTreasuryBalance("تحويل", { sales, creditPayments, entries });

    const outflows = buildOutflowEvents();
    const { avgDaily, collections } = buildInflowProjection();

    let balance = startingBalance;
    let minBalance = startingBalance, minBalanceDate = today;
    let firstDeficitDate = null;
    const dailyRows = [];

    for (let i = 0; i <= horizon; i++) {
      const dateStr = addDays(today, i);
      const dayOutflows = outflows.filter((e) => e.date === dateStr);
      const dayCollections = collections.filter((c) => c.date === dateStr);
      const dayOut = dayOutflows.reduce((a, e) => a + e.amount, 0);
      const dayIn = avgDaily + dayCollections.reduce((a, c) => a + c.amount, 0);
      balance = balance + dayIn - dayOut;
      if (balance < minBalance) { minBalance = balance; minBalanceDate = dateStr; }
      if (balance < 0 && !firstDeficitDate) firstDeficitDate = dateStr;
      dailyRows.push({ date: dateStr, balance, dayOut, dayIn, events: dayOutflows });
    }

    return { startingBalance, dailyRows, minBalance, minBalanceDate, firstDeficitDate, outflows, avgDaily, collections };
  };

  const forecast = loading ? null : runForecast();

  // ── محرك ٢: ترتيب أولوية السداد للاستحقاقات قبل/عند نقطة العجز ──
  const buildPaymentPriority = () => {
    if (!forecast?.firstDeficitDate) return [];
    const relevant = forecast.outflows.filter((e) => e.date <= forecast.firstDeficitDate);
    return relevant
      .map((e) => ({ ...e, weight: (e.overdue ? -100 : 0) + (CATEGORY_PRIORITY[e.category] || 9) }))
      .sort((a, b) => a.weight - b.weight || (a.date < b.date ? -1 : 1));
  };
  const priorityList = forecast ? buildPaymentPriority() : [];

  // ── محرك ٣: منتجات بطيئة الحركة + معامل استجابتها الفعلي للعروض (مش تخمين) ──
  // بنقارن، لكل عرض قديم اتعمل على منتج بعينه، معدل بيعه اليومي وقت العرض
  // مقابل نفس الطول من الأيام قبل العرض مباشرة (خط الأساس). النسبة دي بتتجمّع
  // لكل منتج عبر كل عروضه القديمة، ومتوسطها = "معامل الاستجابة" بتاعه.
  const computeProductDailyQty = (productId, fromDate, toDate) => {
    let qty = 0;
    sales.filter((s) => s.date >= fromDate && s.date <= toDate).forEach((s) => {
      let items = [];
      try { items = typeof s.items === "string" ? JSON.parse(s.items) : (s.items || []); } catch { items = []; }
      items.forEach((it) => { if (it.id === productId) qty += (it.qty || 0); });
    });
    const days = Math.max(1, (new Date(toDate) - new Date(fromDate)) / 86400000 + 1);
    return qty / days;
  };

  const computePromoElasticity = () => {
    // 🆕 عروض على منتج بعينه (product_id) + عروض على براند كامل (manufacturer_id) — الاتنين
    // بيتحسبوا لكل منتج متأثر بيهم، لأن عرض البراند بيأثر على مبيعات كل أصناف نفس الشركة مع بعض.
    const pastPromos = promos.filter((p) => (p.product_id || p.manufacturer_id) && p.start_date && p.end_date && p.end_date < today);
    const byProduct = {};
    const addSample = (pid, ratio) => {
      if (!byProduct[pid]) byProduct[pid] = { sum: 0, count: 0 };
      byProduct[pid].sum += ratio;
      byProduct[pid].count += 1;
    };
    pastPromos.forEach((p) => {
      const promoDays = Math.max(1, (new Date(p.end_date) - new Date(p.start_date)) / 86400000 + 1);
      const baselineStart = addDays(p.start_date, -promoDays);
      const baselineEnd = addDays(p.start_date, -1);
      const targetIds = p.product_id
        ? [p.product_id]
        : products.filter((prod) => prod.manufacturer_id === p.manufacturer_id).map((prod) => prod.id);
      targetIds.forEach((pid) => {
        const duringAvg = computeProductDailyQty(pid, p.start_date, p.end_date);
        const baselineAvg = computeProductDailyQty(pid, baselineStart, baselineEnd);
        const ratio = duringAvg / Math.max(baselineAvg, 0.2); // أرضية 0.2/يوم عشان قسمة على صفر تقريبًا متضخّمش النتيجة
        addSample(pid, ratio);
      });
    });
    const result = {};
    Object.entries(byProduct).forEach(([pid, v]) => {
      const avgRatio = v.sum / v.count;
      result[pid] = {
        avgRatio,
        sampleCount: v.count,
        label: avgRatio >= 1.5 ? "يستجيب جيدًا" : avgRatio <= 1.1 ? "ضعيف الاستجابة" : "استجابة متوسطة",
      };
    });
    return result;
  };

  // 🆕 نسبة مبيعات الفئة اللي فعلاً مرتبطة بعميل معروف (مش بيع كاش لعميل مجهول) — لو النسبة
  // دي واطية، يبقى مؤشر "قاعدة العملاء المهتمة" أصلاً مش موثوق للفئة دي (بيانات ناقصة)،
  // فمينفعش نستبعد منتج بناءً عليه، لأن غالبية بيعه ممكن يكون من عملاء مش مسجلين خالص.
  const computeCategoryIdentifiedCoverage = (category, lookbackDays = 90) => {
    if (!category) return null;
    const lookbackStart = addDays(today, -lookbackDays);
    let total = 0, identified = 0;
    sales.filter((s) => s.date >= lookbackStart).forEach((s) => {
      let items = [];
      try { items = typeof s.items === "string" ? JSON.parse(s.items) : (s.items || []); } catch { items = []; }
      items.forEach((it) => {
        const itCategory = it.category || products.find((pp) => pp.id === it.id)?.category;
        if (itCategory !== category) return;
        const val = (it.price || 0) * (it.qty || 0);
        total += val;
        if (s.customer) identified += val;
      });
    });
    return total > 0 ? identified / total : null; // null = مفيش مبيعات كفاية للفئة أصلًا نقيس عليها
  };

  const buildSlowMovers = () => {
    const elasticity = computePromoElasticity();
    const lookbackStart = addDays(today, -60);
    const recentSales = sales.filter((s) => s.date >= lookbackStart);
    const soldQtyByProduct = {};
    recentSales.forEach((s) => {
      let items = [];
      try { items = typeof s.items === "string" ? JSON.parse(s.items) : (s.items || []); } catch { items = []; }
      items.forEach((it) => { soldQtyByProduct[it.id] = (soldQtyByProduct[it.id] || 0) + (it.qty || 0); });
    });
    const rankOf = (label) => (label === "يستجيب جيدًا" ? 0 : label === "استجابة متوسطة" ? 1 : label == null ? 1.5 : 2);

    const totalCustomers = enrichedCustomers.length;
    const daysUntilDeficit = forecast?.firstDeficitDate
      ? Math.max(1, (new Date(forecast.firstDeficitDate) - new Date(today)) / 86400000)
      : 0;
    const deficitAmount = forecast?.minBalance != null ? Math.abs(forecast.minBalance) : 0;
    const categoryCoverageCache = {};

    return products
      .map((p) => {
        const soldLast60 = soldQtyByProduct[p.id] || 0;
        const el = elasticity[p.id] || null;
        // 🆕 هل قاعدة عملائك أصلاً مهتمة بفئة المنتج ده؟ — نفس منطق المطابقة في PromotionsModule
        const matchingCustomers = totalCustomers > 0
          ? enrichedCustomers.filter((c) => c.stats?.isComprehensiveBuyer || (c.stats?.categorySpend?.[p.category] || 0) > 0).length
          : 0;
        const customerFitShare = totalCustomers > 0 ? matchingCustomers / totalCustomers : null;
        if (!(p.category in categoryCoverageCache)) categoryCoverageCache[p.category] = computeCategoryIdentifiedCoverage(p.category);
        const categoryIdentifiedCoverage = categoryCoverageCache[p.category];
        // فحص التطابق موثوق بس لو أغلب مبيعات الفئة دي مرتبطة بعملاء معروفين فعلًا
        const fitCheckReliable = categoryIdentifiedCoverage != null && categoryIdentifiedCoverage >= 0.5;
        // 🆕 قد إيه المتوقع يتباع فعلًا لحد موعد العجز، وقد إيه هيغطي من قيمة الفجوة نفسها
        const baselineDailyQty = soldLast60 / 60;
        const boostMultiplier = el?.avgRatio || 1; // منتج غير مجرب = افتراض محافظ (بدون تضخيم)
        const expectedQtySellable = Math.min(p.stock || 0, baselineDailyQty * boostMultiplier * daysUntilDeficit);
        const expectedCashRaised = expectedQtySellable * (p.price || 0);
        const deficitCoverage = deficitAmount > 0 ? (expectedCashRaised / deficitAmount) * 100 : null;
        return {
          id: p.id, name: p.name,
          stockValue: (p.stock || 0) * (p.cost || 0),
          soldLast60, stock: p.stock || 0,
          elasticity: el, matchingCustomers, totalCustomers, customerFitShare, fitCheckReliable,
          expectedCashRaised, deficitCoverage,
        };
      })
      .filter((p) => p.stockValue > 100 && p.soldLast60 <= 1) // مخزون ذو قيمة، تقريبًا ما بيتحركش
      .filter((p) => p.elasticity?.label !== "ضعيف الاستجابة") // استبعاد المؤكد إنه مبيستجبش للعروض
      // 🆕 الاستبعاد بناءً على قاعدة العملاء بيتطبق بس لو الفحص موثوق (أغلب بيع الفئة مرتبط بعملاء معروفين)
      .filter((p) => !p.fitCheckReliable || p.customerFitShare == null || p.customerFitShare >= 0.05)
      .sort((a, b) => rankOf(a.elasticity?.label) - rankOf(b.elasticity?.label) || (b.deficitCoverage || 0) - (a.deficitCoverage || 0))
      .slice(0, 10);
  };
  const slowMovers = forecast?.firstDeficitDate ? buildSlowMovers() : [];
  const totalSlowMoversCoverage = slowMovers.reduce((a, p) => a + (p.deficitCoverage || 0), 0);

  if (loading) {
    return <div style={{ color: COLORS.textDim, textAlign: "center", padding: 60 }}>جاري تجهيز مخطط السيولة...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: COLORS.textPrimary, margin: 0, fontSize: 20, fontWeight: 800 }}>🧭 مخطط السيولة</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {[30, 60, 90].map((h) => (
            <Btn key={h} size="sm" variant={horizon === h ? "primary" : "secondary"} onClick={() => setHorizon(h)}>{h} يوم</Btn>
          ))}
        </div>
      </div>

      {/* ══════ ملخص التنبؤ ══════ */}
      <div style={{
        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${forecast.firstDeficitDate ? COLORS.red + "55" : COLORS.green + "55"}`, borderRadius: 14, padding: 18, marginBottom: 20,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>الرصيد الحالي</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.textPrimary }}>{forecast.startingBalance.toFixed(0)} ر.س</div>
          </div>
          <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>متوسط الدخل اليومي المتوقع</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.textPrimary }}>{forecast.avgDaily.toFixed(0)} ر.س</div>
          </div>
          <div style={{ background: forecast.minBalance < 0 ? COLORS.redSoft : COLORS.surfaceAlt, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>أقل رصيد متوقع خلال {horizon} يوم</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: forecast.minBalance < 0 ? COLORS.red : COLORS.green }}>{forecast.minBalance.toFixed(0)} ر.س</div>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>بتاريخ {forecast.minBalanceDate}</div>
          </div>
        </div>

        {forecast.firstDeficitDate ? (
          <div style={{ marginTop: 14, padding: 12, background: COLORS.redSoft, borderRadius: 10 }}>
            <div style={{ fontWeight: 800, color: COLORS.red, fontSize: 14, marginBottom: 4 }}>⚠️ متوقع عجز يبدأ بتاريخ {forecast.firstDeficitDate}</div>
            <div style={{ fontSize: 13, color: COLORS.textPrimary }}>
              💰 محتاج تمويل تقريبي بقيمة <b>{Math.abs(forecast.minBalance).toFixed(0)} ر.س</b> يغطي الفجوة لحد {forecast.minBalanceDate}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, padding: 12, background: COLORS.green + "18", borderRadius: 10, color: COLORS.green, fontSize: 13, fontWeight: 700 }}>
            ✅ مفيش عجز متوقع خلال {horizon} يوم القادمة — السيولة هتغطي كل الاستحقاقات المعروفة
          </div>
        )}
      </div>

      {/* ══════ محرك ٢: ترتيب أولوية السداد ══════ */}
      {priorityList.length > 0 && (
        <div style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 20,
        }}>
          <h3 style={{ color: COLORS.textPrimary, margin: "0 0 12px", fontSize: 15, fontWeight: 800 }}>📋 ترتيب أولوية السداد (لحد موعد العجز)</h3>
          <Table
            headers={["الاستحقاق", "النوع", "المبلغ", "التاريخ", "الحالة"]}
            rows={priorityList.map((e, i) => [
              e.label,
              CATEGORY_LABEL[e.category],
              `${e.amount.toFixed(2)} ر.س`,
              e.date,
              e.overdue
                ? <Badge key="s" color={COLORS.red + "22"} text={COLORS.red}>متأخر — سدده أول حاجة</Badge>
                : i < 2
                  ? <Badge key="s" color={COLORS.gold + "22"} text={COLORS.gold}>أولوية عالية</Badge>
                  : <Badge key="s" color={COLORS.textDim + "22"} text={COLORS.textDim}>ممكن يتأجل شوية</Badge>,
            ])}
          />
          <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 10 }}>
            الترتيب: المتأخر فعلاً أولًا، بعدين الرواتب والتراخيص (أقل قابلية للتأجيل)، وأخيرًا الموردين (أكتر مرونة في التفاوض على التأجيل).
          </div>
        </div>
      )}

      {/* ══════ محرك ٣: تنشيط مبيعات لتسييل كاش قبل موعد العجز ══════ */}
      {slowMovers.length > 0 && (
        <div style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 20,
        }}>
          <h3 style={{ color: COLORS.textPrimary, margin: "0 0 6px", fontSize: 15, fontWeight: 800 }}>🎯 منتجات مقترحة لتنشيط بيع (لتسييل كاش قبل {forecast.firstDeficitDate})</h3>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12 }}>
            مرتبة حسب سجل استجابتها الفعلي للعروض، ومستبعد منها اللي أثبتت عدم الاستجابة أو مبتغطيش غير أقل من 5% من قاعدة عملائك بالفئة دي.
          </div>
          <div style={{ padding: 10, background: totalSlowMoversCoverage >= 30 ? COLORS.green + "18" : COLORS.gold + "18", borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 700, color: totalSlowMoversCoverage >= 30 ? COLORS.green : COLORS.gold }}>
            لو نشّطت كل المنتجات دي مع بعض، متوقع تغطي تقريبًا {totalSlowMoversCoverage.toFixed(0)}% من قيمة الفجوة — {totalSlowMoversCoverage < 30 ? "مش كفاية لوحدها، محتاج كمان تمويل أو ترتيب سداد" : "مساهمة معقولة في تغطية الفجوة"}.
          </div>
          <Table
            headers={["المنتج", "المخزون", "قيمة المخزون", "قاعدة العملاء المهتمة", "سجل الاستجابة للعروض", "متوقع يغطي من الفجوة"]}
            rows={slowMovers.map((p) => [
              p.name, p.stock, `${p.stockValue.toFixed(2)} ر.س`,
              p.totalCustomers > 0
                ? p.fitCheckReliable
                  ? <Badge key="c" color={(p.customerFitShare >= 0.2 ? COLORS.green : COLORS.gold) + "22"} text={p.customerFitShare >= 0.2 ? COLORS.green : COLORS.gold}>{p.matchingCustomers} من {p.totalCustomers} ({(p.customerFitShare * 100).toFixed(0)}%)</Badge>
                  : <Badge key="c" color={COLORS.textDim + "22"} text={COLORS.textDim}>بيانات غير كافية (غالب بيعه لعملاء مجهولين)</Badge>
                : "—",
              p.elasticity
                ? <Badge key="e" color={(p.elasticity.label === "يستجيب جيدًا" ? COLORS.green : COLORS.gold) + "22"} text={p.elasticity.label === "يستجيب جيدًا" ? COLORS.green : COLORS.gold}>
                    {p.elasticity.label} (×{p.elasticity.avgRatio.toFixed(1)}، {p.elasticity.sampleCount} عرض سابق)
                  </Badge>
                : <Badge key="e" color={COLORS.textDim + "22"} text={COLORS.textDim}>❔ غير مجرب من قبل</Badge>,
              p.deficitCoverage != null
                ? <Badge key="d" color={(p.deficitCoverage >= 15 ? COLORS.green : COLORS.textDim) + "22"} text={p.deficitCoverage >= 15 ? COLORS.green : COLORS.textDim}>{p.deficitCoverage.toFixed(0)}% (~{p.expectedCashRaised.toFixed(0)} ر.س)</Badge>
                : "—",
            ])}
          />
        </div>
      )}

      {/* ══════ جدول الاستحقاقات القادمة — مقسّمة شهر بشهر ══════ */}
      {(() => {
        const groups = {};
        forecast.outflows.forEach((e) => {
          const mk = e.date.slice(0, 7);
          if (!groups[mk]) groups[mk] = { monthKey: mk, total: 0, byCategory: {}, items: [] };
          groups[mk].total += e.amount;
          groups[mk].byCategory[e.category] = (groups[mk].byCategory[e.category] || 0) + e.amount;
          groups[mk].items.push(e);
        });
        const monthlyOutflows = Object.values(groups).sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));

        return monthlyOutflows.map((g) => (
          <div key={g.monthKey} style={{
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 14,
          }}>
            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 800, color: COLORS.textPrimary, fontSize: 14 }}>{g.monthKey}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {Object.entries(g.byCategory).map(([cat, amt]) => (
                  <Badge key={cat} color={COLORS.surfaceAlt} text={COLORS.textDim}>{CATEGORY_LABEL[cat]}: {amt.toFixed(0)} ر.س</Badge>
                ))}
                <span style={{ fontWeight: 800, color: COLORS.textPrimary, fontSize: 14 }}>الإجمالي: {g.total.toFixed(2)} ر.س</span>
              </div>
            </div>
            <Table
              headers={["التاريخ", "الاستحقاق", "النوع", "المبلغ", ""]}
              rows={g.items.map((e) => [
                e.date, e.label, CATEGORY_LABEL[e.category], `${e.amount.toFixed(2)} ر.س`,
                e.overdue ? <Badge key="o" color={COLORS.red + "22"} text={COLORS.red}>متأخر</Badge> : "",
              ])}
            />
          </div>
        ));
      })()}
    </div>
  );
}
