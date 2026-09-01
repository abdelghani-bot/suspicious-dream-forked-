import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { logAudit } from "../lib/auditLog";
import { extractPrimaryBarcode, normGtin } from "../lib/barcodeUtils";
import { normalizeArabicText } from "../lib/searchUtils"; // 🆕 بحث مرن (تطبيع الهمزات/التاء المربوطة + مطابقة كلمات)
import { computeStockoutForecast } from "../lib/inventoryUtils";
import { ProductFormModal } from "./ProductFormModal";
import { Badge, Btn, Modal, Pagination, StatCard, Table } from "../ui/primitives";
import { saveProduct, replaceProductBarcodes, replaceProductIngredients } from "../lib/offlineAPI";

// 🆕 هيدر عمود قابل للضغط: بيفلتر الأصناف اللي القيمة دي عندها فاضية، وبيوريك العدد
const HeaderFilterToggle = ({ label, active, count, onClick }) => (
    <div onClick={onClick} style={{ cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span style={{ color: active ? COLORS.accent : COLORS.textDim }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: active ? COLORS.accent : (count > 0 ? COLORS.red : COLORS.border) }}>
            {active ? "✓ عرض الناقصة" : count > 0 ? `${count} ناقص` : "—"}
        </span>
    </div>
);

export function ProductsModule({ products, setProducts, suppliers, sales, purchases, showToast, pharmacyId, currentUser, canAdd = true, canDelete = true, canEdit = true, jokerPendingItems = [], setJokerPendingItems = () => { } }) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(""); // 🆕 القيمة المستخدمة فعليًا في الفلترة، بتتحدث بعد وقفة قصيرة عن الكتابة
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showLowStock, setShowLowStock] = useState(false);
    const [showSlowProducts, setShowSlowProducts] = useState(false);
    const [showStockoutForecast, setShowStockoutForecast] = useState(false);
    // 🆕 Pagination — قايمة الأصناف ممكن توصل لمئات/آلاف الصفوف، فبنعرضها صفحة صفحة.
    const PRODUCTS_PAGE_SIZE = 25;
    const [productsPage, setProductsPage] = useState(1);

    // 🆕 فلاتر إضافية: فئة / شركة منتجة / مادة فعالة / مدى سعر البيع + ترتيب أبجدي —
    // صف واحد تحت شريط البحث بدل مودال منفصل، لأن العناصر قليلة (5) وانت بتفلتر
    // وانت أصلاً بتشتغل بسرعة على الجدول.
    const [filterCategory, setFilterCategory] = useState("");
    const [filterManufacturer, setFilterManufacturer] = useState("");
    const [filterIngredient, setFilterIngredient] = useState("");
    const [filterPriceMin, setFilterPriceMin] = useState("");
    const [filterPriceMax, setFilterPriceMax] = useState("");
    const [sortAlpha, setSortAlpha] = useState("none"); // "none" | "asc" | "desc"
    const [filterNoBarcode, setFilterNoBarcode] = useState(false);
    const [filterNoCategory, setFilterNoCategory] = useState(false);
    const [filterNoSupplier, setFilterNoSupplier] = useState(false);

    useEffect(() => {
        setProductsPage(1);
    }, [debouncedSearch, filterCategory, filterManufacturer, filterIngredient, filterPriceMin, filterPriceMax, sortAlpha, filterNoBarcode, filterNoCategory, filterNoSupplier]);

    // 🆕 debounce: بنستنى المستخدم يوقف عن الكتابة 250ms قبل ما نعيد فلترة قايمة الأصناف
    // (اللي ممكن توصل لمئات/آلاف)، بدل ما نعيد الفلترة الكاملة مع كل حرف بيتكتب — ده اللي
    // كان بيحسّس بالتقل وقت البحث السريع.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(t);
    }, [search]);

    // ── الشركات المنتجة (لعرض الجدول وشاشة الإدارة) ──
    const [manufacturers, setManufacturers] = useState([]);
    const [showMfrModal, setShowMfrModal] = useState(false);
    const [newMfrName, setNewMfrName] = useState("");
    // 🆕 لو نافذة "إدارة الشركات" اتفتحت من جوه فورم إضافة الصنف (زر "أضفها من هنا")،
    // نسجّل ده هنا عشان بعد ما تتحفظ الشركة نقفل نافذة الشركات تلقائيًا ونرجّع
    // الشركة الجديدة للفورم يختارها لوحده، بدل ما تضيع.
    const [mfrModalFromProductForm, setMfrModalFromProductForm] = useState(false);
    const [pendingManufacturerForForm, setPendingManufacturerForForm] = useState(null);
    const [showDuplicates, setShowDuplicates] = useState(false);
    const [duplicatesList, setDuplicatesList] = useState([]);
    const [loadingDuplicates, setLoadingDuplicates] = useState(false);
    const [mergingKey, setMergingKey] = useState(null);
    useEffect(() => {
        supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId).order("name")
            .then(({ data }) => { if (data) setManufacturers(data); });
    }, [pharmacyId]);

    // 🆕 قايمة الفئات الفريدة من الأصناف الموجودة فعليًا (مش من جدول منفصل) — عشان فلتر
    // الفئة يعرض بس الفئات المستخدمة فعلاً في المخزون، مش كل فئات SFDA النظرية.
    const uniqueCategories = useMemo(() => {
        const set = new Set(products.map((p) => p.mainCategory || p.category).filter(Boolean));
        return [...set].sort((a, b) => a.localeCompare(b, "ar"));
    }, [products]);

    // 🆕 عدادات "ناقص بيانات" لهيدرات الجدول (باركود / فئة / مورد) — بتتحدث تلقائيًا مع أي تعديل على products
    const noBarcodeCount = useMemo(() => products.filter((p) => !p.barcode || String(p.barcode).trim() === "").length, [products]);
    const noCategoryCount = useMemo(() => products.filter((p) => !(p.mainCategory || p.category) || String(p.mainCategory || p.category).trim() === "").length, [products]);
    const noSupplierCount = useMemo(() => products.filter((p) => !p.supplier || String(p.supplier).trim() === "").length, [products]);

    // 🆕 بحث مرن: بيطبّع الهمزات/التاء المربوطة/التشكيل، وبيقسّم النص لكلمات (Token) بدل
    // مطابقة كتلة واحدة — يعني "بندول اكسترا" و"اكسترا بندول" بيرجعوا نفس النتيجة، وبيدور
    // في الاسم العربي والإنجليزي والفئة والكلمات المفتاحية مع بعض بدل خانة واحدة بس.
    // 🆕 دلوقتي بقت useMemo لأنها بتتوقف على فلاتر تانية (فئة/شركة/مادة فعالة/سعر/ترتيب)
    // مش بس على debouncedSearch، فمن غير useMemo كانت هتتحسب من جديد مع كل render.
    const filtered = useMemo(() => {
        const priceMin = filterPriceMin === "" ? null : Number(filterPriceMin);
        const priceMax = filterPriceMax === "" ? null : Number(filterPriceMax);

        const base = products.filter((p) => {
            const str = (v) => (v == null ? "" : String(v));
            const qTokens = normalizeArabicText(debouncedSearch).split(/\s+/).filter(Boolean);
            // 🆕 لو النص المكتوب/المتسحوح ده باركود GS1 (QR فيه AIs زي (01).. (17).. (10)..) أو
            // الشكل البديل CODE*YYMMDD، بنستخرج منه الباركود الأساسي بس (زي منطق سكانر نقطة
            // البيع) عشان نقدر نطابقه بسرعة مع باركود الصنف، بدل ما نقارن النص الخام الطويل كله.
            const primaryBarcode = extractPrimaryBarcode(debouncedSearch);

            const haystack = normalizeArabicText(
                [p.nameAr || p.name, p.nameEn, p.barcode, p.id, p.mainCategory || p.category, p.search_keywords]
                    .filter(Boolean).join(" ")
            );
            // 🔧 لو خانة البحث فاضية أصلاً (مفيش tokens ومفيش باركود مستخرج)، مطابقة البحث
            // بتعتبر "ماشية" (true) — قبل الإصلاح القديم كانت الحالة دي بترجع false فتفضل
            // القايمة فاضية لحد ما تكتب حرف.
            const searchOk = (() => {
                if (qTokens.length === 0 && !primaryBarcode) return true;
                const matchesText = qTokens.length > 0 && qTokens.every((t) => haystack.includes(t));
                const matchesBarcode = !!(primaryBarcode && primaryBarcode !== debouncedSearch &&
                    (normGtin(str(p.barcode)) === normGtin(primaryBarcode) || str(p.barcode).includes(primaryBarcode)));
                return matchesText || matchesBarcode;
            })();
            if (!searchOk) return false;

            // 🆕 فلتر الفئة (dropdown من uniqueCategories)
            if (filterCategory && (p.mainCategory || p.category) !== filterCategory) return false;

            // 🆕 فلتر الشركة المنتجة (dropdown من نفس مصفوفة manufacturers الموجودة أصلاً)
            if (filterManufacturer && String(p.manufacturer_id) !== String(filterManufacturer)) return false;

            // 🆕 فلتر المادة الفعالة: بحث نصي مرن مش dropdown، لأن المواد الفعالة كتير جدًا
            // ومتنوعة (نفس سبب استخدام active_ingredient/full_ingredients_text في العرض).
            if (filterIngredient) {
                const ingHaystack = normalizeArabicText(
                    [p.active_ingredient, p.full_ingredients_text].filter(Boolean).join(" ")
                );
                if (!ingHaystack.includes(normalizeArabicText(filterIngredient))) return false;
            }

            // 🆕 فلتر مدى سعر البيع (من/إلى) — أي طرف فاضي معناه من غير حد في الاتجاه ده.
            const price = Number(p.price) || 0;
            if (priceMin !== null && price < priceMin) return false;
            if (priceMax !== null && price > priceMax) return false;

            // 🆕 فلاتر "ناقص بيانات": بدون باركود / بدون فئة / بدون مورد — كل واحد بيتفعّل من هيدر عموده في الجدول
            if (filterNoBarcode && p.barcode && String(p.barcode).trim() !== "") return false;
            if (filterNoCategory && (p.mainCategory || p.category) && String(p.mainCategory || p.category).trim() !== "") return false;
            if (filterNoSupplier && p.supplier && String(p.supplier).trim() !== "") return false;

            return true;
        });

        // 🆕 ترتيب أبجدي اختياري بالاسم العربي (أو الإنجليزي لو مفيش اسم عربي)، بيتطبق
        // بعد كل الفلاتر فوق عشان الترتيب يبقى على النتيجة النهائية بس.
        if (sortAlpha === "none") return base;
        return [...base].sort((a, b) => {
            const an = a.nameAr || a.name || "";
            const bn = b.nameAr || b.name || "";
            return sortAlpha === "asc" ? an.localeCompare(bn, "ar") : bn.localeCompare(an, "ar");
        });
    }, [products, debouncedSearch, filterCategory, filterManufacturer, filterIngredient, filterPriceMin, filterPriceMax, sortAlpha, filterNoBarcode, filterNoCategory, filterNoSupplier]);

    // ── فتح تعديل / إضافة (النموذج نفسه بقى في ProductFormModal) ──
    const openEdit = (p) => { setEditingId(p.id); setShowForm(true); };
    const openAdd = () => { setEditingId(null); setShowForm(true); };

    // ── إدارة الشركات المنتجة ──
    const addManufacturer = async () => {
        if (!newMfrName.trim()) return;
        const { data, error } = await supabase.from("manufacturers").insert({ name: newMfrName.trim(), pharmacy_id: pharmacyId }).select().single();
        if (error) { showToast("خطأ: " + error.message, "error"); return; }
        setManufacturers((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
        setNewMfrName("");
        showToast("تمت إضافة الشركة ✓");
        // 🆕 لو جاي من فورم الصنف، ارجع له فورًا بالشركة الجديدة مختارة، وقفل نافذة الشركات
        if (mfrModalFromProductForm) {
            setPendingManufacturerForForm({ id: data.id, name: data.name, ts: Date.now() });
            setShowMfrModal(false);
            setMfrModalFromProductForm(false);
        }
    };

    const deleteManufacturer = async (id) => {
        const { error } = await supabase.from("manufacturers").delete().eq("id", id).eq("pharmacy_id", pharmacyId);
        if (error) { showToast("خطأ: " + error.message, "error"); return; }
        setManufacturers((p) => p.filter((m) => m.id !== id));
        showToast("تم الحذف");
    };
    // ── فحص ودمج الأصناف المكررة ──
    const checkDuplicates = async () => {
        setShowDuplicates(true);
        setLoadingDuplicates(true);
        const { data, error } = await supabase.rpc("find_duplicate_products", {
            p_pharmacy_id: pharmacyId,
            p_min_similarity: 0.6,
        });
        setLoadingDuplicates(false);
        if (error) { showToast("خطأ: " + error.message, "error"); return; }
        setDuplicatesList(data || []);
    };

    const mergeDuplicate = async (row) => {
        const keepId = row.barcode_1 ? row.id_1 : row.id_2;
        const removeId = row.barcode_1 ? row.id_2 : row.id_1;
        const keepName = row.barcode_1 ? row.name_1 : row.name_2;
        const removeName = row.barcode_1 ? row.name_2 : row.name_1;

        const confirmed = window.confirm(
            `هيتم دمج "${removeName}" في "${keepName}"، ونقل كل الكمية والدفعات إليه، وحذف الصنف الناقص.\nمتأكد إنك عايز تكمل؟ الإجراء ده مش هيتراجع.`
        );
        if (!confirmed) return;

        const rowKey = row.id_1 + row.id_2;
        setMergingKey(rowKey);
        const { data, error } = await supabase.rpc("merge_duplicate_products", {
            p_keep_id: keepId,
            p_remove_id: removeId,
        });
        setMergingKey(null);

        if (error) { showToast("خطأ: " + error.message, "error"); return; }

        logAudit({
            pharmacyId, userName: currentUser?.name, action: "merge", entityType: "product",
            entityId: keepId, entityLabel: keepName,
            oldValue: { removedId: removeId, removedName: removeName },
            description: `دمج الصنف المكرر "${removeName}" في "${keepName}"`,
        });

        setProducts((prev) => prev
            .filter((p) => p.id !== removeId)
            .map((p) => p.id === keepId ? { ...p, stock: data.merged_stock } : p));
        setDuplicatesList((prev) => prev.filter((r) => !(r.id_1 === row.id_1 && r.id_2 === row.id_2)));
        showToast("تم الدمج بنجاح ✓");
    };
    const inputStyle = { background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

    // 🆕 مجموعة IDs لأي صنف له تاريخ بيع أو شراء **على الإطلاق** (مش آخر 30 يوم بس زي
    // movementStatsByProduct تحت، اللي غرضها تصنيف الحركة الحديثة مش حماية الحذف).
    // ده أساس حماية الحذف: صنف مخزونه صفر دلوقتي لكن ليه حركة تاريخية (بيع/شراء، حتى
    // لو طلبية لسه مسودة/مش مستلمة) لازم يفضل موجود عشان الفواتير/التقارير القديمة
    // تفضل شايفة اسمه بدل ما ترجع لصنف محذوف.
    const historyProductIds = useMemo(() => {
        const ids = new Set();
        (sales || []).forEach((s) => (s.items || []).forEach((i) => {
            const pid = i?.id ?? i?.productId ?? i?.product_id;
            if (pid != null) ids.add(pid);
        }));
        (purchases || []).forEach((pu) => (pu.items || []).forEach((i) => {
            const pid = i?.id ?? i?.productId ?? i?.product_id;
            if (pid != null) ids.add(pid);
        }));
        return ids;
    }, [sales, purchases]);

    // 🆕 useMemo: القايمة دي كانت بتتحسب من جديد مع كل render (كل حرف في البحث مثلاً)
    // حتى لو مودال المخزون المنخفض مقفول أصلاً — دلوقتي بتتحسب بس لما products يتغير.
    const lowStockList = useMemo(() => products
        .filter((p) => (p.stock ?? 0) <= (p.minStock || p.min_stock || 0))
        .sort((a, b) => {
            const aEss = (a.is_essential || a.isEssential) ? 1 : 0;
            const bEss = (b.is_essential || b.isEssential) ? 1 : 0;
            return bEss - aEss;
        }), [products]);

    // ========== تصنيف حركة الصنف (سريع/بطيء) ==========
    // 🆕 بدل ما ندوّر في مصفوفة sales كاملة لكل صنف لوحده (تكلفة = عدد الأصناف × عدد
    // المبيعات، وده كان بيتكرر مع كل render)، بنعمل مرور واحد بس على sales ونبني
    // تجميعة (عدد مرات البيع + الأيام المميزة) لكل صنف مرة واحدة، وبعدين getMovementClass
    // بيقرا من التجميعة دي مباشرة. نفس منطق الحساب الأصلي بالظبط (صنف واحد لكل عملية بيع).
    const movementStatsByProduct = useMemo(() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const stats = {};
        (sales || []).forEach((s) => {
            const saleDate = new Date(s.date);
            if (saleDate < thirtyDaysAgo) return;
            const idsInSale = new Set((s.items || []).map((i) => i?.id).filter(Boolean));
            idsInSale.forEach((id) => {
                if (!stats[id]) stats[id] = { count: 0, days: new Set() };
                stats[id].count += 1;
                stats[id].days.add(s.date);
            });
        });
        return stats;
    }, [sales]);

    const getMovementClass = (productId) => {
        const st = movementStatsByProduct[productId];
        const salesDays = st ? st.days.size : 0;
        const salesCount = st ? st.count : 0;
        if (salesDays >= 21) return { class: "fast", label: "سريع جداً", color: COLORS.green };
        if (salesDays >= 10) return { class: "regular", label: "منتظم", color: COLORS.blue };
        if (salesCount >= 5) return { class: "normal", label: "عادي", color: "#aaaaaa" };
        if (salesCount >= 1) return { class: "slow", label: "بطيء", color: COLORS.gold };
        return { class: "very_slow", label: "بطيء جداً", color: COLORS.red };
    };

    // 🆕 useMemo: بتعتمد على movementStatsByProduct (اللي أصلاً محسوبة مسبقًا)، فبقت
    // خفيفة، لكن برضه محتاجة تتحسب بس لما products أو الإحصائية تتغير مش مع كل render.
    const slowProducts = useMemo(() => (products || [])
        .filter((p) => { const mv = getMovementClass(p.id); return (mv.class === "slow" || mv.class === "very_slow") && p.stock > 0; })
        .sort((a, b) => (b.cost || 0) - (a.cost || 0)), [products, movementStatsByProduct]);

    // ========== توقع نفاد المخزون: بدل ما ننتظر المخزون يوصل للحد الأدنى، نحسب
    // معدل البيع اليومي الفعلي في آخر 30 يوم ونتوقع كام يوم متبقي قبل ما الصنف ينفد ==========
    const STOCKOUT_WINDOW_DAYS = 30;
    const STOCKOUT_WARNING_DAYS = 14; // نطلع تنبيه لو متبقي 14 يوم أو أقل قبل النفاد
    const getStockoutForecast = (productId, currentStock) =>
        computeStockoutForecast(sales, productId, currentStock, STOCKOUT_WINDOW_DAYS);

    // 🆕 useMemo: كانت بتعيد حساب توقع النفاد لكل الأصناف مع كل render — بقت بس لما
    // products أو sales يتغيروا فعليًا.
    const stockoutForecastList = useMemo(() => (products || [])
        .filter((p) => (p.stock ?? 0) > 0)
        .map((p) => ({ product: p, forecast: getStockoutForecast(p.id, p.stock ?? 0) }))
        .filter((x) => x.forecast && x.forecast.daysLeft <= STOCKOUT_WARNING_DAYS)
        .sort((a, b) => a.forecast.daysLeft - b.forecast.daysLeft), [products, sales]);

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>إدارة الأصناف</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <Btn icon="settings" variant="secondary" onClick={() => { setMfrModalFromProductForm(false); setShowMfrModal(true); }}>الشركات المنتجة</Btn>
                    {canAdd && <Btn icon="plus" onClick={openAdd}>إضافة صنف</Btn>}
                    <Btn icon="refresh" onClick={checkDuplicates}>
                        فحص الأصناف المكررة
                    </Btn>
                </div>
            </div>

            {/* ── Search ── */}
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الباركود أو الفئة..."
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

            {/* ── فلاتر إضافية: صف واحد بدل مودال، عشان العدد قليل والفلترة بتتم وانت بتشتغل ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ ...inputStyle, width: "auto", minWidth: 130 }}>
                    <option value="">كل الفئات</option>
                    {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterManufacturer} onChange={(e) => setFilterManufacturer(e.target.value)}
                    style={{ ...inputStyle, width: "auto", minWidth: 150 }}>
                    <option value="">كل الشركات</option>
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input value={filterIngredient} onChange={(e) => setFilterIngredient(e.target.value)}
                    placeholder="بحث بالمادة الفعالة..."
                    style={{ ...inputStyle, width: "auto", minWidth: 160, flex: 1 }} />
                <input value={filterPriceMin} onChange={(e) => setFilterPriceMin(e.target.value)}
                    type="number" placeholder="سعر من" min={0}
                    style={{ ...inputStyle, width: 90 }} />
                <input value={filterPriceMax} onChange={(e) => setFilterPriceMax(e.target.value)}
                    type="number" placeholder="سعر إلى" min={0}
                    style={{ ...inputStyle, width: 90 }} />
                <Btn size="sm" variant="secondary"
                    onClick={() => setSortAlpha((s) => s === "none" ? "asc" : s === "asc" ? "desc" : "none")}>
                    {sortAlpha === "none" ? "🔤 بدون ترتيب" : sortAlpha === "asc" ? "🔤 أ ← ي" : "🔤 ي ← أ"}
                </Btn>
                {(filterCategory || filterManufacturer || filterIngredient || filterPriceMin !== "" || filterPriceMax !== "" || sortAlpha !== "none" || filterNoBarcode || filterNoCategory || filterNoSupplier) && (
                    <Btn size="sm" variant="secondary" onClick={() => {
                        setFilterCategory(""); setFilterManufacturer(""); setFilterIngredient("");
                        setFilterPriceMin(""); setFilterPriceMax(""); setSortAlpha("none");
                        setFilterNoBarcode(false); setFilterNoCategory(false); setFilterNoSupplier(false);
                    }}>✕ مسح الفلاتر</Btn>
                )}
            </div>

            {/* ── Stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 16 }}>
                <StatCard label="إجمالي الأصناف" value={products.length} icon="inventory" color={COLORS.blue} />
                <div onClick={() => setShowLowStock(true)} style={{ cursor: "pointer" }}>
                    <StatCard label="مخزون منخفض" value={lowStockList.length} icon="alert" color={COLORS.gold} />
                </div>
                <div onClick={() => setShowSlowProducts(true)} style={{ cursor: "pointer" }}>
                    <StatCard label="أصناف بطيئة" value={slowProducts.length} icon="alert" color={COLORS.red} />
                </div>
                <div onClick={() => setShowStockoutForecast(true)} style={{ cursor: "pointer" }}>
                    <StatCard label="⏳ توقع قرب النفاد" value={stockoutForecastList.length} icon="alert" color={COLORS.coral} />
                </div>
                <StatCard label="أدوية أساسية" value={products.filter((p) => p.is_essential || p.isEssential).length} icon="pill" color={COLORS.gold} />
                <StatCard label="قيمة المخزون" value={products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0).toFixed(0) + " ر.س"} icon="money" color={COLORS.purple} />
            </div>

            {/* ── Table ── */}
            <Table
                headers={[
                    "رمز", "الصنف",
                    <HeaderFilterToggle label="الشركة المنتجة / المورد" active={filterNoSupplier} count={noSupplierCount} onClick={() => setFilterNoSupplier((v) => !v)} />,
                    <HeaderFilterToggle label="الباركود" active={filterNoBarcode} count={noBarcodeCount} onClick={() => setFilterNoBarcode((v) => !v)} />,
                    <HeaderFilterToggle label="الفئة" active={filterNoCategory} count={noCategoryCount} onClick={() => setFilterNoCategory((v) => !v)} />,
                    "سعر البيع", "التكلفة", "أساسي", "إجراءات",
                ]}
                rows={filtered.slice((productsPage - 1) * PRODUCTS_PAGE_SIZE, productsPage * PRODUCTS_PAGE_SIZE).map((p) => {
                    const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
                    return [
                        <span style={{ color: COLORS.textDim, fontSize: 11 }}>{p.id}</span>,
                        <div>
                            <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{p.nameAr || p.name}</div>
                            {p.nameEn && <div style={{ fontSize: 11, color: COLORS.textDim }}>{p.nameEn}</div>}
                            <div style={{ fontSize: 10, color: COLORS.border }}>{p.full_ingredients_text || `${p.active_ingredient || ""} ${p.concentration || ""}`.trim()}</div>
                        </div>,
                        <div>
                            {mfr ? <Badge color={COLORS.blueSoft} text={COLORS.blue}>{mfr.name}</Badge> : <span style={{ color: COLORS.border, fontSize: 11 }}>—</span>}
                            {p.supplier && <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 3 }}>المورد: {p.supplier}</div>}
                        </div>,
                        <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "monospace" }}>{p.barcode}</span>,
                        <div>
                            <Badge>{p.mainCategory || p.category}</Badge>
                            {p.subCategory2 && <div style={{ fontSize: 10, color: COLORS.border, marginTop: 3 }}>{p.subCategory1 && p.subCategory1 + " · "}{p.subCategory2}</div>}
                        </div>,
                        <span style={{ color: COLORS.blue, fontWeight: 700 }}>{p.price} ر.س</span>,
                        <span style={{ color: COLORS.textDim }}>{p.cost} ر.س</span>,
                        (p.is_essential || p.isEssential) ? <Badge color={COLORS.goldSoft} text={COLORS.gold}>⭐ أساسي</Badge> : <span style={{ color: COLORS.textDim, fontSize: 11 }}>—</span>,
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(p.not_available_market) && (
                                p.shortage_report_url
                                    ? <a href={p.shortage_report_url} target="_blank" rel="noreferrer"><Badge color={COLORS.redSoft} text={COLORS.red}>🚫 غير متوفر</Badge></a>
                                    : <Badge color={COLORS.redSoft} text={COLORS.red}>🚫 غير متوفر</Badge>
                            )}
                            <div style={{ display: "flex", gap: 5 }}>
                                {canEdit && <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEdit(p)}>تعديل</Btn>}
                                {/* 🆕 حماية الحذف على مستويين:
                                    1) مخزون حالي > 0 → منع كامل (الزرار بيختفي) — مفيش سبب منطقي تحذف
                                       صنف لسه فيه بضاعة فعلية على الرف.
                                    2) مخزون = 0 لكن له تاريخ بيع/شراء (historyProductIds) → مسموح بالحذف
                                       لكن بتحذير معزز موضّح فيه إن الصنف ده مربوط بفواتير قديمة، عشان
                                       تفضل قادر تنضّف أصناف قديمة اتوقفت فعلاً لو احتجت، من غير منع كامل. */}
                                {canDelete && (
                                    (p.stock ?? 0) > 0 ? (
                                        <span style={{ fontSize: 10, color: COLORS.textDim }}
                                            title="مينفعش تحذف صنف لسه ليه مخزون — لازم تصفير المخزون الأول (بيع أو تسوية جرد)">
                                            🔒 له مخزون ({p.stock})
                                        </span>
                                    ) : (
                                        <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                                            const hasHistory = historyProductIds.has(p.id);
                                            // 🆕 رسالة تأكيد مختلفة لو الصنف له تاريخ بيع/شراء — تحذير معزز
                                            // بدل ما يبقى نفس تأكيد الحذف العادي، عشان تاخد قرار واعي.
                                            const confirmMsg = hasHistory
                                                ? `⚠️ الصنف "${p.nameAr || p.name}" مخزونه صفر لكن له فواتير بيع/شراء سابقة مرتبطة بيه.\nحذفه ممكن يأثر على عرض الفواتير/التقارير القديمة اللي بتشاور عليه.\nمتأكد إنك عايز تكمل الحذف؟ الإجراء ده مش هيتراجع.`
                                                : `متأكد إنك عايز تحذف الصنف "${p.nameAr || p.name}"؟ الإجراء ده مش هيتراجع.`;
                                            const confirmed = window.confirm(confirmMsg);
                                            if (!confirmed) return;
                                            const { error } = await supabase.from("products").delete().eq("id", p.id).eq("pharmacy_id", pharmacyId);
                                            if (error) { showToast("خطأ: " + error.message, "error"); return; }
                                            logAudit({
                                                pharmacyId, userName: currentUser?.name, action: "delete", entityType: "product",
                                                entityId: p.id, entityLabel: p.nameAr || p.name,
                                                oldValue: { name: p.nameAr || p.name, price: p.price, cost: p.cost, barcode: p.barcode, hadHistory: hasHistory },
                                                description: `حذف الصنف "${p.nameAr || p.name}"${hasHistory ? " (كان له تاريخ بيع/شراء)" : ""}`,
                                            });
                                            setProducts((prev) => prev.filter((x) => x.id !== p.id));
                                            showToast("تم حذف الصنف");
                                        }}>حذف</Btn>
                                    )
                                )}
                            </div>
                        </div>,
                    ];
                })}
            />
            <Pagination page={productsPage} onPageChange={setProductsPage} totalItems={filtered.length} pageSize={PRODUCTS_PAGE_SIZE} />

            {/* ── Modal المخزون المنخفض ── */}
            <Modal open={showLowStock} onClose={() => setShowLowStock(false)} title="⚠️ الأصناف ذات المخزون المنخفض">
                {lowStockList.length === 0 ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف ناقصة حاليًا 👍</div>
                ) : (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                        {lowStockList.map((p) => {
                            const isEss = p.is_essential || p.isEssential;
                            return (
                                <div key={p.id} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                                    background: isEss ? COLORS.goldSoft : COLORS.surfaceAlt,
                                    border: `1px solid ${isEss ? COLORS.gold : COLORS.border}`,
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: isEss ? COLORS.gold : COLORS.textPrimary, fontSize: 13 }}>
                                            {isEss && "⭐ "}{p.nameAr || p.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                                            المتاح: {p.stock ?? 0} / الحد الأدنى: {p.minStock || p.min_stock || 0}
                                        </div>
                                    </div>
                                    {canEdit && <Btn size="sm" icon="edit" variant="secondary" onClick={() => { setShowLowStock(false); openEdit(p); }}>تعديل</Btn>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>

            {/* ── Modal الأصناف البطيئة ── */}
            <Modal open={showSlowProducts} onClose={() => setShowSlowProducts(false)} title="⚠️ أصناف بطيئة تحتاج تنشيط">
                {slowProducts.length === 0 ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف بطيئة حاليًا 👍</div>
                ) : (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                        {slowProducts.map((p) => {
                            const mv = getMovementClass(p.id);
                            const isEss = p.is_essential || p.isEssential;
                            return (
                                <div key={p.id} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                                    background: isEss ? COLORS.goldSoft : COLORS.redSoft,
                                    border: `1px solid ${isEss ? COLORS.gold : COLORS.goldSoft}`,
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: isEss ? COLORS.gold : COLORS.textPrimary, fontSize: 13 }}>
                                            {isEss && "⭐ "}{p.nameAr || p.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                                            مخزون: {p.stock} · تكلفة: {p.cost} ر.س
                                        </div>
                                    </div>
                                    <Badge color="#0a0800" text={mv.color}>{mv.label}</Badge>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>

            {/* ── Modal توقع نفاد المخزون ── */}
            <Modal open={showStockoutForecast} onClose={() => setShowStockoutForecast(false)} title="⏳ توقع نفاد المخزون">
                {stockoutForecastList.length === 0 ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف متوقع نفادها قريبًا 👍</div>
                ) : (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                        <div style={{ fontSize: 11.5, color: COLORS.textDim, marginBottom: 10 }}>
                            بناءً على معدل البيع الفعلي في آخر {STOCKOUT_WINDOW_DAYS} يوم — مش مجرد وصول لحد أدنى، ده توقع استباقي قبل ما المخزون ينفد فعليًا.
                        </div>
                        {stockoutForecastList.map(({ product: p, forecast }) => {
                            const isEss = p.is_essential || p.isEssential;
                            const urgent = forecast.daysLeft <= 3;
                            return (
                                <div key={p.id} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                                    background: urgent ? COLORS.redSoft : COLORS.goldSoft,
                                    border: `1px solid ${urgent ? COLORS.red : COLORS.gold}`,
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13 }}>
                                            {isEss && "⭐ "}{p.nameAr || p.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                                            المتاح: {p.stock ?? 0} · معدل البيع: {forecast.avgDailyQty.toFixed(1)} / يوم
                                        </div>
                                        <div style={{ fontSize: 11.5, color: urgent ? COLORS.red : COLORS.gold, marginTop: 3, fontWeight: 600 }}>
                                            "بناءً على معدل البيع الحالي، سينفد هذا الصنف بعد {forecast.daysLeft <= 0 ? "أقل من يوم" : `${forecast.daysLeft} ${forecast.daysLeft === 1 ? "يوم" : "أيام"}`}"
                                        </div>
                                    </div>
                                    {canEdit && <Btn size="sm" icon="edit" variant="secondary" onClick={() => { setShowStockoutForecast(false); openEdit(p); }}>تعديل</Btn>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>

            {/* ── Modal إدارة الشركات ── */}
            <Modal open={showMfrModal} onClose={() => { setShowMfrModal(false); setMfrModalFromProductForm(false); }} title="🏭 إدارة الشركات المنتجة" zIndex={1100}>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <input value={newMfrName} onChange={(e) => setNewMfrName(e.target.value)}
                        placeholder="اسم الشركة المنتجة..."
                        onKeyDown={(e) => e.key === "Enter" && addManufacturer()}
                        style={{ ...inputStyle, flex: 1 }} />
                    <Btn icon="plus" onClick={addManufacturer}>إضافة</Btn>
                </div>
                {manufacturers.length === 0 ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد شركات مضافة</div>
                ) : (
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                        {manufacturers.map((m) => (
                            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                                <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{m.name}</span>
                                <Btn size="sm" variant="danger" onClick={() => deleteManufacturer(m.id)}>حذف</Btn>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
             
             {/* ── Modal الأصناف المكررة ── */}
            <Modal open={showDuplicates} onClose={() => setShowDuplicates(false)} title="🔍 الأصناف المكررة المحتملة">
                {loadingDuplicates ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>جاري الفحص...</div>
                ) : duplicatesList.length === 0 ? (
                    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف مكررة حاليًا 👍</div>
                ) : (
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                        {duplicatesList.map((row) => {
                            const rowKey = row.id_1 + row.id_2;
                            return (
                                <div key={rowKey} style={{
                                    padding: "10px 12px", marginBottom: 8, borderRadius: 8,
                                    background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13 }}>{row.name_1}</div>
                                            <div style={{ fontSize: 11, color: COLORS.textDim }}>باركود: {row.barcode_1 || "— بدون باركود"} · سعر: {row.price_1} ر.س</div>
                                        </div>
                                        <span style={{ color: COLORS.border, fontSize: 16 }}>↔</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13 }}>{row.name_2}</div>
                                            <div style={{ fontSize: 11, color: COLORS.textDim }}>باركود: {row.barcode_2 || "— بدون باركود"} · سعر: {row.price_2} ر.س</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                        <Badge color={COLORS.blueSoft} text={COLORS.blue}>تطابق {Math.round((row.name_similarity || 0) * 100)}%</Badge>
                                        <Btn size="sm" variant="primary" disabled={mergingKey === rowKey} onClick={() => mergeDuplicate(row)}>
                                            {mergingKey === rowKey ? "جاري الدمج..." : "دمج"}
                                        </Btn>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>
            
            <ProductFormModal
                open={showForm}
                onClose={() => { setShowForm(false); setPendingManufacturerForForm(null); }}
                editingId={editingId}
                products={products}
                setProducts={setProducts}
                showToast={showToast}
                pharmacyId={pharmacyId}
                currentUser={currentUser}
                suppliers={suppliers}
                pendingManufacturer={pendingManufacturerForForm}
                onRequestAddManufacturer={() => { setMfrModalFromProductForm(true); setShowMfrModal(true); }}
                jokerPendingItems={jokerPendingItems}
                setJokerPendingItems={setJokerPendingItems}
                onSaved={() => { }}
            />
        </div>
    );
}
