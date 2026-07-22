import { isRamadan } from "./dateUtils";
import { AttendanceModule } from "../modules/AttendanceModule";

// ========== نظام الرواتب — دوال مساعدة مشتركة ==========
// 🆕 حساب مكافأة نهاية الخدمة حسب نظام العمل السعودي (المادة 84/85):
// - نص شهر أجر عن كل سنة من أول 5 سنين خدمة
// - شهر كامل أجر عن كل سنة بعد أول 5 سنين
// - تُحسب على "الأجر الأساسي + البدلات الثابتة" (مش العمولة/النسبة المتغيرة) وقت انتهاء الخدمة
// - في حالة الاستقالة: النظام يقلل الاستحقاق حسب مدة الخدمة (مادة 85) — بيتفعّل لو terminationType = "resignation"
// ⚠️ هذا حساب تقديري عام حسب القواعد المعلنة، وليس استشارة قانونية؛ يُفضّل مراجعة مختص عند التسوية الفعلية.
export function calcServiceYears(hireDate, endDate) {
  const start = new Date(hireDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  return (end - start) / (1000 * 60 * 60 * 24 * 365.25);
}


export function calcEndOfServiceBenefit(hireDate, endDate, monthlyWage, terminationType = "normal") {
  const years = calcServiceYears(hireDate, endDate);
  const wage = +monthlyWage || 0;
  if (years <= 0 || wage <= 0) return { years: 0, grossAmount: 0, factor: 1, netAmount: 0 };
  const firstFiveYears = Math.min(years, 5);
  const remainingYears = Math.max(0, years - 5);
  const grossAmount = (firstFiveYears * (wage / 2)) + (remainingYears * wage);
  // نسبة الاستحقاق عند الاستقالة (مادة 85): أقل من سنتين = صفر، من 2 لـ5 = الثلث، من 5 لـ10 = الثلثين، أكتر من 10 = كامل
  let factor = 1;
  if (terminationType === "resignation") {
    if (years < 2) factor = 0;
    else if (years < 5) factor = 1 / 3;
    else if (years < 10) factor = 2 / 3;
    else factor = 1;
  }
  const netAmount = grossAmount * factor;
  return { years, grossAmount, factor, netAmount };
}


// 🆕 رصيد أيام الإجازة السنوية المتراكم لحد النهاردة (أو لحد تاريخ انتهاء الخدمة)
// = (عدد أيام الإجازة سنويًا ÷ 12) × عدد الشهور من تاريخ التعيين، مطروح منه أي أيام مصروفة/متصرفة فعلاً من السجل
export function calcLeaveBalanceDays(hireDate, leaveDaysPerYear, ledgerEntries, asOfDate) {
  const start = new Date(hireDate);
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  if (isNaN(start) || asOf <= start) return 0;
  const monthsElapsed = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth()) + (asOf.getDate() >= start.getDate() ? 0 : -1);
  const accrued = Math.max(0, monthsElapsed) * ((+leaveDaysPerYear || 21) / 12);
  const used = (ledgerEntries || []).reduce((a, e) => a + (+e.days || 0), 0);
  return Math.max(0, accrued - used);
}



// 🆕 حساب اشتراكات التأمينات الاجتماعية (GOSI) الشهرية
// الأساس: هنا مبسّط = الراتب الأساسي + البدلات الثابتة، بحد أقصى 45,000 ر.س
// سعودي: خصم الموظف 9.75% (تقاعد 9% + ساند 0.75%) + حصة صاحب العمل 11.75% (تقاعد 9% + أخطار مهنية 2% + ساند 0.75%)
// غير سعودي: مفيش خصم من الموظف، وصاحب العمل بيدفع بس فرع الأخطار المهنية 2%
// ⚠️ نسب تقريبية حسب آخر تحديث معلن لنظام التأمينات — راجع بوابة GOSI الرسمية للتأكد قبل الاعتماد عليها فعليًا
export const GOSI_WAGE_CAP = 45000;


export const GOSI_RATES = {
  "سعودي": { employee: 0.0975, employer: 0.1175 },
  "غير سعودي": { employee: 0, employer: 0.02 },
};


export function calcGosi(wageBasis, nationality) {
  const cappedWage = Math.min(+wageBasis || 0, GOSI_WAGE_CAP);
  const rates = GOSI_RATES[nationality] || GOSI_RATES["سعودي"];
  return {
    wageBasis: cappedWage,
    employeeDeduction: +(cappedWage * rates.employee).toFixed(2),
    employerContribution: +(cappedWage * rates.employer).toFixed(2),
  };
}



// 🆕 نسخة top-level من منطق "أي شفت متوقع لموظف في يوم معيّن" — نفس منطق getExpectedShift جوّه AttendanceModule
// (تناوب أول فالأول، بعدين رمضان لو فعّال، بعدين الجدول العادي) عشان نقدر نحسب التأخير والجُمع وقت صرف الراتب
export function getExpectedShiftForSalary(pharmacistName, dow, shiftNumber, dateStr, { workSchedules, rotationSchedules }) {
  // ⚠️ ملحوظة: النسخة دي بتعتمد على الجدول الثابت (work_schedules) + رمضان بس، ومبتاخدش في الاعتبار
  // شفتات التناوب الدوري (rotation_schedules) لأن منطق تحديد "صاحب الدور" مرتبط بحالة داخلية في
  // موديول الحضور. لو عندك صيادلة شغالين بنظام تناوب، تأخيرهم المحسوب هنا ممكن يبقى غير دقيق —
  // راجعه يدويًا في فورم الصرف قبل التأكيد.
  const ramadanActive = isRamadan();
  if (ramadanActive) {
    const ramadanMatch = (workSchedules || []).find(
      (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off && s.is_ramadan
    );
    if (ramadanMatch) return ramadanMatch;
  }
  return (workSchedules || []).find(
    (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off && !s.is_ramadan
  );
}


export function calcLateMinutesForSalary(pharmacistName, shiftNum, checkInTime, ctx) {
  const schedule = getExpectedShiftForSalary(pharmacistName, new Date(checkInTime).getDay(), shiftNum, checkInTime.slice(0, 10), ctx);
  if (!schedule) return 0;
  const [expH, expM] = schedule.shift_start.split(":").map(Number);
  const expected = new Date(checkInTime);
  expected.setHours(expH, expM, 0, 0);
  const actual = new Date(checkInTime);
  const diff = Math.round((actual.getTime() - expected.getTime()) / 60000);
  const grace = +schedule.grace_minutes || 0;
  return Math.max(0, diff - grace);
}


// 🆕 إحصائيات حضور موظف خلال شهر: إجمالي دقائق التأخير + عدد أيام الجمعة اللي حضر فيها فعليًا (يوم 5 = الجمعة)
export function computeMonthlyAttendanceStats(pharmacistName, monthKey, ctx, staffUserId) {
  const { attendanceLogs = [] } = ctx || {};
  const logMatchesStaff = (l) => staffUserId ? l.pharmacist_user_id === staffUserId : l.pharmacist_name === pharmacistName;
  const myLogs = attendanceLogs.filter((l) => logMatchesStaff(l) && l.date && l.date.startsWith(monthKey) && l.check_in);
  let lateMinutes = 0;
  let fridaysWorked = 0;
  const countedFridayDates = new Set();
  for (const log of myLogs) {
    // 🆕 الأولوية للقيمة المحفوظة على السجل وقت تسجيل الحضور نفسه — لأنها محسوبة بمنطق getExpectedShift الكامل
    // في AttendanceModule (بياخد التناوب الدوري في الاعتبار). إعادة الحساب هنا (calcLateMinutesForSalary)
    // بتتجاهل التناوب، فكانت بترجّع صفر غلط لأي موظف شغال بنظام تناوب. بنرجع لإعادة الحساب بس لو السجل قديم
    // ومفيهوش قيمة محفوظة أصلاً.
    lateMinutes += (log.late_minutes != null ? log.late_minutes : calcLateMinutesForSalary(pharmacistName, log.shift_number || 1, log.check_in, ctx));
    const dow = new Date(log.check_in).getDay(); // 5 = الجمعة
    if (dow === 5 && log.check_out && !countedFridayDates.has(log.date)) {
      countedFridayDates.add(log.date);
      fridaysWorked += 1;
    }
  }
  return { lateMinutes, fridaysWorked, daysWorked: myLogs.filter((l) => l.check_out).length };
}



// 🆕 إجمالي ساعات الدوام الأسبوعية المجدولة لموظف من work_schedules — بيُستخدم لحساب معدل الأجر
// الساعي الفعلي بدل افتراض ثابت (8 ساعات)، عشان موظف شفته 6 ساعات ميتحاسبش بمعدل موظف شفته 9 ساعات
export function calcWeeklyScheduledHours(pharmacistName, workSchedules) {
  const ramadanActive = isRamadan();
  const rows = (workSchedules || []).filter(
    (s) => s.pharmacist_name === pharmacistName && !s.is_off && !!s.is_ramadan === ramadanActive
  );
  return rows.reduce((sum, s) => {
    if (!s.shift_start || !s.shift_end) return sum;
    const [sh, sm] = s.shift_start.split(":").map(Number);
    const [eh, em] = s.shift_end.split(":").map(Number);
    return sum + Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
  }, 0);
}



// 🆕 حساب عمولة التحفيز الشهرية لموظف واحد بالاسم — نفس منطق تاب "التارجت" (نسخة مبسطة لموظف واحد
// بدل كل الموظفين، عشان تُستخدم في شاشة صرف الراتب لسحب العمولة تلقائيًا من غير تكرار الحساب الكامل).
export function computeStaffCommissionForMonth(staffName, monthKey, ctx, staffUserId) {
  const { sales = [], returns = [], products = [], tiers = [], tierThresholdHistory = [], incentiveOverrides = [], incentiveList = [], allowedCategories = [] } = ctx || {};
  // 🆕 لو الموظف مرتبط بحساب دخول (user_id)، نطابق بالـ ID المستقر بدل الاسم (اللي ممكن يتغيّر أو يتكرر بين موظفين).
  // لو مش مرتبط، بنرجع للطريقة القديمة (تطابق الاسم) عشان السجلات القديمة أو الموظفين اللي لسه من غير ربط.
  const saleMatchesStaff = (s) => staffUserId ? s.cashier_user_id === staffUserId : (s.cashier_name || "غير محدد") === staffName;
  const matchTierForMargin = (margin, category, atTime) => {
    if (margin === null) return null;
    if (allowedCategories.length > 0 && !allowedCategories.includes(category)) return null;
    let best = null;
    for (const t of tiers) {
      const effectiveThreshold = tierThresholdHistory.length > 0
        ? (tierThresholdHistory.filter((h) => h.tier_id === t.id && h.effective_from <= atTime).at(-1)?.threshold ?? t.threshold)
        : t.threshold;
      if (margin >= effectiveThreshold && (!best || effectiveThreshold > best.threshold)) {
        best = { ...t, threshold: effectiveThreshold };
      }
    }
    return best;
  };
  const matchTierForSaleItem = (item, atTime) => {
    const price = item.price || 0, cost = item.cost || 0;
    if (!cost || !price) return null;
    const margin = ((price - cost) / price) * 100;
    const category = item.category || products.find((p) => p.id === item.id)?.main_category || products.find((p) => p.id === item.id)?.category || "";
    return matchTierForMargin(margin, category, atTime);
  };
  const excludedIds = new Set(incentiveOverrides.filter((o) => o.type === "exclude").map((o) => o.product_id));
  const includedOverrides = incentiveOverrides.filter((o) => o.type === "include");
  const commissionForItem = (item, saleDateTime, qty) => {
    const amt = (item.price || 0) * qty;
    const manualEntry = incentiveList.find((i) => i.product_id === item.id);
    if (manualEntry) return manualEntry.rate ? amt * manualEntry.rate / 100 : (+manualEntry.fixed_amount || 0) * qty;
    if (excludedIds.has(item.id)) return 0;
    let tier = matchTierForSaleItem(item, saleDateTime);
    if (!tier) {
      const inc = includedOverrides.find((o) => o.product_id === item.id);
      if (inc) tier = tiers.find((t) => t.id === inc.tier_id);
    }
    return tier ? amt * tier.rate / 100 : 0;
  };
  const salesById = {};
  sales.forEach((s) => { salesById[s.id] = s; });
  let commission = 0, total = 0;
  sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned && saleMatchesStaff(s))
    .forEach((s) => {
      const saleDateTime = s.created_at || s.date + "T00:00:00.000Z";
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      items.forEach((item) => {
        const qty = item.qty || 1;
        const c = commissionForItem(item, saleDateTime, qty);
        if (c <= 0) return;
        total += (item.price || 0) * qty;
        commission += c;
      });
    });
  (returns || []).filter((r) => r.type === "sales" && r.date?.startsWith(monthKey)).forEach((r) => {
    const originalSale = salesById[r.invoice_id];
    if (!originalSale || originalSale.returned) return;
    if (!saleMatchesStaff(originalSale)) return;
    const saleDateTime = originalSale.created_at || (originalSale.date + "T00:00:00.000Z");
    const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
    items.forEach((ri) => {
      const qty = ri.returnQty || 0;
      if (qty <= 0) return;
      const c = commissionForItem(ri, saleDateTime, qty);
      if (c <= 0) return;
      total -= (ri.price || 0) * qty;
      commission -= c;
    });
  });
  return { total, commission };
}
