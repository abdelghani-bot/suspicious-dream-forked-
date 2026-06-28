import { useTheme } from "../theme/ThemeContext";

export function Dashboard({
  products,
  sales,
  purchases,
  customers,
  suppliers = [],
  shifts,
  currentUser,
  pharmacyId,
  setTab,
  creditPayments = [],
  treasuryEntries = [],
}) {
  const { C } = useTheme();
  const alerts = useEssentialAlerts(products);
  const [salesTab, setSalesTab] = useState("today"); // "today" | "month" | "compare"
  const [privacyMode, setPrivacyMode] = useState(true);
  const [expandedAlertGroup, setExpandedAlertGroup] = useState(null);

  // ── فرص ضائعة ──
  const [missedToday, setMissedToday] = useState({ count: 0, value: 0 });
  const [missedMonth, setMissedMonth] = useState({ count: 0, value: 0 });

  const today = new Date().toISOString().split("T")[0];
  const monthKey = today.substring(0, 7);

  useEffect(() => {
    const fetchMissed = async () => {
      const { data: todayData } = await supabase
        .from("missed_sales").select("price, qty").eq("date", today);
      if (todayData) {
        const value = todayData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedToday({ count: todayData.length, value });
      }
      const { data: monthData } = await supabase
        .from("missed_sales").select("price, qty")
        .gte("date", monthKey + "-01").lte("date", monthKey + "-31");
      if (monthData) {
        const value = monthData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedMonth({ count: monthData.length, value });
      }
    };
    fetchMissed();
  }, [today, monthKey]);
const [myTarget, setMyTarget] = useState(null);

  useEffect(() => {
    if (!pharmacyId || !currentUser?.name) return;
    supabase
      .from("monthly_targets")
      .select("target_amount")
      .eq("pharmacy_id", pharmacyId)
      .eq("pharmacist_name", currentUser.name)
      .eq("month", monthKey)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error(error); setMyTarget(0); return; }
        setMyTarget(data?.target_amount || 0);
      });
  }, [pharmacyId, currentUser?.name, monthKey]);

  const myMonthSales = sales.filter(
    (s) => (s.created_at || s.date || "").startsWith(monthKey) &&
           !s.returned &&
           s.cashier_name === currentUser?.name
  );
  const myAchieved = myMonthSales.reduce((a, s) => a + (s.total || 0), 0);

  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeftInMonth = lastDayOfMonth - new Date().getDate();

  const targetProgress = myTarget > 0 ? Math.min((myAchieved / myTarget) * 100, 100) : 0;
  const targetRemaining = Math.max((myTarget || 0) - myAchieved, 0);
  const requiredDaily = daysLeftInMonth > 0 ? targetRemaining / daysLeftInMonth : targetRemaining;
  // ── حسابات المبيعات ──
  const todaySales    = sales.filter((s) => s.date === today && !s.returned);
  const todayCashSales = todaySales.filter((s) => s.payment !== "آجل" && s.payment !== "تحصيل آجل");
  const todayCreditPaid = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todayReturnsForDash = sales
  .filter((s) => s.returned && s.returnDate === today)
  .reduce((a, s) => a + (s.total || 0), 0);
  const monthReturnsForDash = sales
  .filter((s) => s.returned && s.returnDate?.startsWith(monthKey))
  .reduce((a, s) => a + (s.total || 0), 0);
  const todayRev = todayCashSales.reduce((a, s) => a + s.total, 0);
  const todayAjilTotal = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayAvgInvoice = todayCashSales.length > 0 ? todayRev / todayCashSales.length : 0;

  // ── مبيعات الشبكة اليوم (فواتير بطاقة كاملة + جزء الكارت من الفواتير المختلطة) ──
  const todayNetworkSales = todaySales.reduce((a, s) => {
    if (s.payment === "بطاقة") return a + (s.total || 0);
    if (s.payment === "مختلط" && s.payment_split) return a + (s.payment_split.card || 0);
    return a;
  }, 0);
  // مبيعات الكاش الصافية لعرض منفصل عن الشبكة في كارت خزنة اليوم (todayRev يبقى الإجمالي الشامل ويُستخدم في "صافي اليوم")
  const todayCashOnlySales = todayRev - todayNetworkSales;

  // ── النثريات المسجّلة اليوم من سجل الخزنة ──
  const todayPettyExpenses = (treasuryEntries || [])
    .filter((e) => e.date === today && e.type === "expense" && e.sub_type === "petty")
    .reduce((a, e) => a + (e.amount || 0), 0);

  const monthSales    = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned);
  const monthCashSales = monthSales.filter((s) => s.payment !== "آجل");
  const monthRev = monthCashSales.reduce((a, s) => a + s.total, 0);
  const monthCreditCollected = creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0);
  const monthAjilTotal = monthSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const monthAvgInvoice = monthCashSales.length > 0 ? monthRev / monthCashSales.length : 0;

  // ── آخر 7 أيام للجراف ──
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const last7Data = last7Days.map((day) => {
    const daySales = sales.filter((s) => s.date === day && !s.returned && s.payment !== "آجل");
    return { day, rev: daySales.reduce((a, s) => a + s.total, 0) };
  });
  const maxRev = Math.max(...last7Data.map((d) => d.rev), 1);

  // ── آخر 6 أشهر ──
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  };
  const last6Months = getLast6Months();
  // ربح صنف واحد داخل فاتورة = (سعر البيع - التكلفة) × الكمية
  // التكلفة تُقرأ من الـ item نفسه (مسجلة وقت البيع) وإن لم توجد (فواتير قديمة) نرجع لتكلفة الصنف الحالية كتقريب
  const getSaleItems = (s) => {
    try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
    catch { return []; }
  };
  const calcSaleProfit = (s) => {
    const items = getSaleItems(s).filter((it) => !it.isMissed); // الأصناف المفقودة (طلب بدون مخزون) مش بيع فعلي ومالهاش ربح
    const rawProfit = items.reduce((sum, it) => {
      const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
      const price = it.price ?? 0;
      return sum + (price - cost) * (it.qty || 0);
    }, 0);
    // الخصم بيتطبق على مستوى الفاتورة كلها (subtotal + ضريبة) مش موزّع على كل صنف،
    // وبما إن التكلفة ثابتة، أي خصم بيقلل الربح بقيمته بالكامل
    const discount = s.discount_amt ?? s.discountAmt ?? 0;
    return rawProfit - discount;
  };
  const monthsData = last6Months.map((mk) => {
    const mSales = sales.filter((s) => s.date?.startsWith(mk) && !s.returned);
    const mCash  = mSales.filter((s) => s.payment !== "آجل");
    const mRev   = mCash.reduce((a, s) => a + s.total, 0);
    const mPurchases = purchases.filter((p) => (p.created_at || p.date || "").startsWith(mk)).reduce((a, p) => a + (p.total || 0), 0);
    const mCreditPaid = creditPayments.filter((p) => p.date?.startsWith(mk)).reduce((a, p) => a + p.amount, 0);
    // الربح الفعلي = مجموع (سعر البيع - التكلفة) × الكمية لكل أصناف فواتير الشهر (وليس الفرق بين إجمالي البيع وإجمالي الشراء)
    const mProfit = mSales.reduce((sum, s) => sum + calcSaleProfit(s), 0);
    const label = new Date(mk + "-01").toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    return { mk, label, mRev, mPurchases, mCreditPaid, mProfit };
  });

  // ── تنبيهات الأصناف ──
  const lowStock      = products.filter((p) => p.stock <= (p.min_stock || p.minStock || 0));
  const expiringSoon  = products.filter((p) => {
    if (!p.expiry) return false;
    const diff = (new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return diff < 90 && diff > 0;
  });

  // ══════════ بيانات مركز التنبيهات ══════════
  const todayISO = new Date().toISOString().split("T")[0];

  // عروض تلقائية (غير دواء + قرب صلاحية حسب نفس قواعد قسم العروض) + عروض يدوية لا تحتاج هنا عداد دقيق (تُدار في قسمها)
  const autoPromoCandidates = products.filter((p) => {
    const cat = p.main_category || p.category || "";
    if (cat === "دواء") return false;
    if (!p.expiry) return false;
    const disc = calcAutoDiscount(p.expiry);
    return disc > 0 && (p.stock || 0) > 0;
  });

  // استحقاقات الموردين القريبة (خلال 5 أيام أو متأخرة بالفعل)
  const supplierDues = (suppliers || []).map((s) => {
    const supPurchases = (purchases || []).filter((p) => p.supplier === s.id && p.payment_status !== "مسددة");
    let nearestDue = null, isOverdue = false;
    supPurchases.forEach((po) => {
      const due = new Date(po.date);
      due.setDate(due.getDate() + (s.payment_terms || 30));
      const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
      if (nearestDue === null || daysLeft < nearestDue) nearestDue = daysLeft;
      if (daysLeft < 0) isOverdue = true;
    });
    return { supplier: s, daysLeft: nearestDue, isOverdue };
  }).filter((d) => d.daysLeft !== null && d.daysLeft <= 5);

  // عملاء جدد خلال آخر 7 أيام
  const newCustomers = (customers || []).filter((c) => {
    const created = c.created_at ? new Date(c.created_at) : null;
    if (!created) return false;
    const days = (new Date() - created) / (1000 * 60 * 60 * 24);
    return days <= 7;
  });

  // عملاء مختفون: كان عندهم تعامل سابق ومالهمش زيارة منذ أكثر من 45 يوم
  const disappearedCustomers = (customers || []).filter((c) => {
    if (!c.lastVisit) return false;
    const days = (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
    return days > 45 && days < 365 && (c.visits || 0) > 0;
  });

  // موعد إقفال الإقرار الضريبي الربعي (نهاية الشهر التالي لنهاية الربع - نظام ضريبة القيمة المضافة السعودي)
  const taxDeadlineInfo = (() => {
    const now = new Date();
    const quarterEndMonth = [2, 5, 8, 11].find((m) => m >= now.getMonth()) ?? 2; // فبراير=1 .. نهاية كل ربع
    const qEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0); // آخر يوم في الشهر التالي للربع
    const daysLeft = Math.ceil((qEnd - now) / (1000 * 60 * 60 * 24));
    return { daysLeft, date: qEnd };
  })();

  // إجمالي مركز التنبيهات
  const alertCenterGroups = [
    { key: "essential",  icon: "💊", label: "نفاذ/قرب نفاذ دواء أساسي", count: alerts.length,                 color: VAR.danger, tab: "products" },
    { key: "lowstock",   icon: "📦", label: "مخزون منخفض",              count: lowStock.length,               color: VAR.warn, tab: "products" },
    { key: "expiry",     icon: "⏰", label: "أصناف قرب الانتهاء",        count: expiringSoon.length,           color: VAR.warn, tab: "products" },
    { key: "supplier",   icon: "🧾", label: "استحقاق مورد قريب/متأخر",   count: supplierDues.length,           color: VAR.danger, tab: "suppliers" },
    { key: "newcust",    icon: "🆕", label: "عملاء جدد هذا الأسبوع",     count: newCustomers.length,           color: VAR.accent, tab: "customers" },
    { key: "lostcust",   icon: "👻", label: "عملاء مختفون",              count: disappearedCustomers.length,   color: VAR.muted, tab: "customers" },
    { key: "tax",        icon: "🗂️", label: "موعد الإقرار الضريبي الربعي", count: taxDeadlineInfo.daysLeft <= 14 ? 1 : 0, color: VAR.warn, tab: "tax_report" },
    { key: "appoint",    icon: "📅", label: "مواعيد مهمة (رخصة/إيجار)",  count: 2,                              color: VAR.accent, tab: "dashboard" },
  ];
  // العروض التلقائية بتتطبق وبتتلغي تلقائيًا حسب الصلاحية بدون تدخل بشري — مش بند تنبيه يحتاج إجراء
  const totalAlertsCount = alertCenterGroups.reduce((a, g) => a + g.count, 0);

  // ══════════ تايم لاين حركة اليوم (بالساعة) ══════════
  const todaySalesForTimeline = sales.filter((s) => s.date === todayISO && !s.returned);
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, rev: 0 }));
  todaySalesForTimeline.forEach((s) => {
    const t = s.created_at || s.time || null;
    const h = t ? new Date(t).getHours() : null;
    if (h === null || isNaN(h)) return;
    hourBuckets[h].count += 1;
    hourBuckets[h].rev += s.total || 0;
  });
  const activeHours = hourBuckets.filter((b) => b.hour >= 7 && b.hour <= 23); // ساعات عمل الصيدلية المعتادة
  const maxHourCount = Math.max(...activeHours.map((b) => b.count), 1);

  // ── معلومات الشفت الحالي ──
  const currentShift = shifts?.find((s) => !s.end_time && s.user === currentUser?.name) || null;
  const shiftSales   = currentShift
    ? sales.filter((s) => s.shift === currentShift.id && !s.returned)
    : [];
  const shiftReturns = currentShift
    ? sales.filter((s) => s.shift === currentShift.id && s.returned)
    : [];
  const shiftReturnsTotal = shiftReturns.reduce((a, s) => a + (s.total || 0), 0);
  const shiftItems   = shiftSales.flatMap((s) => {
    try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
    catch { return []; }
  });
  const avgItemsPerInvoice = shiftSales.length > 0 ? (shiftItems.length / shiftSales.length).toFixed(1) : 0;

  // ── helpers ──
  const S = (val) => privacyMode
    ? <span style={{ filter: "blur(6px)", userSelect: "none" }}>{val}</span>
    : val;

  // الألوان مرتبطة الآن بالثيم العام (dark/light) بدل القيم الثابتة
  const VAR = {
    bg:       C.bg,
    surface:  C.surface,
    surface2: C.bgAlt,
    border:   C.border,
    accent:   C.success,
    accent2:  C.accent,
    warn:     C.warning,
    danger:   C.danger,
    text:     C.text,
    muted:    C.muted,
  };

  const card = {
    background: VAR.surface,
    border: `1px solid ${VAR.border}`,
    borderRadius: 12,
    overflow: "hidden",
  };

  const SALES_TABS = [
    { key: "today",   label: "اليوم" },
    { key: "month",   label: "الشهر" },
    { key: "compare", label: "المقارنة" },
  ];

  // ── محتوى تاب المبيعات ──
  const renderSalesStats = () => {
    if (salesTab === "compare") {
      const maxVal = Math.max(...monthsData.map((m) => m.mRev), 1);
      return (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr style={{ background: VAR.bg }}>
                  {["الشهر","المبيعات","المشتريات","السداد","الربح"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: VAR.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthsData.map((m) => (
                  <tr key={m.mk} style={{ borderBottom: `1px solid ${VAR.border}`, background: m.mk === monthKey ? VAR.surface2 : "transparent" }}>
                    <td style={{ padding: "9px 12px", color: VAR.text, fontWeight: m.mk === monthKey ? 700 : 400, fontSize: 12 }}>
                      {m.label} {m.mk === monthKey && "🔵"}
                    </td>
                    <td style={{ padding: "9px 12px", color: VAR.accent, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mRev.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: VAR.danger, fontFamily: "monospace", fontSize: 12 }}>{S(m.mPurchases.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: VAR.warn, fontFamily: "monospace", fontSize: 12 }}>{S(m.mCreditPaid.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: m.mProfit >= 0 ? VAR.accent : VAR.danger, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mProfit.toFixed(0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {monthsData.map((m) => (
              <div key={m.mk} style={{ marginBottom: 8 }}>
                <div style={{ color: VAR.muted, fontSize: 10, marginBottom: 2 }}>{m.label}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                    <div style={{ background: VAR.accent, height: "100%", borderRadius: 3, width: `${(m.mRev / maxVal) * 100}%` }} />
                  </div>
                  <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                    <div style={{ background: VAR.danger, height: "100%", borderRadius: 3, width: `${(m.mPurchases / maxVal) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
              <span style={{ color: VAR.accent, fontSize: 10 }}>■ مبيعات</span>
              <span style={{ color: VAR.danger, fontSize: 10 }}>■ مشتريات</span>
            </div>
          </div>
        </>
      );
    }

    const isToday    = salesTab === "today";
    const rev        = isToday ? todayRev : monthRev;
    const invoices   = isToday ? todayCashSales : monthCashSales;
    const missed     = isToday ? missedToday.value : missedMonth.value;
    const missedCnt  = isToday ? missedToday.count : missedMonth.count;
    const avgInv     = isToday ? todayAvgInvoice : monthAvgInvoice;
    const creditPaid = isToday ? todayCreditPaid : monthCreditCollected;
    const ajilTotal  = isToday ? todayAjilTotal  : monthAjilTotal;
    const returns    = isToday ? todayReturnsForDash : monthReturnsForDash;
    const returnsCnt = isToday
      ? sales.filter((s) => s.returned && s.returnDate === today).length
      : sales.filter((s) => s.returned && s.returnDate?.startsWith(monthKey)).length;

    return (
      <>
        {/* 5 stat cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", borderBottom: `1px solid ${VAR.border}` }}>
          {[
            { label: "إجمالي المبيعات", val: rev.toFixed(0) + " ر.س", color: VAR.accent, sub: `${invoices.length} فاتورة` },
            { label: "سداد الآجل",      val: creditPaid.toFixed(0) + " ر.س", color: VAR.accent2, sub: `مديونية ${ajilTotal.toFixed(0)}` },
            { label: "مرتجع المبيعات",  val: returns.toFixed(0) + " ر.س", color: VAR.danger, sub: `${returnsCnt} فاتورة مرتجعة` },
            { label: "الفرص الضائعة",   val: missed.toFixed(0) + " ر.س", color: VAR.warn, sub: `${missedCnt} صنف مفقود` },
            { label: "متوسط الفاتورة",  val: avgInv.toFixed(1) + " ر.س", color: VAR.text, sub: "ريال" },
          ].map((cell, i) => (
            <div key={i} style={{ padding: "14px 16px", borderLeft: i < 4 ? `1px solid ${VAR.border}` : "none" }}>
              <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600, marginBottom: 4, letterSpacing: "0.05em" }}>
                {cell.label}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: cell.color }}>
                {S(cell.val)}
              </div>
              <div style={{ fontSize: 10, color: VAR.muted, marginTop: 3 }}>{S(cell.sub)}</div>
            </div>
          ))}
        </div>

        {/* Bar chart - آخر 7 أيام */}
        <div style={{ padding: "12px 16px", height: 100, display: "flex", alignItems: "flex-end", gap: 6 }}>
          {last7Data.map((d, i) => {
            const isToday2 = d.day === today;
            const h = `${Math.max((d.rev / maxRev) * 76, 4)}px`;
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{
                  width: "100%", height: h, borderRadius: "4px 4px 0 0",
                  background: isToday2
                    ? `linear-gradient(to top, ${VAR.accent}, ${VAR.accent2})`
                    : VAR.surface2,
                  boxShadow: isToday2 ? `0 0 10px rgba(0,200,150,0.3)` : "none",
                  transition: "height 0.4s",
                }} />
                <div style={{ fontSize: 9, color: isToday2 ? VAR.accent : VAR.muted, fontFamily: "monospace" }}>
                  {isToday2 ? "اليوم" : d.day.slice(8)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ── Alert Strip (مختصر يفتح مركز التنبيهات) ── */}
      {totalAlertsCount > 0 && (
        <div style={{
          background: "linear-gradient(90deg, rgba(239,68,68,0.12), transparent)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12, fontSize: 13,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1, color: VAR.muted }}>
            <strong style={{ color: VAR.danger }}>{totalAlertsCount} تنبيه تحتاج تدخل</strong>
            <span style={{ color: VAR.muted }}> — راجع مركز التنبيهات بالأسفل</span>
          </div>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            style={{
              background: VAR.surface2, border: `1px solid ${VAR.border}`,
              borderRadius: 8, padding: "4px 12px", fontSize: 11,
              color: VAR.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "inherit",
            }}
          >
            {privacyMode ? "🙈 إظهار" : "👁 إخفاء"}
          </button>
        </div>
      )}

      {/* ── ROW 1: إحصائيات المبيعات + تارجت الشهر ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
        إحصائيات المبيعات
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Sales Stats Card */}
        <div style={{ ...card }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${VAR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>المبيعات والفرص</div>
            <div style={{ display: "flex", background: VAR.surface2, borderRadius: 8, padding: 2, gap: 2 }}>
              {SALES_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSalesTab(t.key)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                    background: salesTab === t.key ? VAR.accent : "transparent",
                    color: salesTab === t.key ? VAR.bg : VAR.muted,
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {renderSalesStats()}
        </div>

       {/* Target Card */}
<div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
  <div style={{ fontSize: 11, fontWeight: 700, color: VAR.muted }}>تارجت الشهر</div>
  {myTarget === null ? (
    <div style={{ color: VAR.muted, fontSize: 12 }}>جاري التحميل...</div>
  ) : myTarget === 0 ? (
    <div style={{ color: VAR.muted, fontSize: 12 }}>لم يتم تحديد تارجت لك هذا الشهر</div>
  ) : (
    <>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: VAR.accent, lineHeight: 1 }}>
          {S(`${targetProgress.toFixed(0)}%`)}
        </div>
        <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>
          {S(`من ${myTarget.toLocaleString()} ريال`)}
        </div>
      </div>
      <div style={{ height: 6, background: VAR.surface2, borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${targetProgress}%`, borderRadius: 99,
          background: `linear-gradient(90deg, ${VAR.accent2}, ${VAR.accent})`,
          boxShadow: "0 0 8px rgba(0,200,150,0.4)",
        }} />
      </div>
      <div style={{ fontSize: 11, color: VAR.muted }}>
        متبقي <strong style={{ color: VAR.warn }}>{S(`${targetRemaining.toFixed(0)} ريال`)}</strong> في {daysLeftInMonth} يوم
      </div>
      <div style={{ borderTop: `1px solid ${VAR.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: VAR.muted, marginBottom: 4 }}>المطلوب يومياً</div>
        <div style={{ fontFamily: "monospace", fontSize: 22, color: VAR.warn, fontWeight: 700 }}>
          {S(requiredDaily.toFixed(0))} <span style={{ fontSize: 12, color: VAR.muted }}>ريال</span>
        </div>
      </div>
    </>
  )}
</div>
      </div>
      {/* ── ROW 1.5: تايم لاين حركة اليوم ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        حركة اليوم بالساعة
      </div>
      <div style={{ ...card, padding: "16px 16px 12px", marginBottom: 12 }}>
        {todaySalesForTimeline.length === 0 ? (
          <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
            لا توجد مبيعات مسجّلة اليوم بعد
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
              {activeHours.map((b) => {
                const intensity = b.count / maxHourCount; // 0..1
                const h = `${Math.max(intensity * 56, b.count > 0 ? 6 : 2)}px`;
                // ألوان متدرجة زي خرائط جوجل: فاتح = هادئ، غامق/أخضر مشبع = ذروة
                const bg = b.count === 0
                  ? VAR.surface2
                  : intensity > 0.66 ? VAR.accent
                  : intensity > 0.33 ? VAR.accent2
                  : VAR.surface;
                return (
                  <div key={b.hour} title={`${b.hour}:00 — ${b.count} فاتورة، ${b.rev.toFixed(0)} ر.س`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: bg, transition: "height 0.3s" }} />
                    <div style={{ fontSize: 8, color: VAR.muted, fontFamily: "monospace" }}>{b.hour}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: VAR.muted, marginTop: 10 }}>
              مبني على بيانات اليوم الحالي فقط — مع تراكم أكثر من بضعة أسابيع هيتحول لمتوسط "أكثر أوقات الازدحام" زي خرائط جوجل
            </div>
          </>
        )}
      </div>

      {/* ── ROW 2: مركز التنبيهات ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        مركز التنبيهات
      </div>
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${VAR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text, display: "flex", alignItems: "center", gap: 6 }}>
            🔔 مركز التنبيهات
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(239,68,68,0.15)", color: VAR.danger, fontFamily: "monospace" }}>
              {totalAlertsCount}
            </span>
          </div>
        </div>
        <div>
          {totalAlertsCount === 0 && (
            <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
              لا توجد تنبيهات حالياً ✅
            </div>
          )}
          {alertCenterGroups.filter((g) => g.count > 0).map((g) => (
            <div key={g.key}>
              <div
                onClick={() => setExpandedAlertGroup(expandedAlertGroup === g.key ? null : g.key)}
                style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, borderBottom: `1px solid ${VAR.border}`, fontSize: 12, cursor: "pointer" }}
              >
                <span style={{ fontSize: 14 }}>{g.icon}</span>
                <div style={{ flex: 1, color: VAR.text, fontWeight: 600 }}>{g.label}</div>
                <div style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 700, fontFamily: "monospace",
                  background: g.count > 0 ? `${g.color}26` : "rgba(125,133,144,0.12)",
                  color: g.count > 0 ? g.color : VAR.muted,
                }}>
                  {g.count}
                </div>
                <span style={{ color: VAR.muted, fontSize: 11 }}>{expandedAlertGroup === g.key ? "▲" : "▼"}</span>
                <span onClick={(e) => { e.stopPropagation(); setTab(g.tab); }} style={{ color: VAR.accent2, fontSize: 11 }}>فتح →</span>
              </div>
              {expandedAlertGroup === g.key && (
                <div style={{ background: VAR.bg, padding: "8px 14px 12px" }}>
                  {g.key === "essential" && (
                    alerts.length === 0 ? <EmptyAlertRow text="لا توجد أدوية أساسية ناقصة ✅" muted={VAR.muted} /> :
                    alerts.map((a, i) => (
                      <AlertRow key={i} text={a.name} badge={a.type === "danger" ? "نافذ" : `متبقي ${a.stock}`} color={a.type === "danger" ? VAR.danger : VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "lowstock" && (
                    lowStock.length === 0 ? <EmptyAlertRow text="لا يوجد مخزون منخفض ✅" muted={VAR.muted} /> :
                    lowStock.slice(0, 8).map((p) => (
                      <AlertRow key={p.id} text={p.name} badge={`${p.stock} / ${p.min_stock || p.minStock || 0}`} color={VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "expiry" && (
                    expiringSoon.length === 0 ? <EmptyAlertRow text="لا توجد أصناف قرب الانتهاء ✅" muted={VAR.muted} /> :
                    expiringSoon.slice(0, 8).map((p) => {
                      const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                      return <AlertRow key={p.id} text={p.name} badge={days < 30 ? `${days} يوم` : `${Math.ceil(days / 30)} شهر`} color={VAR.warn} VAR={VAR} />;
                    })
                  )}
                  {g.key === "supplier" && (
                    supplierDues.length === 0 ? <EmptyAlertRow text="لا توجد استحقاقات قريبة" muted={VAR.muted} /> :
                    supplierDues.slice(0, 8).map((d) => (
                      <AlertRow key={d.supplier.id} text={d.supplier.name} badge={d.isOverdue ? `متأخر ${Math.abs(d.daysLeft)} يوم` : `خلال ${d.daysLeft} يوم`} color={d.isOverdue ? VAR.danger : VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "newcust" && (
                    newCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء جدد هذا الأسبوع" muted={VAR.muted} /> :
                    newCustomers.slice(0, 8).map((c) => (
                      <AlertRow key={c.id} text={c.name} badge="جديد" color={VAR.accent} VAR={VAR} />
                    ))
                  )}
                  {g.key === "lostcust" && (
                    disappearedCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء مختفون" muted={VAR.muted} /> :
                    disappearedCustomers.slice(0, 8).map((c) => (
                      <AlertRow key={c.id} text={c.name} badge={`آخر زيارة ${c.lastVisit}`} color={VAR.muted} VAR={VAR} />
                    ))
                  )}
                  {g.key === "tax" && (
                    <AlertRow text="الإقرار الضريبي الربعي القادم" badge={`خلال ${taxDeadlineInfo.daysLeft} يوم`} color={taxDeadlineInfo.daysLeft <= 7 ? VAR.danger : VAR.warn} VAR={VAR} />
                  )}
                  {g.key === "appoint" && (
                    <>
                      <AlertRow text="تجديد الرخصة التجارية" badge="18 يوم" color={VAR.accent} VAR={VAR} />
                      <AlertRow text="إيجار الصيدلية" badge="غداً" color={VAR.warn} VAR={VAR} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 3: الشفت الحالي + الخزنة + إجراءات سريعة ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        الشفت الحالي والخزنة
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>

        {/* بطاقة الصيدلي */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${VAR.border}` }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg, ${VAR.accent}, ${VAR.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: VAR.bg, flexShrink: 0,
            }}>
              {currentUser?.name?.[0] || "م"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{currentUser?.name || "الصيدلي"}</div>
              <div style={{ fontSize: 10, color: VAR.muted }}>
                {currentShift ? `شفت نشط · بدأ ${new Date(currentShift.start_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : "لا يوجد شفت مفتوح"}
              </div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: VAR.accent }}>
              {S(`${shiftSales.length}`)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 1, background: VAR.border }}>
            {[
              { label: "فواتير الشفت",           val: shiftSales.length },
              { label: "متوسط الأصناف/فاتورة",   val: avgItemsPerInvoice },
              { label: "عملاء مسجلين",            val: shiftSales.filter((s) => s.customer_id).length + " / " + shiftSales.length },
              { label: "مبيعات الشفت",            val: S(shiftSales.reduce((a, s) => a + s.total, 0).toFixed(0) + " ر.س") },
              { label: "مرتجع الشفت",             val: S(shiftReturnsTotal.toFixed(0) + " ر.س"), color: VAR.danger },
            ].map((stat, i) => (
              <div key={i} style={{ background: VAR.surface, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: VAR.muted }}>{stat.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: stat.color || VAR.text, marginTop: 2 }}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* خزنة اليوم */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, color: VAR.muted, fontWeight: 600, marginBottom: 12 }}>خزنة اليوم</div>
          {[
            { label: "مبيعات كاش",    val: todayCashOnlySales.toFixed(0), type: "in" },
            { label: "شبكة / صراف",   val: todayNetworkSales.toFixed(0),  type: "in" },
            { label: "سداد الآجل",    val: todayCreditPaid.toFixed(0),    type: "in" },
            { label: "مصاريف نثرية",  val: todayPettyExpenses.toFixed(0), type: "out" },
            { label: "مرتجعات",       val: todayReturnsForDash.toFixed(0), type: "out" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${VAR.border}`, fontSize: 12 }}>
              <span style={{ color: VAR.muted }}>{row.label}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: row.type === "in" ? VAR.accent : VAR.danger }}>
                {row.type === "in" ? "+" : "-"} {S(row.val)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", fontSize: 13, marginTop: 4, borderTop: `1px solid ${VAR.accent}` }}>
            <span style={{ color: VAR.text, fontWeight: 700 }}>صافي اليوم</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: VAR.text, fontSize: 16 }}>
              + {S((todayRev + todayCreditPaid - todayReturnsForDash - todayPettyExpenses).toFixed(0))}
            </span>
          </div>
        </div>

        {/* إجراءات سريعة */}
        <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: VAR.muted, marginBottom: 2 }}>إجراءات سريعة</div>
          {[
            { icon: "💊", label: "فاتورة بيع جديدة",  tab: "pos",       bg: "rgba(0,200,150,0.15)" },
            { icon: "📦", label: "استلام مشتريات",     tab: "purchase",  bg: "rgba(59,130,246,0.15)" },
            { icon: "🔄", label: "تسجيل مرتجع",        tab: "returns",   bg: "rgba(245,158,11,0.15)" },
            { icon: "🔒", label: "تقفيل الشفت",         tab: "shift",     bg: "rgba(239,68,68,0.15)" },
          ].map((btn) => (
            <button
              key={btn.tab}
              onClick={() => setTab(btn.tab)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: VAR.surface2, border: `1px solid ${VAR.border}`,
                cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                color: VAR.text, fontWeight: 600, transition: "border-color 0.15s",
                textAlign: "right",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = VAR.accent}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = VAR.border}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: btn.bg }}>
                {btn.icon}
              </div>
              {btn.label}
            </button>
          ))}
        </div>
       </div>
    </div>
  );
}

//   ==================== FIFO Helper ====================
