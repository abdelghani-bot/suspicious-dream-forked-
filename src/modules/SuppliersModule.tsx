import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { queueEvent, insertTreasuryEntry } from "../lib/offlineAPI";
import { COLORS, tint } from "../theme";
import { TAX_RATE } from "../data/seedData";
import { logAudit } from "../lib/auditLog";
import { todayLocal } from "../lib/dateUtils";
import { computeStockoutForecast } from "../lib/inventoryUtils";
import { SUPPLY_CATEGORIES, SUPPLY_CATEGORY_ICONS } from "../lib/productConstants";
import { computeAvailableForPayment } from "../lib/treasuryUtils";
import { Badge, Btn, IC, Input, Modal } from "../ui/primitives";

export function SuppliersModule({
  suppliers,
  setSuppliers,
  purchases,
  setPurchases,
  products,
  setProducts,
  sales,
  showToast,
  onCreateOrder,
  pharmacyId,
  currentUser,
  setTreasuryEntries,
  treasuryEntries = [], // 🆕 لحساب رصيد الخزنة الفعلي قبل السماح بالسداد
  creditPayments = [], // 🆕 نفس السبب
  canAdd = true,
  canDelete = true,
  canEdit = true,
  canEditSub = (_sub) => true,
  jokerPendingItems = [],
  setJokerPendingItems = () => {},
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [supplierNameSearch, setSupplierNameSearch] = useState(""); // 🆕 بحث سريع باسم المورد
  // 🆕 تاب "قائمة الموردين" / "تحليل الموردين" + فلتر الفئة
  const [supplierViewTab, setSupplierViewTab] = useState("list"); // "list" | "analysis"
  const [categoryFilter, setCategoryFilter] = useState(null); // فئة توريد محددة من "تحليل الموردين"
  const [analysisMonths, setAnalysisMonths] = useState(12); // 🆕 مدى شارت المشتريات/السداد الشهري
  const [analysisSupplierIds, setAnalysisSupplierIds] = useState([]); // 🆕 موردين محددين للمقارنة (فاضي = كل الموردين)
  // 🆕 شاشة مراجعة أصناف الجوكر المعلّقة — مراجعة يدوية قبل ما تدخل أي طلب شراء
  const [showJokerReview, setShowJokerReview] = useState(false);
  const [jokerReviewSupplier, setJokerReviewSupplier] = useState({}); // { [groupKey]: supplierId }
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [showPayForm, setShowPayForm] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(null);
  const [showStatements, setShowStatements] = useState(null);
  const [coverageDays, setCoverageDays] = useState(30);
  const [orderItems, setOrderItems] = useState([]);
  // ── الميزانية المتاحة لطلب الشراء الحالي (اختياري) ──
  const [orderBudget, setOrderBudget] = useState("");
  // ── أصناف منقولة لمورد أرخص، بانتظار فتح طلب الشراء الخاص به (جلسة حالية فقط) ──
  const [pendingBySupplier, setPendingBySupplier] = useState({});
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [manualProductSearchOpen, setManualProductSearchOpen] = useState(false);
  const [expandedSupplierIds, setExpandedSupplierIds] = useState({});
  const toggleSupplierExpand = (id) => setExpandedSupplierIds((p) => ({ ...p, [id]: !p[id] }));
  const [payForm, setPayForm] = useState({ amount: "", note: "", method: "نقدي", receipt: null, receiptUrl: "" });

  // ── مرتجع تلقائي ──
  const [showAutoReturn, setShowAutoReturn] = useState(null); // المورد المختار
  const [autoReturnItems, setAutoReturnItems] = useState([]);

  const blank = {
    id: "",
    name: "",
    taxId: "",
    phone: "",
    email: "",
    address: "",
    contact: "",
    credit_limit: 0,
    payment_terms: 30,
    whatsapp: "",
    opening_balance: 0,
    opening_balance_details: [], // [{id, invoice_no, amount, due_days, note}]
    supply_categories: [],
    gln: "", // 🆕 رقم GLN الخاص بالمورد في نظام رصد — لازم عشان إشعارات مرتجع المشتريات (TOGLN)
    // 🆕 "عام": بيورد أي صنف من فئاته بشكل عام. "متخصص": بيورد بس الأصناف المربوطة بيه صراحة
    // (product.linked_supplier_ids) حتى لو باقي أصناف نفس الفئة مش متاحة عنده فعليًا.
    supplier_type: "عام",
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // تحميل الدفعات والأوردرات
  useEffect(() => {
    supabase.from("payments").select("*").order("date", { ascending: true })
      .then(({ data }) => { if (data) setPayments(data); });
    supabase.from("orders").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setOrders(data); });
  }, []);

  // ========== حالة المورد ==========
  const getSupplierStatus = (supplier) => {
    const supPurchases = purchases.filter(
      (p) => p.supplier === supplier.id && p.payment_status !== "مسددة"
    );
    if (supPurchases.length === 0) return "green";
    const today = new Date();
    let maxDelay = 0;
    for (const po of supPurchases) {
      const dueDate = new Date(po.date);
      dueDate.setDate(dueDate.getDate() + (supplier.payment_terms || 30));
      const delay = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      if (delay > maxDelay) maxDelay = delay;
    }
    if (maxDelay <= 0) return "green";
    if (maxDelay <= 30) return "orange";
    return "red";
  };

  const statusColor = {
    green:  { bg: COLORS.greenSoft, border: COLORS.green, text: COLORS.green, label: "منتظم" },
    orange: { bg: COLORS.goldSoft, border: COLORS.gold, text: COLORS.gold, label: "تأخير بسيط" },
    red:    { bg: COLORS.redSoft, border: COLORS.red, text: COLORS.red, label: "متأخر" },
  };

  // ========== المستحقات ==========
  // 🆕 كل فاتورة دينها الصافي = total - paid - returned_amount
  // لو فاتورة انتهى دينها وعندها مرتجع زيادة، الفرق السالب يترحّل تلقائيًا
  // لأن المجموع الكلي للموردين هو جمع كل الفواتير (سالبة وموجبة) مع بعض.
  const getSupplierDebt = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const openingBalance = supplier?.opening_balance || 0;
    const invoicesDebt = purchases
      .filter((p) => p.supplier === supplierId)
      .reduce((s, p) => s + (p.total - (p.paid || 0) - (p.returned_amount || 0)), 0);
    return openingBalance + invoicesDebt;
  };

  // 🆕 دين فاتورة شراء واحدة بعد خصم المسدد والمرتجع
  const getPurchaseNetDebt = (po) => (po.total || 0) - (po.paid || 0) - (po.returned_amount || 0);

  // ========== أعمار الدين لرصيد أول المدة ==========
  const getOpeningBalanceAging = (details = []) => {
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    details.forEach((d) => {
      const days = d.due_days || 0;
      if (days <= 30) buckets["0-30"] += d.amount || 0;
      else if (days <= 60) buckets["31-60"] += d.amount || 0;
      else if (days <= 90) buckets["61-90"] += d.amount || 0;
      else buckets["90+"] += d.amount || 0;
    });
    return buckets;
  };

  // ========== المرتجع التلقائي ==========
  const getAutoReturnCandidates = (supplierId) => {
    const today = new Date();
    return (products || []).filter((p) => {
      if (!p.expiry || p.stock <= 0) return false;
      const expiryDate = new Date(p.expiry);
      const daysToExpiry = (expiryDate - today) / (1000 * 60 * 60 * 24);
      if (daysToExpiry <= 0) return false;

      // هل الصنف مشترى من هذا المورد؟
      const boughtFromSupplier = purchases.some(
        (pu) => pu.supplier === supplierId && pu.items?.some((i) => i.id === p.id)
      );
      if (!boughtFromSupplier) return false;

      // هل يتحرك؟
      const noMovement = (days) => {
        const since = new Date();
        since.setDate(since.getDate() - days);
        return !(sales || []).some(
          (s) => new Date(s.date) >= since && s.items?.some((i) => i.id === p.id)
        );
      };

      // القاعدة 1: صلاحية أقل من 3 شهور + لا حركة شهر
      if (daysToExpiry < 90 && noMovement(30)) return true;
      // القاعدة 2: صلاحية أقل من 6 شهور + لا حركة شهرين
      if (daysToExpiry < 180 && noMovement(60)) return true;

      return false;
    }).map((p) => {
      const expiryDate = new Date(p.expiry);
      const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      return { ...p, daysToExpiry, returnQty: p.stock };
    });
  };

  const openAutoReturn = (supplier) => {
    const candidates = getAutoReturnCandidates(supplier.id);
    setAutoReturnItems(candidates.map((p) => ({ ...p, returnQty: p.stock })));
    setShowAutoReturn(supplier);
  };

  // ═══════════════════════════════════════════════════
  // 🆕 توزيع قيمة مرتجع (مشتريات) على أقدم فواتير المورد التي لها دين
  // نفس فكرة processPaymentFIFO لكن بالعكس: نزيد returned_amount بدل paid
  // يرجّع: { updates: [{id, returned_amount}], unallocated: number }
  // unallocated = الجزء اللي ما لقى له فاتورة (يبقى كرصيد دائن عام يدخل
  // في getSupplierDebt تلقائيًا عبر opening_balance لو احتجت تسويته يدويًا،
  // أو ببساطة يفضل "معلّق" حتى تُنشأ فاتورة جديدة فتُخصم منها أول ما تُسجَّل)
  // ═══════════════════════════════════════════════════
  const applyReturnFIFO = (supplierId, totalReturnAmount) => {
    const unpaid = purchases
      .filter((p) => p.supplier === supplierId && getPurchaseNetDebt(p) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // الأقدم أولاً

    let remaining = totalReturnAmount;
    const updates = [];
    for (const po of unpaid) {
      if (remaining <= 0) break;
      const debt = getPurchaseNetDebt(po);
      const allocate = Math.min(remaining, debt);
      const newReturnedAmount = (po.returned_amount || 0) + allocate;
      updates.push({ id: po.id, returned_amount: newReturnedAmount });
      remaining -= allocate;
    }
    // لو فاضل remaining > 0 معناه المرتجع أكبر من كل الديون المفتوحة
    // نطرحه من أقدم فاتورة على الإطلاق (حتى لو مسددة) فيبقى رصيد دائن (returned_amount > total)
    if (remaining > 0) {
      const oldestAny = purchases
        .filter((p) => p.supplier === supplierId)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
      if (oldestAny) {
        const existingUpdate = updates.find((u) => u.id === oldestAny.id);
        const base = existingUpdate ? existingUpdate.returned_amount : (oldestAny.returned_amount || 0);
        const newVal = base + remaining;
        if (existingUpdate) {
          existingUpdate.returned_amount = newVal;
        } else {
          updates.push({ id: oldestAny.id, returned_amount: newVal });
        }
        remaining = 0;
      }
    }
    return { updates, unallocated: remaining };
  };

    const persistReturnFIFO = async (supplierId, totalReturnAmount) => {
        const { updates, unallocated } = applyReturnFIFO(supplierId, totalReturnAmount);

        for (const u of updates) {
            const result = await queueEvent({
                id: crypto.randomUUID(),
                type: "PURCHASE_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId, // 🆕 على المستوى العلوي — نفس القاعدة في كل event
                payload: { id: u.id, pharmacy_id: pharmacyId, updates: { returned_amount: u.returned_amount } },
            });
            if (!result.synced && result.error) {
                showToast("⚠️ تحديث المرتجع اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + result.error, "warning");
            }
        }

        setPurchases((prev) =>
            prev.map((p) => {
                const u = updates.find((x) => x.id === p.id);
                return u ? { ...p, returned_amount: u.returned_amount } : p;
            })
        );
        if (unallocated > 0) {
            showToast("⚠️ لا توجد فواتير لهذا المورد لتسجيل المرتجع عليها — راجع رصيد أول المدة", "error");
        }
        return updates;
    };

    const saveAutoReturn = async () => {
        if (!showAutoReturn || autoReturnItems.length === 0) return;

        const items = autoReturnItems.filter((i) => i.returnQty > 0);
        if (items.length === 0) {
            showToast("لا توجد كميات للإرجاع", "error");
            return;
        }

        const subtotal = items.reduce((s, i) => s + (i.cost || i.price || 0) * i.returnQty, 0);
        const tax = items.reduce((s, i) => i.taxable ? s + (i.cost || i.price || 0) * i.returnQty * TAX_RATE : s, 0);
        const total = subtotal + tax;
        const returnId = "RET-" + Date.now();
        const today = todayLocal();

        const stockUpdates = [];
        for (const ri of items) {
            const prod = products.find((x) => x.id === ri.id);
            if (!prod) continue;
            const newStock = prod.stock - ri.returnQty;

            const result = await queueEvent({
                id: crypto.randomUUID(),
                type: "PRODUCT_FIELD_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId,
                payload: { id: ri.id, pharmacy_id: pharmacyId, updates: { stock: newStock } },
            });
            if (!result.synced && result.error) {
                showToast(`⚠️ تحديث مخزون ${prod.name || ri.id} اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: ` + result.error, "warning");
            }
            stockUpdates.push({ id: ri.id, stock: newStock });
        }
        // 🆕 تطبيق واحد بس على state — ده حل مشكلة تكرار خصم المخزون اللي كانت موجودة
        // (كان فيه setProducts هنا + setProducts تانية في آخر الدالة بتطرح returnQty تاني)
        if (stockUpdates.length > 0) {
            setProducts((prev) => prev.map((p) => {
                const u = stockUpdates.find((x) => x.id === p.id);
                return u ? { ...p, stock: u.stock } : p;
            }));
        }

        const returnRecord = {
            id: returnId,
            date: today,
            type: "purchases",
            supplier_id: showAutoReturn.id,
            supplier_name: showAutoReturn.name,
            purchase_invoice_id: null, // مرتجع تلقائي غير مرتبط بفاتورة واحدة، التوزيع يتم عبر FIFO
            items,
            reason: "مرتجع تلقائي — قرب انتهاء الصلاحية",
            subtotal,
            tax,
            total,
            pharmacy_id: pharmacyId,
        };

        const returnResult = await queueEvent({
            id: crypto.randomUUID(),
            type: "RETURN_INSERT",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId,
            payload: { return: returnRecord },
        });
        if (!returnResult.synced && returnResult.error) {
            showToast("⚠️ المرتجع اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + returnResult.error, "warning");
        }

        setReturnsData((prev) => [returnRecord, ...prev]);

        logAudit({
            pharmacyId, userName: currentUser?.name, action: "create", entityType: "return",
            entityId: returnId, entityLabel: showAutoReturn.name,
            newValue: { supplier: showAutoReturn.name, total, itemsCount: items.length },
            description: `مرتجع تلقائي (قرب انتهاء الصلاحية) للمورد "${showAutoReturn.name}" بقيمة ${total} ر.س`,
        });

        // توزيع قيمة المرتجع على أقدم فواتير المورد المديونة (FIFO عكسي)
        await persistReturnFIFO(showAutoReturn.id, total);

        if (showAutoReturn.whatsapp) {
            const itemsText = items
                .map((i) => "- " + i.name + ": " + i.returnQty + " وحدة - صلاحية " + i.expiry)
                .join("\n");
            const msg = "طلب مرتجع - " + new Date().toLocaleDateString("ar") + "\n" + itemsText;
            window.open("https://wa.me/" + showAutoReturn.whatsapp + "?text=" + encodeURIComponent(msg), "_blank");
        }

        setShowAutoReturn(null);
        setAutoReturnItems([]);
        showToast("تم حفظ طلب المرتجع — وتم خصمه من مديونية المورد ✓");
    };
  // ========== أيام الاستحقاق ==========
  const getDueDays = (po, supplier) => {
    const sup = typeof supplier === "object" && supplier !== null
      ? supplier
      : suppliers.find((s) => s.id === (supplier || po.supplier));
    const terms = sup?.payment_terms || 30;
    const due = new Date(po.date);
    due.setDate(due.getDate() + terms);
    return Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
  };

  // ========== FIFO للسداد (رصيد أول المدة يُعتبر أقدم دين فيُسدَّد أولاً) ==========
    const processPaymentFIFO = async (supplierId, totalAmount) => {
        let remaining = totalAmount;
        const supplier = suppliers.find((s) => s.id === supplierId);

        // 1) نخصم من رصيد أول المدة أولاً (لأنه أقدم دين على المورد)
        let openingBalance = supplier?.opening_balance || 0;
        if (remaining > 0 && openingBalance > 0) {
            const payToOpening = Math.min(remaining, openingBalance);
            const newOpeningBalance = openingBalance - payToOpening;

            let toDeduct = payToOpening;
            const newDetails = [...(supplier?.opening_balance_details || [])]
                .sort((a, b) => (b.due_days || 0) - (a.due_days || 0))
                .map((d) => {
                    if (toDeduct <= 0) return d;
                    const cut = Math.min(toDeduct, d.amount || 0);
                    toDeduct -= cut;
                    return { ...d, amount: (d.amount || 0) - cut };
                })
                .filter((d) => (d.amount || 0) > 0.001);

            // 🆕 SUPPLIER_UPDATE بنفس الـ case اللي ضفناه في مرحلة الـ CRUD — بنبعتله بس الحقول اللي اتغيرت
            const obResult = await queueEvent({
                id: crypto.randomUUID(),
                type: "SUPPLIER_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId, // 🆕 على المستوى العلوي — نفس القاعدة في كل event
                payload: {
                    id: supplierId, pharmacy_id: pharmacyId,
                    updates: { opening_balance: newOpeningBalance, opening_balance_details: newDetails },
                },
            });
            if (!obResult.synced && obResult.error) {
                showToast("⚠️ رصيد أول المدة اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + obResult.error, "warning");
            }

            setSuppliers((prev) =>
                prev.map((x) => (x.id === supplierId
                    ? { ...x, opening_balance: newOpeningBalance, opening_balance_details: newDetails }
                    : x))
            );

            remaining -= payToOpening;
        }

        // 2) الباقي (إن وجد) يوزّع على فواتير الشراء من الأقدم فالأحدث
        const unpaid = purchases
            .filter((p) => p.supplier === supplierId && getPurchaseNetDebt(p) > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const updates = [];
        for (const po of unpaid) {
            if (remaining <= 0) break;
            const balance = getPurchaseNetDebt(po);
            const payment = Math.min(remaining, balance);
            const newPaid = (po.paid || 0) + payment;
            const stillOwed = (po.total - (po.returned_amount || 0)) - newPaid;
            updates.push({ id: po.id, paid: newPaid, payment_status: stillOwed <= 0 ? "مسددة" : "مسددة جزئياً" });
            remaining -= payment;
        }

        // 🆕 PURCHASE_UPDATE: نفس فكرة SUPPLIER_UPDATE، case عامة تقبل أي تحديث على فاتورة شراء واحدة
        for (const u of updates) {
            const result = await queueEvent({
                id: crypto.randomUUID(),
                type: "PURCHASE_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId,
                payload: { id: u.id, pharmacy_id: pharmacyId, updates: { paid: u.paid, payment_status: u.payment_status } },
            });
            if (!result.synced && result.error) {
                showToast("⚠️ تحديث فاتورة شراء اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + result.error, "warning");
            }
        }

        // 🆕 setPurchases بيحدّث localStorage تلقائيًا (useStorage) — نطبّق كل التحديثات دفعة واحدة
        setPurchases((prev) =>
            prev.map((p) => { const u = updates.find((x) => x.id === p.id); return u ? { ...p, ...u } : p; })
        );
        return updates;
    };

  // ========== حفظ الدفعة ==========
    const savePayment = async (supplier) => {
        const amount = +payForm.amount;
        if (!amount || amount <= 0) { showToast("يرجى إدخال مبلغ صحيح", "error"); return; }

        const payMethod = payForm.method || "نقدي";
        const availableForPayment = computeAvailableForPayment(payMethod, { sales, creditPayments, entries: treasuryEntries });
        if (amount > availableForPayment) {
            const availLabel = (payMethod === "بطاقة" || payMethod === "تحويل") ? "بطاقة + تحويل" : payMethod;
            showToast(`❌ رصيد الخزنة (${availLabel}) لا يكفي — المتاح ${availableForPayment.toFixed(2)} ر.س والمطلوب ${amount.toFixed(2)} ر.س`, "error");
            return;
        }

        let receiptUrl = "";
        // 🆕 رفع الإيصال محتاج نت فعليًا (ملف Storage مش نص عادي يتقفّل في طابور) —
        // نحاول بس لو أونلاين، وإلا نكمل السداد من غير مرفق بدل ما نوقف العملية كلها
        if (payForm.receipt && navigator.onLine) {
            const fileName = `receipts/${supplier.id}_${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("payment_reports").upload(fileName, payForm.receipt);
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from("payment_reports").getPublicUrl(fileName);
                receiptUrl = urlData.publicUrl;
            }
        } else if (payForm.receipt && !navigator.onLine) {
            showToast("⚠️ مفيش نت — هيتسجل السداد من غير مرفق الإيصال", "warning");
        }

        const payId = `PAY-${Date.now()}`;
        const paymentRecord = {
            id: payId, supplier_id: supplier.id,
            date: todayLocal(),
            amount, notes: payForm.note, attachment_url: receiptUrl, pharmacy_id: pharmacyId,
        };

        const payResult = await queueEvent({
            id: crypto.randomUUID(),
            type: "PAYMENT_INSERT",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId,
            payload: { payment: paymentRecord },
        });
        if (!payResult.synced && payResult.error) {
            showToast("⚠️ الدفعة اتحفظت محليًا وهتتزامن لاحقًا — خطأ مؤقت: " + payResult.error, "warning");
        }

        setPayments((p) => [...p, paymentRecord]);
        await processPaymentFIFO(supplier.id, amount);

        // 🆕 insertTreasuryEntry جاهزة من offlineAPI.ts — بتعمل كتابة كاش الخزنة + queueEvent مع بعض،
        // زي ما بتستخدمها باقي الموديولات بالظبط
        const entryPayload = {
            type: "expense",
            sub_type: "supplier_payment",
            method: payForm.method || "نقدي",
            amount,
            note: `سداد مورد: ${supplier.name}${payForm.note ? " - " + payForm.note : ""}`,
            date: todayLocal(),
            pharmacy_id: pharmacyId,
            created_by: currentUser?.name || "",
            ref_id: supplier.id,
        };
        const { id: trId, synced: trSynced } = await insertTreasuryEntry(entryPayload);
        if (!trSynced) {
            console.warn("treasury entry queued for later sync (supplier payment)");
        }
        if (setTreasuryEntries) {
            setTreasuryEntries((p) => [{ id: trId, ...entryPayload }, ...p]);
        }

        setShowPayForm(null);
        setPayForm({ amount: "", note: "", method: "نقدي", receipt: null, receiptUrl: "" });
        showToast(`تم تسجيل الدفعة ✓ — ${amount.toFixed(2)} ر.س`);
    };

  // ========== تصنيف حركة الصنف ==========
  const getMovementClass = (productId) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = (sales || []).filter((s) => {
      const saleDate = new Date(s.date);
      return saleDate >= thirtyDaysAgo && s.items?.some((i) => i.id === productId);
    });
    const salesDays = new Set(recentSales.map((s) => s.date)).size;
    const salesCount = recentSales.length;
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: COLORS.green };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: COLORS.blue };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: COLORS.gold };
    return             { class: "very_slow", label: "بطيء جداً", color: COLORS.red };
  };

  // ========== تكلفة الصنف عند كل مورد (مستخرجة من واقع فواتير الشراء السابقة) ==========
  const getProductCostBySupplier = (productId) => {
    const bySupplier = {}; // supplierId -> { supplierId, supplierName, cost, date }
    (purchases || []).forEach((pu) => {
      const item = pu.items?.find((i) => i.id === productId);
      if (!item) return;
      const cost = item.receivedCost ?? item.cost;
      if (cost == null || !pu.supplier) return;
      const existing = bySupplier[pu.supplier];
      if (!existing || new Date(pu.date) >= new Date(existing.date)) {
        const supplierObj = suppliers.find((s) => s.id === pu.supplier);
        bySupplier[pu.supplier] = {
          supplierId: pu.supplier,
          supplierName: supplierObj?.name || pu.supplier_name || pu.supplier,
          cost: +cost,
          date: pu.date,
        };
      }
    });
    return Object.values(bySupplier).sort((a, b) => a.cost - b.cost);
  };

  // أرخص مورد معروف لصنف معين (باستثناء مورد معين لو محتاجين نقارن بغيره)
  const getCheapestSupplierForProduct = (productId, excludeSupplierId) => {
    const list = getProductCostBySupplier(productId).filter((r) => r.supplierId !== excludeSupplierId);
    return list.length ? list[0] : null;
  };

  // السعر المبدئي المقترح للصنف عند إضافته لطلب مورد معين: آخر سعر اتشرى بيه من نفس المورد،
  // وإلا أرخص سعر معروف من أي مورد آخر، وإلا سعر التكلفة العام المسجل على الصنف
  const getInitialCostFor = (productId, supplierId, fallbackCost) => {
    const history = getProductCostBySupplier(productId);
    const fromSameSupplier = history.find((r) => r.supplierId === supplierId);
    if (fromSameSupplier) return fromSameSupplier.cost;
    if (history.length) return history[0].cost;
    return fallbackCost ?? 0;
  };

  // نقل صنف من الطلب الحالي لقائمة انتظار مورد أرخص (بيتضاف تلقائياً أول ما يتفتح طلب شراء لنفس المورد ده)
  const moveItemToSupplier = (item, targetSupplierId, targetSupplierName) => {
    setOrderItems((prev) => prev.filter((x) => x.id !== item.id));
    setPendingBySupplier((prev) => ({
      ...prev,
      [targetSupplierId]: [...(prev[targetSupplierId] || []), { ...item, cost: getInitialCostFor(item.id, targetSupplierId, item.cost) }],
    }));
    showToast(`تم نقل "${item.name}" لقائمة انتظار طلب ${targetSupplierName} — هيتضاف تلقائياً عند فتح طلب الشراء الخاص به`, "success");
  };

  // ========== توليد أوردر تلقائي ==========
  const generateOrder = (supplier, extraItems = []) => {
    const status = getSupplierStatus(supplier);
    let targetSupplier = supplier;
    if (status === "red") {
      const alternative = suppliers.find((s) => s.id !== supplier.id && getSupplierStatus(s) !== "red");
      if (alternative) { showToast(`المورد متأخر - سيتم الطلب من: ${alternative.name}`, "warning"); targetSupplier = alternative; }
    }
    const supplierCategories = targetSupplier.supply_categories || [];
    const lowStock = (products || []).filter((p) => {
      // 🆕 الصنف المستبعد يدويًا (auto_order === false) ميدخلش حساب الطلب التلقائي خالص —
      // سواء لسه ما اتشرالوش أبدًا، أو الصيدلي قرر يتجاهله من الطلبات
      if (p.auto_order === false) return false;
      const belowMin = p.stock <= (p.min_stock || p.minStock || 0);
      if (!belowMin) return false;
      if (supplierCategories.length === 0) return true;
      const productCategory = p.supply_category || "";
      if (productCategory && supplierCategories.includes(productCategory)) {
        // 🆕 الصنف مربوط صراحة بموردين محددين — لازم المورد الحالي يكون من ضمنهم
        const linkedSuppliers = p.linked_supplier_ids || [];
        if (linkedSuppliers.length > 0) return linkedSuppliers.includes(targetSupplier.id);
        // مفيش ربط صريح — مورد "متخصص" محتاج ربط صريح عشان يشوف أي صنف، أما "عام" فيشوفه زي العادة
        return targetSupplier.supplier_type !== "متخصص";
      }
      if (!productCategory) {
        const lastPurchase = purchases
          .filter((pu) => pu.items?.some((i) => i.id === p.id))
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        return lastPurchase?.supplier === supplier.id;
      }
      return false;
    });
    const items = lowStock.map((p) => {
      const mv = getMovementClass(p.id);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlySales = (sales || []).filter((s) => new Date(s.date) >= thirtyDaysAgo)
        .reduce((sum, s) => { const si = s.items?.find((i) => i.id === p.id); return sum + (si?.qty || 0); }, 0);
      const dailyRate = monthlySales / 30;
      const neededQty = Math.ceil(dailyRate * coverageDays) - p.stock;
      const orderQty = Math.max(neededQty, p.min_stock || 1);
      return { id: p.id, name: p.name, currentStock: p.stock, minStock: p.min_stock || p.minStock || 0, orderQty, cost: getInitialCostFor(p.id, targetSupplier.id, p.cost), movement: mv, editable: true };
    }).filter((i) => i.orderQty > 0)
      .sort((a, b) => ["fast","regular","normal","slow","very_slow"].indexOf(a.movement.class) - ["fast","regular","normal","slow","very_slow"].indexOf(b.movement.class));
    // ضمّ أي أصناف كانت اتنقلت لهذا المورد لأنه الأرخص، وامسحها من قائمة الانتظار
    const pending = pendingBySupplier[targetSupplier.id] || [];
    // 🆕 extraItems: أي أصناف جوكر اختارها الصيدلي يدويًا من شاشة "أصناف جوكر معلّقة" وحب يضيفهم لطلب المورد ده —
    // مفيش حقن تلقائي صامت هنا، الإضافة بتحصل فقط لما الصيدلي يختارها بنفسه
    const merged = [...items, ...extraItems, ...pending.filter((pi) => !items.some((i) => i.id === pi.id))];
    if (pending.length) {
      setPendingBySupplier((prev) => { const p = { ...prev }; delete p[targetSupplier.id]; return p; });
    }
    setOrderItems(merged);
    setOrderBudget("");
    setShowOrderForm(targetSupplier);
  };

  // ========== توزيع الأصناف حسب الميزانية المتاحة ==========
  // بترتب الأصناف حسب أولوية التوقيت (الأقرب لنفاذ المخزون الأول، وبعدين الأسرع حركة عند التعادل)،
  // وبعدين بتوزع الميزانية بالتتابع: كل صنف ياخد كميته الكاملة لحد ما الميزانية تخلص،
  // وآخر صنف تكفيه الميزانية جزئياً بياخد أقصى كمية ممكنة، والباقي كميته بتتصفر (بدون ما يتشال من القائمة).
  const allocateByBudget = () => {
    const budget = +orderBudget;
    if (!budget || budget <= 0) { showToast("اكتب قيمة ميزانية صحيحة", "error"); return; }
    const movementRank = { fast: 0, regular: 1, normal: 2, slow: 3, very_slow: 4 };
    const withUrgency = orderItems.map((item) => {
      const forecast = computeStockoutForecast(sales, item.id, item.currentStock ?? 0);
      // مفيش حركة بيع كفاية نتوقع بيها = نعتبره أقل إلحاحاً (نضيفه في الآخر)
      const daysLeft = item.currentStock <= 0 ? -1 : (forecast ? forecast.daysLeft : Infinity);
      return { ...item, _daysLeft: daysLeft };
    });
    const sorted = [...withUrgency].sort((a, b) => {
      if (a._daysLeft !== b._daysLeft) return a._daysLeft - b._daysLeft;
      const mvA = movementRank[a.movement?.class] ?? 5;
      const mvB = movementRank[b.movement?.class] ?? 5;
      return mvA - mvB;
    });
    let remaining = budget;
    let cutCount = 0;
    const allocated = sorted.map((item) => {
      const unitCost = +item.cost || 0;
      const fullQty = +item.orderQty || 0;
      if (remaining <= 0) { cutCount++; return { ...item, orderQty: 0 }; }
      if (unitCost <= 0) return item; // مفيش تكلفة معروفة، سيبه زي ما هو من غير خصم من الميزانية
      const fullCost = unitCost * fullQty;
      if (fullCost <= remaining) {
        remaining -= fullCost;
        return item;
      }
      const partialQty = Math.floor(remaining / unitCost);
      remaining = 0;
      cutCount++;
      return { ...item, orderQty: partialQty };
    });
    // رجّع الترتيب الأصلي بتاع orderItems عشان الجدول ميتقلبش
    const byId = Object.fromEntries(allocated.map((i) => [i.id, i]));
    setOrderItems(orderItems.map((i) => byId[i.id] || i));
    const used = budget - remaining;
    showToast(`تم التوزيع حسب الميزانية — استخدام ${used.toFixed(2)} من ${budget.toFixed(2)} ر.س${cutCount ? ` — ${cutCount} صنف اتأجل` : ""}`, "success");
  };

  // ========== حفظ الأوردر ==========
    const saveOrder = async () => {
        if (!showOrderForm || orderItems.length === 0) { showToast("لا توجد أصناف للطلب", "error"); return; }
        const orderId = `ORD-${Date.now()}`;
        const totalCost = orderItems.reduce((sum, i) => sum + (+i.cost || 0) * (+i.orderQty || 0), 0);
        const order = { id: orderId, supplier_id: showOrderForm.id, supplier_name: showOrderForm.name, date: todayLocal(), coverage_days: coverageDays, budget: orderBudget ? +orderBudget : null, items: orderItems, total_cost: totalCost, status: "مسودة", pharmacy_id: pharmacyId };

        const result = await queueEvent({
            id: crypto.randomUUID(),
            type: "ORDER_INSERT",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId, // 🆕 على المستوى العلوي — نفس القاعدة في كل event
            payload: { order },
        });
        if (!result.synced && result.error) {
            showToast("⚠️ الأوردر اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + result.error, "warning");
        }

        setOrders((p) => [order, ...p]);

        // 🆕 أي صنف جوكر معلّق دخل ضمن الأوردر ده، نقفله عشان ميتكررش في طلبات تانية
        const jokerIdsUsed = orderItems.filter((i) => i.isJokerPending).flatMap((i) => i.jokerIds || []);
        if (jokerIdsUsed.length > 0) {
            const jokerResult = await queueEvent({
                id: crypto.randomUUID(),
                type: "JOKER_STATUS_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId,
                payload: { ids: jokerIdsUsed, status: "ordered" },
            });
            if (!jokerResult.synced && jokerResult.error) {
                console.warn("JOKER_STATUS_UPDATE queued for later sync:", jokerResult.error);
            }
            setJokerPendingItems((prev) => prev.map((j) => (jokerIdsUsed.includes(j.id) ? { ...j, status: "ordered" } : j)));
        }

        setShowOrderForm(null);
        setOrderItems([]);
        showToast("تم حفظ الأوردر ✓");
        if (showOrderForm.whatsapp) {
            const msg = `طلب شراء - ${order.date}\n` + orderItems.map((i) => `• ${i.name}: ${i.orderQty} وحدة`).join("\n");
            window.open(`https://wa.me/${showOrderForm.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
        }
    };

  // 🆕 تجاهل صنف نهائيًا من حساب الطلبات التلقائية (auto_order = false) — بيفضل يظهر في شاشة الصنف نفسه
  // كـ checkbox لو حبيت ترجّعه تاني في أي وقت
    const dismissFromAutoOrder = async (item) => {
        const result = await queueEvent({
            id: crypto.randomUUID(),
            type: "PRODUCT_FIELD_UPDATE",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId,
            payload: { id: item.id, pharmacy_id: pharmacyId, updates: { auto_order: false } },
        });
        if (!result.synced && result.error) {
            showToast("⚠️ اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + result.error, "warning");
        }
        setProducts((prev) => prev.map((p) => (p.id === item.id ? { ...p, auto_order: false } : p)));
        setOrderItems((prev) => prev.filter((i) => i.id !== item.id));
        showToast(`تم تجاهل "${item.name}" من الطلبات التلقائية — تقدر ترجعه من شاشة الصنف`, "success");
    };

  // 🆕 ========== أصناف الجوكر المعلّقة (مراجعة يدوية) ==========
  // بتتجمع حسب الاسم + الفئة (احتياطًا لو حصل تكرار قديم قبل تفعيل الدمج عند الفاتورة)
  const jokerPendingGroups = useMemo(() => {
    const normName = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const groups = {};
    (jokerPendingItems || []).filter((j) => j.status === "pending").forEach((j) => {
      const key = normName(j.name) + "||" + (j.category || "");
      if (!groups[key]) groups[key] = { key, name: j.name, category: j.category || null, qty: 0, price: j.price || 0, ids: [], occurrences: 0 };
      groups[key].qty += (+j.qty || 1);
      groups[key].occurrences += 1;
      groups[key].ids.push(j.id);
    });
    return Object.values(groups);
  }, [jokerPendingItems]);

  // حذف مجموعة جوكر معلّقة بالكامل (الصيدلي قرر إنه مش هيطلبها، أو غلط في التسجيل)
    const deleteJokerGroup = async (group) => {
        if (!window.confirm(`تأكيد حذف "${group.name}" من قائمة الجوكر المعلّقة؟`)) return;
        const result = await queueEvent({
            id: crypto.randomUUID(),
            type: "JOKER_DELETE",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId,
            payload: { ids: group.ids },
        });
        if (!result.synced && result.error) {
            showToast("⚠️ اتحفظ محليًا وهيتزامن لاحقًا — خطأ مؤقت: " + result.error, "warning");
        }
        setJokerPendingItems((prev) => prev.filter((j) => !group.ids.includes(j.id)));
        showToast("تم الحذف ✓");
    };

  // إضافة مجموعة جوكر لطلب شراء مورد معيّن — يدويًا وبقرار صريح من الصيدلي، مفيش حقن تلقائي
  const addJokerGroupToSupplierOrder = (group, supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) { showToast("اختر المورد الأول", "error"); return; }
    const jokerOrderItem = {
      id: "JOKER-ORDER-" + group.ids.join("-"),
      name: group.name,
      currentStock: 0,
      minStock: 0,
      orderQty: group.qty,
      cost: group.price,
      movement: { class: "joker", label: "⚠ جوكر (فرصة ضائعة)", color: COLORS.gold },
      editable: true,
      isJokerPending: true,
      jokerIds: group.ids,
    };
    if (showOrderForm && showOrderForm.id === supplier.id) {
      // فيه طلب مفتوح بالفعل لنفس المورد — نضيف عليه بس
      setOrderItems((prev) => (prev.some((i) => i.id === jokerOrderItem.id) ? prev : [...prev, jokerOrderItem]));
    } else {
      // مفيش طلب مفتوح لهذا المورد — نفتحله طلب جديد ونحط الجوكر جواه على طول
      generateOrder(supplier, [jokerOrderItem]);
    }
    setShowJokerReview(false);
    showToast(`تمت إضافة "${group.name}" لطلب ${supplier.name} ✓`);
  };

  // ========== تقييم المورد ==========
  const getSupplierRating = (supplierId) => {
    const supPurchases = purchases.filter((p) => p.supplier === supplierId);
    if (supPurchases.length === 0) return null;
    const totalOrdered  = supPurchases.reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.qty, 0), 0);
    const totalReceived = supPurchases.filter((p) => p.status === "مستلمة" || p.status === "مستلمة جزئياً").reduce((s, p) => s + p.items.reduce((ss, i) => ss + i.qty, 0), 0);
    const fulfillmentRate = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 100;
    return { fulfillmentRate, totalInvoices: supPurchases.length };
  };

  // ========== رسم بياني ==========
  const getMonthlyChart = (supplierId) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar", { month: "short" });
      const purchases_ = purchases.filter((p) => p.supplier === supplierId && p.date?.startsWith(key)).reduce((s, p) => s + p.total, 0);
      const paid_ = payments.filter((p) => p.supplier_id === supplierId && p.date?.startsWith(key)).reduce((s, p) => s + p.amount, 0);
      months.push({ label, purchases: purchases_, paid: paid_ });
    }
    return months;
  };

  // ═══════════════════════════════════════════════════
  // 🆕 تاب "تحليل الموردين" — إحصاءات الفئات + توزيع الدين + شارت شهري مجمّع
  // ═══════════════════════════════════════════════════

  // إحصاء كل فئة توريد: عدد الموردين + إجمالي الدين + إجمالي المشتريات
  const getCategoryStats = () => {
    return SUPPLY_CATEGORIES.map((cat) => {
      const catSuppliers = suppliers.filter((s) => (s.supply_categories || []).includes(cat));
      const totalDebt = catSuppliers.reduce((sum, s) => sum + getSupplierDebt(s.id), 0);
      const totalPurchases = catSuppliers.reduce(
        (sum, s) => sum + purchases.filter((p) => p.supplier === s.id).reduce((x, p) => x + (p.total || 0), 0),
        0
      );
      return { category: cat, count: catSuppliers.length, totalDebt, totalPurchases };
    });
  };

  // توزيع الدين على الموردين (للموردين المديونين فقط) — مرتب تنازليًا + النسبة من إجمالي الدين
  const getDebtDistribution = () => {
    const rows = suppliers
      .map((s) => ({ supplier: s, debt: getSupplierDebt(s.id) }))
      .filter((r) => r.debt > 0.01)
      .sort((a, b) => b.debt - a.debt);
    const total = rows.reduce((s, r) => s + r.debt, 0);
    return { rows, total };
  };

  // شارت مشتريات/سداد مجمّع على مدى N شهر — لو monthsAt supplierIds فاضية بيجمع كل الموردين، غير كده بيقتصر على المحدد
  const getAggregateMonthlyChart = (monthsCount = 12, supplierIds = []) => {
    const idsSet = supplierIds.length > 0 ? new Set(supplierIds) : null;
    const months = [];
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar", { month: "short", year: "2-digit" });
      const purchases_ = purchases
        .filter((p) => p.date?.startsWith(key) && (!idsSet || idsSet.has(p.supplier)))
        .reduce((s, p) => s + (p.total || 0), 0);
      const paid_ = payments
        .filter((p) => p.date?.startsWith(key) && (!idsSet || idsSet.has(p.supplier_id)))
        .reduce((s, p) => s + (p.amount || 0), 0);
      months.push({ label, purchases: purchases_, paid: paid_, paidPct: purchases_ > 0 ? Math.min((paid_ / purchases_) * 100, 100) : 0 });
    }
    return months;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank, id: "S" + Date.now() });
    setShowForm(true);
  };

  // 🆕 لو مفيش مورد مناسب لفئة صنف الجوكر، بنفتح فورم إضافة مورد جديد مع تعبئة الفئة تلقائيًا —
  // مودال المراجعة بيفضل مفتوح في الخلفية، وبعد ما يحفظ المورد الجديد هيلاقيه ظاهر في القائمة على طول
  const openAddWithCategory = (cat) => {
    setEditing(null);
    setForm({ ...blank, id: "S" + Date.now(), supply_categories: cat ? [cat] : [] });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s.id);
    setForm({
      ...blank, ...s,
      credit_limit: s.credit_limit || 0,
      payment_terms: s.payment_terms || 30,
      whatsapp: s.whatsapp || "",
      opening_balance: s.opening_balance || 0,
      opening_balance_details: s.opening_balance_details || [],
      supply_categories: s.supply_categories || [],
      gln: s.gln || "",
      supplier_type: s.supplier_type || "عام",
    });
    setShowForm(true);
  };

    const save = async () => {
        if (!form.name) { showToast("يرجى إدخال اسم المورد", "error"); return; }
        const detailsTotal = (form.opening_balance_details || []).reduce((s, d) => s + (d.amount || 0), 0);
        const openingBal = detailsTotal > 0 ? detailsTotal : (+form.opening_balance || 0);

        const payload = {
            name: form.name, tax_id: form.taxId, phone: form.phone, email: form.email,
            address: form.address, contact: form.contact,
            credit_limit: +form.credit_limit || 0,
            payment_terms: +form.payment_terms || 30,
            whatsapp: form.whatsapp,
            supply_categories: form.supply_categories,
            opening_balance: openingBal,
            opening_balance_details: form.opening_balance_details || [],
            gln: form.gln || null,
            supplier_type: form.supplier_type || "عام",
        };

        if (editing) {
            const oldSupplier = suppliers.find((x) => x.id === editing);
            const updatedSupplier = { ...oldSupplier, ...payload, id: editing, pharmacy_id: pharmacyId };

            // 🆕 pharmacy_id لازم يكون على المستوى العلوي للـ event (مش بس جوه payload) —
            // main.cjs بيقرأ evt.pharmacy_id مباشرة عند تخزين الحدث في pending_sync_events
            const result = await queueEvent({
                id: crypto.randomUUID(),
                type: "SUPPLIER_UPDATE",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId,
                payload: { id: editing, pharmacy_id: pharmacyId, updates: payload },
            });
            if (!result.synced && result.error) {
                // اتحفظ محليًا وهيتزامن لما النت يرجع — منوقفش المستخدم عشان كده
                console.warn("SUPPLIER_UPDATE queued for later sync:", result.error);
            }

            // 🆕 setSuppliers بيحدّث localStorage تلقائيًا عن طريق useStorage — مفيش داعي لكتابة كاش منفصلة
            setSuppliers((p) => p.map((x) => (x.id === editing ? updatedSupplier : x)));
            logAudit({
                pharmacyId, userName: currentUser?.name, action: "update", entityType: "supplier",
                entityId: editing, entityLabel: payload.name,
                oldValue: oldSupplier ? { name: oldSupplier.name, phone: oldSupplier.phone, credit_limit: oldSupplier.credit_limit, payment_terms: oldSupplier.payment_terms } : null,
                newValue: { name: payload.name, phone: payload.phone, credit_limit: payload.credit_limit, payment_terms: payload.payment_terms },
                description: `تعديل بيانات المورد "${payload.name}"`,
            });
        } else {
            // 🆕 form.id متولّد من قبل بشكل أوفلاين-friendly (openAddWithCategory: "S" + Date.now())
            // فمش محتاجين .select() نستنى رد من السيرفر عشان نجيب الـ id — بنستخدمه على طول
            const newSupplier = { id: form.id, ...payload, pharmacy_id: pharmacyId };

            const result = await queueEvent({
                id: crypto.randomUUID(),
                type: "SUPPLIER_INSERT",
                timestamp: new Date().toISOString(),
                pharmacy_id: pharmacyId,
                payload: { supplier: newSupplier },
            });
            if (!result.synced && result.error) {
                console.warn("SUPPLIER_INSERT queued for later sync:", result.error);
            }

            setSuppliers((p) => [...p, newSupplier]);
            logAudit({
                pharmacyId, userName: currentUser?.name, action: "create", entityType: "supplier",
                entityId: newSupplier.id, entityLabel: payload.name,
                newValue: { name: payload.name, phone: payload.phone, credit_limit: payload.credit_limit },
                description: `إضافة مورد جديد "${payload.name}"`,
            });
        }
        setShowForm(false);
        showToast(editing ? "تم تعديل المورد ✓" : "تمت إضافة المورد ✓");
    };

  const filteredSuppliers = suppliers
    .filter((s) => filterStatus === "all" ? true : getSupplierStatus(s) === filterStatus)
    .filter((s) => !categoryFilter ? true : (s.supply_categories || []).includes(categoryFilter))
    .filter((s) => {
      const q = supplierNameSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.contact || "").toLowerCase().includes(q) ||
        (s.phone || "").includes(q)
      );
    });

  // ── helper لإضافة سطر في تفاصيل رصيد أول المدة ──
  const addOpeningDetail = () => {
    F("opening_balance_details", [
      ...(form.opening_balance_details || []),
      { id: Date.now(), invoice_no: "", amount: 0, due_days: 30, note: "" },
    ]);
  };

  const updateOpeningDetail = (id, field, value) => {
    F("opening_balance_details",
      (form.opening_balance_details || []).map((d) => d.id === id ? { ...d, [field]: value } : d)
    );
  };

  const removeOpeningDetail = (id) => {
    F("opening_balance_details", (form.opening_balance_details || []).filter((d) => d.id !== id));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>إدارة الموردين</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {jokerPendingGroups.length > 0 && (
            <Btn icon="alert" variant="secondary" onClick={() => setShowJokerReview(true)} style={{ position: "relative" }}>
              ⚠ أصناف جوكر معلّقة
              <span style={{
                position: "absolute", top: -6, left: -6, background: COLORS.gold, color: "#1a1200",
                borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, padding: "0 4px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{jokerPendingGroups.length}</span>
            </Btn>
          )}
          {canAdd && <Btn icon="plus" onClick={openAdd}>إضافة مورد</Btn>}
        </div>
      </div>

      {/* 🆕 تاب: قائمة الموردين / تحليل الموردين */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: `1px solid ${COLORS.border}` }}>
        {[
          { k: "list",     l: "📋 قائمة الموردين" },
          { k: "analysis", l: "📊 تحليل الموردين" },
        ].map((t) => (
          <button key={t.k} onClick={() => setSupplierViewTab(t.k)} style={{
            padding: "10px 18px", border: "none", borderBottom: `2px solid ${supplierViewTab === t.k ? COLORS.blue : "transparent"}`,
            background: "transparent", color: supplierViewTab === t.k ? COLORS.blue : COLORS.textDim,
            fontSize: 14, fontWeight: supplierViewTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {supplierViewTab === "list" && (
      <>
      {/* 🆕 بحث باسم المورد */}
      <div style={{ position: "relative", marginBottom: 14, maxWidth: 360 }}>
        <IC n="search" s={16} style={{ position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)", color: COLORS.textDim }} />
        <input
          value={supplierNameSearch}
          onChange={(e) => setSupplierNameSearch(e.target.value)}
          placeholder="ابحث باسم المورد أو جهة الاتصال أو الجوال..."
          style={{
            width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "10px 38px 10px 14px",
            color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { k: "all",    l: "الكل",           color: COLORS.textDim },
          { k: "green",  l: "🟢 منتظم",       color: COLORS.green },
          { k: "orange", l: "🟠 تأخير بسيط",  color: COLORS.gold },
          { k: "red",    l: "🔴 متأخر",        color: COLORS.red },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilterStatus(f.k)} style={{
            padding: "7px 16px", borderRadius: 8, border: "1px solid",
            borderColor: filterStatus === f.k ? f.color : COLORS.border,
            background: filterStatus === f.k ? COLORS.surfaceAlt : "transparent",
            color: filterStatus === f.k ? f.color : COLORS.textDim,
            fontSize: 13, fontWeight: filterStatus === f.k ? 700 : 400, cursor: "pointer",
          }}>{f.l}</button>
        ))}
        {/* 🆕 فلتر فئة نشط — جاي من تاب التحليل */}
        {categoryFilter && (
          <button onClick={() => setCategoryFilter(null)} style={{
            padding: "7px 16px", borderRadius: 8, border: `1px solid ${COLORS.blue}`,
            background: COLORS.surfaceAlt, color: COLORS.blue, fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            {SUPPLY_CATEGORY_ICONS[categoryFilter] || "🏷"} {categoryFilter} ✕
          </button>
        )}
      </div>

      {/* كروت الموردين */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
        {filteredSuppliers.map((s) => {
          const status = getSupplierStatus(s);
          const sc = statusColor[status];
          const debt = getSupplierDebt(s.id);
          const rating = getSupplierRating(s.id);
          const creditLimit = s.credit_limit || 0;
          const creditUsedPct = creditLimit > 0 ? Math.min((debt / creditLimit) * 100, 100) : 0;
          const supPurchases = purchases.filter((p) => p.supplier === s.id);
          const autoReturnCount = getAutoReturnCandidates(s.id).length;
          const isExpanded = !!expandedSupplierIds[s.id];

          return (
            <div key={s.id} style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${sc.border}`,
              borderRadius: 14, padding: 18, borderTop: `3px solid ${sc.text}`,
            }}>
              {/* اسم + حالة — اضغط للطي/الفتح */}
              <div
                onClick={() => toggleSupplierExpand(s.id)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, cursor: "pointer", userSelect: "none" }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 15 }}>{s.name}</div>
                  <div style={{ color: COLORS.border, fontSize: 11, marginTop: 2 }}>رمز: {s.id}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge color={sc.bg} text={sc.text}>{sc.label}</Badge>
                    <span style={{ color: COLORS.textDim, fontSize: 12, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▼</span>
                  </div>
                  {rating && <span style={{ fontSize: 11, color: COLORS.textDim }}>تنفيذ: {rating.fulfillmentRate}%</span>}
                </div>
              </div>

              {/* إجمالي المديونية — ملخص دائم الظهور */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 0", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 12, color: COLORS.textDim }}>إجمالي المديونية</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, color: debt > 0 ? COLORS.gold : COLORS.green }}>
                  {debt.toFixed(2)} ر.س
                </span>
              </div>

              {/* تنبيه مرتجع تلقائي — يظل ظاهراً دائماً لأهميته */}
              {autoReturnCount > 0 && (
                <div
                  onClick={(e) => { e.stopPropagation(); openAutoReturn(s); }}
                  style={{
                    background: COLORS.redSoft, border: `1px solid ${tint(COLORS.coral,0.35)}`,
                    borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ color: COLORS.coral, fontWeight: 700, fontSize: 12 }}>🔄 مرتجع تلقائي مقترح</div>
                    <div style={{ color: COLORS.textDim, fontSize: 11 }}>{autoReturnCount} صنف يستوفي شروط الإرجاع</div>
                  </div>
                  <span style={{ color: COLORS.coral, fontSize: 12 }}>إدارة →</span>
                </div>
              )}

              {isExpanded && (
                <>
                  {/* رصيد أول المدة */}
                  {(s.opening_balance || 0) > 0 && (
                    <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>رصيد أول المدة</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 6 }}>
                        {(s.opening_balance || 0).toFixed(2)} ر.س
                      </div>
                      {/* تفاصيل أعمار الدين */}
                      {(s.opening_balance_details || []).length > 0 && (() => {
                        const aging = getOpeningBalanceAging(s.opening_balance_details);
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                            {Object.entries(aging).map(([bucket, val]) => val > 0 && (
                              <div key={bucket} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: COLORS.textDim }}>{bucket} يوم</div>
                                <div style={{
                                  fontSize: 11, fontWeight: 700,
                                  color: bucket === "90+" ? COLORS.red : bucket === "61-90" ? COLORS.gold : COLORS.textPrimary,
                                }}>{val.toFixed(0)}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* الكريدت */}
                  {creditLimit > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
                        <span>الكريدت المستخدم</span>
                        <span style={{ color: debt > creditLimit * 0.8 ? COLORS.red : COLORS.green }}>
                          {debt.toFixed(0)} / {creditLimit.toFixed(0)} ر.س
                        </span>
                      </div>
                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${creditUsedPct}%`,
                          background: creditUsedPct > 80 ? COLORS.red : creditUsedPct > 50 ? COLORS.gold : COLORS.green,
                          borderRadius: 4, transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                  )}

                  {/* فواتير مستحقة */}
                  {supPurchases.filter((p) => getPurchaseNetDebt(p) > 0).length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6 }}>الفواتير المستحقة:</div>
                      {supPurchases
                        .filter((p) => getPurchaseNetDebt(p) > 0)
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .slice(0, 3)
                        .map((po) => {
                          const dueDays = getDueDays(po, s);
                          const balance = getPurchaseNetDebt(po); // 🆕 صافي بعد المرتجع
                          return (
                            <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 11, color: COLORS.textDim }}>{po.id}</span>
                              <span style={{ fontSize: 11, color: COLORS.textPrimary }}>{balance.toFixed(0)} ر.س</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: dueDays < 0 ? COLORS.red : dueDays <= 7 ? COLORS.gold : COLORS.green }}>
                                {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                              </span>
                              {po.returned_amount > 0 && (
                                <Badge color={COLORS.goldSoft} text={COLORS.coral}>مرتجع: {po.returned_amount.toFixed(0)}</Badge>
                              )}
                              {po.payment_status === "مسددة جزئياً" && <Badge color={COLORS.goldSoft} text={COLORS.gold}>جزئي</Badge>}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* بيانات الاتصال */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                    {s.taxId && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: COLORS.border, fontSize: 11, width: 90, flexShrink: 0 }}>الرقم الضريبي:</span>
                        <Badge color={COLORS.greenSoft} text={COLORS.green}>{s.taxId}</Badge>
                      </div>
                    )}
                    {s.gln ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ color: COLORS.border, fontSize: 11, width: 90, flexShrink: 0 }}>GLN (رصد):</span>
                        <Badge color={COLORS.goldSoft} text={COLORS.gold}>{s.gln}</Badge>
                      </div>
                    ) : (
                      JSON.parse(localStorage.getItem("rasd_config") || "{}").enabled && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ color: COLORS.border, fontSize: 11, width: 90, flexShrink: 0 }}>GLN (رصد):</span>
                          <span style={{ fontSize: 11, color: COLORS.red }}>⚠ غير مسجّل — مرتجعات المشتريات لن تُرسل لرصد</span>
                        </div>
                      )
                    )}
                    {(s.supply_categories || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.supply_categories.map((cat) => <Badge key={cat} color="#0a2040" text={COLORS.blue}>{cat}</Badge>)}
                      </div>
                    )}
                    {s.payment_terms && <div style={{ fontSize: 11, color: COLORS.textDim }}>⏱ شروط الدفع: {s.payment_terms} يوم</div>}
                    {s.phone   && <div style={{ fontSize: 11, color: COLORS.textDim }}>📞 {s.phone}</div>}
                    {s.email   && <div style={{ fontSize: 11, color: COLORS.textDim }}>✉ {s.email}</div>}
                    {s.contact && <div style={{ fontSize: 11, color: COLORS.textDim }}>👤 {s.contact}</div>}
                  </div>
                </>
              )}

              {/* أزرار — تظل ظاهرة دائماً للوصول السريع */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: isExpanded ? 0 : 6 }} onClick={(e) => e.stopPropagation()}>
                {canEditSub("purchase_order") && (
                  <Btn size="sm" icon="purchase" onClick={() => generateOrder(s)} style={{ flex: 1, justifyContent: "center", position: "relative" }} variant={status === "red" ? "danger" : "primary"}>
                    طلب شراء
                    {(pendingBySupplier[s.id]?.length > 0) && (
                      <span style={{
                        position: "absolute", top: -6, left: -6, background: COLORS.gold, color: "#1a1200",
                        borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, padding: "0 4px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {pendingBySupplier[s.id].length}
                      </span>
                    )}
                  </Btn>
                )}
                {canEditSub("payment") && (
                  <Btn size="sm" icon="money" onClick={() => { setShowPayForm(s); setPayForm({ amount: "", note: "", method: "نقدي", receipt: null, receiptUrl: "" }); }} variant="success">
                    سداد
                  </Btn>
                )}
                <Btn size="sm" icon="chart" onClick={() => setShowDetail(s)} variant="secondary">تفاصيل</Btn>
                {s.whatsapp && (
                  <button onClick={() => window.open(`https://wa.me/${s.whatsapp}`, "_blank")}
                    style={{ padding: "6px 10px", background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 7, color: COLORS.green, cursor: "pointer", fontSize: 14 }}>
                    💬
                  </button>
                )}
                {canEdit && <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEdit(s)}>تعديل</Btn>}
                      {canDelete && <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                          const supplierDebt = getSupplierDebt(s.id);
                          if (supplierDebt > 0) {
                              if (currentUser?.role !== "admin") { showToast("❌ لا يمكن حذف مورد عليه مديونية", "error"); return; }
                              if (!window.confirm(`⚠️ على المورد "${s.name}" مديونية ${supplierDebt.toFixed(2)} ر.س
هل أنت متأكد من الحذف؟`)) return;
                          }

                          const result = await queueEvent({
                              id: crypto.randomUUID(),
                              type: "SUPPLIER_DELETE",
                              timestamp: new Date().toISOString(),
                              pharmacy_id: pharmacyId, // 🆕 على المستوى العلوي — نفس القاعدة في كل الـ events
                              payload: { id: s.id, pharmacy_id: pharmacyId },
                          });
                          if (!result.synced && result.error) {
                              console.warn("SUPPLIER_DELETE queued for later sync:", result.error);
                          }

                          logAudit({
                              pharmacyId, userName: currentUser?.name, action: "delete", entityType: "supplier",
                              entityId: s.id, entityLabel: s.name,
                              oldValue: { name: s.name, debt: supplierDebt },
                              description: `حذف المورد "${s.name}"${supplierDebt > 0 ? ` (وعليه مديونية ${supplierDebt.toFixed(2)} ر.س)` : ""}`,
                          });
                          setSuppliers((p) => p.filter((x) => x.id !== s.id));
                          showToast("تم حذف المورد");
                      }}>حذف</Btn>}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {supplierViewTab === "analysis" && (() => {
        const catStats = getCategoryStats();
        const maxCatDebt = Math.max(...catStats.map((c) => c.totalDebt), 1);
        const { rows: debtRows, total: totalDebt } = getDebtDistribution();
        const maxDebtRow = Math.max(...debtRows.map((r) => r.debt), 1);
        const monthlyData = getAggregateMonthlyChart(analysisMonths, analysisSupplierIds);
        const maxMonthly = Math.max(...monthlyData.map((d) => Math.max(d.purchases, d.paid)), 1);
        const toggleAnalysisSupplier = (id) => {
          setAnalysisSupplierIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
        };
        return (
          <div>
            {/* ===== بطاقات الفئات ===== */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>الموردون حسب الفئة</div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 12 }}>اضغط على أي فئة لعرض موردينها بكروتهم في قائمة الموردين</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
                {catStats.map((c) => (
                  <div
                    key={c.category}
                    onClick={() => { setCategoryFilter(c.category); setFilterStatus("all"); setSupplierViewTab("list"); }}
                    style={{
                      background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16, cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.blue; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{SUPPLY_CATEGORY_ICONS[c.category] || "🏷"}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{c.category}</div>
                    <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>{c.count} مورد</div>
                    <div style={{ background: COLORS.surfaceAlt, borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ height: "100%", width: `${(c.totalDebt / maxCatDebt) * 100}%`, background: c.totalDebt > 0 ? COLORS.red : COLORS.green, borderRadius: 4 }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: COLORS.textDim }}>دين مستحق</span>
                      <span style={{ color: c.totalDebt > 0 ? COLORS.red : COLORS.green, fontWeight: 700 }}>{c.totalDebt.toFixed(0)} ر.س</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== توزيع الدين حسب المورد ===== */}
            <div style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 28,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>توزيع الدين على الموردين</div>
                <div style={{ fontSize: 12, color: COLORS.textDim }}>إجمالي الدين: <span style={{ color: COLORS.red, fontWeight: 700 }}>{totalDebt.toFixed(0)} ر.س</span></div>
              </div>
              {debtRows.length === 0 ? (
                <div style={{ color: COLORS.textDim, fontSize: 13, padding: "20px 0", textAlign: "center" }}>لا توجد ديون مستحقة على الموردين حاليًا 🎉</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {debtRows.slice(0, 15).map(({ supplier: s, debt }) => {
                    const pct = totalDebt > 0 ? (debt / totalDebt) * 100 : 0;
                    return (
                      <div key={s.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: COLORS.textPrimary }}>{s.name}</span>
                          <span style={{ color: COLORS.textDim }}>{debt.toFixed(0)} ر.س <span style={{ color: COLORS.red, fontWeight: 700 }}>({pct.toFixed(1)}%)</span></span>
                        </div>
                        <div style={{ background: COLORS.surfaceAlt, borderRadius: 4, height: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(debt / maxDebtRow) * 100}%`, background: COLORS.red, borderRadius: 4, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    );
                  })}
                  {debtRows.length > 15 && (
                    <div style={{ fontSize: 11, color: COLORS.textDim, textAlign: "center", marginTop: 4 }}>
                      + {debtRows.length - 15} مورد آخر عليهم دين (اعرض التفاصيل من قائمة الموردين)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ===== المشتريات والسداد الشهري (مجمّع) ===== */}
            <div style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>المشتريات والسداد الشهري {analysisSupplierIds.length > 0 ? `(${analysisSupplierIds.length} مورد محدد)` : "(كل الموردين)"}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[6, 12].map((m) => (
                    <button key={m} onClick={() => setAnalysisMonths(m)} style={{
                      padding: "5px 14px", borderRadius: 8, border: "1px solid",
                      borderColor: analysisMonths === m ? COLORS.blue : COLORS.border,
                      background: analysisMonths === m ? COLORS.surfaceAlt : "transparent",
                      color: analysisMonths === m ? COLORS.blue : COLORS.textDim,
                      fontSize: 12, fontWeight: analysisMonths === m ? 700 : 400, cursor: "pointer",
                    }}>{m} شهر</button>
                  ))}
                </div>
              </div>

              {/* اختيار موردين للمقارنة */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, maxHeight: 90, overflowY: "auto" }}>
                {analysisSupplierIds.length > 0 && (
                  <button onClick={() => setAnalysisSupplierIds([])} style={{
                    padding: "5px 12px", borderRadius: 20, border: `1px solid ${COLORS.red}`,
                    background: "transparent", color: COLORS.red, fontSize: 11, cursor: "pointer",
                  }}>✕ إلغاء التحديد</button>
                )}
                {suppliers.map((s) => {
                  const active = analysisSupplierIds.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleAnalysisSupplier(s.id)} style={{
                      padding: "5px 12px", borderRadius: 20, border: "1px solid",
                      borderColor: active ? COLORS.blue : COLORS.border,
                      background: active ? COLORS.surfaceAlt : "transparent",
                      color: active ? COLORS.blue : COLORS.textDim,
                      fontSize: 11, fontWeight: active ? 700 : 400, cursor: "pointer",
                    }}>{s.name}</button>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: analysisMonths > 6 ? 4 : 8, height: 140, overflowX: "auto" }}>
                {monthlyData.map((d, i) => (
                  <div key={i} style={{ flex: 1, minWidth: analysisMonths > 6 ? 32 : 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 110 }}>
                      <div style={{ flex: 1, background: COLORS.blue, height: `${(d.purchases / maxMonthly) * 110}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مشتريات: ${d.purchases.toFixed(0)} ر.س`} />
                      <div style={{ flex: 1, background: COLORS.green, height: `${(d.paid / maxMonthly) * 110}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مسدد: ${d.paid.toFixed(0)} ر.س — ${d.paidPct.toFixed(0)}% من مشتريات الشهر`} />
                    </div>
                    <span style={{ fontSize: 9, color: COLORS.textDim }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: COLORS.blue }}>■ مشتريات</span>
                <span style={{ fontSize: 11, color: COLORS.green }}>■ مسدد</span>
                <span style={{ fontSize: 11, color: COLORS.textDim }}>مرّر الماوس/إصبعك على أي عمود لعرض نسبة السداد من مشتريات الشهر</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== Modal المرتجع التلقائي ===== */}
      {showAutoReturn && (
        <Modal open title={`🔄 مرتجع تلقائي — ${showAutoReturn.name}`} onClose={() => setShowAutoReturn(null)} wide>
          <div style={{ marginBottom: 14, padding: "10px 14px", background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.coral,0.35)}`, borderRadius: 8, fontSize: 12, color: "#ff9a44" }}>
            الأصناف التالية تستوفي شروط الإرجاع: صلاحية أقل من 3 شهور + لا حركة شهر، أو صلاحية أقل من 6 شهور + لا حركة شهرين
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {["الصنف", "المخزون", "الصلاحية", "الأيام المتبقية", "كمية الإرجاع", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: COLORS.textDim, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {autoReturnItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13 }}>{item.stock}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 12 }}>{item.expiry}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ color: item.daysToExpiry < 90 ? COLORS.red : COLORS.gold, fontWeight: 700, fontSize: 12 }}>
                        {item.daysToExpiry} يوم
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="number" min="0" max={item.stock}
                        value={item.returnQty}
                        onChange={(e) => setAutoReturnItems((prev) =>
                          prev.map((x, j) => j === i ? { ...x, returnQty: +e.target.value } : x)
                        )}
                        style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setAutoReturnItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {autoReturnItems.length === 0 && (
            <div style={{ textAlign: "center", color: COLORS.textDim, padding: 20 }}>تم إزالة كل الأصناف</div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowAutoReturn(null)}>إلغاء</Btn>
            {showAutoReturn.whatsapp && (
              <Btn onClick={() => {
                const msg = `طلب مرتجع — ${new Date().toLocaleDateString("ar")}\n` +
                  autoReturnItems.map((i) => `• ${i.name}: ${i.returnQty} وحدة — صلاحية ${i.expiry}`).join("\n");
                window.open(`https://wa.me/${showAutoReturn.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
              }}>إرسال واتساب</Btn>
            )}
            <Btn icon="check" onClick={saveAutoReturn}>حفظ طلب المرتجع</Btn>
          </div>
        </Modal>
      )}

      {/* ===== Modal الأوردر ===== */}
      {showOrderForm && (
        <Modal open title={`طلب شراء — ${showOrderForm.name}`} onClose={() => setShowOrderForm(null)} wide>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <label style={{ color: COLORS.textDim, fontSize: 13 }}>تغطية لمدة:</label>
            <input type="number" min="1" value={coverageDays}
              onChange={(e) => { setCoverageDays(+e.target.value); generateOrder(showOrderForm); }}
              style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
            <span style={{ color: COLORS.textDim, fontSize: 13 }}>يوم</span>
          </div>

          {/* 💰 الميزانية المتاحة للطلب */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ color: COLORS.textDim, fontSize: 13 }}>الميزانية المتاحة:</label>
            <input type="number" min="0" value={orderBudget}
              onChange={(e) => setOrderBudget(e.target.value)}
              placeholder="اختياري"
              style={{ width: 120, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
            <span style={{ color: COLORS.textDim, fontSize: 13 }}>ر.س</span>
            <Btn icon="check" variant="secondary" onClick={allocateByBudget}>توزيع حسب الميزانية</Btn>
            {orderBudget && +orderBudget > 0 && (() => {
              const total = orderItems.reduce((sum, i) => sum + (+i.cost || 0) * (+i.orderQty || 0), 0);
              const zeroedCount = orderItems.filter((i) => (+i.orderQty || 0) === 0).length;
              return (
                <span style={{ fontSize: 12, color: COLORS.textDim }}>
                  الميزانية: {total.toFixed(2)} من {(+orderBudget).toFixed(2)} ر.س
                  {zeroedCount ? ` — ${zeroedCount} صنف اتأجل` : ""}
                </span>
              );
            })()}
          </div>

          {/* ➕ إضافة صنف يدوياً */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>➕ إضافة صنف يدوياً للطلب</label>
            <input
              value={manualProductSearch}
              onChange={(e) => { setManualProductSearch(e.target.value); setManualProductSearchOpen(true); }}
              onFocus={() => setManualProductSearchOpen(true)}
              onBlur={() => setTimeout(() => setManualProductSearchOpen(false), 150)}
              placeholder="ابحث باسم الصنف أو رمزه لإضافته..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.textPrimary,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
            {manualProductSearchOpen && manualProductSearch.trim() && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                maxHeight: 220, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                {(products || [])
                  .filter((p) => {
                    const q = manualProductSearch.toLowerCase();
                    return (p.name || "").toLowerCase().includes(q) || (p.nameAr || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q);
                  })
                  .filter((p) => !orderItems.some((oi) => oi.id === p.id))
                  .slice(0, 15)
                  .map((p) => (
                    <div
                      key={p.id}
                      onMouseDown={() => {
                        setOrderItems((prev) => [...prev, {
                          id: p.id,
                          name: p.name || p.nameAr,
                          currentStock: p.stock || 0,
                          minStock: p.min_stock || p.minStock || 0,
                          orderQty: 1,
                          cost: getInitialCostFor(p.id, showOrderForm.id, p.cost),
                          movement: { class: "manual", label: "إضافة يدوية", color: COLORS.blue },
                          editable: true,
                        }]);
                        setManualProductSearch("");
                        setManualProductSearchOpen(false);
                      }}
                      style={{ padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{p.name || p.nameAr}</span>
                      <span style={{ fontSize: 11, color: COLORS.textDim, textAlign: "left" }}>
                        <div>مخزون: {p.stock || 0}</div>
                        {(() => {
                          const cheapest = getCheapestSupplierForProduct(p.id);
                          const sameSupplierCost = getProductCostBySupplier(p.id).find((r) => r.supplierId === showOrderForm.id);
                          if (cheapest && (!sameSupplierCost || cheapest.cost < sameSupplierCost.cost)) {
                            return <div style={{ color: COLORS.gold }}>🏷️ أرخص عند {cheapest.supplierName}: {cheapest.cost.toFixed(2)}</div>;
                          }
                          return null;
                        })()}
                      </span>
                    </div>
                  ))}
                {(products || []).filter((p) => {
                  const q = manualProductSearch.toLowerCase();
                  return (p.name || "").toLowerCase().includes(q) || (p.nameAr || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q);
                }).length === 0 && (
                  <div style={{ padding: 14, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>لا توجد أصناف مطابقة</div>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {["الصنف", "الحركة", "المخزون", "الحد الأدنى", "سعر الوحدة", "الكمية المطلوبة", "الإجمالي", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: COLORS.textDim, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, i) => {
                  const cheaper = getCheapestSupplierForProduct(item.id, showOrderForm.id);
                  const showCheaperHint = cheaper && cheaper.cost < (+item.cost || 0);
                  const deferredByBudget = orderBudget && +orderBudget > 0 && (+item.orderQty || 0) === 0;
                  return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: deferredByBudget ? `${COLORS.gold}14` : "transparent" }}>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }}>
                      {item.name}
                      {deferredByBudget && (
                        <span style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, marginRight: 6 }}>⏸️ مؤجل لحد ميزانية تانية</span>
                      )}
                      {showCheaperHint && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10.5, color: COLORS.gold }}>
                            🏷️ أرخص عند {cheaper.supplierName}: {cheaper.cost.toFixed(2)} ر.س
                          </span>
                          <button
                            onClick={() => moveItemToSupplier(item, cheaper.supplierId, cheaper.supplierName)}
                            style={{ fontSize: 10, background: "transparent", border: `1px solid ${COLORS.gold}`, color: COLORS.gold, borderRadius: 5, padding: "1px 6px", cursor: "pointer" }}
                          >
                            نقل لطلب {cheaper.supplierName}
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 11, color: item.movement.color, fontWeight: 700 }}>{item.movement.label}</span></td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13 }}>{item.currentStock}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13 }}>{item.minStock}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" step="0.01" value={item.cost ?? ""}
                        onChange={(e) => setOrderItems((prev) => prev.map((x, j) => j === i ? { ...x, cost: +e.target.value } : x))}
                        style={{ width: 80, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" value={item.orderQty}
                        onChange={(e) => setOrderItems((prev) => prev.map((x, j) => j === i ? { ...x, orderQty: +e.target.value } : x))}
                        style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                    </td>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {((+item.cost || 0) * (+item.orderQty || 0)).toFixed(2)} ر.س
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {!item.isJokerPending && (
                          <button
                            onClick={() => dismissFromAutoOrder(item)}
                            title="تجاهل هذا الصنف نهائيًا من الطلبات التلقائية"
                            style={{ background: "transparent", border: "none", color: COLORS.gold, cursor: "pointer", fontSize: 13 }}
                          >
                            🔕
                          </button>
                        )}
                        <button onClick={() => setOrderItems((p) => p.filter((_, j) => j !== i))}
                          style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>
                          <IC n="trash" s={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              {orderItems.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${COLORS.border}` }}>
                    <td colSpan={6} style={{ padding: "10px", textAlign: "left", color: COLORS.textDim, fontSize: 13, fontWeight: 700 }}>
                      الإجمالي الكلي للطلب
                    </td>
                    <td colSpan={2} style={{ padding: "10px", color: COLORS.textPrimary, fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {orderItems.reduce((sum, i) => sum + (+i.cost || 0) * (+i.orderQty || 0), 0).toFixed(2)} ر.س
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {orderItems.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 20 }}>لا توجد أصناف ناقصة</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowOrderForm(null)}>إلغاء</Btn>
            <Btn icon="check" onClick={saveOrder}>حفظ الأوردر</Btn>
            {showOrderForm.whatsapp && (
              <Btn icon="whatsapp" onClick={() => {
                const msg = `طلب شراء - ${new Date().toLocaleDateString("ar")}\n` + orderItems.map((i) => `• ${i.name}: ${i.orderQty} وحدة`).join("\n");
                window.open(`https://wa.me/${showOrderForm.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
              }}>إرسال واتساب</Btn>
            )}
          </div>
        </Modal>
      )}

      {/* ===== 🆕 Modal مراجعة أصناف الجوكر المعلّقة ===== */}
      {showJokerReview && (
        <Modal open title="⚠ أصناف جوكر معلّقة" onClose={() => setShowJokerReview(false)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: COLORS.textDim }}>
              دي أصناف اتباعت للعملاء كـ"جوكر" ولسه معندهاش صنف حقيقي مسجّل. راجعها واختار المورد المناسب لإضافتها لطلب شراء، أو احذفها لو مش محتاجها.
            </div>
            {jokerPendingGroups.length === 0 ? (
              <div style={{ textAlign: "center", color: COLORS.textDim, padding: 20 }}>لا توجد أصناف جوكر معلّقة 🎉</div>
            ) : (
              jokerPendingGroups.map((group) => {
                // 🆕 أصناف الجوكر لسه مالهاش صنف حقيقي (وبالتالي مفيش linked_supplier_ids)، فمينفعش نتأكد
                // إن مورد "متخصص" فعلاً بيورد الصنف ده — بنسيبه في "موردين آخرين" بدل الاقتراح المباشر
                const matchingSuppliers = suppliers.filter((s) => s.supplier_type !== "متخصص" && (!group.category || (s.supply_categories || []).length === 0 || (s.supply_categories || []).includes(group.category)));
                const otherSuppliers = suppliers.filter((s) => !matchingSuppliers.some((m) => m.id === s.id));
                return (
                  <div key={group.key} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary }}>{group.name}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.textDim, marginTop: 2 }}>
                          {group.category ? `الفئة: ${group.category}` : "بدون فئة محددة"} · إجمالي الكمية المطلوبة: <b style={{ color: COLORS.gold }}>{group.qty}</b>
                          {group.occurrences > 1 && ` (اتكررت ${group.occurrences} مرة)`}
                        </div>
                      </div>
                      <button onClick={() => deleteJokerGroup(group)} style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={jokerReviewSupplier[group.key] || ""}
                        onChange={(e) => setJokerReviewSupplier((p) => ({ ...p, [group.key]: e.target.value }))}
                        style={{ flex: 1, minWidth: 180, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 13 }}
                      >
                        <option value="">اختر المورد...</option>
                        {matchingSuppliers.length > 0 && (
                          <optgroup label="موردين بيوفروا نفس الفئة">
                            {matchingSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </optgroup>
                        )}
                        {otherSuppliers.length > 0 && (
                          <optgroup label="موردين آخرين">
                            {otherSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <Btn
                        size="sm"
                        icon="purchase"
                        onClick={() => addJokerGroupToSupplierOrder(group, jokerReviewSupplier[group.key])}
                      >
                        ➕ أضف لطلب المورد
                      </Btn>
                    </div>
                    <div style={{ fontSize: 11.5, color: COLORS.textDim }}>
                      مش عارف مين المورد بتاعه؟ سيبه هنا لحد ما تتأكد — مش هيتحذف أو يدخل أي طلب لحد ما تختار بنفسك.{" "}
                      {matchingSuppliers.length === 0 && group.category && (
                        <span onClick={() => openAddWithCategory(group.category)} style={{ color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}>
                          مفيش مورد بيوفر فئة "{group.category}"؟ أضف مورد جديد لها ↗
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}

      {showPayForm && (
        <Modal open title={`تسجيل دفعة — ${showPayForm.name}`} onClose={() => setShowPayForm(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>إجمالي المستحقات</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.red }}>{getSupplierDebt(showPayForm.id).toFixed(2)} ر.س</div>
            </div>
            <div>
  <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>طريقة الدفع</div>
  <select value={payForm.method}
    onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
    style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
    <option value="نقدي">💵 نقدي</option>
    <option value="بطاقة">💳 بطاقة / صراف</option>
    <option value="تحويل">🏦 تحويل بنكي</option>
  </select>
</div>
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>ترتيب السداد (الأقدم أولاً):</div>
            {purchases.filter((p) => p.supplier === showPayForm.id && getPurchaseNetDebt(p) > 0)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((po) => {
                const balance = getPurchaseNetDebt(po); // 🆕 صافي بعد المرتجع
                const dueDays = getDueDays(po, showPayForm);
                return (
                  <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                    <div>
                      <div style={{ fontSize: 12, color: COLORS.blue }}>{po.id}</div>
                      <div style={{ fontSize: 11, color: COLORS.textDim }}>{po.date}</div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{balance.toFixed(2)} ر.س</div>
                      <div style={{ fontSize: 11, color: dueDays < 0 ? COLORS.red : COLORS.gold }}>
                        {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                      </div>
                    </div>
                    <Badge color={po.payment_status === "مسددة جزئياً" ? COLORS.goldSoft : COLORS.surfaceAlt} text={po.payment_status === "مسددة جزئياً" ? COLORS.gold : COLORS.textDim}>
                      {po.payment_status || "غير مسددة"}
                    </Badge>
                  </div>
                );
              })}
            <Input label="مبلغ الدفعة (ر.س)" value={payForm.amount} onChange={(v) => setPayForm((p) => ({ ...p, amount: v }))} placeholder="0.00" />
            <Input label="ملاحظة" value={payForm.note} onChange={(v) => setPayForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>سند الدفع (اختياري)</label>
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => { const file = e.target.files[0]; if (file) setPayForm((p) => ({ ...p, receipt: file })); }}
                style={{ color: COLORS.textPrimary, fontSize: 12 }} />
              {payForm.receipt && <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4 }}>✓ {payForm.receipt.name}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowPayForm(null)}>إلغاء</Btn>
            <Btn icon="check" onClick={() => savePayment(showPayForm)}>تأكيد الدفعة</Btn>
          </div>
        </Modal>
      )}

      {/* ===== Modal تفاصيل المورد ===== */}
      {showDetail && (() => {
        const chartData = getMonthlyChart(showDetail.id);
        const maxVal = Math.max(...chartData.map((d) => Math.max(d.purchases, d.paid)), 1);
        const supPayments = payments.filter((p) => p.supplier_id === showDetail.id);
        return (
          <Modal open title={`تفاصيل — ${showDetail.name}`} onClose={() => setShowDetail(null)} wide>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 10 }}>المشتريات والمدفوعات (6 أشهر)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
                      <div style={{ flex: 1, background: COLORS.blue, height: `${(d.purchases / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مشتريات: ${d.purchases.toFixed(0)}`} />
                      <div style={{ flex: 1, background: COLORS.green, height: `${(d.paid / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مدفوعات: ${d.paid.toFixed(0)}`} />
                    </div>
                    <span style={{ fontSize: 9, color: COLORS.textDim }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.blue }}>■ مشتريات</span>
                <span style={{ fontSize: 11, color: COLORS.green }}>■ مدفوعات</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 8 }}>سجل الدفعات</div>
            {supPayments.length === 0 ? (
              <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>لا توجد دفعات مسجلة</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                {supPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div>
                      <div style={{ fontSize: 12, color: COLORS.textPrimary }}>{pay.date}</div>
                      {pay.notes && <div style={{ fontSize: 11, color: COLORS.textDim }}>{pay.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.green }}>{pay.amount.toFixed(2)} ر.س</span>
                      {pay.attachment_url && <a href={pay.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.blue }}>📎 سند</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>رفع كشف حساب المورد</div>
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const fileName = `statements/${showDetail.id}_${Date.now()}_${file.name}`;
                  const { error } = await supabase.storage.from("payment_reports").upload(fileName, file);
                  if (error) { showToast("فشل الرفع: " + error.message, "error"); return; }
                  showToast("تم رفع الكشف ✓");
                }}
                style={{ color: COLORS.textPrimary, fontSize: 12 }} />
            </div>
          </Modal>
        );
      })()}

      {/* ===== Modal الإضافة/التعديل ===== */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "تعديل المورد" : "إضافة مورد جديد"} wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input label="اسم المورد *" value={form.name} onChange={(v) => F("name", v)} placeholder="اسم الشركة" />
          <Input label="الرقم الضريبي" value={form.taxId} onChange={(v) => F("taxId", v)} placeholder="300XXXXXXXXX00003" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="رقم الهاتف" value={form.phone} onChange={(v) => F("phone", v)} placeholder="011XXXXXXX" />
            <Input label="واتساب" value={form.whatsapp} onChange={(v) => F("whatsapp", v)} placeholder="9665XXXXXXXX" />
          </div>
          <Input label="البريد الإلكتروني" value={form.email} onChange={(v) => F("email", v)} placeholder="info@company.com" />
          <Input label="العنوان" value={form.address} onChange={(v) => F("address", v)} />
          <Input label="مسؤول التواصل" value={form.contact} onChange={(v) => F("contact", v)} />
          <Input label="رقم GLN (لنظام رصد)" value={form.gln} onChange={(v) => F("gln", v)} placeholder="6xxxxxxx000010000" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>حد الكريدت (ر.س)</label>
              <input type="number" min="0" value={form.credit_limit} onChange={(e) => F("credit_limit", +e.target.value)}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>شروط الدفع (يوم)</label>
              <input type="number" min="0" value={form.payment_terms} onChange={(e) => F("payment_terms", +e.target.value)}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* ── رصيد أول المدة بتفاصيل ── */}
          <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold,0.35)}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold }}>رصيد أول المدة</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                  المجموع: {(form.opening_balance_details || []).reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)} ر.س
                </div>
              </div>
              <button onClick={addOpeningDetail} style={{ background: "#1a2a10", border: `1px solid ${tint(COLORS.green,0.35)}`, borderRadius: 7, padding: "6px 12px", color: COLORS.green, fontSize: 12, cursor: "pointer" }}>
                + إضافة فاتورة
              </button>
            </div>

            {(form.opening_balance_details || []).length === 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>
                  أو أدخل رقم مجمل مباشرة (ر.س)
                </label>
                <input type="number" min="0" value={form.opening_balance}
                  onChange={(e) => F("opening_balance", +e.target.value)}
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {(form.opening_balance_details || []).length > 0 && (
              <div>
                {/* رأس الجدول */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6 }}>
                  {["رقم الفاتورة", "المبلغ (ر.س)", "عمر الدين (يوم)", "ملاحظة", ""].map((h) => (
                    <div key={h} style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600 }}>{h}</div>
                  ))}
                </div>
                {(form.opening_balance_details || []).map((d) => (
                  <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={d.invoice_no} onChange={(e) => updateOpeningDetail(d.id, "invoice_no", e.target.value)}
                      placeholder="INV-001"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.amount} onChange={(e) => updateOpeningDetail(d.id, "amount", +e.target.value)}
                      placeholder="0"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: COLORS.gold, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.due_days} onChange={(e) => updateOpeningDetail(d.id, "due_days", +e.target.value)}
                      placeholder="30"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${d.due_days > 90 ? COLORS.red : d.due_days > 60 ? COLORS.gold : COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: d.due_days > 90 ? COLORS.red : d.due_days > 60 ? COLORS.gold : COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                    <input value={d.note} onChange={(e) => updateOpeningDetail(d.id, "note", e.target.value)}
                      placeholder="اختياري"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                    <button onClick={() => removeOpeningDetail(d.id)}
                      style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer", padding: 4 }}>
                      <IC n="trash" s={14} />
                    </button>
                  </div>
                ))}

                {/* ملخص أعمار الدين */}
                {(() => {
                  const aging = getOpeningBalanceAging(form.opening_balance_details || []);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10, padding: "10px 0", borderTop: `1px solid ${COLORS.border}` }}>
                      {[
                        { bucket: "0-30", label: "0-30 يوم",  color: COLORS.green },
                        { bucket: "31-60", label: "31-60 يوم", color: COLORS.textPrimary },
                        { bucket: "61-90", label: "61-90 يوم", color: COLORS.gold },
                        { bucket: "90+",  label: "+90 يوم",   color: COLORS.red },
                      ].map(({ bucket, label, color }) => (
                        <div key={bucket} style={{ textAlign: "center", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 6, padding: "8px 4px" }}>
                          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color }}>{aging[bucket].toFixed(0)} ر.س</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* فئات التوريد */}
          <div>
            <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 8 }}>فئات التوريد</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUPPLY_CATEGORIES.map((cat) => {
                const selected = (form.supply_categories || []).includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => {
                    const current = form.supply_categories || [];
                    F("supply_categories", selected ? current.filter((c) => c !== cat) : [...current, cat]);
                  }}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? COLORS.blue : COLORS.border, background: selected ? COLORS.blueSoft : "transparent", color: selected ? COLORS.blue : COLORS.textDim, fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
                    {selected ? "✓ " : ""}{cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🆕 نوع المورد: عام (يشوف كل أصناف فئاته) أو متخصص (يشوف بس الأصناف المربوطة بيه صراحة من كرت الصنف) */}
          <div>
            <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 8 }}>نوع المورد</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["عام", "متخصص"].map((t) => {
                const selected = (form.supplier_type || "عام") === t;
                return (
                  <button key={t} type="button" onClick={() => F("supplier_type", t)}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? COLORS.blue : COLORS.border, background: selected ? COLORS.blueSoft : "transparent", color: selected ? COLORS.blue : COLORS.textDim, fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
                    {selected ? "✓ " : ""}{t}
                  </button>
                );
              })}
            </div>
            {form.supplier_type === "متخصص" && (
              <div style={{ fontSize: 11, color: COLORS.border, marginTop: 4 }}>
                هيظهر له بس الأصناف اللي بتترّبط بيه صراحة من كرت الصنف، مش كل أصناف فئاته
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={save}>{editing ? "حفظ التعديل" : "إضافة المورد"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
