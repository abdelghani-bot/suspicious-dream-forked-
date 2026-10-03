import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { queueEvent, insertTreasuryEntry, getPharmacySettings } from "../lib/offlineAPI";
import { resolveNewShiftBusinessDate, checkNewShiftBlock, getBlockStartTs, hasBusinessDayConfig } from "../lib/businessDay";
import { loadScheduleTables } from "../lib/useBusinessDayContext";
import { getScheduledShiftEndTs } from "../lib/attendanceCalc";
import { COLORS, tint } from "../theme";
import { calcCappedHours, todayLocal } from "../lib/dateUtils";
import { Badge, Btn, Input, Pagination, Table } from "../ui/primitives";
import { splitSaleByMethod } from "../lib/treasuryUtils";
import { computeShiftClosing, printShiftClosing } from "../lib/shiftClosingPrint";

// ==================== SHIFT MODULE ====================
export const SHIFT_CASH_DIFF_REASON_THRESHOLD = 20;
// 🆕 المدة اللي الصيدلي يقدر فيها يعيد فتح شفته بعد التقفيل (المدير مالوش حد زمني)
export const SHIFT_REOPEN_WINDOW_MIN = 30;

// تطبيع "آجل" بكل صيغ الهمزة (نفس منطق الداشبورد والخزنة)
const isCreditSale = (s: any) => String(s?.payment ?? "").replace(/[أإآ]/g, "ا").trim() === "اجل";

export function ShiftModule({ shifts, setShifts, sales, currentUser, showToast, pharmacyId, invoices, returns = [], entries = [], setEntries, creditPayments = [] }: any) {
    const [openCash, setOpenCashRaw] = useState("500");
    // 🆕 لو الصيدلي عدّل النقد الافتتاحي بإيده مانرحّلش القيمة التلقائية فوقه
    const [openCashEdited, setOpenCashEdited] = useState(false);
    const setOpenCash = (v: any) => { setOpenCashEdited(true); setOpenCashRaw(v); };

    // 🆕 طباعة تقفيل الشفت من هنا مباشرة (الصيدلي مش محتاج صلاحية الخزنة). بيانات الصيدلية/الطابعات نفس مصدر الخزنة.
    const [pharmInfo, setPharmInfo] = useState<any>({ name: "", address: "", taxNumber: "", reportsPrinterName: "", thermalPrinterName: "", receiptPaperWidth: "" });
    const [justClosed, setJustClosed] = useState<any>(null); // آخر شفت اتقفل في الجلسة دي (لزرار الطباعة بعد التقفيل)
    // 🆕 المدة المسموحة لإعادة فتح الشفت (بالدقايق) — بتتحمّل من إعدادات الصيدلية، والمدير بس هو اللي يغيّرها (كارت فوق)
    const [reopenWindowMin, setReopenWindowMin] = useState<number>(SHIFT_REOPEN_WINDOW_MIN);
    const [reopenWindowDraft, setReopenWindowDraft] = useState<string>(String(SHIFT_REOPEN_WINDOW_MIN));
    const [settingsRaw, setSettingsRaw] = useState<any>(null); // نسخة الإعدادات (عشان نحدّث الكاش المحلي من غير ما نمسح باقي القيم)
    useEffect(() => {
        if (!pharmacyId) return;
        const apply = (d: any) => d && setPharmInfo({
            name: d.name_ar || "", address: d.address || "", taxNumber: d.tax_number || "",
            reportsPrinterName: d.reports_printer_name || "", thermalPrinterName: d.thermal_printer_name || "",
            receiptPaperWidth: String(d.receipt_paper_width || ""),
        });
        supabase.from("pharmacy_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle()
            .then(({ data, error }) => {
                if (data) apply(data);
                else if (error && window.offlineAPI?.getPharmacySettingsCache) {
                    window.offlineAPI.getPharmacySettingsCache(pharmacyId).then(apply).catch(() => { });
                }
            });
    }, [pharmacyId]);
    // الحساب بيتعمل لحظة الطباعة من أحدث بيانات (مبيعات/مرتجعات/سداد آجل) — نفس دالة تقرير الخزنة عشان الأرقام تتطابق
    const printShiftReport = (shiftObj: any, mode: "a4" | "receipt" = "a4") => {
        const report = computeShiftClosing({ shift: shiftObj, sales, creditPayments, returns, allShifts: shifts });
        printShiftClosing(report, pharmInfo, mode);
    };
    const [closeCash, setCloseCash] = useState("");
    const [notes, setNotes] = useState("");
    const [shiftDiffReason, setShiftDiffReason] = useState("");
    const [expandedVarianceEmployee, setExpandedVarianceEmployee] = useState(null);
    const isAdmin = currentUser?.role === "admin";
    const [overrideReason, setOverrideReason] = useState(""); // 🆕 سبب تجاوز المنع (مدير فقط)
    const [forceCloseTarget, setForceCloseTarget] = useState<any>(null);
    const [forceCloseCash, setForceCloseCash] = useState("");
    const [forceCloseNotes, setForceCloseNotes] = useState("");
    const [forceClosing, setForceClosing] = useState(false);
    const SHIFTS_PAGE_SIZE = 25;
    const [shiftsPage, setShiftsPage] = useState(1);

    // 🆕 تحميل الشفتات من الكاش المحلي (SQLite) عند فتح الشاشة — fallback لو مفيش نت
    // أو لو التطبيق فاتح أوفلاين من البداية. ده مكمل لأي تحميل من Supabase بيحصل في App.tsx،
    // مش بديل عنه: لو shifts وصلت من فوق بالفعل (أونلاين)، بنسيبها زي ما هي.
    useEffect(() => {
        if (!window.offlineAPI?.getShiftsCache || !pharmacyId) return;
        if (shifts && shifts.length > 0) return; // عندنا بيانات بالفعل (جاية من Supabase أو من فوق)
        (async () => {
            try {
                const cached = await window.offlineAPI.getShiftsCache({ pharmacyId, limit: 500 });
                if (cached && cached.length > 0) {
                    setShifts(cached.map((s: any) => ({ ...s, user: s.user_name })));
                }
            } catch (err) {
                console.error("failed to load shifts_cache:", err);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pharmacyId]);

    // 🆕 سياق اليوم التشغيلي (إعداد الصيدلية + جدول الدوام) — بيتحمّل مرة عند فتح الشاشة.
    // أوفلاين: الإعدادات من getPharmacySettings (كاشها)، وجدول الدوام من نسخة localStorage.
    // لو مفيش ولا واحد منهم، الحد بيبقى منتصف الليل (نفس السلوك الحالي).
    const [bdCtx, setBdCtx] = useState<any>({ manualStart: null, workSchedules: [], rotationSchedules: [], officialHolidays: [] });
    useEffect(() => {
        if (!pharmacyId) return;
        let cancelled = false;
        (async () => {
            let manualStart: string | null = null;
            let workSchedules: any[] = [];
            try {
                const { data } = await getPharmacySettings(pharmacyId);
                manualStart = data?.business_day_start || null;
                // 🆕 مدة إعادة فتح الشفت من الإعدادات (لو العمود مش موجود أو فاضي بنفضل على الافتراضي 30)
                if (!cancelled) {
                    setSettingsRaw(data || null);
                    if (data?.shift_reopen_window_minutes != null) {
                        setReopenWindowMin(+data.shift_reopen_window_minutes);
                        setReopenWindowDraft(String(+data.shift_reopen_window_minutes));
                    }
                }
            } catch (err) {
                console.error("business day settings load failed:", err);
            }
            // 🆕 جداول الدوام (عادي + تناوب + إجازات رسمية) — نفس المحمّل المشترك بتاع useBusinessDayContext
            const sched = await loadScheduleTables(pharmacyId);
            workSchedules = sched.workSchedules;
            if (!cancelled) setBdCtx({ manualStart, workSchedules, rotationSchedules: sched.rotationSchedules, officialHolidays: sched.officialHolidays });
        })();
        return () => { cancelled = true; };
    }, [pharmacyId]);

    // 🆕 bdCtx بقى فيه الجداول الثلاثة (عادي + تناوب + إجازات) — بنستخدمه لحساب نهاية دوام الشفت عند إعادة الفتح
    const schedCtx = bdCtx;

    const currentShift = shifts.find(
        (s) => !s.end_time && s.user === currentUser?.name
    );
    const shiftSalesRaw = currentShift
        ? sales.filter((s) => s.shift === currentShift.id && (isCreditSale(s) ? !s.returned : true))
        : [];
    // 🆕 المرتجعات وسداد الآجل والنقد المتوقع بقوا من نفس دالة تقرير التقفيل (computeShiftClosing) —
    // مصدر واحد للشاشة والطباعة والخزنة، وبيربط المرتجع/السداد بشفت واحد بس حتى لو فيه شفتين مفتوحين مع بعض
    // (قبل كده كل شفت مفتوح كان بيخصم نفس المرتجع من النقد المتوقع بتاعه فيطلع عجز وهمي).
    const closingReport = currentShift
        ? computeShiftClosing({ shift: currentShift, sales, creditPayments, returns, allShifts: shifts })
        : null;
    const shiftReturnsTotal = closingReport?.returnsTotal || 0;
    const shiftCashSales = shiftSalesRaw
        .filter((s) => !isCreditSale(s))
        .reduce((a, s) => a + (splitSaleByMethod(s)["نقدي"] || 0), 0);
    const shiftCreditCashCollected = closingReport?.creditPaidCash || 0;
    const shiftCashRefundsPaidNow = closingReport?.returnsCash || 0;
    // المفروض في الدرج = النقد الافتتاحي + نقدي + سداد آجل كاش − مرتجع نقدي (نفس رقم الطباعة)
    const expectedCloseCash = closingReport?.expectedDrawer ?? 0;

    // 🆕 فرق النقد اللي اتسجل قبل كده في الخزنة على نفس الشفت (لو الشفت اتقفل واتعاد فتحه): دخل بالموجب ومصروف بالسالب.
    // عند التقفيل التاني بنسجل الفرق الإضافي بس (الكلي − اللي اتسجل) عشان الفرق الأول مايتعدش مرتين.
    const recordedVarianceNet = currentShift
        ? (entries || [])
            .filter((e) => e.sub_type === "shift_variance" && e.ref_id === currentShift.id)
            .reduce((a, e) => a + (e.type === "income" ? 1 : -1) * (e.amount || 0), 0)
        : 0;
    const cashDiffTotal = closeCash === "" ? 0 : +closeCash - expectedCloseCash;
    const cashDiffNew = cashDiffTotal - recordedVarianceNet;
    const shiftSales = shiftSalesRaw;
    const shiftRevenue = shiftSalesRaw.reduce((a, s) => a + s.total, 0) - shiftReturnsTotal;
    const shiftCardSales = shiftSalesRaw.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
    const shiftTransferSales = shiftSalesRaw.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
    const shiftAjilSales = shiftSalesRaw.filter((s) => isCreditSale(s)).reduce((a, s) => a + s.total, 0);

    const varianceEntries = (entries || []).filter((e) => e.sub_type === "shift_variance");
    const varianceByEmployee = {};
    varianceEntries.forEach((e) => {
        const name = e.created_by || "غير معروف";
        if (!varianceByEmployee[name]) {
            varianceByEmployee[name] = { name, shortageCount: 0, shortageTotal: 0, surplusCount: 0, surplusTotal: 0, incidents: [] };
        }
        const g = varianceByEmployee[name];
        if (e.type === "expense") { g.shortageCount += 1; g.shortageTotal += e.amount || 0; }
        else { g.surplusCount += 1; g.surplusTotal += e.amount || 0; }
        g.incidents.push(e);
    });
    const varianceRows = Object.values(varianceByEmployee)
        .map((g: any) => ({ ...g, net: g.surplusTotal - g.shortageTotal, incidents: g.incidents.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)) }))
        .sort((a: any, b: any) => b.shortageTotal - a.shortageTotal);
    const totalShortageAll = varianceEntries.filter((e) => e.type === "expense").reduce((a, e) => a + (e.amount || 0), 0);
    const totalSurplusAll = varianceEntries.filter((e) => e.type === "income").reduce((a, e) => a + (e.amount || 0), 0);

    // 🆕 مرحلة 5: منع فتح شفت يوم جديد واليوم التشغيلي السابق لسه مقفلش.
    // بيتحسب من shifts و entries اللي في الـ state (نفس الكاش أوفلاين)، فمفيش نداء شبكة.
    const closedDates = new Set<string>(
        (entries || [])
            .filter((e) => e.sub_type === "daily_closing" && e.date)
            .map((e) => String(e.date).slice(0, 10))
    );
    const blockCheck = !currentShift
        ? checkNewShiftBlock({ now: new Date(), shifts, ctx: bdCtx, openerName: currentUser?.name, closedDates })
        : null;
    const openBlocked = !!blockCheck?.block;

    // 🆕 ترحيل النقدية: لو نفس الصيدلي قفل شفت قبل كده في نفس اليوم التشغيلي وفتح شفت جديد، النقد الافتتاحي بيبدأ بنقدية
    // تقفيله الأخير بدل 500 الثابتة. قبل كده الدرج كان فيه (500 + مبيعات) والشفت الجديد بيبدأ بـ 500 فيظهر "زيادة" وهمية.
    let nextBizDate: string | null = null;
    try {
        nextBizDate = resolveNewShiftBusinessDate({ now: new Date(), shifts, ctx: bdCtx, openerName: currentUser?.name })?.businessDate || null;
    } catch { nextBizDate = null; }
    const carryCash: number | null = (() => {
        if (currentShift || !nextBizDate) return null;
        const prev = (shifts || [])
            .filter((s) => s.user === currentUser?.name && s.end_time && s.close_cash != null && s.business_date === nextBizDate)
            .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0];
        return prev ? +prev.close_cash : null;
    })();
    useEffect(() => {
        if (carryCash != null && !openCashEdited) setOpenCashRaw(String(carryCash));
    }, [carryCash, openCashEdited]);

    // 🆕 إعادة فتح آخر شفت: الصيدلي بس لشفته، لحد (نهاية دوامه المجدولة + reopenWindowMin دقيقة)،
    // مش من وقت التقفيل. ممنوعة تمامًا بعد بداية اليوم التشغيلي التالي (getBlockStartTs) — للجميع بما فيهم المدير —
    // لأن البيع هيبقى ممنوع أصلًا. المدير ملوش حد زمني قبل كده بس. لو مفيش جدول للصيدلي → fallback: من وقت التقفيل.
    // وطالما مفتحش بعده شفت تاني، واليوم التشغيلي لسه ما اتقفلش، والشفت مش مقفول قسريًا.
    const reopenCandidate: { shift: any; ageMin: number; deadlineTs: number | null } | null = (() => {
        if (currentShift || !currentUser?.name) return null;
        const mine = (shifts || []).filter((s) => s.user === currentUser.name);
        const last = mine
            .filter((s) => s.end_time)
            .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0];
        if (!last) return null;
        if (String(last.notes || "").includes("إغلاق قسري")) return null;
        const openedAfter = mine.some((s) => s.id !== last.id && new Date(s.start_time).getTime() > new Date(last.start_time).getTime());
        if (openedAfter) return null;
        if (last.business_date && closedDates.has(String(last.business_date).slice(0, 10))) return null;
        const nowMs = Date.now();
        const ageMin = (nowMs - new Date(last.end_time).getTime()) / 60000;

        // منع بعد بداية اليوم التشغيلي التالي (للكل)
        const bd = last.business_date ? String(last.business_date).slice(0, 10) : null;
        if (bd && hasBusinessDayConfig(bdCtx)) {
            const { ts } = getBlockStartTs(bd, bdCtx);
            if (nowMs >= ts) return null;
        }

        // المهلة: نهاية الدوام المجدولة + المدة (أو من وقت التقفيل لو مفيش جدول)
        let deadlineTs: number | null = null;
        if (bd) {
            const schedEnd = getScheduledShiftEndTs(schedCtx, currentUser.name, currentUser.id || null, bd, new Date(last.start_time));
            if (schedEnd != null) deadlineTs = schedEnd + reopenWindowMin * 60000;
        }
        if (deadlineTs == null) deadlineTs = new Date(last.end_time).getTime() + reopenWindowMin * 60000;
        if (!isAdmin && nowMs > deadlineTs) return null; // 0 = لحد نهاية الدوام المجدول بالظبط من غير دقايق زيادة
        return { shift: last, ageMin, deadlineTs };
    })();

    // 🆕 فتح الشفت — كتابة فورية في الكاش المحلي + queueEvent (نفس نمط completeSale).
    // لا نداء مباشر لـ supabase هنا؛ الـ sync الفعلي بيحصل جوه offlineSync.ts (SHIFT_OPEN/ATTENDANCE_CHECKIN).
    const openShift = async () => {
        if (currentShift) {
            showToast("يوجد شفت مفتوح بالفعل", "warn");
            return;
        }
        const nowISO = new Date().toISOString();
        // 🆕 مرحلة 5: إعادة الفحص لحظة الفتح (مش بنعتمد على قيمة الريندر)
        const chk = checkNewShiftBlock({ now: new Date(nowISO), shifts, ctx: bdCtx, openerName: currentUser?.name, closedDates });
        let overrideNote = "";
        if (chk.block) {
            if (!isAdmin) {
                showToast(`🚫 اليوم التشغيلي ${chk.unclosedDate} لسه مقفلش — اقفله من الخزنة أو اطلب من المدير`, "error");
                return;
            }
            if (!overrideReason.trim()) {
                showToast("اكتب سبب التجاوز قبل فتح الشفت", "error");
                return;
            }
            overrideNote = `[تجاوز منع فتح اليوم بواسطة ${currentUser?.name || "مدير"} — يوم ${chk.unclosedDate} لم يُقفل] ${overrideReason.trim()}`;
        }
        // 🆕 تاريخ اليوم التشغيلي للشفت ده
        const { businessDate } = resolveNewShiftBusinessDate({ now: new Date(nowISO), shifts, ctx: bdCtx, openerName: currentUser?.name });
        const sh = {
            id: "SH-" + Date.now() + "-" + crypto.randomUUID().slice(0, 8), // 🆕 لاحقة عشوائية: الـ id لوحده (timestamp) ممكن يتكرر بين جهازين/صيدليتين
            user: currentUser.name,
            role: currentUser.role,
            start_time: nowISO,
            end_time: null,
            open_cash: +openCash,
            close_cash: null,
            sales: 0,
            notes: overrideNote, // 🆕 سبب التجاوز بيتسجل هنا (عمود موجود، مفيش تغيير في الداتابيز)
            pharmacy_id: pharmacyId,
            business_date: businessDate, // 🆕
        };

        try {
            await window.offlineAPI.upsertShiftCache({ ...sh, user_id: currentUser.id || null });
        } catch (err) {
            console.error("upsertShiftCache failed:", err);
        }
        setShifts((p) => [...p, sh]);

        await queueEvent({
            id: crypto.randomUUID(),
            type: "SHIFT_OPEN",
            pharmacy_id: pharmacyId, // 🆕 لازم يكون على مستوى الـ event نفسه (مش بس جوه payload) عشان offlineSync.ts يلقطه
            timestamp: nowISO,
            payload: { shift: sh },
        });

        // ✅ تسجيل حضور تلقائي — بيتنفذ فوراً لو أونلاين، أو يتأجل لو أوفلاين (نفس فلسفة queueEvent)
        // 🆕 تاريخ الحضور = اليوم التشغيلي للشفت (مش التاريخ التقويمي) — عشان الفتح بعد منتصف الليل يفضل في نفس اليوم
        const today = sh.business_date || todayLocal();
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ATTENDANCE_CHECKIN",
            pharmacy_id: pharmacyId, // 🆕 نفس السبب
            timestamp: nowISO,
            payload: {
                pharmacy_id: pharmacyId,
                pharmacist_name: currentUser.name,
                date: today,
                record: {
                    id: crypto.randomUUID(), // 🆕 id من العميل: يمنع تكرار سجل الحضور لو الحدث اتكرر (المعالج idempotent بالـ id)
                    pharmacy_id: pharmacyId,
                    pharmacist_name: currentUser.name,
                    pharmacist_user_id: currentUser.id || null,
                    date: today,
                    shift_id: sh.id,
                    check_in: nowISO,
                },
            },
        });

        setOverrideReason("");
        setOpenCashEdited(false);
        setJustClosed(null);
        showToast("تم فتح الشفت ✓");
    };

    // 🆕 المدير بس: حفظ مدة إعادة الفتح. بتتحدّث في الإعدادات عبر نفس حدث PHARMACY_SETTINGS_UPDATE (أوفلاين-أول)،
    // ومحليًا فورًا. لازم عمود shift_reopen_window_minutes يكون موجود في pharmacy_settings.
    const saveReopenWindow = async () => {
        if (!isAdmin) return;
        const n = Math.round(+reopenWindowDraft);
        if (reopenWindowDraft === "" || !isFinite(n) || n < 0 || n > 1440) {
            showToast("اكتب مدة من 0 إلى 1440 دقيقة", "error");
            return;
        }
        setReopenWindowMin(n);
        if (settingsRaw) {
            // مانكتبش الكاش لو الإعدادات مش متحمّلة، عشان ماننزّلش كاش فيه قيمة واحدة بس
            const merged = { ...settingsRaw, shift_reopen_window_minutes: n };
            setSettingsRaw(merged);
            try { await window.offlineAPI?.upsertPharmacySettingsCache?.({ pharmacyId, settings: merged }); } catch (err) { console.error(err); }
        }
        await queueEvent({
            id: crypto.randomUUID(),
            type: "PHARMACY_SETTINGS_UPDATE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { pharmacy_id: pharmacyId, updates: { shift_reopen_window_minutes: n } },
        });
        showToast(n === 0 ? "إعادة فتح الشفت للصيدلي بقت لحد نهاية الدوام بالظبط ✓" : `مدة إعادة فتح الشفت بقت ${n} دقيقة ✓`);
    };

    // 🆕 إعادة فتح نفس الشفت (بدل شفت جديد) عشان التقفيل ما يتقسمش لشفتين.
    // - نفس id الشفت: بنمسح end_time/close_cash بحدث SHIFT_CLOSE (معالجه في offlineAPI.ts تحديث عام بالـ id فمش محتاج نوع حدث جديد).
    // - الحضور: ATTENDANCE_CHECKIN جديد بنفس shift_id (التقفيل الأول قفل سجل الحضور، فبيظهر جلستين في اليوم وده الصح).
    // - فرق النقد المسجل قبل كده مش بيتلمس: التقفيل التاني بيسجل الفرق الإضافي بس (شوف recordedVarianceNet).
    const reopenShift = async () => {
        if (currentShift) {
            showToast("يوجد شفت مفتوح بالفعل", "warn");
            return;
        }
        if (!reopenCandidate) {
            showToast("لا يمكن إعادة فتح الشفت (انتهت المدة بعد نهاية الدوام أو بدأ اليوم التشغيلي التالي أو اتفتح شفت بعده أو اليوم اتقفل)", "error");
            return;
        }
        const target = reopenCandidate.shift;
        const nowISO = new Date().toISOString();
        const updates = {
            end_time: null,
            close_cash: null,
            notes: [target.notes, `[أُعيد فتح الشفت بواسطة ${currentUser?.name || ""} — ${nowISO}]`].filter(Boolean).join(" | "),
        };
        try {
            await window.offlineAPI.upsertShiftCache({ ...target, ...updates, pharmacy_id: pharmacyId });
        } catch (err) {
            console.error("upsertShiftCache (reopen) failed:", err);
        }
        setShifts((p) => p.map((s) => (s.id === target.id ? { ...s, ...updates } : s)));

        await queueEvent({
            id: crypto.randomUUID(),
            type: "SHIFT_CLOSE", // نفس معالج التحديث بالـ id (end_time = null هنا)
            pharmacy_id: pharmacyId,
            timestamp: nowISO,
            payload: { shiftId: target.id, updates },
        });
        // 🆕 تاريخ الحضور = اليوم التشغيلي للشفت المُعاد فتحه
        const today = target.business_date ? String(target.business_date).slice(0, 10) : todayLocal();
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ATTENDANCE_CHECKIN",
            pharmacy_id: pharmacyId,
            timestamp: nowISO,
            payload: {
                pharmacy_id: pharmacyId,
                pharmacist_name: currentUser.name,
                date: today,
                is_reopen: true, // 🆕 المعالج بيورّث shift_number من جلسة الشفت الأولى ويخلي التأخير 0
                record: {
                    id: crypto.randomUUID(),
                    pharmacy_id: pharmacyId,
                    pharmacist_name: currentUser.name,
                    pharmacist_user_id: currentUser.id || null,
                    date: today,
                    shift_id: target.id,
                    check_in: nowISO,
                },
            },
        });
        setCloseCash("");
        setNotes("");
        setShiftDiffReason("");
        setJustClosed(null);
        showToast("تم إعادة فتح الشفت ✓");
    };

    // 🆕 إغلاق الشفت — نفس فكرة الفاليديشن الأصلية بالظبط، لكن التنفيذ بقى عبر الكاش المحلي + queueEvent.
    // حساب net_hours اتنقل بالكامل لـ ATTENDANCE_CHECKOUT جوه offlineSync.ts (وقت وجود نت فعلي)
    // لأن حسابه محتاج قراءة work_schedules/prayer_breaks من Supabase، ومش متاح أوفلاين.
    const closeShift = async () => {
        const hasOpenItems = invoices?.some((inv) => inv.cart.length > 0);
        if (hasOpenItems) {
            showToast("⚠️ يوجد فاتورة مفتوحة بأصناف — أتمم البيع أو امسح السلة أولاً", "error");
            return;
        }
        if (!closeCash) {
            showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
            return;
        }
        // 🆕 الفرق اللي هيتسجل = الفرق الكلي − اللي اتسجل قبل كده على نفس الشفت (لو اتعاد فتحه)، عشان مايتعدش مرتين
        const shiftCashDiff = cashDiffNew;
        if (Math.abs(shiftCashDiff) > SHIFT_CASH_DIFF_REASON_THRESHOLD && !shiftDiffReason.trim()) {
            showToast(`⚠️ فيه فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} قدره ${Math.abs(shiftCashDiff).toFixed(2)} ر.س — اكتب السبب قبل إغلاق الشفت`, "error");
            return;
        }

        const nowISO = new Date().toISOString();
        const updates = {
            end_time: nowISO,
            close_cash: +closeCash,
            sales: shiftRevenue,
            notes: [currentShift.notes, notes].filter(Boolean).join(" | "), // 🆕 نحافظ على ملاحظة تجاوز المنع
        };

        try {
            await window.offlineAPI.upsertShiftCache({ ...currentShift, ...updates, pharmacy_id: pharmacyId });
        } catch (err) {
            console.error("upsertShiftCache (close) failed:", err);
        }
        setShifts((p) =>
            p.map((s) => (s.id === currentShift.id ? { ...s, ...updates } : s))
        );

        await queueEvent({
            id: crypto.randomUUID(),
            type: "SHIFT_CLOSE",
            pharmacy_id: pharmacyId, // 🆕 نفس السبب
            timestamp: nowISO,
            payload: { shiftId: currentShift.id, updates },
        });

        // 🆕 تسجيل فرق النقد كقيد في الخزنة — عبر queueEvent بدل insert مباشر
        // ⚠️ ملحوظة: البلوك ده كان متكرر جوه نفسه بالغلط (نسخة ولزقة) وده اللي كان بيسيب
        // قوس closeShift كله من غير إقفال، وده سبب خطأ "Unexpected end of file" في آخر الملف.
        // اتشال التكرار وبقى بلوك واحد بس.
        if (Math.abs(shiftCashDiff) > 0.005) {
            const reasonNote = shiftDiffReason.trim()
                ? `فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} عند تسليم شفت ${currentUser?.name || ""} — ${shiftDiffReason.trim()}`
                : `فرق نقد ${shiftCashDiff > 0 ? "زيادة" : "عجز"} عند تسليم شفت ${currentUser?.name || ""} (متوقع: ${expectedCloseCash.toFixed(2)} / فعلي: ${(+closeCash).toFixed(2)})`;

            const { id } = await insertTreasuryEntry({
                type: shiftCashDiff > 0 ? "income" : "expense",
                sub_type: "shift_variance",
                method: "نقدي",
                amount: Math.abs(shiftCashDiff),
                note: reasonNote,
                date: todayLocal(),
                pharmacy_id: pharmacyId,
                created_by: currentUser?.name || "",
                ref_id: currentShift.id, // 🆕 ربط القيد بالشفت مباشرة
            });

            if (setEntries) {
                setEntries((p) => [{
                    id, type: shiftCashDiff > 0 ? "income" : "expense", sub_type: "shift_variance",
                    method: "نقدي", amount: Math.abs(shiftCashDiff), note: reasonNote,
                    date: todayLocal(), pharmacy_id: pharmacyId, created_by: currentUser?.name || "",
                    ref_id: currentShift.id, // 🆕 لازم يتسجل محليًا كمان عشان recordedVarianceNet يشوفه لو الشفت اتعاد فتحه
                }, ...p]);
            }
        }
        setShiftDiffReason("");
        setJustClosed({ ...currentShift, ...updates }); // 🆕 يظهر زرار "طباعة تقفيل الشفت" بعد التقفيل

        // ✅ تسجيل انصراف تلقائي — حساب الساعات نفسه اتأجل لـ ATTENDANCE_CHECKOUT جوه offlineSync.ts
        await queueEvent({
            id: crypto.randomUUID(),
            type: "ATTENDANCE_CHECKOUT",
            pharmacy_id: pharmacyId, // 🆕 نفس السبب
            timestamp: nowISO,
            payload: {
                pharmacy_id: pharmacyId,
                pharmacist_name: currentUser.name,
                pharmacist_user_id: currentUser.id || null, // 🆕 المعالج كان بيقراه بس الحدث ما كانش بيبعته (فبيدوّر بالاسم)
                shift_id: currentShift.id, // 🆕 ربط الانصراف بسجل حضور الشفت ده حتى لو اتقفل بعد منتصف الليل
                date: currentShift.business_date ? String(currentShift.business_date).slice(0, 10) : todayLocal(),
                check_out: nowISO,
            },
        });

        showToast(
            navigator.onLine
                ? "تم إغلاق الشفت وتسليمه ✓"
                : "تم إغلاق الشفت وتسليمه ✓ (سيتم احتساب ساعات العمل عند توفر الاتصال)"
        );
    };

    // 🆕 إغلاق قسري لشفت يتيم (مدير فقط) — هذا الإجراء نادر ومرتبط بحالة استثنائية
    // (تغيير اسم مستخدم بعد فتح شفت)، وعادة ما يُنفَّذ من المدير وهو متصل بالنت،
    // فتم إبقاؤه نداء مباشر لـ Supabase بدل queueEvent، بدل تعقيد مسار نادر الحدوث.
    // لو حبيت لاحقاً نأمّنه أوفلاين برضه، يتحول لنفس نمط SHIFT_CLOSE بسهولة.
    const closeShiftForce = async () => {
        if (!forceCloseTarget) return;
        if (!forceCloseCash) {
            showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
            return;
        }
        setForceClosing(true);
        const updates = {
            end_time: new Date().toISOString(),
            close_cash: +forceCloseCash,
            notes: `[إغلاق قسري بواسطة ${currentUser?.name || "مدير"}] ${forceCloseNotes || ""}`.trim(),
        };
        const { error } = await supabase
            .from("shifts")
            .update(updates)
            .eq("id", forceCloseTarget.id);
        setForceClosing(false);
        if (error) {
            showToast("فشل الإغلاق القسري: " + error.message, "error");
            return;
        }
        try {
            await window.offlineAPI.upsertShiftCache({ ...forceCloseTarget, ...updates, pharmacy_id: pharmacyId });
        } catch (err) {
            console.error("upsertShiftCache (force close) failed:", err);
        }
        setShifts((p) => p.map((s) => (s.id === forceCloseTarget.id ? { ...s, ...updates } : s)));
        // 🆕 الإغلاق القسري كان بيقفل الشفت ويسيب سجل حضور صاحبه مفتوح (من غير انصراف) — فساعات الشفت ما بتتحسبش في الرواتب.
        // دلوقتي بنسجل الانصراف بنفس وقت الإغلاق، والمعالج بيقفل السجل بالـ shift_id (والساعات بتتحسب بسقف الجدول).
        try {
            await queueEvent({
                id: crypto.randomUUID(),
                type: "ATTENDANCE_CHECKOUT",
                pharmacy_id: pharmacyId,
                timestamp: updates.end_time,
                payload: {
                    pharmacy_id: pharmacyId,
                    pharmacist_name: forceCloseTarget.user,
                    pharmacist_user_id: forceCloseTarget.user_id || null,
                    shift_id: forceCloseTarget.id,
                    date: forceCloseTarget.business_date ? String(forceCloseTarget.business_date).slice(0, 10) : todayLocal(),
                    check_out: updates.end_time,
                },
            });
        } catch (err) {
            console.error("force close attendance checkout failed:", err);
        }
        showToast(`تم إغلاق الشفت اليتيم ${forceCloseTarget.id} قسرياً ✓`);
        setForceCloseTarget(null);
        setForceCloseCash("");
        setForceCloseNotes("");
    };

    return (
        <div>
            <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
                إدارة الشفتات
            </h2>
            {isAdmin && (
                <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 16, maxWidth: 480 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.textPrimary, marginBottom: 8 }}>
                        ⚙️ مدة السماح بإعادة فتح الشفت (للصيدلي)
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                            <Input label="بالدقايق بعد نهاية الدوام (0 = لحد نهاية الدوام بالظبط)" value={reopenWindowDraft} onChange={setReopenWindowDraft} type="number" placeholder="30" />
                        </div>
                        <Btn onClick={saveReopenWindow} disabled={reopenWindowDraft === String(reopenWindowMin)}>حفظ</Btn>
                    </div>
                    <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 6 }}>
                        الحالي: {reopenWindowMin} دقيقة بعد نهاية الدوام المجدول للشفت. المدير بدون حد زمني، وإعادة الفتح ممنوعة للكل بعد بداية اليوم التشغيلي التالي.
                    </div>
                </div>
            )}
            {!currentShift ? (
                <div
                    style={{
                        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 14,
                        padding: 24,
                        marginBottom: 20,
                        maxWidth: 480,
                    }}
                >
                    <h3
                        style={{
                            margin: "0 0 16px",
                            fontSize: 16,
                            fontWeight: 700,
                            color: COLORS.textPrimary,
                        }}
                    >
                        فتح شفت جديد
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {justClosed && (
                            <div style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
                                <div style={{ color: COLORS.green, fontWeight: 700 }}>تم تقفيل شفتك ✓ ({justClosed.id})</div>
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <Btn onClick={() => printShiftReport(justClosed, "a4")} style={{ flex: 1, justifyContent: "center" }}>🖨️ طباعة A4</Btn>
                                    <Btn onClick={() => printShiftReport(justClosed, "receipt")} style={{ flex: 1, justifyContent: "center" }}>🧾 طباعة إيصال</Btn>
                                </div>
                            </div>
                        )}
                        {reopenCandidate && (
                            <div style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
                                <div style={{ color: COLORS.textPrimary, fontWeight: 700 }}>
                                    محتاج تبيع حاجة تانية؟ أعد فتح شفتك الأخير بدل ما تفتح شفت جديد:
                                </div>
                                <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 8 }}>
                                    {reopenCandidate.shift.id} — اتقفل من {Math.max(0, Math.round(reopenCandidate.ageMin))} دقيقة{!isAdmin && reopenCandidate.deadlineTs ? ` — متاحة لحد ${new Date(reopenCandidate.deadlineTs).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}` : ""}. التقفيل هيفضل واحد، وفرق النقد المسجل قبل كده مش هيتعد تاني.
                                </div>
                                <Btn onClick={reopenShift} style={{ width: "100%", justifyContent: "center" }}>
                                    إعادة فتح نفس الشفت
                                </Btn>
                            </div>
                        )}
                        <Input
                            label="النقد الافتتاحي (ر.س)"
                            value={openCash}
                            onChange={setOpenCash}
                            type="number"
                            placeholder="500"
                        />
                        {carryCash != null && !openCashEdited && (
                            <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: -6 }}>
                                مرحّل من نقدية آخر تقفيل ليك النهارده ({carryCash} ر.س) — عدّله لو الدرج اتغيّر.
                            </div>
                        )}
                        {openBlocked && (
                            <div style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
                                🚫 اليوم التشغيلي <b>{blockCheck?.unclosedDate}</b> لسه مقفلش، وبدأ يوم جديد.
                                {isAdmin
                                    ? " اقفل اليوم من الخزنة، أو اكتب سبب التجاوز وافتح الشفت."
                                    : " اقفل اليوم من الخزنة أو اطلب من المدير."}
                            </div>
                        )}
                        {openBlocked && isAdmin && (
                            <Input
                                label="سبب التجاوز (مطلوب)"
                                value={overrideReason}
                                onChange={setOverrideReason}
                                placeholder="مثال: نسيان التقفيل، هيتقفل بأثر رجعي"
                            />
                        )}
                        <Btn icon="shift" onClick={openShift} size="lg" disabled={openBlocked && !isAdmin}>
                            {openBlocked && isAdmin ? "تجاوز وفتح الشفت" : "فتح الشفت"}
                        </Btn>
                    </div>
                </div>
            ) : (
                <div
                    style={{
                        background: COLORS.surface,
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 14,
                        padding: 24,
                        marginBottom: 20,
                        maxWidth: 520,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <h3
                            style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                                color: COLORS.green,
                            }}
                        >
                            شفت مفتوح ✓
                        </h3>
                        <Badge color={COLORS.greenSoft} text={COLORS.green}>
                            {currentShift.id}
                        </Badge>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        <div
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
                        >
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>بداية الشفت</div>
                            <div style={{ color: COLORS.textPrimary, fontSize: 13, marginTop: 4 }}>
                                {currentShift.start_time}
                            </div>
                        </div>
                        <div
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
                        >
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                                النقد الافتتاحي
                            </div>
                            <div
                                style={{
                                    color: COLORS.green,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    marginTop: 2,
                                }}
                            >
                                {currentShift.open_cash} ر.س
                            </div>
                        </div>
                        <div
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
                        >
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>مبيعات الشفت</div>
                            <div
                                style={{
                                    color: COLORS.blue,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    marginTop: 2,
                                }}
                            >
                                {shiftRevenue.toFixed(2)} ر.س
                            </div>
                        </div>
                        <div
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}
                        >
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>عدد الفواتير</div>
                            <div
                                style={{
                                    color: COLORS.purple,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    marginTop: 2,
                                }}
                            >
                                {shiftSales.length}
                            </div>
                        </div>
                    </div>
                    {shiftReturnsTotal > 0 && (
                        <div style={{ color: COLORS.red, fontSize: 12, marginTop: -6, marginBottom: 10 }}>
                            🔄 مرتجعات: {shiftReturnsTotal.toFixed(2)} ر.س (مخصومة من مبيعات الشفت)
                        </div>
                    )}
                    <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                        <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>تفصيل مبيعات الشفت</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                            {[
                                { l: "💵 نقدي", v: shiftCashSales, c: COLORS.green },
                                { l: "💳 بطاقة", v: shiftCardSales, c: COLORS.blue },
                                { l: "🏦 تحويل", v: shiftTransferSales, c: COLORS.purple },
                                { l: "📋 آجل", v: shiftAjilSales, c: COLORS.red },
                                { l: "💰 سداد آجل محصّل (كاش)", v: shiftCreditCashCollected, c: COLORS.green },
                            ].map((x) => x.v > 0 && (
                                <div key={x.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                    <span style={{ color: COLORS.textDim }}>{x.l}</span>
                                    <span style={{ color: x.c, fontWeight: 700 }}>{x.v.toFixed(2)} ر.س</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <Btn onClick={() => printShiftReport(currentShift, "a4")} style={{ flex: 1, justifyContent: "center" }}>🖨️ تقرير مبدئي A4</Btn>
                        <Btn onClick={() => printShiftReport(currentShift, "receipt")} style={{ flex: 1, justifyContent: "center" }}>🧾 تقرير مبدئي إيصال</Btn>
                    </div>
                    <Input
                        label="النقد الفعلي عند الإغلاق (ر.س)"
                        value={closeCash}
                        onChange={setCloseCash}
                        type="number"
                        placeholder="0"
                    />
                    <Input
                        label="ملاحظات تسليم الشفت"
                        value={notes}
                        onChange={setNotes}
                        placeholder="أي ملاحظات عند التسليم..."
                        style={{ marginTop: 10 }}
                    />
                    {closeCash && (
                        <div
                            style={{
                                margin: "10px 0",
                                padding: "10px 14px",
                                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                borderRadius: 8,
                                color: COLORS.gold,
                                fontSize: 13,
                            }}
                        >
                            فرق النقد (نقدي فقط){recordedVarianceNet !== 0 ? ` — إجمالي ${cashDiffTotal.toFixed(2)}، منه ${recordedVarianceNet.toFixed(2)} مسجّل قبل كده (بيتسجل الإضافي بس)` : ""}:{" "}
                            {cashDiffNew.toFixed(2)}{" "}
                            ر.س
                            {cashDiffNew !== 0 && (
                                <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
                                    {cashDiffNew > 0 ? "الزيادة" : "العجز"} ده هيتسجل كقيد {cashDiffNew > 0 ? "دخل" : "مصروف"} في الخزنة تلقائيًا عند إغلاق الشفت.
                                </div>
                            )}
                        </div>
                    )}
                    {closeCash && Math.abscashDiffNew > SHIFT_CASH_DIFF_REASON_THRESHOLD && (
                        <Input
                            label={`سبب ${cashDiffNew > 0 ? "الزيادة" : "العجز"} (إلزامي لفرق أكبر من ${SHIFT_CASH_DIFF_REASON_THRESHOLD} ر.س)`}
                            value={shiftDiffReason}
                            onChange={setShiftDiffReason}
                            placeholder="مثال: باقي اتحسب غلط لعميل، صرف بدون تسجيل..."
                            style={{ marginTop: 10 }}
                        />
                    )}
                    <Btn
                        icon="check"
                        variant="success"
                        onClick={closeShift}
                        size="lg"
                        style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
                    >
                        إغلاق وتسليم الشفت
                    </Btn>
                </div>
            )}
            {isAdmin && (() => {
                const orphanShifts = shifts.filter((s) => !s.end_time && s.id !== currentShift?.id);
                if (orphanShifts.length === 0) return null;
                return (
                    <div
                        style={{
                            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                            border: `1px solid ${COLORS.red}`,
                            borderRadius: 14,
                            padding: 20,
                            marginBottom: 20,
                            maxWidth: 560,
                        }}
                    >
                        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: COLORS.red }}>
                            ⚠️ شفتات مفتوحة يتيمة (مش شفتك الحالي)
                        </h3>
                        <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 12 }}>
                            غالباً فُتحت باسم مستخدم اتغيّر بعد كده — وهي اللي بتمنع تقفيل اليوم. بصفتك مدير تقدر تقفلها قسرياً من هنا.
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {orphanShifts.map((s) => (
                                <div
                                    key={s.id}
                                    style={{
                                        background: COLORS.surfaceAlt, borderRadius: 10, padding: 12,
                                        display: "flex", flexDirection: "column", gap: 8,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ fontSize: 13 }}>
                                            <span style={{ color: COLORS.blue, fontWeight: 700 }}>{s.id}</span>
                                            {"  —  "}
                                            <span style={{ color: COLORS.textPrimary }}>{s.user}</span>
                                            {"  —  بدأ: "}
                                            <span style={{ color: COLORS.textDim }}>{s.start_time}</span>
                                        </div>
                                        {forceCloseTarget?.id !== s.id && (
                                            <Btn variant="danger" onClick={() => { setForceCloseTarget(s); setForceCloseCash(""); setForceCloseNotes(""); }}>
                                                إغلاق قسري
                                            </Btn>
                                        )}
                                    </div>
                                    {forceCloseTarget?.id === s.id && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                                            <Input
                                                label="النقد الفعلي عند الإغلاق (ر.س)"
                                                value={forceCloseCash}
                                                onChange={setForceCloseCash}
                                                type="number"
                                                placeholder="0"
                                            />
                                            <Input
                                                label="ملاحظات (اختياري)"
                                                value={forceCloseNotes}
                                                onChange={setForceCloseNotes}
                                                placeholder="سبب الإغلاق القسري..."
                                            />
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <Btn variant="success" onClick={closeShiftForce} disabled={forceClosing}>
                                                    {forceClosing ? "⏳ جارِ الحفظ..." : "تأكيد الإغلاق"}
                                                </Btn>
                                                <Btn variant="ghost" onClick={() => setForceCloseTarget(null)}>إلغاء</Btn>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
            <Table
                headers={[
                    "رقم الشفت",
                    "الموظف",
                    "البداية",
                    "النهاية",
                    "النقد الافتتاحي",
                    "المبيعات",
                    "النقد الختامي",
                    "الحالة",
                    "طباعة",
                ]}
                rows={[...shifts].reverse().slice((shiftsPage - 1) * SHIFTS_PAGE_SIZE, shiftsPage * SHIFTS_PAGE_SIZE).map((s) => [
                    <span style={{ color: COLORS.blue, fontWeight: 700 }}>{s.id}</span>,
                    s.user,
                    s.start_time,
                    s.end_time || "-",
                    s.open_cash + " ر.س",
                    <span style={{ color: COLORS.blue, fontWeight: 700 }}>
                        {(s.sales || 0).toFixed(2)} ر.س
                    </span>,
                    s.close_cash ? s.close_cash + " ر.س" : "-",
                    s.end_time ? (
                        <Badge color={COLORS.greenSoft} text={COLORS.green}>
                            مغلق
                        </Badge>
                    ) : (
                        <Badge color={COLORS.greenSoft} text="#44ffaa">
                            مفتوح
                        </Badge>
                    ),
                    // 🆕 الصيدلي يطبع شفتاته هو بس، والمدير يطبع أي شفت
                    (isAdmin || s.user === currentUser?.name) ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                            <button onClick={() => printShiftReport(s, "a4")} title="طباعة A4" style={{ cursor: "pointer", border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>🖨️</button>
                            <button onClick={() => printShiftReport(s, "receipt")} title="طباعة إيصال" style={{ cursor: "pointer", border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>🧾</button>
                        </span>
                    ) : "-",
                ])}
            />
            <Pagination page={shiftsPage} onPageChange={setShiftsPage} totalItems={shifts.length} pageSize={SHIFTS_PAGE_SIZE} />

            {isAdmin && varianceRows.length > 0 && (
                <div style={{ marginTop: 28 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: COLORS.textPrimary }}>
                        📊 فروقات النقد عند تسليم الشفت — حسب الموظف
                    </h3>
                    <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" as const }}>
                        <div style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 10, padding: "10px 16px" }}>
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>إجمالي العجز (كل الموظفين)</div>
                            <div style={{ color: COLORS.red, fontWeight: 900, fontSize: 18 }}>{totalShortageAll.toFixed(2)} ر.س</div>
                        </div>
                        <div style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 10, padding: "10px 16px" }}>
                            <div style={{ color: COLORS.textDim, fontSize: 11 }}>إجمالي الزيادة (كل الموظفين)</div>
                            <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{totalSurplusAll.toFixed(2)} ر.س</div>
                        </div>
                    </div>
                    {varianceRows.map((g: any) => (
                        <div key={g.name} style={{
                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10,
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 }}>
                                <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{g.name}</span>
                                <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                                    {g.shortageCount > 0 && (
                                        <span style={{ color: COLORS.red }}>عجز: {g.shortageCount} مرة — {g.shortageTotal.toFixed(2)} ر.س</span>
                                    )}
                                    {g.surplusCount > 0 && (
                                        <span style={{ color: COLORS.green }}>زيادة: {g.surplusCount} مرة — {g.surplusTotal.toFixed(2)} ر.س</span>
                                    )}
                                    <span style={{ color: g.net >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                                        الصافي: {g.net >= 0 ? "+" : ""}{g.net.toFixed(2)} ر.س
                                    </span>
                                </div>
                                <button
                                    onClick={() => setExpandedVarianceEmployee((p) => (p === g.name ? null : g.name))}
                                    style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}
                                >
                                    {expandedVarianceEmployee === g.name ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                                </button>
                            </div>
                            {expandedVarianceEmployee === g.name && (
                                <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                                    {g.incidents.map((inc: any) => (
                                        <div key={inc.id || inc.created_at} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8 }}>
                                            <span style={{ color: COLORS.textDim, flexShrink: 0 }}>{inc.date}</span>
                                            <span style={{ color: COLORS.textDim, flex: 1 }}>{inc.note}</span>
                                            <span style={{ color: inc.type === "expense" ? COLORS.red : COLORS.green, fontWeight: 700, flexShrink: 0 }}>
                                                {inc.type === "expense" ? "−" : "+"}{(inc.amount || 0).toFixed(2)} ر.س
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}