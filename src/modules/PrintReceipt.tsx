import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";
import { buildZatcaQR } from "../lib/zatca";
import { Btn, Modal } from "../ui/primitives";

// ==================== PRINT RECEIPT ====================
export function PrintReceipt({ invoice, onClose, pharmacyId, customerPhone }) {
  const printArea = useRef();
  const [paperWidth, setPaperWidth] = useState("80"); // 58 / 80 / A4 — الافتراضي 80مم
  const [pharmacyInfo, setPharmacyInfo] = useState({ name: "", vatNumber: "" });

    useEffect(() => {
        if (!pharmacyId) return;

        // استخدم النسخة المحفوظة محليًا الأول (لو موجودة) كعرض فوري وfallback
        const cached = localStorage.getItem(`pharmacy_settings_${pharmacyId}`);
        if (cached) {
            const data = JSON.parse(cached);
            if (data.receipt_paper_width) setPaperWidth(data.receipt_paper_width);
            setPharmacyInfo({ name: data.name_ar || "", vatNumber: data.tax_number || "" });
        }

        // لو فيه نت، حاول تجيب نسخة محدثة وتخزنها لاستخدامها بعدين أوفلاين
        if (navigator.onLine) {
            supabase
                .from("pharmacy_settings")
                .select("receipt_paper_width, name_ar, tax_number")
                .eq("pharmacy_id", pharmacyId)
                .single()
                .then(({ data }) => {
                    if (data) {
                        if (data.receipt_paper_width) setPaperWidth(data.receipt_paper_width);
                        setPharmacyInfo({ name: data.name_ar || "", vatNumber: data.tax_number || "" });
                        localStorage.setItem(`pharmacy_settings_${pharmacyId}`, JSON.stringify(data));
                    }
                })
                .catch(() => { }); // فشل بهدوء لو حصل قطع نت أثناء الطلب
        }
    }, [pharmacyId]);

  const doPrint = () => {
    const isA4 = paperWidth === "A4";
    const pageCSS = isA4
      ? `@page{size:A4;margin:14mm}html,body{width:auto}`
      : `@page{size:${paperWidth}mm auto;margin:0}html,body{width:${paperWidth}mm}`;
    const w = window.open("", "_blank", "width=400,height=700");
    w.document.write(
      `<html dir="rtl"><head><style>${pageCSS}body{font-family:'Tajawal',Arial,sans-serif;margin:0;padding:8px 10px;font-size:13px;color:#000;background:#fff}h2{margin:4px 0;font-size:16px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px}hr{border:1px dashed #999}.total{font-weight:700;font-size:15px}.dose{font-size:11px;color:#555;font-style:italic}.header{text-align:center;margin-bottom:12px}@media print{body{padding:0 6px}}</style></head><body>${printArea.current.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };
  const shareOnWhatsapp = () => {
    const phone = String(customerPhone || "").replace(/\D/g, "");
    if (!phone) return;
    const lines = invoice.items
      .filter((item) => !item.isMissed && !item.isJoker)
      .map((item) => `• ${item.name} × ${item.qty} = ${(item.price * item.qty).toFixed(2)} ر.س`);
    const msg =
      `🧾 فاتورة مبيعات رقم: ${invoice.id}\n` +
      `التاريخ: ${invoice.date}\n\n` +
      lines.join("\n") +
      `\n\nالإجمالي: ${invoice.total.toFixed(2)} ر.س\n\n` +
      `شكراً لزيارتكم 🌿`;
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg), "_blank");
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
          <h2 style={{ margin: "4px 0", fontSize: 16 }}>{pharmacyInfo.name || "الصيدلية"}</h2>
          <div style={{ fontSize: 11, color: "#555" }}>
            {invoice.isReturn ? `فاتورة مرتجع رقم: ${invoice.id}` : `فاتورة مبيعات رقم: ${invoice.id}`}
          </div>
          {invoice.isReturn && invoice.originalInvoiceId && (
            <div style={{ fontSize: 11, color: "#555" }}>
              مرتبط بفاتورة رقم: {invoice.originalInvoiceId}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#555" }}>
            التاريخ: {invoice.date}{invoice.payment && invoice.payment !== "—" ? ` | الدفع: ${invoice.payment}` : ""}
          </div>
          {(invoice.partyName || invoice.customer_name) && (invoice.partyName || invoice.customer_name) !== "زبون عادي" && (
            <div style={{ fontSize: 11 }}>{invoice.partyLabel || "العميل"}: {invoice.partyName || invoice.customer_name}</div>
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
            {invoice.items
              .filter((item) => !item.isMissed && !item.isJoker)
              .map((item, i) => (
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
            value={buildZatcaQR({
              sellerName: pharmacyInfo.name || invoice.pharmacyName || "",
              vatNumber: pharmacyInfo.vatNumber || invoice.vatNumber || invoice.tax_number || "",
              timestamp: invoice.created_at || invoice.date,
              invoiceTotal: invoice.total || 0,
              vatTotal: invoice.taxAmount || invoice.tax_amount || 0,
            })}
            size={100}
          />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            شكراً لزيارتكم{pharmacyInfo.name ? ` • ${pharmacyInfo.name}` : ""}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>
          إغلاق
        </Btn>
        {customerPhone && (
          <Btn icon="whatsapp" onClick={shareOnWhatsapp}>
            مشاركة واتساب
          </Btn>
        )}
        <Btn icon="print" onClick={doPrint}>
          طباعة
        </Btn>
      </div>
    </Modal>
  );
}
