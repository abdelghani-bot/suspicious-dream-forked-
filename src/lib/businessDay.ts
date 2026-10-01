// ═══════════════════════════════════════════════════════════════════════════
// lib/businessDay.ts — دوال اليوم التشغيلي (مرحلة 1: دوال نقية فقط، لسه مش مستخدمة في أي شاشة)
//
// مصدر "وقت بداية اليوم التشغيلي" بالترتيب:
//   1) الإعداد اليدوي  pharmacy_settings.business_day_start  ("HH:MM")
//   2) جدول الدوام     work_schedules: أقدم shift_start بين كل الصيادلة في نفس يوم الأسبوع
//                      (بيراعي رمضان، ويتجاهل صفوف is_off)
//   3) fallback        منتصف الليل (source = "calendar") — الداشبورد يعرض بانر تنبيه وقتها
//
// ملحوظة: الشفتات اللي بتعدّي منتصف الليل (end <= start) بتتحسب على إن نهايتها في اليوم التالي.
// ما تستخدمش calcWeeklyScheduledHours في أي حاجة هنا — بتقص الشفت الليلي لصفر ساعات.
// ═══════════════════════════════════════════════════════════════════════════
import { isRamadan, todayLocal } from "./dateUtils";

export type WorkScheduleRow = {
  pharmacist_name?: string;
  day_of_week: number; // 0 = الأحد … 6 = السبت (نفس getDay())
  shift_number?: number;
  shift_start?: string | null;
  shift_end?: string | null;
  is_off?: boolean;
  is_ramadan?: boolean;
};

export type DayStartSource = "manual" | "schedule" | "calendar";

export interface BusinessDayContext {
  /** pharmacy_settings.business_day_start — "HH:MM" أو فاضي */
  manualStart?: string | null;
  workSchedules?: WorkScheduleRow[] | null;
  /** لو متبعتش، بيستخدم isRamadan() */
  ramadanActive?: boolean;
}

/** "06:00" أو "06:00:00" (time من Postgres) → دقائق من منتصف الليل، أو null لو غلط */
export function parseHHMM(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** مدى الشفت بالدقائق؛ لو النهاية <= البداية يبقى شفت ليلي والنهاية بتتحسب في اليوم التالي (+1440) */
export function shiftRangeMinutes(start: unknown, end: unknown): { start: number; end: number } | null {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s == null || e == null) return null;
  return { start: s, end: e > s ? e : e + 1440 };
}

function rowsForDay(dow: number, ctx: BusinessDayContext): WorkScheduleRow[] {
  const rows = (ctx.workSchedules || []).filter((s) => s.day_of_week === dow && !s.is_off);
  const ramadan = ctx.ramadanActive ?? isRamadan();
  if (ramadan) {
    const r = rows.filter((s) => s.is_ramadan);
    if (r.length > 0) return r; // نفس منطق getExpectedShiftForSalary: رمضان أولًا، وإلا الجدول العادي
  }
  return rows.filter((s) => !s.is_ramadan);
}

/** هل فيه أي مصدر (يدوي أو جدول) نقدر نحسب منه؟ — لو false الداشبورد يعرض بانر "مفيش جدول" */
export function hasBusinessDayConfig(ctx: BusinessDayContext): boolean {
  if (parseHHMM(ctx.manualStart) != null) return true;
  return (ctx.workSchedules || []).some((s) => !s.is_off && shiftRangeMinutes(s.shift_start, s.shift_end) != null);
}

/** وقت بداية اليوم التشغيلي (بالدقائق) ليوم أسبوع معين + مصدره */
export function getDayStart(dow: number, ctx: BusinessDayContext): { minutes: number; source: DayStartSource } {
  const manual = parseHHMM(ctx.manualStart);
  if (manual != null) return { minutes: manual, source: "manual" };

  const starts = rowsForDay(dow, ctx)
    .map((s) => shiftRangeMinutes(s.shift_start, s.shift_end)?.start)
    .filter((v): v is number => v != null);
  if (starts.length > 0) return { minutes: Math.min(...starts), source: "schedule" };

  return { minutes: 0, source: "calendar" };
}

/** نهاية آخر شفت مجدول في يوم أسبوع (بالدقائق، ممكن تعدّي 1440 للشفت الليلي)، أو null لو مفيش جدول */
export function getScheduledDayEnd(dow: number, ctx: BusinessDayContext): number | null {
  const ends = rowsForDay(dow, ctx)
    .map((s) => shiftRangeMinutes(s.shift_start, s.shift_end)?.end)
    .filter((v): v is number => v != null);
  return ends.length > 0 ? Math.max(...ends) : null;
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** نهاية اليوم التشغيلي المجدولة (timestamp) ليوم تشغيلي "YYYY-MM-DD" — للبانر "اليوم لسه مقفلش" */
export function getScheduledDayEndTs(businessDate: string, ctx: BusinessDayContext): number | null {
  const d = ymdToLocalDate(businessDate);
  const end = getScheduledDayEnd(d.getDay(), ctx);
  if (end == null) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, end).getTime();
}

/**
 * لحظة بداية المنع: بداية اليوم التشغيلي التالي لـ businessDate
 * (التاريخ التقويمي التالي + وقت البداية بتاع يوم الأسبوع ده).
 */
export function getBlockStartTs(
  openBusinessDate: string,
  ctx: BusinessDayContext
): { ts: number; source: DayStartSource } {
  const next = ymdToLocalDate(openBusinessDate);
  next.setDate(next.getDate() + 1);
  const { minutes, source } = getDayStart(next.getDay(), ctx);
  return { ts: new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, minutes).getTime(), source };
}

/** هل لازم نمنع فتح شفت جديد لأن اليوم التشغيلي المفتوح عدّى بداية اليوم اللي بعده؟ */
export function shouldBlockNewShift(
  now: Date,
  openBusinessDate: string,
  ctx: BusinessDayContext
): { block: boolean; blockStartTs: number; source: DayStartSource } {
  const { ts, source } = getBlockStartTs(openBusinessDate, ctx);
  return { block: now.getTime() >= ts, blockStartTs: ts, source };
}

// ═══════════════════════════ مرحلة 2: ختم الشفت بتاريخ اليوم التشغيلي ═══════════════════════════

/**
 * سماح الفتح المبكر: الصيدلي اللي بيفتح شفته قبل بداية اليوم بدقايق (مثلًا 05:50 واليوم بيبدأ 06:00)
 * يتحسب على اليوم الجديد مش اليوم السابق. القيمة دي افتراضية وقابلة للتغيير.
 */
export const EARLY_OPEN_TOLERANCE_MINUTES = 30;

type ShiftLike = { start_time?: string | null; business_date?: string | null; user?: string | null };

/** تاريخ اليوم التشغيلي لشفت: business_date لو موجود، وإلا التاريخ التقويمي لبداية الشفت (الشفتات القديمة) */
export function shiftBusinessDate(shift: ShiftLike): string | null {
  if (shift.business_date) return String(shift.business_date).slice(0, 10);
  if (!shift.start_time) return null;
  const d = new Date(shift.start_time);
  return isNaN(d.getTime()) ? null : todayLocal(d);
}

/** أحدث شفت (بأكبر start_time) بين كل شفتات الصيدلية، أيًا كان صاحبه */
export function latestShift<T extends ShiftLike>(shifts: T[] | null | undefined): T | null {
  let best: T | null = null;
  let bestTs = -Infinity;
  for (const s of shifts || []) {
    const t = s.start_time ? new Date(s.start_time).getTime() : NaN;
    if (!isNaN(t) && t > bestTs) { best = s; bestTs = t; }
  }
  return best;
}

/**
 * تاريخ اليوم التشغيلي اللي الشفت الجديد المفروض يتختم بيه وقت فتحه.
 *
 *  1) نافذة الفتح المبكر  [بداية اليوم الجديد − السماح , بداية اليوم الجديد):
 *     الحكم بالاسم — لو اللي بيفتح هو صاحب آخر شفت في اليوم السابق (المساعد الليلي اللي بيسجل فواتير بعد التقفيل)
 *     يفضل على اليوم السابق، وأي حد تاني (الصباحي اللي جه بدري) يبدأ اليوم الجديد.
 *  2) قبل النافذة → كل الناس على آخر يوم تشغيلي (سواء لسه مفتوح أو اتقفل — مسار "تسوية بعد التقفيل" الحالي).
 *  3) من بداية اليوم الجديد وبعده → يوم جديد بتاريخ النهارده التقويمي للكل.
 *
 * مرحلة 2 مابتمنعش حاجة: لو اليوم السابق لسه مقفلش وعدّى وقت اليوم الجديد، بيبدأ يوم جديد زي الوضع الحالي
 * (المنع مرحلة 4). بدون إعداد ولا جدول → الحد هو منتصف الليل، يعني نفس السلوك الحالي بالظبط.
 *
 * حد معروف: الحكم بالاسم بيعتمد على صاحب "آخر" شفت في اليوم السابق بس؛ لو فيه أكتر من مساعد ليلي
 * والتاني هو اللي بيفتح بعد التقفيل، هيتحسب يوم جديد (ممكن نوسّعها بجدول الدوام لاحقًا).
 */
export function resolveNewShiftBusinessDate(args: {
  now: Date;
  shifts: ShiftLike[] | null | undefined;
  ctx: BusinessDayContext;
  /** اسم اللي بيفتح الشفت (نفس قيمة shift.user) — بيتستخدم في نافذة الفتح المبكر بس */
  openerName?: string | null;
  toleranceMinutes?: number;
}): { businessDate: string; previousBusinessDate: string | null; continuesPrevious: boolean } {
  const { now, shifts, ctx, openerName } = args;
  const tol = args.toleranceMinutes ?? EARLY_OPEN_TOLERANCE_MINUTES;
  const t = now.getTime();
  const calendarToday = todayLocal(now);

  // (1) نافذة الفتح المبكر بالنسبة لآخر يوم تشغيلي سابق لتاريخ النهارده
  const prev = latestShift((shifts || []).filter((s) => {
    const bd = shiftBusinessDate(s);
    return !!bd && bd < calendarToday;
  }));
  const prevBd = prev ? shiftBusinessDate(prev) : null;
  if (prev && prevBd) {
    const { ts } = getBlockStartTs(prevBd, ctx);
    if (t >= ts - tol * 60000 && t < ts) {
      const sameOpener = !!openerName && !!prev.user && prev.user === openerName;
      return sameOpener
        ? { businessDate: prevBd, previousBusinessDate: prevBd, continuesPrevious: true }
        : { businessDate: calendarToday, previousBusinessDate: prevBd, continuesPrevious: false };
    }
  }

  // (2) و (3) على أساس آخر شفت
  const last = latestShift(shifts);
  const lastBd = last ? shiftBusinessDate(last) : null;
  if (!lastBd) return { businessDate: calendarToday, previousBusinessDate: null, continuesPrevious: false };

  const { ts } = getBlockStartTs(lastBd, ctx);
  if (t < ts - tol * 60000) {
    return { businessDate: lastBd, previousBusinessDate: lastBd, continuesPrevious: true };
  }
  return { businessDate: calendarToday, previousBusinessDate: lastBd, continuesPrevious: false };
}

// ═══════════════════════════ مرحلة 3: اليوم التشغيلي الحالي (للداشبورد) ═══════════════════════════

/**
 * اليوم التشغيلي الحالي = business_date لآخر شفت اتفتح، وبدايته = أقدم start_time لشفت من نفس اليوم.
 * مفيش تصفير عند التقفيل ولا عند منتصف الليل — اليوم بيتغير بس لما شفت جديد يتختم بتاريخ جديد.
 * بيعتمد على الشفتات المختومة بـ business_date بس (من مرحلة 2) — الشفتات القديمة من غير ختم بتتجاهل،
 * عشان الداشبورد والخزنة يفضلوا على التاريخ التقويمي (نفس السلوك القديم) لحد أول شفت مختوم.
 * fallback (منتصف الليل التقويمي) لو مفيش شفتات مختومة، أو آخر يوم تشغيلي أقدم من امبارح (الصيدلية كانت مقفولة).
 */
export function getCurrentOperationalDay(args: {
  now: Date;
  shifts: ShiftLike[] | null | undefined;
}): { date: string; startTs: number; fromShifts: boolean } {
  const { now, shifts } = args;
  const calendarToday = todayLocal(now);
  const midnightTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const fallback = { date: calendarToday, startTs: midnightTs, fromShifts: false };

  const stamped = (shifts || []).filter((sh) => sh && sh.business_date);
  const last = latestShift(stamped);
  const lastBd = last ? shiftBusinessDate(last) : null;
  if (!lastBd) return fallback;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastBd < todayLocal(yesterday)) return fallback;

  const starts = stamped
    .filter((sh) => shiftBusinessDate(sh) === lastBd && sh.start_time)
    .map((sh) => new Date(sh.start_time as string).getTime())
    .filter((t) => !isNaN(t));
  const startTs = starts.length > 0 ? Math.min(...starts) : ymdToLocalDate(lastBd).getTime();
  return { date: lastBd, startTs, fromShifts: true };
}

// ═══════════════════════════ مرحلة 4: نسب أي حركة ليومها التشغيلي (للخزنة) ═══════════════════════════

/** أنواع قيود خزنة تاريخها (date) بيتحدد صراحةً وقت الإنشاء (تقفيل/تسوية/تجاهل/رصيد افتتاحي) — بنثق فيه زي ما هو */
const OWN_DATE_SUBTYPES = new Set(["daily_closing", "closing_adjustment", "diagnostics_dismissed", "opening_balance"]);

type RecLike = { date?: string | null; created_at?: string | null; sub_type?: string | null; shift?: string | null };
type ShiftWithId = ShiftLike & { id?: string | number | null };

/**
 * بيرجّع دالة (record) => تاريخ اليوم التشغيلي اللي الحركة تبعه. بتتبنى مرة واحدة لكل تحديث في الشفتات (بحث ثنائي).
 *  - بتشتغل بس على الشفتات المختومة بـ business_date (من مرحلة 2). قبل أول شفت مختوم، أو لو مفيش → record.date زي ما هو (صفر تغيير).
 *  - فاتورة عليها shift معروف → business_date بتاع الشفت ده مباشرة (أدق، وبيحل تداخل الشفتات وقت التسليم).
 *  - غير كده → آخر شفت مختوم بدأ قبل created_at.
 *  - لو record.date مختلف عن التاريخ التقويمي لـ created_at (حركة مؤرخة صراحةً: تقفيل بأثر رجعي، إلخ) → بنثق في record.date.
 *  - لو created_at بعد يوم تقويمي كامل من اليوم التشغيلي لآخر شفت → record.date (الصيدلية كانت مقفولة، مفيش يوم ممتد).
 * تاريخ الفاتورة المخزّن (ZATCA) ما بيتغيرش — ده عرض وتجميع بس.
 */
export function makeRecordDateResolver(shifts: ShiftWithId[] | null | undefined): (rec: RecLike | null | undefined) => string | null {
  const stamped = (shifts || [])
    .filter((s) => s && s.business_date && s.start_time)
    .map((s) => ({ id: s.id != null ? String(s.id) : null, t: new Date(s.start_time as string).getTime(), bd: String(s.business_date).slice(0, 10) }))
    .filter((x) => !isNaN(x.t))
    .sort((a, b) => a.t - b.t);
  const byId = new Map<string, string>();
  for (const x of stamped) if (x.id) byId.set(x.id, x.bd);

  return (rec) => {
    const own = rec?.date ? String(rec.date).slice(0, 10) : null;
    if (!rec || stamped.length === 0) return own;
    if (rec.sub_type && OWN_DATE_SUBTYPES.has(rec.sub_type)) return own;

    if (rec.shift != null) {
      const bd = byId.get(String(rec.shift));
      if (bd) return bd;
    }
    if (!rec.created_at) return own;
    const ts = new Date(rec.created_at).getTime();
    if (isNaN(ts)) return own;
    const createdCal = todayLocal(new Date(ts));
    if (own && own !== createdCal) return own;

    let lo = 0, hi = stamped.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (stamped[mid].t <= ts) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (idx < 0) return own;
    const bd = stamped[idx].bd;
    const limit = ymdToLocalDate(bd);
    limit.setDate(limit.getDate() + 1);
    if (createdCal > todayLocal(limit)) return own;
    return bd;
  };
}

// ═══════════════════════════ مرحلة 5: منع فتح شفت يوم جديد واليوم السابق لسه مقفلش ═══════════════════════════

/**
 * هل فتح الشفت ده هيبدأ يوم تشغيلي جديد واليوم السابق ما عليهوش daily_closing؟
 *  - بيعتمد على resolveNewShiftBusinessDate، فبيحترم نافذة الفتح المبكر ومسار "المساعد الليلي بعد التقفيل" (continuesPrevious) — دول مش بيتمنعوا.
 *  - closedDates: تواريخ قيود daily_closing ("YYYY-MM-DD").
 *  - ما بيمنعش لو اليوم السابق مالوش أي شفت مختوم بـ business_date (عشان التفعيل يبدأ من أول شفت مختوم، زي الداشبورد والخزنة).
 *  - ما بيمنعش لو مفيش إعداد ولا جدول دوام (الحد هيبقى منتصف الليل)، إلا لو blockWithoutConfig = true.
 */
export function checkNewShiftBlock(args: {
  now: Date;
  shifts: ShiftLike[] | null | undefined;
  ctx: BusinessDayContext;
  openerName?: string | null;
  closedDates: Set<string>;
  blockWithoutConfig?: boolean;
}): { block: boolean; unclosedDate: string | null; newBusinessDate: string; source: DayStartSource } {
  const { now, shifts, ctx, openerName, closedDates } = args;
  const r = resolveNewShiftBusinessDate({ now, shifts, ctx, openerName });
  const prev = r.previousBusinessDate;
  const noBlock = { block: false, unclosedDate: null as string | null, newBusinessDate: r.businessDate, source: "calendar" as DayStartSource };
  if (!prev || r.continuesPrevious) return noBlock;

  const { source } = getBlockStartTs(prev, ctx);
  const res = { ...noBlock, source };
  if (source === "calendar" && !args.blockWithoutConfig) return res;

  const prevStamped = (shifts || []).some((s) => s && s.business_date && shiftBusinessDate(s) === prev);
  if (!prevStamped) return res;
  if (closedDates.has(prev)) return res;
  return { ...res, block: true, unclosedDate: prev };
}
