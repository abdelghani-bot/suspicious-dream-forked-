import { useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SHADOW } from "../theme";
import { logAudit } from "../lib/auditLog";
import { todayLocal } from "../lib/dateUtils";
import { MergeGroupCard } from "./ExpiryReport";
import { Modal, Table } from "../ui/primitives";

// ==================== كشف المخزون (Inventory Statement) ====================
// تقرير سريع بكل الأصناف والتشغيلات الموجودة فعليًا بالمخزون (كمية + تاريخ صلاحية +
// سعر تكلفة + سعر بيع)، بالإضافة لإمكانية عمل "تسوية سريعة" لكمية/صلاحية صنف واحد
// من غير المرور بدورة جرد كاملة. مختلف عن "الجرد" اللي بيغطي كل الأصناف بشكل منهجي
// دوري، هنا التركيز على عرض سريع + تصحيح فردي لصنف بعينه.
export function InventoryStatement({
  products,
  setProducts,
  showToast,
  pharmacyId,
  currentUser,
  canEdit = true,
}) {
  const [search, setSearch] = useState("");
  const [editingRow, setEditingRow] = useState(null); // الصف اللي بيتعمله تسوية دلوقتي (وضع التشغيلة)
  const [adjQty, setAdjQty] = useState("");
  const [adjExpiry, setAdjExpiry] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [saving, setSaving] = useState(false);

  // ===== 🆕 وضع العرض: حسب التشغيلة (الأصلي) أو حسب الصنف (تجميعي) =====
  const [viewMode, setViewMode] = useState("batch"); // "batch" | "grouped"
  const [expandedProducts, setExpandedProducts] = useState({}); // {productId: bool} — فتح/قفل تفاصيل التشغيلات تحت كل صنف

  // ===== 🆕 تسوية على مستوى الصنف كامل (وضع التجميع) =====
  const [settlingProduct, setSettlingProduct] = useState(null); // group اللي بيتعمله تسوية دلوقتي
  const [itemAdjQty, setItemAdjQty] = useState(""); // بيتستخدم بس للأصناف اللي من غير تشغيلات (رقم واحد)
  const [itemAdjNote, setItemAdjNote] = useState("");
  // 🆕 بدل الـ dropdown القديم (اختيار تشغيلة واحدة تتحط عليها الزيادة): سطر كمية+صلاحية قابل للتعديل لكل تشغيلة موجودة،
  // بالظبط زي ما المستخدم شايف العلب الفعلية قدامه — كل تشغيلة بكميتها وتاريخها الحقيقيين، بدل ما يدخل رقم إجمالي واحد.
  // كل سطر: { key, batchIndex (null لو سطر جديد), expiry, qty }
  const [itemBatchRows, setItemBatchRows] = useState([]);

  // ===== بناء صفوف الكشف من batches كل صنف (أو من stock لو الصنف من غير تشغيلات) =====
  const allRows = (products ?? []).flatMap((p) => {
    const batches = (p.batches || []).filter((b) => (b.qty ?? 0) > 0);
    if (batches.length > 0) {
      return batches.map((b) => {
        const batchIndex = (p.batches || []).indexOf(b);
        return {
          key: `${p.id}::${batchIndex}`,
          productId: p.id,
          batchIndex,
          name: p.name,
          barcode: p.barcode ?? "-",
          expiry: b.expiry_date || null,
          stock: b.qty ?? 0,
          cost: b.cost ?? p.cost ?? 0,
          price: b.salePrice ?? p.price ?? 0,
          batchNumber: b.batch_number || null,
        };
      });
    }
    if ((p.stock ?? 0) > 0) {
      return [{
        key: `${p.id}::none`,
        productId: p.id,
        batchIndex: null,
        name: p.name,
        barcode: p.barcode ?? "-",
        expiry: null,
        stock: p.stock ?? 0,
        cost: p.cost ?? 0,
        price: p.price ?? 0,
        batchNumber: null,
      }];
    }
    return [];
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? allRows.filter(
        (r) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.barcode || "").toLowerCase().includes(q)
      )
    : allRows;

  const totals = filtered.reduce(
    (acc, r) => {
      acc.qty += r.stock;
      acc.cost += (r.cost || 0) * (r.stock || 0);
      acc.sell += (r.price || 0) * (r.stock || 0);
      return acc;
    },
    { qty: 0, cost: 0, sell: 0 }
  );

  // ===== 🆕 تجميع الصفوف حسب الصنف (وضع "حسب الصنف") =====
  // كل صنف بيبقى ليه سطر واحد بالكمية الإجمالية، وتحته تفاصيل التشغيلات (لو أكتر من واحدة)
  // مرتبة بالأقرب لتاريخ الانتهاء الأول (نفس منطق البيع FIFO على الصلاحية).
  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      if (!map.has(r.productId)) {
        map.set(r.productId, {
          productId: r.productId,
          name: r.name,
          barcode: r.barcode,
          batches: [],
          totalQty: 0,
          totalCost: 0,
          totalSell: 0,
        });
      }
      const g = map.get(r.productId);
      g.batches.push(r);
      g.totalQty += r.stock || 0;
      g.totalCost += (r.cost || 0) * (r.stock || 0);
      g.totalSell += (r.price || 0) * (r.stock || 0);
    }
    const groups = Array.from(map.values());
    for (const g of groups) {
      g.batches.sort((a, b) => {
        if (!a.expiry && !b.expiry) return 0;
        if (!a.expiry) return 1; // من غير صلاحية آخر الترتيب
        if (!b.expiry) return -1;
        return a.expiry.localeCompare(b.expiry); // الأقرب انتهاء الأول
      });
    }
    return groups;
  }, [filtered]);

  // ===== 🆕 كشف الأصناف المكررة (نفس الباركود، أصناف مختلفة في قاعدة البيانات) =====
  // بيحصل لما فاتورة شراء تتسجل ومتلقاش تطابق بالباركود مع الصنف الموجود، فتعمل صنف
  // جديد بدل ما تضيف تشغيلة للصنف القديم. النتيجة: نفس الدواء ظاهر في أكتر من سطر
  // حتى في وضع "حسب الصنف"، لأنهم فعليًا Product IDs مختلفة مش تشغيلات لصنف واحد.
  const duplicateGroups = useMemo(() => {
    const map = new Map();
    for (const p of products ?? []) {
      const bc = (p.barcode || "").trim();
      if (!bc) continue; // من غير باركود مفيش أساس نجمع عليه
      if (!map.has(bc)) map.set(bc, []);
      map.get(bc).push(p);
    }
    return Array.from(map.entries())
      .filter(([, list]) => list.length > 1)
      .map(([barcode, list]) => ({ barcode, products: list }));
  }, [products]);

  const [showMergeTool, setShowMergeTool] = useState(false);

  // ===== طباعة =====
  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>كشف المخزون</title>
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
<h2>كشف المخزون</h2>
<div class="sub">${todayLocal()} — ${filtered.length} سطر</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>اسم الصنف</th><th>الباركود</th>
      <th>تاريخ الانتهاء</th><th>الكمية</th>
      <th>سعر التكلفة</th><th>سعر البيع</th>
      <th>إجمالي التكلفة</th><th>إجمالي البيع</th>
    </tr>
  </thead>
  <tbody>
    ${filtered
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
  <div class="tot">إجمالي الكمية: ${totals.qty}</div>
  <div class="tot">إجمالي التكلفة: ${totals.cost.toFixed(2)}</div>
  <div class="tot">إجمالي البيع: ${totals.sell.toFixed(2)}</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
    win.document.close();
    };

  // ===== فتح مودال التسوية =====
  const openAdjust = (row) => {
    setEditingRow(row);
    setAdjQty(String(row.stock));
    setAdjExpiry(row.expiry || "");
    setAdjNote("");
    };

    // ── قفل تلقائي لأي حالة "pending" في سجل الفروقات لنفس الصنف بعد تسوية ناجحة ──
    // مش بديل عن قرار المدير — ده *هو* قرار المدير (بيسوي الكمية دلوقتي فعليًا)،
    // فمينفعش يتحط في حالة "معلّق" وهو بالفعل اتصلّح قدامنا.
    const resolveVarianceLogForProduct = async (productId: string, resolutionNote: string) => {
        try {
            const { error } = await supabase
                .from("inventory_variance_log")
                .update({
                    status: "resolved",
                    resolved_by: currentUser?.name || null,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: resolutionNote,
                })
                .eq("pharmacy_id", pharmacyId)
                .eq("product_id", productId)
                .eq("status", "pending");
            if (error) throw error;
        } catch (err) {
            console.error("resolveVarianceLogForProduct failed:", err);
    // مش بنعمل showToast هنا عمدًا — التسوية الأساسية نجحت فعلاً، وده مجرد تنظيف
    // إضافي. لو فشل، السجل هيفضل "pending" والمدير هيلاقيه لسه في الداشبورد،
    // ومش هيضر لأنه أصلاً هيبقى متسوّى فعليًا لو حد راجعه يدويًا بعد كده.
        }
    };

  // ===== حفظ التسوية =====
  const saveAdjustment = async () => {
    if (!editingRow) return;
    const newQty = Number(adjQty);
    if (Number.isNaN(newQty) || newQty < 0) {
      showToast("❌ اكتب كمية صحيحة", "error");
      return;
    }
    setSaving(true);
    try {
      const prod = products.find((p) => p.id === editingRow.productId);
      if (!prod) throw new Error("الصنف غير موجود");

      const currentBatches = [...(prod.batches || [])];
      let updatedBatches;
      if (editingRow.batchIndex != null && currentBatches[editingRow.batchIndex]) {
        updatedBatches = currentBatches.map((b, idx) =>
          idx === editingRow.batchIndex
            ? { ...b, qty: newQty, expiry_date: adjExpiry || null }
            : b
        );
      } else {
        updatedBatches = [
          ...currentBatches,
          {
            qty: newQty,
            cost: prod.cost || 0,
            salePrice: prod.price || 0,
            expiry_date: adjExpiry || null,
            date: todayLocal(),
          },
        ];
      }
      updatedBatches = updatedBatches.filter((b) => (b.qty ?? 0) > 0);
      const newStock = updatedBatches.reduce((s, b) => s + (b.qty || 0), 0);

      const { error } = await supabase
        .from("products")
        .update({ stock: newStock, batches: updatedBatches })
        .eq("id", prod.id)
        .eq("pharmacy_id", pharmacyId);
      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id ? { ...p, stock: newStock, batches: updatedBatches } : p
        )
      );

      const diff = newQty - editingRow.stock;
      const logData = {
        id: "INV-ADJ-" + Date.now(),
        date: todayLocal(),
        type: "تسوية سريعة",
        items: [
          {
            id: prod.id,
            name: prod.name,
            expiry: adjExpiry || null,
            systemQty: editingRow.stock,
            actualQty: newQty,
            diff,
          },
        ],
        notes: adjNote || null,
        by: currentUser?.name,
        pharmacy_id: pharmacyId,
      };
      await supabase.from("inventory_logs").insert([logData]);
      if (diff !== 0) {
        await supabase.from("inventory_adjustments").insert([{
          inventory_log_id: logData.id,
          product_id: prod.id,
          quantity: diff,
          date: logData.date,
          created_by: currentUser?.name,
          pharmacy_id: pharmacyId,
        }]);
      }

      logAudit({
        pharmacyId,
        userName: currentUser?.name,
        action: "update",
        entityType: "product",
        entityId: prod.id,
        entityLabel: prod.name,
        oldValue: { qty: editingRow.stock, expiry: editingRow.expiry },
        newValue: { qty: newQty, expiry: adjExpiry || null },
        description:
          `تسوية سريعة من كشف المخزون: ${prod.name} — الكمية من ${editingRow.stock} إلى ${newQty}` +
          (editingRow.expiry !== (adjExpiry || null)
            ? `، الصلاحية من ${editingRow.expiry || "-"} إلى ${adjExpiry || "-"}`
            : "") +
          (adjNote ? ` — ملاحظة: ${adjNote}` : ""),
      });

        await resolveVarianceLogForProduct(
            prod.id,
            `اتقفلت تلقائيًا بعد تسوية سريعة من كشف المخزون (${editingRow.stock} → ${newQty})`
        );

        await resolveVarianceLogForProduct(
            prod.id,
            `اتقفلت تلقائيًا بعد تسوية سريعة من كشف المخزون (${editingRow.stock} → ${newQty})`
        );

        showToast("✅ تم حفظ التسوية وتحديث المخزون");
        setEditingRow(null);
    } catch (e: any) {
      showToast("❌ خطأ في حفظ التسوية: " + (e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  // ===== 🆕 فتح مودال التسوية على مستوى الصنف كامل (وضع التجميع) =====
  // بدل رقم إجمالي واحد: بنجهّز سطر مستقل لكل تشغيلة موجودة (كمية + صلاحية) عشان المستخدم
  // يعدّل كل تشغيلة بالكمية الفعلية اللي عدّها، بالظبط زي ما هو شايف العلب قدامه.
  const openItemSettle = (group) => {
    setSettlingProduct(group);
    const hasBatches = group.batches.some((b) => b.batchIndex != null);
    if (hasBatches) {
      setItemBatchRows(
        group.batches
          .filter((b) => b.batchIndex != null)
          .map((b) => ({ key: b.key, batchIndex: b.batchIndex, expiry: b.expiry || "", qty: String(b.stock) }))
      );
    } else {
      setItemAdjQty(String(group.totalQty)); // صنف من غير تشغيلات — رقم واحد زي الأول
      setItemBatchRows([]);
    }
    setItemAdjNote("");
  };

  // 🆕 إضافة سطر تشغيلة/صلاحية جديدة فاضي (للكمية الزيادة اللي مالهاش تشغيلة موجودة أصلاً)
  const addItemBatchRow = () => {
    setItemBatchRows((prev) => [...prev, { key: "new-" + Date.now(), batchIndex: null, expiry: "", qty: "" }]);
  };
  const updateItemBatchRow = (key, field, value) => {
    setItemBatchRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };
  // حذف سطر (بيتصفّر — التصفير بيشيله فعليًا وقت الحفظ)
  const removeItemBatchRow = (key) => {
    setItemBatchRows((prev) => prev.filter((r) => r.key !== key));
  };

  // ===== 🆕 حفظ التسوية على مستوى الصنف كامل =====
  // نفس مبدأ التعامل مع النقص اتطبّق على الزيادة كمان: مفيش تخمين ولا اختيار من قائمة —
  // المستخدم بيكتب الكمية الفعلية وتاريخ الصلاحية اللي شايفهم قدامه لكل تشغيلة (سواء كانت موجودة
  // أو جديدة كليًا). لو الصلاحية اللي كتبها تطابق تشغيلة موجودة، الفرق (زيادة أو نقص) يتحط عليها
  // مباشرة. لو الصلاحية جديدة تمامًا، يتفتح لها سطر تشغيلة جديد بالكمية والتاريخ زي ما دخلهم.
  const saveItemSettlement = async () => {
    if (!settlingProduct) return;
    const hasBatches = settlingProduct.batches.some((b) => b.batchIndex != null);

    setSaving(true);
    try {
      const prod = products.find((p) => p.id === settlingProduct.productId);
      if (!prod) throw new Error("الصنف غير موجود");

      let updatedBatches;
      let newTotal;
      const batchChanges = []; // لتسجيلها في اللوج (تفاصيل التغيير لكل صلاحية)

      if (!hasBatches) {
        // ===== صنف من غير تشغيلات — نفس التعامل القديم، رقم واحد مباشر =====
        newTotal = Number(itemAdjQty);
        if (Number.isNaN(newTotal) || newTotal < 0) {
          showToast("❌ اكتب كمية صحيحة", "error");
          setSaving(false);
          return;
        }
        updatedBatches = prod.batches || [];
      } else {
        // ===== التحقق: كل سطر بيه كمية لازم رقم صحيح =====
        for (const row of itemBatchRows) {
          const q = Number(row.qty);
          if (row.qty !== "" && (Number.isNaN(q) || q < 0)) {
            showToast("❌ فيه كمية غير صحيحة في أحد السطور", "error");
            setSaving(false);
            return;
          }
        }

        // دمج السطور اللي بنفس الصلاحية (لو المستخدم غيّر صلاحية سطر موجود لتطابق سطر تاني، أو ضاف سطر جديد بصلاحية موجودة أصلاً)
        const mergedMap = new Map(); // key: الصلاحية (أو "" لبلا صلاحية) → { expiry, qty, cost, salePrice, batch_number, date }
        for (const row of itemBatchRows) {
          const q = Number(row.qty) || 0;
          if (q <= 0) continue; // سطر فاضي أو اتصفّر — بيتشال فعليًا
          const key = row.expiry || "";
          const template = row.batchIndex != null ? prod.batches?.[row.batchIndex] : null;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, {
              expiry: row.expiry || null,
              qty: 0,
              cost: template?.cost ?? prod.cost ?? 0,
              salePrice: template?.salePrice ?? prod.price ?? 0,
              batch_number: template?.batch_number ?? null,
              date: template?.date ?? todayLocal(),
            });
          }
          mergedMap.get(key).qty += q;
        }

        // التشغيلات اللي مالهاش دخل بالصنف ده أصلاً (نظريًا مفيش، لكن للأمان لو فيه تشغيلات صفرية قديمة في الداتا)
        const groupIndices = new Set(
          settlingProduct.batches.filter((b) => b.batchIndex != null).map((b) => b.batchIndex)
        );
        const untouchedBatches = (prod.batches || []).filter((b, idx) => !groupIndices.has(idx));

        const newBatchesForGroup = Array.from(mergedMap.values()).map((m) => ({
          qty: m.qty, cost: m.cost, salePrice: m.salePrice, batch_number: m.batch_number,
          expiry_date: m.expiry, date: m.date,
        }));

        updatedBatches = [...untouchedBatches, ...newBatchesForGroup].filter((b) => (b.qty ?? 0) > 0);
        newTotal = updatedBatches.reduce((s, b) => s + (b.qty || 0), 0);

        // ===== بناء تفاصيل التغيير لكل صلاحية (لملف اللوج) — مقارنة القديم بالجديد لكل مفتاح صلاحية =====
        const oldByExpiry = new Map();
        for (const b of settlingProduct.batches) {
          if (b.batchIndex == null) continue;
          const key = b.expiry || "";
          oldByExpiry.set(key, (oldByExpiry.get(key) || 0) + (b.stock || 0));
        }
        const allKeys = new Set([...oldByExpiry.keys(), ...mergedMap.keys()]);
        for (const key of allKeys) {
          const from = oldByExpiry.get(key) || 0;
          const to = mergedMap.has(key) ? mergedMap.get(key).qty : 0;
          if (from !== to) {
            batchChanges.push({ expiry: key || null, from, to, isNew: !oldByExpiry.has(key) });
          }
        }
      }

      const diff = newTotal - settlingProduct.totalQty;
      const newStock = newTotal;

      const { error } = await supabase
        .from("products")
        .update({ stock: newStock, batches: updatedBatches })
        .eq("id", prod.id)
        .eq("pharmacy_id", pharmacyId);
      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id ? { ...p, stock: newStock, batches: updatedBatches } : p
        )
      );

      const logData = {
        id: "INV-ADJ-" + Date.now(),
        date: todayLocal(),
        type: "تسوية سريعة (صنف كامل)",
        items: [
          {
            id: prod.id,
            name: prod.name,
            systemQty: settlingProduct.totalQty,
            actualQty: newTotal,
            diff,
            batchChanges,
          },
        ],
        notes: itemAdjNote || null,
        by: currentUser?.name,
        pharmacy_id: pharmacyId,
      };
      await supabase.from("inventory_logs").insert([logData]);
      if (diff !== 0) {
        await supabase.from("inventory_adjustments").insert([{
          inventory_log_id: logData.id,
          product_id: prod.id,
          quantity: diff,
          date: logData.date,
          created_by: currentUser?.name,
          pharmacy_id: pharmacyId,
        }]);
      }

      logAudit({
        pharmacyId,
        userName: currentUser?.name,
        action: "update",
        entityType: "product",
        entityId: prod.id,
        entityLabel: prod.name,
        oldValue: { qty: settlingProduct.totalQty },
        newValue: { qty: newTotal },
        description:
          `تسوية صنف كامل من كشف المخزون: ${prod.name} — الكمية الإجمالية من ${settlingProduct.totalQty} إلى ${newTotal}` +
          (batchChanges.length ? ` — تفاصيل: ${batchChanges.map((c) => `${c.expiry || "بلا صلاحية"} من ${c.from} إلى ${c.to}`).join("، ")}` : "") +
          (itemAdjNote ? ` — ملاحظة: ${itemAdjNote}` : ""),
      });

        await resolveVarianceLogForProduct(
            prod.id,
            `اتقفلت تلقائيًا بعد تسوية صنف كامل من كشف المخزون (${settlingProduct.totalQty} → ${newTotal})`
        );

        showToast("✅ تم حفظ تسوية الصنف وتحديث المخزون");
        setSettlingProduct(null);
    } catch (e: any) {
      showToast("❌ خطأ في حفظ التسوية: " + (e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  // ===== 🆕 دمج أصناف مكررة (نفس الباركود) في صنف واحد =====
  // keepId: الصنف اللي هيفضل موجود، duplicateIds: الأصناف اللي هتتحذف بعد نقل تشغيلاتها.
  // - بندمج التشغيلات (batches) لكل الأصناف في صنف واحد (وبندمج التشغيلات اللي بنفس الصلاحية مع بعضها).
  // - بننقل أي سجلات مرتبطة بالـ product_id القديم (باركودات إضافية، مكونات فعالة، أكواد موردين،
  //   مبيعات مفقودة، سيريالات مباعة، منتجات حافز) للصنف الباقي، عشان متتيتمش.
  // - سجلات المبيعات/المشتريات/المرتجعات القديمة بتخزن الصنف كـ JSON مدمج جوه الفاتورة نفسها
  //   (اسم + سعر وقت البيع) مش رابط منفصل، فمش محتاجة تحديث — بتفضل تتعرض صح زي ما كانت.
  const mergeDuplicateProducts = async (keepId, duplicateIds) => {
    const keepProduct = products.find((p) => p.id === keepId);
    const dupProducts = products.filter((p) => duplicateIds.includes(p.id));
    if (!keepProduct || dupProducts.length === 0) return;

    const confirmed = window.confirm(
      `هيتم دمج ${dupProducts.length} صنف مكرر داخل "${keepProduct.name}" ونقل كل تشغيلاتهم، وحذف السجلات المكررة نهائيًا. متأكد؟`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      // ===== دمج التشغيلات كلها (الصنف الباقي + كل الأصناف المكررة) في مصفوفة واحدة، بدمج نفس الصلاحية =====
      const allSources = [keepProduct, ...dupProducts];
      const mergedMap = new Map(); // key: الصلاحية (أو "" لبلا صلاحية)
      for (const src of allSources) {
        const srcBatches = (src.batches || []).length > 0
          ? src.batches
          : (src.stock ?? 0) > 0
            ? [{ qty: src.stock, cost: src.cost || 0, salePrice: src.price || 0, expiry_date: null, date: todayLocal() }]
            : [];
        for (const b of srcBatches) {
          const q = Number(b.qty) || 0;
          if (q <= 0) continue;
          const key = b.expiry_date || "";
          if (!mergedMap.has(key)) {
            mergedMap.set(key, {
              qty: 0, cost: b.cost ?? src.cost ?? 0, salePrice: b.salePrice ?? src.price ?? 0,
              batch_number: b.batch_number ?? null, expiry_date: b.expiry_date || null, date: b.date || todayLocal(),
            });
          }
          mergedMap.get(key).qty += q;
        }
      }
      const mergedBatches = Array.from(mergedMap.values()).filter((b) => b.qty > 0);
      const mergedStock = mergedBatches.reduce((s, b) => s + b.qty, 0);

      const { error: updErr } = await supabase
        .from("products")
        .update({ stock: mergedStock, batches: mergedBatches })
        .eq("id", keepId)
        .eq("pharmacy_id", pharmacyId);
      if (updErr) throw updErr;

      // ===== نقل السجلات المرتبطة بالـ product_id القديم للصنف الباقي =====
      const linkedTables = ["product_barcodes", "product_ingredients", "supplier_product_codes", "missed_sales", "sold_serials", "incentive_products"];
      for (const dupId of duplicateIds) {
        for (const table of linkedTables) {
          await supabase.from(table).update({ product_id: keepId }).eq("product_id", dupId).eq("pharmacy_id", pharmacyId);
        }
      }

      // ===== حذف سجلات الأصناف المكررة =====
      const { error: delErr } = await supabase
        .from("products")
        .delete()
        .in("id", duplicateIds)
        .eq("pharmacy_id", pharmacyId);
      if (delErr) throw delErr;

      setProducts((prev) =>
        prev
          .filter((p) => !duplicateIds.includes(p.id))
          .map((p) => (p.id === keepId ? { ...p, stock: mergedStock, batches: mergedBatches } : p))
      );

      logAudit({
        pharmacyId,
        userName: currentUser?.name,
        action: "update",
        entityType: "product",
        entityId: keepId,
        entityLabel: keepProduct.name,
        oldValue: { qty: keepProduct.stock },
        newValue: { qty: mergedStock },
        description: `دمج ${dupProducts.length} صنف مكرر (نفس الباركود ${keepProduct.barcode}) داخل "${keepProduct.name}" — الكمية الإجمالية بعد الدمج: ${mergedStock}`,
      });

      showToast(`✅ تم دمج ${dupProducts.length} صنف مكرر بنجاح`);
    } catch (e: any) {
      showToast("❌ خطأ في الدمج: " + (e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  const card = {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 16,
    boxShadow: SHADOW.card,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>كشف المخزون</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* 🆕 تبديل وضع العرض */}
          <div style={{ display: "flex", border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("batch")}
              style={{
                background: viewMode === "batch" ? COLORS.accent : "transparent",
                color: viewMode === "batch" ? COLORS.accentText : COLORS.textPrimary,
                border: "none", padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              حسب التشغيلة
            </button>
            <button
              onClick={() => setViewMode("grouped")}
              style={{
                background: viewMode === "grouped" ? COLORS.accent : "transparent",
                color: viewMode === "grouped" ? COLORS.accentText : COLORS.textPrimary,
                border: "none", padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              حسب الصنف
            </button>
          </div>
          {canEdit && duplicateGroups.length > 0 && (
            <button
              onClick={() => setShowMergeTool(true)}
              style={{
                background: "#fdecea", color: COLORS.red, border: `1px solid ${COLORS.red}`,
                borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13,
              }}
            >
              🔗 دمج {duplicateGroups.length} صنف مكرر
            </button>
          )}
          <button
            onClick={handlePrint}
            style={{
              background: COLORS.accent, color: COLORS.accentText, border: "none",
              borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13,
            }}
          >
            🖨️ طباعة الكشف
          </button>
        </div>
      </div>

      <div style={{ ...card, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: COLORS.textDim, fontSize: 12 }}>عدد الأسطر</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{filtered.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: COLORS.textDim, fontSize: 12 }}>إجمالي الكمية</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totals.qty}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: COLORS.textDim, fontSize: 12 }}>إجمالي قيمة التكلفة</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totals.cost.toFixed(0)} ر.س</div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: COLORS.textDim, fontSize: 12 }}>إجمالي قيمة البيع</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totals.sell.toFixed(0)} ر.س</div>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث باسم الصنف أو الباركود..."
        style={{
          padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
          background: COLORS.surface, color: COLORS.textPrimary, fontSize: 14,
        }}
      />

      {viewMode === "batch" ? (
        <Table
          headers={["الصنف", "الباركود", "رقم التشغيلة", "تاريخ الانتهاء", "الكمية", "سعر التكلفة", "سعر البيع", "إجراءات"]}
          rows={filtered.map((r) => [
            r.name,
            r.barcode,
            r.batchNumber || "-",
            r.expiry || "-",
            r.stock,
            (r.cost || 0).toFixed(2),
            (r.price || 0).toFixed(2),
            canEdit ? (
              <button
                key={r.key}
                onClick={() => openAdjust(r)}
                style={{
                  background: COLORS.goldSoft, color: COLORS.gold, border: "none",
                  borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                }}
              >
                ⚖️ تسوية
              </button>
            ) : "-",
          ])}
          emptyMsg="لا توجد أصناف بالمخزون"
        />
      ) : (
        // ===== 🆕 وضع "حسب الصنف": سطر واحد لكل صنف بالكمية الإجمالية + تفاصيل تشغيلات قابلة للطي =====
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groupedRows.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: COLORS.textDim, padding: 24 }}>
              لا توجد أصناف بالمخزون
            </div>
          ) : (
            groupedRows.map((g) => {
              const isExpanded = !!expandedProducts[g.productId];
              const hasMultiple = g.batches.length > 1;
              return (
                <div key={g.productId} style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                      flexWrap: "wrap", cursor: hasMultiple ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (!hasMultiple) return;
                      setExpandedProducts((prev) => ({ ...prev, [g.productId]: !prev[g.productId] }));
                    }}
                  >
                    <span style={{ fontSize: 13, color: COLORS.textDim, width: 16, textAlign: "center" }}>
                      {hasMultiple ? (isExpanded ? "▾" : "▸") : ""}
                    </span>
                    <div style={{ flex: "2 1 200px", fontWeight: 700, fontSize: 14 }}>{g.name}</div>
                    <div style={{ flex: "1 1 120px", fontSize: 12, color: COLORS.textDim }}>{g.barcode}</div>
                    <div style={{ flex: "1 1 90px", fontSize: 12, color: COLORS.textDim }}>
                      {hasMultiple ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span>{g.batches.length} تشغيلة</span>
                          <span>{new Set(g.batches.map((b) => b.expiry || "")).size} تاريخ صلاحية</span>
                        </div>
                      ) : (
                        g.batches[0]?.expiry || "بلا صلاحية"
                      )}
                    </div>
                    <div style={{ flex: "0 1 90px", fontWeight: 800, fontSize: 15 }}>{g.totalQty}</div>
                    <div style={{ flex: "0 1 110px", fontSize: 12, color: COLORS.textDim }}>
                      {g.totalCost.toFixed(2)} تكلفة
                    </div>
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openItemSettle(g); }}
                        style={{
                          background: COLORS.goldSoft, color: COLORS.gold, border: "none",
                          borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                        }}
                      >
                        ⚖️ تسوية الصنف
                      </button>
                    )}
                  </div>
                  {hasMultiple && isExpanded && (
                    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      {g.batches.map((b) => (
                        <div
                          key={b.key}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 40px",
                            fontSize: 12.5, borderBottom: `1px dashed ${COLORS.border}`, background: COLORS.bg || "transparent",
                          }}
                        >
                          <div style={{ flex: "1 1 110px", color: COLORS.textDim }}>
                            {b.batchNumber ? `تشغيلة ${b.batchNumber}` : "بدون رقم تشغيلة"}
                          </div>
                          <div style={{ flex: "1 1 100px" }}>{b.expiry ? `صلاحية ${b.expiry}` : "بلا صلاحية"}</div>
                          <div style={{ flex: "0 1 80px", fontWeight: 700 }}>{b.stock}</div>
                          {canEdit && (
                            <button
                              onClick={() => openAdjust(b)}
                              style={{
                                background: "transparent", color: COLORS.gold, border: `1px solid ${COLORS.gold}`,
                                borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                              }}
                            >
                              تسوية هذه التشغيلة
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ✅ Modal تسوية سريعة لكمية/صلاحية صنف */}
      <Modal open={!!editingRow} onClose={() => setEditingRow(null)} title={`تسوية — ${editingRow?.name || ""}`}>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>
            الكمية الحالية بالنظام: <b>{editingRow?.stock}</b>
            {editingRow?.expiry ? ` — صلاحية: ${editingRow.expiry}` : ""}
          </div>
          <div>
            <label style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4, display: "block" }}>الكمية الفعلية</label>
            <input
              type="number"
              value={adjQty}
              onChange={(e) => setAdjQty(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4, display: "block" }}>تاريخ الصلاحية</label>
            <input
              type="date"
              value={adjExpiry}
              onChange={(e) => setAdjExpiry(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4, display: "block" }}>ملاحظة (اختياري)</label>
            <input
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder="سبب التسوية..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
          </div>
          <button
            onClick={saveAdjustment}
            disabled={saving}
            style={{
              background: COLORS.accent, color: COLORS.accentText, border: "none",
              borderRadius: 10, padding: "12px", fontWeight: 800, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1, fontSize: 14,
            }}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ التسوية"}
          </button>
        </div>
      </Modal>

      {/* ✅ 🆕 Modal تسوية على مستوى الصنف كامل (وضع "حسب الصنف") */}
      <Modal open={!!settlingProduct} onClose={() => setSettlingProduct(null)} title={`تسوية صنف — ${settlingProduct?.name || ""}`}>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>
            الكمية الإجمالية الحالية بالنظام: <b>{settlingProduct?.totalQty}</b>
            {settlingProduct?.batches?.length > 1 ? ` — موزّعة على ${settlingProduct.batches.length} تشغيلة` : ""}
          </div>

          {settlingProduct?.batches?.some((b) => b.batchIndex != null) ? (
            // ===== 🆕 صنف بتشغيلات: سطر كمية+صلاحية قابل للتعديل لكل تشغيلة — بدل رقم إجمالي واحد =====
            // نفس المبدأ في النقص والزيادة: بتكتب الكمية الفعلية والتاريخ اللي شايفهم على العلبة قدامك.
            // لو الصلاحية اتكتبت زي تشغيلة موجودة، الفرق يتحط عليها. لو صلاحية جديدة، بتتحسب كتشغيلة جديدة تلقائيًا وقت الحفظ.
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, color: COLORS.textDim }}>الكمية الفعلية لكل تشغيلة (اللي عديتها فعليًا)</label>
              {itemBatchRows.map((row) => {
                const original = settlingProduct.batches.find((b) => b.batchIndex === row.batchIndex);
                const rowDiff = row.qty === "" ? 0 : Number(row.qty) - (original?.stock ?? 0);
                return (
                  <div key={row.key} style={{ display: "flex", gap: 8, alignItems: "center", background: COLORS.goldSoft, borderRadius: 10, padding: 8 }}>
                    <input
                      type="date"
                      value={row.expiry}
                      onChange={(e) => updateItemBatchRow(row.key, "expiry", e.target.value)}
                      style={{ flex: 1.2, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
                    />
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => updateItemBatchRow(row.key, "qty", e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}
                    />
                    {rowDiff !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: rowDiff > 0 ? COLORS.green : COLORS.red, minWidth: 36, textAlign: "center" }}>
                        {rowDiff > 0 ? `+${rowDiff}` : rowDiff}
                      </span>
                    )}
                    <button
                      onClick={() => removeItemBatchRow(row.key)}
                      title="حذف السطر (يخصم التشغيلة دي بالكامل)"
                      style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 15, padding: 4 }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addItemBatchRow}
                style={{
                  background: "transparent", border: `1px dashed ${COLORS.border}`, color: COLORS.textDim,
                  borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                }}
              >
                + إضافة تشغيلة/صلاحية جديدة (لكمية زيادة مالهاش تشغيلة موجودة)
              </button>
              {(() => {
                const newTotal = itemBatchRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
                const diff = newTotal - (settlingProduct?.totalQty ?? 0);
                if (diff === 0) return null;
                return (
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: diff > 0 ? COLORS.green : COLORS.red, textAlign: "left" }}>
                    الإجمالي الجديد: {newTotal} ({diff > 0 ? `+${diff}` : diff})
                  </div>
                );
              })()}
            </div>
          ) : (
            // ===== صنف من غير تشغيلات — نفس التعامل القديم برقم واحد =====
            <div>
              <label style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4, display: "block" }}>الكمية الفعلية (اللي عديتها) للصنف ككل</label>
              <input
                type="number"
                value={itemAdjQty}
                onChange={(e) => setItemAdjQty(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4, display: "block" }}>ملاحظة (اختياري)</label>
            <input
              value={itemAdjNote}
              onChange={(e) => setItemAdjNote(e.target.value)}
              placeholder="سبب التسوية..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 }}
            />
          </div>
          <button
            onClick={saveItemSettlement}
            disabled={saving}
            style={{
              background: COLORS.accent, color: COLORS.accentText, border: "none",
              borderRadius: 10, padding: "12px", fontWeight: 800, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1, fontSize: 14,
            }}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ تسوية الصنف"}
          </button>
        </div>
      </Modal>

      {/* ✅ 🆕 Modal دمج الأصناف المكررة (نفس الباركود) */}
      <Modal open={showMergeTool} onClose={() => setShowMergeTool(false)} title="🔗 دمج الأصناف المكررة" wide>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12.5, color: COLORS.textDim }}>
            الأصناف دي عندها نفس الباركود بس متسجلة كسجلات منفصلة في قاعدة البيانات (مش تشغيلات لصنف واحد).
            اختار الصنف اللي عايز تحتفظ بيه من كل مجموعة، وباقي الأصناف هتتحذف بعد ما تشغيلاتها تتنقل تلقائيًا للصنف المحتفظ به.
          </div>
          {duplicateGroups.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: COLORS.textDim, padding: 24 }}>
              مفيش أصناف مكررة حاليًا ✅
            </div>
          ) : (
            duplicateGroups.map((grp) => (
              <MergeGroupCard
                key={grp.barcode}
                group={grp}
                saving={saving}
                onMerge={mergeDuplicateProducts}
              />
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
