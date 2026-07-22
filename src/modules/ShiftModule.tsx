import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { calcCappedHours, todayLocal } from "../lib/dateUtils";
import { Badge, Btn, Input, Pagination, Table } from "../ui/primitives";

// ==================== SHIFT MODULE ====================
// 🆕 عتبة فرق النقد اللي بتستوجب سبب إلزامي قبل قفل الشفت — عشان نضمن محاسبية أي فرق كبير
export const SHIFT_CASH_DIFF_REASON_THRESHOLD = 20;


export function ShiftModule({ shifts, setShifts, sales, currentUser, showToast, pharmacyId, invoices, returns = [], entries = [], setEntries }) {
  const [openCash, setOpenCash] = useState("500");
  const [closeCash, setCloseCash] = useState("");
  const [notes, setNotes] = useState("");
  const [shiftDiffReason, setShiftDiffReason] = useState(""); // 🆕 سبب فرق النقد (عجز/زيادة) عند إغلاق الشفت
  const [expandedVarianceEmployee, setExpandedVarianceEmployee] = useState(null); // 🆕 لعرض تفاصيل حوادث موظف معيّن
  const isAdmin = currentUser?.role === "admin";
  // 🆕 إغلاق قسري (للمدير فقط) — لإقفال شفتات "يتيمة" فُتحت باسم مستخدم تم تغييره لاحقاً،
  // وبالتالي لم تعد تطابق currentUser.name فلا تظهر كـ"شفتي الحالي" ولا يمكن إغلاقها من المسار العادي.
  const [forceCloseTarget, setForceCloseTarget] = useState<any>(null);
  const [forceCloseCash, setForceCloseCash] = useState("");
  const [forceCloseNotes, setForceCloseNotes] = useState("");
  const [forceClosing, setForceClosing] = useState(false);
  // 🆕 Pagination — سجل الشفتات (فتح/قفل كل الموظفين تاريخيًا) بيكبر مع الوقت، فبنعرضه صفحة صفحة.
  const SHIFTS_PAGE_SIZE = 25;
  const [shiftsPage, setShiftsPage] = useState(1);

  const currentShift = shifts.find(
  (s) => !s.end_time && s.user === currentUser?.name
);
  // 🆕 نفس تصحيح تاب الشفتات في الخزنة: النقدي/البطاقة/التحويل ما بتُستبعدش هنا حتى لو اترجعت
  // بالكامل — قيمتها الأصلية لازم تفضل، والمرتجع يتخصم مرة واحدة بس تحت من shiftReturnsTotal.
  // لو استبعدناها هنا برضه بيبقى فيه خصم مزدوج (الفاتورة تتشال بالكامل + قيمتها تتخصم تاني من المرتجعات).
  // الآجل مختلف: مفيش حركة كاش فعلية عند مرتجعه (مديونيته بترجع صفر مباشرة)، فبيفضل مستبعد.
  const shiftSalesRaw = currentShift
    ? sales.filter((s) => s.shift === currentShift.id && (s.payment === "آجل" ? !s.returned : true))
    : [];
  const salesById = (sales || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
  // 🆕 refund_method بيبقى null لمرتجعات فواتير الآجل — نستبعدها هنا برضه لنفس السبب
  // (الفاتورة الآجل المرتجعة أصلاً مستبعدة فوق، فمفيش داعي نخصم قيمتها تاني هنا).
  const shiftPartialReturns = currentShift
    ? (returns || []).filter((r) => r.type === "sales" && r.refund_method !== null && salesById[r.invoice_id]?.shift === currentShift.id)
    : [];
  const shiftReturnsTotal = shiftPartialReturns.reduce((a, r) => a + (r.total || 0), 0);
  // ═══════════════════════════════════════════════════
  // 🆕 "فرق النقد" لازم يتحسب من الكاش الفعلي بس (نقدي)، مش كل طرق الدفع مجمّعة —
  // بطاقة/تحويل/آجل مفيش فيهم كاش فعلي بيدخل الدرج، فمقارنتهم بالنقد الفعلي عند الإغلاق غلط.
  // وكل مرتجع اتدفع كاش من الدرج ده وقت الشفت ده (بغض النظر عن شفت الفاتورة الأصلية) لازم يتخصم،
  // لأنه فلوس خرجت من هذا الدرج بالذات فعليًا.
  // ═══════════════════════════════════════════════════
  const shiftCashSales = shiftSalesRaw
    .filter((s) => s.payment === "نقدي")
    .reduce((a, s) => a + s.total, 0);
  const shiftCashRefundsPaidNow = currentShift
    ? (returns || []).filter(
        (r) =>
          r.type === "sales" &&
          (salesById[r.invoice_id]?.payment || "نقدي") !== "آجل" && // آجل بينزل من مديونية العميل، مش كاش
          (r.refund_method || "نقدي") !== "بطاقة" && // 🆕 رجاعة شبكة مفيش فيها كاش خارج من الدرج
          r.created_at &&
          new Date(r.created_at).getTime() >= new Date(currentShift.start_time).getTime()
      ).reduce((a, r) => a + (r.total || 0), 0)
    : 0;
  const expectedCloseCash = (currentShift?.open_cash || 0) + shiftCashSales - shiftCashRefundsPaidNow;
  const shiftSales = shiftSalesRaw; // 🆕 تبقى للاستخدام في عدد الفواتير كما كانت
  const shiftRevenue = shiftSalesRaw.reduce((a, s) => a + s.total, 0) - shiftReturnsTotal;
  // 🆕 تفصيل طرق الدفع لعرضها في شاشة تسليم الشفت — عشان الصيدلي يقدر يتأكد من مبيعات
  // البطاقة/التحويل مقابل جهاز الشبكة قبل التسليم، بدل ما يشوف رقم واحد مجمّع بس
  const shiftCardSales = shiftSalesRaw.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
  const shiftTransferSales = shiftSalesRaw.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
  const shiftAjilSales = shiftSalesRaw.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);

  // ═══════════════════════════════════════════════════
  // 🆕 تقرير فروقات النقد لكل موظف — بيجمع كل قيود "shift_variance" المسجّلة تلقائيًا
  // عند إغلاق الشفت، ويقسّمها حسب الموظف (created_by)، عشان يبان أي نمط متكرر
  // (نفس الموظف بيعمل عجز/زيادة كتير) بدل ما كل حادثة تفضل رقم لوحدها في سجل الخزنة.
  // ═══════════════════════════════════════════════════
  const varianceEntries = (entries || []).filter((e) => e.sub_type === "shift_variance");
  const varianceByEmployee = {};
  varianceEntries.forEach((e) => {
    const name = e.created_by || "غير معروف";
    if (!varianceByEmployee[name]) {
      varianceByEmployee[name] = { name, shortageCount: 0, shortageTotal: 0, surplusCount: 0, surplusTotal: 0, incidents: [] };
    }
    const g = varianceByEmployee[name];
    if (e.type === "expense") { g.shortageCount += 1; g.shortageTotal += e.amount || 0; }
    else { g.surplusCount += 1; g.surplusTotal += e.amount || 0; }
    g.incidents.push(e);
  });
  const varianceRows = Object.values(varianceByEmployee)
    .map((g: any) => ({ ...g, net: g.surplusTotal - g.shortageTotal, incidents: g.incidents.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)) }))
    .sort((a: any, b: any) => b.shortageTotal - a.shortageTotal);
  const totalShortageAll = varianceEntries.filter((e) => e.type === "expense").reduce((a, e) => a + (e.amount || 0), 0);
  const totalSurplusAll = varianceEntries.filter((e) => e.type === "income").reduce((a, e) => a + (e.amount || 0), 0);


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
  const today = todayLocal();
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
      pharmacist_user_id: currentUser.id || null,
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
  // 🆕 فرق النقد (عجز/زيادة) — لازم سبب واضح لو الفرق أكبر من العتبة، عشان يبقى فيه محاسبية
  // بدل ما الفرق يتعرض بس على الشاشة ويضيع من غير ما يتسجل في أي مكان.
  const shiftCashDiff = +closeCash - expectedCloseCash;
  if (Math.abs(shiftCashDiff) > SHIFT_CASH_DIFF_REASON_THRESHOLD && !shiftDiffReason.trim()) {
    showToast(`⚠️ فيه فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} قدره ${Math.abs(shiftCashDiff).toFixed(2)} ر.س — اكتب السبب قبل إغلاق الشفت`, "error");
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

  // 🆕 تسجيل فرق النقد كقيد فعلي في الخزنة (دخل لو زيادة، مصروف لو عجز) — بنفس أسلوب
  // تسوية فرق البطاقة في تقفيل اليوم، مربوط بالشفت والموظف عشان تتبع أي نمط متكرر لاحقًا.
  if (shiftCashDiff !== 0 && setEntries) {
    const reasonNote = shiftDiffReason.trim()
      ? `فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} عند تسليم شفت ${currentUser?.name || ""} — ${shiftDiffReason.trim()}`
      : `فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} عند تسليم شفت ${currentUser?.name || ""} (متوقع: ${expectedCloseCash.toFixed(2)} / فعلي: ${(+closeCash).toFixed(2)})`;
    const diffPayload = {
      type: shiftCashDiff > 0 ? "income" : "expense",
      sub_type: "shift_variance",
      method: "نقدي",
      amount: Math.abs(shiftCashDiff),
      note: reasonNote,
      date: todayLocal(),
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
    };
    const { data: diffData, error: diffError } = await supabase.from("treasury_entries").insert(diffPayload).select();
    if (diffError) {
      showToast("تم إغلاق الشفت، لكن فشل تسجيل فرق النقد: " + diffError.message, "error");
    } else if (diffData && diffData[0]) {
      setEntries((p) => [diffData[0], ...p]);
    }
  }
  setShiftDiffReason("");

  // ✅ تسجيل انصراف تلقائي — بيحسب الساعات الفعلية مربوطة بجدول الدوام (زيادة عن الشفت متتحسبش إلا لو أوفر تايم معتمد)
  const today = todayLocal();
  const nowISO = new Date().toISOString();
  const { data: openLog } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .eq("pharmacist_name", currentUser.name)
    .eq("date", today)
    .is("check_out", null)
    .maybeSingle();

  if (openLog) {
    const { data: schedRows } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .eq("pharmacist_name", currentUser.name)
      .eq("day_of_week", new Date(openLog.check_in).getDay())
      .eq("shift_number", openLog.shift_number || 1)
      .eq("is_off", false)
      .maybeSingle();

    const { data: breaks } = await supabase
      .from("prayer_breaks")
      .select("deducted_minutes")
      .eq("attendance_id", openLog.id);

    const { totalHours, outsideSchedule } = calcCappedHours(openLog.check_in, nowISO, schedRows);
    const totalDeductions = (breaks || []).reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
    const netHours = Math.max(0, totalHours - totalDeductions);

    await supabase
      .from("attendance_logs")
      .update({
        check_out: nowISO,
        total_hours: +totalHours.toFixed(2),
        total_deductions: +totalDeductions.toFixed(2),
        net_hours: +netHours.toFixed(2),
      })
      .eq("id", openLog.id)
      .eq("pharmacy_id", pharmacyId);

    if (outsideSchedule) {
      showToast("⚠️ تم إغلاق الشفت — هذا الحضور خارج جدول الدوام المعتمد، لم تُحتسب له ساعات عمل", "warn");
    }
  }

  showToast("تم إغلاق الشفت وتسليمه ✓");
};

  // 🆕 إغلاق قسري لشفت يتيم (مدير فقط) — بيقفل أي شفت مفتوح بمعرفه (id) مباشرة،
  // من غير ما يشترط تطابق اسم المستخدم الحالي، عشان حالة تغيير اسم الصيدلي بعد فتح الشفت.
  const closeShiftForce = async () => {
    if (!forceCloseTarget) return;
    if (!forceCloseCash) {
      showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
      return;
    }
    setForceClosing(true);
    const updates = {
      end_time: new Date().toISOString(),
      close_cash: +forceCloseCash,
      notes: `[إغلاق قسري بواسطة ${currentUser?.name || "مدير"}] ${forceCloseNotes || ""}`.trim(),
    };
    const { error } = await supabase
      .from("shifts")
      .update(updates)
      .eq("id", forceCloseTarget.id);
    setForceClosing(false);
    if (error) {
      showToast("فشل الإغلاق القسري: " + error.message, "error");
      return;
    }
    setShifts((p) => p.map((s) => (s.id === forceCloseTarget.id ? { ...s, ...updates } : s)));
    showToast(`تم إغلاق الشفت اليتيم ${forceCloseTarget.id} قسرياً ✓`);
    setForceCloseTarget(null);
    setForceCloseCash("");
    setForceCloseNotes("");
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        إدارة الشفتات
      </h2>
      {!currentShift ? (
        <div
          style={{
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${COLORS.border}`,
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
              color: COLORS.textPrimary,
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
            background: COLORS.surface,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${COLORS.border}`,
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
                color: COLORS.green,
              }}
            >
              شفت مفتوح ✓
            </h3>
            <Badge color={COLORS.greenSoft} text={COLORS.green}>
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
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>بداية الشفت</div>
              <div style={{ color: COLORS.textPrimary, fontSize: 13, marginTop: 4 }}>
                {currentShift.start_time}
              </div>
            </div>
            <div
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                النقد الافتتاحي
              </div>
              <div
                style={{
                  color: COLORS.green,
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {currentShift.open_cash} ر.س
              </div>
            </div>
            <div
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>مبيعات الشفت</div>
              <div
                style={{
                  color: COLORS.blue,
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftRevenue.toFixed(2)} ر.س
              </div>
            </div>
            <div
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>عدد الفواتير</div>
              <div
                style={{
                  color: COLORS.purple,
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftSales.length}
              </div>
            </div>
          </div>
          {shiftReturnsTotal > 0 && (
            <div style={{ color: COLORS.red, fontSize: 12, marginTop: -6, marginBottom: 10 }}>
              🔄 مرتجعات: {shiftReturnsTotal.toFixed(2)} ر.س (مخصومة من مبيعات الشفت)
            </div>
          )}
          {/* 🆕 تفصيل طرق الدفع — عشان الصيدلي يتأكد من البطاقة/التحويل مقابل جهاز الشبكة قبل التسليم */}
          <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>تفصيل مبيعات الشفت</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {[
                { l: "💵 نقدي", v: shiftCashSales, c: COLORS.green },
                { l: "💳 بطاقة", v: shiftCardSales, c: COLORS.blue },
                { l: "🏦 تحويل", v: shiftTransferSales, c: COLORS.purple },
                { l: "📋 آجل", v: shiftAjilSales, c: COLORS.red },
              ].map((x) => x.v > 0 && (
                <div key={x.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: COLORS.textDim }}>{x.l}</span>
                  <span style={{ color: x.c, fontWeight: 700 }}>{x.v.toFixed(2)} ر.س</span>
                </div>
              ))}
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                borderRadius: 8,
                color: COLORS.gold,
                fontSize: 13,
              }}
            >
              فرق النقد (نقدي فقط):{" "}
              {(+closeCash - expectedCloseCash).toFixed(2)}{" "}
              ر.س
              {(+closeCash - expectedCloseCash) !== 0 && (
                <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
                  {(+closeCash - expectedCloseCash) > 0 ? "الزيادة" : "العجز"} ده هيتسجل كقيد {(+closeCash - expectedCloseCash) > 0 ? "دخل" : "مصروف"} في الخزنة تلقائيًا عند إغلاق الشفت.
                </div>
              )}
            </div>
          )}
          {closeCash && Math.abs(+closeCash - expectedCloseCash) > SHIFT_CASH_DIFF_REASON_THRESHOLD && (
            <Input
              label={`سبب ${(+closeCash - expectedCloseCash) > 0 ? "الزيادة" : "العجز"} (إلزامي لفرق أكبر من ${SHIFT_CASH_DIFF_REASON_THRESHOLD} ر.س)`}
              value={shiftDiffReason}
              onChange={setShiftDiffReason}
              placeholder="مثال: باقي اتحسب غلط لعميل، صرف بدون تسجيل..."
              style={{ marginTop: 10 }}
            />
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
      {isAdmin && (() => {
        const orphanShifts = shifts.filter((s) => !s.end_time && s.id !== currentShift?.id);
        if (orphanShifts.length === 0) return null;
        return (
          <div
            style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.red}`,
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
              maxWidth: 560,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: COLORS.red }}>
              ⚠️ شفتات مفتوحة يتيمة (مش شفتك الحالي)
            </h3>
            <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 12 }}>
              غالباً فُتحت باسم مستخدم اتغيّر بعد كده — وهي اللي بتمنع تقفيل اليوم. بصفتك مدير تقدر تقفلها قسرياً من هنا.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orphanShifts.map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: COLORS.surfaceAlt, borderRadius: 10, padding: 12,
                    display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: COLORS.blue, fontWeight: 700 }}>{s.id}</span>
                      {"  —  "}
                      <span style={{ color: COLORS.textPrimary }}>{s.user}</span>
                      {"  —  بدأ: "}
                      <span style={{ color: COLORS.textDim }}>{s.start_time}</span>
                    </div>
                    {forceCloseTarget?.id !== s.id && (
                      <Btn variant="danger" onClick={() => { setForceCloseTarget(s); setForceCloseCash(""); setForceCloseNotes(""); }}>
                        إغلاق قسري
                      </Btn>
                    )}
                  </div>
                  {forceCloseTarget?.id === s.id && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      <Input
                        label="النقد الفعلي عند الإغلاق (ر.س)"
                        value={forceCloseCash}
                        onChange={setForceCloseCash}
                        type="number"
                        placeholder="0"
                      />
                      <Input
                        label="ملاحظات (اختياري)"
                        value={forceCloseNotes}
                        onChange={setForceCloseNotes}
                        placeholder="سبب الإغلاق القسري..."
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn variant="success" onClick={closeShiftForce} disabled={forceClosing}>
                          {forceClosing ? "⏳ جارِ الحفظ..." : "تأكيد الإغلاق"}
                        </Btn>
                        <Btn variant="ghost" onClick={() => setForceCloseTarget(null)}>إلغاء</Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
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
        rows={[...shifts].reverse().slice((shiftsPage - 1) * SHIFTS_PAGE_SIZE, shiftsPage * SHIFTS_PAGE_SIZE).map((s) => [
          <span style={{ color: COLORS.blue, fontWeight: 700 }}>{s.id}</span>,
          s.user,
          s.start_time,
          s.end_time || "-",
          s.open_cash + " ر.س",
          <span style={{ color: COLORS.blue, fontWeight: 700 }}>
            {(s.sales || 0).toFixed(2)} ر.س
          </span>,
          s.close_cash ? s.close_cash + " ر.س" : "-",
          s.end_time ? (
            <Badge color={COLORS.greenSoft} text={COLORS.green}>
              مغلق
            </Badge>
          ) : (
            <Badge color={COLORS.greenSoft} text="#44ffaa">
              مفتوح
            </Badge>
          ),
        ])}
      />
      <Pagination page={shiftsPage} onPageChange={setShiftsPage} totalItems={shifts.length} pageSize={SHIFTS_PAGE_SIZE} />

      {/* ══════════ 🆕 تقرير فروقات النقد لكل موظف (عجز/زيادة) — للمدير فقط ══════════ */}
      {isAdmin && varianceRows.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: COLORS.textPrimary }}>
            📊 فروقات النقد عند تسليم الشفت — حسب الموظف
          </h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" as const }}>
            <div style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red,0.35)}`, borderRadius: 10, padding: "10px 16px" }}>
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>إجمالي العجز (كل الموظفين)</div>
              <div style={{ color: COLORS.red, fontWeight: 900, fontSize: 18 }}>{totalShortageAll.toFixed(2)} ر.س</div>
            </div>
            <div style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 10, padding: "10px 16px" }}>
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>إجمالي الزيادة (كل الموظفين)</div>
              <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{totalSurplusAll.toFixed(2)} ر.س</div>
            </div>
          </div>
          {varianceRows.map((g: any) => (
            <div key={g.name} style={{
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
                <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{g.name}</span>
                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                  {g.shortageCount > 0 && (
                    <span style={{ color: COLORS.red }}>عجز: {g.shortageCount} مرة — {g.shortageTotal.toFixed(2)} ر.س</span>
                  )}
                  {g.surplusCount > 0 && (
                    <span style={{ color: COLORS.green }}>زيادة: {g.surplusCount} مرة — {g.surplusTotal.toFixed(2)} ر.س</span>
                  )}
                  <span style={{ color: g.net >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                    الصافي: {g.net >= 0 ? "+" : ""}{g.net.toFixed(2)} ر.س
                  </span>
                </div>
                <button
                  onClick={() => setExpandedVarianceEmployee((p) => (p === g.name ? null : g.name))}
                  style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}
                >
                  {expandedVarianceEmployee === g.name ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                </button>
              </div>
              {expandedVarianceEmployee === g.name && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {g.incidents.map((inc: any) => (
                    <div key={inc.id || inc.created_at} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
                      <span style={{ color: COLORS.textDim, flexShrink: 0 }}>{inc.date}</span>
                      <span style={{ color: COLORS.textDim, flex: 1 }}>{inc.note}</span>
                      <span style={{ color: inc.type === "expense" ? COLORS.red : COLORS.green, fontWeight: 700, flexShrink: 0 }}>
                        {inc.type === "expense" ? "−" : "+"}{(inc.amount || 0).toFixed(2)} ر.س
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
