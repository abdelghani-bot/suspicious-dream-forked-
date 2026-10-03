// lib/attendanceCalc.ts
// ═══════════════════════════════════════════════════════════════════════════
// 🆕 حسابات الحضور النقية (من غير React ولا state): رقم الشفت المتوقع والتأخير عند وقت حضور معيّن.
// ليه الملف ده؟ سجل الحضور اللي بيتعمل تلقائيًا عند فتح الشفت كان بيتسجل من غير shift_number / expected_start / late_minutes،
// فالتأخير في التقرير الشهري كان بيطلع 0 والساعات بتتحسب على جدول الشفت 1 دايمًا. معالج ATTENDANCE_CHECKIN في offlineAPI.ts
// بيستخدم الدوال دي وقت المزامنة (نفس فلسفة ATTENDANCE_CHECKOUT).
// المنطق منسوخ بالحرف من AttendanceModule (getCurrentShiftNumber / calcLateMinutes) مع تمرير الوقت والجداول كمعاملات.
// ═══════════════════════════════════════════════════════════════════════════
import { resolveExpectedShift, todayLocal } from "./dateUtils";

export type ScheduleCtx = { workSchedules: any[]; rotationSchedules: any[]; officialHolidays: any[] };

const expectedShift = (ctx: ScheduleCtx, name: string, userId: string | null, dow: number, shiftNum: number, dateStr: string) =>
    resolveExpectedShift(ctx, name, dow, shiftNum, dateStr, userId);

const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
};

// رقم الشفت المتوقع لحظة الحضور: الشفت اللي الوقت جواه، وإلا أقرب شفت (نفس ترتيب AttendanceModule)
// 🆕 بيراعي كمان شفت امبارح الليلي (اللي بيعدي منتصف الليل): حضور/إعادة فتح 00:30 على شفت 20:00–02:00 بتاع امبارح
// كان بيتجاهله ويدوّر في جدول النهارده بس. dayOffset = -1 معناها إن الشفت المختار جدول امبارح.
function pickShiftAt(ctx: ScheduleCtx, name: string, userId: string | null, at: Date): { n: number; dayOffset: 0 | -1 } {
    const nowMin = at.getHours() * 60 + at.getMinutes();
    const build = (base: Date, dayOffset: 0 | -1) =>
        [1, 2]
            .map((n) => expectedShift(ctx, name, userId, base.getDay(), n, todayLocal(base)))
            .filter((s: any) => s?.shift_start && s?.shift_end)
            .map((s: any) => {
                const start = toMin(s.shift_start);
                let end = toMin(s.shift_end);
                const crosses = end <= start;
                if (crosses) end += 1440; // شفت بيعدي نص الليل
                const shift = dayOffset === -1 ? 1440 : 0;
                return {
                    n: s.shift_number as number, dayOffset, crosses,
                    start: start - shift, end: end - shift,
                    // امبارح: نافذة الاعتماد تمتد بالأوفر تايم المعتمد (زي calcLateMinutesAt)
                    endIncl: end - shift + (dayOffset === -1 ? (+s.overtime_minutes || 0) : 0),
                };
            });

    const yesterday = new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1);
    const prevCands = build(yesterday, -1).filter((c) => c.crosses); // اللي بيعدّي منتصف الليل بس
    const todayCands = build(at, 0);

    // الحضور جوه شفت امبارح الليلي → ده الشفت
    const prevInside = prevCands.filter((c) => nowMin >= c.start && nowMin < c.endIncl);
    const todayInside = todayCands.filter((c) => nowMin >= c.start && nowMin < c.end);
    if (prevInside.length > 0 && todayInside.length === 0) {
        return { n: prevInside.sort((x, y) => x.n - y.n)[0].n, dayOffset: -1 };
    }

    const candidates = todayCands;
    if (candidates.length === 0) return { n: 1, dayOffset: 0 };
    if (todayInside.length > 0) return { n: todayInside.sort((x, y) => x.n - y.n)[0].n, dayOffset: 0 };

    const dist = (c: { start: number; end: number }) => (nowMin < c.start ? c.start - nowMin : nowMin - c.end);
    return { n: candidates.sort((x, y) => dist(x) - dist(y) || x.n - y.n)[0].n, dayOffset: 0 };
}

export function pickShiftNumberAt(ctx: ScheduleCtx, name: string, userId: string | null, at: Date): number {
    return pickShiftAt(ctx, name, userId, at).n;
}

// دقايق التأخير بعد فترة السماح، ومراعاة الشفت الليلي اللي بدأ امبارح وعدّى منتصف الليل
export function calcLateMinutesAt(ctx: ScheduleCtx, name: string, userId: string | null, shiftNum: number, at: Date): number {
    const build = (base: Date) => {
        const sch: any = expectedShift(ctx, name, userId, base.getDay(), shiftNum, todayLocal(base));
        if (!sch?.shift_start || !sch?.shift_end) return null;
        const [sH, sM] = sch.shift_start.split(":").map(Number);
        const [eH, eM] = sch.shift_end.split(":").map(Number);
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), sH, sM, 0, 0);
        const crosses = eH * 60 + eM <= sH * 60 + sM;
        const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (crosses ? 1 : 0), eH, eM, 0, 0);
        return { sch, start, end, crosses };
    };
    const prev = build(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1));
    let picked = null as ReturnType<typeof build>;
    if (
        prev && prev.crosses &&
        at.getTime() >= prev.start.getTime() &&
        at.getTime() < prev.end.getTime() + (+prev.sch.overtime_minutes || 0) * 60000
    ) {
        picked = prev;
    }
    if (!picked) picked = build(new Date(at.getFullYear(), at.getMonth(), at.getDate()));
    if (!picked) return 0;
    const diff = Math.round((at.getTime() - picked.start.getTime()) / 60000);
    const grace = +picked.sch.grace_minutes || 0;
    return Math.max(0, diff - grace);
}

// تجميع: الحقول اللي ناقصة في سجل الحضور التلقائي
export function computeCheckInFields(
    ctx: ScheduleCtx, name: string, userId: string | null, at: Date
): { shift_number: number; expected_start: string | null; late_minutes: number } {
    const picked = pickShiftAt(ctx, name, userId, at);
    const shift_number = picked.n;
    // 🆕 لو الشفت المختار شفت امبارح الليلي، بداية الشفت المتوقعة من جدول امبارح
    const baseDay = picked.dayOffset === -1 ? new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1) : at;
    const sch: any = expectedShift(ctx, name, userId, baseDay.getDay(), shift_number, todayLocal(baseDay));
    return {
        shift_number,
        expected_start: sch?.shift_start || null,
        late_minutes: calcLateMinutesAt(ctx, name, userId, shift_number, at),
    };
}

// 🆕 نهاية الدوام المجدولة (timestamp) للشفت اللي بدأ في اليوم التشغيلي businessDate.
// بتراعي التناوب والإجازات الرسمية (resolveExpectedShift) والشفت الليلي (النهاية +1 يوم).
// بتختار الشفت (1 أو 2) اللي وقت بداية الشفت الفعلي جواه أو الأقرب ليه. لو مفيش جدول → null.
export function getScheduledShiftEndTs(
    ctx: ScheduleCtx, name: string, userId: string | null, businessDate: string, shiftStart?: Date | null
): number | null {
    const [y, m, d] = businessDate.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    const base = new Date(y, m - 1, d);
    const cands = [1, 2]
        .map((num) => {
            const sch: any = expectedShift(ctx, name, userId, base.getDay(), num, businessDate.slice(0, 10));
            if (!sch?.shift_start || !sch?.shift_end) return null;
            const [sH, sM] = sch.shift_start.split(":").map(Number);
            const [eH, eM] = sch.shift_end.split(":").map(Number);
            const crosses = eH * 60 + eM <= sH * 60 + sM;
            return {
                start: new Date(y, m - 1, d, sH, sM, 0, 0).getTime(),
                end: new Date(y, m - 1, d + (crosses ? 1 : 0), eH, eM, 0, 0).getTime(),
            };
        })
        .filter(Boolean) as { start: number; end: number }[];
    if (cands.length === 0) return null;
    if (cands.length === 1 || !shiftStart || isNaN(shiftStart.getTime())) return cands[0].end;
    const t = shiftStart.getTime();
    const inside = cands.filter((c) => t >= c.start && t < c.end);
    if (inside.length > 0) return inside.sort((a, b) => a.start - b.start)[0].end;
    const dist = (c: { start: number; end: number }) => (t < c.start ? c.start - t : t - c.end);
    return cands.sort((a, b) => dist(a) - dist(b))[0].end;
}
