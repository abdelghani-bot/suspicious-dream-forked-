export function PrintReceipt({ invoice, onClose }) {
  const printArea = useRef();
  const doPrint = () => {
    const w = window.open("", "_blank", "width=400,height=700");
    w.document.write(
      `<html dir="rtl"><head><style>body{font-family:'Tajawal',Arial,sans-serif;margin:0;padding:16px;font-size:13px;color:#000;background:#fff}h2{margin:4px 0;font-size:16px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px}hr{border:1px dashed #999}.total{font-weight:700;font-size:15px}.dose{font-size:11px;color:#555;font-style:italic}.header{text-align:center;margin-bottom:12px}@media print{body{padding:0}}</style></head><body>${printArea.current.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };
  return (
    <Modal open title="معاينة الفاتورة / وصفة الجرعات" onClose={onClose}>
      <div
        ref={printArea}
        style={{
          background: "#fff",
          color: "#000",
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          fontFamily: "Tajawal,Arial,sans-serif",
          fontSize: 13,
        }}
      >
        <div
          className="header"
          style={{ textAlign: "center", marginBottom: 12 }}
        >
          <h2 style={{ margin: "4px 0", fontSize: 16 }}>صيدلية برو</h2>
          <div style={{ fontSize: 11, color: "#555" }}>
            فاتورة مبيعات رقم: {invoice.id}
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>
            التاريخ: {invoice.date} | الدفع: {invoice.payment}
          </div>
          // ✅
          {invoice.customer_name && invoice.customer_name !== "زبون عادي" && (
            <div style={{ fontSize: 11 }}>العميل: {invoice.customer_name}</div>
          )}
          <hr />
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "right" }}>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td>
                  <div>{item.name}</div>
                  {item.dose && (
                    <div
                      className="dose"
                      style={{
                        fontSize: 11,
                        color: "#555",
                        fontStyle: "italic",
                      }}
                    >
                      ▸ {item.dose}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "center" }}>{item.qty}</td>
                <td style={{ textAlign: "center" }}>{item.price}</td>
                <td style={{ textAlign: "center" }}>
                  {(item.price * item.qty).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span>قبل الضريبة</span>
          <span>{(invoice.subtotal || 0).toFixed(2)} ر.س</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ضريبة 15%</span>
          <span>
            {(invoice.taxAmount || invoice.tax_amount || 0).toFixed(2)} ر.س
          </span>
        </div>
        {invoice.discountAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>خصم</span>
            <span>
              - {invoice.discountAmt || invoice.discount_amt || 0} ر.س
            </span>
          </div>
        )}
        <div
          className="total"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 15,
            borderTop: "2px solid #000",
            paddingTop: 6,
            marginTop: 4,
          }}
        >
          <span>الإجمالي</span>
          <span>{invoice.total.toFixed(2)} ر.س</span>
        </div>
        {invoice.prescriptionImg && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>
              صورة الوصفة الطبية:
            </div>
            <img
              src={invoice.prescriptionImg}
              style={{
                maxWidth: "100%",
                maxHeight: 150,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
              alt="وصفة"
            />
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <QRCodeSVG
            value={`${invoice.date}|${(invoice.total || 0).toFixed(2)}|${(
              invoice.taxAmount ||
              invoice.tax_amount ||
              0
            ).toFixed(2)}`}
            size={100}
          />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            شكراً لزيارتكم • صيدلية برو
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>
          إغلاق
        </Btn>
        <Btn icon="print" onClick={doPrint}>
          طباعة
        </Btn>
      </div>
    </Modal>
  );
}
// ==================== Pharmacy Settings ====================
const getPharmacySettings = async () => {
  try {
    const { data } = await supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("id", "main")
      .single();
    return data || {};
  } catch {
    return {};
  }
};

