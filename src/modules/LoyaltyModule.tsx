import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
    earnLoyaltyPoints, redeemLoyaltyPoints, adjustLoyaltyPoints,
    getLoyaltyPointsMap, getLoyaltyTransactions, insertTreasuryEntry,
} from "../lib/offlineAPI";
import { COLORS, tint } from "../theme";
import { toLocaleString } from "../function toLocaleString() { [native code] }/undefined";
import { todayLocal } from "../lib/dateUtils";
import { Btn, Modal, Pagination } from "../ui/primitives";

// ==================== LOYALTY POINTS MODULE ====================
export function LoyaltyModule({
    customers,
    sales,
    products,
    pharmacyId,
    currentUser,   // 🆕 مطلوب لـ created_by في insertTreasuryEntry
    showToast,
    loyaltySettings,          // 🆕 من App.tsx — نفس المصدر المستخدم في POS
    onLoyaltySettingsChange,  // 🆕 لتحديث App.tsx فور نجاح الحفظ هنا
}: {
    customers: any[];
    sales: any[];
    products: any[];
    pharmacyId: string;
    currentUser: { id: string; name: string } | null; // 🆕
    showToast: (msg: string, type?: string) => void;
    loyaltySettings?: any;
    onLoyaltySettingsChange?: (data: any) => void;
}) {
    // ── State ──
    const [tab, setTab] = useState<"customers" | "settings" | "transactions">("customers");
    const [settings, setSettings] = useState<any>({
        mode: "profit",
        profit_rate: 10,
        sales_rate: 3,
        sales_per: 100,
        min_redeem: 10,
        expiry_months: 12,
        points_per_riyal: 1, // 🆕 كام نقطة تساوي 1 ريال — 1 يعني نقطة=ريال زي ما كان قبل كده
    });
    const [loyaltyMap, setLoyaltyMap] = useState<Record<string, any>>({});
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [redeemModal, setRedeemModal] = useState<any>(null);
    const [redeemAmount, setRedeemAmount] = useState("");
    const [adjustModal, setAdjustModal] = useState<any>(null);
    const [adjustAmount, setAdjustAmount] = useState("");
    const [adjustNote, setAdjustNote] = useState("");
    // 🆕 Pagination — تاب العملاء وتاب السجل ممكن يبقى فيهم مئات الصفوف، فبنعرضهم صفحة صفحة.
    const LOYALTY_PAGE_SIZE = 25;
    const [page, setPage] = useState(1);
    useEffect(() => { setPage(1); }, [tab, search]);

    // 🆕 لو الإعدادات المركزية (App.tsx) اتحدّثت من مكان تاني (أو وصلت بعد أول render)،
    // نعكسها هنا في الـ draft المحلي بتاع تاب الإعدادات
    useEffect(() => {
        if (loyaltySettings) setSettings(loyaltySettings);
    }, [loyaltySettings]);


    // ── Load ──
    useEffect(() => {
        if (!pharmacyId) return;
        const load = async () => {
            setLoading(true);
            const cachedMap = await getLoyaltyPointsMap(pharmacyId);
            if (Object.keys(cachedMap).length > 0) setLoyaltyMap(cachedMap);
            const cachedTx = await getLoyaltyTransactions(pharmacyId);
            if (cachedTx.length > 0) setTransactions(cachedTx);
            setLoading(false); // 🆕 مفيش استنى للنت — الشاشة بتفتح من الكاش فورًا

            if (navigator.onLine) {
                const [sRes, pRes, tRes] = await Promise.all([
                    supabase.from("loyalty_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
                    supabase.from("loyalty_points").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("loyalty_transactions").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(200),
                ]);
                if (sRes.data) {
                    setSettings(sRes.data);
                    onLoyaltySettingsChange?.(sRes.data); // 🆕
                }
                if (pRes.data) {
                    const map: Record<string, any> = {};
                    pRes.data.forEach((r: any) => { map[r.customer_id] = r; });
                    setLoyaltyMap(map);
                    try {
                        await window.offlineAPI.upsertLoyaltyPointsCache({ pharmacyId, rows: pRes.data });
                    } catch (err) { console.error("upsertLoyaltyPointsCache failed:", err); }
                }
                if (tRes.data) setTransactions(tRes.data);
            }
        };
        load();
    }, [pharmacyId]);

    // ── إضافة نقاط لعميل (من فاتورة) ──
    const earnPoints = async (customerId: string, saleId: string, points: number) => {
        if (!customerId || points <= 0) return;
        const current = loyaltyMap[customerId] || { points: 0, total_earned: 0, total_redeemed: 0 };
        const { points: newPoints } = await earnLoyaltyPoints(pharmacyId, customerId, saleId, points, settings.mode);
        setLoyaltyMap((p) => ({
            ...p,
            [customerId]: { ...current, points: newPoints, total_earned: (current.total_earned || 0) + points },
        }));
    };

    // ── استبدال نقاط ──
    const redeemPoints = async () => {
        const amount = parseFloat(redeemAmount); // المبلغ بالريال اللي الصيدلي داخله
        if (!amount || amount <= 0) return showToast("أدخل مبلغ صحيح", "error");
        const current = loyaltyMap[redeemModal.id] || {};
        const perRiyal = settings.points_per_riyal || 1;
        // 🆕 النقاط المطلوب خصمها = المبلغ بالريال × معامل التحويل (نقطة لكل ريال)
        const pointsNeeded = amount * perRiyal;
        if (amount < settings.min_redeem) return showToast(`الحد الأدنى للاستبدال ${settings.min_redeem} ريال`, "warn");
        if (pointsNeeded > (current.points || 0)) return showToast("النقاط غير كافية", "error");

        const { points: newPoints } = await redeemLoyaltyPoints(pharmacyId, redeemModal.id, pointsNeeded);

        const today = todayLocal();
        await insertTreasuryEntry({
            pharmacy_id: pharmacyId,
            date: today,
            type: "expense",
            sub_type: "loyalty_redeem",
            amount: amount,
            note: `استبدال نقاط نقدي — ${redeemModal.name}`,
            method: "نقدي",
            created_by: currentUser?.name || "", // 🆕 زي POS بالظبط
        });

        setLoyaltyMap((p) => ({
            ...p,
            [redeemModal.id]: { ...current, points: newPoints, total_redeemed: (current.total_redeemed || 0) + pointsNeeded },
        }));
        setTransactions((p) => [{
            id: Date.now(), customer_id: redeemModal.id, type: "redeem", amount: -pointsNeeded,
            note: `استبدال نقدي — ${amount} ر.س`, created_at: new Date().toISOString(),
        }, ...p]);

        showToast(`تم صرف ${amount} ريال نقداً للعميل ✓`);
        setRedeemModal(null);
        setRedeemAmount("");
    };

    // ── تعديل يدوي ──
    const adjustPoints = async () => {
        const amount = parseFloat(adjustAmount);
        if (!amount) return showToast("أدخل مبلغ", "error");
        const current = loyaltyMap[adjustModal.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
        const { points: newPoints } = await adjustLoyaltyPoints(pharmacyId, adjustModal.id, amount, adjustNote);

        setLoyaltyMap((p) => ({ ...p, [adjustModal.id]: { ...current, points: newPoints } }));
        setTransactions((p) => [{ id: Date.now(), customer_id: adjustModal.id, type: "adjust", amount, note: adjustNote || "تعديل يدوي", created_at: new Date().toISOString() }, ...p]);
        showToast("تم التعديل ✓");
        setAdjustModal(null);
        setAdjustAmount("");
        setAdjustNote("");
    };

    // ── حفظ الإعدادات ──
    const saveSettings = async () => {
        setSaving(true);
        const savedRow = { ...settings, pharmacy_id: pharmacyId, mode_changed_at: new Date().toISOString() };
        const { error } = await supabase.from("loyalty_settings").upsert(savedRow, { onConflict: "pharmacy_id" });
        setSaving(false);
        if (error) return showToast("خطأ في الحفظ", "error");
        onLoyaltySettingsChange?.(savedRow); // 🆕 يوصل فورًا لـ App.tsx ومنها لـ POS
        showToast("تم حفظ الإعدادات ✓");
    };

    // ── ألوان ──
    const VAR = { bg: COLORS.surface, border: COLORS.border, text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue };

    const typeLabel: Record<string, { label: string; color: string }> = {
        earn: { label: "مكتسبة", color: COLORS.green },
        redeem: { label: "مستبدلة", color: COLORS.red },
        adjust: { label: "تعديل", color: COLORS.gold },
    };

    // ── إحصائيات ──
    const perRiyal = settings.points_per_riyal || 1; // 🆕 معامل تحويل النقطة للريال
    const totalPointsInSystem = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.points || 0), 0);
    const totalEverEarned = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_earned || 0), 0);
    const totalRedeemed = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_redeemed || 0), 0);
    const activeMembers = Object.values(loyaltyMap).filter((v: any) => v.points > 0).length;

    const filtered = customers.filter((c) =>
        (c.name || "").includes(search) || (c.phone || "").includes(search)
    );

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: VAR.muted }}>
            جاري التحميل...
        </div>
    );

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: VAR.text }}>
                    🌟 نقاط الولاء
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                    {(["customers", "transactions", "settings"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: "7px 16px", borderRadius: 8, border: "1px solid",
                            borderColor: tab === t ? VAR.accent : VAR.border,
                            background: tab === t ? COLORS.blueSoft : "transparent",
                            color: tab === t ? VAR.accent : VAR.muted,
                            fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}>
                            {t === "customers" ? "العملاء" : t === "transactions" ? "السجل" : "الإعدادات"}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── إحصائيات ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                    { label: "إجمالي النقاط الحالية", value: totalPointsInSystem.toFixed(0) + " نقطة" + (perRiyal !== 1 ? ` (${(totalPointsInSystem / perRiyal).toFixed(2)} ر.س)` : ""), color: COLORS.blue },
                    { label: "إجمالي المكتسبة", value: totalEverEarned.toFixed(0) + " نقطة", color: COLORS.green },
                    { label: "إجمالي المستبدلة", value: totalRedeemed.toFixed(0) + " نقطة", color: COLORS.red },
                    { label: "أعضاء نشطون", value: activeMembers, color: COLORS.gold },
                ].map((s, i) => (
                    <div key={i} style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ════ TAB: CUSTOMERS ════ */}
            {tab === "customers" && (
                <div>
                    <div style={{ marginBottom: 14 }}>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="بحث باسم العميل أو رقم الجوال..."
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 14px", color: VAR.text, fontSize: 14, outline: "none", width: 300, boxSizing: "border-box" as any }}
                        />
                    </div>

                    <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                                    {["العميل", "النقاط الحالية", "إجمالي مكتسبة", "إجمالي مستبدلة", ""].map((h, i) => (
                                        <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: VAR.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: COLORS.textDim }}>لا يوجد عملاء</td></tr>
                                ) : filtered.slice((page - 1) * LOYALTY_PAGE_SIZE, page * LOYALTY_PAGE_SIZE).map((c, i) => {
                                    const lp = loyaltyMap[c.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
                                    return (
                                        <tr key={c.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt }}>
                                            <td style={{ padding: "11px 16px" }}>
                                                <div style={{ fontWeight: 700, color: VAR.text, fontSize: 14 }}>{c.name}</div>
                                                <div style={{ fontSize: 11, color: VAR.muted }}>{c.phone}</div>
                                            </td>
                                            <td style={{ padding: "11px 16px" }}>
                                                <span style={{
                                                    fontSize: 16, fontWeight: 800,
                                                    color: lp.points >= settings.min_redeem * perRiyal ? COLORS.green : VAR.muted,
                                                }}>
                                                    {(lp.points || 0).toFixed(0)} نقطة
                                                </span>
                                                {perRiyal !== 1 && (
                                                    <div style={{ fontSize: 11, color: VAR.muted }}>
                                                        = {((lp.points || 0) / perRiyal).toFixed(2)} ر.س
                                                    </div>
                                                )}
                                                {lp.points >= settings.min_redeem * perRiyal && (
                                                    <span style={{ marginRight: 6, fontSize: 10, background: COLORS.greenSoft, color: COLORS.green, padding: "1px 6px", borderRadius: 10 }}>
                                                        قابل للاستبدال
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: "11px 16px", color: COLORS.green, fontSize: 13 }}>
                                                {(lp.total_earned || 0).toFixed(0)}
                                            </td>
                                            <td style={{ padding: "11px 16px", color: COLORS.red, fontSize: 13 }}>
                                                {(lp.total_redeemed || 0).toFixed(0)}
                                            </td>
                                            <td style={{ padding: "11px 16px" }}>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    {lp.points >= settings.min_redeem * perRiyal && (
                                                        <button onClick={() => { setRedeemModal(c); setRedeemAmount(""); }} style={{
                                                            padding: "5px 12px", borderRadius: 7, border: `1px solid ${tint(COLORS.green, 0.35)}`,
                                                            background: COLORS.greenSoft, color: COLORS.green, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                                        }}>
                                                            استبدال
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setAdjustModal(c); setAdjustAmount(""); setAdjustNote(""); }} style={{
                                                        padding: "5px 12px", borderRadius: 7, border: `1px solid ${VAR.border}`,
                                                        background: "transparent", color: VAR.muted, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                                    }}>
                                                        تعديل
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} onPageChange={setPage} totalItems={filtered.length} pageSize={LOYALTY_PAGE_SIZE} />
                </div>
            )}

            {/* ════ TAB: TRANSACTIONS ════ */}
            {tab === "transactions" && (
                <>
                    <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                                    {["التاريخ", "العميل", "النوع", "النقاط", "ملاحظة"].map((h, i) => (
                                        <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: VAR.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: COLORS.textDim }}>لا يوجد سجلات</td></tr>
                                ) : transactions.slice((page - 1) * LOYALTY_PAGE_SIZE, page * LOYALTY_PAGE_SIZE).map((t, i) => {
                                    const customer = customers.find((c) => c.id === t.customer_id);
                                    const tl = typeLabel[t.type] || { label: t.type, color: VAR.muted };
                                    return (
                                        <tr key={t.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt }}>
                                            <td style={{ padding: "10px 16px", color: VAR.muted, fontSize: 12 }}>
                                                {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : "-"}
                                            </td>
                                            <td style={{ padding: "10px 16px", color: VAR.text, fontSize: 13, fontWeight: 600 }}>
                                                {customer?.name || t.customer_id}
                                            </td>
                                            <td style={{ padding: "10px 16px" }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: tl.color + "22", color: tl.color }}>
                                                    {tl.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 800, color: t.amount > 0 ? COLORS.green : COLORS.red }}>
                                                {t.amount > 0 ? "+" : ""}{(t.amount || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: "10px 16px", color: VAR.muted, fontSize: 12 }}>{t.note || "-"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} onPageChange={setPage} totalItems={transactions.length} pageSize={LOYALTY_PAGE_SIZE} />
                </>
            )}

            {/* ════ TAB: SETTINGS ════ */}
            {tab === "settings" && (
                <div style={{ maxWidth: 600 }}>
                    <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
                        <h3 style={{ margin: "0 0 20px", color: COLORS.blue, fontSize: 15, fontWeight: 700 }}>
                            🔧 آلية احتساب النقاط
                        </h3>

                        {/* وضع الحساب */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 10 }}>
                                طريقة الاحتساب
                            </label>
                            <div style={{ display: "flex", gap: 10 }}>
                                {[
                                    { v: "profit", label: "نسبة من الربح 📈", desc: "العميل ياخد نقاط أكثر على المنتجات ذات هامش ربح أعلى" },
                                    { v: "sales", label: "نسبة من المبيعات 🛒", desc: "ريال لكل X ريال مشتريات — بسيط وواضح للعميل" },
                                ].map((opt) => (
                                    <div key={opt.v} onClick={() => setSettings((p: any) => ({ ...p, mode: opt.v }))} style={{
                                        flex: 1, padding: 14, borderRadius: 10, border: `2px solid`,
                                        borderColor: settings.mode === opt.v ? VAR.accent : VAR.border,
                                        background: settings.mode === opt.v ? COLORS.blueSoft : "transparent",
                                        cursor: "pointer", transition: "all 0.15s",
                                    }}>
                                        <div style={{ fontWeight: 700, color: settings.mode === opt.v ? VAR.accent : VAR.text, fontSize: 14, marginBottom: 6 }}>
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: 11, color: VAR.muted }}>{opt.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* إعدادات وضع الربح */}
                        {settings.mode === "profit" && (
                            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: VAR.muted, marginBottom: 12 }}>
                                    مثال: إذا كان الربح من الفاتورة 50 ريال والنسبة 10% — يكسب العميل 5 ريال نقاط
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <label style={{ fontSize: 13, color: VAR.text, whiteSpace: "nowrap" }}>نسبة من الربح:</label>
                                    <input
                                        type="number" min={1} max={100}
                                        value={settings.profit_rate}
                                        onChange={(e) => setSettings((p: any) => ({ ...p, profit_rate: +e.target.value }))}
                                        style={{ width: 80, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                                    />
                                    <span style={{ color: VAR.muted, fontSize: 13 }}>%</span>
                                </div>
                            </div>
                        )}

                        {/* إعدادات وضع المبيعات */}
                        {settings.mode === "sales" && (
                            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: VAR.muted, marginBottom: 12 }}>
                                    مثال: إذا حدّدت 3 ريال لكل 100 ريال — من يشتري بـ 250 ريال يكسب 6 ريال نقاط
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as any }}>
                                    <input
                                        type="number" min={0.1}
                                        value={settings.sales_rate}
                                        onChange={(e) => setSettings((p: any) => ({ ...p, sales_rate: +e.target.value }))}
                                        style={{ width: 70, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                                    />
                                    <span style={{ color: VAR.muted, fontSize: 13 }}>ريال لكل</span>
                                    <input
                                        type="number" min={10}
                                        value={settings.sales_per}
                                        onChange={(e) => setSettings((p: any) => ({ ...p, sales_per: +e.target.value }))}
                                        style={{ width: 80, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                                    />
                                    <span style={{ color: VAR.muted, fontSize: 13 }}>ريال مشتريات</span>
                                </div>
                            </div>
                        )}

                        {/* 🆕 معامل تحويل النقطة للريال */}
                        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 12, color: VAR.muted, marginBottom: 12 }}>
                                لو حبيت النقاط تظهر برقم أكبر بدل قيمتها بالريال مباشرة — مثلاً 3 ريال = 300 نقطة بدل 3 نقطة. سيبها 1 لو عايز نقطة = ريال زي ما هي.
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ color: VAR.muted, fontSize: 13 }}>1 ريال =</span>
                                <input
                                    type="number" min={1} step={1}
                                    value={settings.points_per_riyal ?? 1}
                                    onChange={(e) => setSettings((p: any) => ({ ...p, points_per_riyal: Math.max(1, +e.target.value) }))}
                                    style={{ width: 90, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                                />
                                <span style={{ color: VAR.muted, fontSize: 13 }}>نقطة</span>
                            </div>
                        </div>

                        {/* إعدادات الاستبدال */}
                        <h3 style={{ margin: "20px 0 14px", color: COLORS.blue, fontSize: 14, fontWeight: 700 }}>
                            💱 إعدادات الاستبدال
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                                    الحد الأدنى للاستبدال (ريال)
                                </label>
                                <input
                                    type="number" min={1}
                                    value={settings.min_redeem}
                                    onChange={(e) => setSettings((p: any) => ({ ...p, min_redeem: +e.target.value }))}
                                    style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 12px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                                    انتهاء النقاط (شهر)
                                </label>
                                <input
                                    type="number" min={1}
                                    value={settings.expiry_months}
                                    onChange={(e) => setSettings((p: any) => ({ ...p, expiry_months: +e.target.value }))}
                                    style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 12px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                                />
                            </div>
                        </div>
                    </div>

                    <Btn onClick={saveSettings} disabled={saving} icon="check" size="lg" style={{ width: "100%", justifyContent: "center" }}>
                        {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
                    </Btn>
                </div>
            )}

            {/* ── Modal: استبدال ── */}
            {redeemModal && (
                <Modal open onClose={() => setRedeemModal(null)} title={`صرف نقدي — ${redeemModal.name}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: VAR.muted, marginBottom: 4 }}>النقاط المتاحة</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.green }}>
                                {((loyaltyMap[redeemModal.id]?.points) || 0).toFixed(0)} نقطة
                            </div>
                            {perRiyal !== 1 && (
                                <div style={{ fontSize: 12, color: VAR.muted, marginTop: 2 }}>
                                    = {(((loyaltyMap[redeemModal.id]?.points) || 0) / perRiyal).toFixed(2)} ر.س
                                </div>
                            )}
                        </div>
                        <div style={{
                            background: COLORS.goldSoft,
                            border: `1px solid ${tint(COLORS.gold, 0.35)}`,
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            color: COLORS.gold,
                        }}>
                            ⚠ سيتم خصم المبلغ من دخل اليوم كمصروف
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                                المبلغ المراد استبداله (ر.س)
                            </label>
                            <input
                                type="number" min={settings.min_redeem}
                                max={(loyaltyMap[redeemModal.id]?.points || 0) / perRiyal}
                                value={redeemAmount}
                                onChange={(e) => setRedeemAmount(e.target.value)}
                                placeholder={`الحد الأدنى ${settings.min_redeem} ريال`}
                                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setRedeemModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
                            <Btn onClick={redeemPoints} style={{ flex: 1, justifyContent: "center" }}>تأكيد الاستبدال</Btn>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ── Modal: تعديل ── */}
            {adjustModal && (
                <Modal open onClose={() => setAdjustModal(null)} title={`تعديل نقاط — ${adjustModal.name}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: VAR.muted, marginBottom: 4 }}>النقاط الحالية</div>
                            <div style={{ fontSize: 28, fontWeight: 900, color: VAR.accent }}>
                                {((loyaltyMap[adjustModal.id]?.points) || 0).toFixed(0)} نقطة
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                                عدد النقاط (موجب للإضافة، سالب للخصم)
                            </label>
                            <input
                                type="number"
                                value={adjustAmount}
                                onChange={(e) => setAdjustAmount(e.target.value)}
                                placeholder="مثال: 10 أو -5"
                                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>سبب التعديل</label>
                            <input
                                value={adjustNote}
                                onChange={(e) => setAdjustNote(e.target.value)}
                                placeholder="مثال: تعويض عميل..."
                                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <Btn variant="ghost" onClick={() => setAdjustModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
                            <Btn variant="secondary" onClick={adjustPoints} style={{ flex: 1, justifyContent: "center" }}>حفظ التعديل</Btn>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
