import { CATEGORIES } from "../data/seedData";

// ==================== CATEGORIES ====================
// نوع العبوة — يصف شكل التعبئة الخارجية المباعة (مستقل عن الشكل الصيدلاني)
export const PACKAGE_TYPES = ["كرتونة", "كيس/باكيت", "علبة"];



export const MAIN_CATEGORIES = {
  دواء: {
    sub1: ["مستورد", "محلي"],
    sub2: [
      "أقراص",
      "كبسولات",
      "شراب/معلق",
      "قطرة عين",
      "قطرة أذن",
      "قطرة أنف",
      "نقط/قطارة فم",
      "محلول موضعي",
      "كريم/مرهم/جل",
      "أمبولات/حقن",
      "تحاميل",
      "بخاخ/إسبراي",
      "محلول استنشاق",
      "لصقات",
      "أكياس",
      "لا ينطبق",
    ],
  },
  "كوزمتك عادي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "كوزمتك طبي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات أطفال": {
    sub1: [],
    sub2: ["حفاضات", "حليب", "رضاعة", "عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات طبية": {
    sub1: [],
    sub2: ["جهاز طبي", "عناية بالجروح", "وقاية"],
  },
};


export const SUPPLY_CATEGORIES = [
  "دواء",
  "مستلزمات طبية", 
  "كوزمتك عادي",
  "كوزمتك طبي",
  "حليب أطفال",
  "حفاضات",
  "رضاعات ومستلزمات الرضاعة",
];


// 🆕 أيقونة لكل فئة توريد — تستخدم في بطاقات "تحليل الموردين"
export const SUPPLY_CATEGORY_ICONS = {
  "دواء": "💊",
  "مستلزمات طبية": "🩺",
  "كوزمتك عادي": "💄",
  "كوزمتك طبي": "🧴",
  "حليب أطفال": "🍼",
  "حفاضات": "👶",
  "رضاعات ومستلزمات الرضاعة": "🍶",
};



// 🆕 نظام تسمية موحّد للأصناف الغير دوائية — بدل الاسم الحر، بيتبنى الاسم تلقائيًا
// من حقول منفصلة (البراند + النوع + الحجم/الوزن) بترتيب ثابت، عشان البحث اليدوي
// يبقى متسق مهما كان الموظف اللي بيضيف الصنف.
// الصيغة النهائية: [البراند] - [النوع] - [الحجم/الوزن]
export const NON_DRUG_TYPES = [
  "كريم", "لوشن", "غسول", "شامبو", "بلسم", "سيروم", "جل", "بخاخ",
  "مرهم", "بودرة", "فوم", "زيت", "مقشر", "ماسك", "واقي شمس",
  "مناديل مبللة", "معجون أسنان", "غسول فم", "مكمل غذائي", "أخرى",
];


export const NON_DRUG_SIZE_UNITS = ["مل", "جم", "كجم", "لتر", "قطعة"];



// 🆕 نسخة إنجليزية من نفس القوائم — عشان اسم الصنف بالإنجليزي يتبني تلقائيًا هو كمان،
// ويفضل بس محتاج "تمييز الصنف" (النص الحر) يتترجم يدويًا لأنه الجزء الوحيد اللي مالوش قائمة ثابتة.
export const NON_DRUG_TYPES_EN = {
  "كريم": "Cream", "لوشن": "Lotion", "غسول": "Wash", "شامبو": "Shampoo",
  "بلسم": "Conditioner", "سيروم": "Serum", "جل": "Gel", "بخاخ": "Spray",
  "مرهم": "Ointment", "بودرة": "Powder", "فوم": "Foam", "زيت": "Oil",
  "مقشر": "Scrub", "ماسك": "Mask", "واقي شمس": "Sunscreen",
  "مناديل مبللة": "Wet Wipes", "معجون أسنان": "Toothpaste", "غسول فم": "Mouthwash",
  "مكمل غذائي": "Supplement", "أخرى": "Other",
};


export const NON_DRUG_SIZE_UNITS_EN = { "مل": "ml", "جم": "g", "كجم": "kg", "لتر": "L", "قطعة": "pcs" };



export function buildNonDrugNameEn(brandEn, itemTypeEn, sizeValue, sizeUnitEn, variantEn) {
  const parts = [];
  if (brandEn && brandEn.trim()) parts.push(brandEn.trim());
  if (itemTypeEn && itemTypeEn.trim()) parts.push(itemTypeEn.trim());
  if (sizeValue && String(sizeValue).trim()) {
    parts.push(`${String(sizeValue).trim()}${sizeUnitEn || "ml"}`);
  }
  if (variantEn && variantEn.trim()) parts.push(variantEn.trim());
  return parts.join(" - ");
}



export function buildNonDrugName(brand, itemType, sizeValue, sizeUnit, variant) {
  const parts = [];
  if (brand && brand.trim()) parts.push(brand.trim());
  if (itemType && itemType.trim()) parts.push(itemType.trim());
  if (sizeValue && String(sizeValue).trim()) {
    parts.push(`${String(sizeValue).trim()}${sizeUnit || "مل"}`);
  }
  if (variant && variant.trim()) parts.push(variant.trim());
  return parts.join(" - ");
}
