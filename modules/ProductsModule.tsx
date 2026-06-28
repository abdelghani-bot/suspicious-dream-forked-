export function ProductsModule({
  products, setProducts, suppliers, sales, purchases, showToast, pharmacyId }) {
  const { C } = useTheme();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showSlowProducts, setShowSlowProducts] = useState(false);

  // ── الشركات المنتجة ──
  const [manufacturers, setManufacturers] = useState([]);
  const [showMfrModal, setShowMfrModal] = useState(false);
  const [newMfrName, setNewMfrName] = useState("");

  // ── المواد الفعالة ──
  const [allIngredients, setAllIngredients] = useState([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  // ── الباركودات ──
  const [barcodes, setBarcodes] = useState([]);

  const blank = {
    id: "", nameAr: "", nameEn: "",
    mainCategory: "دواء", subCategory1: "مستورد", subCategory2: "أقراص",
    packageType: "", saleUnits: "",
    price: "", cost: "", taxable: true,
    minStock: "", maxStock: "",
    isEssential: false, isChronic: false,
    supply_category: "",
    manufacturer_id: "",
    notAvailableMarket: false,
    shortageReportUrl: "",
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // تحميل المواد الفعالة والشركات
  useEffect(() => {
    supabase.from("active_ingredients").select("*").order("name_ar")
      .then(({ data }) => { if (data) setAllIngredients(data); });
    supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId).order("name")
      .then(({ data }) => { if (data) setManufacturers(data); });
  }, [pharmacyId]);

  const handleMainCategoryChange = (val) => {
    const cat = MAIN_CATEGORIES[val];
    setForm((p) => ({
      ...p, mainCategory: val,
      subCategory1: cat.sub1[0] || "",
      subCategory2: cat.sub2[0] || "",
    }));
  };

  const filtered = products.filter((p) => {
    const s = search.toLowerCase();
    const str = (v) => (v == null ? "" : String(v));
    return (
      str(p.nameAr || p.name).includes(search) ||
      str(p.nameEn).toLowerCase().includes(s) ||
      str(p.barcode).includes(search) ||
      str(p.id).includes(search) ||
      str(p.mainCategory || p.category).includes(search)
    );
  });

  // ── فتح تعديل ──
  const openEdit = async (p) => {
    setEditing(p.id);
    setForm({
      ...blank, ...p,
      nameAr: p.nameAr || p.name_ar || p.name || "",
      nameEn: p.nameEn || p.name_en || "",
      // السعر المخزن قبل الضريبة، نعرضه شامل الضريبة للمستخدم
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
      manufacturer_id: p.manufacturer_id || "",
      notAvailableMarket: p.not_available_market ?? false,
      shortageReportUrl: p.shortage_report_url || "",
    });

    const { data: bc } = await supabase.from("product_barcodes").select("*").eq("product_id", p.id).order("is_primary", { ascending: false });
    setBarcodes(bc || []);

    const { data: pi } = await supabase.from("product_ingredients").select("*, active_ingredients(name_ar)").eq("product_id", p.id);
    setSelectedIngredients((pi || []).map((x) => ({
      ingredient_id: x.ingredient_id,
      name_ar: x.active_ingredients?.name_ar || "",
      concentration: x.concentration || "",
      db_id: x.id,
    })));

    setShowForm(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank, id: "P" + String(products.length + 1).padStart(3, "0") });
    setBarcodes([{ base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: true }]);
    setSelectedIngredients([]);
    setShowForm(true);
  };

  const addBarcode = () => setBarcodes((prev) => [...prev, { base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: false }]);
  const updateBarcode = (i, key, val) => setBarcodes((prev) => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const removeBarcode = (i) => setBarcodes((prev) => prev.filter((_, idx) => idx !== i));

  const addIngredient = async (ing) => {
    if (selectedIngredients.find((x) => x.ingredient_id === ing.id)) { setShowIngredientDropdown(false); setIngredientSearch(""); return; }
    setSelectedIngredients((prev) => [...prev, { ingredient_id: ing.id, name_ar: ing.name_ar, concentration: "", db_id: null }]);
    setShowIngredientDropdown(false);
    setIngredientSearch("");
  };

  const addNewIngredient = async () => {
    if (!ingredientSearch.trim()) return;
    const { data, error } = await supabase.from("active_ingredients").insert({ name_ar: ingredientSearch.trim() }).select().single();
    if (error) { showToast("خطأ في إضافة المادة الفعالة", "error"); return; }
    setAllIngredients((prev) => [...prev, data]);
    addIngredient(data);
  };

  const removeIngredient = (ingredient_id) => setSelectedIngredients((prev) => prev.filter((x) => x.ingredient_id !== ingredient_id));
  const updateIngredientConc = (ingredient_id, val) => setSelectedIngredients((prev) => prev.map((x) => x.ingredient_id === ingredient_id ? { ...x, concentration: val } : x));

  // ── إدارة الشركات المنتجة ──
  const addManufacturer = async () => {
    if (!newMfrName.trim()) return;
    const { data, error } = await supabase.from("manufacturers").insert({ name: newMfrName.trim(), pharmacy_id: pharmacyId }).select().single();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setManufacturers((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewMfrName("");
    showToast("تمت إضافة الشركة ✓");
  };

  const deleteManufacturer = async (id) => {
    await supabase.from("manufacturers").delete().eq("id", id);
    setManufacturers((p) => p.filter((m) => m.id !== id));
    showToast("تم الحذف");
  };

  // ── حفظ ──
  const save = async () => {
    if (!form.nameAr || !form.price) { showToast("يرجى ملء الحقول المطلوبة", "error"); return; }
    const p = {
      id: form.id,
      name: form.nameAr, name_ar: form.nameAr, name_en: form.nameEn,
      barcode: barcodes.find((b) => b.is_primary)?.base_barcode || barcodes[0]?.base_barcode || "",
      category: form.mainCategory, main_category: form.mainCategory,
      sub_category1: form.subCategory1, sub_category2: form.subCategory2,
      package_type: form.packageType || null,
      sale_units: form.saleUnits ? +form.saleUnits : null,
      // السعر المدخل شامل الضريبة، نحفظ السعر قبل الضريبة
      price: form.taxable ? Math.round((+form.price / 1.15) * 100) / 100 : +form.price,
      cost: +form.cost,
      taxable: form.taxable,
      min_stock: +form.minStock, max_stock: +form.maxStock,
      active_ingredient: selectedIngredients[0]?.name_ar || "",
      concentration: selectedIngredients[0]?.concentration || "",
      is_essential: form.isEssential, is_chronic: form.isChronic,
      supply_category: form.supply_category,
      manufacturer_id: form.manufacturer_id || null,
      not_available_market: form.notAvailableMarket,
      shortage_report_url: form.shortageReportUrl || null,
    };

    let productId = form.id;

    if (editing) {
      const { error } = await supabase.from("products").update(p).eq("id", editing);
      if (error) { showToast("خطأ في التعديل: " + error.message, "error"); return; }
      setProducts((prev) => prev.map((x) => (x.id === editing ? { ...x, ...p } : x)));
    } else {
      const { data, error } = await supabase.from("products").insert({ ...p, pharmacy_id: pharmacyId }).select();
      if (error) { showToast("خطأ في الإضافة: " + error.message, "error"); return; }
      productId = data[0].id;
      setProducts((prev) => [...prev, data[0]]);
    }

    if (editing) await supabase.from("product_barcodes").delete().eq("product_id", productId);
    const validBarcodes = barcodes.filter((b) => b.base_barcode.trim());
    if (validBarcodes.length > 0) {
      await supabase.from("product_barcodes").insert(validBarcodes.map((b) => ({ ...b, product_id: productId, id: undefined, pharmacy_id: pharmacyId })));
    }

    if (editing) await supabase.from("product_ingredients").delete().eq("product_id", productId);
    if (selectedIngredients.length > 0) {
      await supabase.from("product_ingredients").insert(selectedIngredients.map((x) => ({ product_id: productId, ingredient_id: x.ingredient_id, concentration: x.concentration, pharmacy_id: pharmacyId })));
    }

    setShowForm(false);
    showToast(editing ? "تم تعديل الصنف" : "تمت إضافة الصنف ✓");
  };

  const currentCat = MAIN_CATEGORIES[form.mainCategory] || { sub1: [], sub2: [] };
  const filteredIngredients = allIngredients.filter((x) =>
    (x.name_ar || "").includes(ingredientSearch) || (x.name_en || "").toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  const inputStyle = { background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

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
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: C.success };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: C.accent };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: C.warning };
    return             { class: "very_slow", label: "بطيء جداً", color: C.danger };
  };

  const slowProducts = (products || [])
    .filter((p) => { const mv = getMovementClass(p.id); return (mv.class === "slow" || mv.class === "very_slow") && p.stock > 0; })
    .sort((a, b) => (b.cost || 0) - (a.cost || 0));

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>إدارة الأصناف</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon="settings" variant="secondary" onClick={() => setShowMfrModal(true)}>الشركات المنتجة</Btn>
          <Btn icon="plus" onClick={openAdd}>إضافة صنف</Btn>
        </div>
      </div>

      {/* ── Search ── */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم أو الباركود أو الفئة..."
        style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="إجمالي الأصناف" value={products.length} icon="inventory" color={C.accent} />
        <div onClick={() => setShowLowStock(true)} style={{ cursor: "pointer" }}>
          <StatCard label="مخزون منخفض" value={lowStockList.length} icon="alert" color={C.warning} />
        </div>
        <div onClick={() => setShowSlowProducts(true)} style={{ cursor: "pointer" }}>
          <StatCard label="أصناف بطيئة" value={slowProducts.length} icon="alert" color={C.danger} />
        </div>
        <StatCard label="أدوية أساسية" value={products.filter((p) => p.is_essential || p.isEssential).length} icon="pill" color={C.warning} />
        <StatCard label="قيمة المخزون" value={products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0).toFixed(0) + " ر.س"} icon="money" color="#a78bfa" />
      </div>

      {/* ── Table ── */}
      <Table
        headers={["رمز", "الصنف", "الشركة المنتجة", "الباركود", "الفئة", "سعر البيع", "التكلفة", "أساسي", "إجراءات"]}
        rows={filtered.map((p) => {
          const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
          return [
            <span style={{ color: C.muted, fontSize: 11 }}>{p.id}</span>,
            <div>
              <div style={{ fontWeight: 700, color: C.text }}>{p.nameAr || p.name}</div>
              {p.nameEn && <div style={{ fontSize: 11, color: C.muted }}>{p.nameEn}</div>}
              <div style={{ fontSize: 10, color: C.muted }}>{p.active_ingredient} {p.concentration}</div>
            </div>,
            mfr ? <Badge color={C.surface} text=C.accent>{mfr.name}</Badge> : <span style={{ color: C.muted, fontSize: 11 }}>—</span>,
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{p.barcode}</span>,
            <div>
              <Badge>{p.mainCategory || p.category}</Badge>
              {p.subCategory2 && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{p.subCategory1 && p.subCategory1 + " · "}{p.subCategory2}</div>}
            </div>,
            <span style={{ color: C.accent, fontWeight: 700 }}>{p.price} ر.س</span>,
            <span style={{ color: C.muted }}>{p.cost} ر.س</span>,
            (p.is_essential || p.isEssential) ? <Badge color={C.warningBg} text=C.warning>⭐ أساسي</Badge> : <span style={{ color: C.muted, fontSize: 11 }}>—</span>,
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(p.not_available_market) && (
                p.shortage_report_url
                  ? <a href={p.shortage_report_url} target="_blank" rel="noreferrer"><Badge color="#3a0a0a" text="#ff5566">🚫 غير متوفر</Badge></a>
                  : <Badge color="#3a0a0a" text="#ff5566">🚫 غير متوفر</Badge>
              )}
              <div style={{ display: "flex", gap: 5 }}>
              <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEdit(p)}>تعديل</Btn>
              <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                await supabase.from("products").delete().eq("id", p.id);
                setProducts((prev) => prev.filter((x) => x.id !== p.id));
                showToast("تم حذف الصنف");
              }}>حذف</Btn>
              </div>
            </div>,
          ];
        })}
      />

      {/* ── Modal المخزون المنخفض ── */}
      <Modal open={showLowStock} onClose={() => setShowLowStock(false)} title="⚠️ الأصناف ذات المخزون المنخفض">
        {lowStockList.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>لا توجد أصناف ناقصة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {lowStockList.map((p) => {
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : "#0d1a2e",
                  border: `1px solid ${isEss ? C.warning : C.border}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? C.warning : C.text, fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      المتاح: {p.stock ?? 0} / الحد الأدنى: {p.minStock || p.min_stock || 0}
                    </div>
                  </div>
                  <Btn size="sm" icon="edit" variant="secondary" onClick={() => { setShowLowStock(false); openEdit(p); }}>تعديل</Btn>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Modal الأصناف البطيئة ── */}
      <Modal open={showSlowProducts} onClose={() => setShowSlowProducts(false)} title="⚠️ أصناف بطيئة تحتاج تنشيط">
        {slowProducts.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>لا توجد أصناف بطيئة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {slowProducts.map((p) => {
              const mv = getMovementClass(p.id);
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : "#1a0a00",
                  border: `1px solid ${isEss ? C.warning : "#3a2000"}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? C.warning : C.text, fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
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

      {/* ── Modal إدارة الشركات ── */}
      <Modal open={showMfrModal} onClose={() => setShowMfrModal(false)} title="🏭 إدارة الشركات المنتجة">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newMfrName} onChange={(e) => setNewMfrName(e.target.value)}
            placeholder="اسم الشركة المنتجة..."
            onKeyDown={(e) => e.key === "Enter" && addManufacturer()}
            style={{ ...inputStyle, flex: 1 }} />
          <Btn icon="plus" onClick={addManufacturer}>إضافة</Btn>
        </div>
        {manufacturers.length === 0 ? (
          <div style={{ color: C.muted, textAlign: "center", padding: 20 }}>لا توجد شركات مضافة</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {manufacturers.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #0a101a" }}>
                <span style={{ color: C.text, fontSize: 13 }}>{m.name}</span>
                <Btn size="sm" variant="danger" onClick={() => deleteManufacturer(m.id)}>حذف</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Modal إضافة/تعديل ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "تعديل الصنف" : "إضافة صنف جديد"} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="رمز الصنف" value={form.id} onChange={(v) => F("id", v)} placeholder="P001" />
          <Input label="الاسم بالعربي *" value={form.nameAr} onChange={(v) => F("nameAr", v)} placeholder="باراسيتامول" />
          <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={(v) => F("nameEn", v)} placeholder="Paracetamol" />

          <Select label="الفئة الرئيسية" value={form.mainCategory} onChange={handleMainCategoryChange} options={Object.keys(MAIN_CATEGORIES)} />
          <Select label="فئة التوريد" value={form.supply_category} onChange={(v) => F("supply_category", v)} options={["", ...SUPPLY_CATEGORIES]} />
          {currentCat.sub1.length > 0 && <Select label="المصدر" value={form.subCategory1} onChange={(v) => F("subCategory1", v)} options={currentCat.sub1} />}
          {currentCat.sub2.length > 0 && <Select label="الشكل الصيدلاني" value={form.subCategory2} onChange={(v) => F("subCategory2", v)} options={currentCat.sub2} />}

          {/* ── الشركة المنتجة ── */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>🏭 الشركة المنتجة</div>
            <select value={form.manufacturer_id} onChange={(e) => F("manufacturer_id", e.target.value)} style={inputStyle}>
              <option value="">— اختر الشركة —</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              لا تجد الشركة؟ <span onClick={() => setShowMfrModal(true)} style={{ color: C.accent, cursor: "pointer", textDecoration: "underline" }}>أضفها من هنا</span>
            </div>
          </div>

          <Select label="نوع العبوة" value={form.packageType} onChange={(v) => F("packageType", v)} options={["", ...PACKAGE_TYPES]} />
          <Input label="عدد وحدات البيع" value={form.saleUnits} onChange={(v) => F("saleUnits", v)} type="number" placeholder="فارغ = بدون تقسيم" />
          <div style={{ fontSize: 11, color: C.muted, gridColumn: "1 / -1", marginTop: -6 }}>
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
              <div style={{ fontSize: 11, color: C.success, marginTop: 4, padding: "4px 8px", background: "#0a1a0a", borderRadius: 4 }}>
                قبل الضريبة: {(+form.price / 1.15).toFixed(2)} ر.س &nbsp;·&nbsp; الضريبة: {(+form.price - +form.price / 1.15).toFixed(2)} ر.س
              </div>
            )}
          </div>

          <Input label="سعر التكلفة" value={form.cost} onChange={(v) => F("cost", v)} type="number" placeholder="0.00" />
          <Input label="الحد الأدنى للمخزون" value={form.minStock} onChange={(v) => F("minStock", v)} type="number" placeholder="10" />
          <Input label="الحد الأقصى للمخزون" value={form.maxStock} onChange={(v) => F("maxStock", v)} type="number" placeholder="100" />

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>خاضع لضريبة القيمة المضافة 15%</label>
            <input type="checkbox" checked={form.taxable} onChange={(e) => F("taxable", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: C.warning, fontSize: 13, fontWeight: 600 }}>⭐ دواء أساسي</label>
            <input type="checkbox" checked={form.isEssential} onChange={(e) => F("isEssential", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#44aaff", fontSize: 13, fontWeight: 600 }}>🔄 دواء مزمن</label>
            <input type="checkbox" checked={form.isChronic} onChange={(e) => F("isChronic", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#ff5566", fontSize: 13, fontWeight: 600 }}>🚫 غير متوفر بالسوق السعودي</label>
            <input type="checkbox" checked={form.notAvailableMarket} onChange={(e) => F("notAvailableMarket", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          {form.notAvailableMarket && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Input label="رابط بلاغ عدم التوفر (منصة رصد مثلاً)" value={form.shortageReportUrl} onChange={(v) => F("shortageReportUrl", v)} placeholder="https://..." />
            </div>
          )}
        </div>

        {/* المواد الفعالة */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1d2d4a", paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: C.accent, marginBottom: 10, fontSize: 14 }}>🧪 المواد الفعالة</div>
          {selectedIngredients.map((ing) => (
            <div key={ing.ingredient_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 12px", color: C.text, fontSize: 13 }}>{ing.name_ar}</div>
              <input value={ing.concentration} onChange={(e) => updateIngredientConc(ing.ingredient_id, e.target.value)}
                placeholder="التركيز (مثال: 500mg)"
                style={{ width: 160, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
              <Btn size="sm" variant="danger" onClick={() => removeIngredient(ing.ingredient_id)}>✕</Btn>
            </div>
          ))}
          <div style={{ position: "relative", marginTop: 8 }}>
            <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setShowIngredientDropdown(true); }}
              onFocus={() => setShowIngredientDropdown(true)}
              placeholder="🔍 بحث عن مادة فعالة أو إضافة جديدة..."
              style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            {showIngredientDropdown && ingredientSearch && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {filteredIngredients.map((ing) => (
                  <div key={ing.id} onClick={() => addIngredient(ing)}
                    style={{ padding: "8px 12px", cursor: "pointer", color: C.text, fontSize: 13, borderBottom: "1px solid #1d2d4a" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.border}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    {ing.name_ar} {ing.name_en && <span style={{ color: C.muted, fontSize: 11 }}>({ing.name_en})</span>}
                  </div>
                ))}
                <div onClick={addNewIngredient}
                  style={{ padding: "8px 12px", cursor: "pointer", color: C.success, fontSize: 13, fontWeight: 600 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.border}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  ➕ إضافة "{ingredientSearch}" كمادة فعالة جديدة
                </div>
              </div>
            )}
          </div>
        </div>

        {/* الباركودات */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1d2d4a", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: C.accent, fontSize: 14 }}>📦 الباركودات</div>
            <Btn size="sm" icon="plus" onClick={addBarcode}>إضافة باركود</Btn>
          </div>
          {barcodes.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input value={b.base_barcode} onChange={(e) => updateBarcode(i, "base_barcode", e.target.value)} placeholder="باركود أساسي *"
                style={{ background: C.bgAlt, border: `1px solid ${b.is_primary ? C.accent : C.border}`, borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={b.batch_number} onChange={(e) => updateBarcode(i, "batch_number", e.target.value)} placeholder="رقم التشغيلة"
                style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={b.serial_number} onChange={(e) => updateBarcode(i, "serial_number", e.target.value)} placeholder="الرقم التسلسلي"
                style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={b.expiry_date} onChange={(e) => updateBarcode(i, "expiry_date", e.target.value)} type="date"
                style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }} />
              <button onClick={() => setBarcodes((prev) => prev.map((x, idx) => ({ ...x, is_primary: idx === i })))}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: b.is_primary ? "#1a3a6a" : C.border, color: b.is_primary ? C.accent : C.muted }}>
                {b.is_primary ? "⭐ رئيسي" : "رئيسي"}
              </button>
              {barcodes.length > 1 && <Btn size="sm" variant="danger" onClick={() => removeBarcode(i)}>✕</Btn>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={save}>{editing ? "حفظ التعديل" : "إضافة الصنف"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
