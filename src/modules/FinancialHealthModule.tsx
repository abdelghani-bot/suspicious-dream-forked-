import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { DEFAULT_FIN_THRESHOLDS, FIN_METRIC_ORDER, FIN_STATUS_COLOR, FIN_STATUS_LABEL, calculateFinancialHealth, compareFinTrend } from "../lib/financeUtils";
import { Badge, Btn, IC, Input, Modal, Table } from "../ui/primitives";

export function FinLineChart({ series, height = 180 }) {
  // series: [{ label, points: [{x: 'شهر', y: number}], color }]
  const allY = series.flatMap((s) => s.points.map((p) => p.y)).filter((y) => y !== null && !isNaN(y));
  if (allY.length === 0) {
    return <div style={{ color: COLORS.textDim, textAlign: "center", padding: 30, fontSize: 13 }}>لا توجد بيانات كافية للرسم</div>;
  }
  const maxY = Math.max(...allY, 0.0001);
  const minY = Math.min(...allY, 0);
  const range = maxY - minY || 1;
  const pointsCount = series[0]?.points.length || 1;
  const w = 100;
  const toX = (i) => (pointsCount > 1 ? (i / (pointsCount - 1)) * w : w / 2);
  const toY = (val) => {
    if (val === null || isNaN(val)) return null;
    return height - ((val - minY) / range) * (height - 24) - 12;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        {series.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.textDim }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
        {series.map((s) => {
          const pts = s.points.map((p, i) => `${toX(i)},${toY(p.y) ?? height}`).join(" ");
          return (
            <polyline
              key={s.label}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={0.9}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {(series[0]?.points || []).map((p, i) => (
          <span key={i} style={{ fontSize: 10, color: COLORS.textDim }}>{p.x}</span>
        ))}
      </div>
    </div>
  );
}



export function FinancialHealthModule({
  sales = [],
  purchases = [],
  products = [],
  customers = [],
  suppliers = [],
  creditPayments = [],
  pharmacyId,
  currentUser,
  showToast,
  canEditFinance = true,
}) {
  const [snapshots, setSnapshots] = useState([]);
  const [opExpenseRows, setOpExpenseRows] = useState([]);
  const [thresholds, setThresholds] = useState(DEFAULT_FIN_THRESHOLDS);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertsLog, setAlertsLog] = useState([]);
  const [showAlertsLog, setShowAlertsLog] = useState(false);
  const unreadAlertsCount = alertsLog.filter((a) => !a.is_read).length;

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [formMonth, setFormMonth] = useState(currentMonthKey);
  const [form, setForm] = useState({
    inventory_value: "",
    cash_balance: "",
    accounts_receivable: "",
    accounts_payable: "",
  });
  const [expenseItems, setExpenseItems] = useState([]); // [{id, category, amount, note}]

  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const [{ data: snaps }, { data: settingsRow }, { data: alerts }] = await Promise.all([
        supabase.from("financial_snapshots").select("*").eq("pharmacy_id", pharmacyId).order("snapshot_date", { ascending: true }),
        supabase.from("financial_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
        supabase.from("financial_alerts").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(100),
      ]);
      setSnapshots(snaps || []);
      setAlertsLog(alerts || []);
      if (settingsRow?.thresholds) {
        setThresholds({ ...DEFAULT_FIN_THRESHOLDS, ...settingsRow.thresholds });
      }
      setLoading(false);
    };
    load();
  }, [pharmacyId]);

  // ── حساب البنود اللي بتتحسب تلقائيًا من بيانات موجودة أصلاً (مبيعات/تكلفة/مديونيات) ──
  const computeAutoFigures = (monthKey) => {
    const monthSales = sales.filter((s) => s.date?.startsWith(monthKey));
    let totalSales = 0, totalCogs = 0;
    monthSales.forEach((s) => {
      let items = [];
      try { items = typeof s.items === "string" ? JSON.parse(s.items) : (s.items || []); } catch { items = []; }
      items.filter((it) => !it.isMissed).forEach((it) => {
        const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
        const price = it.price ?? 0;
        const qty = it.qty || 0;
        totalSales += price * qty;
        totalCogs += cost * qty;
      });
    });
    // مديونية العملاء المستحقة حاليًا (كل الشهور، مش شهر واحد بس — لأنها رصيد لحظي)
    const ajilSales = sales.filter((s) => s.payment === "آجل");
    const totalAR = ajilSales.reduce((sum, inv) => {
      const paid = creditPayments.filter((p) => p.invoice_id === inv.id).reduce((x, p) => x + (p.amount || 0), 0);
      return sum + Math.max((inv.total || 0) - paid, 0);
    }, 0);
    const totalAP = suppliers.reduce((sum, s) => sum + (s.opening_balance || 0), 0);
    const inventoryValueSuggested = products.reduce((sum, p) => sum + (p.stock || 0) * (p.cost || 0), 0);
    return { totalSales, totalCogs, totalAR, totalAP, inventoryValueSuggested };
  };

  const openForm = async (monthKey) => {
    setFormMonth(monthKey);
    const auto = computeAutoFigures(monthKey);
    const existing = snapshots.find((s) => s.snapshot_date === monthKey + "-01");
    setForm({
      inventory_value: existing?.inventory_value ?? Math.round(auto.inventoryValueSuggested),
      cash_balance: existing?.cash_balance ?? "",
      accounts_receivable: existing?.accounts_receivable ?? Math.round(auto.totalAR),
      accounts_payable: existing?.accounts_payable ?? Math.round(auto.totalAP),
    });
    const { data: rows } = await supabase
      .from("operating_expenses")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .eq("snapshot_month", monthKey);
    setExpenseItems(rows && rows.length > 0 ? rows.map((r) => ({ ...r, _tempId: r.id })) : [
      { _tempId: `tmp-${Date.now()}`, category: "إيجار", amount: "", note: "" },
    ]);
    setShowForm(true);
  };

  const addExpenseRow = () => setExpenseItems((p) => [...p, { _tempId: `tmp-${Date.now()}`, category: "", amount: "", note: "" }]);
  const removeExpenseRow = (id) => setExpenseItems((p) => p.filter((r) => r._tempId !== id));
  const updateExpenseRow = (id, field, val) => setExpenseItems((p) => p.map((r) => (r._tempId === id ? { ...r, [field]: val } : r)));

  const saveSnapshot = async () => {
    setSaving(true);
    try {
      const auto = computeAutoFigures(formMonth);
      const opTotal = expenseItems.reduce((s, r) => s + (+r.amount || 0), 0);
      const grossProfit = auto.totalSales - auto.totalCogs;
      const netProfit = grossProfit - opTotal;

      const payload = {
        pharmacy_id: pharmacyId,
        snapshot_date: formMonth + "-01",
        total_sales: auto.totalSales,
        total_cogs: auto.totalCogs,
        gross_profit: grossProfit,
        operating_expenses: opTotal,
        net_profit: netProfit,
        inventory_value: +form.inventory_value || 0,
        cash_balance: +form.cash_balance || 0,
        accounts_receivable: +form.accounts_receivable || 0,
        accounts_payable: +form.accounts_payable || 0,
        days_in_period: new Date(+formMonth.split("-")[0], +formMonth.split("-")[1], 0).getDate(),
        created_by: currentUser?.name || "",
      };

      const { data: savedRows, error: snapError } = await supabase
        .from("financial_snapshots")
        .upsert(payload, { onConflict: "pharmacy_id,snapshot_date" })
        .select();

      if (snapError) {
        showToast("❌ فشل حفظ الموقف المالي: " + snapError.message, "error");
        setSaving(false);
        return;
      }

      // تحديث بنود المصاريف التشغيلية: حذف القديم لنفس الشهر وإدخال الجديد
      await supabase.from("operating_expenses").delete().eq("pharmacy_id", pharmacyId).eq("snapshot_month", formMonth);
      const validExpenseRows = expenseItems.filter((r) => r.category && (+r.amount || 0) > 0);
      if (validExpenseRows.length > 0) {
        await supabase.from("operating_expenses").insert(
          validExpenseRows.map((r) => ({
            pharmacy_id: pharmacyId,
            snapshot_month: formMonth,
            category: r.category,
            amount: +r.amount || 0,
            note: r.note || "",
          }))
        );
      }

      const savedSnap = savedRows && savedRows[0] ? savedRows[0] : payload;
      setSnapshots((prev) => {
        const others = prev.filter((s) => s.snapshot_date !== savedSnap.snapshot_date);
        return [...others, savedSnap].sort((a, b) => (a.snapshot_date > b.snapshot_date ? 1 : -1));
      });

      // ── التنبيهات بتتحسب وتتسجل تلقائيًا في الداتابيز (trigger على financial_snapshots) ──
      // مصدر الحقيقة الوحيد للتنبيهات بقى الـ DB مش حساب محلي، عشان تفضل متسجلة حتى لو حد تاني فتح البيانات
      const { data: newAlerts } = await supabase
        .from("financial_alerts")
        .select("*")
        .eq("snapshot_id", savedSnap.id)
        .order("created_at", { ascending: false });

      setAlertsLog((prev) => {
        const others = prev.filter((a) => a.snapshot_id !== savedSnap.id);
        return [...(newAlerts || []), ...others].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });

      const redAlerts = (newAlerts || []).filter((a) => a.status === "red");
      showToast(
        redAlerts.length > 0
          ? `✅ تم حفظ الموقف المالي — لكن فيه ${redAlerts.length} نسبة في منطقة الخطر`
          : "✅ تم حفظ الموقف المالي لشهر " + formMonth,
        redAlerts.length > 0 ? "warn" : "success"
      );
      redAlerts.forEach((a, i) => setTimeout(() => showToast(`⚠️ ${a.message}`, "error"), (i + 1) * 900));

      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const saveThresholds = async (newThresholds) => {
    setThresholds(newThresholds);
    await supabase.from("financial_settings").upsert(
      { pharmacy_id: pharmacyId, thresholds: newThresholds },
      { onConflict: "pharmacy_id" }
    );
    showToast("✅ تم تحديث حدود التنبيه", "success");
  };

  const markAlertRead = async (alertId) => {
    setAlertsLog((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
    await supabase.from("financial_alerts").update({ is_read: true }).eq("id", alertId);
  };

  const markAllAlertsRead = async () => {
    const unreadIds = alertsLog.filter((a) => !a.is_read).map((a) => a.id);
    if (unreadIds.length === 0) return;
    setAlertsLog((prev) => prev.map((a) => ({ ...a, is_read: true })));
    await supabase.from("financial_alerts").update({ is_read: true }).in("id", unreadIds);
  };

  const latestSnap = snapshots[snapshots.length - 1];
  const prevSnap = snapshots[snapshots.length - 2];
  const latestMetrics = latestSnap ? calculateFinancialHealth(latestSnap, thresholds) : [];
  const prevMetrics = prevSnap ? calculateFinancialHealth(prevSnap, thresholds) : [];

  const netProfitSeries = [{
    label: "صافي الربح (ر.س)",
    color: COLORS.blue,
    points: snapshots.slice(-12).map((s) => ({ x: s.snapshot_date.slice(0, 7), y: s.net_profit })),
  }];
  const quickRatioSeries = [{
    label: "نسبة السيولة السريعة (×)",
    color: COLORS.gold,
    points: snapshots.slice(-12).map((s) => {
      const m = calculateFinancialHealth(s, thresholds).find((x) => x.key === "quick_ratio");
      return { x: s.snapshot_date.slice(0, 7), y: m?.value ?? null };
    }),
  }];

  if (loading) {
    return <div style={{ color: COLORS.textDim, textAlign: "center", padding: 60 }}>جاري تحميل الموقف المالي...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ color: COLORS.textPrimary, margin: 0, fontSize: 20, fontWeight: 800 }}>💵 الموقف المالي</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" icon="bell" size="sm" onClick={() => setShowAlertsLog(true)}>
            سجل التنبيهات{unreadAlertsCount > 0 ? ` (${unreadAlertsCount})` : ""}
          </Btn>
          {canEditFinance && (
            <>
              <Btn variant="secondary" icon="settings" size="sm" onClick={() => setShowThresholds(true)}>حدود التنبيه</Btn>
              <Btn variant="primary" icon="plus" size="sm" onClick={() => openForm(currentMonthKey)}>
                {snapshots.find((s) => s.snapshot_date === currentMonthKey + "-01") ? "تحديث بيانات الشهر الحالي" : "تسجيل الشهر الحالي"}
              </Btn>
            </>
          )}
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div style={{ color: COLORS.textDim, textAlign: "center", padding: 60, background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
          لا توجد بيانات موقف مالي مسجلة بعد. اضغط "تسجيل الشهر الحالي" للبدء — المبيعات والتكلفة هتُحسب تلقائيًا،
          والباقي (المخزون/الكاش/المديونيات) هيكون له اقتراح جاهز تقدر تعدّله.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
            {latestMetrics.map((m) => {
              const prevM = prevMetrics.find((pm) => pm.key === m.key);
              const trend = prevM ? compareFinTrend(m.value, prevM.value, m.cfg.direction) : null;
              const trendIcon = trend === "improved" ? "▲" : trend === "worsened" ? "▼" : trend === "stable" ? "—" : "";
              const trendColor = trend === "improved" ? COLORS.green : trend === "worsened" ? COLORS.red : COLORS.textDim;
              return (
                <div key={m.key} style={{
                  background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                  border: `1px solid ${FIN_STATUS_COLOR[m.status]}55`,
                  borderRadius: 14, padding: "16px 18px",
                }}>
                  <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>{m.cfg.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: FIN_STATUS_COLOR[m.status] }}>
                      {m.value != null ? m.value.toFixed(m.cfg.unit === "%" ? 1 : 2) : "—"}
                    </span>
                    <span style={{ fontSize: 12, color: COLORS.textDim }}>{m.cfg.unit}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <Badge color={FIN_STATUS_COLOR[m.status] + "22"} text={FIN_STATUS_COLOR[m.status]}>{FIN_STATUS_LABEL[m.status]}</Badge>
                    {trend && <span style={{ color: trendColor, fontSize: 12, fontWeight: 700 }}>{trendIcon}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
            }}>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 14, marginBottom: 12 }}>تطور صافي الربح شهر بشهر</div>
              <FinLineChart series={netProfitSeries} />
            </div>
            <div style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
            }}>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 14, marginBottom: 12 }}>تطور نسبة السيولة السريعة شهر بشهر</div>
              <FinLineChart series={quickRatioSeries} />
            </div>
          </div>

          <div style={{
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden",
          }}>
            <Table
              headers={["النسبة", "القيمة", "التعريف", "الحالة"]}
              rows={latestMetrics.map((m) => [
                m.cfg.label,
                m.value != null ? `${m.value.toFixed(2)} ${m.cfg.unit}` : "—",
                FIN_METRIC_DEFINITIONS[m.key],
                <Badge key={m.key} color={FIN_STATUS_COLOR[m.status] + "22"} text={FIN_STATUS_COLOR[m.status]}>{FIN_STATUS_LABEL[m.status]}</Badge>,
              ])}
            />
          </div>
        </>
      )}

      {/* ── مودال تسجيل/تحديث بيانات الشهر ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={`بيانات الموقف المالي — ${formMonth}`} wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="الشهر" type="month" value={formMonth} onChange={(v) => openForm(v)} required={false} />

          <div style={{ padding: 12, background: COLORS.surfaceAlt, borderRadius: 10, fontSize: 12, color: COLORS.textDim }}>
            المبيعات وتكلفة البضاعة والمصروفات المستحقة هتُحسب تلقائيًا من بيانات المبيعات والمديونيات الموجودة عندك.
            البنود اللي تحتها (المخزون/الكاش) عليك تأكيدها لأنها أرقام لحظية مش متتبَّعة تلقائيًا بالكامل.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="قيمة المخزون الحالية (ر.س)" type="number" value={form.inventory_value} onChange={(v) => setForm((p) => ({ ...p, inventory_value: v }))} required={false} />
            <Input label="الكاش المتاح (خزنة + بنك) (ر.س)" type="number" value={form.cash_balance} onChange={(v) => setForm((p) => ({ ...p, cash_balance: v }))} required={false} />
            <Input label="مديونية العملاء (آجل) (ر.س)" type="number" value={form.accounts_receivable} onChange={(v) => setForm((p) => ({ ...p, accounts_receivable: v }))} required={false} />
            <Input label="مديونية الموردين (ر.س)" type="number" value={form.accounts_payable} onChange={(v) => setForm((p) => ({ ...p, accounts_payable: v }))} required={false} />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: COLORS.textDim, fontSize: 13, fontWeight: 700 }}>المصاريف التشغيلية الشهرية (إيجار، رواتب، كهرباء...)</span>
              <Btn variant="ghost" size="sm" icon="plus" onClick={addExpenseRow}>إضافة بند</Btn>
            </div>
            {expenseItems.map((row) => (
              <div key={row._tempId} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end" }}>
                <Input label="البند" value={row.category} onChange={(v) => updateExpenseRow(row._tempId, "category", v)} placeholder="إيجار" required={false} style={{ flex: 2 }} />
                <Input label="المبلغ" type="number" value={row.amount} onChange={(v) => updateExpenseRow(row._tempId, "amount", v)} placeholder="0" required={false} style={{ flex: 1 }} />
                <button onClick={() => removeExpenseRow(row._tempId)} style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", padding: "9px 6px" }}>
                  <IC n="trash" s={16} />
                </button>
              </div>
            ))}
            <div style={{ textAlign: "left", color: COLORS.textDim, fontSize: 12, marginTop: 4 }}>
              إجمالي المصاريف: {expenseItems.reduce((s, r) => s + (+r.amount || 0), 0).toFixed(2)} ر.س
            </div>
          </div>

          <Btn variant="primary" onClick={saveSnapshot} disabled={saving} style={{ justifyContent: "center" }} icon="check">
            {saving ? "جاري الحفظ..." : "حفظ الموقف المالي"}
          </Btn>
        </div>
      </Modal>

      {/* ── مودال تعديل حدود التنبيه ── */}
      <Modal open={showThresholds} onClose={() => setShowThresholds(false)} title="حدود التنبيه للنسب المالية" wide>
        <FinThresholdsEditor thresholds={thresholds} onSave={saveThresholds} />
      </Modal>

      {/* ── سجل التنبيهات المالية (متولّد تلقائيًا من الداتابيز عند كل حفظ) ── */}
      <Modal open={showAlertsLog} onClose={() => setShowAlertsLog(false)} title="🔔 سجل التنبيهات المالية" wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alertsLog.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="secondary" size="sm" onClick={markAllAlertsRead} disabled={unreadAlertsCount === 0}>
                تحديد الكل كمقروء
              </Btn>
            </div>
          )}
          {alertsLog.length === 0 ? (
            <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>
              لا توجد تنبيهات — كل النسب المالية كانت في المنطقة الصحية وقت الحفظ.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {alertsLog.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    background: a.is_read ? "transparent" : COLORS.surface,
                    border: `1px solid ${FIN_STATUS_COLOR[a.status] || COLORS.border}55`,
                    borderRight: `4px solid ${FIN_STATUS_COLOR[a.status] || COLORS.border}`,
                    borderRadius: 10, padding: "10px 14px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: a.is_read ? 400 : 700 }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
                      شهر {a.snapshot_date?.slice(0, 7)} — {new Date(a.created_at).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                  {!a.is_read && (
                    <Btn variant="secondary" size="sm" onClick={() => markAlertRead(a.id)}>تم الاطلاع</Btn>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}



export const FIN_METRIC_DEFINITIONS = {
  quick_ratio: "(الكاش + مديونية العملاء) ÷ مديونية الموردين — قدرتك على تغطية التزاماتك القريبة بدون بيع مخزون",
  gross_margin: "الربح الإجمالي ÷ المبيعات — الهامش بعد خصم تكلفة البضاعة فقط",
  net_margin: "الربح الصافي ÷ المبيعات — الهامش بعد خصم كل المصاريف التشغيلية",
  inventory_turnover: "تكلفة البضاعة المباعة ÷ قيمة المخزون (مُحوَّلة سنويًا) — كل ما زادت زاد دوران المخزون",
  dso: "متوسط الأيام اللي تستغرقها لتحصيل مديونية العملاء",
  dpo: "متوسط الأيام اللي تستغرقها لسداد مديونية الموردين",
};



export function FinThresholdsEditor({ thresholds, onSave }) {
  const [local, setLocal] = useState(thresholds);
  const [saving, setSaving] = useState(false);

  const update = (key, field, val) => setLocal((p) => ({ ...p, [key]: { ...p[key], [field]: val === "" ? "" : +val } }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {FIN_METRIC_ORDER.map((key) => {
        const cfg = local[key];
        return (
          <div key={key} style={{ padding: 12, background: COLORS.surfaceAlt, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13, marginBottom: 8 }}>{cfg.label} ({cfg.unit})</div>
            {cfg.direction === "higher_better" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input label="الحد الصحي (أكبر من)" type="number" value={cfg.healthyMin} onChange={(v) => update(key, "healthyMin", v)} required={false} />
                <Input label="حد المراقبة (أكبر من)" type="number" value={cfg.warningMin} onChange={(v) => update(key, "warningMin", v)} required={false} />
              </div>
            )}
            {cfg.direction === "lower_better" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Input label="الحد الصحي (أصغر من)" type="number" value={cfg.healthyMax} onChange={(v) => update(key, "healthyMax", v)} required={false} />
                <Input label="حد المراقبة (أصغر من)" type="number" value={cfg.warningMax} onChange={(v) => update(key, "warningMax", v)} required={false} />
              </div>
            )}
            {cfg.direction === "range" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                <Input label="أدنى صحي" type="number" value={cfg.healthyMin} onChange={(v) => update(key, "healthyMin", v)} required={false} />
                <Input label="أعلى صحي" type="number" value={cfg.healthyMax} onChange={(v) => update(key, "healthyMax", v)} required={false} />
                <Input label="أدنى مراقبة" type="number" value={cfg.warningMin} onChange={(v) => update(key, "warningMin", v)} required={false} />
                <Input label="أعلى مراقبة" type="number" value={cfg.warningMax} onChange={(v) => update(key, "warningMax", v)} required={false} />
              </div>
            )}
          </div>
        );
      })}
      <Btn variant="primary" disabled={saving} style={{ justifyContent: "center" }} icon="check" onClick={async () => { setSaving(true); await onSave(local); setSaving(false); }}>
        {saving ? "جاري الحفظ..." : "حفظ الحدود"}
      </Btn>
    </div>
  );
}
