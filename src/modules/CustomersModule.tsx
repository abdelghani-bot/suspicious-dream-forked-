export function CustomersModule({
  const { C } = useTheme();
  customers,
  setCustomers,
  showToast,
  sales = [],
  setSales,
  creditPayments,
  setCreditPayments,
  currentUser,
  pharmacyId,
}) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");
  const [filterVip, setFilterVip] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedCard, setExpandedCard] = useState(null);
  const [creditInvoices, setCreditInvoices] = useState([]);
  const [showCredit, setShowCredit] = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const blank = {
    id: "",
    name: "",
    phone: "",
    taxId: "",
    totalSpent: 0,
    visits: 0,
    lastVisit: "-",
    category: "individual",
    children_count: "",
    children_ages: [],
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const openCreditModal = async (customer) => {
    setSelectedCreditCustomer(customer);

    // جلب كل فواتير الآجل بتاعة العميل
    const { data: ajilSales } = await supabase
      .from("sales")
      .select("*")
      .eq("customer", customer.id)
      .eq("payment", "آجل");

    // جلب المدفوع منها
    const { data: paid } = await supabase
      .from("credit_payments")
      .select("*")
      .eq("customer_id", customer.id);

    // حساب الباقي لكل فاتورة
    const invoicesWithBalance = ajilSales
      ?.map((inv) => {
        const totalPaid =
          paid
            ?.filter((p) => p.invoice_id === inv.id)
            .reduce((s, p) => s + p.amount, 0) || 0;
        return {
          ...inv,
          totalPaid,
          remaining: inv.total - totalPaid,
        };
      })
      .filter((inv) => inv.remaining > 0); // الفواتير المفتوحة بس

    setCreditInvoices(invoicesWithBalance || []);
    setShowCredit(true);
  };

  const payCreditInvoice = async () => {
    if (!selectedInvoice || !payAmount) return;

    const amount = parseFloat(payAmount);
    if (amount <= 0 || amount > selectedInvoice.remaining) {
      showToast("المبلغ غير صحيح", "error");
      return;
    }

    const { error } = await supabase.from("credit_payments").insert({
      invoice_id: selectedInvoice.id,
      customer_id: selectedCreditCustomer.id,
      amount,
      date: new Date().toISOString().split("T")[0],
      notes: "سداد جزئي/كامل",
      created_by: currentUser?.name || "",
      pharmacy_id: pharmacyId,
    });

    if (error) {
      showToast("خطأ في السداد: " + error.message, "error");
      return;
    }
    // إضافة السداد في مبيعات اليوم
    const paymentRecord = {
      id: "PAY-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      customer: selectedCreditCustomer.id,
      payment: "تحصيل آجل",
      total: amount,
      subtotal: amount,
      tax_amount: 0,
      discount_amt: 0,
      items: [],
      notes: `تحصيل فاتورة ${selectedInvoice.id}`,
      returned: false,
      pharmacy_id: pharmacyId,
    };

    await supabase.from("sales").insert(paymentRecord);
    setSales((p) => [...p, paymentRecord]);
    setCreditPayments((p) => [...p, {
  invoice_id: selectedInvoice.id,
  customer_id: selectedCreditCustomer.id,
  amount,
  date: new Date().toISOString().split("T")[0],
  notes: "سداد جزئي/كامل",
}]);
    // تحديث الفواتير
    setCreditInvoices((p) =>
      p
        .map((inv) =>
          inv.id === selectedInvoice.id
            ? {
                ...inv,
                totalPaid: inv.totalPaid + amount,
                remaining: inv.remaining - amount,
              }
            : inv
        )
        .filter((inv) => inv.remaining > 0)
    );

    setPayAmount("");
    setSelectedInvoice(null);
    showToast("تم تسجيل السداد ✓");
  };

  // ===== حساب إحصائيات العميل من المبيعات الفعلية =====
  const now = new Date();
  const thisMonthKey = now.toISOString().slice(0, 7);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const computeStats = (customerId) => {
    const cSales = sales.filter((s) => s.customer === customerId);
    if (cSales.length === 0) return null;

    const sorted = [...cSales].sort(
      (a, b) =>
        new Date(b.created_at || b.date) - new Date(a.created_at || a.date)
    );
    const lastSale = sorted[0];
    const lastVisitDate = new Date(lastSale.created_at || lastSale.date);
    const daysSinceLast = Math.floor(
      (now - lastVisitDate) / (1000 * 60 * 60 * 24)
    );

    const totalVisits = cSales.length;
    const monthlyVisits = cSales.filter((s) =>
      s.created_at?.startsWith(thisMonthKey)
    ).length;
    const totalSpent = cSales.reduce((s, sale) => s + (sale.subtotal || 0), 0);
    const monthlySpent = cSales
      .filter((s) => s.created_at?.startsWith(thisMonthKey))
      .reduce((s, sale) => s + (sale.subtotal || 0), 0);
    const avgInvoice = totalVisits > 0 ? totalSpent / totalVisits : 0;

    // RFM — آخر 3 شهور
    const recent = cSales.filter(
      (s) => new Date(s.created_at || s.date) >= threeMonthsAgo
    );
    const freq3 = recent.length;
    const monetary3 = recent.reduce((s, sale) => s + (sale.subtotal || 0), 0);

    const rScore =
      daysSinceLast <= 14
        ? 40
        : daysSinceLast <= 30
        ? 30
        : daysSinceLast <= 90
        ? 15
        : 0;
    const fScore = freq3 > 10 ? 30 : freq3 >= 5 ? 20 : freq3 >= 2 ? 10 : 0;
    const mScore =
      monetary3 > 1000 ? 30 : monetary3 >= 500 ? 20 : monetary3 >= 200 ? 10 : 0;
    const rfmScore = rScore + fScore + mScore;

    const vipLevel =
      rfmScore >= 80
        ? "vip"
        : rfmScore >= 55
        ? "excellent"
        : rfmScore >= 30
        ? "good"
        : "weak";

    const status =
      totalVisits === 1 && daysSinceLast <= 30
        ? "new"
        : daysSinceLast <= 30
        ? "regular"
        : daysSinceLast <= 90
        ? "at_risk"
        : "inactive";

    const lastItems = lastSale?.items
      ? typeof lastSale.items === "string"
        ? JSON.parse(lastSale.items)
        : lastSale.items
      : [];

    return {
      totalVisits,
      monthlyVisits,
      totalSpent,
      monthlySpent,
      avgInvoice,
      lastVisitDate,
      daysSinceLast,
      rfmScore,
      vipLevel,
      status,
      lastItems,
    };
  };

  const enriched = customers.map((c) => ({ ...c, stats: computeStats(c.id) }));

  // ===== واتساب =====
  const openWhatsApp = (phone, message = "") => {
    const clean = phone.replace(/[^0-9]/g, "");
    const wa = clean.startsWith("0") ? "966" + clean.slice(1) : clean;
    window.open(
      `https://wa.me/${wa}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const sendBulk = (list, message) => {
    list.forEach((c, i) =>
      setTimeout(() => openWhatsApp(c.phone, message), i * 600)
    );
  };

  // ===== تصنيف VIP =====
  const vipConfig = {
    vip: { label: "👑 VIP", color: "#ffd700", bg: "#2a2000" },
    excellent: { label: "⭐ ممتاز", color: C.accent, bg: C.surface },
    good: { label: "✅ جيد", color: C.success, bg: "#0a2a1a" },
    weak: { label: "🔴 ضعيف", color: C.danger, bg: C.dangerBg },
  };

  const statusConfig = {
    new: { label: "🆕 جديد", color: C.success },
    regular: { label: "✅ منتظم", color: C.accent },
    at_risk: { label: "⚠️ في خطر", color: C.warning },
    inactive: { label: "💤 مختفي", color: C.danger },
  };

  // ===== فلترة =====
  const filtered = enriched.filter((c) => {
    const s = c.stats;
    return (
      ((c.name||"").includes(search) || (c.phone||"").includes(search)) &&
      (filterVip === "all" || s?.vipLevel === filterVip) &&
      (filterStatus === "all" || s?.status === filterStatus)
    );
  });

  // ===== عملاء اليوم =====
  const todayKey = now.toISOString().slice(0, 10);
  const todayIds = [
    ...new Set(
      sales
        .filter((s) => s.created_at?.startsWith(todayKey))
        .map((s) => s.customer)
        .filter(Boolean)
    ),
  ];
  const todayCustomers = enriched.filter((c) => todayIds.includes(c.id));

  // ===== المختفون =====
  const inactiveCustomers = enriched.filter(
    (c) => c.stats?.status === "inactive"
  );

  // ===== إحصائيات عامة =====
  const totalCustomers = customers.length;
  const newCount = enriched.filter((c) => c.stats?.status === "new").length;
  const vipCount = enriched.filter((c) => c.stats?.vipLevel === "vip").length;
  const inactiveCount = inactiveCustomers.length;

  // ===== رسم بياني بسيط =====
  const BarChart = ({ title, data }) => {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
      <div
        style={{
          background: C.surface,
          border: "1px solid #1d2d4a",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: C.text,
            fontSize: 14,
            marginBottom: 14,
          }}
        >
          {title}
        </div>
        {data.map((d) => (
          <div key={d.label} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ color: "#7a9aaa", fontSize: 12 }}>{d.label}</span>
              <span style={{ color: d.color, fontWeight: 700, fontSize: 13 }}>
                {d.count}
              </span>
            </div>
            <div style={{ background: C.bgAlt, borderRadius: 4, height: 8 }}>
              <div
                style={{
                  background: d.color,
                  height: "100%",
                  borderRadius: 4,
                  width: `${(d.count / max) * 100}%`,
                  transition: "width 0.5s",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ===== كارت العميل =====
  const CustomerCard = ({ c }) => {
    const s = c.stats;
    const vip = s ? vipConfig[s.vipLevel] : null;
    const statusC = s ? statusConfig[s.status] : null;
    const isExpanded = expandedCard === c.id;

    return (
      <div
        style={{
          background: C.surface,
          border: `1px solid ${vip ? vip.color + "33" : C.border}`,
          borderRadius: 14,
          padding: 18,
        }}
      >
        {/* رأس الكارت */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#1a2a5a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              {c.category === "individual"
                ? "👤"
                : c.category === "family_no_kids"
                ? "👫"
                : "👨‍👩‍👧"}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
                {c.name}
              </div>
              <div style={{ color: C.muted, fontSize: 11 }}>
                {c.id} • {c.phone}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "flex-end",
            }}
          >
            {vip && (
              <span
                style={{
                  background: vip.bg,
                  color: vip.color,
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {vip.label}
              </span>
            )}
            {statusC && (
              <span
                style={{
                  background: C.bgAlt,
                  color: statusC.color,
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                {statusC.label}
              </span>
            )}
          </div>
        </div>

        {/* الإحصائيات */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            marginBottom: 10,
          }}
        >
          {[
            {
              label: "إجمالي الزيارات",
              value: s?.totalVisits || 0,
              color: C.accent,
            },
            {
              label: "زيارات الشهر",
              value: s?.monthlyVisits || 0,
              color: C.success,
            },
            {
              label: "متوسط الفاتورة",
              value: s ? s.avgInvoice.toFixed(0) + " ر.س" : "-",
              color: "#a78bfa",
            },
            {
              label: "إجمالي المشتريات",
              value: s ? s.totalSpent.toFixed(0) + " ر.س" : "-",
              color: "#ffd700",
            },
            {
              label: "مشتريات الشهر",
              value: s ? s.monthlySpent.toFixed(0) + " ر.س" : "-",
              color: C.warning,
            },
            {
              label: "آخر زيارة",
              value: s ? `${s.daysSinceLast} يوم` : "لم يزر",
              color: "#7a9aaa",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: C.bgAlt,
                borderRadius: 8,
                padding: "7px 8px",
              }}
            >
              <div style={{ color: C.muted, fontSize: 9 }}>{item.label}</div>
              <div
                style={{
                  color: item.color,
                  fontWeight: 700,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* شريط RFM */}
        {s && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 3,
              }}
            >
              <span style={{ color: C.muted, fontSize: 10 }}>نقاط RFM</span>
              <span
                style={{ color: vip?.color, fontSize: 11, fontWeight: 700 }}
              >
                {s.rfmScore}/100
              </span>
            </div>
            <div style={{ background: C.bgAlt, borderRadius: 4, height: 5 }}>
              <div
                style={{
                  background: vip?.color || C.muted,
                  height: "100%",
                  borderRadius: 4,
                  width: `${s.rfmScore}%`,
                  transition: "width 0.5s",
                }}
              />
            </div>
          </div>
        )}

        {/* آخر مشتريات */}
        {s?.lastItems?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setExpandedCard(isExpanded ? null : c.id)}
              style={{
                background: "transparent",
                border: "none",
                color: C.muted,
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {isExpanded
                ? "▲ إخفاء"
                : `▼ آخر مشتريات (${s.lastItems.length} صنف)`}
            </button>
            {isExpanded && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {s.lastItems.map((item, i) => (
                  <span
                    key={i}
                    style={{
                      background: C.bgAlt,
                      color: "#5a9adf",
                      padding: "3px 8px",
                      borderRadius: 6,
                      fontSize: 10,
                    }}
                  >
                    {item.name} × {item.qty}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* أزرار */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() =>
              openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 نتمنى أن تكونوا بخير`)
            }
            style={{
              background: "#0a2a0a",
              border: "1px solid #1a4a1a",
              borderRadius: 8,
              padding: "6px 12px",
              color: C.success,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            📱 واتساب
          </button>
          <button
            onClick={() => openEdit(c)}
            style={{
              background: C.surface,
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "6px 12px",
              color: C.accent,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✏️ تعديل
          </button>
          <button
            onClick={async () => {
              const { error } = await supabase
                .from("customers")
                .delete()
                .eq("id", c.id);
              if (error) {
                showToast("خطأ في الحذف", "error");
                return;
              }
              setCustomers((p) => p.filter((x) => x.id !== c.id));
              showToast("تم حذف العميل");
            }}
            style={{
              background: C.dangerBg,
              border: "1px solid #3a1010",
              borderRadius: 8,
              padding: "6px 12px",
              color: C.danger,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            🗑️ حذف
          </button>
        </div>
      </div>
    );
  };

  // ===== حفظ / تعديل =====
  const openAdd = () => {
    setEditing(null);
    setForm({
      ...blank,
      id: "C" + Date.now(),
    });
    setShowForm(true);
  };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({ ...blank, ...c });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.phone) {
      showToast("يرجى ملء بيانات العميل", "error");
      return;
    }
    const saved = {
      ...form,
      totalSpent: form.totalSpent || 0,
      visits: form.visits || 0,
      lastVisit: form.lastVisit || "-",
      children_count:
        form.category === "family_with_kids" ? form.children_count : null,
      children_ages:
        form.category === "family_with_kids" ? form.children_ages : [],
    };
    if (editing) {
      const { error } = await supabase
        .from("customers")
        .update(saved)
        .eq("id", editing);
      if (error) {
        showToast("خطأ في التعديل: " + error.message, "error");
        return;
      }
      setCustomers((p) => p.map((x) => (x.id === editing ? saved : x)));
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert(saved)
        .select();
      if (error) {
        showToast("خطأ في الحفظ: " + error.message, "error");
        return;
      }
      setCustomers((p) => [...p, data ? data[0] : saved]);
    }
    setShowForm(false);
    showToast(editing ? "تم تعديل العميل ✓" : "تمت إضافة العميل ✓");
  };

  const toggleAge = (age) => {
    const current = form.children_ages || [];
    F(
      "children_ages",
      current.includes(age)
        ? current.filter((a) => a !== age)
        : [...current, age]
    );
  };

  const tabBtn = (tab) => ({
    background: activeTab === tab ? "#1a3a6a" : "transparent",
    border: `1px solid ${activeTab === tab ? "#3a6aaa" : C.border}`,
    borderRadius: 8,
    padding: "8px 16px",
    color: activeTab === tab ? C.accent : C.muted,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: activeTab === tab ? 700 : 400,
  });

  return (
    <div>
      {/* رأس الصفحة */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          إدارة العملاء
        </h2>
        <Btn icon="plus" onClick={openAdd}>
          إضافة عميل
        </Btn>
      </div>

      {/* بطاقات الإحصائيات */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "إجمالي العملاء",
            value: totalCustomers,
            color: C.accent,
            icon: "👥",
          },
          {
            label: "جديد هذا الشهر",
            value: newCount,
            color: C.success,
            icon: "🆕",
          },
          { label: "عملاء VIP", value: vipCount, color: "#ffd700", icon: "👑" },
          {
            label: "مختفون",
            value: inactiveCount,
            color: C.danger,
            icon: "💤",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: C.surface,
              border: "1px solid #1d2d4a",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ color: item.color, fontWeight: 800, fontSize: 22 }}>
              {item.value}
            </div>
            <div style={{ color: C.muted, fontSize: 11 }}>{item.label}</div>
          </div>
        ))}
        {/* كارت مديونية العملاء */}
        <div
          onClick={() => setActiveTab("credit")}
          style={{
            background: C.surface,
            border: "1px solid #3a1010",
            borderRadius: 12,
            padding: "14px 16px",
            cursor: "pointer",
            gridColumn: "span 4",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
          <div style={{ color: C.danger, fontWeight: 800, fontSize: 18 }}>
            مديونية العملاء
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            اضغط لعرض التفاصيل
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <button style={tabBtn("cards")} onClick={() => setActiveTab("cards")}>
          📋 كل العملاء
        </button>
        <button style={tabBtn("today")} onClick={() => setActiveTab("today")}>
          📅 عملاء اليوم{" "}
          {todayCustomers.length > 0 && `(${todayCustomers.length})`}
        </button>
        <button
          style={tabBtn("inactive")}
          onClick={() => setActiveTab("inactive")}
        >
          💤 المختفون {inactiveCount > 0 && `(${inactiveCount})`}
        </button>
        <button style={tabBtn("charts")} onClick={() => setActiveTab("charts")}>
          📊 الرسوم البيانية
        </button>
        <button style={tabBtn("credit")} onClick={() => setActiveTab("credit")}>
          💳 المديونيات
        </button>
      </div>

      {/* ===== تبويب: كل العملاء ===== */}
      {activeTab === "cards" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 بحث بالاسم أو الهاتف..."
              style={{
                flex: 1,
                minWidth: 200,
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: C.text,
                fontSize: 14,
                outline: "none",
              }}
            />
            <select
              value={filterVip}
              onChange={(e) => setFilterVip(e.target.value)}
              style={{
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: C.text,
                fontSize: 13,
              }}
            >
              <option value="all">كل التصنيفات</option>
              <option value="vip">👑 VIP</option>
              <option value="excellent">⭐ ممتاز</option>
              <option value="good">✅ جيد</option>
              <option value="weak">🔴 ضعيف</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: C.text,
                fontSize: 13,
              }}
            >
              <option value="all">كل الحالات</option>
              <option value="new">🆕 جديد</option>
              <option value="regular">✅ منتظم</option>
              <option value="at_risk">⚠️ في خطر</option>
              <option value="inactive">💤 مختفي</option>
            </select>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((c) => (
              <CustomerCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {/* ===== تبويب: عملاء اليوم ===== */}
      {activeTab === "today" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, color: C.text, fontSize: 15 }}>
              عملاء اليوم ({todayCustomers.length})
            </h3>
            {todayCustomers.length > 0 && (
              <button
                onClick={() =>
                  sendBulk(
                    todayCustomers,
                    "مرحباً! شكراً لزيارتكم اليوم 😊 نتمنى أن تكونوا بخير"
                  )
                }
                style={{
                  background: "#0a2a0a",
                  border: "1px solid #1a4a1a",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: C.success,
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📣 تواصل جماعي
              </button>
            )}
          </div>
          {todayCustomers.length === 0 ? (
            <div style={{ color: C.muted, textAlign: "center", padding: 40 }}>
              لا يوجد عملاء اليوم
            </div>
          ) : (
            todayCustomers.map((c) => {
              const vip = c.stats ? vipConfig[c.stats.vipLevel] : null;
              return (
                <div
                  key={c.id}
                  style={{
                    background: C.surface,
                    border: "1px solid #1d2d4a",
                    borderRadius: 12,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontSize: 20 }}>
                      {c.category === "individual" ? "👤" : "👨‍👩‍👧"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: C.text }}>
                        {c.name}
                      </div>
                      <div style={{ color: C.muted, fontSize: 11 }}>
                        {c.phone}
                      </div>
                    </div>
                    {vip && (
                      <span
                        style={{
                          background: vip.bg,
                          color: vip.color,
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      >
                        {vip.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      openWhatsApp(
                        c.phone,
                        `مرحباً ${c.name}! شكراً لزيارتكم اليوم 😊`
                      )
                    }
                    style={{
                      background: "#0a2a0a",
                      border: "1px solid #1a4a1a",
                      borderRadius: 8,
                      padding: "6px 14px",
                      color: C.success,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    📱 واتساب
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== تبويب: المختفون ===== */}
      {activeTab === "inactive" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, color: C.text, fontSize: 15 }}>
              العملاء المختفون ({inactiveCustomers.length})
            </h3>
            {inactiveCustomers.length > 0 && (
              <button
                onClick={() =>
                  sendBulk(
                    inactiveCustomers,
                    "مرحباً! نفتقدكم في صيدليتنا 💊 لدينا عروض خاصة تنتظركم 🎁"
                  )
                }
                style={{
                  background: C.dangerBg,
                  border: "1px solid #3a1010",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: "#ff6644",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                📣 حملة استرداد جماعي
              </button>
            )}
          </div>
          {inactiveCustomers.map((c) => {
            const s = c.stats;
            return (
              <div
                key={c.id}
                style={{
                  background: C.surface,
                  border: "1px solid #2a1010",
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: C.text }}>
                    {c.name}
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                    غائب منذ{" "}
                    <span style={{ color: C.danger }}>
                      {s?.daysSinceLast} يوم
                    </span>{" "}
                    • إجمالي مشتريات:{" "}
                    <span style={{ color: "#ffd700" }}>
                      {s?.totalSpent.toFixed(0)} ر.س
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      marginTop: 5,
                      flexWrap: "wrap",
                    }}
                  >
                    {s?.lastItems?.slice(0, 3).map((item, i) => (
                      <span
                        key={i}
                        style={{
                          background: C.bgAlt,
                          color: "#5a7a9a",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                        }}
                      >
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() =>
                    openWhatsApp(
                      c.phone,
                      `مرحباً ${c.name}! نفتقدكم 💊 لدينا عروض خاصة تنتظركم`
                    )
                  }
                  style={{
                    background: "#0a2a0a",
                    border: "1px solid #1a4a1a",
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: C.success,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  📱 استرداد
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== تبويب: الرسوم البيانية ===== */}
      {activeTab === "charts" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <BarChart
            title="📊 توزيع نوع العملاء"
            data={[
              {
                label: "👤 فرد",
                count: customers.filter((c) => c.category === "individual")
                  .length,
                color: "#a78bfa",
              },
              {
                label: "👫 أسرة بدون أطفال",
                count: customers.filter((c) => c.category === "family_no_kids")
                  .length,
                color: C.accent,
              },
              {
                label: "👨‍👩‍👧 أسرة مع أطفال",
                count: customers.filter(
                  (c) => c.category === "family_with_kids"
                ).length,
                color: C.success,
              },
            ]}
          />
          <BarChart
            title="📊 حالة العملاء"
            data={[
              {
                label: "🆕 جديد",
                count: enriched.filter((c) => c.stats?.status === "new").length,
                color: C.success,
              },
              {
                label: "✅ منتظم",
                count: enriched.filter((c) => c.stats?.status === "regular")
                  .length,
                color: C.accent,
              },
              {
                label: "⚠️ في خطر",
                count: enriched.filter((c) => c.stats?.status === "at_risk")
                  .length,
                color: C.warning,
              },
              {
                label: "💤 مختفي",
                count: enriched.filter((c) => c.stats?.status === "inactive")
                  .length,
                color: C.danger,
              },
            ]}
          />
          <BarChart
            title="👑 تصنيف VIP"
            data={[
              {
                label: "👑 VIP",
                count: enriched.filter((c) => c.stats?.vipLevel === "vip")
                  .length,
                color: "#ffd700",
              },
              {
                label: "⭐ ممتاز",
                count: enriched.filter((c) => c.stats?.vipLevel === "excellent")
                  .length,
                color: C.accent,
              },
              {
                label: "✅ جيد",
                count: enriched.filter((c) => c.stats?.vipLevel === "good")
                  .length,
                color: C.success,
              },
              {
                label: "🔴 ضعيف",
                count: enriched.filter((c) => c.stats?.vipLevel === "weak")
                  .length,
                color: C.danger,
              },
            ]}
          />
        </div>
      )}
      {activeTab === "credit" && (
        <CreditTab customers={enriched} onPay={openCreditModal} />
      )}
      <Modal
        open={showCredit}
        onClose={() => {
          setShowCredit(false);
          setSelectedInvoice(null);
          setPayAmount("");
        }}
        title={`مديونية - ${selectedCreditCustomer?.name}`}
        wide
      >
        {creditInvoices.length === 0 ? (
          <div style={{ color: C.success, textAlign: "center", padding: 20 }}>
            ✅ لا توجد مديونيات
          </div>
        ) : (
          <>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: 16,
              }}
            >
              <thead>
                <tr style={{ background: C.bgAlt }}>
                  {[
                    "رقم الفاتورة",
                    "التاريخ",
                    "الإجمالي",
                    "المدفوع",
                    "المتبقي",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        color: C.muted,
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    style={{
                      borderBottom: "1px solid #0a101a",
                      cursor: "pointer",
                      background:
                        selectedInvoice?.id === inv.id
                          ? C.surface
                          : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: C.accent,
                        fontWeight: 700,
                      }}
                    >
                      {inv.id}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#7a9aaa" }}>
                      {inv.date}
                    </td>
                    <td style={{ padding: "8px 12px", color: C.text }}>
                      {inv.total.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", color: C.success }}>
                      {inv.totalPaid.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: C.danger,
                        fontWeight: 700,
                      }}
                    >
                      {inv.remaining.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: C.muted, fontSize: 11 }}>
                        اختر
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedInvoice && (
              <div
                style={{ background: C.bgAlt, borderRadius: 10, padding: 14 }}
              >
                <div
                  style={{ color: C.text, marginBottom: 10, fontSize: 13 }}
                >
                  سداد فاتورة{" "}
                  <span style={{ color: C.accent }}>{selectedInvoice.id}</span>{" "}
                  • المتبقي:{" "}
                  <span style={{ color: C.danger }}>
                    {selectedInvoice.remaining.toFixed(2)} ر.س
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="المبلغ المدفوع..."
                    max={selectedInvoice.remaining}
                    style={{
                      flex: 1,
                      background: C.surface,
                      border: "1px solid #1d2d4a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: C.text,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() =>
                      setPayAmount(String(selectedInvoice.remaining))
                    }
                    style={{
                      background: C.surface,
                      border: "1px solid #1d3a6a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: C.accent,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    سداد كامل
                  </button>
                  <Btn icon="check" onClick={payCreditInvoice}>
                    تأكيد
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
      {/* مودال الإضافة/التعديل */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "تعديل العميل" : "إضافة عميل جديد"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="اسم العميل *"
            value={form.name}
            onChange={(v) => F("name", v)}
            placeholder="الاسم الكامل"
          />
          <Input
            label="رقم الهاتف *"
            value={form.phone}
            onChange={(v) => F("phone", v)}
            placeholder="05XXXXXXXX"
          />
          <Input
            label="الرقم الضريبي (اختياري)"
            value={form.taxId}
            onChange={(v) => F("taxId", v)}
            placeholder="اختياري"
          />
          <div>
            <div style={{ color: "#7a9aaa", fontSize: 12, marginBottom: 8 }}>
              نوع العميل *
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { val: "individual", label: "👤 فرد" },
                { val: "family_no_kids", label: "👫 أسرة بدون أطفال" },
                { val: "family_with_kids", label: "👨‍👩‍👧 أسرة مع أطفال" },
              ].map((opt) => (
                <div
                  key={opt.val}
                  onClick={() => F("category", opt.val)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: `2px solid ${
                      form.category === opt.val ? C.accent : C.border
                    }`,
                    background:
                      form.category === opt.val ? C.surface : C.bgAlt,
                    color: form.category === opt.val ? C.accent : "#5a7a9a",
                    fontSize: 12,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
          {form.category === "family_with_kids" && (
            <>
              <Input
                label="عدد الأطفال *"
                value={form.children_count}
                onChange={(v) => F("children_count", v)}
                placeholder="مثال: 2"
                type="number"
              />
              <div>
                <div
                  style={{ color: "#7a9aaa", fontSize: 12, marginBottom: 8 }}
                >
                  الفئات العمرية
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    "أقل من سنة",
                    "1-3 سنوات",
                    "4-6 سنوات",
                    "7-12 سنة",
                    "13-17 سنة",
                  ].map((age) => {
                    const selected = (form.children_ages || []).includes(age);
                    return (
                      <div
                        key={age}
                        onClick={() => toggleAge(age)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 20,
                          border: `1px solid ${
                            selected ? C.success : C.border
                          }`,
                          background: selected ? "#0a2a1a" : C.bgAlt,
                          color: selected ? C.success : "#5a7a9a",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {selected ? "✓ " : ""}
                        {age}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 18,
            justifyContent: "flex-end",
          }}
        >
          <Btn variant="ghost" onClick={() => setShowForm(false)}>
            إلغاء
          </Btn>
          <Btn icon="check" onClick={save}>
            {editing ? "حفظ التعديل" : "إضافة العميل"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
// ==================== PROMOTIONS MODULE ====================
// منطق الخصم التدرجي حسب الصلاحية
