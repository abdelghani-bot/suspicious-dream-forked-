import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { Badge, Btn, Modal, Pagination, StatCard, Table } from "../ui/primitives";
import { updateActiveIngredientFlags } from "../lib/offlineAPI";

const PAGE_SIZE = 30;

// 🆕 شريحة قابلة للضغط لتبديل فلاج (أساسي / يتطلب أرشفة) — بديل خفيف لمكوّن Switch،
// شكلها زي Badge بالظبط عشان تندمج بصريًا مع باقي الجداول
const ToggleChip = ({ label, active, activeColor, disabled, onClick }) => (
    <span
        onClick={disabled ? undefined : onClick}
        style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            border: `1px solid ${active ? activeColor : COLORS.border}`,
            background: active ? activeColor + "22" : "transparent",
            color: active ? activeColor : COLORS.textDim,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
            userSelect: "none",
        }}
        title={disabled ? "" : "اضغط للتبديل"}
    >
        {active ? "✓" : "—"} {label}
    </span>
);

// 🆕 حقل بحث واختيار مادة فعالة واحدة (للدمج اليدوي) — قايمة منسدلة بسيطة
// بتفلتر من نفس "ingredients" المحمّلة أصلًا في الشاشة، من غير أي طلب إضافي للسيرفر
const IngredientPicker = ({ label, ingredients, excludeId, selected, onSelect, onClear }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return ingredients
            .filter((i) => i.id !== excludeId)
            .filter((i) => (i.name_ar || "").toLowerCase().includes(q) || (i.name_en || "").toLowerCase().includes(q))
            .slice(0, 8);
    }, [ingredients, query, excludeId]);

    if (selected) {
        return (
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>{label}</div>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.blue}`,
                    background: COLORS.blue + "11",
                }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.textPrimary }}>{selected.name_ar || selected.name_en}</span>
                    <span onClick={onClear} style={{ cursor: "pointer", color: COLORS.textDim, fontSize: 13 }}>✕</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>{label}</div>
            <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder="ابحث باسم المادة…"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, boxSizing: "border-box" }}
            />
            {open && results.length > 0 && (
                <div style={{
                    position: "absolute", top: "100%", right: 0, left: 0, zIndex: 20, marginTop: 4,
                    background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto",
                }}>
                    {results.map((r) => (
                        <div
                            key={r.id}
                            onMouseDown={() => { onSelect(r); setQuery(""); setOpen(false); }}
                            style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}
                        >
                            {r.name_ar || r.name_en}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// pharmacyId, showToast, canEdit جايين من الشاشة الأب زي باقي الموديولات (نفس props ProductsModule)
export function ActiveIngredientsModule({ pharmacyId, showToast, canEdit = true }) {
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

    // 🆕 مقترحات الدمج التلقائي (من find_similar_active_ingredients)
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [dismissed, setDismissed] = useState(() => new Set());

    // 🆕 اختيار الدمج اليدوي
    const [manualKeep, setManualKeep] = useState(null);
    const [manualDup, setManualDup] = useState(null);

    // 🆕 مودال تأكيد الدمج (مشترك بين المقترح التلقائي واليدوي)
    const [mergeConfirm, setMergeConfirm] = useState(null); // { keepId, keepName, dupId, dupName, count, loadingCount }
    const [merging, setMerging] = useState(false);

    // 🆕 نفس نمط تأخير البحث المستخدم في ProductsModule — يمنع فلترة على كل ضغطة زرار
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { setPage(1); }, [debouncedSearch]);

    // تحميل أولي: من الكاش المحلي الأول (سريع، شغال أوفلاين)، وبعدين تحديث من Supabase لو أونلاين
    useEffect(() => {
        let cancelled = false;

        const normalize = (r) => ({
            ...r,
            is_essential: !!r.is_essential,
            requires_prescription_archive: !!r.requires_prescription_archive,
        });

        (async () => {
            try {
                const cached = await window.offlineAPI?.getActiveIngredientsCache?.(pharmacyId);
                if (!cancelled && cached?.length) {
                    setIngredients(cached.map(normalize));
                    setLoading(false);
                }
            } catch (err) {
                console.error("getActiveIngredientsCache failed:", err);
            }

            const { data, error } = await supabase
                .from("active_ingredients")
                .select("id, name_ar, name_en, is_essential, requires_prescription_archive")
                .eq("pharmacy_id", pharmacyId)
                .order("name_ar");

            if (cancelled) return;
            if (!error && data) {
                setIngredients(data.map(normalize));
                // full-refresh للكاش المحلي عشان يفضل متزامن مع Supabase
                window.offlineAPI?.refreshActiveIngredientsCache?.({ pharmacyId, rows: data });
            }
            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, [pharmacyId]);

    // 🆕 تحميل مقترحات الدمج التلقائي — بس لو المستخدم عنده صلاحية تعديل أصلًا
    const loadSuggestions = async () => {
        if (!pharmacyId) return;
        setLoadingSuggestions(true);
        const { data, error } = await supabase.rpc("find_similar_active_ingredients", {
            p_pharmacy_id: pharmacyId,
            p_threshold: 0.75,
        });
        if (!error && data) {
            setSuggestions(data.filter((s) => !dismissed.has(`${s.id_1}|${s.id_2}`)));
        } else if (error) {
            showToast?.("تعذّر تحميل المقترحات: " + error.message, "error");
        }
        setLoadingSuggestions(false);
    };

    useEffect(() => {
        if (canEdit) loadSuggestions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pharmacyId, canEdit]);

    const dismissSuggestion = (id1, id2) => {
        setDismissed((prev) => new Set(prev).add(`${id1}|${id2}`));
        setSuggestions((prev) => prev.filter((s) => !(s.id_1 === id1 && s.id_2 === id2)));
    };

    // 🆕 فتح مودال التأكيد — بيجيب الأول عدد الأصناف المرتبطة بالمادة اللي هتتحذف
    // عشان الصيدلي يشوف حجم الأثر قبل ما يأكّد (درس اتعلمناه من غلطة الدمج السابقة)
    const openMergeConfirm = async (keepId, keepName, dupId, dupName) => {
        setMergeConfirm({ keepId, keepName, dupId, dupName, count: null, loadingCount: true });
        const { count, error } = await supabase
            .from("product_ingredients")
            .select("id", { count: "exact", head: true })
            .eq("ingredient_id", dupId);
        setMergeConfirm((prev) => (prev ? { ...prev, count: error ? 0 : count ?? 0, loadingCount: false } : prev));
    };

    const performMerge = async () => {
        if (!mergeConfirm) return;
        setMerging(true);
        const { error } = await supabase.rpc("merge_active_ingredients", {
            p_keep_id: mergeConfirm.keepId,
            p_duplicate_ids: [mergeConfirm.dupId],
        });
        setMerging(false);
        if (error) {
            showToast?.("فشل الدمج: " + error.message, "error");
            return;
        }
        // تحديث محلي فوري: شيل المادة المحذوفة من القايمة والمقترحات
        setIngredients((prev) => prev.filter((i) => i.id !== mergeConfirm.dupId));
        setSuggestions((prev) => prev.filter((s) => s.id_1 !== mergeConfirm.dupId && s.id_2 !== mergeConfirm.dupId));
        setManualKeep(null);
        setManualDup(null);
        showToast?.("تم الدمج بنجاح", "success");
        setMergeConfirm(null);
    };

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return ingredients;
        return ingredients.filter(
            (i) => (i.name_ar || "").toLowerCase().includes(q) || (i.name_en || "").toLowerCase().includes(q)
        );
    }, [ingredients, debouncedSearch]);

    const essentialCount = useMemo(() => ingredients.filter((i) => i.is_essential).length, [ingredients]);
    const archiveCount = useMemo(() => ingredients.filter((i) => i.requires_prescription_archive).length, [ingredients]);

    const toggleFlag = async (ingredient, field) => {
        if (!canEdit) return;
        const newValue = !ingredient[field];

        // تحديث فوري في الواجهة (optimistic) — نفس فلسفة تحديث المخزون في نقطة البيع
        setIngredients((prev) => prev.map((i) => (i.id === ingredient.id ? { ...i, [field]: newValue } : i)));

        const { error } = await updateActiveIngredientFlags(ingredient.id, pharmacyId, { [field]: newValue });
        if (error) {
            // رجوع للقيمة القديمة لو فشل الحفظ
            setIngredients((prev) => prev.map((i) => (i.id === ingredient.id ? { ...i, [field]: !newValue } : i)));
            showToast?.("حصل خطأ أثناء الحفظ: " + error, "error");
        }
    };

    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ margin: 0, color: COLORS.textPrimary }}>المواد الفعالة</h2>
                <div style={{ display: "flex", gap: 10 }}>
                    <StatCard label="أساسي" value={essentialCount} icon="pill" color={COLORS.gold} />
                    <StatCard label="يتطلب أرشفة وصفة" value={archiveCount} icon="alert" color={COLORS.red} />
                    <StatCard label="إجمالي المواد" value={ingredients.length} icon="inventory" color={COLORS.blue} />
                </div>
            </div>

            {/* 🆕 قسم المقترحات التلقائية — بيظهر بس لو المستخدم عنده صلاحية تعديل */}
            {canEdit && (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, background: COLORS.surfaceAlt }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>🔎 مواد مكررة مقترحة (تطابق تلقائي)</div>
                        <Btn variant="ghost" onClick={loadSuggestions} disabled={loadingSuggestions}>
                            {loadingSuggestions ? "جاري الفحص…" : "إعادة الفحص"}
                        </Btn>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
                        الاقتراحات دي بس للمواد المفردة (بدون تركيبات متعددة). تأكد إنها فعلًا نفس المادة قبل الدمج — العملية لا يمكن التراجع عنها.
                    </div>
                    {loadingSuggestions ? (
                        <div style={{ color: COLORS.textDim, padding: 10 }}>جاري الفحص…</div>
                    ) : suggestions.length === 0 ? (
                        <div style={{ color: COLORS.textDim, padding: 10 }}>مفيش مواد مكررة محتملة حاليًا 🎉</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {suggestions.map((s) => (
                                <div key={`${s.id_1}-${s.id_2}`} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
                                    padding: "10px 14px", borderRadius: 8, background: "#fff", border: `1px solid ${COLORS.border}`,
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                                        <span style={{ fontWeight: 700 }}>{s.name_1}</span>
                                        <span style={{ color: COLORS.textDim }}>↔</span>
                                        <span style={{ fontWeight: 700 }}>{s.name_2}</span>
                                        <Badge color={s.sim >= 0.95 ? COLORS.green : COLORS.gold}>{Math.round(s.sim * 100)}% تشابه</Badge>
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <Btn size="sm" onClick={() => openMergeConfirm(s.id_1, s.name_1, s.id_2, s.name_2)}>دمج</Btn>
                                        <Btn size="sm" variant="ghost" onClick={() => dismissSuggestion(s.id_1, s.id_2)}>تجاهل</Btn>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 🆕 قسم الدمج اليدوي */}
            {canEdit && (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, color: COLORS.textPrimary, marginBottom: 10 }}>دمج يدوي</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <IngredientPicker
                            label="المادة اللي هتفضل (الأصلية)"
                            ingredients={ingredients}
                            excludeId={manualDup?.id}
                            selected={manualKeep}
                            onSelect={setManualKeep}
                            onClear={() => setManualKeep(null)}
                        />
                        <IngredientPicker
                            label="المادة المكررة (هتتحذف وتتدمج في الأولى)"
                            ingredients={ingredients}
                            excludeId={manualKeep?.id}
                            selected={manualDup}
                            onSelect={setManualDup}
                            onClear={() => setManualDup(null)}
                        />
                        <Btn
                            disabled={!manualKeep || !manualDup}
                            onClick={() => openMergeConfirm(manualKeep.id, manualKeep.name_ar || manualKeep.name_en, manualDup.id, manualDup.name_ar || manualDup.name_en)}
                        >
                            دمج
                        </Btn>
                    </div>
                </div>
            )}

            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم المادة الفعالة (عربي أو إنجليزي)…"
                style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 14,
                    width: "100%",
                    maxWidth: 420,
                }}
            />

            {loading ? (
                <div style={{ color: COLORS.textDim, padding: 20 }}>جاري التحميل…</div>
            ) : filtered.length === 0 ? (
                <div style={{ color: COLORS.textDim, padding: 20 }}>لا توجد نتائج مطابقة</div>
            ) : (
                <>
                    <Table
                        headers={["اسم المادة الفعالة", "أساسي", "يتطلب أرشفة وصفة"]}
                        rows={paged.map((ing) => [
                            <div>
                                <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{ing.name_ar || "—"}</div>
                                {ing.name_en && <div style={{ fontSize: 11, color: COLORS.textDim }}>{ing.name_en}</div>}
                            </div>,
                            <ToggleChip
                                label="أساسي"
                                active={ing.is_essential}
                                activeColor={COLORS.gold}
                                disabled={!canEdit}
                                onClick={() => toggleFlag(ing, "is_essential")}
                            />,
                            <ToggleChip
                                label="يتطلب أرشفة"
                                active={ing.requires_prescription_archive}
                                activeColor={COLORS.red}
                                disabled={!canEdit}
                                onClick={() => toggleFlag(ing, "requires_prescription_archive")}
                            />,
                        ])}
                    />
                    <Pagination page={page} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
                </>
            )}

            {/* 🆕 مودال تأكيد الدمج — مشترك بين المقترح التلقائي والدمج اليدوي */}
            {mergeConfirm && (
                <Modal open onClose={() => !merging && setMergeConfirm(null)} title="تأكيد دمج المواد الفعالة">
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ fontSize: 14, color: COLORS.textPrimary }}>
                            هتدمج <b>{mergeConfirm.dupName}</b> داخل <b>{mergeConfirm.keepName}</b>.
                        </div>
                        <div style={{ fontSize: 13, color: COLORS.textDim, background: COLORS.surfaceAlt, borderRadius: 8, padding: 10 }}>
                            {mergeConfirm.loadingCount ? "جاري حساب عدد الأصناف المتأثرة…" : (
                                <>عدد الأصناف اللي هتنتقل لـ "{mergeConfirm.keepName}": <b>{mergeConfirm.count}</b></>
                            )}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.red, fontWeight: 700 }}>
                            ⚠️ تأكد إن دي فعلًا نفس المادة الفعالة قبل ما تأكّد — العملية نهائية ولا يمكن التراجع عنها.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setMergeConfirm(null)} disabled={merging} style={{ flex: 1, justifyContent: "center" }}>
                                إلغاء
                            </Btn>
                            <Btn onClick={performMerge} disabled={merging || mergeConfirm.loadingCount} style={{ flex: 1, justifyContent: "center" }}>
                                {merging ? "جاري الدمج…" : "تأكيد الدمج"}
                            </Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
