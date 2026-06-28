export function Reports({
  sales, purchases, products, suppliers, customers, returns = [], manufacturers = [] }) {
  const { C } = useTheme();
  const [type, setType] = useState("sales");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [search, setSearch] = useState("");
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(null);
  const [showPrint, setShowPrint] = useState(null);

  // helper: منتجات الشركة المنتجة المختارة
  const mfrProductIds = filterManufacturer
    ? new Set(products.filter((p) => p.manufacturer_id === filterManufacturer).map((p) => p.id))
    : null;

  const filteredSales = sales.filter((s) => {
    const d = s.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterProduct && !s.items.some((i) => i.id === filterProduct)) ok = false;
    if (mfrProductIds && !s.items.some((i) => mfrProductIds.has(i.id))) ok = false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inId = (s.id || "").toLowerCase().includes(q);
      const inCustomer = (s.customer_name || "").toLowerCase().includes(q);
      const inItems = (s.items || []).some((i) => (i.name || "").toLowerCase().includes(q));
      if (!inId && !inCustomer && !inItems) ok = false;
    }
    return ok;
  });

  const filteredPurchases = purchases.filter((p) => {
    const d = p.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterSupplier && p.supplier !== filterSupplier) ok = false;
    if (mfrProductIds && !(p.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    return ok;
  });

  const filteredReturns = (returns || []).filter((r) => {
    const d = r.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (mfrProductIds && !(r.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    return ok;
  });

  // احصائيات شهرية
  const salesByMonth = {};
  filteredSales.forEach((s) => {
    const m = (s.date || s.created_at || "").substring(0, 7);
    if (!m) return;
    if (!salesByMonth[m]) salesByMonth[m] = { count: 0, subtotal: 0, tax: 0, total: 0 };
    salesByMonth[m].count++;
    salesByMonth[m].subtotal += s.subtotal || 0;
    salesByMonth[m].tax += s.taxAmount ?? s.tax_amount ?? 0;
    salesByMonth[m].total += s.total || 0;
  });

  // تقرير الأصناف — مع فلتر الشركة
  const productSales = {};
  filteredSales.forEach((s) =>
    s.items.forEach((i) => {
      if (mfrProductIds && !mfrProductIds.has(i.id)) return;
      if (!productSales[i.id]) productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
      productSales[i.id].qty += i.qty;
      productSales[i.id].revenue += i.price * i.qty;
      productSales[i.id].tax += i.taxable ? i.price * i.qty * TAX_RATE : 0;
    })
  );

  const totalSalesRev = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + s.total, 0);
  const totalSalesTax = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + (s.taxAmount || s.tax_amount || 0), 0);
  const returnedCount = filteredSales.filter((s) => s.returned).length;
  const totalPurchase = filteredPurchases.reduce((a, p) => a + p.total, 0);
  const totalPurchaseTax = filteredPurchases.reduce((a, p) => a + p.taxAmount, 0);

  const returnsSales = filteredReturns.filter((r) => r.type === "sales");
  const returnsPurchases = filteredReturns.filter((r) => r.type === "purchases");
  const totalReturnsSales = returnsSales.reduce((a, r) => a + (r.total || 0), 0);
  const totalReturnsPurchases = returnsPurchases.reduce((a, r) => a + (r.total || 0), 0);
  const totalReturnsTax = filteredReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const isAutoReturn = (r) => (r.reason || "").includes("تلقائي");

  // فلتر الشركة يظهر في: product, purchase, returns
  const showMfrFilter = ["product", "purchase", "returns"].includes(type);

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>التقارير والإحصائيات</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        {["sales", "purchase", "product", "monthly", "returns"].map((t) => (
          <button key={t} onClick={() => setType(t)} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid",
            borderColor: type === t ? C.accent : C.border,
            background: type === t ? C.infoBg : "transparent",
            color: type === t ? C.accent : C.muted,
            fontWeight: type === t ? 700 : 400, cursor: "pointer", fontSize: 13,
          }}>
            {t === "sales" ? "تقرير المبيعات" : t === "purchase" ? "تقرير المشتريات" : t === "product" ? "تقرير الأصناف" : t === "monthly" ? "تقرير شهري" : "تقرير المرتجعات"}
          </button>
        ))}

        <div style={{ marginRight: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {type === "sales" && (
            <Input label="بحث" value={search} onChange={setSearch} placeholder="رقم الفاتورة، العميل، أو اسم الصنف" style={{ width: 220 }} />
          )}
          <Input label="من" value={fromDate} onChange={setFromDate} type="date" style={{ width: 140 }} />
          <Input label="إلى" value={toDate} onChange={setToDate} type="date" style={{ width: 140 }} />

          {type === "purchase" && (
            <Select label="المورد" value={filterSupplier} onChange={setFilterSupplier}
              options={[{ v: "", l: "الكل" }, ...suppliers.map((s) => ({ v: s.id, l: s.name }))]}
              style={{ width: 160 }} />
          )}
          {type === "product" && (
            <Select label="الصنف" value={filterProduct} onChange={setFilterProduct}
              options={[{ v: "", l: "الكل" }, ...products.map((p) => ({ v: p.id, l: p.name }))]}
              style={{ width: 180 }} />
          )}
          {showMfrFilter && manufacturers.length > 0 && (
            <Select label="🏭 الشركة المنتجة" value={filterManufacturer} onChange={setFilterManufacturer}
              options={[{ v: "", l: "الكل" }, ...manufacturers.map((m) => ({ v: m.id, l: m.name }))]}
              style={{ width: 180 }} />
          )}
        </div>
      </div>

      {/* تقرير المبيعات */}
      {type === "sales" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المبيعات (شامل الضريبة)" value={totalSalesRev.toFixed(2) + " ر.س"} icon="money" color={C.accent} />
            <StatCard label="ضريبة المبيعات" value={totalSalesTax.toFixed(2) + " ر.س"} icon="tax" color={C.success} />
            <StatCard label="عدد الفواتير" value={filteredSales.filter((s) => !s.returned).length} icon="pos" color="#a78bfa" />
            <StatCard label="المرتجعات" value={returnedCount} icon="returns" color={C.warning} />
          </div>
          <Table
            headers={["رقم الفاتورة", "التاريخ", "العميل", "المجموع", "الضريبة", "الإجمالي شامل الضريبة", "الدفع", "حالة"]}
            rows={filteredSales.map((s) => [
              <span onClick={() => setShowInvoiceDetail(s)} style={{ color: C.accent, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{s.id}</span>,
              s.date,
              s.customer_name || "زبون عادي",
              (s.subtotal || 0).toFixed(2) + " ر.س",
              <span style={{ color: C.success }}>{(s.taxAmount || s.tax_amount || 0).toFixed(2)} ر.س</span>,
              <span style={{ color: C.accent, fontWeight: 700 }}>{(s.total || 0).toFixed(2)} ر.س</span>,
              s.payment,
              s.returned
                ? <Badge color="#3a0a0a" text={C.danger}>مرتجعة</Badge>
                : <Badge color="#0a2a10" text={C.success}>مكتملة</Badge>,
            ])}
          />
          {filteredSales.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 30 }}>لا توجد فواتير مطابقة للبحث</div>}
        </>
      )}

      {/* تقرير المشتريات */}
      {type === "purchase" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المشتريات (شامل الضريبة)" value={totalPurchase.toFixed(2) + " ر.س"} icon="purchase" color="#fb923c" />
            <StatCard label="ضريبة المشتريات" value={totalPurchaseTax.toFixed(2) + " ر.س"} icon="tax" color={C.success} />
            <StatCard label="عدد أوامر الشراء" value={filteredPurchases.length} icon="suppliers" color="#a78bfa" />
          </div>
          <Table
            headers={["رقم الأمر", "التاريخ", "المورد", "المجموع", "الضريبة", "الإجمالي", "الحالة"]}
            rows={filteredPurchases.map((p) => [
              <span style={{ color: C.accent, fontWeight: 700 }}>{p.id}</span>,
              p.date, p.supplierName,
              p.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: C.success }}>{p.taxAmount.toFixed(2)} ر.س</span>,
              <span style={{ color: "#fb923c", fontWeight: 700 }}>{p.total.toFixed(2)} ر.س</span>,
              <Badge color="#0a2a10" text={C.success}>{p.status}</Badge>,
            ])}
          />
        </>
      )}

      {/* تقرير الأصناف */}
      {type === "product" && (
        <>
          {filterManufacturer && (
            <div style={{ background: C.surface, border: "1px solid #1d3a6a", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: C.accent }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          <Table
            headers={["الصنف", "الشركة المنتجة", "الكمية المباعة", "الإيراد قبل الضريبة", "الضريبة", "الإيراد الكلي"]}
            rows={Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, d]) => {
              const prod = products.find((p) => p.id === id);
              const mfr = manufacturers.find((m) => m.id === prod?.manufacturer_id);
              return [
                <span style={{ fontWeight: 700, color: C.text }}>{d.name}</span>,
                mfr ? <Badge color={C.surface} text={C.accent}>{mfr.name}</Badge> : <span style={{ color: C.muted, fontSize: 11 }}>—</span>,
                <span style={{ color: C.accent, fontWeight: 700 }}>{d.qty}</span>,
                d.revenue.toFixed(2) + " ر.س",
                <span style={{ color: C.success }}>{d.tax.toFixed(2)} ر.س</span>,
                <span style={{ color: C.success, fontWeight: 700 }}>{(d.revenue + d.tax).toFixed(2)} ر.س</span>,
              ];
            })}
          />
        </>
      )}

      {/* تقرير شهري */}
      {type === "monthly" && (
        <Table
          headers={["الشهر", "عدد الفواتير", "المبيعات قبل الضريبة", "ضريبة المبيعات", "المبيعات الكلية"]}
          rows={Object.entries(salesByMonth).sort().reverse().map(([m, d]) => [
            <span style={{ fontWeight: 700, color: C.text }}>{m}</span>,
            d.count,
            d.subtotal.toFixed(2) + " ر.س",
            <span style={{ color: C.success }}>{d.tax.toFixed(2)} ر.س</span>,
            <span style={{ color: C.accent, fontWeight: 700 }}>{d.total.toFixed(2)} ر.س</span>,
          ])}
        />
      )}

      {/* تقرير المرتجعات */}
      {type === "returns" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="عدد المرتجعات" value={filteredReturns.length} icon="returns" color={C.warning} />
            <StatCard label="مرتجعات المبيعات" value={totalReturnsSales.toFixed(2) + " ر.س"} icon="pos" color={C.accent} />
            <StatCard label="مرتجعات المشتريات" value={totalReturnsPurchases.toFixed(2) + " ر.س"} icon="purchase" color="#fb923c" />
            <StatCard label="الضريبة المستردة" value={totalReturnsTax.toFixed(2) + " ر.س"} icon="tax" color={C.success} />
          </div>
          <Table
            headers={["رقم المرتجع", "التاريخ", "النوع", "العميل / المورد", "السبب", "الإجمالي"]}
            rows={filteredReturns.sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => [
              <span style={{ color: C.accent, fontWeight: 700 }}>{r.id}</span>,
              r.date,
              r.type === "sales"
                ? <Badge color="#0a2040" text={C.accent}>مرتجع مبيعات</Badge>
                : <Badge color="#1a1000" text="#fb923c">مرتجع مشتريات</Badge>,
              r.type === "sales" ? (r.customer_name || "زبون عادي") : (r.supplier_name || "—"),
              <span>{r.reason || "—"}{isAutoReturn(r) && <span style={{ marginRight: 6 }}><Badge color="#1a0a00" text={C.warning}>تلقائي</Badge></span>}</span>,
              <span style={{ color: C.warning, fontWeight: 700 }}>{(r.total || 0).toFixed(2)} ر.س</span>,
            ])}
          />
          {filteredReturns.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 30 }}>لا توجد مرتجعات في هذه الفترة</div>}
        </>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {showInvoiceDetail && (
        <Modal open title={`تفاصيل الفاتورة — ${showInvoiceDetail.id}`} onClose={() => setShowInvoiceDetail(null)} wide>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13, color: C.muted }}>
            <span>التاريخ: <span style={{ color: C.text }}>{showInvoiceDetail.date}</span></span>
            <span>العميل: <span style={{ color: C.text }}>{showInvoiceDetail.customer_name || "زبون عادي"}</span></span>
            <span>طريقة الدفع: <span style={{ color: C.text }}>{showInvoiceDetail.payment}</span></span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgAlt }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: C.muted, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showInvoiceDetail.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: C.text, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 13, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 13, textAlign: "center" }}>{item.price}</td>
                    <td style={{ padding: "8px 10px", color: C.text, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: C.bgAlt, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, marginBottom: 5 }}>
              <span>قبل الضريبة</span><span>{(showInvoiceDetail.subtotal || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.success, marginBottom: 5 }}>
              <span>الضريبة</span><span>{(showInvoiceDetail.taxAmount || showInvoiceDetail.tax_amount || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800, fontSize: 16, borderTop: "1px solid #1d2d4a", paddingTop: 8 }}>
              <span>الإجمالي</span><span>{(showInvoiceDetail.total || 0).toFixed(2)} ر.س</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowInvoiceDetail(null)}>إغلاق</Btn>
            <Btn icon="print" onClick={() => setShowPrint(showInvoiceDetail)}>إعادة الطباعة</Btn>
          </div>
        </Modal>
      )}
      {showPrint && <PrintReceipt invoice={showPrint} onClose={() => setShowPrint(null)} />}
    </div>
  );
}
// ==================== SHIFT MODULE ====================
