// lib/useBusinessDayContext.ts — بيحمّل سياق اليوم التشغيلي (إعداد الصيدلية + جدول الدوام) مرة عند فتح الشاشة.
// أوفلاين: الإعدادات من getPharmacySettings (كاشها)، وجدول الدوام من نسخة localStorage (نفس مفتاح ShiftModule).
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { getPharmacySettings } from "./offlineAPI";
import type { BusinessDayContext } from "./businessDay";

// 🆕 جدول من Supabase مع نسخة localStorage للأوفلاين — مصدر واحد (ShiftModule كان عنده نسخة مكررة)
// الأوفلاين: كاش SQLite أولًا (نفس مصدر موديول الحضور — اللي بيتحدّث لما الجدول يتعدّل أوفلاين)، وبعده نسخة localStorage.
// قبل كده الشاشات دي كانت بتقرا localStorage بس (آخر نسخة أونلاين) فتعديل جدول أوفلاين مايوصلش لمنع البيع/الشفت.
const SQLITE_SCHEDULE_GETTERS: Record<string, string> = {
    work_schedules: "getWorkSchedulesCache",
    rotation_schedules: "getRotationSchedulesCache",
    official_holidays: "getHolidaysCache",
};
export async function loadScheduleTable(table: string, pharmacyId: string): Promise<any[]> {
    const key = `${table}_cache_${pharmacyId}`;
    try {
        if (!navigator.onLine) throw new Error("offline");
        const { data, error } = await supabase.from(table).select("*").eq("pharmacy_id", pharmacyId);
        if (!error && Array.isArray(data)) {
            try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
            return data;
        }
        throw error || new Error("no data");
    } catch {
        const getter = SQLITE_SCHEDULE_GETTERS[table];
        try {
            const fn = getter ? (window as any).offlineAPI?.[getter] : null;
            if (fn) {
                const cached = await fn(pharmacyId);
                if (Array.isArray(cached) && cached.length > 0) return cached;
            }
        } catch (err) { console.error(`${getter} failed:`, err); }
        try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
    }
}

// الجداول التلاتة (عادي + تناوب + إجازات رسمية) مع بعض
export async function loadScheduleTables(pharmacyId: string): Promise<{ workSchedules: any[]; rotationSchedules: any[]; officialHolidays: any[] }> {
    const [workSchedules, rotationSchedules, officialHolidays] = await Promise.all([
        loadScheduleTable("work_schedules", pharmacyId), loadScheduleTable("rotation_schedules", pharmacyId), loadScheduleTable("official_holidays", pharmacyId),
    ]);
    return { workSchedules, rotationSchedules, officialHolidays };
}

export function useBusinessDayContext(pharmacyId: string | null | undefined): { ctx: BusinessDayContext; loaded: boolean } {
    const [state, setState] = useState<{ ctx: BusinessDayContext; loaded: boolean }>({
        ctx: { manualStart: null, workSchedules: [], rotationSchedules: [], officialHolidays: [] },
        loaded: false,
    });
    useEffect(() => {
        if (!pharmacyId) return;
        let cancelled = false;
        (async () => {
            let manualStart: string | null = null;
            let workSchedules: any[] = [];
            try {
                const { data } = await getPharmacySettings(pharmacyId);
                manualStart = data?.business_day_start || null;
            } catch (err) {
                console.error("business day settings load failed:", err);
            }
            const sched = await loadScheduleTables(pharmacyId);
            workSchedules = sched.workSchedules;
            if (!cancelled) setState({ ctx: { manualStart, workSchedules, rotationSchedules: sched.rotationSchedules, officialHolidays: sched.officialHolidays }, loaded: true });
        })();
        return () => { cancelled = true; };
    }, [pharmacyId]);
    return state;
}
