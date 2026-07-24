import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { TAX_RATE } from "../data/seedData";
import { normGtin } from "../lib/barcodeUtils";
import { todayLocal } from "../lib/dateUtils";
import { sellFromBatches } from "../lib/inventoryUtils";
import { CART_AREA_HEIGHT, DEFAULT_DOSE_TEMPLATES, DOSAGE_LABEL_SIZES, MAX_INVOICES, emptyInvoice, playWarningBeep } from "../lib/posConstants";
import { MAIN_CATEGORIES } from "../lib/productConstants";
import { calcPromoLineTotal, getEffectivePrice, recalcCartLinePrice } from "../lib/promoUtils";
import { buildZatcaChainForInvoice } from "../lib/zatca";
import { PrintReceipt } from "./PrintReceipt";
import { RasdQueue } from "../services/rasdService";
import { Btn, IC, Modal } from "../ui/primitives";
import { getDeviceId } from "../lib/deviceID";
export function POS({
  products,
  setProducts,
  customers,
  sales,
  setSales,
  shifts,
  setShifts,
  currentUser,
  currentShift,
  showToast,
  invoices,
  setInvoices,
  activeTab,
  setActiveTab,
  pharmacyId,
  jokerPendingItems,
  setJokerPendingItems,
  promos,
  discountRules,
  productEarliestExpiry,
  autoPromoConfig,
}) {
  const [showPrint, setShowPrint] = useState(null);
  const fileRef = useRef();
  const barcodeInputRef = useRef(null);
  const [fifoResults, setFifoResults] = useState({});
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [autoSaveWarning, setAutoSaveWarning] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState(180);
  const autoSaveTimerRef = useRef(null);
  const autoSaveCountdownRef = useRef(null);

  // ── باركود اتقرا بس مش متطابق مع أي صنف عندنا (على الأغلب الشركة غيّرت الـ GTIN) ──
  // بدل ما نرفض بس، بنسيب الكاشير يربط الكود الجديد بالصنف الصح يدويًا، والنظام يحدث الباركود تلقائي.
  const [unmatchedScan, setUnmatchedScan] = useState(null); // { gtin/code, batch, expiry, serial }
  const [unmatchedLinkSearch, setUnmatchedLinkSearch] = useState("");

  // ── ملصق الجرعة ──
  const [doseLabelItem, setDoseLabelItem] = useState(null);
  const [pharmSettingsPOS, setPharmSettingsPOS] = useState<any>({});
  const [doseTemplates, setDoseTemplates] = useState<string[]>(DEFAULT_DOSE_TEMPLATES);
  const [showBulkDoseModal, setShowBulkDoseModal] = useState(false);
  const [bulkLabelSize, setBulkLabelSize] = useState("80x60");

  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("pharmacy_settings").select("*").eq("pharmacy_id", pharmacyId).single()
      .then(({ data }) => {
        if (data) {
          setPharmSettingsPOS(data);
          setDoseTemplates(
            Array.isArray(data.dosage_templates) && data.dosage_templates.length > 0
              ? data.dosage_templates
              : DEFAULT_DOSE_TEMPLATES
          );
        }
      });
  }, [pharmacyId]);

  const saveDoseTemplate = async (text) => {
    const t = (text || "").trim();
    if (!t) return;
    if (doseTemplates.includes(t)) { showToast("القالب موجود بالفعل بين القوالب المحفوظة"); return; }
    const updated = [...doseTemplates, t];
    setDoseTemplates(updated);
    if (pharmacyId) {
      await supabase.from("pharmacy_settings").update({ dosage_templates: updated }).eq("pharmacy_id", pharmacyId);
    }
    showToast("تم حفظ القالب ✓");
  };

  const removeDoseTemplate = async (text) => {
    const updated = doseTemplates.filter((t) => t !== text);
    setDoseTemplates(updated);
    if (pharmacyId) {
      await supabase.from("pharmacy_settings").update({ dosage_templates: updated }).eq("pharmacy_id", pharmacyId);
    }
  };

  // ✅ أي تعديل في نافذة ملصق الجرعة (قالب/كتابة جرعة/ملاحظات) يترحّل فوراً لصنف السلة
  // عشان الجرعة تفضل محفوظة حتى لو المستخدم قفل النافذة من غير ما يطبع، ويقدر يستخدمها في "طباعة الكل" بعدين
  const updateDoseLabel = (updater) => {
    setDoseLabelItem((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      setInv((p) => ({
        ...p,
        cart: p.cart.map((i) =>
          i.lineId === next.lineId ? { ...i, dose: next._dose || "", notes: next._notes || "" } : i
        ),
      }));
      return next;
    });
  };

  const printDoseLabel = () => {
    const it = doseLabelItem;
    if (!it) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-EG");
    const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const size = DOSAGE_LABEL_SIZES.find((s) => s.id === (it._labelSize || "80x60")) || DOSAGE_LABEL_SIZES[2];
    const patientName = (inv.patientName || "").trim() || inv.selCustomer?.name || "";

    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملصق الجرعة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          body { font-family: Arial, sans-serif; }
          .label {
            width: ${size.w}mm; height: ${size.h}mm; padding: 3mm;
            display: flex; flex-direction: column;
          }
          .pharmacy-row {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 8pt; font-weight: 800; border-bottom: 1px solid #000;
            padding-bottom: 1.5mm; margin-bottom: 1.5mm;
          }
          .meta { font-size: 7pt; color: #333; }
          .patient { font-size: 8pt; font-weight: 700; margin: 1mm 0; }
          .product { font-size: 11pt; font-weight: 800; text-align: center; margin: 1.5mm 0; }
          .dose-box {
            border: 1.5px solid #000; border-radius: 2mm; padding: 2mm;
            text-align: center; font-size: 12pt; font-weight: 800;
            margin: 1.5mm 0; flex-grow: 1; display: flex;
            align-items: center; justify-content: center; line-height: 1.4;
          }
          .notes { font-size: 8pt; margin-top: 1mm; }
          .row { display: flex; justify-content: space-between; font-size: 7.5pt; margin-top: 1mm; border-top: 1px dashed #999; padding-top: 1mm; }
          @media print { .no-print { display: none; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding:10px; text-align:center;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        <div class="label">
          <div class="pharmacy-row">
            <span>${pharmSettingsPOS.name_ar || ""}</span>
            <span>${pharmSettingsPOS.license_number ? "رقم الصيدلية: " + pharmSettingsPOS.license_number : ""}</span>
          </div>
          <div class="meta">
            الصيدلي: ${currentUser?.name || ""} &nbsp;|&nbsp; تاريخ الصرف: ${dateStr} ${timeStr}
          </div>
          ${patientName ? `<div class="patient">👤 المريض: ${patientName}</div>` : ""}
          <div class="product">${it.name || ""}</div>
          <div class="dose-box">${(it._dose || "بدون جرعة محددة").replace(/\n/g, "<br>")}</div>
          ${it._notes ? `<div class="notes">📝 ملاحظات: ${it._notes}</div>` : ""}
          <div class="row">
            <span>${it.expiry_date ? "صلاحية: " + it.expiry_date : ""}</span>
            <span>${it._afterOpening ? "بعد الفتح: " + it._afterOpening : ""}</span>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setDoseLabelItem(null);
  };

  // ── طباعة كل ملصقات الجرعة للسلة دفعة واحدة ──
  const printAllDoseLabels = (sizeId) => {
    const items = inv.cart.filter((i) => !i.isGift);
    if (items.length === 0) return;
    const size = DOSAGE_LABEL_SIZES.find((s) => s.id === sizeId) || DOSAGE_LABEL_SIZES[2];
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-EG");
    const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const patientName = (inv.patientName || "").trim() || inv.selCustomer?.name || "";

    const labelsHtml = items
      .map(
        (it) => `
        <div class="label">
          <div class="pharmacy-row">
            <span>${pharmSettingsPOS.name_ar || ""}</span>
            <span>${pharmSettingsPOS.license_number ? "رقم الصيدلية: " + pharmSettingsPOS.license_number : ""}</span>
          </div>
          <div class="meta">
            الصيدلي: ${currentUser?.name || ""} &nbsp;|&nbsp; تاريخ الصرف: ${dateStr} ${timeStr}
          </div>
          ${patientName ? `<div class="patient">👤 المريض: ${patientName}</div>` : ""}
          <div class="product">${it.name || ""}</div>
          <div class="dose-box">${(it.dose || "بدون جرعة محددة").replace(/\n/g, "<br>")}</div>
          ${it.notes ? `<div class="notes">📝 ملاحظات: ${it.notes}</div>` : ""}
          <div class="row">
            <span>${it.expiry_date ? "صلاحية: " + it.expiry_date : ""}</span>
          </div>
        </div>`
      )
      .join("");

    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملصقات الجرعة</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          body { font-family: Arial, sans-serif; }
          .label {
            width: ${size.w}mm; height: ${size.h}mm; padding: 3mm;
            display: flex; flex-direction: column;
            page-break-after: always;
          }
          .label:last-child { page-break-after: auto; }
          .pharmacy-row {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 8pt; font-weight: 800; border-bottom: 1px solid #000;
            padding-bottom: 1.5mm; margin-bottom: 1.5mm;
          }
          .meta { font-size: 7pt; color: #333; }
          .patient { font-size: 8pt; font-weight: 700; margin: 1mm 0; }
          .product { font-size: 11pt; font-weight: 800; text-align: center; margin: 1.5mm 0; }
          .dose-box {
            border: 1.5px solid #000; border-radius: 2mm; padding: 2mm;
            text-align: center; font-size: 12pt; font-weight: 800;
            margin: 1.5mm 0; flex-grow: 1; display: flex;
            align-items: center; justify-content: center; line-height: 1.4;
          }
          .notes { font-size: 8pt; margin-top: 1mm; }
          .row { display: flex; justify-content: space-between; font-size: 7.5pt; margin-top: 1mm; border-top: 1px dashed #999; padding-top: 1mm; }
          @media print { .no-print { display: none; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding:10px; text-align:center;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة الكل (${items.length})</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        ${labelsHtml}
      </body>
      </html>
    `);
    win.document.close();
    setShowBulkDoseModal(false);
  };


  // ── نقاط الولاء ──
  const [customerLoyalty, setCustomerLoyalty] = useState<any>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);

  const inv = invoices[activeTab] || emptyInvoice();
  const setInv = (updater) => {
    setInvoices((prev) =>
      prev.map((item, i) =>
        i === activeTab
          ? typeof updater === "function"
            ? updater(item)
            : updater
          : item
      )
    );
  };
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [activeTab]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (autoSaveCountdownRef.current)
      clearInterval(autoSaveCountdownRef.current);
    setAutoSaveWarning(false);
    if (inv.cart.length === 0) return;
    const elapsed = Date.now() - (inv.openedAt || Date.now());
    const remaining = 10 * 60 * 1000 - elapsed;
    if (remaining <= 0) return;
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveWarning(true);
      setAutoSaveCountdown(180);
      autoSaveCountdownRef.current = setInterval(() => {
        setAutoSaveCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(autoSaveCountdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, remaining);
    return () => {
      clearTimeout(autoSaveTimerRef.current);
      clearInterval(autoSaveCountdownRef.current);
    };
  }, [activeTab, inv.cart.length]);

  const addTab = () => {
    if (invoices.length >= MAX_INVOICES) {
      showToast(`الحد الأقصى ${MAX_INVOICES} فواتير`, "error");
      return;
    }
    setInvoices((p) => [...p, emptyInvoice()]);
    setActiveTab(invoices.length);
  };

 useEffect(() => {
  const handler = (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      addTab();
    }
    if (e.key === "F1") {
      e.preventDefault();
      completeSale();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [addTab]);
  const closeTab = (idx) => {
    if (invoices.length === 1) {
      setInvoices([emptyInvoice()]);
      return;
    }
    const next = invoices.filter((_, i) => i !== idx);
    setInvoices(next);
    setActiveTab(Math.min(activeTab, next.length - 1));
  };

  const [expiryPickerLine, setExpiryPickerLine] = useState<any>(null);

  const addToCart = (p) => {
  if (!p.isMissed && !p.isJoker) {
    const effectiveStock =
      p.saleUnits > 1 ? p.stock * p.saleUnits : p.stock;
    if (effectiveStock <= 0) {
      showToast("المخزون نفد!", "error");
      return;
    }
    if (p.expiry) {
      const expDate = new Date(p.expiry);
      const today = new Date();
      if (expDate < today) {
        showToast(`⚠️ ${p.name} - منتهي الصلاحية! (${p.expiry})`, "error");
        return;
      }
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 90) {
        showToast(`⚠️ ${p.name} - ينتهي خلال ${daysLeft} يوم`, "warning");
      }
    }
  }

  // ملحوظة مهمة: صف المنتج نفسه (p) بيحمل حقل "expiry" قديم بيمثل أقرب تاريخ صلاحية
  // (بيتحسب في productEarliestExpiry) وده مجرد حقل عرض/تنبيه، مش اختيار فعلي للتشغيلة.
  // لازم نتجاهله هنا ونحسب تاريخ الصلاحية الفعلي للسطر من batches نفسها، إلا لو الصنف
  // جاي فعلاً من مسح باركود قرا/أكد تاريخ صلاحية بنفسه (علامة _expiryConfirmed اللي
  // بتتحدد صراحةً في scanBarcode). الاعتماد على وجود batch/serial مش كافي لأن باركود الـ
  // GS1 ممكن يشيل تاريخ الصلاحية بس من غير رقم تشغيلة أو سيريال.
  const cameFromBarcodeScan = !!p._expiryConfirmed;
  let effectiveExpiry = cameFromBarcodeScan ? p.expiry : undefined;
  let needsExpiryChoice = false;
  // 🆕 منطق اختيار الدفعة/الصلاحية الإجباري ده خاص بالدواء بس (تتبع Batch/Serial مطلوب
  // لرصد ولسلامة المريض). الأصناف غير الدوائية (تجميل/مستلزمات...) باركودها العادي
  // مش بيحمل تاريخ صلاحية أصلاً، فمينفعش نوقف البيع عشانها — ناخد أقرب تشغيلة (FIFO)
  // تلقائيًا من غير ما نفتح نافذة اختيار.
  const isDrugItem = (p.mainCategory || p.main_category || p.category) === "دواء";
  if (!effectiveExpiry && !p.isMissed && !p.isJoker) {
    const prodBatches = products.find((x) => x.id === p.id)?.batches || [];
    const validExpiries = Array.from(
      new Set(
        prodBatches
          .filter((b) => b.qty > 0 && b.expiry_date)
          .map((b) => b.expiry_date)
      )
    ).sort();
    if (validExpiries.length === 1) {
      effectiveExpiry = validExpiries[0];
    } else if (isDrugItem && validExpiries.length > 1) {
      // دواء وفيه أكتر من تشغيلة/تاريخ صلاحية: منسيبش الاختيار عشوائي أو تلقائي،
      // هنسيب الحقل فاضي ونجبر الكاشير يختار من نافذة تظهر فورًا بعد الإضافة.
      needsExpiryChoice = true;
    } else if (validExpiries.length > 1) {
      // مش دواء: خد أقرب تاريخ صلاحية تلقائيًا (FIFO) من غير ما توقف البيع.
      effectiveExpiry = validExpiries[0];
    }
  }
  p = { ...p, expiry: effectiveExpiry, _expiryConfirmed: undefined };

  // كل سطر في السلة بيتحدد بالصنف + تاريخ الصلاحية + رقم التشغيلة معًا،
  // عشان لو نفس الصنف موجود ع الرف بأكتر من تاريخ صلاحية يقدر الكاشير يبيعهم كسطرين منفصلين
  // بدل ما يتجمعوا غصب على بعض تحت تاريخ واحد.
  const lineId = p.lineId || `${p.id}::${p.expiry || ""}::${p.batch || ""}`;

  setInv((prev) => {
    const ex = prev.cart.find((i) => i.lineId === lineId);
    if (ex) {
      const prod = products.find((x) => x.id === p.id);
      if (ex.qty + 1 > (prod?.stock || 99)) {
        showToast("لا يوجد مخزون كافٍ", "error");
        return prev;
      }
      const newQty = ex.qty + 1;
      // 🆕 لو السطر ده أصلاً بيتجمّع من كذا سكان (نفس الصنف/التشغيلة/الصلاحية)، لازم نحتفظ
      // بسيريال كل علبة على حدة جوه مصفوفة "serials"، مش نفقد سيريال العلبة التانية والتالتة...
      // لأن ده أصل مشكلة "منع تكرار السيريال بيشتغل بس على أول علبة" — كانت العلب بعد الأولى
      // بتتجمّع في نفس السطر من غير ما سيريالها يتسجل في أي حتة.
      const existingSerials = ex.serials && ex.serials.length ? ex.serials : (ex.serial ? [ex.serial] : []);
      const newSerials = p.serial ? [...existingSerials, p.serial] : existingSerials;
      return {
        ...prev,
        cart: prev.cart.map((i) =>
          i.lineId === lineId
            ? { ...i, qty: newQty, price: recalcCartLinePrice(i, newQty), serials: newSerials }
            : i
        ),
      };
    }
    // صنف جديد
   const initQty = p.qty !== undefined && !isNaN(p.qty) && !p.isPartial
  ? p.qty
  : 1;
    const effective = p.isMissed || p.isJoker
      ? { price: p.price, discountPct: 0, source: null }
      : getEffectivePrice(p, promos, discountRules, productEarliestExpiry, products, sales, autoPromoConfig);

    // السعر الكامل للحساب، سعر الوحدة للعرض
    // أنماط مرتبطة بالكمية (BOGO / كمية / باقة) بيتغيّر متوسط سعر الوحدة حسب عدد القطع
    const isQtyDependentPromo = !p.isPartial && ["bogo", "quantity", "bundle"].includes(effective.promoType);
    const cartPrice = p.isPartial
      ? p.price
      : isQtyDependentPromo
        ? +(calcPromoLineTotal(effective.promo, p.price, initQty) / initQty).toFixed(4)
        : effective.price;
    const unitPrice = p.isPartial
      ? Math.round((p.price / p.saleUnits) * 100) / 100
      : undefined;

    const newLine = {
      ...p,
      lineId,
      qty: initQty,
      // 🆕 أول علبة في السطر ده — تبدأ مصفوفة السيريالات بيها
      serials: p.serial ? [p.serial] : (p.serials || []),
      dose: "",
      price: cartPrice,
      unitPrice,
      originalPrice: p.price,
      discountPct: p.isPartial ? 0 : effective.discountPct,
      discountSource: p.isPartial ? null : effective.source,
      promo: p.isPartial ? null : effective.promo || null,
      promoType: p.isPartial ? null : effective.promoType || null,
      promoLabel: p.isPartial ? null : effective.promoLabel || null,
    };

    // ── هدية مجانية: لو الصنف مرتبط بعرض هدية، ضيف سطر الهدية تلقائيًا (مرة واحدة لكل عرض) ──
    let newCart = [...prev.cart, newLine];
    if (!p.isPartial && effective.promoType === "free_gift" && effective.promo?.gift_product_id) {
      const giftAlready = newCart.some((i) => i.isGift && i.giftFromPromoId === effective.promo.id);
      if (!giftAlready) {
        const giftProduct = products.find((x) => x.id === effective.promo.gift_product_id);
        if (giftProduct) {
          newCart = [...newCart, {
            ...giftProduct,
            lineId: `gift::${effective.promo.id}::${lineId}`,
            qty: +effective.promo.gift_qty || 1,
            dose: "",
            price: 0,
            originalPrice: giftProduct.price,
            discountPct: 100,
            discountSource: "manual",
            promoType: "free_gift",
            promoLabel: "🎀 هدية مجانية",
            isGift: true,
            giftFromPromoId: effective.promo.id,
          }];
        }
      }
    }

    return { ...prev, cart: newCart };
  });

  // ── لو الصنف محتاج اختيار تاريخ صلاحية (أكتر من تشغيلة متاحة)، نفتح نافذة الاختيار فورًا ──
  if (needsExpiryChoice) {
    const prodBatches = products.find((x) => x.id === p.id)?.batches || [];
    const validExpiries = Array.from(
      new Set(
        prodBatches
          .filter((b) => b.qty > 0 && b.expiry_date)
          .map((b) => b.expiry_date)
      )
    ).sort();
    setExpiryPickerLine({
      lineId,
      productId: p.id,
      productName: p.nameAr || p.name,
      options: validExpiries,
    });
  }
};
  const scanBarcode = async (scan) => {
    // ── منع تكرار مسح نفس الرقم التسلسلي: كل SN بيمثل علبة فيزيائية واحدة بس ──
    if (scan.serial) {
      // 1) مكرر جوه نفس الفاتورة الحالية (دبل سكان بالغلط)
      // 🆕 لازم نفتش جوه serials[] كمان، مش بس i.serial المفرد — لأن العلبة التانية والتالتة
      // من نفس الصنف بتتجمّع في نفس السطر وسيريالها بيتخزن جوه المصفوفة دي (شوف addToCart).
      const dupInCart = inv.cart.some(
        (i) => (i.serials && i.serials.includes(scan.serial)) || i.serial === scan.serial
      );
      if (dupInCart) {
        playWarningBeep();
        showToast(`⚠️ الرقم التسلسلي (${scan.serial}) اتمسح في الفاتورة دي بالفعل`, "error");
        return;
      }
      // 2) مباع قبل كده في فاتورة تانية ولسه معملوش إرجاع
      const { data: soldRow } = await supabase
        .from("sold_serials")
        .select("invoice_id")
        .eq("pharmacy_id", pharmacyId)
        .eq("serial_number", scan.serial)
        .eq("status", "sold")
        .maybeSingle();
      if (soldRow) {
        playWarningBeep();
        showToast(`⚠️ الرقم التسلسلي (${scan.serial}) مباع بالفعل في فاتورة ${soldRow.invoice_id} — راجع قبل ما تكمل`, "error");
        return;
      }
    }
    let product = null;
    if (scan.type === "gs1" || scan.type === "custom") {
      product =
        scan.type === "gs1"
          ? products.find(
              (x) => normGtin(x.barcode) === normGtin(scan.gtin) || normGtin(x.gtin) === normGtin(scan.gtin)
            )
          : products.find((x) => x.barcode === scan.code || x.id === scan.code);
      if (product) {
        // فاتورة الشراء بقت بتسجل الصلاحية بتاريخ كامل (type="date")، لكن ممكن يفضل
        // في المخزون تشغيلات قديمة متسجلة بدقة الشهر بس ("YYYY-MM") من قبل التغيير ده.
        // فبنقارن بدقة الشهر عشان الاتنين (القديم والجديد) يتطابقوا صح مع الباركود.
        const norm = (v) => (v ? String(v).slice(0, 7) : "");
        const scannedExpiry = norm(scan.expiry);
        const knownBatches = (product.batches || []).filter((b) => b.qty > 0 && b.expiry_date);
        const knownExpiries = knownBatches.map((b) => norm(b.expiry_date));

        // لو الصنف عنده تشغيلات مسجلة بتاريخ صلاحية، والتاريخ اللي قراه الباركود مش
        // مطابق لأي واحدة منها → نرفض ونطلع تنبيه صوتي، بدل ما نبيع بتاريخ غلط.
        if (scannedExpiry && knownExpiries.length && !knownExpiries.includes(scannedExpiry)) {
          playWarningBeep();
          showToast(
            `⚠️ تاريخ الصلاحية على الباركود (${scan.expiry}) مش مطابق لأي تشغيلة مسجلة لـ "${product.name}". تحقق من الصنف أو سجّل التشغيلة الجديدة في فاتورة الشراء الأول.`,
            "error"
          );
          return;
        }

        // 🆕 لازم نستخدم التاريخ الكامل زي ما هو متسجل فعليًا في التشغيلة (batches)، مش
        // النسخة المقصوصة بدقة الشهر - عشان دروب داون اختيار الصلاحية في السلة (اللي
        // بيقارن بالتاريخ الكامل من batches) يلاقيها متطابقة ومايجبرش الكاشير يختارها يدوي.
        const matchedBatch = knownBatches.find((b) => norm(b.expiry_date) === scannedExpiry);
        const finalExpiry = matchedBatch ? matchedBatch.expiry_date : (scannedExpiry || scan.expiry);

        addToCart({
          ...product,
          batch: scan.batch,
          serial: scan.serial,
          expiry: finalExpiry,
          // ✅ الباركود نفسه قرا/أكد تاريخ الصلاحية (واتقارن مع التشغيلات المسجلة فوق)،
          // فمفيش داعي نجبر الكاشير يختار تاني من نافذة الاختيار — بس لو فعلاً في تاريخ مقروء.
          _expiryConfirmed: !!finalExpiry,
        });
        return;
      }
    } else {
      product = products.find(
        (x) => x.barcode === scan.code || x.id === scan.code
      );
      if (product) {
        addToCart(product);
        return;
      }
    }
    // ── الباركود مش متطابق مع أي صنف — بدل ما نرفضه بس، نديله فرصة يتربط بصنف موجود ──
    playWarningBeep();
    setUnmatchedScan({
      gtin: scan.gtin || scan.code || "",
      batch: scan.batch || "",
      expiry: scan.expiry || "",
      serial: scan.serial || "",
    });
    setUnmatchedLinkSearch("");
  };

  // ── ربط باركود جديد (اتقرا بالسكانر ومتلقاش صنف) بصنف موجود عندنا — للحالة اللي الشركة غيّرت الـ GTIN ──
  const linkUnmatchedBarcodeToProduct = async (product) => {
    const newGtin = unmatchedScan.gtin;
    if (!newGtin) return;
    const oldBarcode = product.barcode || "بدون باركود";
    const { error } = await supabase.from("products").update({ barcode: newGtin }).eq("id", product.id).eq("pharmacy_id", pharmacyId);
    if (error) { showToast("خطأ في تحديث الباركود: " + error.message, "error"); return; }
    const updatedProduct = { ...product, barcode: newGtin };
    setProducts((prev) => prev.map((x) => (x.id === product.id ? updatedProduct : x)));
    // نسجل الدفعة (تشغيلة/صلاحية/سيريال) بتاعة السكان ده في product_barcodes لو فيها بيانات
    if (unmatchedScan.batch || unmatchedScan.expiry || unmatchedScan.serial) {
      await supabase.from("product_barcodes").insert({
        product_id: product.id, pharmacy_id: pharmacyId,
        base_barcode: newGtin,
        batch_number: unmatchedScan.batch || null,
        serial_number: unmatchedScan.serial || null,
        expiry_date: unmatchedScan.expiry || null,
      });
    }
    showToast(`✅ تم تحديث باركود "${product.nameAr || product.name}" من (${oldBarcode}) إلى (${newGtin})`, "success");
    const pendingScan = unmatchedScan;
    setUnmatchedScan(null);
    setUnmatchedLinkSearch("");
    const norm = (v) => (v ? String(v).slice(0, 7) : "");
    addToCart({
      ...updatedProduct,
      batch: pendingScan.batch,
      serial: pendingScan.serial,
      expiry: norm(pendingScan.expiry) || pendingScan.expiry,
      _expiryConfirmed: !!pendingScan.expiry,
    });
  };

  const searchLower = (inv.search || "").toLowerCase();
  const filtered = products.filter((p) => {
    if (!searchLower) return true;
    const name = (p.nameAr || p.name || "").toLowerCase();
    const nameEn = (p.nameEn || p.name_en || "").toLowerCase();
    const barcode = (p.barcode || "").toLowerCase();
    const id = (p.id || "").toLowerCase();
    // 🆕 بنبحث في كل مواد التركيبة (full_ingredients_text)، مش بس أول مادة زي قبل كده
    const ingredient = (p.full_ingredients_text || p.active_ingredient || p.activeIngredient || "").toLowerCase();
    const keywords = (p.search_keywords || "").toLowerCase();
    return (
      name.includes(searchLower) ||
      nameEn.includes(searchLower) ||
      barcode.includes(searchLower) ||
      id.includes(searchLower) ||
      ingredient.includes(searchLower) ||
      keywords.includes(searchLower)
    );
  });
  // لو البحث طابق المادة الفعالة (مش الاسم التجاري)، نبرز ده في النتيجة
  // عشان المستخدم يفهم ليه ظهرت أسماء تجارية مختلفة لنفس المادة
  const isIngredientMatch = (p) => {
    const name = (p.nameAr || p.name || "").toLowerCase();
    const nameEn = (p.nameEn || p.name_en || "").toLowerCase();
    const ingredient = (p.full_ingredients_text || p.active_ingredient || p.activeIngredient || "").toLowerCase();
    return (
      searchLower &&
      ingredient.includes(searchLower) &&
      !name.includes(searchLower) &&
      !nameEn.includes(searchLower)
    );
  };

  const subtotal = inv.cart
    .filter((i) => !i.isMissed)
    .reduce((s, i) => s + i.price * i.qty, 0);

  // ── سطور مؤهلة لكسب نقاط الولاء: بنستبعد أي صنف عليه خصم أو عرض (نسبة/BOGO/كمية/باقة) أو هدية ──
  const isPromoLine = (i) => !!(i.discountPct > 0 || i.promoType || i.isGift);
  const pointsEligibleSubtotal = inv.cart
    .filter((i) => !i.isMissed && !i.isJoker && !isPromoLine(i))
    .reduce((s, i) => s + i.price * i.qty, 0);

  const taxAmount = inv.cart
    .filter((i) => !i.isMissed)
    .reduce((s, i) => (i.taxable ? s + i.price * i.qty * TAX_RATE : s), 0);

  const missedTotal = inv.cart
    .filter((i) => i.isMissed)
    .reduce((s, i) => s + i.price * i.qty, 0);

  const discountAmt =
    inv.discountType === "value"
      ? Math.min(Math.max(inv.discount || 0, 0), subtotal + taxAmount)
      : Math.round((((subtotal + taxAmount) * (inv.discount || 0)) / 100) * 100) / 100;

  // ✅ لو تغيّر إجمالي الفاتورة (إضافة/حذف صنف) والمبلغ المُستبدل بقى أكبر من الحد المسموح، نصغّره تلقائياً
  useEffect(() => {
    if (!usePoints) return;
    const maxRedeemable = Math.max(0, Math.min(customerLoyalty?.points || 0, subtotal + taxAmount - discountAmt));
    setPointsToRedeem((prev) => (prev > maxRedeemable ? maxRedeemable : prev));
  }, [usePoints, subtotal, taxAmount, discountAmt, customerLoyalty]);

  // ── الإجمالي بعد خصم نقاط الولاء ──
  const pointsDiscount = usePoints ? pointsToRedeem : 0;
  const total = Math.max(0, subtotal + taxAmount - discountAmt - pointsDiscount);

  const completeSale = async () => {
    if (!currentShift) {
      showToast("يرجى فتح شفت أولاً", "error");
      return;
    }
    if (inv.cart.length === 0) {
      showToast("السلة فارغة!", "error");
      return;
    }

    // ✅ لو الصنف له أكتر من تاريخ صلاحية في المخزون، لازم يتحدد تاريخ الصلاحية قبل حفظ الفاتورة
    for (const ci of inv.cart) {
      if (ci.isMissed || ci.isJoker) continue;
      const prod = products.find((x) => x.id === ci.id);
      const expiryOptions = Array.from(
        new Set(
          (prod?.batches || [])
            .filter((b) => b.qty > 0 && b.expiry_date)
            .map((b) => b.expiry_date)
        )
      );
      if (expiryOptions.length > 1 && !ci.expiry) {
        showToast(`اختر تاريخ الصلاحية للصنف "${ci.name}" قبل حفظ الفاتورة`, "error");
        return;
      }
    }

    if (inv.paymentMode === "single" && inv.payment === "آجل" && !inv.selCustomer) {
      showToast("لا يمكن تسجيل بيع آجل لزبون عادي — اختر عميلاً أولاً", "error");
      return;
    }

    if (inv.paymentMode === "split") {
      const { card, transfer } = inv.splitPayment;
      const cash = Math.round((total - card - transfer) * 100) / 100;
      if (cash < 0) {
        showToast("مجموع البطاقة والتحويل أكبر من الإجمالي", "error");
        return;
      }
    }

    const id =
      "INV-" +
      new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, "")
        .slice(0, 14);

    // بنمرر تاريخ الصلاحية المحدد في السطر (preferredExpiry) عشان الخصم يحصل من التشغيلة الصح.
    // ولو نفس الصنف موجود في أكتر من سطر في نفس الفاتورة (بتواريخ مختلفة)، بنمرر التشغيلات
    // المتبقية من السطر الأول للسطر اللي بعده (runningBatches) عشان مانخصمش نفس الكمية مرتين.
    const newFifoResults = {};
    const runningBatches = {};
    for (const ci of inv.cart) {
      const prod = products.find((x) => x.id === ci.id);
      if (prod) {
        const baseProd = runningBatches[ci.id]
          ? { ...prod, batches: runningBatches[ci.id] }
          : prod;
        const result = sellFromBatches(baseProd, +ci.qty, ci.expiry || null, ci.batch || null);
        newFifoResults[ci.lineId] = result;
        runningBatches[ci.id] = result.updatedBatches;
      }
    }
    setFifoResults(newFifoResults);

    const invoice = {
      id,
      date: todayLocal(),
      created_at: new Date().toISOString(),
      customer: inv.selCustomer?.id || null,
      customer_name: inv.selCustomer?.name || "زبون عادي",
      items: inv.cart.map((i) => ({
        id: i.id,
        name: i.name,
        qty: +i.qty,
        // مهم: السعر المحفوظ لازم يكون سعر سطر السلة (i.price) لأنه هو اللي فيه أي عرض مطبّق
        // (نسبة/BOGO/كمية/باقة...). سعر التشغيلة (salePrice) بيرجع سعر التشغيلة الأصلي في المخزون
        // ومفيهوش أي خصم، فاستخدامه هنا كان بيلغي العرض عند حفظ الفاتورة.
        price: i.price,
        cost:
          newFifoResults[i.lineId]?.soldBatches?.[0]?.cost ??
          products.find((x) => x.id === i.id)?.cost ??
          0,
        taxable: i.taxable,
        dose: i.dose,
        gtin: i.gtin || i.barcode,
        batch: i.batch || null,
        serial: i.serial || null,
        // 🆕 لو السطر ده فيه أكتر من علبة اتمسحت (سيريالات متعددة)، نحفظهم كلهم —
        // مش بس أول واحد — عشان المرتجعات ورصد يقدروا يتعاملوا مع كل علبة لوحدها.
        serials: i.serials && i.serials.length ? i.serials : (i.serial ? [i.serial] : []),
        isMissed: !!i.isMissed,
        isJoker: !!i.isJoker,
        expiry:
          i.expiry ||
          newFifoResults[i.lineId]?.soldBatches?.[0]?.expiry_date ||
          null,
        category: i.main_category || i.mainCategory || i.category || "أخرى",
        excluded_from_points: isPromoLine(i) || !!i.isJoker || !!i.isMissed,
      })),
      subtotal,
      tax_amount: taxAmount,
      discount_amt: discountAmt,
      discount_type: inv.discountType,
      total,
      payment: inv.paymentMode === "split" ? "مختلط" : inv.payment,
      payment_split: inv.paymentMode === "split" ? {
        card: inv.splitPayment.card,
        transfer: inv.splitPayment.transfer,
        cash: Math.round((total - inv.splitPayment.card - inv.splitPayment.transfer) * 100) / 100,
      } : null,
      shift: currentShift?.id,
      returned: false,
      pharmacy_id: pharmacyId,
      cashier_name: currentUser?.name || "",
      cashier_user_id: currentUser?.id || null,
      points_redeemed: pointsDiscount > 0 ? pointsDiscount : null,
    };

    // ── زاتكا Phase 1: توليد UUID/ICV/PIH + XML + Hash قبل الحفظ ──
    // لو حصل أي عطل هنا (مثلاً الشبكة وقت حساب الـ chain)، الفاتورة تتحفظ عادي
    // بدون حقول زاتكا بدل ما نمنع الكاشير من إتمام البيع، ونسجلها في الـ console للمتابعة.
    try {
      const zatcaFields = await buildZatcaChainForInvoice({
        pharmacyId,
        invoiceId: invoice.id,
        sellerName: pharmSettingsPOS?.name_ar || pharmSettingsPOS?.name_en || "",
        vatNumber: pharmSettingsPOS?.tax_number || "",
        sellerAddress: pharmSettingsPOS?.address || "",
        items: invoice.items.filter((it) => !it.isMissed && !it.isJoker),
        subtotal,
        taxAmount,
        discountAmt,
        total,
        createdAt: invoice.created_at,
      });
      Object.assign(invoice, zatcaFields);
    } catch (zErr) {
      console.error("zatca chain build failed:", zErr);
    }

    const { error: saleError } = await supabase.from("sales").insert(invoice);
    if (saleError) {
      showToast("فشل حفظ الفاتورة: " + saleError.message, "error");
      return;
    }

    // 🆕 تسجيل كل سيريال اتباع في الفاتورة دي — أساس منع تكرار بيع نفس العلبة تاني
    // ✅ نفرد كل سطر لكل السيريالات اللي فيه (سطر ممكن يمثل أكتر من علبة اتمسحت)، مش بس أول واحد
    const soldSerialRows = inv.cart.flatMap((i) => {
      const serials = i.serials && i.serials.length ? i.serials : (i.serial ? [i.serial] : []);
      return serials.map((sn) => ({
        serial_number: sn,
        product_id: i.id,
        pharmacy_id: pharmacyId,
        invoice_id: id,
        status: "sold",
        sold_at: new Date().toISOString(),
      }));
    });
    if (soldSerialRows.length) {
      const { error: serialError } = await supabase.from("sold_serials").insert(soldSerialRows);
      if (serialError) {
        // الفاتورة اتحفظت بنجاح؛ فشل تسجيل التتبع لوحده ميوقفش البيع، بس ننبّه الكاشير يراجعه
        showToast("⚠️ الفاتورة اتحفظت، لكن تسجيل تتبع السيريال فشل: " + serialError.message, "warning");
      }
    }

   // ── تحديث المخزون عن طريق stock movement events بدل الكتابة المباشرة ──
    // كده نفس المسار (RPC آمن، idempotent) بيتستخدم أونلاين وأوفلاين، ومفيش خطر
    // إن جهازين يكتبوا فوق بعض (last-write-wins) لو حصل تزامن بينهم.
    alert("وصلنا لكود stockEvents");
    const stockEvents = [];
    for (const ci of inv.cart) {
      if (ci.isMissed || ci.isJoker) continue;
      const result = newFifoResults[ci.lineId];
      if (!result) continue;
      result.soldBatches.forEach((b) => {
        stockEvents.push({
          id: crypto.randomUUID(),
          pharmacy_id: pharmacyId,
          product_id: ci.id,
          batch_id: b.id || null,
          expiry_date: b.expiry_date || null,
          delta: -b.qtySold,
          movement_type: "sale",
          reference_id: id,
          created_at: new Date().toISOString(),
          device_id: getDeviceId(),
        });
      });
    }

    if (stockEvents.length > 0) {
      // فحص أولي: الجهاز متصل بالنت ولا لأ (مش دقيق 100% لكنه أول خط دفاع)
      const isOnline = navigator.onLine;

      if (isOnline) {
        try {
          const { data: syncResults, error: syncError } = await supabase
            .rpc("apply_stock_movements_batch", { p_events: stockEvents });

          if (syncError) {
            // ده خطأ راجع من السيرفر نفسه (مش قطع نت) - نعرضه زي ما كان بالظبط
            showToast("خطأ في تحديث المخزون: " + syncError.message, "error");
          } else {
            const failed = (syncResults?.results || []).filter((r) => r.status === "error");
            if (failed.length > 0) {
              showToast(`⚠️ فشل تحديث ${failed.length} تشغيلة أثناء البيع — راجع المخزون`, "warning");
            }
          }
        } catch (networkError) {
          // الطلب اتبعت فعلاً بس فشل وصوله (النت اتقطع أثناء الإرسال نفسه)
          // بدل ما نضيّع حركة المخزون، نسجلها محليًا كـ event واحد بنفس شكل الـ batch
          // عشان لما النت يرجع، سكريبت المزامنة يبعتها لـ apply_stock_movements_batch بنفس الطريقة بالظبط
          await window.offlineAPI.queueEvent({
            id: crypto.randomUUID(),
            type: "SALE_STOCK_BATCH",
            timestamp: new Date().toISOString(),
            payload: { events: stockEvents },
          });
          showToast("⚠️ انقطع الاتصال أثناء الإرسال - تم حفظ حركة المخزون محليًا وهتتزامن تلقائيًا", "warning");
        }
      } else {
        // مفيش نت من الأساس - نسجل الحدث محليًا على طول من غير أي محاولة اتصال
        await window.offlineAPI.queueEvent({
          id: crypto.randomUUID(),
          type: "SALE_STOCK_BATCH",
          timestamp: new Date().toISOString(),
          payload: { events: stockEvents },
        });
        showToast("📴 وضع الأوفلاين - تم حفظ حركة المخزون محليًا", "warning");
      }
    }
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    // ✅ كل علبة (سيريال) لازم PRODUCT node مستقل في رصد — مش سطر واحد بكمية 2 وسيريال واحد بس
    // 🆕 رصد بيغطي الدواء بس. لازم فلتر صريح بالفئة هنا (مش الاعتماد بس على وجود serial)،
    // لأن بعض الأصناف غير الدوائية باركودها ممكن يتفهم غلط كـ GS1 ويطلع منه serial،
    // فكنا هنرفعها لرصد غلط لمجرد إنها عندها serial.
    const rasdSaleItems = inv.cart
      .filter((i) => (i.category || i.main_category || i.mainCategory) === "دواء")
      .flatMap((i) => {
        const serials = i.serials && i.serials.length ? i.serials : (i.serial ? [i.serial] : []);
        return serials.map((sn) => ({
          gtin: i.gtin || i.barcode,
          serial: sn,
          batch: i.batch,
          expiry: i.expiry,
        }));
      });
    if (rasdConfig.enabled && rasdSaleItems.length > 0) {
      // بنسجلها في الطابور بدل ما نستنى رد رصد فورًا — كده البيع ميتأخرش لو رصد بطيء أو واقع
      RasdQueue.enqueue("sale", {
        toGln: "0000000000000", // بيع مباشر للمريض (مش عن طريق جهة تسديد)
        prescriptionId: String(invoice.id ?? invoice.invoiceNumber ?? Date.now()),
        prescriptionDate: new Date().toISOString().slice(0, 10),
        items: rasdSaleItems,
      });
    }

    setSales((p) => [...p, invoice]);

    // ── استبدال نقاط في الفاتورة ──
    if (usePoints && pointsToRedeem > 0 && inv.selCustomer?.id) {
      const prev = customerLoyalty || { points: 0, total_earned: 0, total_redeemed: 0 };
      await supabase.from("loyalty_points").upsert({
        pharmacy_id: pharmacyId,
        customer_id: inv.selCustomer.id,
        points: Math.max(0, (prev.points || 0) - pointsToRedeem),
        total_earned: prev.total_earned || 0,
        total_redeemed: (prev.total_redeemed || 0) + pointsToRedeem,
        updated_at: new Date().toISOString(),
      }, { onConflict: "pharmacy_id,customer_id" });

      await supabase.from("loyalty_transactions").insert({
        pharmacy_id: pharmacyId,
        customer_id: inv.selCustomer.id,
        type: "redeem",
        amount: -pointsToRedeem,
        ref_sale_id: invoice.id,
        note: `استبدال نقاط في فاتورة ${invoice.id}`,
      });

      setUsePoints(false);
      setPointsToRedeem(0);
      setCustomerLoyalty(null);
    }

    // ── كسب نقاط الولاء ──
    if (inv.selCustomer?.id) {
      const ls = loyaltySettings || await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle()
        .then(({ data }) => data);

      if (ls) {
        let points = 0;
        // ✅ الأصناف اللي عليها خصم أو عرض (أو هدية) مستبعدة من احتساب النقاط
        const eligibleItems = invoice.items.filter((it) => !it.excluded_from_points);
        if (ls.mode === "profit") {
          const profit = eligibleItems.reduce((sum, it) => {
            return sum + (it.price - (it.cost || 0)) * (it.qty || 0);
          }, 0) - (invoice.discount_amt || 0);
          points = Math.max(0, profit * (ls.profit_rate / 100));
        } else {
          points = Math.floor(pointsEligibleSubtotal / ls.sales_per) * ls.sales_rate;
        }

        if (points > 0) {
          const { data: current } = await supabase
            .from("loyalty_points")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .eq("customer_id", inv.selCustomer.id)
            .maybeSingle();

          const prev = current || { points: 0, total_earned: 0, total_redeemed: 0 };

          await supabase.from("loyalty_points").upsert({
            pharmacy_id: pharmacyId,
            customer_id: inv.selCustomer.id,
            points: (prev.points || 0) + points,
            total_earned: (prev.total_earned || 0) + points,
            total_redeemed: prev.total_redeemed || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "pharmacy_id,customer_id" });

          await supabase.from("loyalty_transactions").insert({
            pharmacy_id: pharmacyId,
            customer_id: inv.selCustomer.id,
            type: "earn",
            amount: points,
            ref_sale_id: invoice.id,
            earned_mode: ls.mode,
            note: `نقاط مكتسبة من فاتورة ${invoice.id}`,
          });

          showToast(`🌟 ${inv.selCustomer.name} كسب ${points.toFixed(1)} ريال نقاط`);
        }
      }
    }

    setProducts((p) =>
      p.map((x) => {
        const ci = inv.cart.find((i) => i.id === x.id && !i.isMissed);
        if (!ci) return x;
        const { updatedBatches } = newFifoResults[x.id] || {};
        return {
          ...x,
          stock: x.stock - ci.qty,
          batches: updatedBatches ?? x.batches ?? [],
          price: updatedBatches?.[0]?.salePrice ?? x.price,
        };
      })
    );

    const missedItems = inv.cart.filter((i) => i.isMissed);
    if (missedItems.length > 0) {
      const missedRecords = missedItems.map((i) => ({
        id: "MS-" + Date.now() + "-" + i.id,
        date: todayLocal(),
        product_id: i.id,
        product_name: i.nameAr || i.name,
        price: i.price,
        qty: i.qty,
        reason: i.missedReason || "غير محدد",
        notes: i.notes || "",
        shift: currentShift?.id,
        cashier: currentUser?.name,
        pharmacy_id: pharmacyId,
        customer_id: inv.selCustomer?.id || null,
        customer_name: inv.selCustomer?.name || null,
      }));
      await supabase.from("missed_sales").insert(missedRecords);
    }

    // 🆕 كل صنف جوكر (بفئته اللي اتحددت) بيتسجل كسطر معلّق في طلبات الشراء —
    // لو نفس الجوكر (نفس الاسم والفئة) اتسجل قبل كده وبردو لسه معلّق (pending)، بنجمع الكمية على نفس الصف
    // بدل ما نكرر صف جديد كل مرة — عشان جدول المراجعة يفضل نضيف وميتكررش فيه نفس الصنف عشرات المرات
    const jokerItems = inv.cart.filter((i) => i.isJoker);
    if (jokerItems.length > 0) {
      const normName = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
      let workingJokerList = [...jokerPendingItems];
      for (const i of jokerItems) {
        const name = i.nameAr || i.name;
        const cat = i.jokerCategory || null;
        const existing = workingJokerList.find(
          (j) => j.status === "pending" && j.pharmacy_id === pharmacyId && normName(j.name) === normName(name) && (j.category || null) === cat
        );
        if (existing) {
          const newQty = (+existing.qty || 0) + (+i.qty || 1);
          await supabase.from("joker_pending_items").update({ qty: newQty }).eq("id", existing.id);
          workingJokerList = workingJokerList.map((j) => (j.id === existing.id ? { ...j, qty: newQty } : j));
        } else {
          const record = {
            pharmacy_id: pharmacyId,
            name,
            category: cat,
            qty: i.qty || 1,
            price: i.price || 0,
            status: "pending",
            created_at: new Date().toISOString(),
          };
          // 🛠️ لازم نسيب عمود id لقاعدة البيانات تولده (uuid تلقائي) - قبل كده كان بيتبعت
          // نص من نوع "JK-...-..." وده مش uuid صحيح فكان الـ insert بيفشل بـ 400 (22P02)
          // ونستخدم select().single() عشان نرجع الصف باللي فيه الـ id الحقيقي.
          const { data: inserted, error: jokerErr } = await supabase
            .from("joker_pending_items")
            .insert(record)
            .select()
            .single();
          if (!jokerErr && inserted) workingJokerList = [...workingJokerList, inserted];
        }
      }
      setJokerPendingItems(workingJokerList);
    }

    setInv({ ...emptyInvoice(), success: true });
    setTimeout(() => setInv((p) => ({ ...p, success: false })), 2000);
    setShowPrint({ ...invoice, customer_phone: inv.selCustomer?.phone || null });
    showToast("تمت عملية البيع ✓");
  };

  return (
    <div
      style={{
        height: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {invoices.map((inv, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 0 }}
          >
            <button
              onClick={() => setActiveTab(i)}
              style={{
                padding: "7px 16px",
                borderRadius: "9px 0 0 9px",
                background: activeTab === i ? COLORS.blueSoft : COLORS.surfaceAlt,
                border: `1px solid ${activeTab === i ? COLORS.blue : COLORS.border}`,
                borderLeft: "none",
                color: activeTab === i ? COLORS.blue : COLORS.textDim,
                fontWeight: activeTab === i ? 700 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              فاتورة {i + 1} {inv.cart.length > 0 ? `(${inv.cart.length})` : ""}
            </button>
            <button
              onClick={() => closeTab(i)}
              style={{
                padding: "7px 8px",
                borderRadius: "0 9px 9px 0",
                background: activeTab === i ? COLORS.blueSoft : COLORS.surfaceAlt,
                border: `1px solid ${activeTab === i ? COLORS.blue : COLORS.border}`,
                color: COLORS.red,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {invoices.length < MAX_INVOICES && (
          <button
            onClick={addTab}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: `1px dashed ${tint(COLORS.blue,0.35)}`,
              color: COLORS.border,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            + فاتورة جديدة
          </button>
        )}
      </div>

      {autoSaveWarning && (
        <div
          style={{
            background: COLORS.goldSoft,
            border: `1px solid ${tint(COLORS.coral,0.35)}`,
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: COLORS.gold,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          <span>
            ⚠️ الفاتورة مفتوحة أكثر من 10 دقائق — سيتم التنبيه خلال{" "}
            {Math.floor(autoSaveCountdown / 60)}:
            {String(autoSaveCountdown % 60).padStart(2, "0")}
          </span>
          <button
            onClick={() => setAutoSaveWarning(false)}
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.gold,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* بحث */}
        <div
          style={{
            padding: "6px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: 8,
            flexShrink: 0,
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <BarcodeScanner
              ref={barcodeInputRef}
              onScan={scanBarcode}
              placeholder="امسح باركود الصنف..."
            />
          </div>
          <div style={{ flex: 1.4, minWidth: 0, position: "relative", display: "flex", gap: 6 }}>
            <input
              value={inv.search}
              onChange={(e) => {
                setInv((p) => ({ ...p, search: e.target.value }));
                setHighlightedIdx(-1);
              }}
              onKeyDown={(e) => {
                const list = filtered.slice(0, 8);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIdx((prev) =>
                    Math.min(prev + 1, list.length - 1)
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIdx((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const target =
                    highlightedIdx >= 0 ? list[highlightedIdx] : list[0];
                  if (target) {
                    addToCart({ ...target, isPartial: false });
                    setInv((p) => ({ ...p, search: "" }));
                    setHighlightedIdx(-1);
                  }
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const target =
                    highlightedIdx >= 0 ? list[highlightedIdx] : list[0];
                  if (target) {
                    addToCart({ ...target, isMissed: true, qty: 1 });
                    setInv((p) => ({ ...p, search: "" }));
                    setHighlightedIdx(-1);
                  }
                } else if (e.key === "Escape") {
                  setInv((p) => ({ ...p, search: "" }));
                  setHighlightedIdx(-1);
                }
              }}
              placeholder="🔍 ابحث بالاسم التجاري أو العلمي أو الباركود..."
              style={{
                flex: 1,
                minWidth: 0,
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "9px 14px",
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setInv((p) => ({ ...p, showJoker: true }))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: COLORS.goldSoft,
                border: `1px solid ${tint(COLORS.gold,0.35)}`,
                color: COLORS.gold,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              + جوكر
            </button>
            {inv.showJoker && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  left: 0,
                  zIndex: 200,
                  background: "#0d1829",
                  border: `1px solid ${tint(COLORS.gold,0.35)}`,
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    color: COLORS.gold,
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  ⚠ صنف جوكر (فرصة ضائعة)
                </div>
                <input
                  placeholder="اسم الصنف..."
                  value={inv.jokerName}
                  onChange={(e) =>
                    setInv((p) => ({ ...p, jokerName: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                />
                <input
                  type="number"
                  placeholder="السعر..."
                  value={inv.jokerPrice}
                  onChange={(e) =>
                    setInv((p) => ({ ...p, jokerPrice: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                />
                <select
                  value={inv.jokerCategory}
                  onChange={(e) =>
                    setInv((p) => ({ ...p, jokerCategory: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                >
                  <option value="">اختر الفئة الرئيسية...</option>
                  {Object.keys(MAIN_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      if (!inv.jokerName || !inv.jokerPrice) return;
                      if (!inv.jokerCategory) { showToast("لازم تحدد الفئة الرئيسية للصنف الجوكر عشان يدخل طلب الشراء الصح", "error"); return; }
                      addToCart({
                        id: "JOKER-" + Date.now(),
                        name: inv.jokerName,
                        nameAr: inv.jokerName,
                        price: +inv.jokerPrice,
                        stock: 99,
                        taxable: false,
                        isMissed: true,
                        isJoker: true,
                        qty: 1,
                        category: "جوكر",
                        jokerCategory: inv.jokerCategory,
                      });
                      setInv((p) => ({
                        ...p,
                        showJoker: false,
                        jokerName: "",
                        jokerPrice: "",
                        jokerCategory: "",
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      background: COLORS.goldSoft,
                      border: `1px solid ${tint(COLORS.gold,0.35)}`,
                      borderRadius: 7,
                      color: COLORS.gold,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    إضافة
                  </button>
                  <button
                    onClick={() => setInv((p) => ({ ...p, showJoker: false }))}
                    style={{
                      padding: "7px 14px",
                      background: "transparent",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 7,
                      color: COLORS.textDim,
                      cursor: "pointer",
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
            {inv.search && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  left: 0,
                  background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  zIndex: 100,
                  maxHeight: 240,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    padding: "5px 14px",
                    fontSize: 10,
                    color: COLORS.textDim,
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: "#0a121f",
                  }}
                >
                  ↓↑ تنقل · Enter إضافة · Esc إلغاء
                </div>
                {filtered.slice(0, 8).map((p, idx) => {
                  const effectiveStock =
                    p.saleUnits > 1 ? p.stock * p.saleUnits : p.stock;
                  const outOfStock = effectiveStock <= 0;
                  const stockColor = outOfStock
                    ? COLORS.red
                    : p.stock <= (p.minStock || 0)
                    ? COLORS.gold
                    : COLORS.green;
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: "7px 14px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${COLORS.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background:
                          idx === highlightedIdx ? COLORS.surfaceAlt : "transparent",
                      }}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onMouseLeave={() => setHighlightedIdx(-1)}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: stockColor,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: COLORS.textPrimary,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.nameAr || p.name}
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim }}>
                            {p.mainCategory || p.category} · مخزون: {p.stock}
                            {p.saleUnits > 1 && (
                              <span style={{ color: COLORS.gold }}>
                                {" "}
                                ÷{p.saleUnits}
                              </span>
                            )}
                            {(p.full_ingredients_text || p.active_ingredient || p.activeIngredient) && (
                              <span style={{ color: isIngredientMatch(p) ? COLORS.blue : COLORS.textDim, fontWeight: isIngredientMatch(p) ? 700 : 400 }}>
                                {" "}· {p.full_ingredients_text || p.active_ingredient || p.activeIngredient}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {outOfStock ? (
                          <button
                            onClick={() => {
                              addToCart({ ...p, isMissed: true, qty: 1 });
                              setInv((x) => ({ ...x, search: "" }));
                            }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: COLORS.goldSoft,
                              border: `1px solid ${tint(COLORS.gold,0.35)}`,
                              color: COLORS.gold,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            title="تسجيل كفرصة ضائعة"
                          >
                            ⚠ فائت
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                addToCart({ ...p, isPartial: false });
                                setInv((x) => ({ ...x, search: "" }));
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: COLORS.blueSoft,
                                border: `1px solid ${tint(COLORS.blue,0.35)}`,
                                color: COLORS.blue,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {(() => {
                                const eff = getEffectivePrice(p, promos, discountRules, productEarliestExpiry, products, sales, autoPromoConfig);
                                return eff.discountPct > 0 ? (
                                  <span>
                                    <span style={{ textDecoration: "line-through", color: COLORS.textDim, fontSize: 10, marginLeft: 4 }}>{p.price?.toFixed(2)}</span>
                                    <span style={{ color: COLORS.green }}> {eff.price?.toFixed(2)} ر.س</span>
                                    <span style={{ background: COLORS.coral, color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 10, marginRight: 4 }}>-{eff.discountPct}%</span>
                                  </span>
                                ) : (
                                  <span>{p.price?.toFixed(2)} ر.س</span>
                                );
                              })()}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div
                    style={{
                      padding: 12,
                      color: COLORS.textDim,
                      textAlign: "center",
                    }}
                  >
                    لا يوجد نتائج
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
       {/* العميل — search بدل dropdown */}
        <div
          style={{
            padding: "6px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={inv.customerSearch ?? (inv.selCustomer ? inv.selCustomer.name : "")}
              onChange={(e) => {
                setInv((p) => ({
                  ...p,
                  customerSearch: e.target.value,
                  selCustomer: e.target.value === "" ? null : p.selCustomer,
                  payment: e.target.value === "" && p.payment === "آجل" ? "نقدي" : p.payment,
                }));
              }}
              onFocus={() => setInv((p) => ({ ...p, customerSearchOpen: true }))}
              onBlur={() => setTimeout(() => setInv((p) => ({ ...p, customerSearchOpen: false })), 150)}
              placeholder="🔍 ابحث عن عميل بالاسم أو الجوال..."
              style={{
                width: "100%",
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${inv.selCustomer ? COLORS.blue : COLORS.border}`,
                borderRadius: 8,
                padding: "7px 10px",
                color: COLORS.textPrimary,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {/* زر مسح العميل */}
            {inv.selCustomer && (
              <button
                onClick={() => {
                  setInv((p) => ({
                    ...p,
                    selCustomer: null,
                    customerSearch: "",
                    payment: p.payment === "آجل" ? "نقدي" : p.payment,
                  }));
                  setCustomerLoyalty(null);
                  setUsePoints(false);
                  setPointsToRedeem(0);
                }}
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: COLORS.red,
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
            {/* Dropdown النتائج */}
            {inv.customerSearchOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                left: 0,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                zIndex: 200,
                maxHeight: 220,
                overflowY: "auto",
                marginTop: 4,
                boxShadow: "0 8px 24px #0006",
              }}>
                {/* زبون عادي دايماً أول خيار */}
                <div
                  onMouseDown={() => {
                    setInv((p) => ({
                      ...p,
                      selCustomer: null,
                      customerSearch: "",
                      payment: p.payment === "آجل" ? "نقدي" : p.payment,
                      customerSearchOpen: false,
                    }));
                    setCustomerLoyalty(null);
                    setUsePoints(false);
                    setPointsToRedeem(0);
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.textDim,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>👤</span> زبون عادي
                </div>
                {customers
                  .filter((c) => {
                    const q = (inv.customerSearch || "").toLowerCase();
                    if (!q) return true;
                    return (
                      (c.name || "").toLowerCase().includes(q) ||
                      (c.phone || "").includes(q) ||
                      (c.taxId || "").includes(q)
                    );
                  })
                  .slice(0, 10)
                  .map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={async () => {
                        setInv((p) => ({
                          ...p,
                          selCustomer: c,
                          customerSearch: c.name,
                          customerSearchOpen: false,
                        }));
                        // جلب نقاط العميل وإعدادات الولاء
                        const [lpRes, lsRes] = await Promise.all([
                          supabase.from("loyalty_points").select("*")
                            .eq("pharmacy_id", pharmacyId)
                            .eq("customer_id", c.id).maybeSingle(),
                          supabase.from("loyalty_settings").select("*")
                            .eq("pharmacy_id", pharmacyId).maybeSingle(),
                        ]);
                        setCustomerLoyalty(lpRes.data);
                        setLoyaltySettings(lsRes.data);
                        setUsePoints(false);
                        setPointsToRedeem(0);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: `1px solid ${COLORS.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
                          {c.name}
                        </div>
                        {(c.phone || c.taxId) && (
                          <div style={{ fontSize: 11, color: COLORS.textDim }}>
                            {c.phone && <span>{c.phone}</span>}
                            {c.phone && c.taxId && <span> · </span>}
                            {c.taxId && <span>{c.taxId}</span>}
                          </div>
                        )}
                      </div>
                      {c.credit > 0 && (
                        <span style={{
                          fontSize: 11,
                          background: COLORS.redSoft,
                          color: COLORS.red,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontWeight: 700,
                        }}>
                          آجل: {c.credit?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                {customers.filter((c) => {
                  const q = (inv.customerSearch || "").toLowerCase();
                  if (!q) return true;
                  return (
                    (c.name || "").toLowerCase().includes(q) ||
                    (c.phone || "").includes(q) ||
                    (c.taxId || "").includes(q)
                  );
                }).length === 0 && (
                  <div style={{ padding: 12, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>
                    لا يوجد عملاء مطابقون
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => fileRef.current.click()}
            style={{
              padding: "7px 12px",
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: `1px dashed ${tint(COLORS.blue,0.35)}`,
              borderRadius: 8,
              color: inv.prescriptionImg ? COLORS.green : COLORS.textDim,
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {inv.prescriptionImg ? "✓ وصفة" : "📎 وصفة"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const r = new FileReader();
              r.onload = (ev) =>
                setInv((p) => ({ ...p, prescriptionImg: ev.target.result }));
              r.readAsDataURL(file);
            }}
          />
        </div>

        {/* اسم المريض — يُفترض إنه نفس العميل إلا لو اتكتب مختلف */}
        <div
          style={{
            padding: "0 16px 6px",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <input
            value={inv.patientName || ""}
            onChange={(e) => setInv((p) => ({ ...p, patientName: e.target.value }))}
            placeholder={`👤 اسم المريض (اتركه فاضي لو هو نفس ${inv.selCustomer?.name || "العميل"})`}
            style={{
              width: "100%",
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              color: COLORS.textPrimary,
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* السلة */}
        <div
          style={{
            height: CART_AREA_HEIGHT,
            minHeight: CART_AREA_HEIGHT,
            maxHeight: CART_AREA_HEIGHT,
            flexShrink: 0,
            overflowY: "auto",
            padding: "6px 16px",
          }}
        >
          {inv.cart.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: COLORS.surfaceAlt,
                padding: "60px 0",
                fontSize: 14,
              }}
            >
              <IC n="cart" s={50} />
              <br />
              <br />
              ابحث عن صنف أو امسح الباركود لإضافته
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i === 0 ? "right" : "center",
                        padding: "8px 4px",
                        color: COLORS.textDim,
                        fontSize: 12,
                        fontWeight: 600,
                        position: "sticky",
                        top: 0,
                        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
  {inv.cart.map((item) => {
    const step = item.saleUnits > 1 ? 1 / item.saleUnits : 1;
    const maxQty = products.find(x => x.id === item.id)?.stock || 99;
    // 🆕 السعر المعروض في صف السلة لازم يكون شامل الضريبة (زي سعر الرف/الملصق)،
    // ده مجرد عرض بصري بس - القيمة الأصلية (item.price) فاضلة زي ما هي وتحتها
    // بيتحسب "قبل الضريبة" و"ضريبة 15%" و"الإجمالي" في فوتر الفاتورة عادي.
    const taxFactor = item.taxable ? 1.15 : 1;
    const displayPrice = (item.unitPrice ?? item.price) * taxFactor;
    const displayTotal = item.price * item.qty * taxFactor;

    return (
      <tr key={item.lineId} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <td style={{ padding: "8px 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}{item.isGift && <span style={{ color: COLORS.green, fontSize: 11, marginRight: 6 }}>🎀 هدية</span>}</div>
          {item.discountPct > 0 && (
            <div style={{ fontSize: 10, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ background: item.discountSource === "auto" ? COLORS.coral : COLORS.blue, color: "#fff", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>
                -{item.discountPct}% {item.discountSource === "auto" ? "⏰" : "✋"}
              </span>
              {item.originalPrice && item.originalPrice !== item.price && (
                <span style={{ textDecoration: "line-through", color: COLORS.textDim }}>{item.originalPrice?.toFixed(2)}</span>
              )}
            </div>
          )}
          {!item.discountPct && item.promoType && ["bogo", "quantity", "bundle"].includes(item.promoType) && (
            <div style={{ fontSize: 10, marginTop: 1 }}>
              <span style={{ background: COLORS.blue, color: "#fff", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>
                🏷️ {item.promoLabel}
              </span>
            </div>
          )}
          {(item.discountPct > 0 || item.promoType || item.isGift) && (
            <div style={{ fontSize: 9.5, marginTop: 1, color: COLORS.textDim }}>
              🚫 مستبعد من نقاط الولاء
            </div>
          )}
          <input
            value={item.dose}
            onChange={(e) => setInv((p) => ({
              ...p,
              cart: p.cart.map((i) => i.lineId === item.lineId ? { ...i, dose: e.target.value } : i),
            }))}
            placeholder="الجرعة..."
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${tint(COLORS.blue,0.35)}`, color: COLORS.textDim, fontSize: 11, outline: "none", padding: "2px 0" }}
          />
          <button
            onClick={() => setDoseLabelItem({
              ...item,
              _dose: item.dose || "",
              _notes: item.notes || "",
              _afterOpening: "",
              _labelSize: "80x60",
            })}
            title="طباعة ملصق جرعة أكبر يشمل بيانات الصيدلية والصلاحية"
            style={{
              background: "transparent", border: "none", color: COLORS.blue, cursor: "pointer",
              fontSize: 11, marginTop: 2, padding: 0, display: "flex", alignItems: "center", gap: 3,
            }}
          >
            🏷️ ملصق جرعة
          </button>
          {!item.isMissed && !item.isJoker && (() => {
            const prodBatches = products.find((x) => x.id === item.id)?.batches || [];
            const expiryOptions = Array.from(
              new Set(
                prodBatches
                  .filter((b) => b.qty > 0 && b.expiry_date)
                  .map((b) => b.expiry_date)
              )
            ).sort();

            if (expiryOptions.length === 0) return null;

            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: COLORS.gold, flexShrink: 0 }}>⏰</span>
                <select
                  value={item.expiry || ""}
                  onChange={(e) => {
                    const newExpiry = e.target.value;
                    setInv((p) => ({
                      ...p,
                      cart: p.cart.map((i) =>
                        i.lineId === item.lineId
                          ? {
                              ...i,
                              expiry: newExpiry,
                              // تحديث lineId عشان لو اتضاف نفس الصنف بنفس التاريخ الجديد يتجمع صح
                              lineId: `${i.id}::${newExpiry || ""}::${i.batch || ""}`,
                            }
                          : i
                      ),
                    }));
                  }}
                  title="اختر التشغيلة (تاريخ الصلاحية) اللي هتبيع منها — القائمة بتعرض التشغيلات الموجودة فعلاً في المخزون بس"
                  style={{ background: "transparent", border: "none", borderBottom: `1px solid ${tint(COLORS.blue,0.35)}`, color: COLORS.gold, fontSize: 10, outline: "none", padding: "1px 0", colorScheme: "dark" }}
                >
                  {!expiryOptions.includes(item.expiry) && (
                    <option value="">اختر تاريخ الصلاحية...</option>
                  )}
                  {expiryOptions.map((exp) => (
                    <option key={exp} value={exp}>{exp}</option>
                  ))}
                </select>
              </div>
            );
          })()}
        </td>

        <td style={{ textAlign: "center", padding: "8px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <button
              onClick={() => setInv((p) => ({
                ...p,
                cart: p.cart.map((i) => {
                  if (i.lineId !== item.lineId) return i;
                  const newQty = Math.max(1, i.qty - 1);
                  return { ...i, qty: newQty, price: recalcCartLinePrice(i, newQty) };
                }),
              }))}
              style={{ width: 22, height: 22, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}
            >-</button>

            <input
              type="text"
              inputMode="decimal"
              title={
                item.saleUnits > 1
                  ? `العلبة مقسّمة لـ ${item.saleUnits} وحدة بيع — اكتب 1 لعلبة كاملة، أو كسر زي 2/${item.saleUnits} لبيع وحدتين بس`
                  : "هذا الصنف بيع علبة كاملة بس — اكتب رقم صحيح"
              }
              value={item.qtyDisplay ?? item.qty}
              onChange={(e) => {
                setInv((p) => ({
                  ...p,
                  cart: p.cart.map((i) =>
                    i.lineId === item.lineId ? { ...i, qtyDisplay: e.target.value } : i
                  ),
                }));
              }}
              onBlur={(e) => {
  const raw = e.target.value.trim();
  
  // parse الكسور زي 1/3 أو 2 1/3
  let val;
  const su = item.saleUnits > 1 ? item.saleUnits : null;
  const itemLabel = item.nameAr || item.name || "الصنف";
  const exampleN = su ? Math.min(2, su - 1) || 1 : 1;

  const fracMatch = raw.match(/^(\d+)\s+(\d+)\/(\d+)$|^(\d+)\/(\d+)$|^(\d*\.?\d+)$/);
  if (!fracMatch) {
    showToast(
      su
        ? `${itemLabel}: صيغة غير مقبولة — العلبة مقسّمة لـ ${su} وحدة بيع، اكتب مثلاً ${exampleN}/${su} لبيع ${exampleN} وحدة، أو 1 لعلبة كاملة`
        : `${itemLabel}: صيغة غير صحيحة — اكتب رقم صحيح (هذا الصنف بيع علبة كاملة بس، بدون تقسيم)`,
      "error"
    );
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.lineId === item.lineId ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }
  if (fracMatch[1]) {
    // 2 1/3
    val = +fracMatch[1] + +fracMatch[2] / +fracMatch[3];
  } else if (fracMatch[4]) {
    // 1/3
    val = +fracMatch[4] / +fracMatch[5];
  } else {
    // 0.33
    val = +fracMatch[6];
  }

  if (isNaN(val) || val <= 0) {
    showToast(`${itemLabel}: الكمية لازم تكون أكبر من صفر`, "error");
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.lineId === item.lineId ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }

  const isValid = Math.abs(Math.round(val / step) * step - val) < 0.0001;
  if (!isValid) {
    showToast(
      su
        ? `${itemLabel}: كمية غير صحيحة — العلبة مقسّمة لـ ${su} وحدة بيع بس، اكتب كسر زي ${exampleN}/${su} (يعني ${exampleN} وحدة من ${su})، لحد ${su}/${su} اللي هي علبة كاملة`
        : `${itemLabel}: هذا الصنف بيع علبة كاملة بس (بدون تقسيم) — اكتب رقم صحيح زي 1 أو 2`,
      "error"
    );
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.lineId === item.lineId ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }

  setInv((p) => ({
    ...p,
    cart: p.cart.map((i) => {
      if (i.lineId !== item.lineId) return i;
      const newQty = Math.min(val, maxQty);
      return { ...i, qty: newQty, qtyDisplay: undefined, price: recalcCartLinePrice(i, newQty) };
    }),
  }));
}}
              style={{ width: 52, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", padding: "3px 4px" }}
            />

            <button
              onClick={() => setInv((p) => ({
                ...p,
                cart: p.cart.map((i) => {
                  if (i.lineId !== item.lineId) return i;
                  const mx = products.find(x => x.id === i.id)?.stock || 99;
                  const newQty = Math.min(i.qty + 1, mx);
                  return { ...i, qty: newQty, price: recalcCartLinePrice(i, newQty) };
                }),
              }))}
              style={{ width: 22, height: 22, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}
            >+</button>
          </div>
        </td>

        <td style={{ textAlign: "center", padding: "8px 4px", color: "#2a9aff", fontSize: 13 }}>
          {displayPrice.toFixed(2)}
        </td>
        <td style={{ textAlign: "center", padding: "8px 4px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 700 }}>
          {displayTotal.toFixed(2)}
        </td>
        <td style={{ textAlign: "center" }}>
          <button
            onClick={() => setInv((p) => ({
              ...p,
              cart: p.cart.filter((i) =>
                i.lineId !== item.lineId &&
                !(i.isGift && item.promoType === "free_gift" && i.giftFromPromoId === item.promo?.id)
              ),
            }))}
            style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}
          >✕</button>
        </td>
      </tr>
    );
  })}
</tbody>
            </table>
          )}
        </div>

        {inv.cart.filter((i) => !i.isGift).length > 0 && (
          <div style={{ padding: "4px 16px 0", flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowBulkDoseModal(true)}
              style={{
                background: "transparent", border: "none", color: COLORS.blue, cursor: "pointer",
                fontSize: 12, display: "flex", alignItems: "center", gap: 4, padding: "2px 0",
              }}
            >
              🖨️ طباعة كل ملصقات الجرعة ({inv.cart.filter((i) => !i.isGift).length})
            </button>
          </div>
        )}

        {/* الإجمالي والدفع */}
        <div
          style={{
            padding: "8px 14px",
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          {/* ===== وسيلة الدفع ===== */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
              {[
                { mode: "single", label: "دفعة واحدة" },
                { mode: "split", label: "⇄ تقسيم الدفع" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setInv((p) => ({ ...p, paymentMode: mode }))}
                  style={{
                    flex: 1,
                    padding: "4px 0",
                    borderRadius: 7,
                    border: "1px solid",
                    borderColor:
                      inv.paymentMode === mode ? COLORS.blue : COLORS.border,
                    background:
                      inv.paymentMode === mode ? COLORS.blueSoft : "transparent",
                    color:
                      inv.paymentMode === mode ? COLORS.blue : COLORS.textDim,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {inv.paymentMode === "single" && (
              <div style={{ display: "flex", gap: 6 }}>
                {["نقدي", "بطاقة", "تحويل", "آجل"].map((m) => {
                  const isAjilLocked = m === "آجل" && !inv.selCustomer;
                  return (
                    <button
                      key={m}
                      disabled={isAjilLocked}
                      title={
                        isAjilLocked
                          ? "اختر عميلاً أولاً لتفعيل البيع الآجل"
                          : undefined
                      }
                      onClick={() => {
                        if (isAjilLocked) {
                          showToast(
                            "لا يمكن تسجيل بيع آجل لزبون عادي — اختر عميلاً أولاً",
                            "error"
                          );
                          return;
                        }
                        setInv((p) => ({ ...p, payment: m }));
                      }}
                      style={{
                        flex: 1,
                        padding: "5px 0",
                        borderRadius: 7,
                        border: "1px solid",
                        borderColor:
                          inv.payment === m ? COLORS.blue : COLORS.border,
                        background:
                          inv.payment === m ? COLORS.blueSoft : "transparent",
                        color: isAjilLocked
                          ? COLORS.textDim
                          : inv.payment === m
                          ? COLORS.blue
                          : COLORS.textDim,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isAjilLocked ? "not-allowed" : "pointer",
                        opacity: isAjilLocked ? 0.5 : 1,
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {inv.paymentMode === "split" && (() => {
              const card = inv.splitPayment.card || 0;
              const transfer = inv.splitPayment.transfer || 0;
              const cash = Math.round((total - card - transfer) * 100) / 100;
              const isOverpaid = cash < 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.blue, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      بطاقة
                    </span>
                    <input
                      type="number" min="0" step="0.01" value={card || ""} placeholder="0.00"
                      onChange={(e) =>
                        setInv((p) => ({
                          ...p,
                          splitPayment: { ...p.splitPayment, card: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "5px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#aa88ff", fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      تحويل
                    </span>
                    <input
                      type="number" min="0" step="0.01" value={transfer || ""} placeholder="0.00"
                      onChange={(e) =>
                        setInv((p) => ({
                          ...p,
                          splitPayment: { ...p.splitPayment, transfer: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "5px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      نقدي
                    </span>
                    <div style={{ flex: 1, background: COLORS.greenSoft, border: `1px solid ${isOverpaid ? COLORS.red : COLORS.green}`, borderRadius: 7, padding: "5px 10px", color: isOverpaid ? COLORS.red : COLORS.green, fontSize: 13, fontWeight: 700 }}>
                      {isOverpaid ? "⚠ تجاوز الإجمالي" : `${cash.toFixed(2)}`}
                    </div>
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderRadius: 6, background: isOverpaid ? COLORS.redSoft : COLORS.greenSoft, border: `1px solid ${isOverpaid ? COLORS.red : COLORS.green}`, marginTop: 2 }}>
                    <span style={{ color: isOverpaid ? COLORS.red : COLORS.green, fontSize: 12, fontWeight: 700 }}>
                      {isOverpaid ? `⚠ زيادة ${Math.abs(cash).toFixed(2)} ر.س` : "✓ الحساب مظبوط"}
                    </span>
                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                      نقدي {cash <= 0 ? "0.00" : cash.toFixed(2)} + بطاقة {card.toFixed(2)} + تحويل {transfer.toFixed(2)} = {total.toFixed(2)} ر.س
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ===== نقاط الولاء ===== */}
          {inv.selCustomer && customerLoyalty?.points >= (loyaltySettings?.min_redeem || 10) && (
            <div style={{
              background: COLORS.greenSoft,
              border: `1px solid ${tint(COLORS.green,0.35)}`,
              borderRadius: 10,
              padding: "7px 12px",
              marginBottom: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>
                    🌟 نقاط متاحة: {customerLoyalty.points.toFixed(2)} ر.س
                  </div>
                  {usePoints && (
                    <div style={{ color: COLORS.green, fontSize: 11, marginTop: 3 }}>
                      سيتم خصم {pointsToRedeem.toFixed(2)} ر.س من الفاتورة
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    const newUse = !usePoints;
                    setUsePoints(newUse);
                    setPointsToRedeem(newUse
                      ? Math.min(customerLoyalty.points, subtotal + taxAmount - discountAmt)
                      : 0
                    );
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 7,
                    border: `1px solid ${tint(COLORS.green,0.35)}`,
                    background: usePoints ? COLORS.green : "transparent",
                    color: usePoints ? "#000" : COLORS.green,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {usePoints ? "✓ مفعّل" : "استخدام النقاط"}
                </button>
              </div>

              {usePoints && (() => {
                const maxRedeemable = Math.max(0, Math.min(customerLoyalty.points, subtotal + taxAmount - discountAmt));
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <input
                      type="number"
                      min={0}
                      max={maxRedeemable}
                      step="0.5"
                      value={pointsToRedeem}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(+e.target.value || 0, maxRedeemable));
                        setPointsToRedeem(v);
                      }}
                      style={{
                        width: 90,
                        background: COLORS.surfaceAlt,
                        border: `1px solid ${tint(COLORS.green,0.35)}`,
                        borderRadius: 7,
                        padding: "5px 8px",
                        color: COLORS.textPrimary,
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    <span style={{ fontSize: 11, color: COLORS.green }}>
                      ر.س (بحد أقصى {maxRedeemable.toFixed(2)})
                    </span>
                    <button
                      onClick={() => setPointsToRedeem(maxRedeemable)}
                      style={{
                        marginRight: "auto",
                        background: "transparent",
                        border: "none",
                        color: COLORS.green,
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        textDecoration: "underline",
                      }}
                    >
                      استخدام الكل
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== الخصم ===== */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: 7,
                overflow: "hidden",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {[
                { type: "percent", label: "%" },
                { type: "value", label: "ر.س" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() =>
                    setInv((p) => ({ ...p, discountType: type, discount: 0 }))
                  }
                  style={{
                    padding: "5px 10px",
                    background:
                      inv.discountType === type ? COLORS.blueSoft : "transparent",
                    color:
                      inv.discountType === type ? COLORS.blue : COLORS.textDim,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label style={{ color: COLORS.textDim, fontSize: 12 }}>خصم</label>
            <input
              type="number"
              min="0"
              max={inv.discountType === "percent" ? 100 : undefined}
              value={inv.discount || ""}
              placeholder="0"
              onChange={(e) =>
                setInv((p) => ({ ...p, discount: +e.target.value }))
              }
              style={{
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 7,
                padding: "6px 10px",
                color: COLORS.textPrimary,
                fontSize: 13,
                outline: "none",
                width: 80,
              }}
            />
            {inv.cart.length > 0 && (
              <button
                onClick={() => setInv((p) => ({ ...p, cart: [] }))}
                style={{
                  marginRight: "auto",
                  background: "transparent",
                  border: "none",
                  color: COLORS.red,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                🗑 مسح الكل
              </button>
            )}
          </div>

          {/* ===== الأرقام ===== */}
          <div
            style={{
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              borderRadius: 10,
              padding: 7,
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, fontSize: 12, marginBottom: 3 }}>
              <span>قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 3 }}>
              <span>ضريبة 15%</span>
              <span>{taxAmount.toFixed(2)} ر.س</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 3 }}>
                <span>خصم {inv.discountType === "percent" ? `${inv.discount}%` : `${inv.discount} ر.س`}</span>
                <span>- {discountAmt.toFixed(2)} ر.س</span>
              </div>
            )}
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 3 }}>
                <span>🌟 نقاط ولاء</span>
                <span>- {pointsToRedeem.toFixed(2)} ر.س</span>
              </div>
            )}
            {missedTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 3 }}>
                <span>⚠ فرص ضائعة</span>
                <span>{missedTotal.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontSize: 17, fontWeight: 800, borderTop: `1px solid ${COLORS.border}`, paddingTop: 5, marginTop: 3 }}>
              <span>الإجمالي</span>
              <span>{total.toFixed(2)} ر.س</span>
            </div>
          </div>

          <Btn
            size="lg"
            onClick={completeSale}
            style={{ width: "100%", justifyContent: "center" }}
            variant={inv.success ? "success" : "primary"}
            icon={inv.success ? "check" : "money"}
          >
            {inv.success ? "تمت العملية!" : "إتمام البيع"}
          </Btn>
        </div>
      </div>

      {showPrint && (
        <PrintReceipt invoice={showPrint} onClose={() => setShowPrint(null)} pharmacyId={pharmacyId} customerPhone={showPrint.customer_phone} />
      )}

      {/* ── باركود اتقرا ومتلقاش صنف مطابق — الأرجح إن الشركة غيّرت الـ GTIN. نسيب الكاشير يربطه بصنف موجود ── */}
      <Modal
        open={!!unmatchedScan}
        onClose={() => { setUnmatchedScan(null); setUnmatchedLinkSearch(""); }}
        title="⚠️ باركود غير معروف"
      >
        {unmatchedScan && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: COLORS.textDim, fontSize: 13, lineHeight: 1.7 }}>
              الباركود <span style={{ color: COLORS.gold, fontWeight: 700 }}>{unmatchedScan.gtin}</span> مش متسجل لأي صنف عندك — يمكن الشركة المنتجة غيّرت الـ GTIN.
              لو الصنف ده موجود عندك بباركود قديم، دوّر عليه واختاره تحت وهيتحدث باركوده تلقائيًا لهذا الكود الجديد.
            </div>
            <input
              autoFocus
              value={unmatchedLinkSearch}
              onChange={(e) => setUnmatchedLinkSearch(e.target.value)}
              placeholder="🔍 دوّر باسم الصنف اللي عايز تربطه بالباركود ده..."
              style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
            {unmatchedLinkSearch.trim() && (
              <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                {products
                  .filter((p) => (p.nameAr || p.name || "").toLowerCase().includes(unmatchedLinkSearch.trim().toLowerCase()) || (p.nameEn || "").toLowerCase().includes(unmatchedLinkSearch.trim().toLowerCase()))
                  .slice(0, 20)
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => linkUnmatchedBarcodeToProduct(p)}
                      style={{ padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, color: COLORS.textPrimary, display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span>{p.nameAr || p.name}</span>
                      <span style={{ color: COLORS.textDim, fontSize: 11 }}>الباركود الحالي: {p.barcode || "—"}</span>
                    </div>
                  ))}
                {products.filter((p) => (p.nameAr || p.name || "").toLowerCase().includes(unmatchedLinkSearch.trim().toLowerCase())).length === 0 && (
                  <div style={{ padding: 14, fontSize: 12.5, color: COLORS.textDim, textAlign: "center" }}>مفيش نتائج مطابقة</div>
                )}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => { setUnmatchedScan(null); setUnmatchedLinkSearch(""); }}>إلغاء</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!expiryPickerLine}
        onClose={() => {
          // مينفعش يقفل من غير اختيار — الصنف ده لازم يتحدد له تاريخ صلاحية قبل ما يكمل
          showToast("لازم تختار تاريخ الصلاحية للصنف ده", "error");
        }}
        title={`⏰ اختر تاريخ الصلاحية — ${expiryPickerLine?.productName || ""}`}
      >
        {expiryPickerLine && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: COLORS.textDim, fontSize: 12.5 }}>
              الصنف ده متسجل بأكتر من تشغيلة/تاريخ صلاحية في المخزون. اختر التشغيلة اللي هتبيع منها:
            </div>
            {expiryPickerLine.options.map((exp) => (
              <button
                key={exp}
                onClick={() => {
                  const newExpiry = exp;
                  const newLineId = `${expiryPickerLine.productId}::${newExpiry}::`;
                  setInv((prev) => ({
                    ...prev,
                    cart: prev.cart.map((i) =>
                      i.lineId === expiryPickerLine.lineId
                        ? { ...i, expiry: newExpiry, lineId: newLineId }
                        : i
                    ),
                  }));
                  setExpiryPickerLine(null);
                }}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer", textAlign: "center",
                  border: `1px solid ${tint(COLORS.gold, 0.35)}`, background: COLORS.surfaceAlt,
                  color: COLORS.gold, fontSize: 14, fontWeight: 700,
                }}
              >
                {exp}
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!doseLabelItem} onClose={() => setDoseLabelItem(null)} title={`🏷️ ملصق جرعة — ${doseLabelItem?.name || ""}`}>
        {doseLabelItem && (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
            {/* قوالب الجرعة الجاهزة */}
            <div>
              <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                قوالب جاهزة (اضغط لاستخدام القالب)
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {doseTemplates.map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => updateDoseLabel((p) => ({ ...p, _dose: t }))}
                      style={{
                        padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt,
                        color: COLORS.textPrimary, fontSize: 12,
                      }}
                    >
                      {t}
                    </button>
                    <button
                      onClick={() => removeDoseTemplate(t)}
                      title="حذف القالب"
                      style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 11 }}
                    >✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* نص الجرعة */}
            <div>
              <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                الجرعة (تقدر تكتبها بنفسك أو تختار قالب فوق)
              </label>
              <textarea
                value={doseLabelItem._dose}
                onChange={(e) => updateDoseLabel((p) => ({ ...p, _dose: e.target.value }))}
                rows={3}
                style={{
                  width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13,
                  outline: "none", boxSizing: "border-box", resize: "vertical",
                }}
              />
              <button
                onClick={() => saveDoseTemplate(doseLabelItem._dose)}
                style={{ marginTop: 6, background: "transparent", border: "none", color: COLORS.blue, cursor: "pointer", fontSize: 12 }}
              >
                + حفظ النص ده كقالب جديد
              </button>
            </div>

            {/* ملاحظات */}
            <div>
              <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                ملاحظات
              </label>
              <textarea
                value={doseLabelItem._notes}
                onChange={(e) => updateDoseLabel((p) => ({ ...p, _notes: e.target.value }))}
                rows={2}
                style={{
                  width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13,
                  outline: "none", boxSizing: "border-box", resize: "vertical",
                }}
              />
            </div>

            {/* الصلاحية بعد الفتح */}
            <div>
              <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                الصلاحية بعد الفتح
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {[7, 14, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      const label = `${days} يوم من الفتح (حتى ${d.toISOString().slice(0, 10)})`;
                      setDoseLabelItem((p) => ({ ...p, _afterOpening: label }));
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                      border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt,
                      color: COLORS.textPrimary, fontSize: 12,
                    }}
                  >
                    {days} يوم
                  </button>
                ))}
              </div>
              <input
                value={doseLabelItem._afterOpening}
                onChange={(e) => setDoseLabelItem((p) => ({ ...p, _afterOpening: e.target.value }))}
                placeholder="مثال: يستخدم خلال شهر من الفتح..."
                style={{
                  width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* حجم الملصق */}
            <div>
              <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                حجم الملصق
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DOSAGE_LABEL_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDoseLabelItem((p) => ({ ...p, _labelSize: s.id }))}
                    style={{
                      padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${(doseLabelItem._labelSize || "80x60") === s.id ? COLORS.blue : COLORS.border}`,
                      background: (doseLabelItem._labelSize || "80x60") === s.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                      color: (doseLabelItem._labelSize || "80x60") === s.id ? COLORS.blue : COLORS.textDim,
                      fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Btn onClick={printDoseLabel} icon="print" style={{ flex: 1, justifyContent: "center" }}>
                طباعة الملصق
              </Btn>
              <Btn variant="ghost" onClick={() => setDoseLabelItem(null)} style={{ flex: 1, justifyContent: "center" }}>
                إلغاء
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showBulkDoseModal} onClose={() => setShowBulkDoseModal(false)} title="🖨️ طباعة كل ملصقات الجرعة">
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ color: COLORS.textDim, fontSize: 13 }}>
            هيتم طباعة ملصق جرعة منفصل لكل صنف في السلة، بالجرعة والملاحظات المكتوبة جنب كل صنف.
            {(() => {
              const patientName = (inv.patientName || "").trim() || inv.selCustomer?.name || "";
              return patientName ? ` المريض: ${patientName}` : "";
            })()}
          </div>
          <div>
            <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
              حجم الملصق (نفس الحجم لكل الأصناف)
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DOSAGE_LABEL_SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setBulkLabelSize(s.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${bulkLabelSize === s.id ? COLORS.blue : COLORS.border}`,
                    background: bulkLabelSize === s.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                    color: bulkLabelSize === s.id ? COLORS.blue : COLORS.textDim,
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn onClick={() => printAllDoseLabels(bulkLabelSize)} icon="print" style={{ flex: 1, justifyContent: "center" }}>
              طباعة الكل
            </Btn>
            <Btn variant="ghost" onClick={() => setShowBulkDoseModal(false)} style={{ flex: 1, justifyContent: "center" }}>
              إلغاء
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
