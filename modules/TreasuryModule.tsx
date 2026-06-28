export function TreasuryModule({
  sales, creditPayments, purchases, suppliers, pharmacyId, currentUser, showToast, shifts, entries, setEntries }) {
  const { C } = useTheme();
  const [activeTab, setActiveTab] = useState("today");
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const printRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];
  const monthKey = today.substring(0, 7);

  const [closingForm, setClosingForm] = useState({
    extra_income: "",
    extra_income_note: "",
    petty: "",
    petty_note: "",
    variable_expenses: [],
    fixed_paid: {},
    card_actual: "",
    card_adjust_reason: "",
  });
  const [editingCard, setEditingCard] = useState(false);
  const [closingSaved, setClosingSaved] = useState(false);
  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(0);

useEffect(() => {
  if (!pharmacyId) return;
  supabase
    .from("treasury_entries")
    .select("amount")
    .eq("pharmacy_id", pharmacyId)
    .eq("date", today)
    .eq("sub_type", "loyalty_redeem")
    .then(({ data }) => {
      if (data) setLoyaltyRedeemed(data.reduce((s, r) => s + (r.amount || 0), 0));
    });
}, [today, pharmacyId]);
  const [fixedForm, setFixedForm] = useState({ name: "", amount: "", due_day: "1", recurrence: "monthly", due_month: "1" });
  const [licenseForm, setLicenseForm] = useState({ name: "", renew_date: "", amount: "", note: "" });
  
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("fixed_expenses").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("licenses").select("*").eq("pharmacy_id", pharmacyId).order("renew_date"),
    ]).then(([f, l]) => {
      if (f.data) setFixedExpenses(f.data);
      if (l.data) setLicenses(l.data);
    });
  }, [pharmacyId]);

  // ── حسابات المبيعات مقسمة ──
  const todaySales = sales.filter((s) => s.date === today && !s.returned);
  const todayCash = todaySales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0);
  const todayCard = todaySales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
  const todayTransfer = todaySales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
  const todayAjil = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayCreditIncome = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todayReturns = (entries || []).filter(
  (e) => e.date === today && e.type === "expense" && e.sub_type === "sales_return"
).reduce((a, e) => a + e.amount, 0);
  const todaySalesIncome = todayCash + todayCard + todayTransfer + todayCreditIncome - todayReturns;

  // ── رصيد الخزنة اللحظي من كل السجلات ──
  const calcBalance = (method) => {
    const safe = (entries || []).filter(Boolean);
    // دخل من المبيعات
    const salesIncome = sales.filter((s) => !s.returned && s.payment === method).reduce((a, s) => a + s.total, 0);
    // سداد آجل (كاش دايماً)
    const creditIn = method === "نقدي" ? creditPayments.reduce((a, p) => a + p.amount, 0) : 0;
    // من سجل الخزنة (يشمل المصروفات العادية ومدفوعات الموردين سوا — type === "expense")
    const entryIn = safe.filter((e) => e.type === "income" && e.method === method).reduce((a, e) => a + e.amount, 0);
    const entryOut = safe.filter((e) => e.type === "expense" && e.method === method).reduce((a, e) => a + e.amount, 0);
    return salesIncome + creditIn + entryIn - entryOut;
  };

  const balanceCash = calcBalance("نقدي");
  const balanceCard = calcBalance("بطاقة");
  const balanceTransfer = calcBalance("تحويل");
  const balanceTotal = balanceCash + balanceCard + balanceTransfer;

  // ── تقفيل الشفتات ──
  const todayShifts = shifts.filter((s) => s.start_time?.startsWith(today));
  const getShiftSales = (shiftId) => {
    const shiftSales = todaySales.filter((s) => s.shift === shiftId);
    return {
      cash: shiftSales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0),
      card: shiftSales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0),
      transfer: shiftSales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0),
      ajil: shiftSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0),
      total: shiftSales.filter((s) => s.payment !== "آجل").reduce((a, s) => a + s.total, 0),
      count: shiftSales.length,
    };
  };

  // ── حسابات المصروفات ──
  const variableTotal = closingForm.variable_expenses.reduce((a, e) => a + (+e.amount || 0), 0);
  const fixedPaidTotal = fixedExpenses.filter((f) => closingForm.fixed_paid[f.id]).reduce((a, f) => a + f.amount, 0);
  const totalExpenses = (+closingForm.petty || 0) + variableTotal + loyaltyRedeemed;
  // ── تعديل مبيعات البطاقة الفعلية وتسوية الفرق في الكاش ──
  const hasCardAdjust = closingForm.card_actual !== "" && !isNaN(+closingForm.card_actual);
  const cardActual = hasCardAdjust ? +closingForm.card_actual : todayCard;
  const cardDiff = hasCardAdjust ? cardActual - todayCard : 0; // موجب = البطاقة زادت عن المحسوب (الكاش ينقص بنفس القيمة)
  const cashAfterAdjust = todayCash + todayCreditIncome - cardDiff;

  const totalIncome = todaySalesIncome + (+closingForm.extra_income || 0);
  const netCash = totalIncome - totalExpenses;

  // ── حساب القسط الشهري الفعلي حسب نوع التكرار ──
  const recurrenceDivisor = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
  const monthlyShare = (f) => (+f.amount || 0) / (recurrenceDivisor[f.recurrence || "monthly"] || 1);
  const monthFixedTotal = fixedExpenses.reduce((a, f) => a + monthlyShare(f), 0);

  const currentDay = new Date().getDate();
  const currentMonthNum = new Date().getMonth() + 1;
  // ── هل المصروف مستحق فعليًا في الشهر الحالي؟ (يأخذ التكرار في الاعتبار) ──
  const isDueThisMonth = (f) => {
    const rec = f.recurrence || "monthly";
    if (rec === "monthly") return true;
    const interval = recurrenceDivisor[rec] || 1;
    const startMonth = +f.due_month || 1;
    const diff = (currentMonthNum - startMonth + 12) % interval;
    return diff === 0;
  };
  const dueFixed = fixedExpenses.filter((f) => isDueThisMonth(f) && Math.abs(+f.due_day - currentDay) <= 3);
  const recurrenceLabel = { monthly: "شهري", quarterly: "ربع سنوي", semi_annual: "نصف سنوي", annual: "سنوي" };

  const upcomingLicenses = licenses.filter((l) => {
    const days = (new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  });

  // ── حفظ التقفيل ──
  const saveClosing = async () => {
    const rows = [];
    if (+closingForm.extra_income > 0)
      rows.push({ type: "income", sub_type: "other", method: "نقدي", amount: +closingForm.extra_income, note: closingForm.extra_income_note || "دخل إضافي", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    if (+closingForm.petty > 0)
      rows.push({ type: "expense", sub_type: "petty", method: "نقدي", amount: +closingForm.petty, note: closingForm.petty_note || "نثريات", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    closingForm.variable_expenses.filter((e) => +e.amount > 0).forEach((e) =>
      rows.push({ type: "expense", sub_type: "variable", method: "نقدي", amount: +e.amount, note: e.name, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name })
    );
    fixedExpenses.filter((f) => closingForm.fixed_paid[f.id]).forEach((f) =>
      rows.push({ type: "expense", sub_type: "fixed", method: "نقدي", amount: f.amount, note: f.name, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name })
    );
    // ── تسوية فرق مبيعات البطاقة (سطر واضح في السجل، بدون تعديل أي رقم بصمت) ──
    if (hasCardAdjust && cardDiff !== 0) {
      const reasonNote = closingForm.card_adjust_reason
        ? `تسوية فرق البطاقة — ${closingForm.card_adjust_reason}`
        : `تسوية فرق البطاقة (محسوب: ${todayCard.toFixed(2)} / فعلي: ${cardActual.toFixed(2)})`;
      if (cardDiff > 0) {
        // البطاقة الفعلية أعلى من المحسوب → خصم من الكاش
        rows.push({ type: "expense", sub_type: "adjustment", method: "نقدي", amount: cardDiff, note: reasonNote, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
      } else {
        // البطاقة الفعلية أقل من المحسوب → إضافة للكاش
        rows.push({ type: "income", sub_type: "adjustment", method: "نقدي", amount: Math.abs(cardDiff), note: reasonNote, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
      }
    }
    if (rows.length > 0) {
      const { data, error } = await supabase.from("treasury_entries").insert(rows).select();
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setEntries((p) => [...data, ...p]);
    }
    setClosingSaved(true);
    showToast("تم حفظ تقفيل اليوم ✓");
  };
  // ── تجميع السجل ──
  const safeEntries = (entries || []).filter(Boolean);
  const groupedByDay = {};
  safeEntries.forEach((e) => {
    if (!groupedByDay[e.date]) groupedByDay[e.date] = [];
    groupedByDay[e.date].push(e);
  });
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  // إجمالي الشهر
  const monthEntries = safeEntries.filter((e) => e.date?.startsWith(monthKey));
  const monthIncome = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned && s.payment !== "آجل").reduce((a, s) => a + s.total, 0)
    + creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0)
    + monthEntries.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
  const monthExpenses = monthEntries.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);

  const cardStyle = (border = C.border) => ({
    background: C.surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });
  const inputStyle = {
    background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8,
    padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0a101a" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>💰 الخزنة</h2>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{today}</div>
        </div>
      </div>

      {/* ── رصيد الخزنة اللحظي ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "💵 نقدي", value: balanceCash, color: C.success },
          { label: "💳 بطاقة", value: balanceCard, color: C.accent },
          { label: "🏦 تحويل", value: balanceTransfer, color: "#a78bfa" },
          { label: "📦 الإجمالي", value: balanceTotal, color: C.warning },
        ].map((b) => (
          <div key={b.label} style={{ background: C.surface, border: "1px solid #1d2d4a", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{b.label}</div>
            <div style={{ color: b.value < 0 ? C.danger : b.color, fontWeight: 900, fontSize: 18 }}>{b.value.toFixed(2)}</div>
            <div style={{ color: C.muted, fontSize: 10 }}>ر.س</div>
          </div>
        ))}
      </div>

      {/* تنبيهات */}
      {(dueFixed.length > 0 || upcomingLicenses.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: dueFixed.length > 0 && upcomingLicenses.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
          {dueFixed.length > 0 && (
            <div style={{ background: "#1a0800", border: "1px solid #4a2800", borderRadius: 12, padding: 12 }}>
              <div style={{ color: C.warning, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⏰ مصاريف ثابتة مستحقة قريباً</div>
              {dueFixed.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: C.text }}>{f.name}</span>
                  <span style={{ color: C.warning, fontWeight: 700 }}>{f.amount} ر.س</span>
                </div>
              ))}
            </div>
          )}
          {upcomingLicenses.length > 0 && (
            <div style={{ background: "#1a0a1a", border: "1px solid #4a1a4a", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📋 تراخيص قريبة التجديد</div>
              {upcomingLicenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: C.text }}>{l.name}</span>
                    <span style={{ color: days <= 14 ? C.danger : C.warning }}>خلال {days} يوم</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bgAlt, borderRadius: 10, padding: 4 }}>
        {[
          { k: "today", l: "📅 تقفيل اليوم" },
          { k: "shifts", l: "🔄 الشفتات" },
          { k: "history", l: "📋 السجل" },
          { k: "fixed", l: "🔒 مصاريف ثابتة" },
          { k: "licenses", l: "📄 التراخيص" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? C.surface : "transparent",
            color: activeTab === t.k ? C.accent : C.muted,
            fontSize: 11, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ══════════ تقفيل اليوم ══════════ */}
      {activeTab === "today" && (
        <div>
          {/* الدخل مقسم */}
          <div style={cardStyle(C.successBg)}>
            <div style={{ color: C.success, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📥 الدخل</div>

            <div style={rowStyle}>
              <span style={{ color: C.muted, fontSize: 13 }}>💵 مبيعات نقدي{hasCardAdjust && cardDiff !== 0 ? " (بعد التسوية)" : ""}</span>
              <span style={{ color: C.success, fontWeight: 700 }}>{(hasCardAdjust ? cashAfterAdjust - todayCreditIncome : todayCash).toFixed(2)} ر.س</span>
            </div>
            <div style={{ ...rowStyle, alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span style={{ color: C.muted, fontSize: 13 }}>💳 مبيعات بطاقة (النظام)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: C.accent, fontWeight: 700 }}>{todayCard.toFixed(2)} ر.س</span>
                  <button onClick={() => setEditingCard((v) => !v)}
                    style={{ background: "transparent", border: "1px solid #1d3a6a", borderRadius: 6, padding: "3px 10px", color: C.accent, fontSize: 11, cursor: "pointer" }}>
                    {editingCard ? "إغلاق" : "تعديل"}
                  </button>
                </div>
              </div>
              {todayReturns > 0 && (
  <div style={rowStyle}>
    <span style={{ color: C.muted, fontSize: 13 }}>↩️ مرتجعات نقدي</span>
    <span style={{ color: C.danger, fontWeight: 700 }}>− {todayReturns.toFixed(2)} ر.س</span>
  </div>
)}
              {editingCard && (
                <div style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d3a6a", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" value={closingForm.card_actual}
                      onChange={(e) => setClosingForm((p) => ({ ...p, card_actual: e.target.value }))}
                      placeholder={`الرقم الفعلي من جهاز النقاط (${todayCard.toFixed(2)})`}
                      style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
                  </div>
                  <input value={closingForm.card_adjust_reason}
                    onChange={(e) => setClosingForm((p) => ({ ...p, card_adjust_reason: e.target.value }))}
                    placeholder="سبب الفرق (اختياري)..." style={inputStyle} />
                  {hasCardAdjust && cardDiff !== 0 && (
                    <div style={{ color: cardDiff > 0 ? C.warning : C.success, fontSize: 12 }}>
                      {cardDiff > 0
                        ? `البطاقة أعلى بـ ${cardDiff.toFixed(2)} ر.س — سيُخصم هذا المبلغ من الكاش`
                        : `البطاقة أقل بـ ${Math.abs(cardDiff).toFixed(2)} ر.س — سيُضاف هذا المبلغ للكاش`}
                    </div>
                  )}
                </div>
              )}
            </div>
            {hasCardAdjust && cardDiff !== 0 && (
              <div style={rowStyle}>
                <span style={{ color: C.warning, fontSize: 13 }}>⚖️ تسوية فرق البطاقة</span>
                <span style={{ color: cardDiff > 0 ? C.warning : C.success, fontWeight: 700 }}>
                  {cardDiff > 0 ? "−" : "+"}{Math.abs(cardDiff).toFixed(2)} ر.س (كاش)
                </span>
              </div>
            )}
            <div style={rowStyle}>
              <span style={{ color: C.muted, fontSize: 13 }}>🏦 مبيعات تحويل</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{todayTransfer.toFixed(2)} ر.س</span>
            </div>
            <div style={rowStyle}>
              <span style={{ color: C.muted, fontSize: 13 }}>✅ سداد آجل</span>
              <span style={{ color: C.accent, fontWeight: 700 }}>{todayCreditIncome.toFixed(2)} ر.س</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={{ color: C.danger, fontSize: 13 }}>📋 مديونية اليوم (غير محصلة)</span>
              <span style={{ color: C.danger, fontWeight: 700 }}>{todayAjil.toFixed(2)} ر.س</span>
            </div>

            {/* دخل إضافي */}
            <div style={{ marginTop: 8, borderTop: "1px solid #1a3a1a", paddingTop: 10 }}>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>دخل إضافي (اختياري)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={closingForm.extra_income_note} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income_note: e.target.value }))}
                  placeholder="وصف الدخل..." style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={closingForm.extra_income} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a3a1a" }}>
              <span style={{ color: C.muted, fontSize: 12, marginLeft: 12 }}>إجمالي الدخل</span>
              <span style={{ color: C.success, fontWeight: 900, fontSize: 16 }}>{totalIncome.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* المصروفات */}
          <div style={cardStyle("#3a1000")}>
            <div style={{ color: C.warning, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📤 المصروفات</div>

            <div style={{ ...rowStyle, gap: 12 }}>
              <span style={{ color: C.muted, fontSize: 13, whiteSpace: "nowrap" as const }}>🪙 نثريات</span>
              {loyaltyRedeemed > 0 && (
  <div style={rowStyle}>
    <span style={{ color: C.muted, fontSize: 13 }}>🌟 استبدال نقاط نقدي</span>
    <span style={{ color: C.warning, fontWeight: 700 }}>{loyaltyRedeemed.toFixed(2)} ر.س</span>
  </div>
)}
              <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <input value={closingForm.petty_note} onChange={(e) => setClosingForm((p) => ({ ...p, petty_note: e.target.value }))}
                  placeholder="وصف..." style={{ ...inputStyle, width: 140 }} />
                <input type="number" value={closingForm.petty} onChange={(e) => setClosingForm((p) => ({ ...p, petty: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
              </div>
            </div>

            {closingForm.variable_expenses.map((exp, i) => (
              <div key={i} style={{ ...rowStyle, gap: 8 }}>
                <span style={{ color: C.muted, fontSize: 13, whiteSpace: "nowrap" as const }}>📦 مصروف</span>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <input value={exp.name} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], name: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="اسم المصروف" style={{ ...inputStyle, width: 140 }} />
                  <input type="number" value={exp.amount} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], amount: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
                  <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: p.variable_expenses.filter((_, j) => j !== i) }))}
                    style={{ background: "#3a0a0a", border: "none", borderRadius: 6, padding: "4px 10px", color: C.warning, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}

            <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: [...p.variable_expenses, { name: "", amount: "" }] }))}
              style={{ background: "#1a0800", border: "1px dashed #3a1800", borderRadius: 8, padding: "7px 14px", color: C.warning, cursor: "pointer", fontSize: 12, width: "100%", marginTop: 4 }}>
              + إضافة مصروف متغير
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a1000" }}>
              <span style={{ color: C.muted, fontSize: 12, marginLeft: 12 }}>إجمالي المصروفات</span>
              <span style={{ color: C.warning, fontWeight: 900, fontSize: 16 }}>{totalExpenses.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* صافي الخزنة */}
          <div style={{ ...cardStyle("#1a2a4a"), textAlign: "center" as const, padding: 20 }}>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>🏦 صافي الخزنة اليوم</div>
            <div style={{ color: netCash >= 0 ? C.success : C.danger, fontWeight: 900, fontSize: 32, marginBottom: 4 }}>
              {netCash.toFixed(2)} ر.س
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, color: C.muted }}>
              <span>نقدي: <b style={{ color: C.success }}>{cashAfterAdjust.toFixed(0)}</b></span>
              <span>بطاقة: <b style={{ color: C.accent }}>{cardActual.toFixed(0)}</b></span>
              <span>تحويل: <b style={{ color: "#a78bfa" }}>{todayTransfer.toFixed(0)}</b></span>
            </div>
            {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).length > 0 && (
              <div style={{ color: C.warning, fontSize: 11, marginTop: 8 }}>
                ⚠️ مصاريف ثابتة مستحقة قريبًا وغير مدفوعة: {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).map((f) => f.name).join("، ")}
                {" "}({dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).reduce((a, f) => a + (+f.amount || 0), 0).toFixed(2)} ر.س)
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            {!closingSaved
              ? <Btn icon="check" onClick={saveClosing}>حفظ تقفيل اليوم</Btn>
              : <div style={{ color: C.success, fontWeight: 700, padding: "10px 16px", fontSize: 13 }}>✅ تم الحفظ</div>
            }
          </div>
        </div>
      )}

      {/* ══════════ تاب الشفتات ══════════ */}
      {activeTab === "shifts" && (
        <div>
          {todayShifts.length === 0 ? (
            <div style={{ color: C.muted, textAlign: "center" as const, padding: 40 }}>لا توجد شفتات اليوم</div>
          ) : (
            <>
              {todayShifts.map((sh) => {
                const ss = getShiftSales(sh.id);
                return (
                  <div key={sh.id} style={cardStyle(C.surface)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <span style={{ color: C.accent, fontWeight: 700 }}>{sh.id}</span>
                        <span style={{ color: C.muted, fontSize: 11, marginRight: 10 }}>{sh.user}</span>
                      </div>
                      <div style={{ color: sh.end_time ? C.success : C.warning, fontSize: 11, fontWeight: 700 }}>
                        {sh.end_time ? "✅ مغلق" : "🟡 مفتوح"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { l: "نقدي", v: ss.cash, c: C.success },
                        { l: "بطاقة", v: ss.card, c: C.accent },
                        { l: "تحويل", v: ss.transfer, c: "#a78bfa" },
                        { l: "إجمالي", v: ss.total, c: C.warning },
                      ].map((x) => (
                        <div key={x.l} style={{ background: C.bgAlt, borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                          <div style={{ color: C.muted, fontSize: 10 }}>{x.l}</div>
                          <div style={{ color: x.c, fontWeight: 700, fontSize: 14 }}>{x.v.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    {ss.ajil > 0 && (
                      <div style={{ marginTop: 8, color: C.danger, fontSize: 12 }}>
                        مديونية: {ss.ajil.toFixed(2)} ر.س ({ss.count} فاتورة)
                      </div>
                    )}
                  </div>
                );
              })}

              {/* إجمالي اليوم */}
              <div style={{ ...cardStyle("#2a3a1a"), marginTop: 8 }}>
                <div style={{ color: C.success, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📊 إجمالي اليوم</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[
                    { l: "نقدي", v: todayCash, c: C.success },
                    { l: "بطاقة", v: todayCard, c: C.accent },
                    { l: "تحويل", v: todayTransfer, c: "#a78bfa" },
                    { l: "الإجمالي", v: todayCash + todayCard + todayTransfer, c: C.warning },
                  ].map((x) => (
                    <div key={x.l} style={{ background: C.bgAlt, borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: C.muted, fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* إجمالي الشهر */}
              <div style={{ ...cardStyle("#1a2a4a"), marginTop: 8 }}>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📅 إجمالي الشهر</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "دخل الشهر", v: monthIncome, c: C.success },
                    { l: "مصروفات الشهر", v: monthExpenses, c: C.warning },
                    { l: "صافي الشهر", v: monthIncome - monthExpenses, c: monthIncome - monthExpenses >= 0 ? C.accent : C.danger },
                  ].map((x) => (
                    <div key={x.l} style={{ background: C.bgAlt, borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: C.muted, fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>ر.س</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ السجل ══════════ */}
      {activeTab === "history" && (
        <div>
          {/* ملخص الشهر */}
          <div style={{ ...cardStyle("#1a2a4a"), display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: C.muted, fontSize: 11 }}>دخل الشهر</div>
              <div style={{ color: C.success, fontWeight: 900, fontSize: 18 }}>{monthIncome.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: C.muted, fontSize: 11 }}>مصروفات الشهر</div>
              <div style={{ color: C.warning, fontWeight: 900, fontSize: 18 }}>{monthExpenses.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: C.muted, fontSize: 11 }}>صافي الشهر</div>
              <div style={{ color: monthIncome - monthExpenses >= 0 ? C.accent : C.danger, fontWeight: 900, fontSize: 18 }}>
                {(monthIncome - monthExpenses).toFixed(0)} ر.س
              </div>
            </div>
          </div>

          {sortedDays.slice(0, 30).map((day) => {
            const dayEnt = groupedByDay[day];
            const dayIncome = dayEnt.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
            const dayExp = dayEnt.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);
            const isOpen = selectedDay === day;
            return (
              <div key={day} style={cardStyle()}>
                <div onClick={() => setSelectedDay(isOpen ? null : day)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div>
                    <div style={{ color: C.text, fontWeight: 700 }}>{day}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{dayEnt.length} قيد</div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: C.success, fontWeight: 700 }}>+{dayIncome.toFixed(0)}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>دخل</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: C.warning, fontWeight: 700 }}>-{dayExp.toFixed(0)}</div>
                      <div style={{ color: C.muted, fontSize: 10 }}>مصروف</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: dayIncome - dayExp >= 0 ? C.accent : C.danger, fontWeight: 900 }}>
                        {(dayIncome - dayExp).toFixed(0)}
                      </div>
                      <div style={{ color: C.muted, fontSize: 10 }}>صافي</div>
                    </div>
                    <span style={{ color: C.muted }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: "1px solid #0a101a", paddingTop: 10 }}>
                    {dayEnt.map((e) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                        <div>
                          <span style={{ color: "#7a9aaa" }}>{e.note || e.sub_type}</span>
                          {e.method && <span style={{ color: C.muted, fontSize: 10, marginRight: 8 }}>({e.method})</span>}
                        </div>
                        <span style={{ color: e.type === "income" ? C.success : C.warning, fontWeight: 700 }}>
                          {e.type === "income" ? "+" : "-"}{e.amount} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {sortedDays.length === 0 && <div style={{ color: C.muted, textAlign: "center" as const, padding: 40 }}>لا توجد قيود مسجلة</div>}
        </div>
      )}

      {/* ══════════ المصاريف الثابتة ══════════ */}
      {activeTab === "fixed" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowFixedForm(true)}>إضافة مصروف ثابت</Btn>
          </div>
          {fixedExpenses.length === 0
            ? <div style={{ color: C.muted, textAlign: "center" as const, padding: 40 }}>لا توجد مصاريف ثابتة</div>
            : (
              <>
                <div style={{ ...cardStyle(C.warningBg), display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.warning, fontWeight: 700 }}>إجمالي شهري (متوسط الأقساط)</span>
                  <span style={{ color: C.warning, fontWeight: 900, fontSize: 16 }}>{monthFixedTotal.toFixed(2)} ر.س</span>
                </div>
                {fixedExpenses.map((f) => {
  const due = isDueThisMonth(f);
  const rec = f.recurrence || "monthly";
  return (
    <div key={f.id} style={cardStyle(due ? "#3a2000" : C.border)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: C.text, fontWeight: 700 }}>{f.name}</span>
            <span style={{ fontSize: 10, color: "#7a8aaa", background: C.divider, padding: "2px 6px", borderRadius: 5 }}>
              {recurrenceLabel[rec]}
            </span>
          </div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
            يوم {f.due_day}{rec !== "monthly" ? ` من شهر الاستحقاق` : " من كل شهر"}
            {due && Math.abs(+f.due_day - currentDay) <= 3 && <span style={{ color: C.warning, marginRight: 8 }}>⏰ مستحقة قريباً</span>}
            {!due && <span style={{ color: C.muted, marginRight: 8 }}>غير مستحقة هذا الشهر</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "left" as const }}>
            <div style={{ color: C.warning, fontWeight: 900, fontSize: 16 }}>{f.amount} ر.س</div>
            {rec !== "monthly" && (
              <div style={{ color: C.muted, fontSize: 10 }}>≈ {monthlyShare(f).toFixed(2)} ر.س / شهر</div>
            )}
          </div>
          <button
            onClick={async () => {
              const { error } = await supabase.from("treasury_entries").insert([{
                type: "expense", sub_type: "fixed", method: "نقدي",
                amount: f.amount, note: f.name, date: today,
                pharmacy_id: pharmacyId, created_by: currentUser.name
              }]);
              if (error) { showToast("خطأ: " + error.message, "error"); return; }
              setEntries((p) => [...p, { type: "expense", sub_type: "fixed", method: "نقدي", amount: f.amount, note: f.name, date: today }]);
              showToast(`تم سداد ${f.name} ✓`);
            }}
            style={{ background: C.successBg, border: "1px solid #2a6a2a", borderRadius: 8, padding: "6px 14px", color: C.success, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            💳 سداد
          </button>
          <button
            onClick={async () => {
              if (!confirm(`حذف "${f.name}"؟`)) return;
              await supabase.from("fixed_expenses").delete().eq("id", f.id);
              setFixedExpenses((p) => p.filter((x) => x.id !== f.id));
              showToast("تم الحذف");
            }}
            style={{ background: "#3a0a0a", border: "none", borderRadius: 8, padding: "6px 10px", color: C.danger, cursor: "pointer", fontSize: 14 }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  );
})}
         </>
            )
          }
        </div>
      )}       
      {/* ══════════ التراخيص ══════════ */}
      {activeTab === "licenses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowLicenseForm(true)}>إضافة ترخيص</Btn>
          </div>
          {licenses.length === 0
            ? <div style={{ color: C.muted, textAlign: "center" as const, padding: 40 }}>لا توجد تراخيص</div>
            : licenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                const urgent = days <= 14; const soon = days <= 60;
                return (
                  <div key={l.id} style={cardStyle(urgent ? "#4a0000" : soon ? "#3a2000" : C.border)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: C.text, fontWeight: 700 }}>{l.name}</div>
                        <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                          تجديد: {l.renew_date}{l.note && ` • ${l.note}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" as const }}>
                        <div style={{ color: urgent ? C.danger : soon ? C.warning : C.success, fontWeight: 700 }}>
                          {days <= 0 ? "⚠️ منتهي" : `خلال ${days} يوم`}
                        </div>
                        <div style={{ color: "#a78bfa", fontWeight: 700 }}>{l.amount} ر.س</div>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}
      {/* Modal مصروف ثابت */}
      <Modal open={showFixedForm} onClose={() => setShowFixedForm(false)} title="🔒 إضافة مصروف ثابت">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="اسم المصروف" value={fixedForm.name} onChange={(v) => setFixedForm((p) => ({ ...p, name: v }))} placeholder="إيجار، رواتب..." />
          <Input label="المبلغ (ر.س)" value={fixedForm.amount} onChange={(v) => setFixedForm((p) => ({ ...p, amount: v }))} type="number" />
          <Select label="نوع التكرار" value={fixedForm.recurrence}
            onChange={(v) => setFixedForm((p) => ({ ...p, recurrence: v }))}
            options={[
              { v: "monthly", l: "شهري" },
              { v: "quarterly", l: "ربع سنوي (كل 3 أشهر)" },
              { v: "semi_annual", l: "نصف سنوي (كل 6 أشهر)" },
              { v: "annual", l: "سنوي" },
            ]} />
          <Input label="يوم الاستحقاق (1-31)" value={fixedForm.due_day} onChange={(v) => setFixedForm((p) => ({ ...p, due_day: v }))} type="number" />
          {fixedForm.recurrence !== "monthly" && (
            <Select label="شهر أول استحقاق" value={fixedForm.due_month}
              onChange={(v) => setFixedForm((p) => ({ ...p, due_month: v }))}
              options={[
                { v: "1", l: "يناير" }, { v: "2", l: "فبراير" }, { v: "3", l: "مارس" },
                { v: "4", l: "أبريل" }, { v: "5", l: "مايو" }, { v: "6", l: "يونيو" },
                { v: "7", l: "يوليو" }, { v: "8", l: "أغسطس" }, { v: "9", l: "سبتمبر" },
                { v: "10", l: "أكتوبر" }, { v: "11", l: "نوفمبر" }, { v: "12", l: "ديسمبر" },
              ]} />
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowFixedForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            if (!fixedForm.name || !fixedForm.amount) return;
            const { data, error } = await supabase.from("fixed_expenses").insert([{ ...fixedForm, amount: +fixedForm.amount, due_month: +fixedForm.due_month, pharmacy_id: pharmacyId }]).select();
            if (error) { showToast("خطأ: " + error.message, "error"); return; }
            setFixedExpenses((p) => [...p, data[0]]);
            setFixedForm({ name: "", amount: "", due_day: "1", recurrence: "monthly", due_month: "1" });
            setShowFixedForm(false);
            showToast("تم الإضافة ✓");
          }}>إضافة</Btn>
        </div>
      </Modal>

      {/* Modal ترخيص */}
      <Modal open={showLicenseForm} onClose={() => setShowLicenseForm(false)} title="📄 إضافة ترخيص">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="اسم الترخيص" value={licenseForm.name} onChange={(v) => setLicenseForm((p) => ({ ...p, name: v }))} placeholder="رخصة تشغيل..." />
          <Input label="تاريخ التجديد" value={licenseForm.renew_date} onChange={(v) => setLicenseForm((p) => ({ ...p, renew_date: v }))} type="date" />
          <Input label="التكلفة (ر.س)" value={licenseForm.amount} onChange={(v) => setLicenseForm((p) => ({ ...p, amount: v }))} type="number" />
          <Input label="ملاحظات" value={licenseForm.note} onChange={(v) => setLicenseForm((p) => ({ ...p, note: v }))} placeholder="تفاصيل..." />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowLicenseForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            if (!licenseForm.name || !licenseForm.renew_date) return;
            const { data, error } = await supabase.from("licenses").insert([{ ...licenseForm, amount: +licenseForm.amount || 0, pharmacy_id: pharmacyId }]).select();
            if (error) { showToast("خطأ: " + error.message, "error"); return; }
            setLicenses((p) => [...p, data[0]].sort((a, b) => a.renew_date.localeCompare(b.renew_date)));
            setLicenseForm({ name: "", renew_date: "", amount: "", note: "" });
            setShowLicenseForm(false);
            showToast("تم الإضافة ✓");
          }}>إضافة</Btn>
        </div>
      </Modal>
    </div>
  );
}
// ==================== TAX REPORT ====================
