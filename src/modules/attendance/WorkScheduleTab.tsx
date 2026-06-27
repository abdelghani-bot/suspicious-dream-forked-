export function WorkScheduleTab({ pharmacists, workSchedules, pharmacyId, todayDow, C, onSaved, globalToast }: any) {
  const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const [selectedPharmacist, setSelectedPharmacist] = useState("");
  const [saving, setSaving] = useState(false);

  // بناء جدول افتراضي أسبوعي
  const emptyWeek = () =>
    Array.from({ length: 7 }, (_, dow) => ({
      day_of_week: dow,
      is_off: dow === 6, // السبت إجازة افتراضياً
      shifts: [
        { shift_number: 1, shift_start: "09:00", shift_end: "21:00", enabled: true },
        { shift_number: 2, shift_start: "15:00", shift_end: "21:00", enabled: false },
      ],
    }));

  const [weekForm, setWeekForm] = useState<any[]>(emptyWeek());

  // لما يختار صيدلي، يحمّل جدوله الموجود
  useEffect(() => {
    if (!selectedPharmacist) { setWeekForm(emptyWeek()); return; }
    const pharmSchedules = workSchedules.filter((s: any) => s.pharmacist_name === selectedPharmacist);
    if (pharmSchedules.length === 0) { setWeekForm(emptyWeek()); return; }

    const newWeek = emptyWeek().map((day) => {
      const daySchedules = pharmSchedules.filter((s: any) => s.day_of_week === day.day_of_week);
      if (daySchedules.length === 0) return day;

      const isOff = daySchedules.every((s: any) => s.is_off);
      const sh1 = daySchedules.find((s: any) => s.shift_number === 1);
      const sh2 = daySchedules.find((s: any) => s.shift_number === 2);

      return {
        ...day,
        is_off: isOff,
        shifts: [
          { shift_number: 1, shift_start: sh1?.shift_start || "09:00", shift_end: sh1?.shift_end || "21:00", enabled: !!sh1 && !isOff },
          { shift_number: 2, shift_start: sh2?.shift_start || "15:00", shift_end: sh2?.shift_end || "21:00", enabled: !!sh2 && !isOff },
        ],
      };
    });
    setWeekForm(newWeek);
  }, [selectedPharmacist, workSchedules]);

  const updateDay = (dow: number, field: string, value: any) => {
    setWeekForm((prev) => prev.map((d) => d.day_of_week === dow ? { ...d, [field]: value } : d));
  };

  const updateShift = (dow: number, shiftNum: number, field: string, value: any) => {
    setWeekForm((prev) => prev.map((d) =>
      d.day_of_week === dow
        ? { ...d, shifts: d.shifts.map((s: any) => s.shift_number === shiftNum ? { ...s, [field]: value } : s) }
        : d
    ));
  };

  const saveWeekSchedule = async () => {
    if (!selectedPharmacist) { globalToast("اختر الصيدلي أولاً"); return; }
    setSaving(true);

    // حذف الجدول القديم للصيدلي
    await supabase.from("work_schedules").delete()
      .eq("pharmacy_id", pharmacyId)
      .eq("pharmacist_name", selectedPharmacist);

    // بناء الصفوف الجديدة
    const rows: any[] = [];
    weekForm.forEach((day) => {
      if (day.is_off) {
        // يوم إجازة — صف واحد
        rows.push({
          pharmacy_id: pharmacyId,
          pharmacist_name: selectedPharmacist,
          day_of_week: day.day_of_week,
          shift_number: 1,
          shift_start: null,
          shift_end: null,
          is_off: true,
        });
      } else {
        day.shifts.forEach((sh: any) => {
          if (!sh.enabled) return;
          rows.push({
            pharmacy_id: pharmacyId,
            pharmacist_name: selectedPharmacist,
            day_of_week: day.day_of_week,
            shift_number: sh.shift_number,
            shift_start: sh.shift_start,
            shift_end: sh.shift_end,
            is_off: false,
          });
        });
      }
    });

    if (rows.length === 0) { globalToast("لا يوجد بيانات للحفظ"); setSaving(false); return; }

    const { error } = await supabase.from("work_schedules").insert(rows);
    setSaving(false);

    if (error) { globalToast("خطأ في الحفظ: " + error.message); return; }
    globalToast(`✓ تم حفظ جدول ${selectedPharmacist}`);
    onSaved();
  };

  const inputStyle: React.CSSProperties = {
    background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 7,
    padding: "5px 8px", color: C.text, fontSize: 12, outline: "none",
  };

  // حساب إجمالي ساعات الأسبوع
  const weeklyHours = weekForm.reduce((total, day) => {
    if (day.is_off) return total;
    return total + day.shifts.filter((s: any) => s.enabled).reduce((sum: number, s: any) => {
      const [sh, sm] = s.shift_start.split(":").map(Number);
      const [eh, em] = s.shift_end.split(":").map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0);
  }, 0);

  return (
    <div>
      {/* اختيار الصيدلي */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>👤 الصيدلي:</label>
          <select
            value={selectedPharmacist}
            onChange={(e) => setSelectedPharmacist(e.target.value)}
            style={{ ...inputStyle, minWidth: 180, padding: "8px 12px", fontSize: 13 }}
          >
            <option value="">اختر صيدلي...</option>
            {pharmacists.map((n: string) => <option key={n} value={n}>{n}</option>)}
          </select>
          {selectedPharmacist && (
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>
                إجمالي الأسبوع:
                <strong style={{ color: C.accent, marginRight: 4 }}>{weeklyHours.toFixed(1)} ساعة</strong>
              </span>
              <button
                onClick={saveWeekSchedule}
                disabled={saving}
                style={{ background: "#0a2a18", border: "1px solid #1a5a30", borderRadius: 8, padding: "8px 20px", color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "جاري الحفظ..." : "💾 حفظ الجدول"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* جدول الأسبوع */}
      {selectedPharmacist && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {weekForm.map((day) => {
            const isToday = day.day_of_week === todayDow;
            const dayHours = day.is_off ? 0 : day.shifts.filter((s: any) => s.enabled).reduce((sum: number, s: any) => {
              const [sh, sm] = s.shift_start.split(":").map(Number);
              const [eh, em] = s.shift_end.split(":").map(Number);
              return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
            }, 0);

            return (
              <div key={day.day_of_week} style={{
                borderBottom: `1px solid ${C.border}`,
                background: isToday ? "#0a1a2a" : "transparent",
                padding: "12px 16px",
              }}>
                {/* رأس اليوم */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: day.is_off ? 0 : 10 }}>
                  <div style={{ width: 80, fontWeight: 700, color: isToday ? C.accent : C.text, fontSize: 13 }}>
                    {DAY_NAMES[day.day_of_week]}
                    {isToday && <span style={{ fontSize: 10, color: C.accent, marginRight: 4 }}>← اليوم</span>}
                  </div>

                  {/* زر إجازة */}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: day.is_off ? C.orange : C.muted }}>
                    <input
                      type="checkbox"
                      checked={day.is_off}
                      onChange={(e) => updateDay(day.day_of_week, "is_off", e.target.checked)}
                      style={{ width: 14, height: 14 }}
                    />
                    إجازة
                  </label>

                  {!day.is_off && (
                    <span style={{ marginRight: "auto", fontSize: 11, color: C.muted }}>
                      {dayHours > 0 ? `${dayHours.toFixed(1)} ساعة` : ""}
                    </span>
                  )}
                </div>

                {/* الشفتات */}
                {!day.is_off && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 16 }}>
                    {day.shifts.map((sh: any) => (
                      <div key={sh.shift_number} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* تفعيل الشفت */}
                        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", minWidth: 68, fontSize: 12, color: sh.enabled ? C.text : C.muted }}>
                          <input
                            type="checkbox"
                            checked={sh.enabled}
                            onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "enabled", e.target.checked)}
                            style={{ width: 13, height: 13 }}
                          />
                          شفت {sh.shift_number}
                        </label>

                        {sh.enabled && (
                          <>
                            <span style={{ fontSize: 11, color: C.muted }}>من</span>
                            <input
                              type="time"
                              value={sh.shift_start}
                              onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "shift_start", e.target.value)}
                              style={{ ...inputStyle, width: 100 }}
                            />
                            <span style={{ fontSize: 11, color: C.muted }}>إلى</span>
                            <input
                              type="time"
                              value={sh.shift_end}
                              onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "shift_end", e.target.value)}
                              style={{ ...inputStyle, width: 100 }}
                            />
                            <span style={{ fontSize: 11, color: C.muted }}>
                              {(() => {
                                const [sh_h, sh_m] = sh.shift_start.split(":").map(Number);
                                const [eh, em] = sh.shift_end.split(":").map(Number);
                                const h = ((eh * 60 + em) - (sh_h * 60 + sh_m)) / 60;
                                return h > 0 ? `${h.toFixed(1)} س` : "";
                              })()}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {day.is_off && (
                  <div style={{ paddingRight: 16, fontSize: 12, color: C.orange }}>🏖️ يوم إجازة</div>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: "12px 16px", background: C.bg2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.muted }}>
              إجمالي ساعات الأسبوع:
              <strong style={{ color: C.accent, marginRight: 6 }}>{weeklyHours.toFixed(1)} ساعة</strong>
            </span>
            <button
              onClick={saveWeekSchedule}
              disabled={saving}
              style={{ background: "#0a2a18", border: "1px solid #1a5a30", borderRadius: 8, padding: "9px 24px", color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "جاري الحفظ..." : "💾 حفظ جدول الأسبوع"}
            </button>
          </div>
        </div>
      )}

      {/* عرض جداول الصيادلة الموجودة */}
      {workSchedules.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📋 الجداول المحفوظة</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[...new Set(workSchedules.map((s: any) => s.pharmacist_name))].map((name: any) => {
              const pharmSchedules = workSchedules.filter((s: any) => s.pharmacist_name === name && !s.is_off);
              const totalHours = pharmSchedules.reduce((sum: number, s: any) => {
                if (!s.shift_start || !s.shift_end) return sum;
                const [sh, sm] = s.shift_start.split(":").map(Number);
                const [eh, em] = s.shift_end.split(":").map(Number);
                return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
              }, 0);
              return (
                <div
                  key={name}
                  onClick={() => setSelectedPharmacist(name)}
                  style={{ background: selectedPharmacist === name ? "#0a1a3a" : C.bg, border: `1px solid ${selectedPharmacist === name ? C.accent : C.border}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{totalHours.toFixed(0)} ساعة / أسبوع</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
