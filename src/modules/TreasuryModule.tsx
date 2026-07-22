import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { toLocaleString } from "../function toLocaleString() { [native code] }/undefined";
import { AUDIT_ENTITY_LABELS, logAudit } from "../lib/auditLog";
import { todayLocal } from "../lib/dateUtils";
import { calcEndOfServiceBenefit, calcGosi, calcLeaveBalanceDays, calcWeeklyScheduledHours, computeMonthlyAttendanceStats, computeStaffCommissionForMonth } from "../lib/hrUtils";
import { computeAvailableForPayment, computeTreasuryBalance } from "../lib/treasuryUtils";
import { Btn, Input, Modal, Select } from "../ui/primitives";

// ==================== TREASURY MODULE ====================
export function TreasuryModule({ sales, creditPayments, purchases, suppliers, pharmacyId, currentUser, users = [], showToast, shifts, entries, setEntries, returns = [], products = [], canViewSub = (_sub) => true, canEditSub = (_sub) => true, canAddSub = (_sub) => true, canDeleteSub = (_sub) => true }) {
  const canViewDayClosing = canViewSub("day_closing");
  const canEditDayClosing = canEditSub("day_closing");
  const canViewOverview   = canViewSub("overview");
  const canEditOverview   = canEditSub("overview");
  // 🆕 صلاحيات دقيقة على زر إظهار/إخفاء أرقام الكروت العلوية، وعلى المصاريف الثابتة والتراخيص
  const canToggleBalances     = canViewSub("balance_visibility");
  const canAddFixedExpense    = canAddSub("fixed_expenses");
  const canPayFixedExpense    = canEditSub("fixed_expenses");
  const canDeleteFixedExpense = canDeleteSub("fixed_expenses");
  const canAddLicense         = canAddSub("licenses");
  const canPayLicense         = canEditSub("licenses");
  const [activeTab, setActiveTab] = useState(canViewDayClosing ? "today" : canViewOverview ? "shifts" : "today");
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [hideBalances, setHideBalances] = useState(false); // 🆕 إخفاء/إظهار أرقام الكروت العلوية للخزنة
  // 🆕 رصيد أول المدة للخزنة (نقدي/بطاقة/تحويل) — بيتسجل كقيد دخل عادي في treasury_entries
  const canAddOpeningBalance = canAddSub("opening_balance");
  const [showOpeningBalanceForm, setShowOpeningBalanceForm] = useState(false);
  const [savingOpeningBalance, setSavingOpeningBalance] = useState(false);
  const [openingBalanceForm, setOpeningBalanceForm] = useState({
    method: "نقدي",
    amount: "",
    source: "تمويل",
    source_other: "",
    note: "",
    date: todayLocal(),
    proof: null,
  });
  const openingBalanceHistory = (entries || [])
    .filter((e) => e.pharmacy_id === pharmacyId && e.sub_type === "opening_balance")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const saveOpeningBalance = async () => {
    const amount = +openingBalanceForm.amount;
    if (!amount || amount <= 0) { showToast("يرجى إدخال مبلغ صحيح", "error"); return; }
    setSavingOpeningBalance(true);
    let proofUrl = "";
    if (openingBalanceForm.proof) {
      const fileName = `opening_balance/${pharmacyId}_${Date.now()}_${openingBalanceForm.proof.name}`;
      const { error: uploadError } = await supabase.storage.from("payment_reports").upload(fileName, openingBalanceForm.proof);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("payment_reports").getPublicUrl(fileName);
        proofUrl = urlData.publicUrl;
      }
    }
    const sourceLabel = openingBalanceForm.source === "أخرى" ? (openingBalanceForm.source_other || "أخرى") : openingBalanceForm.source;
    const payload = {
      type: "income",
      sub_type: "opening_balance",
      method: openingBalanceForm.method,
      amount,
      note: `رصيد أول المدة — المصدر: ${sourceLabel}${openingBalanceForm.note ? " — " + openingBalanceForm.note : ""}`,
      date: openingBalanceForm.date || todayLocal(),
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
      attachment_url: proofUrl || null,
    };
    const { data, error } = await supabase.from("treasury_entries").insert(payload).select();
    setSavingOpeningBalance(false);
    if (error) {
      showToast("❌ فشل حفظ رصيد أول المدة: " + error.message, "error");
      return;
    }
    if (data && data[0] && setEntries) setEntries((p) => [data[0], ...p]);
    setShowOpeningBalanceForm(false);
    setOpeningBalanceForm({ method: "نقدي", amount: "", source: "تمويل", source_other: "", note: "", date: todayLocal(), proof: null });
    showToast(`✅ تم تسجيل رصيد أول المدة — ${amount.toFixed(2)} ر.س`);
  };
  // ═══════════════════════════════════════════════════
  // 🆕 تسوية رصيد الخزنة — لتصحيح أي انحراف بين الرصيد المحسوب في النظام والرصيد الفعلي
  // (عمولات جهاز الشبكة، تصحيحات بنكية، بيانات قديمة اتنقلت من نظام تاني...) بدل التعديل
  // اليدوي المباشر في Supabase. بيتسجل كقيد فعلي (دخل لو الفعلي أعلى، مصروف لو أقل) مع سبب
  // إلزامي دايمًا، وسجل تاريخي كامل لكل تسوية حصلت.
  // ═══════════════════════════════════════════════════
  const canSettleBalance = canEditSub("balance_settlement");
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [settlementForm, setSettlementForm] = useState({ method: "نقدي", actual_balance: "", reason: "" });
  const settlementHistory = (entries || [])
    .filter((e) => e.pharmacy_id === pharmacyId && e.sub_type === "balance_settlement")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  // 🆕 بنستخدم computeTreasuryBalance مباشرة (مش calcBalance) لأنها لسه متعرفتش في الكود
  // في النقطة دي من الملف — نفس الدالة المشتركة بالظبط، بس من غير الاعتماد على ترتيب التعريف.
  const settlementCurrentBalance = computeTreasuryBalance(settlementForm.method, { sales, creditPayments, entries });
  const settlementActualNum = settlementForm.actual_balance === "" ? null : +settlementForm.actual_balance;
  const settlementDiff = settlementActualNum === null ? 0 : settlementActualNum - settlementCurrentBalance;
  const saveBalanceSettlement = async () => {
    if (settlementForm.actual_balance === "" || isNaN(+settlementForm.actual_balance)) {
      showToast("يرجى إدخال الرصيد الفعلي الصحيح", "error");
      return;
    }
    if (!settlementForm.reason.trim()) {
      showToast("يرجى كتابة سبب التسوية — إلزامي دايمًا", "error");
      return;
    }
    if (settlementDiff === 0) {
      showToast("الرصيد مطابق بالفعل — لا حاجة للتسوية", "warn");
      return;
    }
    setSavingSettlement(true);
    const payload = {
      type: settlementDiff > 0 ? "income" : "expense",
      sub_type: "balance_settlement",
      method: settlementForm.method,
      amount: Math.abs(settlementDiff),
      note: `تسوية رصيد الخزنة (${settlementForm.method}) — من ${settlementCurrentBalance.toFixed(2)} إلى ${settlementActualNum.toFixed(2)} — السبب: ${settlementForm.reason.trim()}`,
      date: todayLocal(),
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("treasury_entries").insert(payload).select();
    setSavingSettlement(false);
    if (error) {
      showToast("❌ فشل حفظ التسوية: " + error.message, "error");
      return;
    }
    if (data && data[0] && setEntries) setEntries((p) => [data[0], ...p]);
    setShowSettlementForm(false);
    setSettlementForm({ method: "نقدي", actual_balance: "", reason: "" });
    showToast(`✅ تمت تسوية الرصيد — ${settlementDiff > 0 ? "+" : ""}${settlementDiff.toFixed(2)} ر.س`);
  };
  const [licensePayAmount, setLicensePayAmount] = useState({}); // 🆕 مبلغ السداد القابل للتعديل لكل ترخيص { [licenseId]: "value" }
  const [licensePayMethod, setLicensePayMethod] = useState({}); // 🆕 طريقة السداد لكل ترخيص { [licenseId]: "نقدي" | "بطاقة" | "تحويل" }
  const [fixedPayMethod, setFixedPayMethod] = useState({}); // 🆕 طريقة السداد لكل مصروف ثابت { [expenseId]: "نقدي" | "بطاقة" | "تحويل" }
  const printRef = useRef(null);

  // 🆕 بيانات الصيدلية (اسم/عنوان/رقم ضريبي) لعرضها في رأس تقرير التقفيل المطبوع
  const [pharmInfo, setPharmInfo] = useState({ name: "", address: "", taxNumber: "" });
  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("pharmacy_settings").select("name_ar, address, tax_number").eq("pharmacy_id", pharmacyId).maybeSingle()
      .then(({ data }) => {
        if (data) setPharmInfo({ name: data.name_ar || "", address: data.address || "", taxNumber: data.tax_number || "" });
      });
  }, [pharmacyId]);

  const today = todayLocal();
  const monthKey = today.substring(0, 7);

  const [closingForm, setClosingForm] = useState({
    extra_income: "",
    extra_income_note: "",
    petty: "",
    petty_note: "",
    variable_expenses: [],
    fixed_paid: {},
    card_actual: "",
    card_adjust_reason: "",
  });
  const [editingCard, setEditingCard] = useState(false);
  const [closingSaved, setClosingSaved] = useState(false);
  // 🆕 نسخة كاملة من سجل التقفيل نفسه (مش بس boolean) عشان نعرف امتى اتقفل بالظبط
  const [closingRecord, setClosingRecord] = useState(null);
  useEffect(() => {
    if (!pharmacyId) return;
    const localClosing = (entries || []).find(
      (e) => e.date === today && e.pharmacy_id === pharmacyId && e.sub_type === "daily_closing"
    );
    if (localClosing) { setClosingSaved(true); setClosingRecord(localClosing); return; }
    supabase
      .from("treasury_entries")
      .select("id, created_at")
      .eq("pharmacy_id", pharmacyId)
      .eq("date", today)
      .eq("sub_type", "daily_closing")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) { setClosingSaved(true); setClosingRecord(data[0]); }
      });
  }, [entries, today, pharmacyId]);

  // ═══════════════════════════════════════════════════
  // 🆕 مبيعات/مرتجعات حصلت بعد ما تقفيل اليوم اتحفظ فعليًا
  // (زبون جه بعد التقفيل، صيدلي فتح شفت واستلم) — عشان تتلحق وتتضاف كتسوية
  // بدل ما تفضل غير محسوبة في التقفيل المحفوظ ولا في تقفيل يوم تاني
  // ═══════════════════════════════════════════════════
  const closingCreatedAt = closingRecord?.created_at ? new Date(closingRecord.created_at).getTime() : null;
  // 🆕 نقطة القياس (cursor) لازم تتحرك مع كل تسوية تتضاف، مش تفضل ثابتة عند وقت التقفيل الأصلي —
  // وإلا نفس الفواتير اللي اتسوّت هتفضل تظهر "معلّقة" تاني وتتضاف مرتين لو ضغطنا تسوية تاني.
  const lastAdjustmentAt = (entries || [])
    .filter((e) => e.pharmacy_id === pharmacyId && e.date === today && e.sub_type === "closing_adjustment" && e.created_at)
    .reduce((max, e) => Math.max(max, new Date(e.created_at).getTime()), 0);
  const postClosingCursor = closingCreatedAt ? Math.max(closingCreatedAt, lastAdjustmentAt) : null;
  // 🆕 المبيعات الجديدة بعد التقفيل: من غير استبعاد المرتجعة بالكامل (!s.returned) — لو فاتورة
  // اتباعت وترجعت كلها في نفس الفترة اللي بعد التقفيل، لازم قيمتها الأصلية تفضل هنا، والمرتجع
  // يتخصم مرة واحدة بس تحت من postClosingReturns (بتوقيت المرتجع نفسه مش الفاتورة).
  const postClosingSales = postClosingCursor
    ? (sales || []).filter(
        (s) => s.date === today && s.created_at && new Date(s.created_at).getTime() > postClosingCursor
      )
    : [];
  // 🆕 المرتجعات (كامل + جزئي) بعد التقفيل: بنستخدم جدول returns بتوقيت المرتجع نفسه (r.created_at)
  // مش تاريخ إنشاء الفاتورة الأصلية — كانت المشكلة قبل كده إن الكود بيفحص s.created_at (وقت البيع)
  // بدل وقت المرتجع الفعلي، فكان بيحصل خصم مزدوج (فاتورة اتباعت واترجعت بعد التقفيل تتشال من
  // postClosingSales بالكامل + تتحسب تاني بقيمتها الكاملة في postClosingReturns) أو العكس (مرتجع
  // لفاتورة قديمة قبل التقفيل مكانش بيتلحق خالص لأن وقت الفاتورة نفسه قبل الكيرسر).
  // بنستبعد: رجاعة الشبكة (بطاقة) لأنها مالهاش دخل بفلوس التقفيل المعلّقة، ومرتجع الآجل (refund_method=null)
  // لأنه بيترد كمديونية مباشرة من غير حركة كاش، ومرتجع النقد الافتتاحي لشفت جديد (محسوب على شفته هو).
  // 🆕 المرتجعات بعد التقفيل بتتسجل بمصروفها في الخزنة فورًا لحظة حصولها (بغض النظر عن حالة
  // التقفيل)، فمفيش داعي نطرحها من التسوية هنا تاني — غير كده هيحصل خصم مزدوج. التسوية دي
  // بقت مقصورة على المبيعات الجديدة فقط كدخل. بنسيب postClosingReturns للعرض الإعلامي بس.
  const postClosingReturns = postClosingCursor
    ? (returns || []).filter(
        (r) => r.type === "sales" && r.date === today && r.refund_source !== "shift" &&
          r.refund_method && r.refund_method !== "بطاقة" &&
          r.created_at && new Date(r.created_at).getTime() > postClosingCursor
      )
    : [];
  const postClosingSalesTotal = postClosingSales
    .filter((s) => s.payment !== "آجل")
    .reduce((a, s) => a + (s.total || 0), 0);
  const postClosingNet = postClosingSalesTotal;
  const hasPostClosingActivity = postClosingSales.length > 0;

  const [addingAdjustment, setAddingAdjustment] = useState(false);
  const addingAdjustmentRef = useRef(false); // 🆕 حماية فورية من الضغط المتكرر (state وحده مش كفاية لأن التحديث async)
  const addClosingAdjustment = async () => {
    if (!hasPostClosingActivity || postClosingNet === 0) return;
    if (addingAdjustmentRef.current) return; // 🆕
    // ⛔ نفس شرط تقفيل اليوم بالظبط: ما ينفعش نضيف تسوية والشفت لسه مفتوح —
    // لازم الصيدلي يقفل شفته الأول عشان نضمن إن كل مبيعات/مرتجعات الشفت اتلحقت في التسوية
    // ومفيش حركة هتحصل بعدها من غير ما تتسجل.
    // 🆕 بنفحص أي شفت مفتوح خالص بغض النظر عن تاريخ بدايته، مش بس اللي بدأ "النهاردة" —
    // لأن شفت اتفتح قبل نص الليل وفضل مفتوح بعده كان بيفوت من هذا الفحص ويسمح بالتقفيل غلط.
    const openShiftsNow = (shifts || []).filter((s) => !s.end_time);
    if (openShiftsNow.length > 0) {
      showToast(`❌ يوجد ${openShiftsNow.length} شفت مفتوح — أقفل الشفت أولاً قبل إضافة التسوية`, "error");
      return;
    }
    addingAdjustmentRef.current = true;
    setAddingAdjustment(true);
    const invoiceIds = postClosingSales.map((s) => s.id).join("، ");
    const payload = {
      type: "income",
      sub_type: "closing_adjustment",
      method: "نقدي",
      amount: postClosingNet,
      note: `تسوية مبيعات جديدة بعد تقفيل اليوم — فواتير: ${invoiceIds}`,
      date: today,
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("treasury_entries").insert(payload).select();
    setAddingAdjustment(false);
    addingAdjustmentRef.current = false; // 🆕
    if (error) {
      showToast("خطأ في إضافة تسوية التقفيل: " + error.message, "error");
      return;
    }
    if (data && data[0] && setEntries) setEntries((p) => [data[0], ...p]);
    showToast("✅ تمت إضافة التسوية لتقفيل اليوم");
  };

  // ═══════════════════════════════════════════════════
  // 🆕 مراجعة/تسوية أي يوم سابق مُقفّل — نفس فحص "حركة بعد التقفيل" فوق بالظبط،
  // بس مش مقصور على النهارده. اليوزر بيختار يوم من قائمة الأيام المقفولة، ولو فيه
  // مبيعات/مرتجعات حصلت بعد وقت التقفيل بتاع اليوم ده ولسه مش متضافة كتسوية، يقدر يضيفها.
  // ده بيسد الفجوة اللي كانت بتخلي فرق المطابقة في تقرير "السداد والمصروفات" يفضل عالق
  // لأيام فاتت من غير أي طريقة لتصليحه غير التعديل اليدوي في Supabase.
  // ═══════════════════════════════════════════════════
  const closedDaysList = Array.from(
    new Set((entries || []).filter((e) => e.pharmacy_id === pharmacyId && e.sub_type === "daily_closing").map((e) => e.date))
  ).sort().reverse();
  const [reviewDate, setReviewDate] = useState("");
  const reviewClosingRecord = reviewDate
    ? (entries || []).find((e) => e.pharmacy_id === pharmacyId && e.date === reviewDate && e.sub_type === "daily_closing")
    : null;
  const reviewClosingCreatedAt = reviewClosingRecord?.created_at ? new Date(reviewClosingRecord.created_at).getTime() : null;
  const reviewLastAdjustmentAt = (entries || [])
    .filter((e) => e.pharmacy_id === pharmacyId && e.date === reviewDate && e.sub_type === "closing_adjustment" && e.created_at)
    .reduce((max, e) => Math.max(max, new Date(e.created_at).getTime()), 0);
  const reviewPostClosingCursor = reviewClosingCreatedAt ? Math.max(reviewClosingCreatedAt, reviewLastAdjustmentAt) : null;
  const reviewPostClosingSales = reviewPostClosingCursor
    ? (sales || []).filter((s) => s.date === reviewDate && s.created_at && new Date(s.created_at).getTime() > reviewPostClosingCursor)
    : [];
  const reviewPostClosingReturns = reviewPostClosingCursor
    ? (returns || []).filter(
        (r) => r.type === "sales" && r.date === reviewDate && r.refund_source !== "shift" &&
          r.refund_method && r.refund_method !== "بطاقة" &&
          r.created_at && new Date(r.created_at).getTime() > reviewPostClosingCursor
      )
    : [];
  // 🆕 نفس منطق تسوية اليوم الحالي: المرتجعات متسجلة بمصروفها منفصل فورًا، فبنقتصر هنا على
  // قيمة المبيعات الجديدة فقط كدخل من غير طرح المرتجعات.
  const reviewPostClosingSalesTotal = reviewPostClosingSales.filter((s) => s.payment !== "آجل").reduce((a, s) => a + (s.total || 0), 0);
  const reviewPostClosingNet = reviewPostClosingSalesTotal;
  const reviewHasPostClosingActivity = reviewPostClosingSales.length > 0;
  const [addingReviewAdjustment, setAddingReviewAdjustment] = useState(false);
  const addingReviewAdjustmentRef = useRef(false);
  const addReviewClosingAdjustment = async () => {
    if (!reviewDate || !reviewHasPostClosingActivity || reviewPostClosingNet === 0) return;
    if (addingReviewAdjustmentRef.current) return;
    // 🆕 نفس قيد النهارده بالظبط: ما ينفعش نضيف تسوية والشفت لسه مفتوح، عشان نضمن كل حركة اتلحقت
    const openShiftsNow = (shifts || []).filter((s) => !s.end_time);
    if (openShiftsNow.length > 0) {
      showToast(`❌ يوجد ${openShiftsNow.length} شفت مفتوح — أقفل الشفت أولاً قبل إضافة التسوية`, "error");
      return;
    }
    addingReviewAdjustmentRef.current = true;
    setAddingReviewAdjustment(true);
    const invoiceIds = reviewPostClosingSales.map((s) => s.id).join("، ");
    const payload = {
      type: "income",
      sub_type: "closing_adjustment",
      method: "نقدي",
      amount: reviewPostClosingNet,
      note: `تسوية مبيعات جديدة بعد تقفيل يوم ${reviewDate} — فواتير: ${invoiceIds}`,
      date: reviewDate,
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("treasury_entries").insert(payload).select();
    setAddingReviewAdjustment(false);
    addingReviewAdjustmentRef.current = false;
    if (error) {
      showToast("خطأ في إضافة تسوية اليوم السابق: " + error.message, "error");
      return;
    }
    if (data && data[0] && setEntries) setEntries((p) => [data[0], ...p]);
    showToast(`✅ تمت إضافة التسوية لتقفيل يوم ${reviewDate}`);
  };

  const [loyaltyRedeemed, setLoyaltyRedeemed] = useState(0);

useEffect(() => {
  if (!pharmacyId) return;
  supabase
    .from("treasury_entries")
    .select("amount")
    .eq("pharmacy_id", pharmacyId)
    .eq("date", today)
    .eq("sub_type", "loyalty_redeem")
    .then(({ data }) => {
      if (data) setLoyaltyRedeemed(data.reduce((s, r) => s + (r.amount || 0), 0));
    });
}, [today, pharmacyId]);
  const [fixedForm, setFixedForm] = useState({ name: "", amount: "", due_day: "1", recurrence: "monthly", due_month: "1" });
  const [licenseForm, setLicenseForm] = useState({ name: "", renew_date: "", amount: "", note: "" });
  
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("fixed_expenses").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("licenses").select("*").eq("pharmacy_id", pharmacyId).order("renew_date"),
    ]).then(([f, l]) => {
      if (f.data) setFixedExpenses(f.data);
      if (l.data) setLicenses(l.data);
    });
  }, [pharmacyId]);

  // ═══════════════════════════════════════════════════
  // 🆕 نظام الرواتب — الموظفين، الدفعات الشهرية، رصيد الإجازات، وتسويات نهاية الخدمة
  // ═══════════════════════════════════════════════════
  const canAddEmployee    = canAddSub("salaries");
  const canEditEmployee   = canEditSub("salaries");
  const canDeleteEmployee = canDeleteSub("salaries");
  const canPaySalary      = canEditSub("salaries") || canAddSub("salaries");

  const [employees, setEmployees] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [leaveLedger, setLeaveLedger] = useState([]);
  const [eosSettlements, setEosSettlements] = useState([]);
  // بيانات التحفيز/التارجت — بنسحبها هنا كمان (بشكل خفيف) عشان نحسب عمولة كل صيدلي شهريًا تلقائيًا
  const [incentiveDataForSalary, setIncentiveDataForSalary] = useState({ tiers: [], tierThresholdHistory: [], incentiveOverrides: [], incentiveList: [], allowedCategories: [] });
  // 🆕 بيانات الحضور/الجدولة/التناوب — لحساب دقائق التأخير وعدد أيام الجمعة اللي اتشغّلت خلال الشهر تلقائيًا وقت صرف الراتب
  const [workSchedulesForSalary, setWorkSchedulesForSalary] = useState([]);
  const [rotationSchedulesForSalary, setRotationSchedulesForSalary] = useState([]);
  const [attendanceLogsForSalary, setAttendanceLogsForSalary] = useState([]);

  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("employees").select("*").eq("pharmacy_id", pharmacyId).order("created_at"),
      supabase.from("salary_payments").select("*").eq("pharmacy_id", pharmacyId).order("date", { ascending: false }),
      supabase.from("leave_ledger").select("*").eq("pharmacy_id", pharmacyId).order("date", { ascending: false }),
      supabase.from("end_of_service_settlements").select("*").eq("pharmacy_id", pharmacyId).order("date", { ascending: false }),
      supabase.from("incentive_tiers").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_tier_threshold_history").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_overrides").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_config").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
      supabase.from("work_schedules").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("rotation_schedules").select("*").eq("pharmacy_id", pharmacyId),
    ]).then(([emp, pay, leave, eos, tiersR, historyR, overridesR, prodsR, configR, schedR, rotR]) => {
      if (emp.data) setEmployees(emp.data);
      if (pay.data) setSalaryPayments(pay.data);
      if (leave.data) setLeaveLedger(leave.data);
      if (eos.data) setEosSettlements(eos.data);
      setIncentiveDataForSalary({
        tiers: (tiersR.data || []).map((r) => ({ id: r.id, threshold: r.margin_threshold, rate: r.rate })),
        tierThresholdHistory: historyR.data || [],
        incentiveOverrides: overridesR.data || [],
        incentiveList: prodsR.data || [],
        allowedCategories: configR.data?.allowed_categories || [],
      });
      if (schedR.data) setWorkSchedulesForSalary(schedR.data);
      if (rotR.data) setRotationSchedulesForSalary(rotR.data);
    });
  }, [pharmacyId]);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // null = إضافة جديد، وإلا الموظف الجاري تعديله
  const [employeeForm, setEmployeeForm] = useState({
    name: "", role: "عامل", hire_date: todayLocal(), base_salary: "", allowances: "", allowances_note: "",
    percentage_rate: "", leave_days_per_year: "21", note: "", nationality: "سعودي", gosi_enabled: true, friday_allowance_rate: "",
    user_id: "",
  });
  const employeeRoleLabel = { "صيدلي": "💊 صيدلي", "محاسب": "🧮 محاسب", "عامل": "🧰 عامل", "كاشير": "🧾 كاشير", "مخزن": "📦 مخزن", "أخرى": "👤 أخرى" };
  // 🆕 ربط الموظف (سجل الراتب) بحساب المستخدم بتاعه (تسجيل الدخول) — أساس نقل كل الجداول لاحقًا من الاسم للـ ID
  const linkedUserIds = new Set(employees.filter((e) => e.user_id && e.id !== editingEmployee?.id).map((e) => e.user_id));
  const availableUsersForLink = users.filter((u) => !linkedUserIds.has(u.id));
  const getLinkedUser = (emp) => users.find((u) => u.id === emp.user_id);

  const [payMonth, setPayMonth] = useState(todayLocal().slice(0, 7));
  // 🆕 نجيب سجلات الحضور بتاعة الشهر المختار بس (عشان الجدول ده ممكن يبقى كبير)
  useEffect(() => {
    if (!pharmacyId || !payMonth) return;
    supabase.from("attendance_logs").select("*")
      .eq("pharmacy_id", pharmacyId)
      .gte("date", payMonth + "-01")
      .lte("date", payMonth + "-31")
      .then(({ data }) => { if (data) setAttendanceLogsForSalary(data); });
  }, [pharmacyId, payMonth]);
  const [showPayForm, setShowPayForm] = useState(null); // employee object
  const [savingSalary, setSavingSalary] = useState(false);
  const [payForm, setPayForm] = useState({
    base_salary: "", allowances: "", percentage_amount: "", target_commission: "",
    other_addition: "", deduction_advance: "", deduction_advance_note: "",
    deduction_absence: "", deduction_absence_note: "", method: "نقدي", note: "", proof: null,
    gosi_employee_deduction: "", gosi_employer_contribution: "",
    friday_count: "", friday_allowance: "", late_minutes: "", deduction_lateness: "",
    actual_amount: "", // 🆕 المبلغ اللي هيتصرف فعليًا دلوقتي — قابل للتعديل المباشر، مش لازم يساوي مجموع التفاصيل
  });
  const [commissionSalesBasis, setCommissionSalesBasis] = useState(0); // 🆕 إجمالي مبيعات الصيدلي اللي احتُسبت عليها العمولة (للعرض فقط)

  const [showLeaveForm, setShowLeaveForm] = useState(null); // employee object
  const [leaveForm, setLeaveForm] = useState({ days: "", amount: "", note: "", type: "cashout" });
  const [savingLeave, setSavingLeave] = useState(false);

  const [showEosForm, setShowEosForm] = useState(null); // employee object
  const [eosForm, setEosForm] = useState({ termination_date: todayLocal(), termination_type: "normal", other_addition: "", other_deduction: "", other_deduction_note: "", method: "نقدي", note: "", proof: null });
  const [savingEos, setSavingEos] = useState(false);

  const getEmployeeLeaveLedger = (employeeId) => leaveLedger.filter((l) => l.employee_id === employeeId);
  const getEmployeeLeaveBalance = (emp, asOfDate) =>
    calcLeaveBalanceDays(emp.hire_date, emp.leave_days_per_year, getEmployeeLeaveLedger(emp.id), asOfDate);
  const getEmployeeSalaryPayments = (employeeId) => salaryPayments.filter((p) => p.employee_id === employeeId);
  const isPaidThisMonth = (employeeId, month) => salaryPayments.some((p) => p.employee_id === employeeId && p.month === month);
  // 🆕 إجمالي اللي اتصرف فعليًا للموظف ده في الشهر ده (ممكن يكون على أكتر من دفعة)
  const getPaidSumsThisMonth = (employeeId, month) => {
    const rows = salaryPayments.filter((p) => p.employee_id === employeeId && p.month === month);
    const sum = (key) => rows.reduce((s, r) => s + (+r[key] || 0), 0);
    return {
      base_salary: sum("base_salary"), allowances: sum("allowances"),
      target_commission: sum("target_commission"), friday_count: sum("friday_count"),
      friday_allowance: sum("friday_allowance"), late_minutes: sum("late_minutes"),
      deduction_lateness: sum("deduction_lateness"), gosi_employee_deduction: sum("gosi_employee_deduction"),
      gosi_employer_contribution: sum("gosi_employer_contribution"), net_amount: sum("net_amount"),
    };
  };
  // 🆕 إجمالي "المستحق" الكامل للموظف عن الشهر ده — نفس منطق فورم الصرف، لكن مستقل عنه عشان نقدر
  // نستخدمه في حساب "المتبقي" وفي بادج حالة الصرف في قائمة الموظفين من غير ما نفتح الفورم.
  const computeFullMonthlyDue = (emp) => {
    let autoCommission = 0, salesBasis = 0;
    if (emp.role === "صيدلي") {
      const { commission, total } = computeStaffCommissionForMonth(emp.name, payMonth, {
        sales, returns, products,
        tiers: incentiveDataForSalary.tiers,
        tierThresholdHistory: incentiveDataForSalary.tierThresholdHistory,
        incentiveOverrides: incentiveDataForSalary.incentiveOverrides,
        incentiveList: incentiveDataForSalary.incentiveList,
        allowedCategories: incentiveDataForSalary.allowedCategories,
      }, emp.user_id || null);
      autoCommission = Math.max(0, commission);
      salesBasis = total;
    }
    let gosiEmployee = 0, gosiEmployer = 0;
    if (emp.gosi_enabled !== false) {
      const gosi = calcGosi((+emp.base_salary || 0) + (+emp.allowances || 0), emp.nationality || "سعودي");
      gosiEmployee = gosi.employeeDeduction || 0;
      gosiEmployer = gosi.employerContribution || 0;
    }
    const attendanceStats = computeMonthlyAttendanceStats(emp.name, payMonth, {
      attendanceLogs: attendanceLogsForSalary, workSchedules: workSchedulesForSalary, rotationSchedules: rotationSchedulesForSalary,
    }, emp.user_id || null);
    const fridayRate = +emp.friday_allowance_rate || 0;
    const fridayAllowance = fridayRate * attendanceStats.fridaysWorked;
    const weeklyHours = calcWeeklyScheduledHours(emp.name, workSchedulesForSalary);
    const monthlyHours = weeklyHours > 0 ? weeklyHours * 4.345 : 26 * 8;
    const hourlyRate = ((+emp.base_salary || 0) + (+emp.allowances || 0)) / monthlyHours;
    const latenessDeduction = (attendanceStats.lateMinutes / 60) * hourlyRate;
    const base_salary = +emp.base_salary || 0, allowances = +emp.allowances || 0;
    const net_due = base_salary + allowances + autoCommission + fridayAllowance - gosiEmployee - latenessDeduction;
    return {
      base_salary, allowances, target_commission: autoCommission, salesBasis,
      friday_count: attendanceStats.fridaysWorked, friday_allowance: fridayAllowance,
      late_minutes: attendanceStats.lateMinutes, deduction_lateness: latenessDeduction,
      gosi_employee_deduction: gosiEmployee, gosi_employer_contribution: gosiEmployer,
      net_due,
    };
  };
  // 🆕 حالة صرف راتب الموظف عن الشهر المختار: لسه/جزئي/مكتمل + المتبقي
  const getEmployeeMonthPayStatus = (emp) => {
    const due = computeFullMonthlyDue(emp).net_due;
    const paid = getPaidSumsThisMonth(emp.id, payMonth).net_amount;
    const remaining = Math.max(0, +(due - paid).toFixed(2));
    const status = paid <= 0 ? "unpaid" : remaining <= 0.5 ? "full" : "partial"; // هامش 0.5 ر.س لفروق التقريب
    return { due, paid, remaining, status };
  };

  // ── حفظ/تعديل موظف ──
  const saveEmployee = async () => {
    if (!employeeForm.name || !employeeForm.hire_date) { showToast("يرجى إدخال الاسم وتاريخ التعيين", "error"); return; }
    // 🆕 حماية: نفس حساب المستخدم ميترّبطش بأكتر من موظف راتب واحد
    if (employeeForm.user_id) {
      const clash = employees.find((e) => e.user_id === employeeForm.user_id && e.id !== editingEmployee?.id);
      if (clash) { showToast(`❌ الحساب ده متربط بالفعل بالموظف "${clash.name}"`, "error"); return; }
    }
    const payload = {
      pharmacy_id: pharmacyId, name: employeeForm.name, role: employeeForm.role, hire_date: employeeForm.hire_date,
      base_salary: +employeeForm.base_salary || 0, allowances: +employeeForm.allowances || 0, allowances_note: employeeForm.allowances_note,
      percentage_rate: +employeeForm.percentage_rate || 0, leave_days_per_year: +employeeForm.leave_days_per_year || 21,
      note: employeeForm.note, active: true, nationality: employeeForm.nationality || "سعودي", gosi_enabled: !!employeeForm.gosi_enabled,
      friday_allowance_rate: +employeeForm.friday_allowance_rate || 0,
      user_id: employeeForm.user_id || null,
    };
    if (editingEmployee) {
      const { data, error } = await supabase.from("employees").update(payload).eq("id", editingEmployee.id).eq("pharmacy_id", pharmacyId).select();
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setEmployees((p) => p.map((e) => (e.id === editingEmployee.id ? data[0] : e)));
      showToast("تم تعديل بيانات الموظف ✓");
    } else {
      const { data, error } = await supabase.from("employees").insert(payload).select();
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setEmployees((p) => [...p, data[0]]);
      showToast("تم إضافة الموظف ✓");
    }
    setShowEmployeeForm(false);
    setEditingEmployee(null);
    setEmployeeForm({ name: "", role: "عامل", hire_date: todayLocal(), base_salary: "", allowances: "", allowances_note: "", percentage_rate: "", leave_days_per_year: "21", note: "", nationality: "سعودي", gosi_enabled: true, friday_allowance_rate: "", user_id: "" });
  };
  const deleteEmployee = async (emp) => {
    if (!confirm(`حذف الموظف "${emp.name}"؟ (السجل التاريخي للرواتب هيفضل موجود)`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", emp.id).eq("pharmacy_id", pharmacyId);
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setEmployees((p) => p.filter((e) => e.id !== emp.id));
    showToast("تم حذف الموظف");
  };

  // ── فتح فورم صرف الراتب: تعبئة تلقائية بالمتبقي (المستحق الكامل ناقص أي دفعات سابقة هذا الشهر) ──
  const openPayForm = (emp) => {
    const full = computeFullMonthlyDue(emp);
    setCommissionSalesBasis(full.salesBasis);
    const paidSoFar = getPaidSumsThisMonth(emp.id, payMonth);
    const remain = (key) => Math.max(0, full[key] - (paidSoFar[key] || 0));
    const remainNet = remain("base_salary") + remain("allowances") + remain("target_commission") + remain("friday_allowance") - remain("gosi_employee_deduction") - remain("deduction_lateness");
    setPayForm({
      base_salary: remain("base_salary").toFixed(2), allowances: remain("allowances").toFixed(2),
      percentage_amount: "", target_commission: remain("target_commission").toFixed(2),
      other_addition: "", deduction_advance: "", deduction_advance_note: "",
      deduction_absence: "", deduction_absence_note: "", method: "نقدي", note: "", proof: null,
      gosi_employee_deduction: remain("gosi_employee_deduction").toFixed(2), gosi_employer_contribution: remain("gosi_employer_contribution").toFixed(2),
      friday_count: String(Math.max(0, full.friday_count - (paidSoFar.friday_count || 0))), friday_allowance: remain("friday_allowance").toFixed(2),
      late_minutes: String(Math.max(0, full.late_minutes - (paidSoFar.late_minutes || 0))), deduction_lateness: remain("deduction_lateness").toFixed(2),
      actual_amount: Math.max(0, remainNet).toFixed(2),
    });
    setShowPayForm(emp);
  };

  const payNetTotal = () => {
    const add = (+payForm.base_salary || 0) + (+payForm.allowances || 0) + (+payForm.percentage_amount || 0) + (+payForm.target_commission || 0) + (+payForm.other_addition || 0) + (+payForm.friday_allowance || 0);
    const ded = (+payForm.deduction_advance || 0) + (+payForm.deduction_absence || 0) + (+payForm.gosi_employee_deduction || 0) + (+payForm.deduction_lateness || 0);
    return add - ded;
  };
  // 🆕 المبلغ الفعلي اللي هيتصرف (قابل للتعديل المباشر من اليوزر، ومش لازم يساوي مجموع التفاصيل فوق)
  const payActualAmount = () => +payForm.actual_amount || 0;

  // 🆕 طباعة إيصال صرف الراتب — يتطبع، الموظف يمضي عليه ورقيًا، وبعدين يتصور ويترفع في خانة "إثبات الصرف"
  const printSalaryReceipt = (emp) => {
    const net = payActualAmount();
    const rows = [
      ["الراتب الأساسي", payForm.base_salary],
      ["البدلات", payForm.allowances],
      ["مبلغ النسبة (%)", payForm.percentage_amount],
      ["عمولة تحفيز (تارجت)", payForm.target_commission],
      ["بدل الجُمع", payForm.friday_allowance],
      ["إضافات أخرى", payForm.other_addition],
      ["خصم سلفة" + (payForm.deduction_advance_note ? ` (${payForm.deduction_advance_note})` : ""), payForm.deduction_advance ? "-" + payForm.deduction_advance : ""],
      ["خصم غياب" + (payForm.deduction_absence_note ? ` (${payForm.deduction_absence_note})` : ""), payForm.deduction_absence ? "-" + payForm.deduction_absence : ""],
      ["خصم تأخير (" + (payForm.late_minutes || 0) + " دقيقة)", payForm.deduction_lateness ? "-" + payForm.deduction_lateness : ""],
      ["خصم التأمينات (GOSI)", payForm.gosi_employee_deduction ? "-" + payForm.gosi_employee_deduction : ""],
    ].filter((r) => +String(r[1]).replace("-", "") > 0);
    const html = `
      <html dir="rtl" lang="ar"><head><meta charset="utf-8" />
      <title>إيصال صرف راتب — ${emp.name}</title>
      <style>
        body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .sub { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { padding: 6px 4px; border-bottom: 1px solid #ddd; font-size: 13px; }
        .net { display: flex; justify-content: space-between; margin-top: 14px; padding: 10px; background: #f4f4f4; border-radius: 6px; font-weight: bold; font-size: 15px; }
        .sign { display: flex; justify-content: space-between; margin-top: 60px; }
        .sign div { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; text-align: center; }
        @media print { @page { margin: 16mm; } }
      </style></head>
      <body>
        <h1>إيصال صرف راتب</h1>
        <div class="sub">الموظف: ${emp.name} (${emp.role}) &nbsp;|&nbsp; الشهر: ${payMonth} &nbsp;|&nbsp; تاريخ الصرف: ${todayLocal()} &nbsp;|&nbsp; طريقة الصرف: ${payForm.method}</div>
        <table>${rows.map(([label, val]) => `<tr><td>${label}</td><td style="text-align:left">${val} ر.س</td></tr>`).join("")}</table>
        <div class="net"><span>صافي المبلغ المستلم</span><span>${net.toFixed(2)} ر.س</span></div>
        ${payForm.note ? `<div class="sub" style="margin-top:10px">ملاحظة: ${payForm.note}</div>` : ""}
        <div class="sign">
          <div>توقيع المستلم (${emp.name})</div>
          <div>توقيع المسؤول</div>
        </div>
      </body></html>`;
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { showToast("امنع المتصفح النافذة المنبثقة — اسمح بها وجرّب تاني", "error"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const saveSalaryPayment = async (emp) => {
    const net = payActualAmount();
    if (net <= 0) { showToast("المبلغ المصروف لازم يكون أكبر من صفر", "error"); return; }
    // 🆕 قيد: لازم رصيد الخزنة بطريقة الدفع المختارة يكفي المبلغ قبل ما نأكد الصرف
    // (بطاقة وتحويل بيتجمّعوا كرصيد بنكي واحد للفحص، لأنهم فعليًا نفس المحفظة)
    const salaryMethod = payForm.method || "نقدي";
    const availableForSalary = computeAvailableForPayment(salaryMethod, { sales, creditPayments, entries });
    if (net > availableForSalary) {
      const availLabel = (salaryMethod === "بطاقة" || salaryMethod === "تحويل") ? "بطاقة + تحويل" : salaryMethod;
      showToast(`❌ رصيد الخزنة (${availLabel}) لا يكفي — المتاح ${availableForSalary.toFixed(2)} ر.س والمطلوب ${net.toFixed(2)} ر.س`, "error");
      return;
    }
    setSavingSalary(true);
    let proofUrl = "";
    if (payForm.proof) {
      const fileName = `salaries/${emp.id}_${payMonth}_${Date.now()}_${payForm.proof.name}`;
      const { error: uploadError } = await supabase.storage.from("payment_reports").upload(fileName, payForm.proof);
      if (!uploadError) { const { data: urlData } = supabase.storage.from("payment_reports").getPublicUrl(fileName); proofUrl = urlData.publicUrl; }
    }
    const payload = {
      pharmacy_id: pharmacyId, employee_id: emp.id, month: payMonth,
      base_salary: +payForm.base_salary || 0, allowances: +payForm.allowances || 0,
      percentage_amount: +payForm.percentage_amount || 0, target_commission: +payForm.target_commission || 0,
      other_addition: +payForm.other_addition || 0,
      deduction_advance: +payForm.deduction_advance || 0, deduction_advance_note: payForm.deduction_advance_note,
      deduction_absence: +payForm.deduction_absence || 0, deduction_absence_note: payForm.deduction_absence_note,
      gosi_employee_deduction: +payForm.gosi_employee_deduction || 0, gosi_employer_contribution: +payForm.gosi_employer_contribution || 0,
      friday_count: +payForm.friday_count || 0, friday_allowance: +payForm.friday_allowance || 0,
      late_minutes: +payForm.late_minutes || 0, deduction_lateness: +payForm.deduction_lateness || 0,
      net_amount: net, method: payForm.method, note: payForm.note, attachment_url: proofUrl || null,
      date: todayLocal(), created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("salary_payments").insert(payload).select();
    if (error) { setSavingSalary(false); showToast("❌ فشل حفظ الراتب: " + error.message, "error"); return; }
    const gosiNote = (+payForm.gosi_employee_deduction || 0) > 0 ? ` (بعد خصم تأمينات ${(+payForm.gosi_employee_deduction).toFixed(2)} ر.س)` : "";
    const fridayNote = (+payForm.friday_allowance || 0) > 0 ? ` + بدل ${payForm.friday_count} جمعة` : "";
    const latenessNote = (+payForm.deduction_lateness || 0) > 0 ? ` - خصم تأخير ${payForm.late_minutes} دقيقة` : "";
    const trPayload = {
      type: "expense", sub_type: "salary", method: payForm.method, amount: net,
      note: `راتب ${emp.name} (${emp.role}) — شهر ${payMonth}${gosiNote}${fridayNote}${latenessNote}`,
      date: todayLocal(), pharmacy_id: pharmacyId, created_by: currentUser?.name || "", employee_id: emp.id,
    };
    const { data: trData, error: trError } = await supabase.from("treasury_entries").insert(trPayload).select();
    setSavingSalary(false);
    if (trError) { showToast("تم حفظ الراتب لكن فشل تحديث الخزنة: " + trError.message, "error"); }
    else if (trData && trData[0] && setEntries) setEntries((p) => [trData[0], ...p]);
    setSalaryPayments((p) => [data[0], ...p]);
    setShowPayForm(null);
    showToast(`✅ تم صرف راتب ${emp.name} — ${net.toFixed(2)} ر.س`);
  };

  // ── تصرف رصيد إجازة (نقدًا) ──
  const saveLeaveCashout = async (emp) => {
    const days = +leaveForm.days || 0;
    const amount = +leaveForm.amount || 0;
    if (days <= 0) { showToast("يرجى إدخال عدد أيام صحيح", "error"); return; }
    setSavingLeave(true);
    const payload = {
      pharmacy_id: pharmacyId, employee_id: emp.id, date: todayLocal(), type: leaveForm.type,
      days, amount, note: leaveForm.note, created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("leave_ledger").insert(payload).select();
    if (error) { setSavingLeave(false); showToast("خطأ: " + error.message, "error"); return; }
    setLeaveLedger((p) => [data[0], ...p]);
    if (leaveForm.type === "cashout" && amount > 0) {
      const trPayload = {
        type: "expense", sub_type: "leave_cashout", method: "نقدي", amount,
        note: `صرف بدل إجازة نقدًا — ${emp.name} (${days} يوم)`,
        date: todayLocal(), pharmacy_id: pharmacyId, created_by: currentUser?.name || "", employee_id: emp.id,
      };
      const { data: trData, error: trError } = await supabase.from("treasury_entries").insert(trPayload).select();
      if (trError) showToast("تم تسجيل الإجازة لكن فشل تحديث الخزنة: " + trError.message, "error");
      else if (trData && trData[0] && setEntries) setEntries((p) => [trData[0], ...p]);
    }
    setSavingLeave(false);
    setShowLeaveForm(null);
    setLeaveForm({ days: "", amount: "", note: "", type: "cashout" });
    showToast("✅ تم تسجيل حركة الإجازة");
  };

  // ── تسوية نهاية الخدمة ──
  const previewEos = (emp) => {
    const wage = (+emp.base_salary || 0) + (+emp.allowances || 0);
    const eosb = calcEndOfServiceBenefit(emp.hire_date, eosForm.termination_date, wage, eosForm.termination_type);
    const leaveBalance = getEmployeeLeaveBalance(emp, eosForm.termination_date);
    const dailyWage = wage / 30;
    const leaveCashout = leaveBalance * dailyWage;
    const net = eosb.netAmount + leaveCashout + (+eosForm.other_addition || 0) - (+eosForm.other_deduction || 0);
    return { wage, eosb, leaveBalance, leaveCashout, net };
  };
  const saveEosSettlement = async (emp) => {
    const preview = previewEos(emp);
    if (preview.net < 0) { showToast("صافي التسوية بالسالب — راجع البيانات", "error"); return; }
    setSavingEos(true);
    let proofUrl = "";
    if (eosForm.proof) {
      const fileName = `eos_settlements/${emp.id}_${Date.now()}_${eosForm.proof.name}`;
      const { error: uploadError } = await supabase.storage.from("payment_reports").upload(fileName, eosForm.proof);
      if (!uploadError) { const { data: urlData } = supabase.storage.from("payment_reports").getPublicUrl(fileName); proofUrl = urlData.publicUrl; }
    }
    const payload = {
      pharmacy_id: pharmacyId, employee_id: emp.id, termination_date: eosForm.termination_date,
      termination_type: eosForm.termination_type, years_of_service: preview.eosb.years,
      wage_basis: preview.wage, eosb_amount: preview.eosb.netAmount, leave_days_cashed: preview.leaveBalance,
      leave_cashout_amount: preview.leaveCashout, other_addition: +eosForm.other_addition || 0,
      other_deduction: +eosForm.other_deduction || 0, other_deduction_note: eosForm.other_deduction_note,
      net_amount: preview.net, method: eosForm.method, note: eosForm.note, attachment_url: proofUrl || null,
      date: todayLocal(), created_by: currentUser?.name || "",
    };
    const { data, error } = await supabase.from("end_of_service_settlements").insert(payload).select();
    if (error) { setSavingEos(false); showToast("❌ فشل حفظ التسوية: " + error.message, "error"); return; }
    if (preview.net > 0) {
      const trPayload = {
        type: "expense", sub_type: "end_of_service", method: eosForm.method, amount: preview.net,
        note: `تسوية نهاية خدمة — ${emp.name} (${preview.eosb.years.toFixed(1)} سنة خدمة)`,
        date: todayLocal(), pharmacy_id: pharmacyId, created_by: currentUser?.name || "", employee_id: emp.id,
      };
      const { data: trData, error: trError } = await supabase.from("treasury_entries").insert(trPayload).select();
      if (trError) showToast("تم حفظ التسوية لكن فشل تحديث الخزنة: " + trError.message, "error");
      else if (trData && trData[0] && setEntries) setEntries((p) => [trData[0], ...p]);
    }
    await supabase.from("employees").update({ active: false, termination_date: eosForm.termination_date }).eq("id", emp.id).eq("pharmacy_id", pharmacyId);
    setEmployees((p) => p.map((e) => (e.id === emp.id ? { ...e, active: false, termination_date: eosForm.termination_date } : e)));
    setEosSettlements((p) => [data[0], ...p]);
    setSavingEos(false);
    setShowEosForm(null);
    showToast(`✅ تمت تسوية نهاية الخدمة — صافي ${preview.net.toFixed(2)} ر.س`);
  };

  // ── حسابات مساعدة ──
  const activeEmployees = employees.filter((e) => e.active !== false);
  const unpaidThisMonth = activeEmployees.filter((e) => getEmployeeMonthPayStatus(e).status !== "full");
  const monthSalaryTotal = salaryPayments.filter((p) => p.month === payMonth).reduce((a, p) => a + (p.net_amount || 0), 0);

  // ── حسابات المبيعات مقسمة ──
  // 🆕 النقدي/البطاقة/التحويل ما بتُستبعدش هنا حتى لو اترجعت بالكامل — قيمتها الأصلية لازم تفضل
  // في الإجمالي، والمرتجع بيتخصم مرة واحدة بس تحت (todayReturns من treasury_entries). لو استبعدناها
  // هنا كمان بيبقى فيه خصم مزدوج (الفاتورة تتشال بالكامل + قيمتها تتخصم تاني من المرتجعات).
  // الآجل مختلف: مفيش حركة خزنة فعلية عند مرتجعه (مديونيته بترجع صفر مباشرة عبر credit_payments)،
  // فبيفضل مستبعد زي ما كان عشان مايفضلش ظاهر كمديونية مستحقة وهو أصلاً اترجع.
  const todaySales = sales.filter((s) => s.date === today && (s.payment === "آجل" ? !s.returned : true));
  const todayCash = todaySales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0);
  const todayCard = todaySales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
  const todayTransfer = todaySales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
  const todayAjil = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayCreditIncome = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todayReturns = (entries || []).filter(
  (e) => e.date === today && e.type === "expense" && e.sub_type === "sales_return"
).reduce((a, e) => a + e.amount, 0);
  const todaySalesIncome = todayCash + todayCard + todayTransfer + todayCreditIncome - todayReturns;

  // ── رصيد الخزنة اللحظي من كل السجلات ──
  // 🆕 نفس الحساب دلوقتي مستخرج في computeTreasuryBalance (دالة مشتركة) عشان شاشات تانية
  // (زي سداد الموردين) تقدر تتحقق منه كمان قبل ما تسمح بالسداد.
  const calcBalance = (method) => computeTreasuryBalance(method, { sales, creditPayments, entries });

  const balanceCash = calcBalance("نقدي");
  const balanceCard = calcBalance("بطاقة");
  const balanceTransfer = calcBalance("تحويل");
  const balanceTotal = balanceCash + balanceCard + balanceTransfer;

  // ── تقفيل الشفتات ──
  const todayShifts = shifts.filter((s) => s.start_time?.startsWith(today));

  // 🆕 مرتجعات كل شفت — بنربط كل سطر في جدول returns بالفاتورة الأصلية (invoice_id) عشان نعرف شفتها
  const salesById = (sales || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
  // 🆕 refund_method بيبقى null لمرتجعات فواتير الآجل (مفيش رجّاعة كاش/بطاقة فعلية، بيترد كمديونية
  // مباشرة) — نستبعدها هنا عشان ماتخصمش غلط من إجمالي الكاش/البطاقة/التحويل لكل شفت.
  const todayReturnsSales = (returns || []).filter((r) => r.type === "sales" && r.date === today && r.refund_method !== null);
  // 🆕 إجمالي مرتجعات اليوم (كامل + جزئي) عشان يتخصم من "إجمالي اليوم" في الخزنة، بنفس منطق كل شفت
  const todayReturnsSalesTotal = todayReturnsSales.reduce((a, r) => a + (r.total || 0), 0);
  const getShiftReturns = (shiftId) =>
    todayReturnsSales
      .filter((r) => salesById[r.invoice_id]?.shift === shiftId)
      .reduce((a, r) => a + (r.total || 0), 0);

  const getShiftSales = (shiftId) => {
    const shiftSales = todaySales.filter((s) => s.shift === shiftId);
    const shiftReturns = getShiftReturns(shiftId);
    const grossTotal = shiftSales.filter((s) => s.payment !== "آجل").reduce((a, s) => a + s.total, 0);
    return {
      cash: shiftSales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0),
      card: shiftSales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0),
      transfer: shiftSales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0),
      ajil: shiftSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0),
      returns: shiftReturns, // 🆕 إجمالي مرتجعات الشفت (كامل + جزئي) من جدول returns
      total: grossTotal - shiftReturns, // 🆕 صافي بعد خصم المرتجعات
      count: shiftSales.length,
    };
  };

  // ── حسابات المصروفات ──
  const variableTotal = closingForm.variable_expenses.reduce((a, e) => a + (+e.amount || 0), 0);
  const fixedPaidTotal = fixedExpenses.filter((f) => closingForm.fixed_paid[f.id]).reduce((a, f) => a + f.amount, 0);
  const totalExpenses = (+closingForm.petty || 0) + variableTotal + loyaltyRedeemed;
  // ── تعديل مبيعات البطاقة الفعلية وتسوية الفرق في الكاش ──
  const hasCardAdjust = closingForm.card_actual !== "" && !isNaN(+closingForm.card_actual);
  const cardActual = hasCardAdjust ? +closingForm.card_actual : todayCard;
  const cardDiff = hasCardAdjust ? cardActual - todayCard : 0; // موجب = البطاقة زادت عن المحسوب (الكاش ينقص بنفس القيمة)
  const cashAfterAdjust = todayCash + todayCreditIncome - cardDiff;

  const totalIncome = todaySalesIncome + (+closingForm.extra_income || 0);
  const netCash = totalIncome - totalExpenses;

  // ── حساب القسط الشهري الفعلي حسب نوع التكرار ──
  const recurrenceDivisor = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
  const monthlyShare = (f) => (+f.amount || 0) / (recurrenceDivisor[f.recurrence || "monthly"] || 1);
  const monthFixedTotal = fixedExpenses.reduce((a, f) => a + monthlyShare(f), 0);

  const currentDay = new Date().getDate();
  const currentMonthNum = new Date().getMonth() + 1;
  // ── هل المصروف مستحق فعليًا في الشهر الحالي؟ (يأخذ التكرار في الاعتبار) ──
  const isDueThisMonth = (f) => {
    const rec = f.recurrence || "monthly";
    if (rec === "monthly") return true;
    const interval = recurrenceDivisor[rec] || 1;
    const startMonth = +f.due_month || 1;
    const diff = (currentMonthNum - startMonth + 12) % interval;
    return diff === 0;
  };
  const dueFixed = fixedExpenses.filter((f) => isDueThisMonth(f) && Math.abs(+f.due_day - currentDay) <= 3);
  const recurrenceLabel = { monthly: "شهري", quarterly: "ربع سنوي", semi_annual: "نصف سنوي", annual: "سنوي" };

  const upcomingLicenses = licenses.filter((l) => {
    const days = (new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  });

  // ── حفظ التقفيل ──
  // 🆕 نفس التصحيح: أي شفت مفتوح (مش بس اللي بدأ النهاردة) بيمنع تقفيل اليوم —
  // ده اللي بيضمن إن شفت عدّى نص الليل يتقفل هو الأول قبل ما نقدر نقفل يوم جديد فوقه.
  const openShifts = (shifts || []).filter((s) => !s.end_time);

  const [savingClosing, setSavingClosing] = useState(false); // 🆕 يمنع تكرار حفظ التقفيل لو المستخدم دوس مرتين بسرعة
  const savingClosingRef = useRef(false); // 🆕 حماية فورية (state وحده مش كفاية لأن التحديث async)
  const saveClosing = async () => {
    if (savingClosingRef.current) return; // 🆕 حماية من الضغط المزدوج
    savingClosingRef.current = true;
    setSavingClosing(true);
    try {
    // تحقق إن كل شفتات اليوم متقفلة
    if (openShifts.length > 0) {
      showToast(`❌ يوجد ${openShifts.length} شفت مفتوح — أقفل الشفتات أولاً`, "error");
      return;
    }
    const rows = [];
    // 🆕 ترحيل دخل مبيعات اليوم للسجل كحركات موجبة (لكل طريقة دفع على حدة)
    if (todayCash > 0)
      rows.push({ type: "income", sub_type: "daily_sales", method: "نقدي", amount: todayCash, note: "دخل مبيعات اليوم (نقدي)", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    if (todayCard > 0)
      rows.push({ type: "income", sub_type: "daily_sales", method: "بطاقة", amount: todayCard, note: "دخل مبيعات اليوم (بطاقة)", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    if (todayTransfer > 0)
      rows.push({ type: "income", sub_type: "daily_sales", method: "تحويل", amount: todayTransfer, note: "دخل مبيعات اليوم (تحويل)", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    // 🆕 سداد آجل العملاء كان بيظهر في الملخص بس من غير ما يترحّل كقيد فعلي في الخزنة،
    // فكان بيتغيب عن "صافي الخزنة لهذا اليوم" وعن التقرير المطبوع رغم إنه فلوس كاش اتحصّلت فعليًا.
    if (todayCreditIncome > 0)
      rows.push({ type: "income", sub_type: "daily_sales", method: "نقدي", amount: todayCreditIncome, note: "سداد آجل عملاء", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    if (+closingForm.extra_income > 0)
      rows.push({ type: "income", sub_type: "other", method: "نقدي", amount: +closingForm.extra_income, note: closingForm.extra_income_note || "دخل إضافي", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    if (+closingForm.petty > 0)
      rows.push({ type: "expense", sub_type: "petty", method: "نقدي", amount: +closingForm.petty, note: closingForm.petty_note || "نثريات", date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
    closingForm.variable_expenses.filter((e) => +e.amount > 0).forEach((e) =>
      rows.push({ type: "expense", sub_type: "variable", method: "نقدي", amount: +e.amount, note: e.name, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name })
    );
    fixedExpenses.filter((f) => closingForm.fixed_paid[f.id]).forEach((f) =>
      rows.push({ type: "expense", sub_type: "fixed", method: "نقدي", amount: f.amount, note: f.name, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name })
    );
    // ── تسوية فرق مبيعات البطاقة (سطر واضح في السجل، بدون تعديل أي رقم بصمت) ──
    if (hasCardAdjust && cardDiff !== 0) {
      const reasonNote = closingForm.card_adjust_reason
        ? `تسوية فرق البطاقة — ${closingForm.card_adjust_reason}`
        : `تسوية فرق البطاقة (محسوب: ${todayCard.toFixed(2)} / فعلي: ${cardActual.toFixed(2)})`;
      if (cardDiff > 0) {
        // البطاقة الفعلية أعلى من المحسوب → خصم من الكاش
        rows.push({ type: "expense", sub_type: "adjustment", method: "نقدي", amount: cardDiff, note: reasonNote, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
      } else {
        // البطاقة الفعلية أقل من المحسوب → إضافة للكاش
        rows.push({ type: "income", sub_type: "adjustment", method: "نقدي", amount: Math.abs(cardDiff), note: reasonNote, date: today, pharmacy_id: pharmacyId, created_by: currentUser.name });
      }
    }
    if (rows.length > 0) {
      const { data, error } = await supabase.from("treasury_entries").insert(rows).select();
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setEntries((p) => [...data, ...p]);
    }
    const { data: closingRow, error: closingError } = await supabase
      .from("treasury_entries")
      .insert({
        type: "closing", sub_type: "daily_closing", method: "نقدي",
        amount: 0, note: "تقفيل اليوم", date: today,
        pharmacy_id: pharmacyId, created_by: currentUser.name,
      })
      .select();
    if (closingError) {
      showToast("❌ فشل حفظ تقفيل اليوم: " + closingError.message, "error");
      return;
    }
    if (closingRow) setEntries((p) => [...closingRow, ...p]);
    setClosingSaved(true);
    showToast("تم حفظ تقفيل اليوم ✓");
    setClosingForm({
      extra_income: "",
      extra_income_note: "",
      petty: "",
      petty_note: "",
      variable_expenses: [],
      fixed_paid: {},
      card_actual: "",
      card_adjust_reason: "",
    });
    } finally {
      setSavingClosing(false); // 🆕
      savingClosingRef.current = false; // 🆕
    }
  };
  // ── تجميع السجل ──
  const safeEntries = (entries || []).filter(Boolean);
  const groupedByDay = {};
  safeEntries.forEach((e) => {
    if (!groupedByDay[e.date]) groupedByDay[e.date] = [];
    groupedByDay[e.date].push(e);
  });
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  // ═══════════════════════════════════════════════════
  // 🆕 اكتشاف أيام سابقة فيها مبيعات لكن من غير تقفيل مسجّل —
  // أشهر سبب: شفت اتفتح قبل نص الليل وقُفل بعده، فاليوم اللي بدأ فيه الشفت راح من غير تقفيل رسمي.
  // بنستبعد أي يوم لسه فيه شفت مفتوح (لسه الوقت متاح يتقفل بالطريقة العادية لما يتقفل الشفت).
  // ═══════════════════════════════════════════════════
  const closedDaySet = useMemo(
    () => new Set(safeEntries.filter((e) => e.sub_type === "daily_closing").map((e) => e.date)),
    [safeEntries]
  );
  const openShiftDaySet = useMemo(
    () => new Set((shifts || []).filter((s) => !s.end_time && s.start_time).map((s) => todayLocal(new Date(s.start_time)))),
    [shifts]
  );
  const missingClosingDays = useMemo(() => {
    const saleDates = new Set((sales || []).filter((s) => s.date && s.date < today).map((s) => s.date));
    return Array.from(saleDates)
      .filter((d) => !closedDaySet.has(d) && !openShiftDaySet.has(d))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 30); // آخر 30 يوم ناقص بس، تجنبًا لضوضاء بيانات قديمة قبل تفعيل هذا الفحص
  }, [sales, closedDaySet, openShiftDaySet, today]);

  // ── حساب إجماليات يوم سابق بعينه (بنفس منطق حسابات "اليوم" لكن لتاريخ محدد) ──
  const computeDayTotals = (dateStr) => {
    const daySales = (sales || []).filter((s) => s.date === dateStr && !s.returned);
    const cash = daySales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0);
    const card = daySales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
    const transfer = daySales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
    const creditIncome = (creditPayments || []).filter((p) => p.date === dateStr).reduce((a, p) => a + p.amount, 0);
    return { cash, card, transfer, creditIncome, count: daySales.length };
  };

  // ═══════════════════════════════════════════════════
  // 🆕 طباعة تقرير تقفيل يوم — بيشتغل لأي يوم اتقفل فعلاً (النهاردة، من التاريخ، أو تقفيل بأثر رجعي)
  // بيقرأ القيود الفعلية المسجّلة في treasury_entries لليوم ده (مش حسابات لحظية) عشان التقرير
  // يمثّل بالظبط اللي اتقفل وقتها، حتى لو الأرقام اللحظية اتغيّرت بعدين.
  // ═══════════════════════════════════════════════════
  const printDayClosing = (dateStr) => {
    if (!closedDaySet.has(dateStr)) {
      showToast("⚠️ لسه معملش تقفيل رسمي لهذا اليوم — اقفله الأول", "error");
      return;
    }
    const dayEntries = groupedByDay[dateStr] || [];
    const closingEntry = dayEntries.find((e) => e.sub_type === "daily_closing");
    const incomeRows = dayEntries.filter((e) => e.type === "income");
    const expenseRows = dayEntries.filter((e) => e.type === "expense");
    const totalIncomeRec = incomeRows.reduce((a, e) => a + (e.amount || 0), 0);
    const totalExpenseRec = expenseRows.reduce((a, e) => a + (e.amount || 0), 0);
    const t = computeDayTotals(dateStr);
    const netCashRec = totalIncomeRec - totalExpenseRec;

    const rowsHtml = (rows, sign) => rows.map((e) => `
      <tr>
        <td>${e.note || (AUDIT_ENTITY_LABELS[e.sub_type] || e.sub_type)}</td>
        <td style="text-align:center">${e.method || "—"}</td>
        <td style="text-align:left; font-weight:bold; color:${sign > 0 ? "#0a7a3a" : "#a30f0f"}">${sign > 0 ? "+" : "-"}${(e.amount || 0).toFixed(2)}</td>
      </tr>`).join("");

    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>تقفيل يوم ${dateStr}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; font-family: Arial, sans-serif; }
          @page { size: A4; margin: 14mm; }
          body { color:#111; font-size:13px; }
          .header { text-align:center; border-bottom:2px solid #222; padding-bottom:10px; margin-bottom:16px; }
          .header h1 { font-size:18px; margin-bottom:4px; }
          .header .sub { color:#555; font-size:12px; }
          h2 { font-size:15px; margin:18px 0 8px; border-right:4px solid #0a7a3a; padding-right:8px; }
          table { width:100%; border-collapse:collapse; margin-bottom:10px; }
          th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; }
          th { background:#f2f2f2; text-align:right; }
          .summary { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
          .box { flex:1; min-width:110px; border:1px solid #ccc; border-radius:6px; padding:10px; text-align:center; }
          .box .lbl { font-size:11px; color:#666; margin-bottom:4px; }
          .box .val { font-size:16px; font-weight:bold; }
          .total-line { display:flex; justify-content:space-between; font-size:15px; font-weight:bold; border-top:2px solid #222; padding-top:8px; margin-top:8px; }
          .meta { color:#555; font-size:11px; margin-top:20px; border-top:1px dashed #999; padding-top:8px; }
          @media print { .no-print { display:none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align:center; padding:10px;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        <div class="header">
          <h1>${pharmInfo.name || "الصيدلية"}</h1>
          <div class="sub">${pharmInfo.address || ""}${pharmInfo.taxNumber ? " · الرقم الضريبي: " + pharmInfo.taxNumber : ""}</div>
          <div class="sub" style="margin-top:6px; font-weight:bold;">تقرير تقفيل يومي — ${dateStr}</div>
        </div>

        <div class="summary">
          <div class="box"><div class="lbl">💵 نقدي</div><div class="val">${t.cash.toFixed(2)}</div></div>
          <div class="box"><div class="lbl">💳 بطاقة</div><div class="val">${t.card.toFixed(2)}</div></div>
          <div class="box"><div class="lbl">🏦 تحويل</div><div class="val">${t.transfer.toFixed(2)}</div></div>
          <div class="box"><div class="lbl">سداد آجل</div><div class="val">${t.creditIncome.toFixed(2)}</div></div>
          <div class="box"><div class="lbl">عدد الفواتير</div><div class="val">${t.count}</div></div>
        </div>

        ${incomeRows.length > 0 ? `<h2>الإيرادات المسجّلة</h2>
        <table><thead><tr><th>البيان</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead>
        <tbody>${rowsHtml(incomeRows, 1)}</tbody></table>` : ""}

        ${expenseRows.length > 0 ? `<h2>المصروفات المسجّلة</h2>
        <table><thead><tr><th>البيان</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead>
        <tbody>${rowsHtml(expenseRows, -1)}</tbody></table>` : ""}

        <div class="total-line">
          <span>صافي الخزنة لهذا اليوم</span>
          <span>${netCashRec.toFixed(2)} ر.س</span>
        </div>

        <div class="meta">
          ${closingEntry ? `تم التقفيل بواسطة: ${closingEntry.created_by || "—"} — ${closingEntry.note || ""}${closingEntry.created_at ? " — " + new Date(closingEntry.created_at).toLocaleString("ar-SA") : ""}` : ""}
        </div>
      </body>
      </html>
    `);
    win.document.close();
  };

  // ── تقفيل يوم سابق بأثر رجعي (نسخة مبسطة: بترحّل دخل المبيعات + مصروف إجمالي اختياري + علامة التقفيل) ──
  const [retroClosingDate, setRetroClosingDate] = useState(null);
  const [retroExpense, setRetroExpense] = useState("");
  const [retroExpenseNote, setRetroExpenseNote] = useState("");
  const [savingRetro, setSavingRetro] = useState(false);
  const saveRetroClosing = async (dateStr) => {
    if (savingRetro) return;
    setSavingRetro(true);
    try {
      const t = computeDayTotals(dateStr);
      const rows = [];
      if (t.cash > 0) rows.push({ type: "income", sub_type: "daily_sales", method: "نقدي", amount: t.cash, note: "دخل مبيعات (تقفيل بأثر رجعي)", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name });
      if (t.card > 0) rows.push({ type: "income", sub_type: "daily_sales", method: "بطاقة", amount: t.card, note: "دخل مبيعات (تقفيل بأثر رجعي)", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name });
      if (t.transfer > 0) rows.push({ type: "income", sub_type: "daily_sales", method: "تحويل", amount: t.transfer, note: "دخل مبيعات (تقفيل بأثر رجعي)", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name });
      // 🆕 نفس تصحيح التقفيل العادي — سداد آجل العملاء لازم يترحّل كقيد دخل فعلي عشان يدخل في الصافي والتقرير
      if (t.creditIncome > 0) rows.push({ type: "income", sub_type: "daily_sales", method: "نقدي", amount: t.creditIncome, note: "سداد آجل عملاء (تقفيل بأثر رجعي)", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name });
      if (+retroExpense > 0) rows.push({ type: "expense", sub_type: "variable", method: "نقدي", amount: +retroExpense, note: retroExpenseNote || "مصروفات اليوم (تقفيل بأثر رجعي)", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name });
      if (rows.length > 0) {
        const { data, error } = await supabase.from("treasury_entries").insert(rows).select();
        if (error) { showToast("خطأ: " + error.message, "error"); return; }
        setEntries((p) => [...data, ...p]);
      }
      const { data: closingRow, error: closingError } = await supabase
        .from("treasury_entries")
        .insert({ type: "closing", sub_type: "daily_closing", method: "نقدي", amount: 0, note: "تقفيل بأثر رجعي", date: dateStr, pharmacy_id: pharmacyId, created_by: currentUser.name })
        .select();
      if (closingError) { showToast("❌ فشل حفظ تقفيل اليوم: " + closingError.message, "error"); return; }
      if (closingRow) setEntries((p) => [...closingRow, ...p]);
      showToast(`✅ تم تقفيل يوم ${dateStr} بأثر رجعي`);
      setRetroClosingDate(null);
      setRetroExpense("");
      setRetroExpenseNote("");
      await logAudit({ pharmacyId, userName: currentUser?.name, action: "create", entityType: "invoice", entityLabel: `تقفيل بأثر رجعي — ${dateStr}`, description: `تقفيل يوم ${dateStr} كان ناقص (شفت عدّى نص الليل على الأغلب)` });
    } finally {
      setSavingRetro(false);
    }
  };

  // إجمالي الشهر
  const monthEntries = safeEntries.filter((e) => e.date?.startsWith(monthKey));
  const monthIncome = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned && s.payment !== "آجل").reduce((a, s) => a + s.total, 0)
    + creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0)
    + monthEntries.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
  const monthExpenses = monthEntries.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);

  const cardStyle = (border = COLORS.border) => ({
    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });
  const inputStyle = {
    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8,
    padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>💰 الخزنة</h2>
          <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>{today}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canSettleBalance && (
            <button
              onClick={() => setShowSettlementForm(true)}
              style={{ background: COLORS.blueSoft, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: "8px 14px", color: COLORS.blue, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              ⚖️ تسوية الرصيد
            </button>
          )}
          {canAddOpeningBalance && (
            <button
              onClick={() => setShowOpeningBalanceForm(true)}
              style={{ background: COLORS.goldSoft, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 8, padding: "8px 14px", color: COLORS.gold, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              ➕ رصيد أول المدة
            </button>
          )}
        </div>
      </div>

      {/* ── 🆕 Modal تسوية رصيد الخزنة ── */}
      {showSettlementForm && (
        <Modal open title="⚖️ تسوية رصيد الخزنة" onClose={() => !savingSettlement && setShowSettlementForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              استخدم هذا لتصحيح رصيد الخزنة لو اكتشفت انحراف بينه وبين الرصيد الفعلي (كشف حساب بنكي، عدّ نقدي فعلي...) — بدل التعديل المباشر في قاعدة البيانات. أي تسوية بتتسجل كقيد فعلي مع سبب واضح، وتفضل قابلة للمراجعة في السجل تحت.
            </div>
            <div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>طريقة الدفع</div>
              <select value={settlementForm.method}
                onChange={(e) => setSettlementForm((p) => ({ ...p, method: e.target.value }))}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
                <option value="نقدي">💵 نقدي</option>
                <option value="بطاقة">💳 بطاقة</option>
                <option value="تحويل">🏦 تحويل بنكي</option>
              </select>
            </div>
            <div style={{ background: COLORS.surfaceAlt, borderRadius: 8, padding: "10px 12px", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.textDim }}>الرصيد المحسوب في النظام حاليًا</span>
              <strong style={{ color: COLORS.textPrimary }}>{settlementCurrentBalance.toFixed(2)} ر.س</strong>
            </div>
            <Input label="الرصيد الفعلي الصحيح (ر.س) *" value={settlementForm.actual_balance} onChange={(v) => setSettlementForm((p) => ({ ...p, actual_balance: v }))} placeholder="0.00" type="number" />
            {settlementForm.actual_balance !== "" && !isNaN(+settlementForm.actual_balance) && (
              <div style={{
                background: settlementDiff === 0 ? COLORS.surfaceAlt : settlementDiff > 0 ? COLORS.greenSoft : COLORS.redSoft,
                border: `1px solid ${settlementDiff === 0 ? COLORS.border : tint(settlementDiff > 0 ? COLORS.green : COLORS.red, 0.35)}`,
                borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700,
                color: settlementDiff === 0 ? COLORS.textDim : settlementDiff > 0 ? COLORS.green : COLORS.red,
              }}>
                الفرق: {settlementDiff > 0 ? "+" : ""}{settlementDiff.toFixed(2)} ر.س
                {settlementDiff !== 0 && ` (هيتسجل ${settlementDiff > 0 ? "كدخل" : "كمصروف"})`}
              </div>
            )}
            <Input label="سبب التسوية (إلزامي) *" value={settlementForm.reason} onChange={(v) => setSettlementForm((p) => ({ ...p, reason: v }))} placeholder="مثال: عمولة جهاز الشبكة، تصحيح من كشف الحساب البنكي..." />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowSettlementForm(false)} disabled={savingSettlement}>إلغاء</Btn>
            <Btn icon="check" onClick={saveBalanceSettlement} disabled={savingSettlement || settlementDiff === 0}>{savingSettlement ? "جاري الحفظ..." : "تأكيد التسوية"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── 🆕 Modal إضافة رصيد أول المدة للخزنة ── */}
      {showOpeningBalanceForm && (
        <Modal open title="➕ إضافة رصيد أول المدة للخزنة" onClose={() => !savingOpeningBalance && setShowOpeningBalanceForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.6 }}>
              استخدم هذا لتسجيل رصيد الخزنة الموجود فعليًا قبل بدء استخدام النظام (مثلاً عند إضافة صيدلية شغالة بالفعل)، أو أي إضافة تمويل/قرض للخزنة لاحقًا.
            </div>
            <div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>شكل الإضافة</div>
              <select value={openingBalanceForm.method}
                onChange={(e) => setOpeningBalanceForm((p) => ({ ...p, method: e.target.value }))}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
                <option value="نقدي">💵 نقدي</option>
                <option value="بطاقة">💳 بطاقة</option>
                <option value="تحويل">🏦 تحويل بنكي</option>
              </select>
            </div>
            <Input label="المبلغ (ر.س) *" value={openingBalanceForm.amount} onChange={(v) => setOpeningBalanceForm((p) => ({ ...p, amount: v }))} placeholder="0.00" />
            <div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>مصدر الإضافة</div>
              <select value={openingBalanceForm.source}
                onChange={(e) => setOpeningBalanceForm((p) => ({ ...p, source: e.target.value }))}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
                <option value="رصيد سابق">رصيد سابق (صيدلية شغالة بالفعل)</option>
                <option value="تمويل">تمويل</option>
                <option value="قرض">قرض</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            {openingBalanceForm.source === "أخرى" && (
              <Input label="حدد المصدر" value={openingBalanceForm.source_other} onChange={(v) => setOpeningBalanceForm((p) => ({ ...p, source_other: v }))} placeholder="اكتب المصدر" />
            )}
            <Input label="التاريخ" type="date" value={openingBalanceForm.date} onChange={(v) => setOpeningBalanceForm((p) => ({ ...p, date: v }))} />
            <Input label="ملاحظة" value={openingBalanceForm.note} onChange={(v) => setOpeningBalanceForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>صورة مستند إثبات (اختياري)</label>
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => { const file = e.target.files[0]; if (file) setOpeningBalanceForm((p) => ({ ...p, proof: file })); }}
                style={{ color: COLORS.textPrimary, fontSize: 12 }} />
              {openingBalanceForm.proof && <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>✓ {openingBalanceForm.proof.name}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowOpeningBalanceForm(false)} disabled={savingOpeningBalance}>إلغاء</Btn>
            <Btn icon="check" onClick={saveOpeningBalance} disabled={savingOpeningBalance}>{savingOpeningBalance ? "جاري الحفظ..." : "تأكيد الإضافة"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── 🆕 تنبيه: أيام سابقة فيها مبيعات من غير تقفيل (زي شفت عدّى نص الليل) ── */}
      {canEditDayClosing && missingClosingDays.length > 0 && (
        <div style={{
          background: COLORS.redSoft, border: `1px solid ${COLORS.red}`, borderRadius: 14,
          padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, color: COLORS.red, fontSize: 13, marginBottom: 8 }}>
            ⚠️ فيه {missingClosingDays.length} يوم سابق فيه مبيعات بدون تقفيل مسجّل
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {missingClosingDays.map((d) => (
              <button key={d} onClick={() => setRetroClosingDate(d)} style={{
                background: COLORS.surface, border: `1px solid ${COLORS.red}`, borderRadius: 8,
                padding: "6px 12px", color: COLORS.red, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                {d} — قفل هذا اليوم
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 🆕 نافذة تقفيل يوم سابق بأثر رجعي ── */}
      {retroClosingDate && (() => {
        const t = computeDayTotals(retroClosingDate);
        const grossTotal = t.cash + t.card + t.transfer + t.creditIncome;
        return (
          <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, maxWidth: 420, width: "90%" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 17, color: COLORS.textPrimary }}>🗓️ تقفيل بأثر رجعي — {retroClosingDate}</h3>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14 }}>
                محسوب من فواتير هذا اليوم مباشرة ({t.count} فاتورة). أضِف مصروفات اليوم ده لو فيه، وإلا اتركها فاضية.
              </div>
              <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>💵 نقدي</span><strong>{t.cash.toFixed(2)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>💳 بطاقة</span><strong>{t.card.toFixed(2)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>🏦 تحويل</span><strong>{t.transfer.toFixed(2)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>سداد آجل</span><strong>{t.creditIncome.toFixed(2)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLORS.border}`, marginTop: 6, paddingTop: 6, fontWeight: 800 }}><span>الإجمالي</span><span>{grossTotal.toFixed(2)}</span></div>
              </div>
              <input placeholder="مصروفات اليوم (اختياري)" value={retroExpense} onChange={(e) => setRetroExpense(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13, marginBottom: 8 }} />
              <input placeholder="ملاحظة المصروف (اختياري)" value={retroExpenseNote} onChange={(e) => setRetroExpenseNote(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 13, marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button disabled={savingRetro} onClick={() => saveRetroClosing(retroClosingDate)} style={{ flex: 1, background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 10, padding: "10px", color: COLORS.green, fontWeight: 700, cursor: "pointer" }}>
                  {savingRetro ? "جاري الحفظ..." : "✅ تأكيد التقفيل"}
                </button>
                <button disabled={savingRetro} onClick={() => { setRetroClosingDate(null); setRetroExpense(""); setRetroExpenseNote(""); }} style={{ flex: 1, background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px", color: COLORS.textDim, cursor: "pointer" }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── رصيد الخزنة اللحظي ── */}
      {canViewOverview && (() => {
        // 🆕 لو الدور مالوش صلاحية زر إظهار/إخفاء الأرقام، تفضل الأرقام مخفية إجباريًا وبدون إمكانية إظهارها
        const effectiveHide = canToggleBalances ? hideBalances : true;
        return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          {canToggleBalances && (
          <button
            onClick={() => setHideBalances((v) => !v)}
            title={hideBalances ? "إظهار الأرقام" : "إخفاء الأرقام"}
            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 12px", color: COLORS.textDim, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            {hideBalances ? "👁️ إظهار الأرقام" : "🙈 إخفاء الأرقام"}
          </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "💵 نقدي", value: balanceCash, color: COLORS.green },
            { label: "💳 بطاقة", value: balanceCard, color: COLORS.blue },
            { label: "🏦 تحويل", value: balanceTransfer, color: COLORS.purple },
            { label: "📦 الإجمالي", value: balanceTotal, color: COLORS.gold },
          ].map((b) => (
            <div key={b.label} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
              <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 4 }}>{b.label}</div>
              <div style={{ color: b.value < 0 ? COLORS.red : b.color, fontWeight: 900, fontSize: 18 }}>{effectiveHide ? "••••" : b.value.toFixed(2)}</div>
              <div style={{ color: COLORS.border, fontSize: 10 }}>{effectiveHide ? "" : "ر.س"}</div>
            </div>
          ))}
        </div>
      </div>
        );
      })()}

      {/* ── 🆕 سجل رصيد أول المدة / الإضافات ── */}
      {canViewOverview && openingBalanceHistory.length > 0 && (
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.textPrimary, marginBottom: 8 }}>📜 سجل رصيد أول المدة والإضافات</div>
          {openingBalanceHistory.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.textPrimary }}>{e.note}</div>
                <div style={{ fontSize: 11, color: COLORS.textDim }}>{e.date} — {e.method}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.green }}>{(e.amount || 0).toFixed(2)} ر.س</span>
                {e.attachment_url && <a href={e.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.blue }}>📎 مستند</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 🆕 سجل تسويات رصيد الخزنة ── */}
      {canViewOverview && settlementHistory.length > 0 && (
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.textPrimary, marginBottom: 8 }}>⚖️ سجل تسويات رصيد الخزنة</div>
          {settlementHistory.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.textPrimary }}>{e.note}</div>
                <div style={{ fontSize: 11, color: COLORS.textDim }}>{e.date} — {e.created_by}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: e.type === "income" ? COLORS.green : COLORS.red, flexShrink: 0 }}>
                {e.type === "income" ? "+" : "−"}{(e.amount || 0).toFixed(2)} ر.س
              </span>
            </div>
          ))}
        </div>
      )}

      {/* تنبيهات */}
      {canViewOverview && (dueFixed.length > 0 || upcomingLicenses.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: dueFixed.length > 0 && upcomingLicenses.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
          {dueFixed.length > 0 && (
            <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 12, padding: 12 }}>
              <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⏰ مصاريف ثابتة مستحقة قريباً</div>
              {dueFixed.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: COLORS.textPrimary }}>{f.name}</span>
                  <span style={{ color: COLORS.gold, fontWeight: 700 }}>{f.amount} ر.س</span>
                </div>
              ))}
            </div>
          )}
          {upcomingLicenses.length > 0 && (
            <div style={{ background: "#1a0a1a", border: `1px solid ${tint(COLORS.purple,0.35)}`, borderRadius: 12, padding: 12 }}>
              <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📋 تراخيص قريبة التجديد</div>
              {upcomingLicenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: COLORS.textPrimary }}>{l.name}</span>
                    <span style={{ color: days <= 14 ? COLORS.red : COLORS.gold }}>خلال {days} يوم</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 4 }}>
        {[
          { k: "today", l: "📅 تقفيل اليوم", allowed: canViewDayClosing },
          { k: "shifts", l: "🔄 الشفتات", allowed: canViewOverview },
          { k: "history", l: "📋 السجل", allowed: canViewOverview },
          { k: "fixed", l: "🔒 مصاريف ثابتة", allowed: canViewOverview },
          { k: "licenses", l: "📄 التراخيص", allowed: canViewOverview },
          { k: "salaries", l: "👥 الرواتب", allowed: canViewOverview },
        ].filter((t) => t.allowed).map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? COLORS.surface : "transparent",
            color: activeTab === t.k ? COLORS.blue : COLORS.textDim,
            fontSize: 11, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* تقفيل اليوم غير مسموح به لهذا الدور */}
      {activeTab === "today" && !canViewDayClosing && (
        <div style={{ padding: 20, textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>🔒 ليس لديك صلاحية عرض تقفيل اليوم</div>
      )}
      {activeTab !== "today" && !canViewOverview && (
        <div style={{ padding: 20, textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>🔒 ليس لديك صلاحية عرض محتويات الخزنة</div>
      )}

      {/* ══════════ تقفيل اليوم ══════════ */}
      {activeTab === "today" && canViewDayClosing && closingSaved && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 24, marginBottom: 8 }}>تم تقفيل يوم {today}</div>
          <div style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 28 }}>جاهز لليوم التالي</div>

          {/* 🆕 تنبيه مبيعات/مرتجعات حصلت بعد ما التقفيل اتحفظ (زبون جه بعد الإغلاق) */}
          {hasPostClosingActivity && (
            <div style={{
              maxWidth: 420, margin: "0 auto 24px", textAlign: "right",
              background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                ⚠️ فيه حركة بعد التقفيل مش داخلة في السجل المحفوظ
              </div>
              <div style={{ color: COLORS.textDim, fontSize: 12, lineHeight: 1.8 }}>
                {postClosingSales.length > 0 && <div>مبيعات جديدة: {postClosingSales.length} فاتورة</div>}
                {postClosingReturns.length > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>
                    ℹ️ فيه {postClosingReturns.length} مرتجع بعد التقفيل — متسجل مصروفه في الخزنة فورًا بالفعل، ومش هيتضاف هنا تاني.
                  </div>
                )}
                <div style={{ marginTop: 4, fontWeight: 700, color: COLORS.green }}>
                  قيمة المبيعات الجديدة: +{postClosingNet.toFixed(2)} ر.س
                </div>
              </div>
              <button
                onClick={addClosingAdjustment}
                disabled={addingAdjustment || postClosingNet === 0 || openShifts.length > 0}
                style={{
                  marginTop: 10, width: "100%", background: COLORS.gold, border: "none", borderRadius: 8,
                  padding: "8px 12px", color: "#1a0f00", fontWeight: 700, fontSize: 12,
                  cursor: (addingAdjustment || openShifts.length > 0) ? "default" : "pointer", opacity: (addingAdjustment || openShifts.length > 0) ? 0.6 : 1,
                }}
              >
                {addingAdjustment ? "جارٍ الإضافة..." : "➕ إضافة قيمة المبيعات الجديدة كتسوية"}
              </button>
              {openShifts.length > 0 && (
                <div style={{ marginTop: 8, color: COLORS.red, fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                  ⛔ مينفعش تضيف التسوية والشفت لسه مفتوح — أقفل الشفت الأول ({openShifts.map((s) => s.user).join("، ")})
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setActiveTab("history")}
            style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: "8px 20px", color: COLORS.blue, fontSize: 13, cursor: "pointer", marginLeft: 8 }}
          >
            📋 عرض سجل الأيام
          </button>
          <button
            onClick={() => printDayClosing(today)}
            style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 20px", color: COLORS.textPrimary, fontSize: 13, cursor: "pointer" }}
          >
            🖨️ طباعة التقفيل
          </button>
        </div>
      )}

      {/* ══════════ 🆕 مراجعة/تسوية أي يوم سابق مُقفّل — يظهر دايمًا في تبويب تقفيل اليوم ══════════ */}
      {activeTab === "today" && canViewDayClosing && closedDaysList.length > 0 && (
        <div style={{
          marginTop: 20, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: "14px 16px",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.textPrimary, marginBottom: 10 }}>
            🔎 مراجعة تسوية يوم سابق
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.8 }}>
            اختار يوم مقفول عشان تتأكد مفيش مبيعات/مرتجعات حصلت فيه بعد وقت التقفيل ولسه ما اتضافتش كتسوية.
          </div>
          <select
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.textPrimary, fontSize: 13, marginBottom: 10 }}
          >
            <option value="">— اختر يوم —</option>
            {closedDaysList.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {reviewDate && !reviewHasPostClosingActivity && (
            <div style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>
              ✅ اليوم ده مفيهوش أي حركة معلّقة بعد التقفيل — كل حاجة متسجلة صح.
            </div>
          )}

          {reviewDate && reviewHasPostClosingActivity && (
            <div style={{
              textAlign: "right", background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`,
              borderRadius: 10, padding: "14px 16px",
            }}>
              <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                ⚠️ فيه حركة بعد تقفيل يوم {reviewDate} مش داخلة في السجل المحفوظ
              </div>
              <div style={{ color: COLORS.textDim, fontSize: 12, lineHeight: 1.8 }}>
                {reviewPostClosingSales.length > 0 && <div>مبيعات جديدة: {reviewPostClosingSales.length} فاتورة</div>}
                {reviewPostClosingReturns.length > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>
                    ℹ️ فيه {reviewPostClosingReturns.length} مرتجع بعد التقفيل — متسجل مصروفه في الخزنة فورًا بالفعل، ومش هيتضاف هنا تاني.
                  </div>
                )}
                <div style={{ marginTop: 4, fontWeight: 700, color: COLORS.green }}>
                  قيمة المبيعات الجديدة: +{reviewPostClosingNet.toFixed(2)} ر.س
                </div>
              </div>
              <button
                onClick={addReviewClosingAdjustment}
                disabled={addingReviewAdjustment || reviewPostClosingNet === 0 || openShifts.length > 0}
                style={{
                  marginTop: 10, width: "100%", background: COLORS.gold, border: "none", borderRadius: 8,
                  padding: "8px 12px", color: "#1a0f00", fontWeight: 700, fontSize: 12,
                  cursor: (addingReviewAdjustment || openShifts.length > 0) ? "default" : "pointer", opacity: (addingReviewAdjustment || openShifts.length > 0) ? 0.6 : 1,
                }}
              >
                {addingReviewAdjustment ? "جارٍ الإضافة..." : `➕ إضافة قيمة المبيعات الجديدة كتسوية ليوم ${reviewDate}`}
              </button>
              {openShifts.length > 0 && (
                <div style={{ marginTop: 8, color: COLORS.red, fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                  ⛔ مينفعش تضيف التسوية والشفت لسه مفتوح — أقفل الشفت الأول ({openShifts.map((s) => s.user).join("، ")})
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "today" && canViewDayClosing && !closingSaved && (
        <div>
          {/* تحذير الشفتات المفتوحة */}
          {openShifts.length > 0 && (
            <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}>لا يمكن تقفيل اليوم</div>
                <div style={{ color: COLORS.textDim, fontSize: 12, marginTop: 2 }}>
                  يوجد {openShifts.length} شفت مفتوح: {openShifts.map((s) => s.user).join("، ")} — أقفل الشفتات أولاً
                </div>
              </div>
            </div>
          )}
          {/* الدخل مقسم */}
          <div style={cardStyle(COLORS.greenSoft)}>
            <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📥 الدخل</div>

            <div style={rowStyle}>
              <span style={{ color: COLORS.textDim, fontSize: 13 }}>💵 مبيعات نقدي{hasCardAdjust && cardDiff !== 0 ? " (بعد التسوية)" : ""}</span>
              <span style={{ color: COLORS.green, fontWeight: 700 }}>{(hasCardAdjust ? cashAfterAdjust - todayCreditIncome : todayCash).toFixed(2)} ر.س</span>
            </div>
            <div style={{ ...rowStyle, alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span style={{ color: COLORS.textDim, fontSize: 13 }}>💳 مبيعات بطاقة (النظام)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.blue, fontWeight: 700 }}>{todayCard.toFixed(2)} ر.س</span>
                  <button onClick={() => setEditingCard((v) => !v)}
                    style={{ background: "transparent", border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                    {editingCard ? "إغلاق" : "تعديل"}
                  </button>
                </div>
              </div>
              {editingCard && (
                <div style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue,0.35)}`, borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" value={closingForm.card_actual}
                      onChange={(e) => setClosingForm((p) => ({ ...p, card_actual: e.target.value }))}
                      placeholder={`الرقم الفعلي من جهاز النقاط (${todayCard.toFixed(2)})`}
                      style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
                  </div>
                  <input value={closingForm.card_adjust_reason}
                    onChange={(e) => setClosingForm((p) => ({ ...p, card_adjust_reason: e.target.value }))}
                    placeholder="سبب الفرق (اختياري)..." style={inputStyle} />
                  {hasCardAdjust && cardDiff !== 0 && (
                    <div style={{ color: cardDiff > 0 ? COLORS.coral : COLORS.green, fontSize: 12 }}>
                      {cardDiff > 0
                        ? `البطاقة أعلى بـ ${cardDiff.toFixed(2)} ر.س — سيُخصم هذا المبلغ من الكاش`
                        : `البطاقة أقل بـ ${Math.abs(cardDiff).toFixed(2)} ر.س — سيُضاف هذا المبلغ للكاش`}
                    </div>
                  )}
                </div>
              )}
            </div>
            {hasCardAdjust && cardDiff !== 0 && (
              <div style={rowStyle}>
                <span style={{ color: COLORS.gold, fontSize: 13 }}>⚖️ تسوية فرق البطاقة</span>
                <span style={{ color: cardDiff > 0 ? COLORS.coral : COLORS.green, fontWeight: 700 }}>
                  {cardDiff > 0 ? "−" : "+"}{Math.abs(cardDiff).toFixed(2)} ر.س (كاش)
                </span>
              </div>
            )}
            <div style={rowStyle}>
              <span style={{ color: COLORS.textDim, fontSize: 13 }}>🏦 مبيعات تحويل</span>
              <span style={{ color: COLORS.purple, fontWeight: 700 }}>{todayTransfer.toFixed(2)} ر.س</span>
            </div>
            <div style={rowStyle}>
              <span style={{ color: COLORS.textDim, fontSize: 13 }}>✅ سداد آجل</span>
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{todayCreditIncome.toFixed(2)} ر.س</span>
            </div>
            {todayReturns > 0 && (
              <div style={rowStyle}>
                <span style={{ color: COLORS.coral, fontSize: 13 }}>↩️ مرتجع المبيعات اليوم</span>
                <span style={{ color: COLORS.red, fontWeight: 700 }}>− {todayReturns.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={{ color: COLORS.red, fontSize: 13 }}>📋 مديونية اليوم (غير محصلة)</span>
              <span style={{ color: COLORS.red, fontWeight: 700 }}>{todayAjil.toFixed(2)} ر.س</span>
            </div>

            {/* دخل إضافي */}
            <div style={{ marginTop: 8, borderTop: `1px solid ${tint(COLORS.green,0.35)}`, paddingTop: 10 }}>
              <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 6 }}>دخل إضافي (اختياري)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={closingForm.extra_income_note} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income_note: e.target.value }))}
                  placeholder="وصف الدخل..." style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={closingForm.extra_income} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tint(COLORS.green,0.35)}` }}>
              <span style={{ color: COLORS.textDim, fontSize: 12, marginLeft: 12 }}>إجمالي الدخل</span>
              <span style={{ color: COLORS.green, fontWeight: 900, fontSize: 16 }}>{totalIncome.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* المصروفات */}
          <div style={cardStyle("#3a1000")}>
            <div style={{ color: COLORS.coral, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📤 المصروفات</div>

            <div style={{ ...rowStyle, gap: 12 }}>
              <span style={{ color: COLORS.textDim, fontSize: 13, whiteSpace: "nowrap" as const }}>🪙 نثريات</span>
              {loyaltyRedeemed > 0 && (
  <div style={rowStyle}>
    <span style={{ color: COLORS.textDim, fontSize: 13 }}>🌟 استبدال نقاط نقدي</span>
    <span style={{ color: COLORS.coral, fontWeight: 700 }}>{loyaltyRedeemed.toFixed(2)} ر.س</span>
  </div>
)}
              <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <input value={closingForm.petty_note} onChange={(e) => setClosingForm((p) => ({ ...p, petty_note: e.target.value }))}
                  placeholder="وصف..." style={{ ...inputStyle, width: 140 }} />
                <input type="number" value={closingForm.petty} onChange={(e) => setClosingForm((p) => ({ ...p, petty: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
              </div>
            </div>

            {closingForm.variable_expenses.map((exp, i) => (
              <div key={i} style={{ ...rowStyle, gap: 8 }}>
                <span style={{ color: COLORS.textDim, fontSize: 13, whiteSpace: "nowrap" as const }}>📦 مصروف</span>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <input value={exp.name} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], name: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="اسم المصروف" style={{ ...inputStyle, width: 140 }} />
                  <input type="number" value={exp.amount} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], amount: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
                  <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: p.variable_expenses.filter((_, j) => j !== i) }))}
                    style={{ background: COLORS.redSoft, border: "none", borderRadius: 6, padding: "4px 10px", color: COLORS.coral, cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}

            <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: [...p.variable_expenses, { name: "", amount: "" }] }))}
              style={{ background: COLORS.goldSoft, border: `1px dashed ${tint(COLORS.gold,0.35)}`, borderRadius: 8, padding: "7px 14px", color: COLORS.coral, cursor: "pointer", fontSize: 12, width: "100%", marginTop: 4 }}>
              + إضافة مصروف متغير
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${tint(COLORS.gold,0.35)}` }}>
              <span style={{ color: COLORS.textDim, fontSize: 12, marginLeft: 12 }}>إجمالي المصروفات</span>
              <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: 16 }}>{totalExpenses.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* صافي الخزنة */}
          <div style={{ ...cardStyle(COLORS.surfaceAlt), textAlign: "center" as const, padding: 20 }}>
            <div style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 6 }}>🏦 صافي الخزنة اليوم</div>
            <div style={{ color: netCash >= 0 ? COLORS.green : COLORS.red, fontWeight: 900, fontSize: 32, marginBottom: 4 }}>
              {netCash.toFixed(2)} ر.س
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, color: COLORS.textDim }}>
              <span>نقدي: <b style={{ color: COLORS.green }}>{cashAfterAdjust.toFixed(0)}</b></span>
              <span>بطاقة: <b style={{ color: COLORS.blue }}>{cardActual.toFixed(0)}</b></span>
              <span>تحويل: <b style={{ color: COLORS.purple }}>{todayTransfer.toFixed(0)}</b></span>
            </div>
            {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).length > 0 && (
              <div style={{ color: COLORS.gold, fontSize: 11, marginTop: 8 }}>
                ⚠️ مصاريف ثابتة مستحقة قريبًا وغير مدفوعة: {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).map((f) => f.name).join("، ")}
                {" "}({dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).reduce((a, f) => a + (+f.amount || 0), 0).toFixed(2)} ر.س)
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            {!closingSaved && canEditDayClosing && (
              <button
                onClick={saveClosing}
                disabled={openShifts.length > 0 || savingClosing}
                style={{
                  background: (openShifts.length > 0 || savingClosing) ? COLORS.surfaceAlt : "#1a4a2a",
                  border: `1px solid ${(openShifts.length > 0 || savingClosing) ? COLORS.border : "#2a8a4a"}`,
                  borderRadius: 8, padding: "10px 20px",
                  color: (openShifts.length > 0 || savingClosing) ? COLORS.textDim : COLORS.green,
                  fontSize: 13, fontWeight: 700,
                  cursor: (openShifts.length > 0 || savingClosing) ? "not-allowed" : "pointer",
                  opacity: (openShifts.length > 0 || savingClosing) ? 0.5 : 1,
                }}
              >
                {savingClosing ? "⏳ جارِ الحفظ..." : openShifts.length > 0 ? `🔒 أقفل ${openShifts.length} شفت أولاً` : "✅ حفظ تقفيل اليوم"}
              </button>
            )}
            {!closingSaved && !canEditDayClosing && (
              <div style={{ padding: "10px 20px", color: COLORS.textDim, fontSize: 12 }}>🔒 عرض فقط — لا تملك صلاحية حفظ تقفيل اليوم</div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ تاب الشفتات ══════════ */}
      {activeTab === "shifts" && canViewOverview && (
        <div>
          {todayShifts.length === 0 ? (
            <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد شفتات اليوم</div>
          ) : (
            <>
              {todayShifts.map((sh) => {
                const ss = getShiftSales(sh.id);
                return (
                  <div key={sh.id} style={cardStyle(COLORS.blueSoft)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <span style={{ color: COLORS.blue, fontWeight: 700 }}>{sh.id}</span>
                        <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 10 }}>{sh.user}</span>
                      </div>
                      <div style={{ color: sh.end_time ? COLORS.green : COLORS.gold, fontSize: 11, fontWeight: 700 }}>
                        {sh.end_time ? "✅ مغلق" : "🟡 مفتوح"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { l: "نقدي", v: ss.cash, c: COLORS.green },
                        { l: "بطاقة", v: ss.card, c: COLORS.blue },
                        { l: "تحويل", v: ss.transfer, c: COLORS.purple },
                        { l: "إجمالي", v: ss.total, c: COLORS.gold },
                      ].map((x) => (
                        <div key={x.l} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                          <div style={{ color: COLORS.textDim, fontSize: 10 }}>{x.l}</div>
                          <div style={{ color: x.c, fontWeight: 700, fontSize: 14 }}>{x.v.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    {ss.ajil > 0 && (
                      <div style={{ marginTop: 8, color: COLORS.red, fontSize: 12 }}>
                        مديونية: {ss.ajil.toFixed(2)} ر.س ({ss.count} فاتورة)
                      </div>
                    )}
                    {ss.returns > 0 && (
                      <div style={{ marginTop: 8, color: COLORS.red, fontSize: 12 }}>
                        🔄 مرتجعات: {ss.returns.toFixed(2)} ر.س (مخصومة من الإجمالي)
                      </div>
                    )}
                  </div>
                );
              })}

              {/* إجمالي اليوم */}
              <div style={{ ...cardStyle("#2a3a1a"), marginTop: 8 }}>
                <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📊 إجمالي اليوم</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[
                    { l: "نقدي", v: todayCash, c: COLORS.green },
                    { l: "بطاقة", v: todayCard, c: COLORS.blue },
                    { l: "تحويل", v: todayTransfer, c: COLORS.purple },
                    { l: "الإجمالي", v: todayCash + todayCard + todayTransfer - todayReturnsSalesTotal, c: COLORS.gold },
                  ].map((x) => (
                    <div key={x.l} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                {todayReturnsSalesTotal > 0 && (
                  <div style={{ color: COLORS.red, fontSize: 12, marginTop: 8 }}>
                    🔄 مرتجعات اليوم: {todayReturnsSalesTotal.toFixed(2)} ر.س (مخصومة من الإجمالي)
                  </div>
                )}
              </div>

              {/* إجمالي الشهر */}
              <div style={{ ...cardStyle(COLORS.surfaceAlt), marginTop: 8 }}>
                <div style={{ color: COLORS.blue, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📅 إجمالي الشهر</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "دخل الشهر", v: monthIncome, c: COLORS.green },
                    { l: "مصروفات الشهر", v: monthExpenses, c: COLORS.coral },
                    { l: "صافي الشهر", v: monthIncome - monthExpenses, c: monthIncome - monthExpenses >= 0 ? COLORS.blue : COLORS.red },
                  ].map((x) => (
                    <div key={x.l} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                      <div style={{ color: COLORS.border, fontSize: 10 }}>ر.س</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ السجل ══════════ */}
      {activeTab === "history" && canViewOverview && (
        <div>
          {/* ملخص الشهر */}
          <div style={{ ...cardStyle(COLORS.surfaceAlt), display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>دخل الشهر</div>
              <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{monthIncome.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>مصروفات الشهر</div>
              <div style={{ color: COLORS.coral, fontWeight: 900, fontSize: 18 }}>{monthExpenses.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: COLORS.textDim, fontSize: 11 }}>صافي الشهر</div>
              <div style={{ color: monthIncome - monthExpenses >= 0 ? COLORS.blue : COLORS.red, fontWeight: 900, fontSize: 18 }}>
                {(monthIncome - monthExpenses).toFixed(0)} ر.س
              </div>
            </div>
          </div>

          {sortedDays.slice(0, 30).map((day) => {
            const dayEnt = groupedByDay[day];
            const dayIncome = dayEnt.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
            const dayExp = dayEnt.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);
            const isOpen = selectedDay === day;
            return (
              <div key={day} style={cardStyle()}>
                <div onClick={() => setSelectedDay(isOpen ? null : day)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <div>
                    <div style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{day}</div>
                    <div style={{ color: COLORS.textDim, fontSize: 11 }}>{dayEnt.length} قيد</div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: COLORS.green, fontWeight: 700 }}>+{dayIncome.toFixed(0)}</div>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>دخل</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: COLORS.coral, fontWeight: 700 }}>-{dayExp.toFixed(0)}</div>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>مصروف</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: dayIncome - dayExp >= 0 ? COLORS.blue : COLORS.red, fontWeight: 900 }}>
                        {(dayIncome - dayExp).toFixed(0)}
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>صافي</div>
                    </div>
                    <span style={{ color: COLORS.textDim }}>{isOpen ? "▲" : "▼"}</span>
                    {closedDaySet.has(day) && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); printDayClosing(day); }}
                        title="طباعة تقرير التقفيل"
                        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 9px", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}
                      >
                        🖨️
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                    {dayEnt.map((e) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                        <div>
                          <span style={{ color: COLORS.textDim }}>{e.note || e.sub_type}</span>
                          {e.method && <span style={{ color: COLORS.border, fontSize: 10, marginRight: 8 }}>({e.method})</span>}
                        </div>
                        <span style={{ color: e.type === "income" ? COLORS.green : COLORS.coral, fontWeight: 700 }}>
                          {e.type === "income" ? "+" : "-"}{e.amount} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {sortedDays.length === 0 && <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد قيود مسجلة</div>}
        </div>
      )}

      {/* ══════════ المصاريف الثابتة ══════════ */}
      {activeTab === "fixed" && canViewOverview && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            {canAddFixedExpense && <Btn icon="plus" onClick={() => setShowFixedForm(true)}>إضافة مصروف ثابت</Btn>}
          </div>
          {fixedExpenses.length === 0
            ? <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد مصاريف ثابتة</div>
            : (
              <>
                <div style={{ ...cardStyle(COLORS.goldSoft), display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: COLORS.gold, fontWeight: 700 }}>إجمالي شهري (متوسط الأقساط)</span>
                  <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: 16 }}>{monthFixedTotal.toFixed(2)} ر.س</span>
                </div>
                {fixedExpenses.map((f) => {
  const due = isDueThisMonth(f);
  const rec = f.recurrence || "monthly";
  return (
    <div key={f.id} style={cardStyle(due ? COLORS.goldSoft : COLORS.border)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{f.name}</span>
            <span style={{ fontSize: 10, color: "#7a8aaa", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", padding: "2px 6px", borderRadius: 5 }}>
              {recurrenceLabel[rec]}
            </span>
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
            يوم {f.due_day}{rec !== "monthly" ? ` من شهر الاستحقاق` : " من كل شهر"}
            {due && Math.abs(+f.due_day - currentDay) <= 3 && <span style={{ color: COLORS.gold, marginRight: 8 }}>⏰ مستحقة قريباً</span>}
            {!due && <span style={{ color: COLORS.textDim, marginRight: 8 }}>غير مستحقة هذا الشهر</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "left" as const }}>
            <div style={{ color: COLORS.coral, fontWeight: 900, fontSize: 16 }}>{f.amount} ر.س</div>
            {rec !== "monthly" && (
              <div style={{ color: COLORS.textDim, fontSize: 10 }}>≈ {monthlyShare(f).toFixed(2)} ر.س / شهر</div>
            )}
          </div>
          {canPayFixedExpense && (
          <>
          <select
            value={fixedPayMethod[f.id] || "نقدي"}
            onChange={(e) => setFixedPayMethod((p) => ({ ...p, [f.id]: e.target.value }))}
            style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 12 }}
          >
            <option value="نقدي">💵 نقدي</option>
            <option value="بطاقة">💳 بطاقة</option>
            <option value="تحويل">🏦 تحويل</option>
          </select>
          <button
            onClick={async () => {
              // 🆕 قيد: لازم رصيد الخزنة بطريقة الدفع المختارة يكفي قبل السداد
              // (بطاقة وتحويل بيتجمّعوا كرصيد بنكي واحد للفحص)
              const method = fixedPayMethod[f.id] || "نقدي";
              const available = computeAvailableForPayment(method, { sales, creditPayments, entries });
              if (f.amount > available) {
                const availLabel = (method === "بطاقة" || method === "تحويل") ? "بطاقة + تحويل" : method;
                showToast(`❌ رصيد الخزنة (${availLabel}) لا يكفي لسداد "${f.name}" — المتاح ${available.toFixed(2)} ر.س والمطلوب ${f.amount} ر.س`, "error");
                return;
              }
              const { error } = await supabase.from("treasury_entries").insert([{
                type: "expense", sub_type: "fixed", method,
                amount: f.amount, note: f.name, date: today,
                pharmacy_id: pharmacyId, created_by: currentUser.name
              }]);
              if (error) { showToast("خطأ: " + error.message, "error"); return; }
              setEntries((p) => [...p, { type: "expense", sub_type: "fixed", method, amount: f.amount, note: f.name, date: today }]);
              showToast(`تم سداد ${f.name} ✓`);
            }}
            style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 8, padding: "6px 14px", color: COLORS.green, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            💳 سداد
          </button>
          </>
          )}
          {canDeleteFixedExpense && (
          <button
            onClick={async () => {
              if (!confirm(`حذف "${f.name}"؟`)) return;
              await supabase.from("fixed_expenses").delete().eq("id", f.id);
              setFixedExpenses((p) => p.filter((x) => x.id !== f.id));
              showToast("تم الحذف");
            }}
            style={{ background: COLORS.redSoft, border: "none", borderRadius: 8, padding: "6px 10px", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>
            🗑
          </button>
          )}
        </div>
      </div>
    </div>
  );
})}
         </>
            )
          }
        </div>
      )}       
      {/* ══════════ التراخيص ══════════ */}
      {activeTab === "licenses" && canViewOverview && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            {canAddLicense && <Btn icon="plus" onClick={() => setShowLicenseForm(true)}>إضافة ترخيص</Btn>}
          </div>
          {licenses.length === 0
            ? <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد تراخيص</div>
            : licenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                const urgent = days <= 14; const soon = days <= 60;
                const payAmount = licensePayAmount[l.id] !== undefined ? licensePayAmount[l.id] : String(l.amount || "");
                return (
                  <div key={l.id} style={cardStyle(urgent ? "#4a0000" : soon ? COLORS.goldSoft : COLORS.border)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{l.name}</div>
                        <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
                          تجديد: {l.renew_date}{l.note && ` • ${l.note}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" as const }}>
                        <div style={{ color: urgent ? COLORS.red : soon ? COLORS.gold : COLORS.green, fontWeight: 700 }}>
                          {days <= 0 ? "⚠️ منتهي" : `خلال ${days} يوم`}
                        </div>
                        <div style={{ color: COLORS.purple, fontWeight: 700 }}>{l.amount} ر.س</div>
                      </div>
                    </div>
                    {canPayLicense && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, flexWrap: "wrap" as const }}>
                        <span style={{ color: COLORS.textDim, fontSize: 11 }}>مبلغ السداد:</span>
                        <input
                          type="number"
                          value={payAmount}
                          onChange={(e) => setLicensePayAmount((p) => ({ ...p, [l.id]: e.target.value }))}
                          style={{ width: 100, boxSizing: "border-box", padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 12 }}
                        />
                        <span style={{ color: COLORS.textDim, fontSize: 11 }}>ر.س</span>
                        <select
                          value={licensePayMethod[l.id] || "نقدي"}
                          onChange={(e) => setLicensePayMethod((p) => ({ ...p, [l.id]: e.target.value }))}
                          style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt, color: COLORS.textPrimary, fontSize: 12 }}
                        >
                          <option value="نقدي">💵 نقدي</option>
                          <option value="بطاقة">💳 بطاقة</option>
                          <option value="تحويل">🏦 تحويل</option>
                        </select>
                        <button
                          onClick={async () => {
                            const amt = +payAmount || 0;
                            if (amt <= 0) { showToast("أدخل مبلغ سداد صحيح", "error"); return; }
                            // 🆕 قيد: لازم رصيد الخزنة بطريقة الدفع المختارة يكفي قبل السداد
                            // (بطاقة وتحويل بيتجمّعوا كرصيد بنكي واحد للفحص)
                            const method = licensePayMethod[l.id] || "نقدي";
                            const available = computeAvailableForPayment(method, { sales, creditPayments, entries });
                            if (amt > available) {
                              const availLabel = (method === "بطاقة" || method === "تحويل") ? "بطاقة + تحويل" : method;
                              showToast(`❌ رصيد الخزنة (${availLabel}) لا يكفي لسداد "${l.name}" — المتاح ${available.toFixed(2)} ر.س والمطلوب ${amt.toFixed(2)} ر.س`, "error");
                              return;
                            }
                            const { error } = await supabase.from("treasury_entries").insert([{
                              type: "expense", sub_type: "license", method,
                              amount: amt, note: l.name, date: today,
                              pharmacy_id: pharmacyId, created_by: currentUser.name
                            }]);
                            if (error) { showToast("خطأ: " + error.message, "error"); return; }
                            setEntries((p) => [...p, { type: "expense", sub_type: "license", method, amount: amt, note: l.name, date: today }]);
                            showToast(`تم سداد ${l.name} ✓`);
                          }}
                          style={{ marginRight: "auto", background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 8, padding: "6px 14px", color: COLORS.green, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                          💳 سداد
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ══════════ الرواتب ══════════ */}
      {activeTab === "salaries" && canViewOverview && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>شهر الصرف:</span>
              <input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)}
                style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12 }} />
            </div>
            {canAddEmployee && <Btn icon="plus" onClick={() => { setEditingEmployee(null); setEmployeeForm({ name: "", role: "عامل", hire_date: todayLocal(), base_salary: "", allowances: "", allowances_note: "", percentage_rate: "", leave_days_per_year: "21", note: "", nationality: "سعودي", gosi_enabled: true, friday_allowance_rate: "", user_id: "" }); setShowEmployeeForm(true); }}>إضافة موظف</Btn>}
          </div>

          <div style={{ ...cardStyle(COLORS.goldSoft), display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: COLORS.gold, fontWeight: 700 }}>إجمالي رواتب {payMonth}</span>
            <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: 16 }}>{monthSalaryTotal.toFixed(2)} ر.س</span>
          </div>

          {unpaidThisMonth.length > 0 && (
            <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⏰ لسه ما اتصرفش راتب {payMonth} لـ {unpaidThisMonth.length} موظف</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {unpaidThisMonth.map((e) => <span key={e.id} style={{ fontSize: 11, color: COLORS.textDim }}>{e.name}</span>)}
              </div>
            </div>
          )}

          {employees.length === 0
            ? <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا يوجد موظفين مسجلين</div>
            : employees.map((emp) => {
                const payStatus = getEmployeeMonthPayStatus(emp);
                const paid = payStatus.status === "full";
                const leaveBalance = getEmployeeLeaveBalance(emp);
                const empPayments = getEmployeeSalaryPayments(emp.id).slice(0, 3);
                return (
                  <div key={emp.id} style={cardStyle(emp.active === false ? COLORS.border : (paid ? tint(COLORS.green, 0.35) : payStatus.status === "partial" ? tint(COLORS.gold, 0.35) : COLORS.border))}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{emp.name}</span>
                          <span style={{ fontSize: 10, color: COLORS.textDim, background: COLORS.surfaceAlt, padding: "2px 6px", borderRadius: 5 }}>{employeeRoleLabel[emp.role] || emp.role}</span>
                          {emp.active === false && <span style={{ fontSize: 10, color: COLORS.red, background: COLORS.redSoft, padding: "2px 6px", borderRadius: 5 }}>منتهي الخدمة</span>}
                          {paid && emp.active !== false && <span style={{ fontSize: 10, color: COLORS.green, background: COLORS.greenSoft, padding: "2px 6px", borderRadius: 5 }}>✓ اتصرف {payMonth}</span>}
                          {payStatus.status === "partial" && emp.active !== false && <span title={`المستحق ${payStatus.due.toFixed(2)} ر.س — المصروف ${payStatus.paid.toFixed(2)} ر.س`} style={{ fontSize: 10, color: COLORS.gold, background: COLORS.goldSoft, padding: "2px 6px", borderRadius: 5 }}>🟡 مدفوع جزئيًا — متبقي {payStatus.remaining.toFixed(2)} ر.س</span>}
                          {getLinkedUser(emp)
                            ? <span style={{ fontSize: 10, color: COLORS.blue, background: COLORS.blueSoft, padding: "2px 6px", borderRadius: 5 }}>🔗 مرتبط بحساب {getLinkedUser(emp).name}</span>
                            : emp.active !== false && <span title="من غير ربط، حساب الراتب بيعتمد على تطابق الاسم في الحضور/المبيعات، وده عرضة للأخطاء" style={{ fontSize: 10, color: COLORS.gold, background: COLORS.goldSoft, padding: "2px 6px", borderRadius: 5 }}>⚠️ غير مرتبط بحساب</span>
                          }
                        </div>
                        <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>
                          راتب أساسي: {(emp.base_salary || 0).toFixed(0)} ر.س
                          {emp.allowances > 0 && ` • بدلات: ${emp.allowances.toFixed(0)} ر.س`}
                          {emp.percentage_rate > 0 && ` • نسبة: ${emp.percentage_rate}%`}
                        </div>
                        <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>
                          📅 تعيين: {emp.hire_date} • 🏖️ رصيد إجازة: {leaveBalance.toFixed(1)} يوم
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        {emp.active !== false && canPaySalary && (
                          <button onClick={() => openPayForm(emp)} style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 8, padding: "6px 12px", color: COLORS.green, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{payStatus.status === "partial" ? "💵 صرف الباقي" : "💵 صرف راتب"}</button>
                        )}
                        {emp.active !== false && canPaySalary && (
                          <button onClick={() => { setLeaveForm({ days: "", amount: "", note: "", type: "cashout" }); setShowLeaveForm(emp); }} style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: "6px 12px", color: COLORS.blue, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🏖️ إجازة</button>
                        )}
                        {emp.active !== false && canEditEmployee && (
                          <button onClick={() => { setEditingEmployee(emp); setEmployeeForm({ name: emp.name, role: emp.role, hire_date: emp.hire_date, base_salary: String(emp.base_salary || ""), allowances: String(emp.allowances || ""), allowances_note: emp.allowances_note || "", percentage_rate: String(emp.percentage_rate || ""), leave_days_per_year: String(emp.leave_days_per_year || 21), note: emp.note || "", nationality: emp.nationality || "سعودي", gosi_enabled: emp.gosi_enabled !== false, friday_allowance_rate: String(emp.friday_allowance_rate || ""), user_id: emp.user_id || "" }); setShowEmployeeForm(true); }} style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 12px", color: COLORS.textDim, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✏️ تعديل</button>
                        )}
                        {emp.active !== false && canDeleteEmployee && (
                          <button onClick={() => { setEosForm({ termination_date: todayLocal(), termination_type: "normal", other_addition: "", other_deduction: "", other_deduction_note: "", method: "نقدي", note: "", proof: null }); setShowEosForm(emp); }} style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 8, padding: "6px 12px", color: COLORS.red, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🏁 إنهاء خدمة</button>
                        )}
                        {canDeleteEmployee && (
                          <button onClick={() => deleteEmployee(emp)} style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 11 }}>🗑 حذف</button>
                        )}
                      </div>
                    </div>
                    {empPayments.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>آخر الرواتب المصروفة</div>
                        {empPayments.map((p) => (
                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0" }}>
                            <span style={{ color: COLORS.textDim }}>{p.month}</span>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{(p.net_amount || 0).toFixed(2)} ر.س</span>
                            {p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noreferrer" style={{ color: COLORS.blue }}>📎</a>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* Modal إضافة/تعديل موظف */}
      <Modal open={showEmployeeForm} onClose={() => setShowEmployeeForm(false)} title={editingEmployee ? "✏️ تعديل موظف" : "👥 إضافة موظف جديد"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="اسم الموظف *" value={employeeForm.name} onChange={(v) => setEmployeeForm((p) => ({ ...p, name: v }))} placeholder="الاسم" />
          <div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>الوظيفة</div>
            <select value={employeeForm.role} onChange={(e) => setEmployeeForm((p) => ({ ...p, role: e.target.value }))}
              style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              <option value="صيدلي">💊 صيدلي</option>
              <option value="محاسب">🧮 محاسب</option>
              <option value="عامل">🧰 عامل</option>
              <option value="كاشير">🧾 كاشير</option>
              <option value="مخزن">📦 مخزن</option>
              <option value="أخرى">👤 أخرى</option>
            </select>
          </div>
          <Input label="تاريخ التعيين *" value={employeeForm.hire_date} onChange={(v) => setEmployeeForm((p) => ({ ...p, hire_date: v }))} type="date" />
          <Input label="الراتب الأساسي (ر.س)" value={employeeForm.base_salary} onChange={(v) => setEmployeeForm((p) => ({ ...p, base_salary: v }))} type="number" />
          <Input label="البدلات الثابتة (ر.س)" value={employeeForm.allowances} onChange={(v) => setEmployeeForm((p) => ({ ...p, allowances: v }))} type="number" />
          <Input label="تفاصيل البدلات" value={employeeForm.allowances_note} onChange={(v) => setEmployeeForm((p) => ({ ...p, allowances_note: v }))} placeholder="سكن + مواصلات..." />
          <Input label="نسبة (%) — إن وجدت" value={employeeForm.percentage_rate} onChange={(v) => setEmployeeForm((p) => ({ ...p, percentage_rate: v }))} type="number" />
          <Input label="أيام الإجازة السنوية" value={employeeForm.leave_days_per_year} onChange={(v) => setEmployeeForm((p) => ({ ...p, leave_days_per_year: v }))} type="number" placeholder="21" />
          <div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>الجنسية (لحساب التأمينات)</div>
            <select value={employeeForm.nationality} onChange={(e) => setEmployeeForm((p) => ({ ...p, nationality: e.target.value }))}
              style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              <option value="سعودي">🇸🇦 سعودي</option>
              <option value="غير سعودي">🌍 غير سعودي</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input type="checkbox" checked={employeeForm.gosi_enabled} onChange={(e) => setEmployeeForm((p) => ({ ...p, gosi_enabled: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ fontSize: 12, color: COLORS.textPrimary }}>احسب اشتراكات التأمينات (GOSI) لهذا الموظف تلقائيًا</span>
          </div>
          <Input label="بدل الجمعة الواحدة (ر.س) — لو بيشتغل جمع" value={employeeForm.friday_allowance_rate} onChange={(v) => setEmployeeForm((p) => ({ ...p, friday_allowance_rate: v }))} type="number" placeholder="0" />
          <div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>🔗 ربط بحساب دخول (اختياري)</div>
            <select value={employeeForm.user_id} onChange={(e) => setEmployeeForm((p) => ({ ...p, user_id: e.target.value }))}
              style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              <option value="">— بدون ربط —</option>
              {availableUsersForLink.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role === "admin" ? "مدير" : u.role === "pharmacist" ? "صيدلاني" : u.role === "warehouse" ? "مخزن" : "كاشير"})</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
              ربط الموظف بحساب دخوله هو الأساس اللي هنبني عليه بعدين نقل الحضور والمبيعات من الاسم للـ ID.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Input label="ملاحظات" value={employeeForm.note} onChange={(v) => setEmployeeForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
        </div>
        {employeeForm.role === "صيدلي" && (
          <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 10, lineHeight: 1.6 }}>
            💡 عمولة التحفيز الشهرية هتتسحب تلقائيًا من تاب "التارجت" وقت صرف الراتب، مش محتاج تدخلها هنا.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowEmployeeForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={saveEmployee}>{editingEmployee ? "حفظ التعديل" : "إضافة"}</Btn>
        </div>
      </Modal>

      {/* Modal صرف راتب */}
      {showPayForm && (
        <Modal open title={`💵 صرف راتب — ${showPayForm.name} (${payMonth})`} onClose={() => !savingSalary && setShowPayForm(null)} wide>
          {(() => {
            const st = getEmployeeMonthPayStatus(showPayForm);
            if (st.status === "unpaid") return null;
            return (
              <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 10, padding: 10, marginBottom: 12, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ color: COLORS.textDim }}>إجمالي المستحق عن {payMonth}</span><strong>{st.due.toFixed(2)} ر.س</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ color: COLORS.textDim }}>اتصرف سابقًا (دفعات قبل كده)</span><strong style={{ color: COLORS.green }}>{st.paid.toFixed(2)} ر.س</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.gold, fontWeight: 700 }}>المتبقي (اتعبّى تلقائيًا تحت)</span><strong style={{ color: COLORS.gold }}>{st.remaining.toFixed(2)} ر.س</strong></div>
              </div>
            );
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="الراتب الأساسي" value={payForm.base_salary} onChange={(v) => setPayForm((p) => ({ ...p, base_salary: v }))} type="number" />
            <Input label="البدلات" value={payForm.allowances} onChange={(v) => setPayForm((p) => ({ ...p, allowances: v }))} type="number" />
            <Input label="مبلغ النسبة (%)" value={payForm.percentage_amount} onChange={(v) => setPayForm((p) => ({ ...p, percentage_amount: v }))} type="number" placeholder="0.00" />
            <Input label="عمولة تحفيز (تارجت)" value={payForm.target_commission} onChange={(v) => setPayForm((p) => ({ ...p, target_commission: v }))} type="number" />
            <Input label="إضافات أخرى" value={payForm.other_addition} onChange={(v) => setPayForm((p) => ({ ...p, other_addition: v }))} type="number" />
          </div>
          {showPayForm.role === "صيدلي" && (
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 8 }}>
              💊 إجمالي مبيعات {showPayForm.name} خلال {payMonth} اللي احتُسبت عليها العمولة: <strong style={{ color: COLORS.textPrimary }}>{commissionSalesBasis.toFixed(2)} ر.س</strong>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Input label="خصم سلفة" value={payForm.deduction_advance} onChange={(v) => setPayForm((p) => ({ ...p, deduction_advance: v }))} type="number" />
            <Input label="سبب السلفة" value={payForm.deduction_advance_note} onChange={(v) => setPayForm((p) => ({ ...p, deduction_advance_note: v }))} placeholder="اختياري" />
            <Input label="خصم غياب" value={payForm.deduction_absence} onChange={(v) => setPayForm((p) => ({ ...p, deduction_absence: v }))} type="number" />
            <Input label="سبب خصم الغياب" value={payForm.deduction_absence_note} onChange={(v) => setPayForm((p) => ({ ...p, deduction_absence_note: v }))} placeholder="اختياري" />
          </div>
          <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 700, marginBottom: 8 }}>🏛️ التأمينات الاجتماعية (GOSI) — {showPayForm.nationality || "سعودي"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="خصم التأمينات من الموظف" value={payForm.gosi_employee_deduction} onChange={(v) => setPayForm((p) => ({ ...p, gosi_employee_deduction: v }))} type="number" />
              <Input label="حصة صاحب العمل (لا تُخصم من الراتب)" value={payForm.gosi_employer_contribution} onChange={(v) => setPayForm((p) => ({ ...p, gosi_employer_contribution: v }))} type="number" />
            </div>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 8, lineHeight: 1.5 }}>
              ⚠️ نسب تقديرية للتأكد راجع بوابة GOSI. حصة صاحب العمل هنا للتوثيق فقط، وبتتحول شهريًا لمنصة GOSI مجمّعة وليست جزء من صافي الراتب.
            </div>
          </div>
          <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 700, marginBottom: 8 }}>⏱️ الحضور والانصراف — {payMonth}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="عدد أيام الجمعة اللي اشتغلها" value={payForm.friday_count} onChange={(v) => setPayForm((p) => ({ ...p, friday_count: v }))} type="number" />
              <Input label="بدل الجُمع (ر.س)" value={payForm.friday_allowance} onChange={(v) => setPayForm((p) => ({ ...p, friday_allowance: v }))} type="number" />
              <Input label="إجمالي دقائق التأخير" value={payForm.late_minutes} onChange={(v) => setPayForm((p) => ({ ...p, late_minutes: v }))} type="number" />
              <Input label="خصم التأخير (ر.س)" value={payForm.deduction_lateness} onChange={(v) => setPayForm((p) => ({ ...p, deduction_lateness: v }))} type="number" />
            </div>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 8, lineHeight: 1.5 }}>
              💡 محسوبين تلقائيًا من سجلات الحضور وبدل الجمعة المسجّل في بيانات الموظف. خصم التأخير بمعدل ساعي فعلي (الراتب ÷ ساعات الجدول الأسبوعي المحفوظ للموظف)، وبعد استبعاد فترة السماح المسجّلة في جدول الدوام. راجع الرقمين وعدّلهم يدويًا لو محتاج.
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>طريقة الصرف</div>
            <select value={payForm.method} onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
              style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              <option value="نقدي">💵 نقدي</option>
              <option value="بطاقة">💳 بطاقة</option>
              <option value="تحويل">🏦 تحويل بنكي</option>
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <Input label="ملاحظة" value={payForm.note} onChange={(v) => setPayForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn variant="ghost" icon="printer" onClick={() => printSalaryReceipt(showPayForm)}>🖨️ طباعة إيصال الاستلام</Btn>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>اطبع الإيصال، خلي {showPayForm.name} يمضي عليه ورقيًا، بعدين صوّر الإيصال الممضي وارفعه في "إثبات الصرف" تحت قبل ما تأكد.</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>إثبات الصرف (اختياري)</label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => { const file = e.target.files[0]; if (file) setPayForm((p) => ({ ...p, proof: file })); }} style={{ color: COLORS.textPrimary, fontSize: 12 }} />
            {payForm.proof && <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>✓ {payForm.proof.name}</div>}
          </div>
          <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textDim, marginBottom: 8 }}>
              <span>الإجمالي المحسوب من التفاصيل فوق</span>
              <span>
                {payNetTotal().toFixed(2)} ر.س
                {(+payForm.actual_amount || 0).toFixed(2) !== payNetTotal().toFixed(2) && (
                  <button onClick={() => setPayForm((p) => ({ ...p, actual_amount: payNetTotal().toFixed(2) }))} style={{ marginRight: 8, background: "none", border: "none", color: COLORS.accent, cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>استخدم الرقم ده</button>
                )}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>💵 المبلغ اللي هيتصرف فعليًا</span>
              <input
                type="number"
                value={payForm.actual_amount}
                onChange={(e) => setPayForm((p) => ({ ...p, actual_amount: e.target.value }))}
                style={{ width: 140, textAlign: "left", fontWeight: 900, fontSize: 18, color: payActualAmount() <= 0 ? COLORS.red : COLORS.green, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px" }}
              />
            </div>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 6 }}>ده الرقم اللي بيتسجّل فعليًا كمصروف ويحسب على أساسه المتبقي — ممكن يختلف عن الإجمالي المحسوب لو مثلاً هتصرف جزء بس.</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowPayForm(null)} disabled={savingSalary}>إلغاء</Btn>
            <Btn icon="check" onClick={() => saveSalaryPayment(showPayForm)} disabled={savingSalary}>{savingSalary ? "جاري الحفظ..." : "تأكيد الصرف"}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal إجازة */}
      {showLeaveForm && (
        <Modal open title={`🏖️ رصيد إجازة — ${showLeaveForm.name}`} onClose={() => !savingLeave && setShowLeaveForm(null)}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
            الرصيد الحالي: <strong style={{ color: COLORS.textPrimary }}>{getEmployeeLeaveBalance(showLeaveForm).toFixed(1)} يوم</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>نوع الحركة</div>
              <select value={leaveForm.type} onChange={(e) => setLeaveForm((p) => ({ ...p, type: e.target.value }))}
                style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
                <option value="cashout">💰 صرف نقدًا (بدل إجازة)</option>
                <option value="taken">🗓️ إجازة فعلية (خصم من الرصيد فقط)</option>
              </select>
            </div>
            <Input label="عدد الأيام" value={leaveForm.days} onChange={(v) => setLeaveForm((p) => ({ ...p, days: v }))} type="number" />
            {leaveForm.type === "cashout" && (
              <Input label="المبلغ المصروف (ر.س)" value={leaveForm.amount} onChange={(v) => setLeaveForm((p) => ({ ...p, amount: v }))} type="number" />
            )}
            <Input label="ملاحظة" value={leaveForm.note} onChange={(v) => setLeaveForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowLeaveForm(null)} disabled={savingLeave}>إلغاء</Btn>
            <Btn icon="check" onClick={() => saveLeaveCashout(showLeaveForm)} disabled={savingLeave}>{savingLeave ? "جاري الحفظ..." : "تأكيد"}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal إنهاء الخدمة */}
      {showEosForm && (() => {
        const preview = previewEos(showEosForm);
        return (
          <Modal open title={`🏁 تسوية نهاية الخدمة — ${showEosForm.name}`} onClose={() => !savingEos && setShowEosForm(null)} wide>
            <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, marginBottom: 12 }}>
              ⚠️ حساب تقديري حسب نظام العمل السعودي (نص شهر عن كل سنة من أول 5 سنين + شهر كامل عن كل سنة بعد كده)، على أساس الراتب الأساسي + البدلات فقط. ده مش استشارة قانونية — راجع مختص عند التسوية الفعلية.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="تاريخ انتهاء الخدمة" value={eosForm.termination_date} onChange={(v) => setEosForm((p) => ({ ...p, termination_date: v }))} type="date" />
              <div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>نوع إنهاء الخدمة</div>
                <select value={eosForm.termination_type} onChange={(e) => setEosForm((p) => ({ ...p, termination_type: e.target.value }))}
                  style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
                  <option value="normal">انتهاء عادي / فصل من صاحب العمل (استحقاق كامل)</option>
                  <option value="resignation">استقالة (استحقاق حسب مدة الخدمة)</option>
                </select>
              </div>
            </div>
            <div style={{ background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>مدة الخدمة</span><strong>{preview.eosb.years.toFixed(2)} سنة</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>الأجر المحسوب عليه</span><strong>{preview.wage.toFixed(2)} ر.س</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>مكافأة نهاية الخدمة</span><strong>{preview.eosb.netAmount.toFixed(2)} ر.س</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>رصيد إجازة ({preview.leaveBalance.toFixed(1)} يوم)</span><strong>{preview.leaveCashout.toFixed(2)} ر.س</strong></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Input label="إضافات أخرى" value={eosForm.other_addition} onChange={(v) => setEosForm((p) => ({ ...p, other_addition: v }))} type="number" />
              <Input label="خصومات أخرى" value={eosForm.other_deduction} onChange={(v) => setEosForm((p) => ({ ...p, other_deduction: v }))} type="number" />
              <Input label="سبب الخصم" value={eosForm.other_deduction_note} onChange={(v) => setEosForm((p) => ({ ...p, other_deduction_note: v }))} placeholder="اختياري" />
              <div>
                <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>طريقة الصرف</div>
                <select value={eosForm.method} onChange={(e) => setEosForm((p) => ({ ...p, method: e.target.value }))}
                  style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
                  <option value="نقدي">💵 نقدي</option>
                  <option value="بطاقة">💳 بطاقة</option>
                  <option value="تحويل">🏦 تحويل بنكي</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Input label="ملاحظة" value={eosForm.note} onChange={(v) => setEosForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>مستند التسوية (اختياري)</label>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => { const file = e.target.files[0]; if (file) setEosForm((p) => ({ ...p, proof: file })); }} style={{ color: COLORS.textPrimary, fontSize: 12 }} />
              {eosForm.proof && <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>✓ {eosForm.proof.name}</div>}
            </div>
            <div style={{ background: COLORS.goldSoft, borderRadius: 10, padding: 12, marginTop: 14, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.gold, fontWeight: 700 }}>صافي التسوية</span>
              <span style={{ color: COLORS.gold, fontWeight: 900, fontSize: 18 }}>{preview.net.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowEosForm(null)} disabled={savingEos}>إلغاء</Btn>
              <Btn icon="check" onClick={() => saveEosSettlement(showEosForm)} disabled={savingEos}>{savingEos ? "جاري الحفظ..." : "تأكيد التسوية النهائية"}</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Modal مصروف ثابت */}
      <Modal open={showFixedForm} onClose={() => setShowFixedForm(false)} title="🔒 إضافة مصروف ثابت">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="اسم المصروف" value={fixedForm.name} onChange={(v) => setFixedForm((p) => ({ ...p, name: v }))} placeholder="إيجار، رواتب..." />
          <Input label="المبلغ (ر.س)" value={fixedForm.amount} onChange={(v) => setFixedForm((p) => ({ ...p, amount: v }))} type="number" />
          <Select label="نوع التكرار" value={fixedForm.recurrence}
            onChange={(v) => setFixedForm((p) => ({ ...p, recurrence: v }))}
            options={[
              { v: "monthly", l: "شهري" },
              { v: "quarterly", l: "ربع سنوي (كل 3 أشهر)" },
              { v: "semi_annual", l: "نصف سنوي (كل 6 أشهر)" },
              { v: "annual", l: "سنوي" },
            ]} />
          <Input label="يوم الاستحقاق (1-31)" value={fixedForm.due_day} onChange={(v) => setFixedForm((p) => ({ ...p, due_day: v }))} type="number" />
          {fixedForm.recurrence !== "monthly" && (
            <Select label="شهر أول استحقاق" value={fixedForm.due_month}
              onChange={(v) => setFixedForm((p) => ({ ...p, due_month: v }))}
              options={[
                { v: "1", l: "يناير" }, { v: "2", l: "فبراير" }, { v: "3", l: "مارس" },
                { v: "4", l: "أبريل" }, { v: "5", l: "مايو" }, { v: "6", l: "يونيو" },
                { v: "7", l: "يوليو" }, { v: "8", l: "أغسطس" }, { v: "9", l: "سبتمبر" },
                { v: "10", l: "أكتوبر" }, { v: "11", l: "نوفمبر" }, { v: "12", l: "ديسمبر" },
              ]} />
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowFixedForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            if (!fixedForm.name || !fixedForm.amount) return;
            const { data, error } = await supabase.from("fixed_expenses").insert([{ ...fixedForm, amount: +fixedForm.amount, due_month: +fixedForm.due_month, pharmacy_id: pharmacyId }]).select();
            if (error) { showToast("خطأ: " + error.message, "error"); return; }
            setFixedExpenses((p) => [...p, data[0]]);
            setFixedForm({ name: "", amount: "", due_day: "1", recurrence: "monthly", due_month: "1" });
            setShowFixedForm(false);
            showToast("تم الإضافة ✓");
          }}>إضافة</Btn>
        </div>
      </Modal>

      {/* Modal ترخيص */}
      <Modal open={showLicenseForm} onClose={() => setShowLicenseForm(false)} title="📄 إضافة ترخيص">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="اسم الترخيص" value={licenseForm.name} onChange={(v) => setLicenseForm((p) => ({ ...p, name: v }))} placeholder="رخصة تشغيل..." />
          <Input label="تاريخ التجديد" value={licenseForm.renew_date} onChange={(v) => setLicenseForm((p) => ({ ...p, renew_date: v }))} type="date" />
          <Input label="التكلفة (ر.س)" value={licenseForm.amount} onChange={(v) => setLicenseForm((p) => ({ ...p, amount: v }))} type="number" />
          <Input label="ملاحظات" value={licenseForm.note} onChange={(v) => setLicenseForm((p) => ({ ...p, note: v }))} placeholder="تفاصيل..." />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowLicenseForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            if (!licenseForm.name || !licenseForm.renew_date) return;
            const { data, error } = await supabase.from("licenses").insert([{ ...licenseForm, amount: +licenseForm.amount || 0, pharmacy_id: pharmacyId }]).select();
            if (error) { showToast("خطأ: " + error.message, "error"); return; }
            setLicenses((p) => [...p, data[0]].sort((a, b) => a.renew_date.localeCompare(b.renew_date)));
            setLicenseForm({ name: "", renew_date: "", amount: "", note: "" });
            setShowLicenseForm(false);
            showToast("تم الإضافة ✓");
          }}>إضافة</Btn>
        </div>
      </Modal>
    </div>
  );
}
