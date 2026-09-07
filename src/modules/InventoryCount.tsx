import { useState, useRef, useEffect, useMemo } from "react"; // 🆕 useMemo لتحسين أداء notCountedProducts
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import * as XLSX from "xlsx";
import { logAudit } from "../lib/auditLog";
import { normGtin } from "../lib/barcodeUtils";
import { todayLocal } from "../lib/dateUtils";
import { Badge, Btn, Input, Modal, Table } from "../ui/primitives";
import { queueEvent, saveProduct } from "../lib/offlineAPI"; // 🆕 عدّل المسار حسب مكان الملف عندك
import { ProductFormModal } from "./ProductFormModal"; // 🆕 عدّل المسار حسب مكان الملف عندك

export function InventoryCount({
    products,
    setProducts,
    inventoryLogs,
    setInventoryLogs,
    currentUser,
    showToast,
    pharmacyId,
    purchases,
    canAddSub = (_sub) => true,
    canEditSub = (_sub) => true,
    // 🆕 إعدادات الصيدلية العامة (نفس الكائن المستخدم لإعدادات رصد/الطابعات) — لازم يحمل
    // categoryCostDiscounts: { [supply_category]: percentNumber }. المصدر الوحيد لتعديل النسب
    // دي بقى شاشة "بيانات الصيدلية" (PharmacySettings) — هنا بنقرأها بس.
    pharmacySettings = {},
}) {
    const [showNew, setShowNew] = useState(false);
    const [countItems, setCountItems] = useState([]);
    const [notes, setNotes] = useState("");
    const [search, setSearch] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [repairing, setRepairing] = useState(false);
    const [scanInput, setScanInput] = useState(""); // 🆕 حقل السكانر أثناء الجرد
    const scanTimeoutRef = useRef(null); // 🆕 لتشغيل السكان تلقائي من غير الحاجة لضغط Enter
    const scanInputRef = useRef(null); // 🆕 عشان نرجّع الفوكس لخانة السكانر بعد إدخال الكمية

    // 🆕 نوع الجرد: "افتتاحي" (أول رصيد بيتسجل للصيدلية) أو "دوري" (صيدلية شغالة بالفعل)
    // — بيتحكم في ظهور عمود التكلفة والبلوك الإجباري، من غير ما يأثر على منطق الجرد
    // الأعمى أو أي مسار تاني في الشاشة.
    const [countMode, setCountMode] = useState("دوري");

    // 🆕 التكلفة الافتراضية لسطر الرصيد الافتتاحي: تكلفة قديمة (لو موجودة وأكبر من صفر)
    // ← وإلا سعر البيع × (1 − نسبة خصم فئة التوريد) ← وإلا صفر (يتلوّن أحمر ويتعدل يدوي).
    // التعديل اليدوي لقيمة التكلفة في السطر نفسه بيكسر ربطها بالنسبة (بتتخزن كرقم ثابت).
    // نسبة الخصم نفسها بقى مصدرها ومحل تعديلها شاشة "بيانات الصيدلية" مش هنا. بتتحسب
    // على فئة التوريد (product.supply_category) مش الفئة الرئيسية، لأنها أدق وأكتر تفصيلاً.
    const getDefaultLineCost = (existingCost, product) => {
        if (+existingCost > 0) return +existingCost;
        const pct = pharmacySettings?.categoryCostDiscounts?.[product?.supply_category];
        if (pct != null && +product?.price > 0) {
            return +((+product.price) * (1 - pct / 100)).toFixed(2);
        }
        return 0;
    };

    // ==================== 🆕 الحفظ التلقائي أثناء الجرد (Draft محلي) ====================
    // مفتاح مخصص لكل صيدلية، عشان لو فيه أكتر من صيدلية بتستخدم نفس الجهاز (نادر بس ممكن)
    const DRAFT_KEY = `inv_count_draft_${pharmacyId}`;

    // كل تغيير في سطور الجرد أو الملاحظات وقت ما شاشة الجرد مفتوحة يتخزن فورًا محليًا،
    // عشان لو الشاشة اتقفلت لأي سبب (كراش، قفل الجهاز، تغيير شاشة بالغلط) الجرد يفضل موجود.
    useEffect(() => {
        if (!showNew) return;
        try {
            localStorage.setItem(
                DRAFT_KEY,
                JSON.stringify({ countItems, notes, countMode, updated_at: Date.now() }) // 🆕 countMode مضاف
            );
        } catch { }
    }, [countItems, notes, countMode, showNew]); // 🆕 countMode في الـ deps

    // ==================== 🆕 ربط باركود جديد/متغير بصنف موجود ====================
    const [showLinkBarcodeModal, setShowLinkBarcodeModal] = useState(false);
    const [unmatchedBarcode, setUnmatchedBarcode] = useState("");
    const [linkSearch, setLinkSearch] = useState("");

    // ==================== 🆕 إضافة صنف جديد من نفس شاشة الجرد ====================
    const [showAddProductModal, setShowAddProductModal] = useState(false);

    // ==================== 🆕 استيراد الجرد من إكسيل ====================
    const invExcelInputRef = useRef(null);
    const [excelImportBusy, setExcelImportBusy] = useState(false);
    const [excelUnmatched, setExcelUnmatched] = useState([]); // صفوف الملف اللي معندهاش صنف مطابق
    const [showInvColMapModal, setShowInvColMapModal] = useState(false);
    const [invColMapDraft, setInvColMapDraft] = useState({ code: "", qty: "" });
    const [pendingInvRows, setPendingInvRows] = useState(null);

    // بيبني صفوف الجرد الأساسية من حالة المخزون الحالية (نفس منطق startCount)
    // — دالة منفصلة عشان نقدر نستخدمها في البداية العادية وبرضه كأساس نطبّق عليه الاستيراد
    const buildBaseCountRows = () => {
        const rows = [];
        products.forEach((p) => {
            const batches = (p.batches || []).filter((b) => b.qty > 0);
            if (batches.length > 0) {
                batches.forEach((b, idx) => {
                    rows.push({
                        id: p.id,
                        lineKey: `${p.id}::${b.expiry_date || "بدون-تاريخ"}::${idx}`,
                        name: p.name,
                        category: p.category,
                        expiry: b.expiry_date || "",
                        batchNumber: b.batch_number || null, // 🆕 لمطابقة التشغيلة الأصلية بدقة وقت الحفظ
                        systemQty: b.qty,
                        actualQty: b.qty,
                        diff: 0,
                        isNew: false,
                        cost: getDefaultLineCost(b.cost ?? p.cost ?? 0, p), // 🆕
                        reason: "", // 🆕 سبب اختياري لو ظهر فرق (تلف/سرقة/غلطة عد...)
                    });
                });
            } else {
                rows.push({
                    id: p.id,
                    lineKey: `${p.id}::بدون-تاريخ::0`,
                    name: p.name,
                    category: p.category,
                    expiry: "",
                    batchNumber: null, // 🆕
                    systemQty: p.stock,
                    actualQty: p.stock,
                    diff: 0,
                    isNew: false,
                    cost: getDefaultLineCost(p.cost ?? 0, p), // 🆕
                    reason: "", // 🆕
                });
            }
        });
        return rows;
    };

    const startCount = (mode = "دوري") => {
        // 🆕 قبل ما نبدأ جرد جديد، بنتأكد إن مفيش جرد متوقف محفوظ محليًا من قبل كده —
        // لو فيه، نديله الاختيار يكمله بدل ما يضيع منه.
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            const draft = raw ? JSON.parse(raw) : null;
            if (draft?.countItems?.length) {
                const resume = window.confirm(
                    `فيه جرد متوقف من ${new Date(draft.updated_at).toLocaleString("ar-SA")} فيه ${draft.countItems.length} سطر.\nعايز تكمله؟ (إلغاء = ابدأ جرد جديد من الأول)`
                );
                if (resume) {
                    setCountItems(draft.countItems);
                    setNotes(draft.notes || "");
                    setCountMode(draft.countMode || mode); // 🆕 نرجّع نفس نوع الجرد اللي كان شغال بيه الدرافت
                    setSearch("");
                    setScanInput("");
                    setShowNew(true);
                    return;
                }
            }
        } catch { }

        // 🆕 جرد أعمى (Blind Count): القايمة تبدأ فاضية تمامًا، مفيش رصيد نظام ظاهر.
        // الصيدلي بيضيف الأصناف واحد واحد بالسكانر أو بار البحث، ويكتب الكمية اللي
        // شافها فعليًا على الرف — من غير ما يشوف رصيد النظام وهو بيعد، عشان النتيجة
        // تعكس العدّ الحقيقي مش تأكيد لرقم شايفه قدامه.
        localStorage.removeItem(DRAFT_KEY);
        setExcelUnmatched([]);
        setCountItems([]);
        setCountMode(mode); // 🆕 نحدد نوع الجرد الجديد (افتتاحي / دوري)
        setSearch("");
        setScanInput("");
        setShowNew(true);
    };

    // 🆕 إضافة صنف واحد للجرد (من السكانر أو من نتيجة البحث) — بيتضاف بكل تشغيلاته
    // (batches) كأسطر منفصلة، الكمية الفعلية بتبدأ من صفر (مش من رصيد النظام) عشان
    // يفضل الجرد أعمى، ورصيد النظام بيتخزن جوه السطر (systemQty) للمقارنة بعد الحفظ بس.
    // hint (اختياري): {batchNumber, expiry} مستخرجة من باركود GS1 ثنائي — لو اتبعتت،
    // بنحدد أنهي سطر تشغيلة هو المقصود بالظبط ونركّز حقل الكمية بتاعه فورًا.
    const addProductToCount = (product, hint) => {
        if (countItems.some((r) => r.id === product.id)) {
            showToast("الصنف ده متضاف في الجرد بالفعل");
            return;
        }
        const isMatch = (b) => {
            if (!hint) return false;
            if (hint.batchNumber && b.batch_number && hint.batchNumber === b.batch_number) return true;
            if (hint.expiry && b.expiry_date === hint.expiry) return true;
            return false;
        };
        const batches = (product.batches || []).filter((b) => b.qty > 0);
        const newRows =
            batches.length > 0
                ? batches.map((b, idx) => ({
                      id: product.id,
                      lineKey: `${product.id}::${b.expiry_date || "بدون-تاريخ"}::${idx}`,
                      name: product.name,
                      category: product.category,
                      expiry: b.expiry_date || "",
                      batchNumber: b.batch_number || null, // 🆕 لمطابقة التشغيلة الأصلية بدقة وقت الحفظ
                      systemQty: b.qty,
                      actualQty: 0,
                      diff: -b.qty,
                      isNew: false,
                      scanMatched: isMatch(b),
                      cost: getDefaultLineCost(b.cost ?? product.cost ?? 0, product), // 🆕
                      reason: "", // 🆕
                  }))
                : [
                      {
                          id: product.id,
                          lineKey: `${product.id}::بدون-تاريخ::0`,
                          name: product.name,
                          category: product.category,
                          // 🆕 الصنف ده مالوش batches حقيقية (سطر رصيد إجمالي واحد بس)، فلو
                          // السكانر قرا صلاحية، بنحطها على السطر الوحيد ده مباشرة بدل ما نعتبرها
                          // تشغيلة تانية ونضيف سطر جديد جنبه (ده هيبقى تكرار وهمي مفيدش).
                          expiry: hint?.expiry || "",
                          batchNumber: hint?.batchNumber || null, // 🆕
                          systemQty: product.stock,
                          actualQty: 0,
                          cost: getDefaultLineCost(product.cost ?? 0, product), // 🆕
                          diff: -(product.stock || 0),
                          isNew: false,
                          scanMatched: !!hint?.expiry,
                          reason: "", // 🆕
                      },
                  ];
        // 🆕 لو الباركود فيه تاريخ صلاحية (hint.expiry) والصنف عنده تشغيلات حقيقية
        // (batches.length > 0) ومفيش أي واحدة فيها اتطابقت معاه (يعني الصلاحية اللي على
        // العلبة الحقيقية مش مسجلة في النظام أصلاً)، نضيف سطر تشغيلة جديد بالصلاحية دي
        // بالظبط بدل ما نتجاهلها. الحالة اللي مالهاش batches اتعالجت فوق على السطر نفسه.
        if (batches.length > 0 && hint?.expiry && !newRows.some((r) => r.scanMatched)) {
            newRows.push({
                id: product.id,
                lineKey: `${product.id}::${hint.expiry}::${Date.now()}`,
                name: product.name,
                category: product.category,
                expiry: hint.expiry,
                batchNumber: hint?.batchNumber || null, // 🆕
                systemQty: 0,
                actualQty: 0,
                diff: 0,
                isNew: true,
                scanMatched: true,
                cost: getDefaultLineCost(0, product), // 🆕 تشغيلة جديدة تمامًا، مفيش تكلفة قديمة ليها
                reason: "", // 🆕
            });
        }
        setCountItems((p) => [...p, ...newRows]);
        setSearch("");
        const matchedRow = newRows.find((r) => r.scanMatched);
        if (matchedRow) {
            // نركّز حقل الكمية بتاع التشغيلة المطابقة عشان الصيدلي يكتب الرقم على طول
            setTimeout(() => {
                document.querySelector(`[data-linekey="${matchedRow.lineKey}"]`)?.focus();
            }, 50);
        }
    };


    // 🆕 باركود GS1 الثنائي (DataMatrix) — المستخدم في تتبع الأدوية بالسعودية (رصد) —
    // بيدمج أكتر من معرّف (AI) في كود واحد: (01) GTIN، (10) رقم التشغيلة،
    // (17) تاريخ الصلاحية YYMMDD، (21) الرقم التسلسلي. بيوصل إما بفاصل نصي بالأقواس
    // زي في الصورة، أو بفاصل GS الحقيقي (ASCII 29) من السكانر الفعلي.
    // بيرجع object فيه كل AI موجود، عشان نستخرج الـ GTIN بس للمطابقة مع الأصناف.
    const parseGS1 = (raw) => {
        const FIXED_LEN = { "01": 14, "11": 6, "15": 6, "17": 6 }; // AIs بطول ثابت معروف
        const KNOWN_AI = new Set(["01", "10", "11", "15", "17", "21"]); // AIs المستخدمة في تتبع الدواء
        const out = {};
        if (raw.includes("(")) {
            const re = /\((\d{2,4})\)([^(]*)/g;
            let m;
            while ((m = re.exec(raw))) out[m[1]] = m[2].trim();
            return out;
        }
        // ✅ في السكانر الفعلي، فاصل GS (ASCII 29) بين الحقول متغيرة الطول (10، 21) غالبًا
        // بيتفقد أو مش متسق حسب إعدادات الجهاز — لو اعتمدنا عليه بس، رقم التشغيلة كان بيبلع
        // أرقام تاريخ الصلاحية اللي وراه (وده اللي كان بيدخل الصلاحية غلط). فبدل ما نعتمد
        // على GS لوحده، بندوّر كمان على أقرب نقطة تبدأ فيها AI معروفة تانية (01/10/11/15/17/21)
        // ونوقف الحقل متغير الطول عندها.
        const GS = String.fromCharCode(29);
        let rest = raw;
        while (rest.length >= 2) {
            const ai = rest.slice(0, 2);
            if (!KNOWN_AI.has(ai)) break; // مش قادرين نتعرف على بداية الحقل ده، نوقف بأمان
            rest = rest.slice(2);
            const len = FIXED_LEN[ai];
            if (len) {
                out[ai] = rest.slice(0, len);
                rest = rest.slice(len);
            } else {
                let cut = rest.length;
                const gsIdx = rest.indexOf(GS);
                if (gsIdx !== -1) {
                    cut = gsIdx;
                } else {
                    for (let i = 2; i < rest.length - 1; i++) {
                        if (KNOWN_AI.has(rest.slice(i, i + 2))) {
                            cut = i;
                            break;
                        }
                    }
                }
                out[ai] = rest.slice(0, cut);
                rest = rest.slice(cut);
                if (rest[0] === GS) rest = rest.slice(1);
            }
        }
        return out;
    };

    // 🆕 تحويل تاريخ AI(17) من صيغة GS1 (YYMMDD) لصيغة "سنة-شهر" المستخدمة في batches
    // (input type="month" في الجدول) — بنتجاهل رقم اليوم لإن التخزين عندنا بمستوى الشهر بس.
    const gs1DateToYearMonth = (yymmdd) => {
        if (!yymmdd || yymmdd.length !== 6) return null;
        return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}`;
    };

    // 🆕 معالجة السكانر: بيدخل باركود (عادي أو GS1 ثنائي)، بيدوّر على الصنف المطابق، ويضيفه للجرد.
    // لو الكود مركّب (فيه أقواس AI أو أطول من باركود عادي بكتير)، بنستخرج الـ GTIN (AI 01)
    // بس ونطابق بيه — نفس منطق المطابقة المستخدم في استيراد الإكسيل (normGtin على barcode و gtin).
    // وبنستخرج كمان رقم التشغيلة (AI 10) وتاريخ الصلاحية (AI 17) كـ hint لتحديد سطر
    // التشغيلة بالظبط في الجرد بدل ما الصيدلي يختار يدوي.
    const handleScanBarcode = (rawCode) => {
        let gtinSource = rawCode;
        let hint = null;
        if (rawCode.includes("(") || rawCode.length > 20) {
            const parsed = parseGS1(rawCode);
            if (parsed["01"]) gtinSource = parsed["01"];
            hint = {
                batchNumber: parsed["10"] || null,
                expiry: parsed["17"] ? gs1DateToYearMonth(parsed["17"]) : null,
            };
        }
        const code = normGtin(gtinSource);
        if (!code) return;
        const product = products.find(
            (x) => normGtin(x.barcode) === code || normGtin(x.gtin) === code
                || (x.altBarcodes || []).some((b) => normGtin(b) === code) // 🆕 باركود بديل
        );
        if (!product) {
            // 🆕 بدل ما نرفض الباركود، نفتح مودال يخلي الصيدلي يربطه بصنف موجود
            // (باركود اتغير من المورد) أو يضيف صنف جديد بيه لو فعلاً مش مسجل خالص
            setUnmatchedBarcode(code);
            setLinkSearch("");
            setShowLinkBarcodeModal(true);
            setScanInput("");
            return;
        }
        addProductToCount(product, hint);
        setScanInput("");
    };

    // 🆕 تعديل تكلفة الصنف (product.cost) Inline من نفس شاشة الجرد الدوري — للحالة اللي
    // صنف واصل التكلفة بتاعته صفر (معملش رصيد افتتاحي ليه قبل كده أو بيانات ناقصة)،
    // فالصيدلي يقدر يظبطها بسرعة من غير ما يقفل الجرد ويسيب الشاشة. التعديل ده بيغيّر
    // تكلفة الصنف الأساسية (products) بس — مش بيلمس سطر/فروق الجرد الحالي.
    const [editingCostFor, setEditingCostFor] = useState(null); // lineKey السطر اللي بيتعدل حاليًا
    const [editingCostValue, setEditingCostValue] = useState("");
    const updateProductCostInline = async (product, newCost) => {
        if (!(+newCost > 0)) {
            showToast("لازم تدخل تكلفة أكبر من صفر", "error");
            return;
        }
        const { error } = await saveProduct({ id: product.id, cost: +newCost }, pharmacyId, true);
        if (error) {
            showToast("فشل تحديث التكلفة: " + error, "error");
            return;
        }
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, cost: +newCost } : p)));
        // 🆕 بنحدّث كمان أي سطر جرد حالي لنفس الصنف عشان التحذير يختفي فورًا من غير ما
        // يحتاج يقفل الجرد ويفتحه تاني
        setCountItems((prev) =>
            prev.map((x) => (x.id === product.id ? { ...x, cost: +newCost } : x))
        );
        showToast(`تم تحديث تكلفة "${product.nameAr || product.name}" ✓`);
        setEditingCostFor(null);
        setEditingCostValue("");
    };

    // 🆕 ربط باركود جديد/متغير بصنف موجود بالفعل — بيحدّث حقل الباركود في الصنف
    // نفسه (نفس آلية saveProduct المستخدمة في تحديثات الصنف الجزئية زي is_standalone_offer)
    // وبعدين يضيفه لسطر الجرد الحالي مباشرة عشان الصيدلي يكمل بدون انقطاع.
    const linkBarcodeToProduct = async (product) => {
        const { error } = await saveProduct({ id: product.id, barcode: unmatchedBarcode }, pharmacyId, true);
        if (error) {
            showToast("فشل ربط الباركود: " + error, "error");
            return;
        }
        const updatedProduct = { ...product, barcode: unmatchedBarcode };
        setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));
        showToast(`تم ربط الباركود بـ "${product.nameAr || product.name}" ✓`);
        setShowLinkBarcodeModal(false);
        addProductToCount(updatedProduct);
        setUnmatchedBarcode("");
        setLinkSearch("");
    };

    // 🆕 قايمة "أصناف لسه ماتجردتش": أي صنف عنده رصيد في النظام ومعملهوش سكان/إضافة
    // لسه — بتفضل ظاهرة طول ما الجرد شغال، وأي صنف فيها لسه وقت الحفظ بيتحسب فرق (نقص)
    // تلقائي = رصيده الحالي كامل.
    // ✅ الأداء: ده كان بيتحسب من جديد (فلترة كل الأصناف) في كل render حتى وانت بتكتب رقم
    // في خانة واحدة بس — على مخزون فيه مئات/آلاف الأصناف ده كان بيسبب لاج ملحوظ وانت بتجرد.
    // useMemo بيخليه يتحسب بس لما products أو countItems أو showNew فعلاً يتغيروا.
    const notCountedProducts = useMemo(() => {
        if (!showNew) return [];
        const countedIds = new Set(countItems.map((r) => r.id));
        return products.filter((p) => {
            if (countedIds.has(p.id)) return false;
            const batches = (p.batches || []).filter((b) => b.qty > 0);
            const stock = batches.length > 0 ? batches.reduce((s, b) => s + b.qty, 0) : p.stock || 0;
            return stock > 0;
        });
    }, [showNew, products, countItems]);

    // 🆕 خريطة سريعة (id → product) — نستخدمها في ملخص الجرد المحاسبي عشان منعملش
    // .find() على كل الأصناف لكل سطر جرد (أداء أفضل مع آلاف الأصناف)
    const productsById = useMemo(() => {
        const m = new Map();
        products.forEach((p) => m.set(p.id, p));
        return m;
    }, [products]);

    // 🆕 نسبة ضريبة القيمة المضافة الموحّدة (15%)، شاملة داخل product.price — لو فيه
    // ثابت مشترك تاني في البرنامج (زي إعدادات ZATCA) الأفضل يتستورد من هناك بدل الرقم ده.
    const VAT_RATE = 0.15;

    // 🆕 ملخص محاسبي سريع للجرد الجاري (قبل الحفظ) — بيتحسب من الأسطر اللي داخلة فعليًا
    // في الشاشة دلوقتي بس (مش الأصناف "لسه ماتجردتش" اللي بتتحسب auto-zero وقت الحفظ)،
    // عشان يعكس مراجعة لللي الصيدلي شافه وعدّه فعليًا مش توقّع نهائي. شغال في الوضعين
    // (رصيد افتتاحي وجرد دوري) بنفس المنطق، لأن item.cost أصلاً بيتحدد بنفس الطريقة
    // (getDefaultLineCost) في الحالتين — الفرق إن الصيدلي بيعدّلها يدوي وهو شايفها بس
    // في الرصيد الافتتاحي.
    const countSummary = useMemo(() => {
        const uniqueIds = new Set();
        let totalQty = 0, totalSale = 0, totalCost = 0, totalTax = 0;

        countItems.forEach((item) => {
            uniqueIds.add(item.id);
            const product = productsById.get(item.id);
            const qty = +item.actualQty || 0;
            const price = +product?.price || 0;
            const cost = +item.cost || +product?.cost || 0;

            totalQty += qty;
            totalSale += qty * price;
            totalCost += qty * cost;
            if (product?.taxable) {
                // الضريبة شاملة داخل price، فنصيبها = price × (15/115)
                totalTax += qty * price * (VAT_RATE / (1 + VAT_RATE));
            }
        });

        return {
            lineCount: countItems.length,
            productCount: uniqueIds.size,
            totalQty,
            totalSale,
            totalCost,
            totalTax,
        };
    }, [countItems, productsById]);

    // بيدوّر على اسم العمود الصح مهما اختلفت صياغته في ملف الجرد (باركود/كود، كمية)
    const normalizeInvHeader = (s) =>
        String(s || "")
            .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
            .replace(/[أإآ]/g, "ا")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    const findInvColumn = (row, candidates) => {
        const keys = Object.keys(row);
        for (const cand of candidates) {
            const normCand = normalizeInvHeader(cand);
            const hit = keys.find((k) => normalizeInvHeader(k).includes(normCand));
            if (hit) return hit;
        }
        return null;
    };

    // بيطبّق صفوف ملف الجرد (بعد ما اتحدد عمود الباركود/الكود وعمود الكمية) على صفوف
    // الجرد الأساسية: بيطابق بالباركود (GTIN) زي أي مطابقة تانية في البرنامج، وبيحدّث
    // الكمية الفعلية للصنف المطابق. الأصناف اللي معندهاش تطابق بتتحط في قائمة "مش موجودة عندك".
    const applyInventoryExcelRows = (rows, colMap) => {
        // تجميع صفوف الملف حسب الكود بعد التطبيع، لو نفس الكود اتكرر في أكتر من صف بنجمع الكمية
        const grouped = new Map();
        rows.forEach((row) => {
            const rawCode = row[colMap.code];
            if (rawCode === "" || rawCode == null) return;
            const code = normGtin(rawCode);
            if (!code) return;
            const qty = Number(row[colMap.qty]) || 0;
            grouped.set(code, { code, rawCode: String(rawCode).trim(), qty: (grouped.get(code)?.qty || 0) + qty });
        });

        const baseRows = buildBaseCountRows();
        const unmatched = [];
        let matchedCount = 0;

        grouped.forEach((entry) => {
            const product = products.find(
                (x) => normGtin(x.barcode) === entry.code || normGtin(x.gtin) === entry.code
                    || (x.altBarcodes || []).some((b) => normGtin(b) === entry.code) // 🆕 باركود بديل
            );
            if (!product) {
                unmatched.push(entry);
                return;
            }
            matchedCount++;
            const productLines = baseRows.filter((r) => r.id === product.id);
            if (productLines.length === 0) return;
            // صنف بسطر واحد (الحالة الشائعة، خصوصًا لصيدلية جديدة لسه بتدخل جردها الأول)
            // → الكمية المستوردة بتتحط عليه مباشرة. لو الصنف عنده أكتر من تاريخ صلاحية،
            // الكمية كلها بتتحط على أول سطر والباقي بيتصفّر (يقدر يوزعها يدوي على التواريخ بعدين).
            productLines.forEach((line, idx) => {
                line.actualQty = idx === 0 ? entry.qty : 0;
                line.diff = line.actualQty - line.systemQty;
            });
        });

        setCountItems(baseRows);
        setExcelUnmatched(unmatched);
        setShowNew(true);
        showToast(
            `تم تطبيق ${matchedCount} صنف من الملف على الجرد ✓` +
            (unmatched.length ? ` — و${unmatched.length} كود مش موجود عندك في الأصناف` : "")
        );
    };

    const handleInventoryExcelFile = async (file) => {
        if (!file) return;
        setExcelImportBusy(true);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
            if (!rows.length) {
                showToast("الملف فارغ أو مفيش صفوف بيانات فيه", "error");
                return;
            }
            const colCode = findInvColumn(rows[0], ["باركود", "الباركود", "كود الصنف", "الكود", "كود", "barcode", "gtin", "code"]);
            const colQty = findInvColumn(rows[0], ["الكمية الفعلية", "الكمية", "الرصيد", "المخزون", "qty", "quantity", "stock"]);
            if (colCode && colQty) {
                applyInventoryExcelRows(rows, { code: colCode, qty: colQty });
            } else {
                // مقدرناش نكتشف الأعمدة تلقائيًا → نعرض شاشة بسيطة يحدد فيها العمودين بنفسه
                setInvColMapDraft({ code: colCode || "", qty: colQty || "" });
                setPendingInvRows(rows);
                setShowInvColMapModal(true);
            }
        } catch (e) {
            showToast("تعذّرت قراءة الملف: " + (e?.message || e), "error");
        } finally {
            setExcelImportBusy(false);
            if (invExcelInputRef.current) invExcelInputRef.current.value = "";
        }
    };

    const confirmInvColumnMapping = () => {
        if (!invColMapDraft.code || !invColMapDraft.qty) {
            showToast("لازم تحدد عمود الباركود/الكود وعمود الكمية", "error");
            return;
        }
        setShowInvColMapModal(false);
        applyInventoryExcelRows(pendingInvRows, invColMapDraft);
        setPendingInvRows(null);
    };

    // إضافة سطر تاريخ صلاحية إضافي لنفس الصنف — للحالة اللي بيتلاقى فيها كمية
    // على الرف بتاريخ مش مسجل أصلاً في المخزون.
    const addExtraExpiryLine = (item) => {
        // 🆕 بنجيب بيانات الصنف الأصلية عشان نحسب تكلفة افتراضية للسطر الجديد ده
        // (السطر نفسه معندوش سعر بيع/فئة كافيين، لازم نرجع لكائن المنتج الكامل)
        const product = products.find((p) => p.id === item.id);
        setCountItems((p) => [
            ...p,
            {
                id: item.id,
                lineKey: `${item.id}::جديد::${Date.now()}`,
                name: item.name,
                category: item.category,
                expiry: "",
                batchNumber: null, // 🆕 سطر جديد تمامًا، مالوش تشغيلة أصلية يتطابق معاها
                systemQty: 0,
                actualQty: 0,
                diff: 0,
                isNew: true,
                cost: product ? getDefaultLineCost(0, product) : 0, // 🆕
                reason: "", // 🆕
            },
        ]);
    };

    // 🆕 حذف سطر واحد بس من الجرد (لو محتاج يصحح تشغيلة واحدة)
    const removeCountLine = (lineKey) => {
        setCountItems((p) => p.filter((x) => x.lineKey !== lineKey));
    };

    // 🆕 حذف الصنف كامل من الجرد (كل تشغيلاته) — للحالة اللي بيضرب صنف بالغلط بالسكانر
    const removeProductFromCount = (productId) => {
        setCountItems((p) => p.filter((x) => x.id !== productId));
    };

    // ✅ أداة إصلاح لمرة واحدة: فاتورة الشراء كانت بتحدّث تشغيلات الصنف (batches) في
    // الذاكرة المحلية بس من غير ما تحفظها في Supabase، فتواريخ صلاحية كتير اتفقدت.
    // الأداة دي بتعيد بناء batches كل صنف من كل فواتير الشراء المسجلة + الكمية الحالية
    // في المخزون، بافتراض إن الاستهلاك بيحصل بترتيب فواتير الشراء (الأقدم يتباع الأول).
    const repairBatchesFromPurchases = async () => {
        if (repairing) return;
        const confirmed = window.confirm(
            "هيتم إعادة بناء تشغيلات (batches) كل الأصناف من فواتير الشراء المسجلة، وهيتكتب فوق أي تشغيلات حالية في المخزون. الكمية الإجمالية للصنف مش هتتغير. تكمل؟"
        );
        if (!confirmed) return;

        setRepairing(true);
        try {
            // 1) نجمع كل تشغيلات كل صنف من كل فواتير الشراء، مرتبة زمنيًا (الأقدم أولاً)
            const purchaseBatchesByProduct = {};
            (purchases || [])
                .slice()
                .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                .forEach((po) => {
                    const poItems =
                        typeof po.items === "string" ? JSON.parse(po.items) : po.items || [];
                    poItems.forEach((it) => {
                        if (!it.id) return;
                        const qty = (+it.qty || 0) + (+it.bonusQty || 0);
                        if (qty <= 0) return;
                        if (!purchaseBatchesByProduct[it.id]) purchaseBatchesByProduct[it.id] = [];
                        purchaseBatchesByProduct[it.id].push({
                            qty,
                            cost: it.cost ?? it.receivedCost ?? 0,
                            salePrice: it.salePrice ?? it.newSalePrice ?? 0,
                            expiry_date: it.expiry_date || null,
                            batch_number: it.batch_number || null,
                            date: po.date || null,
                        });
                    });
                });

            // 2) لكل صنف، بنستهلك التشغيلات الأقدم أولاً لحد ما نوصل للكمية الحالية بالظبط
            const updates = [];
            products.forEach((p) => {
                const poBatches = purchaseBatchesByProduct[p.id];
                if (!poBatches || poBatches.length === 0) return; // مفيش فواتير شراء مسجلة لهذا الصنف، نسيبه زي ما هو

                const totalPurchased = poBatches.reduce((s, b) => s + b.qty, 0);
                let toConsume = Math.max(0, totalPurchased - Math.max(0, p.stock || 0));

                const remainingBatches = [];
                for (const b of poBatches) {
                    if (toConsume >= b.qty) {
                        toConsume -= b.qty;
                        continue; // اتستهلكت بالكامل
                    }
                    const remainingQty = b.qty - toConsume;
                    toConsume = 0;
                    if (remainingQty > 0) {
                        remainingBatches.push({ ...b, qty: remainingQty });
                    }
                }

                // لو المتبقي من التشغيلات مجموعه أقل من المخزون الفعلي (فروقات جرد/مرتجعات
                // مش موجودة في فواتير الشراء)، نضيف الفرق كتشغيلة "غير محددة التاريخ"
                const remainingTotal = remainingBatches.reduce((s, b) => s + b.qty, 0);
                const gap = (p.stock || 0) - remainingTotal;
                if (gap > 0) {
                    remainingBatches.push({
                        qty: gap,
                        cost: p.cost || 0,
                        salePrice: p.price || 0,
                        expiry_date: null,
                        batch_number: null,
                        date: "قديم",
                    });
                }

                updates.push({ id: p.id, batches: remainingBatches });
            });

            if (updates.length === 0) {
                showToast("مفيش أصناف محتاجة إصلاح — كل التشغيلات متوفرة أصلاً من فواتير الشراء");
                setRepairing(false);
                return;
            }

            let failCount = 0;
            for (const u of updates) {
                const { error } = await supabase
                    .from("products")
                    .update({ batches: u.batches })
                    .eq("id", u.id)
                    .eq("pharmacy_id", pharmacyId);
                if (error) failCount++;
            }

            setProducts((prev) =>
                prev.map((x) => {
                    const u = updates.find((uu) => uu.id === x.id);
                    return u ? { ...x, batches: u.batches } : x;
                })
            );

            showToast(
                failCount > 0
                    ? `تم إصلاح ${updates.length - failCount} صنف، وفشل ${failCount} — جرب تاني`
                    : `✓ تم إصلاح تشغيلات ${updates.length} صنف من فواتير الشراء`
            );
        } finally {
            setRepairing(false);
        }
    };

    // 🆕 حماية من الحفظ المكرر (Double-submit): لو الصيدلي ضغط "حفظ الجرد" مرتين بسرعة
    // (شائع على الموبايل وقت تأخر الشبكة)، ده كان بيبني ويبعت سجلين جرد منفصلين بنفس
    // البيانات تقريبًا، وبيطبّق تحديث المخزون مرتين — يعني فرق الجرد بيتضاعف غلط.
    const [savingCount, setSavingCount] = useState(false);

    const saveCount = async () => {
        // 🆕 لو في نداء حفظ شغال بالفعل، بنرفض أي نداء تاني لحد ما يخلص
        if (savingCount) return;
        setSavingCount(true);
        try {
        // 🆕 أي صنف عنده رصيد نظام ولسه في قايمة "لسه ماتجردتش" وقت القفل، يتحسب
        // فرق (نقص) تلقائي = رصيده الحالي كامل، بدل ما يتجاهل أو يفضل زي ما هو.
        const autoZeroRows = notCountedProducts.flatMap((p) => {
            const batches = (p.batches || []).filter((b) => b.qty > 0);
            return batches.length > 0
                ? batches.map((b, idx) => ({
                      id: p.id,
                      lineKey: `${p.id}::auto-zero::${idx}`,
                      name: p.name,
                      category: p.category,
                      expiry: b.expiry_date || "",
                      batchNumber: b.batch_number || null, // 🆕
                      systemQty: b.qty,
                      actualQty: 0,
                      diff: -b.qty,
                      isNew: false,
                      cost: getDefaultLineCost(b.cost ?? p.cost ?? 0, p), // 🆕
                      autoZero: true, // 🆕 لتمييزه في سجل الجرد المحفوظ عن سطر اتعد يدويًا بصفر
                  }))
                : [
                      {
                          id: p.id,
                          lineKey: `${p.id}::auto-zero::0`,
                          name: p.name,
                          category: p.category,
                          expiry: "",
                          batchNumber: null, // 🆕
                          systemQty: p.stock,
                          actualQty: 0,
                          diff: -(p.stock || 0),
                          isNew: false,
                          cost: getDefaultLineCost(p.cost ?? 0, p), // 🆕
                          autoZero: true, // 🆕
                      },
                  ];
        });
        const countItemsFinal = [...countItems, ...autoZeroRows];

        // 🆕 بلوك إجباري: في وضع الرصيد الافتتاحي، مينفعش نحفظ لو فيه ولو صنف واحد
        // تكلفته لسه صفر — لإن ده هيكسر أي تقرير أرباح بعد كده. نفس منطق فاتورة المورد بالظبط.
        if (countMode === "افتتاحي") {
            const zeroCostCount = countItemsFinal.filter((i) => !(+i.cost > 0)).length;
            if (zeroCostCount > 0) {
                showToast(
                    `لازم تدخل تكلفة لكل الأصناف قبل حفظ الرصيد الافتتاحي — لسه ${zeroCostCount} صنف تكلفته صفر`,
                    "error"
                );
                return;
            }
            // 🆕 بلوك إجباري تاني: مينفعش التكلفة المدخلة تتخطى سعر البيع المسجل للصنف —
            // غالبًا غلطة كتابة (رقم زيادة أو فاصلة في مكان غلط) وهتكسر حسابات الربح فورًا.
            const overPriceCount = countItemsFinal.filter((i) => {
                const price = +(productsById.get(i.id)?.price) || 0;
                return price > 0 && +i.cost > price;
            }).length;
            if (overPriceCount > 0) {
                showToast(
                    `مينفعش تحفظ — فيه ${overPriceCount} صنف التكلفة المدخلة فيه أعلى من سعر بيعه (راجع الأسطر المتلونة برتقالي)`,
                    "error"
                );
                return;
            }
        }

        const logData = {
            id: "INV-ADJ-" + Date.now(),
            date: todayLocal(),
            // 🆕 نوع السجل بيعكس نوع الجرد، عشان يبقى واضح في سجل الجرد التاريخي إن ده رصيد
            // افتتاحي مش جرد دوري عادي
            type: countMode === "افتتاحي" ? "رصيد افتتاحي" : "جرد",
            items: countItemsFinal.map((i) => ({
                id: i.id,
                name: i.name,
                expiry: i.expiry || null,
                systemQty: i.systemQty,
                actualQty: i.actualQty,
                diff: i.actualQty - i.systemQty,
                // 🆕 تجميد التكلفة وقت الحفظ — القيمة دي مش هترجع تتغير حتى لو تكلفة
                // الصنف نفسه اتغيّرت بعد كده، عشان القيمة المالية للسجل التاريخي تفضل ثابتة
                cost: i.cost ?? 0,
                // 🆕 هل السطر ده اتحسب تلقائي (الصنف "لسه ماتجردتش" وقت القفل) ولا الصيدلي
                // عده فعليًا بنفسه — عشان يبان واضح في تفاصيل الجرد المحفوظ
                autoZero: !!i.autoZero,
                // 🆕 سبب اختياري لو الصيدلي كتبه لما ظهر فرق في السطر ده (تلف/سرقة/غلطة عد...)
                reason: i.reason || null,
            })),
            notes,
            by: currentUser.name,
            pharmacy_id: pharmacyId,
        };

        // بنجمع كل أسطر تواريخ الصلاحية الخاصة بنفس الصنف عشان نحسب إجمالي الكمية الفعلية له
        // 🆕 وبنجمع كمان "قيمة الفرق" (فرق كل سطر × تكلفة نفس السطر) عشان نقدر نطلع تقييم
        // مالي دقيق للفروقات، حتى لو نفس الصنف عنده تشغيلات بتكاليف مختلفة عن بعض
        const productTotals = {};
        countItemsFinal.forEach((i) => {
            if (!productTotals[i.id]) productTotals[i.id] = { systemQty: 0, actualQty: 0, diffValue: 0 };
            productTotals[i.id].systemQty += +i.systemQty;
            productTotals[i.id].actualQty += +i.actualQty;
            productTotals[i.id].diffValue += (+i.actualQty - +i.systemQty) * (+i.cost || 0);
        });

        const changedProductIds = Object.keys(productTotals).filter(
            (id) => productTotals[id].actualQty !== productTotals[id].systemQty
        );

        // 🆕 تقييم مالي للفروقات: quantity زي ما كان، مع unitCost (تكلفة الوحدة الفعلية
        // المستخدمة في حساب القيمة — بتاخد في الاعتبار اختلاف التكلفة بين تشغيلات نفس
        // الصنف) وvalue (القيمة المالية الكاملة للفرق = كمية × تكلفة، بالسالب لو نقص).
        const adjustments = changedProductIds.map((id) => {
            const quantity = productTotals[id].actualQty - productTotals[id].systemQty;
            const value = productTotals[id].diffValue;
            const unitCost = quantity !== 0 ? value / quantity : 0;
            return {
                inventory_log_id: logData.id,
                product_id: id,
                quantity,
                unit_cost: +unitCost.toFixed(4),
                value: +value.toFixed(2),
                date: logData.date,
                created_by: currentUser.name,
                pharmacy_id: pharmacyId,
            };
        });

        // ✅ بنبني تحديثات المخزون بس للأصناف اللي فعلاً اتغيّرت (changedProductIds) —
        // مش كل الأصناف الظاهرة في الجرد. جرد شامل على مئات الأصناف كان قبل كده هيبعت
        // update لكل صنف حتى لو مفيش فرق فيه، ودي كانت عبء غير ضروري على الشبكة/الـ RPC.
        const productUpdates = changedProductIds.map((id) => {
            const prod = products.find((x) => x.id === id);
            const rows = countItemsFinal.filter((i) => i.id === id && +i.actualQty > 0);

            // 🆕 إصلاح مطابقة التشغيلات: قبل كده كنا بنطابق بس بتاريخ الصلاحية (.find())،
            // وده كان بيرجّع أول تشغيلة لاقيها دايمًا. لو نفس الصنف عنده تشغيلتين بنفس تاريخ
            // الصلاحية بالظبط (شائع لو المورد معندوش رقم تشغيلة مسجل)، كل أسطر الجرد بتاريخ
            // الصلاحية ده كانت بتاخد تكلفة/تاريخ أول تشغيلة بس — فيبقى فيه خلط في البيانات
            // المالية بين تشغيلتين مختلفتين فعليًا. الحل: مفتاح مركب (تاريخ + رقم تشغيلة)،
            // ولو فيه أكتر من تشغيلة أصلية بنفس المفتاح، بنوزّعهم بالترتيب (أول سطر جرد بالمفتاح
            // ده ياخد أول تشغيلة أصلية بنفس المفتاح، والتاني ياخد التانية، وهكذا) بدل ما كلهم
            // ياخدوا نفس التشغيلة.
            const origBatchesByKey = {};
            (prod?.batches || []).forEach((b) => {
                const key = `${b.expiry_date || ""}::${b.batch_number || ""}`;
                (origBatchesByKey[key] ||= []).push(b);
            });
            const usedKeyCount = {};
            const newBatches = rows.map((r) => {
                const key = `${r.expiry || ""}::${r.batchNumber || ""}`;
                const occurrenceIdx = usedKeyCount[key] || 0;
                usedKeyCount[key] = occurrenceIdx + 1;
                const origBatch = (origBatchesByKey[key] || [])[occurrenceIdx];
                return {
                    qty: +r.actualQty,
                    // 🔧 إصلاح بج حرج: التكلفة اللي دخلها الصيدلي في سطر الجرد (r.cost) لها
                    // الأولوية دايمًا — دي المصدر الوحيد الموثوق في الرصيد الافتتاحي (مفيش
                    // origBatch أصلاً)، وأي تعديل يدوي للتكلفة في الجرد الدوري كمان. لو مش
                    // موجودة لأي سبب، نرجع للتشغيلة الأصلية، وبعدين تكلفة الصنف العامة.
                    cost: (+r.cost > 0) ? +r.cost : (origBatch?.cost ?? prod?.cost ?? 0),
                    salePrice: origBatch?.salePrice ?? prod?.price ?? 0,
                    expiry_date: r.expiry || null,
                    batch_number: r.batchNumber || null, // 🆕 نحافظ على رقم التشغيلة في التخزين الجديد
                    date: origBatch?.date || logData.date,
                };
            });
            return {
                id,
                pharmacy_id: pharmacyId,
                stock: productTotals[id].actualQty,
                batches: newBatches,
            };
        });

        // 🆕 كاش محلي فوري — يفضل ظاهر في السجل حتى وانت أوفلاين وبعد إعادة تشغيل البرنامج
        await window.offlineAPI.insertInventoryLogCache(logData);

        // 🆕 event واحد شامل بدل 3 نداءات مباشرة لـ Supabase — بيتنفذ فورًا لو أونلاين،
        // وبيتأجل في الطابور المحلي لو أوفلاين (نفس نمط PURCHASE_INSERT).
        // ✅ pharmacy_id لازم يكون على مستوى الـ event نفسه (مش بس جوه payload) —
        // نفس البج اللي اتصلح قبل كده في SALE_STOCK_BATCH و PURCHASE_INSERT/PURCHASE_STOCK_ADD:
        // لو مش موجود هنا، الـ INSERT في pending_sync_events بيفشل بصمت (NOT NULL constraint).
        const { synced, error } = await queueEvent({
            id: logData.id,
            pharmacy_id: pharmacyId,
            // 🆕 نوع event مختلف للرصيد الافتتاحي — عشان التقارير المالية (أرباح/خسائر)
            // تقدر تستثنيه بسهولة، لإنه نقل رصيد من نظام قديم مش فرق جرد فعلي على مخزون
            // كان شغال بالفعل. لازم executeEvent في offlineAPI.ts يعالج النوع الجديد ده
            // (ممكن يكون نفس منطق INVENTORY_COUNT_SAVE بالظبط، بس باسم مختلف للتصنيف).
            type: countMode === "افتتاحي" ? "INITIAL_STOCK_ENTRY" : "INVENTORY_COUNT_SAVE",
            timestamp: new Date().toISOString(),
            payload: { logData, adjustments, productUpdates },
        });

        if (!synced && error) {
            showToast("❌ خطأ في حفظ الجرد: " + error);
            return;
        }

        logAudit({
            pharmacyId, userName: currentUser?.name, action: "update", entityType: "inventory",
            entityId: logData.id, entityLabel: "جرد مخزون",
            newValue: { itemsCount: logData.items.length, notes },
            description: `تنفيذ جرد مخزون على ${logData.items.length} صنف${notes ? ` — ملاحظات: ${notes}` : ""}`,
        });

        setInventoryLogs((p) => [logData, ...p]);
        setProducts((p) =>
            p.map((x) => {
                const u = productUpdates.find((uu) => uu.id === x.id);
                return u ? { ...x, stock: u.stock, batches: u.batches } : x;
            })
        );

        // 🆕 الجرد اتحفظ فعليًا بنجاح، فمفيش داعي نفضل مسكين الدرافت المحلي بتاعه
        localStorage.removeItem(DRAFT_KEY);

        setShowNew(false);
        setNotes("");
        showToast(synced ? "تم حفظ الجرد وتحديث المخزون ✓" : "تم حفظ الجرد محليًا — هيتزامن أول ما النت يرجع 🔄");
        } finally {
            // 🆕 بيتنفذ دايمًا — سواء الحفظ نجح، أو فشل، أو اترفض بسبب البلوك الإجباري
            // (return المبكرة برضه بتعدي من هنا)، عشان الزرار يرجع شغال تاني
            setSavingCount(false);
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
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>نظام الجرد</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    {canEditSub("fix_stock") && (
                        <Btn
                            variant="ghost"
                            icon="tools"
                            onClick={repairBatchesFromPurchases}
                            disabled={repairing}
                            title="إعادة بناء تشغيلات وتواريخ صلاحية الأصناف من فواتير الشراء المسجلة"
                        >
                            {repairing ? "جارِ الإصلاح..." : "إصلاح تشغيلات المخزون"}
                        </Btn>
                    )}
                    {canAddSub("new_count") && (
                        <>
                            <input
                                ref={invExcelInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                style={{ display: "none" }}
                                onChange={(e) => handleInventoryExcelFile(e.target.files?.[0])}
                            />
                            <Btn
                                variant="ghost"
                                icon="upload"
                                onClick={() => invExcelInputRef.current?.click()}
                                disabled={excelImportBusy}
                                title="ارفع ملف إكسيل فيه عمود باركود/كود وعمود كمية، والبرنامج هيطابقه مع أصنافك ويعبّي الجرد تلقائيًا"
                            >
                                {excelImportBusy ? "جارٍ الاستيراد..." : "📥 استيراد جرد من إكسيل"}
                            </Btn>
                            {/* 🆕 رصيد افتتاحي: أول مرة الصيدلية بتدخل رصيدها في البرنامج —
                                بيطلب تكلفة كل صنف (بلوك إجباري لو فيه سطر تكلفته صفر). نسب الخصم
                                الافتراضية لكل فئة بتتضبط من شاشة "بيانات الصيدلية" مش من هنا. */}
                            <Btn
                                icon="count"
                                onClick={() => startCount("افتتاحي")}
                                title="أول مرة بتدخل رصيد الصيدلية في البرنامج — بيطلب تكلفة كل صنف"
                            >
                                رصيد افتتاحي
                            </Btn>
                            {/* الجرد الدوري العادي — نفس السلوك القديم تمامًا، من غير تكلفة ولا بلوك */}
                            <Btn icon="count" onClick={() => startCount("دوري")}>
                                بدء جرد دوري
                            </Btn>
                        </>
                    )}
                </div>
            </div>

            <Table
                headers={["رقم الجرد", "التاريخ", "بواسطة", "ملاحظات", "الفروقات"]}
                rows={inventoryLogs.map((l) => [
                    // ✅ رقم الجرد قابل للضغط
                    <span
                        style={{
                            color: COLORS.blue,
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                        }}
                        onClick={() => setSelectedLog(l)}
                    >
                        {l.id}
                    </span>,
                    l.date,
                    l.by,
                    l.notes || "-",
                    <span
                        style={{
                            color: l.items.some((i) => i.diff !== 0) ? COLORS.gold : COLORS.green,
                        }}
                    >
                        {l.items.filter((i) => i.diff !== 0).length} صنف مختلف
                    </span>,
                ])}
            />

            {/* ✅ Modal عرض تفاصيل الجرد */}
            <Modal
                open={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title={`تفاصيل الجرد - ${selectedLog?.id}`}
                wide
            >
                {selectedLog && (
                    <div>
                        <div
                            style={{
                                display: "flex",
                                gap: 24,
                                marginBottom: 16,
                                color: COLORS.textDim,
                                fontSize: 13,
                            }}
                        >
                            <span>📅 {selectedLog.date}</span>
                            <span>👤 {selectedLog.by}</span>
                            {selectedLog.notes && <span>📝 {selectedLog.notes}</span>}
                        </div>
                        <div
                            style={{
                                overflowX: "auto",
                                maxHeight: "55vh",
                                overflowY: "auto",
                            }}
                        >
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr
                                        style={{
                                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                            position: "sticky",
                                            top: 0,
                                        }}
                                    >
                                        {["الصنف", "تاريخ الصلاحية", "كمية النظام", "الكمية الفعلية", "الفرق"].map(
                                            (h) => (
                                                <th
                                                    key={h}
                                                    style={{
                                                        padding: "9px 14px",
                                                        textAlign: "right",
                                                        color: COLORS.textDim,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {h}
                                                </th>
                                            )
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedLog.items.map((item, i) => {
                                        const changed = item.diff !== 0;
                                        return (
                                            <tr
                                                key={`${item.id}-${i}`}
                                                style={{
                                                    borderBottom: `1px solid ${COLORS.border}`,
                                                    // ✅ الأصناف المتغيرة بخلفية مميزة
                                                    background: changed
                                                        ? item.diff < 0
                                                            ? "rgba(255,100,100,0.08)"
                                                            : "rgba(68,221,136,0.08)"
                                                        : i % 2 === 0
                                                            ? "transparent"
                                                            : COLORS.surfaceAlt,
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding: "8px 14px",
                                                        fontSize: 13,
                                                        color: changed ? COLORS.textPrimary : COLORS.textDim,
                                                        fontWeight: changed ? 700 : 400,
                                                    }}
                                                >
                                                    {item.name}
                                                    {changed && (
                                                        <span
                                                            style={{
                                                                marginRight: 8,
                                                                fontSize: 11,
                                                                color: item.diff < 0 ? COLORS.red : COLORS.green,
                                                            }}
                                                        >
                                                            {item.diff < 0 ? "▼ نقص" : "▲ زيادة"}
                                                        </span>
                                                    )}
                                                    {/* 🆕 الصنف ده معملوش سكان/إضافة يدوية وقت الجرد — الفرق اتحسب تلقائي
                                                        وقت القفل، مش عدّ فعلي من الصيدلي، فمهم يبان الفرق ده واضح */}
                                                    {item.autoZero && (
                                                        <span style={{ marginRight: 8, fontSize: 11, color: COLORS.gold }}>
                                                            ⏳ لم يُجرد (تصفير تلقائي)
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "8px 14px", color: COLORS.textDim, fontSize: 12 }}>
                                                    {item.expiry || "-"}
                                                </td>
                                                <td style={{ padding: "8px 14px", color: COLORS.textDim }}>
                                                    {item.systemQty}
                                                </td>
                                                <td style={{ padding: "8px 14px", color: COLORS.textPrimary }}>
                                                    {item.actualQty}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "8px 14px",
                                                        fontWeight: 700,
                                                        color:
                                                            item.diff < 0
                                                                ? COLORS.red
                                                                : item.diff > 0
                                                                    ? COLORS.green
                                                                    : COLORS.textDim,
                                                    }}
                                                >
                                                    {item.diff > 0 ? "+" : ""}
                                                    {item.diff}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: 12, textAlign: "left" }}>
                            <Btn variant="ghost" onClick={() => setSelectedLog(null)}>
                                إغلاق
                            </Btn>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal الجرد الجديد - بدون تغيير */}
            <Modal
                open={showNew}
                onClose={() => setShowNew(false)}
                title="جرد المخزون الجديد"
                wide
            >
                <Input
                    label="ملاحظات الجرد"
                    value={notes}
                    onChange={setNotes}
                    placeholder="وصف الجرد..."
                />
                {excelUnmatched.length > 0 && (
                    <div
                        style={{
                            background: "rgba(255,170,0,0.08)",
                            border: `1px solid ${COLORS.gold}`,
                            borderRadius: 8,
                            padding: "10px 12px",
                            marginTop: 12,
                            fontSize: 12.5,
                            color: COLORS.textPrimary,
                        }}
                    >
                        <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.gold }}>
                            ⚠️ {excelUnmatched.length} كود من الملف مش موجود عندك في الأصناف (اتجاهله ولم يتحدث):
                        </div>
                        <div style={{ maxHeight: 120, overflowY: "auto" }}>
                            {excelUnmatched.map((u, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: COLORS.textDim }}>
                                    <span>{u.rawCode}</span>
                                    <span>الكمية: {u.qty}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 6, color: COLORS.textDim }}>
                            ضيف الصنف الأول من شاشة "الأصناف" بنفس الباركود، وبعدين استورد الملف تاني.
                        </div>
                    </div>
                )}
                {/* 🆕 حقل السكانر — بيدخل تلقائي من غير Enter: السكانر بيكتب كل حروف
                    الباركود خلال أجزاء من الثانية، فبمجرد ما الكتابة توقف لفترة قصيرة
                    (200ms) بنعتبرها نهاية السكان ونعالجها فورًا. Enter لسه شغال كبديل يدوي. */}
                <input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={(e) => {
                        const val = e.target.value;
                        setScanInput(val);
                        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                        scanTimeoutRef.current = setTimeout(() => {
                            if (val.trim()) handleScanBarcode(val.trim());
                        }, 200);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && scanInput.trim()) {
                            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                            handleScanBarcode(scanInput.trim());
                        }
                    }}
                    placeholder="📷 امسح الباركود هنا..."
                    autoFocus
                    style={{
                        width: "100%",
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 8,
                        padding: "9px 12px",
                        color: COLORS.textPrimary,
                        fontSize: 14,
                        outline: "none",
                        boxSizing: "border-box",
                        marginTop: 12,
                        marginBottom: 8,
                    }}
                />
                {/* 🆕 بار البحث بالاسم — بديل للسكانر، بيقترح الأصناف المطابقة وبتضاف بالضغط عليها */}
                <div style={{ position: "relative", marginBottom: 12, display: "flex", gap: 8 }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 أو ابحث بالاسم وضيف الصنف يدويًا..."
                        style={{
                            flex: 1,
                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 8,
                            padding: "9px 12px",
                            color: COLORS.textPrimary,
                            fontSize: 14,
                            outline: "none",
                            boxSizing: "border-box",
                        }}
                    />
                    {/* 🆕 صنف جديد تمامًا (مش عن طريق باركود مرفوض) — لصنف موجود فعليًا
                        على الرف ومعندوش تسجيل في النظام خالص */}
                    <Btn variant="ghost" onClick={() => setShowAddProductModal(true)}>➕ صنف جديد</Btn>
                    {search.trim() && (
                        <div
                            style={{
                                position: "absolute", zIndex: 5, top: "100%", right: 0, left: 0,
                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 4,
                                maxHeight: 220, overflowY: "auto",
                            }}
                        >
                            {products
                                .filter((p) => {
                                    const searchLower = search.toLowerCase();
                                    const name = (p.nameAr || p.name || "").toLowerCase();
                                    const nameEn = (p.nameEn || p.name_en || "").toLowerCase();
                                    return (
                                        (name.includes(searchLower) || nameEn.includes(searchLower)) &&
                                        !countItems.some((r) => r.id === p.id)
                                    );
                                })
                                .slice(0, 20)
                                .map((p) => (
                                    <div
                                        key={p.id}
                                        onClick={() => addProductToCount(p)}
                                        style={{
                                            padding: "8px 12px", cursor: "pointer", fontSize: 13,
                                            color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}`,
                                        }}
                                    >
                                        {p.nameAr || p.name}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
                {notCountedProducts.length > 0 && (
                    <div
                        style={{
                            background: "rgba(255,170,0,0.08)", border: `1px solid ${COLORS.gold}`,
                            borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12.5,
                        }}
                    >
                        <div style={{ fontWeight: 700, color: COLORS.gold, marginBottom: 4 }}>
                            ⏳ {notCountedProducts.length} صنف لسه ماتجردتش — لو قفلت الجرد كده هيتحسبوا نقص كامل
                        </div>
                    </div>
                )}
                <div
                    style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}
                >
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", position: "sticky", top: 0 }}>
                                {[
                                    "#", // 🆕 رقم السطر
                                    "الصنف",
                                    "الفئة",
                                    "تاريخ الصلاحية",
                                    "التشغيلة", // 🆕 رقم الباتش/التشغيلة كعمود منفصل وواضح
                                    ...(countMode === "افتتاحي" ? ["التكلفة"] : []), // 🆕
                                    "الكمية الفعلية",
                                    ...(countMode === "دوري" ? ["سبب الفرق (اختياري)"] : []), // 🆕 يظهر بس في الجرد الدوري
                                    "",
                                ].map((h, hIdx) => (
                                    <th
                                        key={`${h}-${hIdx}`}
                                        style={{
                                            padding: "9px 14px",
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
                            {countItems.map((item, i) => (
                                <tr
                                    key={item.lineKey}
                                    style={{
                                        borderBottom: `1px solid ${COLORS.border}`,
                                        background: item.scanMatched
                                            ? "rgba(68,221,136,0.14)"
                                            : item.isNew
                                            ? "rgba(68,221,136,0.06)"
                                            : i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                                    }}
                                >
                                    {/* 🆕 رقم السطر — ترقيم بسيط حسب ترتيب الإضافة، بدون أي أثر على منطق الجرد */}
                                    <td style={{ padding: "8px 14px", color: COLORS.textDim, fontSize: 12 }}>
                                        {i + 1}
                                    </td>
                                    <td
                                        style={{
                                            padding: "8px 14px",
                                            fontSize: 13,
                                            color: COLORS.textPrimary,
                                        }}
                                    >
                                        {item.name}
                                        {/* 🆕 تحذير بصري خفيف — بيظهر بس في الجرد الدوري (مش الافتتاحي، عشان
                                            مفيش تكرار مع عمود التكلفة اللي ظاهر أصلاً هناك) لما الصنف تكلفته
                                            صفر، مع زرار Inline يعدّل تكلفة الصنف نفسه من غير ما يقفل شاشة الجرد */}
                                        {countMode === "دوري" && !(+item.cost > 0) && (
                                            editingCostFor === item.lineKey ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 8 }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        autoFocus
                                                        value={editingCostValue}
                                                        onChange={(e) => setEditingCostValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                const product = products.find((p) => p.id === item.id);
                                                                if (product) updateProductCostInline(product, editingCostValue);
                                                            }
                                                            if (e.key === "Escape") {
                                                                setEditingCostFor(null);
                                                                setEditingCostValue("");
                                                            }
                                                        }}
                                                        style={{
                                                            width: 60, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.gold}`,
                                                            borderRadius: 6, padding: "3px 6px", color: COLORS.textPrimary,
                                                            fontSize: 12, outline: "none",
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const product = products.find((p) => p.id === item.id);
                                                            if (product) updateProductCostInline(product, editingCostValue);
                                                        }}
                                                        title="حفظ التكلفة"
                                                        style={{
                                                            border: "none", background: "none", color: COLORS.green,
                                                            cursor: "pointer", fontWeight: 700, fontSize: 13,
                                                        }}
                                                    >✓</button>
                                                </span>
                                            ) : (
                                                <span
                                                    onClick={() => {
                                                        setEditingCostFor(item.lineKey);
                                                        setEditingCostValue("");
                                                    }}
                                                    title="الصنف ده تكلفته صفر في النظام — اضغط للتعديل بسرعة من غير ما تقفل الجرد"
                                                    style={{
                                                        marginRight: 8, fontSize: 11, color: COLORS.gold,
                                                        cursor: "pointer", textDecoration: "underline",
                                                    }}
                                                >
                                                    ⚠️ عدّل التكلفة
                                                </span>
                                            )
                                        )}
                                    </td>
                                    <td style={{ padding: "8px 14px" }}>
                                        <Badge>{item.category}</Badge>
                                    </td>
                                    <td style={{ padding: "8px 14px" }}>
                                        <input
                                            type="month"
                                            value={item.expiry || ""}
                                            onChange={(e) =>
                                                setCountItems((p) =>
                                                    p.map((x) =>
                                                        x.lineKey === item.lineKey
                                                            ? { ...x, expiry: e.target.value }
                                                            : x
                                                    )
                                                )
                                            }
                                            style={{
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${COLORS.border}`,
                                                borderRadius: 6,
                                                padding: "5px 8px",
                                                color: item.expiry ? COLORS.textPrimary : COLORS.textDim,
                                                fontSize: 12,
                                                outline: "none",
                                                colorScheme: "dark",
                                            }}
                                        />
                                        {item.scanMatched && (
                                            <span style={{ marginRight: 6, fontSize: 11, color: COLORS.green }}>
                                                ✓ نفس تشغيلة الباركود
                                            </span>
                                        )}
                                    </td>
                                    {/* 🆕 عمود التشغيلة — رقم الباتش نفسه، بدل ما يفضل مخفي وراء علامة
                                        "نفس تشغيلة الباركود" بس تحت تاريخ الصلاحية */}
                                    <td style={{ padding: "8px 14px", fontSize: 12.5, color: item.batchNumber ? COLORS.textPrimary : COLORS.textDim }}>
                                        {item.batchNumber || "—"}
                                    </td>
                                    {/* 🆕 عمود التكلفة — يظهر بس في وضع "رصيد افتتاحي"؛ لو صفر بيتلوّن
                                        أحمر كتنبيه بصري إن السطر ده لسه محتاج تكلفة قبل الحفظ (البلوك
                                        الإجباري بيرفض الحفظ لحد ما كل الأسطر تتظبط). لو التكلفة أعلى من
                                        سعر البيع (على الأغلب غلطة كتابة زي رقم زيادة أو فاصلة في مكان
                                        غلط) بتتلوّن برتقالي كتحذير بس من غير ما توقف الحفظ. */}
                                    {countMode === "افتتاحي" && (() => {
                                        const salePrice = +(productsById.get(item.id)?.price) || 0;
                                        const costTooHigh = +item.cost > 0 && salePrice > 0 && +item.cost > salePrice;
                                        return (
                                        <td style={{ padding: "8px 14px" }}>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.cost ?? 0}
                                                onChange={(e) =>
                                                    setCountItems((p) =>
                                                        p.map((x) =>
                                                            x.lineKey === item.lineKey
                                                                ? { ...x, cost: +e.target.value }
                                                                : x
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 70,
                                                    background: (+item.cost > 0) ? (costTooHigh ? "rgba(255,165,0,0.12)" : COLORS.surfaceAlt) : "rgba(255,68,68,0.1)",
                                                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${(+item.cost > 0) ? (costTooHigh ? "orange" : COLORS.border) : COLORS.red}`,
                                                    borderRadius: 6,
                                                    padding: "5px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 13,
                                                    outline: "none",
                                                }}
                                            />
                                            {costTooHigh && (
                                                <span title={`سعر البيع المسجل: ${salePrice}`} style={{ marginRight: 6, fontSize: 11, color: "orange" }}>
                                                    ⚠️ أعلى من سعر البيع
                                                </span>
                                            )}
                                        </td>
                                        );
                                    })()}
                                    <td style={{ padding: "8px 14px" }}>
                                        <input
                                            type="number"
                                            min="0"
                                            data-linekey={item.lineKey}
                                            value={item.actualQty}
                                            onChange={(e) =>
                                                setCountItems((p) =>
                                                    p.map((x) =>
                                                        x.lineKey === item.lineKey
                                                            ? {
                                                                ...x,
                                                                actualQty: +e.target.value,
                                                                diff: +e.target.value - x.systemQty,
                                                            }
                                                            : x
                                                    )
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                // 🆕 Enter في خانة الكمية → رجوع فوري لخانة السكانر، عشان
                                                // متحتاجش تدوس بالماوس في كل مرة أثناء الجرد بالسكانر
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    scanInputRef.current?.focus();
                                                }
                                            }}
                                            style={{
                                                width: 70,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${COLORS.border}`,
                                                borderRadius: 6,
                                                padding: "5px 8px",
                                                color: COLORS.textPrimary,
                                                fontSize: 13,
                                                outline: "none",
                                            }}
                                        />
                                    </td>
                                    {/* 🆕 سبب الفرق — اختياري، يظهر بس في الجرد الدوري (مش الرصيد الافتتاحي
                                        أصلاً مفيش "فرق" حقيقي فيه يستاهل توثيق سبب)، وبيتفعّل بس لو فعلاً
                                        في فرق (actualQty ≠ systemQty). بدون أي اقتراح لسبب — صعب معرفته
                                        فعليًا لأي صنف، فمفيش داعي نوحي بسبب معيّن. */}
                                    {countMode === "دوري" && (
                                        <td style={{ padding: "8px 14px" }}>
                                            <input
                                                type="text"
                                                value={item.reason || ""}
                                                disabled={+item.actualQty === +item.systemQty}
                                                onChange={(e) =>
                                                    setCountItems((p) =>
                                                        p.map((x) =>
                                                            x.lineKey === item.lineKey
                                                                ? { ...x, reason: e.target.value }
                                                                : x
                                                        )
                                                    )
                                                }
                                                style={{
                                                    width: 140,
                                                    background: (+item.actualQty === +item.systemQty) ? "transparent" : COLORS.surfaceAlt,
                                                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${COLORS.border}`,
                                                    borderRadius: 6,
                                                    padding: "5px 8px",
                                                    color: COLORS.textPrimary,
                                                    fontSize: 12,
                                                    outline: "none",
                                                }}
                                            />
                                        </td>
                                    )}
                                    <td style={{ padding: "8px 14px", display: "flex", gap: 4 }}>
                                        <button
                                            onClick={() => addExtraExpiryLine(item)}
                                            title="أضف تاريخ صلاحية إضافي لنفس الصنف (لو لقيت كمية على الرف بتاريخ مختلف)"
                                            style={{
                                                width: 24, height: 24, borderRadius: 6,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${COLORS.border}`, color: COLORS.green,
                                                cursor: "pointer", fontWeight: 700, fontSize: 13,
                                            }}
                                        >+</button>
                                        <button
                                            onClick={() => removeCountLine(item.lineKey)}
                                            title="احذف السطر ده بس"
                                            style={{
                                                width: 24, height: 24, borderRadius: 6,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${COLORS.border}`, color: COLORS.red,
                                                cursor: "pointer", fontWeight: 700, fontSize: 13,
                                            }}
                                        >−</button>
                                        <button
                                            onClick={() => removeProductFromCount(item.id)}
                                            title="احذف الصنف كامل من الجرد (ضربته بالغلط بالسكانر)"
                                            style={{
                                                width: 24, height: 24, borderRadius: 6,
                                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                border: `1px solid ${COLORS.border}`, color: COLORS.red,
                                                cursor: "pointer", fontWeight: 700, fontSize: 11,
                                            }}
                                        >🗑</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* 🆕 ملخص محاسبي سريع لمراجعة الجرد قبل الحفظ — بيعكس بس الأسطر الداخلة
                    فعليًا دلوقتي (مش الأصناف "لسه ماتجردتش")، شغال في الوضعين بنفس المنطق */}
                <div
                    style={{
                        display: "flex", flexWrap: "wrap", gap: 16, background: COLORS.surfaceAlt,
                        border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px",
                        marginTop: 12, fontSize: 12.5, color: COLORS.textPrimary,
                    }}
                >
                    <span>عدد السطور: <b>{countSummary.lineCount}</b></span>
                    <span>عدد الأصناف: <b>{countSummary.productCount}</b></span>
                    <span>إجمالي الكمية: <b>{countSummary.totalQty}</b></span>
                    <span>إجمالي سعر البيع: <b>{countSummary.totalSale.toFixed(2)}</b></span>
                    <span>إجمالي التكلفة: <b>{countSummary.totalCost.toFixed(2)}</b></span>
                    <span>إجمالي الضريبة: <b>{countSummary.totalTax.toFixed(2)}</b></span>
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 16,
                        justifyContent: "flex-end",
                    }}
                >
                    <Btn variant="ghost" onClick={() => setShowNew(false)}>
                        إلغاء
                    </Btn>
                    <Btn icon="check" onClick={saveCount} disabled={savingCount}>
                        {savingCount ? "جارِ الحفظ..." : "حفظ الجرد وتحديث المخزون"}
                    </Btn>
                </div>
            </Modal>

            {/* 🆕 Modal تحديد عمود الباركود/الكود وعمود الكمية لما الاكتشاف التلقائي يفشل */}
            <Modal
                open={showInvColMapModal}
                onClose={() => setShowInvColMapModal(false)}
                title="حدد أعمدة ملف الجرد"
            >
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
                    مقدرناش نكتشف الأعمدة تلقائيًا. حدد تحت عمود الباركود/الكود وعمود الكمية الفعلية من ملفك:
                </div>
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>عمود الباركود / الكود</div>
                    <select
                        value={invColMapDraft.code}
                        onChange={(e) => setInvColMapDraft((p) => ({ ...p, code: e.target.value }))}
                        style={{
                            width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                            borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13,
                        }}
                    >
                        <option value="">— اختر العمود —</option>
                        {pendingInvRows && Object.keys(pendingInvRows[0] || {}).map((k) => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>عمود الكمية الفعلية</div>
                    <select
                        value={invColMapDraft.qty}
                        onChange={(e) => setInvColMapDraft((p) => ({ ...p, qty: e.target.value }))}
                        style={{
                            width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                            borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13,
                        }}
                    >
                        <option value="">— اختر العمود —</option>
                        {pendingInvRows && Object.keys(pendingInvRows[0] || {}).map((k) => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <Btn variant="ghost" onClick={() => setShowInvColMapModal(false)}>إلغاء</Btn>
                    <Btn icon="check" onClick={confirmInvColumnMapping}>تأكيد ومتابعة</Btn>
                </div>
            </Modal>

            {/* 🆕 Modal ربط باركود جديد/متغير بصنف موجود — بيتفتح لما السكانر يلاقي
                باركود مش مسجل عندك، بدل ما يرفضه بس */}
            <Modal
                open={showLinkBarcodeModal}
                onClose={() => setShowLinkBarcodeModal(false)}
                title="الباركود ده مش موجود عندك"
            >
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
                    الكود: <b style={{ color: COLORS.textPrimary }}>{unmatchedBarcode}</b> — لو الصنف ده موجود
                    عندك فعليًا بباركود قديم مختلف، دوّر عليه واربطه بالكود الجديد ده:
                </div>
                <Input
                    value={linkSearch}
                    onChange={setLinkSearch}
                    placeholder="🔍 ابحث بالاسم..."
                    autoFocus
                />
                <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8 }}>
                    {products
                        .filter((p) => {
                            if (!linkSearch.trim()) return false;
                            const q = linkSearch.toLowerCase();
                            const name = (p.nameAr || p.name || "").toLowerCase();
                            const nameEn = (p.nameEn || p.name_en || "").toLowerCase();
                            return name.includes(q) || nameEn.includes(q);
                        })
                        .slice(0, 20)
                        .map((p) => (
                            <div
                                key={p.id}
                                onClick={() => linkBarcodeToProduct(p)}
                                style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    color: COLORS.textPrimary,
                                    borderBottom: `1px solid ${COLORS.border}`,
                                }}
                            >
                                {p.nameAr || p.name}
                                {p.barcode && (
                                    <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 8 }}>
                                        (الباركود الحالي: {p.barcode})
                                    </span>
                                )}
                            </div>
                        ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                    <Btn variant="ghost" onClick={() => setShowLinkBarcodeModal(false)}>إلغاء</Btn>
                    <Btn
                        variant="ghost"
                        onClick={() => {
                            setShowLinkBarcodeModal(false);
                            setShowAddProductModal(true);
                        }}
                    >
                        مش لاقيه؟ ضيفه كصنف جديد
                    </Btn>
                </div>
            </Modal>

            {/* 🆕 فورم إضافة صنف جديد من نفس شاشة الجرد — نفس الفورم الموحّد المستخدم
                في شاشة الأصناف وفاتورة الشراء. لو جاي من مسار "الباركود مش موجود"،
                الباركود بييجي متعبي جاهز في الفورم (prefillBarcode). بعد الحفظ، الصنف
                الجديد بيتضاف تلقائيًا لسطر الجرد الحالي عشان الاستمرارية تفضل من غير
                ما الصيدلي يقطع الجرد. */}
            <ProductFormModal
                open={showAddProductModal}
                onClose={() => setShowAddProductModal(false)}
                editingId={null}
                products={products}
                setProducts={setProducts}
                showToast={showToast}
                pharmacyId={pharmacyId}
                currentUser={currentUser}
                prefillBarcode={unmatchedBarcode}
                onSaved={(savedProduct) => {
                    setShowAddProductModal(false);
                    addProductToCount(savedProduct);
                    setUnmatchedBarcode("");
                }}
            />
        </div>
    );
}
