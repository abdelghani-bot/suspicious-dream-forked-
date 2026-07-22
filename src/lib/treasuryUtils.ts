import { TreasuryModule } from "../modules/TreasuryModule";

// ==================== رصيد الخزنة الفعلي لطريقة دفع معينة ====================
// نفس منطق حساب "رصيد الخزنة اللحظي" المستخدم في تبويب الخزنة (TreasuryModule)، مستخرج هنا
// كدالة مشتركة عشان أي شاشة تانية فيها زر سداد (الموردين، المصاريف الثابتة، التراخيص، الرواتب)
// تقدر تتحقق قبل ما تسمح بالسداد إن رصيد الخزنة فعلاً يكفي المبلغ، بدل ما يفضل يسمح ويطلع
// الرصيد بالسالب. method لازم يكون واحدة من "نقدي"/"بطاقة"/"تحويل".
export function computeTreasuryBalance(method, { sales = [], creditPayments = [], entries = [] } = {}) {
  const safe = (entries || []).filter(Boolean);
  const salesIncome = (sales || []).filter((s) => s.payment === method).reduce((a, s) => a + s.total, 0);
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
