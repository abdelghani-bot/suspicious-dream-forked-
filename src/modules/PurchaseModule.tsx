import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import * as XLSX from "xlsx";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { TAX_RATE } from "../data/seedData";
import { logAudit } from "../lib/auditLog";
import { buildLabelBarcode, normGtin, taxInclusiveLabelPrice } from "../lib/barcodeUtils";
import { todayLocal } from "../lib/dateUtils";
import { ProductFormModal } from "./ProductFormModal";
import { RasdSettings } from "./RasdSettings";
import { RasdQueue } from "../services/rasdService";
import { Badge, Btn, IC, Modal, Pagination, Select, Table } from "../ui/primitives";
import { queueEvent } from "../lib/offlineAPI";
import { getDeviceId } from "../lib/deviceID";
import { printHTML } from "../lib/printHelper";

// 🆕 إعادة محاولة بسيطة لكتابات الكاش المحلي (SQLite) — دي مش مصدر الحقيقة (الـ pending_sync_events
// هو المصدر)، بس لو فشلت لسبب عابر (قفل ملف، IO مؤقت) منستحقش نسيبها من أول مرة.
async function retryLocalWrite(fn, attempts = 3, delayMs = 300) {
    let lastResult = { success: false, error: "not_attempted" };
    for (let i = 0; i < attempts; i++) {
        try {
            lastResult = await fn();
            if (lastResult?.success) return lastResult;
        } catch (err) {
            lastResult = { success: false, error: String(err) };
        }
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
    return lastResult;
}

// ==================== طباعة فاتورة الشراء (A4) ====================
const doPrintPurchaseInvoice = async (invoice, supplierName) => {
    const items = invoice.items || [];
    const rowsHtml = items
        .map(
            (i) => `
        <tr>
            <td>${i.name || ""}</td>
            <td style="text-align:center">${i.qty || 0}</td>
            <td style="text-align:center">${i.bonusQty || 0}</td>
            <td style="text-align:center">${(i.receivedCost ?? i.cost ?? 0).toFixed(2)}</td>
            <td style="text-align:center">${((i.receivedCost ?? i.cost ?? 0) * (i.qty || 0)).toFixed(2)}</td>
        </tr>`
        )
        .join("");

    const fullHtml = `<html dir="rtl"><head><style>
        @page{size:A4;margin:14mm}
        body{font-family:'Tajawal',Arial,sans-serif;margin:0;color:#000;font-size:13px}
        h2{margin:0 0 4px;font-size:20px;text-align:center}
        .meta{display:flex;justify-content:space-between;margin:14px 0;font-size:13px;color:#333}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{padding:8px;border-bottom:1px solid #ddd;font-size:12px;text-align:right}
        thead tr{background:#f2f2f2}
        .totals{margin-top:16px;width:280px;margin-right:0;margin-left:auto}
        .totals div{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
        .totals .grand{font-weight:700;font-size:16px;border-top:1px solid #333;margin-top:6px;padding-top:8px}
    </style></head><body>
        <h2>فاتورة شراء</h2>
        <div class="meta">
            <span>رقم الفاتورة: ${invoice.id}</span>
            <span>التاريخ: ${invoice.date}</span>
            <span>المورد: ${supplierName || invoice.supplier_name || invoice.supplierName || "-"}</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>الصنف</th><th>الكمية</th><th>بونص</th><th>تكلفة الوحدة</th><th>الإجمالي</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totals">
            <div><span>الإجمالي قبل الضريبة</span><span>${(invoice.subtotal || 0).toFixed(2)} ر.س</span></div>
            <div><span>الضريبة</span><span>${(invoice.tax_amount ?? invoice.taxAmount ?? 0).toFixed(2)} ر.س</span></div>
            <div class="grand"><span>الإجمالي الكلي</span><span>${(invoice.total || 0).toFixed(2)} ر.س</span></div>
        </div>
    </body></html>`;

    await printHTML(fullHtml); // من غير paperWidthMM = A4 تلقائي
};
export function PurchaseModule({
    products,
    setProducts,
    suppliers,
    purchases,
    setPurchases,
    showToast,
    pharmacyId,
    currentUser,
    // 🆕 حالة فاتورة الشراء الجاري إدخالها — مرفوعة لـ App عشان تفضل موجودة لو الصيدلي غيّر التاب ورجع
    items, setItems,
    selSupplier, setSelSupplier,
    manualSubtotal, setManualSubtotal,
    manualTax, setManualTax,
    showNew, setShowNew,
    canAdd = true,
    canEdit = true,
    jokerPendingItems = [],
    setJokerPendingItems = () => { },
}) {
    // 🆕 نافذة إضافة/تعديل صنف فوق فاتورة الشراء (من غير ما تقفل الفاتورة)
    const [showProductForm, setShowProductForm] = useState(false);
    const [productFormEditId, setProductFormEditId] = useState(null);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedPurchIdx, setHighlightedPurchIdx] = useState(-1);
    const [showProductCard, setShowProductCard] = useState(null);
    const searchRef = useRef(null);
    // ملحوظة: items/selSupplier/manualSubtotal/manualTax/showNew بقوا جايين من App (props)
    // بدل ما يكونوا state محلي هنا، عشان يفضلوا موجودين حتى لو الكومبوننت اتقفل وفتح تاني (تغيير تاب).
    const clearPurchaseDraft = () => {
        try { localStorage.removeItem(`pharmacypro_purchase_draft_${pharmacyId}`); } catch { }
    };

    // ===== استيراد ملف Excel من موقع رصد (GTIN/SN/BN/XD) لفاتورة الشراء =====
    const rasdExcelInputRef = useRef(null);
    const [rasdImportBusy, setRasdImportBusy] = useState(false);
    const [rasdImportResult, setRasdImportResult] = useState(null); // { matchedCount, unmatched: [{gtin,batch,expiry,qty}] }

    // ═══════════════════════════════════════════════════
    // 🆕 استيراد فاتورة مورد عام (كوزمتيك وغيرها) من ملف Excel بأي تنسيق —
    // مش زي ملف رصد اللي عناوينه شبه ثابتة، هنا كل مورد بيبعت ملفه بشكله الخاص.
    // بنعتمد على: (1) بروفايل تربيطة أعمدة محفوظ لكل مورد (يتحفظ أول مرة ويتطبق تلقائيًا بعد كده)
    // (2) قاموس "كود المورد → صنف عندنا" محفوظ لكل مورد (زي باركود إضافي خاص بيه)
    // (3) مطابقة تقريبية بالاسم لو مفيش باركود ولا كود مسجل، مع اقتراح أقرب الأصناف
    // ═══════════════════════════════════════════════════
    const supplierExcelInputRef = useRef(null);
    const [supplierImportBusy, setSupplierImportBusy] = useState(false);
    const [supplierImportResult, setSupplierImportResult] = useState(null); // { matchedCount, needsReview: [{key,name,code,barcode,qty,price,suggestions,saveCode}] }
    const [supplierColumnProfile, setSupplierColumnProfile] = useState(null); // { name, code, barcode, qty, price } لهذا المورد
    const [supplierCodesMap, setSupplierCodesMap] = useState({}); // { [supplier_code]: product_id } لهذا المورد
    const [pendingSupplierRows, setPendingSupplierRows] = useState(null);
    const [showColumnMapModal, setShowColumnMapModal] = useState(false);
    const [columnMapDraft, setColumnMapDraft] = useState({ name: "", code: "", barcode: "", qty: "", price: "" });
    const [reviewNewProductIdx, setReviewNewProductIdx] = useState(null); // index الصف اللي بيتضاف له صنف جديد
    const [productFormPrefillName, setProductFormPrefillName] = useState("");

    // تحميل بروفايل الأعمدة وقاموس أكواد الأصناف الخاصين بالمورد المختار
    useEffect(() => {
        if (!selSupplier || !pharmacyId) { setSupplierCodesMap({}); setSupplierColumnProfile(null); return; }
        supabase.from("supplier_product_codes").select("supplier_code, product_id")
            .eq("pharmacy_id", pharmacyId).eq("supplier_id", selSupplier)
            .then(({ data }) => {
                const map = {};
                (data || []).forEach((r) => { map[r.supplier_code] = r.product_id; });
                setSupplierCodesMap(map);
            })
            .catch(() => {
                // أوفلاين أو فشل الاتصال — نسيب الخريطة فاضية، الاستيراد هيعمل مطابقة يدوية بس
                setSupplierCodesMap({});
            });

        supabase.from("supplier_import_profiles").select("column_mapping")
            .eq("pharmacy_id", pharmacyId).eq("supplier_id", selSupplier).maybeSingle()
            .then(({ data }) => setSupplierColumnProfile(data?.column_mapping || null))
            .catch(() => setSupplierColumnProfile(null));
    }, [selSupplier, pharmacyId]);

    const [showDetail, setShowDetail] = useState(null);
    const [editItems, setEditItems] = useState([]);
    const [editSupplier, setEditSupplier] = useState("");
    const [editManualSubtotal, setEditManualSubtotal] = useState("");
    const [editManualTax, setEditManualTax] = useState("");

    // 🆕 بند فاتورة شراء محفوظة ممكن يكون خلاص اتباع منه شوية (كليًا أو جزئيًا) قبل ما
    // الصيدلي يفتح شاشة التعديل. حذف البند أو تقليل كميته تحت الكمية المتباعة كان بيسمح
    // بيه الكود من غير أي تحقق، وده بيعمل stockDelta سالب بيتطبّق على المخزون من غير ما
    // يراعي إن جزء من الكمية دي خرج فعليًا لعميل بالفعل. الدالة دي بتحسب: من الكمية الأصلية
    // اللي البند ده زوّدها وقت الحفظ، قد إيه لسه فاضل في نفس الـ batch (batch_id) دلوقتي —
    // فالفرق هو اللي اتباع.
    const getSoldQtyForPurchaseItem = (editedItem) => {
        const original = (showDetail?.items || []).find((oi) => oi.id === editedItem.id);
        if (!original) return 0; // بند جديد اتضاف في التعديل نفسه، معندوش تاريخ بيع خالص
        if (!original.batch_id) {
            // بند قديم من غير batch_id متسجل (قبل تتبع الباتشات) — منقدرش نحسب المتبقي
            // بدقة على مستوى الشغلة، فبنرجّع 0 (يعني نسمح بالتعديل زي ما كان شغال قبل كده)
            // بدل ما نمنع حاجة كانت متاحة أصلاً.
            return 0;
        }
        const originalQty = (original.qty || 0) + (original.bonusQty || 0);
        const product = (products || []).find((p) => p.id === editedItem.id);
        const matchedBatch = (product?.batches || []).find((b) => b.id === original.batch_id);
        const currentBatchQty = matchedBatch ? (matchedBatch.qty || 0) : 0;
        return Math.max(0, originalQty - currentBatchQty);
    };
    // 🆕 بحث وPagination لجدول فواتير الشراء — كان بيعرض كل الفواتير دفعة واحدة من غير أي وسيلة بحث.
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const PURCHASE_PAGE_SIZE = 25;
    const [purchasePage, setPurchasePage] = useState(1);
    useEffect(() => { setPurchasePage(1); }, [invoiceSearch]);

    // ===== رصد: قبول شحنة Dispatch كاملة دفعة واحدة =====
    // (تم نقل ميزة "القبول برقم التشغيلة" الصحيحة إلى شاشة إعدادات رصد — راجع RasdSettings)

    // ===== طباعة الباركود =====
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printMethod, setPrintMethod] = useState("browser"); // "browser" | "zpl"
    const [printItems, setPrintItems] = useState([]);
    const [pharmSettings, setPharmSettings] = useState({});
    const LABEL_SIZES = [
        { id: "25x50", label: "25×50 mm (المقاس الفعلي)", w: 25, h: 50 },
        { id: "40x25", label: "40×25 mm", w: 40, h: 25 },
        { id: "50x30", label: "50×30 mm", w: 50, h: 30 },
        { id: "58x40", label: "58×40 mm", w: 58, h: 40 },
        { id: "60x40", label: "60×40 mm", w: 60, h: 40 },
        { id: "76x51", label: "76×51 mm (Zebra 3×2 بوصة)", w: 76.2, h: 50.8 },
    ];
    useEffect(() => {
        if (!pharmacyId) return;
        supabase.from("pharmacy_settings").select("*").eq("pharmacy_id", pharmacyId).single()
            .then(({ data }) => { if (data) setPharmSettings(data); });
    }, [pharmacyId]);

    useEffect(() => {
        const loadScript = (id, src) => {
            if (document.getElementById(id)) return;
            const s = document.createElement("script");
            s.id = id;
            s.src = src;
            s.async = false;
            document.body.appendChild(s);
        };
        loadScript("browserprint-sdk", "/browserprint/BrowserPrint-3.1.250.min.js");
        loadScript("browserprint-zebra-sdk", "/browserprint/BrowserPrint-Zebra-1.1.250.min.js");
        loadScript("jsbarcode-sdk", "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js");
    }, []);

    const printLabels = (invoiceItems) => {
        setPrintItems(invoiceItems.map((i) => ({ ...i, copies: i.qty + (i.bonusQty || 0), selected: true })));
        setShowPrintModal(true);
    };

    const doPrint = () => {
        const size = LABEL_SIZES.find((s) => s.id === (pharmSettings.label_size || "25x50")) || LABEL_SIZES[0];
        const labels = [];
        printItems.filter((item) => item.selected !== false).forEach((item) => {
            for (let c = 0; c < item.copies; c++) {
                labels.push(item);
            }
        });

        const win = window.open("", "_blank");
        win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملصقات الباركود</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          body { font-family: Arial, sans-serif; }
          .page { display: flex; flex-wrap: wrap; }
          .label {
            width: ${size.w}mm;
            height: ${size.h}mm;
            border: 0.5px solid #ccc;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-after: always;
            page-break-inside: avoid;
          }
          .label:last-child { page-break-after: auto; }
          .pharmacy { font-size: 7pt; font-weight: bold; text-align: center; }
          .phone { font-size: 6pt; text-align: center; color: #444; }
          .product { font-size: 7pt; font-weight: bold; text-align: center; margin: 1mm 0; }
          .details { display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; font-weight: bold; margin-top: 1mm; gap: 4px; }
          .details span { white-space: nowrap; }
          img.barcode { width: calc(100% - ${(Number(pharmSettings.barcode_margin_mm) || 2.5) * 2}mm); margin: 0 auto; height: ${size.h * 0.35}mm; display: block; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding:10px; text-align:center;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        <div class="page">
          ${labels.map((item, idx) => `
            <div class="label">
              <div class="pharmacy">${pharmSettings.name_ar || ""}</div>
              <div class="phone">${pharmSettings.phone || ""}</div>
              <div class="product">${item.name}</div>
              <img class="barcode" id="bc${idx}" />
              <div class="details">
                <span>شامل الضريبة: ${taxInclusiveLabelPrice(item)} ر.س</span>
                <span>${item.expiry_date ? "تاريخ الانتهاء: " + item.expiry_date : ""}</span>
              </div>
            </div>
          `).join("")}
        </div>
        <script>
          window.onload = function() {
            ${labels.map((item, idx) => {
            const barcodeResult = buildLabelBarcode(item);
            const bcCode = barcodeResult.ok ? barcodeResult.data : (item.barcode || item.id);
            const bcEan128 = barcodeResult.mode === "gs1" ? "true" : "false";
            const bcShowValue = barcodeResult.mode === "gs1" ? "false" : "true";
            return `
              try {
                JsBarcode("#bc${idx}", "${bcCode}", {
                  format: "CODE128", ean128: ${bcEan128}, width: 1.5, height: ${size.h * 3},
                  displayValue: ${bcShowValue}, fontSize: 8, margin: 0
                });
              } catch(e) {}
            `;
        }).join("")}
          };
        </script>
      </body>
      </html>
    `);
        win.document.close();
        setShowPrintModal(false);
    };

    // ===== طباعة ZPL مباشرة (Zebra Browser Print) =====
    // دقة الطابعة قابلة للتغيير من "بيانات الصيدلية" (203dpi للطابعات العادية زي GK420t، 300dpi لبعض الطابعات الأدق)
    const PRINTER_DPI = Number(pharmSettings.label_dpi) || 203;
    const DOTS_PER_MM = PRINTER_DPI / 25.4;

    const renderLabelCanvas = (item, size) => {
        return new Promise((resolve) => {
            const w = Math.round(size.w * DOTS_PER_MM);
            const h = Math.round(size.h * DOTS_PER_MM);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = "#000";
            ctx.textAlign = "center";
            ctx.direction = "rtl";

            let y = 16;
            ctx.font = "bold 15px Arial";
            ctx.fillText(pharmSettings.name_ar || "", w / 2, y, w - 8);
            y += 15;
            ctx.font = "12px Arial";
            ctx.fillText(pharmSettings.phone || "", w / 2, y, w - 8);
            y += 18;
            ctx.font = "bold 15px Arial";
            ctx.fillText(item.name || "", w / 2, y, w - 8);
            y += 10;

            // نحجز مكان تحت لسطر واحد بس (سعر شامل الضريبة + تاريخ الانتهاء جنب بعض) قبل ما نحسب
            // ارتفاع الباركود، عشان الباركود ميوكلش المساحة كلها ويسيب الكلام اللي تحته من غير مكان
            const priceLineHeight = 18; // السطر ده أكبر وأوضح من باقي السطور
            const hasExpiry = !!item.expiry_date;
            const footerHeight = priceLineHeight + 8;
            const bcGapAfter = 14; // مسافة أكبر شوية بين الباركود والسطر تحته عشان يبقى واضح إنه سطر منفصل
            const availableForBarcode = h - y - footerHeight - bcGapAfter;
            const bcHeight = Math.max(20, Math.min(Math.round(h * 0.28), availableForBarcode));

            const barcodeResult = buildLabelBarcode(item);
            const bcCode = barcodeResult.ok ? barcodeResult.data : (item.barcode || item.id);
            const bcOptions = barcodeResult.mode === "gs1" ? { ean128: true } : {};
            // في وضع GS1 منعرضش نص الباركود الخام (أرقام AI مش مفيدة للعين)، والسعر/الصلاحية
            // بنعرضهم احنا بخطنا تحت. في وضع custom أو plain نعرض الكود زي ما هو مفيد للقراءة اليدوية.
            const bcShowValue = barcodeResult.mode !== "gs1";
            // هامش جانبي حقيقي يمين وشمال (قابل للتعديل من "بيانات الصيدلية") عشان الباركود ميلزقش
            // في حواف الملصق ويسيب مساحة كافية لباقي المعلومات تتطبع بوضوح
            const BC_SIDE_MARGIN_MM = Number(pharmSettings.barcode_margin_mm) || 2.5;
            const bcSideMarginPx = Math.round(BC_SIDE_MARGIN_MM * DOTS_PER_MM);
            const bcMaxW = Math.max(20, w - bcSideMarginPx * 2); // المساحة المتاحة بالبيكسل داخل الملصق

            // الخطوة 1: نرسم بعرض module = 1 بيكسل عشان نعرف "عدد الوحدات" الحقيقي للكود
            // ده مش هيتحط في الملصق، بس بيدينا مقياس دقيق لطول الكود المُرمّز فعليًا
            let moduleUnitWidth = 0;
            const probeCanvas = document.createElement("canvas");
            try {
                window.JsBarcode(probeCanvas, bcCode, {
                    ...bcOptions,
                    format: "CODE128",
                    displayValue: false,
                    margin: 0,
                    width: 1,
                    height: bcHeight,
                });
                moduleUnitWidth = probeCanvas.width || 0;
            } catch (e) { }

            // الخطوة 2: نحسب أكبر عرض صحيح (integer) للـ module يخلي الباركود يملى المساحة
            // من غير ما يعدّيها - عشان كل خط يترسم بعدد بيكسلات صحيح، ومفيش كسور تبوّظ الطباعة الحرارية
            const bcCanvas = document.createElement("canvas");
            if (moduleUnitWidth > 0) {
                const scale = Math.max(1, Math.floor(bcMaxW / moduleUnitWidth));
                try {
                    window.JsBarcode(bcCanvas, bcCode, {
                        ...bcOptions,
                        format: "CODE128",
                        displayValue: bcShowValue,
                        fontSize: 14,
                        margin: 0,
                        width: scale,
                        height: bcHeight,
                    });
                } catch (e) { }
            }

            if (bcCanvas.width) {
                // مفيش تصغير أو تكبير هنا - الباركود بيترسم بمقاسه الطبيعي بالظبط زي ما JsBarcode ولّده
                const bcX = Math.max(0, Math.round((w - bcCanvas.width) / 2));
                ctx.drawImage(bcCanvas, bcX, y);
                y += bcCanvas.height + bcGapAfter;
            }

            ctx.direction = "ltr";
            ctx.font = "bold 13px Arial";
            if (hasExpiry) {
                // السعر يمين والتاريخ شمال على نفس السطر، كل واحد في نص مساحته عشان ميتلخبطوش
                ctx.textAlign = "right";
                ctx.fillText(`شامل الضريبة: ${taxInclusiveLabelPrice(item)} ر.س`, w - 6, y, w / 2 - 10);
                ctx.textAlign = "left";
                ctx.fillText(`تاريخ الانتهاء: ${item.expiry_date}`, 6, y, w / 2 - 10);
                ctx.textAlign = "center";
            } else {
                ctx.fillText(`شامل الضريبة: ${taxInclusiveLabelPrice(item)} ر.س`, w / 2, y, w - 8);
            }

            resolve(canvas);
        });
    };

    // تحويل صورة Canvas لأوامر رسم ZPL (^GFA) بصيغة Hex أبيض/أسود
    const canvasToZPLGraphic = (canvas) => {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h).data;
        const bytesPerRow = Math.ceil(w / 8);
        const totalBytes = bytesPerRow * h;
        let hex = "";
        for (let y = 0; y < h; y++) {
            for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const x = byteIdx * 8 + bit;
                    let on = 0;
                    if (x < w) {
                        const idx = (y * w + x) * 4;
                        const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
                        const brightness = (r + g + b) / 3;
                        on = a > 10 && brightness < 128 ? 1 : 0;
                    }
                    byte = (byte << 1) | on;
                }
                hex += byte.toString(16).padStart(2, "0");
            }
        }
        return { totalBytes, bytesPerRow, hex: hex.toUpperCase() };
    };

    const doPrintZPL = async () => {
        const size = LABEL_SIZES.find((s) => s.id === (pharmSettings.label_size || "25x50")) || LABEL_SIZES[0];
        const labels = [];
        printItems.filter((item) => item.selected !== false).forEach((item) => {
            for (let c = 0; c < item.copies; c++) labels.push(item);
        });

        if (!window.BrowserPrint) {
            alert("تطبيق Zebra Browser Print غير شغال. تأكد إنه مثبت وشغال في الخلفية على هذا الجهاز، ثم حاول تاني.");
            return;
        }

        let fullZPL = "";
        for (const item of labels) {
            const canvas = await renderLabelCanvas(item, size);
            const { totalBytes, bytesPerRow, hex } = canvasToZPLGraphic(canvas);
            fullZPL += `^XA^PW${canvas.width}^LL${canvas.height}^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex}^XZ`;
        }

        window.BrowserPrint.getDefaultDevice(
            "printer",
            (device) => {
                device.send(
                    fullZPL,
                    () => setShowPrintModal(false),
                    (err) => alert("فشلت الطباعة عبر ZPL: " + err)
                );
            },
            (err) => alert("لم يتم العثور على طابعة متصلة عبر Browser Print: " + err)
        );
    };
    // ===== نهاية طباعة ZPL =====
    // ===== نهاية طباعة الباركود =====

    const lastKeyTimePurch = useRef<number>(0);
    const keyCountPurch = useRef<number>(0);
    const scanTimerPurch = useRef<ReturnType<typeof setTimeout>>(null);

    const handleSearchChange = (val) => {
        setSearchText(val);
        if (!val.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        const results = products
            .filter(
                (p) =>
                    (p.name_ar || p.name || "").includes(val) ||
                    (p.barcode || "").includes(val) ||
                    (p.id || "").includes(val)
            )
            .slice(0, 8);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
        setHighlightedPurchIdx(-1);

    };

    const addItem = (p, expiry = "", batch = "") => {
        setItems((prev) => {
            const ex = prev.find((i) => i.id === p.id && (i.expiry_date || "") === expiry);
            if (ex && !expiry)
                return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
            if (ex && expiry)
                return prev.map((i) => (i.id === p.id && i.expiry_date === expiry ? { ...i, qty: i.qty + 1 } : i));
            return [
                ...prev,
                {
                    ...p,
                    qty: 1,
                    bonusQty: 0,
                    discount1: 0,
                    discount2: 0,
                    receivedCost: p.cost ?? 0,
                    newSalePrice: p.price,
                    expiry_date: expiry,
                    batch_number: batch,
                    _rowKey: p.id + "_" + Date.now(),
                },
            ];
        });
        setSearchText("");
        setSearchResults([]);
        setShowDropdown(false);
        focusNewItemQty(p);

    };

    // إضافة نفس الصنف كصف جديد مستقل (تاريخ مختلف)
    const addItemAsNew = (p, expiry = "", batch = "") => {
        setItems((prev) => [
            ...prev,
            {
                ...p,
                qty: 1,
                bonusQty: 0,
                discount1: 0,
                discount2: 0,
                receivedCost: p.cost ?? 0,
                newSalePrice: p.price,
                expiry_date: expiry,
                batch_number: batch,
                _rowKey: p.id + "_" + Date.now(),
            },
        ]);
        setSearchText("");
        setSearchResults([]);
        setShowDropdown(false);
        focusNewItemQty(p);
    };

    // إضافة صف بكمية محدَّدة دفعة واحدة (بدون المرور بمنطق "زود الكمية بواحد" الخاص بـ addItem)
    // — ده اللي بيستخدمه استيراد ملف رصد عشان يحط كل دفعة (batch+expiry) بكميتها الصحيحة مرة واحدة
    const addItemWithQty = (p, expiry, batch, qty) => {
        setItems((prev) => {
            const ex = prev.find((i) => i.id === p.id && (i.expiry_date || "") === (expiry || "") && (i.batch_number || "") === (batch || ""));
            if (ex) {
                return prev.map((i) =>
                    i._rowKey === ex._rowKey ? { ...i, qty: (i.qty || 0) + qty } : i
                );
            }
            return [
                ...prev,
                {
                    ...p,
                    qty,
                    bonusQty: 0,
                    discount1: 0,
                    discount2: 0,
                    receivedCost: p.cost ?? 0,
                    newSalePrice: p.price,
                    expiry_date: expiry || "",
                    batch_number: batch || "",
                    _rowKey: p.id + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                },
            ];
        });
    };

    // إضافة صف بكمية وتكلفة وحدة محدَّدتين — ده اللي بيستخدمه استيراد فاتورة المورد العام
    // (الخصم وتاريخ الصلاحية بيفضلوا زي ما هما، الصيدلي بيدخلهم يدويًا في نفس الصف بعد كده)
    const addItemWithQtyAndCost = (p, qty, cost) => {
        setItems((prev) => [
            ...prev,
            {
                ...p,
                qty: qty || 1,
                bonusQty: 0,
                discount1: 0,
                discount2: 0,
                receivedCost: cost > 0 ? cost : (p.cost ?? 0),
                newSalePrice: p.price,
                expiry_date: "",
                batch_number: "",
                _rowKey: p.id + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            },
        ]);
    };

    // ═══════════════════════════════════════════════════
    // 🆕 مطابقة تقريبية بالاسم (Dice coefficient على bigrams) — بتوحّد أشكال الهمزة/الألف
    // المقصورة/التاء المربوطة وتشيل التشكيل والمسافات الزيادة الأول، عشان الفروق الإملائية
    // البسيطة بين اسم الصنف في ملف المورد واسمه عندنا متكسرش المطابقة.
    // ═══════════════════════════════════════════════════
    const normalizeArabicName = (s) =>
        stripInvisibleChars(String(s || ""))
            .replace(/[\u064B-\u065F\u0670]/g, "") // تشكيل
            .replace(/[إأآا]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ة/g, "ه")
            .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, " ")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");

    const diceCoefficient = (a, b) => {
        const na = normalizeArabicName(a);
        const nb = normalizeArabicName(b);
        if (!na || !nb) return 0;
        if (na === nb) return 1;
        const grams = (s) => { const g = []; for (let i = 0; i < s.length - 1; i++) g.push(s.slice(i, i + 2)); return g; };
        const ga = grams(na), gb = grams(nb);
        if (!ga.length || !gb.length) return na === nb ? 1 : 0;
        const map = new Map();
        ga.forEach((g) => map.set(g, (map.get(g) || 0) + 1));
        let inter = 0;
        gb.forEach((g) => {
            const c = map.get(g) || 0;
            if (c > 0) { inter++; map.set(g, c - 1); }
        });
        return (2 * inter) / (ga.length + gb.length);
    };

    const findBestProductMatches = (name, topN = 3) =>
        products
            .map((p) => ({ product: p, score: diceCoefficient(name, p.name_ar || p.name || "") }))
            .filter((s) => s.score >= 0.25)
            .sort((a, b) => b.score - a.score)
            .slice(0, topN);

    // كلمات مفتاحية موسّعة لاكتشاف أعمدة فاتورة أي مورد (مش بس رصد) — الاسم/الكود/الباركود/الكمية/السعر
    const SUPPLIER_COL_CANDIDATES = {
        name: ["اسم الصنف", "اسم المنتج", "الصنف", "الوصف", "product name", "item name", "description", "الاسم", "name"],
        code: ["كود الصنف", "كود المنتج", "رقم الصنف", "item code", "product code", "sku", "كود", "code"],
        barcode: ["الباركود", "باركود", "barcode", "gtin", "رقم البند"],
        qty: ["الكمية المطلوبة", "الكمية الموردة", "الكمية", "qty", "quantity", "العدد"],
        price: ["سعر الوحدة", "سعر الشراء", "السعر", "unit price", "price", "سعر"],
    };
    const autoDetectSupplierColumns = (headerRow) => ({
        name: findRasdColumn(headerRow, SUPPLIER_COL_CANDIDATES.name),
        code: findRasdColumn(headerRow, SUPPLIER_COL_CANDIDATES.code),
        barcode: findRasdColumn(headerRow, SUPPLIER_COL_CANDIDATES.barcode),
        qty: findRasdColumn(headerRow, SUPPLIER_COL_CANDIDATES.qty),
        price: findRasdColumn(headerRow, SUPPLIER_COL_CANDIDATES.price),
    });

    // تسجيل كود المورد كـ"باركود إضافي" دائم مربوط بيه — من ساعتها أي فاتورة جاية منه وفيها
    // نفس الكود هتتطابق تلقائيًا من غير أي مراجعة يدوية
    const registerSupplierCode = async (code, productId) => {
        if (!code || !selSupplier || !pharmacyId) return;
        setSupplierCodesMap((prev) => ({ ...prev, [code]: productId }));
        const { error } = await supabase.from("supplier_product_codes").upsert(
            { pharmacy_id: pharmacyId, supplier_id: selSupplier, supplier_code: code, product_id: productId },
            { onConflict: "pharmacy_id,supplier_id,supplier_code" }
        );
        if (error) console.error("فشل حفظ كود المورد:", error.message);
    };

    // تجميع صفوف الملف حسب (باركود أو كود مورد أو اسم) ثم مطابقتها بأصنافنا بالترتيب:
    // 1) باركود  2) كود مورد محفوظ سابقًا  3) مطابقة تقريبية بالاسم (تلقائي لو التطابق قوي جدًا، وإلا للمراجعة)
    const processSupplierRows = (rows, mapping) => {
        const grouped = new Map();
        rows.forEach((row) => {
            const rawName = mapping.name ? stripInvisibleChars(row[mapping.name] ?? "").trim() : "";
            if (!rawName) return;
            const rawCode = mapping.code ? stripInvisibleChars(row[mapping.code] ?? "").trim() : "";
            const rawBarcode = mapping.barcode ? normalizeExcelGtin(row[mapping.barcode]) : "";
            const qty = mapping.qty ? (Number(row[mapping.qty]) || 1) : 1;
            const price = mapping.price ? (Number(row[mapping.price]) || 0) : 0;
            const key = rawBarcode || rawCode || rawName;
            const prev = grouped.get(key);
            grouped.set(key, {
                key, name: rawName, code: rawCode, barcode: rawBarcode,
                qty: (prev?.qty || 0) + qty,
                price: price || prev?.price || 0,
            });
        });

        let matchedCount = 0;
        const needsReview = [];
        for (const entry of grouped.values()) {
            let found = entry.barcode
                ? products.find((x) => normGtin(x.barcode) === normGtin(entry.barcode) || normGtin(x.gtin) === normGtin(entry.barcode))
                : null;
            if (!found && entry.code && supplierCodesMap[entry.code]) {
                found = products.find((x) => String(x.id) === String(supplierCodesMap[entry.code]));
            }
            if (found) {
                addItemWithQtyAndCost(found, entry.qty, entry.price);
                matchedCount++;
                continue;
            }
            const suggestions = findBestProductMatches(entry.name, 3);
            if (suggestions.length && suggestions[0].score >= 0.85) {
                addItemWithQtyAndCost(suggestions[0].product, entry.qty, entry.price);
                matchedCount++;
                if (entry.code) registerSupplierCode(entry.code, suggestions[0].product.id);
                continue;
            }
            needsReview.push({ ...entry, suggestions, saveCode: !!entry.code });
        }

        setSupplierImportResult({ matchedCount, needsReview });
        showToast(
            `تم استيراد ${matchedCount} صنف تلقائيًا ✓` +
            (needsReview.length ? ` — و${needsReview.length} صنف محتاج مراجعة يدوية` : "")
        );
    };

    const handleSupplierExcelFile = async (file) => {
        if (!file) return;
        if (!selSupplier) { showToast("اختر المورد الأول", "error"); return; }
        setSupplierImportBusy(true);
        setSupplierImportResult(null);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
            if (!rows.length) {
                showToast("الملف فارغ أو مفيش صفوف بيانات فيه", "error");
                setSupplierImportBusy(false);
                return;
            }

            const headerKeys = Object.keys(rows[0]);
            // 🆕 لو فيه بروفايل أعمدة محفوظ لهذا المورد من فاتورة سابقة، وأعمدته الأساسية (اسم+كمية)
            // لسه موجودة بنفس الاسم في الملف الجديد → طبّقه على طول من غير ما يشوف شاشة التأكيد
            if (
                supplierColumnProfile?.name && headerKeys.includes(supplierColumnProfile.name) &&
                supplierColumnProfile?.qty && headerKeys.includes(supplierColumnProfile.qty)
            ) {
                processSupplierRows(rows, supplierColumnProfile);
                showToast("✓ استُخدمت نفس تربيطة الأعمدة زي آخر فاتورة من هذا المورد");
                setSupplierImportBusy(false);
                if (supplierExcelInputRef.current) supplierExcelInputRef.current.value = "";
                return;
            }

            // مفيش بروفايل مناسب → اكتشاف تلقائي بكلمات مفتاحية موسّعة + عرض شاشة تأكيد/تعديل
            setColumnMapDraft(autoDetectSupplierColumns(rows[0]));
            setPendingSupplierRows(rows);
            setShowColumnMapModal(true);
        } catch (e) {
            showToast("تعذّرت قراءة الملف: " + (e?.message || e), "error");
        } finally {
            setSupplierImportBusy(false);
            if (supplierExcelInputRef.current) supplierExcelInputRef.current.value = "";
        }
    };

    const confirmColumnMapping = async () => {
        if (!columnMapDraft.name || !columnMapDraft.qty) {
            showToast("لازم تحدد عمود الاسم وعمود الكمية على الأقل", "error");
            return;
        }
        setShowColumnMapModal(false);
        setSupplierColumnProfile(columnMapDraft);
        if (pharmacyId && selSupplier) {
            const { error } = await supabase.from("supplier_import_profiles").upsert(
                { pharmacy_id: pharmacyId, supplier_id: selSupplier, column_mapping: columnMapDraft },
                { onConflict: "pharmacy_id,supplier_id" }
            );
            if (error) showToast("⚠️ اتطبّقت الأعمدة بس فشل حفظ البروفايل الدائم: " + error.message, "error");
        }
        processSupplierRows(pendingSupplierRows, columnMapDraft);
        setPendingSupplierRows(null);
    };

    // اختيار صنف موجود يدويًا لصف "محتاج مراجعة"
    const resolveReviewItem = (idx, product) => {
        const item = supplierImportResult.needsReview[idx];
        if (!item) return;
        addItemWithQtyAndCost(product, item.qty, item.price);
        if (item.code && item.saveCode) registerSupplierCode(item.code, product.id);
        setSupplierImportResult((prev) => ({
            matchedCount: prev.matchedCount + 1,
            needsReview: prev.needsReview.filter((_, i2) => i2 !== idx),
        }));
        showToast(`اترابط الصنف "${product.name_ar || product.name}" وأتضاف للفاتورة ✓`);
    };

    const toggleReviewSaveCode = (idx) => {
        setSupplierImportResult((prev) => ({
            ...prev,
            needsReview: prev.needsReview.map((it, i2) => (i2 === idx ? { ...it, saveCode: !it.saveCode } : it)),
        }));
    };

    // فتح شاشة "إضافة صنف جديد" مع تعبئة الاسم من صف الملف، وربط الصنف الناتج بهذا الصف بعد الحفظ
    const openAddProductFromReview = (idx) => {
        const item = supplierImportResult.needsReview[idx];
        if (!item) return;
        setReviewNewProductIdx(idx);
        setProductFormPrefillName(item.name);
        setProductFormEditId(null);
        setShowProductForm(true);
    };

    // ==================== استيراد ملف Excel من موقع رصد (GTIN / SN / BN / XD) ====================
    // بيقرأ ملف الشحنة اللي بينزل من رصد، ويجمع الصفوف لكل (GTIN + BN + XD)، ويدوّر على الصنف
    // المطابق في قاعدة أصنافنا بمقارنة GTIN مع باركود الصنف (نفس منطق سكانر GS1)، ويحطهم في
    // فاتورة الشراء تلقائيًا بدل الإدخال اليدوي.
    const normalizeExcelGtin = (v) => {
        if (v == null || v === "") return "";
        if (typeof v === "number") return v.toFixed(0); // يتجنب صيغة الأس العلمي (Scientific Notation)
        return String(v).trim();
    };

    // بيشيل حروف الاتجاه المخفية (RTL/LTR mark, NBSP...) اللي بتتسرب لقيم الخلايا (مش بس العناوين)
    // لما البيانات تتنسخ من موقع رصد على الويب لملف إكسيل — لو سابناها، الـ regex بتاعة التاريخ
    // بتفشل وتاريخ الصلاحية يفضل فاضي في حقل input[type=date] من غير أي خطأ ظاهر
    const stripInvisibleChars = (s) => String(s || "").replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00A0]/g, "");

    // تاريخ الصلاحية في ملفات رصد بييجي إما نص (dd/mm/yyyy أو yyyy-mm-dd) أو رقم تاريخ إكسيل
    const normalizeExcelExpiry = (v) => {
        if (v == null || v === "") return "";
        if (typeof v === "number") {
            const d = XLSX.SSF.parse_date_code(v);
            if (!d) return "";
            return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        }
        const s = stripInvisibleChars(v).trim().split(/\s+/)[0]; // يشيل أي وقت زائد بعد التاريخ زي "00:00:00"
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
        return s;
    };

    // بيدوّر على اسم العمود الصح مهما اختلفت صياغته في ملف رصد — بيقارن بالتضمين (includes)
    // مش بالتطابق التام، عشان يلحق العناوين الحقيقية زي "رقم بند التجارة العالمي" و"الكمية المستلمة"
    // ✅ بيشيل حروف الاتجاه المخفية (RTL mark وغيرها) اللي بتتسرب لما العنوان يتنسخ من صفحة ويب
    // لإكسيل، وبيوحّد أشكال الهمزة (أ/إ/آ) عشان الفروق الشكلية دي متكسرش المطابقة
    const normalizeHeader = (s) =>
        String(s || "")
            .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
            .replace(/[أإآ]/g, "ا")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    const findRasdColumn = (row, candidates) => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
            const normCand = normalizeHeader(cand);
            const hit = keys.find((k) => normalizeHeader(k).includes(normCand));
            if (hit) return hit;
        }
        return null;
    };

    const handleRasdExcelFile = async (file) => {
        if (!file) return;
        setRasdImportBusy(true);
        setRasdImportResult(null);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });

            if (!rows.length) {
                showToast("الملف فارغ أو مفيش صفوف بيانات فيه", "error");
                setRasdImportBusy(false);
                return;
            }

            // ترتيب أولوية العناوين: الصياغة الحقيقية اللي بتنزل من رصد الأول، وبعدين بدائل عامة
            const colGtin = findRasdColumn(rows[0], ["رقم بند التجارة العالمي", "بند التجارة العالمي", "gtin", "barcode", "الباركود"]);
            const colBatch = findRasdColumn(rows[0], ["رقم الدفعة", "رقم التشغيلة", "batch", "bn"]);
            let colExpiry = findRasdColumn(rows[0], ["تاريخ الإنتهاء", "تاريخ الانتهاء", "تاريخ انتهاء الصلاحية", "تاريخ الصلاحية", "expiry", "xd"]);
            const colQty = findRasdColumn(rows[0], ["الكمية المستلمة", "الكمية", "quantity", "qty"]);

            // ✅ Fallback: لو اسم عمود الصلاحية مطابقش رغم توحيد الهمزة، جرب العمود اللي بعد
            // "رقم الدفعة" مباشرة (ترتيب أعمدة ملفات رصد ثابت عادة: GTIN → الكمية → رقم الدفعة → تاريخ الانتهاء)
            if (!colExpiry && colBatch) {
                const headerKeys = Object.keys(rows[0]);
                const batchIdx = headerKeys.indexOf(colBatch);
                if (batchIdx !== -1 && headerKeys[batchIdx + 1]) {
                    colExpiry = headerKeys[batchIdx + 1];
                }
            }

            if (!colGtin) {
                showToast("مقدرتش ألاقي عمود الـ GTIN في الملف — تأكد إن أول صف هو صف العناوين", "error");
                setRasdImportBusy(false);
                return;
            }

            // تجميع الصفوف حسب (GTIN + BN + XD) — لو الملف فيه سطر لكل وحدة سيريال، بيتحسبوا مع بعض كـ qty
            const grouped = new Map();
            for (const row of rows) {
                const gtinRaw = row[colGtin];
                if (gtinRaw === "" || gtinRaw == null) continue;
                const gtin = normalizeExcelGtin(gtinRaw);
                const batch = colBatch ? stripInvisibleChars(row[colBatch] ?? "").trim() : "";
                const expiry = colExpiry ? normalizeExcelExpiry(row[colExpiry]) : "";
                const qty = colQty ? (Number(row[colQty]) || 1) : 1;
                const key = gtin + "|" + batch + "|" + expiry;
                grouped.set(key, {
                    gtin,
                    batch,
                    expiry,
                    qty: (grouped.get(key)?.qty || 0) + qty,
                });
            }

            let matchedCount = 0;
            const unmatched = [];
            for (const entry of grouped.values()) {
                const found = products.find(
                    (x) => normGtin(x.barcode) === normGtin(entry.gtin) || normGtin(x.gtin) === normGtin(entry.gtin)
                );
                if (!found) {
                    unmatched.push(entry);
                    continue;
                }
                addItemWithQty(found, entry.expiry, entry.batch, entry.qty);
                matchedCount++;
            }

            setRasdImportResult({ matchedCount, unmatched });
            if (matchedCount > 0) {
                showToast(`تم استيراد ${matchedCount} صنف من ملف رصد ✓${unmatched.length ? ` (${unmatched.length} صنف مش موجود عندنا)` : ""}`);
            } else {
                showToast("مفيش أي صنف من الملف اتطابق مع أصنافنا بالـ GTIN", "error");
            }
        } catch (e) {
            showToast("تعذّرت قراءة الملف: " + (e?.message || e), "error");
        } finally {
            setRasdImportBusy(false);
            if (rasdExcelInputRef.current) rasdExcelInputRef.current.value = "";
        }
    };

    const _focusBarcode__ = () => {
        const el = document.querySelector('input[placeholder="امسح باركود الصنف..."]') as HTMLInputElement;
        if (el) el.focus();
    };

    // فوكس على خانة الكمية للصنف المضاف
    const focusNewItemQty = (p) => {
        setTimeout(() => {
            setItems((prev) => {
                const rowIndex = prev.findIndex((i) => i.id === p.id);
                if (rowIndex !== -1) {
                    const qtyCell = document.getElementById(`cell-${rowIndex}-qty`) as HTMLInputElement;
                    if (qtyCell) { qtyCell.focus(); qtyCell.select(); }
                    else searchRef.current?.focus();
                } else {
                    searchRef.current?.focus();
                }
                return prev;
            });
        }, 80);
    };

    const handleSearchKeyDown = (e) => {
        if (showDropdown && searchResults.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedPurchIdx((prev) => Math.min(prev + 1, searchResults.length - 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedPurchIdx((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                const target = highlightedPurchIdx >= 0 ? searchResults[highlightedPurchIdx] : searchResults[0];
                if (target) { addItem(target); setHighlightedPurchIdx(-1); }
                return;
            }
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (searchResults.length > 0) addItem(searchResults[0]);
            else if (searchText.trim()) {
                const p = products.find(
                    (x) =>
                        x.barcode === searchText ||
                        x.id === searchText ||
                        (x.name_ar || x.name || "").includes(searchText)
                );
                if (p) addItem(p);
                else showToast("الصنف غير موجود", "error");
            }
        }
        if (e.key === "Escape") { setShowDropdown(false); setHighlightedPurchIdx(-1); }
    };

    const calcCostAfterDiscount = (basePrice, disc1, disc2) => {
        const afterDisc1 = basePrice * (1 - (disc1 || 0) / 100);
        const afterDisc2 = afterDisc1 * (1 - (disc2 || 0) / 100);
        return Math.round(afterDisc2 * 10000) / 10000;
    };

    const updateItem = (id, field, value) => {
        setItems((prev) =>
            prev.map((i) => {
                if (i.id !== id) return i;
                const updated = { ...i, [field]: value };

                if (field === "discount1") {
                    updated.receivedCost = calcCostAfterDiscount(
                        i.newSalePrice,
                        value,
                        i.discount2
                    );
                } else if (field === "discount2") {
                    updated.receivedCost = calcCostAfterDiscount(
                        i.newSalePrice,
                        i.discount1,
                        value
                    );
                }
                else if (field === "newSalePrice") {
                    updated.receivedCost = calcCostAfterDiscount(
                        value,
                        i.discount1,
                        i.discount2
                    );
                }

                return updated;
            })
        );
    };

    const cols = [
        "qty",
        "discount1",
        "discount2",
        "receivedCost",
        "newSalePrice",
        "bonusQty",
        "expiry_date",
        "batch_number",
    ];

    const handleCellKeyDown = (e, rowIndex, colName) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const currentCol = cols.indexOf(colName);
        const nextCol = currentCol + 1;
        // آخر خانة (batch_number) → بار الباركود
        if (nextCol >= cols.length) {
            // البحث عن input بار الباركود
            const barcodeInput = document.querySelector('input[placeholder="امسح باركود الصنف..."]') as HTMLInputElement;
            if (barcodeInput) barcodeInput.focus();
            else searchRef.current?.focus();
            return;
        }
        document.getElementById(`cell-${rowIndex}-${cols[nextCol]}`)?.focus();
    };

    const cellStyle = {
        width: "100%",
        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        padding: "4px 8px",
        color: COLORS.textPrimary,
        fontSize: 13,
        outline: "none",
    };

    const calcSubtotal = items.reduce((s, i) => s + i.receivedCost * i.qty, 0);
    const calcTax = items.reduce(
        (s, i) => (i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s),
        0
    );
    const subtotal = manualSubtotal !== "" ? +manualSubtotal : calcSubtotal;
    const taxAmt = manualTax !== "" ? +manualTax : calcTax;
    const total = subtotal + taxAmt;

    const savePurchase = async () => {
        if (!canAdd) {
            showToast("ليس لديك صلاحية إضافة فاتورة شراء", "error");
            return;
        }
        if (!selSupplier || items.length === 0) {
            showToast("يرجى اختيار المورد وإضافة أصناف", "error");
            return;
        }
        const sup = suppliers.find((s) => s.id === selSupplier);
        // 🆕 batch.id واحد بيتولّد هنا لكل سطر في الفاتورة (بالـ index، مش بالـ id، عشان لو نفس
        // الصنف اتكرر بسطرين مختلفين في نفس الفاتورة — كل سطر يبقى ليه batch مستقل صح) — ونفس
        // الـ id ده هيتحفظ في بند الفاتورة نفسه (po.items[].batch_id) وفي الـ batch الفعلي جوه
        // products.batches معًا، بدل ما يتولدوا منفصلين زي ما كان قبل كده (نفس مبدأ إصلاح مسار
        // "رصيد صفر" في نقطة البيع). ده اللي بيخلي فحص "قد إيه اتباع من الشغلة دي" في شاشة
        // التعديل يشتغل صح على أي فاتورة عادية، مش بس على مسودات نقطة البيع.
        const batchIds = items.map(() => crypto.randomUUID());
        const po = {
            id: "PO-" + crypto.randomUUID(),
            date: todayLocal(),
            supplier: selSupplier,
            supplierName: sup.name,
            items: items.map((i, idx) => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                bonusQty: i.bonusQty || 0,
                cost: i.receivedCost,
                discount1: i.discount1,
                discount2: i.discount2,
                salePrice: i.newSalePrice,
                taxable: i.taxable,
                expiry_date: i.expiry_date || null,
                batch_number: i.batch_number || null,
                batch_id: batchIds[idx], // 🆕 نفس id الـ batch الفعلي، مش placeholder
            })),
            subtotal,
            taxAmount: taxAmt,
            total,
            status: "مستلمة",
        };

        setPurchases((p) => [...p, po]);
        const purchaseInvoice = {
            id: po.id,
            date: po.date,
            supplier: po.supplier,
            supplier_name: po.supplierName,
            items: po.items,
            subtotal: po.subtotal,
            tax_amount: po.taxAmount,
            total: po.total,
            status: po.status,
            pharmacy_id: pharmacyId,
        };

        const invoiceResult = await queueEvent({
            id: crypto.randomUUID(),
            type: "PURCHASE_INSERT",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { invoice: purchaseInvoice },
        });

        if (!invoiceResult.synced && invoiceResult.error) {
            // فشل حتى محاولة الحفظ الأولى (خطأ حقيقي، مش بس أوفلاين) — نتراجع
            showToast("فشل الحفظ: " + invoiceResult.error, "error");
            setPurchases((p) => p.filter((x) => x.id !== po.id));
            return;
        }

        // 🆕 كاش محلي في SQLite (purchase_invoices_cache) — نفس فلسفة insertSaleCache في completeSale،
        // عشان سجل فواتير الشراء يفضل مقروء أوفلاين حتى لو التطبيق اتقفل قبل ما الحدث يتزامن.
        const cacheResult = await retryLocalWrite(() => {
            if (!window.offlineAPI?.insertPurchaseInvoiceCache) return { success: false, error: "offlineAPI_unavailable" };
            return window.offlineAPI.insertPurchaseInvoiceCache({
                id: po.id,
                pharmacy_id: pharmacyId,
                supplier_id: po.supplier,
                supplier_name: po.supplierName,
                invoice_number: null,
                invoice_date: po.date,
                created_at: new Date().toISOString(),
                items: po.items,
                subtotal: po.subtotal,
                tax_amount: po.taxAmount,
                total: po.total,
                paid_amount: 0,
                payment_status: "unpaid",
                notes: null,
                created_by: currentUser?.name || null,
                returned: false,
            });
        });
        if (!cacheResult?.success) {
            // الفاتورة موجودة في outbox وهتتزامن، بس فشل حفظها في الكاش المحلي — تنبيه بس، مش تراجع
            showToast("⚠️ الفاتورة اتحفظت للمزامنة لكن فشل حفظ نسخة محلية سريعة", "error");
        }

        logAudit({
            pharmacyId, userName: currentUser?.name, action: "create", entityType: "purchase",
            entityId: po.id, entityLabel: `فاتورة شراء — ${po.supplierName}`,
            newValue: { supplier: po.supplierName, total: po.total, itemsCount: po.items.length },
            description: `إضافة فاتورة شراء من "${po.supplierName}" بإجمالي ${po.total} ر.س`,
        });

        // بنجهز الـ batches الجديدة لكل صنف كـ أحداث منفصلة
        // ⚠️ رجّعت شكل الـ batch كـ object كامل زي الأصل — دالة apply_purchase_stock_batch بتقرا
        // qty/cost/salePrice/expiry_date/batch_number من جوه v_event->'batch' مباشرة، مش من حقول
        // مفرودة. الإضافة الوحيدة الصح هنا هي device_id (الدالة بتقراها: v_event->>'device_id').
        const newBatchesByProduct = {};
        const stockEvents = items.map((ci, idx) => {
            const product = products.find((x) => x.id === ci.id);
            // 🆕 لو نفس الصنف اتكرر بأكتر من سطر في نفس الفاتورة (batch مختلف/expiry مختلف)،
            // لازم نبني فوق آخر batches اتجمّعت من سطر سابق لنفس الصنف في نفس الحلقة دي —
            // مش نرجع دايمًا لـ product.batches الأصلية وإلا الـ batch بتاع السطر الأول
            // هيتمسح من الـ state المحلي (السيرفر كان سليم بس العرض المحلي كان بيغلط).
            const baseBatches = newBatchesByProduct[ci.id] || product?.batches || [];
            const newBatch = {
                id: batchIds[idx], // 🆕 نفس id اللي اتحفظ في po.items[idx].batch_id، مش عشوائي مستقل
                qty: ci.qty + (ci.bonusQty || 0),
                cost: ci.receivedCost,
                salePrice: ci.newSalePrice,
                expiry_date: ci.expiry_date || null,
                batch_number: ci.batch_number || null,
                date: todayLocal(),
            };
            newBatchesByProduct[ci.id] = [...baseBatches, newBatch];
            return {
                id: crypto.randomUUID(),
                pharmacy_id: pharmacyId,
                product_id: ci.id,
                batch: newBatch,
                reference_id: po.id,
                created_at: new Date().toISOString(),
                device_id: getDeviceId(),
            };
        });

        await queueEvent({
            id: crypto.randomUUID(),
            type: "PURCHASE_STOCK_ADD",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { events: stockEvents },
        });

        // بنبني القوائم المحدّثة مرة واحدة عشان نستخدمها في: (1) React state و(2) الحفظ في products_cache المحلي
        const updatedProducts = products.map((x) => {
            const ci = items.find((i) => i.id === x.id);
            if (!ci) return x;
            return {
                ...x,
                stock: x.stock + ci.qty + (ci.bonusQty || 0),
                cost: ci.receivedCost,
                price: ci.newSalePrice,
                batches: newBatchesByProduct[x.id] ?? x.batches,
                not_available_market: false,
                auto_order: true,
            };
        });
        setProducts(updatedProducts);

        // 🆕 حفظ الأصناف المتأثرة في products_cache المحلي فوراً — من غير كده الكمية الجديدة
        // بتفضل في الميموري بس، وتضيع من العرض المحلي لو التطبيق اتقفل قبل ما PURCHASE_STOCK_ADD يتزامن.
        // (نفس نمط الـ delta المستخدم في POS/المرتجعات بدل upsertProduct القديمة اللي كانت
        // بتبعت الصنف كامل بـ schema قديمة مش متوافقة مع products_cache الجديد)
        try {
            await window.offlineAPI?.applyProductStockDeltaCache?.({
                pharmacyId,
                deltas: items.map((ci) => ({ id: ci.id, delta: ci.qty + (ci.bonusQty || 0) })),
            });
        } catch (err) {
            console.error("applyProductStockDeltaCache failed:", err);
            showToast("⚠️ تم حفظ الفاتورة لكن فشل تحديث الكاش المحلي للمخزون", "error");
        }
        // ✅ نحتفظ بنسخة من الأصناف للطباعة قبل التصفير
        const itemsForPrint = items.map((i) => ({ ...i }));

        setItems([]);
        setSelSupplier("");
        setManualSubtotal("");
        setManualTax("");
        setShowNew(false);
        clearPurchaseDraft();
        showToast("تم حفظ فاتورة الشراء ✓");

        // ✅ فتح نافذة طباعة الباركود بعد نجاح الحفظ
        printLabels(itemsForPrint);
        // ==================== رصد ====================
        const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
        const gs1Items = itemsForPrint.filter((i) => i.serial);
        if (rasdConfig.enabled && gs1Items.length > 0) {
            RasdQueue.enqueue("accept", {
                items: gs1Items.map((i) => ({
                    gtin: i.gtin || i.barcode,
                    serial: i.serial,
                    batch: i.batch,
                    expiry: i.expiry,
                })),
            });
        }
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18,
                }}
            >
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                    فواتير الشراء
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                    {canAdd && !showNew && items.length > 0 && (
                        <Btn
                            icon="edit"
                            variant="secondary"
                            onClick={() => setShowNew(true)}
                        >
                            استكمال فاتورة الشراء ({items.length} صنف)
                        </Btn>
                    )}
                    {canAdd && (
                        <Btn
                            icon="plus"
                            onClick={() => {
                                if (items.length > 0) {
                                    if (!window.confirm("في فاتورة شراء غير مكتملة، هل تريد إلغاؤها والبدء من جديد؟")) return;
                                    setItems([]);
                                    setManualSubtotal("");
                                    setManualTax("");
                                    clearPurchaseDraft();
                                }
                                setShowNew(true);
                            }}
                        >
                            فاتورة شراء جديدة
                        </Btn>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: 14 }}>
                <input
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="🔍 بحث برقم الفاتورة أو اسم المورد..."
                    style={{
                        width: 320, maxWidth: "100%", padding: "9px 14px", borderRadius: 8,
                        border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt,
                        color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box",
                    }}
                />
            </div>

            {(() => {
                const filteredPurchasesList = purchases.filter((p) => {
                    if (!invoiceSearch.trim()) return true;
                    const q = invoiceSearch.trim().toLowerCase();
                    const inId = (p.id || "").toLowerCase().includes(q);
                    const inSupplier = (p.supplierName || p.supplier_name || "").toLowerCase().includes(q);
                    return inId || inSupplier;
                });
                return (
                    <>
                        <Table
                            headers={[
                                "رقم الفاتورة",
                                "التاريخ",
                                "المورد",
                                "قبل الضريبة",
                                "الضريبة",
                                "الإجمالي",
                                "الحالة",
                            ]}
                            rows={filteredPurchasesList.slice((purchasePage - 1) * PURCHASE_PAGE_SIZE, purchasePage * PURCHASE_PAGE_SIZE).map((p) => [
                                <span
                                    style={{ color: COLORS.blue, fontWeight: canEdit ? 700 : 400, cursor: canEdit ? "pointer" : "default" }}
                                    onClick={() => {
                                        if (!canEdit) return;
                                        setShowDetail(p);
                                        setEditItems(
                                            p.items.map((i) => ({
                                                ...i,
                                                receivedCost: i.cost,
                                                newSalePrice: i.salePrice,
                                                discount1: i.discount1 || 0,
                                                discount2: i.discount2 || 0,
                                                bonusQty: i.bonusQty || 0,
                                                expiry_date: i.expiry_date || "",
                                            }))
                                        );
                                        setEditSupplier(p.supplier);
                                        setEditManualSubtotal("");
                                        setEditManualTax("");
                                    }}
                                >
                                    {p.id}
                                </span>,
                                p.date,
                                p.supplierName || p.supplier_name,
                                (p.subtotal || 0).toFixed(2) + " ر.س",
                                (p.taxAmount ?? p.tax_amount ?? 0).toFixed(2) + " ر.س",
                                <span style={{ color: COLORS.green, fontWeight: 700 }}>
                                    {(p.total || 0).toFixed(2)} ر.س
                                </span>,
                                <Badge color={COLORS.greenSoft} text={COLORS.green}>
                                    {p.status}
                                </Badge>,
                            ])}
                        />
                        <Pagination page={purchasePage} onPageChange={setPurchasePage} totalItems={filteredPurchasesList.length} pageSize={PURCHASE_PAGE_SIZE} />
                    </>
                );
            })()}

            <Modal
                open={showNew}
                onClose={() => {
                    // ⚠️ لا نمسح items/manualSubtotal/manualTax هنا حتى لا تضيع المسودة
                    // عند إغلاق النافذة بالخطأ أو التنقل لصفحة تانية والرجوع.
                    // المسودة بتتمسح فقط بعد الحفظ الناجح (clearPurchaseDraft) أو
                    // عند الضغط الصريح على "فاتورة شراء جديدة" بعد التأكيد.
                    setShowNew(false);
                }}
                title="فاتورة شراء جديدة"
                wide
                closeOnBackdrop={false}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <Select
                        label="المورد"
                        value={selSupplier}
                        onChange={setSelSupplier}
                        options={[
                            { v: "", l: "اختر المورد" },
                            ...suppliers.map((s) => ({
                                v: s.id,
                                l: `${s.name} — ${s.taxId}`,
                            })),
                        ]}
                    />
                </div>

                {/* باركود سكانر منفصل */}
                <div style={{ marginBottom: 8 }}>
                    <BarcodeScanner
                        onScan={(scan) => {
                            const code = scan.type === "gs1" ? scan.gtin : scan.code;
                            const expiry = scan.type === "gs1" || scan.type === "custom" ? (scan.expiry || "") : "";
                            const batch = scan.type === "gs1" || scan.type === "custom" ? (scan.batch || "") : "";
                            const found = products.find((x) =>
                                scan.type === "gs1"
                                    ? normGtin(x.barcode) === normGtin(code) || normGtin(x.gtin) === normGtin(code)
                                    : x.barcode === code || x.id === code
                            );
                            if (!found) { showToast("الصنف غير موجود: " + code, "error"); return; }
                            // إذا كان نفس الصنف موجود بتاريخ مختلف → أضف كصف جديد
                            const existSameDate = items.find((i) => i.id === found.id && (i.expiry_date || "") === expiry);
                            if (existSameDate || !expiry) {
                                addItem(found, expiry, batch);
                            } else {
                                // نفس الصنف بتاريخ مختلف → صف جديد مستقل
                                addItemAsNew(found, expiry, batch);
                            }
                        }}
                        placeholder="امسح باركود الصنف..."
                    />
                </div>

                {/* استيراد ملف Excel من موقع رصد — يطابق الأصناف بالـ GTIN ويحطها في الفاتورة تلقائيًا */}
                <div style={{ marginBottom: 14 }}>
                    <input
                        ref={rasdExcelInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        onChange={(e) => handleRasdExcelFile(e.target.files?.[0])}
                    />
                    <Btn
                        icon="upload"
                        variant="secondary"
                        onClick={() => rasdExcelInputRef.current?.click()}
                        disabled={rasdImportBusy}
                    >
                        {rasdImportBusy ? "جارٍ الاستيراد..." : "📥 استيراد ملف رصد (Excel)"}
                    </Btn>
                    {rasdImportResult && rasdImportResult.unmatched.length > 0 && (
                        <div
                            style={{
                                marginTop: 8,
                                background: COLORS.goldSoft,
                                border: `1px solid ${COLORS.gold}`,
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontSize: 12,
                                color: COLORS.textPrimary,
                            }}
                        >
                            ⚠️ {rasdImportResult.unmatched.length} صنف من الملف مالوش GTIN مطابق عندنا (لازم تتضاف الأصناف دي الأول أو تتربط باركوداتها):
                            <div style={{ marginTop: 6, maxHeight: 180, overflowY: "auto" }}>
                                {rasdImportResult.unmatched.map((u, idx) => (
                                    <div key={idx} style={{ padding: "4px 0", borderBottom: `1px dashed ${COLORS.gold}` }}>
                                        <div style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.textDim }}>
                                            GTIN: {u.gtin} {u.batch ? `— تشغيلة: ${u.batch}` : ""} {u.expiry ? `— صلاحية: ${u.expiry}` : ""} {u.qty > 1 ? `— كمية: ${u.qty}` : ""}
                                        </div>
                                        <select
                                            defaultValue=""
                                            onChange={(e) => {
                                                const pid = e.target.value;
                                                if (!pid) return;
                                                const p = products.find((x) => String(x.id) === pid);
                                                if (!p) return;
                                                addItemWithQty(p, u.expiry, u.batch, u.qty);
                                                setRasdImportResult((prev) => ({
                                                    matchedCount: prev.matchedCount + 1,
                                                    unmatched: prev.unmatched.filter((_, i2) => i2 !== idx),
                                                }));
                                                showToast(`اترابط الصنف "${p.name}" وأتضاف للفاتورة ✓ — لو ده بيتكرر، راجع الباركود المسجل في كارت الصنف`);
                                            }}
                                            style={{
                                                marginTop: 4,
                                                fontSize: 11,
                                                maxWidth: 280,
                                                padding: "3px 6px",
                                                borderRadius: 6,
                                                border: `1px solid ${COLORS.gold}`,
                                                background: "#fff",
                                                color: COLORS.textPrimary,
                                            }}
                                        >
                                            <option value="">-- اربطه يدويًا بصنف موجود --</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} {p.barcode ? `(${p.barcode})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 🆕 استيراد فاتورة مورد عام (كوزمتيك وغيرها) — أي شكل ملف إكسيل، بيتعلم أعمدة كل مورد مرة واحدة */}
                <div style={{ marginBottom: 14 }}>
                    <input
                        ref={supplierExcelInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        style={{ display: "none" }}
                        onChange={(e) => handleSupplierExcelFile(e.target.files?.[0])}
                    />
                    <Btn
                        icon="upload"
                        variant="secondary"
                        onClick={() => supplierExcelInputRef.current?.click()}
                        disabled={supplierImportBusy || !selSupplier}
                    >
                        {supplierImportBusy ? "جارٍ الاستيراد..." : "📥 استيراد فاتورة مورد (Excel)"}
                    </Btn>
                    {!selSupplier && (
                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>اختر المورد الأول عشان نقدر نتعرف على ترتيب أعمدة ملفه ونحفظه له</div>
                    )}

                    {supplierImportResult && supplierImportResult.needsReview.length > 0 && (
                        <div
                            style={{
                                marginTop: 8,
                                background: COLORS.goldSoft,
                                border: `1px solid ${COLORS.gold}`,
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontSize: 12,
                                color: COLORS.textPrimary,
                            }}
                        >
                            ⚠️ {supplierImportResult.needsReview.length} صنف محتاج مراجعة يدوية (مطابقة الاسم مش أكيدة كفاية أو مالهاش نتيجة):
                            <div style={{ marginTop: 6, maxHeight: 280, overflowY: "auto" }}>
                                {supplierImportResult.needsReview.map((item, idx) => (
                                    <div key={item.key + idx} style={{ padding: "8px 0", borderBottom: `1px dashed ${COLORS.gold}` }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.textDim }}>
                                            {item.code && `كود المورد: ${item.code} `}
                                            {item.barcode && `— باركود: ${item.barcode} `}
                                            — كمية: {item.qty}
                                            {item.price > 0 && ` — سعر: ${item.price}`}
                                        </div>

                                        {/* أقرب اقتراحات بالاسم */}
                                        {item.suggestions.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                                {item.suggestions.map((s, si) => (
                                                    <button
                                                        key={si}
                                                        onClick={() => resolveReviewItem(idx, s.product)}
                                                        style={{
                                                            fontSize: 11, padding: "4px 10px", borderRadius: 20,
                                                            border: `1px solid ${COLORS.green}`, background: COLORS.greenSoft,
                                                            color: COLORS.green, cursor: "pointer",
                                                        }}
                                                    >
                                                        ✅ {s.product.name_ar || s.product.name} ({Math.round(s.score * 100)}%)
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                                            <select
                                                defaultValue=""
                                                onChange={(e) => {
                                                    const pid = e.target.value;
                                                    if (!pid) return;
                                                    const p = products.find((x) => String(x.id) === pid);
                                                    if (p) resolveReviewItem(idx, p);
                                                }}
                                                style={{
                                                    fontSize: 11, maxWidth: 240, padding: "3px 6px", borderRadius: 6,
                                                    border: `1px solid ${COLORS.gold}`, background: "#fff", color: COLORS.textPrimary,
                                                }}
                                            >
                                                <option value="">-- اربطه يدويًا بصنف موجود --</option>
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name_ar || p.name} {p.barcode ? `(${p.barcode})` : ""}</option>
                                                ))}
                                            </select>

                                            <Btn size="sm" variant="secondary" icon="plus" onClick={() => openAddProductFromReview(idx)}>
                                                إضافة كصنف جديد
                                            </Btn>

                                            {item.code && (
                                                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textDim, cursor: "pointer" }}>
                                                    <input type="checkbox" checked={item.saveCode} onChange={() => toggleReviewSaveCode(idx)} />
                                                    احفظ الكود "{item.code}" دائمًا لهذا المورد
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 🆕 شاشة تأكيد/تعديل تربيطة أعمدة ملف المورد — تظهر أول فاتورة من كل مورد، وبعدها بتتحفظ وتتطبق تلقائيًا */}
                <Modal open={showColumnMapModal} onClose={() => setShowColumnMapModal(false)} title="تأكيد أعمدة ملف المورد">
                    {pendingSupplierRows && (
                        <div>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12 }}>
                                حاولنا نتعرف على أعمدة الملف تلقائيًا — راجع كل خانة وصحّح لو محتاجة. هنحفظ التربيطة دي لهذا المورد فيتطبقوا تلقائيًا في فواتيره الجاية.
                            </div>
                            {[
                                { key: "name", label: "عمود اسم الصنف", required: true },
                                { key: "qty", label: "عمود الكمية", required: true },
                                { key: "code", label: "عمود كود الصنف عند المورد", required: false },
                                { key: "barcode", label: "عمود الباركود/GTIN", required: false },
                                { key: "price", label: "عمود سعر الوحدة", required: false },
                            ].map((f) => (
                                <div key={f.key} style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>
                                        {f.label} {f.required && <span style={{ color: COLORS.red }}>*</span>}
                                    </label>
                                    <select
                                        value={columnMapDraft[f.key] || ""}
                                        onChange={(e) => setColumnMapDraft((p) => ({ ...p, [f.key]: e.target.value || null }))}
                                        style={{
                                            width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                                            borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13,
                                        }}
                                    >
                                        <option value="">-- لا يوجد --</option>
                                        {Object.keys(pendingSupplierRows[0] || {}).map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                                <Btn variant="secondary" onClick={() => setShowColumnMapModal(false)}>إلغاء</Btn>
                                <Btn icon="check" onClick={confirmColumnMapping}>تأكيد وحفظ لهذا المورد</Btn>
                            </div>
                        </div>
                    )}
                </Modal>

                <div style={{ position: "relative", marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <input
                            ref={searchRef}
                            placeholder="🔍 ابحث بالاسم..."
                            value={searchText}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                            style={{
                                width: "100%",
                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                borderRadius: 8,
                                padding: "10px 14px",
                                color: COLORS.textPrimary,
                                fontSize: 14,
                                outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                        {showDropdown && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    right: 0,
                                    left: 0,
                                    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                                    border: `1px solid ${COLORS.borderStrong}`,
                                    borderRadius: 8,
                                    zIndex: 100,
                                    maxHeight: 240,
                                    overflowY: "auto",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                                }}
                            >
                                {searchResults.map((p, idx) => {
                                    const outOfStock = (p.stock ?? 0) <= 0;
                                    const lowStock = !outOfStock && (p.stock ?? 0) <= (p.min_stock || p.minStock || 0);
                                    const stockColor = outOfStock ? COLORS.red : lowStock ? COLORS.gold : COLORS.green;
                                    const isHighlighted = idx === highlightedPurchIdx;
                                    return (
                                        <div
                                            key={p.id}
                                            onMouseDown={() => { addItem(p); setHighlightedPurchIdx(-1); }}
                                            onMouseEnter={() => setHighlightedPurchIdx(idx)}
                                            onMouseLeave={() => setHighlightedPurchIdx(-1)}
                                            style={{
                                                padding: "9px 14px",
                                                cursor: "pointer",
                                                background: isHighlighted ? COLORS.surfaceAlt : "transparent",
                                                borderBottom: `1px solid ${COLORS.border}`,
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stockColor, flexShrink: 0, display: "inline-block" }} />
                                                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a" }}>{p.name_ar || p.name}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ color: "#2a4a3a", fontSize: 12 }}>
                                                    {p.barcode} | مخزون: {p.stock ?? 0}
                                                </span>
                                                {/* 🆕 تعديل الصنف مباشرة من نتيجة البحث بدون قفل الفاتورة */}
                                                <span
                                                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setProductFormEditId(p.id); setShowProductForm(true); }}
                                                    title="تعديل الصنف"
                                                    style={{ fontSize: 12, cursor: "pointer", padding: "2px 6px", borderRadius: 4, background: "rgba(0,0,0,0.06)" }}
                                                >✏️</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* 🆕 إضافة صنف جديد فوق فاتورة الشراء بدون قفلها */}
                    <Btn icon="plus" variant="secondary" onClick={() => { setProductFormEditId(null); setShowProductForm(true); }}>
                        صنف جديد
                    </Btn>
                </div>

                <div style={{ marginTop: 4, overflowX: "auto" }}>
                    <table
                        style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
                    >
                        <thead>
                            <tr style={{ background: COLORS.surfaceAlt }}>
                                {[
                                    "الصنف",
                                    "الكمية",
                                    "خ.أساسي%",
                                    "خ.إضافي%",
                                    "تكلفة الوحدة",
                                    "سعر البيع",
                                    "بونص",
                                    "الصلاحية",
                                    "رقم التشغيلة",
                                    "ضريبة",
                                    "الإجمالي",
                                    "",
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: "9px 8px",
                                            textAlign: "right",
                                            color: COLORS.textDim,
                                            fontSize: 12,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, rowIndex) => (
                                <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                    <td
                                        style={{
                                            padding: "6px 8px",
                                            fontSize: 13,
                                            color: COLORS.textPrimary,
                                            minWidth: 120,
                                        }}
                                    >
                                        <div
                                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                                        >
                                            {item.name_ar || item.name}
                                            <button
                                                onClick={() => setShowProductCard(item)}
                                                title="عرض بيانات الصنف"
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: COLORS.blue,
                                                    cursor: "pointer",
                                                    padding: 2,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                <IC n="eye" s={13} />
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-qty`}
                                            type="number"
                                            min="1"
                                            value={item.qty}
                                            onChange={(e) =>
                                                updateItem(item.id, "qty", +e.target.value)
                                            }
                                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "qty")}
                                            style={{ ...cellStyle, width: 55 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-discount1`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={item.discount1}
                                            onChange={(e) =>
                                                updateItem(item.id, "discount1", +e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                handleCellKeyDown(e, rowIndex, "discount1")
                                            }
                                            style={{ ...cellStyle, width: 60 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-discount2`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={item.discount2}
                                            onChange={(e) =>
                                                updateItem(item.id, "discount2", +e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                handleCellKeyDown(e, rowIndex, "discount2")
                                            }
                                            style={{ ...cellStyle, width: 60 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-receivedCost`}
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={+(item.receivedCost ?? 0).toFixed(4)}
                                            onChange={(e) =>
                                                updateItem(item.id, "receivedCost", +e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                handleCellKeyDown(e, rowIndex, "receivedCost")
                                            }
                                            style={{ ...cellStyle, width: 85 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-newSalePrice`}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.newSalePrice}
                                            onChange={(e) =>
                                                updateItem(item.id, "newSalePrice", +e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                handleCellKeyDown(e, rowIndex, "newSalePrice")
                                            }
                                            style={{
                                                ...cellStyle,
                                                width: 85,
                                                borderColor:
                                                    item.newSalePrice !== item.price
                                                        ? "#f0a030"
                                                        : COLORS.border,
                                                color:
                                                    item.newSalePrice !== item.price
                                                        ? "#f0c060"
                                                        : COLORS.textPrimary,
                                            }}
                                        />
                                        {/* 🆕 سعر البيع فوق ده مسجّل قبل الضريبة زي ما هو مخزّن — نعرض هنا في نفس الصف
                        السعر شامل الضريبة (اللي العميل بيدفعه فعليًا)، بدل ما يبان بس تحت في إجمالي الفاتورة */}
                                        {item.taxable && (
                                            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2, whiteSpace: "nowrap" }}>
                                                شامل الضريبة: {taxInclusiveLabelPrice(item)}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-bonusQty`}
                                            type="number"
                                            min="0"
                                            value={item.bonusQty}
                                            onChange={(e) =>
                                                updateItem(item.id, "bonusQty", +e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                                handleCellKeyDown(e, rowIndex, "bonusQty")
                                            }
                                            style={{ ...cellStyle, width: 55 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-expiry_date`}
                                            type="date"
                                            value={/^\d{4}-\d{2}$/.test(item.expiry_date || "") ? `${item.expiry_date}-01` : (item.expiry_date || "")}
                                            onChange={(e) =>
                                                updateItem(item.id, "expiry_date", e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                // السهام → يتركها للـ browser عشان تنقل بين شهر/سنة
                                                if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                                                handleCellKeyDown(e, rowIndex, "expiry_date");
                                            }}
                                            style={{ ...cellStyle, width: 125 }}
                                        />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                        <input
                                            id={`cell-${rowIndex}-batch_number`}
                                            type="text"
                                            value={item.batch_number || ""}
                                            placeholder="تلقائي من السكان"
                                            onChange={(e) =>
                                                updateItem(item.id, "batch_number", e.target.value)
                                            }
                                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "batch_number")}
                                            style={{ ...cellStyle, width: 110 }}
                                        />
                                    </td>
                                    <td style={{ padding: "6px 8px" }}>
                                        <Badge
                                            color={item.taxable ? COLORS.greenSoft : COLORS.surfaceAlt}
                                            text={item.taxable ? COLORS.green : COLORS.textDim}
                                        >
                                            {item.taxable ? "15%" : "معفى"}
                                        </Badge>
                                    </td>
                                    <td
                                        style={{
                                            padding: "6px 8px",
                                            color: COLORS.blue,
                                            fontWeight: 700,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {(
                                            item.receivedCost *
                                            item.qty *
                                            (item.taxable ? 1 + TAX_RATE : 1)
                                        ).toFixed(2)}
                                    </td>
                                    <td style={{ padding: "6px 8px" }}>
                                        <button
                                            onClick={() =>
                                                setItems((p) => p.filter((i) => i.id !== item.id))
                                            }
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: COLORS.red,
                                                cursor: "pointer",
                                            }}
                                        >
                                            <IC n="trash" s={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {items.length > 0 && (
                    <div
                        style={{
                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            borderRadius: 10,
                            padding: 14,
                            marginTop: 14,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                color: COLORS.textDim,
                                marginBottom: 8,
                            }}
                        >
                            <span>المجموع قبل الضريبة</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: COLORS.textDim, fontSize: 11 }}>
                                    (محسوب: {calcSubtotal.toFixed(2)})
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder={calcSubtotal.toFixed(2)}
                                    value={manualSubtotal}
                                    onChange={(e) => setManualSubtotal(e.target.value)}
                                    style={{
                                        width: 110,
                                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                        border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                        borderRadius: 6,
                                        padding: "4px 8px",
                                        color: COLORS.textPrimary,
                                        fontSize: 13,
                                        outline: "none",
                                        textAlign: "left",
                                    }}
                                />
                                <span style={{ color: COLORS.textDim }}>ر.س</span>
                            </div>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                color: COLORS.green,
                                marginBottom: 8,
                            }}
                        >
                            <span>ضريبة القيمة المضافة 15%</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: COLORS.textDim, fontSize: 11 }}>
                                    (محسوب: {calcTax.toFixed(2)})
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder={calcTax.toFixed(2)}
                                    value={manualTax}
                                    onChange={(e) => setManualTax(e.target.value)}
                                    style={{
                                        width: 110,
                                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                        border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                        borderRadius: 6,
                                        padding: "4px 8px",
                                        color: COLORS.textPrimary,
                                        fontSize: 13,
                                        outline: "none",
                                        textAlign: "left",
                                    }}
                                />
                                <span style={{ color: COLORS.green }}>ر.س</span>
                            </div>
                        </div>
                        {(manualSubtotal !== "" || manualTax !== "") && (
                            <button
                                onClick={() => {
                                    setManualSubtotal("");
                                    setManualTax("");
                                }}
                                style={{
                                    fontSize: 11,
                                    color: COLORS.textDim,
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    marginBottom: 8,
                                }}
                            >
                                ↺ إعادة الحساب التلقائي
                            </button>
                        )}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                color: COLORS.textPrimary,
                                fontWeight: 800,
                                fontSize: 16,
                                borderTop: `1px solid ${COLORS.border}`,
                                paddingTop: 8,
                            }}
                        >
                            <span>الإجمالي</span>
                            <span>{total.toFixed(2)} ر.س</span>
                        </div>
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 16,
                        justifyContent: "flex-end",
                    }}
                >
                    <Btn
                        variant="ghost"
                        onClick={() => {
                            setShowNew(false);
                            setItems([]);
                            setManualSubtotal("");
                            setManualTax("");
                        }}
                    >
                        إلغاء
                    </Btn>
                    <Btn icon="check" onClick={savePurchase}>
                        حفظ الفاتورة
                    </Btn>
                </div>
            </Modal>

            {/* 🆕 نافذة إضافة/تعديل صنف — تظهر فوق فاتورة الشراء وتفضل الفاتورة مفتوحة خلفها */}
            <ProductFormModal
                open={showProductForm}
                onClose={() => { setShowProductForm(false); setReviewNewProductIdx(null); setProductFormPrefillName(""); }}
                editingId={productFormEditId}
                products={products}
                setProducts={setProducts}
                showToast={showToast}
                pharmacyId={pharmacyId}
                currentUser={currentUser}
                prefillName={productFormPrefillName}
                jokerPendingItems={jokerPendingItems}
                setJokerPendingItems={setJokerPendingItems}
                onSaved={(saved) => {
                    // 🆕 لو الصنف ده أُضيف من مراجعة استيراد فاتورة مورد، اربطه بنفس الصف بدل الإضافة العادية
                    if (reviewNewProductIdx != null && saved?.id) {
                        resolveReviewItem(reviewNewProductIdx, saved);
                        setReviewNewProductIdx(null);
                        setProductFormPrefillName("");
                        return;
                    }
                    // لو صنف جديد (مش تعديل)، نضيفه تلقائياً لسطور الفاتورة الحالية
                    if (!productFormEditId && saved?.id) {
                        const full = { ...saved };
                        addItem(full);
                    }
                }}
            />

            {showProductCard && (
                <Modal
                    open
                    title={`بيانات الصنف: ${showProductCard.name}`}
                    onClose={() => setShowProductCard(null)}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                            ["الرمز", showProductCard.id],
                            ["الباركود", showProductCard.barcode],
                            ["الفئة", showProductCard.category],
                            ["المادة الفعالة", showProductCard.full_ingredients_text || showProductCard.active_ingredient || showProductCard.activeIngredient],
                            ["التركيز", showProductCard.concentration],
                            ["المخزون الحالي", showProductCard.stock],
                            ["سعر البيع الحالي", showProductCard.price + " ر.س"],
                            ["التكلفة الحالية", showProductCard.cost + " ر.س"],
                            ["الحد الأدنى", showProductCard.minStock],
                            ["خاضع للضريبة", showProductCard.taxable ? "نعم 15%" : "معفى"],
                        ].map(
                            ([label, val]) =>
                                val && (
                                    <div
                                        key={label}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            padding: "8px 0",
                                            borderBottom: `1px solid ${COLORS.border}`,
                                        }}
                                    >
                                        <span style={{ color: COLORS.textDim, fontSize: 13 }}>
                                            {label}
                                        </span>
                                        <span
                                            style={{
                                                color: COLORS.textPrimary,
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {val}
                                        </span>
                                    </div>
                                )
                        )}
                    </div>
                </Modal>
            )}

            {/* ✅ Modal طباعة ملصقات الباركود */}
            {showPrintModal && (
                <Modal
                    open
                    title="طباعة ملصقات الباركود"
                    onClose={() => setShowPrintModal(false)}
                >
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        marginBottom: 10, padding: "6px 10px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8,
                    }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={printItems.length > 0 && printItems.every((i) => i.selected !== false)}
                                onChange={(e) =>
                                    setPrintItems((prev) => prev.map((i) => ({ ...i, selected: e.target.checked })))
                                }
                                style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                            <span style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>تحديد الكل</span>
                        </label>
                        <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                            {printItems.filter((i) => i.selected !== false).length} / {printItems.length} محدد
                        </span>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <button
                            onClick={() => setPrintMethod("browser")}
                            style={{
                                flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                border: `2px solid ${printMethod === "browser" ? COLORS.blue : COLORS.border}`,
                                background: printMethod === "browser" ? COLORS.blueSoft : COLORS.surfaceAlt,
                                color: printMethod === "browser" ? COLORS.blue : COLORS.textDim,
                                fontSize: 12, fontWeight: 600,
                            }}
                        >
                            🖨️ طباعة عادية (متصفح)
                        </button>
                        <button
                            onClick={() => setPrintMethod("zpl")}
                            style={{
                                flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                border: `2px solid ${printMethod === "zpl" ? COLORS.blue : COLORS.border}`,
                                background: printMethod === "zpl" ? COLORS.blueSoft : COLORS.surfaceAlt,
                                color: printMethod === "zpl" ? COLORS.blue : COLORS.textDim,
                                fontSize: 12, fontWeight: 600,
                            }}
                        >
                            ⚡ ZPL مباشر (Zebra)
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                        {printItems.map((item, idx) => (
                            <div
                                key={item.id}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 10px",
                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                    borderRadius: 8,
                                    border: `1px solid ${COLORS.border}`,
                                    opacity: item.selected === false ? 0.5 : 1,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <input
                                        type="checkbox"
                                        checked={item.selected !== false}
                                        onChange={(e) =>
                                            setPrintItems((prev) =>
                                                prev.map((i, pi) =>
                                                    pi === idx ? { ...i, selected: e.target.checked } : i
                                                )
                                            )
                                        }
                                        style={{ width: 16, height: 16, cursor: "pointer" }}
                                    />
                                    <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>عدد النسخ</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.copies}
                                        onChange={(e) =>
                                            setPrintItems((prev) =>
                                                prev.map((i, pi) =>
                                                    pi === idx ? { ...i, copies: +e.target.value } : i
                                                )
                                            )
                                        }
                                        style={{
                                            width: 60,
                                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                            border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                            borderRadius: 6,
                                            padding: "4px 8px",
                                            color: COLORS.textPrimary,
                                            fontSize: 13,
                                            outline: "none",
                                            textAlign: "center",
                                        }}
                                    />
                                    <button
                                        onClick={() => setPrintItems((prev) => prev.filter((_, pi) => pi !== idx))}
                                        title="حذف الصنف من القائمة"
                                        style={{
                                            width: 26, height: 26, borderRadius: 6, border: `1px solid ${tint(COLORS.red, 0.35)}`,
                                            background: COLORS.redSoft, color: COLORS.red, fontSize: 14, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                        {printItems.length === 0 && (
                            <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20, fontSize: 13 }}>
                                لا توجد أصناف في القائمة
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            marginTop: 16,
                            justifyContent: "flex-end",
                        }}
                    >
                        <Btn variant="ghost" onClick={() => setShowPrintModal(false)}>
                            إلغاء
                        </Btn>
                        <Btn
                            icon="printer"
                            onClick={printMethod === "zpl" ? doPrintZPL : doPrint}
                            disabled={printItems.filter((i) => i.selected !== false).length === 0}
                        >
                            طباعة ({printItems.filter((i) => i.selected !== false).length})
                        </Btn>
                    </div>
                </Modal>
            )}

            {showDetail && (
                <Modal
                    open
                    title={`تفاصيل الفاتورة: ${showDetail.id}`}
                    onClose={() => setShowDetail(null)}
                    wide
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        <Select
                            label="المورد"
                            value={editSupplier}
                            onChange={setEditSupplier}
                            options={[
                                { v: "", l: "اختر المورد" },
                                ...suppliers.map((s) => ({
                                    v: s.id,
                                    l: `${s.name} — ${s.taxId}`,
                                })),
                            ]}
                        />
                        <div
                            style={{
                                color: COLORS.textDim,
                                fontSize: 12,
                                alignSelf: "flex-end",
                                paddingBottom: 8,
                            }}
                        >
                            التاريخ: {showDetail.date}
                        </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: 900,
                            }}
                        >
                            <thead>
                                <tr style={{ background: COLORS.surfaceAlt }}>
                                    {[
                                        "الصنف",
                                        "الكمية",
                                        "خ.أساسي%",
                                        "خ.إضافي%",
                                        "تكلفة الوحدة",
                                        "سعر البيع",
                                        "بونص",
                                        "الصلاحية",
                                        "الإجمالي",
                                        "",
                                    ].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: "9px 8px",
                                                textAlign: "right",
                                                color: COLORS.textDim,
                                                fontSize: 12,
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {editItems.map((item, rowIndex) => (
                                    <tr
                                        key={item.id}
                                        style={{ borderBottom: `1px solid ${COLORS.border}` }}
                                    >
                                        <td
                                            style={{
                                                padding: "6px 8px",
                                                fontSize: 13,
                                                color: COLORS.textPrimary,
                                                minWidth: 120,
                                            }}
                                        >
                                            {item.name}
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.qty}
                                                onChange={(e) => {
                                                    const newQty = +e.target.value;
                                                    // 🆕 منع تقليل الكمية تحت اللي اتباع بالفعل من نفس الشغلة —
                                                    // نفس منطق منع الحذف بالظبط، بس هنا جزئي مش كامل.
                                                    const soldQty = getSoldQtyForPurchaseItem(item);
                                                    if (soldQty > 0 && newQty < soldQty) {
                                                        showToast(
                                                            `مينفعش الكمية تقل عن ${soldQty} — ده اللي اتباع بالفعل من "${item.name}" من نفس الشغلة`,
                                                            "error"
                                                        );
                                                        return;
                                                    }
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? { ...i, qty: newQty }
                                                                : i
                                                        )
                                                    );
                                                }}
                                                style={{
                                                    width: 55,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.discount1}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? {
                                                                    ...i,
                                                                    discount1: +e.target.value,
                                                                    receivedCost: calcCostAfterDiscount(
                                                                        i.newSalePrice,
                                                                        +e.target.value,
                                                                        i.discount2
                                                                    ),
                                                                }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 60,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={item.discount2}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? {
                                                                    ...i,
                                                                    discount2: +e.target.value,
                                                                    receivedCost: calcCostAfterDiscount(
                                                                        i.newSalePrice,
                                                                        i.discount1,
                                                                        +e.target.value
                                                                    ),
                                                                }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 60,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.0001"
                                                value={+(item.receivedCost ?? 0).toFixed(4)}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? { ...i, receivedCost: +e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 85,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.newSalePrice}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? {
                                                                    ...i,
                                                                    newSalePrice: +e.target.value,
                                                                    receivedCost: calcCostAfterDiscount(
                                                                        +e.target.value,
                                                                        i.discount1,
                                                                        i.discount2
                                                                    ),
                                                                }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 85,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                            {/* 🆕 نفس فكرة فورم الصنف: السعر فوق ده قبل الضريبة، فبنعرض هنا شامل الضريبة
                          جنب الصف نفسه، بدل ما يبان بس تحت في إجمالي الفاتورة */}
                                            {item.taxable && (
                                                <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2, whiteSpace: "nowrap" }}>
                                                    شامل الضريبة: {taxInclusiveLabelPrice(item)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.bonusQty}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? { ...i, bonusQty: +e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 55,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: "4px" }}>
                                            <input
                                                type="date"
                                                value={/^\d{4}-\d{2}$/.test(item.expiry_date || "") ? `${item.expiry_date}-01` : (item.expiry_date || "")}
                                                onChange={(e) =>
                                                    setEditItems((prev) =>
                                                        prev.map((i) =>
                                                            i.id === item.id
                                                                ? { ...i, expiry_date: e.target.value }
                                                                : i
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 125,
                                                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "4px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                        <td
                                            style={{
                                                padding: "6px 8px",
                                                color: COLORS.blue,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {(
                                                item.receivedCost *
                                                item.qty *
                                                (item.taxable ? 1 + TAX_RATE : 1)
                                            ).toFixed(2)}
                                        </td>
                                        <td style={{ padding: "6px 8px" }}>
                                            <button
                                                onClick={() => {
                                                    // 🆕 منع حذف بند اتباع منه بالفعل — لازم يتحل عن طريق مرتجع بيع
                                                    // للكمية دي الأول، مش بحذف صف الفاتورة وتصفير رصيد كان له مالك.
                                                    const soldQty = getSoldQtyForPurchaseItem(item);
                                                    if (soldQty > 0) {
                                                        showToast(
                                                            `مينفعش تحذف "${item.name}" — اتباع منه ${soldQty} وحدة بالفعل من نفس الشغلة. لو محتاج تصحيح، اعمل مرتجع بيع للكمية دي الأول من شاشة المرتجعات`,
                                                            "error"
                                                        );
                                                        return;
                                                    }
                                                    setEditItems((prev) =>
                                                        prev.filter((i) => i.id !== item.id)
                                                    );
                                                }}
                                                style={{
                                                    background: "transparent",
                                                    border: "none",
                                                    color: COLORS.red,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                <IC n="trash" s={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div
                        style={{
                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            borderRadius: 10,
                            padding: 14,
                            marginTop: 14,
                        }}
                    >
                        {(() => {
                            const editCalcSubtotal = editItems.reduce(
                                (s, i) => s + i.receivedCost * i.qty,
                                0
                            );
                            const editCalcTax = editItems.reduce(
                                (s, i) =>
                                    i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                                0
                            );
                            const editSubtotal =
                                editManualSubtotal !== ""
                                    ? +editManualSubtotal
                                    : editCalcSubtotal;
                            const editTaxAmt =
                                editManualTax !== "" ? +editManualTax : editCalcTax;
                            const editTotal = editSubtotal + editTaxAmt;
                            return (
                                <>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: COLORS.textDim,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <span>قبل الضريبة</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder={editCalcSubtotal.toFixed(2)}
                                            value={editManualSubtotal}
                                            onChange={(e) => setEditManualSubtotal(e.target.value)}
                                            style={{
                                                width: 110,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                                borderRadius: 6,
                                                padding: "4px 8px",
                                                color: COLORS.textPrimary,
                                                fontSize: 13,
                                                outline: "none",
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: COLORS.green,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <span>ضريبة 15%</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder={editCalcTax.toFixed(2)}
                                            value={editManualTax}
                                            onChange={(e) => setEditManualTax(e.target.value)}
                                            style={{
                                                width: 110,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${tint(COLORS.blue, 0.35)}`,
                                                borderRadius: 6,
                                                padding: "4px 8px",
                                                color: COLORS.textPrimary,
                                                fontSize: 13,
                                                outline: "none",
                                            }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: COLORS.textPrimary,
                                            fontWeight: 800,
                                            fontSize: 16,
                                            borderTop: `1px solid ${COLORS.border}`,
                                            paddingTop: 8,
                                        }}
                                    >
                                        <span>الإجمالي</span>
                                        <span>{editTotal.toFixed(2)} ر.س</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            marginTop: 16,
                            justifyContent: "flex-end",
                        }}
                    >
                        <Btn variant="ghost" onClick={() => setShowDetail(null)}>
                            إلغاء
                        </Btn>
                        <Btn
                            variant="secondary"
                            icon="print"
                            onClick={() => doPrintPurchaseInvoice(showDetail, suppliers.find(s => s.id === editSupplier)?.name)}
                        >
                            طباعة
                        </Btn>
                        <Btn variant="secondary" onClick={() => printLabels(
                            editItems.map((i) => ({ ...i, newSalePrice: i.salePrice || i.newSalePrice }))
                        )}>
                            🖨️ طباعة ملصقات
                        </Btn>
                        <Btn
                            icon="check"
                            onClick={async () => {
                                if (!canEdit) {
                                    showToast("ليس لديك صلاحية تعديل فواتير الشراء", "error");
                                    return;
                                }
                                const editCalcSubtotal = editItems.reduce(
                                    (s, i) => s + i.receivedCost * i.qty,
                                    0
                                );
                                const editCalcTax = editItems.reduce(
                                    (s, i) =>
                                        i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                                    0
                                );
                                const editSubtotal =
                                    editManualSubtotal !== ""
                                        ? +editManualSubtotal
                                        : editCalcSubtotal;
                                const editTaxAmt =
                                    editManualTax !== "" ? +editManualTax : editCalcTax;
                                const sup = suppliers.find((s) => s.id === editSupplier);
                                // 🆕 الفاتورة دي لو كانت "مسودة" (جاية من سيناريو رصيد صفر في نقطة البيع)
                                // وبيتكمّل بياناتها دلوقتي هنا (التكلفة/الخصومات الحقيقية)، فده بالظبط
                                // معنى "اكتملت" — نحوّل حالتها لـ"مستلمة" زي أي فاتورة عادية، عشان
                                // مش تفضل معلّقة "بحاجة لإكمال" للأبد حتى بعد ما فعلاً اتكملت.
                                const wasDraft = showDetail.status === "مسودة";
                                const updated = {
                                    ...showDetail,
                                    supplier: editSupplier,
                                    supplier_name: sup?.name || showDetail.supplier_name,
                                    status: wasDraft ? "مستلمة" : showDetail.status,
                                    items: editItems.map((i) => ({
                                        id: i.id,
                                        name: i.name,
                                        qty: i.qty,
                                        bonusQty: i.bonusQty || 0,
                                        cost: i.receivedCost,
                                        discount1: i.discount1,
                                        discount2: i.discount2,
                                        salePrice: i.newSalePrice,
                                        taxable: i.taxable,
                                        expiry_date: i.expiry_date || null,
                                        // 🆕 كانوا بيتشالوا هنا من غير قصد — batch_id هو الرابط الوحيد بين
                                        // بند الفاتورة دي وبين الـ batch الفعلي في products.batches (ومنه
                                        // للبيع والرصد). لو اتشال، أي تعديل تاني على نفس الفاتورة بيفقد
                                        // القدرة يحسب "قد إيه اتباع من الشغلة دي" (زي فحص الحذف/التقليل فوق).
                                        batch_id: i.batch_id || null,
                                        batch_number: i.batch_number || null,
                                    })),
                                    subtotal: editSubtotal,
                                    taxAmount: editTaxAmt,
                                    total: editSubtotal + editTaxAmt,
                                };

                                // 🆕 مطابقة المخزون: الفاتورة القديمة أصلاً زوّدت المخزون بكمياتها،
                                // فلو الكميات اتغيرت في التعديل، لازم نعدّل الفرق بس على المخزون.
                                // القراءة هنا من products (state محلي) مش من Supabase — شغالة أوفلاين بالفعل.
                                const oldQtyById = {};
                                (showDetail.items || []).forEach((i) => {
                                    oldQtyById[i.id] = (oldQtyById[i.id] || 0) + i.qty + (i.bonusQty || 0);
                                });
                                const newQtyById = {};
                                editItems.forEach((i) => {
                                    newQtyById[i.id] = (newQtyById[i.id] || 0) + i.qty + (i.bonusQty || 0);
                                });
                                const affectedIds = new Set([...Object.keys(oldQtyById), ...Object.keys(newQtyById)]);
                                const stockDeltas = [];
                                for (const pid of affectedIds) {
                                    const delta = (newQtyById[pid] || 0) - (oldQtyById[pid] || 0);
                                    if (delta === 0) continue;
                                    stockDeltas.push({ id: pid, delta });
                                }

                                // 🆕 event مركّب واحد: تحديث بيانات الفاتورة + تصحيح المخزون بالـ delta —
                                // بيتنفذ جوه apply_stock_deltas على السيرفر وقت المزامنة، مش كتابة مباشرة
                                // أونلاين بس زي ما كان. القيمة الحالية للـ stock وقت التنفيذ الفعلي هي
                                // اللي بتتعدّل، مش قيمة نهائية محسوبة أوفلاين.
                                const editResult = await queueEvent({
                                    id: crypto.randomUUID(),
                                    type: "PURCHASE_INVOICE_EDIT",
                                    timestamp: new Date().toISOString(),
                                    payload: {
                                        purchaseId: showDetail.id,
                                        pharmacyId,
                                        updates: {
                                            supplier: editSupplier,
                                            supplier_name:
                                                sup?.name ||
                                                showDetail.supplier_name ||
                                                showDetail.supplierName,
                                            items: updated.items,
                                            subtotal: editSubtotal,
                                            tax_amount: editTaxAmt,
                                            total: editSubtotal + editTaxAmt,
                                            // 🆕 لو كانت مسودة رصيد صفر، تتحول لـ"مستلمة" فعليًا على السيرفر كمان
                                            // مش بس محليًا — وإلا هتفضل تظهر "بحاجة لإكمال" في أي جهاز/جلسة تانية.
                                            ...(wasDraft ? { status: "مستلمة" } : {}),
                                        },
                                        stockDeltas,
                                    },
                                });
                                if (!editResult.synced) {
                                    showToast("📴 تم حفظ التعديل محليًا - هيتزامن تلقائيًا لما النت يرجع", "warning");
                                }

                                // تحديث optimistic لـ state المحلي + كاش SQLite بالتوازي (بغض النظر عن حالة النت)
                                if (stockDeltas.length > 0) {
                                    setProducts((prev) =>
                                        prev.map((x) => {
                                            const d = stockDeltas.find((sd) => sd.id === x.id);
                                            return d ? { ...x, stock: x.stock + d.delta } : x;
                                        })
                                    );
                                    try {
                                        await window.offlineAPI?.applyProductStockDeltaCache?.({ pharmacyId, deltas: stockDeltas });
                                    } catch (err) {
                                        console.error("applyProductStockDeltaCache failed:", err);
                                    }
                                }

                                // 🆕 كانت ناقصة: تسجيل التعديل في سجل التدقيق (كان بيتسجل الحذف والإضافة بس، مش التعديل)
                                logAudit({
                                    pharmacyId, userName: currentUser?.name, action: "edit", entityType: "purchase_invoice",
                                    entityId: showDetail.id, entityLabel: `فاتورة شراء ${showDetail.id}`,
                                    oldValue: { supplier: showDetail.supplier_name, total: showDetail.total },
                                    newValue: { supplier: updated.supplier_name, total: updated.total },
                                    description: `تعديل فاتورة الشراء "${showDetail.id}"`,
                                });

                                setPurchases((prev) =>
                                    prev.map((p) => (p.id === showDetail.id ? updated : p))
                                );

                                // 🆕 لو الفاتورة دي كانت مسودة رصيد صفر واتكمّلت دلوقتي، نمسح إشارة
                                // "الفاتورة المفتوحة" بتاعة نفس المورد ده من localStorage اللي نقطة
                                // البيع (POS.tsx) بتعتمد عليها — وإلا لو الصيدلي باع صنف تاني (رصيده
                                // صفر) من نفس المورد بعد كده، هتحاول نقطة البيع تضيفه على الفاتورة دي
                                // اللي خلاص اتقفلت، بدل ما تفتح فاتورة مسودة جديدة صح.
                                // بنتأكد إن الإشارة المخزّنة بتخص نفس الفاتورة دي بالظبط (poId) قبل
                                // ما نمسحها، عشان لو حصلت مسودة تانية أحدث لنفس المورد بعد كده منمسحهاش.
                                if (wasDraft) {
                                    try {
                                        const key = `pharmacypro_pos_zero_stock_drafts_${pharmacyId}`;
                                        const raw = localStorage.getItem(key);
                                        if (raw) {
                                            const parsed = JSON.parse(raw);
                                            const supplierKey = showDetail.supplier; // المورد الأصلي وقت إنشاء المسودة
                                            if (parsed[supplierKey]?.poId === showDetail.id) {
                                                delete parsed[supplierKey];
                                                localStorage.setItem(key, JSON.stringify(parsed));
                                            }
                                        }
                                    } catch (err) {
                                        console.error("clearing POS zero-stock draft marker failed:", err);
                                    }
                                }

                                setShowDetail(null);
                                showToast("تم التعديل ✓");
                            }}
                        >
                            حفظ التعديل
                        </Btn>
                    </div>
                </Modal>
            )}
        </div>
    );
}