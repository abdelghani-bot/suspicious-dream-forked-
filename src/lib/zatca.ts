import { supabase } from "./supabaseClient";

 
// ==================== ZATCA QR (Simplified Tax Invoice TLV) ====================
// السطر التالي بيبني QR متوافق مع متطلبات هيئة الزكاة والضريبة (ZATCA) بصيغة TLV/Base64
// بدل ما كان نص عادي (تاريخ|إجمالي|ضريبة) اللي بيظهر كأرقام لما يتم مسحه.
export const toTLVBytes = (tag, value) => {
  const valueBytes = new TextEncoder().encode(String(value ?? ""));
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
};


export const buildZatcaQR = ({ sellerName, vatNumber, timestamp, invoiceTotal, vatTotal }) => {
  const fields = [
    toTLVBytes(1, sellerName || "الصيدلية"),
    toTLVBytes(2, vatNumber || ""),
    toTLVBytes(3, timestamp || new Date().toISOString()),
    toTLVBytes(4, Number(invoiceTotal || 0).toFixed(2)),
    toTLVBytes(5, Number(vatTotal || 0).toFixed(2)),
  ];
  const totalLen = fields.reduce((s, f) => s + f.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const f of fields) {
    merged.set(f, offset);
    offset += f.length;
  }
  let binary = "";
  merged.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};



// ==================== ZATCA Phase 1 — Hash Chain + UBL XML ====================
// أساس Hash Chain (UUID + ICV + PIH) + توليد XML بصيغة UBL 2.1 لفاتورة ضريبية مبسطة.
// ملحوظة: التوقيع الرقمي (Cryptographic Stamp) والشهادة (CSID) بيتضافوا في Phase 2 فقط،
// لكن بنجهز الـ XML بشكل متوافق مع البنية الأساسية من دلوقتي عشان التحول لاحقاً يبقى أسهل.

// SHA-256 → Base64 (بيُستخدم لحساب هاش كل فاتورة)
export const sha256Base64 = async (text) => {
  const enc = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};



// 🆕 بيجيب آخر ICV/Hash لنفس الصيدلية عن طريق RPC واحدة atomic (reserve_zatca_chain) بدل
// قراءة مباشرة من الجدول. القراءة المباشرة القديمة كانت فيها احتمال race condition حقيقي:
// لو فاتورتين اتقفلوا في نفس اللحظة (حتى أونلاين)، الاتنين ممكن يقرأوا نفس "آخر icv" ويحسبوا
// نفس الرقم التالي. الـ RPC بتستخدم pg_advisory_xact_lock على مستوى الصيدلية عشان تمنع ده.
//
// ⚠️ مهم: الدالة دي لازم تتنفذ بس وقت الإدراج الفعلي في السيرفر (جوه executeEvent وقت الإرسال
// الحقيقي — أونلاين فورًا أو وقت مزامنة الأوفلاين)، مش وقت إنشاء الفاتورة في الشاشة. لو اتنفذت
// وإحنا أوفلاين، هترمي error (تتلقفها buildZatcaChainForInvoice وتتسجل في الكونسول من غير ما
// توقف حفظ الفاتورة) بدل ما ترجع icv=1 غلط لكل فاتورة أوفلاين.
export const getNextZatcaChain = async (pharmacyId) => {
  const { data, error } = await supabase.rpc("reserve_zatca_chain", { p_pharmacy_id: pharmacyId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { icv: Number(row?.icv || 1), pih: row?.pih || btoa("0") };
};



// XML escaping بسيط لحماية الحقول النصية (أسماء أصناف/عملاء ممكن تحتوي على أحرف خاصة)
export const xmlEscape = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");



// بناء XML بصيغة UBL 2.1 لفاتورة ضريبية مبسطة (Simplified Tax Invoice - B2C)
// invoiceTypeCode name="0200000": الرقم الأول (2) = فاتورة مبسطة، الباقي أصفار = بدون خصائص إضافية
export const buildZatcaInvoiceXML = ({
  uuid,
  icv,
  pih,
  invoiceId,
  issueDate,
  issueTime,
  sellerName,
  vatNumber,
  sellerAddress,
  items,
  subtotal,
  taxAmount,
  discountAmt,
  total,
  currency = "SAR",
}) => {
  const lines = (items || [])
    .map((it, idx) => {
      const lineNet = Math.round(it.price * it.qty * 100) / 100;
      const rate = it.taxable ? 15 : 0;
      const lineTax = it.taxable ? Math.round(lineNet * 0.15 * 100) / 100 : 0;
      const taxCategory = it.taxable ? "S" : "E"; // S = خاضع 15% | E = معفى (عدّل حسب نوع الصنف لو فيه Zero-rated فعلي)
      return `
  <cac:InvoiceLine>
    <cbc:ID>${idx + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${it.qty}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${lineNet.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currency}">${lineTax.toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="${currency}">${(lineNet + lineTax).toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${xmlEscape(it.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${taxCategory}</cbc:ID>
        <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${Number(it.price).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(invoiceId)}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0200000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pih}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(sellerAddress)}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEscape(vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${Number(subtotal).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${Number(subtotal).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${Number(total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${Number(discountAmt || 0).toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${currency}">${Number(total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${Number(taxAmount).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>${lines}
</Invoice>`;
};



// دالة شاملة: بتاخد بيانات الفاتورة + الصيدلية، وترجع كل حقول زاتكا جاهزة للحفظ في جدول sales
export const buildZatcaChainForInvoice = async ({ pharmacyId, invoiceId, sellerName, vatNumber, sellerAddress, items, subtotal, taxAmount, discountAmt, total, createdAt }) => {
  const { icv, pih } = await getNextZatcaChain(pharmacyId);
  const uuid = crypto.randomUUID();
  const dt = new Date(createdAt || Date.now());
  const issueDate = dt.toISOString().split("T")[0];
  const issueTime = dt.toISOString().split("T")[1].split(".")[0];

  const xml = buildZatcaInvoiceXML({
    uuid, icv, pih, invoiceId, issueDate, issueTime,
    sellerName, vatNumber, sellerAddress, items,
    subtotal, taxAmount, discountAmt, total,
  });

  const hash = await sha256Base64(xml);

  return { zatca_uuid: uuid, zatca_icv: icv, zatca_pih: pih, zatca_hash: hash, zatca_xml: xml };
};
