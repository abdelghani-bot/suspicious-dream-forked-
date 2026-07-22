import { toString } from "../function toString() { [native code] }/undefined";

// ========== توقع نفاد المخزون (مشتركة بين قسم الأصناف وقسم الموردين) ==========
// بتحسب معدل البيع اليومي الفعلي خلال آخر windowDays يوم، وتتوقع كام يوم متبقي قبل ما الصنف ينفد.
// بترجع null لو مفيش حركة بيع كفاية عشان نتوقع بثقة.
export function computeStockoutForecast(sales, productId, currentStock, windowDays = 30) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  let totalQtySold = 0;
  (sales || []).forEach((s) => {
    const saleDate = new Date(s.date);
    if (saleDate < windowStart || s.returned) return;
    (s.items || []).forEach((i) => {
      if (i.id === productId && !i.isMissed && !i.isJoker) totalQtySold += +i.qty || 0;
    });
  });
  const avgDailyQty = totalQtySold / windowDays;
  if (avgDailyQty <= 0) return null;
  const daysLeft = currentStock / avgDailyQty;
  return { avgDailyQty, daysLeft: Math.floor(daysLeft) };
}



//   ==================== FIFO Helper ====================
// preferredExpiry: لو الكاشير حدد تاريخ صلاحية معين للسطر (يدوي أو من باركود GS1)،
// بنخصم من التشغيلة اللي تاريخها مطابق أولاً، بدل ما نجبره على أقرب تاريخ صلاحية دايمًا.
export function sellFromBatches(product, qtyToSell, preferredExpiry, preferredBatch) {
  let batches = product.batches?.length
    ? [...product.batches]
    : product.stock > 0
    ? [
        {
          qty: product.stock,
          cost: product.cost,
          salePrice: product.price,
          date: "قديم",
        },
      ]
    : [];

  if (preferredExpiry || preferredBatch) {
    // تشغيلات المخزون متسجلة بدقة الشهر/السنة بس (زي "2030-05")، فبنقارن بنفس الدقة
    // عشان تاريخ يوم دقيق (من باركود مثلاً) يتطابق صح مع التشغيلة المسجلة.
    const norm = (v) => (v ? String(v).slice(0, 7) : "");
    const target = norm(preferredExpiry);
    // ✅ لو معانا رقم تشغيلة (BN) من الباركود المقروء، نطابق بيه مع تاريخ الصلاحية مع بعض
    // أولاً (أدق تطابق)، وبعدين نرجع للتطابق بالتاريخ بس كخطة بديلة، وبعدين FIFO عادي.
    const exact = [];
    const expiryOnly = [];
    const rest = [];
    batches.forEach((b) => {
      const bExp = norm(b.expiry_date || b.expiry || b.date);
      const bBatch = (b.batch_number || "").toString().trim();
      const expMatch = target && bExp === target;
      const batchMatch = preferredBatch && bBatch && bBatch === String(preferredBatch).trim();
      if (expMatch && (!preferredBatch || batchMatch)) exact.push(b);
      else if (expMatch) expiryOnly.push(b);
      else rest.push(b);
    });
    if (exact.length) batches = [...exact, ...expiryOnly, ...rest];
    else if (expiryOnly.length) batches = [...expiryOnly, ...rest];
  }

  let remaining = qtyToSell;
  const soldBatches = [];

  for (let i = 0; i < batches.length && remaining > 0; i++) {
    if (batches[i].qty <= 0) continue;
    const take = Math.min(batches[i].qty, remaining);
    soldBatches.push({ ...batches[i], qtySold: take });
    batches[i] = { ...batches[i], qty: batches[i].qty - take };
    remaining -= take;
  }

  const updatedBatches = batches.filter((b) => b.qty > 0);
  const salePrice = soldBatches[0]?.salePrice ?? product.price;

  return { updatedBatches, salePrice, soldBatches };
}
