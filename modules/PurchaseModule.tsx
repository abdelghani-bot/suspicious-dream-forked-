export function PurchaseModule({
  products,
  setProducts,
  suppliers,
  purchases,
  setPurchases,
  showToast,
  pharmacyId,
}) {
  const { C } = useTheme();
  const [showNew, setShowNew] = useState(false);
  const [items, setItems] = useState([]);
  const [selSupplier, setSelSupplier] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualSubtotal, setManualSubtotal] = useState("");
  const [manualTax, setManualTax] = useState("");
  const [showProductCard, setShowProductCard] = useState(null);
  const searchRef = useRef(null);
  const [showDetail, setShowDetail] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editSupplier, setEditSupplier] = useState("");
  const [editManualSubtotal, setEditManualSubtotal] = useState("");
  const [editManualTax, setEditManualTax] = useState("");
  
  // ===== طباعة الباركود =====
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printItems, setPrintItems] = useState([]);
  const [pharmSettings, setPharmSettings] = useState({});
const LABEL_SIZES = [
  { id: "40x25", label: "40×25 mm", w: 40, h: 25 },
  { id: "50x30", label: "50×30 mm", w: 50, h: 30 },
  { id: "58x40", label: "58×40 mm", w: 58, h: 40 },
  { id: "60x40", label: "60×40 mm", w: 60, h: 40 },
];
  useEffect(() => {
    supabase.from("pharmacy_settings").select("*").eq("id", "main").single()
      .then(({ data }) => { if (data) setPharmSettings(data); });
  }, []);

  const printLabels = (invoiceItems) => {
    setPrintItems(invoiceItems.map((i) => ({ ...i, copies: i.qty + (i.bonusQty || 0), selected: true })));
    setShowPrintModal(true);
  };

  const doPrint = () => {
    const size = LABEL_SIZES.find((s) => s.id === (pharmSettings.label_size || "50x30")) || LABEL_SIZES[1];
    const labels = [];
    printItems.filter((item) => item.selected !== false).forEach((item) => {
      for (let c = 0; c < item.copies; c++) {
        labels.push(item);
      }
    });

    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملصقات الباركود</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .page { display: flex; flex-wrap: wrap; }
          .label {
            width: ${size.w}mm;
            height: ${size.h}mm;
            border: 0.5px solid #ccc;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .pharmacy { font-size: 7pt; font-weight: bold; text-align: center; }
          .phone { font-size: 6pt; text-align: center; color: #444; }
          .product { font-size: 7pt; font-weight: bold; text-align: center; margin: 1mm 0; }
          .details { display: flex; justify-content: space-between; font-size: 6pt; }
          svg { width: 100%; height: ${size.h * 0.35}mm; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding:10px; text-align:center;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        <div class="page">
          ${labels.map((item, idx) => `
            <div class="label">
              <div class="pharmacy">${pharmSettings.name_ar || ""}</div>
              <div class="phone">${pharmSettings.phone || ""}</div>
              <div class="product">${item.name}</div>
              <svg id="bc${idx}"></svg>
              <div class="details">
                <span>سعر: ${item.newSalePrice || item.salePrice || item.price} ر.س</span>
                <span>${item.expiry_date ? "صلاحية: " + item.expiry_date : ""}</span>
              </div>
            </div>
          `).join("")}
        </div>
        <script>
          window.onload = function() {
            ${labels.map((item, idx) => `
              try {
                JsBarcode("#bc${idx}", "${item.barcode || item.id}", {
                  format: "CODE128", width: 1.5, height: ${size.h * 3},
                  displayValue: true, fontSize: 8, margin: 0
                });
              } catch(e) {}
            `).join("")}
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
    setShowPrintModal(false);
  };
  // ===== نهاية طباعة الباركود =====

  const handleSearchChange = (val) => {
    setSearchText(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const results = products
      .filter(
        (p) =>
          (p.name||"").includes(val) ||
(p.barcode||"").includes(val) ||
(p.id||"").includes(val)
      )
      .slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  };

  const addItem = (p) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex)
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          ...p,
          qty: 1,
          bonusQty: 0,
          discount1: 0,
          discount2: 0,
          receivedCost: p.cost,
          newSalePrice: p.price,
          expiry_date: "",
        },
      ];
    });
    setSearchText("");
    setSearchResults([]);
    setShowDropdown(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) addItem(searchResults[0]);
      else if (searchText.trim()) {
        const p = products.find(
          (x) =>
            x.barcode === searchText ||
            x.id === searchText ||
            (x.name||"").includes(searchText)
        );
        if (p) addItem(p);
        else showToast("الصنف غير موجود", "error");
      }
    }
    if (e.key === "Escape") setShowDropdown(false);
  };

  const calcCostAfterDiscount = (basePrice, disc1, disc2) => {
    const afterDisc1 = basePrice * (1 - (disc1 || 0) / 100);
    const afterDisc2 = afterDisc1 * (1 - (disc2 || 0) / 100);
    return Math.round(afterDisc2 * 10000) / 10000;
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: value };

        if (field === "discount1") {
          updated.receivedCost = calcCostAfterDiscount(
            i.newSalePrice,
            value,
            i.discount2
          );
        } else if (field === "discount2") {
          updated.receivedCost = calcCostAfterDiscount(
            i.newSalePrice,
            i.discount1,
            value
          );
        }
        else if (field === "newSalePrice") {
          updated.receivedCost = calcCostAfterDiscount(
            value,
            i.discount1,
            i.discount2
          );
        }

        return updated;
      })
    );
  };

  const cols = [
    "qty",
    "discount1",
    "discount2",
    "receivedCost",
    "newSalePrice",
    "bonusQty",
    "expiry_date",
  ];

  const handleCellKeyDown = (e, rowIndex, colName) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const currentCol = cols.indexOf(colName);
    let nextCol = currentCol + 1;
    let nextRow = rowIndex;
    if (nextCol >= cols.length) {
      nextCol = 0;
      nextRow = rowIndex + 1;
      if (nextRow >= items.length) {
        searchRef.current?.focus();
        return;
      }
    }
    document.getElementById(`cell-${nextRow}-${cols[nextCol]}`)?.focus();
  };

  const cellStyle = {
    width: "100%",
    background: C.bgAlt,
    border: "1px solid #1d2d4a",
    borderRadius: 6,
    padding: "4px 8px",
    color: C.text,
    fontSize: 13,
    outline: "none",
  };

  const calcSubtotal = items.reduce((s, i) => s + i.receivedCost * i.qty, 0);
  const calcTax = items.reduce(
    (s, i) => (i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s),
    0
  );
  const subtotal = manualSubtotal !== "" ? +manualSubtotal : calcSubtotal;
  const taxAmt = manualTax !== "" ? +manualTax : calcTax;
  const total = subtotal + taxAmt;

  const savePurchase = async () => {
    if (!selSupplier || items.length === 0) {
      showToast("يرجى اختيار المورد وإضافة أصناف", "error");
      return;
    }
    const sup = suppliers.find((s) => s.id === selSupplier);
    const po = {
      id: "PO-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      supplier: selSupplier,
      supplierName: sup.name,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        bonusQty: i.bonusQty || 0,
        cost: i.receivedCost,
        discount1: i.discount1,
        discount2: i.discount2,
        salePrice: i.newSalePrice,
        taxable: i.taxable,
        expiry_date: i.expiry_date || null,
      })),
      subtotal,
      taxAmount: taxAmt,
      total,
      status: "مستلمة",
    };

    setPurchases((p) => [...p, po]);
    const { error } = await supabase.from("purchases").insert({
      id: po.id,
      date: po.date,
      supplier: po.supplier,
      supplier_name: po.supplierName,
      items: po.items,
      subtotal: po.subtotal,
      tax_amount: po.taxAmount,
      total: po.total,
      status: po.status,
      pharmacy_id: pharmacyId,
    });
    if (error) {
      showToast("فشل الحفظ في السيرفر: " + error.message, "error");
    }
    for (const ci of items) {
      const product = products.find((x) => x.id === ci.id);
      if (!product) continue;
      const newStock = product.stock + ci.qty + (ci.bonusQty || 0);
      await supabase
        .from("products")
        .update({
          stock: newStock,
          cost: ci.receivedCost,
          price: ci.newSalePrice,
          not_available_market: false,
        })
        .eq("id", ci.id);
    }
    setProducts((prev) =>
      prev.map((x) => {
        const ci = items.find((i) => i.id === x.id);
        if (!ci) return x;
        const newBatch = {
          qty: ci.qty + (ci.bonusQty || 0),
          cost: ci.receivedCost,
          salePrice: ci.newSalePrice,
          expiry_date: ci.expiry_date || null,
          date: new Date().toISOString().split("T")[0],
        };
        const existingBatches = x.batches?.length
          ? x.batches
          : x.stock > 0
          ? [{ qty: x.stock, cost: x.cost, salePrice: x.price, date: "قديم" }]
          : [];
        return {
          ...x,
          stock: x.stock + ci.qty + (ci.bonusQty || 0),
          cost: ci.receivedCost,
          price: ci.newSalePrice,
          batches: [...existingBatches, newBatch],
          not_available_market: false,
        };
      })
    );

    // ✅ نحتفظ بنسخة من الأصناف للطباعة قبل التصفير
    const itemsForPrint = items.map((i) => ({ ...i }));

    setItems([]);
    setSelSupplier("");
    setManualSubtotal("");
    setManualTax("");
    setShowNew(false);
    showToast("تم حفظ فاتورة الشراء ✓");

    // ✅ فتح نافذة طباعة الباركود بعد نجاح الحفظ
    printLabels(itemsForPrint);

    // ==================== رصد ====================
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = itemsForPrint.filter((i) => i.serial);
    if (rasdConfig.enabled && gs1Items.length > 0) {
      RasdService.sendTransaction(
        "receipt",
        gs1Items.map((i) => ({
          gtin: i.gtin || i.barcode,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.qty,
        })),
        rasdConfig.gln,
        null
      ).then((result) => {
        if (!result.success)
          showToast("تحذير: فشل إرسال بيانات الشراء لرصد", "error");
      });
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          فواتير الشراء
        </h2>
        <Btn icon="plus" onClick={() => setShowNew(true)}>
          فاتورة شراء جديدة
        </Btn>
      </div>

      <Table
        headers={[
          "رقم الفاتورة",
          "التاريخ",
          "المورد",
          "قبل الضريبة",
          "الضريبة",
          "الإجمالي",
          "الحالة",
        ]}
        rows={purchases.map((p) => [
          <span
            style={{ color: C.accent, fontWeight: 700, cursor: "pointer" }}
            onClick={() => {
              setShowDetail(p);
              setEditItems(
                p.items.map((i) => ({
                  ...i,
                  receivedCost: i.cost,
                  newSalePrice: i.salePrice,
                  discount1: i.discount1 || 0,
                  discount2: i.discount2 || 0,
                  bonusQty: i.bonusQty || 0,
                  expiry_date: i.expiry_date || "",
                }))
              );
              setEditSupplier(p.supplier);
              setEditManualSubtotal("");
              setEditManualTax("");
            }}
          >
            {p.id}
          </span>,
          p.date,
          p.supplierName || p.supplier_name,
          (p.subtotal || 0).toFixed(2) + " ر.س",
          (p.taxAmount ?? p.tax_amount ?? 0).toFixed(2) + " ر.س",
          <span style={{ color: C.success, fontWeight: 700 }}>
            {(p.total || 0).toFixed(2)} ر.س
          </span>,
          <Badge color="#0a2a10" text=C.success>
            {p.status}
          </Badge>,
        ])}
      />

      <Modal
        open={showNew}
        onClose={() => {
          setShowNew(false);
          setItems([]);
          setManualSubtotal("");
          setManualTax("");
        }}
        title="فاتورة شراء جديدة"
        wide
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Select
            label="المورد"
            value={selSupplier}
            onChange={setSelSupplier}
            options={[
              { v: "", l: "اختر المورد" },
              ...suppliers.map((s) => ({
                v: s.id,
                l: `${s.name} — ${s.taxId}`,
              })),
            ]}
          />
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            ref={searchRef}
            placeholder="🔍 ابحث بالاسم أو الباركود أو امسح الباركود..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{
              width: "100%",
              background: C.bgAlt,
              border: "1px solid #2a5a9a",
              borderRadius: 8,
              padding: "10px 14px",
              color: C.text,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                left: 0,
                background: "#0d1829",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                zIndex: 100,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onMouseDown={() => addItem(p)}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    color: C.text,
                    fontSize: 13,
                    borderBottom: "1px solid #111a2a",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#152238")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span>{p.name}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {p.barcode} | مخزون: {p.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 4, overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
          >
            <thead>
              <tr style={{ background: C.bgAlt }}>
                {[
                  "الصنف",
                  "الكمية",
                  "خ.أساسي%",
                  "خ.إضافي%",
                  "تكلفة الوحدة",
                  "سعر البيع",
                  "بونص",
                  "الصلاحية",
                  "ضريبة",
                  "الإجمالي",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 8px",
                      textAlign: "right",
                      color: C.muted,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIndex) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                  <td
                    style={{
                      padding: "6px 8px",
                      fontSize: 13,
                      color: C.text,
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {item.name}
                      <button
                        onClick={() => setShowProductCard(item)}
                        title="عرض بيانات الصنف"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#3a6aaa",
                          cursor: "pointer",
                          padding: 2,
                          lineHeight: 1,
                        }}
                      >
                        <IC n="eye" s={13} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-qty`}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(item.id, "qty", +e.target.value)
                      }
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "qty")}
                      style={{ ...cellStyle, width: 55 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-discount1`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount1}
                      onChange={(e) =>
                        updateItem(item.id, "discount1", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "discount1")
                      }
                      style={{ ...cellStyle, width: 60 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-discount2`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount2}
                      onChange={(e) =>
                        updateItem(item.id, "discount2", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "discount2")
                      }
                      style={{ ...cellStyle, width: 60 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-receivedCost`}
                      type="number"
                      min="0"
                      step="0.0001"
                      value={+item.receivedCost.toFixed(4)}
                      onChange={(e) =>
                        updateItem(item.id, "receivedCost", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "receivedCost")
                      }
                      style={{ ...cellStyle, width: 85 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-newSalePrice`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.newSalePrice}
                      onChange={(e) =>
                        updateItem(item.id, "newSalePrice", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "newSalePrice")
                      }
                      style={{
                        ...cellStyle,
                        width: 85,
                        borderColor:
                          item.newSalePrice !== item.price
                            ? "#f0a030"
                            : C.border,
                        color:
                          item.newSalePrice !== item.price
                            ? "#f0c060"
                            : C.text,
                      }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-bonusQty`}
                      type="number"
                      min="0"
                      value={item.bonusQty}
                      onChange={(e) =>
                        updateItem(item.id, "bonusQty", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "bonusQty")
                      }
                      style={{ ...cellStyle, width: 55 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-expiry_date`}
                      type="month"
                      value={item.expiry_date || ""}
                      onChange={(e) =>
                        updateItem(item.id, "expiry_date", e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "expiry_date")
                      }
                      style={{ ...cellStyle, width: 125 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <Badge
                      color={item.taxable ? "#0a2a00" : "#1a1a2a"}
                      text={item.taxable ? C.success : C.muted}
                    >
                      {item.taxable ? "15%" : "معفى"}
                    </Badge>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: C.accent,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(
                      item.receivedCost *
                      item.qty *
                      (item.taxable ? 1 + TAX_RATE : 1)
                    ).toFixed(2)}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      onClick={() =>
                        setItems((p) => p.filter((i) => i.id !== item.id))
                      }
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.dangerBorder,
                        cursor: "pointer",
                      }}
                    >
                      <IC n="trash" s={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div
            style={{
              background: C.bgAlt,
              borderRadius: 10,
              padding: 14,
              marginTop: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: C.muted,
                marginBottom: 8,
              }}
            >
              <span>المجموع قبل الضريبة</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>
                  (محسوب: {calcSubtotal.toFixed(2)})
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={calcSubtotal.toFixed(2)}
                  value={manualSubtotal}
                  onChange={(e) => setManualSubtotal(e.target.value)}
                  style={{
                    width: 110,
                    background: C.divider,
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: C.text,
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: C.muted }}>ر.س</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: C.success,
                marginBottom: 8,
              }}
            >
              <span>ضريبة القيمة المضافة 15%</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>
                  (محسوب: {calcTax.toFixed(2)})
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={calcTax.toFixed(2)}
                  value={manualTax}
                  onChange={(e) => setManualTax(e.target.value)}
                  style={{
                    width: 110,
                    background: C.divider,
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: C.text,
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: C.success }}>ر.س</span>
              </div>
            </div>
            {(manualSubtotal !== "" || manualTax !== "") && (
              <button
                onClick={() => {
                  setManualSubtotal("");
                  setManualTax("");
                }}
                style={{
                  fontSize: 11,
                  color: C.muted,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                ↺ إعادة الحساب التلقائي
              </button>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: C.text,
                fontWeight: 800,
                fontSize: 16,
                borderTop: "1px solid #1d2d4a",
                paddingTop: 8,
              }}
            >
              <span>الإجمالي</span>
              <span>{total.toFixed(2)} ر.س</span>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <Btn
            variant="ghost"
            onClick={() => {
              setShowNew(false);
              setItems([]);
              setManualSubtotal("");
              setManualTax("");
            }}
          >
            إلغاء
          </Btn>
          <Btn icon="check" onClick={savePurchase}>
            حفظ الفاتورة
          </Btn>
        </div>
      </Modal>

      {showProductCard && (
        <Modal
          open
          title={`بيانات الصنف: ${showProductCard.name}`}
          onClose={() => setShowProductCard(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["الرمز", showProductCard.id],
              ["الباركود", showProductCard.barcode],
              ["الفئة", showProductCard.category],
              ["المادة الفعالة", showProductCard.activeIngredient],
              ["التركيز", showProductCard.concentration],
              ["المخزون الحالي", showProductCard.stock],
              ["سعر البيع الحالي", showProductCard.price + " ر.س"],
              ["التكلفة الحالية", showProductCard.cost + " ر.س"],
              ["الحد الأدنى", showProductCard.minStock],
              ["خاضع للضريبة", showProductCard.taxable ? "نعم 15%" : "معفى"],
            ].map(
              ([label, val]) =>
                val && (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #1a2a3a",
                    }}
                  >
                    <span style={{ color: C.muted, fontSize: 13 }}>
                      {label}
                    </span>
                    <span
                      style={{
                        color: C.text,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {val}
                    </span>
                  </div>
                )
            )}
          </div>
        </Modal>
      )}

      {/* ✅ Modal طباعة ملصقات الباركود */}
      {showPrintModal && (
        <Modal
          open
          title="طباعة ملصقات الباركود"
          onClose={() => setShowPrintModal(false)}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10, padding: "6px 10px", background: C.divider, borderRadius: 8,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={printItems.length > 0 && printItems.every((i) => i.selected !== false)}
                onChange={(e) =>
                  setPrintItems((prev) => prev.map((i) => ({ ...i, selected: e.target.checked })))
                }
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>تحديد الكل</span>
            </label>
            <span style={{ color: C.muted, fontSize: 12 }}>
              {printItems.filter((i) => i.selected !== false).length} / {printItems.length} محدد
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {printItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  background: C.bgAlt,
                  borderRadius: 8,
                  border: "1px solid #1d2d4a",
                  opacity: item.selected === false ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={item.selected !== false}
                    onChange={(e) =>
                      setPrintItems((prev) =>
                        prev.map((i, pi) =>
                          pi === idx ? { ...i, selected: e.target.checked } : i
                        )
                      )
                    }
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ color: C.text, fontSize: 13 }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>عدد النسخ</span>
                  <input
                    type="number"
                    min="0"
                    value={item.copies}
                    onChange={(e) =>
                      setPrintItems((prev) =>
                        prev.map((i, pi) =>
                          pi === idx ? { ...i, copies: +e.target.value } : i
                        )
                      )
                    }
                    style={{
                      width: 60,
                      background: C.divider,
                      border: "1px solid #1d3a6a",
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: C.text,
                      fontSize: 13,
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={() => setPrintItems((prev) => prev.filter((_, pi) => pi !== idx))}
                    title="حذف الصنف من القائمة"
                    style={{
                      width: 26, height: 26, borderRadius: 6, border: "1px solid #4a1a1a",
                      background: C.dangerBg, color: "#ff5566", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {printItems.length === 0 && (
              <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 13 }}>
                لا توجد أصناف في القائمة
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              justifyContent: "flex-end",
            }}
          >
            <Btn variant="ghost" onClick={() => setShowPrintModal(false)}>
              إلغاء
            </Btn>
            <Btn
              icon="printer"
              onClick={doPrint}
              disabled={printItems.filter((i) => i.selected !== false).length === 0}
            >
              طباعة ({printItems.filter((i) => i.selected !== false).length})
            </Btn>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal
          open
          title={`تفاصيل الفاتورة: ${showDetail.id}`}
          onClose={() => setShowDetail(null)}
          wide
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Select
              label="المورد"
              value={editSupplier}
              onChange={setEditSupplier}
              options={[
                { v: "", l: "اختر المورد" },
                ...suppliers.map((s) => ({
                  v: s.id,
                  l: `${s.name} — ${s.taxId}`,
                })),
              ]}
            />
            <div
              style={{
                color: C.muted,
                fontSize: 12,
                alignSelf: "flex-end",
                paddingBottom: 8,
              }}
            >
              التاريخ: {showDetail.date}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
              }}
            >
              <thead>
                <tr style={{ background: C.bgAlt }}>
                  {[
                    "الصنف",
                    "الكمية",
                    "خ.أساسي%",
                    "خ.إضافي%",
                    "تكلفة الوحدة",
                    "سعر البيع",
                    "بونص",
                    "الصلاحية",
                    "الإجمالي",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "9px 8px",
                        textAlign: "right",
                        color: C.muted,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editItems.map((item, rowIndex) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #0a101a" }}
                  >
                    <td
                      style={{
                        padding: "6px 8px",
                        fontSize: 13,
                        color: C.text,
                        minWidth: 120,
                      }}
                    >
                      {item.name}
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, qty: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 55,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount1}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    discount1: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      i.newSalePrice,
                                      +e.target.value,
                                      i.discount2
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 60,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount2}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    discount2: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      i.newSalePrice,
                                      i.discount1,
                                      +e.target.value
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 60,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={+item.receivedCost.toFixed(4)}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, receivedCost: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 85,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.newSalePrice}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    newSalePrice: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      +e.target.value,
                                      i.discount1,
                                      i.discount2
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 85,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        value={item.bonusQty}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, bonusQty: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 55,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="month"
                        value={item.expiry_date || ""}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, expiry_date: e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 125,
                          background: C.bgAlt,
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: C.text,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        color: C.accent,
                        fontWeight: 700,
                      }}
                    >
                      {(
                        item.receivedCost *
                        item.qty *
                        (item.taxable ? 1 + TAX_RATE : 1)
                      ).toFixed(2)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button
                        onClick={() =>
                          setEditItems((prev) =>
                            prev.filter((i) => i.id !== item.id)
                          )
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: C.dangerBorder,
                          cursor: "pointer",
                        }}
                      >
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              background: C.bgAlt,
              borderRadius: 10,
              padding: 14,
              marginTop: 14,
            }}
          >
            {(() => {
              const editCalcSubtotal = editItems.reduce(
                (s, i) => s + i.receivedCost * i.qty,
                0
              );
              const editCalcTax = editItems.reduce(
                (s, i) =>
                  i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                0
              );
              const editSubtotal =
                editManualSubtotal !== ""
                  ? +editManualSubtotal
                  : editCalcSubtotal;
              const editTaxAmt =
                editManualTax !== "" ? +editManualTax : editCalcTax;
              const editTotal = editSubtotal + editTaxAmt;
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: C.muted,
                      marginBottom: 8,
                    }}
                  >
                    <span>قبل الضريبة</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={editCalcSubtotal.toFixed(2)}
                      value={editManualSubtotal}
                      onChange={(e) => setEditManualSubtotal(e.target.value)}
                      style={{
                        width: 110,
                        background: C.divider,
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: C.text,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: C.success,
                      marginBottom: 8,
                    }}
                  >
                    <span>ضريبة 15%</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={editCalcTax.toFixed(2)}
                      value={editManualTax}
                      onChange={(e) => setEditManualTax(e.target.value)}
                      style={{
                        width: 110,
                        background: C.divider,
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: C.text,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: C.text,
                      fontWeight: 800,
                      fontSize: 16,
                      borderTop: "1px solid #1d2d4a",
                      paddingTop: 8,
                    }}
                  >
                    <span>الإجمالي</span>
                    <span>{editTotal.toFixed(2)} ر.س</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              justifyContent: "flex-end",
            }}
          >
            <Btn variant="ghost" onClick={() => setShowDetail(null)}>
  إلغاء
</Btn>
            <Btn variant="secondary" onClick={() => printLabels(
  editItems.map((i) => ({ ...i, newSalePrice: i.salePrice || i.newSalePrice }))
)}>
  🖨️ طباعة ملصقات
</Btn>
            <Btn
              icon="check"
              onClick={async () => {
                const editCalcSubtotal = editItems.reduce(
                  (s, i) => s + i.receivedCost * i.qty,
                  0
                );
                const editCalcTax = editItems.reduce(
                  (s, i) =>
                    i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                  0
                );
                const editSubtotal =
                  editManualSubtotal !== ""
                    ? +editManualSubtotal
                    : editCalcSubtotal;
                const editTaxAmt =
                  editManualTax !== "" ? +editManualTax : editCalcTax;
                const sup = suppliers.find((s) => s.id === editSupplier);
                const updated = {
                  ...showDetail,
                  supplier: editSupplier,
                  supplier_name: sup?.name || showDetail.supplier_name,
                  items: editItems.map((i) => ({
                    id: i.id,
                    name: i.name,
                    qty: i.qty,
                    bonusQty: i.bonusQty || 0,
                    cost: i.receivedCost,
                    discount1: i.discount1,
                    discount2: i.discount2,
                    salePrice: i.newSalePrice,
                    taxable: i.taxable,
                    expiry_date: i.expiry_date || null,
                  })),
                  subtotal: editSubtotal,
                  taxAmount: editTaxAmt,
                  total: editSubtotal + editTaxAmt,
                };
                const { error } = await supabase
                  .from("purchases")
                  .update({
                    supplier: editSupplier,
                    supplier_name:
                      sup?.name ||
                      showDetail.supplier_name ||
                      showDetail.supplierName,
                    items: updated.items,
                    subtotal: editSubtotal,
                    tax_amount: editTaxAmt,
                    total: editSubtotal + editTaxAmt,
                  })
                  .eq("id", showDetail.id);
                if (error) {
                  showToast("فشل التعديل: " + error.message, "error");
                  return;
                }
                setPurchases((prev) =>
                  prev.map((p) => (p.id === showDetail.id ? updated : p))
                );
                setShowDetail(null);
                showToast("تم التعديل ✓");
              }}
            >
              حفظ التعديل
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
