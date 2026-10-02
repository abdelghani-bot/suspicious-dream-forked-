// ==================== تاريخ اليوم بالتوقيت المحلي (السعودية) ====================
// 🆕 بديل آمن لـ todayLocal() اللي بترجع تاريخ UTC مش المحلي.
// المشكلة: السعودية UTC+3، فمن الساعة 12 بالليل لحد 3 الفجر بالتوقيت المحلي،
// toISOString() كانت لسه شايفة إن التاريخ "امبارح" مش "النهاردة" — وده كان بيسبب:
// - تقفيل الخزنة يتسجل بتاريخ غلط
// - فحص الشفتات المفتوحة "النهاردة" بيفوت شفت اتفتح قبل نص الليل وفضل مفتوح بعده
// - تسجيل حضور/انصراف بعد نص الليل بيتسجل على تاريخ اليوم اللي فات
// الدالة دي بتستخدم دوال الـ Date المحلية (getFullYear/getMonth/getDate) اللي بتاخد
// توقيت جهاز المستخدم نفسه (الصيدلية) بدل UTC.
// 🆕 تشابه الأسماء (Dice coefficient على ثنائيات الحروف) — بيتستخدم لاقتراح ربط صنف
// جوكر قديم بصنف حقيقي جديد قريب منه في الاسم، حتى لو مش نفس الحروف بالظبط
export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const s1 = norm(a), s2 = norm(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const bigrams = (s: string) => { const arr = []; for (let i = 0; i < s.length - 1; i++) arr.push(s.substr(i, 2)); return arr; };
  const b1 = bigrams(s1), b2 = bigrams(s2);
  if (b1.length === 0 || b2.length === 0) return s1.includes(s2) || s2.includes(s1) ? 0.9 : 0;
  const b2copy = [...b2];
  let matches = 0;
  b1.forEach((bg) => { const idx = b2copy.indexOf(bg); if (idx !== -1) { matches++; b2copy.splice(idx, 1); } });
  return (2 * matches) / (b1.length + b2.length);
}



export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


// ── helpers ──────────────────────────────────────────────────────────────────
export type RamadanRange = { start: string; end: string }; // YYYY-MM-DD، الطرفين شاملين

// فترات افتراضية مدمجة (للسنين اللي فاتت + احتياطي لو الإعدادات لسه متحمّلتش).
const DEFAULT_RAMADAN_RANGES: RamadanRange[] = [
  { start: "2025-03-01", end: "2025-03-30" },
  { start: "2026-02-18", end: "2026-03-19" },
];

// الفترات القادمة من إعدادات الصيدلية (pharmacy_settings.ramadan_ranges) — بتتحدّث من
// getPharmacySettings عبر setRamadanRanges، فمفيش حاجة تتغير في أي مكان بينادي isRamadan.
let configuredRamadanRanges: RamadanRange[] = [];

export function setRamadanRanges(ranges: unknown) {
  const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  configuredRamadanRanges = Array.isArray(ranges)
    ? ranges.filter((r: any) => r && isDate(r.start) && isDate(r.end) && r.start <= r.end)
    : [];
}

export function isRamadan(date: Date | string = new Date()) {
  // مقارنة نصوص YYYY-MM-DD (بتتفادى مشاكل الـ timezone وبتشمل آخر يوم في الفترة)
  const dateStr = typeof date === "string" ? date.slice(0, 10) : todayLocal(date);
  return [...DEFAULT_RAMADAN_RANGES, ...configuredRamadanRanges]
    .some((r) => dateStr >= r.start && dateStr <= r.end);
}



// 🆕 هل التاريخ ده واقع في إجازة رسمية معتمدة؟ بيرجع الإجازة نفسها لو لقاها
export function findHolidayForDate(holidays: any[], dateStr: string) {
  return (holidays || []).find((h) => dateStr >= h.date_start && dateStr <= h.date_end) || null;
}



// 🆕 حساب مين الصيدلي المستحق في دورة تبديل (زي الجمعة) في تاريخ معيّن.
// cycle_length = كام أسبوع متتالي ياخدهم كل صيدلي قبل ما يجي دور اللي بعده
// (cycle_length=1 → أسبوع وأسبوع بالتبادل، cycle_length=2 → جمعتين ورا بعض لكل واحد... وهكذا)
export function getRotationPharmacistForDate(rotation: any, dateStr: string) {
  if (!rotation?.pharmacist_names?.length || !rotation?.start_date) return null;
  const start = new Date(rotation.start_date + "T00:00:00");
  const cur = new Date(dateStr + "T00:00:00");
  const weeksSince = Math.floor((cur.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  if (weeksSince < 0) return null;
  const cycle = Math.max(1, +rotation.cycle_length || 1);
  const turnIndex = Math.floor(weeksSince / cycle) % rotation.pharmacist_names.length;
  return rotation.pharmacist_names[turnIndex];
}


// ==================== مطابقة الصيدلي بالـ id (مع fallback للاسم للصفوف القديمة) ====================
// 🆕 الاسم بقى للعرض بس. لو الصف والمستخدم عندهم pharmacist_user_id بنقارن بيه، وإلا بنرجع للاسم.
export function findUserIdByName(users: any[], name?: string | null): string | null {
  if (!name) return null;
  const matches = (users || []).filter((u) => u.name === name);
  return matches.length === 1 ? String(matches[0].id) : null; // اسم مكرر → مش هنخمّن
}

export function isSamePharmacist(row: any, name?: string | null, userId?: string | null): boolean {
  if (!row) return false;
  if (userId && row.pharmacist_user_id) return String(row.pharmacist_user_id) === String(userId);
  return !!name && row.pharmacist_name === name;
}

export function rotationHasPharmacist(rotation: any, name?: string | null, userId?: string | null): boolean {
  const ids = rotation?.pharmacist_ids;
  if (userId && Array.isArray(ids) && ids.length > 0) return ids.map(String).includes(String(userId));
  return !!name && (rotation?.pharmacist_names || []).includes(name);
}

// index الدور في دورة التبديل لتاريخ معيّن (-1 لو لسه ماوصلناش لتاريخ البداية)
export function getRotationTurnIndex(rotation: any, dateStr: string): number {
  const count = rotation?.pharmacist_ids?.length || rotation?.pharmacist_names?.length || 0;
  if (!count || !rotation?.start_date) return -1;
  const start = new Date(rotation.start_date + "T00:00:00");
  const cur = new Date(dateStr + "T00:00:00");
  const weeksSince = Math.floor((cur.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  if (weeksSince < 0) return -1;
  const cycle = Math.max(1, +rotation.cycle_length || 1);
  return Math.floor(weeksSince / cycle) % count;
}

export function isRotationTurnOf(rotation: any, dateStr: string, name?: string | null, userId?: string | null): boolean {
  const idx = getRotationTurnIndex(rotation, dateStr);
  if (idx < 0) return false;
  const ids = rotation?.pharmacist_ids;
  if (userId && Array.isArray(ids) && ids.length > 0) return String(ids[idx]) === String(userId);
  return !!name && (rotation?.pharmacist_names || [])[idx] === name;
}

// أسماء أعضاء المجموعة للعرض — بالـ id لو متاح (عشان لو اسم صيدلي اتغيّر يظهر الاسم الحالي)
export function rotationDisplayNames(rotation: any, users: any[]): string[] {
  const names: string[] = rotation?.pharmacist_names || [];
  const ids: any[] = rotation?.pharmacist_ids;
  if (!Array.isArray(ids) || ids.length !== names.length) return names;
  return ids.map((id, i) => (users || []).find((u) => String(u.id) === String(id))?.name || names[i]);
}


// 🆕 نسخة pure من getExpectedShift — بتاخد كل البيانات في ctx بدل الاعتماد على state المكوّن،
// عشان تتنادى من autoCloseOrphanLogs وغيرها قبل ما الـ state يتحمّل. الأولوية:
// ١) إجازة رسمية  ٢) تبديل دوري  ٣) جدول رمضان (حسب تاريخ السجل مش تاريخ اليوم)  ٤) الجدول العادي
export function resolveExpectedShift(
  ctx: { workSchedules: any[]; rotationSchedules: any[]; officialHolidays: any[] },
  pharmacistName: string,
  dow: number,
  shiftNumber: number,
  dateStr: string,
  pharmacistUserId?: string | null
) {
  const holiday = findHolidayForDate(ctx.officialHolidays, dateStr);
  if (holiday) {
    if (!holiday.is_worked) return null; // إجازة كاملة — مفيش دوام أصلاً
    if (shiftNumber !== 1) return null; // ساعات الإجازة بتتحسب كشفت واحد بس
    return {
      pharmacist_name: pharmacistName, day_of_week: dow, shift_number: 1,
      shift_start: holiday.work_hours_start, shift_end: holiday.work_hours_end,
      is_off: false, overtime_minutes: 0, is_holiday: true, holiday_name: holiday.name,
    };
  }

  const rotation = (ctx.rotationSchedules || []).find(
    (r) => r.active && r.day_of_week === dow && rotationHasPharmacist(r, pharmacistName, pharmacistUserId)
  );
  if (rotation) {
    if (shiftNumber !== 1) return null;
    if (!isRotationTurnOf(rotation, dateStr, pharmacistName, pharmacistUserId)) return null; // مش دوره — إجازة
    return {
      pharmacist_name: pharmacistName, day_of_week: dow, shift_number: 1,
      shift_start: rotation.shift_start, shift_end: rotation.shift_end,
      is_off: false, overtime_minutes: 0, is_rotation: true,
    };
  }

  const match = (ramadan: boolean) => (ctx.workSchedules || []).find(
    (s) => isSamePharmacist(s, pharmacistName, pharmacistUserId) && s.day_of_week === dow &&
      s.shift_number === shiftNumber && !s.is_off && !!s.is_ramadan === ramadan
  );
  if (isRamadan(dateStr)) {
    const r = match(true);
    if (r) return r;
  }
  return match(false) || null;
}



export function fmt(ts: string | null) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}



export function diffMin(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}



export function fmtHours(h: number) {
  if (!h && h !== 0) return "٠:٠٠";
  const hrs = Math.floor(Math.abs(h));
  const mins = Math.round((Math.abs(h) - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, "0")}`;
}



// 🆕 حساب ساعات العمل الفعلية مربوطة بجدول الدوام:
// القاعدة: أي حضور برا جدول الدوام المعتمد (مفيش شفت مطابق لليوم/الرقم، أو الحضور كله بعد
// نهاية الشفت + الأوفر تايم المعتمد) ميتحسبش ولا دقيقة — صفر ساعات، مش الوقت الفعلي كامل.
// لو الصيدلي داوم زيادة عن نهاية شفته المجدولة، الوقت الزايد ميتحسبش —
// إلا لو فيه دقائق أوفر تايم معتمدة مسبقاً على نفس الشفت (schedule.overtime_minutes)، تتحسب لحد سقفها بس.
// 🆕 نافذة الشفت المجدولة المرتبطة بلحظة حضور معيّنة (start / end / cappedEnd = النهاية + الأوفر تايم المعتمد).
// ليه؟ قبل كده الحساب كان بيبني بداية ونهاية الشفت من تاريخ الحضور التقويمي، فالشفت الليلي (مثلاً 20:00–02:00)
// لو الحضور/إعادة الفتح حصل بعد منتصف الليل (00:30) كانت النهاية بتطلع بكرة 02:00 والسقف بيتلغي والساعات الزايدة بتتحسب.
// الحل (نفس فلسفة calcLateMinutesAt): للشفت اللي بيعدي نص الليل، لو الحضور قبل بداية "النهارده" ووقع جوه نافذة
// الشفت اللي بدأ "امبارح" (لحد نهايته + الأوفر تايم) → النافذة تتبني على امبارح.
export function getScheduleWindow(checkInISO: string | Date, schedule: any): { start: Date; end: Date; cappedEnd: Date } | null {
  if (!schedule?.shift_start || !schedule?.shift_end) return null;
  const at = new Date(checkInISO);
  if (isNaN(at.getTime())) return null;
  const [startH, startM] = schedule.shift_start.split(":").map(Number);
  const [endH, endM] = schedule.shift_end.split(":").map(Number);
  if ([startH, startM, endH, endM].some((v) => isNaN(v))) return null;
  const crosses = endH * 60 + endM <= startH * 60 + startM;
  const overtimeMs = (+schedule.overtime_minutes || 0) * 60000;

  const build = (dayOffset: number) => {
    const start = new Date(at.getFullYear(), at.getMonth(), at.getDate() + dayOffset, startH, startM, 0, 0);
    const end = new Date(at.getFullYear(), at.getMonth(), at.getDate() + dayOffset + (crosses ? 1 : 0), endH, endM, 0, 0);
    return { start, end, cappedEnd: new Date(end.getTime() + overtimeMs) };
  };

  if (crosses) {
    const prev = build(-1);
    if (at.getTime() >= prev.start.getTime() && at.getTime() < prev.cappedEnd.getTime()) return prev;
  }
  return build(0);
}

export function calcCappedHours(checkInISO: string, checkOutISO: string, schedule: any) {
  const checkInDate = new Date(checkInISO);
  const actualCheckOut = new Date(checkOutISO);

  // ⛔ مفيش جدول دوام مطابق أصلاً لهذا اليوم/الشفت (زي فتح شفت إضافي بعد التقفيل الرسمي) →
  // الحضور خارج الدوام بالكامل ولا يُحتسب أي ساعات.
  const win = getScheduleWindow(checkInDate, schedule);
  if (!win) {
    return { totalHours: 0, capped: true, outsideSchedule: true };
  }
  const cappedEnd = win.cappedEnd;

  // ⛔ وقت الحضور نفسه وقع كله بعد نهاية الشفت + الأوفر تايم المسموح (يعني فتح خارج نطاق الدوام تمامًا) →
  // صفر ساعات، مش الوقت الفعلي.
  if (checkInDate >= cappedEnd) {
    return { totalHours: 0, capped: true, outsideSchedule: true };
  }

  const effectiveCheckOut = actualCheckOut > cappedEnd ? cappedEnd : actualCheckOut;
  const totalMinutes = Math.max(0, (effectiveCheckOut.getTime() - checkInDate.getTime()) / 60000);
  return { totalHours: totalMinutes / 60, capped: effectiveCheckOut < actualCheckOut, outsideSchedule: false };
}



export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
