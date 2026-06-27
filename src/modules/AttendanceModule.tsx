export function AttendanceModule({
  const { C } = useTheme(); pharmacyId, shifts, setShifts, currentUser, showToast: globalToast }: {
  pharmacyId: string;
  shifts: any[];
  setShifts: (fn: any) => void;
  currentUser: any;
  showToast: (msg: string, type?: string) => void;
}) {
  const [tab, setTab] = useState<"attendance" | "schedule" | "settings" | "report" | "monthly">("attendance");
  const [pharmacists, setPharmacists] = useState<string[]>([]);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string>>({});
  const [prayerSettings, setPrayerSettings] = useState<any[]>([]);
  const [prayerBreaks, setPrayerBreaks] = useState<any[]>([]);
  const [activePrayerPopup, setActivePrayerPopup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState<any>({ pharmacist_name: "", day_of_week: 0, shift_number: 1, shift_start: "09:00", shift_end: "21:00", is_off: false });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const ramadan = isRamadan();
  const intervalRef = useRef<any>(null);

  const today = new Date().toISOString().split("T")[0];
  const todayDow = new Date().getDay();

  // ── ألوان النظام الداكن ──
  const C = {
    bg: C.surface, bg2: C.bgAlt, border: C.border,
    text: C.text, muted: C.muted, accent: C.accent,
    green: C.success, red: C.danger, orange: C.warning, purple: "#a78bfa",
  };

  useEffect(() => { if (pharmacyId) loadAll(); }, [pharmacyId]);

  useEffect(() => {
    intervalRef.current = setInterval(checkPrayerAlerts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPharmacists(), loadTodayLogs(), loadPrayerSettings(), loadPrayerBreaks(), loadWorkSchedules()]);
    try {
      const pt = await fetchPrayerTimes();
      setPrayerTimes(pt);
    } catch {
      globalToast("تعذّر تحميل مواقيت الصلاة", "error");
    }
    setLoading(false);
  }

  async function loadPharmacists() {
    const { data } = await supabase.from("users").select("name").eq("pharmacy_id", pharmacyId).eq("role", "pharmacist").order("name");
    if (data) setPharmacists(data.map((p: any) => p.name));
  }

  async function loadTodayLogs() {
    const { data } = await supabase.from("attendance_logs").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("check_in");
    if (data) setTodayLogs(data);
  }

  async function loadPrayerSettings() {
    const { data } = await supabase.from("prayer_settings").select("*").eq("pharmacy_id", pharmacyId).order("id");
    if (data) setPrayerSettings(data);
  }

  async function loadPrayerBreaks() {
    const { data } = await supabase.from("prayer_breaks").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("prayer_time");
    if (data) setPrayerBreaks(data);
  }

  async function loadWorkSchedules() {
    const { data } = await supabase.from("work_schedules").select("*").eq("pharmacy_id", pharmacyId).order("pharmacist_name");
    if (data) setWorkSchedules(data);
  }

  async function loadReport(date: string) {
    const { data } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).eq("date", date).order("check_in");
    if (data) setReportLogs(data);
  }

  async function loadMonthlyReport(month: string) {
    const { data } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).gte("date", month + "-01").lte("date", month + "-31").order("date");
    if (data) setMonthlyLogs(data);
  }

  // ── منطق جدول الدوام: إيجاد الشفت المتوقع للصيدلي الآن ──
  function getExpectedShift(pharmacistName: string, dow: number, shiftNumber: number) {
    return workSchedules.find(
      (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off
    );
  }

  function getCurrentShiftNumber(pharmacistName: string) {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todaySchedules = workSchedules.filter((s) => s.pharmacist_name === pharmacistName && s.day_of_week === todayDow && !s.is_off);
    for (const s of todaySchedules) {
      if (nowTime >= s.shift_start && nowTime <= s.shift_end) return s.shift_number;
    }
    // لو مش في وقت شفت، رجّع أقرب شفت
    if (todaySchedules.length > 0) return todaySchedules[0].shift_number;
    return 1;
  }

  function calcLateMinutes(pharmacistName: string, shiftNum: number, checkInTime: string) {
    const schedule = getExpectedShift(pharmacistName, new Date(checkInTime).getDay(), shiftNum);
    if (!schedule) return 0;
    const [expH, expM] = schedule.shift_start.split(":").map(Number);
    const expected = new Date(checkInTime);
    expected.setHours(expH, expM, 0, 0);
    const actual = new Date(checkInTime);
    const diff = Math.round((actual.getTime() - expected.getTime()) / 60000);
    return Math.max(0, diff);
  }

  // ── حضور (مرتبط بالشفت) ──
  async function handleCheckIn(pharmacistName: string) {
    const shiftNum = getCurrentShiftNumber(pharmacistName);
    const existing = todayLogs.find((l) => l.pharmacist_name === pharmacistName && l.shift_number === shiftNum && !l.check_out);
    if (existing) { globalToast(`${pharmacistName} مسجّل بالفعل في شفت ${shiftNum}`, "warn"); return; }

    // إيجاد الشفت المفتوح للمستخدم الحالي
    const openShift = shifts.find((s) => !s.end_time && s.user === pharmacistName);
    const schedule = getExpectedShift(pharmacistName, todayDow, shiftNum);
    const lateMin = calcLateMinutes(pharmacistName, shiftNum, new Date().toISOString());

    const { error } = await supabase.from("attendance_logs").insert({
      pharmacy_id: pharmacyId,
      pharmacist_name: pharmacistName,
      date: today,
      check_in: new Date().toISOString(),
      shift_id: openShift?.id || null,
      shift_number: shiftNum,
      expected_start: schedule?.shift_start || null,
      late_minutes: lateMin,
    });

    if (!error) {
      if (lateMin > 0) globalToast(`⚠️ ${pharmacistName} تأخر ${lateMin} دقيقة`, "warn");
      else globalToast(`✅ تم تسجيل حضور ${pharmacistName} - شفت ${shiftNum}`);
      loadTodayLogs();
    }
  }

  // ── انصراف (مرتبط بقفل الشفت) ──
  async function handleCheckOut(log: any) {
    const now = new Date();
    const totalMinutes = diffMin(log.check_in, now.toISOString());
    const totalHours = totalMinutes / 60;
    const myBreaks = prayerBreaks.filter((b) => b.attendance_id === log.id);
    const totalDeductions = myBreaks.reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
    const netHours = Math.max(0, totalHours - totalDeductions);

    const { error } = await supabase.from("attendance_logs").update({
      check_out: now.toISOString(),
      total_hours: +totalHours.toFixed(2),
      total_deductions: +totalDeductions.toFixed(2),
      net_hours: +netHours.toFixed(2),
    }).eq("id", log.id).eq("pharmacy_id", pharmacyId);

    if (!error) {
      globalToast(`✅ تم تسجيل انصراف ${log.pharmacist_name}`);
      loadTodayLogs();
    }
  }

  // ── حفظ جدول دوام ──
  async function saveSchedule() {
    if (!scheduleForm.pharmacist_name) { globalToast("اختر الصيدلي", "error"); return; }
    const { error } = await supabase.from("work_schedules").upsert({
      ...scheduleForm,
      pharmacy_id: pharmacyId,
      shift_start: scheduleForm.is_off ? null : scheduleForm.shift_start,
      shift_end: scheduleForm.is_off ? null : scheduleForm.shift_end,
    }, { onConflict: "pharmacy_id,pharmacist_name,day_of_week,shift_number" });
    if (!error) {
      globalToast("تم حفظ جدول الدوام ✓");
      loadWorkSchedules();
      setShowScheduleForm(false);
    } else globalToast("خطأ: " + error.message, "error");
  }

  async function deleteSchedule(id: string) {
    await supabase.from("work_schedules").delete().eq("id", id);
    loadWorkSchedules();
    globalToast("تم الحذف ✓");
  }

  const checkPrayerAlerts = useCallback(() => {
    const now = new Date();
    Object.entries(prayerTimes).forEach(([name, isoTime]) => {
      const setting = prayerSettings.find((s) => s.prayer_name === name);
      if (!setting?.is_active) return;
      const pTime = new Date(isoTime);
      const allowed = ramadan ? setting.ramadan_allowed_minutes : setting.allowed_minutes;
      const minutesAfter = (now.getTime() - pTime.getTime()) / 60000;
      if (minutesAfter >= 1 && minutesAfter <= allowed + 5) {
        todayLogs.forEach((log) => {
          if (!log.check_out) {
            const existing = prayerBreaks.find((b) => b.prayer_name === name && b.pharmacist_name === log.pharmacist_name);
            if (!existing) setActivePrayerPopup({ prayer: name, prayerTime: isoTime, log, allowed });
          }
        });
      }
    });
  }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks, ramadan]);

  async function handlePrayerReturn(popup: any) {
    const now = new Date();
    const allowed = popup.allowed;
    const actualMin = diffMin(popup.prayerTime, now.toISOString());
    const deducted = Math.max(0, actualMin - allowed);
    const { error } = await supabase.from("prayer_breaks").insert({
      pharmacy_id: pharmacyId, attendance_id: popup.log.id,
      pharmacist_name: popup.log.pharmacist_name, date: today,
      prayer_name: popup.prayer, prayer_time: popup.prayerTime,
      return_time: now.toISOString(), allowed_minutes: allowed,
      actual_minutes: actualMin, deducted_minutes: deducted,
    });
    if (!error) {
      if (deducted > 0) globalToast(`⚠️ تأخير ${deducted} دقيقة بعد ${popup.prayer}`, "warn");
      else globalToast(`✅ عودة ${popup.log.pharmacist_name} بعد صلاة ${popup.prayer}`);
      setActivePrayerPopup(null);
      loadPrayerBreaks();
    }
  }

  // ── حساب التقرير الشهري لكل صيدلي ──
  function calcMonthlyStats(pharmacistName: string) {
    const logs = monthlyLogs.filter((l) => l.pharmacist_name === pharmacistName);
    const totalNet = logs.reduce((s, l) => s + (l.net_hours || 0), 0);
    const totalLate = logs.reduce((s, l) => s + (l.late_minutes || 0), 0);
    const daysWorked = logs.filter((l) => l.check_out).length;

    // حساب الساعات المطلوبة من جدول الدوام
    const year = parseInt(selectedMonth.split("-")[0]);
    const month = parseInt(selectedMonth.split("-")[1]) - 1;
    let requiredHours = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const daySchedules = workSchedules.filter((s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && !s.is_off);
      daySchedules.forEach((s) => {
        const [sh, sm] = s.shift_start.split(":").map(Number);
        const [eh, em] = s.shift_end.split(":").map(Number);
        requiredHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
      });
    }

    return { totalNet, totalLate, daysWorked, requiredHours };
  }

  const uniquePharmacists = [...new Set(monthlyLogs.map((l) => l.pharmacist_name))];

  // ── جدول الدوام مجمّع لكل صيدلي ──
  const scheduleByPharmacist: Record<string, any[]> = {};
  workSchedules.forEach((s) => {
    if (!scheduleByPharmacist[s.pharmacist_name]) scheduleByPharmacist[s.pharmacist_name] = [];
    scheduleByPharmacist[s.pharmacist_name].push(s);
  });

  const cardStyle: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const inputStyle: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>جاري التحميل...</div>;

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🕐 الحضور والانصراف</h2>
        <div style={{ fontSize: 12, color: C.muted }}>
          {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {ramadan && <span style={{ marginRight: 8, background: "#f59e0b22", color: C.warning, borderRadius: 4, padding: "2px 8px" }}>🌙 رمضان</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bg2, borderRadius: 10, padding: 4 }}>
        {[
          { k: "attendance", l: "📋 الحضور" },
          { k: "schedule",   l: "📅 جدول الدوام" },
          { k: "settings",   l: "⚙️ الصلوات" },
          { k: "report",     l: "📊 تقرير يومي" },
          { k: "monthly",    l: "📈 تقرير شهري" },
        ].map((t) => (
          <button key={t.k} onClick={() => {
            setTab(t.k as any);
            if (t.k === "report") loadReport(selectedDate);
            if (t.k === "monthly") loadMonthlyReport(selectedMonth);
          }} style={{
            flex: 1, padding: "9px 4px", borderRadius: 8, border: "none",
            background: tab === t.k ? C.bg : "transparent",
            color: tab === t.k ? C.accent : C.muted,
            fontSize: 11, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ════ TAB: ATTENDANCE ════ */}
      {tab === "attendance" && (
        <div>
          {/* مواقيت الصلاة */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.accent, marginBottom: 10 }}>🕌 مواقيت الصلاة</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(prayerTimes).length === 0
                ? <span style={{ color: C.muted, fontSize: 12 }}>جاري تحميل المواقيت...</span>
                : Object.entries(prayerTimes).map(([name, time]) => {
                  const setting = prayerSettings.find((s) => s.prayer_name === name);
                  const allowed = ramadan ? setting?.ramadan_allowed_minutes : setting?.allowed_minutes;
                  return (
                    <div key={name} style={{ background: C.bg2, border: `1px solid ${setting?.is_active ? "#1a4a8a" : C.border}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 85 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{name}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{fmt(time)}</div>
                      {setting?.is_active && <div style={{ fontSize: 10, color: C.green }}>مسموح: {allowed} د</div>}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* تسجيل الحضور */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>👤 تسجيل الحضور</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pharmacists.map((name) => {
                const shiftNum = getCurrentShiftNumber(name);
                const activeLog = todayLogs.find((l) => l.pharmacist_name === name && l.shift_number === shiftNum && !l.check_out);
                const doneLog = todayLogs.find((l) => l.pharmacist_name === name && l.shift_number === shiftNum && l.check_out);
                const schedule = getExpectedShift(name, todayDow, shiftNum);

                return (
                  <div key={name} style={{ background: C.bg2, border: `1px solid ${activeLog ? "#1a5a3a" : doneLog ? "#1a3a5a" : C.border}`, borderRadius: 10, padding: "12px 16px", minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{name}</div>
                    {schedule && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                        شفت {shiftNum}: {schedule.shift_start} - {schedule.shift_end}
                      </div>
                    )}
                    {!activeLog && !doneLog && (
                      <button onClick={() => handleCheckIn(name)} style={{ background: C.successBg, border: "1px solid #1a5a30", borderRadius: 7, padding: "6px 14px", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                        ✅ تسجيل حضور
                      </button>
                    )}
                    {activeLog && (
                      <div>
                        <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>🟢 حضر {fmt(activeLog.check_in)}</div>
                        {activeLog.late_minutes > 0 && <div style={{ fontSize: 11, color: C.orange, marginBottom: 6 }}>⚠️ تأخر {activeLog.late_minutes} دقيقة</div>}
                        <button onClick={() => handleCheckOut(activeLog)} style={{ background: C.dangerBg, border: "1px solid #5a1a1a", borderRadius: 7, padding: "6px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                          🔴 تسجيل انصراف
                        </button>
                      </div>
                    )}
                    {doneLog && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        <div>🟢 {fmt(doneLog.check_in)}</div>
                        <div>🔴 {fmt(doneLog.check_out)}</div>
                        <div style={{ color: C.accent, fontWeight: 700 }}>صافي: {fmtHours(doneLog.net_hours)} س</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* سجل اليوم */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>📋 سجل اليوم</div>
            {todayLogs.length === 0
              ? <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>لا يوجد حضور مسجّل اليوم</div>
              : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["الصيدلي", "شفت", "الحضور", "التأخير", "الانصراف", "ساعات", "خصومات", "صافي"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "center", color: C.muted, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.map((log) => {
                      const myBreaks = prayerBreaks.filter((b) => b.attendance_id === log.id);
                      const liveDeductions = myBreaks.reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0);
                      const liveTotal = log.check_out ? log.total_hours : diffMin(log.check_in, new Date().toISOString()) / 60;
                      const liveNet = Math.max(0, liveTotal - liveDeductions / 60);
                      return (
                        <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                          <td style={{ padding: "10px", fontWeight: 700, color: C.text }}>{log.pharmacist_name}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: C.muted }}>{log.shift_number || 1}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                            {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", color: log.check_out ? C.red : C.muted }}>{fmt(log.check_out)}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{fmtHours(liveTotal)}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: liveDeductions > 0 ? C.red : C.muted }}>
                            {liveDeductions > 0 ? `-${liveDeductions} د` : "—"}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: C.accent }}>{fmtHours(liveNet)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

            {/* فترات الصلاة */}
            {prayerBreaks.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>🕌 فترات الصلاة</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {prayerBreaks.map((b) => (
                    <div key={b.id} style={{ background: b.deducted_minutes > 0 ? "#2a1000" : "#0a1a10", border: `1px solid ${b.deducted_minutes > 0 ? "#5a2000" : C.successBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                      <strong style={{ color: C.text }}>{b.pharmacist_name}</strong>
                      <span style={{ color: C.muted }}> – {b.prayer_name} · {fmt(b.prayer_time)} ← {fmt(b.return_time)}</span>
                      {b.deducted_minutes > 0
                        ? <span style={{ color: C.red }}> ⚠️ خصم {b.deducted_minutes} د</span>
                        : <span style={{ color: C.green }}> ✅</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "schedule" && (
  <WorkScheduleTab
    pharmacists={pharmacists}
    workSchedules={workSchedules}
    pharmacyId={pharmacyId}
    todayDow={todayDow}
    C={C}
    onSaved={loadWorkSchedules}
    globalToast={globalToast}
  />
)}
      {/* ════ TAB: PRAYER SETTINGS ════ */}
      {tab === "settings" && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>⚙️ إعدادات وقت الصلوات</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>التأخير عن الوقت المسموح يُخصم من ساعات العمل</div>
          {prayerSettings.map((s) => (
            <PrayerSettingRow key={s.id} setting={s} onSave={async (updated: any) => {
              await supabase.from("prayer_settings").update({ allowed_minutes: updated.allowed_minutes, ramadan_allowed_minutes: updated.ramadan_allowed_minutes, is_active: updated.is_active, updated_at: new Date().toISOString() }).eq("id", updated.id).eq("pharmacy_id", pharmacyId);
              globalToast("تم حفظ الإعدادات ✓");
              loadPrayerSettings();
            }} ramadan={ramadan} C={C} />
          ))}
        </div>
      )}

      {/* ════ TAB: DAILY REPORT ════ */}
      {tab === "report" && (
        <div>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 13, color: C.text }}>📅 اختر التاريخ:</label>
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); loadReport(e.target.value); }}
              style={{ ...inputStyle, width: "auto" }} />
          </div>

          {reportLogs.length === 0
            ? <div style={{ ...cardStyle, textAlign: "center", color: C.muted, padding: 40 }}>لا يوجد سجلات لهذا اليوم</div>
            : reportLogs.map((log) => (
              <div key={log.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: C.text }}>{log.pharmacist_name}</strong>
                    <span style={{ fontSize: 11, color: C.muted, marginRight: 8 }}>شفت {log.shift_number || 1}</span>
                    {log.expected_start && <span style={{ fontSize: 11, color: C.muted }}>· متوقع: {log.expected_start}</span>}
                  </div>
                  <span style={{ background: C.surface, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                    صافي: {fmtHours(log.net_hours)} س
                  </span>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
                  <span>🟢 حضور: <strong style={{ color: C.green }}>{fmt(log.check_in)}</strong></span>
                  <span>🔴 انصراف: <strong style={{ color: C.red }}>{fmt(log.check_out)}</strong></span>
                  <span>⏱ إجمالي: <strong style={{ color: C.text }}>{fmtHours(log.total_hours)}</strong></span>
                  {log.late_minutes > 0 && <span>⚠️ تأخير: <strong style={{ color: C.orange }}>{log.late_minutes} د</strong></span>}
                  {log.total_deductions > 0 && <span>🕌 خصم صلاة: <strong style={{ color: C.red }}>{fmtHours(log.total_deductions)}</strong></span>}
                </div>
                {log.prayer_breaks?.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>فترات الصلاة:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {log.prayer_breaks.map((b: any) => (
                        <div key={b.id} style={{ background: b.deducted_minutes > 0 ? "#2a1000" : "#0a1a10", border: `1px solid ${b.deducted_minutes > 0 ? "#5a2000" : C.successBorder}`, borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>
                          {b.prayer_name}: {fmt(b.prayer_time)} ← {fmt(b.return_time)}
                          {b.deducted_minutes > 0 ? <span style={{ color: C.red }}> ⚠️ -{b.deducted_minutes}د</span> : <span style={{ color: C.green }}> ✅</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ════ TAB: MONTHLY REPORT ════ */}
      {tab === "monthly" && (
        <div>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 13, color: C.text }}>📅 اختر الشهر:</label>
            <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); loadMonthlyReport(e.target.value); }}
              style={{ ...inputStyle, width: "auto" }} />
          </div>

          {monthlyLogs.length === 0
            ? <div style={{ ...cardStyle, textAlign: "center", color: C.muted, padding: 40 }}>لا يوجد سجلات لهذا الشهر</div>
            : uniquePharmacists.map((name) => {
              const { totalNet, totalLate, daysWorked, requiredHours } = calcMonthlyStats(name);
              const diff = totalNet - requiredHours;
              const pharmLogs = monthlyLogs.filter((l) => l.pharmacist_name === name);
              return (
                <div key={name} style={cardStyle}>
                  {/* رأس الصيدلي */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <strong style={{ fontSize: 15, color: C.text }}>👤 {name}</strong>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ background: C.surface, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                        فعلي: {fmtHours(totalNet)} س
                      </span>
                      <span style={{ background: diff >= 0 ? C.successBg : C.dangerBg, color: diff >= 0 ? C.green : C.red, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                        {diff >= 0 ? "+" : ""}{fmtHours(Math.abs(diff))} {diff >= 0 ? "زيادة" : "نقص"}
                      </span>
                    </div>
                  </div>

                  {/* إحصائيات */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "أيام العمل", val: daysWorked + " يوم", color: C.text },
                      { label: "ساعات مطلوبة", val: fmtHours(requiredHours) + " س", color: C.muted },
                      { label: "ساعات فعلية", val: fmtHours(totalNet) + " س", color: C.accent },
                      { label: "إجمالي التأخير", val: totalLate + " د", color: totalLate > 0 ? C.orange : C.muted },
                    ].map((stat) => (
                      <div key={stat.label} style={{ background: C.bg2, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* تفاصيل الأيام */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {["التاريخ", "اليوم", "شفت", "الحضور", "التأخير", "الانصراف", "صافي"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "center", color: C.muted, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pharmLogs.map((log) => {
                        const dow = new Date(log.date).getDay();
                        return (
                          <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>{log.date}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: dow === 5 ? C.orange : C.text }}>{DAY_NAMES[dow]}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>{log.shift_number || 1}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                              {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                            </td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.red }}>{fmt(log.check_out)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: C.accent }}>{fmtHours(log.net_hours)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      )}

      {/* Prayer Popup */}
      {activePrayerPopup && (
        <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🕌</div>
            <h3 style={{ margin: "0 0 4px", color: C.text, fontSize: 18 }}>وقت صلاة {activePrayerPopup.prayer}</h3>
            <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 14 }}>{activePrayerPopup.log.pharmacist_name} – الوقت المسموح: {activePrayerPopup.allowed} دقيقة</p>
            <button onClick={() => handlePrayerReturn(activePrayerPopup)}
              style={{ background: C.successBg, border: "1px solid #1a5a30", borderRadius: 10, padding: "12px 28px", color: C.green, fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 10 }}>
              ✅ {activePrayerPopup.log.pharmacist_name} – رجع من الصلاة
            </button>
            <button onClick={() => setActivePrayerPopup(null)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 20px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
              تجاهل مؤقتاً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Prayer Setting Row ──────────────────────────────────────────────────────
