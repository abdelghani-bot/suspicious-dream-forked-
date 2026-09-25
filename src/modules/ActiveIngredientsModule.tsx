import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { Badge, Btn, Pagination, StatCard, Table } from "../ui/primitives";
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

// pharmacyId, showToast, canEdit جايين من الشاشة الأب زي باقي الموديولات (نفس props ProductsModule)
export function ActiveIngredientsModule({ pharmacyId, showToast, canEdit = true }) {
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

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
        </div>
    );
}
