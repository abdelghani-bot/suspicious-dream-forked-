import React, { useState } from "react";

/**
 * ShortageReviewBanner
 * ---------------------
 * Render this once, right after the opening inventory count save
 * succeeds (e.g. inside the "رصيد افتتاحي" save handler, on success).
 * Pass `count` from the same client-side products state the sidebar
 * badge already uses (products.filter(p => p.stock <= 0 && !p.shortage_reviewed_at).length)
 * so both numbers always agree — no separate fetch needed here.
 * "لاحقًا" just hides the banner for this session — it does NOT
 * mark anything reviewed, so the sidebar badge keeps reminding
 * until the pharmacist actually opens the review screen.
 */
interface ShortageReviewBannerProps {
  count: number;
  onReviewNow: () => void; // navigate to the ShortageReview screen (e.g. setTab("shortage_review"))
}

export function ShortageReviewBanner({ count, onReviewNow }: ShortageReviewBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !count || count === 0) return null;

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
        background: "#FBF1E7",
        border: "1px solid #EAD3B0",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        margin: "12px 0",
      }}
    >
      <span style={{ fontSize: 14, color: "#8A5420" }}>
        عندك <b>{count}</b> صنف رصيده صفر بعد الجرد — تحب تراجعهم دلوقتي؟
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setDismissed(true)}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: 8,
            border: "1px solid #EAD3B0",
            background: "transparent",
            color: "#8A5420",
            cursor: "pointer",
          }}
        >
          لاحقًا
        </button>
        <button
          onClick={onReviewNow}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: "#C97A2B",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          مراجعة الآن
        </button>
      </div>
    </div>
  );
}

// ملحوظة: مفيش داعي لكومبوننت badge منفصل — النظام عندك أصلاً فيه
// tabAlertCounts بيحسب رقم لكل sidebar item، فبمجرد ما تضيف
// shortage_review فيه (products.filter(p => p.stock <= 0 && !p.shortage_reviewed_at).length)
// هتظهر الـ badge تلقائي جنب "مراجعة النواقص" في الـ sidebar من غير كود إضافي.
