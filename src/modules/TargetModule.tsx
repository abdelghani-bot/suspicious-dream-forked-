import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { MAIN_CATEGORIES } from "../lib/productConstants";
import { Btn, Input, Modal } from "../ui/primitives";

// ==================== TARGET MODULE ====================
export function TargetModule({ users, sales, customers, products, currentUser, pharmacyId, showToast, returns = [], canAdd = true, canEdit = true, canDelete = true }) {
  const [subTab, setSubTab] = useState("target"); // target | incentive
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [targets, setTargets] = useState([]); // كل التارجتات لكل الشهور
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [expandedTarget, setExpandedTarget] = useState(null);
  const [compareWith, setCompareWith] = useState({}); // { [pharmacistName]: otherName }

  // 🆕 خريطة مشتركة: الكمية المرتجعة فعليًا لكل صنف داخل كل فاتورة مبيعات (كلي أو جزئي)
  // بتُستخدم في حساب "الأداء/التارجت" وفي حساب "العمولة" مع بعض عشان محدش يفوتها.
  // معمولة useMemo عشان متتحسبش تاني إلا لو "returns" اتغيّرت فعليًا (مش كل render).
  const { returnedQtyByInvoiceItem, returnedAmountByInvoice } = useMemo(() => {
    const qtyMap = {};
    const amtMap = {};
    (returns || [])
      .filter((r) => r.type === "sales" && r.invoice_id)
      .forEach((r) => {
        const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
        items.forEach((ri) => {
          const key = `${r.invoice_id}__${ri.id}`;
          qtyMap[key] = (qtyMap[key] || 0) + (ri.returnQty || 0);
        });
        amtMap[r.invoice_id] = (amtMap[r.invoice_id] || 0) + (r.total || 0);
      });
    return { returnedQtyByInvoiceItem: qtyMap, returnedAmountByInvoice: amtMap };
  }, [returns]);
  const getReturnedQty = (saleId, itemId) => returnedQtyByInvoiceItem[`${saleId}__${itemId}`] || 0;
  // صافي قيمة الفاتورة بعد خصم أي مرتجع جزئي عليها (الفواتير المرتجعة بالكامل أصلاً مستبعدة بـ !s.returned)
  const netSaleTotal = (s) => Math.max(0, (s.total || 0) - (returnedAmountByInvoice[s.id] || 0));

  // ── التحفيز — الأصناف المحفزة ──
  const [incentiveList, setIncentiveList] = useState([]);
  const [incentiveConfig, setIncentiveConfig] = useState({
    month: new Date().toISOString().slice(0, 7),
    allowedCategories: [] as string[], // فارغة = كل الفئات مسموحة
  });
  // ── نظام الـ Tiers — نسب عمولة متعددة حسب هامش الربح ──
  const [tiers, setTiers] = useState<{ id: string; threshold: number; rate: number }[]>([]);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState({ threshold: "", rate: "" });
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  // ── تاريخ تغييرات حد الهامش لكل Tier (لمنع الأثر الرجعي) ──
  const [tierThresholdHistory, setTierThresholdHistory] = useState<{ tier_id: string; threshold: number; effective_from: string }[]>([]);
  // ── استثناءات القائمة التلقائية (استثناء صنف مستوفي، أو إضافة صنف يدوياً لـ Tier معين) ──
  const [incentiveOverrides, setIncentiveOverrides] = useState<{ id: string; product_id: string; type: "include" | "exclude"; tier_id?: string }[]>([]);
  const [autoListExpanded, setAutoListExpanded] = useState(false);
  const [autoListSearch, setAutoListSearch] = useState("");
  const [configExpanded, setConfigExpanded] = useState(false);
  const [commissionExpanded, setCommissionExpanded] = useState(true);
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const [tierAddSearch, setTierAddSearch] = useState<{ [tierId: string]: string }>({});
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);
  const [manufacturers, setManufacturers] = useState([]);
  const [incentiveMonthsBack, setIncentiveMonthsBack] = useState(6); // لمقارنة العمولة عبر الشهور
  const incMonthKey = incentiveConfig.month;

  const isAdmin = currentUser?.role === "admin";
  const pharmacists = users.filter((u) => u.role === "pharmacist");
  // 🆕 نفس مصدر الأسماء المستخدم في تاب "التارجت" — بنستخدمه في تاب "العمولة" كمان
  // عشان لو ظهر اسم كاشير مش صيدلاني (أو فاتورة من غير cashier_name) نوضحه بدل ما يتلخبط مع الصيادلة.
  const pharmacistNames = new Set(pharmacists.map((u) => u.name));

  // تحميل كل التارجتات (كل الشهور) مرة واحدة — يسمح بالمقارنة عبر الشهور من غير إعادة تحميل
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("monthly_targets")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .then(({ data }) => setTargets(data || []));
  }, [pharmacyId]);

  // ── تحميل بيانات التحفيز ──
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("incentive_products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_config").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
      supabase.from("manufacturers").select("id, name").eq("pharmacy_id", pharmacyId).order("name"),
      supabase.from("incentive_tiers").select("*").eq("pharmacy_id", pharmacyId).order("margin_threshold", { ascending: true }),
      supabase.from("incentive_tier_threshold_history")
        .select("tier_id, threshold, effective_from")
        .eq("pharmacy_id", pharmacyId)
        .order("effective_from", { ascending: true }),
      supabase.from("incentive_overrides").select("*").eq("pharmacy_id", pharmacyId),
    ]).then(([i, c, m, t, th, ov]) => {
      if (i.data) setIncentiveList(i.data);
      if (c.data) setIncentiveConfig((prev) => ({ ...prev, allowedCategories: c.data.allowed_categories || [] }));
      if (m.data) setManufacturers(m.data);
      if (t.data) setTiers(t.data.map((r) => ({ id: r.id, threshold: r.margin_threshold, rate: r.rate })));
      if (th.data) setTierThresholdHistory(th.data);
      if (ov.data) setIncentiveOverrides(ov.data);
    });
  }, [pharmacyId]);

  // ── حفظ الفئات المسموحة (إعداد عام واحد يطبق على كل الـ Tiers) ──
  const saveAllowedCategories = async (cats: string[]) => {
    const { error } = await supabase.from("incentive_config").upsert({
      pharmacy_id: pharmacyId,
      allowed_categories: cats,
    }, { onConflict: "pharmacy_id" });
    if (error) { showToast("خطأ في حفظ الفئات: " + error.message, "error"); return; }
    setIncentiveConfig((p) => ({ ...p, allowedCategories: cats }));
    showToast("تم حفظ الفئات المسموحة ✓");
  };

  // ── إضافة / تعديل Tier ──
  const saveTier = async () => {
    const threshold = +tierForm.threshold, rate = +tierForm.rate;
    if (!threshold || !rate) { showToast("أدخل الهامش والنسبة", "error"); return; }
    if (editingTierId) {
      const { error } = await supabase.from("incentive_tiers")
        .update({ rate }).eq("id", editingTierId).eq("pharmacy_id", pharmacyId);
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      const current = tiers.find((t) => t.id === editingTierId);
      setTiers((p) => p.map((t) => (t.id === editingTierId ? { ...t, rate } : t)));
      if (current && current.threshold !== threshold) await updateTierThreshold(editingTierId, threshold);
    } else {
      const { data, error } = await supabase.from("incentive_tiers")
        .insert({ pharmacy_id: pharmacyId, margin_threshold: threshold, rate }).select().single();
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setTiers((p) => [...p, { id: data.id, threshold, rate }]);
      const now = new Date().toISOString();
      await supabase.from("incentive_tier_threshold_history").insert({
        pharmacy_id: pharmacyId, tier_id: data.id, threshold, effective_from: now,
        created_by: currentUser?.name || currentUser?.email || "",
      });
      setTierThresholdHistory((p) => [...p, { tier_id: data.id, threshold, effective_from: now }]);
    }
    setTierForm({ threshold: "", rate: "" });
    setEditingTierId(null);
    setShowTierForm(false);
    showToast("تم حفظ الـ Tier ✓");
  };

  // ── تغيير حد هامش Tier مع حفظ التاريخ (لمنع الأثر الرجعي على المبيعات القديمة) ──
  const updateTierThreshold = async (tierId: string, newThreshold: number) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("incentive_tier_threshold_history").insert({
      pharmacy_id: pharmacyId, tier_id: tierId, threshold: newThreshold, effective_from: now,
      created_by: currentUser?.name || currentUser?.email || "",
    });
    if (error) { showToast("خطأ في حفظ الهامش: " + error.message, "error"); return; }
    setTierThresholdHistory((prev) => [...prev, { tier_id: tierId, threshold: newThreshold, effective_from: now }]);
    setTiers((p) => p.map((t) => (t.id === tierId ? { ...t, threshold: newThreshold } : t)));
  };

  const deleteTier = async (tierId: string) => {
    const { error } = await supabase.from("incentive_tiers").delete().eq("id", tierId).eq("pharmacy_id", pharmacyId);
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setTiers((p) => p.filter((t) => t.id !== tierId));
    showToast("تم حذف الـ Tier ✓");
  };

  // ── استثناء صنف مستوفي تلقائياً، أو إضافة صنف استثنائياً لـ Tier معين ──
  const addIncentiveOverride = async (productId: string, type: "include" | "exclude", tierId?: string) => {
    const { data, error } = await supabase.from("incentive_overrides")
      .upsert({ pharmacy_id: pharmacyId, product_id: productId, type, tier_id: tierId || null }, { onConflict: "pharmacy_id,product_id" })
      .select().single();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setIncentiveOverrides((p) => [...p.filter((o) => o.product_id !== productId), data]);
    showToast(type === "exclude" ? "تم حذف الصنف من القائمة ✓" : "تم نقل الصنف ✓");
  };

  const removeIncentiveOverride = async (id: string) => {
    const { error } = await supabase.from("incentive_overrides").delete().eq("id", id).eq("pharmacy_id", pharmacyId);
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setIncentiveOverrides((p) => p.filter((o) => o.id !== id));
  };

  // ── حساب هامش الربح لصنف ──
  const getProductMargin = (p) => {
    const cost = p.cost || 0, price = p.price || 0;
    if (!cost || !price) return null;
    return ((price - cost) / price) * 100;
  };

  // ── إيجاد الـ Tier المطابق لهامش/فئة معينة في لحظة زمنية — لو استوفى أكتر من Tier ياخد الأعلى ──
  const matchTierForMargin = (margin: number | null, category: string, atTime: string) => {
    if (margin === null) return null;
    if (incentiveConfig.allowedCategories && incentiveConfig.allowedCategories.length > 0
        && !incentiveConfig.allowedCategories.includes(category)) return null;
    let best: { id: string; threshold: number; rate: number } | null = null;
    for (const t of tiers) {
      const effectiveThreshold = tierThresholdHistory.length > 0
        ? (tierThresholdHistory.filter((h) => h.tier_id === t.id && h.effective_from <= atTime).at(-1)?.threshold ?? t.threshold)
        : t.threshold;
      if (margin >= effectiveThreshold && (!best || effectiveThreshold > best.threshold)) {
        best = { ...t, threshold: effectiveThreshold };
      }
    }
    return best;
  };

  // ── مطابقة صنف حي (شاشة الإعدادات) — بيستخدم سعر/تكلفة الصنف الحاليين ──
  const matchTierAt = (p, atTime: string) => matchTierForMargin(getProductMargin(p), p.main_category || p.mainCategory || p.category || "", atTime);

  // ── مطابقة عنصر فاتورة قديمة — لازم يستخدم السعر/التكلفة/الفئة "زي ما كانوا وقت البيع" ──
  // (كل عنصر فاتورة بيحفظ price/cost/category الخاصة بيه وقت البيع — راجع completeSale)
  // ده اللي بيضمن إن تغيّر سعر/تكلفة الصنف بعد كده (زيادة أو نقصان) ميأثرش على عمولة شهور فاتت.
  const matchTierForSaleItem = (item, atTime: string) => {
    const price = item.price || 0, cost = item.cost || 0;
    if (!cost || !price) return null;
    const margin = ((price - cost) / price) * 100;
    const category = item.category || products.find((p) => p.id === item.id)?.main_category || products.find((p) => p.id === item.id)?.category || "";
    return matchTierForMargin(margin, category, atTime);
  };

  const excludedIds = new Set(incentiveOverrides.filter((o) => o.type === "exclude").map((o) => o.product_id));
  const includedOverrides = incentiveOverrides.filter((o) => o.type === "include");

  // ── القائمة التلقائية الحالية (لحظة العرض) — override (نقل/حذف يدوي) له الأولوية دايماً على الحساب الطبيعي ──
  const nowIso = new Date().toISOString();
  const autoIncentiveProducts = products
    .map((p) => {
      const inc = includedOverrides.find((o) => o.product_id === p.id);
      if (inc) {
        const tier2 = tiers.find((t) => t.id === inc.tier_id);
        return tier2 ? { product: p, tier: tier2, manual: true } : null;
      }
      if (excludedIds.has(p.id)) return null;
      const tier = matchTierAt(p, nowIso);
      return tier ? { product: p, tier, manual: false } : null;
    })
    .filter(Boolean) as { product: any; tier: { id: string; threshold: number; rate: number }; manual: boolean }[];

  const incentiveCardStyle = (border = COLORS.border) => ({
    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });

  const getTarget = (name, mKey) =>
    targets.find((t) => t.pharmacist_name === name && t.month === mKey)?.target_amount || 0;

  const saveTarget = async (name) => {
    if (!editValue || +editValue <= 0) {
      showToast("ادخل قيمة تارجت صحيحة", "error");
      return;
    }
    const row = {
      pharmacy_id: pharmacyId,
      pharmacist_name: name,
      month: monthKey,
      target_amount: +editValue,
    };
    const { data, error } = await supabase
      .from("monthly_targets")
      .upsert([row], { onConflict: "pharmacy_id,pharmacist_name,month" })
      .select();
    if (error) {
      showToast("خطأ: " + error.message, "error");
      return;
    }
    setTargets((prev) => {
      const others = prev.filter((t) => !(t.pharmacist_name === name && t.month === monthKey));
      return [...others, data[0]];
    });
    setEditing(null);
    setEditValue("");
    showToast("تم حفظ التارجت ✓");
  };

  const now = new Date();

  // 🆕 فهرسة المبيعات حسب الكاشير مرة واحدة بس (بتتغيّر لما sales تتغيّر فعليًا)،
  // بدل ما نفلتر كل الفواتير (كل الصيادلة) من الأول في كل استدعاء لـ calcForMonth.
  const salesByCashier = useMemo(() => {
    const map: Record<string, any[]> = {};
    sales.forEach((s) => {
      if (s.returned) return;
      const name = s.cashier_name || "غير محدد";
      if (!map[name]) map[name] = [];
      map[name].push(s);
    });
    return map;
  }, [sales]);

  // 🆕 كاش لمبيعات صيدلي معين في شهر معين — بيتقرا كتير (كارت + تفاصيل + مقارنة + رسم بياني)
  // فبنحسبه مرة واحدة بس لكل (صيدلي × شهر) مهما اتكرر الاستدعاء في نفس الـ render.
  const cashierMonthSalesCache = useMemo(() => new Map<string, any[]>(), [sales]);
  const getCashierMonthSales = (name: string, mKey: string) => {
    const key = `${name}|${mKey}`;
    if (cashierMonthSalesCache.has(key)) return cashierMonthSalesCache.get(key)!;
    const result = (salesByCashier[name] || []).filter((s) => (s.created_at || s.date || "").startsWith(mKey));
    cashierMonthSalesCache.set(key, result);
    return result;
  };

  // 🆕 كاش نتيجة calcForMonth نفسها (كل الإحصائيات المجمّعة) — بيتصفّر لو sales/returns/targets/customers اتغيّروا فعليًا
  const calcCache = useMemo(() => new Map<string, any>(), [sales, returns, targets, customers]);

  // ===== حساب أداء صيدلي في أي شهر (نعيد استخدامها للشهر الحالي وللمقارنات) =====
  const calcForMonth = (name, mKey) => {
    const cacheKey = `${name}|${mKey}`;
    if (calcCache.has(cacheKey)) return calcCache.get(cacheKey);

    const [yy, mm] = mKey.split("-").map(Number);
    const daysInM = new Date(yy, mm, 0).getDate();
    const isCurrent = mKey === now.toISOString().slice(0, 7);
    const daysP = isCurrent ? now.getDate() : daysInM;

    const mySales = getCashierMonthSales(name, mKey);
    const achieved = mySales.reduce((a, s) => a + netSaleTotal(s), 0);
    // 🆕 قيمة المرتجعات الجزئية اللي أثّرت على الرقم ده — لعرضها كتنبيه بصري في الكارت
    const returnsImpact = mySales.reduce((a, s) => a + (returnedAmountByInvoice[s.id] || 0), 0);
    const target = getTarget(name, mKey);

    const simplePct = target > 0 ? (achieved / target) * 100 : 0;
    const dailyAvg = daysP > 0 ? achieved / daysP : 0;
    const projected = dailyAvg * daysInM;
    const paceRequired = target > 0 ? target / daysInM : 0;
    const paceStatus =
      target === 0
        ? "—"
        : dailyAvg >= paceRequired
        ? "على المسار ✅"
        : dailyAvg >= paceRequired * 0.85
        ? "متأخر بسيط ⚠️"
        : "متأخر عن المسار 🔴";

    const invoiceCount = mySales.length;
    let itemsSold = 0;
    mySales.forEach((s) => {
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      itemsSold += items.reduce((a, it) => a + Math.max(0, (it.qty || 1) - getReturnedQty(s.id, it.id)), 0);
    });
    const avgItemsPerInvoice = invoiceCount > 0 ? itemsSold / invoiceCount : 0;
    const avgInvoiceValue = invoiceCount > 0 ? achieved / invoiceCount : 0;

    const linkedToCustomer = mySales.filter((s) => s.customer).length;
    const customerRegRate = invoiceCount > 0 ? (linkedToCustomer / invoiceCount) * 100 : 0;

    const newCustomers = customers.filter(
      (c) => (c.created_at || "").startsWith(mKey) && c.created_by === name
    ).length;

    const myCustomers = customers.filter((c) => c.created_by === name);
    const inactiveCustomers = myCustomers.filter((c) => {
      const cSales = sales.filter((s) => s.customer === c.id);
      if (cSales.length === 0) return false;
      const last = cSales.reduce((a, s) => {
        const d = new Date(s.created_at || s.date);
        return d > a ? d : a;
      }, new Date(0));
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    }).length;

    const result = {
      achieved, target, simplePct, projected, paceStatus, daysP, daysInM, mKey,
      invoiceCount, itemsSold, avgItemsPerInvoice, avgInvoiceValue,
      customerRegRate, newCustomers, inactiveCustomers, returnsImpact,
    };
    calcCache.set(cacheKey, result);
    return result;
  };

  const calcForPharmacist = (name) => calcForMonth(name, monthKey);

  // ===== أداء يومي خلال الشهر الحالي =====
  const getDailyPerformance = (name, c) => {
    // 🆕 بنفلتر يوم-بيوم على مبيعات "الصيدلي ده في الشهر ده" بس (مُجهّزة مسبقًا)،
    // مش على كل فواتير الصيدلية من الأول لكل يوم.
    const mySales = getCashierMonthSales(name, monthKey);
    const days = [];
    for (let d = 1; d <= c.daysP; d++) {
      const dayStr = `${monthKey}-${String(d).padStart(2, "0")}`;
      const amt = mySales
        .filter((s) => (s.created_at || s.date || "").startsWith(dayStr))
        .reduce((a, s) => a + netSaleTotal(s), 0);
      days.push({ day: d, amount: amt });
    }
    return days;
  };

  // ===== مقارنة آخر 6 شهور =====
  const getYearTrend = (name) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey2 = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("ar", { month: "short" });
      const c2 = calcForMonth(name, mKey2);
      months.push({ label, mKey: mKey2, achieved: c2.achieved, target: c2.target });
    }
    return months;
  };

  const pctColor = (p) => (p >= 100 ? COLORS.green : p >= 75 ? COLORS.blue : p >= 50 ? COLORS.gold : COLORS.red);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🎯 تارجت المبيعات والتحفيز</h2>
          <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>
            تارجت شهري لكل صيدلي + تحليل فني لحظي + مقارنات + أصناف محفزة وعمولات
          </div>
        </div>
        {subTab === "target" && (
          <Input type="month" value={monthKey} onChange={setMonthKey} style={{ width: 160 }} />
        )}
      </div>

      {/* Sub Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 4 }}>
        {[
          { k: "target", l: "🎯 التارجت" },
          { k: "incentive", l: "⭐ التحفيز" },
        ].map((t) => (
          <button key={t.k} onClick={() => setSubTab(t.k)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 8, border: "none",
            background: subTab === t.k ? COLORS.surface : "transparent",
            color: subTab === t.k ? COLORS.blue : COLORS.textDim,
            fontSize: 12, fontWeight: subTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {subTab === "target" && (
      <>
      {pharmacists.length === 0 && (
        <div style={{ color: COLORS.textDim, padding: 20 }}>لا يوجد صيادلة مسجلين بدور "pharmacist".</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
        {pharmacists.map((u) => {
          const c = calcForPharmacist(u.name);
          const cardColor = pctColor(c.simplePct);
          const isOpen = expandedTarget === u.name;

          return (
            <div key={u.id} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${cardColor}44`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: cardColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    🎯
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textPrimary }}>{u.name}</div>
                    <div style={{ color: COLORS.textDim, fontSize: 10 }}>صيدلاني</div>
                  </div>
                </div>
                <div style={{ background: cardColor + "22", color: cardColor, fontWeight: 900, fontSize: 13, padding: "3px 10px", borderRadius: 20 }}>
                  {c.target ? c.simplePct.toFixed(0) + "%" : "—"}
                </div>
              </div>

              <div style={{ background: COLORS.surfaceAlt, borderRadius: 8, height: 7, overflow: "hidden" }}>
                <div style={{ width: Math.min(c.simplePct, 100) + "%", height: "100%", background: cardColor, transition: "width .3s" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <div>
                  <div style={{ color: COLORS.textDim, fontSize: 10 }}>التارجت</div>
                  <div style={{ color: "#8ab0ff", fontWeight: 800 }}>{c.target ? c.target.toFixed(0) + " ر.س" : "—"}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: COLORS.textDim, fontSize: 10 }}>المحقق</div>
                  <div style={{ color: COLORS.textPrimary, fontWeight: 800 }}>
                    {c.achieved.toFixed(0)} ر.س
                    {c.returnsImpact > 0 && (
                      <span title={`الرقم ده بعد خصم مرتجعات بقيمة ${c.returnsImpact.toFixed(0)} ر.س`} style={{ marginRight: 5, fontSize: 11, color: COLORS.coral }}>
                        🔄
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* تعديل التارجت — ظاهر دايماً */}
              {editing === u.name ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Input value={editValue} onChange={setEditValue} type="number" placeholder="قيمة التارجت" style={{ flex: 1 }} />
                  <Btn size="sm" variant="success" onClick={() => saveTarget(u.name)}>حفظ</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>✕</Btn>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  {isAdmin && (
                    <button
                      onClick={() => { setEditing(u.name); setEditValue(c.target || ""); }}
                      style={{ flex: 1, background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", color: COLORS.blue, fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                    >
                      ✏️ تعديل التارجت
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTarget(isOpen ? null : u.name)}
                    style={{ flex: 1, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}
                  >
                    {isOpen ? "▲ إخفاء التفاصيل" : "▼ عرض التفاصيل"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== التفاصيل الموسعة — تظهر تحت الكروت لصيدلي واحد بس ===== */}
      {pharmacists.filter((u) => expandedTarget === u.name).map((u) => {
        const c = calcForPharmacist(u.name);
        const dailyPerf = getDailyPerformance(u.name, c);
        const yearTrend = getYearTrend(u.name);
        const maxDaily = Math.max(...dailyPerf.map((d) => d.amount), 1);
        const maxYearly = Math.max(...yearTrend.map((m) => Math.max(m.achieved, m.target)), 1);
        const otherPharmacists = pharmacists.filter((p) => p.name !== u.name);
        const compareName = compareWith[u.name] || (otherPharmacists[0]?.name ?? "");
        const cOther = compareName ? calcForPharmacist(compareName) : null;

        return (
          <div key={u.id} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.textPrimary }}>📋 تفاصيل {u.name}</div>
                <button onClick={() => setExpandedTarget(null)} style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 13 }}>✕ إغلاق</button>
              </div>

              {c.target > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 12 }}>
                  <span style={{ color: COLORS.textDim }}>
                    المتوقع نهاية الشهر (Run Rate): <b style={{ color: COLORS.purple }}>{c.projected.toFixed(0)} ر.س</b>
                  </span>
                  <span style={{ fontWeight: 700 }}>{c.paceStatus}</span>
                </div>
              )}

              {/* 🆕 تنبيه واضح لو المحقق اتأثر بمرتجعات جزئية/كلية الشهر ده */}
              {c.returnsImpact > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 12, background: tint(COLORS.coral, 0.9), border: `1px solid ${tint(COLORS.coral, 0.4)}`, borderRadius: 8, padding: "8px 12px" }}>
                  <span>🔄</span>
                  <span style={{ color: COLORS.textDim }}>
                    الرقم المحقق أعلاه بعد خصم مرتجعات بقيمة <b style={{ color: COLORS.coral }}>{c.returnsImpact.toFixed(0)} ر.س</b> هذا الشهر
                  </span>
                </div>
              )}

              {/* ===== التحليل الفني ===== */}
              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                <div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📊 التحليل الفني</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                  {[
                    { l: "عدد الفواتير", v: c.invoiceCount },
                    { l: "عدد الأصناف المباعة", v: c.itemsSold },
                    { l: "متوسط الأصناف/فاتورة", v: c.avgItemsPerInvoice.toFixed(1) },
                    { l: "متوسط قيمة الفاتورة", v: c.avgInvoiceValue.toFixed(0) + " ر.س" },
                    { l: "نسبة التسجيل على عملاء", v: c.customerRegRate.toFixed(0) + "%" },
                    { l: "عملاء جدد هذا الشهر", v: c.newCustomers },
                    { l: "عملاء سجّلهم وأصبحوا خاملين", v: c.inactiveCustomers },
                  ].map((x, i) => (
                    <div key={i} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                      <div style={{ color: COLORS.textDim, fontSize: 11 }}>{x.l}</div>
                      <div style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: 800, marginTop: 4 }}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== الأداء خلال الشهر ===== */}
              <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                <div style={{ color: COLORS.green, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                  📅 الأداء خلال الشهر (مبيعات يومية)
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70, overflowX: "auto", paddingBottom: 4 }}>
                  {dailyPerf.map((d) => (
                    <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 14 }}>
                      <div
                        title={`يوم ${d.day}: ${d.amount.toFixed(0)} ر.س`}
                        style={{
                          width: 8,
                          height: Math.max((d.amount / maxDaily) * 55, 2),
                          background: d.amount > 0 ? COLORS.green : COLORS.border,
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                      <span style={{ fontSize: 8, color: COLORS.border, marginTop: 3 }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== مقارنة عبر آخر 6 شهور ===== */}
              <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                <div style={{ color: COLORS.purple, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                  📈 مقارنة الأداء عبر آخر 6 شهور
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
                  {yearTrend.map((m) => (
                    <div key={m.mKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 65 }}>
                        <div
                          title={`المحقق: ${m.achieved.toFixed(0)} ر.س`}
                          style={{ flex: 1, background: COLORS.blue, height: `${(m.achieved / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }}
                        />
                        {m.target > 0 && (
                          <div
                            title={`التارجت: ${m.target.toFixed(0)} ر.س`}
                            style={{ flex: 1, background: "#4a3a00", height: `${(m.target / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2, border: `1px dashed ${tint(COLORS.coral,0.35)}` }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: 9, color: COLORS.textDim }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: COLORS.blue }}>■ المحقق</span>
                  <span style={{ fontSize: 11, color: COLORS.gold }}>▢ التارجت</span>
                </div>
              </div>

              {/* ===== مقارنة مع صيدلي آخر ===== */}
              {otherPharmacists.length > 0 && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700 }}>⚖️ مقارنة مع صيدلي آخر</div>
                    <select
                      value={compareName}
                      onChange={(e) => setCompareWith((p) => ({ ...p, [u.name]: e.target.value }))}
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }}
                    >
                      {otherPharmacists.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {cOther && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                        <div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{u.name}</div>
                        {[
                          ["المحقق", c.achieved.toFixed(0) + " ر.س"],
                          ["نسبة التارجت", c.target ? c.simplePct.toFixed(1) + "%" : "—"],
                          ["عدد الفواتير", c.invoiceCount],
                          ["متوسط الفاتورة", c.avgInvoiceValue.toFixed(0) + " ر.س"],
                          ["نسبة التسجيل على عملاء", c.customerRegRate.toFixed(0) + "%"],
                        ].map(([l, v], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: COLORS.textDim }}>{l}</span>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ color: COLORS.border, fontSize: 18, fontWeight: 900 }}>VS</div>

                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                        <div style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{compareName}</div>
                        {[
                          ["المحقق", cOther.achieved.toFixed(0) + " ر.س"],
                          ["نسبة التارجت", cOther.target ? cOther.simplePct.toFixed(1) + "%" : "—"],
                          ["عدد الفواتير", cOther.invoiceCount],
                          ["متوسط الفاتورة", cOther.avgInvoiceValue.toFixed(0) + " ر.س"],
                          ["نسبة التسجيل على عملاء", cOther.customerRegRate.toFixed(0) + "%"],
                        ].map(([l, v], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: COLORS.textDim }}>{l}</span>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </>
      )}

      {/* ── الأصناف المحفزة ── */}
      {subTab === "incentive" && (
        <div>
          {/* إعداد الشهر + الفئات المسموحة (إعداد عام يطبق على كل الـ Tiers) */}
          <div style={incentiveCardStyle(COLORS.surfaceAlt)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div onClick={() => setConfigExpanded((v) => !v)} style={{ cursor: "pointer", flex: 1, minWidth: 200 }}>
                <div style={{ color: COLORS.blue, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚙️ إعدادات العمولة <span style={{ color: COLORS.textDim, fontSize: 12 }}>{configExpanded ? "▲" : "▼"}</span>
                </div>
                <div style={{ color: COLORS.textDim, fontSize: 12 }}>نسبة واحدة موحدة لكل الصيادلة — بتختلف حسب مستوى (Tier) الصنف مش حسب مين باعه</div>
              </div>
              <div>
                <label style={{ color: COLORS.border, fontSize: 11, display: "block", marginBottom: 2 }}>الشهر</label>
                <input type="month" value={incentiveConfig.month}
                  onChange={(e) => setIncentiveConfig((p) => ({ ...p, month: e.target.value }))}
                  style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              </div>
            </div>
            {configExpanded && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>الفئات المشمولة بالتحفيز التلقائي (فاضية = كل الفئات)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(MAIN_CATEGORIES).map((cat) => {
                  const active = incentiveConfig.allowedCategories.includes(cat);
                  return (
                    <button key={cat}
                      onClick={() => {
                        if (!canEdit) { showToast("❌ لا تملك صلاحية تعديل إعدادات التحفيز", "error"); return; }
                        const next = active
                          ? incentiveConfig.allowedCategories.filter((c) => c !== cat)
                          : [...incentiveConfig.allowedCategories, cat];
                        saveAllowedCategories(next);
                      }}
                      style={{
                        background: active ? COLORS.blue : COLORS.surfaceAlt, color: active ? "#fff" : COLORS.textDim,
                        border: `1px solid ${active ? COLORS.blue : COLORS.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: canEdit ? "pointer" : "default",
                      }}>{cat}</button>
                  );
                })}
              </div>
            </div>
            )}
          </div>

          {/* Tiers — مستويات عمولة متعددة حسب هامش الربح */}
          <div style={incentiveCardStyle(COLORS.surfaceAlt)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: COLORS.purple, fontWeight: 700 }}>📶 مستويات العمولة (Tiers)</div>
              {canAdd && <Btn icon="plus" size="sm" onClick={() => { setTierForm({ threshold: "", rate: "" }); setEditingTierId(null); setShowTierForm(true); }}>Tier جديد</Btn>}
            </div>
            {tiers.length === 0
              ? <div style={{ color: COLORS.textDim, fontSize: 12 }}>لا توجد مستويات مضافة — أضف Tier عشان يبدأ التحفيز التلقائي يشتغل</div>
              : [...tiers].sort((a, b) => b.threshold - a.threshold).map((t) => {
                  const tierProducts = autoIncentiveProducts.filter((x) => x.tier.id === t.id);
                  const isOpen = expandedTierId === t.id;
                  return (
                    <div key={t.id} style={{ marginBottom: 6 }}>
                      <div onClick={() => setExpandedTierId(isOpen ? null : t.id)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.surfaceAlt, border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: isOpen ? "8px 8px 0 0" : 8, padding: "8px 12px", cursor: "pointer" }}>
                        <div style={{ color: COLORS.textPrimary, fontSize: 13 }}>
                          هامش ≥ <b style={{ color: COLORS.purple }}>{t.threshold}%</b>
                          <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 8 }}>({tierProducts.length} صنف)</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ color: COLORS.green, fontWeight: 700, fontSize: 13 }}>{t.rate}% عمولة</span>
                          {canEdit && (
                            <button onClick={(e) => { e.stopPropagation(); setTierForm({ threshold: String(t.threshold), rate: String(t.rate) }); setEditingTierId(t.id); setShowTierForm(true); }}
                              style={{ background: "none", border: "none", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>✏️</button>
                          )}
                          {canDelete && (
                            <button onClick={(e) => { e.stopPropagation(); deleteTier(t.id); }} style={{ background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer" }}>🗑️</button>
                          )}
                          <span style={{ color: COLORS.textDim, fontSize: 11 }}>{isOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "8px 12px" }}>
                          {canAdd && (
                            <div style={{ marginBottom: 10 }}>
                              <input
                                value={tierAddSearch[t.id] || ""}
                                onChange={(e) => setTierAddSearch((p) => ({ ...p, [t.id]: e.target.value }))}
                                placeholder="🔍 بحث لإضافة صنف مباشرة لهذا الـ Tier..."
                                style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              />
                              {(tierAddSearch[t.id] || "").length > 0 && (
                                <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6 }}>
                                  {products
                                    .filter((p) => (p.name_ar || p.name || p.nameAr || "").includes(tierAddSearch[t.id]) && !tierProducts.some((x) => x.product.id === p.id))
                                    .slice(0, 20)
                                    .map((p) => (
                                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", borderBottom: `1px solid ${COLORS.border}` }}>
                                        <span style={{ color: COLORS.textPrimary, fontSize: 12 }}>{p.name_ar || p.name || p.nameAr}</span>
                                        <button onClick={() => { addIncentiveOverride(p.id, "include", t.id); setTierAddSearch((prev) => ({ ...prev, [t.id]: "" })); }}
                                          style={{ background: "none", border: "none", color: COLORS.green, fontSize: 12, cursor: "pointer" }}>➕ إضافة</button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                          {tierProducts.length === 0
                            ? <div style={{ color: COLORS.textDim, fontSize: 12, padding: "6px 0" }}>لا توجد أصناف في هذا المستوى حالياً</div>
                            : tierProducts.map(({ product: p, manual }) => (
                                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                                  <div>
                                    <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{p.name_ar || p.name || p.nameAr}</span>
                                    {manual && <span style={{ color: COLORS.gold, fontSize: 11, marginRight: 6 }}>⭐ يدوي</span>}
                                  </div>
                                  {(canEdit || canDelete) && (
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      {canEdit && (
                                      <select defaultValue="" onChange={(e) => { if (e.target.value) addIncentiveOverride(p.id, "include", e.target.value); }}
                                        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, fontSize: 11, padding: "3px 6px" }}>
                                        <option value="">↔️ نقل لـ...</option>
                                        {tiers.filter((tt) => tt.id !== t.id).map((tt) => <option key={tt.id} value={tt.id}>{tt.threshold}% → {tt.rate}%</option>)}
                                      </select>
                                      )}
                                      {canDelete && (
                                      <button onClick={() => addIncentiveOverride(p.id, "exclude")}
                                        style={{ background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer" }}>🗑️ حذف</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                          }
                        </div>
                      )}
                    </div>
                  );
                })
            }
            <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 6 }}>لو صنف مستوفي أكتر من Tier في نفس اللحظة، بياخد نسبة الـ Tier الأعلى. دوس على أي Tier عشان تشوف الأصناف اللي فيه.</div>
          </div>

          {/* أصناف بهامش تلقائية — كارت مضغوط قابل للتوسيع */}
          <div style={incentiveCardStyle(COLORS.surfaceAlt)}>
            <div onClick={() => setAutoListExpanded((v) => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div style={{ color: COLORS.purple, fontWeight: 700 }}>
                🎯 أصناف محفزة تلقائياً حسب الـ Tiers ({autoIncentiveProducts.length})
              </div>
              <span style={{ color: COLORS.textDim, fontSize: 14 }}>{autoListExpanded ? "▲" : "▼"}</span>
            </div>

            {autoListExpanded && (
              <div style={{ marginTop: 12 }}>
                <input
                  value={autoListSearch} onChange={(e) => setAutoListSearch(e.target.value)}
                  placeholder="🔍 بحث لإضافة استثناء أو استثناء صنف يدوياً..."
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                />

                {autoListSearch ? (
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {products.filter((p) => (p.name_ar || p.name || p.nameAr || "").includes(autoListSearch)).slice(0, 30).map((p) => {
                      const isExcluded = excludedIds.has(p.id);
                      const isAuto = autoIncentiveProducts.some((x) => x.product.id === p.id);
                      const margin = getProductMargin(p);
                      return (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                          <div>
                            <div style={{ color: COLORS.textPrimary, fontSize: 13 }}>{p.name_ar || p.name || p.nameAr}</div>
                            {margin !== null && <div style={{ color: COLORS.textDim, fontSize: 11 }}>هامش: {margin.toFixed(0)}%</div>}
                          </div>
                          {isExcluded ? (
                            canEdit && (
                            <button onClick={() => {
                              const ov = incentiveOverrides.find((o) => o.product_id === p.id && o.type === "exclude");
                              if (ov) removeIncentiveOverride(ov.id);
                            }} style={{ background: "none", border: "none", color: COLORS.green, fontSize: 12, cursor: "pointer" }}>↩️ إلغاء الاستثناء</button>
                            )
                          ) : isAuto ? (
                            canDelete && (
                            <button onClick={() => addIncentiveOverride(p.id, "exclude")}
                              style={{ background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer" }}>🚫 استثناء</button>
                            )
                          ) : (
                            canAdd && tiers.length > 0 && (
                              <select onChange={(e) => e.target.value && addIncentiveOverride(p.id, "include", e.target.value)}
                                defaultValue=""
                                style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, fontSize: 11, padding: "3px 6px" }}>
                                <option value="">+ إضافة استثنائية لـ Tier...</option>
                                {tiers.map((t) => <option key={t.id} value={t.id}>{t.threshold}% → {t.rate}%</option>)}
                              </select>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  autoIncentiveProducts.length === 0
                    ? <div style={{ color: COLORS.textDim, fontSize: 12 }}>لا توجد أصناف مستوفية حالياً</div>
                    : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {autoIncentiveProducts.map(({ product: p, tier, manual }) => (
                          <div key={p.id} style={{ background: COLORS.surfaceAlt, border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{p.name_ar || p.name || p.nameAr}</span>
                            <span style={{ color: COLORS.purple, marginRight: 8, fontWeight: 700 }}>{tier.rate}%{manual ? " ⭐" : ""}</span>
                            {canDelete && (
                            <button onClick={() => addIncentiveOverride(p.id, "exclude")}
                              style={{ background: "none", border: "none", color: COLORS.red, fontSize: 11, cursor: "pointer", marginRight: 6 }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                )}
              </div>
            )}
          </div>

          {/* ── نسبة كل صيدلي هذا الشهر — حسب الـ Tier الفعلي وقت كل عملية بيع ── */}
          {/* 🆕 المرتجع (كلي أو جزئي) بيتخصم من عمولة "شهر حدوث المرتجع نفسه"، مش شهر البيع الأصلي —
              يعني لو صنف اتباع في يونيو ورجع في يوليو، عمولة يونيو تفضل زي ما هي، وعمولة يوليو
              هي اللي هتتخصم منها قيمة المرتجع. الاستثناء الوحيد: الفاتورة اللي رجعت بالكامل
              (s.returned = true) أصلاً مستبعدة تمامًا من كل الشهور زي ما كان الوضع قبل كده. */}
          {(() => {
            const commissionForItem = (item, saleDateTime, qty) => {
              const amt = (item.price || 0) * qty;
              const manualEntry = incentiveList.find((i) => i.product_id === item.id);
              if (manualEntry) {
                return manualEntry.rate ? amt * manualEntry.rate / 100 : (+manualEntry.fixed_amount || 0) * qty;
              }
              if (excludedIds.has(item.id)) return 0;
              let tier = matchTierForSaleItem(item, saleDateTime);
              if (!tier) {
                const inc = includedOverrides.find((o) => o.product_id === item.id);
                if (inc) tier = tiers.find((t) => t.id === inc.tier_id);
              }
              return tier ? amt * tier.rate / 100 : 0;
            };

            const salesById = {};
            sales.forEach((s) => { salesById[s.id] = s; });

            const staffSales = {};
            const addToStaff = (name, amt, commission, pName) => {
              if (!staffSales[name]) staffSales[name] = { total: 0, commission: 0, items: {}, isPharmacist: pharmacistNames.has(name) };
              staffSales[name].total += amt;
              staffSales[name].commission += commission;
              staffSales[name].items[pName] = (staffSales[name].items[pName] || 0) + amt;
            };

            // 1) العمولة الأساسية: كل مبيعات هذا الشهر بكامل كمياتها (من غير خصم مرتجعات مستقبلية)
            sales
              .filter((s) => s.date?.startsWith(incMonthKey) && !s.returned)
              .forEach((s) => {
                const name = s.cashier_name || "غير محدد";
                const saleDateTime = s.created_at || s.date + "T00:00:00.000Z";
                const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
                items.forEach((item) => {
                  const qty = item.qty || 1;
                  const commission = commissionForItem(item, saleDateTime, qty);
                  if (commission <= 0) return;
                  const prod = products.find((p) => p.id === item.id);
                  const amt = (item.price || 0) * qty;
                  const pName = prod?.name || prod?.nameAr || item.name || item.id;
                  addToStaff(name, amt, commission, pName);
                });
              });

            // 2) خصم أي مرتجع (كلي أو جزئي) حصل فعليًا خلال هذا الشهر — بغض النظر عن شهر البيع الأصلي
            (returns || [])
              .filter((r) => r.type === "sales" && r.date?.startsWith(incMonthKey))
              .forEach((r) => {
                const originalSale = salesById[r.invoice_id];
                // فاتورة رجعت بالكامل أصلاً مستبعدة من كل الشهور (!s.returned فوق) فمفيش عمولة نرجعها هنا
                if (originalSale?.returned) return;
                const name = originalSale?.cashier_name || "غير محدد";
                const saleDateTime = originalSale?.created_at || (originalSale?.date ? originalSale.date + "T00:00:00.000Z" : r.date + "T00:00:00.000Z");
                const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
                items.forEach((ri) => {
                  const qty = ri.returnQty || 0;
                  if (qty <= 0) return;
                  const commission = commissionForItem(ri, saleDateTime, qty);
                  if (commission <= 0) return;
                  const prod = products.find((p) => p.id === ri.id);
                  const amt = (ri.price || 0) * qty;
                  const pName = prod?.name || prod?.nameAr || ri.name || ri.id;
                  addToStaff(name, -amt, -commission, pName);
                });
              });

            const staffList: [string, any][] = Object.entries(staffSales)
              .filter(([, v]: any) => v.total !== 0 || v.commission !== 0)
              .sort((a: any, b: any) => (b[1].isPharmacist ? 1 : 0) - (a[1].isPharmacist ? 1 : 0));
            if (staffList.length === 0) return (
              <div style={{ ...incentiveCardStyle(), marginTop: 16, textAlign: "center" }}>
                <div style={{ color: COLORS.textDim, padding: 20 }}>
                  لا توجد مبيعات من الأصناف المحفزة في {incMonthKey}
                </div>
              </div>
            );

            const totalAllStaff = staffList.reduce((a, [, v]: any) => a + v.total, 0);
            const totalCommission = staffList.reduce((a, [, v]: any) => a + v.commission, 0);

            return (
              <div style={{ ...incentiveCardStyle(COLORS.greenSoft), marginTop: 16 }}>
                <div onClick={() => setCommissionExpanded((v) => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: commissionExpanded ? 14 : 0 }}>
                  <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 14 }}>
                    📊 عمولة الأصناف المحفزة — {incMonthKey}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ color: COLORS.textDim, fontSize: 12 }}>
                      إجمالي المبيعات المحفزة: <span style={{ color: COLORS.green, fontWeight: 700 }}>{totalAllStaff.toFixed(2)} ر.س</span>
                    </div>
                    <span style={{ color: COLORS.textDim, fontSize: 13 }}>{commissionExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {commissionExpanded && (
                <>
                {staffList.map(([name, data]: any) => {
                  const pct = totalAllStaff > 0 ? (data.total / totalAllStaff * 100) : 0;
                  const barPct = Math.max(0, Math.min(100, pct));
                  const isNegative = data.commission < 0;
                  const amountColor = isNegative ? COLORS.red : COLORS.green;
                  return (
                    <div key={name} style={{ padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>
                            👤 {name}
                            {!data.isPharmacist && (
                              <span title="الاسم ده مش موجود في قائمة الصيادلة (تاب التارجت) — تحقق من اسم الكاشير على الفاتورة" style={{ marginRight: 8, fontSize: 10, fontWeight: 700, color: COLORS.gold, background: tint(COLORS.gold, 0.85), border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 6, padding: "2px 6px" }}>
                                ⚠️ مش من قائمة الصيادلة
                              </span>
                            )}
                          </div>
                          <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>
                            {isNegative ? "خصم مرتجعات: " : "مبيعات محفزة: "}
                            <span style={{ color: amountColor }}>{data.total.toFixed(2)} ر.س</span>
                            {!isNegative && <span style={{ marginRight: 10, color: COLORS.textDim }}>({pct.toFixed(1)}% من الإجمالي)</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ color: amountColor, fontWeight: 900, fontSize: 18 }}>{data.commission.toFixed(2)} ر.س</div>
                          <div style={{ color: COLORS.textDim, fontSize: 11 }}>{isNegative ? "خصم مرتجع من العمولة" : "عمولة"}</div>
                        </div>
                      </div>
                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 4, height: 6, marginBottom: 8 }}>
                        <div style={{ background: amountColor, height: "100%", borderRadius: 4, width: `${barPct}%`, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {Object.entries(data.items).map(([pName, amt]) => {
                          const itemNegative = (amt as number) < 0;
                          return (
                            <div key={pName} style={{ background: itemNegative ? tint(COLORS.red, 0.85) : COLORS.greenSoft, border: `1px solid ${tint(itemNegative ? COLORS.red : COLORS.green, 0.35)}`, borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                              <span style={{ color: COLORS.textDim }}>{pName}</span>
                              <span style={{ color: itemNegative ? COLORS.red : COLORS.green, marginRight: 6, fontWeight: 700 }}>{(amt as number).toFixed(0)} ر.س</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "2px solid #1a3a1a" }}>
                  <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>إجمالي العمولات المستحقة</span>
                  <span style={{ color: totalCommission < 0 ? COLORS.red : COLORS.green, fontWeight: 900, fontSize: 18 }}>
                    {totalCommission.toFixed(2)} ر.س
                  </span>
                </div>
                </>
                )}
              </div>
            );
          })()}
          {(() => {
            const now = new Date();
            const months = Array.from({ length: incentiveMonthsBack }, (_, idx) => {
              const d = new Date(now.getFullYear(), now.getMonth() - idx, 1);
              return d.toISOString().slice(0, 7);
            });

            const monthlyTotals = months.map((mKey) => {
              let total = 0;
              sales.filter((s) => s.date?.startsWith(mKey) && !s.returned).forEach((s) => {
                const saleDateTime = s.created_at || s.date + "T00:00:00.000Z";
                const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
                items.forEach((item) => {
                  const amt = (item.price || 0) * (item.qty || 1);
                  const manualEntry = incentiveList.find((i) => i.product_id === item.id);
                  if (manualEntry) {
                    total += manualEntry.rate ? amt * manualEntry.rate / 100 : (+manualEntry.fixed_amount || 0) * (item.qty || 1);
                    return;
                  }
                  if (excludedIds.has(item.id)) return;
                  let tier = matchTierForSaleItem(item, saleDateTime);
                  if (!tier) {
                    const inc = includedOverrides.find((o) => o.product_id === item.id);
                    if (inc) tier = tiers.find((t) => t.id === inc.tier_id);
                  }
                  if (tier) total += amt * tier.rate / 100;
                });
              });
              return { month: mKey, total };
            });

            const maxTotal = Math.max(1, ...monthlyTotals.map((m) => m.total));
            const chartData = monthlyTotals.slice().reverse().map((m) => {
              const [yy, mm] = m.month.split("-").map(Number);
              const label = new Date(yy, mm - 1, 1).toLocaleDateString("ar", { month: "short", year: "2-digit" });
              return { ...m, label };
            });

            return (
              <div style={{ ...incentiveCardStyle(COLORS.surfaceAlt), marginTop: 16 }}>
                <div onClick={() => setComparisonExpanded((v) => !v)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: comparisonExpanded ? 14 : 0 }}>
                  <div style={{ color: COLORS.blue, fontWeight: 700 }}>📈 مقارنة العمولات عبر الشهور</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select value={incentiveMonthsBack} onClick={(e) => e.stopPropagation()} onChange={(e) => setIncentiveMonthsBack(+e.target.value)}
                      style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textPrimary, fontSize: 12, padding: "4px 8px" }}>
                      <option value={3}>آخر 3 شهور</option>
                      <option value={6}>آخر 6 شهور</option>
                      <option value={12}>آخر 12 شهر</option>
                    </select>
                    <span style={{ color: COLORS.textDim, fontSize: 13 }}>{comparisonExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {comparisonExpanded && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 140, overflowX: "auto", paddingBottom: 4 }}>
                    {chartData.map((m) => (
                      <div key={m.month} style={{ flex: "1 0 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: COLORS.green, fontWeight: 700 }}>{m.total > 0 ? m.total.toFixed(0) : ""}</span>
                        <div
                          title={`${m.month}: ${m.total.toFixed(2)} ر.س`}
                          style={{ width: "100%", maxWidth: 46, background: COLORS.green, height: Math.max((m.total / maxTotal) * 100, 2), borderRadius: "6px 6px 0 0" }}
                        />
                        <span style={{ fontSize: 10, color: COLORS.textDim, whiteSpace: "nowrap" }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Modal إضافة/تعديل Tier ── */}
      <Modal open={showTierForm} onClose={() => { setShowTierForm(false); setEditingTierId(null); }} title={editingTierId ? "✏️ تعديل Tier" : "➕ Tier جديد"}>
        <div style={{ display: "grid", gap: 12 }}>
          <Input label="حد الهامش الأدنى %" value={tierForm.threshold} onChange={(v) => setTierForm((p) => ({ ...p, threshold: v }))} type="number" placeholder="مثلاً 40" />
          <Input label="نسبة العمولة %" value={tierForm.rate} onChange={(v) => setTierForm((p) => ({ ...p, rate: v }))} type="number" placeholder="مثلاً 5" />
          <Btn icon="check" onClick={saveTier}>حفظ</Btn>
        </div>
      </Modal>
    </div>
  );
}
