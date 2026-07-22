// ── واتساب: دوال عامة مشتركة (مش محصورة جوه قسم العملاء) ──
export function openWhatsApp(phone, message = "") {
  const clean = String(phone || "").replace(/[^0-9]/g, "");
  const wa = clean.startsWith("0") ? "966" + clean.slice(1) : clean;
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, "_blank");
}


export function sendBulk(list, message) {
  list.forEach((c, i) => setTimeout(() => openWhatsApp(c.phone, message), i * 600));
}
