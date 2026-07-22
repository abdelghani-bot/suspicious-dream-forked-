import { POS } from "../modules/POS";

// صوت تنبيه قصير (بيب) لما الباركود يقرا تاريخ صلاحية مش مطابق للمسجل بالمخزون
export function playWarningBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch (e) {
    // متصفح مايدعمش Web Audio — نتجاهل بهدوء
  }
}


// ==================== POS ====================
export const MAX_INVOICES = 8;


export const CART_ROW_HEIGHT = 49;

 // ارتفاع تقريبي لكل صف في جدول السلة
export const CART_VISIBLE_ROWS = 5;

 // 🔧 CHANGED: عدد الأصناف الظاهرة قبل ظهور السكرول
export const CART_HEADER_HEIGHT = 34;

 // ارتفاع رأس الجدول (thead)
export const CART_AREA_HEIGHT = CART_HEADER_HEIGHT + CART_ROW_HEIGHT * CART_VISIBLE_ROWS;

 // 🔧 CHANGED

export const emptyInvoice = () => ({
  cart: [],
  selCustomer: null,
  patientName: "",
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
  jokerCategory: "",
  openedAt: Date.now(),
});



// ==================== ملصق الجرعة (Dosage Label) ====================
export const DEFAULT_DOSE_TEMPLATES = [
  "قرص واحد 3 مرات يومياً بعد الأكل",
  "قرص واحد يومياً صباحاً",
  "قرص واحد كل 12 ساعة",
  "قرص واحد كل 8 ساعات",
  "نصف قرص يومياً",
  "قطرة قطرة 3 مرات يومياً في العين المصابة",
  "ملعقة صغيرة 3 مرات يومياً",
  "حقنة واحدة يومياً",
  "يستخدم عند اللزوم فقط",
];



export const DOSAGE_LABEL_SIZES = [
  { id: "60x40", label: "60×40 مم", w: 60, h: 40 },
  { id: "76x51", label: "76×51 مم", w: 76.2, h: 50.8 },
  { id: "80x60", label: "80×60 مم", w: 80, h: 60 },
  { id: "100x70", label: "100×70 مم", w: 100, h: 70 },
];
