export function SuppliersModule({
  const { C } = useTheme();
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
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [showPayForm, setShowPayForm] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(null);
  const [showStatements, setShowStatements] = useState(null);
  const [coverageDays, setCoverageDays] = useState(30);
  const [orderItems, setOrderItems] = useState([]);
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
    green:  { bg: "#0a2010", border: "#1a5020", text: C.success, label: "منتظم" },
    orange: { bg: "#1a1000", border: "#4a3000", text: C.warning, label: "تأخير بسيط" },
    red:    { bg: C.dangerBg, border: C.dangerBorder, text: C.danger, label: "متأخر" },
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
      await supabase.from("purchases").update({ returned_amount: u.returned_amount }).eq("id", u.id);
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
    const today = new Date().toISOString().split("T")[0];

    for (const ri of items) {
      const prod = products.find((x) => x.id === ri.id);
      if (prod) {
        await supabase.from("products")
          .update({ stock: prod.stock - ri.returnQty })
          .eq("id", ri.id);
      }
    }

    const { error } = await supabase.from("returns").insert([{
      id: returnId,
      date: today,
      type: "purchases",
      supplier_id: showAutoReturn.id,
      supplier_name: showAutoReturn.name,
      purchase_invoice_id: null, // 🆕 مرتجع تلقائي غير مرتبط بفاتورة واحدة، التوزيع يتم عبر FIFO
      items,
      reason: "مرتجع تلقائي — قرب انتهاء الصلاحية",
      subtotal,
      tax,
      total,
      pharmacy_id: pharmacyId,
    }]);

    if (error) {
      showToast("فشل حفظ المرتجع: " + error.message, "error");
      return;
    }

    // 🆕 توزيع قيمة المرتجع على أقدم فواتير المورد المديونة (FIFO عكسي)
    await persistReturnFIFO(showAutoReturn.id, total);

    setProducts((p) =>
      p.map((x) => {
        const ri = items.find((i) => i.id === x.id);
        return ri ? { ...x, stock: x.stock - ri.returnQty } : x;
      })
    );

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

  // ========== FIFO للسداد ==========
  const processPaymentFIFO = async (supplierId, totalAmount) => {
    const unpaid = purchases
      .filter((p) => p.supplier === supplierId && getPurchaseNetDebt(p) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = totalAmount;
    const updates = [];
    for (const po of unpaid) {
      if (remaining <= 0) break;
      const balance = getPurchaseNetDebt(po); // 🆕 يحسب صافي الدين بعد المرتجعات
      const payment = Math.min(remaining, balance);
      const newPaid = (po.paid || 0) + payment;
      const stillOwed = (po.total - (po.returned_amount || 0)) - newPaid;
      updates.push({ id: po.id, paid: newPaid, payment_status: stillOwed <= 0 ? "مسددة" : "مسددة جزئياً" });
      remaining -= payment;
    }
    for (const u of updates) {
      await supabase.from("purchases").update({ paid: u.paid, payment_status: u.payment_status }).eq("id", u.id);
    }
    setPurchases((prev) =>
      prev.map((p) => { const u = updates.find((x) => x.id === p.id); return u ? { ...p, ...u } : p; })
    );
    return updates;
  };

  // ========== حفظ الدفعة ==========
  const savePayment = async (supplier) => {
    const amount = +payForm.amount;
    if (!amount || amount <= 0) { showToast("يرجى إدخال مبلغ صحيح", "error"); return; }

    let receiptUrl = "";
    if (payForm.receipt) {
      const fileName = `receipts/${supplier.id}_${Date.now()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment_reports").upload(fileName, payForm.receipt);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("payment_reports").getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;
      }
    }

    const payId = `PAY-${Date.now()}`;
    const { error } = await supabase.from("payments").insert({
      id: payId, supplier_id: supplier.id,
      date: new Date().toISOString().split("T")[0],
      amount, notes: payForm.note, attachment_url: receiptUrl, pharmacy_id: pharmacyId,
    });
    if (error) { showToast("فشل حفظ الدفعة: " + error.message, "error"); return; }

    setPayments((p) => [...p, { id: payId, supplier_id: supplier.id, date: new Date().toISOString().split("T")[0], amount, notes: payForm.note, attachment_url: receiptUrl }]);
    await processPaymentFIFO(supplier.id, amount);
    const trPayload = {
      type: "expense",
      sub_type: "supplier_payment",
      method: payForm.method || "نقدي",
      amount,
      note: `سداد مورد: ${supplier.name}${payForm.note ? " - " + payForm.note : ""}`,
      date: new Date().toISOString().split("T")[0],
      pharmacy_id: pharmacyId,
      created_by: currentUser?.name || "",
      supplier_id: supplier.id,
    };
    const { data: trData, error: trError } = await supabase.from("treasury_entries").insert(trPayload).select();
    if (trError) {
      showToast("تم تسجيل السداد لكن فشل تحديث الخزنة: " + trError.message, "error");
    } else if (setTreasuryEntries) {
      const newEntry = (trData && trData[0]) ? trData[0] : { id: `TMP-${Date.now()}`, ...trPayload };
      setTreasuryEntries((p) => [newEntry, ...p]);
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
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: C.success };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: C.accent };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: C.warning };
    return             { class: "very_slow", label: "بطيء جداً", color: C.danger };
  };

  // ========== توليد أوردر تلقائي ==========
  const generateOrder = (supplier) => {
    const status = getSupplierStatus(supplier);
    let targetSupplier = supplier;
    if (status === "red") {
      const alternative = suppliers.find((s) => s.id !== supplier.id && getSupplierStatus(s) !== "red");
      if (alternative) { showToast(`المورد متأخر - سيتم الطلب من: ${alternative.name}`, "warning"); targetSupplier = alternative; }
    }
    const supplierCategories = targetSupplier.supply_categories || [];
    const lowStock = (products || []).filter((p) => {
      const belowMin = p.stock <= (p.min_stock || p.minStock || 0);
      if (!belowMin) return false;
      if (supplierCategories.length === 0) return true;
      const productCategory = p.supply_category || "";
      if (productCategory && supplierCategories.includes(productCategory)) return true;
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
      return { id: p.id, name: p.name, currentStock: p.stock, minStock: p.min_stock || p.minStock || 0, orderQty, cost: p.cost, movement: mv, editable: true };
    }).filter((i) => i.orderQty > 0)
      .sort((a, b) => ["fast","regular","normal","slow","very_slow"].indexOf(a.movement.class) - ["fast","regular","normal","slow","very_slow"].indexOf(b.movement.class));
    setOrderItems(items);
    setShowOrderForm(targetSupplier);
  };

  // ========== حفظ الأوردر ==========
  const saveOrder = async () => {
    if (!showOrderForm || orderItems.length === 0) { showToast("لا توجد أصناف للطلب", "error"); return; }
    const orderId = `ORD-${Date.now()}`;
    const order = { id: orderId, supplier_id: showOrderForm.id, supplier_name: showOrderForm.name, date: new Date().toISOString().split("T")[0], coverage_days: coverageDays, items: orderItems, status: "مسودة", pharmacy_id: pharmacyId };
    const { error } = await supabase.from("orders").insert(order);
    if (error) { showToast("فشل حفظ الأوردر: " + error.message, "error"); return; }
    setOrders((p) => [order, ...p]);
    setShowOrderForm(null);
    setOrderItems([]);
    showToast("تم حفظ الأوردر ✓");
    if (showOrderForm.whatsapp) {
      const msg = `طلب شراء - ${order.date}\n` + orderItems.map((i) => `• ${i.name}: ${i.orderQty} وحدة`).join("\n");
      window.open(`https://wa.me/${showOrderForm.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
    }
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

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank, id: "S" + Date.now() });
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
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) { showToast("يرجى إدخال اسم المورد", "error"); return; }
    // احسب مجموع رصيد أول المدة من التفاصيل لو موجودة
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
    };
    if (editing) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editing);
      if (error) { showToast("فشل التعديل: " + error.message, "error"); return; }
      setSuppliers((p) => p.map((x) => (x.id === editing ? { ...x, ...form, opening_balance: openingBal } : x)));
    } else {
      const { data, error } = await supabase.from("suppliers").insert({ id: form.id, ...payload }).select();
      if (error) { showToast("فشل الإضافة: " + error.message, "error"); return; }
      setSuppliers((p) => [...p, data[0]]);
    }
    setShowForm(false);
    showToast(editing ? "تم تعديل المورد ✓" : "تمت إضافة المورد ✓");
  };

  const filteredSuppliers = suppliers.filter((s) => filterStatus === "all" ? true : getSupplierStatus(s) === filterStatus);

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
        <Btn icon="plus" onClick={openAdd}>إضافة مورد</Btn>
      </div>

      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { k: "all",    l: "الكل",           color: C.muted },
          { k: "green",  l: "🟢 منتظم",       color: C.success },
          { k: "orange", l: "🟠 تأخير بسيط",  color: C.warning },
          { k: "red",    l: "🔴 متأخر",        color: C.danger },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilterStatus(f.k)} style={{
            padding: "7px 16px", borderRadius: 8, border: "1px solid",
            borderColor: filterStatus === f.k ? f.color : C.border,
            background: filterStatus === f.k ? C.divider : "transparent",
            color: filterStatus === f.k ? f.color : C.muted,
            fontSize: 13, fontWeight: filterStatus === f.k ? 700 : 400, cursor: "pointer",
          }}>{f.l}</button>
        ))}
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

          return (
            <div key={s.id} style={{
              background: C.surface, border: `1px solid ${sc.border}`,
              borderRadius: 14, padding: 18, borderTop: `3px solid ${sc.text}`,
            }}>
              {/* اسم + حالة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{s.name}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>رمز: {s.id}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge color={sc.bg} text={sc.text}>{sc.label}</Badge>
                  {rating && <span style={{ fontSize: 11, color: C.muted }}>تنفيذ: {rating.fulfillmentRate}%</span>}
                </div>
              </div>

              {/* تنبيه مرتجع تلقائي */}
              {autoReturnCount > 0 && (
                <div
                  onClick={() => openAutoReturn(s)}
                  style={{
                    background: "#1a0a00", border: "1px solid #ff7744",
                    borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ color: C.warning, fontWeight: 700, fontSize: 12 }}>🔄 مرتجع تلقائي مقترح</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{autoReturnCount} صنف يستوفي شروط الإرجاع</div>
                  </div>
                  <span style={{ color: C.warning, fontSize: 12 }}>إدارة →</span>
                </div>
              )}

              {/* رصيد أول المدة */}
              {(s.opening_balance || 0) > 0 && (
                <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>رصيد أول المدة</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.warning, marginBottom: 6 }}>
                    {(s.opening_balance || 0).toFixed(2)} ر.س
                  </div>
                  {/* تفاصيل أعمار الدين */}
                  {(s.opening_balance_details || []).length > 0 && (() => {
                    const aging = getOpeningBalanceAging(s.opening_balance_details);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                        {Object.entries(aging).map(([bucket, val]) => val > 0 && (
                          <div key={bucket} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.muted }}>{bucket} يوم</div>
                            <div style={{
                              fontSize: 11, fontWeight: 700,
                              color: bucket === "90+" ? C.danger : bucket === "61-90" ? C.warning : C.text,
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
                    <span>الكريدت المستخدم</span>
                    <span style={{ color: debt > creditLimit * 0.8 ? C.danger : C.success }}>
                      {debt.toFixed(0)} / {creditLimit.toFixed(0)} ر.س
                    </span>
                  </div>
                  <div style={{ background: C.divider, borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${creditUsedPct}%`,
                      background: creditUsedPct > 80 ? C.danger : creditUsedPct > 50 ? C.warning : C.success,
                      borderRadius: 4, transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              )}

              {/* فواتير مستحقة */}
              {supPurchases.filter((p) => getPurchaseNetDebt(p) > 0).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>الفواتير المستحقة:</div>
                  {supPurchases
                    .filter((p) => getPurchaseNetDebt(p) > 0)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, 3)
                    .map((po) => {
                      const dueDays = getDueDays(po, s);
                      const balance = getPurchaseNetDebt(po); // 🆕 صافي بعد المرتجع
                      return (
                        <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: C.bgAlt, borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>{po.id}</span>
                          <span style={{ fontSize: 11, color: C.text }}>{balance.toFixed(0)} ر.س</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: dueDays < 0 ? C.danger : dueDays <= 7 ? C.warning : C.success }}>
                            {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                          </span>
                          {po.returned_amount > 0 && (
                            <Badge color="#1a0800" text=C.warning>مرتجع: {po.returned_amount.toFixed(0)}</Badge>
                          )}
                          {po.payment_status === "مسددة جزئياً" && <Badge color="#1a1000" text=C.warning>جزئي</Badge>}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* بيانات الاتصال */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                {s.taxId && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 11, width: 90, flexShrink: 0 }}>الرقم الضريبي:</span>
                    <Badge color="#0a2a00" text=C.success>{s.taxId}</Badge>
                  </div>
                )}
                {(s.supply_categories || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {s.supply_categories.map((cat) => <Badge key={cat} color="#0a2040" text=C.accent>{cat}</Badge>)}
                  </div>
                )}
                {s.payment_terms && <div style={{ fontSize: 11, color: "#5a7a9a" }}>⏱ شروط الدفع: {s.payment_terms} يوم</div>}
                {s.phone   && <div style={{ fontSize: 11, color: "#5a7a9a" }}>📞 {s.phone}</div>}
                {s.email   && <div style={{ fontSize: 11, color: "#5a7a9a" }}>✉ {s.email}</div>}
                {s.contact && <div style={{ fontSize: 11, color: "#5a7a9a" }}>👤 {s.contact}</div>}
              </div>

              {/* أزرار */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn size="sm" icon="purchase" onClick={() => generateOrder(s)} style={{ flex: 1, justifyContent: "center" }} variant={status === "red" ? "danger" : "primary"}>
                  طلب شراء
                </Btn>
                <Btn size="sm" icon="money" onClick={() => { setShowPayForm(s); setPayForm({ amount: "", note: "", method: "نقدي", receipt: null, receiptUrl: "" }); }} variant="success">
                  سداد
                </Btn>
                <Btn size="sm" icon="chart" onClick={() => setShowDetail(s)} variant="secondary">تفاصيل</Btn>
                {s.whatsapp && (
                  <button onClick={() => window.open(`https://wa.me/${s.whatsapp}`, "_blank")}
                    style={{ padding: "6px 10px", background: "#0a2a10", border: "1px solid #1a5020", borderRadius: 7, color: C.success, cursor: "pointer", fontSize: 14 }}>
                    💬
                  </button>
                )}
                <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEdit(s)}>تعديل</Btn>
                <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                  await supabase.from("suppliers").delete().eq("id", s.id);
                  setSuppliers((p) => p.filter((x) => x.id !== s.id));
                  showToast("تم حذف المورد");
                }}>حذف</Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Modal المرتجع التلقائي ===== */}
      {showAutoReturn && (
        <Modal open title={`🔄 مرتجع تلقائي — ${showAutoReturn.name}`} onClose={() => setShowAutoReturn(null)} wide>
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#1a0800", border: "1px solid #ff7744", borderRadius: 8, fontSize: 12, color: "#ff9a44" }}>
            الأصناف التالية تستوفي شروط الإرجاع: صلاحية أقل من 3 شهور + لا حركة شهر، أو صلاحية أقل من 6 شهور + لا حركة شهرين
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgAlt }}>
                  {["الصنف", "المخزون", "الصلاحية", "الأيام المتبقية", "كمية الإرجاع", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: C.muted, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {autoReturnItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: C.text, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 13 }}>{item.stock}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12 }}>{item.expiry}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ color: item.daysToExpiry < 90 ? C.danger : C.warning, fontWeight: 700, fontSize: 12 }}>
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
                        style={{ width: 70, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: C.text, fontSize: 13, outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setAutoReturnItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: C.dangerBorder, cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {autoReturnItems.length === 0 && (
            <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>تم إزالة كل الأصناف</div>
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
            <label style={{ color: C.muted, fontSize: 13 }}>تغطية لمدة:</label>
            <input type="number" min="1" value={coverageDays}
              onChange={(e) => { setCoverageDays(+e.target.value); generateOrder(showOrderForm); }}
              style={{ width: 70, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: C.text, fontSize: 13, outline: "none" }} />
            <span style={{ color: C.muted, fontSize: 13 }}>يوم</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bgAlt }}>
                  {["الصنف", "الحركة", "المخزون", "الحد الأدنى", "الكمية المطلوبة", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: C.muted, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: C.text, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 11, color: item.movement.color, fontWeight: 700 }}>{item.movement.label}</span></td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 13 }}>{item.currentStock}</td>
                    <td style={{ padding: "8px 10px", color: C.muted, fontSize: 13 }}>{item.minStock}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" value={item.orderQty}
                        onChange={(e) => setOrderItems((prev) => prev.map((x, j) => j === i ? { ...x, orderQty: +e.target.value } : x))}
                        style={{ width: 70, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: C.text, fontSize: 13, outline: "none" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setOrderItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: C.dangerBorder, cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orderItems.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>لا توجد أصناف ناقصة</div>}
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

      {/* ===== Modal السداد ===== */}
      {showPayForm && (
        <Modal open title={`تسجيل دفعة — ${showPayForm.name}`} onClose={() => setShowPayForm(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.bgAlt, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>إجمالي المستحقات</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.danger }}>{getSupplierDebt(showPayForm.id).toFixed(2)} ر.س</div>
            </div>
            <div>
  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>طريقة الدفع</div>
  <select value={payForm.method}
    onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
    style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}>
    <option value="نقدي">💵 نقدي</option>
    <option value="بطاقة">💳 بطاقة / صراف</option>
    <option value="تحويل">🏦 تحويل بنكي</option>
  </select>
</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>ترتيب السداد (الأقدم أولاً):</div>
            {purchases.filter((p) => p.supplier === showPayForm.id && getPurchaseNetDebt(p) > 0)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((po) => {
                const balance = getPurchaseNetDebt(po); // 🆕 صافي بعد المرتجع
                const dueDays = getDueDays(po, showPayForm);
                return (
                  <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: C.bgAlt, borderRadius: 8, border: "1px solid #1d2d4a" }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.accent }}>{po.id}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{po.date}</div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{balance.toFixed(2)} ر.س</div>
                      <div style={{ fontSize: 11, color: dueDays < 0 ? C.danger : C.warning }}>
                        {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                      </div>
                    </div>
                    <Badge color={po.payment_status === "مسددة جزئياً" ? "#1a1000" : "#0a0a1a"} text={po.payment_status === "مسددة جزئياً" ? C.warning : C.muted}>
                      {po.payment_status || "غير مسددة"}
                    </Badge>
                  </div>
                );
              })}
            <Input label="مبلغ الدفعة (ر.س)" value={payForm.amount} onChange={(v) => setPayForm((p) => ({ ...p, amount: v }))} placeholder="0.00" />
            <Input label="ملاحظة" value={payForm.note} onChange={(v) => setPayForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>سند الدفع (اختياري)</label>
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => { const file = e.target.files[0]; if (file) setPayForm((p) => ({ ...p, receipt: file })); }}
                style={{ color: C.text, fontSize: 12 }} />
              {payForm.receipt && <div style={{ fontSize: 11, color: C.success, marginTop: 4 }}>✓ {payForm.receipt.name}</div>}
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
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>المشتريات والمدفوعات (6 أشهر)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
                      <div style={{ flex: 1, background: "#3a6aff", height: `${(d.purchases / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مشتريات: ${d.purchases.toFixed(0)}`} />
                      <div style={{ flex: 1, background: C.success, height: `${(d.paid / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مدفوعات: ${d.paid.toFixed(0)}`} />
                    </div>
                    <span style={{ fontSize: 9, color: C.muted }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#3a6aff" }}>■ مشتريات</span>
                <span style={{ fontSize: 11, color: C.success }}>■ مدفوعات</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>سجل الدفعات</div>
            {supPayments.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>لا توجد دفعات مسجلة</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                {supPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #0a101a" }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.text }}>{pay.date}</div>
                      {pay.notes && <div style={{ fontSize: 11, color: C.muted }}>{pay.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{pay.amount.toFixed(2)} ر.س</span>
                      {pay.attachment_url && <a href={pay.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.accent }}>📎 سند</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: C.bgAlt, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>رفع كشف حساب المورد</div>
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const fileName = `statements/${showDetail.id}_${Date.now()}_${file.name}`;
                  const { error } = await supabase.storage.from("payment_reports").upload(fileName, file);
                  if (error) { showToast("فشل الرفع: " + error.message, "error"); return; }
                  showToast("تم رفع الكشف ✓");
                }}
                style={{ color: C.text, fontSize: 12 }} />
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>حد الكريدت (ر.س)</label>
              <input type="number" min="0" value={form.credit_limit} onChange={(e) => F("credit_limit", +e.target.value)}
                style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>شروط الدفع (يوم)</label>
              <input type="number" min="0" value={form.payment_terms} onChange={(e) => F("payment_terms", +e.target.value)}
                style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* ── رصيد أول المدة بتفاصيل ── */}
          <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.warning }}>رصيد أول المدة</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  المجموع: {(form.opening_balance_details || []).reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)} ر.س
                </div>
              </div>
              <button onClick={addOpeningDetail} style={{ background: "#1a2a10", border: "1px solid #2a5020", borderRadius: 7, padding: "6px 12px", color: C.success, fontSize: 12, cursor: "pointer" }}>
                + إضافة فاتورة
              </button>
            </div>

            {(form.opening_balance_details || []).length === 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>
                  أو أدخل رقم مجمل مباشرة (ر.س)
                </label>
                <input type="number" min="0" value={form.opening_balance}
                  onChange={(e) => F("opening_balance", +e.target.value)}
                  style={{ width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {(form.opening_balance_details || []).length > 0 && (
              <div>
                {/* رأس الجدول */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6 }}>
                  {["رقم الفاتورة", "المبلغ (ر.س)", "عمر الدين (يوم)", "ملاحظة", ""].map((h) => (
                    <div key={h} style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{h}</div>
                  ))}
                </div>
                {(form.opening_balance_details || []).map((d) => (
                  <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={d.invoice_no} onChange={(e) => updateOpeningDetail(d.id, "invoice_no", e.target.value)}
                      placeholder="INV-001"
                      style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.amount} onChange={(e) => updateOpeningDetail(d.id, "amount", +e.target.value)}
                      placeholder="0"
                      style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: C.warning, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.due_days} onChange={(e) => updateOpeningDetail(d.id, "due_days", +e.target.value)}
                      placeholder="30"
                      style={{ background: C.bgAlt, border: `1px solid ${d.due_days > 90 ? C.dangerBorder : d.due_days > 60 ? "#4a3000" : C.border}`, borderRadius: 6, padding: "7px 10px", color: d.due_days > 90 ? C.danger : d.due_days > 60 ? C.warning : C.text, fontSize: 12, outline: "none" }} />
                    <input value={d.note} onChange={(e) => updateOpeningDetail(d.id, "note", e.target.value)}
                      placeholder="اختياري"
                      style={{ background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, outline: "none" }} />
                    <button onClick={() => removeOpeningDetail(d.id)}
                      style={{ background: "transparent", border: "none", color: C.dangerBorder, cursor: "pointer", padding: 4 }}>
                      <IC n="trash" s={14} />
                    </button>
                  </div>
                ))}

                {/* ملخص أعمار الدين */}
                {(() => {
                  const aging = getOpeningBalanceAging(form.opening_balance_details || []);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10, padding: "10px 0", borderTop: "1px solid #1d2d4a" }}>
                      {[
                        { bucket: "0-30", label: "0-30 يوم",  color: C.success },
                        { bucket: "31-60", label: "31-60 يوم", color: C.text },
                        { bucket: "61-90", label: "61-90 يوم", color: C.warning },
                        { bucket: "90+",  label: "+90 يوم",   color: C.danger },
                      ].map(({ bucket, label, color }) => (
                        <div key={bucket} style={{ textAlign: "center", background: C.bgAlt, borderRadius: 6, padding: "8px 4px" }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
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
            <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 8 }}>فئات التوريد</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUPPLY_CATEGORIES.map((cat) => {
                const selected = (form.supply_categories || []).includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => {
                    const current = form.supply_categories || [];
                    F("supply_categories", selected ? current.filter((c) => c !== cat) : [...current, cat]);
                  }}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? C.accent : C.border, background: selected ? "#0a2040" : "transparent", color: selected ? C.accent : C.muted, fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
                    {selected ? "✓ " : ""}{cat}
                  </button>
                );
              })}
            </div>
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
