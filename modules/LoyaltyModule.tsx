export function LoyaltyModule({
  const { C } = useTheme();
  customers,
  sales,
  products,
  pharmacyId,
  showToast,
}: {
  customers: any[];
  sales: any[];
  products: any[];
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
}) {
  // ── State ──
  const [tab, setTab] = useState<"customers" | "settings" | "transactions">("customers");
  const [settings, setSettings] = useState<any>({
    mode: "profit",
    profit_rate: 10,
    sales_rate: 3,
    sales_per: 100,
    min_redeem: 10,
    expiry_months: 12,
  });
  const [loyaltyMap, setLoyaltyMap] = useState<Record<string, any>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [redeemModal, setRedeemModal] = useState<any>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [adjustModal, setAdjustModal] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  // ── Load ──
  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const [sRes, pRes, tRes] = await Promise.all([
        supabase.from("loyalty_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
        supabase.from("loyalty_points").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("loyalty_transactions").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(200),
      ]);
      if (sRes.data) setSettings(sRes.data);
      if (pRes.data) {
        const map: Record<string, any> = {};
        pRes.data.forEach((r: any) => { map[r.customer_id] = r; });
        setLoyaltyMap(map);
      }
      if (tRes.data) setTransactions(tRes.data);
      setLoading(false);
    };
    load();
  }, [pharmacyId]);

  // ── حساب النقاط المكتسبة من فاتورة ──
  const calcEarnedPoints = (sale: any): number => {
    if (settings.mode === "profit") {
      const items = (() => {
        try { return typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items || []; }
        catch { return []; }
      })();
      const profit = items.reduce((sum: number, it: any) => {
        const cost = it.cost ?? products.find((p: any) => p.id === it.id)?.cost ?? 0;
        return sum + (it.price - cost) * (it.qty || 0);
      }, 0) - (sale.discount_amt ?? sale.discountAmt ?? 0);
      return Math.max(0, profit * (settings.profit_rate / 100));
    } else {
      // sales mode: X ريال لكل Y ريال
      const subtotal = sale.subtotal ?? sale.total ?? 0;
      return Math.floor(subtotal / settings.sales_per) * settings.sales_rate;
    }
  };

  // ── إضافة نقاط لعميل (من فاتورة) ──
  const earnPoints = async (customerId: string, saleId: string, points: number) => {
    if (!customerId || points <= 0) return;
    const current = loyaltyMap[customerId] || { points: 0, total_earned: 0, total_redeemed: 0 };
    const newPoints = (current.points || 0) + points;
    const newEarned = (current.total_earned || 0) + points;

    await supabase.from("loyalty_points").upsert({
      pharmacy_id: pharmacyId,
      customer_id: customerId,
      points: newPoints,
      total_earned: newEarned,
      total_redeemed: current.total_redeemed || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "pharmacy_id,customer_id" });

    await supabase.from("loyalty_transactions").insert({
      pharmacy_id: pharmacyId,
      customer_id: customerId,
      type: "earn",
      amount: points,
      ref_sale_id: saleId,
      earned_mode: settings.mode,
      note: `نقاط مكتسبة من فاتورة ${saleId}`,
    });

    setLoyaltyMap((p) => ({
      ...p,
      [customerId]: { ...current, points: newPoints, total_earned: newEarned },
    }));
  };

  // ── استبدال نقاط ──
const redeemPoints = async () => {
  const amount = parseFloat(redeemAmount);
  if (!amount || amount <= 0) return showToast("أدخل مبلغ صحيح", "error");
  const current = loyaltyMap[redeemModal.id] || {};
  if (amount > (current.points || 0)) return showToast("النقاط غير كافية", "error");
  if (amount < settings.min_redeem) return showToast(`الحد الأدنى للاستبدال ${settings.min_redeem} ريال`, "warn");

  const newPoints = (current.points || 0) - amount;
  const newRedeemed = (current.total_redeemed || 0) + amount;

  // 1. تحديث نقاط العميل
  await supabase.from("loyalty_points").upsert({
    pharmacy_id: pharmacyId,
    customer_id: redeemModal.id,
    points: newPoints,
    total_earned: current.total_earned || 0,
    total_redeemed: newRedeemed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "pharmacy_id,customer_id" });

  // 2. تسجيل المعاملة
  await supabase.from("loyalty_transactions").insert({
    pharmacy_id: pharmacyId,
    customer_id: redeemModal.id,
    type: "redeem",
    amount: -amount,
    note: "استبدال نقدي",
  });

  // 3. خصم من دخل اليوم — تسجيل كمصروف
  const today = new Date().toISOString().split("T")[0];
  // ✅ استبدله بهذا
await supabase.from("treasury_entries").insert({
  pharmacy_id: pharmacyId,
  date: today,
  type: "expense",
  sub_type: "loyalty_redeem",
  amount: amount,
  note: `استبدال نقاط نقدي — ${redeemModal.name}`,
  method: "نقدي",
});

  // 4. تحديث الـ state
  setLoyaltyMap((p) => ({
    ...p,
    [redeemModal.id]: { ...current, points: newPoints, total_redeemed: newRedeemed },
  }));
  setTransactions((p) => [{
    id: Date.now(),
    customer_id: redeemModal.id,
    type: "redeem",
    amount: -amount,
    note: "استبدال نقدي",
    created_at: new Date().toISOString(),
  }, ...p]);

  showToast(`تم صرف ${amount} ريال نقداً للعميل ✓`);
  setRedeemModal(null);
  setRedeemAmount("");
};
  // ── تعديل يدوي ──
  const adjustPoints = async () => {
    const amount = parseFloat(adjustAmount);
    if (!amount) return showToast("أدخل مبلغ", "error");
    const current = loyaltyMap[adjustModal.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
    const newPoints = Math.max(0, (current.points || 0) + amount);

    await supabase.from("loyalty_points").upsert({
      pharmacy_id: pharmacyId,
      customer_id: adjustModal.id,
      points: newPoints,
      total_earned: amount > 0 ? (current.total_earned || 0) + amount : current.total_earned || 0,
      total_redeemed: current.total_redeemed || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "pharmacy_id,customer_id" });

    await supabase.from("loyalty_transactions").insert({
      pharmacy_id: pharmacyId,
      customer_id: adjustModal.id,
      type: "adjust",
      amount,
      note: adjustNote || "تعديل يدوي",
    });

    setLoyaltyMap((p) => ({ ...p, [adjustModal.id]: { ...current, points: newPoints } }));
    setTransactions((p) => [{ id: Date.now(), customer_id: adjustModal.id, type: "adjust", amount, note: adjustNote || "تعديل يدوي", created_at: new Date().toISOString() }, ...p]);
    showToast("تم التعديل ✓");
    setAdjustModal(null);
    setAdjustAmount("");
    setAdjustNote("");
  };

  // ── حفظ الإعدادات ──
  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from("loyalty_settings").upsert({ ...settings, pharmacy_id: pharmacyId, mode_changed_at: new Date().toISOString()}, { onConflict: "pharmacy_id" });
    setSaving(false);
    if (error) return showToast("خطأ في الحفظ", "error");
    showToast("تم حفظ الإعدادات ✓");
  };

  // ── ألوان ──
  const VAR = { bg: C.surface, border: C.border, text: C.text, muted: C.muted, accent: C.accent };

  const typeLabel: Record<string, { label: string; color: string }> = {
    earn:   { label: "مكتسبة",  color: C.success },
    redeem: { label: "مستبدلة", color: C.danger },
    adjust: { label: "تعديل",   color: C.warning },
  };

  // ── إحصائيات ──
  const totalPointsInSystem = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.points || 0), 0);
  const totalEverEarned     = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_earned || 0), 0);
  const totalRedeemed       = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_redeemed || 0), 0);
  const activeMembers       = Object.values(loyaltyMap).filter((v: any) => v.points > 0).length;

  const filtered = customers.filter((c) =>
    (c.name || "").includes(search) || (c.phone || "").includes(search)
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: C.muted }}>
      جاري التحميل...
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
          🌟 نقاط الولاء
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          {(["customers", "transactions", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid",
              borderColor: tab === t ? C.accent : C.border,
              background: tab === t ? C.infoBg : "transparent",
              color: tab === t ? C.accent : C.muted,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              {t === "customers" ? "العملاء" : t === "transactions" ? "السجل" : "الإعدادات"}
            </button>
          ))}
        </div>
      </div>

      {/* ── إحصائيات ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "إجمالي النقاط الحالية", value: totalPointsInSystem.toFixed(1) + " ر.س", color: C.accent },
          { label: "إجمالي المكتسبة", value: totalEverEarned.toFixed(1) + " ر.س", color: C.success },
          { label: "إجمالي المستبدلة", value: totalRedeemed.toFixed(1) + " ر.س", color: C.danger },
          { label: "أعضاء نشطون", value: activeMembers, color: C.warning },
        ].map((s, i) => (
          <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ════ TAB: CUSTOMERS ════ */}
      {tab === "customers" && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم العميل أو رقم الجوال..."
              style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", color: C.text, fontSize: 14, outline: "none", width: 300, boxSizing: "border-box" as any }}
            />
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
                  {["العميل", "النقاط الحالية (ر.س)", "إجمالي مكتسبة", "إجمالي مستبدلة", ""].map((h, i) => (
                    <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: C.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#2a3a5a" }}>لا يوجد عملاء</td></tr>
                ) : filtered.map((c, i) => {
                  const lp = loyaltyMap[c.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid #0a1020`, background: i % 2 === 0 ? "transparent" : C.bgAlt }}>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{c.phone}</div>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          fontSize: 16, fontWeight: 800,
                          color: lp.points >= settings.min_redeem ? C.success : C.muted,
                        }}>
                          {(lp.points || 0).toFixed(2)}
                        </span>
                        {lp.points >= settings.min_redeem && (
                          <span style={{ marginRight: 6, fontSize: 10, background: C.successBg, color: C.success, padding: "1px 6px", borderRadius: 10 }}>
                            قابل للاستبدال
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "11px 16px", color: C.success, fontSize: 13 }}>
                        {(lp.total_earned || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "11px 16px", color: C.danger, fontSize: 13 }}>
                        {(lp.total_redeemed || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {lp.points >= settings.min_redeem && (
                            <button onClick={() => { setRedeemModal(c); setRedeemAmount(""); }} style={{
                              padding: "5px 12px", borderRadius: 7, border: "1px solid #1a5a30",
                              background: C.successBg, color: C.success, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}>
                              استبدال
                            </button>
                          )}
                          <button onClick={() => { setAdjustModal(c); setAdjustAmount(""); setAdjustNote(""); }} style={{
                            padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.border}`,
                            background: "transparent", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}>
                            تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ TAB: TRANSACTIONS ════ */}
      {tab === "transactions" && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
                {["التاريخ", "العميل", "النوع", "المبلغ (ر.س)", "ملاحظة"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: C.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#2a3a5a" }}>لا يوجد سجلات</td></tr>
              ) : transactions.slice(0, 100).map((t, i) => {
                const customer = customers.find((c) => c.id === t.customer_id);
                const tl = typeLabel[t.type] || { label: t.type, color: C.muted };
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid #0a1020`, background: i % 2 === 0 ? "transparent" : C.bgAlt }}>
                    <td style={{ padding: "10px 16px", color: C.muted, fontSize: 12 }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : "-"}
                    </td>
                    <td style={{ padding: "10px 16px", color: C.text, fontSize: 13, fontWeight: 600 }}>
                      {customer?.name || t.customer_id}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: tl.color + "22", color: tl.color }}>
                        {tl.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 800, color: t.amount > 0 ? C.success : C.danger }}>
                      {t.amount > 0 ? "+" : ""}{(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 16px", color: C.muted, fontSize: 12 }}>{t.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════ TAB: SETTINGS ════ */}
      {tab === "settings" && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 20px", color: C.accent, fontSize: 15, fontWeight: 700 }}>
              🔧 آلية احتساب النقاط
            </h3>

            {/* وضع الحساب */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 10 }}>
                طريقة الاحتساب
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { v: "profit", label: "نسبة من الربح 📈", desc: "العميل ياخد نقاط أكثر على المنتجات ذات هامش ربح أعلى" },
                  { v: "sales", label: "نسبة من المبيعات 🛒", desc: "ريال لكل X ريال مشتريات — بسيط وواضح للعميل" },
                ].map((opt) => (
                  <div key={opt.v} onClick={() => setSettings((p: any) => ({ ...p, mode: opt.v }))} style={{
                    flex: 1, padding: 14, borderRadius: 10, border: `2px solid`,
                    borderColor: settings.mode === opt.v ? C.accent : C.border,
                    background: settings.mode === opt.v ? C.infoBg : "transparent",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 700, color: settings.mode === opt.v ? C.accent : C.text, fontSize: 14, marginBottom: 6 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* إعدادات وضع الربح */}
            {settings.mode === "profit" && (
              <div style={{ background: C.bgAlt, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                  مثال: إذا كان الربح من الفاتورة 50 ريال والنسبة 10% — يكسب العميل 5 ريال نقاط
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap" }}>نسبة من الربح:</label>
                  <input
                    type="number" min={1} max={100}
                    value={settings.profit_rate}
                    onChange={(e) => setSettings((p: any) => ({ ...p, profit_rate: +e.target.value }))}
                    style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: C.muted, fontSize: 13 }}>%</span>
                </div>
              </div>
            )}

            {/* إعدادات وضع المبيعات */}
            {settings.mode === "sales" && (
              <div style={{ background: C.bgAlt, borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                  مثال: إذا حدّدت 3 ريال لكل 100 ريال — من يشتري بـ 250 ريال يكسب 6 ريال نقاط
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as any }}>
                  <input
                    type="number" min={0.1}
                    value={settings.sales_rate}
                    onChange={(e) => setSettings((p: any) => ({ ...p, sales_rate: +e.target.value }))}
                    style={{ width: 70, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: C.muted, fontSize: 13 }}>ريال لكل</span>
                  <input
                    type="number" min={10}
                    value={settings.sales_per}
                    onChange={(e) => setSettings((p: any) => ({ ...p, sales_per: +e.target.value }))}
                    style={{ width: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: C.muted, fontSize: 13 }}>ريال مشتريات</span>
                </div>
              </div>
            )}

            {/* إعدادات الاستبدال */}
            <h3 style={{ margin: "20px 0 14px", color: C.accent, fontSize: 14, fontWeight: 700 }}>
              💱 إعدادات الاستبدال
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  الحد الأدنى للاستبدال (ريال)
                </label>
                <input
                  type="number" min={1}
                  value={settings.min_redeem}
                  onChange={(e) => setSettings((p: any) => ({ ...p, min_redeem: +e.target.value }))}
                  style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  انتهاء النقاط (شهر)
                </label>
                <input
                  type="number" min={1}
                  value={settings.expiry_months}
                  onChange={(e) => setSettings((p: any) => ({ ...p, expiry_months: +e.target.value }))}
                  style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
            </div>
          </div>

          <Btn onClick={saveSettings} disabled={saving} icon="check" size="lg" style={{ width: "100%", justifyContent: "center" }}>
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </Btn>
        </div>
      )}

      {/* ── Modal: استبدال ── */}
      {redeemModal && (
        <Modal open onClose={() => setRedeemModal(null)} title={`صرف نقدي — ${redeemModal.name}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.bgAlt, borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>النقاط المتاحة</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.success }}>
                {((loyaltyMap[redeemModal.id]?.points) || 0).toFixed(2)} ر.س
              </div>
            </div>
            <div style={{
  background: C.warningBg,
  border: "1px solid #7a4a00",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  color: C.warning,
}}>
  ⚠ سيتم خصم المبلغ من دخل اليوم كمصروف
</div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                المبلغ المراد استبداله (ر.س)
              </label>
              <input
                type="number" min={settings.min_redeem}
                max={loyaltyMap[redeemModal.id]?.points || 0}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                placeholder={`الحد الأدنى ${settings.min_redeem} ريال`}
                style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setRedeemModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={redeemPoints} style={{ flex: 1, justifyContent: "center" }}>تأكيد الاستبدال</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: تعديل ── */}
      {adjustModal && (
        <Modal open onClose={() => setAdjustModal(null)} title={`تعديل نقاط — ${adjustModal.name}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.bgAlt, borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>النقاط الحالية</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>
                {((loyaltyMap[adjustModal.id]?.points) || 0).toFixed(2)} ر.س
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                المبلغ (موجب للإضافة، سالب للخصم)
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="مثال: 10 أو -5"
                style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>سبب التعديل</label>
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="مثال: تعويض عميل..."
                style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setAdjustModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn variant="secondary" onClick={adjustPoints} style={{ flex: 1, justifyContent: "center" }}>حفظ التعديل</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ==================== PERMISSIONS MODULE ====================
// ── أقسام النظام ──
const SYSTEM_SECTIONS = [
  { id: "dashboard",         label: "الرئيسية",             icon: "📊" },
  { id: "pos",               label: "نقطة البيع",           icon: "🛒" },
  { id: "purchase",          label: "فواتير الشراء",        icon: "📦" },
  { id: "returns",           label: "المرتجعات",            icon: "↩️" },
  { id: "products",          label: "الأصناف والمخزون",    icon: "💊" },
  { id: "suppliers",         label: "الموردون",             icon: "🏭" },
  { id: "customers",         label: "العملاء",              icon: "👥" },
  { id: "loyalty",           label: "نقاط الولاء",         icon: "🌟" },
  { id: "reports",           label: "التقارير",             icon: "📈" },
  { id: "tax_report",        label: "التقرير الضريبي",     icon: "🧾" },
  { id: "promotions",        label: "العروض والخصومات",    icon: "🏷️" },
  { id: "treasury",          label: "الخزنة",              icon: "💰" },
  { id: "shift",             label: "الشفتات",             icon: "🕐" },
  { id: "target",            label: "تارجت المبيعات",      icon: "🎯" },
  { id: "inventory_count",   label: "الجرد",               icon: "📋" },
  { id: "expiry_report",     label: "تقرير الصلاحيات",    icon: "⚠️" },
  { id: "attendance",        label: "الحضور والانصراف",   icon: "⏱️" },
  { id: "pharmacy_settings", label: "بيانات الصيدلية",    icon: "⚙️" },
  { id: "rasd_settings",     label: "إعدادات رصد",         icon: "🔗" },
];

// ── الأدوار الافتراضية ──
const DEFAULT_ROLES = ["pharmacist", "cashier"];

