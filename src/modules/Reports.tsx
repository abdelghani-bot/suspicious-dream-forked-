import { useState, useEffect } from "react";
import { COLORS, tint } from "../theme";
import * as XLSX from "xlsx";
import { TAX_RATE } from "../data/seedData";
import { todayLocal } from "../lib/dateUtils";
import { PrintReceipt } from "./PrintReceipt";
import { Badge, Btn, Input, Modal, Pagination, Select, StatCard, Table } from "../ui/primitives";

// ==================== REPORTS ====================
export function Reports({ sales, purchases, products, suppliers, customers, returns = [], manufacturers = [], pharmacyId, treasuryEntries = [], creditPayments = [] }) {
  const [type, setType] = useState("sales");
  // 🆕 افتراضي "من" = أول الشهر الحالي بدل فاضي — كان بيخلي التقرير (لو المستخدم مسحتش "من")
  // يعرض كل فواتير الصيدلية من أول يوم فتحت فيه الحساب، وده بطيء وغير مفيد في أغلب الاستخدام.
  // خيار "كل الفترة" تحت بيمسح "من" (فاضي) لمن يحتاج فعلاً يشوف كل التاريخ — نفس المعنى اللي
  // كل أكواد الفلترة تحت أصلاً بتفهمه (fromDate فاضي = مفيش حد أدنى للتاريخ).
  const firstDayOfCurrentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const [fromDate, setFromDate] = useState(firstDayOfCurrentMonth);
  const [toDate, setToDate] = useState(todayLocal());
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [search, setSearch] = useState("");
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(null);
  const [showPrint, setShowPrint] = useState(null);
  const [selectedPaymentGroup, setSelectedPaymentGroup] = useState(null); // 🆕 فلتر تفاعلي لجدول تقرير السداد والمصروفات

  // 🆕 Pagination — بدل ما كل جداول التقارير تعرض كل الصفوف دفعة واحدة (بطيء لو الفترة كبيرة أو الصيدلية شغالة بـ"كل الفترة")،
  // بنعرض صفحة واحدة بس في كل مرة. صفحة واحدة مشتركة لكل أنواع التقارير (يكفي لأن نوع واحد بس ظاهر في كل لحظة)،
  // وبنصفّرها على 1 كل ما أي فلتر يتغيّر عشان المستخدم ميلاقيش نفسه واقف في صفحة فاضية بعد تضييق النتايج.
  const REPORT_PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [type, fromDate, toDate, filterSupplier, filterProduct, filterManufacturer, search, selectedPaymentGroup]);

  // helper: منتجات الشركة المنتجة المختارة
  const mfrProductIds = filterManufacturer
    ? new Set(products.filter((p) => p.manufacturer_id === filterManufacturer).map((p) => p.id))
    : null;

  const filteredSales = sales.filter((s) => {
    const d = s.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterProduct && !s.items.some((i) => i.id === filterProduct)) ok = false;
    if (mfrProductIds && !s.items.some((i) => mfrProductIds.has(i.id))) ok = false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inId = (s.id || "").toLowerCase().includes(q);
      const inCustomer = (s.customer_name || "").toLowerCase().includes(q);
      const inItems = (s.items || []).some((i) => (i.name || "").toLowerCase().includes(q));
      if (!inId && !inCustomer && !inItems) ok = false;
    }
    return ok;
  });

  const filteredPurchases = purchases.filter((p) => {
    const d = p.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterSupplier && p.supplier !== filterSupplier) ok = false;
    if (mfrProductIds && !(p.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inId = (p.id || "").toLowerCase().includes(q);
      const inSupplier = (p.supplierName || "").toLowerCase().includes(q);
      const inItems = (p.items || []).some((i) => (i.name || "").toLowerCase().includes(q));
      if (!inId && !inSupplier && !inItems) ok = false;
    }
    return ok;
  });

  const filteredReturns = (returns || []).filter((r) => {
    const d = r.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (mfrProductIds && !(r.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inId = (r.id || "").toLowerCase().includes(q);
      const inParty = ((r.customer_name || "") + (r.supplier_name || "")).toLowerCase().includes(q);
      const inReason = (r.reason || "").toLowerCase().includes(q);
      const inItems = (r.items || []).some((i) => (i.name || "").toLowerCase().includes(q));
      if (!inId && !inParty && !inReason && !inItems) ok = false;
    }
    return ok;
  });
  // 🆕 مرتجعات المبيعات (كامل + جزئي) — بنحسبها الأول عشان نخصمها من كل أرقام المبيعات تحت.
  // ⚠️ التصحيح المهم: بنخصم كل مرتجع في "شهره/فترته هو نفسه" (تاريخ المرتجع)، مش في شهر الفاتورة الأصلية.
  // ده نفس أسلوب "تقرير ضريبي" (وهو الصح فعليًا وفق مبدأ إقرار الـ ZATCA: المرتجع بيتسجّل في الفترة اللي
  // حصل فيها، مش بيترحّل لفترة الفاتورة الأصلية). المحاولة السابقة كانت بتتبّع كل مرتجع لفاتورته الأصلية
  // وتخصمه من شهرها هي، فكانت بتختلف عن "تقرير ضريبي" لو المرتجع حصل في شهر تاني عن شهر البيع.
  const returnsSales = filteredReturns.filter((r) => r.type === "sales");
  const returnsPurchases = filteredReturns.filter((r) => r.type === "purchases");
  const totalReturnsSales = returnsSales.reduce((a, r) => a + (r.total || 0), 0);
  const returnsSalesTax = returnsSales.reduce((a, r) => a + (r.tax || 0), 0);
  // 🆕 خصم مزدوج: فاتورة مرتجعة بالكامل (s.returned) أصلًا مستبعدة من filteredSales فمساهمتها صفر —
  // لو خصمنا قيمة مرتجعها تاني هنا (زي totalReturnsSales اللي فوق) هيبقى خصم مزدوج لنفس الفاتورة.
  // فبنستخدم نسخة "للخصم فقط" بتستبعد مرتجعات الفواتير المرتجعة بالكامل، وتفضل بس المرتجع الجزئي
  // (اللي فعلًا لازم يتخصم لأن فاتورته الأصلية لسه محسوبة كاملة). totalReturnsSales/returnsSalesTax
  // الأصليين فضلوا زي ما هم لعرض "إجمالي المرتجعات" الحقيقي في تبويب مرتجع المبيعات.
  const fullyReturnedSaleIds = new Set(sales.filter((s) => s.returned).map((s) => s.id));
  const returnsSalesForNetting = returnsSales.filter((r) => !(r.invoice_id && fullyReturnedSaleIds.has(r.invoice_id)));
  const totalReturnsSalesForNetting = returnsSalesForNetting.reduce((a, r) => a + (r.total || 0), 0);
  const returnsSalesTaxForNetting = returnsSalesForNetting.reduce((a, r) => a + (r.tax || 0), 0);

  // احصائيات شهرية — إجمالي كل شهر (فواتير غير مرتجعة بالكامل) ناقص مرتجعات نفس الشهر (بتاريخ المرتجع نفسه)
  const salesByMonth = {};
  const monthBucket = (m) => (salesByMonth[m] || (salesByMonth[m] = { count: 0, subtotal: 0, tax: 0, total: 0 }));
  filteredSales.filter((s) => !s.returned).forEach((s) => {
    const m = (s.date || s.created_at || "").substring(0, 7);
    if (!m) return;
    const b = monthBucket(m);
    b.count++;
    b.subtotal += s.subtotal || 0;
    b.tax += s.taxAmount ?? s.tax_amount ?? 0;
    b.total += s.total || 0;
  });
  returnsSalesForNetting.forEach((r) => {
    const m = (r.date || "").substring(0, 7);
    if (!m) return;
    const b = monthBucket(m);
    b.subtotal -= Math.max(0, (r.total || 0) - (r.tax || 0));
    b.tax -= r.tax || 0;
    b.total -= r.total || 0;
  });

  // تقرير الأصناف — مع فلتر الشركة — إجمالي كمية/إيراد الصنف ناقص أي كمية اترجعت من نفس الصنف في نفس الفترة
  const productSales = {};
  filteredSales.filter((s) => !s.returned).forEach((s) =>
    s.items.forEach((i) => {
      if (mfrProductIds && !mfrProductIds.has(i.id)) return;
      if (!productSales[i.id]) productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
      productSales[i.id].qty += i.qty;
      productSales[i.id].revenue += i.price * i.qty;
      productSales[i.id].tax += i.taxable ? i.price * i.qty * TAX_RATE : 0;
    })
  );
  returnsSalesForNetting.forEach((r) =>
    (r.items || []).forEach((i) => {
      if (mfrProductIds && !mfrProductIds.has(i.id)) return;
      if (!productSales[i.id]) productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
      productSales[i.id].qty -= i.qty || 0;
      productSales[i.id].revenue -= (i.price || 0) * (i.qty || 0);
      productSales[i.id].tax -= i.taxable ? (i.price || 0) * (i.qty || 0) * TAX_RATE : 0;
    })
  );

  // 🆕 صافي المبيعات (شامل الضريبة) بعد خصم مرتجعات نفس الفترة — نفس أسلوب "تقرير ضريبي" بالظبط
  const totalSalesRev = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + (s.total || 0), 0) - totalReturnsSalesForNetting;
  const totalSalesTax = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + (s.taxAmount || s.tax_amount || 0), 0) - returnsSalesTaxForNetting;
  // 🆕 عدد المرتجعات (returnedCount) اتنقل تحت بعد تعريف returnsSales — راجع الشرح هناك
  const totalPurchase = filteredPurchases.reduce((a, p) => a + p.total, 0);
  const totalPurchaseTax = filteredPurchases.reduce((a, p) => a + p.taxAmount, 0);

  const returnedCount = returnsSales.length; // 🆕 نفس مصدر تبويب "تقرير مرتجع المبيعات" (كامل + جزئي)
  const totalReturnsPurchases = returnsPurchases.reduce((a, r) => a + (r.total || 0), 0);
  const returnsPurchasesTax = returnsPurchases.reduce((a, r) => a + (r.tax || 0), 0);
  const isAutoReturn = (r) => (r.reason || "").includes("تلقائي");

  // فلتر الشركة يظهر في: product, purchase, مرتجع المبيعات، مرتجع المشتريات
  const showMfrFilter = ["product", "purchase", "sales_returns", "purchase_returns"].includes(type);

  // ═══════════════════════════════════════════════════════════════
  // 🆕 تقرير السداد والمصروفات — عشان أحمد يعرف صرف إيه في الفترة
  // ويقدر يطابقه مع "دخل" تقرير المبيعات لمعرفة صافي أثر الفترة على الخزنة.
  // بيستبعد عمدًا أي رصيد مُضاف من خارج الدورة (تمويل/رصيد أول مدة) لأنه مش دخل تشغيلي.
  // ═══════════════════════════════════════════════════════════════
  const inDateRange = (d) => {
    if (!d) return false;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  // كل قيود "المصروفات/السداد" الفعلية من سجل الخزنة في الفترة — مرتجعات المبيعات (sales_return)
  // مستبعدة هنا عمدًا لأنها متخصومة أصلًا جوه "الداخل الفعلي" تحت، وتضمينها هنا كان هيعمل خصم مزدوج.
  const paymentEntries = (treasuryEntries || []).filter(
    (e) => e && e.type === "expense" && e.sub_type !== "sales_return" && inDateRange(e.date)
  );

  const PAYMENT_GROUPS = [
    { key: "suppliers", label: "سداد الموردين", icon: "purchase", color: COLORS.coral, subs: ["supplier_payment"] },
    { key: "salaries", label: "الرواتب والمستحقات", icon: "customers", color: COLORS.blue, subs: ["salary", "leave_cashout", "end_of_service"] },
    { key: "daily", label: "مصروفات يومية / نثريات", icon: "money", color: COLORS.gold, subs: ["petty", "variable"] },
    { key: "fixed", label: "مصاريف ثابتة وتراخيص", icon: "settings", color: COLORS.purple, subs: ["fixed", "license"] },
    { key: "other", label: "أخرى (تسويات / نقاط ولاء)", icon: "reports", color: COLORS.textDim, subs: ["adjustment", "closing_adjustment", "loyalty_redeem", "other"] },
  ];
  const paymentGroupTotals = PAYMENT_GROUPS.map((g) => {
    const groupEntries = paymentEntries.filter((e) => g.subs.includes(e.sub_type));
    return { ...g, total: groupEntries.reduce((a, e) => a + (e.amount || 0), 0), entries: groupEntries };
  });
  const totalPayments = paymentGroupTotals.reduce((a, g) => a + g.total, 0);

  // 🆕 الدخل الفعلي للخزنة للفترة (مش المبيعات المحاسبية اللي فيها آجل) — مقسّم حسب الطريقة عشان
  // يتقارن بكل درج/محفظة لوحده: مبيعات نقدي/بطاقة/تحويل (مش آجل) ناقص مرتجعاتها + دخل إضافي مُسجّل
  // يدويًا عند التقفيل (نثريات/فلوس زيادة اتلاقت في الدرج). تحصيلات الآجل بتتحسب "نقدي" دايمًا،
  // نفس الافتراض المستخدم في حساب رصيد الخزنة بتاب "الخزنة".
  const cashSalesInRange = (sales || []).filter((s) => inDateRange(s.date) && !s.returned && s.payment !== "آجل");
  const cashReturnsInRange = (returns || []).filter(
    (r) => r.type === "sales" && inDateRange(r.date) && r.refund_method &&
      !(r.invoice_id && fullyReturnedSaleIds.has(r.invoice_id))
  );
  const otherIncomeInRange = (treasuryEntries || []).filter(
    (e) => e && e.type === "income" && e.sub_type === "other" && inDateRange(e.date)
  );
  const METHODS = ["نقدي", "بطاقة", "تحويل"];
  const methodBreakdown = METHODS.map((m) => {
    const salesTotal = cashSalesInRange.filter((s) => s.payment === m).reduce((a, s) => a + (s.total || 0), 0);
    const returnsTotal = cashReturnsInRange.filter((r) => r.refund_method === m).reduce((a, r) => a + (r.total || 0), 0);
    const otherTotal = otherIncomeInRange.filter((e) => (e.method || "نقدي") === m).reduce((a, e) => a + (e.amount || 0), 0);
    const creditTotal = m === "نقدي" ? (creditPayments || []).filter((p) => inDateRange(p.date)).reduce((a, p) => a + (p.amount || 0), 0) : 0;
    const paidTotal = paymentEntries.filter((e) => (e.method || "نقدي") === m).reduce((a, e) => a + (e.amount || 0), 0);
    return { method: m, income: salesTotal - returnsTotal + otherTotal + creditTotal, paid: paidTotal };
  });
  const cashSalesTotal = cashSalesInRange.reduce((a, s) => a + (s.total || 0), 0);
  const cashReturnsTotal = cashReturnsInRange.reduce((a, r) => a + (r.total || 0), 0);
  const creditCollectedInRange = (creditPayments || []).filter((p) => inDateRange(p.date)).reduce((a, p) => a + (p.amount || 0), 0);
  const otherIncomeTotal = otherIncomeInRange.reduce((a, e) => a + (e.amount || 0), 0);
  const cashBasisIncome = cashSalesTotal - cashReturnsTotal + creditCollectedInRange + otherIncomeTotal;

  // 🆕 أي رصيد اتضاف للخزنة من "خارج الدورة" (تمويل / رصيد أول مدة) — بيتعرض للعلم بس ومش
  // بيدخل في حساب الدخل ولا في صافي الفرق المتوقع تحت.
  const externalFundingInRange = (treasuryEntries || []).filter(
    (e) => e && e.type === "income" && e.sub_type === "opening_balance" && inDateRange(e.date)
  );
  const totalExternalFunding = externalFundingInRange.reduce((a, e) => a + (e.amount || 0), 0);

  const expectedNetChange = cashBasisIncome - totalPayments;

  // 🔍 مطابقة مع سجل تقفيل الخزنة: نفس الفكرة محسوبة من قيود treasury_entries المسجّلة فعليًا
  // (daily_sales + other + closing_adjustment كدخل، ومصروفات + مرتجعات كخروج) بدل الجداول الخام.
  // لو الرقمين مش متطابقين، غالبًا فيه أيام في الفترة لسه ما اتقفلتش (تقفيل يومي متأخر/منسي).
  const recordedIncomeInRange = (treasuryEntries || []).filter(
    (e) => e && e.type === "income" && e.sub_type !== "opening_balance" && inDateRange(e.date)
  ).reduce((a, e) => a + (e.amount || 0), 0);
  const recordedSalesReturnExpense = (treasuryEntries || []).filter(
    (e) => e && e.type === "expense" && e.sub_type === "sales_return" && inDateRange(e.date)
  ).reduce((a, e) => a + (e.amount || 0), 0);
  const recordedNetChangeInRange = recordedIncomeInRange - totalPayments - recordedSalesReturnExpense;

  // ═══════════════════════════════════════════════════════════════
  // 🆕 السبب الجذري لتحذير "المطابقة" الزائف اليومي: "المتوقع" فوق بيتحسب فورًا من
  // فواتير/مرتجعات اليوم الخام (متاحة على طول)، أما "المسجّل" فبييجي من قيود سجل تقفيل
  // الخزنة (sub_type = "daily_sales") اللي بتتسجل بس لما الصيدلي يعمل "تقفيل اليوم" —
  // ولأن تقفيل النهارده لسه ما حصلش، بيفضل يظهر فرق/تحذير أحمر زائف كل يوم لحد ما تقفل،
  // وده كان بيخلي المستخدم يتعود يتجاهل التحذير بدل ما ياخده على محمل الجد لما يكون حقيقي.
  // ✅ الحل: بنحسب نسخة موازية "أيام مُقفّلة بس" (بتستبعد اليوم الحالي لو لسه ما اتقفلش)
  // ونستخدمها لتحديد لون/رسالة الكارت بس، من غير ما نلمس cashBasisIncome ولا تكسير طرق
  // الدفع ولا جدول السداد المعروضين تحت (لسه شاملين اليوم الحالي زي ما هما).
  // ═══════════════════════════════════════════════════════════════
  const todayStr = todayLocal();
  const isTodayClosed = (treasuryEntries || []).some((e) => e && e.date === todayStr && e.sub_type === "daily_sales");
  const todayInRange = (!fromDate || fromDate <= todayStr) && (!toDate || toDate >= todayStr);
  const excludeUnclosedToday = todayInRange && !isTodayClosed;
  const closedRangeCheck = (d) => inDateRange(d) && !(excludeUnclosedToday && d === todayStr);

  const closedCashSalesInRange = (sales || []).filter((s) => closedRangeCheck(s.date) && !s.returned && s.payment !== "آجل");
  const closedCashReturnsInRange = (returns || []).filter(
    (r) => r.type === "sales" && closedRangeCheck(r.date) && r.refund_method &&
      !(r.invoice_id && fullyReturnedSaleIds.has(r.invoice_id))
  );
  const closedOtherIncomeInRange = (treasuryEntries || []).filter(
    (e) => e && e.type === "income" && e.sub_type === "other" && closedRangeCheck(e.date)
  );
  const closedCashBasisIncome =
    closedCashSalesInRange.reduce((a, s) => a + (s.total || 0), 0)
    - closedCashReturnsInRange.reduce((a, r) => a + (r.total || 0), 0)
    + (creditPayments || []).filter((p) => closedRangeCheck(p.date)).reduce((a, p) => a + (p.amount || 0), 0)
    + closedOtherIncomeInRange.reduce((a, e) => a + (e.amount || 0), 0);
  const closedRecordedIncome = (treasuryEntries || []).filter(
    (e) => e && e.type === "income" && e.sub_type !== "opening_balance" && closedRangeCheck(e.date)
  ).reduce((a, e) => a + (e.amount || 0), 0);
  const closedRecordedSalesReturnExpense = (treasuryEntries || []).filter(
    (e) => e && e.type === "expense" && e.sub_type === "sales_return" && closedRangeCheck(e.date)
  ).reduce((a, e) => a + (e.amount || 0), 0);
  // ملحوظة: totalPayments بيتلغي رياضيًا من طرفَي الفرق (بيتخصم من المتوقع والمسجّل بنفس القيمة)،
  // فمفيش داعي نستبعد اليوم الحالي منه — استبعاده كان هيغيّر رقم "إجمالي السداد والمصروفات"
  // المعروض فوق كـ StatCard من غير أي فايدة في دقة المطابقة.
  const closedExpectedNetChange = closedCashBasisIncome - totalPayments;
  const closedRecordedNetChange = closedRecordedIncome - totalPayments - closedRecordedSalesReturnExpense;
  const closedReconciliationVariance = closedExpectedNetChange - closedRecordedNetChange;
  const isReconciled = Math.abs(closedReconciliationVariance) < 0.01;

  // 🆕 تشخيص يوم بيوم — بدل ما نفترض "فيه يوم ما اتقفلش" من غير دليل، بنحسب لكل يوم في الفترة
  // (المُقفّل منها) الفرق بين "المتوقع من الفواتير الخام" و"المسجّل فعليًا في قيود الخزنة"،
  // ونعرض بس الأيام اللي فيها فرق فعلي — عشان أحمد يعرف بالظبط اليوم المسبب للمشكلة
  // بدل ما يدوّر في كل الفترة. سبب شائع: مبيعات/مرتجعات حصلت بعد "تقفيل اليوم" ولسه
  // ما اتضافتش كـ"تسوية" (closing_adjustment) — دلوقتي زرار التسوية شغال بس على النهارده.
  const dailyReconDates = new Set();
  (sales || []).forEach((s) => { if (s && closedRangeCheck(s.date)) dailyReconDates.add(s.date); });
  (returns || []).forEach((r) => { if (r && r.type === "sales" && closedRangeCheck(r.date)) dailyReconDates.add(r.date); });
  (treasuryEntries || []).forEach((e) => { if (e && closedRangeCheck(e.date)) dailyReconDates.add(e.date); });
  (creditPayments || []).forEach((p) => { if (p && closedRangeCheck(p.date)) dailyReconDates.add(p.date); });
  const dailyReconciliation = Array.from(dailyReconDates).sort().map((d) => {
    const expected =
      (sales || []).filter((s) => s.date === d && !s.returned && s.payment !== "آجل").reduce((a, s) => a + (s.total || 0), 0)
      - (returns || []).filter((r) => r.type === "sales" && r.date === d && r.refund_method && !(r.invoice_id && fullyReturnedSaleIds.has(r.invoice_id))).reduce((a, r) => a + (r.total || 0), 0)
      + (creditPayments || []).filter((p) => p.date === d).reduce((a, p) => a + (p.amount || 0), 0)
      + (treasuryEntries || []).filter((e) => e && e.type === "income" && e.sub_type === "other" && e.date === d).reduce((a, e) => a + (e.amount || 0), 0);
    const recorded =
      (treasuryEntries || []).filter((e) => e && e.type === "income" && e.sub_type !== "opening_balance" && e.date === d).reduce((a, e) => a + (e.amount || 0), 0)
      - (treasuryEntries || []).filter((e) => e && e.type === "expense" && e.sub_type === "sales_return" && e.date === d).reduce((a, e) => a + (e.amount || 0), 0);
    const wasClosed = (treasuryEntries || []).some((e) => e && e.date === d && e.sub_type === "daily_closing");
    return { date: d, expected, recorded, diff: expected - recorded, wasClosed };
  }).filter((r) => Math.abs(r.diff) > 0.01);

  // ═══════════════════════════════════════════════════════════════
  // 🆕 تصدير Excel — بيصدّر نفس بيانات التبويب المفتوح حاليًا وبنفس الفلاتر
  // المطبّقة (من/إلى/مورد/صنف/شركة/بحث)، عشان اللي بيتصدّر يطابق اللي المستخدم شايفه بالظبط.
  // بنبني الصفوف كقيم نصية/رقمية خام (مش JSX زي الجدول المعروض) عشان xlsx يقدر يكتبها.
  // ═══════════════════════════════════════════════════════════════
  const exportReportToExcel = () => {
    let headers = [];
    let rows = [];
    let sheetName = "تقرير";
    let fileLabel = "تقرير";

    if (type === "sales") {
      headers = ["رقم الفاتورة", "التاريخ", "العميل", "المجموع", "الضريبة", "الإجمالي شامل الضريبة", "الدفع", "الحالة"];
      rows = filteredSales.map((s) => [
        s.id, s.date, s.customer_name || "زبون عادي",
        (s.subtotal || 0).toFixed(2), (s.taxAmount || s.tax_amount || 0).toFixed(2), (s.total || 0).toFixed(2),
        s.payment, s.returned ? "مرتجعة" : "مكتملة",
      ]);
      sheetName = "تقرير المبيعات"; fileLabel = "تقرير_المبيعات";
    } else if (type === "purchase") {
      headers = ["رقم الأمر", "التاريخ", "المورد", "المجموع", "الضريبة", "الإجمالي", "الحالة"];
      rows = filteredPurchases.map((p) => [
        p.id, p.date, p.supplierName, (p.subtotal || 0).toFixed(2), (p.taxAmount || 0).toFixed(2), (p.total || 0).toFixed(2), p.status,
      ]);
      sheetName = "تقرير المشتريات"; fileLabel = "تقرير_المشتريات";
    } else if (type === "product") {
      headers = ["الصنف", "الشركة المنتجة", "الكمية المباعة", "الإيراد قبل الضريبة", "الضريبة", "الإيراد الكلي"];
      rows = Object.entries(productSales)
        .filter(([, d]) => !search.trim() || (d.name || "").toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => b[1].revenue - a[1].revenue).map(([id, d]) => {
        const prod = products.find((p) => p.id === id);
        const mfr = manufacturers.find((m) => m.id === prod?.manufacturer_id);
        return [d.name, mfr ? mfr.name : "—", d.qty, d.revenue.toFixed(2), d.tax.toFixed(2), (d.revenue + d.tax).toFixed(2)];
      });
      sheetName = "تقرير الأصناف"; fileLabel = "تقرير_الأصناف";
    } else if (type === "monthly") {
      headers = ["الشهر", "عدد الفواتير", "المبيعات قبل الضريبة", "ضريبة المبيعات", "المبيعات الكلية"];
      rows = Object.entries(salesByMonth)
        .filter(([m]) => !search.trim() || m.includes(search.trim()))
        .sort().reverse().map(([m, d]) => [
        m, d.count, d.subtotal.toFixed(2), d.tax.toFixed(2), d.total.toFixed(2),
      ]);
      sheetName = "تقرير شهري"; fileLabel = "تقرير_شهري";
    } else if (type === "sales_returns") {
      headers = ["رقم المرتجع", "التاريخ", "العميل", "السبب", "الإجمالي"];
      rows = returnsSales.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => [
        r.id, r.date, r.customer_name || "زبون عادي", r.reason || "—", (r.total || 0).toFixed(2),
      ]);
      sheetName = "مرتجع المبيعات"; fileLabel = "تقرير_مرتجع_المبيعات";
    } else if (type === "purchase_returns") {
      headers = ["رقم المرتجع", "التاريخ", "المورد", "السبب", "الإجمالي"];
      rows = returnsPurchases.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => [
        r.id, r.date, r.supplier_name || "—", r.reason || "—", (r.total || 0).toFixed(2),
      ]);
      sheetName = "مرتجع المشتريات"; fileLabel = "تقرير_مرتجع_المشتريات";
    } else if (type === "payments") {
      headers = ["التاريخ", "الفئة", "التفاصيل", "الطريقة", "المبلغ", "بواسطة"];
      rows = paymentEntries
        .filter((e) => {
          if (!selectedPaymentGroup) return true;
          const grp = PAYMENT_GROUPS.find((g) => g.key === selectedPaymentGroup);
          return grp ? grp.subs.includes(e.sub_type) : true;
        })
        .filter((e) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          const grp = PAYMENT_GROUPS.find((g) => g.subs.includes(e.sub_type));
          const inNote = (e.note || "").toLowerCase().includes(q);
          const inMethod = (e.method || "").toLowerCase().includes(q);
          const inCategory = (grp ? grp.label : e.sub_type || "").toLowerCase().includes(q);
          const inCreatedBy = (e.created_by || "").toLowerCase().includes(q);
          return inNote || inMethod || inCategory || inCreatedBy;
        })
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((e) => {
          const grp = PAYMENT_GROUPS.find((g) => g.subs.includes(e.sub_type));
          return [e.date, grp ? grp.label : e.sub_type, e.note || "—", e.method || "—", (e.amount || 0).toFixed(2), e.created_by || "—"];
        });
      sheetName = "السداد والمصروفات"; fileLabel = "تقرير_السداد_والمصروفات";
    }

    if (rows.length === 0) {
      alert("لا توجد بيانات للتصدير في هذه الفترة/الفلتر الحالي");
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    // 🆕 اسم الشيت في Excel ممنوع يتعدى 31 حرف وممنوع فيه رموز زي / \ ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    XLSX.writeFile(wb, `${fileLabel}_${fromDate || "الكل"}_إلى_${toDate || todayLocal()}.xlsx`);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>التقارير والإحصائيات</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        {["sales", "purchase", "product", "monthly", "sales_returns", "purchase_returns", "payments"].map((t) => (
          <button key={t} onClick={() => { setType(t); setSearch(""); }} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid",
            borderColor: type === t ? COLORS.blue : COLORS.border,
            background: type === t ? COLORS.blueSoft : "transparent",
            color: type === t ? COLORS.blue : COLORS.textDim,
            fontWeight: type === t ? 700 : 400, cursor: "pointer", fontSize: 13,
          }}>
            {t === "sales" ? "تقرير المبيعات" : t === "purchase" ? "تقرير المشتريات" : t === "product" ? "تقرير الأصناف" : t === "monthly" ? "تقرير شهري" : t === "sales_returns" ? "تقرير مرتجع المبيعات" : t === "purchase_returns" ? "تقرير مرتجع المشتريات" : "تقرير السداد والمصروفات"}
          </button>
        ))}

        <div style={{ marginRight: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Input
            label="بحث"
            value={search}
            onChange={setSearch}
            placeholder={
              type === "sales" ? "رقم الفاتورة، العميل، أو اسم الصنف"
              : type === "purchase" ? "رقم الأمر أو اسم المورد"
              : type === "product" ? "اسم الصنف"
              : type === "monthly" ? "الشهر، مثال 2026-07"
              : type === "sales_returns" ? "رقم المرتجع، العميل، أو السبب"
              : type === "purchase_returns" ? "رقم المرتجع، المورد، أو السبب"
              : "التفاصيل أو بواسطة"
            }
            style={{ width: 220 }}
          />
          <Input label="من" value={fromDate} onChange={setFromDate} type="date" style={{ width: 140 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.textDim, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={!fromDate} onChange={(e) => setFromDate(e.target.checked ? "" : firstDayOfCurrentMonth())} />
            كل الفترة
          </label>
          <Input label="إلى" value={toDate} onChange={setToDate} type="date" style={{ width: 140 }} />

          {type === "purchase" && (
            <Select label="المورد" value={filterSupplier} onChange={setFilterSupplier}
              options={[{ v: "", l: "الكل" }, ...suppliers.map((s) => ({ v: s.id, l: s.name }))]}
              style={{ width: 160 }} />
          )}
          {type === "product" && (
            <Select label="الصنف" value={filterProduct} onChange={setFilterProduct}
              options={[{ v: "", l: "الكل" }, ...products.map((p) => ({ v: p.id, l: p.name }))]}
              style={{ width: 180 }} />
          )}
          {showMfrFilter && manufacturers.length > 0 && (
            <Select label="🏭 الشركة المنتجة" value={filterManufacturer} onChange={setFilterManufacturer}
              options={[{ v: "", l: "الكل" }, ...manufacturers.map((m) => ({ v: m.id, l: m.name }))]}
              style={{ width: 180 }} />
          )}
          <Btn variant="secondary" onClick={exportReportToExcel}>📊 تصدير Excel</Btn>
        </div>
      </div>

      {/* تقرير المبيعات */}
      {type === "sales" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المبيعات (شامل الضريبة)" value={totalSalesRev.toFixed(2) + " ر.س"} icon="money" color={COLORS.blue} />
            <StatCard label="ضريبة المبيعات" value={totalSalesTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
            <StatCard label="عدد الفواتير" value={filteredSales.filter((s) => !s.returned).length} icon="pos" color={COLORS.purple} />
            <StatCard label="المرتجعات" value={returnedCount} icon="returns" color={COLORS.coral} />
          </div>
          <Table
            headers={["رقم الفاتورة", "التاريخ", "العميل", "المجموع", "الضريبة", "الإجمالي شامل الضريبة", "الدفع", "حالة"]}
            rows={filteredSales.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map((s) => [
              <span onClick={() => setShowInvoiceDetail({ ...s, customer_phone: customers.find((c) => c.id === s.customer)?.phone || null })} style={{ color: COLORS.blue, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{s.id}</span>,
              s.date,
              s.customer_name || "زبون عادي",
              (s.subtotal || 0).toFixed(2) + " ر.س",
              <span style={{ color: COLORS.green }}>{(s.taxAmount || s.tax_amount || 0).toFixed(2)} ر.س</span>,
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{(s.total || 0).toFixed(2)} ر.س</span>,
              s.payment,
              s.returned
                ? <Badge color={COLORS.redSoft} text={COLORS.red}>مرتجعة</Badge>
                : <Badge color={COLORS.greenSoft} text={COLORS.green}>مكتملة</Badge>,
            ])}
          />
          <Pagination page={page} onPageChange={setPage} totalItems={filteredSales.length} pageSize={REPORT_PAGE_SIZE} />
          {filteredSales.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد فواتير مطابقة للبحث</div>}
        </>
      )}

      {/* تقرير المشتريات */}
      {type === "purchase" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المشتريات (شامل الضريبة)" value={totalPurchase.toFixed(2) + " ر.س"} icon="purchase" color={COLORS.coral} />
            <StatCard label="ضريبة المشتريات" value={totalPurchaseTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
            <StatCard label="عدد أوامر الشراء" value={filteredPurchases.length} icon="suppliers" color={COLORS.purple} />
          </div>
          <Table
            headers={["رقم الأمر", "التاريخ", "المورد", "المجموع", "الضريبة", "الإجمالي", "الحالة"]}
            rows={filteredPurchases.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map((p) => [
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{p.id}</span>,
              p.date, p.supplierName,
              p.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: COLORS.green }}>{p.taxAmount.toFixed(2)} ر.س</span>,
              <span style={{ color: COLORS.coral, fontWeight: 700 }}>{p.total.toFixed(2)} ر.س</span>,
              <Badge color={COLORS.greenSoft} text={COLORS.green}>{p.status}</Badge>,
            ])}
          />
          <Pagination page={page} onPageChange={setPage} totalItems={filteredPurchases.length} pageSize={REPORT_PAGE_SIZE} />
        </>
      )}

      {/* تقرير الأصناف */}
      {type === "product" && (
        <>
          {filterManufacturer && (
            <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: COLORS.blue }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          {(() => {
            const productRows = Object.entries(productSales)
              .filter(([, d]) => !search.trim() || (d.name || "").toLowerCase().includes(search.trim().toLowerCase()))
              .sort((a, b) => b[1].revenue - a[1].revenue);
            return (
              <>
                <Table
                  headers={["الصنف", "الشركة المنتجة", "الكمية المباعة", "الإيراد قبل الضريبة", "الضريبة", "الإيراد الكلي"]}
                  rows={productRows.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map(([id, d]) => {
                    const prod = products.find((p) => p.id === id);
                    const mfr = manufacturers.find((m) => m.id === prod?.manufacturer_id);
                    return [
                      <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{d.name}</span>,
                      mfr ? <Badge color={COLORS.blueSoft} text={COLORS.blue}>{mfr.name}</Badge> : <span style={{ color: COLORS.border, fontSize: 11 }}>—</span>,
                      <span style={{ color: COLORS.blue, fontWeight: 700 }}>{d.qty}</span>,
                      d.revenue.toFixed(2) + " ر.س",
                      <span style={{ color: COLORS.green }}>{d.tax.toFixed(2)} ر.س</span>,
                      <span style={{ color: COLORS.green, fontWeight: 700 }}>{(d.revenue + d.tax).toFixed(2)} ر.س</span>,
                    ];
                  })}
                />
                <Pagination page={page} onPageChange={setPage} totalItems={productRows.length} pageSize={REPORT_PAGE_SIZE} />
              </>
            );
          })()}
        </>
      )}

      {/* تقرير شهري */}
      {type === "monthly" && (() => {
        const monthRows = Object.entries(salesByMonth)
          .filter(([m]) => !search.trim() || m.includes(search.trim()))
          .sort().reverse();
        return (
          <>
            <Table
              headers={["الشهر", "عدد الفواتير", "المبيعات قبل الضريبة", "ضريبة المبيعات", "المبيعات الكلية"]}
              rows={monthRows.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map(([m, d]) => [
                <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{m}</span>,
                d.count,
                d.subtotal.toFixed(2) + " ر.س",
                <span style={{ color: COLORS.green }}>{d.tax.toFixed(2)} ر.س</span>,
                <span style={{ color: COLORS.blue, fontWeight: 700 }}>{d.total.toFixed(2)} ر.س</span>,
              ])}
            />
            <Pagination page={page} onPageChange={setPage} totalItems={monthRows.length} pageSize={REPORT_PAGE_SIZE} />
          </>
        );
      })()}

      {/* تقرير مرتجع المبيعات */}
      {type === "sales_returns" && (
        <>
          {filterManufacturer && (
            <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: COLORS.blue }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="عدد مرتجعات المبيعات" value={returnsSales.length} icon="returns" color={COLORS.coral} />
            <StatCard label="إجمالي مرتجعات المبيعات" value={totalReturnsSales.toFixed(2) + " ر.س"} icon="pos" color={COLORS.blue} />
            <StatCard label="الضريبة المستردة" value={returnsSalesTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
          </div>
          <Table
            headers={["رقم المرتجع", "التاريخ", "العميل", "السبب", "الإجمالي"]}
            rows={returnsSales.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map((r) => [
              <span
                onClick={() => setShowInvoiceDetail({
                  id: r.id,
                  date: r.date,
                  partyLabel: "العميل",
                  partyName: r.customer_name || "زبون عادي",
                  payment: sales.find((s) => s.id === r.invoice_id)?.payment || "—",
                  items: (r.items || []).map((it) => ({ name: it.name, qty: it.returnQty ?? it.qty, price: it.price })),
                  subtotal: r.subtotal,
                  taxAmount: r.tax,
                  total: r.total,
                  isReturn: true,
                  originalInvoiceId: r.invoice_id,
                  reason: r.reason,
                })}
                style={{ color: COLORS.blue, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >{r.id}</span>,
              r.date,
              r.customer_name || "زبون عادي",
              <span>{r.reason || "—"}{isAutoReturn(r) && <span style={{ marginRight: 6 }}><Badge color={COLORS.redSoft} text={COLORS.coral}>تلقائي</Badge></span>}</span>,
              <span style={{ color: COLORS.coral, fontWeight: 700 }}>{(r.total || 0).toFixed(2)} ر.س</span>,
            ])}
          />
          <Pagination page={page} onPageChange={setPage} totalItems={returnsSales.length} pageSize={REPORT_PAGE_SIZE} />
          {returnsSales.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد مرتجعات مبيعات في هذه الفترة</div>}
        </>
      )}

      {/* تقرير مرتجع المشتريات */}
      {type === "purchase_returns" && (
        <>
          {filterManufacturer && (
            <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: COLORS.blue }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="عدد مرتجعات المشتريات" value={returnsPurchases.length} icon="returns" color={COLORS.coral} />
            <StatCard label="إجمالي مرتجعات المشتريات" value={totalReturnsPurchases.toFixed(2) + " ر.س"} icon="purchase" color={COLORS.coral} />
            <StatCard label="الضريبة المستردة" value={returnsPurchasesTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
          </div>
          <Table
            headers={["رقم المرتجع", "التاريخ", "المورد", "السبب", "الإجمالي"]}
            rows={returnsPurchases.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map((r) => [
              <span
                onClick={() => setShowInvoiceDetail({
                  id: r.id,
                  date: r.date,
                  partyLabel: "المورد",
                  partyName: r.supplier_name || "—",
                  payment: "—",
                  items: (r.items || []).map((it) => ({ name: it.name, qty: it.returnQty ?? it.qty, price: it.price })),
                  subtotal: r.subtotal,
                  taxAmount: r.tax,
                  total: r.total,
                  isReturn: true,
                  originalInvoiceId: r.purchase_invoice_id,
                  reason: r.reason,
                })}
                style={{ color: COLORS.blue, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >{r.id}</span>,
              r.date,
              r.supplier_name || "—",
              <span>{r.reason || "—"}{isAutoReturn(r) && <span style={{ marginRight: 6 }}><Badge color={COLORS.redSoft} text={COLORS.coral}>تلقائي</Badge></span>}</span>,
              <span style={{ color: COLORS.coral, fontWeight: 700 }}>{(r.total || 0).toFixed(2)} ر.س</span>,
            ])}
          />
          <Pagination page={page} onPageChange={setPage} totalItems={returnsPurchases.length} pageSize={REPORT_PAGE_SIZE} />
          {returnsPurchases.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد مرتجعات مشتريات في هذه الفترة</div>}
        </>
      )}

      {/* تقرير السداد والمصروفات */}
      {type === "payments" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
            <StatCard label="💵 الداخل الفعلي للخزنة (نقدي/بطاقة/تحويل + تحصيل آجل + دخل إضافي)" value={cashBasisIncome.toFixed(2) + " ر.س"} icon="money" color={COLORS.green} />
            <StatCard label="📤 إجمالي السداد والمصروفات" value={totalPayments.toFixed(2) + " ر.س"} icon="purchase" color={COLORS.coral} />
            <StatCard label="⚖️ صافي الفرق المتوقع في الخزنة" value={expectedNetChange.toFixed(2) + " ر.س"} icon="tax" color={expectedNetChange >= 0 ? COLORS.blue : COLORS.red} />
          </div>

          <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: COLORS.blue, lineHeight: 1.9 }}>
            ⚖️ <strong>صافي الفرق المتوقع</strong> = الداخل الفعلي للخزنة − إجمالي السداد والمصروفات، وده المفروض يطابق (زيادة/نقصان) رصيد الخزنة الفعلي في نفس الفترة.
            <br />
            🚫 مرتجعات المبيعات النقدية متخصومة أصلًا ضمن "الداخل الفعلي"، فمش متضمنة تاني هنا لتفادي الخصم المزدوج.
            {totalExternalFunding > 0 && (
              <>
                <br />
                💰 تنبيه: تم تسجيل <strong>{totalExternalFunding.toFixed(2)} ر.س</strong> كـ"رصيد أول مدة / تمويل" مُضاف للخزنة من خارج الدورة التشغيلية في هذه الفترة — <strong>هذا المبلغ غير محسوب</strong> ضمن الداخل الفعلي ولا ضمن صافي الفرق أعلاه عمدًا، لأنه مش دخل تشغيلي.
              </>
            )}
          </div>

          {/* 🆕 تكسير حسب طريقة الدفع — لمطابقة كل درج/محفظة لوحده */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: COLORS.textPrimary }}>💳 تكسير حسب طريقة الدفع</h3>
            <Table
              headers={["الطريقة", "الداخل", "السداد/المصروفات", "الصافي"]}
              rows={methodBreakdown.map((m) => [
                m.method,
                <span style={{ color: COLORS.green }}>{m.income.toFixed(2)} ر.س</span>,
                <span style={{ color: COLORS.coral }}>{m.paid.toFixed(2)} ر.س</span>,
                <span style={{ fontWeight: 700, color: (m.income - m.paid) >= 0 ? COLORS.blue : COLORS.red }}>{(m.income - m.paid).toFixed(2)} ر.س</span>,
              ])}
            />
          </div>

          {/* 🆕 مطابقة مع سجل تقفيل الخزنة — بيكشف الأيام اللي ما اتقفلتش لسه في الفترة (غير النهارده) */}
          <div style={{
            background: isReconciled ? COLORS.greenSoft : COLORS.redSoft,
            border: `1px solid ${tint(isReconciled ? COLORS.green : COLORS.red, 0.35)}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: excludeUnclosedToday ? 8 : 16, fontSize: 12,
            color: isReconciled ? COLORS.green : COLORS.red, lineHeight: 1.9,
          }}>
            {isReconciled ? (
              <>✅ <strong>مطابق:</strong> نفس الرقم اتحسب من سجل تقفيل الخزنة الفعلي{excludeUnclosedToday ? " (للأيام المُقفّلة قبل النهارده)" : ""}، يعني كل أيام الفترة دي مُقفّلة وموثّقة صح.</>
            ) : (
              <>
                ⚠️ <strong>فيه فرق {closedReconciliationVariance.toFixed(2)} ر.س</strong> بين "الصافي المحسوب من فواتير/مرتجعات الفترة" وبين "الصافي المسجّل فعليًا في سجل تقفيل الخزنة" لنفس الفترة{excludeUnclosedToday ? " (بعد استبعاد النهارده اللي لسه ما اتقفلش)" : ""}.
                <br />
                السبب الأرجح: فيه يوم أو أكتر في الفترة دي لسه ما اتقفلش (تقفيل الخزنة اليومي)، فقيود الدخل الخاصة بيه لسه ماتسجلتش. راجع أيام التقفيل الناقصة في تبويب "الخزنة".
              </>
            )}
          </div>
          {excludeUnclosedToday && (
            <div style={{
              background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`,
              borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: COLORS.blue, lineHeight: 1.9,
            }}>
              ℹ️ اليوم الحالي ({todayStr}) لسه ما اتقفلش، فمستبعد مؤقتًا من كارت المطابقة فوق عشان محدش يتلبّس بتحذير غير حقيقي — هيدخل في المطابقة تلقائيًا أول ما تعمل "تقفيل اليوم".
            </div>
          )}

          {/* 🆕 تشخيص يوم بيوم — بيظهر بس لو فيه فرق فعلي، عشان يحدد اليوم بالظبط بدل التخمين */}
          {!isReconciled && dailyReconciliation.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: COLORS.textPrimary }}>
                🔎 الأيام اللي فيها فرق فعلي (بدل التخمين)
              </h3>
              <Table
                headers={["التاريخ", "متوقع من الفواتير", "مسجّل في الخزنة", "الفرق", "مُقفّل؟"]}
                rows={dailyReconciliation.map((r) => [
                  r.date,
                  r.expected.toFixed(2) + " ر.س",
                  r.recorded.toFixed(2) + " ر.س",
                  <span style={{ fontWeight: 700, color: COLORS.red }}>{r.diff.toFixed(2)} ر.س</span>,
                  r.wasClosed ? "✅ مقفول" : "❌ غير مقفول",
                ])}
              />
              <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6, lineHeight: 1.8 }}>
                لو اليوم "✅ مقفول" وبرضه فيه فرق، الاحتمال الأكبر إن فيه مبيعات/مرتجعات حصلت
                في نفس اليوم <strong>بعد</strong> ما اتعمل "تقفيل اليوم"، ولسه ما اتضافتش كـ"تسوية" — وده حاليًا
                زرار "إضافة كتسوية على تقفيل اليوم" شغال بس لليوم الحالي، مش لأي يوم سابق. ممكن كمان
                يكون فيه تعديل يدوي حصل على جدول treasury_entries من الـ Table Editor مباشرة لنفس اليوم ده.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 10 }}>
            {paymentGroupTotals.map((g) => (
              <div key={g.key} onClick={() => setSelectedPaymentGroup((p) => (p === g.key ? null : g.key))} style={{ cursor: "pointer" }}>
                <StatCard
                  label={g.label + (selectedPaymentGroup === g.key ? " ✓" : "")}
                  value={g.total.toFixed(2) + " ر.س"}
                  icon={g.icon}
                  color={g.color}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>💡 اضغط على أي فئة فوق لتصفية الجدول بيها</div>
            {selectedPaymentGroup && (
              <button onClick={() => setSelectedPaymentGroup(null)} style={{ border: "none", background: "transparent", color: COLORS.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                إلغاء التصفية (عرض الكل)
              </button>
            )}
          </div>

          {(() => {
            const paymentRows = paymentEntries
              .filter((e) => {
                if (!selectedPaymentGroup) return true;
                const grp = PAYMENT_GROUPS.find((g) => g.key === selectedPaymentGroup);
                return grp ? grp.subs.includes(e.sub_type) : true;
              })
              .filter((e) => {
                if (!search.trim()) return true;
                const q = search.trim().toLowerCase();
                const grp = PAYMENT_GROUPS.find((g) => g.subs.includes(e.sub_type));
                const inNote = (e.note || "").toLowerCase().includes(q);
                const inMethod = (e.method || "").toLowerCase().includes(q);
                const inCategory = (grp ? grp.label : e.sub_type || "").toLowerCase().includes(q);
                const inCreatedBy = (e.created_by || "").toLowerCase().includes(q);
                return inNote || inMethod || inCategory || inCreatedBy;
              })
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date));
            return (
              <>
                <Table
                  headers={["التاريخ", "الفئة", "التفاصيل", "الطريقة", "المبلغ", "بواسطة"]}
                  rows={paymentRows.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE).map((e) => {
                    const grp = PAYMENT_GROUPS.find((g) => g.subs.includes(e.sub_type));
                    return [
                      e.date,
                      <Badge color={COLORS.blueSoft} text={COLORS.blue}>{grp ? grp.label : e.sub_type}</Badge>,
                      e.note || "—",
                      e.method || "—",
                      <span style={{ color: COLORS.coral, fontWeight: 700 }}>{(e.amount || 0).toFixed(2)} ر.س</span>,
                      e.created_by || "—",
                    ];
                  })}
                />
                <Pagination page={page} onPageChange={setPage} totalItems={paymentRows.length} pageSize={REPORT_PAGE_SIZE} />
              </>
            );
          })()}
          {paymentEntries.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد مصروفات أو مدفوعات مسجّلة في هذه الفترة</div>}
        </>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {showInvoiceDetail && (
        <Modal open title={`${showInvoiceDetail.isReturn ? "تفاصيل المرتجع" : "تفاصيل الفاتورة"} — ${showInvoiceDetail.id}`} onClose={() => setShowInvoiceDetail(null)} wide>
          {showInvoiceDetail.isReturn && (
            <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: COLORS.blue }}>
              🔗 مرتبط بفاتورة رقم: {showInvoiceDetail.originalInvoiceId || "—"}
              {showInvoiceDetail.reason && <span> · السبب: {showInvoiceDetail.reason}</span>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13, color: COLORS.textDim }}>
            <span>التاريخ: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.date}</span></span>
            <span>{showInvoiceDetail.partyLabel || "العميل"}: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.partyName || showInvoiceDetail.customer_name || "زبون عادي"}</span></span>
            {showInvoiceDetail.payment && showInvoiceDetail.payment !== "—" && (
              <span>طريقة الدفع: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.payment}</span></span>
            )}
          </div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: COLORS.textDim, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showInvoiceDetail.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13, textAlign: "center" }}>{item.price}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 5 }}>
              <span>قبل الضريبة</span><span>{(showInvoiceDetail.subtotal || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, marginBottom: 5 }}>
              <span>الضريبة</span><span>{(showInvoiceDetail.taxAmount || showInvoiceDetail.tax_amount || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, fontSize: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
              <span>الإجمالي</span><span>{(showInvoiceDetail.total || 0).toFixed(2)} ر.س</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowInvoiceDetail(null)}>إغلاق</Btn>
            <Btn icon="print" onClick={() => setShowPrint(showInvoiceDetail)}>إعادة الطباعة</Btn>
          </div>
        </Modal>
      )}
      {showPrint && <PrintReceipt invoice={showPrint} onClose={() => setShowPrint(null)} pharmacyId={pharmacyId} customerPhone={showPrint.customer_phone} />}
    </div>
  );
}
