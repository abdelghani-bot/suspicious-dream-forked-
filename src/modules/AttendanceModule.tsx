import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { queueEvent } from "../lib/offlineAPI";
import { COLORS, tint } from "../theme";
import { DAY_NAMES, calcCappedHours, diffMin, findHolidayForDate, fmt, fmtHours, getRotationPharmacistForDate, isRamadan, todayLocal } from "../lib/dateUtils";
import { SAUDI_CITIES, fetchPrayerTimes } from "../lib/prayerTimes";
import { SYSTEM_SECTIONS } from "./PermissionsModule";

// ══════════════════════════════════════════════════════
// Component منفصل — ضعه خارج AttendanceModule
// ══════════════════════════════════════════════════════
export function WorkScheduleTab({ pharmacists, workSchedules, pharmacyId, todayDow, C, onSaved, globalToast, readOnly = false }: any) {
    const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

    const [selectedPharmacist, setSelectedPharmacist] = useState("");
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState<"normal" | "ramadan">("normal"); // 🆕 جدول عادي أو نسخة رمضان

    // بناء جدول افتراضي أسبوعي
    const emptyWeek = () =>
        Array.from({ length: 7 }, (_, dow) => ({
            day_of_week: dow,
            is_off: dow === 6, // السبت إجازة افتراضياً
            shifts: [
                { shift_number: 1, shift_start: "09:00", shift_end: "21:00", enabled: true, overtime_minutes: 0, grace_minutes: 10 },
                { shift_number: 2, shift_start: "15:00", shift_end: "21:00", enabled: false, overtime_minutes: 0, grace_minutes: 10 },
            ],
        }));

    const [weekForm, setWeekForm] = useState<any[]>(emptyWeek());

    // لما يختار صيدلي، يحمّل جدوله الموجود
    useEffect(() => {
        if (!selectedPharmacist) { setWeekForm(emptyWeek()); return; }
        const pharmSchedules = workSchedules.filter((s: any) => s.pharmacist_name === selectedPharmacist && !!s.is_ramadan === (mode === "ramadan"));
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
                    { shift_number: 1, shift_start: sh1?.shift_start || "09:00", shift_end: sh1?.shift_end || "21:00", enabled: !!sh1 && !isOff, overtime_minutes: sh1?.overtime_minutes || 0, grace_minutes: sh1?.grace_minutes ?? 10 },
                    { shift_number: 2, shift_start: sh2?.shift_start || "15:00", shift_end: sh2?.shift_end || "21:00", enabled: !!sh2 && !isOff, overtime_minutes: sh2?.overtime_minutes || 0, grace_minutes: sh2?.grace_minutes ?? 10 },
                ],
            };
        });
        setWeekForm(newWeek);
    }, [selectedPharmacist, workSchedules, mode]);

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
        if (readOnly) { globalToast("❌ لا تملك صلاحية تعديل جدول الدوام", "error"); return; }
        if (!selectedPharmacist) { globalToast("اختر الصيدلي أولاً"); return; }
        setSaving(true);

        const isRamadanMode = mode === "ramadan";

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
                    is_ramadan: isRamadanMode,
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
                        overtime_minutes: +sh.overtime_minutes || 0,
                        grace_minutes: +sh.grace_minutes || 0,
                        is_ramadan: isRamadanMode,
                    });
                });
            }
        });

        if (rows.length === 0) { globalToast("لا يوجد بيانات للحفظ"); setSaving(false); return; }

        // 🆕 أوفلاين-أول: event مركّب واحد بيعمل الحذف+الإدراج معًا وقت المزامنة (WORK_SCHEDULE_REPLACE_WEEK)
        // بدل نداءين منفصلين محتاجين نت فورًا. الكاش المحلي بيتحدّث فورًا برضه عشان onSaved() يعرض
        // النتيجة صح لو الجهاز أوفلاين.
        const rowsWithIds = rows.map((r) => ({ id: crypto.randomUUID(), ...r }));
        try {
            for (const r of rowsWithIds) await window.offlineAPI.upsertWorkScheduleCache(r);
            await window.offlineAPI.deleteWorkSchedulesCacheByPharmacist({
                pharmacyId, pharmacistName: selectedPharmacist, isRamadan: isRamadanMode, excludeIds: rowsWithIds.map((r) => r.id),
            });
        } catch (err) {
            console.error("work schedule cache update failed:", err);
        }

        await queueEvent({
            id: crypto.randomUUID(),
            type: "WORK_SCHEDULE_REPLACE_WEEK",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { pharmacy_id: pharmacyId, pharmacist_name: selectedPharmacist, is_ramadan: isRamadanMode, rows: rowsWithIds },
        });

        setSaving(false);
        globalToast(`✓ تم حفظ جدول ${selectedPharmacist}${isRamadanMode ? " (رمضان)" : ""}`);
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

                    {/* 🆕 التبديل بين الجدول العادي ونسخة رمضان */}
                    <div style={{ display: "flex", background: C.bg2, borderRadius: 8, padding: 3 }}>
                        <button onClick={() => setMode("normal")} style={{ border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: mode === "normal" ? C.bg : "transparent", color: mode === "normal" ? C.accent : C.muted }}>
                            📅 عادي
                        </button>
                        <button onClick={() => setMode("ramadan")} style={{ border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: mode === "ramadan" ? C.bg : "transparent", color: mode === "ramadan" ? COLORS.gold : C.muted }}>
                            🌙 رمضان
                        </button>
                    </div>

                    {selectedPharmacist && (
                        <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: C.muted }}>
                                إجمالي الأسبوع:
                                <strong style={{ color: C.accent, marginRight: 4 }}>{weeklyHours.toFixed(1)} ساعة</strong>
                            </span>
                            <button
                                onClick={saveWeekSchedule}
                                disabled={saving || readOnly}
                                style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 8, padding: "8px 20px", color: C.green, fontSize: 13, fontWeight: 700, cursor: readOnly ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.6 : 1 }}
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
                                background: isToday ? COLORS.surfaceAlt : "transparent",
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
                                                        <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>+أوفر تايم</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={5}
                                                            value={sh.overtime_minutes || 0}
                                                            onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "overtime_minutes", e.target.value)}
                                                            style={{ ...inputStyle, width: 60 }}
                                                            title="دقائق أوفر تايم معتمدة تُحتسب لو داوم فيها فعلاً — أي وقت زيادة غيرها لا يُحسب"
                                                        />
                                                        <span style={{ fontSize: 10, color: C.muted }}>د</span>
                                                        <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>| سماح تأخير</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={5}
                                                            value={sh.grace_minutes ?? 10}
                                                            onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "grace_minutes", e.target.value)}
                                                            style={{ ...inputStyle, width: 55 }}
                                                            title="عدد الدقائق المسموحة بعد ميعاد الشفت من غير ما تُحسب تأخير"
                                                        />
                                                        <span style={{ fontSize: 10, color: C.muted }}>د</span>
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
                            disabled={saving || readOnly}
                            style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 8, padding: "9px 24px", color: C.green, fontSize: 13, fontWeight: 700, cursor: readOnly ? "not-allowed" : "pointer", opacity: (saving || readOnly) ? 0.6 : 1 }}
                        >
                            {readOnly ? "🔒 عرض فقط" : (saving ? "جاري الحفظ..." : "💾 حفظ جدول الأسبوع")}
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
                                    style={{ background: selectedPharmacist === name ? COLORS.blueSoft : C.bg, border: `1px solid ${selectedPharmacist === name ? C.accent : C.border}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
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
// 🆕 التبديل الدوري (زي تبديل الجمعة بين صيادلة) — نمط مرن: أي عدد أسابيع متتالية لكل صيدلي
// ══════════════════════════════════════════════════════════════════════════════
export function RotationTab({ pharmacists, rotationSchedules, pharmacyId, C, onSaved, globalToast, readOnly = false }: any) {
    const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const emptyForm = () => ({
        group_name: "", day_of_week: 5, pharmacist_names: [] as string[],
        cycle_length: 1, start_date: todayLocal(), shift_start: "09:00", shift_end: "21:00",
    });
    const [form, setForm] = useState<any>(emptyForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const togglePharmacist = (name: string) => {
        setForm((p: any) => ({
            ...p,
            pharmacist_names: p.pharmacist_names.includes(name)
                ? p.pharmacist_names.filter((n: string) => n !== name)
                : [...p.pharmacist_names, name],
        }));
    };

    const startEdit = (r: any) => {
        setEditingId(r.id);
        setForm({
            group_name: r.group_name, day_of_week: r.day_of_week, pharmacist_names: [...(r.pharmacist_names || [])],
            cycle_length: r.cycle_length, start_date: r.start_date, shift_start: r.shift_start, shift_end: r.shift_end,
        });
    };

    const save = async () => {
        if (readOnly) { globalToast("❌ لا تملك صلاحية تعديل التبديل الدوري", "error"); return; }
        if (!form.group_name.trim()) { globalToast("اكتب اسم المجموعة"); return; }
        if (form.pharmacist_names.length < 2) { globalToast("اختر صيدليين اتنين على الأقل"); return; }
        setSaving(true);
        const id = editingId || crypto.randomUUID();
        const row = {
            id, pharmacy_id: pharmacyId, group_name: form.group_name.trim(), day_of_week: +form.day_of_week,
            pharmacist_names: form.pharmacist_names, cycle_length: +form.cycle_length || 1,
            start_date: form.start_date, shift_start: form.shift_start, shift_end: form.shift_end, active: true,
        };
        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر
        try {
            await window.offlineAPI.upsertRotationScheduleCache(row);
        } catch (err) {
            console.error("upsertRotationScheduleCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: editingId ? "ROTATION_UPDATE" : "ROTATION_INSERT",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: editingId ? { id, pharmacy_id: pharmacyId, updates: row } : { row },
        });
        setSaving(false);
        globalToast("✓ تم حفظ التبديل الدوري");
        setForm(emptyForm());
        setEditingId(null);
        onSaved();
    };

    const remove = async (id: string) => {
        if (readOnly) { globalToast("❌ لا تملك صلاحية الحذف", "error"); return; }
        // 🆕 أوفلاين-أول: حذف من الكاش المحلي فورًا + queueEvent
        try {
            await window.offlineAPI.deleteRotationScheduleCache(id);
        } catch (err) {
            console.error("deleteRotationScheduleCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ROTATION_DELETE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { id, pharmacy_id: pharmacyId },
        });
        globalToast("تم الحذف");
        onSaved();
    };

    const inputStyle: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

    return (
        <div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>🔁 {editingId ? "تعديل" : "إضافة"} تبديل دوري</div>
                <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
                    مثال: صيدليين يتبادلوا الجمعة — حدد اليوم، رتّب الصيادلة بالدور، وحدد كام أسبوع ياخد كل واحد قبل ما يجي دور اللي بعده (١ = أسبوع وأسبوع بالتبادل، ٢ = جمعتين ورا بعض لكل واحد... وهكذا)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>اسم المجموعة</label>
                        <input style={inputStyle} value={form.group_name} disabled={readOnly} placeholder="مثال: تبديل الجمعة" onChange={(e) => setForm((p: any) => ({ ...p, group_name: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>اليوم</label>
                        <select style={inputStyle} value={form.day_of_week} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, day_of_week: +e.target.value }))}>
                            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: C.muted }}>الصيادلة (بالترتيب اللي هيبدأ بيهم الدور)</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        {pharmacists.map((name: string) => {
                            const idx = form.pharmacist_names.indexOf(name);
                            return (
                                <button key={name} type="button" disabled={readOnly} onClick={() => togglePharmacist(name)}
                                    style={{ background: idx >= 0 ? COLORS.blueSoft : C.bg2, border: `1px solid ${idx >= 0 ? C.accent : C.border}`, borderRadius: 8, padding: "6px 12px", color: C.text, fontSize: 12, cursor: readOnly ? "not-allowed" : "pointer" }}>
                                    {idx >= 0 ? `${idx + 1}. ` : ""}{name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>كام أسبوع لكل صيدلي</label>
                        <input type="number" min={1} style={inputStyle} value={form.cycle_length} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, cycle_length: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>تاريخ بداية الدورة</label>
                        <input type="date" style={inputStyle} value={form.start_date} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, start_date: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>من الساعة</label>
                        <input type="time" style={inputStyle} value={form.shift_start} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, shift_start: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>إلى الساعة</label>
                        <input type="time" style={inputStyle} value={form.shift_end} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, shift_end: e.target.value }))} />
                    </div>
                </div>

                {!readOnly && (
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={save} disabled={saving} style={{ background: C.accent, border: "none", borderRadius: 8, padding: "9px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
                        </button>
                        {editingId && (
                            <button onClick={() => { setEditingId(null); setForm(emptyForm()); }} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 20px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                                إلغاء
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📋 التبديلات المحفوظة</div>
            {rotationSchedules.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: "center" }}>لا يوجد تبديل دوري محفوظ</div>}
            {rotationSchedules.map((r: any) => {
                const nextTurn = getRotationPharmacistForDate(r, todayLocal());
                return (
                    <div key={r.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{r.group_name} — {DAY_NAMES[r.day_of_week]}</div>
                                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{(r.pharmacist_names || []).join(" ← ")} · كل {r.cycle_length} أسبوع · {r.shift_start}–{r.shift_end}</div>
                                {nextTurn && <div style={{ fontSize: 12, color: C.accent, marginTop: 4, fontWeight: 700 }}>👤 الدور على: {nextTurn} (النهاردة)</div>}
                            </div>
                            {!readOnly && (
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => startEdit(r)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.accent, fontSize: 11, cursor: "pointer" }}>تعديل</button>
                                    <button onClick={() => remove(r.id)} style={{ background: "transparent", border: `1px solid ${C.red}`, borderRadius: 6, padding: "5px 10px", color: C.red, fontSize: 11, cursor: "pointer" }}>حذف</button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
// 🆕 الإجازات الرسمية — المدير بيضيفها ويحدد هل الصيدلية شغالة فيها ولو شغالة بكام ساعة
// ══════════════════════════════════════════════════════════════════════════════
export function HolidaysTab({ officialHolidays, pharmacyId, C, onSaved, globalToast, readOnly = false }: any) {
    // مناسبات معروفة مسبقًا — الثابتة تواريخها مؤكدة، الهجرية (الأعياد/رمضان) تقديرية لحد ما وزارة الموارد البشرية تعلنها رسميًا
    const SUGGESTED_2026 = [
        { name: "يوم التأسيس", date_start: "2026-02-22", date_end: "2026-02-22", is_estimated: false },
        { name: "عيد الفطر", date_start: "2026-03-19", date_end: "2026-03-23", is_estimated: true },
        { name: "يوم عرفة + عيد الأضحى", date_start: "2026-05-25", date_end: "2026-05-29", is_estimated: true },
        { name: "اليوم الوطني", date_start: "2026-09-23", date_end: "2026-09-23", is_estimated: false },
    ];

    const emptyForm = () => ({ name: "", date_start: todayLocal(), date_end: todayLocal(), is_worked: false, work_hours_start: "09:00", work_hours_end: "17:00", is_estimated: false });
    const [form, setForm] = useState<any>(emptyForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const startEdit = (h: any) => {
        setEditingId(h.id);
        setForm({
            name: h.name, date_start: h.date_start, date_end: h.date_end, is_worked: h.is_worked,
            work_hours_start: h.work_hours_start || "09:00", work_hours_end: h.work_hours_end || "17:00", is_estimated: h.is_estimated,
        });
    };

    const quickAdd = (s: any) => {
        setEditingId(null);
        setForm({ name: s.name, date_start: s.date_start, date_end: s.date_end, is_worked: false, work_hours_start: "09:00", work_hours_end: "17:00", is_estimated: s.is_estimated });
        globalToast(s.is_estimated ? "⚠️ التاريخ ده تقديري — أكّده لما وزارة الموارد البشرية تعلن رسميًا" : "تاريخ ثابت مؤكد");
    };

    const save = async () => {
        if (readOnly) { globalToast("❌ لا تملك صلاحية تعديل الإجازات", "error"); return; }
        if (!form.name.trim()) { globalToast("اكتب اسم المناسبة"); return; }
        if (form.date_end < form.date_start) { globalToast("تاريخ النهاية قبل البداية!"); return; }
        setSaving(true);
        const id = editingId || crypto.randomUUID();
        const row = {
            id, pharmacy_id: pharmacyId, name: form.name.trim(), date_start: form.date_start, date_end: form.date_end,
            is_worked: form.is_worked, is_estimated: form.is_estimated,
            work_hours_start: form.is_worked ? form.work_hours_start : null,
            work_hours_end: form.is_worked ? form.work_hours_end : null,
        };
        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر
        try {
            await window.offlineAPI.upsertHolidayCache(row);
        } catch (err) {
            console.error("upsertHolidayCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: editingId ? "HOLIDAY_UPDATE" : "HOLIDAY_INSERT",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: editingId ? { id, pharmacy_id: pharmacyId, updates: row } : { row },
        });
        setSaving(false);
        globalToast("✓ تم حفظ الإجازة");
        setForm(emptyForm());
        setEditingId(null);
        onSaved();
    };

    const remove = async (id: string) => {
        if (readOnly) { globalToast("❌ لا تملك صلاحية الحذف", "error"); return; }
        // 🆕 أوفلاين-أول: حذف من الكاش المحلي فورًا + queueEvent
        try {
            await window.offlineAPI.deleteHolidayCache(id);
        } catch (err) {
            console.error("deleteHolidayCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "HOLIDAY_DELETE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { id, pharmacy_id: pharmacyId },
        });
        globalToast("تم الحذف");
        onSaved();
    };

    const inputStyle: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
    const sorted = [...officialHolidays].sort((a: any, b: any) => a.date_start.localeCompare(b.date_start));

    return (
        <div>
            {!readOnly && (
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 8 }}>⚡ إضافة سريعة — مناسبات ٢٠٢٦</div>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 10 }}>التواريخ الهجرية (الأعياد) تقديرية حسب التقويم — لازم تأكيدها بعد الإعلان الرسمي من وزارة الموارد البشرية</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {SUGGESTED_2026.map((s) => (
                            <button key={s.name} onClick={() => quickAdd(s)} style={{ background: C.bg2, border: `1px solid ${s.is_estimated ? C.orange : C.green}`, borderRadius: 8, padding: "7px 12px", color: C.text, fontSize: 12, cursor: "pointer" }}>
                                {s.is_estimated ? "🌙" : "📌"} {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 12 }}>🗓️ {editingId ? "تعديل" : "إضافة"} إجازة رسمية</div>

                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: C.muted }}>اسم المناسبة</label>
                    <input style={inputStyle} value={form.name} disabled={readOnly} placeholder="مثال: عيد الفطر" onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>من تاريخ</label>
                        <input type="date" style={inputStyle} value={form.date_start} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, date_start: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: C.muted }}>إلى تاريخ</label>
                        <input type="date" style={inputStyle} value={form.date_end} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, date_end: e.target.value }))} />
                    </div>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: readOnly ? "not-allowed" : "pointer" }}>
                        <input type="checkbox" checked={form.is_worked} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, is_worked: e.target.checked }))} style={{ width: 16, height: 16 }} />
                        الصيدلية شغالة في الإجازة دي
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text, cursor: readOnly ? "not-allowed" : "pointer" }}>
                        <input type="checkbox" checked={form.is_estimated} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, is_estimated: e.target.checked }))} style={{ width: 16, height: 16 }} />
                        تاريخ تقديري (لسه مش معلن رسميًا)
                    </label>
                </div>

                {form.is_worked && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        <div>
                            <label style={{ fontSize: 11, color: C.muted }}>من الساعة</label>
                            <input type="time" style={inputStyle} value={form.work_hours_start} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, work_hours_start: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ fontSize: 11, color: C.muted }}>إلى الساعة</label>
                            <input type="time" style={inputStyle} value={form.work_hours_end} disabled={readOnly} onChange={(e) => setForm((p: any) => ({ ...p, work_hours_end: e.target.value }))} />
                        </div>
                    </div>
                )}

                {!readOnly && (
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={save} disabled={saving} style={{ background: C.accent, border: "none", borderRadius: 8, padding: "9px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
                        </button>
                        {editingId && (
                            <button onClick={() => { setEditingId(null); setForm(emptyForm()); }} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 20px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
                                إلغاء
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📋 الإجازات المحفوظة</div>
            {sorted.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: "center" }}>لا يوجد إجازات رسمية محفوظة</div>}
            {sorted.map((h: any) => (
                <div key={h.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>
                                {h.name} {h.is_estimated && <span style={{ background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 4, padding: "1px 6px", fontSize: 10, marginRight: 6 }}>🌙 تقديري</span>}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                                {h.date_start === h.date_end ? h.date_start : `${h.date_start} → ${h.date_end}`}
                                {" · "}
                                {h.is_worked ? `شغالة ${h.work_hours_start}–${h.work_hours_end}` : "إجازة كاملة"}
                            </div>
                        </div>
                        {!readOnly && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => startEdit(h)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 10px", color: C.accent, fontSize: 11, cursor: "pointer" }}>تعديل</button>
                                <button onClick={() => remove(h.id)} style={{ background: "transparent", border: `1px solid ${C.red}`, borderRadius: 6, padding: "5px 10px", color: C.red, fontSize: 11, cursor: "pointer" }}>حذف</button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
export function AttendanceModule({ pharmacyId, shifts, setShifts, currentUser, users = [], showToast: globalToast, canViewSub = (_sub) => true, canEditSub = (_sub) => true }: {
    pharmacyId: string;
    shifts: any[];
    setShifts: (fn: any) => void;
    currentUser: any;
    users?: any[];
    showToast: (msg: string, type?: string) => void;
    canViewSub?: (sub: string) => boolean;
    canEditSub?: (sub: string) => boolean;
}) {
    // ── ربط تابات الشاشة بمعرّفات الصلاحيات في SYSTEM_SECTIONS ──
    const TAB_PERM_KEY: Record<string, string> = {
        attendance: "checkin", schedule: "schedule", settings: "prayers",
        report: "daily_report", monthly: "monthly_report",
        holidays: "schedule", rotation: "schedule",
    };
    const canViewTab = (t: string) => canViewSub(TAB_PERM_KEY[t] || t);
    const canEditTab = (t: string) => canEditSub(TAB_PERM_KEY[t] || t);
    const [tab, setTab] = useState<"attendance" | "schedule" | "settings" | "report" | "monthly" | "holidays" | "rotation">("attendance");
    const [pharmacists, setPharmacists] = useState<string[]>([]);
    const [todayLogs, setTodayLogs] = useState<any[]>([]);
    const [prayerTimes, setPrayerTimes] = useState<Record<string, string>>({});
    const [prayerSettings, setPrayerSettings] = useState<any[]>([]);
    const [prayerBreaks, setPrayerBreaks] = useState<any[]>([]);
    const [activePrayerPopup, setActivePrayerPopup] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(todayLocal());
    const [reportLogs, setReportLogs] = useState<any[]>([]);
    const [workSchedules, setWorkSchedules] = useState<any[]>([]);
    const [officialHolidays, setOfficialHolidays] = useState<any[]>([]);
    const [rotationSchedules, setRotationSchedules] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
    const [scheduleForm, setScheduleForm] = useState<any>({ pharmacist_name: "", day_of_week: 0, shift_number: 1, shift_start: "09:00", shift_end: "21:00", is_off: false });
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [prayerCity, setPrayerCity] = useState<string>("riyadh");
    const ramadan = isRamadan();
    const intervalRef = useRef<any>(null);

    // 🆕 استشعار انقطاع الكهرباء/النت: فجوة بين آخر نبضة والوقت الحالي
    const [gapThresholdMinutes, setGapThresholdMinutes] = useState<number>(30);
    const [pendingGap, setPendingGap] = useState<{ start: string; end: string; minutes: number } | null>(null);
    const [gapReasonNote, setGapReasonNote] = useState("");
    const [unreviewedGaps, setUnreviewedGaps] = useState<any[]>([]);
    const heartbeatRef = useRef<any>(null);

    const today = todayLocal();
    const todayDow = new Date().getDay();

    // ── ألوان النظام الداكن ──
    const C = {
        bg: COLORS.surface, bg2: COLORS.surfaceAlt, border: COLORS.border,
        text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue,
        green: COLORS.green, red: COLORS.red, orange: COLORS.gold, purple: COLORS.purple,
    };

    useEffect(() => { if (pharmacyId) loadAll(); }, [pharmacyId]);

    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("pharmacy_settings")
            .select("prayer_city")
            .eq("pharmacy_id", pharmacyId)
            .single()
            .then(({ data }) => {
                if (data?.prayer_city) setPrayerCity(data.prayer_city);
            });
    }, [pharmacyId]);

    // 🆕 تحميل حد الفجوة المشبوهة (بالدقايق) من إعدادات الصيدلية
    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("pharmacy_settings")
            .select("attendance_gap_threshold_minutes")
            .eq("pharmacy_id", pharmacyId)
            .single()
            .then(({ data }) => {
                if (data?.attendance_gap_threshold_minutes) setGapThresholdMinutes(data.attendance_gap_threshold_minutes);
            });
    }, [pharmacyId]);

    const saveGapThreshold = async (minutes: number) => {
        setGapThresholdMinutes(minutes);
        // 🆕 أوفلاين-أول: التحديث المحلي (state) بيحصل فورًا فوق، والكتابة للسيرفر بتتأجل عبر queueEvent
        await queueEvent({
            id: crypto.randomUUID(),
            type: "GAP_THRESHOLD_UPDATE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { pharmacy_id: pharmacyId, minutes },
        });
        globalToast(`✅ تم تحديث حد الفجوة المشبوهة إلى ${minutes} دقيقة`);
    };

    // 🆕 نبضة heartbeat محلية طول ما الشاشة مفتوحة، عشان لو الجهاز اتقفل فجأة (كهرباء/كراش)
    // نلاقي آخر وقت كان فيه نشاط فعلي محفوظ على القرص (localStorage مش الذاكرة).
    const HEARTBEAT_KEY = `attendance_heartbeat_${pharmacyId}`;

    function checkForGap() {
        if (!currentUser?.name) return;
        const myOpenLog = todayLogs.find((l) => l.pharmacist_name === currentUser.name && !l.check_out);
        if (!myOpenLog) return; // مفيش حضور مفتوح للمستخدم الحالي، مفيش داعي نسأل

        const lastBeat = localStorage.getItem(HEARTBEAT_KEY);
        const now = Date.now();
        if (lastBeat) {
            const gapMs = now - parseInt(lastBeat, 10);
            const gapMinutes = gapMs / 60000;
            if (gapMinutes >= gapThresholdMinutes) {
                setPendingGap({
                    start: new Date(parseInt(lastBeat, 10)).toISOString(),
                    end: new Date(now).toISOString(),
                    minutes: Math.round(gapMinutes),
                });
            }
        }
        localStorage.setItem(HEARTBEAT_KEY, String(now));
    }

    useEffect(() => {
        if (!pharmacyId || !currentUser?.name) return;
        checkForGap(); // تحقق فوري عند فتح/رجوع الصفحة
        heartbeatRef.current = setInterval(() => {
            localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
        }, 60000); // نبضة كل دقيقة طول ما الصفحة مفتوحة وشغالة
        const onVisible = () => { if (document.visibilityState === "visible") checkForGap(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            clearInterval(heartbeatRef.current);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [pharmacyId, currentUser?.name, gapThresholdMinutes, todayLogs.length]);

    // 🆕 حفظ سبب الفجوة اللي اختاره الصيدلي + تحميل الفجوات اللي لسه محتاجة مراجعة المدير
    async function submitGapReason(reason: string) {
        if (!pendingGap || !currentUser?.name) return;
        const myOpenLog = todayLogs.find((l) => l.pharmacist_name === currentUser.name && !l.check_out);
        const gapRow = {
            id: crypto.randomUUID(),
            pharmacy_id: pharmacyId,
            attendance_id: myOpenLog?.id || null,
            pharmacist_name: currentUser.name,
            gap_start: pendingGap.start,
            gap_end: pendingGap.end,
            duration_minutes: pendingGap.minutes,
            reason,
            note: reason === "سبب آخر" ? gapReasonNote : null,
            review_status: "pending",
        };
        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر
        try {
            await window.offlineAPI.upsertAttendanceGapCache(gapRow);
        } catch (err) {
            console.error("upsertAttendanceGapCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "GAP_REASON_INSERT",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { record: gapRow },
        });
        globalToast("✅ تم تسجيل السبب، هيتراجع من المدير");
        setPendingGap(null);
        setGapReasonNote("");
        loadUnreviewedGaps();
    }

    async function loadUnreviewedGaps() {
        // 🆕 أونلاين أولاً، وفولباك للكاش المحلي لو فشلت أو أوفلاين
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase
                .from("attendance_gaps")
                .select("*")
                .eq("pharmacy_id", pharmacyId)
                .eq("review_status", "pending")
                .order("gap_start", { ascending: false });
            if (error) throw error;
            setUnreviewedGaps(data || []);
        } catch {
            try {
                const cached = await window.offlineAPI.getUnreviewedAttendanceGapsCache(pharmacyId);
                setUnreviewedGaps(cached || []);
            } catch (err) {
                console.error("getUnreviewedAttendanceGapsCache failed:", err);
            }
        }
    }

    useEffect(() => { if (pharmacyId) loadUnreviewedGaps(); }, [pharmacyId]);

    // 🆕 اعتماد الفجوة (مفيش خصم) أو رفضها (تتحسب تأخير/خصم من ساعات العمل)
    async function reviewGap(gap: any, approve: boolean) {
        const reviewedAt = new Date().toISOString();
        const reviewedBy = currentUser?.name || null;

        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي (بس حالة المراجعة، مش خصم الساعات —
        // ده بيتحسب وقت المزامنة على بيانات attendance_logs الطازة، نفس فلسفة ATTENDANCE_CHECKOUT)
        try {
            await window.offlineAPI.upsertAttendanceGapCache({ ...gap, review_status: approve ? "approved" : "rejected", reviewed_at: reviewedAt, reviewed_by: reviewedBy });
        } catch (err) {
            console.error("upsertAttendanceGapCache (review) failed:", err);
        }

        await queueEvent({
            id: crypto.randomUUID(),
            type: "GAP_REVIEW",
            pharmacy_id: pharmacyId,
            timestamp: reviewedAt,
            payload: {
                gapId: gap.id, approve, reviewedBy, reviewedAt,
                attendanceId: gap.attendance_id, durationMinutes: gap.duration_minutes, pharmacyId,
            },
        });

        globalToast(approve ? "✅ تم اعتماد الفجوة" : "❌ تم رفض الفجوة واحتسابها تأخير");
        loadUnreviewedGaps();
        loadTodayLogs();
    }

    const saveCityAndReload = async (cityId: string) => {
        setPrayerCity(cityId);
        await supabase
            .from("pharmacy_settings")
            .upsert([{ pharmacy_id: pharmacyId, prayer_city: cityId }], { onConflict: "pharmacy_id" });
        const city = SAUDI_CITIES.find((c) => c.id === cityId);
        if (city) {
            try {
                const pt = await fetchPrayerTimes(city.lat, city.lng);
                setPrayerTimes(pt);
                globalToast(`✅ تم تحديث المواقيت حسب ${city.name}`);
            } catch {
                globalToast("تعذّر تحميل مواقيت الصلاة", "error");
            }
        }
    };

    useEffect(() => {
        intervalRef.current = setInterval(checkPrayerAlerts, 30000);
        return () => clearInterval(intervalRef.current);
    }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks]);

    async function loadAll() {
        setLoading(true);
        await loadPharmacists();
        const schedulesData = await loadWorkSchedules();
        await Promise.all([loadOfficialHolidays(), loadRotationSchedules()]);
        await autoCloseOrphanLogs(schedulesData);
        await Promise.all([loadTodayLogs(), loadPrayerSettings(), loadPrayerBreaks()]);
        try {
            const { data: settingsData } = await supabase
                .from("pharmacy_settings")
                .select("prayer_city")
                .eq("pharmacy_id", pharmacyId)
                .single();
            const cityId = settingsData?.prayer_city || "riyadh";
            const city = SAUDI_CITIES.find((c) => c.id === cityId) || SAUDI_CITIES[0];
            setPrayerCity(city.id);
            const pt = await fetchPrayerTimes(city.lat, city.lng);
            setPrayerTimes(pt);
        } catch {
            globalToast("تعذّر تحميل مواقيت الصلاة", "error");
        }
        setLoading(false);
    }

    // 🆕 إغلاق تلقائي لسجلات الحضور "اليتيمة" — لما صيدلي ينسى يسجل انصراف ويفضل السجل مفتوح من يوم سابق.
    // بنقفله على وقت نهاية دوامه المجدول (+ الأوفرتايم المسموح)، مش وقت اكتشاف المشكلة،
    // نفس منطق calcCappedHours بالظبط، عشان الساعات تتحسب صح ومايفضلش معلّق للأبد.
    async function autoCloseOrphanLogs(schedulesData: any[]) {
        // 🆕 عملية صيانة تلقائية مش يدوية — لو أوفلاين بنأجلها بأمان لحد فتح البرنامج ومعاه نت،
        // بدل ما نحاول نكتب على بيانات مش موجودة عندنا كاملة (كل orphans كل الصيدليات)
        if (!navigator.onLine) return;
        const { data: orphans } = await supabase
            .from("attendance_logs")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .is("check_out", null)
            .lt("date", today);
        if (!orphans || orphans.length === 0) return;

        for (const log of orphans) {
            const dow = new Date(log.check_in).getDay();
            const schedule = (schedulesData || []).find(
                (s: any) => s.pharmacist_name === log.pharmacist_name && s.day_of_week === dow && s.shift_number === (log.shift_number || 1) && !s.is_off
            );

            let closeISO: string;
            if (schedule?.shift_start && schedule?.shift_end) {
                const [startH, startM] = schedule.shift_start.split(":").map(Number);
                const [endH, endM] = schedule.shift_end.split(":").map(Number);
                const scheduledEnd = new Date(log.check_in);
                scheduledEnd.setHours(endH, endM, 0, 0);
                if (endH * 60 + endM <= startH * 60 + startM) scheduledEnd.setDate(scheduledEnd.getDate() + 1);
                const overtimeAllowed = +schedule.overtime_minutes || 0;
                closeISO = new Date(scheduledEnd.getTime() + overtimeAllowed * 60000).toISOString();
            } else {
                // مفيش جدول مطابق أصلاً — نقفله على نهاية يوم الحضور، وهيتحسب صفر ساعات زي ما بيحصل مع أي حضور خارج الدوام
                const endOfDay = new Date(log.check_in);
                endOfDay.setHours(23, 59, 59, 0);
                closeISO = endOfDay.toISOString();
            }

            const { totalHours } = calcCappedHours(log.check_in, closeISO, schedule);
            const { data: breaks } = await supabase.from("prayer_breaks").select("deducted_minutes").eq("attendance_id", log.id);
            const totalDeductions = (breaks || []).reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
            const netHours = Math.max(0, totalHours - totalDeductions);

            await supabase.from("attendance_logs").update({
                check_out: closeISO,
                total_hours: +totalHours.toFixed(2),
                total_deductions: +totalDeductions.toFixed(2),
                net_hours: +netHours.toFixed(2),
                auto_closed: true,
            }).eq("id", log.id).eq("pharmacy_id", pharmacyId);
        }

        globalToast(`⚠️ تم إغلاق ${orphans.length} سجل حضور تلقائيًا (نسيان تسجيل انصراف)`, "warn");
    }

    // 🆕 بقت بتفلتر من props.users الجاهز بدل query مباشر — نفس فلسفة تصحيح openCreditModal
    // في موديول العملاء: البيانات أصلًا متاحة عند الأب، فمفيش داعي لطلب نت إضافي، وبيشتغل أوفلاين تلقائيًا
    async function loadPharmacists() {
        setPharmacists(users.filter((u: any) => u.role === "pharmacist").map((u: any) => u.name).sort());
    }

    async function loadTodayLogs() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("attendance_logs").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("check_in");
            if (error) throw error;
            setTodayLogs(data || []);
        } catch {
            try {
                const cached = await window.offlineAPI.getTodayAttendanceLogsCache({ pharmacyId, date: today });
                setTodayLogs(cached || []);
            } catch (err) {
                console.error("getTodayAttendanceLogsCache failed:", err);
            }
        }
    }

    async function loadPrayerSettings() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("prayer_settings").select("*").eq("pharmacy_id", pharmacyId).order("id");
            if (error) throw error;
            setPrayerSettings(data || []);
            // 🆕 كتابة فورية في الكاش عشان تفضل متاحة أوفلاين المرة الجاية
            (data || []).forEach((s: any) => window.offlineAPI.upsertPrayerSettingCache(s).catch(() => { }));
        } catch {
            try {
                const cached = await window.offlineAPI.getPrayerSettingsCache(pharmacyId);
                setPrayerSettings(cached || []);
            } catch (err) {
                console.error("getPrayerSettingsCache failed:", err);
            }
        }
    }

    async function loadPrayerBreaks() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("prayer_breaks").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("prayer_time");
            if (error) throw error;
            setPrayerBreaks(data || []);
        } catch {
            try {
                const cached = await window.offlineAPI.getPrayerBreaksCache({ pharmacyId, date: today });
                setPrayerBreaks(cached || []);
            } catch (err) {
                console.error("getPrayerBreaksCache failed:", err);
            }
        }
    }

    async function loadWorkSchedules() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("work_schedules").select("*").eq("pharmacy_id", pharmacyId).order("pharmacist_name");
            if (error) throw error;
            setWorkSchedules(data || []);
            return data || [];
        } catch {
            try {
                const cached = await window.offlineAPI.getWorkSchedulesCache(pharmacyId);
                setWorkSchedules(cached || []);
                return cached || [];
            } catch (err) {
                console.error("getWorkSchedulesCache failed:", err);
                return [];
            }
        }
    }

    async function loadOfficialHolidays() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("official_holidays").select("*").eq("pharmacy_id", pharmacyId).order("date_start");
            if (error) throw error;
            setOfficialHolidays(data || []);
            return data || [];
        } catch {
            try {
                const cached = await window.offlineAPI.getHolidaysCache(pharmacyId);
                setOfficialHolidays(cached || []);
                return cached || [];
            } catch (err) {
                console.error("getHolidaysCache failed:", err);
                return [];
            }
        }
    }

    async function loadRotationSchedules() {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("rotation_schedules").select("*").eq("pharmacy_id", pharmacyId).order("group_name");
            if (error) throw error;
            setRotationSchedules(data || []);
            return data || [];
        } catch {
            try {
                const cached = await window.offlineAPI.getRotationSchedulesCache(pharmacyId);
                setRotationSchedules(cached || []);
                return cached || [];
            } catch (err) {
                console.error("getRotationSchedulesCache failed:", err);
                return [];
            }
        }
    }

    async function loadReport(date: string) {
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).eq("date", date).order("check_in");
            if (error) throw error;
            setReportLogs(data || []);
        } catch {
            try {
                const [logs, breaks] = await Promise.all([
                    window.offlineAPI.getAttendanceLogsRangeCache({ pharmacyId, from: date, to: date }),
                    window.offlineAPI.getPrayerBreaksRangeCache({ pharmacyId, from: date, to: date }),
                ]);
                const merged = (logs || []).map((l: any) => ({ ...l, prayer_breaks: (breaks || []).filter((b: any) => b.attendance_id === l.id) }));
                setReportLogs(merged);
            } catch (err) {
                console.error("loadReport cache fallback failed:", err);
            }
        }
    }

    async function loadMonthlyReport(month: string) {
        const from = month + "-01", to = month + "-31";
        try {
            if (!navigator.onLine) throw new Error("offline");
            const { data, error } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).gte("date", from).lte("date", to).order("date");
            if (error) throw error;
            setMonthlyLogs(data || []);
        } catch {
            try {
                const [logs, breaks] = await Promise.all([
                    window.offlineAPI.getAttendanceLogsRangeCache({ pharmacyId, from, to }),
                    window.offlineAPI.getPrayerBreaksRangeCache({ pharmacyId, from, to }),
                ]);
                const merged = (logs || []).map((l: any) => ({ ...l, prayer_breaks: (breaks || []).filter((b: any) => b.attendance_id === l.id) }));
                setMonthlyLogs(merged);
            } catch (err) {
                console.error("loadMonthlyReport cache fallback failed:", err);
            }
        }
    }

    // ── منطق جدول الدوام: إيجاد الشفت المتوقع للصيدلي — بترتيب أولوية:
    // ١) إجازة رسمية معتمدة لليوم ده (لو شغالة فيها بيستخدم ساعاتها، لو إجازة كاملة يرجع "مفيش شفت")
    // ٢) تبديل دوري (زي الجمعة) لو الصيدلي ضمن مجموعة تبديل في اليوم ده
    // ٣) الجدول الأسبوعي — نسخة رمضان لو الشهر رمضان وموجودة له نسخة، وإلا الجدول العادي
    function getExpectedShift(pharmacistName: string, dow: number, shiftNumber: number, dateStr: string = today) {
        const holiday = findHolidayForDate(officialHolidays, dateStr);
        if (holiday) {
            if (!holiday.is_worked) return null; // إجازة كاملة — مفيش دوام أصلاً
            if (shiftNumber !== 1) return null; // ساعات الإجازة بتتحسب كشفت واحد بس
            return {
                pharmacist_name: pharmacistName, day_of_week: dow, shift_number: 1,
                shift_start: holiday.work_hours_start, shift_end: holiday.work_hours_end,
                is_off: false, overtime_minutes: 0, is_holiday: true, holiday_name: holiday.name,
            };
        }

        const rotation = rotationSchedules.find(
            (r) => r.active && r.day_of_week === dow && (r.pharmacist_names || []).includes(pharmacistName)
        );
        if (rotation) {
            if (shiftNumber !== 1) return null;
            const turnPharmacist = getRotationPharmacistForDate(rotation, dateStr);
            if (turnPharmacist !== pharmacistName) return null; // مش دوره — إجازة
            return {
                pharmacist_name: pharmacistName, day_of_week: dow, shift_number: 1,
                shift_start: rotation.shift_start, shift_end: rotation.shift_end,
                is_off: false, overtime_minutes: 0, is_rotation: true,
            };
        }

        const ramadanActive = isRamadan();
        if (ramadanActive) {
            const ramadanMatch = workSchedules.find(
                (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off && s.is_ramadan
            );
            if (ramadanMatch) return ramadanMatch;
        }

        return workSchedules.find(
            (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off && !s.is_ramadan
        );
    }

    // 🆕 هل سجل الحضور ده خارج جدول الدوام المعتمد؟ (مفيش شفت مطابق، أو الحضور كله وقع بعد نهاية الشفت + الأوفر تايم)
    function isOutsideSchedule(log: any) {
        if (!log?.check_in) return false;
        const dow = new Date(log.check_in).getDay();
        const schedule = getExpectedShift(log.pharmacist_name, dow, log.shift_number || 1, log.date || todayLocal());
        if (!schedule) return true;
        if (log.check_out) {
            const { outsideSchedule } = calcCappedHours(log.check_in, log.check_out, schedule);
            return outsideSchedule;
        }
        return false;
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
        const schedule = getExpectedShift(pharmacistName, new Date(checkInTime).getDay(), shiftNum, checkInTime.slice(0, 10));
        if (!schedule) return 0;
        const [expH, expM] = schedule.shift_start.split(":").map(Number);
        const expected = new Date(checkInTime);
        expected.setHours(expH, expM, 0, 0);
        const actual = new Date(checkInTime);
        const diff = Math.round((actual.getTime() - expected.getTime()) / 60000);
        const grace = +schedule.grace_minutes || 0;
        return Math.max(0, diff - grace);
    }

    // ── حضور (مرتبط بالشفت) ──
    async function handleCheckIn(pharmacistName: string) {
        if (!canEditTab("attendance")) { globalToast("❌ لا تملك صلاحية تسجيل الحضور", "error"); return; }
        const shiftNum = getCurrentShiftNumber(pharmacistName);
        const existing = todayLogs.find((l) => l.pharmacist_name === pharmacistName && l.shift_number === shiftNum && !l.check_out);
        if (existing) { globalToast(`${pharmacistName} مسجّل بالفعل في شفت ${shiftNum}`, "warn"); return; }

        // إيجاد الشفت المفتوح للمستخدم الحالي
        const openShift = shifts.find((s) => !s.end_time && s.user === pharmacistName);
        const schedule = getExpectedShift(pharmacistName, todayDow, shiftNum);
        const lateMin = calcLateMinutes(pharmacistName, shiftNum, new Date().toISOString());

        const logRow = {
            id: crypto.randomUUID(),
            pharmacy_id: pharmacyId,
            pharmacist_name: pharmacistName,
            pharmacist_user_id: users.find((u) => u.name === pharmacistName)?.id || null,
            date: today,
            check_in: new Date().toISOString(),
            shift_id: openShift?.id || null,
            shift_number: shiftNum,
            expected_start: schedule?.shift_start || null,
            late_minutes: lateMin,
        };

        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر (نفس نمط الشفت)
        try {
            await window.offlineAPI.upsertAttendanceLogCache(logRow);
        } catch (err) {
            console.error("upsertAttendanceLogCache (checkin) failed:", err);
        }
        // بنستخدم event type ATTENDANCE_CHECKIN الموجود بالفعل جوه offlineSync.ts (نفس اللي بيستخدمه
        // فتح الشفت تلقائيًا) لأن الشكل مطابق تمامًا: dedupe على pharmacist_name+date+check_out=null
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ATTENDANCE_CHECKIN",
            pharmacy_id: pharmacyId,
            timestamp: logRow.check_in,
            payload: { pharmacy_id: pharmacyId, pharmacist_name: pharmacistName, date: today, record: logRow },
        });

        setTodayLogs((p) => [...p, logRow]);
        if (!schedule) globalToast(`⚠️ تم تسجيل حضور ${pharmacistName} لكن لا يوجد شفت مطابق في جدول الدوام — لن تُحتسب له ساعات عمل`, "warn");
        else if (lateMin > 0) globalToast(`⚠️ ${pharmacistName} تأخر ${lateMin} دقيقة`, "warn");
        else globalToast(`✅ تم تسجيل حضور ${pharmacistName} - شفت ${shiftNum}`);
    }

    // ── انصراف (مرتبط بقفل الشفت) ──
    async function handleCheckOut(log: any) {
        if (!canEditTab("attendance")) { globalToast("❌ لا تملك صلاحية تسجيل الانصراف", "error"); return; }
        const now = new Date();
        const schedule = getExpectedShift(log.pharmacist_name, new Date(log.check_in).getDay(), log.shift_number || 1, log.date || todayLocal());
        const { totalHours, capped, outsideSchedule } = calcCappedHours(log.check_in, now.toISOString(), schedule);
        const myBreaks = prayerBreaks.filter((b) => b.attendance_id === log.id);
        const totalDeductions = myBreaks.reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
        const netHours = Math.max(0, totalHours - totalDeductions);

        const updates = {
            check_out: now.toISOString(),
            total_hours: +totalHours.toFixed(2),
            total_deductions: +totalDeductions.toFixed(2),
            net_hours: +netHours.toFixed(2),
        };

        // 🆕 أوفلاين-أول: الساعات محسوبة بالفعل هنا (باستخدام workSchedules/prayerBreaks المحمّلين
        // مسبقًا)، فبنكتب updates جاهزة عبر ATTENDANCE_LOG_UPDATE بدل تأجيل الحساب زي ATTENDANCE_CHECKOUT
        // — كده التوست بيفضل دقيق فورًا (outsideSchedule/capped) حتى لو أوفلاين.
        try {
            await window.offlineAPI.upsertAttendanceLogCache({ ...log, ...updates });
        } catch (err) {
            console.error("upsertAttendanceLogCache (checkout) failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ATTENDANCE_LOG_UPDATE",
            pharmacy_id: pharmacyId,
            timestamp: updates.check_out,
            payload: { id: log.id, pharmacy_id: pharmacyId, updates },
        });

        setTodayLogs((p) => p.map((l) => (l.id === log.id ? { ...l, ...updates } : l)));
        if (outsideSchedule) globalToast(`⚠️ تم تسجيل انصراف ${log.pharmacist_name} — الحضور خارج جدول الدوام، لم تُحتسب ساعات عمل`, "warn");
        else if (capped) globalToast(`✅ تم تسجيل انصراف ${log.pharmacist_name} — وقت زيادة عن الشفت متحسبش`, "warn");
        else globalToast(`✅ تم تسجيل انصراف ${log.pharmacist_name}`);
    }

    // ── حفظ جدول دوام ──
    async function saveSchedule() {
        if (!scheduleForm.pharmacist_name) { globalToast("اختر الصيدلي", "error"); return; }
        const row = {
            id: crypto.randomUUID(),
            ...scheduleForm,
            pharmacy_id: pharmacyId,
            shift_start: scheduleForm.is_off ? null : scheduleForm.shift_start,
            shift_end: scheduleForm.is_off ? null : scheduleForm.shift_end,
        };
        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent (WORK_SCHEDULE_UPSERT بنفس onConflict)
        try {
            await window.offlineAPI.upsertWorkScheduleCache(row);
        } catch (err) {
            console.error("upsertWorkScheduleCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "WORK_SCHEDULE_UPSERT",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { row },
        });
        globalToast("تم حفظ جدول الدوام ✓");
        loadWorkSchedules();
        setShowScheduleForm(false);
    }

    async function deleteSchedule(id: string) {
        // 🆕 أوفلاين-أول: حذف من الكاش المحلي فورًا + queueEvent
        try {
            await window.offlineAPI.deleteWorkScheduleCache(id);
        } catch (err) {
            console.error("deleteWorkScheduleCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "WORK_SCHEDULE_DELETE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { id, pharmacy_id: pharmacyId },
        });
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
        const record = {
            id: crypto.randomUUID(),
            pharmacy_id: pharmacyId, attendance_id: popup.log.id,
            pharmacist_name: popup.log.pharmacist_name, date: today,
            prayer_name: popup.prayer, prayer_time: popup.prayerTime,
            return_time: now.toISOString(), allowed_minutes: allowed,
            actual_minutes: actualMin, deducted_minutes: deducted,
        };
        // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر
        try {
            await window.offlineAPI.upsertPrayerBreakCache(record);
        } catch (err) {
            console.error("upsertPrayerBreakCache failed:", err);
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "PRAYER_BREAK_INSERT",
            pharmacy_id: pharmacyId,
            timestamp: now.toISOString(),
            payload: { record },
        });
        if (deducted > 0) globalToast(`⚠️ تأخير ${deducted} دقيقة بعد ${popup.prayer}`, "warn");
        else globalToast(`✅ عودة ${popup.log.pharmacist_name} بعد صلاة ${popup.prayer}`);
        setActivePrayerPopup(null);
        setPrayerBreaks((p) => [...p, record]);
    }

    // ── حساب التقرير الشهري لكل صيدلي ──
    function calcMonthlyStats(pharmacistName: string) {
        const logs = monthlyLogs.filter((l) => l.pharmacist_name === pharmacistName);
        const totalNet = logs.reduce((s, l) => s + (l.net_hours || 0), 0);
        const totalLate = logs.reduce((s, l) => s + (l.late_minutes || 0), 0);
        const daysWorked = logs.filter((l) => l.check_out).length;

        // حساب الساعات المطلوبة من جدول الدوام — مع مراعاة الإجازات الرسمية وتبديل الجمعة ورمضان
        const year = parseInt(selectedMonth.split("-")[0]);
        const month = parseInt(selectedMonth.split("-")[1]) - 1;
        let requiredHours = 0;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month, d).getDay();
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const schedule = getExpectedShift(pharmacistName, dow, 1, dateStr);
            const schedule2 = getExpectedShift(pharmacistName, dow, 2, dateStr);
            [schedule, schedule2].forEach((s) => {
                if (!s?.shift_start || !s?.shift_end) return;
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

            {/* 🆕 مودال: طلب توضيح سبب توقف البرنامج فترة (احتمال انقطاع كهرباء) */}
            {pendingGap && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                    <div style={{ background: C.bg, border: `1px solid ${COLORS.gold}`, borderRadius: 16, padding: 22, width: 340, maxWidth: "90%" }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: COLORS.gold, marginBottom: 6 }}>⚡ لاحظنا توقف في البرنامج</div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                            من {fmt(pendingGap.start)} إلى {fmt(pendingGap.end)} (حوالي {pendingGap.minutes} دقيقة) — ايه السبب؟
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button onClick={() => submitGapReason("انقطاع كهرباء")} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, cursor: "pointer", textAlign: "right" }}>
                                ⚡ انقطاع كهرباء
                            </button>
                            <button onClick={() => submitGapReason("مشكلة إنترنت")} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, cursor: "pointer", textAlign: "right" }}>
                                📶 مشكلة إنترنت
                            </button>
                            <div>
                                <input
                                    value={gapReasonNote}
                                    onChange={(e) => setGapReasonNote(e.target.value)}
                                    placeholder="سبب آخر (اكتبه هنا)..."
                                    style={{ width: "100%", boxSizing: "border-box", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", marginBottom: 6 }}
                                />
                                <button
                                    onClick={() => gapReasonNote.trim() && submitGapReason("سبب آخر")}
                                    disabled={!gapReasonNote.trim()}
                                    style={{ width: "100%", background: gapReasonNote.trim() ? COLORS.blueSoft : C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, cursor: gapReasonNote.trim() ? "pointer" : "not-allowed" }}
                                >
                                    إرسال السبب الآخر
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🕐 الحضور والانصراف</h2>
                <div style={{ fontSize: 12, color: C.muted }}>
                    {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {ramadan && <span style={{ marginRight: 8, background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 4, padding: "2px 8px" }}>🌙 رمضان</span>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bg2, borderRadius: 10, padding: 4 }}>
                {[
                    { k: "attendance", l: "📋 الحضور" },
                    { k: "schedule", l: "📅 جدول الدوام" },
                    { k: "rotation", l: "🔁 التبديل الدوري" },
                    { k: "holidays", l: "🗓️ الإجازات الرسمية" },
                    { k: "settings", l: "⚙️ الصلوات" },
                    { k: "report", l: "📊 تقرير يومي" },
                    { k: "monthly", l: "📈 تقرير شهري" },
                ].filter((t) => canViewTab(t.k)).map((t) => (
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

            {!canViewTab(tab) && (
                <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
                    🔒 لا تملك صلاحية عرض هذا القسم
                </div>
            )}

            {/* ════ TAB: ATTENDANCE ════ */}
            {tab === "attendance" && canViewTab("attendance") && (
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

                    {/* 🆕 فجوات محتاجة مراجعة (احتمال انقطاع كهرباء/نت) */}
                    {unreviewedGaps.length > 0 && (
                        <div style={{ ...cardStyle, border: `1px solid ${COLORS.gold}` }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.gold, marginBottom: 10 }}>
                                ⚡ فجوات محتاجة مراجعة ({unreviewedGaps.length})
                            </div>
                            {unreviewedGaps.map((gap) => (
                                <div key={gap.id} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{gap.pharmacist_name}</div>
                                            <div style={{ fontSize: 11, color: C.muted }}>
                                                من {fmt(gap.gap_start)} إلى {fmt(gap.gap_end)} · {gap.duration_minutes} دقيقة
                                            </div>
                                            <div style={{ fontSize: 12, color: C.accent, marginTop: 4 }}>
                                                السبب: {gap.reason}{gap.note ? ` — ${gap.note}` : ""}
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            <button onClick={() => reviewGap(gap, true)} style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 7, padding: "6px 12px", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                                ✅ اعتماد
                                            </button>
                                            <button onClick={() => reviewGap(gap, false)} style={{ background: "#3a1a1a", border: `1px solid #6a2a2a`, borderRadius: 7, padding: "6px 12px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                                ❌ رفض واحتسابها تأخير
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

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
                                            <button onClick={() => handleCheckIn(name)} style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 7, padding: "6px 14px", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                                                ✅ تسجيل حضور
                                            </button>
                                        )}
                                        {activeLog && (
                                            <div>
                                                <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>🟢 حضر {fmt(activeLog.check_in)}</div>
                                                {activeLog.late_minutes > 0 && <div style={{ fontSize: 11, color: C.orange, marginBottom: 6 }}>⚠️ تأخر {activeLog.late_minutes} دقيقة</div>}
                                                <button onClick={() => handleCheckOut(activeLog)} style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 7, padding: "6px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
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
                                            const outside = isOutsideSchedule(log);
                                            return (
                                                <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                                                    <td style={{ padding: "10px", fontWeight: 700, color: C.text }}>
                                                        {log.pharmacist_name}
                                                        {outside && (
                                                            <div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginTop: 2 }}>⚠️ خارج الدوام</div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "10px", textAlign: "center", color: C.muted }}>{log.shift_number || 1}</td>
                                                    <td style={{ padding: "10px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                                                    <td style={{ padding: "10px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                                                        {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                                                    </td>
                                                    <td style={{ padding: "10px", textAlign: "center", color: log.check_out ? C.red : C.muted }}>
                                                        {fmt(log.check_out)}
                                                        {log.auto_closed && (
                                                            <div style={{ fontSize: 9, color: C.orange, fontWeight: 700, marginTop: 2 }}>⏱ إغلاق تلقائي</div>
                                                        )}
                                                    </td>
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
                                        <div key={b.id} style={{ background: b.deducted_minutes > 0 ? COLORS.redSoft : COLORS.greenSoft, border: `1px solid ${b.deducted_minutes > 0 ? COLORS.red : COLORS.green}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
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

            {tab === "schedule" && canViewTab("schedule") && (
                <WorkScheduleTab
                    pharmacists={pharmacists}
                    workSchedules={workSchedules}
                    pharmacyId={pharmacyId}
                    todayDow={todayDow}
                    C={C}
                    onSaved={loadWorkSchedules}
                    globalToast={globalToast}
                    readOnly={!canEditTab("schedule")}
                />
            )}

            {/* ════ TAB: ROTATION (تبديل دوري زي الجمعة) ════ */}
            {tab === "rotation" && canViewTab("rotation") && (
                <RotationTab
                    pharmacists={pharmacists}
                    rotationSchedules={rotationSchedules}
                    pharmacyId={pharmacyId}
                    C={C}
                    onSaved={loadRotationSchedules}
                    globalToast={globalToast}
                    readOnly={!canEditTab("rotation")}
                />
            )}

            {/* ════ TAB: OFFICIAL HOLIDAYS ════ */}
            {tab === "holidays" && canViewTab("holidays") && (
                <HolidaysTab
                    officialHolidays={officialHolidays}
                    pharmacyId={pharmacyId}
                    C={C}
                    onSaved={loadOfficialHolidays}
                    globalToast={globalToast}
                    readOnly={!canEditTab("holidays")}
                />
            )}

            {/* ════ TAB: PRAYER SETTINGS ════ */}
            {tab === "settings" && canViewTab("settings") && (
                <div style={cardStyle}>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>⚙️ إعدادات وقت الصلوات</div>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>التأخير عن الوقت المسموح يُخصم من ساعات العمل</div>

                    {/* اختيار المدينة لحساب مواقيت الصلاة */}
                    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 8 }}>🕌 المدينة المعتمدة لحساب مواقيت الصلاة</div>
                        <select
                            value={prayerCity}
                            onChange={(e) => saveCityAndReload(e.target.value)}
                            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}
                        >
                            {SAUDI_CITIES.map((city) => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                            ))}
                        </select>
                        <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
                            تغيير المدينة يعيد حساب مواقيت الصلاة فوراً حسب الإحداثيات الجديدة
                        </div>
                    </div>

                    {/* 🆕 حد الفجوة المشبوهة لاستشعار انقطاع الكهرباء/النت */}
                    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 8 }}>⚡ حد الفجوة المشبوهة (انقطاع كهرباء/نت)</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                                type="number"
                                min={5}
                                step={5}
                                defaultValue={gapThresholdMinutes}
                                disabled={!canEditTab("settings")}
                                onBlur={(e) => {
                                    const v = +e.target.value;
                                    if (v >= 5 && v !== gapThresholdMinutes) saveGapThreshold(v);
                                }}
                                style={{ width: 100, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}
                            />
                            <span style={{ color: C.muted, fontSize: 12 }}>دقيقة</span>
                        </div>
                        <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
                            لو الجهاز اتقفل (كهرباء/كراش) لفترة أطول من كده أثناء شفت مفتوح، هيظهر للصيدلي طلب توضيح السبب عند رجوعه
                        </div>
                    </div>

                    {prayerSettings.map((s) => (
                        <PrayerSettingRow key={s.id} setting={s} onSave={async (updated: any) => {
                            if (!canEditTab("settings")) { globalToast("❌ لا تملك صلاحية تعديل إعدادات الصلوات", "error"); return; }
                            const updates = { allowed_minutes: updated.allowed_minutes, ramadan_allowed_minutes: updated.ramadan_allowed_minutes, is_active: updated.is_active, updated_at: new Date().toISOString() };
                            // 🆕 أوفلاين-أول: كتابة فورية في الكاش المحلي + queueEvent بدل نداء مباشر
                            try {
                                await window.offlineAPI.upsertPrayerSettingCache({ ...s, ...updates });
                            } catch (err) {
                                console.error("upsertPrayerSettingCache failed:", err);
                            }
                            await queueEvent({
                                id: crypto.randomUUID(),
                                type: "PRAYER_SETTING_UPDATE",
                                pharmacy_id: pharmacyId,
                                timestamp: new Date().toISOString(),
                                payload: { id: updated.id, pharmacy_id: pharmacyId, updates },
                            });
                            globalToast("تم حفظ الإعدادات ✓");
                            loadPrayerSettings();
                        }} ramadan={ramadan} C={C} readOnly={!canEditTab("settings")} />
                    ))}
                </div>
            )}

            {/* ════ TAB: DAILY REPORT ════ */}
            {tab === "report" && canViewTab("report") && (
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
                                        {isOutsideSchedule(log) && (
                                            <span style={{ fontSize: 11, color: C.red, fontWeight: 700, marginRight: 8 }}>⚠️ خارج الدوام</span>
                                        )}
                                        {log.auto_closed && (
                                            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginRight: 8 }}>⏱ إغلاق تلقائي (نسيان انصراف)</span>
                                        )}
                                    </div>
                                    <span style={{ background: COLORS.blueSoft, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
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
                                                <div key={b.id} style={{ background: b.deducted_minutes > 0 ? COLORS.redSoft : COLORS.greenSoft, border: `1px solid ${b.deducted_minutes > 0 ? COLORS.red : COLORS.green}`, borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>
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
            {tab === "monthly" && canViewTab("monthly") && (
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
                                            <span style={{ background: COLORS.blueSoft, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                                                فعلي: {fmtHours(totalNet)} س
                                            </span>
                                            <span style={{ background: diff >= 0 ? COLORS.greenSoft : COLORS.redSoft, color: diff >= 0 ? C.green : C.red, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
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
                                                const outside = isOutsideSchedule(log);
                                                return (
                                                    <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>{log.date}</td>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: dow === 5 ? C.orange : C.text }}>{DAY_NAMES[dow]}</td>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>
                                                            {log.shift_number || 1}
                                                            {outside && <div style={{ fontSize: 9, color: C.red, fontWeight: 700 }}>⚠️ خارج الدوام</div>}
                                                        </td>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                                                            {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                                                        </td>
                                                        <td style={{ padding: "7px 8px", textAlign: "center", color: C.red }}>
                                                            {fmt(log.check_out)}
                                                            {log.auto_closed && (
                                                                <div style={{ fontSize: 9, color: C.orange, fontWeight: 700 }}>⏱ تلقائي</div>
                                                            )}
                                                        </td>
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
                            style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 10, padding: "12px 28px", color: C.green, fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 10 }}>
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
export function PrayerSettingRow({ setting, onSave, ramadan, C, readOnly = false }: any) {
    const [local, setLocal] = useState({ ...setting });
    const changed = JSON.stringify(local) !== JSON.stringify(setting);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <div style={{ width: 70, fontWeight: 700, color: C.text, fontSize: 14 }}>{setting.prayer_name}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: readOnly ? "not-allowed" : "pointer", fontSize: 13, color: C.muted }}>
                <input type="checkbox" checked={local.is_active} disabled={readOnly} onChange={(e) => setLocal({ ...local, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
                تفعيل
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
                وقت مسموح:
                <input type="number" min={5} max={120} value={local.allowed_minutes} disabled={readOnly} onChange={(e) => setLocal({ ...local, allowed_minutes: +e.target.value })}
                    style={{ width: 60, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
                <span style={{ color: C.muted }}>دقيقة</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
                🌙 رمضان:
                <input type="number" min={5} max={120} value={local.ramadan_allowed_minutes} disabled={readOnly} onChange={(e) => setLocal({ ...local, ramadan_allowed_minutes: +e.target.value })}
                    style={{ width: 60, background: ramadan ? "#1a1500" : C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
                <span style={{ color: C.muted }}>دقيقة</span>
            </label>
            {changed && !readOnly && (
                <button onClick={() => onSave(local)} style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 7, padding: "6px 16px", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    حفظ
                </button>
            )}
        </div>
    );
}
