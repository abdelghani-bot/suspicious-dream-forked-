export function sellFromBatches(product, qtyToSell) {
  const batches = product.batches?.length
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

  let remaining = qtyToSell;
  const soldBatches = [];

  for (let i = 0; i < batches.length && remaining > 0; i++) {
    const take = Math.min(batches[i].qty, remaining);
    soldBatches.push({ ...batches[i], qtySold: take });
    batches[i] = { ...batches[i], qty: batches[i].qty - take };
    remaining -= take;
  }

  const updatedBatches = batches.filter((b) => b.qty > 0);
  const salePrice = soldBatches[0]?.salePrice ?? product.price;

  return { updatedBatches, salePrice, soldBatches };
}
// ==================== POS ====================
const MAX_INVOICES = 8;
const CART_ROW_HEIGHT = 49; // ارتفاع تقريبي لكل صف في جدول السلة
const CART_VISIBLE_ROWS = 5; // 🔧 CHANGED: عدد الأصناف الظاهرة قبل ظهور السكرول
const CART_HEADER_HEIGHT = 34; // ارتفاع رأس الجدول (thead)
const CART_AREA_HEIGHT = CART_HEADER_HEIGHT + CART_ROW_HEIGHT * CART_VISIBLE_ROWS; // 🔧 CHANGED

const emptyInvoice = () => ({
  cart: [],
  selCustomer: null,
  payment: "نقدي",
  paymentMode: "single",
  splitPayment: { card: 0, transfer: 0 },
  discount: 0,
  discountType: "percent",
  prescriptionImg: null,
  search: "",
  success: false,
  showJoker: false,
  jokerName: "",
  jokerPrice: "",
  openedAt: Date.now(),
});

// ==================== EFFECTIVE PRICE (عروض تلقائية + يدوية) ====================
function getEffectivePrice(product, promos, discountRules, productEarliestExpiry) {
  const today = new Date().toISOString().split("T")[0];
  // 1. عروض يدوية نشطة
  const manualPromo = (promos || []).find(
    (p) =>
      p.product_id === product.id &&
      p.start_date <= today &&
      p.end_date >= today
  );
  if (manualPromo) {
    return {
      price: +(product.price * (1 - manualPromo.discount / 100)).toFixed(2),
      discountPct: manualPromo.discount,
      source: "manual",
    };
  }
  // 2. عروض تلقائية (غير دواء + صلاحية قريبة)
  const cat = product.main_category || product.category || "";
  if (cat !== "دواء") {
    const expiry = (productEarliestExpiry || {})[product.id] || product.expiry || null;
    const autoPct = calcAutoDiscount(expiry, discountRules);
    if (autoPct > 0) {
      return {
        price: +(product.price * (1 - autoPct / 100)).toFixed(2),
        discountPct: autoPct,
        source: "auto",
      };
    }
  }
  // 3. السعر الأصلي
  return { price: product.price, discountPct: 0, source: null };
}

