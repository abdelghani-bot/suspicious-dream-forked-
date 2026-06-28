export function TargetModule({
  users, sales, customers, currentUser, pharmacyId, showToast }) {
  const { C } = useTheme();
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [targets, setTargets] = useState([]); // كل التارجتات لكل الشهور
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [compareWith, setCompareWith] = useState({}); // { [pharmacistName]: otherName }

  const isAdmin = currentUser?.role === "admin";
  const pharmacists = users.filter((u) => u.role === "pharmacist");

  // تحميل كل التارجتات (كل الشهور) مرة واحدة — يسمح بالمقارنة عبر الشهور من غير إعادة تحميل
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("monthly_targets")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .then(({ data }) => setTargets(data || []));
  }, [pharmacyId]);

  const getTarget = (name, mKey) =>
    targets.find((t) => t.pharmacist_name === name && t.month === mKey)?.target_amount || 0;

  const saveTarget = async (name) => {
    if (!editValue || +editValue <= 0) {
      showToast("ادخل قيمة تارجت صحيحة", "error");
      return;
    }
    const row = {
      pharmacy_id: pharmacyId,
      pharmacist_name: name,
      month: monthKey,
      target_amount: +editValue,
    };
    const { data, error } = await supabase
      .from("monthly_targets")
      .upsert([row], { onConflict: "pharmacy_id,pharmacist_name,month" })
      .select();
    if (error) {
      showToast("خطأ: " + error.message, "error");
      return;
    }
    setTargets((prev) => {
      const others = prev.filter((t) => !(t.pharmacist_name === name && t.month === monthKey));
      return [...others, data[0]];
    });
    setEditing(null);
    setEditValue("");
    showToast("تم حفظ التارجت ✓");
  };

  const now = new Date();

  // ===== حساب أداء صيدلي في أي شهر (نعيد استخدامها للشهر الحالي وللمقارنات) =====
  const calcForMonth = (name, mKey) => {
    const [yy, mm] = mKey.split("-").map(Number);
    const daysInM = new Date(yy, mm, 0).getDate();
    const isCurrent = mKey === now.toISOString().slice(0, 7);
    const daysP = isCurrent ? now.getDate() : daysInM;

    const monthSales = sales.filter(
      (s) => (s.created_at || s.date || "").startsWith(mKey) && !s.returned
    );
    const mySales = monthSales.filter((s) => s.cashier_name === name);
    const achieved = mySales.reduce((a, s) => a + (s.total || 0), 0);
    const target = getTarget(name, mKey);

    const simplePct = target > 0 ? (achieved / target) * 100 : 0;
    const dailyAvg = daysP > 0 ? achieved / daysP : 0;
    const projected = dailyAvg * daysInM;
    const paceRequired = target > 0 ? target / daysInM : 0;
    const paceStatus =
      target === 0
        ? "—"
        : dailyAvg >= paceRequired
        ? "على المسار ✅"
        : dailyAvg >= paceRequired * 0.85
        ? "متأخر بسيط ⚠️"
        : "متأخر عن المسار 🔴";

    const invoiceCount = mySales.length;
    let itemsSold = 0;
    mySales.forEach((s) => {
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      itemsSold += items.reduce((a, it) => a + (it.qty || 1), 0);
    });
    const avgItemsPerInvoice = invoiceCount > 0 ? itemsSold / invoiceCount : 0;
    const avgInvoiceValue = invoiceCount > 0 ? achieved / invoiceCount : 0;

    const linkedToCustomer = mySales.filter((s) => s.customer).length;
    const customerRegRate = invoiceCount > 0 ? (linkedToCustomer / invoiceCount) * 100 : 0;

    const newCustomers = customers.filter(
      (c) => (c.created_at || "").startsWith(mKey) && c.created_by === name
    ).length;

    const myCustomers = customers.filter((c) => c.created_by === name);
    const inactiveCustomers = myCustomers.filter((c) => {
      const cSales = sales.filter((s) => s.customer === c.id);
      if (cSales.length === 0) return false;
      const last = cSales.reduce((a, s) => {
        const d = new Date(s.created_at || s.date);
        return d > a ? d : a;
      }, new Date(0));
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    }).length;

    return {
      achieved, target, simplePct, projected, paceStatus, daysP, daysInM, mKey,
      invoiceCount, itemsSold, avgItemsPerInvoice, avgInvoiceValue,
      customerRegRate, newCustomers, inactiveCustomers,
    };
  };

  const calcForPharmacist = (name) => calcForMonth(name, monthKey);

  // ===== أداء يومي خلال الشهر الحالي =====
  const getDailyPerformance = (name, c) => {
    const days = [];
    for (let d = 1; d <= c.daysP; d++) {
      const dayStr = `${monthKey}-${String(d).padStart(2, "0")}`;
      const amt = sales
        .filter(
          (s) =>
            (s.created_at || s.date || "").startsWith(dayStr) &&
            !s.returned &&
            s.cashier_name === name
        )
        .reduce((a, s) => a + (s.total || 0), 0);
      days.push({ day: d, amount: amt });
    }
    return days;
  };

  // ===== مقارنة آخر 6 شهور =====
  const getYearTrend = (name) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey2 = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("ar", { month: "short" });
      const c2 = calcForMonth(name, mKey2);
      months.push({ label, mKey: mKey2, achieved: c2.achieved, target: c2.target });
    }
    return months;
  };

  const pctColor = (p) => (p >= 100 ? C.success : p >= 75 ? C.accent : p >= 50 ? C.warning : C.danger);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🎯 تارجت المبيعات</h2>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
            تارجت شهري لكل صيدلي + تحليل فني لحظي + مقارنات
          </div>
        </div>
        <Input type="month" value={monthKey} onChange={setMonthKey} style={{ width: 160 }} />
      </div>

      {pharmacists.length === 0 && (
        <div style={{ color: C.muted, padding: 20 }}>لا يوجد صيادلة مسجلين بدور "pharmacist".</div>
      )}

      {pharmacists.map((u) => {
        const c = calcForPharmacist(u.name);
        const dailyPerf = getDailyPerformance(u.name, c);
        const yearTrend = getYearTrend(u.name);
        const maxDaily = Math.max(...dailyPerf.map((d) => d.amount), 1);
        const maxYearly = Math.max(...yearTrend.map((m) => Math.max(m.achieved, m.target)), 1);
        const otherPharmacists = pharmacists.filter((p) => p.name !== u.name);
        const compareName = compareWith[u.name] || (otherPharmacists[0]?.name ?? "");
        const cOther = compareName ? calcForPharmacist(compareName) : null;

        return (
          <div key={u.id} style={{ background: C.surface, border: "1px solid #1d2d4a", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            {/* ===== الهيدر + التارجت ===== */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{u.name}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>صيدلاني</div>
              </div>

              {editing === u.name ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input value={editValue} onChange={setEditValue} type="number" placeholder="قيمة التارجت" style={{ width: 140 }} />
                  <Btn size="sm" variant="success" onClick={() => saveTarget(u.name)}>حفظ</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Btn>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: C.muted, fontSize: 11 }}>التارجت الشهري</div>
                    <div style={{ color: "#8ab0ff", fontWeight: 800, fontSize: 15 }}>
                      {c.target ? c.target.toFixed(0) + " ر.س" : "غير محدد"}
                    </div>
                  </div>
                  {isAdmin && (
                    <Btn size="sm" variant="ghost" icon="edit" onClick={() => { setEditing(u.name); setEditValue(c.target || ""); }}>
                      تعديل
                    </Btn>
                  )}
                </div>
              )}
            </div>

            {/* ===== شريط التقدم ===== */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#8aa0cc" }}>
                  المحقق: <b style={{ color: C.text }}>{c.achieved.toFixed(0)} ر.س</b>
                </span>
                <span style={{ color: pctColor(c.simplePct), fontWeight: 800 }}>
                  {c.target ? c.simplePct.toFixed(1) + "%" : "—"}
                </span>
              </div>
              <div style={{ background: C.bgAlt, borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{
                  width: Math.min(c.simplePct, 100) + "%",
                  height: "100%",
                  background: pctColor(c.simplePct),
                  transition: "width .3s",
                }} />
              </div>
              {c.target > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: C.muted }}>
                    المتوقع نهاية الشهر (Run Rate): <b style={{ color: "#a78bfa" }}>{c.projected.toFixed(0)} ر.س</b>
                  </span>
                  <span style={{ fontWeight: 700 }}>{c.paceStatus}</span>
                </div>
              )}
            </div>

            {/* ===== التحليل الفني — ظاهر لحظيًا بدون أي ضغط ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📊 التحليل الفني</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                {[
                  { l: "عدد الفواتير", v: c.invoiceCount },
                  { l: "عدد الأصناف المباعة", v: c.itemsSold },
                  { l: "متوسط الأصناف/فاتورة", v: c.avgItemsPerInvoice.toFixed(1) },
                  { l: "متوسط قيمة الفاتورة", v: c.avgInvoiceValue.toFixed(0) + " ر.س" },
                  { l: "نسبة التسجيل على عملاء", v: c.customerRegRate.toFixed(0) + "%" },
                  { l: "عملاء جدد هذا الشهر", v: c.newCustomers },
                  { l: "عملاء سجّلهم وأصبحوا خاملين", v: c.inactiveCustomers },
                ].map((x, i) => (
                  <div key={i} style={{ background: C.bgAlt, borderRadius: 10, padding: 12 }}>
                    <div style={{ color: C.muted, fontSize: 11 }}>{x.l}</div>
                    <div style={{ color: C.text, fontSize: 16, fontWeight: 800, marginTop: 4 }}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== الأداء خلال الشهر (يوم بيوم) ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: C.success, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                📅 الأداء خلال الشهر (مبيعات يومية)
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70, overflowX: "auto", paddingBottom: 4 }}>
                {dailyPerf.map((d) => (
                  <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 14 }}>
                    <div
                      title={`يوم ${d.day}: ${d.amount.toFixed(0)} ر.س`}
                      style={{
                        width: 8,
                        height: Math.max((d.amount / maxDaily) * 55, 2),
                        background: d.amount > 0 ? C.success : C.border,
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                    <span style={{ fontSize: 8, color: C.muted, marginTop: 3 }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== مقارنة عبر آخر 6 شهور ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                📈 مقارنة الأداء عبر آخر 6 شهور
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
                {yearTrend.map((m) => (
                  <div key={m.mKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 65 }}>
                      <div
                        title={`المحقق: ${m.achieved.toFixed(0)} ر.س`}
                        style={{ flex: 1, background: C.accent, height: `${(m.achieved / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }}
                      />
                      {m.target > 0 && (
                        <div
                          title={`التارجت: ${m.target.toFixed(0)} ر.س`}
                          style={{ flex: 1, background: "#4a3a00", height: `${(m.target / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2, border: "1px dashed #ffaa44" }}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: C.muted }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: C.accent }}>■ المحقق</span>
                <span style={{ fontSize: 11, color: C.warning }}>▢ التارجت</span>
              </div>
            </div>

            {/* ===== مقارنة مع صيدلي آخر ===== */}
            {otherPharmacists.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ color: C.warning, fontSize: 12, fontWeight: 700 }}>⚖️ مقارنة مع صيدلي آخر</div>
                  <select
                    value={compareName}
                    onChange={(e) => setCompareWith((p) => ({ ...p, [u.name]: e.target.value }))}
                    style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 12, outline: "none" }}
                  >
                    {otherPharmacists.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {cOther && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ background: C.bgAlt, borderRadius: 10, padding: 12 }}>
                      <div style={{ color: C.accent, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{u.name}</div>
                      {[
                        ["المحقق", c.achieved.toFixed(0) + " ر.س"],
                        ["نسبة التارجت", c.target ? c.simplePct.toFixed(1) + "%" : "—"],
                        ["عدد الفواتير", c.invoiceCount],
                        ["متوسط الفاتورة", c.avgInvoiceValue.toFixed(0) + " ر.س"],
                        ["نسبة التسجيل على عملاء", c.customerRegRate.toFixed(0) + "%"],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                          <span style={{ color: C.muted }}>{l}</span>
                          <span style={{ color: C.text, fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ color: C.muted, fontSize: 18, fontWeight: 900 }}>VS</div>

                    <div style={{ background: C.bgAlt, borderRadius: 10, padding: 12 }}>
                      <div style={{ color: C.warning, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{compareName}</div>
                      {[
                        ["المحقق", cOther.achieved.toFixed(0) + " ر.س"],
                        ["نسبة التارجت", cOther.target ? cOther.simplePct.toFixed(1) + "%" : "—"],
                        ["عدد الفواتير", cOther.invoiceCount],
                        ["متوسط الفاتورة", cOther.avgInvoiceValue.toFixed(0) + " ر.س"],
                        ["نسبة التسجيل على عملاء", cOther.customerRegRate.toFixed(0) + "%"],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                          <span style={{ color: C.muted }}>{l}</span>
                          <span style={{ color: C.text, fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ==================== TREASURY MODULE ====================
