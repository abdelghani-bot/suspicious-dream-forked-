import { useState } from "react";
import { COLORS, SHADOW } from "../theme";

// ======================== Expiry Report ==========================
export function ExpiryReport({ products, onRemoveExpired }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showExpiredDetail, setShowExpiredDetail] = useState(false);
  const [customMonth, setCustomMonth] = useState(""); // "YYYY-MM" - أي شهر يختاره المستخدم

  // ===== flatten الأصناف مع batches — من المخزون الحالي الفعلي (وقت البحث) =====
  // بنبني القايمة من products[].batches بدل فواتير الشراء، عشان لو الصنف اتباع
  // (والكمية في التشغيلة بقت صفر) ميفضلش ظاهر في التقرير غلط.
  const allItems = (products ?? []).flatMap((p) =>
    (p.batches ?? [])
      .filter((b) => b.expiry_date && (b.qty ?? 0) > 0)
      .map((b, idx) => ({
        id: `${p.id}::${b.batch_number || idx}::${b.expiry_date}`,
        productId: p.id,
        name: p.name,
        barcode: p.barcode ?? "-",
        expiry: b.expiry_date,
        stock: b.qty ?? 0,
        cost: b.cost ?? p.cost ?? 0,
        price: b.salePrice ?? p.price ?? 0,
        batchNumber: b.batch_number || null,
      }))
  );

  // ===== الأصناف المنتهية =====
  const expired = allItems.filter(
    (p) => p.expiry && new Date(p.expiry) < today
  );

  // ===== 6 أشهر قادمة (اختصار سريع) =====
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

  // بيرجع أصناف أي شهر (ماضي أو مستقبل) حسب المخزون الحالي وقت البحث
  const getMonthItems = (key) =>
    allItems.filter((p) => p.expiry && p.expiry.startsWith(key));

  const formatMonthLabel = (key) => {
    if (!key) return "";
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("ar-EG", {
      month: "long",
      year: "numeric",
    });
  };

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
  // ملحوظة: الكروت كانت شفافة (backdropFilter blur) على افتراض خلفية غامقة —
  // مع الثيم الفاتح الحالي الخلفية والسطح قريبين جدًا في اللون فبقت الكروت
  // شبه مختفية. استبدلناها بخلفية صريحة + ظل، زي باقي شاشات البرنامج.
  const card = (borderColor = COLORS.border) => ({
    background: COLORS.surface,
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: SHADOW.card,
  });

  const btn = (bg = COLORS.border) => ({
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
        <tr style={{ background: COLORS.surfaceAlt }}>
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
                color: COLORS.textDim,
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
          <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <td
              style={{
                padding: "8px 12px",
                color: COLORS.textPrimary,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {p.name}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.textDim, fontSize: 11 }}>
              {p.barcode || "-"}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.coral, fontSize: 13 }}>
              {p.expiry}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              {p.stock}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.gold, fontSize: 13 }}>
              {(p.cost || 0).toFixed(2)}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.green, fontSize: 13 }}>
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
      <div style={{ ...card(COLORS.red), marginBottom: 24 }}>
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
              color: COLORS.red,
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
                  style={btn(COLORS.border)}
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
              <span style={{ color: COLORS.border, fontSize: 13 }}>
                لا يوجد أصناف منتهية
              </span>
            )}
          </div>
        </div>
        {showExpiredDetail && expired.length > 0 && (
          <ItemsTable items={expired} />
        )}
      </div>

      {/* ===== بحث بأي شهر ===== */}
      <div style={{ ...card(COLORS.border), marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary }}>
          🔍 بحث بشهر معيّن
        </span>
        <input
          type="month"
          value={customMonth}
          onChange={(e) => setCustomMonth(e.target.value)}
          style={{
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "7px 10px",
            color: COLORS.textPrimary,
            fontSize: 13,
          }}
        />
        {customMonth && (
          <button style={btn(COLORS.border)} onClick={() => setCustomMonth("")}>
            ✖ مسح
          </button>
        )}
        <span style={{ color: COLORS.textDim, fontSize: 12 }}>
          النتيجة بتتحسب من المخزون الحالي وقت البحث (مش من فواتير الشراء)
        </span>
      </div>

      {customMonth &&
        (() => {
          const items = getMonthItems(customMonth);
          const { costTotal, sellTotal } = calcTotals(items);
          const label = formatMonthLabel(customMonth);
          return (
            <div style={{ ...card(COLORS.blue), marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <h4 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 14 }}>
                  📋 أصناف {label} ({items.length} صنف)
                </h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700 }}>
                    تكلفة: {costTotal.toFixed(2)}
                  </span>
                  <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>
                    بيع: {sellTotal.toFixed(2)}
                  </span>
                  {items.length > 0 && (
                    <button style={btn("#1a3a7a")} onClick={() => handlePrint(label, items)}>
                      🖨️ طباعة
                    </button>
                  )}
                </div>
              </div>
              {items.length > 0 ? (
                <ItemsTable items={items} />
              ) : (
                <div style={{ color: COLORS.textDim, fontSize: 13, marginTop: 8 }}>
                  لا يوجد أصناف بمخزون حالي منتهية الصلاحية في هذا الشهر
                </div>
              )}
            </div>
          );
        })()}

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
                  isExpanded ? COLORS.blue : hasItems ? COLORS.borderStrong : COLORS.border
                ),
                cursor: hasItems ? "pointer" : "default",
                opacity: hasItems ? 1 : 0.45,
                transition: "border-color 0.2s",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: COLORS.textPrimary,
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
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
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
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                    قيمة التكلفة
                  </span>
                  <span
                    style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}
                  >
                    {costTotal.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                    قيمة البيع
                  </span>
                  <span
                    style={{ color: COLORS.green, fontWeight: 700, fontSize: 13 }}
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
                    color: COLORS.textDim,
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
            <div style={card(COLORS.blue)}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <h4 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 14 }}>
                  📋 أصناف {monthLabel}
                </h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700 }}
                  >
                    تكلفة: {costTotal.toFixed(2)}
                  </span>
                  <span
                    style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}
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



// ===== 🆕 بطاقة مجموعة أصناف مكررة (نفس الباركود) — اختيار الصنف المحتفظ به وتنفيذ الدمج =====
export function MergeGroupCard({ group, saving, onMerge }) {
  const [keepId, setKeepId] = useState(
    // افتراضيًا نقترح الصنف صاحب أكبر كمية (غالبًا الأقدم/الأكتر استخدامًا)
    group.products.reduce((best, p) => ((p.stock || 0) > (best.stock || 0) ? p : best), group.products[0]).id
  );
  const totalQty = group.products.reduce((s, p) => s + (p.stock || 0), 0);

  return (
    <div style={{ background: COLORS.goldSoft, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12.5, color: COLORS.textDim }}>
        باركود <b>{group.barcode}</b> — {group.products.length} سجل، إجمالي الكمية بعد الدمج: <b>{totalQty}</b>
      </div>
      {group.products.map((p) => (
        <label
          key={p.id}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
            borderRadius: 8, background: keepId === p.id ? "#eaf7ee" : COLORS.surface,
            border: `1px solid ${keepId === p.id ? COLORS.green : COLORS.border}`, cursor: "pointer",
          }}
        >
          <input type="radio" name={`merge-${group.barcode}`} checked={keepId === p.id} onChange={() => setKeepId(p.id)} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>
            الكمية: {p.stock || 0} — {(p.batches || []).length > 0 ? `${p.batches.length} تشغيلة` : "بدون تشغيلات"}
          </div>
          {keepId === p.id && <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.green }}>✓ هيتم الاحتفاظ به</span>}
        </label>
      ))}
      <button
        onClick={() => onMerge(keepId, group.products.filter((p) => p.id !== keepId).map((p) => p.id))}
        disabled={saving}
        style={{
          alignSelf: "flex-start", background: COLORS.accent, color: COLORS.accentText, border: "none",
          borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1, fontSize: 12.5,
        }}
      >
        {saving ? "جارٍ الدمج..." : "🔗 دمج هذه المجموعة"}
      </button>
    </div>
  );
}
