import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { useEssentialAlerts } from "../hooks/useEssentialAlerts";
import { todayLocal } from "../lib/dateUtils";
import { MAIN_CATEGORIES } from "../lib/productConstants";
import { calcAutoDiscount, describePromo, isPromoFulfillable } from "../lib/promoUtils";
import { PromotionsModule } from "./PromotionsModule";
import { Badge, Modal } from "../ui/primitives";

export function AlertRow({ text, badge, color, VAR }) {
    return (
        <div style={{ display: "flex", alignItems: "center", padding: "6px 0", gap: 10, fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, color: VAR.text }}>{text}</div>
            <div style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: `${color}1f`, color, fontWeight: 600 }}>{badge}</div>
        </div>
    );
}


export function EmptyAlertRow({ text, muted }) {
    return <div style={{ textAlign: "center", color: muted, fontSize: 11, padding: "10px 0" }}>{text}</div>;
}


export function Dashboard({
    products,
    sales,
    purchases,
    customers,
    suppliers = [],
    shifts,
    currentUser,
    pharmacyId,
    setTab,
    creditPayments = [],
    treasuryEntries = [],
    promos = [],
    returnsData = [],
}) {
    const alerts = useEssentialAlerts(products);
    const [salesTab, setSalesTab] = useState("today"); // "today" | "month" | "compare"
    const [deptTab, setDeptTab] = useState("today"); // "today" | "month" — لكارت مبيعات الأقسام
    const [privacyMode, setPrivacyMode] = useState(true);
    const [expandedAlertGroup, setExpandedAlertGroup] = useState(null);

    // ── فرص ضائعة ──
    const [missedToday, setMissedToday] = useState({ count: 0, value: 0, items: [] });
    const [missedMonth, setMissedMonth] = useState({ count: 0, value: 0, items: [] });
    const [showMissedModal, setShowMissedModal] = useState(false);

    const today = todayLocal();
    const monthKey = today.substring(0, 7);

    // ══════════════════════════════════════════════════════════
    // 🆕 نقطة بداية "اليوم" الفعلية لكروت المبيعات/الفرص/الأقسام:
    // بيتساوى منتصف الليل التقويمي إلا لو حصل تقفيل يومي (daily_closing)
    // بعد منتصف الليل ده — يعني الصيدلي قفل يوم امبارح فعليًا وقت
    // بقت الساعة داخلة في تاريخ اليوم. في الحالة دي نعتبر "اليوم" بادئ
    // من لحظة التقفيل نفسها، عشان الكروت تصفر فورًا وقت التقفيل مش
    // تفضل شايلة أرقام اليوم اللي فات لحد منتصف الليل التقويمي التالي.
    const todayMidnightTs = new Date(); todayMidnightTs.setHours(0, 0, 0, 0);
    const lastClosingTs = (treasuryEntries || [])
        .filter((e) => e.sub_type === "daily_closing" && e.created_at)
        .reduce((latest, e) => {
            const t = new Date(e.created_at).getTime();
            return t > latest ? t : latest;
        }, 0);
    const todayStartTs = Math.max(todayMidnightTs.getTime(), lastClosingTs);
    // 🆕 بيستخدم created_at لو موجود (أدق وبيحل مشكلة التقفيل بعد نص الليل)،
    // ولو مش موجود (سجلات قديمة) بيرجع للمقارنة بالتاريخ التقويمي العادية
    const isTodayRecord = (record) => {
        if (!record?.created_at) return record?.date === today;
        return new Date(record.created_at).getTime() >= todayStartTs;
    };

    useEffect(() => {
        if (!pharmacyId) return;
        const fetchMissed = async () => {
            // 🆕 أوفلاين-أول: لو مفيش نت أو الـ query فشل، ارجع للكاش المحلي (missed_sales_cache)
            // بدل ما الكارت يفضل فاضي. لو نجحنا نجيب من Supabase، نكتب نسخة في الكاش (write-through)
            // عشان لو النت اتقطع بعد كده تلاقي آخر بيانات معروفة بدل الصفر.
            if (navigator.onLine) {
                try {
                    const { data: todayData, error: todayErr } = await supabase
                        .from("missed_sales")
                        .select("id, product_name, price, qty, reason, notes, cashier, date, created_at, customer_id, customer_name")
                        .gte("created_at", new Date(todayStartTs).toISOString())
                        .eq("pharmacy_id", pharmacyId)
                        .order("id", { ascending: false });
                    if (todayErr) throw todayErr;
                    if (todayData) {
                        const value = todayData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
                        setMissedToday({ count: todayData.length, value, items: todayData });
                        window.offlineAPI?.upsertMissedSalesCache({ pharmacyId, records: todayData }).catch(() => { });
                    }

                    const { data: monthData, error: monthErr } = await supabase
                        .from("missed_sales")
                        .select("id, product_name, price, qty, reason, notes, cashier, date, customer_id, customer_name")
                        .gte("date", monthKey + "-01").lte("date", monthKey + "-31")
                        .eq("pharmacy_id", pharmacyId)
                        .order("date", { ascending: false });
                    if (monthErr) throw monthErr;
                    if (monthData) {
                        const value = monthData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
                        setMissedMonth({ count: monthData.length, value, items: monthData });
                        window.offlineAPI?.upsertMissedSalesCache({ pharmacyId, records: monthData }).catch(() => { });
                    }
                    return;
                } catch (err) {
                    console.error("fetchMissed online failed, falling back to cache:", err);
                    // كمل تحت لقراءة الكاش
                }
            }

            // أوفلاين أو الـ query فوق فشل
            try {
                const cachedToday = await window.offlineAPI?.getTodayMissedSalesCache({
                    pharmacyId, sinceIso: new Date(todayStartTs).toISOString(),
                }) || [];
                const todayValue = cachedToday.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
                setMissedToday({ count: cachedToday.length, value: todayValue, items: cachedToday });

                const cachedMonth = await window.offlineAPI?.getMissedSalesMonthCache({ pharmacyId, monthKey }) || [];
                const monthValue = cachedMonth.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
                setMissedMonth({ count: cachedMonth.length, value: monthValue, items: cachedMonth });
            } catch (err) {
                console.error("fetchMissed cache read failed:", err);
            }
        };
        fetchMissed();
    }, [today, todayStartTs, monthKey, pharmacyId]);

    const [myTarget, setMyTarget] = useState(null);

    // ══════════ سجل فروقات المخزون المعلّقة (أصناف تحتاج تسوية رصيد) ══════════
    // المصدر الأساسي دلوقتي: محاولة بيع صنف بالسكانر ورصيده صفر بالنظام (POS)،
    // وقابل للتوسع لاحقًا (تسوية يدوية، عجز/زيادة شفت) بنفس الجدول والمنطق.
    // ⚠️ فحص أونلاين بس دلوقتي (زي مركز التنبيهات في مجمله) — مفيش كاش محلي ليها
    // لسه، فمش هتظهر تحديثات لحظية وأنت أوفلاين. لو ده مهم لاحقًا، محتاج نضيف
    // upsertVarianceLogCache/getVarianceLogCache في offlineAPI زي نمط missed_sales.
    const [pendingVariance, setPendingVariance] = useState([]);
    useEffect(() => {
        if (!pharmacyId) return;
        let active = true;
        const fetchVariance = async () => {
            try {
                const { data, error } = await supabase
                    .from("inventory_variance_log")
                    .select("id, product_id, event_type, created_at, notes")
                    .eq("pharmacy_id", pharmacyId)
                    .eq("status", "pending")
                    .order("created_at", { ascending: false })
                    .limit(50);
                if (error) throw error;
                if (active && data) setPendingVariance(data);
            } catch (err) {
                console.error("fetchVariance failed:", err);
            }
        };
        fetchVariance();
        return () => { active = false; };
    }, [pharmacyId]);

    useEffect(() => {
        if (!pharmacyId || !currentUser?.name) return;

        // 🆕 نفس فلسفة fetchMissed: أونلاين → Supabase + كتابة كاش، أوفلاين/فشل → قراءة
        // من monthly_targets_cache (اللي أصلاً بيتملى offline-first من upsertMonthlyTarget()
        // وقت ما حد يحدد التارجت، أونلاين كان أو أوفلاين)
        const loadTarget = async () => {
            if (navigator.onLine) {
                try {
                    const { data, error } = await supabase
                        .from("monthly_targets")
                        .select("target_amount")
                        .eq("pharmacy_id", pharmacyId)
                        .eq("pharmacist_name", currentUser.name)
                        .eq("month", monthKey)
                        .maybeSingle();
                    if (error) throw error;
                    setMyTarget(data?.target_amount || 0);
                    window.offlineAPI?.upsertMonthlyTargetCache({
                        pharmacyId,
                        row: { pharmacist_name: currentUser.name, month: monthKey, target_amount: data?.target_amount || 0 },
                    }).catch(() => { });
                    return;
                } catch (err) {
                    console.error("loadTarget online failed, falling back to cache:", err);
                }
            }

            try {
                const cached = await window.offlineAPI?.getMonthlyTargetsCache(pharmacyId) || [];
                const row = cached.find((r) => r.pharmacist_name === currentUser.name && r.month === monthKey);
                setMyTarget(row?.target_amount || 0);
            } catch (err) {
                console.error("loadTarget cache read failed:", err);
                setMyTarget(0);
            }
        };
        loadTarget();
    }, [pharmacyId, currentUser?.name, monthKey]);

    const myMonthSales = sales.filter(
        (s) => (s.created_at || s.date || "").startsWith(monthKey) &&
            !s.returned &&
            (currentUser?.id ? s.cashier_user_id === currentUser.id : s.cashier_name === currentUser?.name)
    );
    const myAchieved = myMonthSales.reduce((a, s) => a + (s.total || 0), 0);

    const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysLeftInMonth = lastDayOfMonth - new Date().getDate();

    const targetProgress = myTarget > 0 ? Math.min((myAchieved / myTarget) * 100, 100) : 0;
    const targetRemaining = Math.max((myTarget || 0) - myAchieved, 0);
    const requiredDaily = daysLeftInMonth > 0 ? targetRemaining / daysLeftInMonth : targetRemaining;
    // ── حسابات المبيعات ──
    const todaySales = sales.filter((s) => isTodayRecord(s) && !s.returned);
    const todayCashSales = todaySales.filter((s) => s.payment !== "آجل" && s.payment !== "تحصيل آجل");
    const todayCreditPaid = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
    // 🆕 المرتجعات هنا بتتحسب من treasury_entries (نفس مصدر تقفيل اليوم) مش من sales.returned مباشرة،
    // عشان: 1) مرتجع فاتورة آجل ميتخصمش من الخزنة (مفيش كاش خرج أصلاً)، 2) المرتجع الجزئي (مش كل الفاتورة) يتحسب صح.
    const todayReturnsForDash = (treasuryEntries || [])
        .filter((e) => isTodayRecord(e) && e.type === "expense" && e.sub_type === "sales_return")
        .reduce((a, e) => a + (e.amount || 0), 0);
    const monthReturnsForDash = (treasuryEntries || [])
        .filter((e) => e.date?.startsWith(monthKey) && e.type === "expense" && e.sub_type === "sales_return")
        .reduce((a, e) => a + (e.amount || 0), 0);
    const todayRev = todayCashSales.reduce((a, s) => a + s.total, 0);
    const todayAjilTotal = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
    const todayAvgInvoice = todayCashSales.length > 0 ? todayRev / todayCashSales.length : 0;

    // ── مبيعات الشبكة اليوم (فواتير بطاقة كاملة + جزء الكارت من الفواتير المختلطة) ──
    const todayNetworkSales = todaySales.reduce((a, s) => {
        if (s.payment === "بطاقة") return a + (s.total || 0);
        if (s.payment === "مختلط" && s.payment_split) return a + (s.payment_split.card || 0);
        return a;
    }, 0);
    // مبيعات الكاش الصافية لعرض منفصل عن الشبكة في كارت خزنة اليوم (todayRev يبقى الإجمالي الشامل ويُستخدم في "صافي اليوم")
    const todayCashOnlySales = todayRev - todayNetworkSales;

    // 🆕 نسخة خاصة بكارت "خزنة اليوم" بس (تحسب الكاش الفعلي): ما بتستبعدش الفاتورة اللي اترجعت
    // بالكامل زي todaySales فوق — عشان لو استبعدناها هنا هي كمان، المرتجع هيتخصم مرتين (تشال بالكامل
    // من هنا + قيمتها تتخصم تاني من todayReturnsForDash). المرتجع الصحيح مصدره الوحيد todayReturnsForDash.
    const todayCashSalesForTreasury = sales.filter((s) => isTodayRecord(s) && s.payment !== "آجل" && s.payment !== "تحصيل آجل");
    const todayRevForTreasury = todayCashSalesForTreasury.reduce((a, s) => a + s.total, 0);
    const todayNetworkSalesForTreasury = todayCashSalesForTreasury.reduce((a, s) => {
        if (s.payment === "بطاقة") return a + (s.total || 0);
        if (s.payment === "مختلط" && s.payment_split) return a + (s.payment_split.card || 0);
        return a;
    }, 0);
    const todayCashOnlySalesForTreasury = todayRevForTreasury - todayNetworkSalesForTreasury;

    // ── النثريات المسجّلة اليوم من سجل الخزنة ──
    const todayPettyExpenses = (treasuryEntries || [])
        .filter((e) => isTodayRecord(e) && e.type === "expense" && e.sub_type === "petty")
        .reduce((a, e) => a + (e.amount || 0), 0);

    const monthSales = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned);
    const monthCashSales = monthSales.filter((s) => s.payment !== "آجل");
    const monthRev = monthCashSales.reduce((a, s) => a + s.total, 0);
    const monthCreditCollected = creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0);
    const monthAjilTotal = monthSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
    const monthAvgInvoice = monthCashSales.length > 0 ? monthRev / monthCashSales.length : 0;

    // ── آخر 7 أيام للجراف ──
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return todayLocal(d);
    });
    const last7Data = last7Days.map((day) => {
        const daySales = sales.filter((s) => s.date === day && !s.returned && s.payment !== "آجل");
        return { day, rev: daySales.reduce((a, s) => a + s.total, 0) };
    });
    const maxRev = Math.max(...last7Data.map((d) => d.rev), 1);

    // ── آخر 6 أشهر ──
    const getLast6Months = () => {
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push(d.toISOString().slice(0, 7));
        }
        return months;
    };
    const last6Months = getLast6Months();
    // ربح صنف واحد داخل فاتورة = (سعر البيع - التكلفة) × الكمية
    // التكلفة تُقرأ من الـ item نفسه (مسجلة وقت البيع) وإن لم توجد (فواتير قديمة) نرجع لتكلفة الصنف الحالية كتقريب
    const getSaleItems = (s) => {
        try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
        catch { return []; }
    };
    const calcSaleProfit = (s) => {
        const items = getSaleItems(s).filter((it) => !it.isMissed); // الأصناف المفقودة (طلب بدون مخزون) مش بيع فعلي ومالهاش ربح
        const rawProfit = items.reduce((sum, it) => {
            const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
            const price = it.price ?? 0;
            return sum + (price - cost) * (it.qty || 0);
        }, 0);
        // الخصم بيتطبق على مستوى الفاتورة كلها (subtotal + ضريبة) مش موزّع على كل صنف،
        // وبما إن التكلفة ثابتة، أي خصم بيقلل الربح بقيمته بالكامل
        const discount = s.discount_amt ?? s.discountAmt ?? 0;
        return rawProfit - discount;
    };
    const monthsData = last6Months.map((mk) => {
        const mSales = sales.filter((s) => s.date?.startsWith(mk) && !s.returned);
        const mCash = mSales.filter((s) => s.payment !== "آجل");
        const mRev = mCash.reduce((a, s) => a + s.total, 0);
        const mPurchases = purchases.filter((p) => (p.created_at || p.date || "").startsWith(mk)).reduce((a, p) => a + (p.total || 0), 0);
        const mCreditPaid = creditPayments.filter((p) => p.date?.startsWith(mk)).reduce((a, p) => a + p.amount, 0);
        // الربح الفعلي = مجموع (سعر البيع - التكلفة) × الكمية لكل أصناف فواتير الشهر (وليس الفرق بين إجمالي البيع وإجمالي الشراء)
        const mProfit = mSales.reduce((sum, s) => sum + calcSaleProfit(s), 0);
        const label = new Date(mk + "-01").toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
        return { mk, label, mRev, mPurchases, mCreditPaid, mProfit };
    });

    // ══════════ مبيعات الأقسام (يومي/شهري) — إيراد + ربح لكل قسم ══════════
    // 🆕 خريطة ألوان موحّدة للأقسام — نفس اللون لنفس القسم في كل كروت الداشبورد (مبيعات الأقسام + قيمة المخزون)
    const CATEGORY_COLORS = {
        "دواء": COLORS.blue,
        "كوزمتك عادي": COLORS.teal,
        "كوزمتك طبي": COLORS.purple,
        "مستلزمات أطفال": COLORS.gold,
        "مستلزمات طبية": COLORS.red,
    };
    const DEPT_PALETTE = [COLORS.coral, COLORS.green, COLORS.blue, COLORS.purple, COLORS.teal, COLORS.gold, COLORS.red]; // احتياطي لأقسام مش في الخريطة الموحّدة
    // 🆕 مرتجعات كل قسم (قيمة) — من جدول returns (النوع "sales" فقط)، بنفس منطق تصنيف القسم المستخدم في المبيعات
    const computeDeptReturnsMap = (returnsArr) => {
        const map = {};
        (returnsArr || []).filter((r) => r.type === "sales").forEach((r) => {
            (r.items || []).forEach((it) => {
                const cat = it.category || it.main_category || it.mainCategory ||
                    products.find((p) => p.id === it.id)?.main_category ||
                    products.find((p) => p.id === it.id)?.category || "أخرى";
                const price = it.price ?? 0;
                const qty = it.returnQty || 0;
                map[cat] = (map[cat] || 0) + price * qty;
            });
        });
        return map;
    };
    const computeDeptStats = (salesArr, returnsArr = []) => {
        const map = {};
        salesArr.forEach((s) => {
            const items = getSaleItems(s).filter((it) => !it.isMissed);
            items.forEach((it) => {
                const cat = it.category || it.main_category || it.mainCategory ||
                    products.find((p) => p.id === it.id)?.main_category ||
                    products.find((p) => p.id === it.id)?.category || "أخرى";
                const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
                const price = it.price ?? 0;
                const qty = it.qty || 0;
                if (!map[cat]) map[cat] = { category: cat, revenue: 0, cost: 0 };
                map[cat].revenue += price * qty;
                map[cat].cost += cost * qty;
            });
        });
        const returnsMap = computeDeptReturnsMap(returnsArr);
        const rows = Object.values(map).map((r) => ({
            ...r,
            profit: r.revenue - r.cost,
            profitPct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0,
            returnValue: returnsMap[r.category] || 0,
            returnPct: r.revenue > 0 ? ((returnsMap[r.category] || 0) / r.revenue) * 100 : (returnsMap[r.category] ? 100 : 0),
        })).sort((a, b) => b.revenue - a.revenue);
        const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
        const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
        return { rows: rows.map((r) => ({ ...r, share: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0 })), totalRevenue, totalProfit };
    };
    const todayReturns = (returnsData || []).filter((r) => isTodayRecord(r));
    const monthReturns = (returnsData || []).filter((r) => r.date?.startsWith(monthKey));
    const deptStatsToday = computeDeptStats(todaySales, todayReturns);
    const deptStatsMonth = computeDeptStats(monthSales, monthReturns);

    // ══════════ أكثر الأصناف مبيعًا (يومي/شهري) — عدد قابل للتحديد من الصيدلي/المدير ══════════
    const computeTopProducts = (salesArr, limit, sortBy = "qty") => {
        const map = {};
        salesArr.forEach((s) => {
            const items = getSaleItems(s).filter((it) => !it.isMissed);
            items.forEach((it) => {
                const prod = products.find((p) => p.id === it.id);
                const name = it.name || prod?.name || "صنف غير معروف";
                const price = it.price ?? 0;
                const qty = it.qty || 0;
                if (!map[it.id]) map[it.id] = { id: it.id, name, qty: 0, revenue: 0 };
                map[it.id].qty += qty;
                map[it.id].revenue += price * qty;
            });
        });
        return Object.values(map).sort((a, b) => b[sortBy] - a[sortBy]).slice(0, limit);
    };
    const [topProductsTab, setTopProductsTab] = useState("today"); // "today" | "month"
    const [topProductsCount, setTopProductsCount] = useState(10);
    const [topProductsSortBy, setTopProductsSortBy] = useState("qty"); // "qty" | "revenue"
    const topProductsToday = computeTopProducts(todaySales, topProductsCount, topProductsSortBy);
    const topProductsMonth = computeTopProducts(monthSales, topProductsCount, topProductsSortBy);

    // ── تنبيهات الأصناف ──
    const lowStock = products.filter((p) => p.stock <= (p.min_stock || p.minStock || 0));
    const expiringSoon = products.filter((p) => {
        if (!p.expiry) return false;
        const diff = (new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24);
        return diff < 90 && diff > 0;
    });

    // ══════════ بيانات مركز التنبيهات ══════════
    const todayISO = todayLocal();

    // عروض تلقائية (غير دواء + قرب صلاحية حسب نفس قواعد قسم العروض) + عروض يدوية لا تحتاج هنا عداد دقيق (تُدار في قسمها)
    const autoPromoCandidates = products.filter((p) => {
        const cat = p.main_category || p.category || "";
        if (cat === "دواء") return false;
        if (!p.expiry) return false;
        const disc = calcAutoDiscount(p.expiry);
        return disc > 0 && (p.stock || 0) > 0;
    });

    // استحقاقات الموردين القريبة (خلال 5 أيام أو متأخرة بالفعل)
    const supplierDues = (suppliers || []).map((s) => {
        const supPurchases = (purchases || []).filter((p) => p.supplier === s.id && p.payment_status !== "مسددة");
        let nearestDue = null, isOverdue = false;
        supPurchases.forEach((po) => {
            const due = new Date(po.date);
            due.setDate(due.getDate() + (s.payment_terms || 30));
            const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
            if (nearestDue === null || daysLeft < nearestDue) nearestDue = daysLeft;
            if (daysLeft < 0) isOverdue = true;
        });
        return { supplier: s, daysLeft: nearestDue, isOverdue };
    }).filter((d) => d.daysLeft !== null && d.daysLeft <= 5);

    // عملاء جدد خلال آخر 7 أيام
    const newCustomers = (customers || []).filter((c) => {
        const created = c.created_at ? new Date(c.created_at) : null;
        if (!created) return false;
        const days = (new Date() - created) / (1000 * 60 * 60 * 24);
        return days <= 7;
    });

    // عملاء مختفون: كان عندهم تعامل سابق ومالهمش زيارة منذ أكثر من 45 يوم
    const disappearedCustomers = (customers || []).filter((c) => {
        if (!c.lastVisit) return false;
        const days = (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
        return days > 45 && days < 365 && (c.visits || 0) > 0;
    });

    // عملاء متأخرين في سداد مديونية الآجل (حسب فترة السداد الخاصة بكل عميل)
    const customerDues = (customers || []).map((c) => {
        const ajilSales = (sales || []).filter((s) => s.customer === c.id && s.payment === "آجل");
        const terms = c.payment_terms || 30;
        let oldestDaysLeft = null, isOverdue = false, remainingTotal = 0;
        ajilSales.forEach((inv) => {
            const totalPaid = (creditPayments || [])
                .filter((p) => p.invoice_id === inv.id)
                .reduce((sum, p) => sum + (p.amount || 0), 0);
            const remaining = (inv.total || 0) - totalPaid;
            if (remaining <= 0.01) return;
            remainingTotal += remaining;
            const due = new Date(inv.created_at || inv.date);
            due.setDate(due.getDate() + terms);
            const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
            if (oldestDaysLeft === null || daysLeft < oldestDaysLeft) oldestDaysLeft = daysLeft;
            if (daysLeft < 0) isOverdue = true;
        });
        return { customer: c, daysLeft: oldestDaysLeft, isOverdue, remainingTotal };
    }).filter((d) => d.isOverdue);

    // موعد إقفال الإقرار الضريبي الربعي (نهاية الشهر التالي لنهاية الربع - نظام ضريبة القيمة المضافة السعودي)
    const taxDeadlineInfo = (() => {
        const now = new Date();
        const quarterEndMonth = [2, 5, 8, 11].find((m) => m >= now.getMonth()) ?? 2; // فبراير=1 .. نهاية كل ربع
        const qEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0); // آخر يوم في الشهر التالي للربع
        const daysLeft = Math.ceil((qEnd - now) / (1000 * 60 * 60 * 24));
        return { daysLeft, date: qEnd };
    })();

    // إجمالي مركز التنبيهات
    const alertCenterGroups = [
        { key: "essential", icon: "💊", label: "نفاذ/قرب نفاذ دواء أساسي", count: alerts.length, color: COLORS.red, tab: "products" },
        { key: "variance", icon: "🧮", label: "أصناف تحتاج تسوية رصيد", count: pendingVariance.length, color: COLORS.red, tab: "purchase" },
        { key: "lowstock", icon: "📦", label: "مخزون منخفض", count: lowStock.length, color: COLORS.gold, tab: "products" },
        { key: "expiry", icon: "⏰", label: "أصناف قرب الانتهاء", count: expiringSoon.length, color: COLORS.gold, tab: "products" },
        { key: "supplier", icon: "🧾", label: "استحقاق مورد قريب/متأخر", count: supplierDues.length, color: COLORS.red, tab: "suppliers" },
        { key: "newcust", icon: "🆕", label: "عملاء جدد هذا الأسبوع", count: newCustomers.length, color: COLORS.green, tab: "customers" },
        { key: "lostcust", icon: "👻", label: "عملاء مختفون", count: disappearedCustomers.length, color: COLORS.textDim, tab: "customers" },
        { key: "custdebt", icon: "💳", label: "عملاء متأخرين في السداد", count: customerDues.length, color: COLORS.red, tab: "customers" },
        { key: "tax", icon: "🗂️", label: "موعد الإقرار الضريبي الربعي", count: taxDeadlineInfo.daysLeft <= 14 ? 1 : 0, color: COLORS.gold, tab: "tax_report" },
        { key: "appoint", icon: "📅", label: "مواعيد مهمة (رخصة/إيجار)", count: 2, color: COLORS.green, tab: "dashboard" },
    ];
    // العروض التلقائية بتتطبق وبتتلغي تلقائيًا حسب الصلاحية بدون تدخل بشري — مش بند تنبيه يحتاج إجراء
    const totalAlertsCount = alertCenterGroups.reduce((a, g) => a + g.count, 0);

    // ══════════ تايم لاين حركة اليوم (بالساعة) ══════════
    const todaySalesForTimeline = sales.filter((s) => s.date === todayISO && !s.returned);
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, rev: 0 }));
    todaySalesForTimeline.forEach((s) => {
        const t = s.created_at || s.time || null;
        const h = t ? new Date(t).getHours() : null;
        if (h === null || isNaN(h)) return;
        hourBuckets[h].count += 1;
        hourBuckets[h].rev += s.total || 0;
    });
    const activeHours = hourBuckets.filter((b) => b.hour >= 7 && b.hour <= 23); // ساعات عمل الصيدلية المعتادة
    const maxHourCount = Math.max(...activeHours.map((b) => b.count), 1);

    // ── معلومات الشفت الحالي ──
    const currentShift = shifts?.find((s) => !s.end_time && s.user === currentUser?.name) || null;
    const shiftSales = currentShift
        ? sales.filter((s) => s.shift === currentShift.id && !s.returned)
        : [];
    const shiftReturns = currentShift
        ? sales.filter((s) => s.shift === currentShift.id && s.returned)
        : [];
    const shiftReturnsTotal = shiftReturns.reduce((a, s) => a + (s.total || 0), 0);
    const shiftItems = shiftSales.flatMap((s) => {
        try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
        catch { return []; }
    });
    const avgItemsPerInvoice = shiftSales.length > 0 ? (shiftItems.length / shiftSales.length).toFixed(1) : 0;

    // ── helpers ──
    const S = (val) => privacyMode
        ? <span style={{ filter: "blur(6px)", userSelect: "none" }}>{val}</span>
        : val;

    const VAR = {
        bg: COLORS.appBg,
        surface: COLORS.surface,
        surface2: COLORS.surfaceAlt,
        border: COLORS.border,
        accent: COLORS.accent,
        accent2: COLORS.blue,
        warn: COLORS.gold,
        danger: COLORS.red,
        text: COLORS.textPrimary,
        muted: COLORS.textDim,
    };

    const card = {
        background: VAR.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${VAR.border}`,
        borderRadius: 12,
        overflow: "hidden",
    };

    const SALES_TABS = [
        { key: "today", label: "اليوم" },
        { key: "month", label: "الشهر" },
        { key: "compare", label: "المقارنة" },
    ];

    // ── محتوى تاب المبيعات ──
    const renderSalesStats = () => {
        if (salesTab === "compare") {
            const maxVal = Math.max(...monthsData.map((m) => m.mRev), 1);
            return (
                <>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                            <thead>
                                <tr style={{ background: VAR.bg }}>
                                    {["الشهر", "المبيعات", "المشتريات", "السداد", "الربح"].map((h) => (
                                        <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: VAR.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {monthsData.map((m) => (
                                    <tr key={m.mk} style={{ borderBottom: `1px solid ${VAR.border}`, background: m.mk === monthKey ? COLORS.tealSoft : "transparent" }}>
                                        <td style={{ padding: "9px 12px", color: VAR.text, fontWeight: m.mk === monthKey ? 700 : 400, fontSize: 12 }}>
                                            {m.label} {m.mk === monthKey && "🔵"}
                                        </td>
                                        <td style={{ padding: "9px 12px", color: VAR.accent, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mRev.toFixed(0))}</td>
                                        <td style={{ padding: "9px 12px", color: VAR.danger, fontFamily: "monospace", fontSize: 12 }}>{S(m.mPurchases.toFixed(0))}</td>
                                        <td style={{ padding: "9px 12px", color: VAR.warn, fontFamily: "monospace", fontSize: 12 }}>{S(m.mCreditPaid.toFixed(0))}</td>
                                        <td style={{ padding: "9px 12px", color: m.mProfit >= 0 ? VAR.accent : VAR.danger, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mProfit.toFixed(0))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                        {monthsData.map((m) => (
                            <div key={m.mk} style={{ marginBottom: 8 }}>
                                <div style={{ color: VAR.muted, fontSize: 10, marginBottom: 2 }}>{m.label}</div>
                                <div style={{ display: "flex", gap: 4 }}>
                                    <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                                        <div style={{ background: VAR.accent, height: "100%", borderRadius: 3, width: `${(m.mRev / maxVal) * 100}%` }} />
                                    </div>
                                    <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                                        <div style={{ background: VAR.danger, height: "100%", borderRadius: 3, width: `${(m.mPurchases / maxVal) * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                            <span style={{ color: VAR.accent, fontSize: 10 }}>■ مبيعات</span>
                            <span style={{ color: VAR.danger, fontSize: 10 }}>■ مشتريات</span>
                        </div>
                    </div>
                </>
            );
        }

        const isToday = salesTab === "today";
        const rev = isToday ? todayRev : monthRev;
        const invoices = isToday ? todayCashSales : monthCashSales;
        const missed = isToday ? missedToday.value : missedMonth.value;
        const missedCnt = isToday ? missedToday.count : missedMonth.count;
        const avgInv = isToday ? todayAvgInvoice : monthAvgInvoice;
        const creditPaid = isToday ? todayCreditPaid : monthCreditCollected;
        const ajilTotal = isToday ? todayAjilTotal : monthAjilTotal;
        const returns = isToday ? todayReturnsForDash : monthReturnsForDash;
        const returnsCnt = isToday
            ? sales.filter((s) => s.returned && s.returnDate === today).length
            : sales.filter((s) => s.returned && s.returnDate?.startsWith(monthKey)).length;

        return (
            <>
                {/* 5 stat cells — كل كارت دلالي بخلفية Soft Tint من لونه */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, padding: "14px 16px" }}>
                    {[
                        { label: "إجمالي المبيعات", val: rev.toFixed(0) + " ر.س", color: VAR.accent, sub: `${invoices.length} فاتورة` },
                        { label: "سداد الآجل", val: creditPaid.toFixed(0) + " ر.س", color: VAR.accent2, sub: `مديونية ${ajilTotal.toFixed(0)}` },
                        { label: "مرتجع المبيعات", val: returns.toFixed(0) + " ر.س", color: VAR.danger, sub: `${returnsCnt} فاتورة مرتجعة` },
                        { label: "الفرص الضائعة", val: missed.toFixed(0) + " ر.س", color: VAR.warn, sub: `${missedCnt} صنف مفقود`, onClick: () => setShowMissedModal(true) },
                        { label: "متوسط الفاتورة", val: avgInv.toFixed(1) + " ر.س", color: VAR.text, sub: "ريال", neutral: true },
                    ].map((cell, i) => (
                        <div
                            key={i}
                            onClick={cell.onClick}
                            style={{
                                padding: "12px 14px",
                                borderRadius: 10,
                                background: cell.neutral ? VAR.surface2 : tint(cell.color, 0.08),
                                border: `1px solid ${cell.neutral ? VAR.border : tint(cell.color, 0.3)}`,
                                cursor: cell.onClick ? "pointer" : "default",
                            }}
                        >
                            <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600, marginBottom: 4, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}>
                                {cell.label}
                                {cell.onClick && <span style={{ fontSize: 9, opacity: 0.7 }}>↗</span>}
                            </div>
                            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: cell.color }}>
                                {S(cell.val)}
                            </div>
                            <div style={{ fontSize: 10, color: VAR.muted, marginTop: 3 }}>{S(cell.sub)}</div>
                        </div>
                    ))}
                </div>

                {/* Bar chart - آخر 7 أيام */}
                <div style={{ padding: "12px 16px", height: 100, display: "flex", alignItems: "flex-end", gap: 6 }}>
                    {last7Data.map((d, i) => {
                        const isToday2 = d.day === today;
                        const h = `${Math.max((d.rev / maxRev) * 76, 4)}px`;
                        return (
                            <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                                <div style={{
                                    width: "100%", height: h, borderRadius: "4px 4px 0 0",
                                    background: isToday2
                                        ? `linear-gradient(to top, ${VAR.accent}, ${VAR.accent2})`
                                        : VAR.surface2,
                                    boxShadow: isToday2 ? `0 0 10px rgba(0,200,150,0.3)` : "none",
                                    transition: "height 0.4s",
                                }} />
                                <div style={{ fontSize: 9, color: isToday2 ? VAR.accent : VAR.muted, fontFamily: "monospace" }}>
                                    {isToday2 ? "اليوم" : d.day.slice(8)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    // ══════════ كارت العروض المتوفرة ══════════
    const activePromos = (promos || []).filter((p) => {
        if (!p.end_date) return false;
        if (p.start_date && p.start_date > today) return false; // لسه ماجاش وقتها
        if (p.end_date < today) return false;
        return isPromoFulfillable(p, products.find((pr) => pr.id === p.product_id), products);
    });
    // 🆕 أقرب تاريخ صلاحية لكل صنف من فواتير الشراء (batches) + fallback لـ p.expiry — نفس منطق
    // productEarliestExpiry في PromotionsModule، عشان الكارت ده يطابق العروض التلقائية الحقيقية
    // بدل ما يعتمد بس على p.expiry اللي ممكن يبقى فاضي أو قديم لو الصلاحية متسجلة في الباتش بس
    const dashProductEarliestExpiry = (() => {
        const map = {};
        (purchases || []).forEach((pu) => {
            const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
            (items || []).forEach((item) => {
                const expiry = item.expiry_date || item.expiry;
                if (!expiry || !item.id) return;
                if (!map[item.id] || expiry < map[item.id]) map[item.id] = expiry;
            });
        });
        (products || []).forEach((p) => {
            if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) map[p.id] = p.expiry;
        });
        return map;
    })();
    const autoPromoProducts = products
        .map((p) => ({ ...p, expiry: dashProductEarliestExpiry[p.id] || p.expiry }))
        .filter((p) => {
            if (!p.expiry) return false;
            const daysLeft = Math.ceil((new Date(p.expiry).getTime() - Date.now()) / 86400000);
            return daysLeft > 0 && daysLeft <= 90 && (p.stock ?? 0) > 0;
        });

    // ══════════ كارت تغيير الأسعار ══════════
    const oneWeekAgo = todayLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const recentPriceChanges = (() => {
        const changes: any[] = [];
        const recentPurchases = (purchases || [])
            .filter((po) => po.date >= oneWeekAgo)
            .sort((a: any, b: any) => b.date.localeCompare(a.date));
        const seen = new Set<string>();
        recentPurchases.forEach((po: any) => {
            (po.items || []).forEach((item: any) => {
                if (seen.has(item.id)) return;
                const prod = products.find((p) => p.id === item.id);
                if (!prod) return;
                const newPrice = item.salePrice || item.newSalePrice;
                const oldPrice = prod.price;
                if (!newPrice || !oldPrice) return;
                const diff = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
                if (Math.abs(diff) >= 1) {
                    seen.add(item.id);
                    changes.push({ name: prod.name_ar || prod.name || item.name || "", oldPrice, newPrice, date: po.date, diff });
                }
            });
        });
        return changes.slice(0, 15);
    })();

    // ── قيمة المخزون حسب التصنيف الرئيسي ──
    const stockByCategory = (() => {
        // 🆕 بتستخدم نفس CATEGORY_COLORS الموحّدة مع كارت "مبيعات الأقسام" — نفس القسم = نفس اللون في الكارتين
        const cats = Object.keys(MAIN_CATEGORIES);
        const grouped = {};
        cats.forEach((c) => { grouped[c] = 0; });
        let otherVal = 0;

        products.forEach((p) => {
            const cat = p.main_category || p.mainCategory || p.category || "";
            const val = (p.cost || 0) * (p.stock || 0);
            if (grouped.hasOwnProperty(cat)) grouped[cat] += val;
            else otherVal += val;
        });

        const total = Object.values(grouped).reduce((s, v) => s + v, 0) + otherVal;

        const rows = cats
            .map((c) => ({ label: c, value: grouped[c], color: CATEGORY_COLORS[c] }))
            .concat(otherVal > 0 ? [{ label: "أخرى", value: otherVal, color: VAR.muted }] : [])
            .filter((r) => r.value > 0)
            .sort((a, b) => b.value - a.value)
            .map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }));

        return { rows, total };
    })();

    const stockDonutGradient = (() => {
        let acc = 0;
        return stockByCategory.rows
            .map((r) => {
                const start = acc;
                acc += r.pct;
                return `${r.color} ${start}% ${acc}%`;
            })
            .join(", ");
    })();

    // ── حالة طي/فتح الكروت الكبيرة ──
    const [openCard, setOpenCard] = useState("sales"); // 🆕 كارت "المبيعات والفرص" مفتوح افتراضيًا عشان أهم رقم يبان أول ما تدخل الصفحة
    const toggleCard = (key) => setOpenCard((prev) => (prev === key ? null : key));

    // غلاف كارت قابل للطي: عنوان + أيقونة + شارة عدد (اختياري) + سهم، والمحتوى يظهر فقط لو الكارت مفتوح
    // 🆕 urgent: بوردر/توهج أحمر لما يكون الكارت فيه حاجة تحتاج انتباه فوري (زي وجود تنبيهات فعلية)
    // 🆕 wide: الكارت ياخد عرض عمودين حتى وهو مقفول (لأهم كارت في الداشبورد)
    const CollapsibleCard = ({ cardKey, icon, title, badge, badgeColor, children, urgent = false, wide = false }) => {
        const isOpen = openCard === cardKey;
        return (
            <div style={{
                ...card, display: "flex", flexDirection: "column",
                gridColumn: isOpen ? "1 / -1" : (wide ? "span 2" : "auto"),
                ...(urgent ? { border: `1px solid ${tint(VAR.danger, 0.5)}`, boxShadow: `0 0 16px ${tint(VAR.danger, 0.18)}` } : {}),
            }}>
                <div
                    onClick={() => toggleCard(cardKey)}
                    style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "14px 16px", cursor: "pointer", userSelect: "none",
                        borderBottom: isOpen ? `1px solid ${VAR.border}` : "none",
                    }}
                >
                    <span style={{ fontSize: 17 }}>{icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: VAR.text, flex: 1 }}>{title}</span>
                    {badge !== undefined && badge !== null && (
                        <span style={{
                            background: urgent ? `${VAR.danger}26` : (badgeColor ? `${badgeColor}26` : VAR.surface2),
                            color: urgent ? VAR.danger : (badgeColor || VAR.muted),
                            borderRadius: 99, fontSize: 11, padding: "2px 9px", fontWeight: 700, fontFamily: "monospace",
                        }}>
                            {badge}
                        </span>
                    )}
                    <span style={{ color: VAR.muted, fontSize: 12, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
                </div>
                {isOpen && <div>{children}</div>}
            </div>
        );
    };


    return (
        <div style={{ fontFamily: "'Cairo', sans-serif" }}>

            {/* ── Alert Strip (مختصر يفتح مركز التنبيهات) ── */}
            {totalAlertsCount > 0 && (
                <div style={{
                    background: "linear-gradient(90deg, rgba(239,68,68,0.12), transparent)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 10, padding: "10px 16px", marginBottom: 20,
                    display: "flex", alignItems: "center", gap: 12, fontSize: 13,
                }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ flex: 1, color: VAR.muted }}>
                        <strong style={{ color: VAR.danger }}>{totalAlertsCount} تنبيه تحتاج تدخل</strong>
                        <span style={{ color: VAR.muted }}> — راجع مركز التنبيهات بالأسفل</span>
                    </div>
                    <button
                        onClick={() => setPrivacyMode(!privacyMode)}
                        style={{
                            background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`,
                            borderRadius: 8, padding: "4px 12px", fontSize: 11,
                            color: VAR.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                            fontFamily: "inherit",
                        }}
                    >
                        {privacyMode ? "🙈 إظهار" : "👁 إخفاء"}
                    </button>
                </div>
            )}

            {/* ── Hero Strip: أهم الأرقام بارزة وظاهرة دايمًا من غير ما تفتح أي كارت ── */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
                maxWidth: 1100,
                marginLeft: "auto",
                marginRight: "auto",
            }}>
                {[
                    { label: "مبيعات اليوم", value: todayRev, color: VAR.accent, icon: "📊" },
                    { label: "ربح اليوم", value: deptStatsToday.totalProfit, color: COLORS.green, icon: "💹" },
                    { label: "خزنة اليوم", value: todayRevForTreasury + todayCreditPaid - todayReturnsForDash - todayPettyExpenses, color: VAR.accent2, icon: "💵" },
                    { label: "تنبيهات تحتاج تدخل", value: totalAlertsCount, isCount: true, color: totalAlertsCount > 0 ? VAR.danger : VAR.muted, icon: "🔔" },
                ].map((m) => (
                    <div
                        key={m.label}
                        onClick={() => m.label === "تنبيهات تحتاج تدخل" ? setOpenCard("alerts") : setOpenCard("sales")}
                        style={{
                            ...card, padding: "14px 16px", cursor: "pointer",
                            borderColor: tint(m.color, 0.3),
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: VAR.muted, fontWeight: 600, marginBottom: 6 }}>
                            <span>{m.icon}</span>{m.label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: "monospace" }}>
                            {S(m.isCount ? m.value : `${m.value.toFixed(0)} ر.س`)}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── الكروت الرئيسية: مضغوطة وتتفتح بالضغط ── */}
            <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
                نظرة عامة
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
                maxWidth: 1100,
                marginLeft: "auto",
                marginRight: "auto",
            }}>

                {/* 1) المبيعات والفرص */}
                <CollapsibleCard cardKey="sales" icon="📊" title="المبيعات والفرص" badge={salesTab === "today" ? `${todayRev.toFixed(0)} ر.س` : null} badgeColor={VAR.accent} wide>
                    <div style={{ display: "flex", background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 2, gap: 2, margin: "10px 14px 0" }}>
                        {SALES_TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={(e) => { e.stopPropagation(); setSalesTab(t.key); }}
                                style={{
                                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                                    background: salesTab === t.key ? VAR.accent : "transparent",
                                    color: salesTab === t.key ? VAR.bg : VAR.muted,
                                    border: "none", cursor: "pointer", fontFamily: "inherit",
                                    transition: "all 0.15s",
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    {renderSalesStats()}
                </CollapsibleCard>

                <Modal
                    open={showMissedModal}
                    onClose={() => setShowMissedModal(false)}
                    title={`الفرص الضائعة — ${salesTab === "today" ? "اليوم" : "الشهر"}`}
                >
                    {(() => {
                        const items = salesTab === "today" ? missedToday.items : missedMonth.items;
                        if (!items || items.length === 0) {
                            return (
                                <div style={{ textAlign: "center", color: VAR.muted, fontSize: 13, padding: "30px 0" }}>
                                    لا توجد فرص ضائعة 🎉
                                </div>
                            );
                        }
                        return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {items.map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        style={{
                                            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                                            padding: "10px 12px", borderRadius: 8, background: VAR.surface2, border: `1px solid ${VAR.border}`, gap: 10,
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>{S(item.product_name || "—")}</div>
                                            <div style={{ fontSize: 11, color: VAR.muted, marginTop: 3 }}>
                                                {S(`الكمية: ${item.qty || 1}`)} · {S(`السبب: ${item.reason || "غير محدد"}`)}
                                                {item.cashier ? ` · ${item.cashier}` : ""}
                                                {salesTab === "month" && item.date ? ` · ${item.date}` : ""}
                                            </div>
                                            {item.customer_name && (
                                                <div style={{ fontSize: 11, color: VAR.accent, marginTop: 3, fontWeight: 600 }}>{S(`👤 العميل: ${item.customer_name}`)}</div>
                                            )}
                                            {item.notes && (
                                                <div style={{ fontSize: 11, color: VAR.muted, marginTop: 3 }}>{S(`ملاحظة: ${item.notes}`)}</div>
                                            )}
                                        </div>
                                        <div style={{ fontFamily: "monospace", fontWeight: 700, color: VAR.warn, fontSize: 14, whiteSpace: "nowrap" }}>
                                            {S(((item.price || 0) * (item.qty || 1)).toFixed(0) + " ر.س")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </Modal>

                {/* مبيعات الأقسام — يومي/شهري مع نسبة وقيمة الربح */}
                <CollapsibleCard
                    cardKey="departments"
                    icon="🏬"
                    title="مبيعات الأقسام"
                    badge={`${(deptTab === "today" ? deptStatsToday.totalRevenue : deptStatsMonth.totalRevenue).toFixed(0)} ر.س`}
                    badgeColor={VAR.accent2}
                >
                    <div style={{ display: "flex", background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 2, gap: 2, margin: "10px 14px 0" }}>
                        {[{ key: "today", label: "اليوم" }, { key: "month", label: "الشهر" }].map((t) => (
                            <button
                                key={t.key}
                                onClick={(e) => { e.stopPropagation(); setDeptTab(t.key); }}
                                style={{
                                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                                    background: deptTab === t.key ? VAR.accent2 : "transparent",
                                    color: deptTab === t.key ? VAR.bg : VAR.muted,
                                    border: "none", cursor: "pointer", fontFamily: "inherit",
                                    transition: "all 0.15s",
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {(() => {
                        const stats = deptTab === "today" ? deptStatsToday : deptStatsMonth;
                        if (stats.rows.length === 0) {
                            return (
                                <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "24px 0" }}>
                                    لا توجد مبيعات مسجّلة {deptTab === "today" ? "اليوم" : "هذا الشهر"} بعد
                                </div>
                            );
                        }
                        const overallProfitPct = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
                        return (
                            <>
                                {/* ملخص علوي */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, padding: "14px 14px 6px" }}>
                                    <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(VAR.accent, 0.08), border: `1px solid ${tint(VAR.accent, 0.28)}` }}>
                                        <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>إجمالي الإيراد</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: VAR.accent }}>{S(stats.totalRevenue.toFixed(0) + " ر.س")}</div>
                                    </div>
                                    <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(COLORS.green, 0.08), border: `1px solid ${tint(COLORS.green, 0.28)}` }}>
                                        <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>إجمالي الربح</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: COLORS.green }}>{S(stats.totalProfit.toFixed(0) + " ر.س")}</div>
                                    </div>
                                    <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(COLORS.gold, 0.08), border: `1px solid ${tint(COLORS.gold, 0.28)}` }}>
                                        <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>نسبة الربح</div>
                                        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{overallProfitPct.toFixed(1)}%</div>
                                    </div>
                                </div>

                                {/* كروت زجاجية ملونة لكل قسم — عرض الشريط بنسبة الحصة من الإيراد */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px 14px" }}>
                                    {stats.rows.map((r, i) => {
                                        const color = CATEGORY_COLORS[r.category] || DEPT_PALETTE[i % DEPT_PALETTE.length];
                                        return (
                                            <div
                                                key={r.category}
                                                style={{
                                                    position: "relative", borderRadius: 10, overflow: "hidden",
                                                    background: `linear-gradient(135deg, ${tint(color, 0.16)}, ${tint(color, 0.04)})`,
                                                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                                    border: `1px solid ${tint(color, 0.32)}`,
                                                    padding: "10px 12px",
                                                }}
                                            >
                                                {/* شريط تقدّم زجاجي بنسبة الحصة من إجمالي إيراد الفترة */}
                                                <div style={{
                                                    position: "absolute", top: 0, bottom: 0, right: 0,
                                                    width: `${Math.max(r.share, 3)}%`,
                                                    background: `linear-gradient(90deg, transparent, ${tint(color, 0.22)})`,
                                                    transition: "width 0.4s",
                                                }} />
                                                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <span style={{ width: 8, height: 8, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }} />
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{r.category}</span>
                                                    </div>
                                                    <span style={{ fontSize: 10, color: VAR.muted, fontFamily: "monospace" }}>{r.share.toFixed(0)}%</span>
                                                </div>
                                                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                                                    <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color }}>{S(r.revenue.toFixed(0) + " ر.س")}</span>
                                                    <span style={{ fontSize: 11, color: VAR.muted }}>
                                                        ربح {S(r.profit.toFixed(0) + " ر.س")}{" "}
                                                        <span style={{ color: r.profitPct >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                                                            ({r.profitPct.toFixed(0)}%)
                                                        </span>
                                                    </span>
                                                </div>
                                                {r.returnValue > 0 && (
                                                    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                                                        <span style={{ fontSize: 11, color: COLORS.red }}>↩️ مرتجعات {S(r.returnValue.toFixed(0) + " ر.س")}</span>
                                                        <span style={{ fontSize: 11, color: COLORS.red, fontWeight: 700 }}>({r.returnPct.toFixed(1)}%)</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    })()}
                </CollapsibleCard>

                {/* 🆕 أكثر الأصناف مبيعًا — يومي/شهري مع تحديد عدد الأصناف المعروضة */}
                <CollapsibleCard cardKey="topProducts" icon="⭐" title="أكثر الأصناف مبيعًا" badgeColor={VAR.accent2}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 6, margin: "10px 14px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", borderRadius: 6, gap: 2 }}>
                                {[{ key: "today", label: "اليوم" }, { key: "month", label: "الشهر" }].map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={(e) => { e.stopPropagation(); setTopProductsTab(t.key); }}
                                        style={{
                                            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                                            background: topProductsTab === t.key ? VAR.accent2 : "transparent",
                                            color: topProductsTab === t.key ? VAR.bg : VAR.muted,
                                            border: "none", cursor: "pointer", fontFamily: "inherit",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <select
                                value={topProductsCount}
                                onChange={(e) => { e.stopPropagation(); setTopProductsCount(Number(e.target.value)); }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${VAR.border}`, background: VAR.bg, color: VAR.text, fontSize: 11, fontFamily: "inherit" }}
                            >
                                {[5, 10, 15, 20, 30].map((n) => (
                                    <option key={n} value={n}>أعلى {n} صنف</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: VAR.muted }}>الترتيب حسب:</span>
                            <div style={{ display: "flex", borderRadius: 6, gap: 2 }}>
                                {[{ key: "qty", label: "الكمية المباعة" }, { key: "revenue", label: "قيمة المبيعات" }].map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={(e) => { e.stopPropagation(); setTopProductsSortBy(t.key); }}
                                        style={{
                                            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                                            background: topProductsSortBy === t.key ? VAR.accent2 : "transparent",
                                            color: topProductsSortBy === t.key ? VAR.bg : VAR.muted,
                                            border: "none", cursor: "pointer", fontFamily: "inherit",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const topList = topProductsTab === "today" ? topProductsToday : topProductsMonth;
                        if (topList.length === 0) {
                            return (
                                <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "24px 0" }}>
                                    لا توجد مبيعات مسجّلة {topProductsTab === "today" ? "اليوم" : "هذا الشهر"} بعد
                                </div>
                            );
                        }
                        const maxQty = Math.max(...topList.map((p) => p.qty), 1);
                        return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px 14px" }}>
                                {topList.map((p, i) => (
                                    <div
                                        key={p.id}
                                        style={{
                                            position: "relative", borderRadius: 10, overflow: "hidden",
                                            background: tint(COLORS.accent, 0.06),
                                            border: `1px solid ${tint(COLORS.accent, 0.22)}`,
                                            padding: "8px 12px",
                                        }}
                                    >
                                        <div style={{
                                            position: "absolute", top: 0, bottom: 0, right: 0,
                                            width: `${Math.max((p.qty / maxQty) * 100, 4)}%`,
                                            background: tint(COLORS.accent, 0.14),
                                        }} />
                                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: VAR.muted, width: 18 }}>{i + 1}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: VAR.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                                <span style={{ fontSize: 12, color: VAR.muted }}>{S(p.revenue.toFixed(0) + " ر.س")}</span>
                                                <Badge color={COLORS.accent + "22"} text={COLORS.accent}>{p.qty} وحدة</Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </CollapsibleCard>

                {/* 2) تارجت الشهر */}
                <CollapsibleCard cardKey="target" icon="🎯" title="تارجت الشهر" badge={myTarget ? `${targetProgress.toFixed(0)}%` : null} badgeColor={VAR.accent2}>
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                        {myTarget === null ? (
                            <div style={{ color: VAR.muted, fontSize: 12 }}>جاري التحميل...</div>
                        ) : myTarget === 0 ? (
                            <div style={{ color: VAR.muted, fontSize: 12 }}>لم يتم تحديد تارجت لك هذا الشهر</div>
                        ) : (
                            <>
                                <div>
                                    <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: VAR.accent, lineHeight: 1 }}>
                                        {S(`${targetProgress.toFixed(0)}%`)}
                                    </div>
                                    <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>
                                        {S(`من ${myTarget.toLocaleString()} ريال`)}
                                    </div>
                                </div>
                                <div style={{ height: 6, background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 99, overflow: "hidden" }}>
                                    <div style={{
                                        height: "100%", width: `${targetProgress}%`, borderRadius: 99,
                                        background: `linear-gradient(90deg, ${VAR.accent2}, ${VAR.accent})`,
                                        boxShadow: "0 0 8px rgba(0,200,150,0.4)",
                                    }} />
                                </div>
                                <div style={{ fontSize: 11, color: VAR.muted }}>
                                    متبقي <strong style={{ color: VAR.warn }}>{S(`${targetRemaining.toFixed(0)} ريال`)}</strong> في {daysLeftInMonth} يوم
                                </div>
                                <div style={{ borderTop: `1px solid ${VAR.border}`, paddingTop: 10 }}>
                                    <div style={{ fontSize: 10, color: VAR.muted, marginBottom: 4 }}>المطلوب يومياً</div>
                                    <div style={{ fontFamily: "monospace", fontSize: 22, color: VAR.warn, fontWeight: 700 }}>
                                        {S(requiredDaily.toFixed(0))} <span style={{ fontSize: 12, color: VAR.muted }}>ريال</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CollapsibleCard>

                {/* 3) مركز التنبيهات */}
                <CollapsibleCard cardKey="alerts" icon="🔔" title="مركز التنبيهات" badge={totalAlertsCount} badgeColor={VAR.danger} urgent={totalAlertsCount > 0}>
                    <div>
                        {totalAlertsCount === 0 && (
                            <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
                                لا توجد تنبيهات حالياً ✅
                            </div>
                        )}
                        {alertCenterGroups.filter((g) => g.count > 0).map((g) => (
                            <div key={g.key}>
                                <div
                                    onClick={() => setExpandedAlertGroup(expandedAlertGroup === g.key ? null : g.key)}
                                    style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, borderBottom: `1px solid ${VAR.border}`, fontSize: 12, cursor: "pointer" }}
                                >
                                    <span style={{ fontSize: 14 }}>{g.icon}</span>
                                    <div style={{ flex: 1, color: VAR.text, fontWeight: 600 }}>{g.label}</div>
                                    <div style={{
                                        fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 700, fontFamily: "monospace",
                                        background: g.count > 0 ? `${g.color}26` : "rgba(125,133,144,0.12)",
                                        color: g.count > 0 ? g.color : VAR.muted,
                                    }}>
                                        {g.count}
                                    </div>
                                    <span style={{ color: VAR.muted, fontSize: 11 }}>{expandedAlertGroup === g.key ? "▲" : "▼"}</span>
                                    <span onClick={(e) => { e.stopPropagation(); setTab(g.tab); }} style={{ color: VAR.accent2, fontSize: 11 }}>فتح →</span>
                                </div>
                                {expandedAlertGroup === g.key && (
                                    <div style={{ background: VAR.bg, padding: "8px 14px 12px" }}>
                                        {g.key === "essential" && (
                                            alerts.length === 0 ? <EmptyAlertRow text="لا توجد أدوية أساسية ناقصة ✅" muted={VAR.muted} /> :
                                                alerts.map((a, i) => (
                                                    <AlertRow key={i} text={a.name} badge={a.type === "danger" ? "نافذ" : `متبقي ${a.stock}`} color={a.type === "danger" ? VAR.danger : VAR.warn} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "variance" && (
                                            pendingVariance.length === 0 ? <EmptyAlertRow text="لا توجد أصناف تحتاج تسوية ✅" muted={VAR.muted} /> :
                                                pendingVariance.slice(0, 8).map((v) => {
                                                    const prod = products.find((p) => p.id === v.product_id);
                                                    const eventLabel = v.event_type === "scan_zero_stock" ? "رصيد صفر بالسكانر"
                                                        : v.event_type === "manual_adjustment" ? "تسوية يدوية"
                                                            : v.event_type === "shift_variance" ? "عجز/زيادة شفت"
                                                                : v.event_type;
                                                    return (
                                                        <AlertRow
                                                            key={v.id}
                                                            text={prod?.nameAr || prod?.name || "صنف محذوف/غير معروف"}
                                                            badge={eventLabel}
                                                            color={VAR.danger}
                                                            VAR={VAR}
                                                        />
                                                    );
                                                })
                                        )}
                                        {g.key === "lowstock" && (
                                            lowStock.length === 0 ? <EmptyAlertRow text="لا يوجد مخزون منخفض ✅" muted={VAR.muted} /> :
                                                lowStock.slice(0, 8).map((p) => (
                                                    <AlertRow key={p.id} text={p.name} badge={`${p.stock} / ${p.min_stock || p.minStock || 0}`} color={VAR.warn} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "expiry" && (
                                            expiringSoon.length === 0 ? <EmptyAlertRow text="لا توجد أصناف قرب الانتهاء ✅" muted={VAR.muted} /> :
                                                expiringSoon.slice(0, 8).map((p) => {
                                                    const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                                                    return <AlertRow key={p.id} text={p.name} badge={days < 30 ? `${days} يوم` : `${Math.ceil(days / 30)} شهر`} color={VAR.warn} VAR={VAR} />;
                                                })
                                        )}
                                        {g.key === "supplier" && (
                                            supplierDues.length === 0 ? <EmptyAlertRow text="لا توجد استحقاقات قريبة" muted={VAR.muted} /> :
                                                supplierDues.slice(0, 8).map((d) => (
                                                    <AlertRow key={d.supplier.id} text={d.supplier.name} badge={d.isOverdue ? `متأخر ${Math.abs(d.daysLeft)} يوم` : `خلال ${d.daysLeft} يوم`} color={d.isOverdue ? VAR.danger : VAR.warn} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "custdebt" && (
                                            customerDues.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء متأخرين في السداد ✅" muted={VAR.muted} /> :
                                                customerDues.slice(0, 8).map((d) => (
                                                    <AlertRow key={d.customer.id} text={d.customer.name} badge={`متأخر ${Math.abs(d.daysLeft)} يوم • ${d.remainingTotal.toFixed(0)} ر.س`} color={VAR.danger} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "newcust" && (
                                            newCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء جدد هذا الأسبوع" muted={VAR.muted} /> :
                                                newCustomers.slice(0, 8).map((c) => (
                                                    <AlertRow key={c.id} text={c.name} badge="جديد" color={VAR.accent} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "lostcust" && (
                                            disappearedCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء مختفون" muted={VAR.muted} /> :
                                                disappearedCustomers.slice(0, 8).map((c) => (
                                                    <AlertRow key={c.id} text={c.name} badge={`آخر زيارة ${c.lastVisit}`} color={VAR.muted} VAR={VAR} />
                                                ))
                                        )}
                                        {g.key === "tax" && (
                                            <AlertRow text="الإقرار الضريبي الربعي القادم" badge={`خلال ${taxDeadlineInfo.daysLeft} يوم`} color={taxDeadlineInfo.daysLeft <= 7 ? VAR.danger : VAR.warn} VAR={VAR} />
                                        )}
                                        {g.key === "appoint" && (
                                            <>
                                                <AlertRow text="تجديد الرخصة التجارية" badge="18 يوم" color={VAR.accent} VAR={VAR} />
                                                <AlertRow text="إيجار الصيدلية" badge="غداً" color={VAR.warn} VAR={VAR} />
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CollapsibleCard>

                {/* 4) قيمة المخزون حسب التصنيف الرئيسي */}
                <CollapsibleCard
                    cardKey="stockCategory"
                    icon="🥧"
                    title="قيمة المخزون حسب التصنيف"
                    badge={stockByCategory.total.toFixed(0) + " ر.س"}
                    badgeColor={COLORS.purple}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 16, flexWrap: "wrap" }}>
                        {/* الدونات */}
                        <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0, margin: "0 auto" }}>
                            <div
                                style={{
                                    width: "100%", height: "100%", borderRadius: "50%",
                                    background: stockByCategory.rows.length
                                        ? `conic-gradient(${stockDonutGradient})`
                                        : VAR.surface2,
                                    boxShadow: `0 0 24px ${tint(COLORS.purple, 0.25)}, inset 0 0 0 1px ${VAR.border}`,
                                    transition: "background 0.4s",
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute", inset: 18, borderRadius: "50%",
                                    background: VAR.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                                    border: `1px solid ${VAR.border}`,
                                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <div style={{ fontSize: 9, color: VAR.muted, fontWeight: 600 }}>إجمالي</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: VAR.text, fontFamily: "monospace" }}>
                                    {stockByCategory.total.toFixed(0)}
                                </div>
                                <div style={{ fontSize: 9, color: VAR.muted }}>ر.س</div>
                            </div>
                        </div>

                        {/* المفتاح (Legend) */}
                        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                            {stockByCategory.rows.length === 0 && (
                                <div style={{ fontSize: 12, color: VAR.muted, textAlign: "center", padding: "10px 0" }}>
                                    لا توجد بيانات مخزون بعد
                                </div>
                            )}
                            {stockByCategory.rows.map((r) => (
                                <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color}` }} />
                                        <div style={{ flex: 1, fontSize: 12, color: VAR.text }}>{r.label}</div>
                                        <div style={{ fontSize: 11, color: VAR.muted, fontFamily: "monospace" }}>{r.value.toFixed(0)} ر.س</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: r.color, fontFamily: "monospace", minWidth: 38, textAlign: "left" }}>
                                            {r.pct.toFixed(1)}%
                                        </div>
                                    </div>
                                    {/* 🆕 شريط تقدّم مصغّر بنفس روح كارت مبيعات الأقسام — يوحّد اللغة البصرية بين الكارتين */}
                                    <div style={{ height: 4, borderRadius: 99, background: VAR.surface2, overflow: "hidden", marginRight: 17 }}>
                                        <div style={{
                                            height: "100%", width: `${Math.max(r.pct, 2)}%`,
                                            background: `linear-gradient(90deg, ${tint(r.color, 0.35)}, ${r.color})`,
                                            borderRadius: 99, transition: "width 0.4s",
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleCard>

                {/* 5) العروض المتوفرة */}
                <CollapsibleCard cardKey="promos" icon="🏷️" title="العروض المتوفرة" badge={activePromos.length + autoPromoProducts.length} badgeColor={VAR.accent}>
                    <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
                        {activePromos.length === 0 && autoPromoProducts.length === 0 && (
                            <div style={{ padding: "20px 14px", color: VAR.muted, fontSize: 12, textAlign: "center" }}>لا توجد عروض نشطة</div>
                        )}
                        {/* العروض اليدوية */}
                        {activePromos.map((p) => {
                            const prod = products.find((pr) => pr.id === p.product_id);
                            const desc = describePromo(p, prod);
                            return (
                                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{prod?.name_ar || prod?.name || p.product_id}</div>
                                        <div style={{ fontSize: 10, color: VAR.muted }}>حتى {p.end_date}</div>
                                    </div>
                                    <span style={{ background: COLORS.tealSoft || "rgba(0,200,150,0.12)", color: VAR.accent, borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                                        {desc.label}
                                    </span>
                                </div>
                            );
                        })}
                        {/* العروض التلقائية (قرب الصلاحية) */}
                        {autoPromoProducts.map((p) => {
                            const daysLeft = Math.ceil((new Date(p.expiry).getTime() - Date.now()) / 86400000);
                            return (
                                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{p.name_ar || p.name}</div>
                                        <div style={{ fontSize: 10, color: COLORS.gold }}>⏳ صلاحية: {daysLeft} يوم · مخزون: {p.stock}</div>
                                    </div>
                                    <span style={{ background: COLORS.goldSoft || "#fef3c7", color: COLORS.gold, borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                                        تلقائي
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CollapsibleCard>

                {/* 6) تغيرات الأسعار */}
                <CollapsibleCard cardKey="prices" icon="💰" title="تغيرات الأسعار" badge={recentPriceChanges.length} badgeColor={VAR.accent2}>
                    <div style={{ fontSize: 10, color: VAR.muted, padding: "8px 14px 0" }}>آخر 7 أيام</div>
                    <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
                        {recentPriceChanges.length === 0 && (
                            <div style={{ padding: "20px 14px", color: VAR.muted, fontSize: 12, textAlign: "center" }}>لا توجد تغيرات في الأسعار هذا الأسبوع</div>
                        )}
                        {recentPriceChanges.map((c, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{c.name}</div>
                                    <div style={{ fontSize: 10, color: VAR.muted }}>{c.date} · {c.oldPrice} ← {c.newPrice} ر.س</div>
                                </div>
                                <span style={{
                                    background: c.diff > 0 ? (COLORS.redSoft || "#fde8e8") : (COLORS.greenSoft || "#d1fae5"),
                                    color: c.diff > 0 ? COLORS.red : COLORS.green,
                                    borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700,
                                }}>
                                    {c.diff > 0 ? "▲" : "▼"} {Math.abs(c.diff)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </CollapsibleCard>

                {/* 7) بطاقة الصيدلي */}
                <CollapsibleCard cardKey="shift" icon="👤" title={currentUser?.name || "الصيدلي"} badge={shiftSales.length} badgeColor={VAR.accent}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${VAR.accent}, ${VAR.accent2})`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, color: VAR.bg, flexShrink: 0,
                        }}>
                            {currentUser?.name?.[0] || "م"}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: VAR.muted }}>
                                {currentShift ? `شفت نشط · بدأ ${new Date(currentShift.start_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : "لا يوجد شفت مفتوح"}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 1, background: VAR.border }}>
                        {[
                            { label: "فواتير الشفت", val: shiftSales.length },
                            { label: "متوسط الأصناف/فاتورة", val: avgItemsPerInvoice },
                            { label: "عملاء مسجلين", val: shiftSales.filter((s) => s.customer_id).length + " / " + shiftSales.length },
                            { label: "مبيعات الشفت", val: S(shiftSales.reduce((a, s) => a + s.total, 0).toFixed(0) + " ر.س") },
                            { label: "مرتجع الشفت", val: S(shiftReturnsTotal.toFixed(0) + " ر.س"), color: VAR.danger },
                        ].map((stat, i) => (
                            <div key={i} style={{ background: VAR.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "8px 10px" }}>
                                <div style={{ fontSize: 10, color: VAR.muted }}>{stat.label}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: stat.color || VAR.text, marginTop: 2 }}>{stat.val}</div>
                            </div>
                        ))}
                    </div>
                </CollapsibleCard>

                {/* 8) خزنة اليوم */}
                <CollapsibleCard cardKey="treasury" icon="💵" title="خزنة اليوم" badge={(todayRevForTreasury + todayCreditPaid - todayReturnsForDash - todayPettyExpenses).toFixed(0) + " ر.س"} badgeColor={VAR.accent}>
                    <div style={{ padding: 16 }}>
                        {[
                            { label: "مبيعات كاش", val: todayCashOnlySalesForTreasury.toFixed(0), type: "in" },
                            { label: "شبكة / صراف", val: todayNetworkSalesForTreasury.toFixed(0), type: "in" },
                            { label: "سداد الآجل", val: todayCreditPaid.toFixed(0), type: "in" },
                            { label: "مصاريف نثرية", val: todayPettyExpenses.toFixed(0), type: "out" },
                            { label: "مرتجعات", val: todayReturnsForDash.toFixed(0), type: "out" },
                        ].map((row, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${VAR.border}`, fontSize: 12 }}>
                                <span style={{ color: VAR.muted }}>{row.label}</span>
                                <span style={{ fontFamily: "monospace", fontWeight: 600, color: row.type === "in" ? VAR.accent : VAR.danger }}>
                                    {row.type === "in" ? "+" : "-"} {S(row.val)}
                                </span>
                            </div>
                        ))}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", fontSize: 13, marginTop: 4, borderTop: `1px solid ${VAR.accent}` }}>
                            <span style={{ color: VAR.text, fontWeight: 700 }}>صافي اليوم</span>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: VAR.text, fontSize: 16 }}>
                                + {S((todayRevForTreasury + todayCreditPaid - todayReturnsForDash - todayPettyExpenses).toFixed(0))}
                            </span>
                        </div>
                    </div>
                </CollapsibleCard>

                {/* 9) إجراءات سريعة */}
                <CollapsibleCard cardKey="actions" icon="⚡" title="إجراءات سريعة">
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                            { icon: "💊", label: "فاتورة بيع جديدة", tab: "pos", bg: "rgba(0,200,150,0.15)" },
                            { icon: "📦", label: "استلام مشتريات", tab: "purchase", bg: "rgba(59,130,246,0.15)" },
                            { icon: "🔄", label: "تسجيل مرتجع مبيعات", tab: "sales_returns", bg: "rgba(245,158,11,0.15)" },
                            { icon: "🔒", label: "تقفيل الشفت", tab: "shift", bg: "rgba(239,68,68,0.15)" },
                        ].map((btn) => (
                            <button
                                key={btn.tab}
                                onClick={() => setTab(btn.tab)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "8px 12px", borderRadius: 8,
                                    background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`,
                                    cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                                    color: VAR.text, fontWeight: 600, transition: "border-color 0.15s",
                                    textAlign: "right",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = VAR.accent}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = VAR.border}
                            >
                                <div style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: btn.bg }}>
                                    {btn.icon}
                                </div>
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </CollapsibleCard>
            </div>

            {/* ── تايم لاين حركة اليوم — أسفل الداشبورد بعرض كامل ── */}
            <div style={{
                ...card,
                padding: "16px 18px 14px",
                marginTop: 8,
                background: `linear-gradient(135deg, ${VAR.surface}, ${tint(VAR.accent, 0.05)})`,
                border: `1px solid ${tint(VAR.accent, 0.25)}`,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 16 }}>🕐</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>حركة اليوم بالساعة</span>
                </div>
                {todaySalesForTimeline.length === 0 ? (
                    <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
                        لا توجد مبيعات مسجّلة اليوم بعد
                    </div>
                ) : (
                    <>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
                            {activeHours.map((b) => {
                                const intensity = b.count / maxHourCount; // 0..1
                                const h = `${Math.max(intensity * 56, b.count > 0 ? 6 : 2)}px`;
                                // ألوان متدرجة زي خرائط جوجل: فاتح = هادئ، غامق/أخضر مشبع = ذروة
                                const bg = b.count === 0
                                    ? VAR.surface2
                                    : intensity > 0.66 ? VAR.accent
                                        : intensity > 0.33 ? VAR.accent2
                                            : COLORS.teal;
                                return (
                                    <div key={b.hour} title={`${b.hour}:00 — ${b.count} فاتورة، ${b.rev.toFixed(0)} ر.س`}
                                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                                        <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: bg, transition: "height 0.3s" }} />
                                        <div style={{ fontSize: 8, color: VAR.muted, fontFamily: "monospace" }}>{b.hour}</div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: 10, color: VAR.muted, marginTop: 10 }}>
                            مبني على بيانات اليوم الحالي فقط — مع تراكم أكثر من بضعة أسابيع هيتحول لمتوسط "أكثر أوقات الازدحام" زي خرائط جوجل
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
