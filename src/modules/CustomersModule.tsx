import { useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SHADOW, tint } from "../theme";
import { toLocaleString } from "../function toLocaleString() { [native code] }/undefined";
import { logAudit } from "../lib/auditLog";
import { todayLocal } from "../lib/dateUtils";
import { MAIN_CATEGORIES } from "../lib/productConstants";
import { openWhatsApp, sendBulk } from "../lib/whatsapp";
import { Btn, Input, Modal } from "../ui/primitives";

export function CreditTab({ customers, onPay, sales = [], creditPayments = [] }) {
  // 🐛 FIX: كانت الدالة بتعمل query مباشر لـ supabase بدون فلترة pharmacy_id
  // → معناه أي صيدلية بتشوف مديونيات آجل خاصة بصيدليات تانية (تسريب بيانات بين المستأجرين).
  // التصحيح: بنستخدم sales و creditPayments الجاهزين اللي جايين من الأب (App.tsx)
  // وهما أصلاً مفلترين بـ pharmacy_id عند التحميل، فمش محتاجين query جديد أساسًا.
  const creditData = useMemo(() => {
    const ajilSales = sales.filter((s) => s.payment === "آجل");
    return customers
      .map((c) => {
        const cSales = ajilSales.filter((s) => s.customer === c.id);
        const totalDebt = cSales.reduce((s, inv) => {
          const totalPaid = creditPayments
            .filter((p) => p.invoice_id === inv.id)
            .reduce((x, p) => x + (p.amount || 0), 0);
          return s + ((inv.total || 0) - totalPaid);
        }, 0);
        return { ...c, totalDebt, invoiceCount: cSales.length };
      })
      .filter((c) => c.totalDebt > 0);
  }, [customers, sales, creditPayments]);

  return (
    <div>
      <h3 style={{ color: COLORS.textPrimary, marginBottom: 14 }}>💳 مديونية العملاء</h3>
      {creditData.length === 0 ? (
        <div style={{ color: COLORS.border, textAlign: "center", padding: 40 }}>
          لا توجد مديونيات
        </div>
      ) : (
        creditData.map((c) => (
          <div
            key={c.id}
            style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${tint(COLORS.red,0.35)}`,
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{c.name}</div>
              <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
                {c.invoiceCount} فاتورة آجل •{" "}
                <span style={{ color: COLORS.red }}>
                  متبقي: {c.totalDebt.toFixed(2)} ر.س
                </span>
                {c.stats?.isOverdue && (
                  <span style={{ color: COLORS.red, fontWeight: 700 }}> • ⏰ متأخر {c.stats.daysOverdue} يوم (فترة السداد {c.stats.paymentTerms} يوم)</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onPay(c)}
              style={{
                background: COLORS.greenSoft,
                border: `1px solid ${tint(COLORS.green,0.35)}`,
                borderRadius: 8,
                padding: "6px 14px",
                color: COLORS.green,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              💰 سداد
            </button>
          </div>
        ))
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════
// 🆕 حساب إحصائيات وتصنيف العميل — دالة عامة مشتركة (مش مقصورة على قسم العملاء بس)
// عشان أي موديول تاني (زي قسم العروض) يقدر يستخدم نفس تصنيفات العميل (VIP/نمط الشراء/الاتجاه)
// من غير ما يكرر المنطق. بتاخد sales/creditPayments كمعطيات صريحة بدل الاعتماد على closure.
// ═══════════════════════════════════════════════════
export function computeCustomerStats(customer, sales = [], creditPayments = []) {
  const now = new Date();
  const thisMonthKey = now.toISOString().slice(0, 7);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const customerId = customer.id;
    const cSales = sales.filter((s) => s.customer === customerId);
    if (cSales.length === 0) return null;

    const sorted = [...cSales].sort(
      (a, b) =>
        new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
    );
    const lastSale = sorted[0];
    const lastVisitDate = new Date(lastSale.created_at || lastSale.date);
    const daysSinceLast = Math.floor(
      (now - lastVisitDate) / (1000 * 60 * 60 * 24)
    );

    const totalVisits = cSales.length;
    const monthlyVisits = cSales.filter((s) =>
      s.created_at?.startsWith(thisMonthKey)
    ).length;
    const totalSpent = cSales.reduce((s, sale) => s + (sale.subtotal || 0), 0);
    const monthlySpent = cSales
      .filter((s) => s.created_at?.startsWith(thisMonthKey))
      .reduce((s, sale) => s + (sale.subtotal || 0), 0);
    const avgInvoice = totalVisits > 0 ? totalSpent / totalVisits : 0;

    // RFM — آخر 3 شهور
    const recent = cSales.filter(
      (s) => new Date(s.created_at || s.date) >= threeMonthsAgo
    );
    const freq3 = recent.length;
    const monetary3 = recent.reduce((s, sale) => s + (sale.subtotal || 0), 0);

    const rScore =
      daysSinceLast <= 14
        ? 40
        : daysSinceLast <= 30
        ? 30
        : daysSinceLast <= 90
        ? 15
        : 0;
    const fScore = freq3 > 10 ? 30 : freq3 >= 5 ? 20 : freq3 >= 2 ? 10 : 0;
    const mScore =
      monetary3 > 1000 ? 30 : monetary3 >= 500 ? 20 : monetary3 >= 200 ? 10 : 0;
    const rfmScore = rScore + fScore + mScore;

    const vipLevel =
      rfmScore >= 80
        ? "vip"
        : rfmScore >= 55
        ? "excellent"
        : rfmScore >= 30
        ? "good"
        : "weak";

    const status =
      totalVisits === 1 && daysSinceLast <= 30
        ? "new"
        : daysSinceLast <= 30
        ? "regular"
        : daysSinceLast <= 90
        ? "at_risk"
        : "inactive";

    const lastItems = lastSale?.items
      ? typeof lastSale.items === "string"
        ? JSON.parse(lastSale.items)
        : lastSale.items
      : [];

    // ===== تصنيف سلوك الشراء: هل تركيز شراءه في قسم واحد، ولا "شامل" بيشتري من كذا قسم بشكل متوازن؟ =====
    const categorySpend = {};
    cSales.forEach((sale) => {
      const saleItems = sale.items
        ? typeof sale.items === "string"
          ? JSON.parse(sale.items)
          : sale.items
        : [];
      saleItems.forEach((it) => {
        const cat = it.category || "أخرى";
        categorySpend[cat] =
          (categorySpend[cat] || 0) + (it.price || 0) * (it.qty || 0);
      });
    });
    const sortedCats = Object.entries(categorySpend)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats[0]?.[0] || null;
    const totalCatSpend = sortedCats.reduce((s, [, v]) => s + v, 0);
    const topCategoryShare = totalCatSpend > 0 ? (sortedCats[0]?.[1] || 0) / totalCatSpend : 0;
    const distinctCategoriesCount = sortedCats.length;
    // عميل "شامل" = بيشتري من قسمين أو أكتر ومفيش قسم واحد مسيطر بنسبة عالية (يعني ثقة عامة في الصيدلية مش احتياج محدد)
    const isComprehensiveBuyer = distinctCategoriesCount >= 2 && topCategoryShare < 0.65;
    const buyerType = isComprehensiveBuyer ? "شامل" : topCategory;

    // ===== مديونية الآجل وفترة السداد =====
    const ajilSales = cSales.filter((s) => s.payment === "آجل");
    const paymentTerms = customer.payment_terms || 30;
    let debtRemaining = 0, oldestDaysLeft = null, isOverdue = false;
    ajilSales.forEach((inv) => {
      const totalPaid = (creditPayments || [])
        .filter((p) => p.invoice_id === inv.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const remaining = (inv.total || 0) - totalPaid;
      if (remaining <= 0.01) return;
      debtRemaining += remaining;
      const due = new Date(inv.created_at || inv.date);
      due.setDate(due.getDate() + paymentTerms);
      const daysLeft = Math.floor((due - now) / (1000 * 60 * 60 * 24));
      if (oldestDaysLeft === null || daysLeft < oldestDaysLeft) oldestDaysLeft = daysLeft;
      if (daysLeft < 0) isOverdue = true;
    });

    // ===== اتجاه الشراء الشهري (آخر 6 شهور) — لتحديد هل العميل صاعد ولا نازل ولا ثابت =====
    const monthlyTrendMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      monthlyTrendMap[key] = 0;
    }
    cSales.forEach((sale) => {
      const key = (sale.created_at || sale.date || "").slice(0, 7);
      if (key in monthlyTrendMap) {
        monthlyTrendMap[key] += sale.subtotal || 0;
      }
    });
    const monthlyTrend = Object.entries(monthlyTrendMap).map(([key, amount]) => ({
      month: key,
      label: new Date(key + "-01").toLocaleDateString("ar-SA", { month: "short" }),
      amount: Math.round(amount),
    }));
    const activeMonthsCount = monthlyTrend.filter((m) => m.amount > 0).length;
    const firstHalfAvg =
      monthlyTrend.slice(0, 3).reduce((s, m) => s + m.amount, 0) / 3;
    const secondHalfAvg =
      monthlyTrend.slice(3).reduce((s, m) => s + m.amount, 0) / 3;
    let trendDirection = "stable";
    if (activeMonthsCount >= 2) {
      if (firstHalfAvg <= 0 && secondHalfAvg > 0) {
        trendDirection = "up";
      } else if (secondHalfAvg <= 0 && firstHalfAvg > 0) {
        trendDirection = "down";
      } else if (firstHalfAvg > 0) {
        const change = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        trendDirection = change >= 0.15 ? "up" : change <= -0.15 ? "down" : "stable";
      }
    }

    return {
      totalVisits,
      monthlyVisits,
      totalSpent,
      monthlySpent,
      avgInvoice,
      lastVisitDate,
      daysSinceLast,
      rfmScore,
      vipLevel,
      status,
      categorySpend,
      topCategory,
      buyerType,
      isComprehensiveBuyer,
      topCategoryShare,
      debtRemaining,
      isOverdue,
      daysOverdue: isOverdue ? Math.abs(oldestDaysLeft) : 0,
      paymentTerms,
      lastItems,
      monthlyTrend,
      trendDirection,
      activeMonthsCount,
    };
}



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



export function CustomersModule({
  customers,
  setCustomers,
  showToast,
  sales = [],
  setSales,
  creditPayments,
  setCreditPayments,
  currentUser,
  pharmacyId,
  canAdd = true,
  canDelete = true,
  canEdit = true,
}) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");
  const [filterVip, setFilterVip] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showOpportunityOnly, setShowOpportunityOnly] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [creditInvoices, setCreditInvoices] = useState([]);
  const [showCredit, setShowCredit] = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [trendGroupView, setTrendGroupView] = useState(null); // "up" | "down" | "stable" | null

  const blank = {
    id: "",
    name: "",
    phone: "",
    taxId: "",
    totalSpent: 0,
    visits: 0,
    lastVisit: "-",
    category: "individual",
    children_count: "",
    children_ages: [],
    payment_terms: 30,
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const openCreditModal = async (customer) => {
    setSelectedCreditCustomer(customer);

    // جلب كل فواتير الآجل بتاعة العميل
    const { data: ajilSales } = await supabase
      .from("sales")
      .select("*")
      .eq("customer", customer.id)
      .eq("payment", "آجل")
      .eq("pharmacy_id", pharmacyId);

    // جلب المدفوع منها
    const { data: paid } = await supabase
      .from("credit_payments")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("pharmacy_id", pharmacyId);

    // حساب الباقي لكل فاتورة
    const invoicesWithBalance = ajilSales
      ?.map((inv) => {
        const totalPaid =
          paid
            ?.filter((p) => p.invoice_id === inv.id)
            .reduce((s, p) => s + p.amount, 0) || 0;
        return {
          ...inv,
          totalPaid,
          remaining: inv.total - totalPaid,
        };
      })
      .filter((inv) => inv.remaining > 0); // الفواتير المفتوحة بس

    setCreditInvoices(invoicesWithBalance || []);
    setShowCredit(true);
  };

  const payCreditInvoice = async () => {
    if (!selectedInvoice || !payAmount) return;

    const amount = parseFloat(payAmount);
    if (amount <= 0 || amount > selectedInvoice.remaining) {
      showToast("المبلغ غير صحيح", "error");
      return;
    }

    const { error } = await supabase.from("credit_payments").insert({
      invoice_id: selectedInvoice.id,
      customer_id: selectedCreditCustomer.id,
      amount,
      date: todayLocal(),
      notes: "سداد جزئي/كامل",
      created_by: currentUser?.name || "",
      pharmacy_id: pharmacyId,
    });

    if (error) {
      showToast("خطأ في السداد: " + error.message, "error");
      return;
    }
    // إضافة السداد في مبيعات اليوم
    const paymentRecord = {
      id: "PAY-" + Date.now(),
      date: todayLocal(),
      created_at: new Date().toISOString(),
      customer: selectedCreditCustomer.id,
      payment: "تحصيل آجل",
      total: amount,
      subtotal: amount,
      tax_amount: 0,
      discount_amt: 0,
      items: [],
      notes: `تحصيل فاتورة ${selectedInvoice.id}`,
      returned: false,
      pharmacy_id: pharmacyId,
    };

    const { error: salesInsertError } = await supabase.from("sales").insert(paymentRecord);
    if (salesInsertError) {
      showToast("⚠️ تم تسجيل السداد لكن فشل تسجيله في المبيعات: " + salesInsertError.message, "error");
    } else {
      setSales((p) => [...p, paymentRecord]);
    }
    setCreditPayments((p) => [...p, {
  invoice_id: selectedInvoice.id,
  customer_id: selectedCreditCustomer.id,
  amount,
  date: todayLocal(),
  notes: "سداد جزئي/كامل",
}]);
    // تحديث الفواتير
    setCreditInvoices((p) =>
      p
        .map((inv) =>
          inv.id === selectedInvoice.id
            ? {
                ...inv,
                totalPaid: inv.totalPaid + amount,
                remaining: inv.remaining - amount,
              }
            : inv
        )
        .filter((inv) => inv.remaining > 0)
    );

    setPayAmount("");
    setSelectedInvoice(null);
    showToast("تم تسجيل السداد ✓");
  };

  // 🆕 التصنيفات والدوال دي بقت مشتركة على مستوى الملف كله (computeCustomerStats/vipConfig/
  // statusConfig/trendConfig/openWhatsApp/sendBulk) — عشان موديولات تانية زي قسم العروض
  // تقدر تستخدم نفس المنطق بالظبط من غير تكرار.
  const KIDS_COSMETICS_CATS = ["مستلزمات أطفال", "كوزمتك عادي", "كوزمتك طبي"];
  const enriched = customers.map((c) => {
    const stats = computeCustomerStats(c, sales, creditPayments);
    const missedKidsCosmetics =
      c.category === "family_with_kids" &&
      !!stats &&
      !KIDS_COSMETICS_CATS.some((cat) => (stats.categorySpend?.[cat] || 0) > 0);
    return { ...c, stats, missedKidsCosmetics };
  });

  // ===== فلترة =====
  const filtered = enriched.filter((c) => {
    const s = c.stats;
    return (
      ((c.name||"").includes(search) || (c.phone||"").includes(search)) &&
      (filterVip === "all" || s?.vipLevel === filterVip) &&
      (filterStatus === "all" || s?.status === filterStatus) &&
      (filterCategory === "all" || s?.buyerType === filterCategory) &&
      (!showOpportunityOnly || c.missedKidsCosmetics)
    );
  });

  // ===== عملاء اليوم =====
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const todayIds = [
    ...new Set(
      sales
        .filter((s) => s.created_at?.startsWith(todayKey))
        .map((s) => s.customer)
        .filter(Boolean)
    ),
  ];
  const todayCustomers = enriched.filter((c) => todayIds.includes(c.id));

  // ===== المختفون =====
  const inactiveCustomers = enriched.filter(
    (c) => c.stats?.status === "inactive"
  );

  // ===== إحصائيات عامة =====
  const totalCustomers = customers.length;
  const newCount = enriched.filter((c) => c.stats?.status === "new").length;
  const vipCount = enriched.filter((c) => c.stats?.vipLevel === "vip").length;
  const inactiveCount = inactiveCustomers.length;

  // ===== رسم بياني بسيط =====
  const BarChart = ({ title, data, unit = "" }) => {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
      <div
        style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: COLORS.textPrimary,
            fontSize: 14,
            marginBottom: 14,
          }}
        >
          {title}
        </div>
        {data.map((d) => (
          <div key={d.label} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ color: COLORS.textDim, fontSize: 12 }}>{d.label}</span>
              <span style={{ color: d.color, fontWeight: 700, fontSize: 13 }}>
                {unit ? d.count.toLocaleString("ar-SA") : d.count}{unit}
              </span>
            </div>
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 4, height: 8 }}>
              <div
                style={{
                  background: d.color,
                  height: "100%",
                  borderRadius: 4,
                  width: `${(d.count / max) * 100}%`,
                  transition: "width 0.5s",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ===== خط بياني مصغّر لاتجاه الشراء الشهري =====
  const MiniTrend = ({ data, color, height = 40 }) => {
    if (!data || data.length === 0) return null;
    const values = data.map((d) => d.amount);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 100;
    const toX = (i) => (values.length > 1 ? (i / (values.length - 1)) * w : w / 2);
    const toY = (v) => height - ((v - min) / range) * (height - 8) - 4;
    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    return (
      <div>
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
          <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {values.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={1.8} fill={color} />
          ))}
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          {data.map((d, i) => (
            <span key={i} style={{ fontSize: 9, color: COLORS.textDim }}>{d.label}</span>
          ))}
        </div>
      </div>
    );
  };

  // ===== كارت العميل =====
  const [loyaltyMapC, setLoyaltyMapC] = useState<Record<string, number>>({});

  const loadLoyaltyC = async (customerId: string) => {
    if (loyaltyMapC[customerId] !== undefined) return;
    const { data } = await supabase
      .from("loyalty_points")
      .select("points")
      .eq("customer_id", customerId)
      .eq("pharmacy_id", pharmacyId)
      .single();
    setLoyaltyMapC((p) => ({ ...p, [customerId]: data?.points ?? 0 }));
  };

  const CustomerCard = ({ c }) => {
    const s = c.stats;
    const vip = s ? vipConfig[s.vipLevel] : null;
    const isExpanded = expandedCard === c.id;
    const loyalty = loyaltyMapC[c.id];

    const debt = sales
      .filter((x) => x.customer === c.id && x.payment === "آجل")
      .reduce((sum, x) => sum + (x.total || 0), 0);

    const handleExpand = () => {
      if (!isExpanded) { loadLoyaltyC(c.id); setExpandedCard(c.id); }
      else setExpandedCard(null);
    };

    return (
      <div style={{
        background: COLORS.surface,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${isExpanded ? (vip ? vip.color + "55" : COLORS.blue) : (vip ? vip.color + "33" : COLORS.border)}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}>
        {/* رأس الكارت — قابل للضغط */}
        <div onClick={handleExpand} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", cursor: "pointer", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: "#1a2a5a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              {c.category === "individual" ? "👤" : c.category === "family_no_kids" ? "👫" : "👨‍👩‍👧"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </div>
              <div style={{ color: COLORS.textDim, fontSize: 10, fontWeight: 600 }}>{c.phone}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {vip && <span style={{ background: vip.bg, color: vip.color, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{vip.label}</span>}
            {s?.trendDirection && s.activeMonthsCount >= 2 && (
              <span title={trendConfig[s.trendDirection].label} style={{ background: trendConfig[s.trendDirection].bg, color: trendConfig[s.trendDirection].color, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
                {trendConfig[s.trendDirection].icon}
              </span>
            )}
            {debt > 0 && <span style={{ background: COLORS.redSoft, color: COLORS.red, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>💳 {debt.toFixed(0)} ر.س</span>}
            {s?.isOverdue && <span style={{ background: COLORS.redSoft, color: COLORS.red, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>⏰ متأخر {s.daysOverdue} يوم</span>}
            {c.missedKidsCosmetics && <span style={{ background: COLORS.goldSoft, color: COLORS.gold, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>🎁 فرصة عرض</span>}
            <span style={{ color: COLORS.textDim, fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* التفاصيل */}
        {isExpanded && (
          <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
            {/* إحصائيات */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginTop: 10, marginBottom: 8 }}>
              {[
                { label: "إجمالي الزيارات", value: s?.totalVisits || 0, color: COLORS.blue },
                { label: "زيارات الشهر", value: s?.monthlyVisits || 0, color: COLORS.green },
                { label: "متوسط الفاتورة", value: s ? s.avgInvoice.toFixed(0) + " ر.س" : "-", color: COLORS.purple },
                { label: "إجمالي المشتريات", value: s ? s.totalSpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                { label: "مشتريات الشهر", value: s ? s.monthlySpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                { label: "آخر زيارة", value: s ? `${s.daysSinceLast} يوم` : "لم يزر", color: COLORS.textDim },
                { label: "نمط الشراء", value: s?.buyerType ? (s.buyerType === "شامل" ? "🌐 شامل" : s.buyerType) : "-", color: s?.buyerType === "شامل" ? COLORS.green : COLORS.blue },
              ].map((item) => (
                <div key={item.label} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 7, padding: "6px 7px" }}>
                  <div style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* نقاط الولاء */}
            {loyalty !== undefined && loyalty > 0 && (
              <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 7, padding: "6px 10px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: COLORS.gold, fontSize: 12 }}>🌟 نقاط الولاء</span>
                <span style={{ color: COLORS.gold, fontWeight: 800, fontSize: 13 }}>{loyalty.toFixed(2)} ر.س</span>
              </div>
            )}

            {/* شريط RFM */}
            {s && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 10 }}>نقاط RFM</span>
                  <span style={{ color: vip?.color, fontSize: 10, fontWeight: 700 }}>{s.rfmScore}/100</span>
                </div>
                <div style={{ background: COLORS.surfaceAlt, borderRadius: 4, height: 4 }}>
                  <div style={{ background: vip?.color || COLORS.textDim, height: "100%", borderRadius: 4, width: `${s.rfmScore}%`, transition: "width 0.5s" }} />
                </div>
              </div>
            )}

            {/* اتجاه الشراء الشهري */}
            {s?.monthlyTrend && (
              <div style={{ background: COLORS.surfaceAlt, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 10 }}>اتجاه الشراء (آخر 6 شهور)</span>
                  <span style={{ color: trendConfig[s.trendDirection].color, fontSize: 10, fontWeight: 700 }}>
                    {trendConfig[s.trendDirection].label}
                  </span>
                </div>
                <MiniTrend data={s.monthlyTrend} color={trendConfig[s.trendDirection].color} />
              </div>
            )}

            {/* آخر مشتريات */}
            {s?.lastItems?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 4 }}>آخر مشتريات ({s.lastItems.length} صنف):</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.lastItems.map((item, i) => (
                    <span key={i} style={{ background: COLORS.blueSoft, color: COLORS.blue, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>
                      {item.name} × {item.qty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <button onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 نتمنى أن تكونوا بخير`)}
                style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.green, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                📱 واتساب
              </button>
              {c.missedKidsCosmetics && (
                <button onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 عندنا عروض على مستلزمات الأطفال والعناية بالبشرة، تحب نبعتلك التفاصيل؟`)}
                  style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  🎁 ابعت عرض
                </button>
              )}
              {canEdit && (
                <button onClick={() => openEdit(c)}
                  style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "5px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                  ✏️ تعديل
                </button>
              )}
              {canDelete && (
                <button onClick={async () => {
                  if (debt > 0) {
                    if (currentUser?.role !== "admin") { showToast("❌ لا يمكن حذف عميل عليه مديونية", "error"); return; }
                    if (!window.confirm(`⚠️ على ${c.name} مديونية ${debt.toFixed(2)} ر.س
هل أنت متأكد من الحذف؟`)) return;
                  }
                  const { error } = await supabase.from("customers").delete().eq("id", c.id).eq("pharmacy_id", pharmacyId);
                  if (error) { showToast("خطأ في الحذف", "error"); return; }
                  logAudit({
                    pharmacyId, userName: currentUser?.name, action: "delete", entityType: "customer",
                    entityId: c.id, entityLabel: c.name,
                    oldValue: { name: c.name, debt },
                    description: `حذف العميل "${c.name}"${debt > 0 ? ` (وعليه مديونية ${debt.toFixed(2)} ر.س)` : ""}`,
                  });
                  setCustomers((p) => p.filter((x) => x.id !== c.id));
                  showToast("تم حذف العميل");
                }}
                  style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red,0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>
                  🗑️ حذف
                </button>
              )}
              {debt > 0 && (
                <button onClick={() => openCreditModal && openCreditModal(c)}
                  style={{ background: "#2a1a00", border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  💳 سداد آجل
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ===== حفظ / تعديل =====
  const openAdd = () => {
    setEditing(null);
    setForm({
      ...blank,
      id: "C" + Date.now(),
    });
    setShowForm(true);
  };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({ ...blank, ...c });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.phone) {
      showToast("يرجى ملء بيانات العميل", "error");
      return;
    }
    // ⚠️ مهم: نبعت الأعمدة الحقيقية الموجودة في جدول customers بس.
    // form بييجي أحيانًا من نسخة "enriched" فيها حقول محسوبة في الواجهة زي
    // stats و missedKidsCosmetics — دول مش أعمدة في القاعدة، وبعتهم بيسبب
    // خطأ "schema cache". فبنعمل whitelist صريح بدل ما نعمل spread لكل form.
    const saved = {
      id: form.id,
      name: form.name,
      phone: form.phone,
      taxId: form.taxId || "",
      totalSpent: form.totalSpent || 0,
      visits: form.visits || 0,
      lastVisit: form.lastVisit || "-",
      category: form.category,
      payment_terms: +form.payment_terms || 30,
      children_count:
        form.category === "family_with_kids" ? form.children_count : null,
      children_ages:
        form.category === "family_with_kids" ? form.children_ages : [],
      pharmacy_id: pharmacyId,
      created_by: form.created_by || currentUser?.name || "",
    };
    if (editing) {
      const oldCustomer = customers.find((x) => x.id === editing);
      const { error } = await supabase
        .from("customers")
        .update(saved)
        .eq("id", editing);
      if (error) {
        showToast("خطأ في التعديل: " + error.message, "error");
        return;
      }
      setCustomers((p) => p.map((x) => (x.id === editing ? saved : x)));
      logAudit({
        pharmacyId, userName: currentUser?.name, action: "update", entityType: "customer",
        entityId: editing, entityLabel: saved.name,
        oldValue: oldCustomer ? { name: oldCustomer.name, phone: oldCustomer.phone, category: oldCustomer.category, payment_terms: oldCustomer.payment_terms } : null,
        newValue: { name: saved.name, phone: saved.phone, category: saved.category, payment_terms: saved.payment_terms },
        description: `تعديل بيانات العميل "${saved.name}"`,
      });
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert(saved)
        .select();
      if (error) {
        showToast("خطأ في الحفظ: " + error.message, "error");
        return;
      }
      setCustomers((p) => [...p, data ? data[0] : saved]);
      logAudit({
        pharmacyId, userName: currentUser?.name, action: "create", entityType: "customer",
        entityId: data?.[0]?.id, entityLabel: saved.name,
        newValue: { name: saved.name, phone: saved.phone, category: saved.category },
        description: `إضافة عميل جديد "${saved.name}"`,
      });
    }
    setShowForm(false);
    showToast(editing ? "تم تعديل العميل ✓" : "تمت إضافة العميل ✓");
  };

  const toggleAge = (age) => {
    const current = form.children_ages || [];
    F(
      "children_ages",
      current.includes(age)
        ? current.filter((a) => a !== age)
        : [...current, age]
    );
  };

  const tabBtn = (tab) => ({
    background: activeTab === tab ? COLORS.blueSoft : COLORS.surface,
    border: `1px solid ${activeTab === tab ? COLORS.blue : COLORS.border}`,
    borderRadius: 8,
    padding: "8px 16px",
    color: activeTab === tab ? COLORS.blue : COLORS.textPrimary,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 800 : 600,
    boxShadow: SHADOW.card,
  });

  return (
    <div>
      {/* رأس الصفحة */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          إدارة العملاء
        </h2>
        {canAdd && (
          <Btn icon="plus" onClick={openAdd}>
            إضافة عميل
          </Btn>
        )}
      </div>

      {/* بطاقات الإحصائيات */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "إجمالي العملاء",
            value: totalCustomers,
            color: COLORS.blue,
            bg: COLORS.blueSoft,
            icon: "👥",
          },
          {
            label: "جديد هذا الشهر",
            value: newCount,
            color: COLORS.green,
            bg: COLORS.greenSoft,
            icon: "🆕",
          },
          { label: "عملاء VIP", value: vipCount, color: COLORS.gold, bg: COLORS.goldSoft, icon: "👑" },
          {
            label: "مختفون",
            value: inactiveCount,
            color: COLORS.red,
            bg: COLORS.redSoft,
            icon: "💤",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: item.bg,
              border: `1px solid ${tint(item.color, 0.35)}`,
              borderRadius: 12,
              padding: "14px 16px",
              boxShadow: SHADOW.card,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ color: item.color, fontWeight: 800, fontSize: 24 }}>
              {item.value}
            </div>
            <div style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: 700 }}>{item.label}</div>
          </div>
        ))}
        {/* كارت مديونية العملاء */}
        <div
          onClick={() => setActiveTab("credit")}
          style={{
            background: COLORS.redSoft,
            border: `1px solid ${tint(COLORS.red, 0.35)}`,
            borderRadius: 12,
            padding: "14px 16px",
            cursor: "pointer",
            gridColumn: "span 4",
            boxShadow: SHADOW.card,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
          <div style={{ color: COLORS.red, fontWeight: 800, fontSize: 18 }}>
            مديونية العملاء
          </div>
          <div style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: 600 }}>
            اضغط لعرض التفاصيل
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <button style={tabBtn("cards")} onClick={() => setActiveTab("cards")}>
          📋 كل العملاء
        </button>
        <button style={tabBtn("today")} onClick={() => setActiveTab("today")}>
          📅 عملاء اليوم{" "}
          {todayCustomers.length > 0 && `(${todayCustomers.length})`}
        </button>
        <button
          style={tabBtn("inactive")}
          onClick={() => setActiveTab("inactive")}
        >
          💤 المختفون {inactiveCount > 0 && `(${inactiveCount})`}
        </button>
        <button style={tabBtn("charts")} onClick={() => setActiveTab("charts")}>
          📊 الرسوم البيانية
        </button>
        <button style={tabBtn("credit")} onClick={() => setActiveTab("credit")}>
          💳 المديونيات
        </button>
      </div>

      {/* ===== تبويب: كل العملاء ===== */}
      {activeTab === "cards" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 بحث بالاسم أو الهاتف..."
              style={{
                flex: 1,
                minWidth: 200,
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "9px 14px",
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
              }}
            />
            <select
              value={filterVip}
              onChange={(e) => setFilterVip(e.target.value)}
              style={{
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: COLORS.textPrimary,
                fontSize: 13,
              }}
            >
              <option value="all">كل التصنيفات</option>
              <option value="vip">👑 VIP</option>
              <option value="excellent">⭐ ممتاز</option>
              <option value="good">✅ جيد</option>
              <option value="weak">🔴 ضعيف</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: COLORS.textPrimary,
                fontSize: 13,
              }}
            >
              <option value="all">كل الحالات</option>
              <option value="new">🆕 جديد</option>
              <option value="regular">✅ منتظم</option>
              <option value="at_risk">⚠️ في خطر</option>
              <option value="inactive">💤 مختفي</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: COLORS.textPrimary,
                fontSize: 13,
              }}
            >
              <option value="all">كل أنماط الشراء</option>
              <option value="شامل">🌐 عملاء شاملين (كذا قسم)</option>
              {Object.keys(MAIN_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>🛒 متخصصين في {cat}</option>
              ))}
            </select>
            <button
              onClick={() => setShowOpportunityOnly((p) => !p)}
              title="أسر عندها أطفال ومبتشتريش مستلزمات أطفال/كوزمتك — فرصة لعرض مستهدف"
              style={{
                background: showOpportunityOnly ? COLORS.goldSoft : COLORS.surfaceAlt,
                border: `1px solid ${showOpportunityOnly ? COLORS.gold : COLORS.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: showOpportunityOnly ? COLORS.gold : COLORS.textDim,
                fontSize: 13,
                cursor: "pointer",
                fontWeight: showOpportunityOnly ? 700 : 400,
                whiteSpace: "nowrap",
              }}
            >
              🎁 فرص عروض{showOpportunityOnly ? ` (${enriched.filter((c) => c.missedKidsCosmetics).length})` : ""}
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((c) => (
              <CustomerCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {/* ===== تبويب: عملاء اليوم ===== */}
      {activeTab === "today" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 15 }}>
              عملاء اليوم ({todayCustomers.length})
            </h3>
            {todayCustomers.length > 0 && (
              <button
                onClick={() =>
                  sendBulk(
                    todayCustomers,
                    "مرحباً! شكراً لزيارتكم اليوم 😊 نتمنى أن تكونوا بخير"
                  )
                }
                style={{
                  background: COLORS.greenSoft,
                  border: `1px solid ${tint(COLORS.green,0.35)}`,
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: COLORS.green,
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📣 تواصل جماعي
              </button>
            )}
          </div>
          {todayCustomers.length === 0 ? (
            <div style={{ color: COLORS.border, textAlign: "center", padding: 40 }}>
              لا يوجد عملاء اليوم
            </div>
          ) : (
            todayCustomers.map((c) => {
              const vip = c.stats ? vipConfig[c.stats.vipLevel] : null;
              return (
                <div
                  key={c.id}
                  style={{
                    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: 20 }}>
                      {c.category === "individual" ? "👤" : "👨‍👩‍👧"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                        {c.name}
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                        {c.phone}
                      </div>
                    </div>
                    {vip && (
                      <span
                        style={{
                          background: vip.bg,
                          color: vip.color,
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      >
                        {vip.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      openWhatsApp(
                        c.phone,
                        `مرحباً ${c.name}! شكراً لزيارتكم اليوم 😊`
                      )
                    }
                    style={{
                      background: COLORS.greenSoft,
                      border: `1px solid ${tint(COLORS.green,0.35)}`,
                      borderRadius: 8,
                      padding: "6px 14px",
                      color: COLORS.green,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    📱 واتساب
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== تبويب: المختفون ===== */}
      {activeTab === "inactive" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 15 }}>
              العملاء المختفون ({inactiveCustomers.length})
            </h3>
            {inactiveCustomers.length > 0 && (
              <button
                onClick={() =>
                  sendBulk(
                    inactiveCustomers,
                    "مرحباً! نفتقدكم في صيدليتنا 💊 لدينا عروض خاصة تنتظركم 🎁"
                  )
                }
                style={{
                  background: COLORS.redSoft,
                  border: `1px solid ${tint(COLORS.red,0.35)}`,
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: "#ff6644",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📣 حملة استرداد جماعي
              </button>
            )}
          </div>
          {inactiveCustomers.map((c) => {
            const s = c.stats;
            return (
              <div
                key={c.id}
                style={{
                  background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${tint(COLORS.red,0.35)}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                    {c.name}
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
                    غائب منذ{" "}
                    <span style={{ color: COLORS.red }}>
                      {s?.daysSinceLast} يوم
                    </span>{" "}
                    • إجمالي مشتريات:{" "}
                    <span style={{ color: COLORS.gold }}>
                      {s?.totalSpent.toFixed(0)} ر.س
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    {s?.lastItems?.slice(0, 3).map((item, i) => (
                      <span
                        key={i}
                        style={{
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          color: COLORS.textDim,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                        }}
                      >
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() =>
                    openWhatsApp(
                      c.phone,
                      `مرحباً ${c.name}! نفتقدكم 💊 لدينا عروض خاصة تنتظركم`
                    )
                  }
                  style={{
                    background: COLORS.greenSoft,
                    border: `1px solid ${tint(COLORS.green,0.35)}`,
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: COLORS.green,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  📱 استرداد
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== تبويب: الرسوم البيانية ===== */}
      {activeTab === "charts" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <BarChart
            title="📊 توزيع نوع العملاء"
            data={[
              {
                label: "👤 فرد",
                count: customers.filter((c) => c.category === "individual")
                  .length,
                color: COLORS.purple,
              },
              {
                label: "👫 أسرة بدون أطفال",
                count: customers.filter((c) => c.category === "family_no_kids")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "👨‍👩‍👧 أسرة مع أطفال",
                count: customers.filter(
                  (c) => c.category === "family_with_kids"
                ).length,
                color: COLORS.green,
              },
            ]}
          />
          <BarChart
            title="📊 حالة العملاء"
            data={[
              {
                label: "🆕 جديد",
                count: enriched.filter((c) => c.stats?.status === "new").length,
                color: COLORS.green,
              },
              {
                label: "✅ منتظم",
                count: enriched.filter((c) => c.stats?.status === "regular")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "⚠️ في خطر",
                count: enriched.filter((c) => c.stats?.status === "at_risk")
                  .length,
                color: COLORS.gold,
              },
              {
                label: "💤 مختفي",
                count: enriched.filter((c) => c.stats?.status === "inactive")
                  .length,
                color: COLORS.red,
              },
            ]}
          />
          <BarChart
            title="👑 تصنيف VIP"
            data={[
              {
                label: "👑 VIP",
                count: enriched.filter((c) => c.stats?.vipLevel === "vip")
                  .length,
                color: COLORS.gold,
              },
              {
                label: "⭐ ممتاز",
                count: enriched.filter((c) => c.stats?.vipLevel === "excellent")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "✅ جيد",
                count: enriched.filter((c) => c.stats?.vipLevel === "good")
                  .length,
                color: COLORS.green,
              },
              {
                label: "🔴 ضعيف",
                count: enriched.filter((c) => c.stats?.vipLevel === "weak")
                  .length,
                color: COLORS.red,
              },
            ]}
          />
          <BarChart
            title="🛒 أنماط الشراء (عدد العملاء)"
            data={[
              {
                label: "🌐 شاملين (كذا قسم)",
                count: enriched.filter((c) => c.stats?.buyerType === "شامل").length,
                color: COLORS.teal,
              },
              ...Object.keys(MAIN_CATEGORIES).map((cat, idx) => ({
                label: `🎯 متخصص في ${cat}`,
                count: enriched.filter((c) => c.stats?.buyerType === cat).length,
                color: [COLORS.blue, COLORS.purple, COLORS.gold, COLORS.green, COLORS.coral][idx % 5],
              })),
              {
                label: "❓ غير محدد",
                count: enriched.filter((c) => !c.stats?.buyerType).length,
                color: COLORS.textDim,
              },
            ]}
          />
          <BarChart
            title="💰 أنماط الشراء (قيمة المبيعات)"
            unit=" ر.س"
            data={[
              {
                label: "🌐 شاملين (كذا قسم)",
                count: Math.round(
                  enriched.filter((c) => c.stats?.buyerType === "شامل")
                    .reduce((s, c) => s + (c.stats?.totalSpent || 0), 0)
                ),
                color: COLORS.teal,
              },
              ...Object.keys(MAIN_CATEGORIES).map((cat, idx) => ({
                label: `🎯 متخصص في ${cat}`,
                count: Math.round(
                  enriched.filter((c) => c.stats?.buyerType === cat)
                    .reduce((s, c) => s + (c.stats?.totalSpent || 0), 0)
                ),
                color: [COLORS.blue, COLORS.purple, COLORS.gold, COLORS.green, COLORS.coral][idx % 5],
              })),
              {
                label: "❓ غير محدد",
                count: Math.round(
                  enriched.filter((c) => !c.stats?.buyerType)
                    .reduce((s, c) => s + (c.stats?.totalSpent || 0), 0)
                ),
                color: COLORS.textDim,
              },
            ]}
          />
          <div
            style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 14, marginBottom: 14 }}>
              📊 اتجاه شراء العملاء (آخر 6 شهور)
            </div>
            {["up", "down", "stable"].map((key) => {
              const cfg = trendConfig[key];
              const list = enriched.filter((c) => c.stats?.trendDirection === key);
              return (
                <div
                  key={key}
                  onClick={() => list.length > 0 && setTrendGroupView(key)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                    background: cfg.bg, border: `1px solid ${cfg.color}33`,
                    cursor: list.length > 0 ? "pointer" : "default",
                  }}
                >
                  <span style={{ color: cfg.color, fontSize: 13, fontWeight: 700 }}>{cfg.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.textPrimary, fontWeight: 800, fontSize: 15 }}>{list.length}</span>
                    {list.length > 0 && (
                      <span style={{ color: COLORS.textDim, fontSize: 11 }}>عرض العملاء ◀</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeTab === "credit" && (
        <CreditTab customers={enriched} onPay={openCreditModal} sales={sales} creditPayments={creditPayments} />
      )}
      <Modal
        open={!!trendGroupView}
        onClose={() => setTrendGroupView(null)}
        title={trendGroupView ? `${trendConfig[trendGroupView].label} — العملاء` : ""}
        wide
      >
        {(() => {
          if (!trendGroupView) return null;
          const list = enriched
            .filter((c) => c.stats?.trendDirection === trendGroupView)
            .sort((a, b) => (b.stats?.totalSpent || 0) - (a.stats?.totalSpent || 0));
          if (list.length === 0) {
            return (
              <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>
                لا يوجد عملاء في هذه المجموعة
              </div>
            );
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 8,
                    background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13 }}>{c.name}</div>
                    <div style={{ color: COLORS.textDim, fontSize: 11 }}>{c.phone}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 12 }}>
                        {(c.stats?.totalSpent || 0).toFixed(0)} ر.س
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>
                        هذا الشهر: {(c.stats?.monthlySpent || 0).toFixed(0)} ر.س
                      </div>
                    </div>
                    <button
                      onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊`)}
                      style={{
                        background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`,
                        borderRadius: 7, padding: "5px 9px", color: COLORS.green, fontSize: 11,
                        cursor: "pointer", fontWeight: 700,
                      }}
                    >
                      📱
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>
      <Modal
        open={showCredit}
        onClose={() => {
          setShowCredit(false);
          setSelectedInvoice(null);
          setPayAmount("");
        }}
        title={`مديونية - ${selectedCreditCustomer?.name}`}
        wide
      >
        {creditInvoices.length === 0 ? (
          <div style={{ color: COLORS.green, textAlign: "center", padding: 20 }}>
            ✅ لا توجد مديونيات
          </div>
        ) : (
          <>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: 16,
              }}
            >
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {[
                    "رقم الفاتورة",
                    "التاريخ",
                    "الإجمالي",
                    "المدفوع",
                    "المتبقي",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        color: COLORS.textDim,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                      background:
                        selectedInvoice?.id === inv.id
                          ? COLORS.blueSoft
                          : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: COLORS.blue,
                        fontWeight: 700,
                      }}
                    >
                      {inv.id}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.textDim }}>
                      {inv.date}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.textPrimary }}>
                      {inv.total.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.green }}>
                      {inv.totalPaid.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: COLORS.red,
                        fontWeight: 700,
                      }}
                    >
                      {inv.remaining.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: COLORS.border, fontSize: 11 }}>
                        اختر
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedInvoice && (
              <div
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14 }}
              >
                <div
                  style={{ color: COLORS.textPrimary, marginBottom: 10, fontSize: 13 }}
                >
                  سداد فاتورة{" "}
                  <span style={{ color: COLORS.blue }}>{selectedInvoice.id}</span>{" "}
                  • المتبقي:{" "}
                  <span style={{ color: COLORS.red }}>
                    {selectedInvoice.remaining.toFixed(2)} ر.س
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="المبلغ المدفوع..."
                    max={selectedInvoice.remaining}
                    style={{
                      flex: 1,
                      background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: COLORS.textPrimary,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() =>
                      setPayAmount(String(selectedInvoice.remaining))
                    }
                    style={{
                      background: COLORS.blueSoft,
                      border: `1px solid ${tint(COLORS.blue,0.35)}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: COLORS.blue,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    سداد كامل
                  </button>
                  <Btn icon="check" onClick={payCreditInvoice}>
                    تأكيد
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
      {/* مودال الإضافة/التعديل */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "تعديل العميل" : "إضافة عميل جديد"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="اسم العميل *"
            value={form.name}
            onChange={(v) => F("name", v)}
            placeholder="الاسم الكامل"
          />
          <Input
            label="رقم الهاتف *"
            value={form.phone}
            onChange={(v) => F("phone", v)}
            placeholder="05XXXXXXXX"
          />
          <Input
            label="الرقم الضريبي (اختياري)"
            value={form.taxId}
            onChange={(v) => F("taxId", v)}
            placeholder="اختياري"
          />
          <Input
            label="فترة السداد (بالأيام) — لبيع الآجل"
            value={form.payment_terms}
            onChange={(v) => F("payment_terms", v)}
            placeholder="مثال: 30"
            type="number"
          />
          <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: -6 }}>
            لو العميل بيشتري بالآجل، هيظهر تنبيه "متأخر في السداد" لو فاتورة مفتوحة عدّت فترة السداد دي من غير تحصيل.
          </div>
          <div>
            <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 8 }}>
              نوع العميل *
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { val: "individual", label: "👤 فرد" },
                { val: "family_no_kids", label: "👫 أسرة بدون أطفال" },
                { val: "family_with_kids", label: "👨‍👩‍👧 أسرة مع أطفال" },
              ].map((opt) => (
                <div
                  key={opt.val}
                  onClick={() => F("category", opt.val)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: `2px solid ${
                      form.category === opt.val ? COLORS.blue : COLORS.border
                    }`,
                    background:
                      form.category === opt.val ? COLORS.blueSoft : COLORS.surfaceAlt,
                    color: form.category === opt.val ? COLORS.blue : COLORS.textDim,
                    fontSize: 12,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
          {form.category === "family_with_kids" && (
            <>
              <Input
                label="عدد الأطفال *"
                value={form.children_count}
                onChange={(v) => F("children_count", v)}
                placeholder="مثال: 2"
                type="number"
              />
              <div>
                <div
                  style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 8 }}
                >
                  الفئات العمرية
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    "أقل من سنة",
                    "1-3 سنوات",
                    "4-6 سنوات",
                    "7-12 سنة",
                    "13-17 سنة",
                  ].map((age) => {
                    const selected = (form.children_ages || []).includes(age);
                    return (
                      <div
                        key={age}
                        onClick={() => toggleAge(age)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 20,
                          border: `1px solid ${
                            selected ? COLORS.green : COLORS.border
                          }`,
                          background: selected ? COLORS.greenSoft : COLORS.surfaceAlt,
                          color: selected ? COLORS.green : COLORS.textDim,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {selected ? "✓ " : ""}
                        {age}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 18,
            justifyContent: "flex-end",
          }}
        >
          <Btn variant="ghost" onClick={() => setShowForm(false)}>
            إلغاء
          </Btn>
          <Btn icon="check" onClick={save}>
            {editing ? "حفظ التعديل" : "إضافة العميل"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
