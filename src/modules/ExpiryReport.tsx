export function ExpiryReport({
  purchases, onRemoveExpired }) {
  const { C } = useTheme();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showExpiredDetail, setShowExpiredDetail] = useState(false);

  // ===== flatten الأصناف مع batches =====
  const allItems = (purchases ?? []).flatMap((po) =>
    (po.items ?? [])
      .filter((i) => i.expiry_date)
      .map((i) => ({
        id: i.id,
        name: i.name,
        barcode: i.barcode ?? "-",
        expiry: i.expiry_date,
        stock: (i.qty ?? 0) + (i.bonusQty ?? 0),
        cost: i.cost ?? 0,
        price: i.salePrice ?? 0,
        invoiceId: po.id,
      }))
  );

  // ===== الأصناف المنتهية =====
  const expired = allItems.filter(
    (p) => p.expiry && new Date(p.expiry) < today
  );

  // ===== 6 أشهر قادمة =====
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const label = d.toLocaleDateString("ar-EG", {
      month: "long",
      year: "numeric",
    });
    return { key, label };
  });

  const getMonthItems = (key) =>
    allItems.filter((p) => {
      if (!p.expiry) return false;
      if (new Date(p.expiry) < today) return false;
      return p.expiry.startsWith(key);
    });

  const calcTotals = (items) => ({
    count: items.length,
    costTotal: items.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0),
    sellTotal: items.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0),
  });

  // ===== طباعة =====
  const handlePrint = (label, items) => {
    const { costTotal, sellTotal } = calcTotals(items);
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير صلاحيات - ${label}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h2 { text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; font-size: 13px; }
  th { background: #f0f0f0; font-weight: 700; }
  tr:nth-child(even) { background: #fafafa; }
  .totals { margin-top: 16px; display: flex; gap: 16px; justify-content: flex-end; }
  .tot { background: #f0f4ff; border-radius: 8px; padding: 8px 16px; font-weight: 700; font-size: 14px; }
  @media print { * { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h2>تقرير الصلاحيات</h2>
<div class="sub">${label} — ${items.length} صنف</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>اسم الصنف</th><th>الباركود</th>
      <th>تاريخ الانتهاء</th><th>المخزون</th>
      <th>سعر التكلفة</th><th>سعر البيع</th>
      <th>إجمالي التكلفة</th><th>إجمالي البيع</th>
    </tr>
  </thead>
  <tbody>
    ${items
      .map(
        (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name || "-"}</td>
        <td>${p.barcode || "-"}</td>
        <td>${p.expiry || "-"}</td>
        <td>${p.stock || 0}</td>
        <td>${(p.cost || 0).toFixed(2)}</td>
        <td>${(p.price || 0).toFixed(2)}</td>
        <td>${((p.cost || 0) * (p.stock || 0)).toFixed(2)}</td>
        <td>${((p.price || 0) * (p.stock || 0)).toFixed(2)}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
<div class="totals">
  <div class="tot">إجمالي التكلفة: ${costTotal.toFixed(2)}</div>
  <div class="tot">إجمالي البيع: ${sellTotal.toFixed(2)}</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
    win.document.close();
  };

  // ===== Styles =====
  const card = (borderColor = C.border) => ({
    background: C.surface,
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: 16,
  });

  const btn = (bg = C.border) => ({
    background: bg,
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  });

  const ItemsTable = ({ items }) => (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
      <thead>
        <tr style={{ background: C.bgAlt }}>
          {[
            "الصنف",
            "الباركود",
            "تاريخ الانتهاء",
            "المخزون",
            "التكلفة",
            "البيع",
          ].map((h) => (
            <th
              key={h}
              style={{
                padding: "8px 12px",
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
        {items.map((p) => (
          <tr key={p.id} style={{ borderBottom: "1px solid #0a101a" }}>
            <td
              style={{
                padding: "8px 12px",
                color: C.text,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {p.name}
            </td>
            <td style={{ padding: "8px 12px", color: C.muted, fontSize: 11 }}>
              {p.barcode || "-"}
            </td>
            <td style={{ padding: "8px 12px", color: C.warning, fontSize: 13 }}>
              {p.expiry}
            </td>
            <td style={{ padding: "8px 12px", color: C.text, fontSize: 13 }}>
              {p.stock}
            </td>
            <td style={{ padding: "8px 12px", color: C.warning, fontSize: 13 }}>
              {(p.cost || 0).toFixed(2)}
            </td>
            <td style={{ padding: "8px 12px", color: "#44cc88", fontSize: 13 }}>
              {(p.price || 0).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>
        تقرير الصلاحيات
      </h2>

      {/* ===== قسم المنتهية ===== */}
      <div style={{ ...card("#3a1010"), marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: C.danger,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            🔴 منتهية الصلاحية ({expired.length} صنف)
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            {expired.length > 0 ? (
              <>
                <button
                  style={btn(C.border)}
                  onClick={() => setShowExpiredDetail(!showExpiredDetail)}
                >
                  {showExpiredDetail ? "▲ إخفاء" : "▼ عرض الأصناف"}
                </button>
                <button
                  style={btn("#6b1010")}
                  onClick={() => onRemoveExpired && onRemoveExpired(expired)}
                >
                  📤 إخراج من المخزون
                </button>
              </>
            ) : (
              <span style={{ color: C.muted, fontSize: 13 }}>
                لا يوجد أصناف منتهية
              </span>
            )}
          </div>
        </div>
        {showExpiredDetail && expired.length > 0 && (
          <ItemsTable items={expired} />
        )}
      </div>

      {/* ===== 6 أشهر ===== */}
      <h3
        style={{
          margin: "0 0 14px",
          fontSize: 15,
          fontWeight: 700,
          color: "#7a9adf",
        }}
      >
        📅 قريبة الانتهاء — الأشهر القادمة
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {months.map(({ key, label }) => {
          const items = getMonthItems(key);
          const { count, costTotal, sellTotal } = calcTotals(items);
          const isExpanded = expandedMonth === key;
          const hasItems = count > 0;

          return (
            <div
              key={key}
              onClick={() =>
                hasItems && setExpandedMonth(isExpanded ? null : key)
              }
              style={{
                ...card(
                  isExpanded ? "#2a4a8a" : hasItems ? C.infoBorder : "#1a2030"
                ),
                cursor: hasItems ? "pointer" : "default",
                opacity: hasItems ? 1 : 0.45,
                transition: "border-color 0.2s",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: C.text,
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                {label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    عدد الأصناف
                  </span>
                  <span
                    style={{ color: "#5a8adf", fontWeight: 800, fontSize: 15 }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    قيمة التكلفة
                  </span>
                  <span
                    style={{ color: C.warning, fontWeight: 700, fontSize: 13 }}
                  >
                    {costTotal.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    قيمة البيع
                  </span>
                  <span
                    style={{ color: "#44cc88", fontWeight: 700, fontSize: 13 }}
                  >
                    {sellTotal.toFixed(2)}
                  </span>
                </div>
              </div>
              {hasItems && (
                <div
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    color: C.muted,
                    fontSize: 11,
                  }}
                >
                  {isExpanded ? "▲ إخفاء" : "▼ عرض الأصناف"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== تفاصيل الشهر المفتوح ===== */}
      {expandedMonth &&
        (() => {
          const items = getMonthItems(expandedMonth);
          const { costTotal, sellTotal } = calcTotals(items);
          const monthLabel = months.find((m) => m.key === expandedMonth)?.label;
          return (
            <div style={card("#2a4a8a")}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <h4 style={{ margin: 0, color: C.text, fontSize: 14 }}>
                  📋 أصناف {monthLabel}
                </h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: C.warning, fontSize: 12, fontWeight: 700 }}
                  >
                    تكلفة: {costTotal.toFixed(2)}
                  </span>
                  <span
                    style={{ color: "#44cc88", fontSize: 12, fontWeight: 700 }}
                  >
                    بيع: {sellTotal.toFixed(2)}
                  </span>
                  <button
                    style={btn("#1a3a7a")}
                    onClick={() => handlePrint(monthLabel, items)}
                  >
                    🖨️ طباعة
                  </button>
                </div>
              </div>
              <ItemsTable items={items} />
            </div>
          );
        })()}
    </div>
  );
}
