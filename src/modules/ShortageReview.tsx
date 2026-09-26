import React, { useEffect, useMemo, useState } from "react";
import {
  getZeroStockProducts,
  setProductAutoOrder,
  bulkSetAutoOrderForZeroStock,
  type ZeroStockProduct,
} from "../lib/shortageReviewAPI.ts"; // adjust path to wherever you placed shortageReviewAPI.ts

interface ShortageReviewProps {
  pharmacyId: string;
}

export default function ShortageReview({ pharmacyId }: ShortageReviewProps) {
  const [products, setProducts] = useState<ZeroStockProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<null | "hide" | "show">(null);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      setError(null);
      const data = await getZeroStockProducts(pharmacyId);
      setProducts(data);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحميل قائمة النواقص");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.name_en?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const visibleCount = useMemo(() => (products ?? []).filter((p) => p.auto_order).length, [products]);

  async function handleToggle(product: ZeroStockProduct) {
    setBusyId(product.id);
    const newValue = !product.auto_order;
    try {
      await setProductAutoOrder(product.id, newValue);
      setProducts((prev) => (prev ? prev.map((p) => (p.id === product.id ? { ...p, auto_order: newValue } : p)) : prev));
    } catch (e) {
      console.error(e);
      setError("تعذّر تحديث الصنف");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk(value: boolean) {
    setBulkBusy(value ? "show" : "hide");
    try {
      await bulkSetAutoOrderForZeroStock(pharmacyId, value);
      await load();
    } catch (e) {
      console.error(e);
      setError("تعذّر تنفيذ الإجراء الجماعي");
    } finally {
      setBulkBusy(null);
    }
  }

  if (!products) {
    return (
      <div
        dir="rtl"
        style={{ fontFamily: "'Tajawal', 'Segoe UI', sans-serif", padding: 40, textAlign: "center", color: "#5B6663" }}
      >
        جارِ تحميل القائمة...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
        background: "#F7F9F8",
        minHeight: "100%",
        padding: "28px 20px",
        color: "#16241F",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0F6B5C" }}>
            مراجعة النواقص
          </h1>
          <p style={{ fontSize: 14, color: "#5B6663", marginTop: 6, lineHeight: 1.7 }}>
            دي كل الأصناف اللي رصيدها صفر بعد الجرد الافتتاحي. حدد أي صنف تحب يظهر في طلبات الشراء
            كنقص فعلي، وأخفِ الباقي اللي مش محتاجه دلوقتي.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "#FBEAEA", color: "#A33A3A", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div
          style={{
            background: "#fff",
            border: "1px solid #DCE5E1",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "#5B6663" }}>
            {visibleCount} من {products.length} صنف ظاهر حاليًا في طلبات الشراء
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleBulk(false)}
              disabled={bulkBusy !== null}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #DCE5E1",
                cursor: bulkBusy ? "default" : "pointer",
                color: "#5B6663",
                background: "#fff",
                opacity: bulkBusy === "hide" ? 0.6 : 1,
              }}
            >
              {bulkBusy === "hide" ? "جارِ الإخفاء..." : "إخفاء الكل"}
            </button>
            <button
              onClick={() => handleBulk(true)}
              disabled={bulkBusy !== null}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #0F6B5C",
                cursor: bulkBusy ? "default" : "pointer",
                color: "#0F6B5C",
                background: "#fff",
                opacity: bulkBusy === "show" ? 0.6 : 1,
              }}
            >
              {bulkBusy === "show" ? "جارِ الإظهار..." : "إظهار الكل تاني"}
            </button>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الصنف..."
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #DCE5E1",
            fontSize: 14,
            marginBottom: 14,
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9AA6A1", fontSize: 14 }}>
            {products.length === 0 ? "مفيش أصناف رصيدها صفر حاليًا 🎉" : "مفيش نتائج مطابقة للبحث"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((p) => {
              const isBusy = busyId === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #DCE5E1",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#16241F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                    {p.name_en && (
                      <div style={{ fontSize: 12, color: "#9AA6A1" }}>{p.name_en}</div>
                    )}
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: isBusy ? "default" : "pointer",
                      flexShrink: 0,
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    <span style={{ fontSize: 12, color: p.auto_order ? "#1F6E56" : "#9AA6A1", fontWeight: 600 }}>
                      {p.auto_order ? "ظاهر في الطلبات" : "مخفي"}
                    </span>
                    <span
                      onClick={() => !isBusy && handleToggle(p)}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 999,
                        background: p.auto_order ? "#2F9E7A" : "#DCE5E1",
                        position: "relative",
                        transition: "background 0.15s ease",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          right: p.auto_order ? 20 : 2,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                          transition: "right 0.15s ease",
                        }}
                      />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
