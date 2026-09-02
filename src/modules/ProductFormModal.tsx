import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { logAudit } from "../lib/auditLog";
import { isGS1Formatted, parseGS1Barcode } from "../lib/barcodeUtils";
import { nameSimilarity } from "../lib/dateUtils";
import { MAIN_CATEGORIES, NON_DRUG_SIZE_UNITS, NON_DRUG_SIZE_UNITS_EN, NON_DRUG_TYPES_EN, PACKAGE_TYPES, SUPPLY_CATEGORIES, buildNonDrugName, buildNonDrugNameEn } from "../lib/productConstants";
import { detectSupplierOfferPattern } from "../lib/promoUtils";
import { Btn, Input, Modal, Select } from "../ui/primitives";
import { saveProduct, replaceProductBarcodes, replaceProductAltBarcodes, replaceProductIngredients, addItemType, addSubCategory2, deleteItemType, deleteSubCategory2, addSizeUnit, deleteSizeUnit } from "../lib/offlineAPI";

// ═══════════════════════════════════════════════════════════════════════
// 🆕 ProductFormModal — نافذة موحّدة لإضافة/تعديل صنف، قابلة للاستخدام من
// أي مكان (شاشة الأصناف، أو فوق فاتورة الشراء بدون إغلاقها)
// ═══════════════════════════════════════════════════════════════════════

// 🆕 قيمة sentinel لخيار "إضافة نوع جديد" جوه Select النوع — لو المستخدم اختارها
// بنفتح prompt بدل ما نحفظها كقيمة فعلية لخانة النوع.
const ADD_NEW_SUB2 = "➕ إضافة شكل صيدلاني جديد...";
const ADD_NEW_UNIT = "➕ إضافة وحدة جديدة...";

export function ProductFormModal({
    open,
    onClose,
    editingId,          // id الصنف المراد تعديله، أو null للإضافة
    products,
    setProducts,
    showToast,
    pharmacyId,
    currentUser,
    onSaved,             // (savedProduct) => void — يُستدعى بعد الحفظ بنجاح
    onRequestAddManufacturer, // اختياري: فتح شاشة إدارة الشركات المنتجة الكاملة
    pendingManufacturer, // 🆕 {id, name, ts} — بيوصل من الأب لما يتم إضافة شركة جديدة من جوه فورم الصنف نفسه، عشان نختارها تلقائيًا بدل ما "تضيع"
    prefillName = "",    // 🆕 اسم مبدئي يتحط في الفورم (مثلاً من صف فاتورة مورد لسه محتاج يتربط بصنف)
    prefillBarcode = "", // 🆕 باركود مبدئي يتحط في خانة GTIN (مثلاً من شاشة الجرد لما السكانر يلاقي باركود مش مسجل)
    jokerPendingItems = [],       // 🆕 أصناف الجوكر المعلقة — لاقتراح ربطها بالصنف الجديد
    setJokerPendingItems = () => { },
    suppliers = [],       // 🆕 لازم لعرض قائمة الموردين المرشحين لفئة التوريد بتاعة الصنف
}) {
    const [manufacturers, setManufacturers] = useState([]);
    const [itemTypes, setItemTypes] = useState([]); // 🆕 أنواع الأصناف الغير دوائية — ديناميكية بدل hardcoded
    const [subCategories2, setSubCategories2] = useState([]);
    const [sizeUnits, setSizeUnits] = useState([]); // 🆕 وحدات الحجم/الوزن — ديناميكية بدل NON_DRUG_SIZE_UNITS الثابتة
    const [showUnitPrompt, setShowUnitPrompt] = useState(false);
    const [unitPromptValue, setUnitPromptValue] = useState("");
    const [unitPromptValueEn, setUnitPromptValueEn] = useState("");
    const [showSubCat2Prompt, setShowSubCat2Prompt] = useState(false);
    const [subCat2PromptValue, setSubCat2PromptValue] = useState("");
    const [subCat2PromptValueEn, setSubCat2PromptValueEn] = useState("");
    const [showManageModal, setShowManageModal] = useState(null); // "itemType" | "subCat2" | null
    const [showItemTypeDropdown, setShowItemTypeDropdown] = useState(false); // 🆕 دروب داون بحث النوع
    const [allIngredients, setAllIngredients] = useState([]);
    const [ingredientSearch, setIngredientSearch] = useState("");
    const [similarSearch, setSimilarSearch] = useState("");
    const [similarProductId, setSimilarProductId] = useState("");
    const [showSimilarDropdown, setShowSimilarDropdown] = useState(false);
    const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [barcodes, setBarcodes] = useState([]);
    const [altBarcodes, setAltBarcodes] = useState([]); // 🆕 باركودات بسيطة بديلة لنفس الصنف (مش دفعات GS1)
    // 🆕 اقتراح ربط الصنف الجديد بصنف جوكر قديم قريب منه في الاسم
    const [jokerLinkChoice, setJokerLinkChoice] = useState(null); // id الجوكر اللي المستخدم وافق يربطه، أو null
    const [dismissedJokerSuggestion, setDismissedJokerSuggestion] = useState(false);

    const blank = {
        id: "", nameAr: "", nameEn: "",
        gtin: "", // 🆕 GTIN ثابت للصنف — مصدره الوحيد products.barcode، بيتحمّل مع باقي الفورم مباشرة (مش عن طريق استعلام منفصل)
        mainCategory: "دواء", subCategory1: "مستورد", subCategory2: "أقراص",
        packageType: "", saleUnits: "",
        price: "", cost: "", taxable: true,
        minStock: "", maxStock: "",
        isEssential: false, isChronic: false,
        supply_category: "",
        // 🆕 موردين محددين مربوطين بالصنف صراحة (اختياري) — فاضية يعني "أي مورد في نفس الفئة"،
        // مفيدة لصنف بيوره مورد واحد بعينه رغم إن الفئة عندها موردين تانيين
        linkedSupplierIds: [],
        manufacturer_id: "",
        notAvailableMarket: false,
        shortageReportUrl: "",
        // 🆕 حقول التسمية الموحّدة للأصناف الغير دوائية (كوزمتك/مستلزمات/إلخ)
        brandName: "", brandNameEn: "", itemType: "", sizeValue: "", sizeUnit: "مل",
        variant: "", // 🆕 تمييز الصنف (مثلاً "لتساقط الشعر") — بيتضاف آخر الاسم بعد الحجم/الوحدة
        variantEn: "", // 🆕 نفس التمييز بس بالإنجليزي — الجزء الوحيد اللي محتاج ترجمة يدوية لأنه نص حر
        searchKeywords: "", // 🆕 مرادفات/كلمات بحث إضافية (مفصولة بفواصل) — بتساعد البحث من غير ما تأثر على الاسم المعروض
        linkedProductId: "", // 🆕 لو الصنف ده كارت عرض منفصل من المورد (مثلاً "Closeup 3+1")، ده id الصنف الأصلي (Closeup 75ml العادي)
        // 🆕 هل الصنف ده يدخل في حساب طلبات الشراء التلقائية؟ افتراضيًا false للأصناف الجديدة —
        // عشان تقدر تبني قاعدة بيانات الأصناف من غير ما كل صنف يظهر في طلب شراء فورًا.
        // بيتفعّل تلقائيًا أول ما الصنف يدخل فاتورة شراء حقيقية.
        autoOrder: false,
    };
    const [form, setForm] = useState(blank);
    const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    // 🆕 نبّهني إن اسم الصنف اللي بيتكتب دلوقتي شكله عرض من المورد (مش صنف منفصل حقيقي)
    const offerPattern = useMemo(() => detectSupplierOfferPattern(form.nameAr), [form.nameAr]);
    const [offerNudgeDismissed, setOfferNudgeDismissed] = useState(false);
    // 🆕 لو الاسم اللي بيتكتب دلوقتي (وإحنا بنضيف صنف جديد) قريب من اسم صنف جوكر معلّق قديم، نقترح ربطهم
    const jokerSuggestionMatch = useMemo(() => {
        if (editingId || dismissedJokerSuggestion || jokerLinkChoice) return null;
        const name = (form.nameAr || "").trim();
        if (name.length < 3) return null;
        // 🆕 لازم الفئة الرئيسية تتطابق كمان (مش بس تشابه الاسم) — بيمنع اقتراحات غلط زي
        // ربط "بندول" بجوكر "بندول اكسترا" لو كانا مسجلين بفئتين مختلفتين
        const candidates = (jokerPendingItems || []).filter((j) => j.status !== "linked" && (j.category || null) === (form.mainCategory || null));
        let best = null, bestScore = 0;
        candidates.forEach((j) => {
            const score = nameSimilarity(name, j.name || "");
            if (score > bestScore) { bestScore = score; best = j; }
        });
        return bestScore >= 0.55 ? best : null;
    }, [form.nameAr, form.mainCategory, editingId, dismissedJokerSuggestion, jokerLinkChoice, jokerPendingItems]);
    const [offerLinkSearch, setOfferLinkSearch] = useState("");
    const [showOfferLinkDropdown, setShowOfferLinkDropdown] = useState(false);
    const linkedProduct = useMemo(
        () => products.find((p) => p.id === form.linkedProductId) || null,
        [products, form.linkedProductId]
    );
    const offerLinkResults = useMemo(() => {
        if (!offerLinkSearch.trim()) return [];
        const q = offerLinkSearch.trim();
        return products
            .filter((p) => p.id !== editingId && (p.name_ar || p.name || "").includes(q))
            .slice(0, 8);
    }, [products, offerLinkSearch, editingId]);

    // 🆕 خاصية "استرجاع مسودة الصنف" اتشالت بناءً على طلب المستخدم.

    // 🆕 لما نضيف شركة منتجة جديدة من جوه فورم الصنف (نافذة "إدارة الشركات" اللي بتفتح فوقه)،
    // الأب بيبعتها هنا بمجرد ما تتحفظ — نضيفها لقائمتنا المحلية ونختارها تلقائيًا،
    // بدل ما الكاشير يضطر يدور عليها تاني في القائمة المنسدلة.
    useEffect(() => {
        if (!pendingManufacturer?.id) return;
        setManufacturers((prev) =>
            prev.some((m) => m.id === pendingManufacturer.id) ? prev : [...prev, pendingManufacturer].sort((a, b) => a.name.localeCompare(b.name))
        );
        F("manufacturer_id", pendingManufacturer.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingManufacturer?.id, pendingManufacturer?.ts]);

    // 🆕 الأصناف الغير دوائية بتتسمى تلقائيًا من [البراند - النوع - الحجم/الوزن]
    // بدل خانة الاسم الحرة، عشان يبقى في وحدة في طريقة التسمية تسهّل البحث اليدوي.
    const isNonDrug = form.mainCategory !== "دواء";
    useEffect(() => {
        if (!isNonDrug) return;
        const built = buildNonDrugName(form.brandName, form.itemType, form.sizeValue, form.sizeUnit, form.variant);
        if (built && built !== form.nameAr) F("nameAr", built);
    }, [isNonDrug, form.brandName, form.itemType, form.sizeValue, form.sizeUnit, form.variant]);

    // 🆕 نفس الفكرة بالظبط بس للاسم الإنجليزي: "النوع" و"الوحدة" ليهم قايمة ثابتة فبنترجمهم
    // مباشرة، والبراند بنتعلمه من أي صنف سابق اتسجل بنفس البراند العربي وله اسم إنجليزي محفوظ
    // (يعني أول مرة بس هتكتب "Nivea" بنفسك، وبعد كده أي صنف "نيفيا" جديد هياخدها تلقائي).
    // الحقل الوحيد اللي فاضل نص حر فعلي هو "تمييز الصنف بالإنجليزي" — وده بالظبط اللي طلبته.
    const brandEnMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
        const cat = p.main_category || p.mainCategory || "";
        const b = (p.brand_name || "").trim();
        const en = (p.brand_name_en || "").trim();
        if (cat !== "دواء" && b && en) map[b] = en;
    });
    return map;
}, [products]);
// 🆕 البراند → الشركة المنتجة، بنفس منطق brandEnMap بالظبط
const brandManufacturerMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
        const cat = p.main_category || p.mainCategory || "";
        const b = (p.brand_name || "").trim();
        const mid = p.manufacturer_id;
        if (cat !== "دواء" && b && mid && !map[b]) map[b] = mid;
    });
    return map;
}, [products]);

// 🆕 النوع → الشكل الصيدلاني الافتراضي، نفس المنطق — بس مجرد اقتراح مش إجبار
const itemTypeSub2Map = useMemo(() => {
    const map = {};
    products.forEach((p) => {
        const cat = p.main_category || p.mainCategory || "";
        const t = (p.item_type || "").trim();
        const s2 = (p.sub_category2 || "").trim();
        if (cat !== "دواء" && t && s2 && !map[t]) map[t] = s2;
    });
    return map;
}, [products]);
    const brandEn = form.brandNameEn.trim() || (form.brandName ? (brandEnMap[form.brandName.trim()] || "") : "");
    // 🆕 الترجمة الإنجليزية للنوع: بندور الأول في جدول item_types الديناميكي (name_en لو
    // المستخدم سجّله وقت الإضافة)، وبنرجع لخريطة NON_DRUG_TYPES_EN القديمة كـ fallback —
    // عشان الأصناف اللي اتسجلت بأنواع قديمة (قبل التحويل للنوع الديناميكي) تفضل شغالة من غير migration.
    const itemTypeEn = itemTypes.find((t) => t.name_ar === form.itemType)?.name_en || NON_DRUG_TYPES_EN[form.itemType] || "";
    const sizeUnitEn = sizeUnits.find((u) => u.name_ar === form.sizeUnit)?.name_en || NON_DRUG_SIZE_UNITS_EN[form.sizeUnit] || "";
    // بنتابع آخر نص إنجليزي اتبنى تلقائيًا، عشان لو الكاشير عدّل الاسم الإنجليزي يدويًا بعد كده
    // منكتبش فوق تعديله كل ما يغيّر حاجة تانية في الفورم (الحجم مثلاً).
    const nameEnAutoRef = useRef("");
    useEffect(() => {
        if (!isNonDrug) return;
        const builtEn = buildNonDrugNameEn(brandEn, itemTypeEn, form.sizeValue, sizeUnitEn, form.variantEn);
        if (builtEn && (form.nameEn === "" || form.nameEn === nameEnAutoRef.current)) {
            F("nameEn", builtEn);
        }
        nameEnAutoRef.current = builtEn;
    }, [isNonDrug, brandEn, itemTypeEn, form.sizeValue, sizeUnitEn, form.variantEn]);
const manufacturerAutoRef = useRef("");
useEffect(() => {
    if (!isNonDrug || !form.brandName) return;
    const suggested = brandManufacturerMap[form.brandName.trim()] || "";
    if (suggested && (form.manufacturer_id === "" || form.manufacturer_id === manufacturerAutoRef.current)) {
        F("manufacturer_id", suggested);
    }
    manufacturerAutoRef.current = suggested;
}, [isNonDrug, form.brandName, brandManufacturerMap]);

const subCat2AutoRef = useRef("");
useEffect(() => {
    if (!isNonDrug || !form.itemType) return;
    const suggested = itemTypeSub2Map[form.itemType] || "";
    if (suggested && (form.subCategory2 === "" || form.subCategory2 === subCat2AutoRef.current)) {
        F("subCategory2", suggested);
    }
    subCat2AutoRef.current = suggested;
}, [isNonDrug, form.itemType, itemTypeSub2Map]);
    // 🆕 قائمة البراندات المستخدمة سابقًا (للأصناف الغير دوائية فقط) عشان الـ autocomplete
    const knownBrands = useMemo(() => {
        const set = new Set();
        products.forEach((p) => {
            const cat = p.main_category || p.mainCategory || "";
            const b = p.brand_name;
            if (cat !== "دواء" && b && b.trim()) set.add(b.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
    }, [products]);
    // 🆕 نفس الفكرة بالظبط بس للبراند بالإنجليزي — مبنية من brandEnMap (كل قيمة فريدة)
    const knownBrandsEn = useMemo(() => Array.from(new Set(Object.values(brandEnMap))).sort((a, b) => a.localeCompare(b)), [brandEnMap]);

    useEffect(() => {
        if (!pharmacyId) return;
        supabase.from("active_ingredients").select("*").eq("pharmacy_id", pharmacyId).order("name_ar")
            .then(({ data }) => { if (data) setAllIngredients(data); });
        supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId).order("name")
            .then(({ data }) => { if (data) setManufacturers(data); });

        // 🆕 تحميل أنواع الأصناف: بنجرب الكاش المحلي الأول (يشتغل أوفلاين فورًا)، وبعدين لو
        // أونلاين بنجيب النسخة الأحدث من supabase ونحدّث الكاش المحلي بيها.
        (async () => {
            try {
                const cached = await window.offlineAPI?.getItemTypesCache?.(pharmacyId);
                if (cached && cached.length > 0) setItemTypes(cached);
            } catch (err) {
                console.error("getItemTypesCache failed:", err);
            }
            if (navigator.onLine) {
                const { data, error } = await supabase.from("item_types").select("*").eq("pharmacy_id", pharmacyId).order("name_ar");
                if (!error && data) {
                    setItemTypes(data);
                    try { await window.offlineAPI?.refreshItemTypesCache?.({ pharmacyId, rows: data }); } catch (err) { console.error("refreshItemTypesCache failed:", err); }
                }
            }
            try {
            const cachedSub2 = await window.offlineAPI?.getSubCategories2Cache?.(pharmacyId);
            if (cachedSub2 && cachedSub2.length > 0) setSubCategories2(cachedSub2);
        } catch (err) { console.error("getSubCategories2Cache failed:", err); }
        if (navigator.onLine) {
            const { data: sub2Data, error: sub2Err } = await supabase.from("sub_categories2").select("*").eq("pharmacy_id", pharmacyId).order("name_ar");
            if (!sub2Err && sub2Data) {
                setSubCategories2(sub2Data);
                try { await window.offlineAPI?.refreshSubCategories2Cache?.({ pharmacyId, rows: sub2Data }); } catch (err) { console.error("refreshSubCategories2Cache failed:", err); }
            }
        }
        // 🆕 نفس منطق subCategories2 بالظبط، بس لوحدات الحجم/الوزن
        try {
            const cachedUnits = await window.offlineAPI?.getSizeUnitsCache?.(pharmacyId);
            if (cachedUnits && cachedUnits.length > 0) setSizeUnits(cachedUnits);
        } catch (err) { console.error("getSizeUnitsCache failed:", err); }
        if (navigator.onLine) {
            const { data: unitsData, error: unitsErr } = await supabase.from("size_units").select("*").eq("pharmacy_id", pharmacyId).order("name_ar");
            if (!unitsErr && unitsData) {
                setSizeUnits(unitsData);
                try { await window.offlineAPI?.refreshSizeUnitsCache?.({ pharmacyId, rows: unitsData }); } catch (err) { console.error("refreshSizeUnitsCache failed:", err); }
            }
        }
        })();
    }, [pharmacyId]);

    const handleMainCategoryChange = (val) => {
        const cat = MAIN_CATEGORIES[val];
        setForm((p) => ({
            ...p, mainCategory: val,
            subCategory1: cat.sub1[0] || "",
            subCategory2: cat.sub2[0] || "",
        }));
    };

    // 🆕 إضافة نوع جديد — أوفلاين-فيرست بنفس نمط باقي الفورم (زي إضافة الصنف نفسه): بتتسجل
    // في الكاش المحلي فورًا وتتحط في queueEvent، وتتزامن مع supabase أول ما النت يرجع.
    // ملاحظة: window.prompt() مش مدعومة في Electron (خصوصًا مع sandbox: true) فبترمي
    // خطأ فورًا — استبدلناها بـ modal بسيطة بتستخدم state + Input زي باقي الفورم.
    const [showItemTypePrompt, setShowItemTypePrompt] = useState(false);
    const [itemTypePromptValue, setItemTypePromptValue] = useState("");
    const [itemTypePromptValueEn, setItemTypePromptValueEn] = useState(""); // 🆕 الاسم الإنجليزي (اختياري)

    const filteredItemTypes = useMemo(() => {
        const q = (form.itemType || "").trim().toLowerCase();
        if (!q) return itemTypes;
        return itemTypes.filter((t) => t.name_ar.toLowerCase().includes(q));
    }, [itemTypes, form.itemType]);
    const itemTypeExactMatch = itemTypes.some((t) => t.name_ar === (form.itemType || "").trim());

    const confirmAddItemType = async () => {
        const trimmed = itemTypePromptValue.trim();
        if (!trimmed) return;
        const trimmedEn = itemTypePromptValueEn.trim();
        setShowItemTypePrompt(false);
        const existing = itemTypes.find((t) => t.name_ar === trimmed);
        if (existing) { F("itemType", trimmed); return; }
        const result = await addItemType(trimmed, pharmacyId, trimmedEn || undefined);
        if (result.error && !result.synced) {
            // لسه اتسجل محليًا وهيتزامن لاحقًا، مش خطأ فعلي — بس لو فيه خطأ حقيقي (مش مجرد أوفلاين) نبلّغ
        }
        const newType = { id: result.id, name_ar: trimmed, name_en: trimmedEn || null, pharmacy_id: pharmacyId };
        setItemTypes((prev) => [...prev, newType].sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar")));
        F("itemType", trimmed);
        showToast(result.synced ? "تمت إضافة النوع ✓" : "تمت إضافة النوع محليًا — هتتزامن لما يرجع النت ✓");
    };

    // 🆕 نفس منطق النوع بالظبط بس لوحدة الحجم/الوزن — Select عادي مع خيار "إضافة وحدة جديدة"
    // (مش محتاجة بحث زي النوع لإن قايمة الوحدات عادةً قصيرة: مل/جم/كجم/لتر...)
    const handleUnitChange = (v) => {
        if (v !== ADD_NEW_UNIT) { F("sizeUnit", v); return; }
        setUnitPromptValue("");
        setUnitPromptValueEn("");
        setShowUnitPrompt(true);
    };

    const confirmAddUnit = async () => {
        const trimmed = unitPromptValue.trim();
        if (!trimmed) return;
        const trimmedEn = unitPromptValueEn.trim();
        setShowUnitPrompt(false);
        const existing = sizeUnits.find((u) => u.name_ar === trimmed);
        if (existing) { F("sizeUnit", trimmed); return; }
        const result = await addSizeUnit(trimmed, pharmacyId, trimmedEn || undefined);
        const newUnit = { id: result.id, name_ar: trimmed, name_en: trimmedEn || null, pharmacy_id: pharmacyId };
        setSizeUnits((prev) => [...prev, newUnit].sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar")));
        F("sizeUnit", trimmed);
        showToast(result.synced ? "تمت إضافة الوحدة ✓" : "تمت إضافة الوحدة محليًا — هتتزامن لما يرجع النت ✓");
    };
     const handleSubCat2Change = (v) => {
    if (v !== ADD_NEW_SUB2) { F("subCategory2", v); return; }
    setSubCat2PromptValue(""); setSubCat2PromptValueEn("");
    setShowSubCat2Prompt(true);
};

const confirmAddSubCat2 = async () => {
    const trimmed = subCat2PromptValue.trim();
    if (!trimmed) return;
    const trimmedEn = subCat2PromptValueEn.trim();
    setShowSubCat2Prompt(false);
    const existing = subCategories2.find((s) => s.name_ar === trimmed && s.main_category === form.mainCategory);
    if (existing) { F("subCategory2", trimmed); return; }
    const result = await addSubCategory2(trimmed, form.mainCategory, pharmacyId, trimmedEn || undefined);
    const newSub2 = { id: result.id, main_category: form.mainCategory, name_ar: trimmed, name_en: trimmedEn || null, pharmacy_id: pharmacyId };
    setSubCategories2((prev) => [...prev, newSub2].sort((a, b) => a.name_ar.localeCompare(b.name_ar, "ar")));
    F("subCategory2", trimmed);
    showToast(result.synced ? "تمت الإضافة ✓" : "تمت الإضافة محليًا — هتتزامن لما يرجع النت ✓");
};

    // ── تحميل بيانات الفورم كل ما تتفتح النافذة (إضافة أو تعديل) ──
    useEffect(() => {
        if (!open) return;
        if (editingId) {
            const p = products.find((x) => x.id === editingId);
            if (!p) return;
            setForm({
                ...blank, ...p,
                nameAr: p.nameAr || p.name_ar || p.name || "",
                nameEn: p.nameEn || p.name_en || "",
                gtin: p.barcode || "", // 🆕 GTIN بيتحمّل فورًا مع الفورم، مش منتظر رد أي استعلام
                price: String(p.taxable ? Math.round((p.price * 1.15) * 100) / 100 : p.price),
                cost: String(p.cost),
                minStock: String(p.min_stock || p.minStock || ""),
                maxStock: String(p.max_stock || p.maxStock || ""),
                saleUnits: p.sale_units || p.unit_division || p.saleUnits || "",
                packageType: p.package_type || p.unit || p.packageType || "",
                mainCategory: p.main_category || p.mainCategory || "دواء",
                subCategory1: p.sub_category1 || p.subCategory1 || "",
                subCategory2: p.sub_category2 || p.subCategory2 || "",
                isEssential: p.is_essential ?? p.isEssential ?? false,
                isChronic: p.is_chronic ?? false,
                supply_category: p.supply_category || "",
                linkedSupplierIds: p.linked_supplier_ids || [],
                manufacturer_id: p.manufacturer_id || "",
                notAvailableMarket: p.not_available_market ?? false,
                shortageReportUrl: p.shortage_report_url || "",
                brandName: p.brand_name || "",
                brandNameEn: p.brand_name_en || "",
                itemType: p.item_type || "",
                sizeValue: p.size_value != null ? String(p.size_value) : "",
                sizeUnit: p.size_unit || "مل",
                variant: p.variant || "",
                searchKeywords: p.search_keywords || "",
                linkedProductId: p.linked_product_id || "",
                autoOrder: p.auto_order ?? p.autoOrder ?? false,
            });
            // ── جدول product_barcodes بقى غرضه بس تتبع الدفعات (batch/serial/expiry) — الـ GTIN نفسه بقى منفصل في form.gtin أعلاه ──
            supabase.from("product_barcodes").select("*").eq("product_id", p.id)
                .then(({ data }) => {
                    setBarcodes(data && data.length > 0 ? data : [{ batch_number: "", serial_number: "", expiry_date: "" }]);
                });
            // 🆕 تحميل الباركودات البديلة البسيطة (مش GS1) المسجلة لنفس الصنف
            supabase.from("product_alt_barcodes").select("*").eq("product_id", p.id)
                .then(({ data }) => setAltBarcodes(data || []));
            supabase.from("product_ingredients").select("*, active_ingredients(name_ar, name_en)").eq("product_id", p.id)
                .then(({ data }) => {
                    setSelectedIngredients((data || []).map((x) => {
                        const fromAll = allIngredients.find((a) => a.id === x.ingredient_id);
                        return {
                            ingredient_id: x.ingredient_id,
                            name_ar: x.active_ingredients?.name_ar || x.active_ingredients?.name_en || fromAll?.name_ar || fromAll?.name_en || "⚠️ مادة فعالة غير موجودة",
                            concentration: x.concentration || "",
                            db_id: x.id,
                        };
                    }));
                });
            setSimilarSearch(""); setSimilarProductId("");
        } else {
            setForm({ ...blank, id: "P" + Date.now(), nameAr: prefillName || "", gtin: prefillBarcode || "" });
            setBarcodes([{ batch_number: "", serial_number: "", expiry_date: "" }]);
            setAltBarcodes([]);
            setSelectedIngredients([]);
            setSimilarSearch(""); setSimilarProductId("");
        }
    }, [open, editingId, prefillName, prefillBarcode]);

    const addBarcode = () => setBarcodes((prev) => [...prev, { batch_number: "", serial_number: "", expiry_date: "" }]);
    const updateBarcode = (i, key, val) => setBarcodes((prev) => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
    const removeBarcode = (i) => setBarcodes((prev) => prev.filter((_, idx) => idx !== i));

    // ── سكان GS1 وتوزيع البيانات تلقائياً ──
    const [gs1ScanVal, setGs1ScanVal] = useState("");
    const gs1Ref = useRef(null);
    const handleGs1Scan = (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        // 🆕 مهم: منديش parseGS1Barcode غير لو الباركود فعلاً GS1 (أقواس AI أو بادئة GS1-128).
        // الفولباك جوه parseGS1Barcode بيدور على أنماط AI ("01"،"17"..) في أي مكان جوه الرقم،
        // فلو اتنادى على باركود خطي عادي (EAN-13/UPC، زي أغلب الكوزمتك وبعض الأدوية) ممكن يقتطع
        // جزء غلط من الرقم ويحطه في GTIN غلط (زي ما حصل: باركود 13 رقم اتحول لـ 5 أرقام بس).
        const parsed = isGS1Formatted(trimmed) ? parseGS1Barcode(trimmed) : { gtin: null };
        if (parsed.gtin) {
            // 🆕 الـ GTIN من السكان بيروح مباشرة لخانة GTIN الثابتة، مش لصفوف الدفعات
            F("gtin", parsed.gtin);
            const emptyIdx = barcodes.findIndex((b) => !b.batch_number && !b.serial_number && !b.expiry_date);
            const newRow = {
                batch_number: parsed.batch || "",
                serial_number: parsed.serial || "",
                expiry_date: parsed.expiry || "",
            };
            if (emptyIdx !== -1) {
                setBarcodes((prev) => prev.map((b, idx) => idx === emptyIdx ? newRow : b));
            } else {
                setBarcodes((prev) => [...prev, newRow]);
            }
            setGs1ScanVal("");
            showToast(`✅ تم استخراج الباركود: ${parsed.gtin}${parsed.expiry ? " | صلاحية: " + parsed.expiry : ""}${parsed.batch ? " | تشغيلة: " + parsed.batch : ""}`, "success");
        } else {
            // 🆕 باركود بسيط مش GS1 (زي كود صنف داخلي أو EAN بسيط):
            // - لو خانة GTIN الرئيسية لسه فاضية → يروح لها هي (نفس السلوك القديم)
            // - لو GTIN متعبي بالفعل → يبقى معناه ده باركود إضافي/بديل لنفس الصنف
            //   (مورد غيّر الباركود، أو الصنف له أكتر من رقم مطبوع)، فيتضاف لقايمة
            //   الباركودات البديلة بدل ما يكتب فوق GTIN الأساسي ويضيعه.
            if (!form.gtin.trim()) {
                F("gtin", trimmed);
                showToast("تم إضافة الباركود البسيط", "success");
            } else if (form.gtin.trim() === trimmed || altBarcodes.some((b) => b.barcode === trimmed)) {
                showToast("الباركود ده مسجل بالفعل لنفس الصنف", "warning");
            } else {
                setAltBarcodes((prev) => [...prev, { id: "tmp" + Date.now(), barcode: trimmed }]);
                showToast(`✅ تم إضافة "${trimmed}" كباركود بديل للصنف`, "success");
            }
            setGs1ScanVal("");
        }
    };

    const removeAltBarcode = (id) => setAltBarcodes((prev) => prev.filter((b) => b.id !== id));

    const addIngredient = async (ing) => {
        if (selectedIngredients.find((x) => x.ingredient_id === ing.id)) { setShowIngredientDropdown(false); setIngredientSearch(""); return; }
        setSelectedIngredients((prev) => [...prev, { ingredient_id: ing.id, name_ar: ing.name_ar || ing.name_en || "", concentration: "", db_id: null }]);
        setShowIngredientDropdown(false);
        setIngredientSearch("");
    };

    const addNewIngredient = async () => {
        const text = ingredientSearch.trim();
        if (!text) return;
        // 🆕 لو المادة موجودة بالفعل (بغض النظر عن حالة الحروف)، بنستخدمها بدل ما نضيف صف مكرر
        const existing = allIngredients.find(
            (a) => (a.name_ar || "").trim().toLowerCase() === text.toLowerCase() || (a.name_en || "").trim().toLowerCase() === text.toLowerCase()
        );
        if (existing) { addIngredient(existing); return; }
        // 🆕 المواد الفعالة كلها متسجلة بالإنجليزي في العمود name_en، فأي نص مكتوب بحروف لاتينية
        // (زي "hydrochlorthiazide") لازم يروح على name_en مش name_ar، عشان ميبقاش فيه مادتين
        // بنفس الاسم موزعين على عمودين مختلفين.
        const isArabic = /[\u0600-\u06FF]/.test(text);
        const payload = isArabic ? { name_ar: text, pharmacy_id: pharmacyId } : { name_en: text, pharmacy_id: pharmacyId };
        const { data, error } = await supabase.from("active_ingredients").insert(payload).select().single();
        if (error) { showToast("خطأ في إضافة المادة الفعالة: " + error.message, "error"); return; }
        setAllIngredients((prev) => [...prev, data]);
        addIngredient(data);
    };

    const removeIngredient = (ingredient_id) => setSelectedIngredients((prev) => prev.filter((x) => x.ingredient_id !== ingredient_id));
    const updateIngredientConc = (ingredient_id, val) => setSelectedIngredients((prev) => prev.map((x) => x.ingredient_id === ingredient_id ? { ...x, concentration: val } : x));

    // ── إضافة شركة منتجة سريعة (لو مفيش شاشة إدارة كاملة متاحة) ──
    // نفس ملاحظة النوع: window.prompt() مش مدعومة في Electron، فلو مفيش
    // onRequestAddManufacturer (المسار المفضّل) بنستخدم modal بديلة بدل الـ prompt.
    const [showMfrPrompt, setShowMfrPrompt] = useState(false);
    const [mfrPromptValue, setMfrPromptValue] = useState("");

    const quickAddManufacturer = () => {
        if (onRequestAddManufacturer) { onRequestAddManufacturer(); return; }
        setMfrPromptValue("");
        setShowMfrPrompt(true);
    };

    const confirmAddManufacturer = async () => {
        const trimmed = mfrPromptValue.trim();
        if (!trimmed) return;
        setShowMfrPrompt(false);
        const { data, error } = await supabase.from("manufacturers").insert({ name: trimmed, pharmacy_id: pharmacyId }).select().single();
        if (error) { showToast("خطأ: " + error.message, "error"); return; }
        setManufacturers((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
        F("manufacturer_id", data.id);
        showToast("تمت إضافة الشركة ✓");
    };

    // ── حفظ ──
    const save = async () => {
        if (!form.nameAr || !form.price) { showToast("يرجى ملء الحقول المطلوبة", "error"); return; }
        // 🆕 منع تكرار الأصناف: بنتحقق بس وقت "إضافة" صنف جديد (مش تعديل صنف موجود)
        if (!editingId) {
            const dupCode = products.find((x) => x.id === form.id);
            if (dupCode) { showToast(`⚠️ رمز الصنف "${form.id}" مستخدم بالفعل لصنف آخر — غيّر الرمز`, "error"); return; }
            const gtin = form.gtin.trim();
            const dupBarcode = gtin && products.find((x) => (x.barcode || "").trim() === gtin);
            if (dupBarcode) { showToast(`⚠️ الباركود (GTIN) ده مسجل بالفعل على الصنف "${dupBarcode.name_ar || dupBarcode.name}"`, "error"); return; }
            // تطابق الاسم بس (من غير كود/باركود) ممكن يكون طبيعي (تحديث سعر مورد جديد مثلاً)، فبنحذّر ونسيب القرار للصيدلي
            const dupName = products.find((x) => (x.name_ar || x.name || "").trim() === form.nameAr.trim());
            if (dupName) {
                const confirmMsg = `⚠️ في صنف بنفس الاسم "${form.nameAr}" موجود بالفعل (رمز ${dupName.id}).\nتقدر تعدّل السعر في الصنف الموجود بدل ما تضيف نسخة تانية.\nعايز تكمل وتضيفه كصنف منفصل؟`;
                if (!window.confirm(confirmMsg)) return;
            }
        }
        const p = {
            id: form.id,
            name: form.nameAr, name_ar: form.nameAr, name_en: form.nameEn,
            barcode: form.gtin.trim(),
            stock: editingId ? undefined : 0,
            category: form.mainCategory, main_category: form.mainCategory,
            sub_category1: form.subCategory1, sub_category2: form.subCategory2,
            package_type: form.packageType || null,
            sale_units: form.saleUnits ? +form.saleUnits : null,
            price: form.taxable ? Math.round((+form.price / 1.15) * 100) / 100 : +form.price,
            cost: +form.cost,
            taxable: form.taxable,
            min_stock: +form.minStock, max_stock: +form.maxStock,
            active_ingredient: selectedIngredients[0]?.name_ar || "",
            concentration: selectedIngredients[0]?.concentration || "",
            is_essential: form.isEssential, is_chronic: form.isChronic,
            supply_category: form.supply_category,
            linked_supplier_ids: form.linkedSupplierIds || [],
            manufacturer_id: form.manufacturer_id || null,
            not_available_market: form.notAvailableMarket,
            shortage_report_url: form.shortageReportUrl || null,
            // 🆕 حقول التسمية الموحّدة — بتتسجل بس للأصناف الغير دوائية، وبتفضل فاضية للدواء
            brand_name: isNonDrug ? (form.brandName || null) : null,
            brand_name_en: isNonDrug ? (form.brandNameEn || null) : null,
            item_type: isNonDrug ? (form.itemType || null) : null,
            size_value: isNonDrug && form.sizeValue ? +form.sizeValue : null,
            size_unit: isNonDrug ? (form.sizeUnit || null) : null,
            variant: isNonDrug ? (form.variant || null) : null,
            search_keywords: form.searchKeywords.trim() || null,
            linked_product_id: form.linkedProductId || null, // 🆕 لو الصنف ده كارت عرض من المورد، مربوط بالصنف الأصلي
            // 🆕 هل الصنف ده يدخل في حساب طلبات الشراء التلقائية؟ الأصناف الجديدة بتتسجل false افتراضيًا،
            // وبتتفعّل تلقائيًا أول ما تدخل فاتورة شراء حقيقية (شوف كود حفظ فاتورة الشراء)
            auto_order: editingId ? form.autoOrder : false,
        };

        let productId = form.id;
        const editing = !!editingId;
        if (editing) {
            const oldProduct = products.find((x) => x.id === editingId);
            const result = await saveProduct(p, pharmacyId, true);
            if (!result.synced && result.error) {
                showToast("خطأ في التعديل: " + result.error, "error"); return;
            }
            setProducts((prev) => prev.map((x) => (x.id === editingId ? {
                ...x,
                ...p,
                saleUnits: p.sale_units || x.saleUnits || null,
                packageType: p.package_type || x.packageType || "",
            } : x)));
            if (oldProduct) {
                const trackedFields = ["name", "price", "cost", "barcode", "category", "mainCategory", "supplier_id", "is_essential", "is_chronic", "not_available_market", "linked_supplier_ids"];
                const oldSnap: any = {}; const newSnap: any = {};
                trackedFields.forEach((k) => {
                    const ov = (oldProduct as any)[k]; const nv = (p as any)[k];
                    if (JSON.stringify(ov) !== JSON.stringify(nv)) { oldSnap[k] = ov; newSnap[k] = nv; }
                });
                if (Object.keys(newSnap).length > 0) {
                    logAudit({
                        pharmacyId, userName: currentUser?.name, action: "update", entityType: "product",
                        entityId: editingId, entityLabel: p.name,
                        oldValue: oldSnap, newValue: newSnap,
                        description: `تعديل بيانات الصنف "${p.name}"`,
                    });
                }
            }
        } else {
            const result = await saveProduct(p, pharmacyId, false);
            if (!result.synced && result.error) {
                showToast("خطأ في الإضافة: " + result.error, "error"); return;
            }
            productId = p.id;
            setProducts((prev) => [...prev, {
                ...p,
                pharmacy_id: pharmacyId,
                saleUnits: p.sale_units || null,
                packageType: p.package_type || "",
            }]);
            logAudit({
                pharmacyId, userName: currentUser?.name, action: "create", entityType: "product",
                entityId: productId, entityLabel: p.name,
                newValue: { name: p.name, price: p.price, cost: p.cost, barcode: p.barcode },
                description: `إضافة صنف جديد "${p.name}"`,
            });
        }

        const validBarcodes = barcodes.filter((b) => (b.batch_number || "").trim() || (b.serial_number || "").trim() || (b.expiry_date || "").trim());
        await replaceProductBarcodes(productId, pharmacyId, validBarcodes.map((b) => ({
            batch_number: b.batch_number || null,
            serial_number: b.serial_number || null,
            expiry_date: b.expiry_date || null,
            base_barcode: form.gtin.trim(),
            product_id: productId, pharmacy_id: pharmacyId,
        })));

        // 🆕 حفظ الباركودات البديلة (replace كامل زي البارباركود العادي)
        await replaceProductAltBarcodes(productId, pharmacyId, altBarcodes.map((b) => b.barcode));

        await replaceProductIngredients(productId, pharmacyId, selectedIngredients.map((x) => ({
            product_id: productId, ingredient_id: x.ingredient_id, concentration: x.concentration, pharmacy_id: pharmacyId,
        })));

        if (jokerLinkChoice) {
            await supabase.from("joker_pending_items").update({ status: "linked", linked_product_id: productId }).eq("id", jokerLinkChoice);
            setJokerPendingItems((prev) => prev.map((j) => (j.id === jokerLinkChoice ? { ...j, status: "linked", linked_product_id: productId } : j)));
        }

        showToast(editing ? "تم تعديل الصنف" : "تمت إضافة الصنف ✓");
        if (!editing) {
            setForm({ ...blank, id: "P" + Date.now() });
            setBarcodes([{ batch_number: "", serial_number: "", expiry_date: "" }]);
            setSelectedIngredients([]);
            setJokerLinkChoice(null);
            setDismissedJokerSuggestion(false);
        }
        if (onSaved) onSaved({ ...p, id: productId });
        onClose();
    };

    const currentCat = MAIN_CATEGORIES[form.mainCategory] || { sub1: [], sub2: [] };
    const filteredIngredients = allIngredients.filter((x) =>
        (x.name_ar || "").includes(ingredientSearch) || (x.name_en || "").toLowerCase().includes(ingredientSearch.toLowerCase())
    );

    const inputStyle = { background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

    return (
        <>
            <Modal open={open} onClose={onClose} title={editingId ? "تعديل الصنف" : "إضافة صنف جديد"} wide>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Input label="رمز الصنف" value={form.id} onChange={(v) => F("id", v)} placeholder="P001" />

                    {isNonDrug ? (
                        <>
                            {/* 🆕 التسمية الموحّدة للأصناف الغير دوائية: البراند + النوع + الحجم/الوزن → الاسم بيتبني تلقائيًا */}
                            <div style={{ position: "relative" }}>
                                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>البراند *</div>
                                <input
                                    value={form.brandName}
                                    onChange={(e) => F("brandName", e.target.value)}
                                    placeholder="نيفيا"
                                    dir="rtl" lang="ar"
                                    list="brand-suggestions"
                                    style={inputStyle}
                                />
                                <datalist id="brand-suggestions">
                                    {knownBrands.map((b) => <option key={b} value={b} />)}
                                </datalist>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>البراند بالإنجليزي {!brandEnMap[form.brandName?.trim()] && "*"}</div>
                            <input
                             value={form.brandNameEn}
                               onChange={(e) => F("brandNameEn", e.target.value)}
                               placeholder="Nivea"
                               dir="ltr" lang="en"
                               list="brand-en-suggestions"
                               style={inputStyle}
                                      />
                            <datalist id="brand-en-suggestions">
                                {knownBrandsEn.map((b) => <option key={b} value={b} />)}
                            </datalist>
                                   </div>
                            {/* 🆕 النوع بقى قابل للبحث بالكتابة بدل Select عادي — مصدره جدول item_types
                الديناميكي، والقايمة بتتفلتر لحظيًا مع الكتابة. لو الاسم المكتوب مش موجود
                أصلاً، بيظهر خيار "إضافة كنوع جديد" في نفس القايمة بدل ما يحتاج زرار منفصل. */}
                            <div style={{ position: "relative" }}>
                                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>النوع *</div>
                                <input
                                    value={form.itemType}
                                    onChange={(e) => { F("itemType", e.target.value); setShowItemTypeDropdown(true); }}
                                    onFocus={() => setShowItemTypeDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowItemTypeDropdown(false), 150)}
                                    placeholder="اكتب للبحث عن النوع..."
                                    dir="rtl" lang="ar"
                                    style={inputStyle}
                                />
                                {showItemTypeDropdown && (
                                    <div style={{
                                        position: "absolute", zIndex: 20, top: "100%", right: 0, left: 0,
                                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                        border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 4,
                                        maxHeight: 200, overflowY: "auto",
                                    }}>
                                        {filteredItemTypes.map((t) => (
                                            <div
                                                key={t.id}
                                                onMouseDown={() => { F("itemType", t.name_ar); setShowItemTypeDropdown(false); }}
                                                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}` }}
                                            >
                                                {t.name_ar}
                                            </div>
                                        ))}
                                        {filteredItemTypes.length === 0 && (
                                            <div style={{ padding: "8px 12px", fontSize: 12, color: COLORS.textDim }}>مفيش نتايج مطابقة</div>
                                        )}
                                        {form.itemType.trim() && !itemTypeExactMatch && (
                                            <div
                                                onMouseDown={() => {
                                                    setItemTypePromptValue(form.itemType.trim());
                                                    setItemTypePromptValueEn("");
                                                    setShowItemTypeDropdown(false);
                                                    setShowItemTypePrompt(true);
                                                }}
                                                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: COLORS.green, fontWeight: 700 }}
                                            >
                                                ➕ إضافة "{form.itemType.trim()}" كنوع جديد
                                            </div>
                                        )}
                                    </div>
                                )}
                                <span onClick={() => setShowManageModal("itemType")} style={{ fontSize: 11, color: COLORS.blue, cursor: "pointer" }}>🗑 إدارة الأنواع</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <div style={{ flex: 2 }}>
                                    <Input label="الحجم/الوزن" value={form.sizeValue} onChange={(v) => F("sizeValue", v)} type="number" placeholder="400" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Select label="الوحدة" value={form.sizeUnit} onChange={handleUnitChange}
                                        options={["", ...sizeUnits.map((u) => u.name_ar), ADD_NEW_UNIT]} />
                                    <span onClick={() => setShowManageModal("sizeUnit")} style={{ fontSize: 11, color: COLORS.blue, cursor: "pointer" }}>🗑 إدارة الوحدات</span>
                                </div>
                            </div>
                            {/* 🆕 تمييز الصنف — وصف حر بيتضاف آخر الاسم (مثلاً "لتساقط الشعر"، "بشرة جافة") لتفريق منتجات نفس البراند/النوع/الحجم عن بعض */}
                            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <Input label="تمييز الصنف (اختياري)" value={form.variant} onChange={(v) => F("variant", v)} placeholder="لتساقط الشعر" dir="rtl" lang="ar" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    {/* 🆕 الجزء الوحيد اللي محتاج ترجمة يدوية — كل حاجة تانية (البراند لو معروف، النوع، الحجم) بتتملي لوحدها في الاسم الإنجليزي تحت */}
                                    <Input label="تمييز الصنف بالإنجليزي (اختياري)" value={form.variantEn} onChange={(v) => F("variantEn", v)} placeholder="Hair Loss" dir="ltr" lang="en" />
                                </div>
                            </div>
                            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: COLORS.textDim, marginTop: -6 }}>
                                الاسم النهائي (يتبني تلقائيًا): <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{form.nameAr || "—"}</span>
                            </div>
                            {/* 🆕 الاسم بالإنجليزي: بيتبني تلقائيًا من نفس الحقول (النوع/الوحدة مترجمين ثابت، والبراند لو
                اتسجل قبل كده بالإنجليزي لصنف تاني بنفس البراند) — تقدر تعدّله يدويًا في أي وقت */}
                            <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={(v) => F("nameEn", v)} placeholder="Nivea Cream 400ml" dir="ltr" lang="en" />
                            {!brandEn && form.brandName && (
    <div style={{ gridColumn: "1 / -1", fontSize: 11, color: COLORS.gold, marginTop: -6 }}>
        💡 أول مرة تستخدم براند "{form.brandName}" — اكتب اسمه بالإنجليزي في خانة "البراند بالإنجليزي"، وبعد كده هيتملي لوحده تلقائيًا لأي صنف جديد بنفس البراند.
    </div>
)}
                            
                            {/* 🆕 مرادفات/كلمات بحث إضافية — اختياري، بيتخزن جنبًا ومش بيأثر على شكل الاسم المعروض */}
                            <div style={{ gridColumn: "1 / -1" }}>
                                <Input
                                    label="مرادفات/كلمات بحث إضافية (اختياري)"
                                    value={form.searchKeywords}
                                    onChange={(v) => F("searchKeywords", v)}
                                    placeholder="مثال: nivea, نيفيا كريم, جسم"
                                    dir="rtl" lang="ar"
                                />
                                <div style={{ fontSize: 11, color: COLORS.border, marginTop: 4 }}>
                                    افصل بين الكلمات بفاصلة — بتساعد البحث اليدوي من غير ما تغيّر الاسم المعروض للصنف.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* 🆕 الاسم بالعربي: يتفعّل تلقائيًا اتجاه RTL ولغة عربي عند التركيز عليه */}
                            <Input label="الاسم بالعربي *" value={form.nameAr} onChange={(v) => F("nameAr", v)} placeholder="باراسيتامول" dir="rtl" lang="ar" />
                            {/* 🆕 الاسم بالإنجليزي: يتفعّل تلقائيًا اتجاه LTR ولغة إنجليزي عند التركيز عليه */}
                            <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={(v) => F("nameEn", v)} placeholder="Paracetamol" dir="ltr" lang="en" />
                        </>
                    )}

                    {/* 🆕 تنويه: الاسم اللي بيتكتب شكله "عرض من المورد" مش صنف منفصل حقيقي —
            نقترح ربطه بالصنف الأصلي عشان يتحول تلقائيًا لعرض BOGO جاهز في قسم العروض */}
                    {!editingId && offerPattern.isOffer && !form.linkedProductId && !offerNudgeDismissed && (
                        <div style={{ gridColumn: "1 / -1", background: COLORS.goldSoft, border: `1px dashed ${COLORS.gold}`, borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
                                <div style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 700 }}>
                                    ⚠️ الاسم ده شكله عرض من المورد — حابب تربطه بصنف موجود بدل ما يتسجل كصنف منفصل؟
                                </div>
                                <span onClick={() => setOfferNudgeDismissed(true)} style={{ cursor: "pointer", color: COLORS.textDim, fontSize: 12, whiteSpace: "nowrap" }}>تجاهل ✕</span>
                            </div>
                            <div style={{ position: "relative", marginTop: 8 }}>
                                <input
                                    value={offerLinkSearch}
                                    onChange={(e) => { setOfferLinkSearch(e.target.value); setShowOfferLinkDropdown(true); }}
                                    onFocus={() => setShowOfferLinkDropdown(true)}
                                    placeholder="دوّر على الصنف الأصلي (مثلاً Closeup 75ml)..."
                                    dir="rtl" lang="ar"
                                    style={inputStyle}
                                />
                                {showOfferLinkDropdown && offerLinkResults.length > 0 && (
                                    <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                                        {offerLinkResults.map((p) => (
                                            <div
                                                key={p.id}
                                                onMouseDown={() => { F("linkedProductId", p.id); setOfferLinkSearch(""); setShowOfferLinkDropdown(false); }}
                                                style={{ padding: "8px 10px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}
                                            >
                                                {p.name_ar || p.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {form.linkedProductId && (
                        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, background: COLORS.greenSoft, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                            🔗 مرتبط بـ: <b>{linkedProduct?.name_ar || linkedProduct?.name || "..."}</b>
                            <span onClick={() => F("linkedProductId", "")} style={{ cursor: "pointer", color: COLORS.red, marginRight: "auto", fontSize: 12 }}>إلغاء الربط ✕</span>
                        </div>
                    )}
                    {jokerSuggestionMatch && (
                        <div style={{ gridColumn: "1 / -1", background: COLORS.goldSoft, border: `1px dashed ${COLORS.gold}`, borderRadius: 10, padding: 12 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
                                <div style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 700 }}>
                                    🔔 ده يشبه صنف جوكر اتسجل قبل كده باسم "{jokerSuggestionMatch.name}" ({jokerSuggestionMatch.qty} وحدة مطلوبة). تحب تربطهم؟
                                </div>
                                <span onClick={() => setDismissedJokerSuggestion(true)} style={{ cursor: "pointer", color: COLORS.textDim, fontSize: 12, whiteSpace: "nowrap" }}>تجاهل ✕</span>
                            </div>
                            <button
                                onClick={() => { setJokerLinkChoice(jokerSuggestionMatch.id); setDismissedJokerSuggestion(true); }}
                                style={{ marginTop: 8, background: COLORS.gold, color: "#1a1a1a", border: "none", borderRadius: 7, padding: "6px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                            >
                                ✓ نعم، اربطهم — هيتم اعتماد اسم الصنف الجديد بدل الاسم السريع
                            </button>
                        </div>
                    )}
                    {jokerLinkChoice && (
                        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, background: COLORS.greenSoft, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                            🔗 هيتم ربط الصنف ده بالجوكر المعلّق المطابق عند الحفظ
                            <span onClick={() => setJokerLinkChoice(null)} style={{ cursor: "pointer", color: COLORS.red, marginRight: "auto", fontSize: 12 }}>إلغاء الربط ✕</span>
                        </div>
                    )}

                    <Select label="الفئة الرئيسية" value={form.mainCategory} onChange={handleMainCategoryChange} options={Object.keys(MAIN_CATEGORIES)} />
                    <Select label="فئة التوريد" value={form.supply_category} onChange={(v) => F("supply_category", v)} options={["", ...SUPPLY_CATEGORIES]} />
                    {/* 🆕 ربط الصنف بمورد/موردين محددين من داخل موردين نفس الفئة — مفيد لو فيه أكتر من مورد
                        لنفس الفئة بس بعضهم بيورد شركات/منتجات معينة بس (مثلاً كوزمتك طبي) */}
                    {form.supply_category && (() => {
                        const categorySuppliers = suppliers.filter((s) => (s.supply_categories || []).includes(form.supply_category));
                        if (categorySuppliers.length === 0) return null;
                        return (
                            <div style={{ gridColumn: "1 / -1" }}>
                                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>
                                    الموردين المرتبطين بالصنف (اختياري — سيبها فاضية لو أي مورد في الفئة يقدر يوردّه)
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {categorySuppliers.map((s) => {
                                        const selected = (form.linkedSupplierIds || []).includes(s.id);
                                        return (
                                            <button key={s.id} type="button" onClick={() => {
                                                const current = form.linkedSupplierIds || [];
                                                F("linkedSupplierIds", selected ? current.filter((id) => id !== s.id) : [...current, s.id]);
                                            }}
                                                style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? COLORS.blue : COLORS.border, background: selected ? COLORS.blueSoft : "transparent", color: selected ? COLORS.blue : COLORS.textDim, fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
                                                {selected ? "✓ " : ""}{s.name}{s.supplier_type === "متخصص" ? " (متخصص)" : ""}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                    {currentCat.sub1.length > 0 && <Select label="المصدر" value={form.subCategory1} onChange={(v) => F("subCategory1", v)} options={currentCat.sub1} />}
                    {(() => {
    const sub2Options = subCategories2.filter((s) => s.main_category === form.mainCategory).map((s) => s.name_ar);
    const hasSub2 = isNonDrug ? sub2Options.length > 0 : currentCat.sub2.length > 0;
    if (!hasSub2) return null;
    const options = isNonDrug
        ? ["", ...sub2Options, ADD_NEW_SUB2]
        : currentCat.sub2; // 🆕 الدواء يفضل زي ما هو — مش مربوط بالجدول الديناميكي
    return (
        <div>
            <Select label="الشكل الصيدلاني" value={form.subCategory2}
                onChange={isNonDrug ? handleSubCat2Change : (v) => F("subCategory2", v)}
                options={options} />
            {isNonDrug && (
                <span onClick={() => setShowManageModal("subCat2")} style={{ fontSize: 11, color: COLORS.blue, cursor: "pointer" }}>🗑 إدارة الأشكال</span>
            )}
        </div>
    );
})()}

                    {/* ── الشركة المنتجة ── */}
                    <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>🏭 الشركة المنتجة</div>
                        <select value={form.manufacturer_id} onChange={(e) => F("manufacturer_id", e.target.value)} style={inputStyle}>
                            <option value="">— اختر الشركة —</option>
                            {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <div style={{ fontSize: 11, color: COLORS.border, marginTop: 4 }}>
                            لا تجد الشركة؟ <span onClick={quickAddManufacturer} style={{ color: COLORS.blue, cursor: "pointer", textDecoration: "underline" }}>أضفها من هنا</span>
                        </div>
                    </div>

                    <Select label="نوع العبوة" value={form.packageType} onChange={(v) => F("packageType", v)} options={["", ...PACKAGE_TYPES]} />
                    <Input label="عدد وحدات البيع" value={form.saleUnits} onChange={(v) => F("saleUnits", v)} type="number" placeholder="فارغ = بدون تقسيم" />
                    <div style={{ fontSize: 11, color: COLORS.border, gridColumn: "1 / -1", marginTop: -6 }}>
                        مثال: عبوة (نوع العبوة) فيها 20 قرص (عدد وحدات البيع) — يُستخدم لحساب سعر الوحدة وتفتيت البيع.
                    </div>

                    {/* ── حقل السعر مع hint الضريبة ── */}
                    <div>
                        <Input
                            label={`سعر البيع * ${form.taxable ? "(شامل الضريبة 15%)" : ""}`}
                            value={form.price}
                            onChange={(v) => F("price", v)}
                            type="number"
                            placeholder="0.00"
                        />
                        {form.taxable && form.price && +form.price > 0 && (
                            <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4, padding: "4px 8px", background: COLORS.greenSoft, borderRadius: 4 }}>
                                قبل الضريبة: {(+form.price / 1.15).toFixed(2)} ر.س &nbsp;·&nbsp; الضريبة: {(+form.price - +form.price / 1.15).toFixed(2)} ر.س
                            </div>
                        )}
                    </div>

                    <Input label="سعر التكلفة" value={form.cost} onChange={(v) => F("cost", v)} type="number" placeholder="0.00" />
                    <Input label="الحد الأدنى للمخزون" value={form.minStock} onChange={(v) => F("minStock", v)} type="number" placeholder="10" />
                    <Input label="الحد الأقصى للمخزون" value={form.maxStock} onChange={(v) => F("maxStock", v)} type="number" placeholder="100" />

                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                        <label style={{ color: COLORS.border, fontSize: 13, fontWeight: 600 }}>خاضع لضريبة القيمة المضافة 15%</label>
                        <input type="checkbox" checked={form.taxable} onChange={(e) => F("taxable", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                        <label style={{ color: COLORS.gold, fontSize: 13, fontWeight: 600 }}>⭐ دواء أساسي</label>
                        <input type="checkbox" checked={form.isEssential} onChange={(e) => F("isEssential", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                        <label style={{ color: "#44aaff", fontSize: 13, fontWeight: 600 }}>🔄 دواء مزمن</label>
                        <input type="checkbox" checked={form.isChronic} onChange={(e) => F("isChronic", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                        <label style={{ color: COLORS.red, fontSize: 13, fontWeight: 600 }}>🚫 غير متوفر بالسوق السعودي</label>
                        <input type="checkbox" checked={form.notAvailableMarket} onChange={(e) => F("notAvailableMarket", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </div>
                    {form.notAvailableMarket && (
                        <div style={{ gridColumn: "1 / -1" }}>
                            <Input label="رابط بلاغ عدم التوفر (منصة رصد مثلاً)" value={form.shortageReportUrl} onChange={(v) => F("shortageReportUrl", v)} placeholder="https://..." />
                        </div>
                    )}
                    {/* 🆕 التحكم اليدوي في دخول الصنف لحساب الطلب التلقائي — بيظهر بس وقت التعديل، لأن الصنف الجديد
            بيتسجل false افتراضيًا ويتفعّل لوحده أول ما يدخل فاتورة شراء حقيقية */}
                    {editingId && (
                        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "8px 0", background: form.autoOrder ? "transparent" : COLORS.goldSoft, borderRadius: 8, paddingRight: form.autoOrder ? 0 : 10 }}>
                            <label style={{ color: form.autoOrder ? COLORS.green : COLORS.gold, fontSize: 13, fontWeight: 600 }}>
                                📦 يدخل حساب طلبات الشراء التلقائية{!form.autoOrder && " — متجاهَل حاليًا"}
                            </label>
                            <input type="checkbox" checked={form.autoOrder} onChange={(e) => F("autoOrder", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                        </div>
                    )}
                    {!editingId && (
                        <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: COLORS.textDim, background: COLORS.surfaceAlt, borderRadius: 8, padding: "6px 10px" }}>
                            ℹ️ الصنف الجديد ده مش هيدخل حساب طلبات الشراء التلقائية إلا بعد ما يتسجل في فاتورة شراء فعلية.
                        </div>
                    )}
                </div>

                {/* 🆕 صنف مثيل — بيظهر بس للأدوية (نقل مادة فعالة من صنف مشابه منطقي للدواء بس، مش لصنف كوزمتك مثلاً) */}
                {!isNonDrug && (
                    <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                        <div style={{ fontWeight: 700, color: COLORS.blue, marginBottom: 8, fontSize: 14 }}>🔗 صنف مثيل (اختياري)</div>
                        <div style={{ position: "relative" }}>
                            <input
                                value={similarSearch}
                                onChange={(e) => { setSimilarSearch(e.target.value); setShowSimilarDropdown(true); setSimilarProductId(""); }}
                                onFocus={() => setShowSimilarDropdown(true)}
                                placeholder="ابحث عن الصنف الأصلي المثيل له..."
                                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 7, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
                            />
                            {showSimilarDropdown && similarSearch && (
                                <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 7, zIndex: 200, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                                    {products.filter((p) => (p.name_ar || p.name || "").includes(similarSearch) && p.id !== form.id).slice(0, 8).map((p) => (
                                        <div key={p.id} onClick={() => {
                                            setSimilarProductId(p.id);
                                            setSimilarSearch(p.name_ar || p.name || "");
                                            setShowSimilarDropdown(false);
                                            supabase.from("product_ingredients")
                                                .select("*, active_ingredients(name_ar, name_en)")
                                                .eq("product_id", p.id)
                                                .then(({ data }) => {
                                                    if (data && data.length > 0) {
                                                        setSelectedIngredients(data.map((x) => {
                                                            const fromAll = allIngredients.find((a) => a.id === x.ingredient_id);
                                                            return {
                                                                ingredient_id: x.ingredient_id,
                                                                name_ar:
                                                                    x.active_ingredients?.name_ar ||
                                                                    x.active_ingredients?.name_en ||
                                                                    fromAll?.name_ar ||
                                                                    fromAll?.name_en ||
                                                                    "⚠️ مادة فعالة غير موجودة",
                                                                concentration: x.concentration || "",
                                                            };
                                                        }));
                                                        showToast(`✅ تم استيراد ${data.length} مادة فعالة من ${p.name_ar || p.name}`);
                                                    }
                                                });
                                        }}
                                            style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.textPrimary, fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                                            {p.name_ar || p.name}
                                            {(p.active_ingredient || "") && <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 6 }}>— {p.active_ingredient}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {similarProductId && <div style={{ color: COLORS.green, fontSize: 12, marginTop: 5 }}>✅ المواد الفعالة تم استيرادها تلقائياً</div>}
                    </div>
                )}

                {/* 🆕 المواد الفعالة — بتخص الأدوية بس */}
                {!isNonDrug && (
                    <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                        <div style={{ fontWeight: 700, color: COLORS.blue, marginBottom: 10, fontSize: 14 }}>🧪 المواد الفعالة</div>
                        {selectedIngredients.map((ing) => (
                            <div key={ing.ingredient_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                <div style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 7, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, minHeight: 36 }}>{ing.name_ar}</div>
                                <input value={ing.concentration} onChange={(e) => updateIngredientConc(ing.ingredient_id, e.target.value)}
                                    placeholder="التركيز (مثال: 500mg)"
                                    style={{ width: 170, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 7, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", minHeight: 36 }} />
                                <Btn size="sm" variant="danger" onClick={() => removeIngredient(ing.ingredient_id)}>✕</Btn>
                            </div>
                        ))}
                        <div style={{ position: "relative", marginTop: 8 }}>
                            <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setShowIngredientDropdown(true); }}
                                onFocus={() => setShowIngredientDropdown(true)}
                                placeholder="🔍 بحث عن مادة فعالة أو إضافة جديدة..."
                                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "7px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                            {showIngredientDropdown && ingredientSearch && (
                                <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 6, zIndex: 200, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                                    {filteredIngredients.map((ing) => (
                                        <div key={ing.id} onClick={() => addIngredient(ing)}
                                            style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.textPrimary, fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                                            {ing.name_ar ? (
                                                <>{ing.name_ar} {ing.name_en && <span style={{ color: COLORS.textDim, fontSize: 11 }}>({ing.name_en})</span>}</>
                                            ) : (
                                                <>{ing.name_en || "—"} <span style={{ color: COLORS.gold, fontSize: 10 }}>(بدون اسم عربي)</span></>
                                            )}
                                        </div>
                                    ))}
                                    <div onClick={addNewIngredient}
                                        style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.green, fontSize: 13, fontWeight: 600 }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                                        ➕ إضافة "{ingredientSearch}" كمادة فعالة جديدة
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* GTIN — ثابت لكل صنف، مصدره الوحيد products.barcode */}
                <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                    <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: 14, marginBottom: 10 }}>🔖 GTIN</div>
                    <input value={form.gtin} onChange={(e) => F("gtin", e.target.value)} placeholder="GTIN (رقم بند التجارة العالمي)"
                        style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>

                {/* الدفعات — batch/serial/expiry فقط، الـ GTIN ثابت وموحّد أعلاه */}
                <div style={{ marginTop: 20, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: 14 }}>📦 الدفعات (تشغيلة / صلاحية / سيريال)</div>
                        <Btn size="sm" icon="plus" onClick={addBarcode}>إضافة دفعة</Btn>
                    </div>

                    <div style={{
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px dashed ${COLORS.borderStrong}`,
                        borderRadius: 8, padding: "10px 12px", marginBottom: 12,
                        display: "flex", gap: 8, alignItems: "center",
                    }}>
                        <span style={{ fontSize: 18 }}>📷</span>
                        {/* 🆕 بنستخدم نفس مكوّن سكانر نقطة البيع (BarcodeScanner) هنا عشان يشتغل بنفس
              الخاصية: بيقرأ event.code بدل event.key، فمينفعش لغة الإدخال (عربي/إنجليزي)
              تلخبط القيمة المتسحوحة زي ما كان بيحصل مع input عادي بيعتمد على لغة النظام. */}
                        <div style={{ flex: 1 }}>
                            <BarcodeScanner
                                ref={gs1Ref}
                                onScan={(scan) => handleGs1Scan(scan.raw || scan.code || "")}
                                placeholder="امسح QR/باركود الدواء هنا — هيتوزع تلقائياً ↵"
                            />
                        </div>
                    </div>

                    {/* 🆕 قايمة الباركودات البديلة البسيطة (مش دفعات GS1) — بتتضاف تلقائيًا لما
                        تمسح باركود بسيط والخانة الرئيسية (GTIN) متعبية بالفعل */}
                    {altBarcodes.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>باركودات بديلة لنفس الصنف:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {altBarcodes.map((b) => (
                                    <span key={b.id} style={{
                                        display: "flex", alignItems: "center", gap: 6,
                                        background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                                        borderRadius: 20, padding: "4px 10px", fontSize: 12, color: COLORS.textPrimary,
                                    }}>
                                        {b.barcode}
                                        <span onClick={() => removeAltBarcode(b.id)} style={{ cursor: "pointer", color: COLORS.red, fontWeight: 700 }}>×</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {barcodes.map((b, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                            <input value={b.batch_number} onChange={(e) => updateBarcode(i, "batch_number", e.target.value)} placeholder="رقم التشغيلة"
                                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                            <input value={b.serial_number} onChange={(e) => updateBarcode(i, "serial_number", e.target.value)} placeholder="الرقم التسلسلي"
                                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                            <input value={b.expiry_date} onChange={(e) => updateBarcode(i, "expiry_date", e.target.value)} type="date"
                                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                            {barcodes.length > 1 && <Btn size="sm" variant="danger" onClick={() => removeBarcode(i)}>✕</Btn>}
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                    <Btn variant="ghost" onClick={onClose}>إلغاء</Btn>
                    <Btn icon="check" onClick={save}>{editingId ? "حفظ التعديل" : "إضافة الصنف"}</Btn>
                </div>
            </Modal>

            {/* 🆕 modal إضافة نوع صنف جديد — بديل عن window.prompt() غير المدعومة في Electron */}
            <Modal open={showItemTypePrompt} onClose={() => setShowItemTypePrompt(false)} title="➕ إضافة نوع جديد" zIndex={1200}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Input
                        value={itemTypePromptValue}
                        onChange={(v) => setItemTypePromptValue(v)}
                        placeholder="اسم النوع بالعربي (مثال: شامبو)"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && confirmAddItemType()}
                    />
                    <Input
                        value={itemTypePromptValueEn}
                        onChange={(v) => setItemTypePromptValueEn(v)}
                        placeholder="الاسم بالإنجليزي (اختياري — مثال: Shampoo)"
                        onKeyDown={(e) => e.key === "Enter" && confirmAddItemType()}
                    />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <Btn variant="ghost" onClick={() => setShowItemTypePrompt(false)}>إلغاء</Btn>
                        <Btn icon="check" onClick={confirmAddItemType}>إضافة</Btn>
                    </div>
                </div>
            </Modal>
            <Modal open={showSubCat2Prompt} onClose={() => setShowSubCat2Prompt(false)} title="➕ إضافة شكل صيدلاني جديد" zIndex={1200}>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Input value={subCat2PromptValue} onChange={(v) => setSubCat2PromptValue(v)} placeholder="اسم الشكل بالعربي (مثال: عناية بالفم)" autoFocus onKeyDown={(e) => e.key === "Enter" && confirmAddSubCat2()} />
        <Input value={subCat2PromptValueEn} onChange={(v) => setSubCat2PromptValueEn(v)} placeholder="الاسم بالإنجليزي (اختياري)" onKeyDown={(e) => e.key === "Enter" && confirmAddSubCat2()} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowSubCat2Prompt(false)}>إلغاء</Btn>
            <Btn icon="check" onClick={confirmAddSubCat2}>إضافة</Btn>
        </div>
    </div>
</Modal>
             <Modal open={!!showManageModal} onClose={() => setShowManageModal(null)} title={showManageModal === "itemType" ? "🗑 إدارة الأنواع" : showManageModal === "sizeUnit" ? "🗑 إدارة الوحدات" : "🗑 إدارة الأشكال الصيدلانية"} zIndex={1200}>
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
        {(showManageModal === "itemType" ? itemTypes : showManageModal === "sizeUnit" ? sizeUnits : subCategories2.filter((s) => s.main_category === form.mainCategory)).map((item) => {
            const inUse = products.some((p) => showManageModal === "itemType" ? p.item_type === item.name_ar : showManageModal === "sizeUnit" ? (p.size_unit === item.name_ar) : p.sub_category2 === item.name_ar);
            return (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                    <span>{item.name_ar}{inUse && <span style={{ color: COLORS.gold, fontSize: 11 }}> (مستخدم في أصناف حالية)</span>}</span>
                    <Btn size="sm" variant="danger" onClick={async () => {
                        if (inUse && !window.confirm(`"${item.name_ar}" مستخدم في أصناف حالية بالفعل. متأكد تحذفه من القائمة؟ (الأصناف الموجودة مش هتتأثر)`)) return;
                        if (showManageModal === "itemType") {
                            await deleteItemType(item.id, pharmacyId);
                            setItemTypes((prev) => prev.filter((x) => x.id !== item.id));
                        } else if (showManageModal === "sizeUnit") {
                            await deleteSizeUnit(item.id, pharmacyId);
                            setSizeUnits((prev) => prev.filter((x) => x.id !== item.id));
                        } else {
                            await deleteSubCategory2(item.id, pharmacyId);
                            setSubCategories2((prev) => prev.filter((x) => x.id !== item.id));
                        }
                    }}>حذف</Btn>
                </div>
            );
        })}
    </div>
</Modal>  
            {/* 🆕 modal إضافة وحدة جديدة — نفس نمط نوع الصنف والشكل الصيدلاني بالظبط */}
            <Modal open={showUnitPrompt} onClose={() => setShowUnitPrompt(false)} title="➕ إضافة وحدة جديدة" zIndex={1200}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Input
                        value={unitPromptValue}
                        onChange={(v) => setUnitPromptValue(v)}
                        placeholder="اسم الوحدة بالعربي (مثال: كيس)"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && confirmAddUnit()}
                    />
                    <Input
                        value={unitPromptValueEn}
                        onChange={(v) => setUnitPromptValueEn(v)}
                        placeholder="الاسم بالإنجليزي (اختياري — مثال: Sachet)"
                        onKeyDown={(e) => e.key === "Enter" && confirmAddUnit()}
                    />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <Btn variant="ghost" onClick={() => setShowUnitPrompt(false)}>إلغاء</Btn>
                        <Btn icon="check" onClick={confirmAddUnit}>إضافة</Btn>
                    </div>
                </div>
            </Modal>
            {/* 🆕 modal إضافة شركة منتجة سريعة — نفس السبب، بديل عن window.prompt() */}
            <Modal open={showMfrPrompt} onClose={() => setShowMfrPrompt(false)} title="🏭 إضافة شركة منتجة جديدة" zIndex={1200}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <Input
                        value={mfrPromptValue}
                        onChange={(v) => setMfrPromptValue(v)}
                        placeholder="اسم الشركة المنتجة الجديدة"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && confirmAddManufacturer()}
                    />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <Btn variant="ghost" onClick={() => setShowMfrPrompt(false)}>إلغاء</Btn>
                        <Btn icon="check" onClick={confirmAddManufacturer}>إضافة</Btn>
                    </div>
                </div>
            </Modal>
        </>
    );
}
