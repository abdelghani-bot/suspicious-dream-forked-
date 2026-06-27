export function TaxReport({
  const { C } = useTheme(); sales, purchases, returns = [] }) {
  const [quarter, setQuarter] = useState("Q2-2026");
  const quarters = ["Q1-2026","Q2-2026","Q3-2026","Q4-2026","Q1-2025","Q2-2025"];
  const qMap = { Q1: "01,02,03", Q2: "04,05,06", Q3: "07,08,09", Q4: "10,11,12" };
  const [q, year] = quarter.split("-");
  const months = qMap[q].split(",").map((m) => `${year}-${m}`);
  const filtSales = sales.filter((s) => months.some((m) => s.date.startsWith(m)) && !s.returned);
  const filtPurchases = purchases.filter((p) => months.some((m) => p.date.startsWith(m)));
  const filtReturns = (returns || []).filter((r) => months.some((m) => (r.date || "").startsWith(m)));
  const filtSalesReturns = filtReturns.filter((r) => r.type === "sales");
  const filtPurchaseReturns = filtReturns.filter((r) => r.type === "purchases");
  const salesSubtotal = filtSales.reduce((a, s) => a + (s.subtotal || 0), 0);
  const salesTax = filtSales.reduce((a, s) => a + (s.tax_amount || 0), 0);
  const salesTotal = filtSales.reduce((a, s) => a + (s.total || 0), 0);
  const purchSubtotal = filtPurchases.reduce((a, p) => a + (p.subtotal || 0), 0);
  const purchTax = filtPurchases.reduce((a, p) => a + (p.tax_amount || 0), 0);
  const purchTotal = filtPurchases.reduce((a, p) => a + (p.total || 0), 0);
  const salesReturnsSubtotal = filtSalesReturns.reduce((a, r) => a + (r.subtotal || 0), 0);
  const salesReturnsTax = filtSalesReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const purchReturnsSubtotal = filtPurchaseReturns.reduce((a, r) => a + (r.subtotal || 0), 0);
  const purchReturnsTax = filtPurchaseReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const netSalesTax = salesTax - salesReturnsTax;
  const netPurchTax = purchTax - purchReturnsTax;
  const netTax = netSalesTax - netPurchTax;
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>تقرير ضريبة القيمة المضافة — ربع سنوي</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, alignItems: "center" }}>
        <Select label="الربع السنوي" value={quarter} onChange={setQuarter}
          options={quarters.map((q) => ({ v: q, l: `الربع ${q}` }))} style={{ width: 200 }} />
        <div style={{ color: C.muted, fontSize: 13, marginTop: 20 }}>نسبة الضريبة: 15% (VAT)</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: C.surface, border: "1px solid #1a3a1a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.success, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="pos" s={16} /> ضريبة المبيعات (الضريبة المحصلة)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.muted }}>
              <span>إجمالي المبيعات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{salesSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.success }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{salesTax.toFixed(2)} ر.س</span>
            </div>
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning, fontSize: 12 }}>
                <span>قيمة مرتجعات المبيعات (قبل الضريبة)</span>
                <span>{salesReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning }}>
                <span>(–) ضريبة مرتجعات المبيعات</span>
                <span style={{ fontWeight: 700 }}>−{salesReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800, borderTop: "1px solid #1d3a1d", paddingTop: 10 }}>
              <span>صافي ضريبة المخرجات</span>
              <span>{netSalesTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800 }}>
              <span>إجمالي المبيعات شامل الضريبة</span>
              <span>{salesTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a6a3a", fontSize: 12 }}>عدد الفواتير: {filtSales.length}{filtSalesReturns.length > 0 ? ` · مرتجعات: ${filtSalesReturns.length}` : ""}</div>
          </div>
        </div>
        <div style={{ background: C.surface, border: "1px solid #1a2a3a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.accent, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="purchase" s={16} /> ضريبة المشتريات (ضريبة المدخلات)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.muted }}>
              <span>إجمالي المشتريات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{purchSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.accent }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{purchTax.toFixed(2)} ر.س</span>
            </div>
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning, fontSize: 12 }}>
                <span>قيمة مرتجعات المشتريات (قبل الضريبة)</span>
                <span>{purchReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning }}>
                <span>(–) ضريبة مرتجعات المشتريات</span>
                <span style={{ fontWeight: 700 }}>−{purchReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 10 }}>
              <span>صافي ضريبة المدخلات</span>
              <span>{netPurchTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800 }}>
              <span>إجمالي المشتريات شامل الضريبة</span>
              <span>{purchTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>عدد الفواتير: {filtPurchases.length}{filtPurchaseReturns.length > 0 ? ` · مرتجعات: ${filtPurchaseReturns.length}` : ""}</div>
          </div>
        </div>
      </div>
      <div style={{ background: netTax > 0 ? "#0a1a0a" : C.dangerBg, border: `2px solid ${netTax > 0 ? "#1a6a1a" : "#6a1a1a"}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: netTax > 0 ? C.success : C.danger }}>
          {netTax > 0 ? "✔️ ضريبة مستحقة الدفع" : "✔️ ضريبة مستردة"} — {quarter}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.muted, fontSize: 13 }}>صافي ضريبة المبيعات</div>
            <div style={{ color: C.success, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netSalesTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.muted, fontSize: 13 }}>صافي ضريبة المشتريات</div>
            <div style={{ color: C.accent, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netPurchTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.muted, fontSize: 13 }}>صافي الضريبة</div>
            <div style={{ color: netTax > 0 ? C.success : C.danger, fontSize: 28, fontWeight: 900, marginTop: 4 }}>{netTax.toFixed(2)} ر.س</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, color: C.muted, fontSize: 13 }}>
          {netTax > 0
            ? `يجب تحويل مبلغ ${netTax.toFixed(2)} ر.س إلى هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`
            : `يحق استرداد مبلغ ${Math.abs(netTax).toFixed(2)} ر.س من هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`}
        </div>
      </div>
    </div>
  );
}

// ==================== REPORTS ====================
