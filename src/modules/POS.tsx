export function POS({
  const { C } = useTheme();
  products,
  setProducts,
  customers,
  sales,
  setSales,
  shifts,
  setShifts,
  currentUser,
  currentShift,
  showToast,
  invoices,
  setInvoices,
  activeTab,
  setActiveTab,
  pharmacyId,
  promos,
  discountRules,
  productEarliestExpiry,
}) {
  const [showPrint, setShowPrint] = useState(null);
  const fileRef = useRef();
  const [fifoResults, setFifoResults] = useState({});
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [autoSaveWarning, setAutoSaveWarning] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState(180);
  const autoSaveTimerRef = useRef(null);
  const autoSaveCountdownRef = useRef(null);

  // ── نقاط الولاء ──
  const [customerLoyalty, setCustomerLoyalty] = useState<any>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltySettings, setLoyaltySettings] = useState<any>(null);

  const inv = invoices[activeTab] || emptyInvoice();
  const setInv = (updater) => {
    setInvoices((prev) =>
      prev.map((item, i) =>
        i === activeTab
          ? typeof updater === "function"
            ? updater(item)
            : updater
          : item
      )
    );
  };
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (autoSaveCountdownRef.current)
      clearInterval(autoSaveCountdownRef.current);
    setAutoSaveWarning(false);
    if (inv.cart.length === 0) return;
    const elapsed = Date.now() - (inv.openedAt || Date.now());
    const remaining = 10 * 60 * 1000 - elapsed;
    if (remaining <= 0) return;
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveWarning(true);
      setAutoSaveCountdown(180);
      autoSaveCountdownRef.current = setInterval(() => {
        setAutoSaveCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(autoSaveCountdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, remaining);
    return () => {
      clearTimeout(autoSaveTimerRef.current);
      clearInterval(autoSaveCountdownRef.current);
    };
  }, [activeTab, inv.cart.length]);

  const addTab = () => {
    if (invoices.length >= MAX_INVOICES) {
      showToast(`الحد الأقصى ${MAX_INVOICES} فواتير`, "error");
      return;
    }
    setInvoices((p) => [...p, emptyInvoice()]);
    setActiveTab(invoices.length);
  };

 useEffect(() => {
  const handler = (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      addTab();
    }
    if (e.key === "F1") {
      e.preventDefault();
      completeSale();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [addTab]);
  const closeTab = (idx) => {
    if (invoices.length === 1) {
      setInvoices([emptyInvoice()]);
      return;
    }
    const next = invoices.filter((_, i) => i !== idx);
    setInvoices(next);
    setActiveTab(Math.min(activeTab, next.length - 1));
  };

  const addToCart = (p) => {
  if (!p.isMissed && !p.isJoker) {
    const effectiveStock =
      p.saleUnits > 1 ? p.stock * p.saleUnits : p.stock;
    if (effectiveStock <= 0) {
      showToast("المخزون نفد!", "error");
      return;
    }
    if (p.expiry) {
      const expDate = new Date(p.expiry);
      const today = new Date();
      if (expDate < today) {
        showToast(`⚠️ ${p.name} - منتهي الصلاحية! (${p.expiry})`, "error");
        return;
      }
      const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 90) {
        showToast(`⚠️ ${p.name} - ينتهي خلال ${daysLeft} يوم`, "warning");
      }
    }
  }

  setInv((prev) => {
    const ex = prev.cart.find((i) => i.id === p.id);
    if (ex) {
      const prod = products.find((x) => x.id === p.id);
      const step = p.saleUnits > 1 ? 1 / p.saleUnits : 1;  // ✅ p مش item
      const maxQty = p.saleUnits > 1
        ? (prod?.stock || 0) * p.saleUnits
        : prod?.stock || 99;
      if (ex.qty + step > maxQty) {
        showToast("لا يوجد مخزون كافٍ", "error");
        return prev;
      }
      return {
        ...prev,
        cart: prev.cart.map((i) =>
          i.id === p.id
            ? { ...i, qty: Math.round((i.qty + step) * 10000) / 10000 }
            : i
        ),
      };
    }

    // صنف جديد
   const initQty = p.qty !== undefined && !isNaN(p.qty) && !p.isPartial
  ? p.qty
  : 1;
    const effective = p.isMissed || p.isJoker
      ? { price: p.price, discountPct: 0, source: null }
      : getEffectivePrice(p, promos, discountRules, productEarliestExpiry);

    // السعر الكامل للحساب، سعر الوحدة للعرض
    const cartPrice = p.isPartial ? p.price : effective.price;
    const unitPrice = p.isPartial
      ? Math.round((p.price / p.saleUnits) * 100) / 100
      : undefined;

    return {
      ...prev,
      cart: [...prev.cart, {
        ...p,
        qty: initQty,
        dose: "",
        price: cartPrice,
        unitPrice,
        originalPrice: p.price,
        discountPct: p.isPartial ? 0 : effective.discountPct,
        discountSource: p.isPartial ? null : effective.source,
      }],
    };
  });
};
  const scanBarcode = (scan) => {
    let product = null;
    if (scan.type === "gs1") {
      product = products.find(
        (x) => x.barcode === scan.gtin || x.gtin === scan.gtin
      );
      if (product) {
        addToCart({
          ...product,
          batch: scan.batch,
          serial: scan.serial,
          expiry: scan.expiry,
        });
        return;
      }
    } else {
      product = products.find(
        (x) => x.barcode === scan.code || x.id === scan.code
      );
      if (product) {
        addToCart(product);
        return;
      }
    }
    showToast("الصنف غير موجود: " + (scan.gtin || scan.code), "error");
  };

  const filtered = products.filter((p) => {
    return (
      (p.name || "").includes(inv.search) ||
      (p.barcode || "").includes(inv.search) ||
      (p.id || "").includes(inv.search)
    );
  });

  const subtotal = inv.cart
    .filter((i) => !i.isMissed)
    .reduce((s, i) => s + i.price * i.qty, 0);

  const taxAmount = inv.cart
    .filter((i) => !i.isMissed)
    .reduce((s, i) => (i.taxable ? s + i.price * i.qty * TAX_RATE : s), 0);

  const missedTotal = inv.cart
    .filter((i) => i.isMissed)
    .reduce((s, i) => s + i.price * i.qty, 0);

  const discountAmt =
    inv.discountType === "value"
      ? Math.min(Math.max(inv.discount || 0, 0), subtotal + taxAmount)
      : Math.round((((subtotal + taxAmount) * (inv.discount || 0)) / 100) * 100) / 100;

  // ── الإجمالي بعد خصم نقاط الولاء ──
  const pointsDiscount = usePoints ? pointsToRedeem : 0;
  const total = Math.max(0, subtotal + taxAmount - discountAmt - pointsDiscount);

  const completeSale = async () => {
    if (!currentShift) {
      showToast("يرجى فتح شفت أولاً", "error");
      return;
    }
    if (inv.cart.length === 0) {
      showToast("السلة فارغة!", "error");
      return;
    }

    if (inv.paymentMode === "single" && inv.payment === "آجل" && !inv.selCustomer) {
      showToast("لا يمكن تسجيل بيع آجل لزبون عادي — اختر عميلاً أولاً", "error");
      return;
    }

    if (inv.paymentMode === "split") {
      const { card, transfer } = inv.splitPayment;
      const cash = Math.round((total - card - transfer) * 100) / 100;
      if (cash < 0) {
        showToast("مجموع البطاقة والتحويل أكبر من الإجمالي", "error");
        return;
      }
    }

    const id =
      "INV-" +
      new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, "")
        .slice(0, 14);

    const newFifoResults = {};
    for (const ci of inv.cart) {
      const prod = products.find((x) => x.id === ci.id);
      if (prod) {
        newFifoResults[ci.id] = sellFromBatches(prod, +ci.qty);
      }
    }
    setFifoResults(newFifoResults);

    const invoice = {
      id,
      date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      customer: inv.selCustomer?.id || null,
      customer_name: inv.selCustomer?.name || "زبون عادي",
      items: inv.cart.map((i) => ({
        id: i.id,
        name: i.name,
        qty: +i.qty,
        price: newFifoResults[i.id]?.salePrice ?? i.price,
        cost:
          newFifoResults[i.id]?.soldBatches?.[0]?.cost ??
          products.find((x) => x.id === i.id)?.cost ??
          0,
        taxable: i.taxable,
        dose: i.dose,
        gtin: i.gtin || i.barcode,
        batch: i.batch || null,
        serial: i.serial || null,
        isMissed: !!i.isMissed,
        isJoker: !!i.isJoker,
        expiry:
          i.expiry ||
          newFifoResults[i.id]?.soldBatches?.[0]?.expiry_date ||
          null,
        category: i.main_category || i.mainCategory || i.category || "أخرى",
      })),
      subtotal,
      tax_amount: taxAmount,
      discount_amt: discountAmt,
      discount_type: inv.discountType,
      total,
      payment: inv.paymentMode === "split" ? "مختلط" : inv.payment,
      payment_split: inv.paymentMode === "split" ? {
        card: inv.splitPayment.card,
        transfer: inv.splitPayment.transfer,
        cash: Math.round((total - inv.splitPayment.card - inv.splitPayment.transfer) * 100) / 100,
      } : null,
      shift: currentShift?.id,
      returned: false,
      pharmacy_id: pharmacyId,
      cashier_name: currentUser?.name || "",
      points_redeemed: pointsDiscount > 0 ? pointsDiscount : null,
    };

    const { error: saleError } = await supabase.from("sales").insert(invoice);
    if (saleError) {
      showToast("فشل حفظ الفاتورة: " + saleError.message, "error");
      return;
    }

    for (const ci of inv.cart) {
      if (ci.isMissed) continue;
      const prod = products.find((x) => x.id === ci.id);
      if (prod) {
        const { updatedBatches } = newFifoResults[ci.id] || {};
        const { error: stockError } = await supabase
          .from("products")
          .update({
            stock: prod.stock - +ci.qty,
            batches: updatedBatches ?? prod.batches ?? [],
            price: updatedBatches?.[0]?.salePrice ?? prod.price,
          })
          .eq("id", ci.id);
        if (stockError) {
          showToast("خطأ في تحديث المخزون: " + stockError.message, "error");
        }
      }
    }
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = inv.cart.filter((i) => i.serial);
    if (rasdConfig.enabled && gs1Items.length > 0) {
      const rasdResult = await RasdService.sendTransaction(
        "dispense",
        gs1Items.map((i) => ({
          gtin: i.gtin || i.barcode,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.qty,
        })),
        rasdConfig.gln || PHARMACY_GLN,
        null
      );
      if (!rasdResult.success) {
        showToast("تحذير: فشل إرسال البيانات لرصد", "error");
        console.error("Rasd error:", rasdResult.error);
      }
    }

    setSales((p) => [...p, invoice]);

    // ── استبدال نقاط في الفاتورة ──
    if (usePoints && pointsToRedeem > 0 && inv.selCustomer?.id) {
      const prev = customerLoyalty || { points: 0, total_earned: 0, total_redeemed: 0 };
      await supabase.from("loyalty_points").upsert({
        pharmacy_id: pharmacyId,
        customer_id: inv.selCustomer.id,
        points: Math.max(0, (prev.points || 0) - pointsToRedeem),
        total_earned: prev.total_earned || 0,
        total_redeemed: (prev.total_redeemed || 0) + pointsToRedeem,
        updated_at: new Date().toISOString(),
      }, { onConflict: "pharmacy_id,customer_id" });

      await supabase.from("loyalty_transactions").insert({
        pharmacy_id: pharmacyId,
        customer_id: inv.selCustomer.id,
        type: "redeem",
        amount: -pointsToRedeem,
        ref_sale_id: invoice.id,
        note: `استبدال نقاط في فاتورة ${invoice.id}`,
      });

      setUsePoints(false);
      setPointsToRedeem(0);
      setCustomerLoyalty(null);
    }

    // ── كسب نقاط الولاء ──
    if (inv.selCustomer?.id) {
      const ls = loyaltySettings || await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .maybeSingle()
        .then(({ data }) => data);

      if (ls) {
        let points = 0;
        if (ls.mode === "profit") {
          const profit = invoice.items.reduce((sum, it) => {
            return sum + (it.price - (it.cost || 0)) * (it.qty || 0);
          }, 0) - (invoice.discount_amt || 0);
          points = Math.max(0, profit * (ls.profit_rate / 100));
        } else {
          points = Math.floor(invoice.subtotal / ls.sales_per) * ls.sales_rate;
        }

        if (points > 0) {
          const { data: current } = await supabase
            .from("loyalty_points")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .eq("customer_id", inv.selCustomer.id)
            .maybeSingle();

          const prev = current || { points: 0, total_earned: 0, total_redeemed: 0 };

          await supabase.from("loyalty_points").upsert({
            pharmacy_id: pharmacyId,
            customer_id: inv.selCustomer.id,
            points: (prev.points || 0) + points,
            total_earned: (prev.total_earned || 0) + points,
            total_redeemed: prev.total_redeemed || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: "pharmacy_id,customer_id" });

          await supabase.from("loyalty_transactions").insert({
            pharmacy_id: pharmacyId,
            customer_id: inv.selCustomer.id,
            type: "earn",
            amount: points,
            ref_sale_id: invoice.id,
            earned_mode: ls.mode,
            note: `نقاط مكتسبة من فاتورة ${invoice.id}`,
          });

          showToast(`🌟 ${inv.selCustomer.name} كسب ${points.toFixed(1)} ريال نقاط`);
        }
      }
    }

    setProducts((p) =>
      p.map((x) => {
        const ci = inv.cart.find((i) => i.id === x.id && !i.isMissed);
        if (!ci) return x;
        const { updatedBatches } = newFifoResults[x.id] || {};
        return {
          ...x,
          stock: x.stock - ci.qty,
          batches: updatedBatches ?? x.batches ?? [],
          price: updatedBatches?.[0]?.salePrice ?? x.price,
        };
      })
    );

    const missedItems = inv.cart.filter((i) => i.isMissed);
    if (missedItems.length > 0) {
      const missedRecords = missedItems.map((i) => ({
        id: "MS-" + Date.now() + "-" + i.id,
        date: new Date().toISOString().split("T")[0],
        product_id: i.id,
        product_name: i.nameAr || i.name,
        price: i.price,
        qty: i.qty,
        reason: i.missedReason || "غير محدد",
        notes: i.notes || "",
        shift: currentShift?.id,
        cashier: currentUser?.name,
        pharmacy_id: pharmacyId,
      }));
      await supabase.from("missed_sales").insert(missedRecords);
    }

    setInv({ ...emptyInvoice(), success: true });
    setTimeout(() => setInv((p) => ({ ...p, success: false })), 2000);
    setShowPrint(invoice);
    showToast("تمت عملية البيع ✓");
  };

  return (
    <div
      style={{
        height: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {invoices.map((inv, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 0 }}
          >
            <button
              onClick={() => setActiveTab(i)}
              style={{
                padding: "7px 16px",
                borderRadius: "9px 0 0 9px",
                background: activeTab === i ? C.infoBg : C.bg,
                border: `1px solid ${activeTab === i ? C.accent : C.border}`,
                borderLeft: "none",
                color: activeTab === i ? C.accent : C.muted,
                fontWeight: activeTab === i ? 700 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              فاتورة {i + 1} {inv.cart.length > 0 ? `(${inv.cart.length})` : ""}
            </button>
            <button
              onClick={() => closeTab(i)}
              style={{
                padding: "7px 8px",
                borderRadius: "0 9px 9px 0",
                background: activeTab === i ? C.infoBg : C.bg,
                border: `1px solid ${activeTab === i ? C.accent : C.border}`,
                color: C.dangerBorder,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {invoices.length < MAX_INVOICES && (
          <button
            onClick={addTab}
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              background: C.surface,
              border: "1px dashed #1d3a5a",
              color: C.muted,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            + فاتورة جديدة
          </button>
        )}
      </div>

      {autoSaveWarning && (
        <div
          style={{
            background: C.warningBg,
            border: "1px solid #f59e0b",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fcd34d",
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          <span>
            ⚠️ الفاتورة مفتوحة أكثر من 10 دقائق — سيتم التنبيه خلال{" "}
            {Math.floor(autoSaveCountdown / 60)}:
            {String(autoSaveCountdown % 60).padStart(2, "0")}
          </span>
          <button
            onClick={() => setAutoSaveWarning(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fcd34d",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          background: C.surface,
          border: "1px solid #1d2d4a",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* بحث */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #1d2d4a",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <BarcodeScanner
            onScan={scanBarcode}
            placeholder="امسح باركود الصنف..."
          />
          <div style={{ position: "relative" }}>
            <input
              value={inv.search}
              onChange={(e) => {
                setInv((p) => ({ ...p, search: e.target.value }));
                setHighlightedIdx(-1);
              }}
              onKeyDown={(e) => {
                const list = filtered.slice(0, 8);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIdx((prev) =>
                    Math.min(prev + 1, list.length - 1)
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIdx((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const target =
                    highlightedIdx >= 0 ? list[highlightedIdx] : list[0];
                  if (target) {
                    addToCart({ ...target, isPartial: false });
                    setInv((p) => ({ ...p, search: "" }));
                    setHighlightedIdx(-1);
                  }
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const target =
                    highlightedIdx >= 0 ? list[highlightedIdx] : list[0];
                  if (target) {
                    addToCart({ ...target, isMissed: true, qty: 1 });
                    setInv((p) => ({ ...p, search: "" }));
                    setHighlightedIdx(-1);
                  }
                } else if (e.key === "Escape") {
                  setInv((p) => ({ ...p, search: "" }));
                  setHighlightedIdx(-1);
                }
              }}
              placeholder="🔍 ابحث عن صنف بالاسم أو الباركود..."
              style={{
                width: "100%",
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: C.text,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setInv((p) => ({ ...p, showJoker: true }))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: C.warningBg,
                border: "1px solid #7a4a00",
                color: C.warning,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + جوكر
            </button>
            {inv.showJoker && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  left: 0,
                  zIndex: 200,
                  background: "#0d1829",
                  border: "1px solid #7a4a00",
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    color: C.warning,
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  ⚠ صنف جوكر (فرصة ضائعة)
                </div>
                <input
                  placeholder="اسم الصنف..."
                  value={inv.jokerName}
                  onChange={(e) =>
                    setInv((p) => ({ ...p, jokerName: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: C.bgAlt,
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: C.text,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                />
                <input
                  type="number"
                  placeholder="السعر..."
                  value={inv.jokerPrice}
                  onChange={(e) =>
                    setInv((p) => ({ ...p, jokerPrice: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: C.bgAlt,
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: C.text,
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      if (!inv.jokerName || !inv.jokerPrice) return;
                      addToCart({
                        id: "JOKER-" + Date.now(),
                        name: inv.jokerName,
                        nameAr: inv.jokerName,
                        price: +inv.jokerPrice,
                        stock: 99,
                        taxable: false,
                        isMissed: true,
                        isJoker: true,
                        qty: 1,
                        category: "جوكر",
                      });
                      setInv((p) => ({
                        ...p,
                        showJoker: false,
                        jokerName: "",
                        jokerPrice: "",
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      background: C.warningBg,
                      border: "1px solid #7a4a00",
                      borderRadius: 7,
                      color: C.warning,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    إضافة
                  </button>
                  <button
                    onClick={() => setInv((p) => ({ ...p, showJoker: false }))}
                    style={{
                      padding: "7px 14px",
                      background: "transparent",
                      border: "1px solid #1d2d4a",
                      borderRadius: 7,
                      color: C.muted,
                      cursor: "pointer",
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
            {inv.search && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  left: 0,
                  background: C.surface,
                  border: "1px solid #1d2d4a",
                  borderRadius: 8,
                  zIndex: 100,
                  maxHeight: 240,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    padding: "5px 14px",
                    fontSize: 10,
                    color: C.muted,
                    borderBottom: "1px solid #1a2a3a",
                    background: "#0a121f",
                  }}
                >
                  ↓↑ تنقل · Enter إضافة · Esc إلغاء
                </div>
                {filtered.slice(0, 8).map((p, idx) => {
                  const effectiveStock =
                    p.saleUnits > 1 ? p.stock * p.saleUnits : p.stock;
                  const outOfStock = effectiveStock <= 0;
                  const stockColor = outOfStock
                    ? "#dd4444"
                    : p.stock <= (p.minStock || 0)
                    ? C.warning
                    : C.success;
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: "7px 14px",
                        cursor: "pointer",
                        borderBottom: "1px solid #1a2a3a",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background:
                          idx === highlightedIdx ? "#1a2a4a" : "transparent",
                      }}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onMouseLeave={() => setHighlightedIdx(-1)}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: stockColor,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: C.text,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.nameAr || p.name}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {p.mainCategory || p.category} · مخزون: {p.stock}
                            {p.saleUnits > 1 && (
                              <span style={{ color: C.warning }}>
                                {" "}
                                ÷{p.saleUnits}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {outOfStock ? (
                          <button
                            onClick={() => {
                              addToCart({ ...p, isMissed: true, qty: 1 });
                              setInv((x) => ({ ...x, search: "" }));
                            }}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: C.warningBg,
                              border: "1px solid #7a4a00",
                              color: C.warning,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                            title="تسجيل كفرصة ضائعة"
                          >
                            ⚠ فائت
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                addToCart({ ...p, isPartial: false });
                                setInv((x) => ({ ...x, search: "" }));
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 6,
                                background: C.infoBg,
                                border: "1px solid #2a6aef",
                                color: C.accent,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {(() => {
                                const eff = getEffectivePrice(p, promos, discountRules, productEarliestExpiry);
                                return eff.discountPct > 0 ? (
                                  <span>
                                    <span style={{ textDecoration: "line-through", color: C.muted, fontSize: 10, marginLeft: 4 }}>{p.price?.toFixed(2)}</span>
                                    <span style={{ color: C.success }}> {eff.price?.toFixed(2)} ر.س</span>
                                    <span style={{ background: C.warning, color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 10, marginRight: 4 }}>-{eff.discountPct}%</span>
                                  </span>
                                ) : (
                                  <span>{p.price?.toFixed(2)} ر.س</span>
                                );
                              })()}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div
                    style={{
                      padding: 12,
                      color: C.muted,
                      textAlign: "center",
                    }}
                  >
                    لا يوجد نتائج
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
       {/* العميل — search بدل dropdown */}
        <div
          style={{
            padding: "6px 16px",
            borderBottom: "1px solid #1d2d4a",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={inv.customerSearch ?? (inv.selCustomer ? inv.selCustomer.name : "")}
              onChange={(e) => {
                setInv((p) => ({
                  ...p,
                  customerSearch: e.target.value,
                  selCustomer: e.target.value === "" ? null : p.selCustomer,
                  payment: e.target.value === "" && p.payment === "آجل" ? "نقدي" : p.payment,
                }));
              }}
              onFocus={() => setInv((p) => ({ ...p, customerSearchOpen: true }))}
              onBlur={() => setTimeout(() => setInv((p) => ({ ...p, customerSearchOpen: false })), 150)}
              placeholder="🔍 ابحث عن عميل بالاسم أو الجوال..."
              style={{
                width: "100%",
                background: C.bgAlt,
                border: `1px solid ${inv.selCustomer ? C.accent : C.border}`,
                borderRadius: 8,
                padding: "7px 10px",
                color: C.text,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {/* زر مسح العميل */}
            {inv.selCustomer && (
              <button
                onClick={() => {
                  setInv((p) => ({
                    ...p,
                    selCustomer: null,
                    customerSearch: "",
                    payment: p.payment === "آجل" ? "نقدي" : p.payment,
                  }));
                  setCustomerLoyalty(null);
                  setUsePoints(false);
                  setPointsToRedeem(0);
                }}
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: C.dangerBorder,
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
            {/* Dropdown النتائج */}
            {inv.customerSearchOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                left: 0,
                background: C.surface,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                zIndex: 200,
                maxHeight: 220,
                overflowY: "auto",
                marginTop: 4,
                boxShadow: "0 8px 24px #0006",
              }}>
                {/* زبون عادي دايماً أول خيار */}
                <div
                  onMouseDown={() => {
                    setInv((p) => ({
                      ...p,
                      selCustomer: null,
                      customerSearch: "",
                      payment: p.payment === "آجل" ? "نقدي" : p.payment,
                      customerSearchOpen: false,
                    }));
                    setCustomerLoyalty(null);
                    setUsePoints(false);
                    setPointsToRedeem(0);
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #1a2a3a",
                    color: C.muted,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>👤</span> زبون عادي
                </div>
                {customers
                  .filter((c) => {
                    const q = (inv.customerSearch || "").toLowerCase();
                    if (!q) return true;
                    return (
                      (c.name || "").toLowerCase().includes(q) ||
                      (c.phone || "").includes(q) ||
                      (c.taxId || "").includes(q)
                    );
                  })
                  .slice(0, 10)
                  .map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={async () => {
                        setInv((p) => ({
                          ...p,
                          selCustomer: c,
                          customerSearch: c.name,
                          customerSearchOpen: false,
                        }));
                        // جلب نقاط العميل وإعدادات الولاء
                        const [lpRes, lsRes] = await Promise.all([
                          supabase.from("loyalty_points").select("*")
                            .eq("pharmacy_id", pharmacyId)
                            .eq("customer_id", c.id).maybeSingle(),
                          supabase.from("loyalty_settings").select("*")
                            .eq("pharmacy_id", pharmacyId).maybeSingle(),
                        ]);
                        setCustomerLoyalty(lpRes.data);
                        setLoyaltySettings(lsRes.data);
                        setUsePoints(false);
                        setPointsToRedeem(0);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #1a2a3a",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          {c.name}
                        </div>
                        {(c.phone || c.taxId) && (
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {c.phone && <span>{c.phone}</span>}
                            {c.phone && c.taxId && <span> · </span>}
                            {c.taxId && <span>{c.taxId}</span>}
                          </div>
                        )}
                      </div>
                      {c.credit > 0 && (
                        <span style={{
                          fontSize: 11,
                          background: "#2a1010",
                          color: C.danger,
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontWeight: 700,
                        }}>
                          آجل: {c.credit?.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                {customers.filter((c) => {
                  const q = (inv.customerSearch || "").toLowerCase();
                  if (!q) return true;
                  return (
                    (c.name || "").toLowerCase().includes(q) ||
                    (c.phone || "").includes(q) ||
                    (c.taxId || "").includes(q)
                  );
                }).length === 0 && (
                  <div style={{ padding: 12, color: C.muted, textAlign: "center", fontSize: 13 }}>
                    لا يوجد عملاء مطابقون
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => fileRef.current.click()}
            style={{
              padding: "7px 12px",
              background: C.surface,
              border: "1px dashed #1d3a5a",
              borderRadius: 8,
              color: inv.prescriptionImg ? C.success : C.muted,
              cursor: "pointer",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {inv.prescriptionImg ? "✓ وصفة" : "📎 وصفة"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const r = new FileReader();
              r.onload = (ev) =>
                setInv((p) => ({ ...p, prescriptionImg: ev.target.result }));
              r.readAsDataURL(file);
            }}
          />
        </div>

        {/* السلة */}
        <div
          style={{
            height: CART_AREA_HEIGHT,
            minHeight: CART_AREA_HEIGHT,
            maxHeight: CART_AREA_HEIGHT,
            flexShrink: 0,
            overflowY: "auto",
            padding: "6px 16px",
          }}
        >
          {inv.cart.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#1a2a4a",
                padding: "60px 0",
                fontSize: 14,
              }}
            >
              <IC n="cart" s={50} />
              <br />
              <br />
              ابحث عن صنف أو امسح الباركود لإضافته
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1d2d4a" }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i === 0 ? "right" : "center",
                        padding: "8px 4px",
                        color: C.muted,
                        fontSize: 12,
                        fontWeight: 600,
                        position: "sticky",
                        top: 0,
                        background: C.surface,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
  {inv.cart.map((item) => {
    const step = item.saleUnits > 1 ? 1 / item.saleUnits : 1;
    const maxQty = products.find(x => x.id === item.id)?.stock || 99;
    const displayPrice = item.unitPrice ?? (fifoResults?.[item.id]?.salePrice ?? item.price);
    const displayTotal = (fifoResults?.[item.id]?.salePrice ?? item.price) * item.qty;

    return (
      <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
        <td style={{ padding: "8px 4px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.name}</div>
          {item.discountPct > 0 && (
            <div style={{ fontSize: 10, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ background: item.discountSource === "auto" ? C.warning : C.accent, color: "#fff", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>
                -{item.discountPct}% {item.discountSource === "auto" ? "⏰" : "✋"}
              </span>
              {item.originalPrice && item.originalPrice !== item.price && (
                <span style={{ textDecoration: "line-through", color: C.muted }}>{item.originalPrice?.toFixed(2)}</span>
              )}
            </div>
          )}
          <input
            value={item.dose}
            onChange={(e) => setInv((p) => ({
              ...p,
              cart: p.cart.map((i) => i.id === item.id ? { ...i, dose: e.target.value } : i),
            }))}
            placeholder="الجرعة..."
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1a2a4a", color: C.muted, fontSize: 11, outline: "none", padding: "2px 0" }}
          />
          {item.expiry && (
            <div style={{ fontSize: 10, color: C.warning, marginTop: 2 }}>ينتهي: {item.expiry}</div>
          )}
        </td>

        <td style={{ textAlign: "center", padding: "8px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <button
              onClick={() => setInv((p) => ({
                ...p,
                cart: p.cart.map((i) => {
                  if (i.id !== item.id) return i;
                  return { ...i, qty: Math.max(1, i.qty - 1) };
                }),
              }))}
              style={{ width: 22, height: 22, borderRadius: 4, background: "#1a2540", border: "none", color: C.accent, cursor: "pointer", fontWeight: 700 }}
            >-</button>

            <input
              type="text"
              inputMode="decimal"
              value={item.qtyDisplay ?? item.qty}
              onChange={(e) => {
                setInv((p) => ({
                  ...p,
                  cart: p.cart.map((i) =>
                    i.id === item.id ? { ...i, qtyDisplay: e.target.value } : i
                  ),
                }));
              }}
              onBlur={(e) => {
  const raw = e.target.value.trim();
  
  // parse الكسور زي 1/3 أو 2 1/3
  let val;
  const fracMatch = raw.match(/^(\d+)\s+(\d+)\/(\d+)$|^(\d+)\/(\d+)$|^(\d*\.?\d+)$/);
  if (!fracMatch) {
    showToast("صيغة غير صحيحة", "error");
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.id === item.id ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }
  if (fracMatch[1]) {
    // 2 1/3
    val = +fracMatch[1] + +fracMatch[2] / +fracMatch[3];
  } else if (fracMatch[4]) {
    // 1/3
    val = +fracMatch[4] / +fracMatch[5];
  } else {
    // 0.33
    val = +fracMatch[6];
  }

  if (isNaN(val) || val <= 0) {
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.id === item.id ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }

  const isValid = Math.abs(Math.round(val / step) * step - val) < 0.0001;
  if (!isValid) {
    showToast(`الكمية لازم مضاعف لـ 1/${item.saleUnits || 1}`, "error");
    setInv((p) => ({
      ...p,
      cart: p.cart.map((i) =>
        i.id === item.id ? { ...i, qtyDisplay: undefined } : i
      ),
    }));
    return;
  }

  setInv((p) => ({
    ...p,
    cart: p.cart.map((i) =>
      i.id === item.id
        ? { ...i, qty: Math.min(val, maxQty), qtyDisplay: undefined }
        : i
    ),
  }));
}}
              style={{ width: 52, background: C.divider, border: "1px solid #1d2d4a", borderRadius: 6, color: C.text, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", padding: "3px 4px" }}
            />

            <button
              onClick={() => setInv((p) => ({
                ...p,
                cart: p.cart.map((i) => {
                  if (i.id !== item.id) return i;
                  return { ...i, qty: Math.min(i.qty + 1, maxQty) };
                }),
              }))}
              style={{ width: 22, height: 22, borderRadius: 4, background: "#1a2540", border: "none", color: C.accent, cursor: "pointer", fontWeight: 700 }}
            >+</button>
          </div>
        </td>

        <td style={{ textAlign: "center", padding: "8px 4px", color: "#2a9aff", fontSize: 13 }}>
          {displayPrice.toFixed(2)}
        </td>
        <td style={{ textAlign: "center", padding: "8px 4px", color: C.text, fontSize: 13, fontWeight: 700 }}>
          {displayTotal.toFixed(2)}
        </td>
        <td style={{ textAlign: "center" }}>
          <button
            onClick={() => setInv((p) => ({ ...p, cart: p.cart.filter((i) => i.id !== item.id) }))}
            style={{ background: "transparent", border: "none", color: C.dangerBorder, cursor: "pointer" }}
          >✕</button>
        </td>
      </tr>
    );
  })}
</tbody>
            </table>
          )}
        </div>

        {/* الإجمالي والدفع */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1d2d4a",
            background: C.bgAlt,
            flexShrink: 0,
          }}
        >
          {/* ===== وسيلة الدفع ===== */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[
                { mode: "single", label: "دفعة واحدة" },
                { mode: "split", label: "⇄ تقسيم الدفع" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setInv((p) => ({ ...p, paymentMode: mode }))}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    borderRadius: 7,
                    border: "1px solid",
                    borderColor:
                      inv.paymentMode === mode ? C.accent : C.border,
                    background:
                      inv.paymentMode === mode ? C.infoBg : "transparent",
                    color:
                      inv.paymentMode === mode ? C.accent : C.muted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {inv.paymentMode === "single" && (
              <div style={{ display: "flex", gap: 6 }}>
                {["نقدي", "بطاقة", "تحويل", "آجل"].map((m) => {
                  const isAjilLocked = m === "آجل" && !inv.selCustomer;
                  return (
                    <button
                      key={m}
                      disabled={isAjilLocked}
                      title={
                        isAjilLocked
                          ? "اختر عميلاً أولاً لتفعيل البيع الآجل"
                          : undefined
                      }
                      onClick={() => {
                        if (isAjilLocked) {
                          showToast(
                            "لا يمكن تسجيل بيع آجل لزبون عادي — اختر عميلاً أولاً",
                            "error"
                          );
                          return;
                        }
                        setInv((p) => ({ ...p, payment: m }));
                      }}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 7,
                        border: "1px solid",
                        borderColor:
                          inv.payment === m ? C.accent : C.border,
                        background:
                          inv.payment === m ? C.infoBg : "transparent",
                        color: isAjilLocked
                          ? "#2a3a4a"
                          : inv.payment === m
                          ? C.accent
                          : C.muted,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isAjilLocked ? "not-allowed" : "pointer",
                        opacity: isAjilLocked ? 0.5 : 1,
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {inv.paymentMode === "split" && (() => {
              const card = inv.splitPayment.card || 0;
              const transfer = inv.splitPayment.transfer || 0;
              const cash = Math.round((total - card - transfer) * 100) / 100;
              const isOverpaid = cash < 0;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.accent, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      بطاقة
                    </span>
                    <input
                      type="number" min="0" step="0.01" value={card || ""} placeholder="0.00"
                      onChange={(e) =>
                        setInv((p) => ({
                          ...p,
                          splitPayment: { ...p.splitPayment, card: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      style={{ flex: 1, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 7, padding: "5px 10px", color: C.text, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: C.muted, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#aa88ff", fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      تحويل
                    </span>
                    <input
                      type="number" min="0" step="0.01" value={transfer || ""} placeholder="0.00"
                      onChange={(e) =>
                        setInv((p) => ({
                          ...p,
                          splitPayment: { ...p.splitPayment, transfer: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      style={{ flex: 1, background: C.bgAlt, border: "1px solid #1d2d4a", borderRadius: 7, padding: "5px 10px", color: C.text, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: C.muted, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.success, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      نقدي
                    </span>
                    <div style={{ flex: 1, background: "#0a1a10", border: `1px solid ${isOverpaid ? "#6a2a2a" : "#2a6a2a"}`, borderRadius: 7, padding: "5px 10px", color: isOverpaid ? "#dd4444" : C.success, fontSize: 13, fontWeight: 700 }}>
                      {isOverpaid ? "⚠ تجاوز الإجمالي" : `${cash.toFixed(2)}`}
                    </div>
                    <span style={{ color: C.muted, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderRadius: 6, background: isOverpaid ? C.dangerBg : "#0a1a10", border: `1px solid ${isOverpaid ? "#6a2a2a" : "#2a6a2a"}`, marginTop: 2 }}>
                    <span style={{ color: isOverpaid ? "#dd4444" : C.success, fontSize: 12, fontWeight: 700 }}>
                      {isOverpaid ? `⚠ زيادة ${Math.abs(cash).toFixed(2)} ر.س` : "✓ الحساب مظبوط"}
                    </span>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      نقدي {cash <= 0 ? "0.00" : cash.toFixed(2)} + بطاقة {card.toFixed(2)} + تحويل {transfer.toFixed(2)} = {total.toFixed(2)} ر.س
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ===== نقاط الولاء ===== */}
          {inv.selCustomer && customerLoyalty?.points >= (loyaltySettings?.min_redeem || 10) && (
            <div style={{
              background: C.successBg,
              border: "1px solid #1a5a30",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ color: C.success, fontSize: 12, fontWeight: 700 }}>
                  🌟 نقاط متاحة: {customerLoyalty.points.toFixed(2)} ر.س
                </div>
                {usePoints && (
                  <div style={{ color: C.success, fontSize: 11, marginTop: 3 }}>
                    سيتم خصم {pointsToRedeem.toFixed(2)} ر.س من الفاتورة
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const newUse = !usePoints;
                  setUsePoints(newUse);
                  setPointsToRedeem(newUse
                    ? Math.min(customerLoyalty.points, subtotal + taxAmount - discountAmt)
                    : 0
                  );
                }}
                style={{
                  padding: "5px 14px",
                  borderRadius: 7,
                  border: "1px solid #1a5a30",
                  background: usePoints ? C.success : "transparent",
                  color: usePoints ? "#000" : C.success,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {usePoints ? "✓ مفعّل" : "استخدام النقاط"}
              </button>
            </div>
          )}

          {/* ===== الخصم ===== */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: 7,
                overflow: "hidden",
                border: "1px solid #1d2d4a",
              }}
            >
              {[
                { type: "percent", label: "%" },
                { type: "value", label: "ر.س" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() =>
                    setInv((p) => ({ ...p, discountType: type, discount: 0 }))
                  }
                  style={{
                    padding: "5px 10px",
                    background:
                      inv.discountType === type ? C.infoBg : "transparent",
                    color:
                      inv.discountType === type ? C.accent : C.muted,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label style={{ color: C.muted, fontSize: 12 }}>خصم</label>
            <input
              type="number"
              min="0"
              max={inv.discountType === "percent" ? 100 : undefined}
              value={inv.discount || ""}
              placeholder="0"
              onChange={(e) =>
                setInv((p) => ({ ...p, discount: +e.target.value }))
              }
              style={{
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 7,
                padding: "6px 10px",
                color: C.text,
                fontSize: 13,
                outline: "none",
                width: 80,
              }}
            />
            {inv.cart.length > 0 && (
              <button
                onClick={() => setInv((p) => ({ ...p, cart: [] }))}
                style={{
                  marginRight: "auto",
                  background: "transparent",
                  border: "none",
                  color: C.dangerBorder,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                🗑 مسح الكل
              </button>
            )}
          </div>

          {/* ===== الأرقام ===== */}
          <div
            style={{
              background: C.divider,
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 12, marginBottom: 4 }}>
              <span>قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: C.success, fontSize: 12, marginBottom: 4 }}>
              <span>ضريبة 15%</span>
              <span>{taxAmount.toFixed(2)} ر.س</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning, fontSize: 12, marginBottom: 4 }}>
                <span>خصم {inv.discountType === "percent" ? `${inv.discount}%` : `${inv.discount} ر.س`}</span>
                <span>- {discountAmt.toFixed(2)} ر.س</span>
              </div>
            )}
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.success, fontSize: 12, marginBottom: 4 }}>
                <span>🌟 نقاط ولاء</span>
                <span>- {pointsToRedeem.toFixed(2)} ر.س</span>
              </div>
            )}
            {missedTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: C.warning, fontSize: 12, marginBottom: 4 }}>
                <span>⚠ فرص ضائعة</span>
                <span>{missedTotal.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: C.text, fontSize: 18, fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 8, marginTop: 4 }}>
              <span>الإجمالي</span>
              <span>{total.toFixed(2)} ر.س</span>
            </div>
          </div>

          <Btn
            size="lg"
            onClick={completeSale}
            style={{ width: "100%", justifyContent: "center" }}
            variant={inv.success ? "success" : "primary"}
            icon={inv.success ? "check" : "money"}
          >
            {inv.success ? "تمت العملية!" : "إتمام البيع"}
          </Btn>
        </div>
      </div>

      {showPrint && (
        <PrintReceipt invoice={showPrint} onClose={() => setShowPrint(null)} />
      )}
    </div>
  );
} 
// ==================== PRINT RECEIPT ====================
