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
export function isRamadan() {
  const now = new Date();
  const ranges = [
    { start: new Date("2025-03-01"), end: new Date("2025-03-30") },
    { start: new Date("2026-02-18"), end: new Date("2026-03-19") },
  ];
  return ranges.some((r) => now >= r.start && now <= r.end);
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
export function calcCappedHours(checkInISO: string, checkOutISO: string, schedule: any) {
  const checkInDate = new Date(checkInISO);
  const actualCheckOut = new Date(checkOutISO);

  // ⛔ مفيش جدول دوام مطابق أصلاً لهذا اليوم/الشفت (زي فتح شفت إضافي بعد التقفيل الرسمي) →
  // الحضور خارج الدوام بالكامل ولا يُحتسب أي ساعات.
  if (!schedule?.shift_start || !schedule?.shift_end) {
    return { totalHours: 0, capped: true, outsideSchedule: true };
  }

  const [startH, startM] = schedule.shift_start.split(":").map(Number);
  const scheduledStart = new Date(checkInDate);
  scheduledStart.setHours(startH, startM, 0, 0);

  const [endH, endM] = schedule.shift_end.split(":").map(Number);
  const scheduledEnd = new Date(checkInDate);
  scheduledEnd.setHours(endH, endM, 0, 0);
  // لو الشفت بيعدي نص الليل (النهاية أصغر من البداية رقمياً) نضيف يوم
  if (endH * 60 + endM <= startH * 60 + startM) scheduledEnd.setDate(scheduledEnd.getDate() + 1);

  const overtimeAllowed = +schedule.overtime_minutes || 0;
  const cappedEnd = new Date(scheduledEnd.getTime() + overtimeAllowed * 60000);

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
