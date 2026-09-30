import { useState } from "react";
import { COLORS, tint } from "../theme";
import * as XLSX from "xlsx";
import { Btn, IC, Select } from "../ui/primitives";
import { TAX_RATE } from "../data/seedData";

// 🔧 أسماء حقل الضريبة مش موحدة في الداتا (taxAmount / tax_amount / tax) — تقرير المبيعات بيقرأ الاتنين،
// فلازم نفس الشيء هنا، وإلا الضريبة ممكن تظهر صفر وتتحسب الضريبة المستحقة غلط.
const taxOf = (x) => (x && (x.taxAmount || x.tax_amount)) || 0;
// 🔧 الخصم على الفاتورة بيتسجل في الإجمالي (total) بس، ومش بينعكس على subtotal ولا tax (ظهر في فواتير فعلية:
// الإجمالي أقل من قبل الضريبة + الضريبة بقيمة الخصم). فالأساس الفعلي قبل الضريبة = الإجمالي − الضريبة،
// وبكده (الأساس + الضريبة = الإجمالي) دايماً، والمبيعات المعروضة بتطابق اللي اتدفع فعلاً.
const baseOf = (x) => (x && x.total != null ? x.total - taxOf(x) : (x && x.subtotal) || 0);
const returnTaxOf = (r) => (r && (r.tax || r.taxAmount || r.tax_amount)) || 0;
// المرتجع ممكن ميكونش فيه subtotal محفوظ — نفس الاحتياطي المستخدم في تقرير الأصناف الشهري
const returnSubtotalOf = (r) => r.subtotal ?? Math.max(0, (r.total || 0) - returnTaxOf(r));
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// 🆕 فصل الخاضع عن غير الخاضع من غير الاعتماد على حقول الأصناف:
// الأساس الخاضع = الضريبة ÷ النسبة، وغير الخاضع = المجموع قبل الضريبة − الأساس الخاضع.
// بيتحسب لكل مستند لوحده، وأي فرق أقل من 0.05 ر.س بيتعامل كتقريب هللات (مش مبلغ غير خاضع حقيقي).
// الافتراض: "المجموع قبل الضريبة" هو الأساس بعد الخصم (لو الخصم مش متخصم منه، هيظهر غلط كغير خاضع).
const nonTaxableBase = (subtotal, tax, rate) => {
  const v = (subtotal || 0) - (tax || 0) / rate;
  return v > 0.05 ? v : 0;
};

// 🔧 الأرباع بتتولد من تاريخ اليوم (آخر 8 أرباع) بدل قائمة ثابتة كانت هتنتهي وتفتقد أي ربع جديد
const buildQuarters = (count = 8) => {
  const d = new Date();
  let qn = Math.floor(d.getMonth() / 3) + 1;
  let y = d.getFullYear();
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(`Q${qn}-${y}`);
    qn--;
    if (qn === 0) { qn = 4; y--; }
  }
  return out;
};

// ==================== TAX REPORT ====================
export function TaxReport({ sales, purchases, returns = [] }) {
  const quarters = buildQuarters();
  const [quarter, setQuarter] = useState(quarters[0]);
  const rate = TAX_RATE || 0.15;
  const vatPct = Math.round(rate * 100);
  const qMap = { Q1: "01,02,03", Q2: "04,05,06", Q3: "07,08,09", Q4: "10,11,12" };
  const [q, year] = quarter.split("-");
  const months = qMap[q].split(",").map((m) => `${year}-${m}`);
  const inQuarter = (date) => months.some((m) => (date || "").startsWith(m));
  const filtPurchases = purchases.filter((p) => inQuarter(p.date));
  const filtReturns = (returns || []).filter((r) => inQuarter(r.date));
  // 🔧 المبدأ المحاسبي: الفاتورة تُحسب في ربع تاريخها، والمرتجع (إشعار دائن) يُخصم في ربع تاريخه هو.
  // قبل كده الفاتورة المرتجعة بالكامل كانت بتتشال من ربعها الأصلي (وده بيغيّر إقرار اتقدّم فعلاً لو المرتجع
  // حصل في ربع لاحق) ومرتجعها كان بيتشال كمان. دلوقتي نفس الفاتورة تفضل في ربعها، ومرتجعها يتخصم في ربعه.
  // احتياط: لو فاتورة معلّمة مرتجعة بالكامل ومفيش لها سجل مرتجع أصلاً، بنستبعدها (زي السلوك القديم)
  // عشان ما تتحسبش مبيعات من غير خصم مقابل.
  const invoicesWithReturnRecord = new Set(
    (returns || []).filter((r) => r.type === "sales" && r.invoice_id).map((r) => r.invoice_id)
  );
  const filtSales = sales.filter((s) => inQuarter(s.date) && (!s.returned || invoicesWithReturnRecord.has(s.id)));
  const filtSalesReturns = filtReturns.filter((r) => r.type === "sales");
  const filtPurchaseReturns = filtReturns.filter((r) => r.type === "purchases");
  const salesSubtotal = filtSales.reduce((a, s) => a + baseOf(s), 0);
  const salesTax = filtSales.reduce((a, s) => a + taxOf(s), 0);
  const salesTotal = filtSales.reduce((a, s) => a + (s.total || 0), 0);
  const purchSubtotal = filtPurchases.reduce((a, p) => a + baseOf(p), 0);
  const purchTax = filtPurchases.reduce((a, p) => a + taxOf(p), 0);
  const purchTotal = filtPurchases.reduce((a, p) => a + (p.total || 0), 0);
  const salesReturnsSubtotal = filtSalesReturns.reduce((a, r) => a + returnSubtotalOf(r), 0);
  const salesReturnsTax = filtSalesReturns.reduce((a, r) => a + returnTaxOf(r), 0);
  const salesReturnsTotal = filtSalesReturns.reduce((a, r) => a + (r.total || 0), 0);
  const purchReturnsSubtotal = filtPurchaseReturns.reduce((a, r) => a + returnSubtotalOf(r), 0);
  const purchReturnsTax = filtPurchaseReturns.reduce((a, r) => a + returnTaxOf(r), 0);
  const purchReturnsTotal = filtPurchaseReturns.reduce((a, r) => a + (r.total || 0), 0);
  // صافي القيم بعد المرتجعات (الأساس الخاضع للضريبة + الضريبة + الإجمالي)
  const netSalesSubtotal = salesSubtotal - salesReturnsSubtotal;
  const netSalesTotal = salesTotal - salesReturnsTotal;
  const netPurchSubtotal = purchSubtotal - purchReturnsSubtotal;
  const netPurchTotal = purchTotal - purchReturnsTotal;
  const netSalesTax = salesTax - salesReturnsTax;
  const netPurchTax = purchTax - purchReturnsTax;
  // 🆕 الخاضع / غير الخاضع (صافي بعد المرتجعات)
  const netSalesNonTaxable = round2(
    filtSales.reduce((a, s) => a + nonTaxableBase(baseOf(s), taxOf(s), rate), 0)
    - filtSalesReturns.reduce((a, r) => a + nonTaxableBase(returnSubtotalOf(r), returnTaxOf(r), rate), 0)
  );
  const netPurchNonTaxable = round2(
    filtPurchases.reduce((a, p) => a + nonTaxableBase(baseOf(p), taxOf(p), rate), 0)
    - filtPurchaseReturns.reduce((a, r) => a + nonTaxableBase(returnSubtotalOf(r), returnTaxOf(r), rate), 0)
  );
  const netSalesTaxable = round2(netSalesSubtotal - netSalesNonTaxable);
  const netPurchTaxable = round2(netPurchSubtotal - netPurchNonTaxable);
  // 🆕 فحص سلامة: الفواتير اللي إجماليها ≠ (قبل الضريبة + الضريبة) — غالباً خصم مش منعكس على المجموع/الضريبة.
  // ده بيفسر أي فرق بين "صافي شامل الضريبة" ومجموع (قبل الضريبة + الضريبة) في الكروت.
  const gapOf = (x) => round2((x.total || 0) - ((x.subtotal || 0) + taxOf(x)));
  const salesGapDocs = filtSales.filter((x) => Math.abs(gapOf(x)) > 0.05);
  const purchGapDocs = filtPurchases.filter((x) => Math.abs(gapOf(x)) > 0.05);
  const salesGapSum = round2(salesGapDocs.reduce((a, x) => a + gapOf(x), 0));
  const purchGapSum = round2(purchGapDocs.reduce((a, x) => a + gapOf(x), 0));
  // 🔧 تقريب لأقرب هللة عشان ضوضاء الكسور (مثلاً -0.00) ما تقلبش الحالة بين مستحقة/مستردة
  const netTax = round2(netSalesTax - netPurchTax);
  const statusColor = netTax > 0 ? COLORS.green : netTax < 0 ? COLORS.red : COLORS.textDim;
  // 🆕 تصدير Excel: شيت ملخص + شيتات تفصيلية (مبيعات/مشتريات/مرتجعات) عشان المحاسب يراجع الأرقام فاتورة فاتورة
  const exportToExcel = () => {
    const n = (v) => round2(v || 0);
    const summary = [
      ["البند", "المبيعات", "المشتريات"],
      ["الفترة", quarter, quarter],
      ["الإجمالي قبل الضريبة", n(salesSubtotal), n(purchSubtotal)],
      ["الضريبة", n(salesTax), n(purchTax)],
      ["(–) مرتجعات قبل الضريبة", n(salesReturnsSubtotal), n(purchReturnsSubtotal)],
      ["(–) ضريبة المرتجعات", n(salesReturnsTax), n(purchReturnsTax)],
      ["الصافي قبل الضريبة (بعد المرتجعات)", n(netSalesSubtotal), n(netPurchSubtotal)],
      ["منه: خاضع للضريبة", n(netSalesTaxable), n(netPurchTaxable)],
      ["منه: غير خاضع للضريبة", n(netSalesNonTaxable), n(netPurchNonTaxable)],
      ["صافي الضريبة", n(netSalesTax), n(netPurchTax)],
      ["الصافي شامل الضريبة", n(netSalesTotal), n(netPurchTotal)],
      ["عدد الفواتير", filtSales.length, filtPurchases.length],
      ["عدد المرتجعات", filtSalesReturns.length, filtPurchaseReturns.length],
      [],
      ["صافي الضريبة (مخرجات − مدخلات) — محسوب من النظام للمراجعة", netTax],
    ];
    const salesRows = [["رقم الفاتورة", "التاريخ", "العميل", "قبل الضريبة (بعد الخصم)", "الضريبة", "الإجمالي", "الحالة"],
      ...filtSales.map((x) => [x.id, x.date, x.customer_name || "زبون عادي", n(baseOf(x)), n(taxOf(x)), n(x.total), x.returned ? "مرتجعة" : "مكتملة"])];
    const purchRows = [["رقم الأمر", "التاريخ", "المورد", "قبل الضريبة (بعد الخصم)", "الضريبة", "الإجمالي"],
      ...filtPurchases.map((x) => [x.id, x.date, x.supplierName || "—", n(baseOf(x)), n(taxOf(x)), n(x.total)])];
    const retRows = [["رقم المرتجع", "التاريخ", "النوع", "الفاتورة الأصلية", "قبل الضريبة", "الضريبة", "الإجمالي"],
      ...filtReturns.map((r) => [r.id, r.date, r.type === "sales" ? "مبيعات" : "مشتريات", r.invoice_id || "—", n(returnSubtotalOf(r)), n(returnTaxOf(r)), n(r.total)])];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    [["ملخص الضريبة", summary], ["فواتير المبيعات", salesRows], ["فواتير المشتريات", purchRows], ["المرتجعات", retRows]]
      .forEach(([name, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name));
    const gapRows = [["النوع", "الرقم", "التاريخ", "قبل الضريبة (كما في الفاتورة)", "الضريبة", "الإجمالي", "الخصم/الفرق (الإجمالي − قبل الضريبة − الضريبة)"],
      ...salesGapDocs.map((x) => ["بيع", x.id, x.date, n(x.subtotal), n(taxOf(x)), n(x.total), gapOf(x)]),
      ...purchGapDocs.map((x) => ["شراء", x.id, x.date, n(x.subtotal), n(taxOf(x)), n(x.total), gapOf(x)])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gapRows), "فروقات");
    XLSX.writeFile(wb, `تقرير_الضريبة_${quarter}.xlsx`);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>تقرير ضريبة القيمة المضافة — ربع سنوي</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, alignItems: "center" }}>
        <Select label="الربع السنوي" value={quarter} onChange={setQuarter}
          options={quarters.map((q) => ({ v: q, l: `الربع ${q}` }))} style={{ width: 200 }} />
        <div style={{ color: COLORS.textDim, fontSize: 13, marginTop: 20 }}>نسبة الضريبة: {vatPct}% (VAT)</div>
        <div style={{ marginTop: 20, marginRight: "auto" }}>
          <Btn variant="secondary" onClick={exportToExcel}>📊 تصدير Excel</Btn>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: COLORS.green, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="pos" s={16} /> ضريبة المبيعات (الضريبة المحصلة)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>إجمالي المبيعات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{salesSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green }}>
              <span>ضريبة القيمة المضافة ({vatPct}%)</span>
              <span style={{ fontWeight: 700 }}>{salesTax.toFixed(2)} ر.س</span>
            </div>
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral, fontSize: 12 }}>
                <span>قيمة مرتجعات المبيعات (قبل الضريبة)</span>
                <span>{salesReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral }}>
                <span>(–) ضريبة مرتجعات المبيعات</span>
                <span style={{ fontWeight: 700 }}>−{salesReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, borderTop: `1px solid ${tint(COLORS.green,0.35)}`, paddingTop: 10 }}>
              <span>صافي المبيعات قبل الضريبة (بعد المرتجعات)</span>
              <span>{netSalesSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 13, paddingRight: 12 }}>
              <span>منها: خاضعة للضريبة</span>
              <span style={{ fontWeight: 700 }}>{netSalesTaxable.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, fontSize: 13, paddingRight: 12 }}>
              <span>منها: غير خاضعة للضريبة</span>
              <span style={{ fontWeight: 700 }}>{netSalesNonTaxable.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800 }}>
              <span>صافي ضريبة المخرجات</span>
              <span>{netSalesTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>صافي المبيعات شامل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{netSalesTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 12 }}>عدد الفواتير: {filtSales.length}{filtSalesReturns.length > 0 ? ` · مرتجعات: ${filtSalesReturns.length}` : ""}</div>
            {salesGapDocs.length > 0 && (
              <div style={{ color: COLORS.coral, fontSize: 12 }}>
                ℹ️ {salesGapDocs.length} فاتورة عليها خصم/فرق ({Math.abs(salesGapSum).toFixed(2)} ر.س) — اتحسب الأساس من الإجمالي − الضريبة. التفاصيل في شيت "فروقات" بملف Excel.
              </div>
            )}
          </div>
        </div>
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: COLORS.blue, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="purchase" s={16} /> ضريبة المشتريات (ضريبة المدخلات)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>إجمالي المشتريات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{purchSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.blue }}>
              <span>ضريبة القيمة المضافة ({vatPct}%)</span>
              <span style={{ fontWeight: 700 }}>{purchTax.toFixed(2)} ر.س</span>
            </div>
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral, fontSize: 12 }}>
                <span>قيمة مرتجعات المشتريات (قبل الضريبة)</span>
                <span>{purchReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral }}>
                <span>(–) ضريبة مرتجعات المشتريات</span>
                <span style={{ fontWeight: 700 }}>−{purchReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
              <span>صافي المشتريات قبل الضريبة (بعد المرتجعات)</span>
              <span>{netPurchSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.blue, fontSize: 13, paddingRight: 12 }}>
              <span>منها: خاضعة للضريبة</span>
              <span style={{ fontWeight: 700 }}>{netPurchTaxable.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, fontSize: 13, paddingRight: 12 }}>
              <span>منها: غير خاضعة للضريبة</span>
              <span style={{ fontWeight: 700 }}>{netPurchNonTaxable.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800 }}>
              <span>صافي ضريبة المدخلات</span>
              <span>{netPurchTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>صافي المشتريات شامل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{netPurchTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 12 }}>عدد الفواتير: {filtPurchases.length}{filtPurchaseReturns.length > 0 ? ` · مرتجعات: ${filtPurchaseReturns.length}` : ""}</div>
            {purchGapDocs.length > 0 && (
              <div style={{ color: COLORS.coral, fontSize: 12 }}>
                ℹ️ {purchGapDocs.length} أمر شراء عليه خصم/فرق ({Math.abs(purchGapSum).toFixed(2)} ر.س) — اتحسب الأساس من الإجمالي − الضريبة. التفاصيل في شيت "فروقات" بملف Excel.
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ background: netTax > 0 ? COLORS.greenSoft : netTax < 0 ? COLORS.redSoft : COLORS.surface, border: `2px solid ${statusColor === COLORS.textDim ? COLORS.border : statusColor}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: statusColor }}>
          {netTax > 0 ? "✔️ صافي ضريبة مستحقة (محسوب من النظام)" : netTax < 0 ? "↩️ صافي ضريبة مستردة (محسوب من النظام)" : "➖ صافي الضريبة صفر (محسوب من النظام)"} — {quarter}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي ضريبة المبيعات</div>
            <div style={{ color: COLORS.green, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netSalesTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي ضريبة المشتريات</div>
            <div style={{ color: COLORS.blue, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netPurchTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي الضريبة</div>
            <div style={{ color: statusColor, fontSize: 28, fontWeight: 900, marginTop: 4 }}>{netTax.toFixed(2)} ر.س</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, color: COLORS.textDim, fontSize: 13 }}>
          {netTax > 0
            ? `صافي الضريبة المحسوب من بيانات النظام: ${netTax.toFixed(2)} ر.س مستحقة عن الربع ${quarter}`
            : netTax < 0
            ? `صافي الضريبة المحسوب من بيانات النظام: ${Math.abs(netTax).toFixed(2)} ر.س مستردة عن الربع ${quarter}`
            : `صافي الضريبة المحسوب من بيانات النظام صفر عن الربع ${quarter}`}
          <div style={{ marginTop: 8, fontSize: 12 }}>
            الرقم ده للمراجعة قبل تقديم الإقرار في هيئة الزكاة والضريبة والجمارك. الإقرار الفعلي ممكن يتضمن بنود أو تسويات مش مسجلة في النظام (عمليات صفرية/معفاة، استيراد، تعديلات).
          </div>
        </div>
      </div>
    </div>
  );
}
