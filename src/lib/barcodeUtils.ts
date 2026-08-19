import { toString } from "../function toString() { [native code] }/undefined";

// ==================== RASSD BARCODE PARSER ====================

// 🆕 فحص موحّد: الباركود ده فعلاً GS1 (له أقواس AI زي (01).. أو بادئة GS1-128 بدون أقواس)
// ولا باركود خطي عادي (EAN-13/UPC وغيره)؟ لازم يتنادى قبل أي استخدام لـ parseGS1Barcode،
// لأن الفولباك جوه parseGS1Barcode بيدور على أنماط AI في أي مكان جوه الرقم، وده بيدي نتيجة
// غلط لو اتنادى على باركود خطي عادي مش GS1 أصلاً (زي ما حصل مع باركود كوزمتيك خطي).
export function isGS1Formatted(raw) {
  const s = String(raw || "");
  return s.includes("(01)") || s.includes(")01(") || /^01\d{14}/.test(s);
}


function normalizeGs1ExpiryDate(yymmdd) {
    const yy = yymmdd.slice(0, 2);
    const mm = yymmdd.slice(2, 4);
    let dd = yymmdd.slice(4, 6);
    const year = 2000 + parseInt(yy, 10);
    const month = parseInt(mm, 10);
    if (dd === "00") {
        // آخر يوم في الشهر: يوم 0 من الشهر الجاي = آخر يوم في الشهر الحالي
        const lastDay = new Date(year, month, 0).getDate();
        dd = String(lastDay).padStart(2, "0");
    }
    return `${year}-${mm}-${dd}`;
}
export function parseGS1Barcode(raw) {
  const result = {
    gtin: null,
    expiry: null,
    batch: null,
    serial: null,
    raw,
  };

  try {
    // الفورمات المدعوم: (01)XXXXXX(21)XXXX(10)XXXX(17)XXXXXX
    // نفك الأقواس ونحوّل لمصفوفة [ai, value]
    const bracketFormat = /\((\d{2,4})\)([^(]*)/g;
    let match;
    let foundAny = false;

    while ((match = bracketFormat.exec(raw)) !== null) {
      foundAny = true;
      const ai = match[1];
      const value = match[2].trim();

      if (ai === "01") {
        // GTIN-14: 14 رقم
        result.gtin = value.substring(0, 14);
      } else if (ai === "17") {
          // تاريخ الصلاحية YYMMDD
          const d = value.substring(0, 6);
          result.expiry = normalizeGs1ExpiryDate(d);
      } else if (ai === "10") {
        result.batch = value;
      } else if (ai === "21") {
        result.serial = value;
      }
    }

    // fallback: GS1 DataMatrix SFDA format
    if (!foundAny) {
      const s = raw.replace(/[]/g, "");
      let i = 0;
      const FIXED: Record<string, number> = {
        "00": 18, "01": 14, "02": 14,
        "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6,
        "20": 2,
      };
      const varEnd = (from: number): number => {
        for (let j = from; j < s.length - 1; j++) {
          if (s[j] === "") return j;
          const a = s.substring(j, j + 2);
          if (["17","10","21","01","11","00"].includes(a) && j > from) return j;
        }
        return s.length;
      };
      while (i < s.length) {
        if (s[i] === "") { i++; continue; }
        const ai = s.substring(i, i + 2);
        if (ai === "01") {
          result.gtin = s.substring(i + 2, i + 16);
          i += 16;
        } else if (ai === "17") {
            const d = s.substring(i + 2, i + 8);
            result.expiry = normalizeGs1ExpiryDate(d);
            i += 8;
        } else if (ai === "10") {
          const end = varEnd(i + 2);
          result.batch = s.substring(i + 2, end).trim();
          i = end;
        } else if (ai === "21") {
          const end = varEnd(i + 2);
          result.serial = s.substring(i + 2, end).trim();
          i = end;
        } else if (FIXED[ai] !== undefined) {
          i += 2 + FIXED[ai];
        } else { i++; }
      }
    }
  } catch (e) {
    console.error("GS1 parse error:", e);
  }

  return result;
}



// ==================== بناء باركود GS1-128 (يشمل الصلاحية ورقم التشغيلة) ====================
// بيرجع { ok, data, hri } - data هو السترينج اللي يتحط في JsBarcode مع ean128:true
// hri هو النص المقروء البديل (Human Readable Interpretation) اللي بيتحط تحت الباركود
// ملاحظة مهمة: عشان الباركود يتقرأ صح، السكانر لازم يدعم قراءة GS1-128 (FNC1)
// وأي نظام هيقرأه لازم يستخدم parseGS1Barcode (الموجودة فوق) لفك التشفير مرة تانية
export function buildGS1Barcode(item) {
  // لازم الباركود يكون أرقام بس عشان يبقى GTIN صالح - لو فيه حروف (زي "P006" أو
  // كود صنف داخلي) يبقى مش GTIN حقيقي، ومينفعش نشيل الحروف ونحط أصفار مكانها
  // (ده اللي كان بيحصل قبل كده وبيولد باركود أغلبه أصفار وغير صحيح).
  // كمان ملاحظة: item.id هو معرّف داخلي في النظام مش باركود، فمينفعش نستخدمه كـ GTIN.
  const barcodeRaw = String(item.barcode || "").trim();
  if (!/^\d{8,14}$/.test(barcodeRaw)) return { ok: false };

  const gtin14 = barcodeRaw.padStart(14, "0");

  const expiryDate = item.expiry_date || item.expiry;
  if (!expiryDate) return { ok: false }; // من غير صلاحية مفيش داعي لـ GS1، الباركود العادي أبسط وأثبت

  const d = new Date(expiryDate);
  if (isNaN(d.getTime())) return { ok: false };
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yymmdd = `${yy}${mm}${dd}`;

  const batch = (item.batch_number || item.batch || "").toString().trim();

  // (10) رقم التشغيلة لازم يبقى آخر حقل لأنه طول متغير - عشان منحتاجش FNC1 فاصلة بعده
  let data = `01${gtin14}17${yymmdd}`;
  let hri = `(01)${gtin14}(17)${yymmdd}`;
  if (batch) {
    data += `10${batch}`;
    hri += `(10)${batch}`;
  }

  return { ok: true, data, hri };
}



// ==================== باركود بديل لما الصنف كوده مش GTIN رقمي (زي أكواد تبدأ بحرف P) ====================
// ده مش معيار GS1 رسمي (GS1 محتاج GTIN أرقام بس)، لكنه شكل بسيط بيحافظ على كود الصنف
// زي ما هو (P006 مثلاً) وبيضيفله الصلاحية والتشغيلة، وبيتقرأ بأي سكانر عادي من غير
// أي إعداد خاص، وبرنامجنا هو اللي بيفك تشفيره تاني عن طريق parseCustomExpiryBarcode
export function buildCustomExpiryBarcode(item) {
  const code = String(item.barcode || item.id || "").trim();
  if (!code) return { ok: false };

  const expiryDate = item.expiry_date || item.expiry;
  if (!expiryDate) return { ok: false };
  const d = new Date(expiryDate);
  if (isNaN(d.getTime())) return { ok: false };
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yymmdd = `${yy}${mm}${dd}`;

  const batch = (item.batch_number || item.batch || "").toString().trim();

  let data = `${code}*${yymmdd}`;
  if (batch) data += `*${batch}`;

  return { ok: true, data, hri: data };
}



// بيفك تشفير الشكل البديل: CODE*YYMMDD أو CODE*YYMMDD*BATCH
export function parseCustomExpiryBarcode(raw) {
  const m = /^(.+?)\*(\d{6})(?:\*(.+))?$/.exec(String(raw || "").trim());
  if (!m) return null;
  const [, code, yymmdd, batch] = m;
  const expiry = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
  return { code, expiry, batch: batch || null };
}



// 🆕 بنفس منطق سكانر نقطة البيع: أي نص متسح (زي QR الدواء اللي فيه GS1 AIs كتير) بنرجّع
// منه الباركود الأساسي بس (GTIN أو كود الصنف) عشان البحث يطابقه بسرعة، بدل ما نقارن
// النص الخام الطويل كله (اللي معاه تشغيلة/صلاحية/سيريال) بباركود الصنف المسجل فيفشل التطابق.
export function extractPrimaryBarcode(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return trimmed;
  const isGS1 = isGS1Formatted(trimmed);
  if (isGS1) {
    const parsed = parseGS1Barcode(trimmed);
    if (parsed.gtin) return parsed.gtin;
  } else {
    const custom = parseCustomExpiryBarcode(trimmed);
    if (custom) return custom.code;
  }
  return trimmed;
}



// نقطة دخول موحّدة للطباعة: يجرب GS1 الرسمي الأول (لو الباركود GTIN أرقام حقيقي)،
// وبعدين الشكل البديل (لأي كود تاني زي P006)، وبعدين يرجع للباركود العادي من غير صلاحية
// 🆕 السعر المطبوع على الملصق لازم يكون شامل الضريبة (ده اللي العميل بيدفعه فعليًا على الرف)،
// مش سعر ما قبل الضريبة المخزّن داخليًا في newSalePrice/salePrice/price.
export function taxInclusiveLabelPrice(item) {
  const base = item.newSalePrice ?? item.salePrice ?? item.price ?? 0;
  const incl = item.taxable ? base * 1.15 : base;
  return Math.round(incl * 100) / 100;
}


export function buildLabelBarcode(item) {
  const gs1 = buildGS1Barcode(item);
  if (gs1.ok) return { ...gs1, mode: "gs1" };
  const custom = buildCustomExpiryBarcode(item);
  if (custom.ok) return { ...custom, mode: "custom" };
  return { ok: false, mode: "plain" };
}



// بيشيل الأصفار الزيادة على الشمال قبل المقارنة - عشان GTIN-14 المبطّن بالأصفار
// (زي اللي بيطلع من GS1) يتطابق مع الباركود الأصلي المسجل في قاعدة البيانات
// (زي EAN-13 من غير الصفر) من غير ما نحتاج نعدّل بيانات الأصناف نفسها.
export function normGtin(v) {
  // بنشيل أي حاجة مش رقم (مسافات عادية، مسافات مخفية زي NBSP/zero-width، شرط "-"، إلخ)
  // اللي ممكن تتسرب لخانة الباركود من النسخ واللصق من موقع رصد أو ملف الإكسيل، عشان
  // المقارنة تبقى بالأرقام بس - قبل ما نشيل الأصفار الزيادة على الشمال.
  return String(v || "").replace(/\D+/g, "").replace(/^0+(?=\d)/, "");
}
