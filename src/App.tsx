import { useState, useContext, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import { authService } from "./services/authService";
import { useStorage } from "./hooks/useStorage";
import { INIT_PRODUCTS, INIT_SUPPLIERS, INIT_CUSTOMERS, INIT_SALES, INIT_PURCHASES, INIT_USERS, emptyInvoice } from "./data/initialData";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { ThemeToggle } from "./theme/ThemeToggle";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { StatCard } from "./ui/StatCard";
import { Btn } from "./ui/Btn";
import { Toast } from "./ui/Toast";
import { BarcodeScanner } from "./ui/BarcodeScanner";
import { Badge } from "./ui/Badge";
import { Modal } from "./ui/Modal";
import { IC } from "./ui/IC";
import { Table } from "./ui/Table";
import { Login } from "./components/Login";
import { PrintReceipt } from "./modules/PrintReceipt";
import { Dashboard } from "./modules/Dashboard";
import { POS } from "./modules/POS";
import { ProductsModule } from "./modules/ProductsModule";
import { SuppliersModule } from "./modules/SuppliersModule";
import { CustomersModule } from "./modules/CustomersModule";
import { PurchaseModule } from "./modules/PurchaseModule";
import { ReturnsModule } from "./modules/ReturnsModule";
import { Reports } from "./modules/Reports";
import { ExpiryReport } from "./modules/ExpiryReport";
import { InventoryCount } from "./modules/InventoryCount";
import { TreasuryModule } from "./modules/TreasuryModule";
import { PromotionsModule } from "./modules/PromotionsModule";
import { TaxReport } from "./modules/TaxReport";
import { ShiftModule } from "./modules/ShiftModule";
import { AttendanceModule } from "./modules/AttendanceModule";
import { TargetModule } from "./modules/TargetModule";
import { LoyaltyModule } from "./modules/LoyaltyModule";
import { PermissionsModule } from "./modules/PermissionsModule";
import { PharmacySettings } from "./modules/PharmacySettings";
import { RasdSettings } from "./modules/RasdSettings";

export default function PharmacyPro() {
  const [products, setProducts] = useStorage("ph_products", INIT_PRODUCTS);
  const [suppliers, setSuppliers] = useStorage("ph_suppliers", INIT_SUPPLIERS);
  const [customers, setCustomers] = useStorage("ph_customers", INIT_CUSTOMERS);
  const [sales, setSales] = useStorage("ph_sales", INIT_SALES);
  const [purchases, setPurchases] = useStorage("ph_purchases", INIT_PURCHASES);
  const [creditPayments, setCreditPayments] = useState([]);
  const [returnsData, setReturnsData] = useStorage("ph_returns", []);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [users] = useStorage("ph_users", INIT_USERS);
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const pharmacyId = currentUser?.pharmacy_id || null;
  const [shifts, setShifts] = useState([]);
  useEffect(() => {
  if (!pharmacyId) return;
  supabase
    .from("shifts")
    .select("*")
    .eq("pharmacy_id", pharmacyId)
    .order("start_time", { ascending: false })
    .then(({ data }) => {
      if (data) setShifts(data);
    });
}, [pharmacyId]);
  const [treasuryEntries, setTreasuryEntries] = useState([]);
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("treasury_entries")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) setTreasuryEntries(data);
      });
  }, [pharmacyId]);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [posInvoices, setPosInvoices] = useState([emptyInvoice()]);
  const [posActiveTab, setPosActiveTab] = useState(0);
  const [posPromos, setPosPromos] = useState([]);
  const [posDiscountRules, setPosDiscountRules] = useState([
    { days: 90,  discount: 50, color: "#ff4444" },
    { days: 120, discount: 25, color: "#ff7744" },
    { days: 150, discount: 20, color: "#ffaa44" },
    { days: 180, discount: 15, color: "#f59e0b" },
  ]);
  const posProductEarliestExpiry = useMemo(() => {
    const map = {};
    (purchases || []).forEach((pu) => {
      const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
      items.forEach((item) => {
        const expiry = item.expiry_date || item.expiry;
        if (!expiry || !item.id) return;
        if (!map[item.id] || expiry < map[item.id]) map[item.id] = expiry;
      });
    });
    (products || []).forEach((p) => {
      if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) map[p.id] = p.expiry;
    });
    return map;
  }, [purchases, products]);
  // تحميل العروض وقواعد الخصم للـ POS
  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("promotions").select("*").eq("pharmacy_id", pharmacyId).order("end_date")
      .then(({ data }) => { if (data) setPosPromos(data); });
    supabase.from("promo_rules").select("*").eq("pharmacy_id", pharmacyId).order("days")
      .then(({ data }) => { if (data && data.length > 0) setPosDiscountRules(data); });
  }, [pharmacyId]);
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const currentShift = shifts.find(
    (s) => !s.end_time && s.user === currentUser?.name
  );
  useEffect(() => {
    const loadData = async () => {
  if (!pharmacyId) return;
  
  setProducts([]);
  setSuppliers([]);
  setCustomers([]);
  setSales([]);
  setPurchases([]);
  setReturnsData([]);
  setCreditPayments([]);
  setInventoryLogs([]);
  setManufacturers([]);  
  setIsLoading(true);
  
  try {
    const [p, s, c, sa, pu, ret, cp, inv, mfr] = await Promise.all([
      supabase.from("products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("suppliers").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("customers").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("sales").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("purchases").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("returns").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("credit_payments").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("inventory_logs").select("*").eq("pharmacy_id", pharmacyId).order("date", { ascending: false }),
      supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId),
    ]);
    setProducts(
      (p.data ?? []).map((row) => ({
        ...row,
        // ── توحيد الأسماء بين الداتابيز (snake_case) والكود (camelCase) ──
        // ملاحظة: نحتفظ بالحقول الخام (row.*) كما هي بجانب النسخة المُعدّلة،
        // فأي كود قديم يقرأ snake_case مباشرة يستمر في العمل بدون كسر.
        saleUnits: row.sale_units || row.unit_division || null,
        packageType: row.package_type || row.unit || "",
        dosageForm: row.dosage_form || "",
      }))
    );
    setSuppliers(s.data ?? []);
    setCustomers(c.data ?? []);
    setSales(sa.data ?? []);
    setReturnsData(ret.data ?? []);
    setCreditPayments(cp.data ?? []);
    setInventoryLogs(inv.data ?? []);
    setManufacturers(mfr.data ?? []);
    setPurchases(
      (pu.data ?? []).map((item) => ({
        ...item,
        supplierName: item.supplier_name,
        taxAmount: item.tax_amount ?? 0,
        subtotal: item.subtotal ?? 0,
        total: item.total ?? 0,
        items: item.items ?? [],
      }))
    );
  } finally {
    setIsLoading(false);
  }
};
loadData();
  }, [pharmacyId]);

  // ✅ تم نقل هذا البلوك لفوق الـ early returns لتفادي خطأ React #310
  // (الـ hooks لازم تتنفذ بنفس الترتيب في كل render، مش بشكل شرطي)
  const essentialAlerts = useEssentialAlerts(products);
  const tabAlertCounts = useMemo(() => {
    const lowStockCount   = products.filter((p) => p.stock <= (p.min_stock || p.minStock || 0)).length;
    const expiringCount   = products.filter((p) => {
      if (!p.expiry) return false;
      const diff = (new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24);
      return diff < 90 && diff > 0;
    }).length;
    const supplierDueCount = (suppliers || []).filter((s) => {
      const supPurchases = (purchases || []).filter((p) => p.supplier === s.id && p.payment_status !== "مسددة");
      return supPurchases.some((po) => {
        const due = new Date(po.date);
        due.setDate(due.getDate() + (s.payment_terms || 30));
        const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 5;
      });
    }).length;
    const disappearedCount = (customers || []).filter((c) => {
      if (!c.lastVisit) return false;
      const days = (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
      return days > 45 && days < 365 && (c.visits || 0) > 0;
    }).length;
    const newCustomersCount = (customers || []).filter((c) => {
      if (!c.created_at) return false;
      const days = (new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;
    const now = new Date();
    const quarterEndMonth = [2, 5, 8, 11].find((m) => m >= now.getMonth()) ?? 2;
    const qEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0);
    const taxDaysLeft = Math.ceil((qEnd - now) / (1000 * 60 * 60 * 24));
    return {
      products: lowStockCount + expiringCount + essentialAlerts.length,
      suppliers: supplierDueCount,
      customers: disappearedCount + newCustomersCount,
      tax_report: taxDaysLeft <= 14 ? 1 : 0,
    };
  }, [products, suppliers, purchases, customers, essentialAlerts]);

  if (!currentUser)
    return (
      <Login
        users={users}
        onLogin={async (username, password) => {
          const u = await authService.login(username, password);
          setCurrentUser(u);
          setTab("dashboard");
        }}
      />
    );
if (isLoading) return (
  <div style={{
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#060c16",
    flexDirection: "column",
    gap: 16,
    fontFamily: "'Tajawal',sans-serif",
  }}>
    <div style={{
      width: 56,
      height: 56,
      borderRadius: 16,
      background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#8ab0ff",
    }}>
      <IC n="pill" s={28} />
    </div>
    <div style={{ color: "#3a6aaa", fontSize: 15 }}>
      جاري تحميل البيانات...
    </div>
  </div>
);

 const TABS = [
  // ── الرئيسية ──
  { id: "dashboard", label: "الرئيسية", icon: "dashboard" },

  // ── الفريق والالتزام ──
  { id: "shift",      label: "الشفتات",            icon: "shift" },
  { id: "attendance", label: "الحضور والانصراف",   icon: "shift" },

  // ── العملاء والمبيعات ──
  { id: "customers",  label: "العملاء",             icon: "customers" },
  { id: "loyalty",    label: "نقاط الولاء",         icon: "star" },
  { id: "pos",        label: "نقطة البيع",          icon: "pos" },
  { id: "returns",    label: "المرتجعات",           icon: "returns" },
  { id: "promotions", label: "العروض",              icon: "tag" },
  { id: "target",     label: "🎯 تارجت المبيعات",  icon: "target" },

  // ── المخزون والموردين ──
  { id: "purchase",        label: "فواتير الشراء",  icon: "purchase" },
  { id: "products",        label: "الأصناف",         icon: "inventory" },
  { id: "suppliers",       label: "الموردون",        icon: "suppliers" },
  { id: "inventory_count", label: "الجرد",           icon: "count" },

  // ── التقارير ──
  { id: "expiry_report", label: "تقرير تواريخ الصلاحية", icon: "alert" },
  { id: "reports",       label: "التقارير",               icon: "reports" },
  { id: "tax_report",    label: "تقرير ضريبي",            icon: "tax" },

  // ── الإدارة ──
  { id: "treasury",          label: "الخزنة",           icon: "money" },
  { id: "pharmacy_settings", label: "بيانات الصيدلية",  icon: "settings" },
  { id: "permissions",       label: "الصلاحيات",        icon: "settings" },
  { id: "rasd_settings",     label: "إعدادات رصد",      icon: "settings" },
];

  const { C } = useTheme();
  return (
    <ThemeProvider>
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal',sans-serif",
        background: C.bg,
        minHeight: "100vh",
        color: C.text,
        display: "flex",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
        rel="stylesheet"
      />
      {toast && <Toast {...toast} />}

      {/* SIDEBAR */}
      <nav
  style={{
    width: 210,
    background: "#0a0f1c",
    borderLeft: "none",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  }}
>
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: "1px solid #141e30",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8ab0ff",
                flexShrink: 0,
              }}
            >
              <IC n="pill" s={18} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#dde8ff",
                  lineHeight: 1.2,
                }}
              >
                صيدلية برو
              </div>
              <div style={{ fontSize: 10, color: "#2a5a8a" }}>نظام متكامل</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: "#0d1520",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IC n="user" s={14} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#8aa0cc",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentUser.name}
              </div>
              <div style={{ fontSize: 10, color: "#2a4a6a" }}>
                {currentUser.role === "admin" ? "مدير" : "صيدلاني"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "8px 0" }}>
  {(() => {
  const GROUP_COLORS = {
    team:     "#22c55e",
    sales:    "#3b82f6",
    stock:    "#f97316",
    reports:  "#a855f7",
    admin:    "#eab308",
    main:     "#2a6aef",
  };

  const groups = [
    { label: null,               color: GROUP_COLORS.main,    ids: ["dashboard"] },
    { label: "الفريق والالتزام", color: GROUP_COLORS.team,    ids: ["shift", "attendance"] },
    { label: "العملاء والمبيعات",color: GROUP_COLORS.sales,   ids: ["customers", "loyalty", "pos", "returns", "promotions", "target"] },
    { label: "المخزون والموردين",color: GROUP_COLORS.stock,   ids: ["purchase", "products", "suppliers", "inventory_count"] },
    { label: "التقارير",         color: GROUP_COLORS.reports, ids: ["expiry_report", "reports", "tax_report"] },
    { label: "الإدارة",          color: GROUP_COLORS.admin,   ids: ["treasury", "pharmacy_settings", "permissions", "rasd_settings"] },
  ];

  // إيجاد لون التاب الحالي
  const activeGroup = groups.find(g => g.ids.includes(tab));
  const activeColor = activeGroup?.color || GROUP_COLORS.main;

  return groups.map((group, gi) => (
    <div key={gi}>
      {group.label && (
        <div style={{
          padding: "10px 16px 4px",
          fontSize: 10,
          fontWeight: 700,
          color: group.color,
          opacity: 0.7,
          letterSpacing: "0.05em",
          marginTop: 4,
        }}>
          {group.label}
        </div>
      )}
      {group.ids.map((id) => {
        const t = TABS.find((x) => x.id === id);
        if (!t) return null;
        const isActive = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 16px",
              width: "100%",
              background: isActive ? `${group.color}18` : "transparent",
              borderRight: isActive ? `3px solid ${group.color}` : "3px solid transparent",
              border: "none",
              color: isActive ? group.color : "#4a6a8a",
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
              textAlign: "right",
              transition: "all 0.12s",
            }}
          >
            <IC n={t.icon} s={15} />
            <span style={{ flex: 1 }}>{t.label}</span>
            {tabAlertCounts[t.id] > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 99, background: "#3a1010", color: "#ff6a6a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace",
              }}>
                {tabAlertCounts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  ));
})()}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #141e30" }}>
          {currentShift ? (
            <div
              style={{
                background: "#0a2010",
                border: "1px solid #1a5020",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 10,
                color: "#44aa66",
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 700 }}>شفت مفتوح</div>
              <div style={{ color: "#2a7a46" }}>{currentShift.start}</div>
            </div>
          ) : (
            <div
              style={{
                background: "#1a0a00",
                border: "1px solid #4a2a00",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 10,
                color: "#ffaa44",
                fontSize: 11,
              }}
            >
              لا يوجد شفت مفتوح
            </div>
          )}
          <button
            onClick={() => {
              authService.logout();
              setCurrentUser(null);
              setTab("dashboard");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "9px 10px",
              background: "#1a0a0a",
              border: "1px solid #3a1010",
              borderRadius: 8,
              color: "#aa4444",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <IC n="logout" s={15} />
            خروج
          </button>
        </div>
      </nav>
  {/* GRADIENT DIVIDER */}
<div style={{
  width: 1,
  background: "linear-gradient(to bottom, transparent, #1e3a6a 20%, #2a6aef 50%, #1e3a6a 80%, transparent)",
  flexShrink: 0,
  opacity: 0.4,
}} />

      {/* MAIN CONTENT */}
      {tab === "pharmacy_settings" && (
        <PharmacySettings showToast={showToast}
          pharmacyId={pharmacyId}
          />
      )}
      <main
        style={{ flex: 1, overflow: "auto", padding: 24, minHeight: "100vh" }}
      >
        {tab === "dashboard" && (
          <Dashboard
            products={products}
            sales={sales}
            purchases={purchases}
            customers={customers}
            suppliers={suppliers}
            shifts={shifts}
            currentUser={currentUser}
            pharmacyId={pharmacyId}
            setTab={setTab}
            creditPayments={creditPayments}
            treasuryEntries={treasuryEntries}
          />
        )}
        {tab === "pos" && (
          <POS
            products={products}
            setProducts={setProducts}
            customers={customers}
            sales={sales}
            setSales={setSales}
            shifts={shifts}
            setShifts={setShifts}
            currentUser={currentUser}
            currentShift={currentShift}
            showToast={showToast}
            invoices={posInvoices}
            setInvoices={setPosInvoices}
            activeTab={posActiveTab}
            setActiveTab={setPosActiveTab}
            pharmacyId={pharmacyId}
            promos={posPromos}
            discountRules={posDiscountRules}
            productEarliestExpiry={posProductEarliestExpiry}
          />
        )}
        {tab === "purchase" && (
          <PurchaseModule
            products={products}
            setProducts={setProducts}
            suppliers={suppliers}
            purchases={purchases}
            setPurchases={setPurchases}
            showToast={showToast}
            pharmacyId={pharmacyId}
          />
        )}
        {tab === "returns" && (
          <ReturnsModule
            products={products}
            setProducts={setProducts}
            sales={sales}
            setSales={setSales}
            purchases={purchases}
            setPurchases={setPurchases}
            customers={customers}
            showToast={showToast}
            pharmacyId={pharmacyId}
            currentUser={currentUser}
          />
        )}
        {tab === "rasd_settings" && <RasdSettings showToast={showToast} />}
        {tab === "expiry_report" && <ExpiryReport purchases={purchases} />}
        {tab === "inventory_count" && (
          <InventoryCount
            products={products}
            setProducts={setProducts}
            inventoryLogs={inventoryLogs}
            setInventoryLogs={setInventoryLogs}
            currentUser={currentUser}
            showToast={showToast}
            pharmacyId={pharmacyId}
          />
        )}
        {tab === "products" && (
          <ProductsModule
            products={products}
            setProducts={setProducts}
            suppliers={suppliers}
            sales={sales}
            purchases={purchases}
            showToast={showToast}
            pharmacyId={pharmacyId}
          />
        )}
        {tab === "suppliers" && (
          <SuppliersModule
  suppliers={suppliers}
  setSuppliers={setSuppliers}
  purchases={purchases}
  setPurchases={setPurchases}
  products={products}
  setProducts={setProducts}
  sales={sales}
  showToast={showToast}
  pharmacyId={pharmacyId}
  currentUser={currentUser}
  setTreasuryEntries={setTreasuryEntries}
/>
        )}
        {tab === "customers" && (
          <CustomersModule
            customers={customers}
            setCustomers={setCustomers}
            showToast={showToast}
            sales={sales}
            setSales={setSales}
            creditPayments={creditPayments}
            setCreditPayments={setCreditPayments}
            currentUser={currentUser}
            pharmacyId={pharmacyId}
          />
        )}
        {tab === "reports" && (
          <Reports
            sales={sales}
            purchases={purchases}
            products={products}
            suppliers={suppliers}
            customers={customers}
            returns={returnsData}
            manufacturers={manufacturers}
          />
        )}
        {tab === "tax_report" && (
          <TaxReport sales={sales} purchases={purchases} returns={returnsData} />
        )}
        {tab === "promotions" && (
          <PromotionsModule
            products={products}
            setProducts={setProducts}
            sales={sales}
            purchases={purchases}
            shifts={shifts}
            currentUser={currentUser}
            pharmacyId={pharmacyId}
            showToast={showToast}
          />
        )}
        {tab === "target" && (
  <TargetModule
    users={users}
    sales={sales}
    customers={customers}
    currentUser={currentUser}
    pharmacyId={pharmacyId}
    showToast={showToast}
  />
)}
        {tab === "treasury" && (
          <TreasuryModule
            sales={sales}
            creditPayments={creditPayments}
            pharmacyId={pharmacyId}
            currentUser={currentUser}
            showToast={showToast}
            suppliers={suppliers}
            shifts={shifts}
            entries={treasuryEntries}
            setEntries={setTreasuryEntries}
          />
        )}
        {tab === "shift" && (
          <ShiftModule
            shifts={shifts}
            setShifts={setShifts}
            sales={sales}
            currentUser={currentUser}
            showToast={showToast}
            pharmacyId={pharmacyId}
            invoices={posInvoices}
          />
        )}
{tab === "attendance" && (
  <AttendanceModule
  pharmacyId={pharmacyId}
  shifts={shifts}
  setShifts={setShifts}
  currentUser={currentUser}
  showToast={showToast}
/>
)}
    {tab === "loyalty" && (
  <LoyaltyModule
    customers={customers}
    sales={sales}
    products={products}
    pharmacyId={pharmacyId}
    showToast={showToast}
  />
)}
{tab === "permissions" && (
  <PermissionsModule
    pharmacyId={pharmacyId}
    showToast={showToast}
  />
)}    
      </main>
    </div>
    </ThemeProvider>
  );
}
