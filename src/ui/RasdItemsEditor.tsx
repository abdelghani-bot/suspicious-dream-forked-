import { COLORS } from "../theme";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { Btn, IC } from "./primitives";

// محرر صغير لقائمة منتجات رصد (GTIN/SN/BN/XD) — بيتستخدم في مودالات Deactivate/Transfer
export const RasdItemsEditor = ({ items, onChange }) => {
  const addRow = () => onChange([...items, { gtin: "", serial: "", batch: "", expiry: "" }]);
  const updateRow = (i, field, value) =>
    onChange(items.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));

  // 🆕 مسح باركود الصنف (GS1) بيملأ GTIN + BN + XD + SN تلقائيًا في سطر جديد،
  // بدل ما تدخلهم يدويًا واحد واحد في الخانات الأربعة.
  const handleBarcodeScan = (scan) => {
    const gtin = scan.gtin || scan.code || "";
    if (!gtin) return;
    onChange([...items, { gtin, serial: scan.serial || "", batch: scan.batch || "", expiry: scan.expiry || "" }]);
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <BarcodeScanner onScan={handleBarcodeScan} placeholder="امسح باركود الصنف لإضافته تلقائيًا (GTIN + دفعة + صلاحية + تسلسلي)..." />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim }}>الأصناف ({items.length})</span>
        <Btn size="sm" variant="secondary" icon="plus" onClick={addRow}>إضافة صنف يدويًا</Btn>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: COLORS.textDim, padding: "10px 0" }}>لا يوجد أصناف — اضغط "إضافة صنف"</div>
      )}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {items.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 0.9fr 0.9fr auto",
              gap: 6,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <input
              value={row.gtin}
              onChange={(e) => updateRow(i, "gtin", e.target.value)}
              placeholder="GTIN"
              style={rasdCellStyle}
            />
            <input
              value={row.serial}
              onChange={(e) => updateRow(i, "serial", e.target.value)}
              placeholder="SN (الرقم التسلسلي)"
              style={rasdCellStyle}
            />
            <input
              value={row.batch}
              onChange={(e) => updateRow(i, "batch", e.target.value)}
              placeholder="دفعة (BN)"
              style={rasdCellStyle}
            />
            <input
              value={row.expiry}
              onChange={(e) => updateRow(i, "expiry", e.target.value)}
              placeholder="صلاحية (XD)"
              style={rasdCellStyle}
            />
            <button
              onClick={() => removeRow(i)}
              style={{
                background: COLORS.redSoft,
                border: "none",
                borderRadius: 6,
                color: COLORS.red,
                cursor: "pointer",
                padding: "6px 8px",
              }}
            >
              <IC n="x" s={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};



export const rasdCellStyle = {
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: "7px 9px",
  color: COLORS.textPrimary,
  fontSize: 12,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};



// محرر أصناف عمليات "برقم التشغيلة" — GTIN + الكمية (QTY) + BN + XD، من غير رقم تسلسلي (SN)
// ✅ مبني على شاشات رصد الفعلية (القبول/الإرجاع/النقل برقم التشغيلة)
export const RasdItemsEditorBatch = ({ items, onChange }) => {
  const addRow = () => onChange([...items, { gtin: "", quantity: "", batch: "", expiry: "" }]);
  const updateRow = (i, field, value) =>
    onChange(items.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));

  // 🆕 مسح باركود الصنف (GS1) بيملأ GTIN + BN + XD تلقائيًا في سطر جديد (الكمية افتراضيًا 1 وتقدر تعدّلها).
  const handleBarcodeScan = (scan) => {
    const gtin = scan.gtin || scan.code || "";
    if (!gtin) return;
    onChange([...items, { gtin, quantity: 1, batch: scan.batch || "", expiry: scan.expiry || "" }]);
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <BarcodeScanner onScan={handleBarcodeScan} placeholder="امسح باركود الصنف لإضافته تلقائيًا (GTIN + دفعة + صلاحية)..." />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim }}>الدفعات ({items.length})</span>
        <Btn size="sm" variant="secondary" icon="plus" onClick={addRow}>إضافة دفعة يدويًا</Btn>
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: COLORS.textDim, padding: "10px 0" }}>لا يوجد دفعات — اضغط "إضافة دفعة"</div>
      )}
      <div style={{ maxHeight: 260, overflowY: "auto" }}>
        {items.map((row, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.8fr 0.9fr 0.9fr auto",
              gap: 6,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <input
              value={row.gtin}
              onChange={(e) => updateRow(i, "gtin", e.target.value)}
              placeholder="GTIN"
              style={rasdCellStyle}
            />
            <input
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
              placeholder="الكمية"
              type="number"
              style={rasdCellStyle}
            />
            <input
              value={row.batch}
              onChange={(e) => updateRow(i, "batch", e.target.value)}
              placeholder="دفعة (BN)"
              style={rasdCellStyle}
            />
            <input
              value={row.expiry}
              onChange={(e) => updateRow(i, "expiry", e.target.value)}
              placeholder="صلاحية (XD)"
              style={rasdCellStyle}
            />
            <button
              onClick={() => removeRow(i)}
              style={{
                background: COLORS.redSoft,
                border: "none",
                borderRadius: 6,
                color: COLORS.red,
                cursor: "pointer",
                padding: "6px 8px",
              }}
            >
              <IC n="x" s={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
