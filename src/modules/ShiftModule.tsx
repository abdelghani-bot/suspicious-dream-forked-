export function ShiftModule({
  const { C } = useTheme(); shifts, setShifts, sales, currentUser, showToast, pharmacyId, invoices }) {
  const [openCash, setOpenCash] = useState("500");
  const [closeCash, setCloseCash] = useState("");
  const [notes, setNotes] = useState("");

  const currentShift = shifts.find(
  (s) => !s.end_time && s.user === currentUser?.name
);
  const shiftSales = currentShift
    ? sales.filter((s) => s.shift === currentShift.id)
    : [];
  const shiftRevenue = shiftSales.reduce((a, s) => a + s.total, 0);

 const openShift = async () => {
  if (currentShift) {
    showToast("يوجد شفت مفتوح بالفعل", "warn");
    return;
  }
  const sh = {
    id: "SH-" + Date.now(),
    user: currentUser.name,
    role: currentUser.role,
    start_time: new Date().toISOString(),
    end_time: null,
    open_cash: +openCash,
    close_cash: null,
    sales: 0,
    notes: "",
    pharmacy_id: pharmacyId,
  };

  const { error } = await supabase.from("shifts").insert(sh);
  if (error) {
    showToast("فشل فتح الشفت: " + error.message, "error");
    return;
  }
  setShifts((p) => [...p, sh]);

  // ✅ تسجيل حضور تلقائي
  const today = new Date().toISOString().split("T")[0];
  const existing = await supabase
    .from("attendance_logs")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("pharmacist_name", currentUser.name)
    .eq("date", today)
    .is("check_out", null)
    .maybeSingle();

  if (!existing.data) {
  const { error: attError } = await supabase
    .from("attendance_logs")
    .insert({
      pharmacy_id: pharmacyId,
      pharmacist_name: currentUser.name,
      date: today,
      shift_id: sh.id,
      check_in: new Date().toISOString(),
    });
  if (attError) showToast("خطأ في تسجيل الحضور: " + attError.message, "error");
  else showToast("تم فتح الشفت وتسجيل الحضور ✓");
} else {
  showToast("تم فتح الشفت ✓");
}

  showToast("تم فتح الشفت ✓");
};
 const closeShift = async () => {
  const hasOpenItems = invoices?.some((inv) => inv.cart.length > 0);
  if (hasOpenItems) {
    showToast("⚠️ يوجد فاتورة مفتوحة بأصناف — أتمم البيع أو امسح السلة أولاً", "error");
    return;
  }
  if (!closeCash) {
    showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
    return;
  }

  const updates = {
    end_time: new Date().toISOString(),
    close_cash: +closeCash,
    sales: shiftRevenue,
    notes,
  };

  const { error } = await supabase
    .from("shifts")
    .update(updates)
    .eq("id", currentShift.id);

  if (error) {
    showToast("فشل إغلاق الشفت: " + error.message, "error");
    return;
  }

  setShifts((p) =>
    p.map((s) => (s.id === currentShift.id ? { ...s, ...updates } : s))
  );

  // ✅ تسجيل انصراف تلقائي
  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("attendance_logs")
    .update({ check_out: new Date().toISOString() })
    .eq("pharmacy_id", pharmacyId)
    .eq("pharmacist_name", currentUser.name)
    .eq("date", today)
    .is("check_out", null);

  showToast("تم إغلاق الشفت وتسليمه ✓");
};
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        إدارة الشفتات
      </h2>
      {!currentShift ? (
        <div
          style={{
            background: C.surface,
            border: "1px solid #1d2d4a",
            borderRadius: 14,
            padding: 24,
            marginBottom: 20,
            maxWidth: 480,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: 16,
              fontWeight: 700,
              color: C.text,
            }}
          >
            فتح شفت جديد
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="النقد الافتتاحي (ر.س)"
              value={openCash}
              onChange={setOpenCash}
              type="number"
              placeholder="500"
            />
            <Btn icon="shift" onClick={openShift} size="lg">
              فتح الشفت
            </Btn>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#0a1a0a",
            border: "1px solid #1a5a1a",
            borderRadius: 14,
            padding: 24,
            marginBottom: 20,
            maxWidth: 520,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: C.success,
              }}
            >
              شفت مفتوح ✓
            </h3>
            <Badge color="#0a3a0a" text=C.success>
              {currentShift.id}
            </Badge>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{ background: C.bgAlt, borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>بداية الشفت</div>
              <div style={{ color: C.text, fontSize: 13, marginTop: 4 }}>
                {currentShift.start_time}
              </div>
            </div>
            <div
              style={{ background: C.bgAlt, borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>
                النقد الافتتاحي
              </div>
              <div
                style={{
                  color: C.success,
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {currentShift.open_cash} ر.س
              </div>
            </div>
            <div
              style={{ background: C.bgAlt, borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>مبيعات الشفت</div>
              <div
                style={{
                  color: C.accent,
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftRevenue.toFixed(2)} ر.س
              </div>
            </div>
            <div
              style={{ background: C.bgAlt, borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>عدد الفواتير</div>
              <div
                style={{
                  color: "#a78bfa",
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftSales.length}
              </div>
            </div>
          </div>
          <Input
            label="النقد الفعلي عند الإغلاق (ر.س)"
            value={closeCash}
            onChange={setCloseCash}
            type="number"
            placeholder="0"
          />
          <Input
            label="ملاحظات تسليم الشفت"
            value={notes}
            onChange={setNotes}
            placeholder="أي ملاحظات عند التسليم..."
            style={{ marginTop: 10 }}
          />
          {closeCash && (
            <div
              style={{
                margin: "10px 0",
                padding: "10px 14px",
                background: C.bgAlt,
                borderRadius: 8,
                color: C.warning,
                fontSize: 13,
              }}
            >
              فرق النقد:{" "}
              {(+closeCash - currentShift.open_cash - shiftRevenue).toFixed(2)}{" "}
              ر.س
            </div>
          )}
          <Btn
            icon="check"
            variant="success"
            onClick={closeShift}
            size="lg"
            style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
          >
            إغلاق وتسليم الشفت
          </Btn>
        </div>
      )}
      <Table
        headers={[
          "رقم الشفت",
          "الموظف",
          "البداية",
          "النهاية",
          "النقد الافتتاحي",
          "المبيعات",
          "النقد الختامي",
          "الحالة",
        ]}
        rows={[...shifts].reverse().map((s) => [
          <span style={{ color: C.accent, fontWeight: 700 }}>{s.id}</span>,
          s.user,
          s.start_time,
          s.end_time || "-",
          s.open_cash + " ر.س",
          <span style={{ color: C.accent, fontWeight: 700 }}>
            {(s.sales || 0).toFixed(2)} ر.س
          </span>,
          s.close_cash ? s.close_cash + " ر.س" : "-",
          s.end_time ? (
            <Badge color="#0a2a10" text=C.success>
              مغلق
            </Badge>
          ) : (
            <Badge color="#0a2a1a" text="#44ffaa">
              مفتوح
            </Badge>
          ),
        ])}
      />
    </div>
  );
}
// ── helpers ──────────────────────────────────────────────────────────────────
