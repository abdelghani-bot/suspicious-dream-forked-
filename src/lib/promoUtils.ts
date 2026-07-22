import { todayLocal } from "./dateUtils";

// ==================== أنماط العروض ====================
// كل نمط عرض بيوصف نفسه: الحقول اللي محتاجها في الفورم، وهل ممكن يتفعّل تلقائيًا حسب الصلاحية
export const PROMO_TYPES = [
  {
    id: "percent",
    label: "خصم بالنسبة %",
    icon: "🏷️",
    autoCapable: true, // النمط اللي بيشتغل مع نظام الخصم التدرجي حسب الصلاحية
    fields: [{ key: "discount", label: "نسبة الخصم %", type: "number", placeholder: "10" }],
  },
  {
    id: "fixed_amount",
    label: "خصم قيمة ثابتة (ر.س)",
    icon: "💵",
    autoCapable: false,
    fields: [{ key: "fixed_amount", label: "قيمة الخصم (ر.س)", type: "number", placeholder: "5" }],
  },
  {
    id: "bogo",
    label: "اشتري وخد التاني ببلاش",
    icon: "🎁",
    autoCapable: false,
    fields: [
      { key: "buy_qty", label: "اشتري كمية", type: "number", placeholder: "1" },
      { key: "get_qty", label: "يحصل مجانًا على", type: "number", placeholder: "1" },
      { key: "get_discount_percent", label: "نسبة خصم القطعة المجانية % (100 = ببلاش)", type: "number", placeholder: "100" },
    ],
  },
  {
    id: "quantity",
    label: "خصم عند شراء كمية",
    icon: "📦",
    autoCapable: false,
    fields: [
      { key: "buy_qty", label: "اشتري كمية (حبة)", type: "number", placeholder: "3" },
      { key: "qty_discount_percent", label: "خصم % على الحبة عند الوصول لهذه الكمية", type: "number", placeholder: "10" },
    ],
  },
  {
    id: "bundle",
    label: "سعر ثابت للعبوة/الباقة",
    icon: "📦",
    autoCapable: false,
    fields: [
      { key: "bundle_qty", label: "عدد القطع في الباقة", type: "number", placeholder: "2" },
      { key: "bundle_price", label: "سعر الباقة (ر.س)", type: "number", placeholder: "30" },
    ],
  },
  {
    id: "free_gift",
    label: "هدية مجانية عند الشراء",
    icon: "🎀",
    autoCapable: false,
    fields: [
      { key: "gift_product_id", label: "الصنف الهدية", type: "product_select", placeholder: "" },
      { key: "gift_qty", label: "كمية الهدية", type: "number", placeholder: "1" },
    ],
  },
];


export const getPromoTypeConfig = (id) => PROMO_TYPES.find((t) => t.id === id) || PROMO_TYPES[0];


export const blankPromoDetails = { discount: "", fixed_amount: "", buy_qty: "", get_qty: "", get_discount_percent: 100, qty_discount_percent: "", bundle_qty: "", bundle_price: "", gift_product_id: "", gift_qty: "" };



// ═══════════════════════════════════════════════════
// 🆕 اكتشاف نمط "عرض من المورد" في اسم الصنف — بيتفعّل وقت كتابة اسم صنف جديد
// (مثلاً "Closeup 3+1" أو "بادج شامبو عرض") عشان ننبّه الصيدلي إنه يربطه بالصنف الأصلي
// بدل ما يفضل مسجّل كصنف منفصل عن العرض التلقائي في قسم العروض.
// بيرجع buyQty/getQty لو قدرنا نستخرجهم من نمط رقم+رقم، وإلا بيرجعوا null (يتملوا يدوي بعدين).
// ═══════════════════════════════════════════════════
export const SUPPLIER_OFFER_KEYWORDS = ["عرض", "offer", "special offer", "free", "مجانا", "مجاناً", "هدية", "بونص", "bonus"];


export function detectSupplierOfferPattern(name) {
  const s = String(name || "").trim();
  if (!s) return { isOffer: false, buyQty: null, getQty: null };
  const toEnDigits = (str) => str.replace(/[\u0660-\u0669]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  // نمط رقم+رقم بأي فاصل (+ أو x أو "خد"): 3+1, ٣+١, 2 + 2, "10 خد 1"
  const plusMatch = toEnDigits(s).match(/(\d{1,3})\s*\+\s*(\d{1,3})/);
  if (plusMatch) {
    return { isOffer: true, buyQty: +plusMatch[1], getQty: +plusMatch[2] };
  }
  const khodMatch = toEnDigits(s).match(/(\d{1,3})\s*(?:خد|واخد|واحصل على)\s*(\d{1,3})/);
  if (khodMatch) {
    return { isOffer: true, buyQty: +khodMatch[1], getQty: +khodMatch[2] };
  }
  const lower = s.toLowerCase();
  if (SUPPLIER_OFFER_KEYWORDS.some((k) => lower.includes(k))) {
    return { isOffer: true, buyQty: null, getQty: null };
  }
  return { isOffer: false, buyQty: null, getQty: null };
}



// وصف نصي مختصر للعرض + السعر الفعّال (بيستخدم في العرض والطباعة)
export function describePromo(promo, product) {
  const type = promo.promo_type || "percent";
  const price = product?.price || 0;
  switch (type) {
    case "fixed_amount":
      return { label: `خصم ${promo.fixed_amount} ر.س`, newUnitPrice: +Math.max(0, price - (promo.fixed_amount || 0)).toFixed(2) };
    case "bogo":
      return { label: `اشتري ${promo.buy_qty || 1} واحصل على ${promo.get_qty || 1} بخصم ${promo.get_discount_percent ?? 100}%`, newUnitPrice: price };
    case "quantity":
      return { label: `اشتري ${promo.buy_qty || 1}+ واحصل على خصم ${promo.qty_discount_percent || 0}% على كل حبة`, newUnitPrice: +(price * (1 - (promo.qty_discount_percent || 0) / 100)).toFixed(2) };
    case "bundle":
      return { label: `باقة ${promo.bundle_qty || 1} قطع بـ ${promo.bundle_price || 0} ر.س`, newUnitPrice: promo.bundle_qty ? +((promo.bundle_price || 0) / promo.bundle_qty).toFixed(2) : price };
    case "free_gift":
      return { label: `هدية مجانية: ${promo.gift_qty || 1} قطعة`, newUnitPrice: price };
    default:
      return { label: `خصم ${promo.discount || 0}%`, newUnitPrice: +(price * (1 - (promo.discount || 0) / 100)).toFixed(2) };
  }
}



// ══════════ فحص جاهزية العرض للتطبيق فعليًا حسب المخزون المتاح ══════════
// كل نمط عرض له حد أدنى من الكمية لازم يتوفر عشان العرض يفضل "قابل للتطبيق":
//  - BOGO: لازم buy_qty + get_qty مع بعض (اشتري 1 واحصل على 1 = محتاج 2 قطعة، مش قطعة واحدة بس)
//  - كمية (خصم عند الوصول لعدد معين): لازم buy_qty على الأقل
//  - باقة: لازم bundle_qty على الأقل
//  - نسبة/قيمة ثابتة/هدية: يكفي وجود قطعة واحدة من الصنف نفسه
export function getPromoMinRequiredQty(promo) {
  const type = promo?.promo_type || "percent";
  switch (type) {
    case "bogo": return (promo.buy_qty || 1) + (promo.get_qty || 1);
    case "quantity": return promo.buy_qty || 1;
    case "bundle": return promo.bundle_qty || 1;
    default: return 1;
  }
}



export function isPromoFulfillable(promo, product, products) {
  if (!product) return false;
  const stock = product.stock || 0;
  if (stock < getPromoMinRequiredQty(promo)) return false;
  // الهدية المجانية محتاجة كمان مخزون كافي من صنف الهدية نفسه (لو متاح فحصه)
  if (promo.promo_type === "free_gift" && promo.gift_product_id && products) {
    const giftProd = products.find((p) => p.id === promo.gift_product_id);
    if (!giftProd || (giftProd.stock || 0) < (promo.gift_qty || 1)) return false;
  }
  return true;
}



// حساب سعر/كمية سطر السلة حسب النمط ومراعاة الكمية الفعلية (BOGO والكمية والباقة بيتأثروا بعدد القطع)
export function calcPromoLineTotal(promo, unitPrice, qty) {
  const type = promo?.promo_type || "percent";
  switch (type) {
    case "fixed_amount":
      return Math.max(0, unitPrice - (promo.fixed_amount || 0)) * qty;
    case "bogo": {
      const buy = Math.max(1, +promo.buy_qty || 1);
      const get = Math.max(1, +promo.get_qty || 1);
      const getDisc = (promo.get_discount_percent ?? 100) / 100;
      const cycle = buy + get;
      const cycles = Math.floor(qty / cycle);
      const remainder = qty % cycle;
      const paidInCycle = buy + get * (1 - getDisc);
      const remainderPaid = Math.min(remainder, buy) + Math.max(0, remainder - buy) * (1 - getDisc);
      return (cycles * paidInCycle + remainderPaid) * unitPrice;
    }
    case "quantity": {
      const buy = Math.max(1, +promo.buy_qty || 1);
      const pct = (+promo.qty_discount_percent || 0) / 100;
      if (qty >= buy) return unitPrice * (1 - pct) * qty;
      return unitPrice * qty;
    }
    case "bundle": {
      const bq = Math.max(1, +promo.bundle_qty || 1);
      const bp = +promo.bundle_price || unitPrice * bq;
      const cycles = Math.floor(qty / bq);
      const remainder = qty % bq;
      return cycles * bp + remainder * unitPrice;
    }
    case "free_gift":
      // سعر الأصناف المشتراة نفسه ما بيتغيرش، الهدية بتضاف كسطر منفصل بسعر صفر
      return unitPrice * qty;
    default: {
      const pct = promo?.discount || 0;
      return unitPrice * (1 - pct / 100) * qty;
    }
  }
}



// إعادة حساب متوسط سعر الوحدة لسطر في السلة عند تغيير الكمية (لأنماط BOGO/الكمية/الباقة)
export function recalcCartLinePrice(item, newQty) {
  if (!item?.promo || !["bogo", "quantity", "bundle"].includes(item.promoType) || !newQty) {
    return item.price;
  }
  const base = item.originalPrice ?? item.price;
  return +(calcPromoLineTotal(item.promo, base, newQty) / newQty).toFixed(4);
}



// ==================== EFFECTIVE PRICE (عروض تلقائية + يدوية) ====================
// sales و autoPromoConfig اختياريين (توافقية للخلف)، لكن لازم يتوفروا عشان العرض التلقائي
// (خصوصًا خصم "الراكد" وشروط استبعاد الفئات/المخزون/أقل خصم) يتطابق فعليًا مع اللي بيتحاسب في نقطة البيع
export function getEffectivePrice(product, promos, discountRules, productEarliestExpiry, products, sales, autoPromoConfig) {
  const today = todayLocal();
  // 1. عروض يدوية نشطة (بأي نمط) وقابلة للتطبيق فعليًا حسب المخزون المتبقي
  const manualPromo = (promos || []).find(
    (p) =>
      p.product_id === product.id &&
      p.start_date <= today &&
      p.end_date >= today &&
      isPromoFulfillable(p, product, products)
  );
  if (manualPromo) {
    const type = manualPromo.promo_type || "percent";
    const desc = describePromo(manualPromo, product);
    return {
      price: desc.newUnitPrice,
      discountPct: type === "percent" ? manualPromo.discount : 0,
      source: "manual",
      promo: manualPromo,
      promoType: type,
      promoLabel: desc.label,
    };
  }
  // 2. عروض تلقائية (صلاحية + راكد) — لو متوفر autoPromoConfig بنستخدم نفس منطق تبويب "العروض التلقائية"
  // بالظبط (بما فيه الراكد + استبعاد الفئات + شرط المخزون + أقل خصم)، عشان السعر المعروض هناك
  // يبقى هو نفسه اللي بيتحاسب بيه العميل في نقطة البيع.
  if (autoPromoConfig) {
    const expiry = (productEarliestExpiry || {})[product.id] || product.expiry || null;
    const auto = computeAutoPromoForProduct(product, discountRules, expiry, sales, autoPromoConfig);
    if (auto) {
      return {
        price: +(product.price * (1 - auto.autoDiscount / 100)).toFixed(2),
        discountPct: auto.autoDiscount,
        source: "auto",
        autoReasonExpiry: auto.reasonExpiry,
        autoReasonStagnant: auto.reasonStagnant,
      };
    }
  } else {
    // ── توافقية للخلف: لو الطلب مبعتش autoPromoConfig، نرجع لمنطق الصلاحية القديم بس ──
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
  }
  // 3. السعر الأصلي
  return { price: product.price, discountPct: 0, source: null };
}


// ==================== PROMOTIONS MODULE ====================
// منطق الخصم التدرجي حسب الصلاحية
export function calcAutoDiscount(expiryDate, rules?) {
  if (!expiryDate) return 0;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 0;
  const activeRules = rules || [
    { days: 90,  discount: 50 },
    { days: 120, discount: 25 },
    { days: 150, discount: 20 },
    { days: 180, discount: 15 },
  ];
  const sorted = [...activeRules].sort((a, b) => a.days - b.days);
  for (const rule of sorted) {
    if (days <= rule.days) return rule.discount;
  }
  return 0;
}



// ══════════ كشف الأصناف الراكدة (لأغراض العروض التلقائية) ══════════
// معيارين مستقلين لتحديد إن الصنف "راكد" ومحتاج عرض:
//  1) noSaleFlag: مفيش أي بيع للصنف من مدة أطول من الحد المسموح (noSaleDays) — أو مفيش بيع خالص في السجل المتاح
//  2) wontSelloutFlag: معاه صلاحية، ومعدل بيعه الحالي (آخر velocityWindowDays يوم) بطيء جدًا لدرجة إن المخزون
//     الحالي مش هيخلص قبل ما ينتهي — يعني هيتحول لهالك لو استنينا للعرض العادي حسب قرب الصلاحية بس
export function getStagnationInfo(product, sales, expiry, cfg) {
  const now = new Date();
  let lastSaleDate = null;
  (sales || []).forEach((s) => {
    const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
    if (items.some((it) => it.id === product.id)) {
      const d = new Date(s.date);
      if (!lastSaleDate || d > lastSaleDate) lastSaleDate = d;
    }
  });
  const daysSinceLastSale = lastSaleDate ? Math.floor((now - lastSaleDate) / (1000 * 60 * 60 * 24)) : null;
  // معيار 1: عدم وجود مبيعات من مدة كافية (أو الصنف لم يُبع نهائيًا في السجل المتاح رغم وجود مخزون)
  const noSaleFlag = daysSinceLastSale === null ? (product.stock || 0) > 0 : daysSinceLastSale >= cfg.noSaleDays;

  // معيار 2: هيفضل مخزون لما الصنف ينتهي حسب معدل البيع الحالي
  let wontSelloutFlag = false;
  if (expiry) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - cfg.velocityWindowDays);
    let qtySold = 0;
    (sales || []).forEach((s) => {
      const d = new Date(s.date);
      if (d < windowStart) return;
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      items.forEach((it) => { if (it.id === product.id) qtySold += (it.qty || 0); });
    });
    const dailyVelocity = qtySold / cfg.velocityWindowDays;
    const daysToExpiry = Math.ceil((new Date(expiry) - now) / (1000 * 60 * 60 * 24));
    if (daysToExpiry > 0) {
      wontSelloutFlag = dailyVelocity <= 0 ? (product.stock || 0) > 0 : (product.stock || 0) / dailyVelocity > daysToExpiry;
    }
  }

  return { isStagnant: noSaleFlag || wontSelloutFlag, daysSinceLastSale, wontSelloutFlag, noSaleFlag };
}



// دالة موحّدة لحساب الخصم التلقائي (صلاحية + راكد) لصنف واحد — نفس المنطق مستخدم في معاينة تبويب
// "العروض التلقائية" وفي حساب السعر الفعلي بنقطة البيع (getEffectivePrice)، عشان السعر يفضل متطابق
// في المكانين ومايحصلش "العرض ظاهر في الشاشة بس مبيتطبقش وقت البيع".
export function computeAutoPromoForProduct(product, discountRules, expiry, sales, autoPromoConfig) {
  if (!product || !autoPromoConfig) return null;
  const cat = product.main_category || product.category || "";
  if ((autoPromoConfig.excludeCategories || []).includes(cat)) return null;
  if (autoPromoConfig.requireStock && (product.stock || 0) <= 0) return null;

  const expiryDiscount = calcAutoDiscount(expiry, discountRules);
  const reasonExpiry = expiryDiscount > 0;

  const stagInfo = autoPromoConfig.stagnantEnabled
    ? getStagnationInfo(product, sales, expiry, {
        noSaleDays: autoPromoConfig.stagnantNoSaleDays,
        velocityWindowDays: autoPromoConfig.stagnantVelocityWindowDays,
      })
    : { isStagnant: false };
  const reasonStagnant = stagInfo.isStagnant;

  if (!reasonExpiry && !reasonStagnant) return null;

  // لو الصنف واقع تحت الاتنين، ناخد أعلى خصم بينهم
  const autoDiscount = Math.max(reasonExpiry ? expiryDiscount : 0, reasonStagnant ? autoPromoConfig.stagnantDiscountPercent : 0);
  if (autoDiscount <= 0 || autoDiscount < autoPromoConfig.minDiscount) return null;

  return { autoDiscount, reasonExpiry, reasonStagnant, daysSinceLastSale: stagInfo.daysSinceLastSale };
}



// ── القيم الافتراضية لإعدادات العروض التلقائية — مشتركة بين هذا المكون وأعلى التطبيق (App) ──
export const DEFAULT_AUTO_PROMO_CONFIG = {
  excludeCategories: ["دواء"],
  minDiscount: 0,
  requireStock: true,
  enabledTypes: PROMO_TYPES.map((t) => t.id), // كل الأنماط مفعّلة افتراضيًا
  autoEligibleTypes: ["percent"], // بس النسبة قادرة تشتغل في العروض التلقائية حسب الصلاحية
  // ── إعدادات الأصناف الراكدة (خصم ثابت مستقل عن تدرج الصلاحية) ──
  stagnantEnabled: true,
  stagnantNoSaleDays: 45,        // مفيش بيع من كام يوم يعتبر الصنف راكد
  stagnantVelocityWindowDays: 90, // نافذة حساب معدل البيع الحالي لتوقع "هيخلص قبل الانتهاء ولا لأ"
  stagnantDiscountPercent: 15,    // نسبة الخصم الثابتة للراكد
};
