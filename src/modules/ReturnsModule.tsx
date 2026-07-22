import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { TAX_RATE } from "../data/seedData";
import { toString } from "../function toString() { [native code] }/undefined";
import { logAudit } from "../lib/auditLog";
import { normGtin } from "../lib/barcodeUtils";
import { todayLocal } from "../lib/dateUtils";
import { POS } from "./POS";
import { SuppliersModule } from "./SuppliersModule";
import { RasdQueue } from "../services/rasdService";
import { Badge, Btn, Input, Modal, Select } from "../ui/primitives";

export function ReturnsModule({
  products,
  setProducts,
  sales,
  setSales,
  purchases,
  setPurchases,
  customers,
  suppliers = [], // 🆕 عشان نجيب GLN المورد الصح لمرتجع المشتريات بدل GLN الصيدلية نفسها
  showToast,
  pharmacyId,
  currentUser,
  setTreasuryEntries, // 🆕 لازم تتمرر من الأب (App.tsx) لنفس الـ pattern المستخدم في SuppliersModule
  setReturnsData, // 🆕 لتحديث state المرتجعات فورًا بعد الحفظ (تاب الشفتات وتقفيل اليوم بيعتمدوا عليه)
  entries = [], // 🆕 قيود الخزنة — نستخدمها بس عشان نعرف هل تقفيل اليوم حصل فعلاً
  shifts = [], // 🆕 عشان نعرف هل فيه شفت مفتوح دلوقتي بعد التقفيل
  canViewSalesReturns = true,
  canViewPurchaseReturns = true,
  canEditSalesReturns = true,
  canEditPurchaseReturns = true,
  fixedType = null, // 🆕 لو اتبعت "sales" أو "purchases" بيثبّت النوع ويخفي زر التبديل (تبويب مستقل بالقائمة الجانبية)
}) {
  const [type, setType] = useState(fixedType || (canViewSalesReturns ? "sales" : "purchases"));
  const [returnItems, setReturnItems] = useState([]);
  const [lastScanResult, setLastScanResult] = useState(null); // 🆕 نتيجة آخر مسح ضوئي (بار المقارنة)
  const [reasonOption, setReasonOption] = useState("");
  const [reasonCustom, setReasonCustom] = useState("");
  const reason = reasonOption === "أخرى" ? reasonCustom : reasonOption;
  const [selInvoice, setSelInvoice] = useState(null); // كائن الفاتورة كاملة
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false);

  // ═══════════════════════════════════════════════════
  // 🆕 مصدر فلوس الاسترجاع — بيظهر بس لو تقفيل اليوم حصل فعلاً النهارده
  // (يعني ممكن الكاش يتاخد من فلوس التقفيل اللي لسه معاك، أو من النقد الافتتاحي لشفت جديد)
  // ═══════════════════════════════════════════════════
  const todayStr = todayLocal();
  const dayClosedToday = (entries || []).some(
    (e) => e.date === todayStr && e.pharmacy_id === pharmacyId && e.sub_type === "daily_closing"
  );
  const openShiftToday = (shifts || [])
    .filter((s) => s.pharmacy_id === pharmacyId && !s.end_time && s.start_time?.startsWith(todayStr))
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0] || null;
  const [refundSource, setRefundSource] = useState("pending"); // "pending" | "shift"
  useEffect(() => {
    // لو مفيش تقفيل حصل النهارده أو مفيش شفت مفتوح، نرجّع الافتراضي (مفيش لبس أصلاً)
    if (!dayClosedToday || !openShiftToday) setRefundSource("pending");
  }, [dayClosedToday, openShiftToday]);

  // ═══════════════════════════════════════════════════
  // 🆕 رجاعة الشبكة — بعض الصيدليات بس بتقدر ترجّع فلوس شبكة فعليًا (reversal)،
  // فبنجيب إعداد الصيدلية مرة واحدة، ونظهر خيار (كاش/شبكة) بس لو مفعّل.
  // ═══════════════════════════════════════════════════
  const [supportsCardRefund, setSupportsCardRefund] = useState(false);
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("pharmacy_settings")
      .select("supports_card_refund")
      .eq("pharmacy_id", pharmacyId)
      .single()
      .then(({ data }) => setSupportsCardRefund(!!data?.supports_card_refund));
  }, [pharmacyId]);
  const [refundMethod, setRefundMethod] = useState("نقدي"); // "نقدي" | "بطاقة"
  useEffect(() => {
    setRefundMethod("نقدي");
  }, [selInvoice, type]);

  // 🆕 أسباب الإرجاع الجاهزة (مبيعات ومشتريات)
  const SALES_RETURN_REASONS = [
    "منتج تالف",
    "قريب من انتهاء الصلاحية",
    "منتهي الصلاحية",
    "صنف خاطئ (تم صرف صنف غير مطلوب)",
    "كمية زائدة عن حاجة العميل",
    "رد فعل تحسسي / عدم تحمل",
    "الطبيب غيّر العلاج / وصفة جديدة",
    "العميل عدل رأيه",
    "عيب تصنيع",
    "أخرى",
  ];
  const PURCHASE_RETURN_REASONS = [
    "منتج تالف من المورد",
    "قريب من انتهاء الصلاحية",
    "منتهي الصلاحية",
    "صنف خاطئ في التوريد",
    "كمية زائدة عن المطلوب",
    "عيب تصنيع",
    "عدم مطابقة للمواصفات",
    "أخرى",
  ];

  // بحث العميل
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selCustomer, setSelCustomer] = useState(null);

  // مرتجع مشتريات
  const [selPurchaseInvoice, setSelPurchaseInvoice] = useState("");
  // 🆕 بحث بالمورد — لتصفية فواتير الشراء الخاصة به قبل اختيار الفاتورة
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [selSupplier, setSelSupplier] = useState(null);

  // مدير: إرجاع بدون فاتورة
  const isAdmin = currentUser?.role === "admin";
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const ADMIN_PIN = "1234"; // غيّره حسب احتياجك

  useEffect(() => {
    setReturnItems([]);
    setInvoiceSearch("");
    setSelInvoice(null);
    setCustomerSearch("");
    setSelCustomer(null);
    setSupplierSearch("");
    setSelSupplier(null);
    setReasonOption("");
    setReasonCustom("");
    setSelPurchaseInvoice("");
    setAdminOverride(false);
    setLastScanResult(null);
    setRefundSource("pending");
    setRefundMethod("نقدي");
  }, [type]);

  // ── فلترة فواتير المبيعات ──
  // 🆕 بحث موسّع: رقم الفاتورة / اسم العميل / اسم الكاشير / اسم أي صنف في الفاتورة / الإجمالي / التاريخ
  // (مهم لحالة "زبون عادي" من غير فاتورة ورقية ومن غير صلاحية فتح التقارير — يقدر يوصلها
  // بمعرفة الصنف اللي اشتراه أو المبلغ أو التاريخ التقريبي بدل ما يكون محتاج رقم الفاتورة بالظبط)
  const filteredSaleInvoices = sales
    .filter((s) => {
      const q = invoiceSearch.trim().toLowerCase();
      if (!q) return true;
      const itemsArr = typeof s.items === "string" ? (() => { try { return JSON.parse(s.items); } catch { return []; } })() : (s.items || []);
      return (
        (s.id || "").toLowerCase().includes(q) ||
        (s.customer_name || "").toLowerCase().includes(q) ||
        (s.cashier_name || "").toLowerCase().includes(q) ||
        (s.date || "").includes(q) ||
        String(s.total || "").includes(q) ||
        itemsArr.some((it) => (it.name || "").toLowerCase().includes(q))
      );
    })
    // الأحدث أولاً — يسهّل تصفح آخر الفواتير لما العميل يفتكر التاريخ بس مش رقم الفاتورة
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // ── اختيار فاتورة مبيعات ──
  const handleSelectInvoice = (invoice) => {
    // تحقق من الحد الزمني 14 يوم
    const invoiceDate = new Date(invoice.date);
    const today = new Date();
    const daysDiff = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 14 && !adminOverride) {
      showToast(`⚠️ الفاتورة أقدم من 14 يوم (${daysDiff} يوم) — يلزم تصريح مدير`, "error");
      setShowPinModal(true);
      return;
    }
    setSelInvoice(invoice);
    setLastScanResult(null);
    setInvoiceSearch(invoice.id);
    setInvoiceSearchOpen(false);
    // تحميل أصناف الفاتورة
    setReturnItems(
      (invoice.items || []).map((item) => ({
        ...item,
        returnQty: 0,
        originalBatch: item.batch || null,
        originalExpiry: item.expiry || null,
        originalSerial: item.serial || null,
        // 🆕 كل سيريالات السطر (ممكن يكون فيه أكتر من علبة)، مش بس أول واحدة
        originalSerials: item.serials && item.serials.length ? item.serials : (item.serial ? [item.serial] : []),
        alreadyReturnedQty: item.returnedQty || 0, // 🆕 كمية سبق إرجاعها من هذا الصنف
      }))
    );
    // تحديد العميل تلقائياً — invoice.customer هو الـ id (راجع POS.completeSale)
    if (invoice.customer) {
      const c = customers?.find((x) => String(x.id) === String(invoice.customer));
      if (c) {
        setSelCustomer(c);
        setCustomerSearch(c.name);
      }
    }
  };

  // ── فاتورة مشتريات ──
  const purchaseInvoice = purchases.find((p) => p.id === selPurchaseInvoice);

  // 🆕 الكمية المتاحة فعليًا في المخزون من نفس تشغيلة (batch_number + expiry_date) هذا الصنف
  // في فاتورة الشراء. لازم نحسبها عشان مانسمحش بإرجاع كمية تم بيع جزء أو كل منها بالفعل.
  // لو الصنف مش متتبّع بتشغيلات (batches فاضية)، بنستخدم إجمالي مخزون الصنف الحالي كسقف آمن.
  const getPurchaseItemStockQty = (item) => {
    const prod = products.find((p) => p.id === item.id);
    if (!prod) return 0;
    const batches = prod.batches || [];
    if (batches.length === 0) {
      return Math.min(item.qty || 0, prod.stock || 0);
    }
    const match = batches.find(
      (b) =>
        (b.batch_number || "").toString().trim() === (item.batch_number || "").toString().trim() &&
        (b.expiry_date || "") === (item.expiry_date || "")
    );
    return match?.qty ?? 0;
  };

  useEffect(() => {
    if (type === "purchases" && purchaseInvoice) {
      setReturnItems(
        purchaseInvoice.items.map((i) => ({
          ...i,
          returnQty: 0,
          alreadyReturnedQty: i.returnedQty || 0, // 🆕 لو خزّنت تفاصيل الإرجاع على مستوى الصنف
          stockQty: getPurchaseItemStockQty(i), // 🆕 الكمية الموجودة فعليًا في المخزون من هذه التشغيلة
        }))
      );
    }
  }, [selPurchaseInvoice, type]);

  // ── حسابات ──
  const returnSubtotal = returnItems.reduce(
    (s, i) =>
      s + (type === "purchases" ? i.cost || i.price || 0 : i.price || 0) * (i.returnQty || 0),
    0
  );
  const returnTax = returnItems.reduce(
    (s, i) =>
      i.taxable
        ? s + (type === "purchases" ? i.cost || i.price || 0 : i.price || 0) * (i.returnQty || 0) * TAX_RATE
        : s,
    0
  );
  const returnTotal = returnSubtotal + returnTax;

  // ── 🆕 مسح باركود صنف مرتجع (مبيعات) ومقارنته بالصنف المباع في الفاتورة الأصلية ──
  const handleReturnScan = (scan) => {
    if (type !== "sales") return;
    if (!selInvoice && !adminOverride) {
      showToast("اختر فاتورة البيع أولاً قبل المسح", "error");
      return;
    }
    const code = scan.type === "gs1" ? scan.gtin : scan.code;
    const scannedExpiry = (scan.type === "gs1" || scan.type === "custom") && scan.expiry ? scan.expiry.slice(0, 7) : "";
    const scannedBatch = scan.type === "gs1" || scan.type === "custom" ? scan.batch || "" : "";
    const prod = products.find((x) =>
      scan.type === "gs1"
        ? normGtin(x.barcode) === normGtin(code) || normGtin(x.gtin) === normGtin(code)
        : x.barcode === code || x.id === code
    );

    if (!prod) {
      setLastScanResult({ status: "not_found", code });
      showToast("الصنف غير موجود: " + code, "error");
      return;
    }

    const idx = returnItems.findIndex((i) => i.id === prod.id);
    if (idx === -1) {
      setLastScanResult({ status: "not_in_invoice", name: prod.name, code });
      showToast(`⚠️ "${prod.name}" غير موجود ضمن أصناف هذه الفاتورة`, "error");
      return;
    }

    const item = returnItems[idx];
    const maxReturnable = Math.max(0, (item.qty || 0) - (item.alreadyReturnedQty || 0));
    if (item.returnQty >= maxReturnable) {
      setLastScanResult({ status: "max_reached", name: item.name, maxReturnable });
      showToast(`⚠️ ${item.name}: وصلت لأقصى كمية قابلة للإرجاع (${maxReturnable})`, "error");
      return;
    }

    // مقارنة الباتش/الصلاحية الممسوحة بالفاتورة الأصلية
    const batchMismatch =
      (scannedBatch && item.originalBatch && scannedBatch !== item.originalBatch) ||
      (scannedExpiry && item.originalExpiry && scannedExpiry !== item.originalExpiry);

    setReturnItems((p) =>
      p.map((x, j) =>
        j === idx
          ? {
              ...x,
              returnQty: Math.min(x.returnQty + 1, maxReturnable),
              scannedBatch: scannedBatch || x.scannedBatch || "",
              scannedExpiry: scannedExpiry || x.scannedExpiry || "",
              batchMismatch,
            }
          : x
      )
    );

    setLastScanResult({
      status: batchMismatch ? "mismatch" : "matched",
      name: item.name,
      originalBatch: item.originalBatch || null,
      originalExpiry: item.originalExpiry || null,
      scannedBatch: scannedBatch || null,
      scannedExpiry: scannedExpiry || null,
      newQty: Math.min(item.returnQty + 1, maxReturnable),
    });

    if (batchMismatch) {
      showToast(`⚠️ ${item.name}: الباتش/الصلاحية الممسوحة لا تطابق الفاتورة الأصلية`, "error");
    } else {
      showToast(`✓ تم تسجيل إرجاع: ${item.name}`, "success");
    }
  };

  // ── تحقق من الباتش والصلاحية ──
  const validateItem = (item) => {
    if (!selInvoice || adminOverride) return true;
    // تحقق batch
    if (item.originalBatch && item.batch && item.batch !== item.originalBatch) {
      showToast(`⚠️ ${item.name}: رقم الباتش لا يطابق الفاتورة الأصلية`, "error");
      return false;
    }
    // تحقق expiry
    if (item.originalExpiry && item.expiry && item.expiry !== item.originalExpiry) {
      showToast(`⚠️ ${item.name}: تاريخ الصلاحية لا يطابق الفاتورة الأصلية`, "error");
      return false;
    }
    // 🆕 تحقق الباتش/الصلاحية الممسوحة ضوئيًا عند الإرجاع
    if (item.batchMismatch) {
      showToast(`⚠️ ${item.name}: الباتش الممسوح لا يطابق باتش الفاتورة الأصلية — راجع الصنف`, "error");
      return false;
    }
    return true;
  };

  // ── تأكيد الإرجاع ──
  const processReturn = async () => {
    if (type === "sales" && !selInvoice && !adminOverride) {
      showToast("يجب اختيار فاتورة البيع أولاً", "error");
      return;
    }
    if (type === "purchases" && !selPurchaseInvoice) {
      showToast("يجب اختيار فاتورة الشراء أولاً", "error");
      return;
    }
    if (returnItems.length === 0 || returnItems.every((i) => i.returnQty === 0)) {
      showToast("يرجى تحديد الكميات المرتجعة", "error");
      return;
    }

    // تحقق من كل صنف
    for (const item of returnItems) {
      if (item.returnQty > 0 && !validateItem(item)) return;
      // تحقق أن الكمية المرتجعة لا تتجاوز الكمية المباعة/المشتراة (مع احتساب ما سبق إرجاعه)
      if (type === "sales" && selInvoice) {
        const origItem = selInvoice.items?.find((x) => x.id === item.id);
        const alreadyReturned = item.alreadyReturnedQty || 0;
        if (origItem && item.returnQty + alreadyReturned > origItem.qty) {
          showToast(
            `⚠️ ${item.name}: الكمية المرتجعة (${item.returnQty}) + سابق إرجاعه (${alreadyReturned}) أكبر من المباعة (${origItem.qty})`,
            "error"
          );
          return;
        }
      }
      if (type === "purchases" && purchaseInvoice) {
        const origItem = purchaseInvoice.items?.find((x) => x.id === item.id);
        const alreadyReturned = item.alreadyReturnedQty || 0;
        if (origItem && item.returnQty + alreadyReturned > origItem.qty) {
          showToast(
            `⚠️ ${item.name}: الكمية المرتجعة (${item.returnQty}) + سابق إرجاعه (${alreadyReturned}) أكبر من المشتراة (${origItem.qty})`,
            "error"
          );
          return;
        }
        // 🆕 مينفعش نرجّع للمورد كمية أكبر من الموجود فعليًا بالمخزون (لو جزء اتباع)
        if (item.returnQty > (item.stockQty ?? 0)) {
          showToast(
            `⚠️ ${item.name}: الكمية المتاحة للإرجاع فعليًا في المخزون هي (${item.stockQty ?? 0}) فقط — جزء من الكمية تم بيعه/صرفه`,
            "error"
          );
          return;
        }
      }
    }

    const returnId = `RET-${Date.now()}`;
    const today = todayLocal();
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);

    // ── تحديث المخزون في Supabase ──
    for (const ri of itemsToReturn) {
      const prod = products.find((x) => x.id === ri.id);
      if (prod) {
        const { error: stockError } = await supabase
          .from("products")
          .update({
            stock: type === "sales" ? prod.stock + ri.returnQty : prod.stock - ri.returnQty,
          })
          .eq("id", ri.id);
        if (stockError) {
          showToast("خطأ في تحديث المخزون: " + stockError.message, "error");
        }
      }
    }

    setProducts((p) =>
      p.map((x) => {
        const ri = itemsToReturn.find((i) => i.id === x.id);
        if (!ri) return x;
        return { ...x, stock: type === "sales" ? x.stock + ri.returnQty : x.stock - ri.returnQty };
      })
    );

    // ═══════════════════════════════════════════════════
    // 🆕 مرتجع مبيعات: ينزل من الدخل (خزنة لو كاش / مديونية لو آجل)
    // + تحديث جزئي على بنود الفاتورة الأصلية في sales (مش الفاتورة كلها)
    // ═══════════════════════════════════════════════════
    if (type === "sales" && selInvoice) {
      // 🆕 لو السطر المرتجع جاي أصلاً من مسح سيريال، رجّعه "متاح للبيع" تاني في سجل التتبع
      // ✅ السطر ممكن يمثل كذا علبة (كذا سيريال) — نفك بس عدد "returnQty" منهم، بادئين من بعد
      // اللي اترجع قبل كده (alreadyReturnedQty)، عشان لو المرتجع جزئي (علبة من اتنين) نرجّع
      // السيريال الصح بس، ومنمسحش سيريال العلبة اللي لسه في يد العميل.
      const serializedReturns = itemsToReturn.filter(
        (i) => (i.originalSerials && i.originalSerials.length) || i.originalSerial
      );
      const serialsToRelease = serializedReturns.flatMap((ri) => {
        const all = ri.originalSerials && ri.originalSerials.length ? ri.originalSerials : (ri.originalSerial ? [ri.originalSerial] : []);
        return all.slice(ri.alreadyReturnedQty || 0, (ri.alreadyReturnedQty || 0) + ri.returnQty);
      });
      for (const sn of serialsToRelease) {
        await supabase
          .from("sold_serials")
          .update({ status: "returned" })
          .eq("pharmacy_id", pharmacyId)
          .eq("serial_number", sn)
          .eq("status", "sold");
      }

      const updatedItems = (selInvoice.items || []).map((item) => {
        const ri = itemsToReturn.find((i) => i.id === item.id);
        if (!ri) return item;
        return { ...item, returnedQty: (item.returnedQty || 0) + ri.returnQty };
      });
      const allReturned = updatedItems.every(
        (item) => (item.returnedQty || 0) >= item.qty
      );

      // ═══════════════════════════════════════════════════
      // 🆕 الجانب المالي (خزنة/مديونية) الأول، وبعده بس تحديث sales.returned
      // عشان مايبقاش فيه حالة متضاربة: فاتورة متعلّم "مرتجعة" من غير أي أثر مالي
      // فيها لو فشل الـ insert بتاع treasury_entries أو credit_payments.
      // مع محاولة إعادة (retry) واحدة قبل ما نوقف العملية بالكامل.
      // ═══════════════════════════════════════════════════
      const insertWithRetry = async (table, payload) => {
        let { data, error } = await supabase.from(table).insert(payload).select();
        if (error) {
          // محاولة تانية بعد نص ثانية قبل الاستسلام (فشل شبكة مؤقت غالبًا)
          await new Promise((r) => setTimeout(r, 500));
          ({ data, error } = await supabase.from(table).insert(payload).select());
        }
        return { data, error };
      };

      if ((selInvoice.payment || "نقدي") === "آجل") {
        // 🆕 فاتورة آجل → ينزل من مديونية العميل عبر credit_payments (نفس آلية السداد بالضبط)
        const customerId = selCustomer?.id || selInvoice.customer;
        if (!customerId) {
          showToast("⚠️ لا يمكن تحديد العميل لخصم المرتجع من مديونيته", "error");
          return;
        }
        const { error: creditError } = await insertWithRetry("credit_payments", [
          {
            invoice_id: selInvoice.id,
            customer_id: customerId,
            amount: returnTotal,
            date: today,
            notes: "مرتجع بيع",
            created_by: currentUser?.name || "",
            pharmacy_id: pharmacyId,
          },
        ]);
        if (creditError) {
          showToast(
            "❌ فشل تسجيل خصم المرتجع من مديونية العميل بعد محاولتين — لم يتم حفظ المرتجع، حاول مرة أخرى: " + creditError.message,
            "error"
          );
          return; // لا نكمل: مفيش تحديث لـ sales.returned طالما الجانب المالي فشل
        }
      } else {
        // 🆕 فاتورة نقدي/شبكة → ينزل من الخزنة كمصروف (نفس pattern سداد المورد في SuppliersModule)
        // 🆕 method بقى بيعكس طريقة الرد الفعلية (كاش أو رجاعة شبكة)، مش ثابت "نقدي" زي الأول
        // 🆕 لو الاسترجاع من النقد الافتتاحي لشفت جديد بعد التقفيل، نوضح ده في الملاحظة ونربطه بالشفت
        // عشان تسوية التقفيل (closing_adjustment) ما تخصمهوش تاني من فلوس التقفيل المعلّقة أصلاً
        const isShiftFundedRefund = dayClosedToday && openShiftToday && refundSource === "shift" && refundMethod === "نقدي";
        const trPayload = {
          type: "expense",
          sub_type: "sales_return",
          method: refundMethod,
          amount: returnTotal,
          note: `مرتجع بيع — فاتورة ${selInvoice.id}${reason ? " - " + reason : ""}${
            refundMethod === "بطاقة" ? " — رجاعة شبكة" : ""
          }${isShiftFundedRefund ? ` — من النقد الافتتاحي لشفت ${openShiftToday.id}` : ""}`,
          date: today,
          pharmacy_id: pharmacyId,
          created_by: currentUser?.name || "",
        };
        const { data: trData, error: trError } = await insertWithRetry("treasury_entries", trPayload);
        if (trError) {
          showToast(
            "❌ فشل تحديث الخزنة بعد محاولتين — لم يتم حفظ المرتجع، حاول مرة أخرى: " + trError.message,
            "error"
          );
          return; // لا نكمل: مفيش تحديث لـ sales.returned طالما الخزنة فشلت
        }
        if (setTreasuryEntries) {
          const newEntry = trData && trData[0] ? trData[0] : { id: `TMP-${Date.now()}`, ...trPayload };
          setTreasuryEntries((p) => [newEntry, ...p]);
        }
      }

      // ── الجانب المالي نجح → دلوقتي بس نعلّم الفاتورة كمرتجعة ──
      const { error: saleUpdateError } = await supabase
        .from("sales")
        .update({
          items: updatedItems,
          returned: allReturned, // علم فقط لو كل البنود رجعت بالكامل
          return_date: allReturned ? today : null,
        })
        .eq("id", selInvoice.id);

      if (saleUpdateError) {
        showToast(
          "⚠️ تم تحديث الخزنة/المديونية لكن فشل تحديث الفاتورة الأصلية — راجع فاتورة " + selInvoice.id + ": " + saleUpdateError.message,
          "error"
        );
        return;
      }

      setSales((prev) =>
        prev.map((s) =>
          s.id === selInvoice.id
            ? { ...s, items: updatedItems, returned: allReturned, returnDate: allReturned ? today : s.returnDate }
            : s
        )
      );
    }

    // ═══════════════════════════════════════════════════
    // 🆕 مرتجع مشتريات: يرتبط بفاتورة الشراء وينزل من مديونية المورد
    // عبر تحديث purchases.returned_amount (تراكمي)
    // ═══════════════════════════════════════════════════
    let supplierIdForReturn = null;
    if (type === "purchases" && purchaseInvoice) {
      supplierIdForReturn = purchaseInvoice.supplier;
      const newReturnedAmount = (purchaseInvoice.returned_amount || 0) + returnTotal;

      const updatedItems = (purchaseInvoice.items || []).map((item) => {
        const ri = itemsToReturn.find((i) => i.id === item.id);
        if (!ri) return item;
        return { ...item, returnedQty: (item.returnedQty || 0) + ri.returnQty };
      });

      const { error: purchaseUpdateError } = await supabase
        .from("purchases")
        .update({
          returned_amount: newReturnedAmount,
          items: updatedItems,
        })
        .eq("id", purchaseInvoice.id);

      if (purchaseUpdateError) {
        showToast("خطأ في تحديث فاتورة الشراء الأصلية: " + purchaseUpdateError.message, "error");
        return;
      }

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === purchaseInvoice.id
            ? { ...p, returned_amount: newReturnedAmount, items: updatedItems }
            : p
        )
      );
    }

    // ── حفظ سجل المرتجع نفسه ──
    const isShiftFundedRefundRow =
      type === "sales" && (selInvoice?.payment || "نقدي") !== "آجل" && refundMethod === "نقدي" && dayClosedToday && openShiftToday && refundSource === "shift";
    const { data: newReturnRows, error } = await supabase.from("returns").insert([
      {
        id: returnId,
        date: today,
        type,
        invoice_id: selInvoice?.id || null,
        purchase_invoice_id: purchaseInvoice?.id || null, // 🆕
        supplier_id: supplierIdForReturn, // 🆕
        customer: selCustomer?.id || null,
        customer_name: selCustomer?.name || "زبون عادي",
        items: itemsToReturn,
        reason,
        subtotal: returnSubtotal,
        tax: returnTax,
        total: returnTotal,
        admin_override: adminOverride,
        pharmacy_id: pharmacyId,
        // 🆕 مصدر فلوس الاسترجاع (يخص مرتجعات المبيعات النقدية بعد تقفيل اليوم فقط)
        refund_source: type === "sales" ? refundSource : null,
        refund_shift_id: isShiftFundedRefundRow ? openShiftToday.id : null,
        // 🆕 طريقة رد الفلوس الفعلية للعميل — نقدي أو رجاعة شبكة (بس لو الصيدلية مفعّلة الخيار)
        refund_method: type === "sales" && (selInvoice?.payment || "نقدي") !== "آجل" ? refundMethod : null,
      },
    ]).select();

    if (error) {
      showToast("خطأ في حفظ المرتجع: " + error.message, "error");
      return;
    }
    logAudit({
      pharmacyId, userName: currentUser?.name, action: "create", entityType: "return",
      entityId: returnId, entityLabel: type === "sales" ? (selCustomer?.name || "زبون عادي") : "مرتجع مشتريات",
      newValue: { type, total: returnTotal, reason },
      description: type === "sales" ? `مرتجع مبيعات بقيمة ${returnTotal} ر.س — السبب: ${reason || "—"}` : `مرتجع مشتريات بقيمة ${returnTotal} ر.س — السبب: ${reason || "—"}`,
    });

    // 🆕 تحديث state المرتجعات محليًا فورًا (من غير كده تفضل كارتات الشفتات وتسوية التقفيل قديمة لحد ما تعمل refresh كامل)
    if (newReturnRows && newReturnRows[0]) {
      setReturnsData?.((prev) => [...(prev || []), newReturnRows[0]]);
    }

    // رصد
    // 🆕 مرتجع مبيعات (عميل بيرجّع دواء اشتراه) ≠ مرتجع مشتريات (بيرجع للمورد) في نظام رصد:
    // مرتجع المشتريات فعلاً "إرجاع لجهة" فبيستخدم خدمة Return الرسمية.
    // مرتجع المبيعات مفيهوش جهة مستلمة (المريض مش Stakeholder في رصد) — الصح هو
    // "إلغاء" عملية البيع نفسها عن طريق Pharmacy Sale Cancel (بنفس PRESCRIPTIONID
    // اللي اتبعت وقت البيع الأصلي = رقم الفاتورة) — مؤكد من DTTS-ISD_PHARMACY_SALE.
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    // ✅ مرتجع مبيعات: نستخدم بالظبط نفس السيريالات اللي اترجعت فعليًا (serialsToRelease
    // المحسوبة فوق بمراعاة الكمية الجزئية)، مش سيريال واحد لكل سطر. مرتجع مشتريات لسه سطر=سيريال واحد
    // زي ما هو (كل صف في فاتورة الشراء بيمثل علبة واحدة أصلاً).
    // 🆕 نفس فلتر "دواء بس" بتاع رصد المبيعات — مينفعش صنف غير دوائي يترفع لرصد في المرتجع
    // حتى لو اتحسبله serial بالغلط (باركود اتفهم كـ GS1 من غير ما يكون فعلاً).
    const isRasdDrugReturnLine = (i) => (i.category || i.main_category || i.mainCategory) === "دواء";
    const salesSerializedReturns =
      type === "sales" && selInvoice
        ? itemsToReturn.filter(
            (i) => isRasdDrugReturnLine(i) && ((i.originalSerials && i.originalSerials.length) || i.originalSerial)
          )
        : [];
    const rasdItems =
      type === "sales" && selInvoice
        ? salesSerializedReturns.flatMap((ri) => {
            const all = ri.originalSerials && ri.originalSerials.length ? ri.originalSerials : (ri.originalSerial ? [ri.originalSerial] : []);
            const released = all.slice(ri.alreadyReturnedQty || 0, (ri.alreadyReturnedQty || 0) + ri.returnQty);
            return released.map((sn) => ({
              gtin: ri.gtin || ri.barcode,
              serial: sn,
              batch: ri.batch,
              expiry: ri.expiry,
            }));
          })
        : itemsToReturn
            .filter((i) => isRasdDrugReturnLine(i) && i.serial)
            .map((i) => ({
              gtin: i.gtin || i.barcode,
              serial: i.serial,
              batch: i.batch,
              expiry: i.expiry,
            }));
    if (rasdConfig.enabled && rasdItems.length > 0) {
      if (type === "sales" && selInvoice) {
        RasdQueue.enqueue("saleCancel", {
          toGln: "0000000000000", // نفس TOGLN اللي اتبعت وقت البيع الأصلي (بيع مباشر للمريض)
          prescriptionId: String(selInvoice.id),
          items: rasdItems,
        });
      } else if (type === "purchases") {
        // 🆕 TOGLN لازم يكون GLN المورد اللي بنرجّع له، مش GLN الصيدلية نفسها
        const supplierObj = suppliers.find((s) => s.id === supplierIdForReturn);
        if (supplierObj?.gln) {
          RasdQueue.enqueue("return", {
            toGln: supplierObj.gln,
            items: rasdItems,
          });
        } else {
          showToast("⚠️ لم يتم إرسال المرتجع لرصد: رقم GLN الخاص بالمورد غير مسجّل في بيانات المورد", "error");
        }
      }
    }

    setReturnItems([]);
    setReasonOption("");
    setReasonCustom("");
    setSelCustomer(null);
    setCustomerSearch("");
    setSelInvoice(null);
    setInvoiceSearch("");
    setSelPurchaseInvoice("");
    setAdminOverride(false);
    showToast(`✅ تم تسجيل المرتجع — ${returnTotal.toFixed(2)} ر.س`);
  };

  return (
    <div>
      {/* PIN Modal */}
      {showPinModal && (
        <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 16, padding: 28, width: 320, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px" }}>صلاحية مدير مطلوبة</h3>
            <p style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 16 }}>
              الفاتورة أقدم من 14 يوم — أدخل PIN المدير للمتابعة
            </p>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="PIN..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`,
                borderRadius: 8, padding: "10px 14px", color: COLORS.textPrimary, fontSize: 16,
                outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (adminPin === ADMIN_PIN) {
                    setAdminOverride(true);
                    setShowPinModal(false);
                    setAdminPin("");
                    showToast("✅ تم التحقق — يمكنك المتابعة");
                  } else {
                    showToast("PIN غير صحيح", "error");
                    setAdminPin("");
                  }
                }}
                style={{ flex: 1, padding: "9px 0", background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, color: COLORS.blue, fontWeight: 700, cursor: "pointer" }}
              >
                تأكيد
              </button>
              <button
                onClick={() => { setShowPinModal(false); setAdminPin(""); }}
                style={{ padding: "9px 16px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textDim, cursor: "pointer" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        {fixedType === "sales" ? "مرتجع المبيعات" : fixedType === "purchases" ? "مرتجع المشتريات" : "المرتجعات"}
      </h2>

      {/* نوع المرتجع — يظهر فقط لو التبويب مش مثبّت على نوع واحد */}
      {!fixedType && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {["sales", "purchases"]
            .filter((t) => (t === "sales" ? canViewSalesReturns : canViewPurchaseReturns))
            .map((t) => (
            <button key={t} onClick={() => setType(t)}
              style={{
                padding: "9px 22px", borderRadius: 9, border: "1px solid",
                borderColor: type === t ? COLORS.blue : COLORS.border,
                background: type === t ? COLORS.blueSoft : "transparent",
                color: type === t ? COLORS.blue : COLORS.textDim,
                fontWeight: type === t ? 700 : 400, cursor: "pointer", fontSize: 14,
              }}
            >
              مرتجع {t === "sales" ? "مبيعات" : "مشتريات"}
            </button>
          ))}
        </div>
      )}

      {/* ════ مرتجع مبيعات ════ */}
      {type === "sales" && canViewSalesReturns && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>

          {/* بحث فاتورة */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>
              🧾 رقم الفاتورة <span style={{ color: COLORS.red }}>*</span>
              {adminOverride && <span style={{ marginRight: 8, background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 4, padding: "1px 8px", fontSize: 11 }}>🔓 تصريح مدير</span>}
            </label>
            <input
              value={invoiceSearch}
              onChange={(e) => { setInvoiceSearch(e.target.value); setSelInvoice(null); setReturnItems([]); }}
              onFocus={() => setInvoiceSearchOpen(true)}
              onBlur={() => setTimeout(() => setInvoiceSearchOpen(false), 150)}
              placeholder="رقم الفاتورة / اسم العميل / اسم الكاشير / اسم الصنف / المبلغ / التاريخ..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${selInvoice ? COLORS.blue : COLORS.border}`,
                borderRadius: 9, padding: "11px 14px", color: COLORS.textPrimary,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {!selInvoice && (
              <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                💡 لو الفاتورة زبون عادي ومعاكش رقمها: دوّر باسم الصنف اللي اتباع، أو المبلغ، أو التاريخ (مثلاً 2026-07-10)، أو اسم الكاشير اللي باع.
              </div>
            )}
            {selInvoice && (
              <div style={{ marginTop: 6, padding: "6px 12px", background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 8, fontSize: 12, color: COLORS.green, display: "flex", justifyContent: "space-between" }}>
                <span>
                  ✅ {selInvoice.id} — {selInvoice.date} — {selInvoice.customer_name}
                  {" — "}
                  <strong>{selInvoice.payment === "آجل" ? "آجل (سينزل من مديونية العميل)" : "نقدي (سينزل من الخزنة)"}</strong>
                </span>
                <button onClick={() => { setSelInvoice(null); setInvoiceSearch(""); setReturnItems([]); setLastScanResult(null); }}
                  style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>✕</button>
              </div>
            )}
            {invoiceSearchOpen && !selInvoice && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                maxHeight: 220, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                {filteredSaleInvoices.slice(0, 15).map((inv) => {
                  const daysDiff = Math.floor((new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24));
                  const isOld = daysDiff > 14;
                  return (
                    <div key={inv.id} onMouseDown={() => handleSelectInvoice(inv)}
                      style={{
                        padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{inv.id}</div>
                        <div style={{ fontSize: 11, color: COLORS.textDim }}>
                          {inv.customer_name || "زبون عادي"} · {inv.date} · {(inv.total || 0).toFixed(2)} ر.س
                          {inv.payment === "آجل" && <span style={{ color: COLORS.gold }}> · آجل</span>}
                          {inv.cashier_name && <span> · {inv.cashier_name}</span>}
                        </div>
                      </div>
                      {isOld && (
                        <span style={{ fontSize: 10, background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 4, padding: "2px 6px" }}>
                          {daysDiff} يوم 🔐
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredSaleInvoices.length === 0 && (
                  <div style={{ padding: 14, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>لا توجد فواتير مطابقة</div>
                )}
              </div>
            )}
          </div>

          {/* بحث عميل */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>👤 العميل</label>
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); if (!e.target.value) setSelCustomer(null); }}
              onFocus={() => setCustomerSearchOpen(true)}
              onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
              placeholder="ابحث بالاسم أو الجوال..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${selCustomer ? COLORS.blue : COLORS.border}`,
                borderRadius: 9, padding: "11px 14px", color: COLORS.textPrimary,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {customerSearchOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                maxHeight: 200, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                <div onMouseDown={() => { setSelCustomer(null); setCustomerSearch(""); setCustomerSearchOpen(false); }}
                  style={{ padding: "8px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textDim, fontSize: 13 }}>
                  👤 زبون عادي
                </div>
                {(customers || [])
                  .filter((c) => {
                    const q = customerSearch.toLowerCase();
                    if (!q) return true;
                    return (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
                  })
                  .slice(0, 10)
                  .map((c) => (
                    <div key={c.id} onMouseDown={() => { setSelCustomer(c); setCustomerSearch(c.name); setCustomerSearchOpen(false); }}
                      style={{ padding: "8px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: 11, color: COLORS.textDim }}>{c.phone}</div>}
                      </div>
                      {c.credit > 0 && (
                        <span style={{ fontSize: 11, background: COLORS.redSoft, color: COLORS.red, borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
                          آجل: {c.credit?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ مرتجع مشتريات ════ */}
      {type === "purchases" && canViewPurchaseReturns && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 🆕 بحث بالمورد — لعرض فواتيره فقط قبل اختيار الفاتورة */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>🏭 المورد</label>
            <input
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                if (!e.target.value) setSelSupplier(null);
              }}
              onFocus={() => setSupplierSearchOpen(true)}
              onBlur={() => setTimeout(() => setSupplierSearchOpen(false), 150)}
              placeholder="ابحث باسم المورد..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${selSupplier ? COLORS.blue : COLORS.border}`,
                borderRadius: 9, padding: "11px 14px", color: COLORS.textPrimary,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {selSupplier && (
              <div style={{ marginTop: 6, padding: "6px 12px", background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 8, fontSize: 12, color: COLORS.green, display: "flex", justifyContent: "space-between" }}>
                <span>✅ {selSupplier.name}</span>
                <button
                  onClick={() => { setSelSupplier(null); setSupplierSearch(""); setSelPurchaseInvoice(""); }}
                  style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            )}
            {supplierSearchOpen && !selSupplier && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                maxHeight: 220, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                {suppliers
                  .filter((s) => {
                    const q = supplierSearch.toLowerCase();
                    if (!q) return true;
                    return (s.name || "").toLowerCase().includes(q);
                  })
                  .slice(0, 15)
                  .map((s) => (
                    <div
                      key={s.id}
                      onMouseDown={() => {
                        setSelSupplier(s);
                        setSupplierSearch(s.name);
                        setSupplierSearchOpen(false);
                        setSelPurchaseInvoice(""); // إعادة ضبط الفاتورة المختارة عند تغيير المورد
                      }}
                      style={{ padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}
                    >
                      {s.name}
                    </div>
                  ))}
                {suppliers.filter((s) => {
                  const q = supplierSearch.toLowerCase();
                  if (!q) return true;
                  return (s.name || "").toLowerCase().includes(q);
                }).length === 0 && (
                  <div style={{ padding: 14, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>لا يوجد موردين مطابقين</div>
                )}
              </div>
            )}
          </div>

          <Select
            label="اختر فاتورة الشراء"
            value={selPurchaseInvoice}
            onChange={setSelPurchaseInvoice}
            options={[
              { v: "", l: selSupplier ? "اختر فاتورة المورد..." : "اختر الفاتورة..." },
              ...purchases
                .filter((p) => (p.total - (p.returned_amount || 0)) > 0 || (p.returned_amount || 0) === 0)
                .filter((p) => !selSupplier || String(p.supplier) === String(selSupplier.id))
                .map((x) => ({
                  v: x.id,
                  l: `${x.id} — ${x.date} — ${(x.total ?? 0).toFixed(2)} ر.س${
                    x.returned_amount > 0 ? ` (مرتجع سابق: ${x.returned_amount.toFixed(2)})` : ""
                  }`,
                })),
            ]}
          />
        </div>
      )}

      {/* 🆕 طريقة رد الفلوس — بتظهر بس لو الصيدلية مفعّلة عندها رجاعة شبكة، ولو الفاتورة الأصلية دفعت شبكة/تحويل */}
      {type === "sales" && (selInvoice || adminOverride) && (selInvoice?.payment || "نقدي") !== "آجل" && supportsCardRefund && (selInvoice?.payment === "بطاقة" || selInvoice?.payment === "تحويل") && (
        <div style={{ marginBottom: 14 }}>
          <Select
            label="رجّعت الفلوس للعميل إزاي؟"
            value={refundMethod}
            onChange={setRefundMethod}
            options={[
              { v: "نقدي", l: "كاش من الدرج" },
              { v: "بطاقة", l: "رجاعة شبكة (reversal)" },
            ]}
          />
        </div>
      )}

      {/* 🆕 مصدر فلوس الاسترجاع — بيظهر بس لو مرتجع مبيعات نقدي بعد ما تقفيل اليوم حصل وفيه شفت جديد مفتوح */}
      {type === "sales" && (selInvoice || adminOverride) && (selInvoice?.payment || "نقدي") !== "آجل" && refundMethod === "نقدي" && dayClosedToday && openShiftToday && (
        <div style={{ marginBottom: 14 }}>
          <Select
            label="من فين هتدفع الكاش للعميل؟"
            value={refundSource}
            onChange={setRefundSource}
            options={[
              { v: "pending", l: "من فلوس التقفيل المعلّق تسليمها (لسه معايا)" },
              { v: "shift", l: `من النقد الافتتاحي لشفت ${openShiftToday.id}` },
            ]}
          />
          <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
            {refundSource === "pending"
              ? "هيتخصم من إجمالي التقفيل النهارده اللي لسه هيتسلم للمحاسب."
              : "هيتحسب على شفت النقد الافتتاحي ده، ومش هيتخصم من فلوس التقفيل المقفول."}
          </div>
        </div>
      )}

      {/* سبب الإرجاع */}
      <div style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Select
          label="سبب الإرجاع"
          value={reasonOption}
          onChange={setReasonOption}
          style={{ flex: 1, minWidth: 200 }}
          options={[
            { v: "", l: "اختر السبب..." },
            ...(type === "purchases" ? PURCHASE_RETURN_REASONS : SALES_RETURN_REASONS).map((r) => ({ v: r, l: r })),
          ]}
        />
        {reasonOption === "أخرى" && (
          <Input
            label="اكتب السبب"
            value={reasonCustom}
            onChange={setReasonCustom}
            placeholder="وضّح سبب الإرجاع..."
            style={{ flex: 1, minWidth: 200 }}
          />
        )}
      </div>

      {/* 🆕 باركود سكانر لمرتجع المبيعات — يمسح الصنف ويقارنه بباتش الفاتورة الأصلية */}
      {type === "sales" && (selInvoice || adminOverride) && returnItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <BarcodeScanner onScan={handleReturnScan} placeholder="امسح باركود الصنف المرتجع..." />
        </div>
      )}

      {/* 🆕 بار نتيجة آخر مسح — ثابت وواضح لحد ما تمسح صنف تاني */}
      {lastScanResult && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: `1px solid ${
              lastScanResult.status === "matched" ? COLORS.green
                : lastScanResult.status === "mismatch" ? COLORS.red
                : COLORS.gold
            }`,
            background:
              lastScanResult.status === "matched" ? "#0a2a0a"
                : lastScanResult.status === "mismatch" ? "#2a0a0a"
                : "#2a2205",
          }}
        >
          <div style={{ fontSize: 22, flexShrink: 0 }}>
            {lastScanResult.status === "matched" && "✅"}
            {lastScanResult.status === "mismatch" && "⛔"}
            {(lastScanResult.status === "not_found" || lastScanResult.status === "not_in_invoice" || lastScanResult.status === "max_reached") && "⚠️"}
          </div>
          <div style={{ flex: 1 }}>
            {lastScanResult.status === "matched" && (
              <>
                <div style={{ fontWeight: 800, color: COLORS.green, fontSize: 14 }}>
                  {lastScanResult.name} — مطابق للفاتورة ✓
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3 }}>
                  {lastScanResult.originalBatch && <span>باتش: {lastScanResult.originalBatch} </span>}
                  {lastScanResult.originalExpiry && <span>| صلاحية: {lastScanResult.originalExpiry} </span>}
                  | الكمية المرتجعة الآن: {lastScanResult.newQty}
                </div>
              </>
            )}
            {lastScanResult.status === "mismatch" && (
              <>
                <div style={{ fontWeight: 800, color: COLORS.red, fontSize: 14 }}>
                  {lastScanResult.name} — لا يطابق الفاتورة الأصلية!
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span>باتش الفاتورة: <b style={{ color: COLORS.textPrimary }}>{lastScanResult.originalBatch || "—"}</b></span>
                  <span>الباتش الممسوح: <b style={{ color: COLORS.red }}>{lastScanResult.scannedBatch || "—"}</b></span>
                  {(lastScanResult.originalExpiry || lastScanResult.scannedExpiry) && (
                    <span>صلاحية الفاتورة: <b style={{ color: COLORS.textPrimary }}>{lastScanResult.originalExpiry || "—"}</b> / الممسوحة: <b style={{ color: COLORS.red }}>{lastScanResult.scannedExpiry || "—"}</b></span>
                  )}
                </div>
              </>
            )}
            {lastScanResult.status === "not_found" && (
              <div style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13 }}>
                باركود غير مسجل في المنتجات: {lastScanResult.code}
              </div>
            )}
            {lastScanResult.status === "not_in_invoice" && (
              <div style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13 }}>
                "{lastScanResult.name}" غير موجود ضمن أصناف هذه الفاتورة
              </div>
            )}
            {lastScanResult.status === "max_reached" && (
              <div style={{ fontWeight: 700, color: COLORS.gold, fontSize: 13 }}>
                {lastScanResult.name}: وصلت لأقصى كمية قابلة للإرجاع ({lastScanResult.maxReturnable})
              </div>
            )}
          </div>
          <button
            onClick={() => setLastScanResult(null)}
            style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 16, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* الأصناف */}
      {returnItems.length > 0 && (
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
            {selInvoice ? `أصناف فاتورة ${selInvoice.id}` : "الأصناف"}
            {!adminOverride && <span style={{ marginRight: 8, color: COLORS.gold, fontSize: 11 }}>⚠️ سيتم التحقق من الباتش والصلاحية</span>}
          </div>
          {returnItems.map((item, i) => {
            const remainingFromInvoice = Math.max(0, (item.qty || 0) - (item.alreadyReturnedQty || 0));
            // 🆕 لمرتجع المشتريات: مينفعش نرجّع كمية أكبر من الموجود فعليًا بالمخزون من نفس التشغيلة
            // (يعني لو جزء أو كل الكمية اتباع، الباقي القابل للإرجاع بيقل تبعًا لذلك)
            const maxReturnable =
              type === "purchases"
                ? Math.max(0, Math.min(remainingFromInvoice, item.stockQty ?? 0))
                : remainingFromInvoice;
            const soldQty = type === "purchases" ? Math.max(0, remainingFromInvoice - (item.stockQty ?? 0)) : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: item.batchMismatch ? `1px solid ${COLORS.red}` : `1px solid ${COLORS.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    {item.originalBatch && <span>باتش الفاتورة: {item.originalBatch}</span>}
                    {item.originalExpiry && <span style={{ marginRight: 8 }}>صلاحية: {item.originalExpiry}</span>}
                    <span style={{ marginRight: 8 }}>الكمية: {item.qty}</span>
                    {item.alreadyReturnedQty > 0 && (
                      <span style={{ marginRight: 8, color: COLORS.gold }}>سبق إرجاعه: {item.alreadyReturnedQty}</span>
                    )}
                    {soldQty > 0 && (
                      <span style={{ marginRight: 8, color: COLORS.red }}>تم بيع/صرف: {soldQty} (الحد الأقصى للإرجاع: {maxReturnable})</span>
                    )}
                  </div>
                  {item.scannedBatch && (
                    <div style={{ fontSize: 11, marginTop: 3, color: item.batchMismatch ? COLORS.red : COLORS.green }}>
                      {item.batchMismatch ? "⚠️ " : "✓ "}
                      الباتش الممسوح: {item.scannedBatch}
                      {item.scannedExpiry ? ` — صلاحية: ${item.scannedExpiry}` : ""}
                      {item.batchMismatch ? " (لا يطابق الفاتورة الأصلية!)" : ""}
                    </div>
                  )}
                </div>
                <div style={{ color: COLORS.textDim, fontSize: 12, flexShrink: 0 }}>
                  {(type === "purchases" ? item.cost || item.price : item.price).toFixed(2)} ر.س
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.max(0, x.returnQty - 1) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}>-</button>
                  <input type="number" min={0} max={maxReturnable}
                    value={item.returnQty}
                    onChange={(e) => setReturnItems((p) => p.map((x, j) => j === i ? {
                      ...x, returnQty: Math.min(Math.max(0, +e.target.value), maxReturnable)
                    } : x))}
                    style={{ width: 50, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 6px", color: COLORS.textPrimary, fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.min(x.returnQty + 1, maxReturnable) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}>+</button>
                </div>
                {item.taxable && <Badge color={COLORS.greenSoft} text={COLORS.green}>15%</Badge>}
              </div>
            );
          })}
        </div>
      )}

      {/* الإجمالي */}
      {returnTotal > 0 && (
        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 5 }}>
            <span>قبل الضريبة</span><span>{returnSubtotal.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, marginBottom: 5 }}>
            <span>الضريبة المستردة 15%</span><span>{returnTax.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, fontSize: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
            <span>إجمالي المرتجع</span><span>{returnTotal.toFixed(2)} ر.س</span>
          </div>
          {type === "sales" && selInvoice && (
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.blue }}>
              {selInvoice.payment === "آجل"
                ? "↳ سيُخصم هذا المبلغ من مديونية العميل"
                : "↳ سيُسجَّل هذا المبلغ كمصروف من الخزنة"}
            </div>
          )}
          {type === "purchases" && purchaseInvoice && (
            <div style={{ marginTop: 8, fontSize: 11, color: COLORS.blue }}>
              ↳ سيُخصم هذا المبلغ من مديونية المورد {purchaseInvoice.returned_amount > 0 ? `(مرتجع سابق على هذه الفاتورة: ${purchaseInvoice.returned_amount.toFixed(2)} ر.س)` : ""}
            </div>
          )}
        </div>
      )}

      {(type === "sales" ? canEditSalesReturns : canEditPurchaseReturns) ? (
        <Btn icon="returns" onClick={processReturn} variant="danger">تأكيد الإرجاع</Btn>
      ) : (
        <div style={{ padding: "10px 14px", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textDim, fontSize: 12, textAlign: "center" }}>
          🔒 ليس لديك صلاحية تنفيذ {type === "sales" ? "مرتجع المبيعات" : "مرتجع المشتريات"} — عرض فقط
        </div>
      )}
    </div>
  );
}
