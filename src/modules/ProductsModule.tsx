import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { logAudit } from "../lib/auditLog";
import { extractPrimaryBarcode, normGtin } from "../lib/barcodeUtils";
import { normalizeArabicText } from "../lib/searchUtils"; // 🆕 بحث مرن (تطبيع الهمزات/التاء المربوطة + مطابقة كلمات)
import { computeStockoutForecast } from "../lib/inventoryUtils";
import { ProductFormModal } from "./ProductFormModal";
import { Badge, Btn, Modal, Pagination, StatCard, Table } from "../ui/primitives";
import { saveProduct, replaceProductBarcodes, replaceProductIngredients } from "../lib/offlineAPI";

export function ProductsModule({ products, setProducts, suppliers, sales, purchases, showToast, pharmacyId, currentUser, canAdd = true, canDelete = true, canEdit = true, jokerPendingItems = [], setJokerPendingItems = () => { } }) {
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showLowStock, setShowLowStock] = useState(false);
    const [showSlowProducts, setShowSlowProducts] = useState(false);
    const [showStockoutForecast, setShowStockoutForecast] = useState(false);
    // 🆕 Pagination — قايمة الأصناف ممكن توصل لمئات/آلاف الصفوف، فبنعرضها صفحة صفحة.
    const PRODUCTS_PAGE_SIZE = 25;
    const [productsPage, setProductsPage] = useState(1);
    useEffect(() => { setProductsPage(1); }, [search]);

    // ── الشركات المنتجة (لعرض الجدول وشاشة الإدارة) ──
    const [manufacturers, setManufacturers] = useState([]);
    const [showMfrModal, setShowMfrModal] = useState(false);
    const [newMfrName, setNewMfrName] = useState("");
    // 🆕 لو نافذة "إدارة الشركات" اتفتحت من جوه فورم إضافة الصنف (زر "أضفها من هنا")،
    // نسجّل ده هنا عشان بعد ما تتحفظ الشركة نقفل نافذة الشركات تلقائيًا ونرجّع
    // الشركة الجديدة للفورم يختارها لوحده، بدل ما تضيع.
    const [mfrModalFromProductForm, setMfrModalFromProductForm] = useState(false);
    const [pendingManufacturerForForm, setPendingManufacturerForForm] = useState(null);

    useEffect(() => {
        supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId).order("name")
            .then(({ data }) => { if (data) setManufacturers(data); });
    }, [pharmacyId]);

    // 🆕 بحث مرن: بيطبّع الهمزات/التاء المربوطة/التشكيل، وبيقسّم النص لكلمات (Token) بدل
    // مطابقة كتلة واحدة — يعني "بندول اكسترا" و"اكسترا بندول" بيرجعوا نفس النتيجة، وبيدور
    // في الاسم العربي والإنجليزي والفئة والكلمات المفتاحية مع بعض بدل خانة واحدة بس.
    const filtered = products.filter((p) => {
        const str = (v) => (v == null ? "" : String(v));
        const qTokens = normalizeArabicText(search).split(/\s+/).filter(Boolean);
        // 🆕 لو النص المكتوب/المتسحوح ده باركود GS1 (QR فيه AIs زي (01).. (17).. (10)..) أو
        // الشكل البديل CODE*YYMMDD، بنستخرج منه الباركود الأساسي بس (زي منطق سكانر نقطة
        // البيع) عشان نقدر نطابقه بسرعة مع باركود الصنف، بدل ما نقارن النص الخام الطويل كله.
        const primaryBarcode = extractPrimaryBarcode(search);

        const haystack = normalizeArabicText(
            [p.nameAr || p.name, p.nameEn, p.barcode, p.id, p.mainCategory || p.category, p.search_keywords]
                .filter(Boolean).join(" ")
        );
        // 🔧 لو خانة البحث فاضية أصلاً (مفيش tokens ومفيش باركود مستخرج)، لازم نعرض كل
        // الأصناف بدل ما نستبعدهم كلهم — قبل الإصلاح ده كانت matchesText/matchesBarcode
        // بترجع false للاتنين لما search="" فتفضل القايمة فاضية لحد ما تكتب حرف.
        if (qTokens.length === 0 && !primaryBarcode) return true;

        const matchesText = qTokens.length > 0 && qTokens.every((t) => haystack.includes(t));

        const matchesBarcode = !!(primaryBarcode && primaryBarcode !== search &&
            (normGtin(str(p.barcode)) === normGtin(primaryBarcode) || str(p.barcode).includes(primaryBarcode)));

        return matchesText || matchesBarcode;
    });

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

    const inputStyle = { background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

    const lowStockList = products
        .filter((p) => (p.stock ?? 0) <= (p.minStock || p.min_stock || 0))
        .sort((a, b) => {
            const aEss = (a.is_essential || a.isEssential) ? 1 : 0;
            const bEss = (b.is_essential || b.isEssential) ? 1 : 0;
            return bEss - aEss;
        });

    // ========== تصنيف حركة الصنف (سريع/بطيء) ==========
    const getMovementClass = (productId) => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentSales = (sales || []).filter((s) => {
            const saleDate = new Date(s.date);
            return saleDate >= thirtyDaysAgo && s.items?.some((i) => i.id === productId);
        });
        const salesDays = new Set(recentSales.map((s) => s.date)).size;
        const salesCount = recentSales.length;
        if (salesDays >= 21) return { class: "fast", label: "سريع جداً", color: COLORS.green };
        if (salesDays >= 10) return { class: "regular", label: "منتظم", color: COLORS.blue };
        if (salesCount >= 5) return { class: "normal", label: "عادي", color: "#aaaaaa" };
        if (salesCount >= 1) return { class: "slow", label: "بطيء", color: COLORS.gold };
        return { class: "very_slow", label: "بطيء جداً", color: COLORS.red };
    };

    const slowProducts = (products || [])
        .filter((p) => { const mv = getMovementClass(p.id); return (mv.class === "slow" || mv.class === "very_slow") && p.stock > 0; })
        .sort((a, b) => (b.cost || 0) - (a.cost || 0));

    // ========== توقع نفاد المخزون: بدل ما ننتظر المخزون يوصل للحد الأدنى، نحسب
    // معدل البيع اليومي الفعلي في آخر 30 يوم ونتوقع كام يوم متبقي قبل ما الصنف ينفد ==========
    const STOCKOUT_WINDOW_DAYS = 30;
    const STOCKOUT_WARNING_DAYS = 14; // نطلع تنبيه لو متبقي 14 يوم أو أقل قبل النفاد
    const getStockoutForecast = (productId, currentStock) =>
        computeStockoutForecast(sales, productId, currentStock, STOCKOUT_WINDOW_DAYS);

    const stockoutForecastList = (products || [])
        .filter((p) => (p.stock ?? 0) > 0)
        .map((p) => ({ product: p, forecast: getStockoutForecast(p.id, p.stock ?? 0) }))
        .filter((x) => x.forecast && x.forecast.daysLeft <= STOCKOUT_WARNING_DAYS)
        .sort((a, b) => a.forecast.daysLeft - b.forecast.daysLeft);

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>إدارة الأصناف</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <Btn icon="settings" variant="secondary" onClick={() => { setMfrModalFromProductForm(false); setShowMfrModal(true); }}>الشركات المنتجة</Btn>
                    {canAdd && <Btn icon="plus" onClick={openAdd}>إضافة صنف</Btn>}
                </div>
            </div>

            {/* ── Search ── */}
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الباركود أو الفئة..."
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

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
                headers={["رمز", "الصنف", "الشركة المنتجة", "الباركود", "الفئة", "سعر البيع", "التكلفة", "أساسي", "إجراءات"]}
                rows={filtered.slice((productsPage - 1) * PRODUCTS_PAGE_SIZE, productsPage * PRODUCTS_PAGE_SIZE).map((p) => {
                    const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
                    return [
                        <span style={{ color: COLORS.textDim, fontSize: 11 }}>{p.id}</span>,
                        <div>
                            <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{p.nameAr || p.name}</div>
                            {p.nameEn && <div style={{ fontSize: 11, color: COLORS.textDim }}>{p.nameEn}</div>}
                            <div style={{ fontSize: 10, color: COLORS.border }}>{p.full_ingredients_text || `${p.active_ingredient || ""} ${p.concentration || ""}`.trim()}</div>
                        </div>,
                        mfr ? <Badge color={COLORS.blueSoft} text={COLORS.blue}>{mfr.name}</Badge> : <span style={{ color: COLORS.border, fontSize: 11 }}>—</span>,
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
                                {canDelete && <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                                    const { error } = await supabase.from("products").delete().eq("id", p.id).eq("pharmacy_id", pharmacyId);
                                    if (error) { showToast("خطأ: " + error.message, "error"); return; }
                                    logAudit({
                                        pharmacyId, userName: currentUser?.name, action: "delete", entityType: "product",
                                        entityId: p.id, entityLabel: p.nameAr || p.name,
                                        oldValue: { name: p.nameAr || p.name, price: p.price, cost: p.cost, barcode: p.barcode },
                                        description: `حذف الصنف "${p.nameAr || p.name}"`,
                                    });
                                    setProducts((prev) => prev.filter((x) => x.id !== p.id));
                                    showToast("تم حذف الصنف");
                                }}>حذف</Btn>}
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
