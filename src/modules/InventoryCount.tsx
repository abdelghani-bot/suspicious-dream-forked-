import { useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import * as XLSX from "xlsx";
import { logAudit } from "../lib/auditLog";
import { normGtin } from "../lib/barcodeUtils";
import { todayLocal } from "../lib/dateUtils";
import { Badge, Btn, Input, Modal, Table } from "../ui/primitives";

export function InventoryCount({
  products,
  setProducts,
  inventoryLogs,
  setInventoryLogs,
  currentUser,
  showToast,
  pharmacyId,
  purchases,
  canAddSub = (_sub) => true,
  canEditSub = (_sub) => true,
}) {
  const [showNew, setShowNew] = useState(false);
  const [countItems, setCountItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [repairing, setRepairing] = useState(false);

  // ==================== 🆕 استيراد الجرد من إكسيل ====================
  const invExcelInputRef = useRef(null);
  const [excelImportBusy, setExcelImportBusy] = useState(false);
  const [excelUnmatched, setExcelUnmatched] = useState([]); // صفوف الملف اللي معندهاش صنف مطابق
  const [showInvColMapModal, setShowInvColMapModal] = useState(false);
  const [invColMapDraft, setInvColMapDraft] = useState({ code: "", qty: "" });
  const [pendingInvRows, setPendingInvRows] = useState(null);

  // بيبني صفوف الجرد الأساسية من حالة المخزون الحالية (نفس منطق startCount)
  // — دالة منفصلة عشان نقدر نستخدمها في البداية العادية وبرضه كأساس نطبّق عليه الاستيراد
  const buildBaseCountRows = () => {
    const rows = [];
    products.forEach((p) => {
      const batches = (p.batches || []).filter((b) => b.qty > 0);
      if (batches.length > 0) {
        batches.forEach((b, idx) => {
          rows.push({
            id: p.id,
            lineKey: `${p.id}::${b.expiry_date || "بدون-تاريخ"}::${idx}`,
            name: p.name,
            category: p.category,
            expiry: b.expiry_date || "",
            systemQty: b.qty,
            actualQty: b.qty,
            diff: 0,
            isNew: false,
          });
        });
      } else {
        rows.push({
          id: p.id,
          lineKey: `${p.id}::بدون-تاريخ::0`,
          name: p.name,
          category: p.category,
          expiry: "",
          systemQty: p.stock,
          actualQty: p.stock,
          diff: 0,
          isNew: false,
        });
      }
    });
    return rows;
  };

  const startCount = () => {
    // كل تشغيلة (صنف + تاريخ صلاحية) بتاخد سطر منفصل في الجرد،
    // عشان الكمية الفعلية للصنف تقدر تتوزع على أكتر من تاريخ صلاحية.
    setExcelUnmatched([]);
    setCountItems(buildBaseCountRows());
    setShowNew(true);
  };

  // بيدوّر على اسم العمود الصح مهما اختلفت صياغته في ملف الجرد (باركود/كود، كمية)
  const normalizeInvHeader = (s) =>
    String(s || "")
      .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const findInvColumn = (row, candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const normCand = normalizeInvHeader(cand);
      const hit = keys.find((k) => normalizeInvHeader(k).includes(normCand));
      if (hit) return hit;
    }
    return null;
  };

  // بيطبّق صفوف ملف الجرد (بعد ما اتحدد عمود الباركود/الكود وعمود الكمية) على صفوف
  // الجرد الأساسية: بيطابق بالباركود (GTIN) زي أي مطابقة تانية في البرنامج، وبيحدّث
  // الكمية الفعلية للصنف المطابق. الأصناف اللي معندهاش تطابق بتتحط في قائمة "مش موجودة عندك".
  const applyInventoryExcelRows = (rows, colMap) => {
    // تجميع صفوف الملف حسب الكود بعد التطبيع، لو نفس الكود اتكرر في أكتر من صف بنجمع الكمية
    const grouped = new Map();
    rows.forEach((row) => {
      const rawCode = row[colMap.code];
      if (rawCode === "" || rawCode == null) return;
      const code = normGtin(rawCode);
      if (!code) return;
      const qty = Number(row[colMap.qty]) || 0;
      grouped.set(code, { code, rawCode: String(rawCode).trim(), qty: (grouped.get(code)?.qty || 0) + qty });
    });

    const baseRows = buildBaseCountRows();
    const unmatched = [];
    let matchedCount = 0;

    grouped.forEach((entry) => {
      const product = products.find(
        (x) => normGtin(x.barcode) === entry.code || normGtin(x.gtin) === entry.code
      );
      if (!product) {
        unmatched.push(entry);
        return;
      }
      matchedCount++;
      const productLines = baseRows.filter((r) => r.id === product.id);
      if (productLines.length === 0) return;
      // صنف بسطر واحد (الحالة الشائعة، خصوصًا لصيدلية جديدة لسه بتدخل جردها الأول)
      // → الكمية المستوردة بتتحط عليه مباشرة. لو الصنف عنده أكتر من تاريخ صلاحية،
      // الكمية كلها بتتحط على أول سطر والباقي بيتصفّر (يقدر يوزعها يدوي على التواريخ بعدين).
      productLines.forEach((line, idx) => {
        line.actualQty = idx === 0 ? entry.qty : 0;
        line.diff = line.actualQty - line.systemQty;
      });
    });

    setCountItems(baseRows);
    setExcelUnmatched(unmatched);
    setShowNew(true);
    showToast(
      `تم تطبيق ${matchedCount} صنف من الملف على الجرد ✓` +
      (unmatched.length ? ` — و${unmatched.length} كود مش موجود عندك في الأصناف` : "")
    );
  };

  const handleInventoryExcelFile = async (file) => {
    if (!file) return;
    setExcelImportBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
      if (!rows.length) {
        showToast("الملف فارغ أو مفيش صفوف بيانات فيه", "error");
        return;
      }
      const colCode = findInvColumn(rows[0], ["باركود", "الباركود", "كود الصنف", "الكود", "كود", "barcode", "gtin", "code"]);
      const colQty = findInvColumn(rows[0], ["الكمية الفعلية", "الكمية", "الرصيد", "المخزون", "qty", "quantity", "stock"]);
      if (colCode && colQty) {
        applyInventoryExcelRows(rows, { code: colCode, qty: colQty });
      } else {
        // مقدرناش نكتشف الأعمدة تلقائيًا → نعرض شاشة بسيطة يحدد فيها العمودين بنفسه
        setInvColMapDraft({ code: colCode || "", qty: colQty || "" });
        setPendingInvRows(rows);
        setShowInvColMapModal(true);
      }
    } catch (e) {
      showToast("تعذّرت قراءة الملف: " + (e?.message || e), "error");
    } finally {
      setExcelImportBusy(false);
      if (invExcelInputRef.current) invExcelInputRef.current.value = "";
    }
  };

  const confirmInvColumnMapping = () => {
    if (!invColMapDraft.code || !invColMapDraft.qty) {
      showToast("لازم تحدد عمود الباركود/الكود وعمود الكمية", "error");
      return;
    }
    setShowInvColMapModal(false);
    applyInventoryExcelRows(pendingInvRows, invColMapDraft);
    setPendingInvRows(null);
  };

  // إضافة سطر تاريخ صلاحية إضافي لنفس الصنف — للحالة اللي بيتلاقى فيها كمية
  // على الرف بتاريخ مش مسجل أصلاً في المخزون.
  const addExtraExpiryLine = (item) => {
    setCountItems((p) => [
      ...p,
      {
        id: item.id,
        lineKey: `${item.id}::جديد::${Date.now()}`,
        name: item.name,
        category: item.category,
        expiry: "",
        systemQty: 0,
        actualQty: 0,
        diff: 0,
        isNew: true,
      },
    ]);
  };

  // ✅ أداة إصلاح لمرة واحدة: فاتورة الشراء كانت بتحدّث تشغيلات الصنف (batches) في
  // الذاكرة المحلية بس من غير ما تحفظها في Supabase، فتواريخ صلاحية كتير اتفقدت.
  // الأداة دي بتعيد بناء batches كل صنف من كل فواتير الشراء المسجلة + الكمية الحالية
  // في المخزون، بافتراض إن الاستهلاك بيحصل بترتيب فواتير الشراء (الأقدم يتباع الأول).
  const repairBatchesFromPurchases = async () => {
    if (repairing) return;
    const confirmed = window.confirm(
      "هيتم إعادة بناء تشغيلات (batches) كل الأصناف من فواتير الشراء المسجلة، وهيتكتب فوق أي تشغيلات حالية في المخزون. الكمية الإجمالية للصنف مش هتتغير. تكمل؟"
    );
    if (!confirmed) return;

    setRepairing(true);
    try {
      // 1) نجمع كل تشغيلات كل صنف من كل فواتير الشراء، مرتبة زمنيًا (الأقدم أولاً)
      const purchaseBatchesByProduct = {};
      (purchases || [])
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .forEach((po) => {
          const poItems =
            typeof po.items === "string" ? JSON.parse(po.items) : po.items || [];
          poItems.forEach((it) => {
            if (!it.id) return;
            const qty = (+it.qty || 0) + (+it.bonusQty || 0);
            if (qty <= 0) return;
            if (!purchaseBatchesByProduct[it.id]) purchaseBatchesByProduct[it.id] = [];
            purchaseBatchesByProduct[it.id].push({
              qty,
              cost: it.cost ?? it.receivedCost ?? 0,
              salePrice: it.salePrice ?? it.newSalePrice ?? 0,
              expiry_date: it.expiry_date || null,
              batch_number: it.batch_number || null,
              date: po.date || null,
            });
          });
        });

      // 2) لكل صنف، بنستهلك التشغيلات الأقدم أولاً لحد ما نوصل للكمية الحالية بالظبط
      const updates = [];
      products.forEach((p) => {
        const poBatches = purchaseBatchesByProduct[p.id];
        if (!poBatches || poBatches.length === 0) return; // مفيش فواتير شراء مسجلة لهذا الصنف، نسيبه زي ما هو

        const totalPurchased = poBatches.reduce((s, b) => s + b.qty, 0);
        let toConsume = Math.max(0, totalPurchased - Math.max(0, p.stock || 0));

        const remainingBatches = [];
        for (const b of poBatches) {
          if (toConsume >= b.qty) {
            toConsume -= b.qty;
            continue; // اتستهلكت بالكامل
          }
          const remainingQty = b.qty - toConsume;
          toConsume = 0;
          if (remainingQty > 0) {
            remainingBatches.push({ ...b, qty: remainingQty });
          }
        }

        // لو المتبقي من التشغيلات مجموعه أقل من المخزون الفعلي (فروقات جرد/مرتجعات
        // مش موجودة في فواتير الشراء)، نضيف الفرق كتشغيلة "غير محددة التاريخ"
        const remainingTotal = remainingBatches.reduce((s, b) => s + b.qty, 0);
        const gap = (p.stock || 0) - remainingTotal;
        if (gap > 0) {
          remainingBatches.push({
            qty: gap,
            cost: p.cost || 0,
            salePrice: p.price || 0,
            expiry_date: null,
            batch_number: null,
            date: "قديم",
          });
        }

        updates.push({ id: p.id, batches: remainingBatches });
      });

      if (updates.length === 0) {
        showToast("مفيش أصناف محتاجة إصلاح — كل التشغيلات متوفرة أصلاً من فواتير الشراء");
        setRepairing(false);
        return;
      }

      let failCount = 0;
      for (const u of updates) {
        const { error } = await supabase
          .from("products")
          .update({ batches: u.batches })
          .eq("id", u.id)
          .eq("pharmacy_id", pharmacyId);
        if (error) failCount++;
      }

      setProducts((prev) =>
        prev.map((x) => {
          const u = updates.find((uu) => uu.id === x.id);
          return u ? { ...x, batches: u.batches } : x;
        })
      );

      showToast(
        failCount > 0
          ? `تم إصلاح ${updates.length - failCount} صنف، وفشل ${failCount} — جرب تاني`
          : `✓ تم إصلاح تشغيلات ${updates.length} صنف من فواتير الشراء`
      );
    } finally {
      setRepairing(false);
    }
  };

  const saveCount = async () => {
    const logData = {
      id: "INV-ADJ-" + Date.now(),
      date: todayLocal(),
      type: "جرد",
      items: countItems.map((i) => ({
        id: i.id,
        name: i.name,
        expiry: i.expiry || null,
        systemQty: i.systemQty,
        actualQty: i.actualQty,
        diff: i.actualQty - i.systemQty,
      })),
      notes,
      by: currentUser.name,
      pharmacy_id: pharmacyId,
    };

    const { error: logError } = await supabase
      .from("inventory_logs")
      .insert([logData]);

    if (logError) {
      showToast("❌ خطأ في حفظ الجرد: " + logError.message);
      return;
    }
    logAudit({
      pharmacyId, userName: currentUser?.name, action: "update", entityType: "inventory",
      entityId: logData.id, entityLabel: "جرد مخزون",
      newValue: { itemsCount: logData.items.length, notes },
      description: `تنفيذ جرد مخزون على ${logData.items.length} صنف${notes ? ` — ملاحظات: ${notes}` : ""}`,
    });

    // بنجمع كل أسطر تواريخ الصلاحية الخاصة بنفس الصنف عشان نحسب إجمالي الكمية الفعلية له
    const productTotals = {};
    countItems.forEach((i) => {
      if (!productTotals[i.id]) productTotals[i.id] = { systemQty: 0, actualQty: 0 };
      productTotals[i.id].systemQty += +i.systemQty;
      productTotals[i.id].actualQty += +i.actualQty;
    });

    const changedProductIds = Object.keys(productTotals).filter(
      (id) => productTotals[id].actualQty !== productTotals[id].systemQty
    );

    if (changedProductIds.length > 0) {
      const adjustments = changedProductIds.map((id) => ({
        inventory_log_id: logData.id,
        product_id: id,
        quantity: productTotals[id].actualQty - productTotals[id].systemQty,
        date: logData.date,
        created_by: currentUser.name,
        pharmacy_id: pharmacyId,
      }));

      const { error: adjError } = await supabase
        .from("inventory_adjustments")
        .insert(adjustments);

      if (adjError) {
        showToast("❌ خطأ في حفظ التسويات: " + adjError.message);
        return;
      }
    }

    // بنعيد بناء تشغيلات كل صنف حسب التواريخ اللي اتسجلت فعليًا في الجرد
    const productUpdates = Object.keys(productTotals).map((id) => {
      const prod = products.find((x) => x.id === id);
      const rows = countItems.filter((i) => i.id === id && +i.actualQty > 0);
      const newBatches = rows.map((r) => {
        const origBatch = (prod?.batches || []).find(
          (b) => (b.expiry_date || "") === (r.expiry || "")
        );
        return {
          qty: +r.actualQty,
          cost: origBatch?.cost ?? prod?.cost ?? 0,
          salePrice: origBatch?.salePrice ?? prod?.price ?? 0,
          expiry_date: r.expiry || null,
          date: origBatch?.date || logData.date,
        };
      });
      return {
        id,
        stock: productTotals[id].actualQty,
        batches: newBatches,
      };
    });

    await Promise.all(
      productUpdates.map((u) =>
        supabase
          .from("products")
          .update({ stock: u.stock, batches: u.batches })
          .eq("id", u.id)
          .eq("pharmacy_id", pharmacyId)
      )
    );

    setInventoryLogs((p) => [logData, ...p]);
    setProducts((p) =>
      p.map((x) => {
        const u = productUpdates.find((uu) => uu.id === x.id);
        return u ? { ...x, stock: u.stock, batches: u.batches } : x;
      })
    );

    setShowNew(false);
    setNotes("");
    showToast("تم حفظ الجرد وتحديث المخزون ✓");
  };

  const filtered = countItems.filter(
    (i) => (i.name||"").includes(search) || (i.category||"").includes(search)
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>نظام الجرد</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {canEditSub("fix_stock") && (
          <Btn
            variant="ghost"
            icon="tools"
            onClick={repairBatchesFromPurchases}
            disabled={repairing}
            title="إعادة بناء تشغيلات وتواريخ صلاحية الأصناف من فواتير الشراء المسجلة"
          >
            {repairing ? "جارِ الإصلاح..." : "إصلاح تشغيلات المخزون"}
          </Btn>
          )}
          {canAddSub("new_count") && (
          <>
          <input
            ref={invExcelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => handleInventoryExcelFile(e.target.files?.[0])}
          />
          <Btn
            variant="ghost"
            icon="upload"
            onClick={() => invExcelInputRef.current?.click()}
            disabled={excelImportBusy}
            title="ارفع ملف إكسيل فيه عمود باركود/كود وعمود كمية، والبرنامج هيطابقه مع أصنافك ويعبّي الجرد تلقائيًا"
          >
            {excelImportBusy ? "جارٍ الاستيراد..." : "📥 استيراد جرد من إكسيل"}
          </Btn>
          <Btn icon="count" onClick={startCount}>
            بدء جرد جديد
          </Btn>
          </>
          )}
        </div>
      </div>

      <Table
        headers={["رقم الجرد", "التاريخ", "بواسطة", "ملاحظات", "الفروقات"]}
        rows={inventoryLogs.map((l) => [
          // ✅ رقم الجرد قابل للضغط
          <span
            style={{
              color: COLORS.blue,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => setSelectedLog(l)}
          >
            {l.id}
          </span>,
          l.date,
          l.by,
          l.notes || "-",
          <span
            style={{
              color: l.items.some((i) => i.diff !== 0) ? COLORS.gold : COLORS.green,
            }}
          >
            {l.items.filter((i) => i.diff !== 0).length} صنف مختلف
          </span>,
        ])}
      />

      {/* ✅ Modal عرض تفاصيل الجرد */}
      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`تفاصيل الجرد - ${selectedLog?.id}`}
        wide
      >
        {selectedLog && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 16,
                color: COLORS.textDim,
                fontSize: 13,
              }}
            >
              <span>📅 {selectedLog.date}</span>
              <span>👤 {selectedLog.by}</span>
              {selectedLog.notes && <span>📝 {selectedLog.notes}</span>}
            </div>
            <div
              style={{
                overflowX: "auto",
                maxHeight: "55vh",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    {["الصنف", "تاريخ الصلاحية", "كمية النظام", "الكمية الفعلية", "الفرق"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 14px",
                            textAlign: "right",
                            color: COLORS.textDim,
                            fontSize: 12,
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedLog.items.map((item, i) => {
                    const changed = item.diff !== 0;
                    return (
                      <tr
                        key={`${item.id}-${i}`}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          // ✅ الأصناف المتغيرة بخلفية مميزة
                          background: changed
                            ? item.diff < 0
                              ? "rgba(255,100,100,0.08)"
                              : "rgba(68,221,136,0.08)"
                            : i % 2 === 0
                            ? "transparent"
                            : COLORS.surfaceAlt,
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            color: changed ? COLORS.textPrimary : COLORS.textDim,
                            fontWeight: changed ? 700 : 400,
                          }}
                        >
                          {item.name}
                          {changed && (
                            <span
                              style={{
                                marginRight: 8,
                                fontSize: 11,
                                color: item.diff < 0 ? COLORS.red : COLORS.green,
                              }}
                            >
                              {item.diff < 0 ? "▼ نقص" : "▲ زيادة"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", color: COLORS.textDim, fontSize: 12 }}>
                          {item.expiry || "-"}
                        </td>
                        <td style={{ padding: "8px 14px", color: COLORS.textDim }}>
                          {item.systemQty}
                        </td>
                        <td style={{ padding: "8px 14px", color: COLORS.textPrimary }}>
                          {item.actualQty}
                        </td>
                        <td
                          style={{
                            padding: "8px 14px",
                            fontWeight: 700,
                            color:
                              item.diff < 0
                                ? COLORS.red
                                : item.diff > 0
                                ? COLORS.green
                                : COLORS.textDim,
                          }}
                        >
                          {item.diff > 0 ? "+" : ""}
                          {item.diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, textAlign: "left" }}>
              <Btn variant="ghost" onClick={() => setSelectedLog(null)}>
                إغلاق
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal الجرد الجديد - بدون تغيير */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="جرد المخزون الجديد"
        wide
      >
        <Input
          label="ملاحظات الجرد"
          value={notes}
          onChange={setNotes}
          placeholder="وصف الجرد..."
        />
        {excelUnmatched.length > 0 && (
          <div
            style={{
              background: "rgba(255,170,0,0.08)",
              border: `1px solid ${COLORS.gold}`,
              borderRadius: 8,
              padding: "10px 12px",
              marginTop: 12,
              fontSize: 12.5,
              color: COLORS.textPrimary,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.gold }}>
              ⚠️ {excelUnmatched.length} كود من الملف مش موجود عندك في الأصناف (اتجاهله ولم يتحدث):
            </div>
            <div style={{ maxHeight: 120, overflowY: "auto" }}>
              {excelUnmatched.map((u, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: COLORS.textDim }}>
                  <span>{u.rawCode}</span>
                  <span>الكمية: {u.qty}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, color: COLORS.textDim }}>
              ضيف الصنف الأول من شاشة "الأصناف" بنفس الباركود، وبعدين استورد الملف تاني.
            </div>
          </div>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث في الأصناف..."
          style={{
            width: "100%",
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "9px 12px",
            color: COLORS.textPrimary,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            marginTop: 12,
            marginBottom: 12,
          }}
        />
        <div
          style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", position: "sticky", top: 0 }}>
                {[
                  "الصنف",
                  "الفئة",
                  "تاريخ الصلاحية",
                  "كمية النظام",
                  "الكمية الفعلية",
                  "الفرق",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 14px",
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
              {filtered.map((item, i) => (
                <tr
                  key={item.lineKey}
                  style={{
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: item.isNew
                      ? "rgba(68,221,136,0.06)"
                      : i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                  }}
                >
                  <td
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {item.name}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <input
                      type="month"
                      value={item.expiry || ""}
                      onChange={(e) =>
                        setCountItems((p) =>
                          p.map((x) =>
                            x.lineKey === item.lineKey
                              ? { ...x, expiry: e.target.value }
                              : x
                          )
                        )
                      }
                      style={{
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: item.expiry ? COLORS.textPrimary : COLORS.textDim,
                        fontSize: 12,
                        outline: "none",
                        colorScheme: "dark",
                      }}
                    />
                  </td>
                  <td style={{ padding: "8px 14px", color: COLORS.textDim }}>
                    {item.systemQty}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <input
                      type="number"
                      min="0"
                      value={item.actualQty}
                      onChange={(e) =>
                        setCountItems((p) =>
                          p.map((x) =>
                            x.lineKey === item.lineKey
                              ? {
                                  ...x,
                                  actualQty: +e.target.value,
                                  diff: +e.target.value - x.systemQty,
                                }
                              : x
                          )
                        )
                      }
                      style={{
                        width: 70,
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: COLORS.textPrimary,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      padding: "8px 14px",
                      fontWeight: 700,
                      color:
                        item.actualQty - item.systemQty < 0
                          ? COLORS.red
                          : item.actualQty - item.systemQty > 0
                          ? COLORS.green
                          : COLORS.textDim,
                    }}
                  >
                    {item.actualQty - item.systemQty > 0 ? "+" : ""}
                    {item.actualQty - item.systemQty}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <button
                      onClick={() => addExtraExpiryLine(item)}
                      title="أضف تاريخ صلاحية إضافي لنفس الصنف (لو لقيت كمية على الرف بتاريخ مختلف)"
                      style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: `1px solid ${COLORS.border}`, color: COLORS.green,
                        cursor: "pointer", fontWeight: 700, fontSize: 13,
                      }}
                    >+</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <Btn variant="ghost" onClick={() => setShowNew(false)}>
            إلغاء
          </Btn>
          <Btn icon="check" onClick={saveCount}>
            حفظ الجرد وتحديث المخزون
          </Btn>
        </div>
      </Modal>

      {/* 🆕 Modal تحديد عمود الباركود/الكود وعمود الكمية لما الاكتشاف التلقائي يفشل */}
      <Modal
        open={showInvColMapModal}
        onClose={() => setShowInvColMapModal(false)}
        title="حدد أعمدة ملف الجرد"
      >
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 12 }}>
          مقدرناش نكتشف الأعمدة تلقائيًا. حدد تحت عمود الباركود/الكود وعمود الكمية الفعلية من ملفك:
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>عمود الباركود / الكود</div>
          <select
            value={invColMapDraft.code}
            onChange={(e) => setInvColMapDraft((p) => ({ ...p, code: e.target.value }))}
            style={{
              width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13,
            }}
          >
            <option value="">— اختر العمود —</option>
            {pendingInvRows && Object.keys(pendingInvRows[0] || {}).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>عمود الكمية الفعلية</div>
          <select
            value={invColMapDraft.qty}
            onChange={(e) => setInvColMapDraft((p) => ({ ...p, qty: e.target.value }))}
            style={{
              width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13,
            }}
          >
            <option value="">— اختر العمود —</option>
            {pendingInvRows && Object.keys(pendingInvRows[0] || {}).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowInvColMapModal(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={confirmInvColumnMapping}>تأكيد ومتابعة</Btn>
        </div>
      </Modal>
    </div>
  );
}
