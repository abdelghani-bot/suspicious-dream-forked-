// 🆕 توزيع إجمالي فاتورة على طرق الدفع { نقدي, بطاقة, تحويل }.
// - نقدي/بطاقة/تحويل: الإجمالي كله على الطريقة.
// - مختلط: payment_split.card و payment_split.transfer، والباقي كاش.
// - آجل وأي نوع تاني: صفر (الآجل بيدخل الخزنة عن طريق creditPayments).
export function splitSaleByMethod(s) {
  const out = { "نقدي": 0, "بطاقة": 0, "تحويل": 0 };
  if (!s) return out;
  const total = s.total || 0;
  if (s.payment === "مختلط") {
    const split = s.payment_split || {};
    const card = split.card || 0;
    const transfer = split.transfer || 0;
    out["بطاقة"] = card;
    out["تحويل"] = transfer;
    out["نقدي"] = total - card - transfer;
  } else if (out[s.payment] !== undefined) {
    out[s.payment] = total;
  }
  return out;
}

// ==================== رصيد الخزنة الفعلي لطريقة دفع معينة ====================
// نفس منطق حساب "رصيد الخزنة اللحظي" المستخدم في تبويب الخزنة (TreasuryModule)، مستخرج هنا
// كدالة مشتركة عشان أي شاشة تانية فيها زر سداد (الموردين، المصاريف الثابتة، التراخيص، الرواتب)
// تقدر تتحقق قبل ما تسمح بالسداد إن رصيد الخزنة فعلاً يكفي المبلغ، بدل ما يفضل يسمح ويطلع
// الرصيد بالسالب. method لازم يكون واحدة من "نقدي"/"بطاقة"/"تحويل".
export function computeTreasuryBalance(method, { sales = [], creditPayments = [], entries = [] } = {}) {
  const safe = (entries || []).filter(Boolean);
  // 🆕 الفاتورة "مختلط" بتتوزع على طرق الدفع حسب payment_split (الـ POS مبيكتبش لها قيود خزنة)
  const salesIncome = (sales || []).reduce((a, s) => a + (splitSaleByMethod(s)[method] || 0), 0);
  // سداد آجل (كاش دايماً)
  const creditIn = method === "نقدي" ? (creditPayments || []).reduce((a, p) => a + p.amount, 0) : 0;
  const entryIn = safe.filter((e) => e.type === "income" && e.method === method && e.sub_type !== "daily_sales").reduce((a, e) => a + e.amount, 0);
  const entryOut = safe.filter((e) => e.type === "expense" && e.method === method).reduce((a, e) => a + e.amount, 0);
  return salesIncome + creditIn + entryIn - entryOut;
}

// 🆕 "بطاقة" و"تحويل" فعليًا نفس المحفظة (رصيد بنكي واحد) — بس قنوات دخول/خروج مختلفة.
// دخل البطاقة (مبيعات الشبكة) بيتسجل تحت method="بطاقة"، وخروج السداد بتحويل بنكي بيتسجل
// تحت method="تحويل"، فلو فحصنا كل واحد لوحده هيفضل رصيد "تحويل" شبه صفر دايمًا حتى لو
// فيه رصيد بنكي فعلي كافي (جاي من البطاقة). عشان كده أي فحص "هل يكفي للسداد؟" بيُجمّع
// الاتنين مع بعض، لكن كروت العرض في تبويب الخزنة بتفضل منفصلة (بطاقة/تحويل) عشان المتابعة.
export function computeAvailableForPayment(method, ctx) {
  if (method === "بطاقة" || method === "تحويل") {
    return computeTreasuryBalance("بطاقة", ctx) + computeTreasuryBalance("تحويل", ctx);
  }
  return computeTreasuryBalance(method, ctx);
}

// ==================== ملخص يوم تشغيلي واحد (مصدر واحد للخزنة والداشبورد) ====================
// 🆕 الخزنة والداشبورد كانوا بيحسبوا أرقام "اليوم" كل واحد لوحده بفلتر مختلف (recDate vs
// isTodayRecord). دلوقتي الاتنين بيستدعوا الدالة دي، فالأرقام تتطابق بالتعريف.
//
// المدخلات:
//   sales, creditPayments, entries, returns : البيانات الخام (من غير فلترة بتاريخ)
//   recDate : دالة تنسب أي سجل ليومه التشغيلي (makeRecordDateResolver(shifts))
//   day     : تاريخ اليوم التشغيلي "YYYY-MM-DD"
//
// قواعد الحساب (نفس منطق الخزنة الحالي):
//   - الفاتورة النقدية/بطاقة/تحويل المرتجعة بالكامل بتفضل في الإجمالي، والمرتجع بيتخصم مرة
//     واحدة بس من قيد sales_return (عشان مايحصلش خصم مزدوج).
//   - الآجل المرتجع بيتستبعد لأن مرتجعه مالوش حركة خزنة.
//   - الفاتورة "مختلط": جزء البطاقة (payment_split.card) والتحويل (payment_split.transfer) بيتفصلوا،
//     والباقي كاش.
export function computeDaySummary({ sales = [], creditPayments = [], entries = [], returns = [], recDate, day }) {
  const inDay = (r) => !!r && recDate(r) === day;

  const daySales = (sales || []).filter((s) => inDay(s) && (s.payment === "آجل" ? !s.returned : true));

  let cash = 0;
  let card = 0;
  let transfer = 0;
  let ajil = 0;
  for (const s of daySales) {
    if (s.payment === "آجل") {
      ajil += s.total || 0;
      continue;
    }
    const parts = splitSaleByMethod(s);
    cash += parts["نقدي"];
    card += parts["بطاقة"];
    transfer += parts["تحويل"];
  }

  const creditIncome = (creditPayments || []).filter(inDay).reduce((a, p) => a + (p.amount || 0), 0);

  const safeEntries = (entries || []).filter(Boolean);
  // المرتجع الفعلي الخارج من الخزنة (قيد مصروف sales_return) — ده المصدر اللي بيتخصم من الصافي
  const returnsEntries = safeEntries
    .filter((e) => inDay(e) && e.type === "expense" && e.sub_type === "sales_return")
    .reduce((a, e) => a + (e.amount || 0), 0);
  // مرتجعات جدول returns (refund_method=null معناها مرتجع آجل: مفيش كاش خرج)
  const returnsTable = (returns || [])
    .filter((r) => r && r.type === "sales" && recDate(r) === day && r.refund_method !== null)
    .reduce((a, r) => a + (r.total || 0), 0);

  const petty = safeEntries
    .filter((e) => inDay(e) && e.type === "expense" && e.sub_type === "petty")
    .reduce((a, e) => a + (e.amount || 0), 0);

  const grossIncome = cash + card + transfer + creditIncome;
  const net = grossIncome - returnsEntries;
  const count = daySales.filter((s) => !s.returned).length;

  return {
    cash,
    card,
    transfer,
    ajil,
    creditIncome,
    returnsEntries,
    returnsTable,
    // لو الرقمين دول اختلفوا، يبقى فيه مرتجع ناقص قيد خزنة (أو العكس) — مفيد للتشخيص
    returnsMismatch: Math.abs(returnsEntries - returnsTable) > 0.005,
    petty,
    grossIncome,
    net,
    netAfterPetty: net - petty,
    count,
  };
}
