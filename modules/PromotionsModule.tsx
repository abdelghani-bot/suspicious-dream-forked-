export function PromotionsModule({
  products, setProducts, sales, purchases, shifts, currentUser, pharmacyId, showToast }) {
  const { C } = useTheme();
  const [activeTab, setActiveTab] = useState("auto"); // auto | manual | incentive
  const [promos, setPromos] = useState([]);
  const [incentiveList, setIncentiveList] = useState([]);
  const [incentiveConfig, setIncentiveConfig] = useState({
    rate: 5,
    month: new Date().toISOString().slice(0, 7),
    marginThreshold: 45, // ← حد الهامش التلقائي قابل للتعديل
  });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");

  // ── الشركات المنتجة ──
  const [manufacturers, setManufacturers] = useState([]);
  const [incentiveSupplierFilter, setIncentiveSupplierFilter] = useState("");

  // ── تاريخ تغييرات الهامش (لمنع الأثر الرجعي) ──
  const [thresholdHistory, setThresholdHistory] = useState<{ threshold: number; effective_from: string }[]>([]);

  const DEFAULT_RULES = [
    { days: 90,  discount: 50, color: C.danger },
    { days: 120, discount: 25, color: C.warning },
    { days: 150, discount: 20, color: C.warning },
    { days: 180, discount: 15, color: C.warning },
  ];
  const [discountRules, setDiscountRules] = useState(DEFAULT_RULES);
  const [editRules, setEditRules] = useState(DEFAULT_RULES);

  // تحميل قواعد الخصم من Supabase
  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("promo_rules").select("*").eq("pharmacy_id", pharmacyId).order("days").then(({ data }) => {
      if (data && data.length > 0) {
        setDiscountRules(data);
        setEditRules(data);
      }
    });
  }, [pharmacyId]);

  const [incentiveSearch, setIncentiveSearch] = useState("");
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoPromoConfig, setAutoPromoConfig] = useState({
    excludeCategories: ["دواء"],
    minDiscount: 0,
    requireStock: true,
  });

  const blankPromo = { product_id: "", discount: "", start_date: new Date().toISOString().split("T")[0], end_date: "", note: "" };
  const [promoForm, setPromoForm] = useState(blankPromo);
  const [incentiveForm, setIncentiveForm] = useState({ rate: "", fixed_amount: "", note: "" });
  const [selectedIncentiveProducts, setSelectedIncentiveProducts] = useState<string[]>([]); // IDs المحددة للإضافة

  const today = new Date().toISOString().split("T")[0];
  const monthKey = incentiveConfig.month;

  // ── دالة حفظ autoPromoConfig في Supabase ──
  const saveAutoConfig = async (newConfig) => {
    await supabase.from("promo_settings").upsert({
      pharmacy_id: pharmacyId,
      auto_config: newConfig,
      updated_at: new Date().toISOString(),
    });
  };

  // ── دالة تغيير الهامش مع حفظ التاريخ ──
  const updateMarginThreshold = async (newThreshold: number) => {
    const now = new Date().toISOString();
    // حفظ في جدول التاريخ
    const { error } = await supabase.from("incentive_threshold_history").insert({
      pharmacy_id: pharmacyId,
      threshold: newThreshold,
      effective_from: now,
      created_by: currentUser?.name || currentUser?.email || "",
    });
    if (error) { showToast("خطأ في حفظ الهامش: " + error.message, "error"); return; }
    // تحديث الـ state
    setThresholdHistory((prev) => [...prev, { threshold: newThreshold, effective_from: now }]);
    setIncentiveConfig((p) => ({ ...p, marginThreshold: newThreshold }));
  };

  // تحميل البيانات
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("promotions").select("*").eq("pharmacy_id", pharmacyId).order("end_date"),
      supabase.from("incentive_products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_config").select("*").eq("pharmacy_id", pharmacyId).single(),
      // ── الشركات المنتجة مفلترة بالصيدلية ──
      supabase.from("manufacturers").select("id, name").eq("pharmacy_id", pharmacyId).order("name"),
      // ── إعدادات الإضافة التلقائية المحفوظة ──
      supabase.from("promo_settings").select("auto_config").eq("pharmacy_id", pharmacyId).single(),
      // ── تاريخ تغييرات الهامش ──
      supabase.from("incentive_threshold_history")
        .select("threshold, effective_from")
        .eq("pharmacy_id", pharmacyId)
        .order("effective_from", { ascending: true }),
    ]).then(([p, i, c, m, ps, th]) => {
      if (p.data) setPromos(p.data);
      if (i.data) setIncentiveList(i.data);
      if (c.data) setIncentiveConfig((prev) => ({ ...prev, rate: c.data.rate || 5 }));
      if (m.data) setManufacturers(m.data);
      // ── تحميل autoPromoConfig المحفوظ ──
      if (ps.data?.auto_config) {
        setAutoPromoConfig((prev) => ({ ...prev, ...ps.data.auto_config }));
      }
      // ── تحميل تاريخ الهامش + تحديث القيمة الحالية من آخر سجل ──
      if (th.data && th.data.length > 0) {
        setThresholdHistory(th.data);
        const latest = th.data[th.data.length - 1];
        setIncentiveConfig((prev) => ({ ...prev, marginThreshold: latest.threshold }));
      }
    });
  }, [pharmacyId]);

  // الأصناف التلقائية (غير دواء + فيها صلاحية قريبة)
  const productEarliestExpiry = useMemo(() => {
    const map = {};
    (purchases || []).forEach((pu) => {
      const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
      items.forEach((item) => {
        const expiry = item.expiry_date || item.expiry;
        if (!expiry || !item.id) return;
        if (!map[item.id] || expiry < map[item.id]) map[item.id] = expiry;
      });
    });
    (products || []).forEach((p) => {
      if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) {
        map[p.id] = p.expiry;
      }
    });
    return map;
  }, [purchases, products]);

  const getProductExpiry = (p) =>
    productEarliestExpiry[p.id] || p.expiry || null;

  const autoPromoProducts = products.filter((p) => {
    const cat = p.main_category || p.category || "";
    if (autoPromoConfig.excludeCategories.includes(cat)) return false;
    if (autoPromoConfig.requireStock && (p.stock || 0) <= 0) return false;
    const expiry = getProductExpiry(p);
    const disc = calcAutoDiscount(expiry, discountRules);
    return disc > 0 && disc >= autoPromoConfig.minDiscount;
  }).map((p) => {
    const expiry = getProductExpiry(p);
    return { ...p, expiry, autoDiscount: calcAutoDiscount(expiry, discountRules) };
  }).sort((a, b) => b.autoDiscount - a.autoDiscount);

  // ── الأصناف المحفزة — حسب marginThreshold القابل للتعديل ──
  const highMarginProducts = products.filter((p) => {
    const cost = p.cost || 0;
    const price = p.price || 0;
    if (!cost || !price) return false;
    return ((price - cost) / price) * 100 >= incentiveConfig.marginThreshold;
  });

  // ── دالة طباعة Shelf Label ──
  const printShelfLabel = (items: {
    name: string;
    originalPrice: number;
    discountedPrice: number;
    discount: number;
    endDate?: string;
    isAuto?: boolean;
  }[]) => {
    const labelsHTML = items.map((item) => `
      <div class="label">
        <div class="pharmacy-name">PharmacyPro</div>
        <div class="product-name">${item.name}</div>
        <div class="discount-badge">خصم ${item.discount}%</div>
        <div class="prices">
          <div class="old-price-box">
            <div class="old-price-label">السعر قبل</div>
            <div class="old-price">${item.originalPrice.toFixed(2)}</div>
          </div>
          <div class="arrow">◄</div>
          <div class="new-price-box">
            <div class="new-price-label">السعر بعد</div>
            <div class="new-price">${item.discountedPrice.toFixed(2)}</div>
          </div>
        </div>
        ${item.endDate ? `<div class="end-date">ينتهي العرض: ${item.endDate}</div>` : ""}
      </div>
    `).join("");

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8"/>
        <title>Shelf Labels</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
          .page {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8mm;
            padding: 10mm;
            width: 210mm;
          }
          .label {
            background: #FFD700;
            border: 3px solid #e6b800;
            border-radius: 12px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-height: 120mm;
            justify-content: center;
          }
          .pharmacy-name { font-size: 11px; color: #7a6000; font-weight: 600; letter-spacing: 1px; }
          .product-name { font-size: 18px; font-weight: 900; color: #1a1a00; text-align: center; line-height: 1.3; }
          .discount-badge { background: #cc0000; color: #fff; font-size: 20px; font-weight: 900; padding: 4px 20px; border-radius: 20px; }
          .prices { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; margin-top: 4px; }
          .old-price-box { background: #cc0000; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .old-price-label { color: #ffaaaa; font-size: 11px; margin-bottom: 2px; }
          .old-price { color: #fff; font-size: 22px; font-weight: 900; text-decoration: line-through; text-decoration-color: #ffaaaa; text-decoration-thickness: 3px; }
          .arrow { color: #7a6000; font-size: 22px; }
          .new-price-box { background: #1a5c00; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .new-price-label { color: #aaffaa; font-size: 11px; margin-bottom: 2px; }
          .new-price { color: #fff; font-size: 28px; font-weight: 900; }
          .end-date { font-size: 12px; color: #5a4400; background: #fff3; padding: 3px 10px; border-radius: 6px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="page">${labelsHTML}</div>
        <script>
          window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // ── طباعة تلقائية عند دخول صنف جديد للعروض التلقائية ──
  useEffect(() => {
    if (!pharmacyId || autoPromoProducts.length === 0) return;
    const storageKey = `printed_auto_promos_${pharmacyId}`;
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const newItems: typeof autoPromoProducts = [];
    autoPromoProducts.forEach((p) => {
      const prevDiscount = stored[p.id];
      if (prevDiscount === undefined || prevDiscount !== p.autoDiscount) {
        newItems.push(p);
        stored[p.id] = p.autoDiscount;
      }
    });
    if (newItems.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(stored));
    printShelfLabel(
      newItems.map((p) => ({
        name: p.name || p.nameAr || "",
        originalPrice: p.price,
        discountedPrice: parseFloat((p.price * (1 - p.autoDiscount / 100)).toFixed(2)),
        discount: p.autoDiscount,
        isAuto: true,
      }))
    );
  }, [autoPromoProducts, pharmacyId]);

  // حفظ عرض يدوي
  const savePromo = async () => {
    if (!promoForm.product_id || !promoForm.discount || !promoForm.end_date) {
      showToast("يرجى ملء جميع الحقول", "error"); return;
    }
    const row = { ...promoForm, discount: +promoForm.discount, pharmacy_id: pharmacyId };
    const { data, error } = await supabase.from("promotions").insert([row]).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setPromos((p) => [...p, data[0]]);
    setPromoForm(blankPromo);
    setShowPromoForm(false);
    showToast("تم إضافة العرض ✓");
    const prod = products.find((p) => p.id === promoForm.product_id);
    if (prod) {
      printShelfLabel([{
        name: prod.name || prod.nameAr || "",
        originalPrice: prod.price,
        discountedPrice: parseFloat((prod.price * (1 - +promoForm.discount / 100)).toFixed(2)),
        discount: +promoForm.discount,
        endDate: promoForm.end_date,
        isAuto: false,
      }]);
    }
  };

  // حفظ أصناف محفزة (متعددة)
  const saveIncentive = async () => {
    if (selectedIncentiveProducts.length === 0) { showToast("اختر صنفاً على الأقل", "error"); return; }
    // تصفية الأصناف اللي مضافة مسبقاً
    const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
    const toAdd = selectedIncentiveProducts.filter((id) => !alreadyAdded.has(id));
    if (toAdd.length === 0) { showToast("الأصناف المحددة مضافة مسبقاً", "error"); return; }
    const rows = toAdd.map((product_id) => ({
      product_id,
      rate: incentiveForm.rate || null,
      fixed_amount: incentiveForm.fixed_amount || null,
      note: incentiveForm.note || null,
      pharmacy_id: pharmacyId,
    }));
    const { data, error } = await supabase.from("incentive_products").insert(rows).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setIncentiveList((p) => [...p, ...data]);
    setIncentiveForm({ rate: "", fixed_amount: "", note: "" });
    setSelectedIncentiveProducts([]);
    setIncentiveSupplierFilter("");
    setShowIncentiveForm(false);
    showToast(`تم إضافة ${data.length} صنف للقائمة المحفزة ✓`);
  };

  // حساب مبيعات الصيدلي من الأصناف المحفزة في الشهر
  const calcIncentiveSales = (userName) => {
    const incentiveIds = new Set([
      ...incentiveList.map((i) => i.product_id),
      ...highMarginProducts.map((p) => p.id),
    ]);
    const monthSales = sales.filter((s) =>
      s.date?.startsWith(monthKey) && !s.returned &&
      (s.cashier === userName || s.user === userName || s.created_by === userName)
    );
    let total = 0;
    monthSales.forEach((s) => {
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      items.forEach((item) => {
        if (incentiveIds.has(item.id)) total += (item.price || 0) * (item.qty || 1);
      });
    });
    return total;
  };

  const activePromos = promos.filter((p) => p.end_date >= today && p.start_date <= today);
  const expiredPromos = promos.filter((p) => p.end_date < today);

  const discountColor = (d) => d >= 50 ? C.danger : d >= 25 ? C.warning : d >= 20 ? C.warning : C.warning;

  const cardStyle = (border = C.border) => ({
    background: C.surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });

  const filteredAutoPromos = autoPromoProducts.filter((p) =>
    !promoSearch || (p.name || p.nameAr || "").includes(promoSearch)
  );
  const filteredIncentive = incentiveList.filter((i) =>
    !incentiveSearch || (products.find((p) => p.id === i.product_id)?.name || "").includes(incentiveSearch)
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🏷️ إدارة العروض</h2>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
            عروض تلقائية حسب الصلاحية + عروض يدوية + أصناف محفزة
          </div>
        </div>
      </div>

      {/* تنبيه العروض التلقائية */}
      {autoPromoProducts.length > 0 && (
        <div style={{ background: "#1a0800", border: "1px solid #4a2800", borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: C.warning, fontWeight: 700 }}>⚠️ {autoPromoProducts.length} صنف يحتاج عرض تلقائي</span>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>أصناف غير دوائية بصلاحية أقل من 6 شهور</div>
          </div>
          <button onClick={() => setActiveTab("auto")} style={{ background: "#3a2000", border: "1px solid #6a4000", borderRadius: 8, padding: "6px 14px", color: C.warning, fontSize: 12, cursor: "pointer" }}>
            عرض التفاصيل
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bgAlt, borderRadius: 10, padding: 4 }}>
        {[
          { k: "auto", l: `⏰ تلقائي (${autoPromoProducts.length})` },
          { k: "manual", l: `✋ يدوي (${activePromos.length})` },
          { k: "incentive", l: "⭐ أصناف محفزة" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? C.surface : "transparent",
            color: activeTab === t.k ? C.accent : C.muted,
            fontSize: 12, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── العروض التلقائية ── */}
      {activeTab === "auto" && (
        <div>
          <div style={cardStyle("#1a2a1a")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: C.success, fontWeight: 700 }}>📋 منطق الخصم التدرجي التلقائي</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAutoConfig((v) => !v)}
                  style={{ background: "#1a0a2a", border: "1px solid #4a1a6a", borderRadius: 8, padding: "5px 14px", color: "#a78bfa", fontSize: 12, cursor: "pointer" }}>
                  ⚙️ شرط الإضافة
                </button>
                <button onClick={() => { setEditRules(discountRules.map(r => ({...r}))); setShowRulesEditor(true); }}
                  style={{ background: C.surface, border: "1px solid #1d3a6a", borderRadius: 8, padding: "5px 14px", color: C.accent, fontSize: 12, cursor: "pointer" }}>
                  ✏️ تعديل القواعد
                </button>
              </div>
            </div>

            {/* كارت إعدادات شرط الإضافة التلقائية */}
            {showAutoConfig && (
              <div style={{ background: "#0a0a1a", border: "1px solid #2a1a4a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⚙️ شروط الإضافة للقائمة التلقائية</div>

                {/* الفئات المستثناة */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>الفئات المستثناة (لن تظهر في العروض التلقائية):</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["دواء", "مستلزمات طبية", "مستحضرات تجميل", "أخرى"].map((cat) => {
                      const excluded = autoPromoConfig.excludeCategories.includes(cat);
                      return (
                        <div key={cat} onClick={() => {
                          const updated = {
                            ...autoPromoConfig,
                            excludeCategories: excluded
                              ? autoPromoConfig.excludeCategories.filter((c) => c !== cat)
                              : [...autoPromoConfig.excludeCategories, cat],
                          };
                          setAutoPromoConfig(updated);
                          saveAutoConfig(updated);
                        }} style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                          background: excluded ? C.dangerBg : "#0a1a0a",
                          border: `1px solid ${excluded ? "#6a2a2a" : "#1a4a1a"}`,
                          color: excluded ? C.warning : C.success, fontSize: 12 }}>
                          {excluded ? "✕ " : "✓ "}{cat}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* الحد الأدنى للخصم */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>أقل خصم يظهر في القائمة:</span>
                  <input type="number" min="0" max="100" value={autoPromoConfig.minDiscount}
                    onChange={(e) => {
                      const updated = { ...autoPromoConfig, minDiscount: +e.target.value };
                      setAutoPromoConfig(updated);
                      saveAutoConfig(updated);
                    }}
                    style={{ width: 60, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: C.text, fontSize: 13, outline: "none" }} />
                  <span style={{ color: C.muted, fontSize: 12 }}>%</span>
                </div>

                {/* اشتراط المخزون */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>إظهار الأصناف المنتهية المخزون:</span>
                  <div onClick={() => {
                    const updated = { ...autoPromoConfig, requireStock: !autoPromoConfig.requireStock };
                    setAutoPromoConfig(updated);
                    saveAutoConfig(updated);
                  }}
                    style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                      background: autoPromoConfig.requireStock ? "#2a6a2a" : "#6a2a2a",
                      position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: autoPromoConfig.requireStock ? 3 : 19, transition: "left 0.2s" }} />
                  </div>
                  <span style={{ color: autoPromoConfig.requireStock ? C.success : C.warning, fontSize: 11 }}>
                    {autoPromoConfig.requireStock ? "مخفية" : "ظاهرة"}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[...discountRules].sort((a,b) => a.days - b.days).map((r) => (
                <div key={r.days} style={{ background: C.bgAlt, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ color: r.color || C.warning, fontWeight: 900, fontSize: 18 }}>{r.discount}%</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>أقل من {Math.round(r.days/30)} شهور</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>({r.days} يوم)</div>
                </div>
              ))}
            </div>
          </div>

          <input
            value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredAutoPromos.length === 0
            ? <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>✅ لا توجد أصناف تحتاج عروض تلقائية</div>
            : filteredAutoPromos.map((p) => {
                const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                const newPrice = (p.price * (1 - p.autoDiscount / 100)).toFixed(2);
                return (
                  <div key={p.id} style={cardStyle(p.autoDiscount >= 50 ? "#3a0000" : p.autoDiscount >= 25 ? "#3a1500" : C.warningBg)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{p.name || p.nameAr}</span>
                          <span style={{
                            background: discountColor(p.autoDiscount), color: "#fff",
                            borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900,
                          }}>-{p.autoDiscount}%</span>
                        </div>
                        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                          <span style={{ color: C.muted }}>الفئة: <span style={{ color: C.muted }}>{p.main_category || p.category}</span></span>
                          <span style={{ color: C.muted }}>المخزون: <span style={{ color: C.text }}>{p.stock}</span></span>
                          <span style={{ color: C.muted }}>ينتهي بعد: <span style={{ color: discountColor(p.autoDiscount) }}>{days} يوم</span></span>
                        </div>
                      </div>
                      <div style={{ textAlign: "left", minWidth: 110 }}>
                        <div style={{ color: C.muted, fontSize: 11, textDecoration: "line-through" }}>{p.price} ر.س</div>
                        <div style={{ color: C.success, fontWeight: 900, fontSize: 18 }}>{newPrice} ر.س</div>
                        <div style={{ color: C.muted, fontSize: 10 }}>تاريخ: {p.expiry}</div>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── العروض اليدوية ── */}
      {activeTab === "manual" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowPromoForm(true)}>إضافة عرض</Btn>
          </div>

          {activePromos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.success, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>✅ عروض نشطة ({activePromos.length})</div>
              {activePromos.map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                const newPrice = prod ? (prod.price * (1 - promo.discount / 100)).toFixed(2) : "—";
                const daysLeft = Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={promo.id} style={cardStyle(C.successBg)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ color: C.text, fontWeight: 700 }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                          <span style={{ background: C.warning, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>-{promo.discount}%</span>
                        </div>
                        <div style={{ color: C.muted, fontSize: 11 }}>
                          {promo.start_date} ← {promo.end_date}
                          {promo.note && <span style={{ marginRight: 10, color: C.muted }}>• {promo.note}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ color: C.success, fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</div>
                        <div style={{ color: daysLeft <= 3 ? C.danger : C.muted, fontSize: 11 }}>يتبقى {daysLeft} يوم</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expiredPromos.length > 0 && (
            <div>
              <div style={{ color: C.muted, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 عروض منتهية ({expiredPromos.length})</div>
              {expiredPromos.slice(0, 5).map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                return (
                  <div key={promo.id} style={{ ...cardStyle(), opacity: 0.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: C.muted }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                      <span style={{ color: C.muted }}>-{promo.discount}% • انتهى {promo.end_date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {promos.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>لا توجد عروض يدوية</div>}
        </div>
      )}

      {/* ── الأصناف المحفزة ── */}
      {activeTab === "incentive" && (
        <div>
          {/* إعداد النسبة */}
          <div style={cardStyle("#1a2a4a")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: C.accent, fontWeight: 700, marginBottom: 4 }}>⚙️ إعدادات العمولة</div>
                <div style={{ color: C.muted, fontSize: 12 }}>نسبة الصيدلي من مبيعات الأصناف المحفزة</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <label style={{ color: C.muted, fontSize: 11, display: "block", marginBottom: 2 }}>الشهر</label>
                  <input type="month" value={incentiveConfig.month}
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, month: e.target.value }))}
                    style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: C.muted, fontSize: 11, display: "block", marginBottom: 2 }}>نسبة العمولة %</label>
                  <input type="number" value={incentiveConfig.rate} min="1" max="20"
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, rate: +e.target.value }))}
                    style={{ width: 70, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 13, outline: "none" }} />
                </div>
                {/* ── خانة حد الهامش التلقائي ── */}
                <div>
                  <label style={{ color: C.muted, fontSize: 11, display: "block", marginBottom: 2 }}>حد الهامش التلقائي %</label>
                  <input type="number" value={incentiveConfig.marginThreshold} min="1" max="100"
                    onBlur={(e) => {
                      const val = +e.target.value;
                      if (val !== incentiveConfig.marginThreshold) updateMarginThreshold(val);
                    }}
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, marginThreshold: +e.target.value }))}
                    style={{ width: 70, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 13, outline: "none" }} />
                </div>
              </div>
            </div>
          </div>

          {/* أصناف بهامش تلقائية — العنوان يعكس القيمة الحالية */}
          <div style={cardStyle("#1a1a2a")}>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 10 }}>
              🎯 أصناف بهامش ربح ≥ {incentiveConfig.marginThreshold}% — تلقائية ({highMarginProducts.length})
            </div>
            {highMarginProducts.length === 0
              ? <div style={{ color: C.muted, fontSize: 12 }}>لا توجد أصناف بهذا الهامش حالياً</div>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {highMarginProducts.map((p) => {
                    const margin = (((p.price - p.cost) / p.price) * 100).toFixed(0);
                    return (
                      <div key={p.id} style={{ background: "#0a0a1a", border: "1px solid #2a2a4a", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        <span style={{ color: C.text }}>{p.name || p.nameAr}</span>
                        <span style={{ color: "#a78bfa", marginRight: 8, fontWeight: 700 }}>{margin}%</span>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* أصناف مضافة يدوياً */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: C.text, fontWeight: 700 }}>✋ أصناف مضافة يدوياً ({incentiveList.length})</div>
            <Btn icon="plus" size="sm" onClick={() => setShowIncentiveForm(true)}>إضافة صنف</Btn>
          </div>

          <input
            value={incentiveSearch} onChange={(e) => setIncentiveSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredIncentive.map((item) => {
            const prod = products.find((p) => p.id === item.product_id);
            return (
              <div key={item.id} style={cardStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700 }}>{prod?.name || prod?.nameAr || item.product_id}</div>
                    {item.note && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{item.note}</div>}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    {item.rate && <div style={{ color: C.success, fontWeight: 700 }}>{item.rate}% عمولة</div>}
                    {item.fixed_amount && <div style={{ color: C.accent, fontWeight: 700 }}>{item.fixed_amount} ر.س ثابت</div>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── نسبة الصيدلي هذا الشهر ── */}
          {(() => {
            const incentiveIds = new Set([
              ...incentiveList.map((i) => i.product_id),
              ...highMarginProducts.map((p) => p.id),
            ]);
            const staffSales = {};
            sales
              .filter((s) => s.date?.startsWith(monthKey) && !s.returned)
              .forEach((s) => {
                const name = s.cashier || s.user || s.created_by || "غير محدد";
                // وقت البيعة بالظبط لتحديد الهامش الساري وقتها
                const saleDateTime = s.created_at || s.date + "T00:00:00.000Z";

                // الهامش الساري وقت البيعة — آخر سجل قبل أو عند وقت البيعة
                const applicableThreshold = thresholdHistory.length > 0
                  ? (thresholdHistory.filter((h) => h.effective_from <= saleDateTime).at(-1)?.threshold ?? incentiveConfig.marginThreshold)
                  : incentiveConfig.marginThreshold;

                // الأصناف ذات الهامش المرتفع بناءً على الهامش الساري وقتها
                const validMarginIds = new Set(
                  products.filter((p) => {
                    const cost = p.cost || 0;
                    const price = p.price || 0;
                    if (!cost || !price) return false;
                    return ((price - cost) / price) * 100 >= applicableThreshold;
                  }).map((p) => p.id)
                );

                // الأصناف اليدوية لا تتأثر بالهامش
                const allIncentiveIds = new Set([
                  ...incentiveList.map((i) => i.product_id),
                  ...validMarginIds,
                ]);

                const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
                items.forEach((item) => {
                  if (allIncentiveIds.has(item.id)) {
                    if (!staffSales[name]) staffSales[name] = { total: 0, items: {} };
                    const amt = (item.price || 0) * (item.qty || 1);
                    staffSales[name].total += amt;
                    const prod = products.find((p) => p.id === item.id);
                    const pName = prod?.name || prod?.nameAr || item.name || item.id;
                    if (!staffSales[name].items[pName]) staffSales[name].items[pName] = 0;
                    staffSales[name].items[pName] += amt;
                  }
                });
              });

            const staffList = Object.entries(staffSales).filter(([, v]) => v.total > 0);
            if (staffList.length === 0) return (
              <div style={{ ...cardStyle(), marginTop: 16, textAlign: "center" }}>
                <div style={{ color: C.muted, padding: 20 }}>
                  لا توجد مبيعات من الأصناف المحفزة في {monthKey}
                </div>
              </div>
            );

            const totalAllStaff = staffList.reduce((a, [, v]) => a + v.total, 0);

            return (
              <div style={{ ...cardStyle(C.successBg), marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: C.success, fontWeight: 700, fontSize: 14 }}>
                    📊 عمولة الأصناف المحفزة — {monthKey}
                  </div>
                  <div style={{ color: C.muted, fontSize: 12 }}>
                    إجمالي المبيعات المحفزة: <span style={{ color: C.success, fontWeight: 700 }}>{totalAllStaff.toFixed(2)} ر.س</span>
                  </div>
                </div>

                {staffList.map(([name, data]) => {
                  const rate = incentiveConfig.rate;
                  const commission = (data.total * rate / 100);
                  const pct = totalAllStaff > 0 ? (data.total / totalAllStaff * 100).toFixed(1) : "0";
                  return (
                    <div key={name} style={{ padding: "12px 0", borderBottom: "1px solid #0a1a0a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>👤 {name}</div>
                          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                            مبيعات محفزة: <span style={{ color: C.success }}>{data.total.toFixed(2)} ر.س</span>
                            <span style={{ marginRight: 10, color: C.muted }}>({pct}% من الإجمالي)</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ color: C.success, fontWeight: 900, fontSize: 18 }}>{commission.toFixed(2)} ر.س</div>
                          <div style={{ color: C.muted, fontSize: 11 }}>عمولة {rate}%</div>
                        </div>
                      </div>
                      <div style={{ background: C.bgAlt, borderRadius: 4, height: 6, marginBottom: 8 }}>
                        <div style={{ background: C.success, height: "100%", borderRadius: 4, width: `${pct}%`, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {Object.entries(data.items).map(([pName, amt]) => (
                          <div key={pName} style={{ background: "#0a1a0a", border: "1px solid #1a3a1a", borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                            <span style={{ color: C.muted }}>{pName}</span>
                            <span style={{ color: C.success, marginRight: 6, fontWeight: 700 }}>{(amt as number).toFixed(0)} ر.س</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "2px solid #1a3a1a" }}>
                  <span style={{ color: C.text, fontWeight: 700 }}>إجمالي العمولات المستحقة</span>
                  <span style={{ color: C.success, fontWeight: 900, fontSize: 18 }}>
                    {staffList.reduce((a, [, v]) => a + v.total * incentiveConfig.rate / 100, 0).toFixed(2)} ر.س
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal تعديل قواعد الخصم */}
      <Modal open={showRulesEditor} onClose={() => setShowRulesEditor(false)} title="✏️ تعديل قواعد الخصم التدرجي">
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
          حدد عدد الأيام ونسبة الخصم لكل مرحلة — يتم الترتيب تلقائياً من الأقل للأكثر
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>أقل من (يوم)</span>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>نسبة الخصم %</span>
          <span/>
        </div>
        {editRules.map((rule, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" value={rule.days} min="1" max="365"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, days: +e.target.value } : r))}
              style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <input type="number" value={rule.discount} min="1" max="100"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, discount: +e.target.value } : r))}
              style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <button onClick={() => setEditRules((p) => p.filter((_, j) => j !== i))}
              style={{ background: C.dangerBg, border: "none", borderRadius: 6, padding: "8px 12px", color: C.warning, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={() => setEditRules((p) => [...p, { days: 60, discount: 10, color: C.warning }])}
          style={{ background: "#0a1a0a", border: "1px dashed #1a4a1a", borderRadius: 8, padding: "7px 14px", color: C.success, cursor: "pointer", fontSize: 12, width: "100%", marginBottom: 14 }}>
          + إضافة مرحلة
        </button>
        <div style={{ background: C.bgAlt, borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>معاينة:</div>
          {[...editRules].sort((a, b) => a.days - b.days).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: C.muted }}>أقل من {r.days} يوم (~{Math.round(r.days/30)} شهور)</span>
              <span style={{ color: C.warning, fontWeight: 700 }}>خصم {r.discount}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setEditRules([...DEFAULT_RULES])}>إعادة للافتراضي</Btn>
          <Btn variant="ghost" onClick={() => setShowRulesEditor(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            const sorted = [...editRules].sort((a, b) => a.days - b.days);
            await supabase.from("promo_rules").delete().eq("pharmacy_id", pharmacyId);
            const rows = sorted.map((r) => ({
              days: r.days,
              discount: r.discount,
              color: r.color || C.warning,
              pharmacy_id: pharmacyId,
            }));
            const { error } = await supabase.from("promo_rules").insert(rows);
            if (error) { showToast("خطأ في الحفظ: " + error.message, "error"); return; }
            setDiscountRules(sorted);
            setShowRulesEditor(false);
            showToast("تم حفظ قواعد الخصم ✓");
          }}>حفظ</Btn>
        </div>
      </Modal>

      {/* Modal إضافة عرض يدوي */}
      <Modal open={showPromoForm} onClose={() => setShowPromoForm(false)} title="➕ إضافة عرض يدوي">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>الصنف</label>
            <select value={promoForm.product_id}
              onChange={(e) => setPromoForm((p) => ({ ...p, product_id: e.target.value }))}
              style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}>
              <option value="">-- اختر صنفاً --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.nameAr} — {p.price} ر.س</option>
              ))}
            </select>
          </div>
          <Input label="نسبة الخصم %" value={promoForm.discount} onChange={(v) => setPromoForm((p) => ({ ...p, discount: v }))} type="number" placeholder="10" />
          <Input label="تاريخ البداية" value={promoForm.start_date} onChange={(v) => setPromoForm((p) => ({ ...p, start_date: v }))} type="date" />
          <Input label="تاريخ النهاية" value={promoForm.end_date} onChange={(v) => setPromoForm((p) => ({ ...p, end_date: v }))} type="date" />
          <Input label="ملاحظة" value={promoForm.note} onChange={(v) => setPromoForm((p) => ({ ...p, note: v }))} placeholder="وصف العرض..." />
        </div>
        {promoForm.product_id && promoForm.discount && (() => {
          const prod = products.find((p) => p.id === promoForm.product_id);
          if (!prod) return null;
          const newPrice = (prod.price * (1 - +promoForm.discount / 100)).toFixed(2);
          return (
            <div style={{ background: "#0a1a0a", border: "1px solid #1a4a1a", borderRadius: 8, padding: 10, marginTop: 10 }}>
              <span style={{ color: C.muted, fontSize: 12 }}>السعر بعد الخصم: </span>
              <span style={{ color: C.success, fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</span>
              <span style={{ color: C.muted, fontSize: 11, marginRight: 8 }}>(بدلاً من {prod.price} ر.س)</span>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowPromoForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={savePromo}>إضافة العرض</Btn>
        </div>
      </Modal>

      {/* ── Modal إضافة صنف محفز — مع فلتر الشركة المنتجة وتحديد متعدد ── */}
      <Modal open={showIncentiveForm} onClose={() => { setShowIncentiveForm(false); setIncentiveSupplierFilter(""); setSelectedIncentiveProducts([]); }} title="⭐ إضافة أصناف للقائمة المحفزة">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>

          {/* فلتر الشركة المنتجة */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 4 }}>
              🏭 الشركة المنتجة
            </label>
            <select
              value={incentiveSupplierFilter}
              onChange={(e) => {
                const mId = e.target.value;
                setIncentiveSupplierFilter(mId);
                // تحديد كل أصناف الشركة تلقائياً (ما عدا المضافة مسبقاً)
                const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
                const ids = products
                  .filter((p) => p.manufacturer_id === mId && !alreadyAdded.has(p.id))
                  .map((p) => p.id);
                setSelectedIncentiveProducts(ids);
              }}
              style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}>
              <option value="">-- اختر شركة --</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <Input label="نسبة عمولة %" value={incentiveForm.rate} onChange={(v) => setIncentiveForm((p) => ({ ...p, rate: v }))} type="number" placeholder="اتركه فارغ لو ثابت" />
          <Input label="مبلغ ثابت (ر.س)" value={incentiveForm.fixed_amount} onChange={(v) => setIncentiveForm((p) => ({ ...p, fixed_amount: v }))} type="number" placeholder="اتركه فارغ لو نسبة" />
          <div style={{ gridColumn: "1/-1" }}>
            <Input label="ملاحظة" value={incentiveForm.note} onChange={(v) => setIncentiveForm((p) => ({ ...p, note: v }))} placeholder="تطبق على جميع الأصناف المضافة..." />
          </div>
        </div>

        {/* قائمة أصناف الشركة مع checkbox */}
        {incentiveSupplierFilter && (() => {
          const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
          const mfProducts = products.filter((p) => p.manufacturer_id === incentiveSupplierFilter);
          const available = mfProducts.filter((p) => !alreadyAdded.has(p.id));
          const allSelected = available.length > 0 && available.every((p) => selectedIncentiveProducts.includes(p.id));

          return (
            <div style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 10, overflow: "hidden" }}>
              {/* Header القائمة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1d2d4a", background: "#0a1220" }}>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 13 }}>
                  {mfProducts.length} صنف
                  {alreadyAdded.size > 0 && (
                    <span style={{ color: C.muted, fontWeight: 400, fontSize: 11, marginRight: 8 }}>
                      ({mfProducts.filter(p => alreadyAdded.has(p.id)).length} مضاف مسبقاً)
                    </span>
                  )}
                </div>
                {available.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSelectedIncentiveProducts(available.map((p) => p.id))}
                      style={{ background: "none", border: "none", color: C.success, fontSize: 12, cursor: "pointer" }}>
                      تحديد الكل
                    </button>
                    <span style={{ color: C.border }}>|</span>
                    <button onClick={() => setSelectedIncentiveProducts([])}
                      style={{ background: "none", border: "none", color: C.warning, fontSize: 12, cursor: "pointer" }}>
                      إلغاء الكل
                    </button>
                  </div>
                )}
              </div>

              {/* الأصناف */}
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {mfProducts.length === 0 ? (
                  <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 13 }}>
                    لا توجد أصناف لهذه الشركة
                  </div>
                ) : (
                  mfProducts.map((p) => {
                    const isAdded = alreadyAdded.has(p.id);
                    const isSelected = selectedIncentiveProducts.includes(p.id);
                    const margin = p.cost && p.price
                      ? (((p.price - p.cost) / p.price) * 100).toFixed(0)
                      : null;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isAdded) return;
                          setSelectedIncentiveProducts((prev) =>
                            isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderBottom: "1px solid #0d1928",
                          cursor: isAdded ? "default" : "pointer",
                          background: isAdded ? "#0a0f18" : isSelected ? C.surface : "transparent",
                          opacity: isAdded ? 0.5 : 1,
                          transition: "background 0.15s",
                        }}>
                        {/* Checkbox */}
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${isAdded ? "#2a3a4a" : isSelected ? C.accent : "#2a3a5a"}`,
                          background: isAdded ? C.surface : isSelected ? C.accent : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {(isSelected || isAdded) && (
                            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>
                          )}
                        </div>

                        {/* اسم الصنف */}
                        <div style={{ flex: 1 }}>
                          <div style={{ color: isAdded ? C.muted : C.text, fontSize: 13 }}>
                            {p.name || p.nameAr}
                            {isAdded && <span style={{ color: C.muted, fontSize: 11, marginRight: 8 }}>• مضاف مسبقاً</span>}
                          </div>
                          {margin && (
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                              هامش: <span style={{ color: +margin >= incentiveConfig.marginThreshold ? "#a78bfa" : C.muted }}>{margin}%</span>
                            </div>
                          )}
                        </div>

                        {/* السعر */}
                        <div style={{ color: C.muted, fontSize: 12, textAlign: "left" }}>
                          {p.price} ر.س
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: C.muted, fontSize: 12 }}>
            {selectedIncentiveProducts.length > 0 && (
              <span style={{ color: C.accent }}>{selectedIncentiveProducts.length} صنف محدد</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setShowIncentiveForm(false); setIncentiveSupplierFilter(""); setSelectedIncentiveProducts([]); }}>إلغاء</Btn>
            <Btn icon="check" onClick={saveIncentive}>
              إضافة {selectedIncentiveProducts.length > 0 ? `(${selectedIncentiveProducts.length})` : ""}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
// ==================== TARGET MODULE ====================
