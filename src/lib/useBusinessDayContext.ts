// lib/useBusinessDayContext.ts — بيحمّل سياق اليوم التشغيلي (إعداد الصيدلية + جدول الدوام) مرة عند فتح الشاشة.
// أوفلاين: الإعدادات من getPharmacySettings (كاشها)، وجدول الدوام من نسخة localStorage (نفس مفتاح ShiftModule).
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { getPharmacySettings } from "./offlineAPI";
import type { BusinessDayContext } from "./businessDay";

export function useBusinessDayContext(pharmacyId: string | null | undefined): { ctx: BusinessDayContext; loaded: boolean } {
    const [state, setState] = useState<{ ctx: BusinessDayContext; loaded: boolean }>({
        ctx: { manualStart: null, workSchedules: [] },
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
            const wsKey = `work_schedules_cache_${pharmacyId}`;
            try {
                const { data, error } = await supabase.from("work_schedules").select("*").eq("pharmacy_id", pharmacyId);
                if (!error && Array.isArray(data)) {
                    workSchedules = data;
                    try { localStorage.setItem(wsKey, JSON.stringify(data)); } catch { /* ignore */ }
                } else {
                    throw error || new Error("no data");
                }
            } catch {
                try { workSchedules = JSON.parse(localStorage.getItem(wsKey) || "[]"); } catch { workSchedules = []; }
            }
            if (!cancelled) setState({ ctx: { manualStart, workSchedules }, loaded: true });
        })();
        return () => { cancelled = true; };
    }, [pharmacyId]);
    return state;
}
