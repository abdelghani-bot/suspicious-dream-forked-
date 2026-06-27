export function InventoryCount({
  const { C } = useTheme();
  products,
  setProducts,
  inventoryLogs,
  setInventoryLogs,
  currentUser,
  showToast,
  pharmacyId,
}) {
  const [showNew, setShowNew] = useState(false);
  const [countItems, setCountItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const startCount = () => {
    setCountItems(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        systemQty: p.stock,
        actualQty: p.stock,
        diff: 0,
      }))
    );
    setShowNew(true);
  };

  const saveCount = async () => {
    const logData = {
      id: "INV-ADJ-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      type: "جرد",
      items: countItems.map((i) => ({
        id: i.id,
        name: i.name,
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

    const changedItems = countItems.filter((i) => i.actualQty !== i.systemQty);

    if (changedItems.length > 0) {
      const adjustments = changedItems.map((i) => ({
        inventory_log_id: logData.id,
        product_id: i.id,
        quantity: i.actualQty - i.systemQty,
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

      await Promise.all(
        changedItems.map((i) =>
          supabase
            .from("products")
            .update({ stock: i.actualQty })
            .eq("id", i.id)
            .eq("pharmacy_id", pharmacyId)
        )
      );
    }

    setInventoryLogs((p) => [logData, ...p]);
    setProducts((p) =>
      p.map((x) => {
        const ci = changedItems.find((i) => i.id === x.id);
        return ci ? { ...x, stock: ci.actualQty } : x;
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
        <Btn icon="count" onClick={startCount}>
          بدء جرد جديد
        </Btn>
      </div>

      <Table
        headers={["رقم الجرد", "التاريخ", "بواسطة", "ملاحظات", "الفروقات"]}
        rows={inventoryLogs.map((l) => [
          // ✅ رقم الجرد قابل للضغط
          <span
            style={{
              color: C.accent,
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
              color: l.items.some((i) => i.diff !== 0) ? C.warning : C.success,
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
                color: C.muted,
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
                      background: C.bgAlt,
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    {["الصنف", "كمية النظام", "الكمية الفعلية", "الفرق"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 14px",
                            textAlign: "right",
                            color: C.muted,
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
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #0a101a",
                          // ✅ الأصناف المتغيرة بخلفية مميزة
                          background: changed
                            ? item.diff < 0
                              ? "rgba(255,100,100,0.08)"
                              : "rgba(68,221,136,0.08)"
                            : i % 2 === 0
                            ? "transparent"
                            : C.bgAlt,
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            color: changed ? C.text : C.muted,
                            fontWeight: changed ? 700 : 400,
                          }}
                        >
                          {item.name}
                          {changed && (
                            <span
                              style={{
                                marginRight: 8,
                                fontSize: 11,
                                color: item.diff < 0 ? C.danger : C.success,
                              }}
                            >
                              {item.diff < 0 ? "▼ نقص" : "▲ زيادة"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", color: C.muted }}>
                          {item.systemQty}
                        </td>
                        <td style={{ padding: "8px 14px", color: C.text }}>
                          {item.actualQty}
                        </td>
                        <td
                          style={{
                            padding: "8px 14px",
                            fontWeight: 700,
                            color:
                              item.diff < 0
                                ? C.danger
                                : item.diff > 0
                                ? C.success
                                : C.muted,
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث في الأصناف..."
          style={{
            width: "100%",
            background: C.bgAlt,
            border: "1px solid #1d2d4a",
            borderRadius: 8,
            padding: "9px 12px",
            color: C.text,
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
              <tr style={{ background: C.bgAlt, position: "sticky", top: 0 }}>
                {[
                  "الصنف",
                  "الفئة",
                  "كمية النظام",
                  "الكمية الفعلية",
                  "الفرق",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 14px",
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
              {filtered.map((item, i) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #0a101a",
                    background: i % 2 === 0 ? "transparent" : C.bgAlt,
                  }}
                >
                  <td
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    {item.name}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td style={{ padding: "8px 14px", color: C.muted }}>
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
                            x.id === item.id
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
                        background: C.bgAlt,
                        border: "1px solid #1d2d4a",
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: C.text,
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
                          ? C.danger
                          : item.actualQty - item.systemQty > 0
                          ? C.success
                          : C.muted,
                    }}
                  >
                    {item.actualQty - item.systemQty > 0 ? "+" : ""}
                    {item.actualQty - item.systemQty}
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
    </div>
  );
}

// ==================== CATEGORIES ====================
// نوع العبوة — يصف شكل التعبئة الخارجية المباعة (مستقل عن الشكل الصيدلاني)
const PACKAGE_TYPES = ["كرتونة", "كيس/باكيت", "علبة"];

const MAIN_CATEGORIES = {
  دواء: {
    sub1: ["مستورد", "محلي"],
    sub2: [
      "أقراص",
      "كبسولات",
      "شراب/معلق",
      "قطرة عين",
      "قطرة أذن",
      "قطرة أنف",
      "نقط/قطارة فم",
      "محلول موضعي",
      "كريم/مرهم/جل",
      "أمبولات/حقن",
      "تحاميل",
      "بخاخ/إسبراي",
      "محلول استنشاق",
      "لصقات",
      "أكياس",
      "لا ينطبق",
    ],
  },
  "كوزمتك عادي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "كوزمتك طبي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات أطفال": {
    sub1: [],
    sub2: ["حفاضات", "حليب", "رضاعة", "عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات طبية": {
    sub1: [],
    sub2: ["جهاز طبي", "عناية بالجروح", "وقاية"],
  },
};
const SUPPLY_CATEGORIES = [
  "دواء",
  "مستلزمات طبية", 
  "كوزمتك عادي",
  "كوزمتك طبي",
  "حليب أطفال",
  "حفاضات",
  "رضاعات ومستلزمات الرضاعة",
];
