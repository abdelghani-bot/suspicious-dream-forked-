import { shiftBusinessDate, getBlockStartTs, hasBusinessDayConfig } from "./businessDay";
import type { BusinessDayContext } from "./businessDay";

export interface SalesBlockResult {
    blocked: boolean;
    reason: string | null;
}

/**
 * هل البيع ممنوع دلوقتي؟
 *  1) مفيش شفت مفتوح، أو الشفت اتقفل  → ممنوع
 *  2) الشفت لسه مفتوح وعدّى بداية اليوم التشغيلي التالي لـ business_date بتاعه → ممنوع
 *     (لازم يتقفل الشفت/اليوم قبل بداية اليوم التالي)
 * لو مفيش إعداد لليوم التشغيلي (لا بداية يدوية ولا جدول دوام) الفحص الزمني بيتعطل
 * عشان منمنعش البيع عند منتصف الليل في صيدليات مفعّلتش الميزة.
 */
export function getSalesBlock(args: {
    now: Date;
    shift: { end_time?: string | null; start_time?: string | null; business_date?: string | null } | null | undefined;
    ctx: BusinessDayContext;
    ctxLoaded?: boolean;
}): SalesBlockResult {
    const { now, shift, ctx, ctxLoaded = true } = args;
    if (!shift) return { blocked: true, reason: "يرجى فتح شفت أولاً" };
    if (shift.end_time) return { blocked: true, reason: "الشفت مقفول — افتح شفت جديد أو أعد فتحه" };

    if (!ctxLoaded || !hasBusinessDayConfig(ctx)) return { blocked: false, reason: null };

    const bd = shiftBusinessDate(shift);
    if (!bd) return { blocked: false, reason: null };

    const { ts } = getBlockStartTs(bd, ctx);
    if (now.getTime() >= ts) {
        return {
            blocked: true,
            reason: "بدأ اليوم التشغيلي التالي — البيع ممنوع. اقفل الشفت واليوم ثم افتح شفت جديد.",
        };
    }
    return { blocked: false, reason: null };
}
