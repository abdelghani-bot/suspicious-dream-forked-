export function ReturnsModule({
  const { C } = useTheme();
  products,
  setProducts,
  sales,
  setSales,
  purchases,
  setPurchases,
  customers,
  showToast,
  pharmacyId,
  currentUser,
  setTreasuryEntries, // 🆕 لازم تتمرر من الأب (App.tsx) لنفس الـ pattern المستخدم في SuppliersModule
}) {
  const [type, setType] = useState("sales");
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState("");
  const [selInvoice, setSelInvoice] = useState(null); // كائن الفاتورة كاملة
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false);

  // بحث العميل
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selCustomer, setSelCustomer] = useState(null);

  // مرتجع مشتريات
  const [selPurchaseInvoice, setSelPurchaseInvoice] = useState("");

  // مدير: إرجاع بدون فاتورة
  const isAdmin = currentUser?.role === "admin";
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const ADMIN_PIN = "1234"; // غيّره حسب احتياجك

  useEffect(() => {
    setReturnItems([]);
    setInvoiceSearch("");
    setSelInvoice(null);
    setCustomerSearch("");
    setSelCustomer(null);
    setReason("");
    setSelPurchaseInvoice("");
    setAdminOverride(false);
  }, [type]);

  // ── فلترة فواتير المبيعات ──
  const filteredSaleInvoices = sales.filter((s) => {
    const q = invoiceSearch.toLowerCase();
    if (!q) return true;
    return (
      (s.id || "").toLowerCase().includes(q) ||
      (s.customer_name || "").toLowerCase().includes(q)
    );
  });

  // ── اختيار فاتورة مبيعات ──
  const handleSelectInvoice = (invoice) => {
    // تحقق من الحد الزمني 14 يوم
    const invoiceDate = new Date(invoice.date);
    const today = new Date();
    const daysDiff = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 14 && !adminOverride) {
      showToast(`⚠️ الفاتورة أقدم من 14 يوم (${daysDiff} يوم) — يلزم تصريح مدير`, "error");
      setShowPinModal(true);
      return;
    }
    setSelInvoice(invoice);
    setInvoiceSearch(invoice.id);
    setInvoiceSearchOpen(false);
    // تحميل أصناف الفاتورة
    setReturnItems(
      (invoice.items || []).map((item) => ({
        ...item,
        returnQty: 0,
        originalBatch: item.batch || null,
        originalExpiry: item.expiry || null,
        originalSerial: item.serial || null,
        alreadyReturnedQty: item.returnedQty || 0, // 🆕 كمية سبق إرجاعها من هذا الصنف
      }))
    );
    // تحديد العميل تلقائياً — invoice.customer هو الـ id (راجع POS.completeSale)
    if (invoice.customer) {
      const c = customers?.find((x) => String(x.id) === String(invoice.customer));
      if (c) {
        setSelCustomer(c);
        setCustomerSearch(c.name);
      }
    }
  };

  // ── فاتورة مشتريات ──
  const purchaseInvoice = purchases.find((p) => p.id === selPurchaseInvoice);
  useEffect(() => {
    if (type === "purchases" && purchaseInvoice) {
      setReturnItems(
        purchaseInvoice.items.map((i) => ({
          ...i,
          returnQty: 0,
          alreadyReturnedQty: i.returnedQty || 0, // 🆕 لو خزّنت تفاصيل الإرجاع على مستوى الصنف
        }))
      );
    }
  }, [selPurchaseInvoice, type]);

  // ── حسابات ──
  const returnSubtotal = returnItems.reduce(
    (s, i) =>
      s + (type === "purchases" ? i.cost || i.price || 0 : i.price || 0) * (i.returnQty || 0),
    0
  );
  const returnTax = returnItems.reduce(
    (s, i) =>
      i.taxable
        ? s + (type === "purchases" ? i.cost || i.price || 0 : i.price || 0) * (i.returnQty || 0) * TAX_RATE
        : s,
    0
  );
  const returnTotal = returnSubtotal + returnTax;

  // ── تحقق من الباتش والصلاحية ──
  const validateItem = (item) => {
    if (!selInvoice || adminOverride) return true;
    // تحقق batch
    if (item.originalBatch && item.batch && item.batch !== item.originalBatch) {
      showToast(`⚠️ ${item.name}: رقم الباتش لا يطابق الفاتورة الأصلية`, "error");
      return false;
    }
    // تحقق expiry
    if (item.originalExpiry && item.expiry && item.expiry !== item.originalExpiry) {
      showToast(`⚠️ ${item.name}: تاريخ الصلاحية لا يطابق الفاتورة الأصلية`, "error");
      return false;
    }
    return true;
  };

  // ── تأكيد الإرجاع ──
  const processReturn = async () => {
    if (type === "sales" && !selInvoice && !adminOverride) {
      showToast("يجب اختيار فاتورة البيع أولاً", "error");
      return;
    }
    if (type === "purchases" && !selPurchaseInvoice) {
      showToast("يجب اختيار فاتورة الشراء أولاً", "error");
      return;
    }
    if (returnItems.length === 0 || returnItems.every((i) => i.returnQty === 0)) {
      showToast("يرجى تحديد الكميات المرتجعة", "error");
      return;
    }

    // تحقق من كل صنف
    for (const item of returnItems) {
      if (item.returnQty > 0 && !validateItem(item)) return;
      // تحقق أن الكمية المرتجعة لا تتجاوز الكمية المباعة/المشتراة (مع احتساب ما سبق إرجاعه)
      if (type === "sales" && selInvoice) {
        const origItem = selInvoice.items?.find((x) => x.id === item.id);
        const alreadyReturned = item.alreadyReturnedQty || 0;
        if (origItem && item.returnQty + alreadyReturned > origItem.qty) {
          showToast(
            `⚠️ ${item.name}: الكمية المرتجعة (${item.returnQty}) + سابق إرجاعه (${alreadyReturned}) أكبر من المباعة (${origItem.qty})`,
            "error"
          );
          return;
        }
      }
      if (type === "purchases" && purchaseInvoice) {
        const origItem = purchaseInvoice.items?.find((x) => x.id === item.id);
        const alreadyReturned = item.alreadyReturnedQty || 0;
        if (origItem && item.returnQty + alreadyReturned > origItem.qty) {
          showToast(
            `⚠️ ${item.name}: الكمية المرتجعة (${item.returnQty}) + سابق إرجاعه (${alreadyReturned}) أكبر من المشتراة (${origItem.qty})`,
            "error"
          );
          return;
        }
      }
    }

    const returnId = `RET-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);

    // ── تحديث المخزون في Supabase ──
    for (const ri of itemsToReturn) {
      const prod = products.find((x) => x.id === ri.id);
      if (prod) {
        const { error: stockError } = await supabase
          .from("products")
          .update({
            stock: type === "sales" ? prod.stock + ri.returnQty : prod.stock - ri.returnQty,
          })
          .eq("id", ri.id);
        if (stockError) {
          showToast("خطأ في تحديث المخزون: " + stockError.message, "error");
        }
      }
    }

    setProducts((p) =>
      p.map((x) => {
        const ri = itemsToReturn.find((i) => i.id === x.id);
        if (!ri) return x;
        return { ...x, stock: type === "sales" ? x.stock + ri.returnQty : x.stock - ri.returnQty };
      })
    );

    // ═══════════════════════════════════════════════════
    // 🆕 مرتجع مبيعات: ينزل من الدخل (خزنة لو كاش / مديونية لو آجل)
    // + تحديث جزئي على بنود الفاتورة الأصلية في sales (مش الفاتورة كلها)
    // ═══════════════════════════════════════════════════
    if (type === "sales" && selInvoice) {
      const updatedItems = (selInvoice.items || []).map((item) => {
        const ri = itemsToReturn.find((i) => i.id === item.id);
        if (!ri) return item;
        return { ...item, returnedQty: (item.returnedQty || 0) + ri.returnQty };
      });
      const allReturned = updatedItems.every(
        (item) => (item.returnedQty || 0) >= item.qty
      );

      const { error: saleUpdateError } = await supabase
        .from("sales")
        .update({
          items: updatedItems,
          returned: allReturned, // علم فقط لو كل البنود رجعت بالكامل
          returnDate: allReturned ? today : undefined,
        })
        .eq("id", selInvoice.id);

      if (saleUpdateError) {
        showToast("خطأ في تحديث الفاتورة الأصلية: " + saleUpdateError.message, "error");
        return;
      }

      setSales((prev) =>
        prev.map((s) =>
          s.id === selInvoice.id
            ? { ...s, items: updatedItems, returned: allReturned, returnDate: allReturned ? today : s.returnDate }
            : s
        )
      );

      if ((selInvoice.payment || "نقدي") === "آجل") {
        // 🆕 فاتورة آجل → ينزل من مديونية العميل عبر credit_payments (نفس آلية السداد بالضبط)
        const customerId = selCustomer?.id || selInvoice.customer;
        if (!customerId) {
          showToast("⚠️ لا يمكن تحديد العميل لخصم المرتجع من مديونيته", "error");
          return;
        }
        const { error: creditError } = await supabase.from("credit_payments").insert([
          {
            invoice_id: selInvoice.id,
            customer_id: customerId,
            amount: returnTotal,
            date: today,
            notes: "مرتجع بيع",
            created_by: currentUser?.name || "",
            pharmacy_id: pharmacyId,
          },
        ]);
        if (creditError) {
          showToast("خطأ في تسجيل خصم المرتجع من مديونية العميل: " + creditError.message, "error");
          return;
        }
      } else {
        // 🆕 فاتورة نقدي → ينزل من الخزنة كمصروف (نفس pattern سداد المورد في SuppliersModule)
        const trPayload = {
          type: "expense",
          sub_type: "sales_return",
          method: "نقدي",
          amount: returnTotal,
          note: `مرتجع بيع — فاتورة ${selInvoice.id}${reason ? " - " + reason : ""}`,
          date: today,
          pharmacy_id: pharmacyId,
          created_by: currentUser?.name || "",
        };
        const { data: trData, error: trError } = await supabase
          .from("treasury_entries")
          .insert(trPayload)
          .select();
        if (trError) {
          showToast("تم تسجيل المرتجع لكن فشل تحديث الخزنة: " + trError.message, "error");
        } else if (setTreasuryEntries) {
          const newEntry = trData && trData[0] ? trData[0] : { id: `TMP-${Date.now()}`, ...trPayload };
          setTreasuryEntries((p) => [newEntry, ...p]);
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 🆕 مرتجع مشتريات: يرتبط بفاتورة الشراء وينزل من مديونية المورد
    // عبر تحديث purchases.returned_amount (تراكمي)
    // ═══════════════════════════════════════════════════
    let supplierIdForReturn = null;
    if (type === "purchases" && purchaseInvoice) {
      supplierIdForReturn = purchaseInvoice.supplier;
      const newReturnedAmount = (purchaseInvoice.returned_amount || 0) + returnTotal;

      const updatedItems = (purchaseInvoice.items || []).map((item) => {
        const ri = itemsToReturn.find((i) => i.id === item.id);
        if (!ri) return item;
        return { ...item, returnedQty: (item.returnedQty || 0) + ri.returnQty };
      });

      const { error: purchaseUpdateError } = await supabase
        .from("purchases")
        .update({
          returned_amount: newReturnedAmount,
          items: updatedItems,
        })
        .eq("id", purchaseInvoice.id);

      if (purchaseUpdateError) {
        showToast("خطأ في تحديث فاتورة الشراء الأصلية: " + purchaseUpdateError.message, "error");
        return;
      }

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === purchaseInvoice.id
            ? { ...p, returned_amount: newReturnedAmount, items: updatedItems }
            : p
        )
      );
    }

    // ── حفظ سجل المرتجع نفسه ──
    const { error } = await supabase.from("returns").insert([
      {
        id: returnId,
        date: today,
        type,
        invoice_id: selInvoice?.id || null,
        purchase_invoice_id: purchaseInvoice?.id || null, // 🆕
        supplier_id: supplierIdForReturn, // 🆕
        customer: selCustomer?.id || null,
        customer_name: selCustomer?.name || "زبون عادي",
        items: itemsToReturn,
        reason,
        subtotal: returnSubtotal,
        tax: returnTax,
        total: returnTotal,
        admin_override: adminOverride,
        pharmacy_id: pharmacyId,
      },
    ]);

    if (error) {
      showToast("خطأ في حفظ المرتجع: " + error.message, "error");
      return;
    }

    // رصد
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = itemsToReturn.filter((i) => i.serial);
    if (rasdConfig.enabled && gs1Items.length > 0) {
      RasdService.sendTransaction(
        "return",
        gs1Items.map((i) => ({
          gtin: i.gtin || i.barcode,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.returnQty,
        })),
        rasdConfig.gln,
        null
      ).then((result) => {
        if (!result.success) showToast("تحذير: فشل إرسال بيانات المرتجع لرصد", "error");
      });
    }

    setReturnItems([]);
    setReason("");
    setSelCustomer(null);
    setCustomerSearch("");
    setSelInvoice(null);
    setInvoiceSearch("");
    setSelPurchaseInvoice("");
    setAdminOverride(false);
    showToast(`✅ تم تسجيل المرتجع — ${returnTotal.toFixed(2)} ر.س`);
  };

  return (
    <div>
      {/* PIN Modal */}
      {showPinModal && (
        <div style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.surface, border: "1px solid #2a6aef", borderRadius: 16, padding: 28, width: 320, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h3 style={{ color: C.text, margin: "0 0 8px" }}>صلاحية مدير مطلوبة</h3>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
              الفاتورة أقدم من 14 يوم — أدخل PIN المدير للمتابعة
            </p>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="PIN..."
              style={{
                width: "100%", background: C.bgAlt, border: "1px solid #1d2d4a",
                borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 16,
                outline: "none", textAlign: "center", boxSizing: "border-box", marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (adminPin === ADMIN_PIN) {
                    setAdminOverride(true);
                    setShowPinModal(false);
                    setAdminPin("");
                    showToast("✅ تم التحقق — يمكنك المتابعة");
                  } else {
                    showToast("PIN غير صحيح", "error");
                    setAdminPin("");
                  }
                }}
                style={{ flex: 1, padding: "9px 0", background: C.infoBg, border: "1px solid #2a6aef", borderRadius: 8, color: C.accent, fontWeight: 700, cursor: "pointer" }}
              >
                تأكيد
              </button>
              <button
                onClick={() => { setShowPinModal(false); setAdminPin(""); }}
                style={{ padding: "9px 16px", background: "transparent", border: "1px solid #1d2d4a", borderRadius: 8, color: C.muted, cursor: "pointer" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>المرتجعات</h2>

      {/* نوع المرتجع */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {["sales", "purchases"].map((t) => (
          <button key={t} onClick={() => setType(t)}
            style={{
              padding: "9px 22px", borderRadius: 9, border: "1px solid",
              borderColor: type === t ? C.accent : C.border,
              background: type === t ? C.infoBg : "transparent",
              color: type === t ? C.accent : C.muted,
              fontWeight: type === t ? 700 : 400, cursor: "pointer", fontSize: 14,
            }}
          >
            مرتجع {t === "sales" ? "مبيعات" : "مشتريات"}
          </button>
        ))}
      </div>

      {/* ════ مرتجع مبيعات ════ */}
      {type === "sales" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>

          {/* بحث فاتورة */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 4, display: "block" }}>
              🧾 رقم الفاتورة <span style={{ color: C.danger }}>*</span>
              {adminOverride && <span style={{ marginRight: 8, background: C.warningBg, color: C.warning, borderRadius: 4, padding: "1px 8px", fontSize: 11 }}>🔓 تصريح مدير</span>}
            </label>
            <input
              value={invoiceSearch}
              onChange={(e) => { setInvoiceSearch(e.target.value); setSelInvoice(null); setReturnItems([]); }}
              onFocus={() => setInvoiceSearchOpen(true)}
              onBlur={() => setTimeout(() => setInvoiceSearchOpen(false), 150)}
              placeholder="ابحث برقم الفاتورة أو اسم العميل..."
              style={{
                width: "100%", background: C.bgAlt,
                border: `1px solid ${selInvoice ? C.accent : C.border}`,
                borderRadius: 9, padding: "11px 14px", color: C.text,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {selInvoice && (
              <div style={{ marginTop: 6, padding: "6px 12px", background: "#0a1a10", border: "1px solid #2a6a2a", borderRadius: 8, fontSize: 12, color: C.success, display: "flex", justifyContent: "space-between" }}>
                <span>
                  ✅ {selInvoice.id} — {selInvoice.date} — {selInvoice.customer_name}
                  {" — "}
                  <strong>{selInvoice.payment === "آجل" ? "آجل (سينزل من مديونية العميل)" : "نقدي (سينزل من الخزنة)"}</strong>
                </span>
                <button onClick={() => { setSelInvoice(null); setInvoiceSearch(""); setReturnItems([]); }}
                  style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer" }}>✕</button>
              </div>
            )}
            {invoiceSearchOpen && !selInvoice && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: C.surface, border: "1px solid #1d2d4a", borderRadius: 8,
                maxHeight: 220, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                {filteredSaleInvoices.slice(0, 15).map((inv) => {
                  const daysDiff = Math.floor((new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24));
                  const isOld = daysDiff > 14;
                  return (
                    <div key={inv.id} onMouseDown={() => handleSelectInvoice(inv)}
                      style={{
                        padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #1a2a3a",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{inv.id}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {inv.customer_name} · {inv.date} · {(inv.total || 0).toFixed(2)} ر.س
                          {inv.payment === "آجل" && <span style={{ color: C.warning }}> · آجل</span>}
                        </div>
                      </div>
                      {isOld && (
                        <span style={{ fontSize: 10, background: "#2a1000", color: C.warning, borderRadius: 4, padding: "2px 6px" }}>
                          {daysDiff} يوم 🔐
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredSaleInvoices.length === 0 && (
                  <div style={{ padding: 14, color: C.muted, textAlign: "center", fontSize: 13 }}>لا توجد فواتير مطابقة</div>
                )}
              </div>
            )}
          </div>

          {/* بحث عميل */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: C.muted, marginBottom: 4, display: "block" }}>👤 العميل</label>
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); if (!e.target.value) setSelCustomer(null); }}
              onFocus={() => setCustomerSearchOpen(true)}
              onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
              placeholder="ابحث بالاسم أو الجوال..."
              style={{
                width: "100%", background: C.bgAlt,
                border: `1px solid ${selCustomer ? C.accent : C.border}`,
                borderRadius: 9, padding: "11px 14px", color: C.text,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {customerSearchOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: C.surface, border: "1px solid #1d2d4a", borderRadius: 8,
                maxHeight: 200, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                <div onMouseDown={() => { setSelCustomer(null); setCustomerSearch(""); setCustomerSearchOpen(false); }}
                  style={{ padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #1a2a3a", color: C.muted, fontSize: 13 }}>
                  👤 زبون عادي
                </div>
                {(customers || [])
                  .filter((c) => {
                    const q = customerSearch.toLowerCase();
                    if (!q) return true;
                    return (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
                  })
                  .slice(0, 10)
                  .map((c) => (
                    <div key={c.id} onMouseDown={() => { setSelCustomer(c); setCustomerSearch(c.name); setCustomerSearchOpen(false); }}
                      style={{ padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #1a2a3a", display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: 11, color: C.muted }}>{c.phone}</div>}
                      </div>
                      {c.credit > 0 && (
                        <span style={{ fontSize: 11, background: "#2a1010", color: C.danger, borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
                          آجل: {c.credit?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ مرتجع مشتريات ════ */}
      {type === "purchases" && (
        <div style={{ marginBottom: 14 }}>
          <Select
            label="اختر فاتورة الشراء"
            value={selPurchaseInvoice}
            onChange={setSelPurchaseInvoice}
            options={[
              { v: "", l: "اختر الفاتورة..." },
              ...purchases
                .filter((p) => (p.total - (p.returned_amount || 0)) > 0 || (p.returned_amount || 0) === 0)
                .map((x) => ({
                  v: x.id,
                  l: `${x.id} — ${x.date} — ${(x.total ?? 0).toFixed(2)} ر.س${
                    x.returned_amount > 0 ? ` (مرتجع سابق: ${x.returned_amount.toFixed(2)})` : ""
                  }`,
                })),
            ]}
          />
        </div>
      )}

      {/* سبب الإرجاع */}
      <div style={{ marginBottom: 14 }}>
        <Input label="سبب الإرجاع" value={reason} onChange={setReason} placeholder="سبب الإرجاع (اختياري)" />
      </div>

      {/* الأصناف */}
      {returnItems.length > 0 && (
        <div style={{ background: C.surface, border: "1px solid #1d2d4a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            {selInvoice ? `أصناف فاتورة ${selInvoice.id}` : "الأصناف"}
            {!adminOverride && <span style={{ marginRight: 8, color: C.warning, fontSize: 11 }}>⚠️ سيتم التحقق من الباتش والصلاحية</span>}
          </div>
          {returnItems.map((item, i) => {
            const maxReturnable = Math.max(0, (item.qty || 0) - (item.alreadyReturnedQty || 0));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0a101a" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {item.originalBatch && <span>باتش: {item.originalBatch}</span>}
                    {item.originalExpiry && <span style={{ marginRight: 8 }}>صلاحية: {item.originalExpiry}</span>}
                    <span style={{ marginRight: 8 }}>الكمية: {item.qty}</span>
                    {item.alreadyReturnedQty > 0 && (
                      <span style={{ marginRight: 8, color: C.warning }}>سبق إرجاعه: {item.alreadyReturnedQty}</span>
                    )}
                  </div>
                </div>
                <div style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>
                  {(type === "purchases" ? item.cost || item.price : item.price).toFixed(2)} ر.س
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.max(0, x.returnQty - 1) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: "#1a2540", border: "none", color: C.accent, cursor: "pointer", fontWeight: 700 }}>-</button>
                  <input type="number" min={0} max={maxReturnable}
                    value={item.returnQty}
                    onChange={(e) => setReturnItems((p) => p.map((x, j) => j === i ? {
                      ...x, returnQty: Math.min(Math.max(0, +e.target.value), maxReturnable)
                    } : x))}
                    style={{ width: 50, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 6px", color: C.text, fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.min(x.returnQty + 1, maxReturnable) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: "#1a2540", border: "none", color: C.accent, cursor: "pointer", fontWeight: 700 }}>+</button>
                </div>
                {item.taxable && <Badge color="#0a2a00" text={C.success}>15%</Badge>}
              </div>
            );
          })}
        </div>
      )}

      {/* الإجمالي */}
      {returnTotal > 0 && (
        <div style={{ background: C.bgAlt, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, marginBottom: 5 }}>
            <span>قبل الضريبة</span><span>{returnSubtotal.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.success, marginBottom: 5 }}>
            <span>الضريبة المستردة 15%</span><span>{returnTax.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontWeight: 800, fontSize: 16, borderTop: "1px solid #1d2d4a", paddingTop: 8 }}>
            <span>إجمالي المرتجع</span><span>{returnTotal.toFixed(2)} ر.س</span>
          </div>
          {type === "sales" && selInvoice && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#6a9aff" }}>
              {selInvoice.payment === "آجل"
                ? "↳ سيُخصم هذا المبلغ من مديونية العميل"
                : "↳ سيُسجَّل هذا المبلغ كمصروف من الخزنة"}
            </div>
          )}
          {type === "purchases" && purchaseInvoice && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#6a9aff" }}>
              ↳ سيُخصم هذا المبلغ من مديونية المورد {purchaseInvoice.returned_amount > 0 ? `(مرتجع سابق على هذه الفاتورة: ${purchaseInvoice.returned_amount.toFixed(2)} ر.س)` : ""}
            </div>
          )}
        </div>
      )}

      <Btn icon="returns" onClick={processReturn} variant="danger">تأكيد الإرجاع</Btn>
    </div>
  );
}
// ==================== RASSD SETTINGS ====================
