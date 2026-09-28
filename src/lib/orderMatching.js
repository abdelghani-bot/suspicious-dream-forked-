// lib/orderMatching.js
// منطق مطابقة فاتورة الشراء بطلب الشراء النشط — معزول عشان يتستخدم من PurchaseModule ويتختبر لوحده.

// مصدر واحد للحقيقة: SuppliersModule بيستورد الثابت ده من هنا (بدل ما يعرّفه محليًا)
export const ACTIVE_ORDER_STATUSES = ["مسودة", "مُرسل"]; // الحالات اللي بتعلّم الصنف "مطلوب"
export const RECEIVED_ORDER_STATUS = "تم الاستلام";

// 🆕 خصمين مركّبين -> نسبة خصم واحدة (نفس صيغة calcCostAfterDiscount بتاعة PurchaseModule،
// بس هنا بنحتاج النسبة نفسها للمقارنة مش التكلفة النهائية)
const combinedDiscountPercent = (d1, d2) => {
  const a = +d1 || 0, b = +d2 || 0;
  return Math.round((1 - (1 - a / 100) * (1 - b / 100)) * 10000) / 100;
};

// 🆕 أقل فرق خصم يستاهل تنبيه — أي حاجة أصغر من كده اعتبرها فروق تقريب عادية
const DISCOUNT_MISMATCH_THRESHOLD = 0.5; // نقطة مئوية

// مفتاح ترتيب الطلبات بالوقت: بنعتمد على الـ timestamp اللي جوه id الطلب (ORD-<ms>)
// لأنه موجود في الطلبات الجديدة (لسه محفوظة محليًا) والقديمة (جاية من الداتابيز) بنفس الشكل،
// وبعدها created_at ثم date كاحتياطي. الـ date لوحده مش كفاية لأنه يوم بس (طلبات نفس اليوم كانت بتتلخبط).
export const orderSortKey = (o) => {
  const m = /^ORD-(\d+)$/.exec(String(o?.id || ""));
  if (m) return +m[1];
  return new Date(o?.created_at || o?.date).getTime() || 0;
};

/**
 * بيدور على أقدم طلب نشط لنفس المورد (وفيه صنف واحد على الأقل من أصناف الفاتورة)،
 * ويحسب الكميات المستلمة لكل صنف، ويرجّع نسخة محدّثة من الطلب من غير ما يعدّل أي حاجة بره.
 * 🆕 لو الطلب مصدره "quote_compare" (فاز بيه المورد في مقارنة عروض)، بيقارن كمان خصم كل
 * صنف في الفاتورة الفعلية بالخصم اللي فاز بيه وقت المقارنة، ويرجّع أي فروق في discountMismatches.
 *
 * @param {Array}  orders        - كل الطلبات (من الـ state)
 * @param {string} supplierId
 * @param {Array}  invoiceItems  - أصناف الفاتورة: {id, qty, bonusQty, discount1?, discount2?}
 * @param {string} invoiceId     - id الفاتورة اللي استلمنا بيها (بيتسجل على الطلب)
 * @returns {{order: Object, updates: Object, discountMismatches: Array}|null}
 *   order              → الطلب كامل بعد التحديث (للـ setOrders)
 *   updates            → الحقول اللي اتغيرت بس (للـ ORDER_UPDATE event)
 *   discountMismatches → [{itemId, name, quotedDiscount, actualDiscount, diff}] — فاضية لو مفيش فروق أو الطلب مش من مقارنة
 *   null               → مفيش طلب نشط مناسب، والفاتورة تفضل من غير ربط عادي
 */
export function matchInvoiceToOrder(orders, supplierId, invoiceItems, invoiceId = null) {
  const receivedById = {};
  const discountById = {};
  (invoiceItems || []).forEach((i) => {
    receivedById[i.id] = (receivedById[i.id] || 0) + (+i.qty || 0) + (+i.bonusQty || 0);
    discountById[i.id] = combinedDiscountPercent(i.discount1, i.discount2);
  });

  // الطلبات بتيجي من الـ state مرتبة تنازلي (الأحدث الأول)، فلازم نرتّبها تصاعدي عشان "الأقدم"
  const orderTime = orderSortKey;

  const order = (orders || [])
    .filter((o) => o.supplier_id === supplierId && ACTIVE_ORDER_STATUSES.includes(o.status))
    // الطلب لازم يشترك مع الفاتورة في صنف واحد على الأقل (غير ملغي) — وإلا فاتورة لأصناف تانية خالص متقفلش الطلب غلط
    .filter((o) => (o.items || []).some((it) => it.status !== "ملغي" && receivedById[it.id] !== undefined))
    .sort((a, b) => orderTime(a) - orderTime(b) || String(a.id).localeCompare(String(b.id)))[0];

  if (!order) return null;

  // الكمية المستلمة بتتسجل على كل صنف للمراجعة بس — الفلاج بيختفي لأن حالة الطلب خرجت من ACTIVE_ORDER_STATUSES
  const items = (order.items || []).map((it) => {
    const received = receivedById[it.id];
    if (received === undefined) return it; // الصنف ده مكانش في الفاتورة دي
    return { ...it, received_qty: (+it.received_qty || 0) + received };
  });

  // 🆕 مقارنة الخصم بس للطلبات الجاية من مقارنة عروض موردين — طلب عادي مفيهوش خصم "متفق عليه" أصلاً
  const discountMismatches = [];
  if (order.source === "quote_compare") {
    (order.items || []).forEach((it) => {
      if (receivedById[it.id] === undefined) return; // الصنف ده مش في الفاتورة دي
      const quoted = +it.discount || 0;
      const actual = discountById[it.id] ?? 0;
      const diff = Math.round((actual - quoted) * 100) / 100;
      if (Math.abs(diff) >= DISCOUNT_MISMATCH_THRESHOLD) {
        discountMismatches.push({ itemId: it.id, name: it.name, quotedDiscount: quoted, actualDiscount: actual, diff });
      }
    });
  }

  const updates = {
    items,
    status: RECEIVED_ORDER_STATUS,
    received_at: new Date().toISOString(),
    received_via_invoice_id: invoiceId,
  };
  return { order: { ...order, ...updates }, updates, discountMismatches };
}
