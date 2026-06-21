import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://glcdvwpwxbhutfecljdj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsY2R2d3B3eGJodXRmZWNsamRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE1OTIsImV4cCI6MjA5NTU0NzU5Mn0.w-dLQiFTTPzB0eeA7Asf95hy5x7kjA-OvilneYAIHHA"
);
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ==================== AUTH SERVICE ====================
const SESSION_KEY = "pharmacy_session";
const authService = {
  async login(username: string, password: string) {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id")
      .eq("username", username)
      .eq("password", password)
      .single();
    if (error || !data) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    if (!data.pharmacy_id) throw new Error("هذا المستخدم غير مرتبط بصيدلية");
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  },
  logout() { localStorage.removeItem(SESSION_KEY); },
  getCurrentUser() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },
};

// ==================== STORAGE ====================
const useStorage = (key, initial) => {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (val) => {
      setState((prev) => {
        const next = typeof val === "function" ? val(prev) : val;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [key]
  );
  return [state, set];
};

// ==================== INITIAL DATA ====================
const INIT_PRODUCTS = [
  {
    id: "P001",
    name: "باراسيتامول 500mg",
    barcode: "6281234567001",
    category: "مسكنات",
    unit: "قرص",
    price: 12,
    cost: 7,
    taxable: false,
    stock: 150,
    minStock: 20,
    supplier: "S001",
    expiry: "2027-06-01",
    activeIngredient: "Paracetamol",
    concentration: "500mg",
  },
  {
    id: "P002",
    name: "أموكسيسيلين 250mg",
    barcode: "6281234567002",
    category: "مضادات حيوية",
    unit: "كبسولة",
    price: 45,
    cost: 28,
    taxable: true,
    stock: 80,
    minStock: 15,
    supplier: "S001",
    expiry: "2026-12-01",
    activeIngredient: "Amoxicillin",
    concentration: "250mg",
  },
  {
    id: "P003",
    name: "أومبيرازول 20mg",
    barcode: "6281234567003",
    category: "جهاز هضمي",
    unit: "كبسولة",
    price: 35,
    cost: 20,
    taxable: true,
    stock: 60,
    minStock: 10,
    supplier: "S002",
    expiry: "2027-03-01",
    activeIngredient: "Omeprazole",
    concentration: "20mg",
  },
  {
    id: "P004",
    name: "ميتفورمين 500mg",
    barcode: "6281234567004",
    category: "سكري",
    unit: "قرص",
    price: 28,
    cost: 16,
    taxable: true,
    stock: 5,
    minStock: 20,
    supplier: "S002",
    expiry: "2027-01-01",
    activeIngredient: "Metformin",
    concentration: "500mg",
  },
  {
    id: "P005",
    name: "فيتامين C 1000mg",
    barcode: "6281234567005",
    category: "فيتامينات",
    unit: "قرص فوار",
    price: 55,
    cost: 32,
    taxable: true,
    stock: 200,
    minStock: 30,
    supplier: "S003",
    expiry: "2027-08-01",
    activeIngredient: "Ascorbic Acid",
    concentration: "1000mg",
  },
];
const INIT_SUPPLIERS = [
  {
    id: "S001",
    name: "شركة الدواء العربية",
    taxId: "300123456700003",
    phone: "0112345678",
    email: "info@arabmed.sa",
    address: "الرياض، حي الملز",
    contact: "أحمد الشمري",
  },
  {
    id: "S002",
    name: "فارما مصر للتوزيع",
    taxId: "300987654300003",
    phone: "0223456789",
    email: "orders@pharmaegy.sa",
    address: "جدة، المنطقة الصناعية",
    contact: "محمد العتيبي",
  },
  {
    id: "S003",
    name: "ناتيورال كير",
    taxId: "311234567890003",
    phone: "0143456789",
    email: "sales@naturalcare.sa",
    address: "الدمام، حي الفيصلية",
    contact: "سارة الزهراني",
  },
];
const INIT_CUSTOMERS = [
  {
    id: "C001",
    name: "أحمد محمد علي",
    phone: "0501234567",
    taxId: "",
    totalSpent: 450,
    visits: 5,
    lastVisit: "2026-05-20",
  },
  {
    id: "C002",
    name: "شركة الرعاية الصحية",
    phone: "0112223344",
    taxId: "310234567890003",
    totalSpent: 8500,
    visits: 25,
    lastVisit: "2026-05-22",
  },
];
const INIT_SALES = [
  {
    id: "INV-0001",
    date: "2026-05-20",
    customer: "C001",
    customerName: "أحمد محمد علي",
    items: [
      {
        id: "P001",
        name: "باراسيتامول 500mg",
        qty: 2,
        price: 12,
        taxable: false,
        dose: "قرص واحد 3 مرات يومياً بعد الأكل",
      },
      {
        id: "P005",
        name: "فيتامين C 1000mg",
        qty: 1,
        price: 55,
        taxable: true,
        dose: "قرص يومياً مع الطعام",
      },
    ],
    subtotal: 79,
    taxAmount: 2.75,
    total: 81.75,
    payment: "نقدي",
    shift: "S-001",
    prescriptionImg: null,
    returned: false,
  },
];
const INIT_PURCHASES = [
  {
    id: "PO-0001",
    date: "2026-05-15",
    supplier: "S001",
    supplierName: "شركة الدواء العربية",
    items: [
      {
        id: "P001",
        name: "باراسيتامول 500mg",
        qty: 100,
        cost: 7,
        taxable: false,
      },
      {
        id: "P002",
        name: "أموكسيسيلين 250mg",
        qty: 50,
        cost: 28,
        taxable: true,
      },
    ],
    subtotal: 2100,
    taxAmount: 210,
    total: 2310,
    status: "مستلمة",
  },
];
const INIT_INVENTORY = [
  {
    id: "INV-ADJ-001",
    date: "2026-05-10",
    type: "جرد",
    items: [
      { id: "P001", systemQty: 150, actualQty: 148, diff: -2 },
      { id: "P002", systemQty: 80, actualQty: 80, diff: 0 },
    ],
    notes: "جرد شهر مايو",
    by: "أحمد الصيدلاني",
  },
];
const INIT_SHIFTS = [
  {
    id: "SH-001",
    user: "أحمد الصيدلاني",
    start: "2026-05-22 08:00",
    end: null,
    openCash: 500,
    closeCash: null,
    sales: 0,
    notes: "",
  },
];
const INIT_USERS = [
  {
    id: "U001",
    name: "مدير النظام",
    role: "admin",
    username: "admin",
    password: "admin123",
  },
  {
    id: "U002",
    name: "أحمد الصيدلاني",
    role: "pharmacist",
    username: "ahmed",
    password: "123456",
  },
];
const CATEGORIES = [
  "مسكنات",
  "مضادات حيوية",
  "جهاز هضمي",
  "سكري",
  "قلب وأوعية",
  "فيتامينات",
  "حساسية",
  "جلدية",
  "عيون",
  "أذن وأنف",
  "تغذية",
  "أخرى",
];
const TAX_RATE = 0.15;

// ==================== ICONS ====================
const IC = ({ n, s = 18 }) => {
  const m = {
    dashboard: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
    pos: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
    inventory: (
      <>
        <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path d="M16 3H8L6 7h12l-2-4z" />
      </>
    ),
    purchase: (
      <>
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </>
    ),
    returns: (
      <>
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
      </>
    ),
    customers: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    suppliers: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </>
    ),
    reports: (
      <>
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </>
    ),
    tax: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </>
    ),
    shift: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    count: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    cart: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    minus: <line x1="5" y1="12" x2="19" y2="12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    barcode: (
      <>
        <path d="M3 5v14M8 5v14M16 5v14M21 5v14M12 5v5M12 14v5" />
      </>
    ),
    print: (
      <>
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </>
    ),
    img: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </>
    ),
    pill: (
      <>
        <rect x="2" y="9" width="20" height="6" rx="3" />
        <path d="M12 9v6" />
      </>
    ),
    alert: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    money: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    tag: (
      <>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </>
    ),
    percent: (
      <>
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
  };
  return (
    <svg
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {m[n]}
    </svg>
  );
};

// ==================== UI COMPONENTS ====================
const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(5,10,20,0.8)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 18,
          width: wide ? "92vw" : "580px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #1d2d4a",
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#dde8ff",
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "#1d2d4a",
              border: "none",
              color: "#6a8aaa",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
            }}
          >
            <IC n="x" s={16} />
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 24, flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const Toast = ({ msg, type }) => (
  <div
    style={{
      position: "fixed",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      background:
        type === "error" ? "#3a0a0a" : type === "warn" ? "#3a2a00" : "#0a2a18",
      border: `1px solid ${
        type === "error" ? "#7a2020" : type === "warn" ? "#7a5a00" : "#1a6a46"
      }`,
      borderRadius: 12,
      padding: "13px 28px",
      color:
        type === "error" ? "#ff8888" : type === "warn" ? "#ffcc44" : "#44dd88",
      fontSize: 15,
      fontWeight: 700,
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      whiteSpace: "nowrap",
      pointerEvents: "none",
    }}
  >
    {msg}
  </div>
);

const Btn = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  style = {},
  disabled = false,
  icon,
}) => {
  const bg = {
    primary: "linear-gradient(135deg,#1e4fbf,#1a3d9f)",
    danger: "#3a1010",
    success: "#0a2a18",
    ghost: "transparent",
    secondary: "#1a2540",
  };
  const cl = {
    primary: "#8ab0ff",
    danger: "#ff7777",
    success: "#44dd88",
    ghost: "#6a8aaa",
    secondary: "#8aa0cc",
  };
  const pd =
    size === "sm" ? "6px 14px" : size === "lg" ? "14px 32px" : "10px 20px";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: pd,
        background: bg[variant],
        border: `1px solid ${
          variant === "ghost"
            ? "#1d2d4a"
            : variant === "danger"
            ? "#5a2020"
            : variant === "success"
            ? "#1a5a30"
            : "#2a4a8a"
        }`,
        borderRadius: 9,
        color: cl[variant],
        fontSize: size === "sm" ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        ...style,
      }}
    >
      {icon && <IC n={icon} s={size === "sm" ? 13 : 16} />}
      {children}
    </button>
  );
};

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  style = {},
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
    {label && (
      <label style={{ color: "#5a7aaa", fontSize: 12, fontWeight: 600 }}>
        {label}
        {required && <span style={{ color: "#ff6666" }}> *</span>}
      </label>
    )}
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: "#080e1a",
        border: "1px solid #1d2d4a",
        borderRadius: 8,
        padding: "9px 12px",
        color: "#dde8ff",
        fontSize: 14,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
      }}
    />
  </div>
);

const Select = ({ label, value, onChange, options, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
    {label && (
      <label style={{ color: "#5a7aaa", fontSize: 12, fontWeight: 600 }}>
        {label}
      </label>
    )}
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#080e1a",
        border: "1px solid #1d2d4a",
        borderRadius: 8,
        padding: "9px 12px",
        color: "#dde8ff",
        fontSize: 14,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {options.map((o) => (
        <option key={o.v || o} value={o.v || o}>
          {o.l || o}
        </option>
      ))}
    </select>
  </div>
);

const Badge = ({ children, color = "#1a3a6a", text = "#5a9aff" }) => (
  <span
    style={{
      background: color,
      color: text,
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

const StatCard = ({ label, value, icon, color, sub }) => (
  <div
    style={{
      background: "#0f1623",
      border: "1px solid #1d2d4a",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: color + "22",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        flexShrink: 0,
      }}
    >
      <IC n={icon} s={22} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#dde8ff",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ color: "#4a6a9a", fontSize: 12, marginTop: 4 }}>
        {label}
      </div>
      {sub && (
        <div style={{ color: "#2a8a5a", fontSize: 11, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  </div>
);

const Table = ({ headers, rows, emptyMsg = "لا توجد بيانات" }) => (
  <div
    style={{
      background: "#0f1623",
      border: "1px solid #1d2d4a",
      borderRadius: 14,
      overflow: "hidden",
    }}
  >
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}
      >
        <thead>
          <tr
            style={{ background: "#080e1a", borderBottom: "1px solid #1d2d4a" }}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "11px 16px",
                  textAlign: "right",
                  color: "#4a6a9a",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "#2a3a5a",
                  fontSize: 14,
                }}
              >
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #0a1020",
                  background: i % 2 === 0 ? "transparent" : "#080e16",
                  transition: "background 0.1s",
                }}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "11px 16px",
                      fontSize: 13,
                      color: "#c0d0f0",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// ==================== BARCODE SCANNER ====================
const BarcodeScanner = ({
  onScan,
  placeholder = "امسح أو اكتب الباركود...",
}) => {
  const [val, setVal] = useState("");
  const ref = useRef();

  const handleScan = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // كشف إذا كان GS1 2D باركود
    const isGS1 =
      trimmed.includes("(01)") ||
      trimmed.includes(")01(") ||
      /^01\d{14}/.test(trimmed);

    if (isGS1) {
      const parsed = parseGS1Barcode(trimmed);
      onScan({ type: "gs1", ...parsed });
    } else {
      onScan({ type: "simple", code: trimmed, raw: trimmed });
    }
    setVal("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && val.trim()) handleScan(val);
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <IC
        n="barcode"
        s={18}
        style={{ position: "absolute", right: 10, color: "#3a5aaa" }}
      />
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        style={{
          background: "#080e1a",
          border: "1px solid #2a5a9a",
          borderRadius: 8,
          padding: "9px 12px 9px 40px",
          color: "#dde8ff",
          fontSize: 14,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        }}
      />
      <Btn size="sm" onClick={() => handleScan(val)} icon="search">
        بحث
      </Btn>
    </div>
  );
};
// ==================== LOGIN ====================
const Login = ({ users, onLogin }) => {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const go = async () => {
    setErr("");
    try {
      await onLogin(u, p);
    } catch (e) {
      setErr(e.message || "اسم المستخدم أو كلمة المرور غير صحيحة");
    }
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#060c16",
        fontFamily: "'Tajawal',sans-serif",
      }}
      dir="rtl"
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 20,
          padding: 40,
          width: 380,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "#8ab0ff",
            }}
          >
            <IC n="pill" s={32} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: "#dde8ff",
            }}
          >
            صيدلية برو
          </h1>
          <p style={{ margin: "6px 0 0", color: "#3a5a8a", fontSize: 13 }}>
            نظام إدارة صيدلية متكامل
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label="اسم المستخدم"
            value={u}
            onChange={setU}
            placeholder="أدخل اسم المستخدم"
          />
          <Input
            label="كلمة المرور"
            value={p}
            onChange={setP}
            type="password"
            placeholder="أدخل كلمة المرور"
          />
          {err && (
            <div
              style={{ color: "#ff7777", fontSize: 13, textAlign: "center" }}
            >
              {err}
            </div>
          )}
          <Btn
            size="lg"
            onClick={go}
            style={{ marginTop: 4, justifyContent: "center" }}
          >
            دخول النظام
          </Btn>
        </div>
        <p
          style={{
            textAlign: "center",
            color: "#2a4a6a",
            fontSize: 11,
            marginTop: 20,
          }}
        >
          admin/admin123 — ahmed/123456
        </p>
      </div>
    </div>
  );
};
// ==================== RASSD SERVICE ====================

const RasdService = {
  baseUrl: "https://rsd.sfda.gov.sa/api", // غير للـ URL الصح من رصد
  token: null,

  // تسجيل الدخول والحصول على token
  async login(username, password) {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      this.token = data.token;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // إرسال حركة لرصد
  async sendTransaction(type, items, glnFrom, glnTo) {
    // type: "receipt" | "dispense" | "return"
    try {
      if (!this.token) {
        const cfg = JSON.parse(localStorage.getItem("rasd_config") || "{}");
        this.token = cfg.token;
      }
      const payload = {
        transactionType: type,
        fromGLN: glnFrom,
        toGLN: glnTo,
        date: new Date().toISOString(),
        items: items.map((i) => ({
          gtin: i.gtin,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.qty,
        })),
      };

      const res = await fetch(`${this.baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { success: res.ok, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // التحقق من صلاحية الدواء
  async verifyProduct(gtin, serial) {
    try {
      const res = await fetch(
        `${this.baseUrl}/products/verify?gtin=${gtin}&serial=${serial}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );
      const data = await res.json();
      return { success: res.ok, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
// ==================== RASSD BARCODE PARSER ====================

function parseGS1Barcode(raw) {
  const result = {
    gtin: null,
    expiry: null,
    batch: null,
    serial: null,
    raw,
  };

  try {
    // إزالة الأقواس وتحويل لـ standard GS1 format
    const cleaned = raw
      .replace(/\)(\d{2})\(/g, "$1") // )(01)( → 01
      .replace(/^\(/, "") // إزالة أول قوس
      .replace(/\)/, ""); // إزالة آخر قوس

    let i = 0;
    while (i < cleaned.length) {
      const ai = cleaned.substring(i, i + 2);

      if (ai === "01") {
        result.gtin = cleaned.substring(i + 2, i + 16);
        i += 16;
      } else if (ai === "17") {
        const raw = cleaned.substring(i + 2, i + 8); // YYMMDD
        result.expiry = `20${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(
          4,
          6
        )}`;
        i += 8;
      } else if (ai === "10") {
        // batch - variable length, ends at next AI or end
        const rest = cleaned.substring(i + 2);
        const nextAI = rest.search(/(?:17|21)\d/);
        if (nextAI === -1) {
          result.batch = rest;
          i = cleaned.length;
        } else {
          result.batch = rest.substring(0, nextAI);
          i += 2 + nextAI;
        }
      } else if (ai === "21") {
        result.serial = cleaned.substring(i + 2);
        i = cleaned.length;
      } else {
        i++;
      }
    }
  } catch (e) {
    console.error("GS1 parse error:", e);
  }

  return result;
}
// ==================== MAIN APP ====================
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
    setProducts(p.data ?? []);
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
    { id: "dashboard", label: "الرئيسية", icon: "dashboard" },
    { id: "pos", label: "نقطة البيع", icon: "pos" },
    { id: "purchase", label: "فواتير الشراء", icon: "purchase" },
    { id: "returns", label: "المرتجعات", icon: "returns" },
    { id: "rasd_settings", label: "إعدادات رصد", icon: "settings" },
    { id: "expiry_report", label: "تقرير الصلاحيات", icon: "alert" },
    { id: "inventory_count", label: "الجرد", icon: "count" },
    { id: "products", label: "الأصناف", icon: "inventory" },
    { id: "suppliers", label: "الموردون", icon: "suppliers" },
    { id: "customers", label: "العملاء", icon: "customers" },
    { id: "reports", label: "التقارير", icon: "reports" },
    { id: "tax_report", label: "تقرير ضريبي", icon: "tax" },
    { id: "shift", label: "الشفتات", icon: "shift" },
    { id: "promotions", label: "العروض", icon: "tag" },
    { id: "target", label: "🎯 تارجت المبيعات", icon: "target" },
    { id: "treasury", label: "الخزنة", icon: "money" },
    { id: "pharmacy_settings", label: "بيانات الصيدلية", icon: "settings" },
  ];

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal',sans-serif",
        background: "#060c16",
        minHeight: "100vh",
        color: "#dde8ff",
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
          borderLeft: "1px solid #141e30",
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
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                width: "100%",
                background: tab === t.id ? "#14233a" : "transparent",
                borderRight:
                  tab === t.id ? "3px solid #2a6aef" : "3px solid transparent",
                border: "none",
                color: tab === t.id ? "#6aaeff" : "#4a6a8a",
                fontSize: 13,
                fontWeight: tab === t.id ? 700 : 400,
                cursor: "pointer",
                textAlign: "right",
                transition: "all 0.12s",
              }}
            >
              <IC n={t.icon} s={16} />
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
          ))}
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
            setTab={setTab}
            creditPayments={creditPayments}
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
          />
        )}
      </main>
    </div>
  );
}

function AlertRow({ text, badge, color, VAR }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 0", gap: 10, fontSize: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, color: VAR.text }}>{text}</div>
      <div style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: `${color}1f`, color, fontWeight: 600 }}>{badge}</div>
    </div>
  );
}
function EmptyAlertRow({ text, muted }) {
  return <div style={{ textAlign: "center", color: muted, fontSize: 11, padding: "10px 0" }}>{text}</div>;
}
function useEssentialAlerts(products) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!products || products.length === 0) return;

    const grouped = {};
    products
      .filter((p) => p.is_essential)
      .forEach((p) => {
        const key = `${p.active_ingredient} ${p.concentration}`;
        if (!grouped[key]) {
          grouped[key] = { totalStock: 0, minStock: p.min_stock || 0 };
        }
        grouped[key].totalStock += p.stock || 0;
      });

    const newAlerts = [];
    Object.entries(grouped).forEach(([name, data]) => {
      if (data.totalStock === 0) {
        newAlerts.push({ type: "danger", name });
      } else if (data.totalStock <= data.minStock) {
        newAlerts.push({ type: "warning", name, stock: data.totalStock });
      }
    });

    setAlerts(newAlerts);
  }, [products]);

  return alerts;
}
function Dashboard({
  products,
  sales,
  purchases,
  customers,
  suppliers = [],
  shifts,
  currentUser,
  setTab,
  creditPayments = [],
}) {
  const alerts = useEssentialAlerts(products);
  const [salesTab, setSalesTab] = useState("today"); // "today" | "month" | "compare"
  const [privacyMode, setPrivacyMode] = useState(true);
  const [expandedAlertGroup, setExpandedAlertGroup] = useState(null);

  // ── فرص ضائعة ──
  const [missedToday, setMissedToday] = useState({ count: 0, value: 0 });
  const [missedMonth, setMissedMonth] = useState({ count: 0, value: 0 });

  const today = new Date().toISOString().split("T")[0];
  const monthKey = today.substring(0, 7);

  useEffect(() => {
    const fetchMissed = async () => {
      const { data: todayData } = await supabase
        .from("missed_sales").select("price, qty").eq("date", today);
      if (todayData) {
        const value = todayData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedToday({ count: todayData.length, value });
      }
      const { data: monthData } = await supabase
        .from("missed_sales").select("price, qty")
        .gte("date", monthKey + "-01").lte("date", monthKey + "-31");
      if (monthData) {
        const value = monthData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedMonth({ count: monthData.length, value });
      }
    };
    fetchMissed();
  }, [today, monthKey]);

  // ── حسابات المبيعات ──
  const todaySales    = sales.filter((s) => s.date === today && !s.returned);
  const todayCashSales = todaySales.filter((s) => s.payment !== "آجل" && s.payment !== "تحصيل آجل");
  const todayCreditPaid = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todayRev = todayCashSales.reduce((a, s) => a + s.total, 0);
  const todayAjilTotal = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayAvgInvoice = todayCashSales.length > 0 ? todayRev / todayCashSales.length : 0;

  const monthSales    = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned);
  const monthCashSales = monthSales.filter((s) => s.payment !== "آجل");
  const monthRev = monthCashSales.reduce((a, s) => a + s.total, 0);
  const monthCreditCollected = creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0);
  const monthAjilTotal = monthSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const monthAvgInvoice = monthCashSales.length > 0 ? monthRev / monthCashSales.length : 0;

  // ── آخر 7 أيام للجراف ──
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const last7Data = last7Days.map((day) => {
    const daySales = sales.filter((s) => s.date === day && !s.returned && s.payment !== "آجل");
    return { day, rev: daySales.reduce((a, s) => a + s.total, 0) };
  });
  const maxRev = Math.max(...last7Data.map((d) => d.rev), 1);

  // ── آخر 6 أشهر ──
  const getLast6Months = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  };
  const last6Months = getLast6Months();
  // ربح صنف واحد داخل فاتورة = (سعر البيع - التكلفة) × الكمية
  // التكلفة تُقرأ من الـ item نفسه (مسجلة وقت البيع) وإن لم توجد (فواتير قديمة) نرجع لتكلفة الصنف الحالية كتقريب
  const getSaleItems = (s) => {
    try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
    catch { return []; }
  };
  const calcSaleProfit = (s) => {
    const items = getSaleItems(s).filter((it) => !it.isMissed); // الأصناف المفقودة (طلب بدون مخزون) مش بيع فعلي ومالهاش ربح
    const rawProfit = items.reduce((sum, it) => {
      const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
      const price = it.price ?? 0;
      return sum + (price - cost) * (it.qty || 0);
    }, 0);
    // الخصم بيتطبق على مستوى الفاتورة كلها (subtotal + ضريبة) مش موزّع على كل صنف،
    // وبما إن التكلفة ثابتة، أي خصم بيقلل الربح بقيمته بالكامل
    const discount = s.discount_amt ?? s.discountAmt ?? 0;
    return rawProfit - discount;
  };
  const monthsData = last6Months.map((mk) => {
    const mSales = sales.filter((s) => s.date?.startsWith(mk) && !s.returned);
    const mCash  = mSales.filter((s) => s.payment !== "آجل");
    const mRev   = mCash.reduce((a, s) => a + s.total, 0);
    const mPurchases = purchases.filter((p) => (p.created_at || p.date || "").startsWith(mk)).reduce((a, p) => a + (p.total || 0), 0);
    const mCreditPaid = creditPayments.filter((p) => p.date?.startsWith(mk)).reduce((a, p) => a + p.amount, 0);
    // الربح الفعلي = مجموع (سعر البيع - التكلفة) × الكمية لكل أصناف فواتير الشهر (وليس الفرق بين إجمالي البيع وإجمالي الشراء)
    const mProfit = mSales.reduce((sum, s) => sum + calcSaleProfit(s), 0);
    const label = new Date(mk + "-01").toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    return { mk, label, mRev, mPurchases, mCreditPaid, mProfit };
  });

  // ── تنبيهات الأصناف ──
  const lowStock      = products.filter((p) => p.stock <= (p.min_stock || p.minStock || 0));
  const expiringSoon  = products.filter((p) => {
    if (!p.expiry) return false;
    const diff = (new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24);
    return diff < 90 && diff > 0;
  });

  // ══════════ بيانات مركز التنبيهات ══════════
  const todayISO = new Date().toISOString().split("T")[0];

  // عروض تلقائية (غير دواء + قرب صلاحية حسب نفس قواعد قسم العروض) + عروض يدوية لا تحتاج هنا عداد دقيق (تُدار في قسمها)
  const autoPromoCandidates = products.filter((p) => {
    const cat = p.main_category || p.category || "";
    if (cat === "دواء") return false;
    if (!p.expiry) return false;
    const disc = calcAutoDiscount(p.expiry);
    return disc > 0 && (p.stock || 0) > 0;
  });

  // استحقاقات الموردين القريبة (خلال 5 أيام أو متأخرة بالفعل)
  const supplierDues = (suppliers || []).map((s) => {
    const supPurchases = (purchases || []).filter((p) => p.supplier === s.id && p.payment_status !== "مسددة");
    let nearestDue = null, isOverdue = false;
    supPurchases.forEach((po) => {
      const due = new Date(po.date);
      due.setDate(due.getDate() + (s.payment_terms || 30));
      const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
      if (nearestDue === null || daysLeft < nearestDue) nearestDue = daysLeft;
      if (daysLeft < 0) isOverdue = true;
    });
    return { supplier: s, daysLeft: nearestDue, isOverdue };
  }).filter((d) => d.daysLeft !== null && d.daysLeft <= 5);

  // عملاء جدد خلال آخر 7 أيام
  const newCustomers = (customers || []).filter((c) => {
    const created = c.created_at ? new Date(c.created_at) : null;
    if (!created) return false;
    const days = (new Date() - created) / (1000 * 60 * 60 * 24);
    return days <= 7;
  });

  // عملاء مختفون: كان عندهم تعامل سابق ومالهمش زيارة منذ أكثر من 45 يوم
  const disappearedCustomers = (customers || []).filter((c) => {
    if (!c.lastVisit) return false;
    const days = (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
    return days > 45 && days < 365 && (c.visits || 0) > 0;
  });

  // موعد إقفال الإقرار الضريبي الربعي (نهاية الشهر التالي لنهاية الربع - نظام ضريبة القيمة المضافة السعودي)
  const taxDeadlineInfo = (() => {
    const now = new Date();
    const quarterEndMonth = [2, 5, 8, 11].find((m) => m >= now.getMonth()) ?? 2; // فبراير=1 .. نهاية كل ربع
    const qEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0); // آخر يوم في الشهر التالي للربع
    const daysLeft = Math.ceil((qEnd - now) / (1000 * 60 * 60 * 24));
    return { daysLeft, date: qEnd };
  })();

  // إجمالي مركز التنبيهات
  const alertCenterGroups = [
    { key: "essential",  icon: "💊", label: "نفاذ/قرب نفاذ دواء أساسي", count: alerts.length,                 color: "#EF4444", tab: "products" },
    { key: "lowstock",   icon: "📦", label: "مخزون منخفض",              count: lowStock.length,               color: "#F59E0B", tab: "products" },
    { key: "expiry",     icon: "⏰", label: "أصناف قرب الانتهاء",        count: expiringSoon.length,           color: "#F59E0B", tab: "products" },
    { key: "supplier",   icon: "🧾", label: "استحقاق مورد قريب/متأخر",   count: supplierDues.length,           color: "#EF4444", tab: "suppliers" },
    { key: "newcust",    icon: "🆕", label: "عملاء جدد هذا الأسبوع",     count: newCustomers.length,           color: "#00C896", tab: "customers" },
    { key: "lostcust",   icon: "👻", label: "عملاء مختفون",              count: disappearedCustomers.length,   color: "#7D8590", tab: "customers" },
    { key: "tax",        icon: "🗂️", label: "موعد الإقرار الضريبي الربعي", count: taxDeadlineInfo.daysLeft <= 14 ? 1 : 0, color: "#F59E0B", tab: "tax_report" },
    { key: "appoint",    icon: "📅", label: "مواعيد مهمة (رخصة/إيجار)",  count: 2,                              color: "#00C896", tab: "dashboard" },
  ];
  // العروض التلقائية بتتطبق وبتتلغي تلقائيًا حسب الصلاحية بدون تدخل بشري — مش بند تنبيه يحتاج إجراء
  const totalAlertsCount = alertCenterGroups.reduce((a, g) => a + g.count, 0);

  // ══════════ تايم لاين حركة اليوم (بالساعة) ══════════
  const todaySalesForTimeline = sales.filter((s) => s.date === todayISO && !s.returned);
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, rev: 0 }));
  todaySalesForTimeline.forEach((s) => {
    const t = s.created_at || s.time || null;
    const h = t ? new Date(t).getHours() : null;
    if (h === null || isNaN(h)) return;
    hourBuckets[h].count += 1;
    hourBuckets[h].rev += s.total || 0;
  });
  const activeHours = hourBuckets.filter((b) => b.hour >= 7 && b.hour <= 23); // ساعات عمل الصيدلية المعتادة
  const maxHourCount = Math.max(...activeHours.map((b) => b.count), 1);

  // ── معلومات الشفت الحالي ──
  const currentShift = shifts?.find((s) => !s.end_time) || null;
  const shiftSales   = currentShift
    ? sales.filter((s) => s.shift_id === currentShift.id && !s.returned)
    : [];
  const shiftItems   = shiftSales.flatMap((s) => {
    try { return typeof s.items === "string" ? JSON.parse(s.items) : s.items || []; }
    catch { return []; }
  });
  const avgItemsPerInvoice = shiftSales.length > 0 ? (shiftItems.length / shiftSales.length).toFixed(1) : 0;

  // ── helpers ──
  const S = (val) => privacyMode
    ? <span style={{ filter: "blur(6px)", userSelect: "none" }}>{val}</span>
    : val;

  const VAR = {
    bg:       "#0D1117",
    surface:  "#161B22",
    surface2: "#1C2330",
    border:   "#21262D",
    accent:   "#00C896",
    accent2:  "#3B82F6",
    warn:     "#F59E0B",
    danger:   "#EF4444",
    text:     "#E6EDF3",
    muted:    "#7D8590",
  };

  const card = {
    background: VAR.surface,
    border: `1px solid ${VAR.border}`,
    borderRadius: 12,
    overflow: "hidden",
  };

  const SALES_TABS = [
    { key: "today",   label: "اليوم" },
    { key: "month",   label: "الشهر" },
    { key: "compare", label: "المقارنة" },
  ];

  // ── محتوى تاب المبيعات ──
  const renderSalesStats = () => {
    if (salesTab === "compare") {
      const maxVal = Math.max(...monthsData.map((m) => m.mRev), 1);
      return (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr style={{ background: VAR.bg }}>
                  {["الشهر","المبيعات","المشتريات","السداد","الربح"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "right", color: VAR.muted, fontSize: 11, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthsData.map((m) => (
                  <tr key={m.mk} style={{ borderBottom: `1px solid ${VAR.border}`, background: m.mk === monthKey ? "#0d1f2d" : "transparent" }}>
                    <td style={{ padding: "9px 12px", color: VAR.text, fontWeight: m.mk === monthKey ? 700 : 400, fontSize: 12 }}>
                      {m.label} {m.mk === monthKey && "🔵"}
                    </td>
                    <td style={{ padding: "9px 12px", color: VAR.accent, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mRev.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: VAR.danger, fontFamily: "monospace", fontSize: 12 }}>{S(m.mPurchases.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: VAR.warn, fontFamily: "monospace", fontSize: 12 }}>{S(m.mCreditPaid.toFixed(0))}</td>
                    <td style={{ padding: "9px 12px", color: m.mProfit >= 0 ? VAR.accent : VAR.danger, fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{S(m.mProfit.toFixed(0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {monthsData.map((m) => (
              <div key={m.mk} style={{ marginBottom: 8 }}>
                <div style={{ color: VAR.muted, fontSize: 10, marginBottom: 2 }}>{m.label}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                    <div style={{ background: VAR.accent, height: "100%", borderRadius: 3, width: `${(m.mRev / maxVal) * 100}%` }} />
                  </div>
                  <div style={{ flex: 1, background: VAR.bg, borderRadius: 3, height: 6 }}>
                    <div style={{ background: VAR.danger, height: "100%", borderRadius: 3, width: `${(m.mPurchases / maxVal) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
              <span style={{ color: VAR.accent, fontSize: 10 }}>■ مبيعات</span>
              <span style={{ color: VAR.danger, fontSize: 10 }}>■ مشتريات</span>
            </div>
          </div>
        </>
      );
    }

    const isToday    = salesTab === "today";
    const rev        = isToday ? todayRev : monthRev;
    const invoices   = isToday ? todayCashSales : monthCashSales;
    const missed     = isToday ? missedToday.value : missedMonth.value;
    const missedCnt  = isToday ? missedToday.count : missedMonth.count;
    const avgInv     = isToday ? todayAvgInvoice : monthAvgInvoice;
    const creditPaid = isToday ? todayCreditPaid : monthCreditCollected;
    const ajilTotal  = isToday ? todayAjilTotal  : monthAjilTotal;

    return (
      <>
        {/* 4 stat cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: `1px solid ${VAR.border}` }}>
          {[
            { label: "إجمالي المبيعات", val: rev.toFixed(0) + " ر.س", color: VAR.accent, sub: `${invoices.length} فاتورة` },
            { label: "سداد الآجل",      val: creditPaid.toFixed(0) + " ر.س", color: VAR.accent2, sub: `مديونية ${ajilTotal.toFixed(0)}` },
            { label: "الفرص الضائعة",   val: missed.toFixed(0) + " ر.س", color: VAR.warn, sub: `${missedCnt} صنف مفقود` },
            { label: "متوسط الفاتورة",  val: avgInv.toFixed(1) + " ر.س", color: VAR.text, sub: "ريال" },
          ].map((cell, i) => (
            <div key={i} style={{ padding: "14px 16px", borderLeft: i < 3 ? `1px solid ${VAR.border}` : "none" }}>
              <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600, marginBottom: 4, letterSpacing: "0.05em" }}>
                {cell.label}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: cell.color }}>
                {S(cell.val)}
              </div>
              <div style={{ fontSize: 10, color: VAR.muted, marginTop: 3 }}>{S(cell.sub)}</div>
            </div>
          ))}
        </div>

        {/* Bar chart - آخر 7 أيام */}
        <div style={{ padding: "12px 16px", height: 100, display: "flex", alignItems: "flex-end", gap: 6 }}>
          {last7Data.map((d, i) => {
            const isToday2 = d.day === today;
            const h = `${Math.max((d.rev / maxRev) * 76, 4)}px`;
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{
                  width: "100%", height: h, borderRadius: "4px 4px 0 0",
                  background: isToday2
                    ? `linear-gradient(to top, ${VAR.accent}, ${VAR.accent2})`
                    : VAR.surface2,
                  boxShadow: isToday2 ? `0 0 10px rgba(0,200,150,0.3)` : "none",
                  transition: "height 0.4s",
                }} />
                <div style={{ fontSize: 9, color: isToday2 ? VAR.accent : VAR.muted, fontFamily: "monospace" }}>
                  {isToday2 ? "اليوم" : d.day.slice(8)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ── Alert Strip (مختصر يفتح مركز التنبيهات) ── */}
      {totalAlertsCount > 0 && (
        <div style={{
          background: "linear-gradient(90deg, rgba(239,68,68,0.12), transparent)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12, fontSize: 13,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1, color: VAR.muted }}>
            <strong style={{ color: VAR.danger }}>{totalAlertsCount} تنبيه تحتاج تدخل</strong>
            <span style={{ color: VAR.muted }}> — راجع مركز التنبيهات بالأسفل</span>
          </div>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            style={{
              background: VAR.surface2, border: `1px solid ${VAR.border}`,
              borderRadius: 8, padding: "4px 12px", fontSize: 11,
              color: VAR.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontFamily: "inherit",
            }}
          >
            {privacyMode ? "🙈 إظهار" : "👁 إخفاء"}
          </button>
        </div>
      )}

      {/* ── ROW 1: إحصائيات المبيعات + تارجت الشهر ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
        إحصائيات المبيعات
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>

        {/* Sales Stats Card */}
        <div style={{ ...card }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${VAR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>المبيعات والفرص</div>
            <div style={{ display: "flex", background: VAR.surface2, borderRadius: 8, padding: 2, gap: 2 }}>
              {SALES_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSalesTab(t.key)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                    background: salesTab === t.key ? VAR.accent : "transparent",
                    color: salesTab === t.key ? VAR.bg : VAR.muted,
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {renderSalesStats()}
        </div>

        {/* Target Card */}
        <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: VAR.muted }}>تارجت الشهر</div>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: VAR.accent, lineHeight: 1 }}>
              {S("73%")}
            </div>
            <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>{S("من 80,000 ريال")}</div>
          </div>
          <div style={{ height: 6, background: VAR.surface2, borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: "73%", borderRadius: 99,
              background: `linear-gradient(90deg, ${VAR.accent2}, ${VAR.accent})`,
              boxShadow: "0 0 8px rgba(0,200,150,0.4)",
            }} />
          </div>
          <div style={{ fontSize: 11, color: VAR.muted }}>
            متبقي <strong style={{ color: VAR.warn }}>{S("21,600 ريال")}</strong> في 11 يوم
          </div>
          <div style={{ borderTop: `1px solid ${VAR.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: VAR.muted, marginBottom: 4 }}>المطلوب يومياً</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, color: VAR.warn, fontWeight: 700 }}>
              {S("1,963")} <span style={{ fontSize: 12, color: VAR.muted }}>ريال</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 1.5: تايم لاين حركة اليوم ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        حركة اليوم بالساعة
      </div>
      <div style={{ ...card, padding: "16px 16px 12px", marginBottom: 12 }}>
        {todaySalesForTimeline.length === 0 ? (
          <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
            لا توجد مبيعات مسجّلة اليوم بعد
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
              {activeHours.map((b) => {
                const intensity = b.count / maxHourCount; // 0..1
                const h = `${Math.max(intensity * 56, b.count > 0 ? 6 : 2)}px`;
                // ألوان متدرجة زي خرائط جوجل: فاتح = هادئ، غامق/أخضر مشبع = ذروة
                const bg = b.count === 0
                  ? VAR.surface2
                  : intensity > 0.66 ? VAR.accent
                  : intensity > 0.33 ? "#3B82F6"
                  : "#1f4f6e";
                return (
                  <div key={b.hour} title={`${b.hour}:00 — ${b.count} فاتورة، ${b.rev.toFixed(0)} ر.س`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: bg, transition: "height 0.3s" }} />
                    <div style={{ fontSize: 8, color: VAR.muted, fontFamily: "monospace" }}>{b.hour}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: VAR.muted, marginTop: 10 }}>
              مبني على بيانات اليوم الحالي فقط — مع تراكم أكثر من بضعة أسابيع هيتحول لمتوسط "أكثر أوقات الازدحام" زي خرائط جوجل
            </div>
          </>
        )}
      </div>

      {/* ── ROW 2: مركز التنبيهات ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        مركز التنبيهات
      </div>
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${VAR.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text, display: "flex", alignItems: "center", gap: 6 }}>
            🔔 مركز التنبيهات
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(239,68,68,0.15)", color: VAR.danger, fontFamily: "monospace" }}>
              {totalAlertsCount}
            </span>
          </div>
        </div>
        <div>
          {totalAlertsCount === 0 && (
            <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "20px 0" }}>
              لا توجد تنبيهات حالياً ✅
            </div>
          )}
          {alertCenterGroups.filter((g) => g.count > 0).map((g) => (
            <div key={g.key}>
              <div
                onClick={() => setExpandedAlertGroup(expandedAlertGroup === g.key ? null : g.key)}
                style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, borderBottom: `1px solid ${VAR.border}`, fontSize: 12, cursor: "pointer" }}
              >
                <span style={{ fontSize: 14 }}>{g.icon}</span>
                <div style={{ flex: 1, color: VAR.text, fontWeight: 600 }}>{g.label}</div>
                <div style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 700, fontFamily: "monospace",
                  background: g.count > 0 ? `${g.color}26` : "rgba(125,133,144,0.12)",
                  color: g.count > 0 ? g.color : VAR.muted,
                }}>
                  {g.count}
                </div>
                <span style={{ color: VAR.muted, fontSize: 11 }}>{expandedAlertGroup === g.key ? "▲" : "▼"}</span>
                <span onClick={(e) => { e.stopPropagation(); setTab(g.tab); }} style={{ color: VAR.accent2, fontSize: 11 }}>فتح →</span>
              </div>
              {expandedAlertGroup === g.key && (
                <div style={{ background: VAR.bg, padding: "8px 14px 12px" }}>
                  {g.key === "essential" && (
                    alerts.length === 0 ? <EmptyAlertRow text="لا توجد أدوية أساسية ناقصة ✅" muted={VAR.muted} /> :
                    alerts.map((a, i) => (
                      <AlertRow key={i} text={a.name} badge={a.type === "danger" ? "نافذ" : `متبقي ${a.stock}`} color={a.type === "danger" ? VAR.danger : VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "lowstock" && (
                    lowStock.length === 0 ? <EmptyAlertRow text="لا يوجد مخزون منخفض ✅" muted={VAR.muted} /> :
                    lowStock.slice(0, 8).map((p) => (
                      <AlertRow key={p.id} text={p.name} badge={`${p.stock} / ${p.min_stock || p.minStock || 0}`} color={VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "expiry" && (
                    expiringSoon.length === 0 ? <EmptyAlertRow text="لا توجد أصناف قرب الانتهاء ✅" muted={VAR.muted} /> :
                    expiringSoon.slice(0, 8).map((p) => {
                      const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                      return <AlertRow key={p.id} text={p.name} badge={days < 30 ? `${days} يوم` : `${Math.ceil(days / 30)} شهر`} color={VAR.warn} VAR={VAR} />;
                    })
                  )}
                  {g.key === "supplier" && (
                    supplierDues.length === 0 ? <EmptyAlertRow text="لا توجد استحقاقات قريبة" muted={VAR.muted} /> :
                    supplierDues.slice(0, 8).map((d) => (
                      <AlertRow key={d.supplier.id} text={d.supplier.name} badge={d.isOverdue ? `متأخر ${Math.abs(d.daysLeft)} يوم` : `خلال ${d.daysLeft} يوم`} color={d.isOverdue ? VAR.danger : VAR.warn} VAR={VAR} />
                    ))
                  )}
                  {g.key === "newcust" && (
                    newCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء جدد هذا الأسبوع" muted={VAR.muted} /> :
                    newCustomers.slice(0, 8).map((c) => (
                      <AlertRow key={c.id} text={c.name} badge="جديد" color={VAR.accent} VAR={VAR} />
                    ))
                  )}
                  {g.key === "lostcust" && (
                    disappearedCustomers.length === 0 ? <EmptyAlertRow text="لا يوجد عملاء مختفون" muted={VAR.muted} /> :
                    disappearedCustomers.slice(0, 8).map((c) => (
                      <AlertRow key={c.id} text={c.name} badge={`آخر زيارة ${c.lastVisit}`} color={VAR.muted} VAR={VAR} />
                    ))
                  )}
                  {g.key === "tax" && (
                    <AlertRow text="الإقرار الضريبي الربعي القادم" badge={`خلال ${taxDeadlineInfo.daysLeft} يوم`} color={taxDeadlineInfo.daysLeft <= 7 ? VAR.danger : VAR.warn} VAR={VAR} />
                  )}
                  {g.key === "appoint" && (
                    <>
                      <AlertRow text="تجديد الرخصة التجارية" badge="18 يوم" color={VAR.accent} VAR={VAR} />
                      <AlertRow text="إيجار الصيدلية" badge="غداً" color={VAR.warn} VAR={VAR} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 3: الشفت الحالي + الخزنة + إجراءات سريعة ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        الشفت الحالي والخزنة
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>

        {/* بطاقة الصيدلي */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${VAR.border}` }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg, ${VAR.accent}, ${VAR.accent2})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: VAR.bg, flexShrink: 0,
            }}>
              {currentUser?.name?.[0] || "م"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{currentUser?.name || "الصيدلي"}</div>
              <div style={{ fontSize: 10, color: VAR.muted }}>
                {currentShift ? `شفت نشط · بدأ ${new Date(currentShift.start_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : "لا يوجد شفت مفتوح"}
              </div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: VAR.accent }}>
              {S(`${shiftSales.length}`)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: VAR.border }}>
            {[
              { label: "فواتير الشفت",           val: shiftSales.length },
              { label: "متوسط الأصناف/فاتورة",   val: avgItemsPerInvoice },
              { label: "عملاء مسجلين",            val: shiftSales.filter((s) => s.customer_id).length + " / " + shiftSales.length },
              { label: "مبيعات الشفت",            val: S(shiftSales.reduce((a, s) => a + s.total, 0).toFixed(0) + " ر.س") },
            ].map((stat, i) => (
              <div key={i} style={{ background: VAR.surface, padding: "8px 14px" }}>
                <div style={{ fontSize: 10, color: VAR.muted }}>{stat.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 600, color: VAR.text, marginTop: 2 }}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* خزنة اليوم */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, color: VAR.muted, fontWeight: 600, marginBottom: 12 }}>خزنة اليوم</div>
          {[
            { label: "مبيعات كاش",    val: todayRev.toFixed(0),        type: "in" },
            { label: "شبكة / صراف",   val: "0",                        type: "in" },
            { label: "سداد الآجل",    val: todayCreditPaid.toFixed(0), type: "in" },
            { label: "مصاريف نثرية",  val: "0",                        type: "out" },
          ].map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${VAR.border}`, fontSize: 12 }}>
              <span style={{ color: VAR.muted }}>{row.label}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, color: row.type === "in" ? VAR.accent : VAR.danger }}>
                {row.type === "in" ? "+" : "-"} {S(row.val)}
              </span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", fontSize: 13, marginTop: 4, borderTop: `1px solid ${VAR.accent}` }}>
            <span style={{ color: VAR.text, fontWeight: 700 }}>صافي اليوم</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: VAR.text, fontSize: 16 }}>
              + {S((todayRev + todayCreditPaid).toFixed(0))}
            </span>
          </div>
        </div>

        {/* إجراءات سريعة */}
        <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: VAR.muted, marginBottom: 2 }}>إجراءات سريعة</div>
          {[
            { icon: "💊", label: "فاتورة بيع جديدة",  tab: "pos",       bg: "rgba(0,200,150,0.15)" },
            { icon: "📦", label: "استلام مشتريات",     tab: "purchases", bg: "rgba(59,130,246,0.15)" },
            { icon: "🔄", label: "تسجيل مرتجع",        tab: "returns",   bg: "rgba(245,158,11,0.15)" },
            { icon: "🔒", label: "تقفيل الشفت",         tab: "shifts",    bg: "rgba(239,68,68,0.15)" },
          ].map((btn) => (
            <button
              key={btn.tab}
              onClick={() => setTab(btn.tab)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: VAR.surface2, border: `1px solid ${VAR.border}`,
                cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                color: VAR.text, fontWeight: 600, transition: "border-color 0.15s",
                textAlign: "right",
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = VAR.accent}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = VAR.border}
            >
              <div style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: btn.bg }}>
                {btn.icon}
              </div>
              {btn.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}// ==================== FIFO Helper ====================
function sellFromBatches(product, qtyToSell) {
  const batches = product.batches?.length
    ? [...product.batches]
    : product.stock > 0
    ? [
        {
          qty: product.stock,
          cost: product.cost,
          salePrice: product.price,
          date: "قديم",
        },
      ]
    : [];

  let remaining = qtyToSell;
  const soldBatches = [];

  for (let i = 0; i < batches.length && remaining > 0; i++) {
    const take = Math.min(batches[i].qty, remaining);
    soldBatches.push({ ...batches[i], qtySold: take });
    batches[i] = { ...batches[i], qty: batches[i].qty - take };
    remaining -= take;
  }

  const updatedBatches = batches.filter((b) => b.qty > 0);
  const salePrice = soldBatches[0]?.salePrice ?? product.price;

  return { updatedBatches, salePrice, soldBatches };
}
// ==================== POS ====================
const MAX_INVOICES = 8;

const emptyInvoice = () => ({
  cart: [],
  selCustomer: null,
  payment: "نقدي",
  discount: 0,
  prescriptionImg: null,
  search: "",
  success: false,
  showJoker: false,
  jokerName: "",
  jokerPrice: "",
  openedAt: Date.now(),
});

function POS({
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
}) {
  const [showPrint, setShowPrint] = useState(null);
  const fileRef = useRef();
  const [fifoResults, setFifoResults] = useState({});
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [autoSaveWarning, setAutoSaveWarning] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState(180);
  const autoSaveTimerRef = useRef(null);
  const autoSaveCountdownRef = useRef(null);
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
    // للجوكر والفرص الضائعة — تجاوز فحص المخزون
    if (!p.isMissed && !p.isJoker) {
      // حساب الـ stock الفعلي بالوحدة المطلوبة
      const effectiveStock =
        p.isPartial && p.unitDivision > 1 ? p.stock * p.unitDivision : p.stock;

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
        // حساب الحد الأقصى
        const prod = products.find((x) => x.id === p.id);
        const maxQty =
          p.isPartial && p.unitDivision > 1
            ? prod?.stock * p.unitDivision // 1 علبة × 100 = 100 حبة
            : prod?.stock || 99;
        const step = p.isPartial ? 1 / p.unitDivision : 1;

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
      const initQty = p.isPartial
        ? Math.round((1 / p.unitDivision) * 10000) / 10000
        : 1;
      return {
        ...prev,
        cart: [...prev.cart, { ...p, qty: initQty, dose: "" }],
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
    const str = (v) => (v == null ? "" : String(v));
    return (
      (p.name||"").includes(inv.search) ||
(p.barcode||"").includes(inv.search) ||
(p.id||"").includes(inv.search)
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
    Math.round((((subtotal + taxAmount) * inv.discount) / 100) * 100) / 100;
  const total = subtotal + taxAmount - discountAmt;
  {
    missedTotal > 0 && (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#ffaa44",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        <span>⚠ فرص ضائعة</span>
        <span>{missedTotal.toFixed(2)} ر.س</span>
      </div>
    );
  }
  const completeSale = async () => {
    if (!currentShift) {
      showToast("يرجى فتح شفت أولاً", "error");
      return;
    }
    if (inv.cart.length === 0) {
      showToast("السلة فارغة!", "error");
      return;
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
        newFifoResults[ci.id] = sellFromBatches(prod, ci.qty);
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
        qty: i.qty,
        price: newFifoResults[i.id]?.salePrice ?? i.price,
        cost: newFifoResults[i.id]?.soldBatches?.[0]?.cost ?? products.find((x) => x.id === i.id)?.cost ?? 0,
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
        category: i.main_category || i.mainCategory || i.category || "أخرى", // ✅ أضف هذ
      })),
      subtotal,
      tax_amount: taxAmount,
      discount_amt: discountAmt,
      total,
      payment: inv.payment,
      shift: currentShift?.id,
      returned: false,
      pharmacy_id: pharmacyId,
      cashier_name: currentUser?.name || "",
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
            stock: prod.stock - ci.qty,
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
    // تسجيل الفرص الضائعة
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
                background: activeTab === i ? "#142a5a" : "#0a0f1c",
                border: `1px solid ${activeTab === i ? "#2a6aef" : "#1d2d4a"}`,
                borderLeft: "none",
                color: activeTab === i ? "#6aaeff" : "#4a6a8a",
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
                background: activeTab === i ? "#142a5a" : "#0a0f1c",
                border: `1px solid ${activeTab === i ? "#2a6aef" : "#1d2d4a"}`,
                color: "#5a2a2a",
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
              background: "#0a1a2a",
              border: "1px dashed #1d3a5a",
              color: "#3a6a9a",
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
            background: "#2a1500",
            border: "1px solid #f59e0b",
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fcd34d",
            fontSize: 13,
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
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flex: 1,
        }}
      >
        {/* بحث */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1d2d4a",
            display: "flex",
            flexDirection: "column",
            gap: 8,
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
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: "#dde8ff",
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
                background: "#2a1a00",
                border: "1px solid #7a4a00",
                color: "#ffaa44",
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
                    color: "#ffaa44",
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
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: "#dde8ff",
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
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: "#dde8ff",
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
                      background: "#2a1a00",
                      border: "1px solid #7a4a00",
                      borderRadius: 7,
                      color: "#ffaa44",
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
                      color: "#4a6a8a",
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
                  background: "#0f1623",
                  border: "1px solid #1d2d4a",
                  borderRadius: 8,
                  zIndex: 100,
                  maxHeight: 200,
                  overflowY: "auto",
                  marginTop: 4,
                }}
              >
                {filtered.slice(0, 8).map((p, idx) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "8px 14px",
                      cursor: p.stock === 0 ? "not-allowed" : "pointer",
                      opacity: p.stock === 0 ? 0.5 : 1,
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
                    {/* الصف الأول: اسم الصنف والأزرار */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: p.isMissed ? "#ffaa44" : "#dde8ff",
                            textDecoration: p.isMissed
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {p.nameAr || p.name}
                          {p.isPartial && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#44dd88",
                                marginRight: 6,
                              }}
                            >
                              ({p.partialLabel})
                            </span>
                          )}
                          {p.isMissed && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#ffaa44",
                                marginRight: 6,
                              }}
                            >
                              ⚠ فرصة ضائعة
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#4a6a8a" }}>
                          {p.mainCategory || p.category} | مخزون: {p.stock}
                          {p.unitDivision > 1 && (
                            <span style={{ color: "#f59e0b", marginRight: 6 }}>
                              ÷{p.unitDivision}
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 5,
                          alignItems: "center",
                        }}
                      >
                        {/* زر وحدة كاملة */}
                        <button
                          onClick={() => {
                            if (p.stock > 0) {
                              addToCart({ ...p, isPartial: false });
                              setInv((x) => ({ ...x, search: "" }));
                            }
                          }}
                          disabled={p.stock === 0}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "#142a5a",
                            border: "1px solid #2a6aef",
                            color: "#6aaeff",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: p.stock === 0 ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.price?.toFixed(2)} ر.س
                        </button>

                        {/* زر جزء - لو unitDivision > 1 */}
                        {p.unitDivision > 1 && (
                          <button
                            onClick={() => {
                              if (p.stock > 0) {
                                const partialQty =
                                  Math.round((1 / p.unitDivision) * 10000) /
                                  10000;
                                const partialPrice =
                                  Math.round((p.price / p.unitDivision) * 100) /
                                  100;
                                addToCart({
                                  ...p,
                                  qty: partialQty,
                                  price: partialPrice,
                                  isPartial: true,
                                  partialLabel: `1/${p.unitDivision}`,
                                });
                                setInv((x) => ({ ...x, search: "" }));
                              }
                            }}
                            disabled={p.stock === 0}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "#0a2a10",
                              border: "1px solid #2a6a2a",
                              color: "#44dd88",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: p.stock === 0 ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            1/{p.unitDivision} —{" "}
                            {(p.price / p.unitDivision).toFixed(2)} ر.س
                          </button>
                        )}

                        {/* زر فرصة ضائعة */}
                        <button
                          onClick={() => {
                            addToCart({ ...p, isMissed: true, qty: 1 });
                            setInv((x) => ({ ...x, search: "" }));
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "#2a1a00",
                            border: "1px solid #7a4a00",
                            color: "#ffaa44",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                          title="تسجيل كفرصة ضائعة"
                        >
                          ⚠ فائت
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div
                    style={{
                      padding: 12,
                      color: "#4a6a8a",
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

        {/* العميل */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #1d2d4a",
            display: "flex",
            gap: 8,
          }}
        >
          <select
            value={inv.selCustomer ? String(inv.selCustomer.id) : ""}
            onChange={(e) =>
              setInv((p) => ({
                ...p,
                selCustomer:
                  customers.find((c) => String(c.id) === e.target.value) ||
                  null,
              }))
            }
            style={{
              flex: 1,
              background: "#080e1a",
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "7px 10px",
              color: "#dde8ff",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="">زبون عادي</option>
            {customers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
                {c.taxId ? ` — ${c.taxId}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => fileRef.current.click()}
            style={{
              padding: "7px 12px",
              background: "#0a1a2a",
              border: "1px dashed #1d3a5a",
              borderRadius: 8,
              color: inv.prescriptionImg ? "#44dd88" : "#4a6a8a",
              cursor: "pointer",
              fontSize: 12,
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
        <div style={{ flex: 2, overflowY: "auto", padding: "6px 16px" }}>
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
                        color: "#4a6a8a",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inv.cart.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #0a101a" }}
                  >
                    <td style={{ padding: "8px 4px" }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#dde8ff",
                        }}
                      >
                        {item.name}
                      </div>
                      <input
                        value={item.dose}
                        onChange={(e) =>
                          setInv((p) => ({
                            ...p,
                            cart: p.cart.map((i) =>
                              i.id === item.id
                                ? { ...i, dose: e.target.value }
                                : i
                            ),
                          }))
                        }
                        placeholder="الجرعة..."
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid #1a2a4a",
                          color: "#6a8aaa",
                          fontSize: 11,
                          outline: "none",
                          padding: "2px 0",
                        }}
                      />
                      {item.expiry && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#ffaa44",
                            marginTop: 2,
                          }}
                        >
                          ينتهي: {item.expiry}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px 4px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        <button
                          onClick={() =>
                            setInv((p) => ({
                              ...p,
                              cart: p.cart.map((i) =>
                                i.id === item.id
                                  ? { ...i, qty: Math.max(1, i.qty - 1) }
                                  : i
                              ),
                            }))
                          }
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: "#1a2540",
                            border: "none",
                            color: "#5a9aff",
                            cursor: "pointer",
                          }}
                        >
                          -
                        </button>
                        <span
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowRight") {
                              e.preventDefault();
                              setInv((p) => ({
                                ...p,
                                cart: p.cart.map((i) => {
                                  if (i.id !== item.id) return i;
                                  const prod = products.find(
                                    (x) => x.id === i.id
                                  );
                                  const maxQty =
                                    i.isPartial && i.unitDivision > 1
                                      ? prod?.stock * i.unitDivision
                                      : prod?.stock || 99;
                                  const step = i.isPartial
                                    ? 1 / i.unitDivision
                                    : 1;
                                  return {
                                    ...i,
                                    qty: Math.min(
                                      Math.round((i.qty + step) * 10000) /
                                        10000,
                                      maxQty
                                    ),
                                  };
                                }),
                              }));
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              setInv((p) => ({
                                ...p,
                                cart: p.cart.map((i) => {
                                  if (i.id !== item.id) return i;
                                  const step = i.isPartial
                                    ? 1 / i.unitDivision
                                    : 1;
                                  return {
                                    ...i,
                                    qty: Math.max(
                                      step,
                                      Math.round((i.qty - step) * 10000) / 10000
                                    ),
                                  };
                                }),
                              }));
                            }
                          }}
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#dde8ff",
                            minWidth: 20,
                            textAlign: "center",
                            outline: "none",
                            cursor: "default",
                          }}
                          title="← → لتغيير الكمية"
                        >
                          {item.qty}
                        </span>
                        <button
                          onClick={() =>
                            setInv((p) => ({
                              ...p,
                              cart: p.cart.map((i) =>
                                i.id === item.id
                                  ? {
                                      ...i,
                                      qty: Math.min(
                                        Math.round(
                                          (i.qty +
                                            (i.isPartial
                                              ? 1 / i.unitDivision
                                              : 1)) *
                                            10000
                                        ) / 10000,
                                        i.isPartial && i.unitDivision > 1
                                          ? products.find((x) => x.id === i.id)
                                              ?.stock * i.unitDivision || 99
                                          : products.find((x) => x.id === i.id)
                                              ?.stock || 99
                                      ),
                                    }
                                  : i
                              ),
                            }))
                          }
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: "#1a2540",
                            border: "none",
                            color: "#5a9aff",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        padding: "8px 4px",
                        color: "#2a9aff",
                        fontSize: 13,
                      }}
                    >
                      {/* ← عرض سعر البيع من الدفعة الأقدم */}
                      {(
                        fifoResults?.[item.id]?.salePrice ?? item.price
                      ).toFixed(2)}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        padding: "8px 4px",
                        color: "#dde8ff",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {(
                        (fifoResults?.[item.id]?.salePrice ?? item.price) *
                        item.qty
                      ).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() =>
                          setInv((p) => ({
                            ...p,
                            cart: p.cart.filter((i) => i.id !== item.id),
                          }))
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#5a2a2a",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* الإجمالي */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #1d2d4a",
            background: "#080e1a",
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["نقدي", "بطاقة", "تحويل", "آجل"].map((m) => (
              <button
                key={m}
                onClick={() => setInv((p) => ({ ...p, payment: m }))}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 7,
                  border: "1px solid",
                  borderColor: inv.payment === m ? "#2a6aef" : "#1d2d4a",
                  background: inv.payment === m ? "#142a5a" : "transparent",
                  color: inv.payment === m ? "#6aaeff" : "#4a6a8a",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <label style={{ color: "#4a6a8a", fontSize: 12 }}>خصم %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={inv.discount}
              onChange={(e) =>
                setInv((p) => ({ ...p, discount: +e.target.value }))
              }
              style={{
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 7,
                padding: "6px 10px",
                color: "#dde8ff",
                fontSize: 13,
                outline: "none",
                width: 70,
              }}
            />
            {inv.cart.length > 0 && (
              <button
                onClick={() => setInv((p) => ({ ...p, cart: [] }))}
                style={{
                  marginRight: "auto",
                  background: "transparent",
                  border: "none",
                  color: "#5a2a2a",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                🗑 مسح الكل
              </button>
            )}
          </div>
          <div
            style={{
              background: "#0a1020",
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#4a6a8a",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              <span>قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#88dd44",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              <span>ضريبة 15%</span>
              <span>{taxAmount.toFixed(2)} ر.س</span>
            </div>
            {inv.discount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#ffaa44",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>خصم {inv.discount}%</span>
                <span>- {discountAmt.toFixed(2)} ر.س</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#dde8ff",
                fontSize: 18,
                fontWeight: 800,
                borderTop: "1px solid #1d2d4a",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
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
function PrintReceipt({ invoice, onClose }) {
  const printArea = useRef();
  const doPrint = () => {
    const w = window.open("", "_blank", "width=400,height=700");
    w.document.write(
      `<html dir="rtl"><head><style>body{font-family:'Tajawal',Arial,sans-serif;margin:0;padding:16px;font-size:13px;color:#000;background:#fff}h2{margin:4px 0;font-size:16px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px}hr{border:1px dashed #999}.total{font-weight:700;font-size:15px}.dose{font-size:11px;color:#555;font-style:italic}.header{text-align:center;margin-bottom:12px}@media print{body{padding:0}}</style></head><body>${printArea.current.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };
  return (
    <Modal open title="معاينة الفاتورة / وصفة الجرعات" onClose={onClose}>
      <div
        ref={printArea}
        style={{
          background: "#fff",
          color: "#000",
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          fontFamily: "Tajawal,Arial,sans-serif",
          fontSize: 13,
        }}
      >
        <div
          className="header"
          style={{ textAlign: "center", marginBottom: 12 }}
        >
          <h2 style={{ margin: "4px 0", fontSize: 16 }}>صيدلية برو</h2>
          <div style={{ fontSize: 11, color: "#555" }}>
            فاتورة مبيعات رقم: {invoice.id}
          </div>
          <div style={{ fontSize: 11, color: "#555" }}>
            التاريخ: {invoice.date} | الدفع: {invoice.payment}
          </div>
          // ✅
          {invoice.customer_name && invoice.customer_name !== "زبون عادي" && (
            <div style={{ fontSize: 11 }}>العميل: {invoice.customer_name}</div>
          )}
          <hr />
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "right" }}>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i}>
                <td>
                  <div>{item.name}</div>
                  {item.dose && (
                    <div
                      className="dose"
                      style={{
                        fontSize: 11,
                        color: "#555",
                        fontStyle: "italic",
                      }}
                    >
                      ▸ {item.dose}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "center" }}>{item.qty}</td>
                <td style={{ textAlign: "center" }}>{item.price}</td>
                <td style={{ textAlign: "center" }}>
                  {(item.price * item.qty).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span>قبل الضريبة</span>
          <span>{(invoice.subtotal || 0).toFixed(2)} ر.س</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ضريبة 15%</span>
          <span>
            {(invoice.taxAmount || invoice.tax_amount || 0).toFixed(2)} ر.س
          </span>
        </div>
        {invoice.discountAmt > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>خصم</span>
            <span>
              - {invoice.discountAmt || invoice.discount_amt || 0} ر.س
            </span>
          </div>
        )}
        <div
          className="total"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 15,
            borderTop: "2px solid #000",
            paddingTop: 6,
            marginTop: 4,
          }}
        >
          <span>الإجمالي</span>
          <span>{invoice.total.toFixed(2)} ر.س</span>
        </div>
        {invoice.prescriptionImg && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>
              صورة الوصفة الطبية:
            </div>
            <img
              src={invoice.prescriptionImg}
              style={{
                maxWidth: "100%",
                maxHeight: 150,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
              alt="وصفة"
            />
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <QRCodeSVG
            value={`${invoice.date}|${(invoice.total || 0).toFixed(2)}|${(
              invoice.taxAmount ||
              invoice.tax_amount ||
              0
            ).toFixed(2)}`}
            size={100}
          />
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            شكراً لزيارتكم • صيدلية برو
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>
          إغلاق
        </Btn>
        <Btn icon="print" onClick={doPrint}>
          طباعة
        </Btn>
      </div>
    </Modal>
  );
}
// ==================== Pharmacy Settings ====================
const getPharmacySettings = async () => {
  try {
    const { data } = await supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("id", "main")
      .single();
    return data || {};
  } catch {
    return {};
  }
};

function PharmacySettings({ showToast, pharmacyId }) {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .single()
      .then(({ data }) => {
        if (data) setSettings({
          nameAr: data.name_ar || data.name || "",
          nameEn: data.name_en || "",
          phone: data.phone || "",
          address: data.address || "",
          vatNumber: data.tax_number || "",
          licenseNumber: data.license_number || "",
          labelSize: data.label_size || "50x30",
        });
      });
  }, [pharmacyId]);

  const fields = [
    { key: "nameAr", label: "اسم الصيدلية (عربي)" },
    { key: "nameEn", label: "Pharmacy Name (English)" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "address", label: "العنوان" },
    { key: "vatNumber", label: "الرقم الضريبي" },
    { key: "licenseNumber", label: "رقم الترخيص" },
  ];

  const LABEL_SIZES = [
    { id: "40x25", label: "40×25 mm (صغير)", w: 40, h: 25 },
    { id: "50x30", label: "50×30 mm (متوسط)", w: 50, h: 30 },
    { id: "58x40", label: "58×40 mm (كبير)", w: 58, h: 40 },
    { id: "60x40", label: "60×40 mm (كبير)", w: 60, h: 40 },
  ];

  const save = async () => {
  if (!pharmacyId) return;
  const { error } = await supabase
    .from("pharmacy_settings")
    .update({
      name_ar: settings.nameAr,
      name_en: settings.nameEn,
      phone: settings.phone,
      address: settings.address,
      tax_number: settings.vatNumber,
      license_number: settings.licenseNumber,
      updated_at: new Date().toISOString(),
      label_size: settings.labelSize || "50x30",
    })
    .eq("pharmacy_id", pharmacyId);

  if (error) {
    showToast("خطأ في الحفظ: " + error.message, "error");
    return;
  }
  localStorage.setItem("pharmacy_settings", JSON.stringify(settings));
  showToast("تم حفظ بيانات الصيدلية ✓");
};
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        بيانات الصيدلية
      </h2>
      <div style={{
        background: "#0f1623", border: "1px solid #1d2d4a",
        borderRadius: 16, padding: 24,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label style={{ color: "#4a6a8a", fontSize: 12, display: "block", marginBottom: 6 }}>
              {label}
            </label>
            <input
              value={settings[key] || ""}
              onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
              style={{
                width: "100%", background: "#080e1a",
                border: "1px solid #1d2d4a", borderRadius: 8,
                padding: "8px 12px", color: "#dde8ff",
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div></div>

        {/* حجم الملصق */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ color: "#4a6a8a", fontSize: 12, display: "block", marginBottom: 8 }}>
            حجم ملصق الباركود
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {LABEL_SIZES.map((size) => (
              <button
                key={size.id}
                onClick={() => setSettings((p) => ({ ...p, labelSize: size.id }))}
                style={{
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${settings.labelSize === size.id ? "#3a9aff" : "#1d2d4a"}`,
                  background: settings.labelSize === size.id ? "#0a1a3a" : "#080e1a",
                  color: settings.labelSize === size.id ? "#3a9aff" : "#4a6a8a",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* ✅ هنا كانت المشكلة - </div> ناقصة لإغلاق الـ grid */}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn icon="check" onClick={save}>حفظ البيانات</Btn>
        </div>

      </div>
    </div>
  );
}
function PurchaseModule({
  products,
  setProducts,
  suppliers,
  purchases,
  setPurchases,
  showToast,
  pharmacyId,
}) {
  const [showNew, setShowNew] = useState(false);
  const [items, setItems] = useState([]);
  const [selSupplier, setSelSupplier] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualSubtotal, setManualSubtotal] = useState("");
  const [manualTax, setManualTax] = useState("");
  const [showProductCard, setShowProductCard] = useState(null);
  const searchRef = useRef(null);
  const [showDetail, setShowDetail] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editSupplier, setEditSupplier] = useState("");
  const [editManualSubtotal, setEditManualSubtotal] = useState("");
  const [editManualTax, setEditManualTax] = useState("");
  
  // ===== طباعة الباركود =====
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printItems, setPrintItems] = useState([]);
  const [pharmSettings, setPharmSettings] = useState({});
const LABEL_SIZES = [
  { id: "40x25", label: "40×25 mm", w: 40, h: 25 },
  { id: "50x30", label: "50×30 mm", w: 50, h: 30 },
  { id: "58x40", label: "58×40 mm", w: 58, h: 40 },
  { id: "60x40", label: "60×40 mm", w: 60, h: 40 },
];
  useEffect(() => {
    supabase.from("pharmacy_settings").select("*").eq("id", "main").single()
      .then(({ data }) => { if (data) setPharmSettings(data); });
  }, []);

  const printLabels = (invoiceItems) => {
    setPrintItems(invoiceItems.map((i) => ({ ...i, copies: i.qty + (i.bonusQty || 0), selected: true })));
    setShowPrintModal(true);
  };

  const doPrint = () => {
    const size = LABEL_SIZES.find((s) => s.id === (pharmSettings.label_size || "50x30")) || LABEL_SIZES[1];
    const labels = [];
    printItems.filter((item) => item.selected !== false).forEach((item) => {
      for (let c = 0; c < item.copies; c++) {
        labels.push(item);
      }
    });

    const win = window.open("", "_blank");
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>ملصقات الباركود</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .page { display: flex; flex-wrap: wrap; }
          .label {
            width: ${size.w}mm;
            height: ${size.h}mm;
            border: 0.5px solid #ccc;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .pharmacy { font-size: 7pt; font-weight: bold; text-align: center; }
          .phone { font-size: 6pt; text-align: center; color: #444; }
          .product { font-size: 7pt; font-weight: bold; text-align: center; margin: 1mm 0; }
          .details { display: flex; justify-content: space-between; font-size: 6pt; }
          svg { width: 100%; height: ${size.h * 0.35}mm; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding:10px; text-align:center;">
          <button onclick="window.print()" style="padding:8px 24px; font-size:14px; cursor:pointer;">🖨️ طباعة</button>
          <button onclick="window.close()" style="padding:8px 24px; font-size:14px; cursor:pointer; margin-right:10px;">✕ إغلاق</button>
        </div>
        <div class="page">
          ${labels.map((item, idx) => `
            <div class="label">
              <div class="pharmacy">${pharmSettings.name_ar || ""}</div>
              <div class="phone">${pharmSettings.phone || ""}</div>
              <div class="product">${item.name}</div>
              <svg id="bc${idx}"></svg>
              <div class="details">
                <span>سعر: ${item.newSalePrice || item.salePrice || item.price} ر.س</span>
                <span>${item.expiry_date ? "صلاحية: " + item.expiry_date : ""}</span>
              </div>
            </div>
          `).join("")}
        </div>
        <script>
          window.onload = function() {
            ${labels.map((item, idx) => `
              try {
                JsBarcode("#bc${idx}", "${item.barcode || item.id}", {
                  format: "CODE128", width: 1.5, height: ${size.h * 3},
                  displayValue: true, fontSize: 8, margin: 0
                });
              } catch(e) {}
            `).join("")}
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
    setShowPrintModal(false);
  };
  // ===== نهاية طباعة الباركود =====

  const handleSearchChange = (val) => {
    setSearchText(val);
    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const results = products
      .filter(
        (p) =>
          (p.name||"").includes(val) ||
(p.barcode||"").includes(val) ||
(p.id||"").includes(val)
      )
      .slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  };

  const addItem = (p) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex)
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [
        ...prev,
        {
          ...p,
          qty: 1,
          bonusQty: 0,
          discount1: 0,
          discount2: 0,
          receivedCost: p.cost,
          newSalePrice: p.price,
          expiry_date: "",
        },
      ];
    });
    setSearchText("");
    setSearchResults([]);
    setShowDropdown(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) addItem(searchResults[0]);
      else if (searchText.trim()) {
        const p = products.find(
          (x) =>
            x.barcode === searchText ||
            x.id === searchText ||
            (x.name||"").includes(searchText)
        );
        if (p) addItem(p);
        else showToast("الصنف غير موجود", "error");
      }
    }
    if (e.key === "Escape") setShowDropdown(false);
  };

  const calcCostAfterDiscount = (basePrice, disc1, disc2) => {
    const afterDisc1 = basePrice * (1 - (disc1 || 0) / 100);
    const afterDisc2 = afterDisc1 * (1 - (disc2 || 0) / 100);
    return Math.round(afterDisc2 * 10000) / 10000;
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: value };

        if (field === "discount1") {
          updated.receivedCost = calcCostAfterDiscount(
            i.newSalePrice,
            value,
            i.discount2
          );
        } else if (field === "discount2") {
          updated.receivedCost = calcCostAfterDiscount(
            i.newSalePrice,
            i.discount1,
            value
          );
        }
        else if (field === "newSalePrice") {
          updated.receivedCost = calcCostAfterDiscount(
            value,
            i.discount1,
            i.discount2
          );
        }

        return updated;
      })
    );
  };

  const cols = [
    "qty",
    "discount1",
    "discount2",
    "receivedCost",
    "newSalePrice",
    "bonusQty",
    "expiry_date",
  ];

  const handleCellKeyDown = (e, rowIndex, colName) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const currentCol = cols.indexOf(colName);
    let nextCol = currentCol + 1;
    let nextRow = rowIndex;
    if (nextCol >= cols.length) {
      nextCol = 0;
      nextRow = rowIndex + 1;
      if (nextRow >= items.length) {
        searchRef.current?.focus();
        return;
      }
    }
    document.getElementById(`cell-${nextRow}-${cols[nextCol]}`)?.focus();
  };

  const cellStyle = {
    width: "100%",
    background: "#080e1a",
    border: "1px solid #1d2d4a",
    borderRadius: 6,
    padding: "4px 8px",
    color: "#dde8ff",
    fontSize: 13,
    outline: "none",
  };

  const calcSubtotal = items.reduce((s, i) => s + i.receivedCost * i.qty, 0);
  const calcTax = items.reduce(
    (s, i) => (i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s),
    0
  );
  const subtotal = manualSubtotal !== "" ? +manualSubtotal : calcSubtotal;
  const taxAmt = manualTax !== "" ? +manualTax : calcTax;
  const total = subtotal + taxAmt;

  const savePurchase = async () => {
    if (!selSupplier || items.length === 0) {
      showToast("يرجى اختيار المورد وإضافة أصناف", "error");
      return;
    }
    const sup = suppliers.find((s) => s.id === selSupplier);
    const po = {
      id: "PO-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      supplier: selSupplier,
      supplierName: sup.name,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        bonusQty: i.bonusQty || 0,
        cost: i.receivedCost,
        discount1: i.discount1,
        discount2: i.discount2,
        salePrice: i.newSalePrice,
        taxable: i.taxable,
        expiry_date: i.expiry_date || null,
      })),
      subtotal,
      taxAmount: taxAmt,
      total,
      status: "مستلمة",
    };

    setPurchases((p) => [...p, po]);
    const { error } = await supabase.from("purchases").insert({
      id: po.id,
      date: po.date,
      supplier: po.supplier,
      supplier_name: po.supplierName,
      items: po.items,
      subtotal: po.subtotal,
      tax_amount: po.taxAmount,
      total: po.total,
      status: po.status,
      pharmacy_id: pharmacyId,
    });
    if (error) {
      showToast("فشل الحفظ في السيرفر: " + error.message, "error");
    }
    for (const ci of items) {
      const product = products.find((x) => x.id === ci.id);
      if (!product) continue;
      const newStock = product.stock + ci.qty + (ci.bonusQty || 0);
      await supabase
        .from("products")
        .update({
          stock: newStock,
          cost: ci.receivedCost,
          price: ci.newSalePrice,
          not_available_market: false,
        })
        .eq("id", ci.id);
    }
    setProducts((prev) =>
      prev.map((x) => {
        const ci = items.find((i) => i.id === x.id);
        if (!ci) return x;
        const newBatch = {
          qty: ci.qty + (ci.bonusQty || 0),
          cost: ci.receivedCost,
          salePrice: ci.newSalePrice,
          expiry_date: ci.expiry_date || null,
          date: new Date().toISOString().split("T")[0],
        };
        const existingBatches = x.batches?.length
          ? x.batches
          : x.stock > 0
          ? [{ qty: x.stock, cost: x.cost, salePrice: x.price, date: "قديم" }]
          : [];
        return {
          ...x,
          stock: x.stock + ci.qty + (ci.bonusQty || 0),
          cost: ci.receivedCost,
          price: ci.newSalePrice,
          batches: [...existingBatches, newBatch],
          not_available_market: false,
        };
      })
    );

    // ✅ نحتفظ بنسخة من الأصناف للطباعة قبل التصفير
    const itemsForPrint = items.map((i) => ({ ...i }));

    setItems([]);
    setSelSupplier("");
    setManualSubtotal("");
    setManualTax("");
    setShowNew(false);
    showToast("تم حفظ فاتورة الشراء ✓");

    // ✅ فتح نافذة طباعة الباركود بعد نجاح الحفظ
    printLabels(itemsForPrint);

    // ==================== رصد ====================
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = itemsForPrint.filter((i) => i.serial);
    if (rasdConfig.enabled && gs1Items.length > 0) {
      RasdService.sendTransaction(
        "receipt",
        gs1Items.map((i) => ({
          gtin: i.gtin || i.barcode,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.qty,
        })),
        rasdConfig.gln,
        null
      ).then((result) => {
        if (!result.success)
          showToast("تحذير: فشل إرسال بيانات الشراء لرصد", "error");
      });
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          فواتير الشراء
        </h2>
        <Btn icon="plus" onClick={() => setShowNew(true)}>
          فاتورة شراء جديدة
        </Btn>
      </div>

      <Table
        headers={[
          "رقم الفاتورة",
          "التاريخ",
          "المورد",
          "قبل الضريبة",
          "الضريبة",
          "الإجمالي",
          "الحالة",
        ]}
        rows={purchases.map((p) => [
          <span
            style={{ color: "#6aaeff", fontWeight: 700, cursor: "pointer" }}
            onClick={() => {
              setShowDetail(p);
              setEditItems(
                p.items.map((i) => ({
                  ...i,
                  receivedCost: i.cost,
                  newSalePrice: i.salePrice,
                  discount1: i.discount1 || 0,
                  discount2: i.discount2 || 0,
                  bonusQty: i.bonusQty || 0,
                  expiry_date: i.expiry_date || "",
                }))
              );
              setEditSupplier(p.supplier);
              setEditManualSubtotal("");
              setEditManualTax("");
            }}
          >
            {p.id}
          </span>,
          p.date,
          p.supplierName || p.supplier_name,
          (p.subtotal || 0).toFixed(2) + " ر.س",
          (p.taxAmount ?? p.tax_amount ?? 0).toFixed(2) + " ر.س",
          <span style={{ color: "#44dd88", fontWeight: 700 }}>
            {(p.total || 0).toFixed(2)} ر.س
          </span>,
          <Badge color="#0a2a10" text="#44dd88">
            {p.status}
          </Badge>,
        ])}
      />

      <Modal
        open={showNew}
        onClose={() => {
          setShowNew(false);
          setItems([]);
          setManualSubtotal("");
          setManualTax("");
        }}
        title="فاتورة شراء جديدة"
        wide
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Select
            label="المورد"
            value={selSupplier}
            onChange={setSelSupplier}
            options={[
              { v: "", l: "اختر المورد" },
              ...suppliers.map((s) => ({
                v: s.id,
                l: `${s.name} — ${s.taxId}`,
              })),
            ]}
          />
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            ref={searchRef}
            placeholder="🔍 ابحث بالاسم أو الباركود أو امسح الباركود..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{
              width: "100%",
              background: "#080e1a",
              border: "1px solid #2a5a9a",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#dde8ff",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                left: 0,
                background: "#0d1829",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                zIndex: 100,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onMouseDown={() => addItem(p)}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    color: "#dde8ff",
                    fontSize: 13,
                    borderBottom: "1px solid #111a2a",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#152238")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span>{p.name}</span>
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>
                    {p.barcode} | مخزون: {p.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 4, overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
          >
            <thead>
              <tr style={{ background: "#080e1a" }}>
                {[
                  "الصنف",
                  "الكمية",
                  "خ.أساسي%",
                  "خ.إضافي%",
                  "تكلفة الوحدة",
                  "سعر البيع",
                  "بونص",
                  "الصلاحية",
                  "ضريبة",
                  "الإجمالي",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 8px",
                      textAlign: "right",
                      color: "#4a6a9a",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIndex) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                  <td
                    style={{
                      padding: "6px 8px",
                      fontSize: 13,
                      color: "#c0d0f0",
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {item.name}
                      <button
                        onClick={() => setShowProductCard(item)}
                        title="عرض بيانات الصنف"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#3a6aaa",
                          cursor: "pointer",
                          padding: 2,
                          lineHeight: 1,
                        }}
                      >
                        <IC n="eye" s={13} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-qty`}
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(item.id, "qty", +e.target.value)
                      }
                      onKeyDown={(e) => handleCellKeyDown(e, rowIndex, "qty")}
                      style={{ ...cellStyle, width: 55 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-discount1`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount1}
                      onChange={(e) =>
                        updateItem(item.id, "discount1", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "discount1")
                      }
                      style={{ ...cellStyle, width: 60 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-discount2`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.discount2}
                      onChange={(e) =>
                        updateItem(item.id, "discount2", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "discount2")
                      }
                      style={{ ...cellStyle, width: 60 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-receivedCost`}
                      type="number"
                      min="0"
                      step="0.0001"
                      value={+item.receivedCost.toFixed(4)}
                      onChange={(e) =>
                        updateItem(item.id, "receivedCost", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "receivedCost")
                      }
                      style={{ ...cellStyle, width: 85 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-newSalePrice`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.newSalePrice}
                      onChange={(e) =>
                        updateItem(item.id, "newSalePrice", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "newSalePrice")
                      }
                      style={{
                        ...cellStyle,
                        width: 85,
                        borderColor:
                          item.newSalePrice !== item.price
                            ? "#f0a030"
                            : "#1d2d4a",
                        color:
                          item.newSalePrice !== item.price
                            ? "#f0c060"
                            : "#dde8ff",
                      }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-bonusQty`}
                      type="number"
                      min="0"
                      value={item.bonusQty}
                      onChange={(e) =>
                        updateItem(item.id, "bonusQty", +e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "bonusQty")
                      }
                      style={{ ...cellStyle, width: 55 }}
                    />
                  </td>
                  <td style={{ padding: "4px" }}>
                    <input
                      id={`cell-${rowIndex}-expiry_date`}
                      type="month"
                      value={item.expiry_date || ""}
                      onChange={(e) =>
                        updateItem(item.id, "expiry_date", e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCellKeyDown(e, rowIndex, "expiry_date")
                      }
                      style={{ ...cellStyle, width: 125 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <Badge
                      color={item.taxable ? "#0a2a00" : "#1a1a2a"}
                      text={item.taxable ? "#44dd88" : "#4a6a8a"}
                    >
                      {item.taxable ? "15%" : "معفى"}
                    </Badge>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "#3a9aff",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(
                      item.receivedCost *
                      item.qty *
                      (item.taxable ? 1 + TAX_RATE : 1)
                    ).toFixed(2)}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      onClick={() =>
                        setItems((p) => p.filter((i) => i.id !== item.id))
                      }
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#5a2a2a",
                        cursor: "pointer",
                      }}
                    >
                      <IC n="trash" s={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length > 0 && (
          <div
            style={{
              background: "#080e1a",
              borderRadius: 10,
              padding: 14,
              marginTop: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#4a6a8a",
                marginBottom: 8,
              }}
            >
              <span>المجموع قبل الضريبة</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6a8aaa", fontSize: 11 }}>
                  (محسوب: {calcSubtotal.toFixed(2)})
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={calcSubtotal.toFixed(2)}
                  value={manualSubtotal}
                  onChange={(e) => setManualSubtotal(e.target.value)}
                  style={{
                    width: 110,
                    background: "#0a1020",
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: "#dde8ff",
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: "#4a6a8a" }}>ر.س</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#88dd44",
                marginBottom: 8,
              }}
            >
              <span>ضريبة القيمة المضافة 15%</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6a8aaa", fontSize: 11 }}>
                  (محسوب: {calcTax.toFixed(2)})
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={calcTax.toFixed(2)}
                  value={manualTax}
                  onChange={(e) => setManualTax(e.target.value)}
                  style={{
                    width: 110,
                    background: "#0a1020",
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: "#dde8ff",
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: "#88dd44" }}>ر.س</span>
              </div>
            </div>
            {(manualSubtotal !== "" || manualTax !== "") && (
              <button
                onClick={() => {
                  setManualSubtotal("");
                  setManualTax("");
                }}
                style={{
                  fontSize: 11,
                  color: "#4a6a8a",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                ↺ إعادة الحساب التلقائي
              </button>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#dde8ff",
                fontWeight: 800,
                fontSize: 16,
                borderTop: "1px solid #1d2d4a",
                paddingTop: 8,
              }}
            >
              <span>الإجمالي</span>
              <span>{total.toFixed(2)} ر.س</span>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <Btn
            variant="ghost"
            onClick={() => {
              setShowNew(false);
              setItems([]);
              setManualSubtotal("");
              setManualTax("");
            }}
          >
            إلغاء
          </Btn>
          <Btn icon="check" onClick={savePurchase}>
            حفظ الفاتورة
          </Btn>
        </div>
      </Modal>

      {showProductCard && (
        <Modal
          open
          title={`بيانات الصنف: ${showProductCard.name}`}
          onClose={() => setShowProductCard(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["الرمز", showProductCard.id],
              ["الباركود", showProductCard.barcode],
              ["الفئة", showProductCard.category],
              ["المادة الفعالة", showProductCard.activeIngredient],
              ["التركيز", showProductCard.concentration],
              ["المخزون الحالي", showProductCard.stock],
              ["سعر البيع الحالي", showProductCard.price + " ر.س"],
              ["التكلفة الحالية", showProductCard.cost + " ر.س"],
              ["الحد الأدنى", showProductCard.minStock],
              ["خاضع للضريبة", showProductCard.taxable ? "نعم 15%" : "معفى"],
            ].map(
              ([label, val]) =>
                val && (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid #1a2a3a",
                    }}
                  >
                    <span style={{ color: "#4a6a8a", fontSize: 13 }}>
                      {label}
                    </span>
                    <span
                      style={{
                        color: "#dde8ff",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {val}
                    </span>
                  </div>
                )
            )}
          </div>
        </Modal>
      )}

      {/* ✅ Modal طباعة ملصقات الباركود */}
      {showPrintModal && (
        <Modal
          open
          title="طباعة ملصقات الباركود"
          onClose={() => setShowPrintModal(false)}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10, padding: "6px 10px", background: "#0a1020", borderRadius: 8,
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={printItems.length > 0 && printItems.every((i) => i.selected !== false)}
                onChange={(e) =>
                  setPrintItems((prev) => prev.map((i) => ({ ...i, selected: e.target.checked })))
                }
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ color: "#dde8ff", fontSize: 13, fontWeight: 600 }}>تحديد الكل</span>
            </label>
            <span style={{ color: "#4a6a8a", fontSize: 12 }}>
              {printItems.filter((i) => i.selected !== false).length} / {printItems.length} محدد
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
            {printItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  background: "#080e1a",
                  borderRadius: 8,
                  border: "1px solid #1d2d4a",
                  opacity: item.selected === false ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={item.selected !== false}
                    onChange={(e) =>
                      setPrintItems((prev) =>
                        prev.map((i, pi) =>
                          pi === idx ? { ...i, selected: e.target.checked } : i
                        )
                      )
                    }
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span style={{ color: "#dde8ff", fontSize: 13 }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>عدد النسخ</span>
                  <input
                    type="number"
                    min="0"
                    value={item.copies}
                    onChange={(e) =>
                      setPrintItems((prev) =>
                        prev.map((i, pi) =>
                          pi === idx ? { ...i, copies: +e.target.value } : i
                        )
                      )
                    }
                    style={{
                      width: 60,
                      background: "#0a1020",
                      border: "1px solid #1d3a6a",
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: "#dde8ff",
                      fontSize: 13,
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={() => setPrintItems((prev) => prev.filter((_, pi) => pi !== idx))}
                    title="حذف الصنف من القائمة"
                    style={{
                      width: 26, height: 26, borderRadius: 6, border: "1px solid #4a1a1a",
                      background: "#1a0a0a", color: "#ff5566", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {printItems.length === 0 && (
              <div style={{ color: "#4a6a8a", textAlign: "center", padding: 20, fontSize: 13 }}>
                لا توجد أصناف في القائمة
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              justifyContent: "flex-end",
            }}
          >
            <Btn variant="ghost" onClick={() => setShowPrintModal(false)}>
              إلغاء
            </Btn>
            <Btn
              icon="printer"
              onClick={doPrint}
              disabled={printItems.filter((i) => i.selected !== false).length === 0}
            >
              طباعة ({printItems.filter((i) => i.selected !== false).length})
            </Btn>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal
          open
          title={`تفاصيل الفاتورة: ${showDetail.id}`}
          onClose={() => setShowDetail(null)}
          wide
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Select
              label="المورد"
              value={editSupplier}
              onChange={setEditSupplier}
              options={[
                { v: "", l: "اختر المورد" },
                ...suppliers.map((s) => ({
                  v: s.id,
                  l: `${s.name} — ${s.taxId}`,
                })),
              ]}
            />
            <div
              style={{
                color: "#4a6a8a",
                fontSize: 12,
                alignSelf: "flex-end",
                paddingBottom: 8,
              }}
            >
              التاريخ: {showDetail.date}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
              }}
            >
              <thead>
                <tr style={{ background: "#080e1a" }}>
                  {[
                    "الصنف",
                    "الكمية",
                    "خ.أساسي%",
                    "خ.إضافي%",
                    "تكلفة الوحدة",
                    "سعر البيع",
                    "بونص",
                    "الصلاحية",
                    "الإجمالي",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "9px 8px",
                        textAlign: "right",
                        color: "#4a6a9a",
                        fontSize: 12,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editItems.map((item, rowIndex) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #0a101a" }}
                  >
                    <td
                      style={{
                        padding: "6px 8px",
                        fontSize: 13,
                        color: "#c0d0f0",
                        minWidth: 120,
                      }}
                    >
                      {item.name}
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, qty: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 55,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount1}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    discount1: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      i.newSalePrice,
                                      +e.target.value,
                                      i.discount2
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 60,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount2}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    discount2: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      i.newSalePrice,
                                      i.discount1,
                                      +e.target.value
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 60,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={+item.receivedCost.toFixed(4)}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, receivedCost: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 85,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.newSalePrice}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? {
                                    ...i,
                                    newSalePrice: +e.target.value,
                                    receivedCost: calcCostAfterDiscount(
                                      +e.target.value,
                                      i.discount1,
                                      i.discount2
                                    ),
                                  }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 85,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        value={item.bonusQty}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, bonusQty: +e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 55,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td style={{ padding: "4px" }}>
                      <input
                        type="month"
                        value={item.expiry_date || ""}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id
                                ? { ...i, expiry_date: e.target.value }
                                : i
                            )
                          )
                        }
                        style={{
                          width: 125,
                          background: "#080e1a",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#dde8ff",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        color: "#3a9aff",
                        fontWeight: 700,
                      }}
                    >
                      {(
                        item.receivedCost *
                        item.qty *
                        (item.taxable ? 1 + TAX_RATE : 1)
                      ).toFixed(2)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button
                        onClick={() =>
                          setEditItems((prev) =>
                            prev.filter((i) => i.id !== item.id)
                          )
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#5a2a2a",
                          cursor: "pointer",
                        }}
                      >
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              background: "#080e1a",
              borderRadius: 10,
              padding: 14,
              marginTop: 14,
            }}
          >
            {(() => {
              const editCalcSubtotal = editItems.reduce(
                (s, i) => s + i.receivedCost * i.qty,
                0
              );
              const editCalcTax = editItems.reduce(
                (s, i) =>
                  i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                0
              );
              const editSubtotal =
                editManualSubtotal !== ""
                  ? +editManualSubtotal
                  : editCalcSubtotal;
              const editTaxAmt =
                editManualTax !== "" ? +editManualTax : editCalcTax;
              const editTotal = editSubtotal + editTaxAmt;
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#4a6a8a",
                      marginBottom: 8,
                    }}
                  >
                    <span>قبل الضريبة</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={editCalcSubtotal.toFixed(2)}
                      value={editManualSubtotal}
                      onChange={(e) => setEditManualSubtotal(e.target.value)}
                      style={{
                        width: 110,
                        background: "#0a1020",
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: "#dde8ff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#88dd44",
                      marginBottom: 8,
                    }}
                  >
                    <span>ضريبة 15%</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={editCalcTax.toFixed(2)}
                      value={editManualTax}
                      onChange={(e) => setEditManualTax(e.target.value)}
                      style={{
                        width: 110,
                        background: "#0a1020",
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: "#dde8ff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#dde8ff",
                      fontWeight: 800,
                      fontSize: 16,
                      borderTop: "1px solid #1d2d4a",
                      paddingTop: 8,
                    }}
                  >
                    <span>الإجمالي</span>
                    <span>{editTotal.toFixed(2)} ر.س</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              justifyContent: "flex-end",
            }}
          >
            <Btn variant="ghost" onClick={() => setShowDetail(null)}>
  إلغاء
</Btn>
            <Btn variant="secondary" onClick={() => printLabels(
  editItems.map((i) => ({ ...i, newSalePrice: i.salePrice || i.newSalePrice }))
)}>
  🖨️ طباعة ملصقات
</Btn>
            <Btn
              icon="check"
              onClick={async () => {
                const editCalcSubtotal = editItems.reduce(
                  (s, i) => s + i.receivedCost * i.qty,
                  0
                );
                const editCalcTax = editItems.reduce(
                  (s, i) =>
                    i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s,
                  0
                );
                const editSubtotal =
                  editManualSubtotal !== ""
                    ? +editManualSubtotal
                    : editCalcSubtotal;
                const editTaxAmt =
                  editManualTax !== "" ? +editManualTax : editCalcTax;
                const sup = suppliers.find((s) => s.id === editSupplier);
                const updated = {
                  ...showDetail,
                  supplier: editSupplier,
                  supplier_name: sup?.name || showDetail.supplier_name,
                  items: editItems.map((i) => ({
                    id: i.id,
                    name: i.name,
                    qty: i.qty,
                    bonusQty: i.bonusQty || 0,
                    cost: i.receivedCost,
                    discount1: i.discount1,
                    discount2: i.discount2,
                    salePrice: i.newSalePrice,
                    taxable: i.taxable,
                    expiry_date: i.expiry_date || null,
                  })),
                  subtotal: editSubtotal,
                  taxAmount: editTaxAmt,
                  total: editSubtotal + editTaxAmt,
                };
                const { error } = await supabase
                  .from("purchases")
                  .update({
                    supplier: editSupplier,
                    supplier_name:
                      sup?.name ||
                      showDetail.supplier_name ||
                      showDetail.supplierName,
                    items: updated.items,
                    subtotal: editSubtotal,
                    tax_amount: editTaxAmt,
                    total: editSubtotal + editTaxAmt,
                  })
                  .eq("id", showDetail.id);
                if (error) {
                  showToast("فشل التعديل: " + error.message, "error");
                  return;
                }
                setPurchases((prev) =>
                  prev.map((p) => (p.id === showDetail.id ? updated : p))
                );
                setShowDetail(null);
                showToast("تم التعديل ✓");
              }}
            >
              حفظ التعديل
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ReturnsModule({
  products,
  setProducts,
  sales,
  setSales,
  purchases,
  setPurchases,
  customers,
  showToast,
  pharmacyId,
}) {
  const [type, setType] = useState("sales");
  const [search, setSearch] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState("");
  const [selCustomer, setSelCustomer] = useState("");
  const [selInvoice, setSelInvoice] = useState("");

  useEffect(() => {
    setReturnItems([]);
    setSearch("");
    setSelCustomer("");
    setReason("");
    setSelInvoice("");
  }, [type]);

  const purchaseInvoice = purchases.find((p) => p.id === selInvoice);

  useEffect(() => {
    if (type === "purchases" && purchaseInvoice) {
      setReturnItems(
        purchaseInvoice.items.map((i) => ({ ...i, returnQty: 0 }))
      );
    }
  }, [selInvoice, type]);

  const handleSearch = (val) => {
    setSearch(val);
    if (!val.trim()) return;
    const found = products.find(
      (p) =>
        p.barcode === val.trim() ||
        (p.name||"").toLowerCase().includes(val.toLowerCase())
    );
    if (found) {
      const already = returnItems.find((i) => i.id === found.id);
      if (already) {
        showToast("الصنف موجود بالفعل", "error");
        return;
      }
      setReturnItems((prev) => [...prev, { ...found, returnQty: 1 }]);
      setSearch("");
    }
  };

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

  const processReturn = async () => {
    if (
      returnItems.length === 0 ||
      returnItems.every((i) => i.returnQty === 0)
    ) {
      showToast("يرجى إضافة أصناف للمرتجع", "error");
      return;
    }

    const returnId = `RET-${Date.now()}`;
    const customer = customers?.find((c) => String(c.id) === selCustomer);

    // تحديث المخزون في Supabase
    for (const ri of returnItems) {
      if (ri.returnQty > 0) {
        const prod = products.find((x) => x.id === ri.id);
        if (prod) {
          const { error: stockError } = await supabase
            .from("products")
            .update({
              // مرتجع مبيعات ← الكمية ترجع للمخزون (زيادة)
              // مرتجع مشتريات ← الكمية تخرج من المخزون (نقص)
              stock:
                type === "sales"
                  ? prod.stock + ri.returnQty
                  : prod.stock - ri.returnQty,
            })
            .eq("id", ri.id);
          if (stockError) {
            showToast("خطأ في تحديث المخزون: " + stockError.message, "error");
          }
        }
      }
    }

    // تحديث المخزون محلياً
    setProducts((p) =>
      p.map((x) => {
        const ri = returnItems.find((i) => i.id === x.id);
        if (!ri || ri.returnQty === 0) return x;
        return {
          ...x,
          stock:
            type === "sales" ? x.stock + ri.returnQty : x.stock - ri.returnQty,
        };
      })
    );

    if (type === "purchases" && selInvoice) {
      setPurchases((p) =>
        p.map((s) =>
          s.id === selInvoice
            ? { ...s, returned: true, returnReason: reason }
            : s
        )
      );
    }

    const { error } = await supabase.from("returns").insert([
      {
        id: returnId,
        date: new Date().toISOString().split("T")[0],
        type,
        customer: selCustomer || null,
        customer_name: customer?.name || "زبون عادي",
        items: returnItems,
        reason,
        subtotal: returnSubtotal,
        tax: returnTax,
        total: returnTotal,
        pharmacy_id: pharmacyId,
      },
    ]);

    if (error) {
      showToast("خطأ في حفظ المرتجع: " + error.message, "error");
      return;
    }

    setReturnItems([]);
    setReason("");
    setSelCustomer("");
    setSelInvoice("");
    showToast(`تم تسجيل المرتجع ✓ — ${returnTotal.toFixed(2)} ر.س`);

    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = returnItems.filter((i) => i.serial && i.returnQty > 0);
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
        if (!result.success)
          showToast("تحذير: فشل إرسال بيانات المرتجع لرصد", "error");
      });
    }
  };
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        المرتجعات
      </h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {["sales", "purchases"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              padding: "9px 22px",
              borderRadius: 9,
              border: "1px solid",
              borderColor: type === t ? "#2a6aef" : "#1d2d4a",
              background: type === t ? "#142a5a" : "transparent",
              color: type === t ? "#6aaeff" : "#4a6a8a",
              fontWeight: type === t ? 700 : 400,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            مرتجع {t === "sales" ? "مبيعات" : "مشتريات"}
          </button>
        ))}
      </div>

      {type === "sales" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <input
              placeholder="🔍 ابحث بالاسم أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(search)}
              style={{
                width: "100%",
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 9,
                padding: "11px 14px",
                color: "#dde8ff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* ✅ Fix: native select بدل custom Select */}
          <div style={{ marginBottom: 14 }}>
            <select
              value={selCustomer}
              onChange={(e) => setSelCustomer(e.target.value)}
              style={{
                width: "100%",
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 9,
                padding: "11px 14px",
                color: "#dde8ff",
                fontSize: 14,
                outline: "none",
              }}
            >
              <option value="">زبون عادي</option>
              {(customers || []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {type === "purchases" && (
        <div style={{ marginBottom: 14 }}>
          <Select
            label="اختر فاتورة الشراء"
            value={selInvoice}
            onChange={setSelInvoice}
            options={[
              { v: "", l: "اختر الفاتورة..." },
              ...purchases
                .filter((p) => !p.returned)
                .map((x) => ({
                  v: x.id,
                  l: `${x.id} — ${x.date} — ${(x.total ?? 0).toFixed(2)} ر.س`,
                })),
            ]}
          />
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <Input
          label="سبب الإرجاع"
          value={reason}
          onChange={setReason}
          placeholder="سبب الإرجاع (اختياري)"
        />
      </div>

      {returnItems.length > 0 && (
        <div
          style={{
            background: "#0f1623",
            border: "1px solid #1d2d4a",
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
          }}
        >
          {returnItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid #0a101a",
              }}
            >
              <div style={{ flex: 1, fontSize: 13, color: "#c0d0f0" }}>
                {item.name}
              </div>
              <div style={{ color: "#4a6a8a", fontSize: 12 }}>
                {(type === "purchases"
                  ? item.cost || item.price
                  : item.price
                ).toFixed(2)}{" "}
                ر.س
              </div>
              <input
                type="number"
                min={type === "purchases" ? 0 : 1}
                max={type === "purchases" ? item.qty : undefined}
                value={item.returnQty}
                onChange={(e) =>
                  setReturnItems((p) =>
                    p.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            returnQty:
                              type === "purchases"
                                ? Math.min(+e.target.value, item.qty)
                                : Math.max(1, +e.target.value),
                          }
                        : x
                    )
                  )
                }
                style={{
                  width: 60,
                  background: "#080e1a",
                  border: "1px solid #1d2d4a",
                  borderRadius: 6,
                  padding: "5px 8px",
                  color: "#dde8ff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {type === "sales" && (
                <button
                  onClick={() =>
                    setReturnItems((p) => p.filter((_, j) => j !== i))
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ff6666",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              )}
              {item.taxable && (
                <Badge color="#0a2a00" text="#44dd88">
                  15%
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {returnTotal > 0 && (
        <div
          style={{
            background: "#080e1a",
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#4a6a8a",
              marginBottom: 5,
            }}
          >
            <span>قبل الضريبة</span>
            <span>{returnSubtotal.toFixed(2)} ر.س</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#88dd44",
              marginBottom: 5,
            }}
          >
            <span>الضريبة المستردة 15%</span>
            <span>{returnTax.toFixed(2)} ر.س</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#dde8ff",
              fontWeight: 800,
              fontSize: 16,
              borderTop: "1px solid #1d2d4a",
              paddingTop: 8,
            }}
          >
            <span>إجمالي المرتجع</span>
            <span>{returnTotal.toFixed(2)} ر.س</span>
          </div>
        </div>
      )}

      <Btn icon="returns" onClick={processReturn} variant="danger">
        تأكيد الإرجاع
      </Btn>
    </div>
  );
}
// ==================== RASSD SETTINGS ====================
function RasdSettings({ showToast }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("rasd_config");
    return saved
      ? JSON.parse(saved)
      : {
          enabled: false,
          gln: "",
          username: "",
          password: "",
          apiUrl: "https://rsd.sfda.gov.sa/api",
        };
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const save = () => {
    // احفظ التوكن الحالي مع الإعدادات
    const configToSave = {
      ...config,
      token: RasdService.token || null,
    };
    localStorage.setItem("rasd_config", JSON.stringify(configToSave));
    showToast("تم حفظ إعدادات رصد ✓");
  };

  const testConnection = async () => {
    if (!config.username || !config.password) {
      showToast("يرجى إدخال اسم المستخدم وكلمة المرور", "error");
      return;
    }
    setTesting(true);
    RasdService.baseUrl = config.apiUrl;
    const result = await RasdService.login(config.username, config.password);
    setTesting(false);
    if (result.success) {
      setConnected(true);
      // احفظ التوكن في config
      setConfig((p) => ({ ...p, token: RasdService.token }));
      showToast("تم الاتصال برصد بنجاح ✓");
    } else {
      setConnected(false);
      showToast("فشل الاتصال: " + result.error, "error");
    }
  };

  const Field = ({ label, value, onChange, type = "text", placeholder }) => (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: "#4a6a8a",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "#080e1a",
          border: "1px solid #1d2d4a",
          borderRadius: 8,
          padding: "10px 14px",
          color: "#dde8ff",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  return (
    <div>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: 20,
          fontWeight: 800,
          color: "#dde8ff",
        }}
      >
        إعدادات نظام رصد
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#3a5a8a" }}>
        نظام التتبع الإلكتروني للمستحضرات الصيدلانية — هيئة الغذاء والدواء
      </p>

      {/* Status Card */}
      <div
        style={{
          background: config.enabled && connected ? "#0a2010" : "#1a0a00",
          border: `1px solid ${
            config.enabled && connected ? "#1a5020" : "#4a2a00"
          }`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: config.enabled && connected ? "#44dd88" : "#ffaa44",
            }}
          />
          <span
            style={{
              color: config.enabled && connected ? "#44dd88" : "#ffaa44",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {config.enabled && connected
              ? "رصد مفعّل ومتصل"
              : config.enabled
              ? "مفعّل — غير متصل"
              : "رصد غير مفعّل"}
          </span>
        </div>
        {/* Toggle */}
        <div
          onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            background: config.enabled ? "#2a6aef" : "#1d2d4a",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              right: config.enabled ? 3 : 22,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "right 0.2s",
            }}
          />
        </div>
      </div>

      {/* Form */}
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 14,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            fontWeight: 700,
            color: "#6aaeff",
          }}
        >
          بيانات الصيدلية
        </h3>

        <Field
          label="رقم GLN (Global Location Number)"
          value={config.gln}
          onChange={(v) => setConfig((p) => ({ ...p, gln: v }))}
          placeholder="مثال: 6281234567890"
        />

        <Field
          label="اسم المستخدم في رصد"
          value={config.username}
          onChange={(v) => setConfig((p) => ({ ...p, username: v }))}
          placeholder="اسم المستخدم"
        />

        <div style={{ marginBottom: 16, position: "relative" }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#4a6a8a",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            كلمة المرور
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={config.password}
              onChange={(e) =>
                setConfig((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="كلمة المرور"
              style={{
                width: "100%",
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "10px 44px 10px 14px",
                color: "#dde8ff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setShowPassword((p) => !p)}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "#4a6a8a",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </div>

        <Field
          label="رابط الـ API"
          value={config.apiUrl}
          onChange={(v) => setConfig((p) => ({ ...p, apiUrl: v }))}
          placeholder="https://rsd.sfda.gov.sa/api"
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn
          onClick={testConnection}
          variant="ghost"
          icon={testing ? "loading" : "check"}
          style={{ flex: 1 }}
        >
          {testing ? "جارٍ الاختبار..." : "اختبار الاتصال"}
        </Btn>
        <Btn onClick={save} icon="check" style={{ flex: 1 }}>
          حفظ الإعدادات
        </Btn>
      </div>

      {/* Instructions */}
      <div
        style={{
          background: "#080e1a",
          border: "1px solid #1d2d4a",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <h4
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "#ffaa44",
          }}
        >
          ⚠️ متطلبات التفعيل
        </h4>
        {[
          "التسجيل في بوابة رصد على rsd.sfda.gov.sa",
          "الحصول على رقم GLN من GS1 السعودية",
          "ماسح ضوئي يقرأ الباركود ثنائي الأبعاد (2D DataMatrix)",
          "التأكد من أن جميع المنتجات لها GTIN مسجل في رصد",
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 8,
              fontSize: 12,
              color: "#6a8aaa",
            }}
          >
            <span style={{ color: "#2a6aef", marginTop: 1 }}>•</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
// ======================== Expiry Report ==========================
function ExpiryReport({ purchases, onRemoveExpired }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showExpiredDetail, setShowExpiredDetail] = useState(false);

  // ===== flatten الأصناف مع batches =====
  const allItems = (purchases ?? []).flatMap((po) =>
    (po.items ?? [])
      .filter((i) => i.expiry_date)
      .map((i) => ({
        id: i.id,
        name: i.name,
        barcode: i.barcode ?? "-",
        expiry: i.expiry_date,
        stock: (i.qty ?? 0) + (i.bonusQty ?? 0),
        cost: i.cost ?? 0,
        price: i.salePrice ?? 0,
        invoiceId: po.id,
      }))
  );

  // ===== الأصناف المنتهية =====
  const expired = allItems.filter(
    (p) => p.expiry && new Date(p.expiry) < today
  );

  // ===== 6 أشهر قادمة =====
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const label = d.toLocaleDateString("ar-EG", {
      month: "long",
      year: "numeric",
    });
    return { key, label };
  });

  const getMonthItems = (key) =>
    allItems.filter((p) => {
      if (!p.expiry) return false;
      if (new Date(p.expiry) < today) return false;
      return p.expiry.startsWith(key);
    });

  const calcTotals = (items) => ({
    count: items.length,
    costTotal: items.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0),
    sellTotal: items.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0),
  });

  // ===== طباعة =====
  const handlePrint = (label, items) => {
    const { costTotal, sellTotal } = calcTotals(items);
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير صلاحيات - ${label}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
  h2 { text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; font-size: 13px; }
  th { background: #f0f0f0; font-weight: 700; }
  tr:nth-child(even) { background: #fafafa; }
  .totals { margin-top: 16px; display: flex; gap: 16px; justify-content: flex-end; }
  .tot { background: #f0f4ff; border-radius: 8px; padding: 8px 16px; font-weight: 700; font-size: 14px; }
  @media print { * { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
<h2>تقرير الصلاحيات</h2>
<div class="sub">${label} — ${items.length} صنف</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>اسم الصنف</th><th>الباركود</th>
      <th>تاريخ الانتهاء</th><th>المخزون</th>
      <th>سعر التكلفة</th><th>سعر البيع</th>
      <th>إجمالي التكلفة</th><th>إجمالي البيع</th>
    </tr>
  </thead>
  <tbody>
    ${items
      .map(
        (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.name || "-"}</td>
        <td>${p.barcode || "-"}</td>
        <td>${p.expiry || "-"}</td>
        <td>${p.stock || 0}</td>
        <td>${(p.cost || 0).toFixed(2)}</td>
        <td>${(p.price || 0).toFixed(2)}</td>
        <td>${((p.cost || 0) * (p.stock || 0)).toFixed(2)}</td>
        <td>${((p.price || 0) * (p.stock || 0)).toFixed(2)}</td>
      </tr>`
      )
      .join("")}
  </tbody>
</table>
<div class="totals">
  <div class="tot">إجمالي التكلفة: ${costTotal.toFixed(2)}</div>
  <div class="tot">إجمالي البيع: ${sellTotal.toFixed(2)}</div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
    win.document.close();
  };

  // ===== Styles =====
  const card = (borderColor = "#1d2d4a") => ({
    background: "#0f1623",
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: 16,
  });

  const btn = (bg = "#1d2d4a") => ({
    background: bg,
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  });

  const ItemsTable = ({ items }) => (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
      <thead>
        <tr style={{ background: "#080e1a" }}>
          {[
            "الصنف",
            "الباركود",
            "تاريخ الانتهاء",
            "المخزون",
            "التكلفة",
            "البيع",
          ].map((h) => (
            <th
              key={h}
              style={{
                padding: "8px 12px",
                textAlign: "right",
                color: "#4a6a9a",
                fontSize: 12,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id} style={{ borderBottom: "1px solid #0a101a" }}>
            <td
              style={{
                padding: "8px 12px",
                color: "#dde8ff",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {p.name}
            </td>
            <td style={{ padding: "8px 12px", color: "#4a6a8a", fontSize: 11 }}>
              {p.barcode || "-"}
            </td>
            <td style={{ padding: "8px 12px", color: "#ff7744", fontSize: 13 }}>
              {p.expiry}
            </td>
            <td style={{ padding: "8px 12px", color: "#dde8ff", fontSize: 13 }}>
              {p.stock}
            </td>
            <td style={{ padding: "8px 12px", color: "#ffaa44", fontSize: 13 }}>
              {(p.cost || 0).toFixed(2)}
            </td>
            <td style={{ padding: "8px 12px", color: "#44cc88", fontSize: 13 }}>
              {(p.price || 0).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 800 }}>
        تقرير الصلاحيات
      </h2>

      {/* ===== قسم المنتهية ===== */}
      <div style={{ ...card("#3a1010"), marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#ff4444",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            🔴 منتهية الصلاحية ({expired.length} صنف)
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            {expired.length > 0 ? (
              <>
                <button
                  style={btn("#1d2d4a")}
                  onClick={() => setShowExpiredDetail(!showExpiredDetail)}
                >
                  {showExpiredDetail ? "▲ إخفاء" : "▼ عرض الأصناف"}
                </button>
                <button
                  style={btn("#6b1010")}
                  onClick={() => onRemoveExpired && onRemoveExpired(expired)}
                >
                  📤 إخراج من المخزون
                </button>
              </>
            ) : (
              <span style={{ color: "#3a5a8a", fontSize: 13 }}>
                لا يوجد أصناف منتهية
              </span>
            )}
          </div>
        </div>
        {showExpiredDetail && expired.length > 0 && (
          <ItemsTable items={expired} />
        )}
      </div>

      {/* ===== 6 أشهر ===== */}
      <h3
        style={{
          margin: "0 0 14px",
          fontSize: 15,
          fontWeight: 700,
          color: "#7a9adf",
        }}
      >
        📅 قريبة الانتهاء — الأشهر القادمة
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {months.map(({ key, label }) => {
          const items = getMonthItems(key);
          const { count, costTotal, sellTotal } = calcTotals(items);
          const isExpanded = expandedMonth === key;
          const hasItems = count > 0;

          return (
            <div
              key={key}
              onClick={() =>
                hasItems && setExpandedMonth(isExpanded ? null : key)
              }
              style={{
                ...card(
                  isExpanded ? "#2a4a8a" : hasItems ? "#1d3a6a" : "#1a2030"
                ),
                cursor: hasItems ? "pointer" : "default",
                opacity: hasItems ? 1 : 0.45,
                transition: "border-color 0.2s",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#dde8ff",
                  fontSize: 14,
                  marginBottom: 12,
                }}
              >
                {label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>
                    عدد الأصناف
                  </span>
                  <span
                    style={{ color: "#5a8adf", fontWeight: 800, fontSize: 15 }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>
                    قيمة التكلفة
                  </span>
                  <span
                    style={{ color: "#ffaa44", fontWeight: 700, fontSize: 13 }}
                  >
                    {costTotal.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#4a6a8a", fontSize: 12 }}>
                    قيمة البيع
                  </span>
                  <span
                    style={{ color: "#44cc88", fontWeight: 700, fontSize: 13 }}
                  >
                    {sellTotal.toFixed(2)}
                  </span>
                </div>
              </div>
              {hasItems && (
                <div
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    color: "#4a6a8a",
                    fontSize: 11,
                  }}
                >
                  {isExpanded ? "▲ إخفاء" : "▼ عرض الأصناف"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== تفاصيل الشهر المفتوح ===== */}
      {expandedMonth &&
        (() => {
          const items = getMonthItems(expandedMonth);
          const { costTotal, sellTotal } = calcTotals(items);
          const monthLabel = months.find((m) => m.key === expandedMonth)?.label;
          return (
            <div style={card("#2a4a8a")}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <h4 style={{ margin: 0, color: "#dde8ff", fontSize: 14 }}>
                  📋 أصناف {monthLabel}
                </h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: "#ffaa44", fontSize: 12, fontWeight: 700 }}
                  >
                    تكلفة: {costTotal.toFixed(2)}
                  </span>
                  <span
                    style={{ color: "#44cc88", fontSize: 12, fontWeight: 700 }}
                  >
                    بيع: {sellTotal.toFixed(2)}
                  </span>
                  <button
                    style={btn("#1a3a7a")}
                    onClick={() => handlePrint(monthLabel, items)}
                  >
                    🖨️ طباعة
                  </button>
                </div>
              </div>
              <ItemsTable items={items} />
            </div>
          );
        })()}
    </div>
  );
}
function InventoryCount({
  products,
  setProducts,
  inventoryLogs,
  setInventoryLogs,
  currentUser,
  showToast,
  pharmacyId,
}) {
  const [showNew, setShowNew] = useState(false);
  const [countItems, setCountItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const startCount = () => {
    setCountItems(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        systemQty: p.stock,
        actualQty: p.stock,
        diff: 0,
      }))
    );
    setShowNew(true);
  };

  const saveCount = async () => {
    const logData = {
      id: "INV-ADJ-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      type: "جرد",
      items: countItems.map((i) => ({
        id: i.id,
        name: i.name,
        systemQty: i.systemQty,
        actualQty: i.actualQty,
        diff: i.actualQty - i.systemQty,
      })),
      notes,
      by: currentUser.name,
      pharmacy_id: pharmacyId,
    };

    const { error: logError } = await supabase
      .from("inventory_logs")
      .insert([logData]);

    if (logError) {
      showToast("❌ خطأ في حفظ الجرد: " + logError.message);
      return;
    }

    const changedItems = countItems.filter((i) => i.actualQty !== i.systemQty);

    if (changedItems.length > 0) {
      const adjustments = changedItems.map((i) => ({
        inventory_log_id: logData.id,
        product_id: i.id,
        quantity: i.actualQty - i.systemQty,
        date: logData.date,
        created_by: currentUser.name,
        pharmacy_id: pharmacyId,
      }));

      const { error: adjError } = await supabase
        .from("inventory_adjustments")
        .insert(adjustments);

      if (adjError) {
        showToast("❌ خطأ في حفظ التسويات: " + adjError.message);
        return;
      }

      await Promise.all(
        changedItems.map((i) =>
          supabase
            .from("products")
            .update({ stock: i.actualQty })
            .eq("id", i.id)
            .eq("pharmacy_id", pharmacyId)
        )
      );
    }

    setInventoryLogs((p) => [logData, ...p]);
    setProducts((p) =>
      p.map((x) => {
        const ci = changedItems.find((i) => i.id === x.id);
        return ci ? { ...x, stock: ci.actualQty } : x;
      })
    );

    setShowNew(false);
    setNotes("");
    showToast("تم حفظ الجرد وتحديث المخزون ✓");
  };

  const filtered = countItems.filter(
    (i) => (i.name||"").includes(search) || (i.category||"").includes(search)
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>نظام الجرد</h2>
        <Btn icon="count" onClick={startCount}>
          بدء جرد جديد
        </Btn>
      </div>

      <Table
        headers={["رقم الجرد", "التاريخ", "بواسطة", "ملاحظات", "الفروقات"]}
        rows={inventoryLogs.map((l) => [
          // ✅ رقم الجرد قابل للضغط
          <span
            style={{
              color: "#6aaeff",
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
            }}
            onClick={() => setSelectedLog(l)}
          >
            {l.id}
          </span>,
          l.date,
          l.by,
          l.notes || "-",
          <span
            style={{
              color: l.items.some((i) => i.diff !== 0) ? "#ffaa44" : "#44dd88",
            }}
          >
            {l.items.filter((i) => i.diff !== 0).length} صنف مختلف
          </span>,
        ])}
      />

      {/* ✅ Modal عرض تفاصيل الجرد */}
      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`تفاصيل الجرد - ${selectedLog?.id}`}
        wide
      >
        {selectedLog && (
          <div>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 16,
                color: "#4a6a9a",
                fontSize: 13,
              }}
            >
              <span>📅 {selectedLog.date}</span>
              <span>👤 {selectedLog.by}</span>
              {selectedLog.notes && <span>📝 {selectedLog.notes}</span>}
            </div>
            <div
              style={{
                overflowX: "auto",
                maxHeight: "55vh",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "#080e1a",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    {["الصنف", "كمية النظام", "الكمية الفعلية", "الفرق"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "9px 14px",
                            textAlign: "right",
                            color: "#4a6a9a",
                            fontSize: 12,
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedLog.items.map((item, i) => {
                    const changed = item.diff !== 0;
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #0a101a",
                          // ✅ الأصناف المتغيرة بخلفية مميزة
                          background: changed
                            ? item.diff < 0
                              ? "rgba(255,100,100,0.08)"
                              : "rgba(68,221,136,0.08)"
                            : i % 2 === 0
                            ? "transparent"
                            : "#080e14",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            color: changed ? "#dde8ff" : "#6a8aaa",
                            fontWeight: changed ? 700 : 400,
                          }}
                        >
                          {item.name}
                          {changed && (
                            <span
                              style={{
                                marginRight: 8,
                                fontSize: 11,
                                color: item.diff < 0 ? "#ff7777" : "#44dd88",
                              }}
                            >
                              {item.diff < 0 ? "▼ نقص" : "▲ زيادة"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", color: "#4a6a8a" }}>
                          {item.systemQty}
                        </td>
                        <td style={{ padding: "8px 14px", color: "#dde8ff" }}>
                          {item.actualQty}
                        </td>
                        <td
                          style={{
                            padding: "8px 14px",
                            fontWeight: 700,
                            color:
                              item.diff < 0
                                ? "#ff7777"
                                : item.diff > 0
                                ? "#44dd88"
                                : "#4a6a8a",
                          }}
                        >
                          {item.diff > 0 ? "+" : ""}
                          {item.diff}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, textAlign: "left" }}>
              <Btn variant="ghost" onClick={() => setSelectedLog(null)}>
                إغلاق
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal الجرد الجديد - بدون تغيير */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="جرد المخزون الجديد"
        wide
      >
        <Input
          label="ملاحظات الجرد"
          value={notes}
          onChange={setNotes}
          placeholder="وصف الجرد..."
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث في الأصناف..."
          style={{
            width: "100%",
            background: "#080e1a",
            border: "1px solid #1d2d4a",
            borderRadius: 8,
            padding: "9px 12px",
            color: "#dde8ff",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            marginTop: 12,
            marginBottom: 12,
          }}
        />
        <div
          style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#080e1a", position: "sticky", top: 0 }}>
                {[
                  "الصنف",
                  "الفئة",
                  "كمية النظام",
                  "الكمية الفعلية",
                  "الفرق",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 14px",
                      textAlign: "right",
                      color: "#4a6a9a",
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #0a101a",
                    background: i % 2 === 0 ? "transparent" : "#080e14",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      color: "#c0d0f0",
                    }}
                  >
                    {item.name}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td style={{ padding: "8px 14px", color: "#4a6a8a" }}>
                    {item.systemQty}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <input
                      type="number"
                      min="0"
                      value={item.actualQty}
                      onChange={(e) =>
                        setCountItems((p) =>
                          p.map((x) =>
                            x.id === item.id
                              ? {
                                  ...x,
                                  actualQty: +e.target.value,
                                  diff: +e.target.value - x.systemQty,
                                }
                              : x
                          )
                        )
                      }
                      style={{
                        width: 70,
                        background: "#080e1a",
                        border: "1px solid #1d2d4a",
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: "#dde8ff",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      padding: "8px 14px",
                      fontWeight: 700,
                      color:
                        item.actualQty - item.systemQty < 0
                          ? "#ff7777"
                          : item.actualQty - item.systemQty > 0
                          ? "#44dd88"
                          : "#4a6a8a",
                    }}
                  >
                    {item.actualQty - item.systemQty > 0 ? "+" : ""}
                    {item.actualQty - item.systemQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <Btn variant="ghost" onClick={() => setShowNew(false)}>
            إلغاء
          </Btn>
          <Btn icon="check" onClick={saveCount}>
            حفظ الجرد وتحديث المخزون
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ==================== CATEGORIES ====================
const MAIN_CATEGORIES = {
  دواء: {
    sub1: ["مستورد", "محلي"],
    sub2: ["فموي", "موضعي", "أمبول"],
  },
  "كوزمتك عادي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "كوزمتك طبي": {
    sub1: [],
    sub2: ["عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات أطفال": {
    sub1: [],
    sub2: ["حفاضات", "حليب", "رضاعة", "عناية بالشعر", "عناية بالجلد"],
  },
  "مستلزمات طبية": {
    sub1: [],
    sub2: ["جهاز طبي", "عناية بالجروح", "وقاية"],
  },
};
const SUPPLY_CATEGORIES = [
  "دواء",
  "مستلزمات طبية", 
  "كوزمتك عادي",
  "كوزمتك طبي",
  "حليب أطفال",
  "حفاضات",
  "رضاعات ومستلزمات الرضاعة",
];
function ProductsModule({ products, setProducts, suppliers, sales, purchases, showToast, pharmacyId }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showSlowProducts, setShowSlowProducts] = useState(false);

  // ── الشركات المنتجة ──
  const [manufacturers, setManufacturers] = useState([]);
  const [showMfrModal, setShowMfrModal] = useState(false);
  const [newMfrName, setNewMfrName] = useState("");

  // ── المواد الفعالة ──
  const [allIngredients, setAllIngredients] = useState([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [showIngredientDropdown, setShowIngredientDropdown] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  // ── الباركودات ──
  const [barcodes, setBarcodes] = useState([]);

  const blank = {
    id: "", nameAr: "", nameEn: "",
    mainCategory: "دواء", subCategory1: "مستورد", subCategory2: "فموي",
    unit: "قرص", unitDivision: 1,
    price: "", cost: "", taxable: true,
    minStock: "", maxStock: "",
    isEssential: false, isChronic: false,
    supply_category: "",
    manufacturer_id: "",
    notAvailableMarket: false,
    shortageReportUrl: "",
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // تحميل المواد الفعالة والشركات
  useEffect(() => {
    supabase.from("active_ingredients").select("*").order("name_ar")
      .then(({ data }) => { if (data) setAllIngredients(data); });
    supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId).order("name")
      .then(({ data }) => { if (data) setManufacturers(data); });
  }, [pharmacyId]);

  const handleMainCategoryChange = (val) => {
    const cat = MAIN_CATEGORIES[val];
    setForm((p) => ({
      ...p, mainCategory: val,
      subCategory1: cat.sub1[0] || "",
      subCategory2: cat.sub2[0] || "",
    }));
  };

  const filtered = products.filter((p) => {
    const s = search.toLowerCase();
    const str = (v) => (v == null ? "" : String(v));
    return (
      str(p.nameAr || p.name).includes(search) ||
      str(p.nameEn).toLowerCase().includes(s) ||
      str(p.barcode).includes(search) ||
      str(p.id).includes(search) ||
      str(p.mainCategory || p.category).includes(search)
    );
  });

  // ── فتح تعديل ──
  const openEdit = async (p) => {
    setEditing(p.id);
    setForm({
      ...blank, ...p,
      nameAr: p.nameAr || p.name_ar || p.name || "",
      nameEn: p.nameEn || p.name_en || "",
      price: String(p.price), cost: String(p.cost),
      minStock: String(p.min_stock || p.minStock || ""),
      maxStock: String(p.max_stock || p.maxStock || ""),
      unitDivision: p.unit_division || p.unitDivision || 1,
      mainCategory: p.main_category || p.mainCategory || "دواء",
      subCategory1: p.sub_category1 || p.subCategory1 || "",
      subCategory2: p.sub_category2 || p.subCategory2 || "",
      isEssential: p.is_essential ?? p.isEssential ?? false,
      isChronic: p.is_chronic ?? false,
      supply_category: p.supply_category || "",
      manufacturer_id: p.manufacturer_id || "",
      notAvailableMarket: p.not_available_market ?? false,
      shortageReportUrl: p.shortage_report_url || "",
    });

    const { data: bc } = await supabase.from("product_barcodes").select("*").eq("product_id", p.id).order("is_primary", { ascending: false });
    setBarcodes(bc || []);

    const { data: pi } = await supabase.from("product_ingredients").select("*, active_ingredients(name_ar)").eq("product_id", p.id);
    setSelectedIngredients((pi || []).map((x) => ({
      ingredient_id: x.ingredient_id,
      name_ar: x.active_ingredients?.name_ar || "",
      concentration: x.concentration || "",
      db_id: x.id,
    })));

    setShowForm(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank, id: "P" + String(products.length + 1).padStart(3, "0") });
    setBarcodes([{ base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: true }]);
    setSelectedIngredients([]);
    setShowForm(true);
  };

  const addBarcode = () => setBarcodes((prev) => [...prev, { base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: false }]);
  const updateBarcode = (i, key, val) => setBarcodes((prev) => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const removeBarcode = (i) => setBarcodes((prev) => prev.filter((_, idx) => idx !== i));

  const addIngredient = async (ing) => {
    if (selectedIngredients.find((x) => x.ingredient_id === ing.id)) { setShowIngredientDropdown(false); setIngredientSearch(""); return; }
    setSelectedIngredients((prev) => [...prev, { ingredient_id: ing.id, name_ar: ing.name_ar, concentration: "", db_id: null }]);
    setShowIngredientDropdown(false);
    setIngredientSearch("");
  };

  const addNewIngredient = async () => {
    if (!ingredientSearch.trim()) return;
    const { data, error } = await supabase.from("active_ingredients").insert({ name_ar: ingredientSearch.trim() }).select().single();
    if (error) { showToast("خطأ في إضافة المادة الفعالة", "error"); return; }
    setAllIngredients((prev) => [...prev, data]);
    addIngredient(data);
  };

  const removeIngredient = (ingredient_id) => setSelectedIngredients((prev) => prev.filter((x) => x.ingredient_id !== ingredient_id));
  const updateIngredientConc = (ingredient_id, val) => setSelectedIngredients((prev) => prev.map((x) => x.ingredient_id === ingredient_id ? { ...x, concentration: val } : x));

  // ── إدارة الشركات المنتجة ──
  const addManufacturer = async () => {
    if (!newMfrName.trim()) return;
    const { data, error } = await supabase.from("manufacturers").insert({ name: newMfrName.trim(), pharmacy_id: pharmacyId }).select().single();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setManufacturers((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewMfrName("");
    showToast("تمت إضافة الشركة ✓");
  };

  const deleteManufacturer = async (id) => {
    await supabase.from("manufacturers").delete().eq("id", id);
    setManufacturers((p) => p.filter((m) => m.id !== id));
    showToast("تم الحذف");
  };

  // ── حفظ ──
  const save = async () => {
    if (!form.nameAr || !form.price) { showToast("يرجى ملء الحقول المطلوبة", "error"); return; }
    const p = {
      id: form.id,
      name: form.nameAr, name_ar: form.nameAr, name_en: form.nameEn,
      barcode: barcodes.find((b) => b.is_primary)?.base_barcode || barcodes[0]?.base_barcode || "",
      category: form.mainCategory, main_category: form.mainCategory,
      sub_category1: form.subCategory1, sub_category2: form.subCategory2,
      unit: form.unit, unit_division: +form.unitDivision || 1,
      price: +form.price, cost: +form.cost, taxable: form.taxable,
      min_stock: +form.minStock, max_stock: +form.maxStock,
      active_ingredient: selectedIngredients[0]?.name_ar || "",
      concentration: selectedIngredients[0]?.concentration || "",
      is_essential: form.isEssential, is_chronic: form.isChronic,
      supply_category: form.supply_category,
      manufacturer_id: form.manufacturer_id || null,
      not_available_market: form.notAvailableMarket,
      shortage_report_url: form.shortageReportUrl || null,
    };

    let productId = form.id;

    if (editing) {
      const { error } = await supabase.from("products").update(p).eq("id", editing);
      if (error) { showToast("خطأ في التعديل: " + error.message, "error"); return; }
      setProducts((prev) => prev.map((x) => (x.id === editing ? { ...x, ...p } : x)));
    } else {
      const { data, error } = await supabase.from("products").insert({ ...p, pharmacy_id: pharmacyId }).select();
      if (error) { showToast("خطأ في الإضافة: " + error.message, "error"); return; }
      productId = data[0].id;
      setProducts((prev) => [...prev, data[0]]);
    }

    if (editing) await supabase.from("product_barcodes").delete().eq("product_id", productId);
    const validBarcodes = barcodes.filter((b) => b.base_barcode.trim());
    if (validBarcodes.length > 0) {
      await supabase.from("product_barcodes").insert(validBarcodes.map((b) => ({ ...b, product_id: productId, id: undefined, pharmacy_id: pharmacyId })));
    }

    if (editing) await supabase.from("product_ingredients").delete().eq("product_id", productId);
    if (selectedIngredients.length > 0) {
      await supabase.from("product_ingredients").insert(selectedIngredients.map((x) => ({ product_id: productId, ingredient_id: x.ingredient_id, concentration: x.concentration, pharmacy_id: pharmacyId })));
    }

    setShowForm(false);
    showToast(editing ? "تم تعديل الصنف" : "تمت إضافة الصنف ✓");
  };

  const currentCat = MAIN_CATEGORIES[form.mainCategory] || { sub1: [], sub2: [] };
  const filteredIngredients = allIngredients.filter((x) =>
    (x.name_ar || "").includes(ingredientSearch) || (x.name_en || "").toLowerCase().includes(ingredientSearch.toLowerCase())
  );

  const inputStyle = { background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

  const lowStockList = products
    .filter((p) => (p.stock ?? 0) <= (p.minStock || p.min_stock || 0))
    .sort((a, b) => {
      const aEss = (a.is_essential || a.isEssential) ? 1 : 0;
      const bEss = (b.is_essential || b.isEssential) ? 1 : 0;
      return bEss - aEss;
    });

  // ========== تصنيف حركة الصنف (سريع/بطيء) ==========
  const getMovementClass = (productId) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = (sales || []).filter((s) => {
      const saleDate = new Date(s.date);
      return saleDate >= thirtyDaysAgo && s.items?.some((i) => i.id === productId);
    });
    const salesDays = new Set(recentSales.map((s) => s.date)).size;
    const salesCount = recentSales.length;
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: "#44dd88" };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: "#3a9aff" };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: "#ffaa44" };
    return             { class: "very_slow", label: "بطيء جداً", color: "#ff5555" };
  };

  const slowProducts = (products || [])
    .filter((p) => { const mv = getMovementClass(p.id); return (mv.class === "slow" || mv.class === "very_slow") && p.stock > 0; })
    .sort((a, b) => (b.cost || 0) - (a.cost || 0));

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>إدارة الأصناف</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn icon="settings" variant="secondary" onClick={() => setShowMfrModal(true)}>الشركات المنتجة</Btn>
          <Btn icon="plus" onClick={openAdd}>إضافة صنف</Btn>
        </div>
      </div>

      {/* ── Search ── */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم أو الباركود أو الفئة..."
        style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: "#dde8ff", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="إجمالي الأصناف" value={products.length} icon="inventory" color="#3a9aff" />
        <div onClick={() => setShowLowStock(true)} style={{ cursor: "pointer" }}>
          <StatCard label="مخزون منخفض" value={lowStockList.length} icon="alert" color="#ffaa44" />
        </div>
        <div onClick={() => setShowSlowProducts(true)} style={{ cursor: "pointer" }}>
          <StatCard label="أصناف بطيئة" value={slowProducts.length} icon="alert" color="#ff5555" />
        </div>
        <StatCard label="أدوية أساسية" value={products.filter((p) => p.is_essential || p.isEssential).length} icon="pill" color="#f59e0b" />
        <StatCard label="قيمة المخزون" value={products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0).toFixed(0) + " ر.س"} icon="money" color="#a78bfa" />
      </div>

      {/* ── Table ── */}
      <Table
        headers={["رمز", "الصنف", "الشركة المنتجة", "الباركود", "الفئة", "سعر البيع", "التكلفة", "أساسي", "إجراءات"]}
        rows={filtered.map((p) => {
          const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
          return [
            <span style={{ color: "#4a6a8a", fontSize: 11 }}>{p.id}</span>,
            <div>
              <div style={{ fontWeight: 700, color: "#dde8ff" }}>{p.nameAr || p.name}</div>
              {p.nameEn && <div style={{ fontSize: 11, color: "#4a6a8a" }}>{p.nameEn}</div>}
              <div style={{ fontSize: 10, color: "#3a5a8a" }}>{p.active_ingredient} {p.concentration}</div>
            </div>,
            mfr ? <Badge color="#0a1a3a" text="#6aaeff">{mfr.name}</Badge> : <span style={{ color: "#3a5a8a", fontSize: 11 }}>—</span>,
            <span style={{ fontSize: 11, color: "#4a6a8a", fontFamily: "monospace" }}>{p.barcode}</span>,
            <div>
              <Badge>{p.mainCategory || p.category}</Badge>
              {p.subCategory2 && <div style={{ fontSize: 10, color: "#3a5a8a", marginTop: 3 }}>{p.subCategory1 && p.subCategory1 + " · "}{p.subCategory2}</div>}
            </div>,
            <span style={{ color: "#3a9aff", fontWeight: 700 }}>{p.price} ر.س</span>,
            <span style={{ color: "#4a6a8a" }}>{p.cost} ر.س</span>,
            (p.is_essential || p.isEssential) ? <Badge color="#2a1a00" text="#f59e0b">⭐ أساسي</Badge> : <span style={{ color: "#4a6a8a", fontSize: 11 }}>—</span>,
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(p.not_available_market) && (
                p.shortage_report_url
                  ? <a href={p.shortage_report_url} target="_blank" rel="noreferrer"><Badge color="#3a0a0a" text="#ff5566">🚫 غير متوفر</Badge></a>
                  : <Badge color="#3a0a0a" text="#ff5566">🚫 غير متوفر</Badge>
              )}
              <div style={{ display: "flex", gap: 5 }}>
              <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEdit(p)}>تعديل</Btn>
              <Btn size="sm" icon="trash" variant="danger" onClick={async () => {
                await supabase.from("products").delete().eq("id", p.id);
                setProducts((prev) => prev.filter((x) => x.id !== p.id));
                showToast("تم حذف الصنف");
              }}>حذف</Btn>
              </div>
            </div>,
          ];
        })}
      />

      {/* ── Modal المخزون المنخفض ── */}
      <Modal open={showLowStock} onClose={() => setShowLowStock(false)} title="⚠️ الأصناف ذات المخزون المنخفض">
        {lowStockList.length === 0 ? (
          <div style={{ color: "#4a6a8a", textAlign: "center", padding: 20 }}>لا توجد أصناف ناقصة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {lowStockList.map((p) => {
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : "#0d1a2e",
                  border: `1px solid ${isEss ? "#f59e0b" : "#1d2d4a"}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? "#f59e0b" : "#dde8ff", fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 2 }}>
                      المتاح: {p.stock ?? 0} / الحد الأدنى: {p.minStock || p.min_stock || 0}
                    </div>
                  </div>
                  <Btn size="sm" icon="edit" variant="secondary" onClick={() => { setShowLowStock(false); openEdit(p); }}>تعديل</Btn>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Modal الأصناف البطيئة ── */}
      <Modal open={showSlowProducts} onClose={() => setShowSlowProducts(false)} title="⚠️ أصناف بطيئة تحتاج تنشيط">
        {slowProducts.length === 0 ? (
          <div style={{ color: "#4a6a8a", textAlign: "center", padding: 20 }}>لا توجد أصناف بطيئة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {slowProducts.map((p) => {
              const mv = getMovementClass(p.id);
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : "#1a0a00",
                  border: `1px solid ${isEss ? "#f59e0b" : "#3a2000"}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? "#f59e0b" : "#dde8ff", fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 2 }}>
                      مخزون: {p.stock} · تكلفة: {p.cost} ر.س
                    </div>
                  </div>
                  <Badge color="#0a0800" text={mv.color}>{mv.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Modal إدارة الشركات ── */}
      <Modal open={showMfrModal} onClose={() => setShowMfrModal(false)} title="🏭 إدارة الشركات المنتجة">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newMfrName} onChange={(e) => setNewMfrName(e.target.value)}
            placeholder="اسم الشركة المنتجة..."
            onKeyDown={(e) => e.key === "Enter" && addManufacturer()}
            style={{ ...inputStyle, flex: 1 }} />
          <Btn icon="plus" onClick={addManufacturer}>إضافة</Btn>
        </div>
        {manufacturers.length === 0 ? (
          <div style={{ color: "#4a6a8a", textAlign: "center", padding: 20 }}>لا توجد شركات مضافة</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {manufacturers.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #0a101a" }}>
                <span style={{ color: "#dde8ff", fontSize: 13 }}>{m.name}</span>
                <Btn size="sm" variant="danger" onClick={() => deleteManufacturer(m.id)}>حذف</Btn>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Modal إضافة/تعديل ── */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "تعديل الصنف" : "إضافة صنف جديد"} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="رمز الصنف" value={form.id} onChange={(v) => F("id", v)} placeholder="P001" />
          <Input label="الاسم بالعربي *" value={form.nameAr} onChange={(v) => F("nameAr", v)} placeholder="باراسيتامول" />
          <Input label="الاسم بالإنجليزي" value={form.nameEn} onChange={(v) => F("nameEn", v)} placeholder="Paracetamol" />

          <Select label="الفئة الرئيسية" value={form.mainCategory} onChange={handleMainCategoryChange} options={Object.keys(MAIN_CATEGORIES)} />
          <Select label="فئة التوريد" value={form.supply_category} onChange={(v) => F("supply_category", v)} options={["", ...SUPPLY_CATEGORIES]} />
          {currentCat.sub1.length > 0 && <Select label="المصدر" value={form.subCategory1} onChange={(v) => F("subCategory1", v)} options={currentCat.sub1} />}
          {currentCat.sub2.length > 0 && <Select label="الشكل الصيدلاني" value={form.subCategory2} onChange={(v) => F("subCategory2", v)} options={currentCat.sub2} />}

          {/* ── الشركة المنتجة ── */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 6 }}>🏭 الشركة المنتجة</div>
            <select value={form.manufacturer_id} onChange={(e) => F("manufacturer_id", e.target.value)} style={inputStyle}>
              <option value="">— اختر الشركة —</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "#3a5a8a", marginTop: 4 }}>
              لا تجد الشركة؟ <span onClick={() => setShowMfrModal(true)} style={{ color: "#3a9aff", cursor: "pointer", textDecoration: "underline" }}>أضفها من هنا</span>
            </div>
          </div>

          <Input label="وحدة البيع" value={form.unit} onChange={(v) => F("unit", v)} placeholder="قرص / كبسولة..." />
          <Input label="تقسيم الوحدة" value={form.unitDivision === 1 ? "" : String(form.unitDivision)} onChange={(v) => F("unitDivision", v ? +v : 1)} type="number" placeholder="فارغ = بدون تقسيم" />
          <Input label="سعر البيع *" value={form.price} onChange={(v) => F("price", v)} type="number" placeholder="0.00" />
          <Input label="سعر التكلفة" value={form.cost} onChange={(v) => F("cost", v)} type="number" placeholder="0.00" />
          <Input label="الحد الأدنى للمخزون" value={form.minStock} onChange={(v) => F("minStock", v)} type="number" placeholder="10" />
          <Input label="الحد الأقصى للمخزون" value={form.maxStock} onChange={(v) => F("maxStock", v)} type="number" placeholder="100" />

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#5a7aaa", fontSize: 13, fontWeight: 600 }}>خاضع لضريبة القيمة المضافة 15%</label>
            <input type="checkbox" checked={form.taxable} onChange={(e) => F("taxable", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>⭐ دواء أساسي</label>
            <input type="checkbox" checked={form.isEssential} onChange={(e) => F("isEssential", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#44aaff", fontSize: 13, fontWeight: 600 }}>🔄 دواء مزمن</label>
            <input type="checkbox" checked={form.isChronic} onChange={(e) => F("isChronic", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#ff5566", fontSize: 13, fontWeight: 600 }}>🚫 غير متوفر بالسوق السعودي</label>
            <input type="checkbox" checked={form.notAvailableMarket} onChange={(e) => F("notAvailableMarket", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          {form.notAvailableMarket && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Input label="رابط بلاغ عدم التوفر (منصة رصد مثلاً)" value={form.shortageReportUrl} onChange={(v) => F("shortageReportUrl", v)} placeholder="https://..." />
            </div>
          )}
        </div>

        {/* المواد الفعالة */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1d2d4a", paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: "#3a9aff", marginBottom: 10, fontSize: 14 }}>🧪 المواد الفعالة</div>
          {selectedIngredients.map((ing) => (
            <div key={ing.ingredient_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 12px", color: "#dde8ff", fontSize: 13 }}>{ing.name_ar}</div>
              <input value={ing.concentration} onChange={(e) => updateIngredientConc(ing.ingredient_id, e.target.value)}
                placeholder="التركيز (مثال: 500mg)"
                style={{ width: 160, background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
              <Btn size="sm" variant="danger" onClick={() => removeIngredient(ing.ingredient_id)}>✕</Btn>
            </div>
          ))}
          <div style={{ position: "relative", marginTop: 8 }}>
            <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setShowIngredientDropdown(true); }}
              onFocus={() => setShowIngredientDropdown(true)}
              placeholder="🔍 بحث عن مادة فعالة أو إضافة جديدة..."
              style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 12px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            {showIngredientDropdown && ingredientSearch && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {filteredIngredients.map((ing) => (
                  <div key={ing.id} onClick={() => addIngredient(ing)}
                    style={{ padding: "8px 12px", cursor: "pointer", color: "#dde8ff", fontSize: 13, borderBottom: "1px solid #1d2d4a" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1d2d4a"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    {ing.name_ar} {ing.name_en && <span style={{ color: "#4a6a8a", fontSize: 11 }}>({ing.name_en})</span>}
                  </div>
                ))}
                <div onClick={addNewIngredient}
                  style={{ padding: "8px 12px", cursor: "pointer", color: "#44dd88", fontSize: 13, fontWeight: 600 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#1d2d4a"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  ➕ إضافة "{ingredientSearch}" كمادة فعالة جديدة
                </div>
              </div>
            )}
          </div>
        </div>

        {/* الباركودات */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1d2d4a", paddingTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "#3a9aff", fontSize: 14 }}>📦 الباركودات</div>
            <Btn size="sm" icon="plus" onClick={addBarcode}>إضافة باركود</Btn>
          </div>
          {barcodes.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input value={b.base_barcode} onChange={(e) => updateBarcode(i, "base_barcode", e.target.value)} placeholder="باركود أساسي *"
                style={{ background: "#080e1a", border: `1px solid ${b.is_primary ? "#3a9aff" : "#1d2d4a"}`, borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
              <input value={b.batch_number} onChange={(e) => updateBarcode(i, "batch_number", e.target.value)} placeholder="رقم التشغيلة"
                style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
              <input value={b.serial_number} onChange={(e) => updateBarcode(i, "serial_number", e.target.value)} placeholder="الرقم التسلسلي"
                style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
              <input value={b.expiry_date} onChange={(e) => updateBarcode(i, "expiry_date", e.target.value)} type="date"
                style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
              <button onClick={() => setBarcodes((prev) => prev.map((x, idx) => ({ ...x, is_primary: idx === i })))}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: b.is_primary ? "#1a3a6a" : "#1d2d4a", color: b.is_primary ? "#3a9aff" : "#4a6a8a" }}>
                {b.is_primary ? "⭐ رئيسي" : "رئيسي"}
              </button>
              {barcodes.length > 1 && <Btn size="sm" variant="danger" onClick={() => removeBarcode(i)}>✕</Btn>}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={save}>{editing ? "حفظ التعديل" : "إضافة الصنف"}</Btn>
        </div>
      </Modal>
    </div>
  );
}
function SuppliersModule({
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
    green:  { bg: "#0a2010", border: "#1a5020", text: "#44dd88", label: "منتظم" },
    orange: { bg: "#1a1000", border: "#4a3000", text: "#ffaa44", label: "تأخير بسيط" },
    red:    { bg: "#1a0a0a", border: "#4a1010", text: "#ff5555", label: "متأخر" },
  };

  // ========== المستحقات ==========
  const getSupplierDebt = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const openingBalance = supplier?.opening_balance || 0;
    const invoicesDebt = purchases
      .filter((p) => p.supplier === supplierId && p.payment_status !== "مسددة")
      .reduce((s, p) => s + (p.total - (p.paid || 0)), 0);
    return openingBalance + invoicesDebt;
  };

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
    showToast("تم حفظ طلب المرتجع");
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
      .filter((p) => p.supplier === supplierId && p.payment_status !== "مسددة")
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remaining = totalAmount;
    const updates = [];
    for (const po of unpaid) {
      if (remaining <= 0) break;
      const balance = po.total - (po.paid || 0);
      const payment = Math.min(remaining, balance);
      const newPaid = (po.paid || 0) + payment;
      updates.push({ id: po.id, paid: newPaid, payment_status: newPaid >= po.total ? "مسددة" : "مسددة جزئياً" });
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
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: "#44dd88" };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: "#3a9aff" };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: "#ffaa44" };
    return             { class: "very_slow", label: "بطيء جداً", color: "#ff5555" };
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
          { k: "all",    l: "الكل",           color: "#4a6a8a" },
          { k: "green",  l: "🟢 منتظم",       color: "#44dd88" },
          { k: "orange", l: "🟠 تأخير بسيط",  color: "#ffaa44" },
          { k: "red",    l: "🔴 متأخر",        color: "#ff5555" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilterStatus(f.k)} style={{
            padding: "7px 16px", borderRadius: 8, border: "1px solid",
            borderColor: filterStatus === f.k ? f.color : "#1d2d4a",
            background: filterStatus === f.k ? "#0a1020" : "transparent",
            color: filterStatus === f.k ? f.color : "#4a6a8a",
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
              background: "#0f1623", border: `1px solid ${sc.border}`,
              borderRadius: 14, padding: 18, borderTop: `3px solid ${sc.text}`,
            }}>
              {/* اسم + حالة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#dde8ff", fontSize: 15 }}>{s.name}</div>
                  <div style={{ color: "#3a6a9a", fontSize: 11, marginTop: 2 }}>رمز: {s.id}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge color={sc.bg} text={sc.text}>{sc.label}</Badge>
                  {rating && <span style={{ fontSize: 11, color: "#4a6a8a" }}>تنفيذ: {rating.fulfillmentRate}%</span>}
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
                    <div style={{ color: "#ff7744", fontWeight: 700, fontSize: 12 }}>🔄 مرتجع تلقائي مقترح</div>
                    <div style={{ color: "#4a6a8a", fontSize: 11 }}>{autoReturnCount} صنف يستوفي شروط الإرجاع</div>
                  </div>
                  <span style={{ color: "#ff7744", fontSize: 12 }}>إدارة →</span>
                </div>
              )}

              {/* رصيد أول المدة */}
              {(s.opening_balance || 0) > 0 && (
                <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 6 }}>رصيد أول المدة</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#ffaa44", marginBottom: 6 }}>
                    {(s.opening_balance || 0).toFixed(2)} ر.س
                  </div>
                  {/* تفاصيل أعمار الدين */}
                  {(s.opening_balance_details || []).length > 0 && (() => {
                    const aging = getOpeningBalanceAging(s.opening_balance_details);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                        {Object.entries(aging).map(([bucket, val]) => val > 0 && (
                          <div key={bucket} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: "#4a6a8a" }}>{bucket} يوم</div>
                            <div style={{
                              fontSize: 11, fontWeight: 700,
                              color: bucket === "90+" ? "#ff5555" : bucket === "61-90" ? "#ffaa44" : "#dde8ff",
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
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4a6a8a", marginBottom: 4 }}>
                    <span>الكريدت المستخدم</span>
                    <span style={{ color: debt > creditLimit * 0.8 ? "#ff5555" : "#44dd88" }}>
                      {debt.toFixed(0)} / {creditLimit.toFixed(0)} ر.س
                    </span>
                  </div>
                  <div style={{ background: "#0a1020", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${creditUsedPct}%`,
                      background: creditUsedPct > 80 ? "#ff5555" : creditUsedPct > 50 ? "#ffaa44" : "#44dd88",
                      borderRadius: 4, transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              )}

              {/* فواتير مستحقة */}
              {supPurchases.filter((p) => p.payment_status !== "مسددة").length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#4a6a8a", marginBottom: 6 }}>الفواتير المستحقة:</div>
                  {supPurchases
                    .filter((p) => p.payment_status !== "مسددة")
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, 3)
                    .map((po) => {
                      const dueDays = getDueDays(po, s);
                      const balance = po.total - (po.paid || 0);
                      return (
                        <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: "#080e1a", borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: "#6a8aaa" }}>{po.id}</span>
                          <span style={{ fontSize: 11, color: "#dde8ff" }}>{balance.toFixed(0)} ر.س</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: dueDays < 0 ? "#ff5555" : dueDays <= 7 ? "#ffaa44" : "#44dd88" }}>
                            {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                          </span>
                          {po.payment_status === "مسددة جزئياً" && <Badge color="#1a1000" text="#ffaa44">جزئي</Badge>}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* بيانات الاتصال */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                {s.taxId && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: "#3a6a9a", fontSize: 11, width: 90, flexShrink: 0 }}>الرقم الضريبي:</span>
                    <Badge color="#0a2a00" text="#44dd88">{s.taxId}</Badge>
                  </div>
                )}
                {(s.supply_categories || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {s.supply_categories.map((cat) => <Badge key={cat} color="#0a2040" text="#3a9aff">{cat}</Badge>)}
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
                    style={{ padding: "6px 10px", background: "#0a2a10", border: "1px solid #1a5020", borderRadius: 7, color: "#44dd88", cursor: "pointer", fontSize: 14 }}>
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
                <tr style={{ background: "#080e1a" }}>
                  {["الصنف", "المخزون", "الصلاحية", "الأيام المتبقية", "كمية الإرجاع", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: "#4a6a9a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {autoReturnItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: "#c0d0f0", fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 13 }}>{item.stock}</td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 12 }}>{item.expiry}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ color: item.daysToExpiry < 90 ? "#ff5555" : "#ffaa44", fontWeight: 700, fontSize: 12 }}>
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
                        style={{ width: 70, background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: "#dde8ff", fontSize: 13, outline: "none" }}
                      />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setAutoReturnItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: "#5a2a2a", cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {autoReturnItems.length === 0 && (
            <div style={{ textAlign: "center", color: "#4a6a8a", padding: 20 }}>تم إزالة كل الأصناف</div>
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
            <label style={{ color: "#4a6a8a", fontSize: 13 }}>تغطية لمدة:</label>
            <input type="number" min="1" value={coverageDays}
              onChange={(e) => { setCoverageDays(+e.target.value); generateOrder(showOrderForm); }}
              style={{ width: 70, background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 13, outline: "none" }} />
            <span style={{ color: "#4a6a8a", fontSize: 13 }}>يوم</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#080e1a" }}>
                  {["الصنف", "الحركة", "المخزون", "الحد الأدنى", "الكمية المطلوبة", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: "#4a6a9a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: "#c0d0f0", fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 11, color: item.movement.color, fontWeight: 700 }}>{item.movement.label}</span></td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 13 }}>{item.currentStock}</td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 13 }}>{item.minStock}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" value={item.orderQty}
                        onChange={(e) => setOrderItems((prev) => prev.map((x, j) => j === i ? { ...x, orderQty: +e.target.value } : x))}
                        style={{ width: 70, background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: "#dde8ff", fontSize: 13, outline: "none" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setOrderItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: "#5a2a2a", cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orderItems.length === 0 && <div style={{ textAlign: "center", color: "#4a6a8a", padding: 20 }}>لا توجد أصناف ناقصة</div>}
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
            <div style={{ background: "#080e1a", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 4 }}>إجمالي المستحقات</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ff5555" }}>{getSupplierDebt(showPayForm.id).toFixed(2)} ر.س</div>
            </div>
            <div>
  <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 6 }}>طريقة الدفع</div>
  <select value={payForm.method}
    onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
    style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none" }}>
    <option value="نقدي">💵 نقدي</option>
    <option value="بطاقة">💳 بطاقة / صراف</option>
    <option value="تحويل">🏦 تحويل بنكي</option>
  </select>
</div>
            <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 4 }}>ترتيب السداد (الأقدم أولاً):</div>
            {purchases.filter((p) => p.supplier === showPayForm.id && p.payment_status !== "مسددة")
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((po) => {
                const balance = po.total - (po.paid || 0);
                const dueDays = getDueDays(po, showPayForm);
                return (
                  <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#080e1a", borderRadius: 8, border: "1px solid #1d2d4a" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#6aaeff" }}>{po.id}</div>
                      <div style={{ fontSize: 11, color: "#4a6a8a" }}>{po.date}</div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#dde8ff" }}>{balance.toFixed(2)} ر.س</div>
                      <div style={{ fontSize: 11, color: dueDays < 0 ? "#ff5555" : "#ffaa44" }}>
                        {dueDays < 0 ? `متأخر ${Math.abs(dueDays)} يوم` : `باقي ${dueDays} يوم`}
                      </div>
                    </div>
                    <Badge color={po.payment_status === "مسددة جزئياً" ? "#1a1000" : "#0a0a1a"} text={po.payment_status === "مسددة جزئياً" ? "#ffaa44" : "#4a6a8a"}>
                      {po.payment_status || "غير مسددة"}
                    </Badge>
                  </div>
                );
              })}
            <Input label="مبلغ الدفعة (ر.س)" value={payForm.amount} onChange={(v) => setPayForm((p) => ({ ...p, amount: v }))} placeholder="0.00" />
            <Input label="ملاحظة" value={payForm.note} onChange={(v) => setPayForm((p) => ({ ...p, note: v }))} placeholder="اختياري" />
            <div>
              <label style={{ fontSize: 12, color: "#4a6a8a", display: "block", marginBottom: 6 }}>سند الدفع (اختياري)</label>
              <input type="file" accept="image/*,application/pdf"
                onChange={(e) => { const file = e.target.files[0]; if (file) setPayForm((p) => ({ ...p, receipt: file })); }}
                style={{ color: "#dde8ff", fontSize: 12 }} />
              {payForm.receipt && <div style={{ fontSize: 11, color: "#44dd88", marginTop: 4 }}>✓ {payForm.receipt.name}</div>}
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
              <div style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 10 }}>المشتريات والمدفوعات (6 أشهر)</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
                      <div style={{ flex: 1, background: "#3a6aff", height: `${(d.purchases / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مشتريات: ${d.purchases.toFixed(0)}`} />
                      <div style={{ flex: 1, background: "#44dd88", height: `${(d.paid / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مدفوعات: ${d.paid.toFixed(0)}`} />
                    </div>
                    <span style={{ fontSize: 9, color: "#4a6a8a" }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#3a6aff" }}>■ مشتريات</span>
                <span style={{ fontSize: 11, color: "#44dd88" }}>■ مدفوعات</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#4a6a8a", marginBottom: 8 }}>سجل الدفعات</div>
            {supPayments.length === 0 ? (
              <div style={{ color: "#4a6a8a", fontSize: 12, marginBottom: 14 }}>لا توجد دفعات مسجلة</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                {supPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #0a101a" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#dde8ff" }}>{pay.date}</div>
                      {pay.notes && <div style={{ fontSize: 11, color: "#4a6a8a" }}>{pay.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#44dd88" }}>{pay.amount.toFixed(2)} ر.س</span>
                      {pay.attachment_url && <a href={pay.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3a9aff" }}>📎 سند</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: "#080e1a", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#4a6a8a", marginBottom: 8 }}>رفع كشف حساب المورد</div>
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const fileName = `statements/${showDetail.id}_${Date.now()}_${file.name}`;
                  const { error } = await supabase.storage.from("payment_reports").upload(fileName, file);
                  if (error) { showToast("فشل الرفع: " + error.message, "error"); return; }
                  showToast("تم رفع الكشف ✓");
                }}
                style={{ color: "#dde8ff", fontSize: 12 }} />
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
              <label style={{ fontSize: 12, color: "#4a6a8a", display: "block", marginBottom: 6 }}>حد الكريدت (ر.س)</label>
              <input type="number" min="0" value={form.credit_limit} onChange={(e) => F("credit_limit", +e.target.value)}
                style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#4a6a8a", display: "block", marginBottom: 6 }}>شروط الدفع (يوم)</label>
              <input type="number" min="0" value={form.payment_terms} onChange={(e) => F("payment_terms", +e.target.value)}
                style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* ── رصيد أول المدة بتفاصيل ── */}
          <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ffaa44" }}>رصيد أول المدة</div>
                <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 2 }}>
                  المجموع: {(form.opening_balance_details || []).reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)} ر.س
                </div>
              </div>
              <button onClick={addOpeningDetail} style={{ background: "#1a2a10", border: "1px solid #2a5020", borderRadius: 7, padding: "6px 12px", color: "#44dd88", fontSize: 12, cursor: "pointer" }}>
                + إضافة فاتورة
              </button>
            </div>

            {(form.opening_balance_details || []).length === 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "#4a6a8a", display: "block", marginBottom: 6 }}>
                  أو أدخل رقم مجمل مباشرة (ر.س)
                </label>
                <input type="number" min="0" value={form.opening_balance}
                  onChange={(e) => F("opening_balance", +e.target.value)}
                  style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {(form.opening_balance_details || []).length > 0 && (
              <div>
                {/* رأس الجدول */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6 }}>
                  {["رقم الفاتورة", "المبلغ (ر.س)", "عمر الدين (يوم)", "ملاحظة", ""].map((h) => (
                    <div key={h} style={{ fontSize: 10, color: "#4a6a8a", fontWeight: 600 }}>{h}</div>
                  ))}
                </div>
                {(form.opening_balance_details || []).map((d) => (
                  <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={d.invoice_no} onChange={(e) => updateOpeningDetail(d.id, "invoice_no", e.target.value)}
                      placeholder="INV-001"
                      style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.amount} onChange={(e) => updateOpeningDetail(d.id, "amount", +e.target.value)}
                      placeholder="0"
                      style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: "#ffaa44", fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.due_days} onChange={(e) => updateOpeningDetail(d.id, "due_days", +e.target.value)}
                      placeholder="30"
                      style={{ background: "#080e1a", border: `1px solid ${d.due_days > 90 ? "#4a1010" : d.due_days > 60 ? "#4a3000" : "#1d2d4a"}`, borderRadius: 6, padding: "7px 10px", color: d.due_days > 90 ? "#ff5555" : d.due_days > 60 ? "#ffaa44" : "#dde8ff", fontSize: 12, outline: "none" }} />
                    <input value={d.note} onChange={(e) => updateOpeningDetail(d.id, "note", e.target.value)}
                      placeholder="اختياري"
                      style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
                    <button onClick={() => removeOpeningDetail(d.id)}
                      style={{ background: "transparent", border: "none", color: "#5a2a2a", cursor: "pointer", padding: 4 }}>
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
                        { bucket: "0-30", label: "0-30 يوم",  color: "#44dd88" },
                        { bucket: "31-60", label: "31-60 يوم", color: "#dde8ff" },
                        { bucket: "61-90", label: "61-90 يوم", color: "#ffaa44" },
                        { bucket: "90+",  label: "+90 يوم",   color: "#ff5555" },
                      ].map(({ bucket, label, color }) => (
                        <div key={bucket} style={{ textAlign: "center", background: "#080e1a", borderRadius: 6, padding: "8px 4px" }}>
                          <div style={{ fontSize: 10, color: "#4a6a8a", marginBottom: 4 }}>{label}</div>
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
            <label style={{ fontSize: 12, color: "#4a6a8a", display: "block", marginBottom: 8 }}>فئات التوريد</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUPPLY_CATEGORIES.map((cat) => {
                const selected = (form.supply_categories || []).includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => {
                    const current = form.supply_categories || [];
                    F("supply_categories", selected ? current.filter((c) => c !== cat) : [...current, cat]);
                  }}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? "#3a9aff" : "#1d2d4a", background: selected ? "#0a2040" : "transparent", color: selected ? "#3a9aff" : "#4a6a8a", fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
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
function CreditTab({ customers, onPay }) {
  const [creditData, setCreditData] = useState([]);

  useEffect(() => {
    const fetchCredit = async () => {
      const { data: ajilSales } = await supabase
        .from("sales")
        .select("*")
        .eq("payment", "آجل");

      const { data: paid } = await supabase.from("credit_payments").select("*");

      const byCustomer = customers
        .map((c) => {
          const cSales = ajilSales?.filter((s) => s.customer === c.id) || [];
          const totalDebt = cSales.reduce((s, inv) => {
            const totalPaid =
              paid
                ?.filter((p) => p.invoice_id === inv.id)
                .reduce((x, p) => x + p.amount, 0) || 0;
            return s + (inv.total - totalPaid);
          }, 0);
          return { ...c, totalDebt, invoiceCount: cSales.length };
        })
        .filter((c) => c.totalDebt > 0);

      setCreditData(byCustomer);
    };
    fetchCredit();
  }, []);

  return (
    <div>
      <h3 style={{ color: "#dde8ff", marginBottom: 14 }}>💳 مديونية العملاء</h3>
      {creditData.length === 0 ? (
        <div style={{ color: "#3a5a8a", textAlign: "center", padding: 40 }}>
          لا توجد مديونيات
        </div>
      ) : (
        creditData.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#0f1623",
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
              <div style={{ fontWeight: 700, color: "#dde8ff" }}>{c.name}</div>
              <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 3 }}>
                {c.invoiceCount} فاتورة آجل •{" "}
                <span style={{ color: "#ff7777" }}>
                  متبقي: {c.totalDebt.toFixed(2)} ر.س
                </span>
              </div>
            </div>
            <button
              onClick={() => onPay(c)}
              style={{
                background: "#0a2a1a",
                border: "1px solid #1a4a2a",
                borderRadius: 8,
                padding: "6px 14px",
                color: "#44dd88",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              💰 سداد
            </button>
          </div>
        ))
      )}
    </div>
  );
}
function CustomersModule({
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
    excellent: { label: "⭐ ممتاز", color: "#5a9aff", bg: "#0a1a3a" },
    good: { label: "✅ جيد", color: "#44dd88", bg: "#0a2a1a" },
    weak: { label: "🔴 ضعيف", color: "#ff4444", bg: "#2a0a0a" },
  };

  const statusConfig = {
    new: { label: "🆕 جديد", color: "#44dd88" },
    regular: { label: "✅ منتظم", color: "#5a9aff" },
    at_risk: { label: "⚠️ في خطر", color: "#ffaa44" },
    inactive: { label: "💤 مختفي", color: "#ff4444" },
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
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: "#dde8ff",
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
            <div style={{ background: "#080e1a", borderRadius: 4, height: 8 }}>
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
          background: "#0f1623",
          border: `1px solid ${vip ? vip.color + "33" : "#1d2d4a"}`,
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
              <div style={{ fontWeight: 700, color: "#dde8ff", fontSize: 14 }}>
                {c.name}
              </div>
              <div style={{ color: "#3a6a9a", fontSize: 11 }}>
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
                  background: "#080e1a",
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
              color: "#5a9aff",
            },
            {
              label: "زيارات الشهر",
              value: s?.monthlyVisits || 0,
              color: "#44dd88",
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
              color: "#ffaa44",
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
                background: "#080e1a",
                borderRadius: 8,
                padding: "7px 8px",
              }}
            >
              <div style={{ color: "#3a5a8a", fontSize: 9 }}>{item.label}</div>
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
              <span style={{ color: "#4a6a8a", fontSize: 10 }}>نقاط RFM</span>
              <span
                style={{ color: vip?.color, fontSize: 11, fontWeight: 700 }}
              >
                {s.rfmScore}/100
              </span>
            </div>
            <div style={{ background: "#080e1a", borderRadius: 4, height: 5 }}>
              <div
                style={{
                  background: vip?.color || "#4a6a8a",
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
                color: "#4a6a8a",
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
                      background: "#080e1a",
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
              color: "#44dd88",
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
              background: "#0a1a3a",
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "6px 12px",
              color: "#5a9aff",
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
              background: "#2a0a0a",
              border: "1px solid #3a1010",
              borderRadius: 8,
              padding: "6px 12px",
              color: "#ff4444",
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
    border: `1px solid ${activeTab === tab ? "#3a6aaa" : "#1d2d4a"}`,
    borderRadius: 8,
    padding: "8px 16px",
    color: activeTab === tab ? "#5a9aff" : "#4a6a8a",
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
            color: "#5a9aff",
            icon: "👥",
          },
          {
            label: "جديد هذا الشهر",
            value: newCount,
            color: "#44dd88",
            icon: "🆕",
          },
          { label: "عملاء VIP", value: vipCount, color: "#ffd700", icon: "👑" },
          {
            label: "مختفون",
            value: inactiveCount,
            color: "#ff4444",
            icon: "💤",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: "#0f1623",
              border: "1px solid #1d2d4a",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ color: item.color, fontWeight: 800, fontSize: 22 }}>
              {item.value}
            </div>
            <div style={{ color: "#4a6a8a", fontSize: 11 }}>{item.label}</div>
          </div>
        ))}
        {/* كارت مديونية العملاء */}
        <div
          onClick={() => setActiveTab("credit")}
          style={{
            background: "#0f1623",
            border: "1px solid #3a1010",
            borderRadius: 12,
            padding: "14px 16px",
            cursor: "pointer",
            gridColumn: "span 4",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
          <div style={{ color: "#ff7777", fontWeight: 800, fontSize: 18 }}>
            مديونية العملاء
          </div>
          <div style={{ color: "#4a6a8a", fontSize: 11 }}>
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
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: "#dde8ff",
                fontSize: 14,
                outline: "none",
              }}
            />
            <select
              value={filterVip}
              onChange={(e) => setFilterVip(e.target.value)}
              style={{
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: "#dde8ff",
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
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: "#dde8ff",
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
            <h3 style={{ margin: 0, color: "#dde8ff", fontSize: 15 }}>
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
                  color: "#44dd88",
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
            <div style={{ color: "#3a5a8a", textAlign: "center", padding: 40 }}>
              لا يوجد عملاء اليوم
            </div>
          ) : (
            todayCustomers.map((c) => {
              const vip = c.stats ? vipConfig[c.stats.vipLevel] : null;
              return (
                <div
                  key={c.id}
                  style={{
                    background: "#0f1623",
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
                      <div style={{ fontWeight: 700, color: "#dde8ff" }}>
                        {c.name}
                      </div>
                      <div style={{ color: "#4a6a8a", fontSize: 11 }}>
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
                      color: "#44dd88",
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
            <h3 style={{ margin: 0, color: "#dde8ff", fontSize: 15 }}>
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
                  background: "#2a0a0a",
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
                  background: "#0f1623",
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
                  <div style={{ fontWeight: 700, color: "#dde8ff" }}>
                    {c.name}
                  </div>
                  <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 3 }}>
                    غائب منذ{" "}
                    <span style={{ color: "#ff4444" }}>
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
                          background: "#080e1a",
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
                    color: "#44dd88",
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
                color: "#5a9aff",
              },
              {
                label: "👨‍👩‍👧 أسرة مع أطفال",
                count: customers.filter(
                  (c) => c.category === "family_with_kids"
                ).length,
                color: "#44dd88",
              },
            ]}
          />
          <BarChart
            title="📊 حالة العملاء"
            data={[
              {
                label: "🆕 جديد",
                count: enriched.filter((c) => c.stats?.status === "new").length,
                color: "#44dd88",
              },
              {
                label: "✅ منتظم",
                count: enriched.filter((c) => c.stats?.status === "regular")
                  .length,
                color: "#5a9aff",
              },
              {
                label: "⚠️ في خطر",
                count: enriched.filter((c) => c.stats?.status === "at_risk")
                  .length,
                color: "#ffaa44",
              },
              {
                label: "💤 مختفي",
                count: enriched.filter((c) => c.stats?.status === "inactive")
                  .length,
                color: "#ff4444",
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
                color: "#5a9aff",
              },
              {
                label: "✅ جيد",
                count: enriched.filter((c) => c.stats?.vipLevel === "good")
                  .length,
                color: "#44dd88",
              },
              {
                label: "🔴 ضعيف",
                count: enriched.filter((c) => c.stats?.vipLevel === "weak")
                  .length,
                color: "#ff4444",
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
          <div style={{ color: "#44dd88", textAlign: "center", padding: 20 }}>
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
                <tr style={{ background: "#080e1a" }}>
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
                        color: "#4a6a9a",
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
                          ? "#0a1a3a"
                          : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "#6aaeff",
                        fontWeight: 700,
                      }}
                    >
                      {inv.id}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#7a9aaa" }}>
                      {inv.date}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#dde8ff" }}>
                      {inv.total.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#44dd88" }}>
                      {inv.totalPaid.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "#ff7777",
                        fontWeight: 700,
                      }}
                    >
                      {inv.remaining.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: "#3a6a9a", fontSize: 11 }}>
                        اختر
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedInvoice && (
              <div
                style={{ background: "#080e1a", borderRadius: 10, padding: 14 }}
              >
                <div
                  style={{ color: "#dde8ff", marginBottom: 10, fontSize: 13 }}
                >
                  سداد فاتورة{" "}
                  <span style={{ color: "#6aaeff" }}>{selectedInvoice.id}</span>{" "}
                  • المتبقي:{" "}
                  <span style={{ color: "#ff7777" }}>
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
                      background: "#0f1623",
                      border: "1px solid #1d2d4a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "#dde8ff",
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() =>
                      setPayAmount(String(selectedInvoice.remaining))
                    }
                    style={{
                      background: "#0a1a3a",
                      border: "1px solid #1d3a6a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "#5a9aff",
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
                      form.category === opt.val ? "#3a9aff" : "#1d2d4a"
                    }`,
                    background:
                      form.category === opt.val ? "#0a1a3a" : "#080e1a",
                    color: form.category === opt.val ? "#3a9aff" : "#5a7a9a",
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
                            selected ? "#44dd88" : "#1d2d4a"
                          }`,
                          background: selected ? "#0a2a1a" : "#080e1a",
                          color: selected ? "#44dd88" : "#5a7a9a",
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
function calcAutoDiscount(expiryDate, rules?) {
  if (!expiryDate) return 0;
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 0;
  const activeRules = rules || [
    { days: 90,  discount: 50 },
    { days: 120, discount: 25 },
    { days: 150, discount: 20 },
    { days: 180, discount: 15 },
  ];
  const sorted = [...activeRules].sort((a, b) => a.days - b.days);
  for (const rule of sorted) {
    if (days <= rule.days) return rule.discount;
  }
  return 0;
}

function PromotionsModule({ products, setProducts, sales, purchases, shifts, currentUser, pharmacyId, showToast }) {
  const [activeTab, setActiveTab] = useState("auto"); // auto | manual | incentive
  const [promos, setPromos] = useState([]);
  const [incentiveList, setIncentiveList] = useState([]);
  const [incentiveConfig, setIncentiveConfig] = useState({ rate: 5, month: new Date().toISOString().slice(0, 7) });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");

  const DEFAULT_RULES = [
    { days: 90,  discount: 50, color: "#ff4444" },
    { days: 120, discount: 25, color: "#ff7744" },
    { days: 150, discount: 20, color: "#ffaa44" },
    { days: 180, discount: 15, color: "#f59e0b" },
  ];
  const [discountRules, setDiscountRules] = useState(DEFAULT_RULES);
  const [editRules, setEditRules] = useState(DEFAULT_RULES);

  // تحميل قواعد الخصم من Supabase
  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("promo_rules").select("*").eq("pharmacy_id", pharmacyId).order("days").then(({ data }) => {
      if (data && data.length > 0) {
        setDiscountRules(data);
        setEditRules(data);
      }
    });
  }, [pharmacyId]);
  const [incentiveSearch, setIncentiveSearch] = useState("");

  const blankPromo = { product_id: "", discount: "", start_date: new Date().toISOString().split("T")[0], end_date: "", note: "" };
  const [promoForm, setPromoForm] = useState(blankPromo);
  const [incentiveForm, setIncentiveForm] = useState({ product_id: "", rate: "", fixed_amount: "", note: "" });

  const today = new Date().toISOString().split("T")[0];
  const monthKey = incentiveConfig.month;

  // تحميل البيانات
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("promotions").select("*").eq("pharmacy_id", pharmacyId).order("end_date"),
      supabase.from("incentive_products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_config").select("*").eq("pharmacy_id", pharmacyId).single(),
    ]).then(([p, i, c]) => {
      if (p.data) setPromos(p.data);
      if (i.data) setIncentiveList(i.data);
      if (c.data) setIncentiveConfig((prev) => ({ ...prev, rate: c.data.rate || 5 }));
    });
  }, [pharmacyId]);

  // الأصناف التلقائية (غير دواء + فيها صلاحية قريبة)
  // بنجيب أقرب تاريخ صلاحية من فواتير الشراء لكل صنف
  const productEarliestExpiry = useMemo(() => {
    const map = {};
    (purchases || []).forEach((pu) => {
      const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
      items.forEach((item) => {
        const expiry = item.expiry_date || item.expiry;
        if (!expiry || !item.id) return;
        if (!map[item.id] || expiry < map[item.id]) map[item.id] = expiry;
      });
    });
    // كمان نجيب من جدول products نفسه لو موجود
    (products || []).forEach((p) => {
      if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) {
        map[p.id] = p.expiry;
      }
    });
    return map;
  }, [purchases, products]);

  const getProductExpiry = (p) =>
    productEarliestExpiry[p.id] || p.expiry || null;

  const autoPromoProducts = products.filter((p) => {
    const cat = p.main_category || p.category || "";
    if (cat === "دواء") return false;
    const expiry = getProductExpiry(p);
    const disc = calcAutoDiscount(expiry, discountRules);
    return disc > 0 && (p.stock || 0) > 0;
  }).map((p) => {
    const expiry = getProductExpiry(p);
    return { ...p, expiry, autoDiscount: calcAutoDiscount(expiry, discountRules) };
  }).sort((a, b) => b.autoDiscount - a.autoDiscount);

  // الأصناف المحفزة — خصم > 45%
  const highMarginProducts = products.filter((p) => {
    const cost = p.cost || 0;
    const price = p.price || 0;
    if (!cost || !price) return false;
    return ((price - cost) / price) * 100 >= 45;
  });

  // حفظ عرض يدوي
  const savePromo = async () => {
    if (!promoForm.product_id || !promoForm.discount || !promoForm.end_date) {
      showToast("يرجى ملء جميع الحقول", "error"); return;
    }
    const row = { ...promoForm, discount: +promoForm.discount, pharmacy_id: pharmacyId };
    const { data, error } = await supabase.from("promotions").insert([row]).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setPromos((p) => [...p, data[0]]);
    setPromoForm(blankPromo);
    setShowPromoForm(false);
    showToast("تم إضافة العرض ✓");
  };

  // حفظ صنف محفز
  const saveIncentive = async () => {
    if (!incentiveForm.product_id) { showToast("اختر صنفاً", "error"); return; }
    const row = { ...incentiveForm, pharmacy_id: pharmacyId };
    const { data, error } = await supabase.from("incentive_products").insert([row]).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setIncentiveList((p) => [...p, data[0]]);
    setIncentiveForm({ product_id: "", rate: "", fixed_amount: "", note: "" });
    setShowIncentiveForm(false);
    showToast("تم إضافة الصنف للقائمة ✓");
  };

  // حساب مبيعات الصيدلي من الأصناف المحفزة في الشهر
  const calcIncentiveSales = (userName) => {
    const incentiveIds = new Set([
      ...incentiveList.map((i) => i.product_id),
      ...highMarginProducts.map((p) => p.id),
    ]);
    const monthSales = sales.filter((s) =>
      s.date?.startsWith(monthKey) && !s.returned &&
      (s.cashier === userName || s.user === userName || s.created_by === userName)
    );
    let total = 0;
    monthSales.forEach((s) => {
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      items.forEach((item) => {
        if (incentiveIds.has(item.id)) total += (item.price || 0) * (item.qty || 1);
      });
    });
    return total;
  };

  // العروض النشطة
  const activePromos = promos.filter((p) => p.end_date >= today && p.start_date <= today);
  const expiredPromos = promos.filter((p) => p.end_date < today);

  const discountColor = (d) => d >= 50 ? "#ff4444" : d >= 25 ? "#ff7744" : d >= 20 ? "#ffaa44" : "#f59e0b";

  const cardStyle = (border = "#1d2d4a") => ({
    background: "#0f1623", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });

  // فلترة
  const filteredAutoPromos = autoPromoProducts.filter((p) =>
    !promoSearch || (p.name || p.nameAr || "").includes(promoSearch)
  );
  const filteredIncentive = incentiveList.filter((i) =>
    !incentiveSearch || (products.find((p) => p.id === i.product_id)?.name || "").includes(incentiveSearch)
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🏷️ إدارة العروض</h2>
          <div style={{ color: "#3a5a8a", fontSize: 12, marginTop: 2 }}>
            عروض تلقائية حسب الصلاحية + عروض يدوية + أصناف محفزة
          </div>
        </div>
      </div>

      {/* تنبيه العروض التلقائية */}
      {autoPromoProducts.length > 0 && (
        <div style={{ background: "#1a0800", border: "1px solid #4a2800", borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: "#ffaa44", fontWeight: 700 }}>⚠️ {autoPromoProducts.length} صنف يحتاج عرض تلقائي</span>
            <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 2 }}>أصناف غير دوائية بصلاحية أقل من 6 شهور</div>
          </div>
          <button onClick={() => setActiveTab("auto")} style={{ background: "#3a2000", border: "1px solid #6a4000", borderRadius: 8, padding: "6px 14px", color: "#ffaa44", fontSize: 12, cursor: "pointer" }}>
            عرض التفاصيل
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#080e1a", borderRadius: 10, padding: 4 }}>
        {[
          { k: "auto", l: `⏰ تلقائي (${autoPromoProducts.length})` },
          { k: "manual", l: `✋ يدوي (${activePromos.length})` },
          { k: "incentive", l: "⭐ أصناف محفزة" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? "#0f1623" : "transparent",
            color: activeTab === t.k ? "#3a9aff" : "#4a6a8a",
            fontSize: 12, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── العروض التلقائية ── */}
      {activeTab === "auto" && (
        <div>
          {/* قواعد الخصم — قابلة للتعديل */}
          <div style={cardStyle("#1a2a1a")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: "#44dd88", fontWeight: 700 }}>📋 منطق الخصم التدرجي التلقائي</div>
              <button onClick={() => { setEditRules(discountRules.map(r => ({...r}))); setShowRulesEditor(true); }}
                style={{ background: "#0a1a2a", border: "1px solid #1d3a6a", borderRadius: 8, padding: "5px 14px", color: "#3a9aff", fontSize: 12, cursor: "pointer" }}>
                ✏️ تعديل القواعد
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[...discountRules].sort((a,b) => a.days - b.days).map((r) => (
                <div key={r.days} style={{ background: "#080e1a", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ color: r.color || "#ffaa44", fontWeight: 900, fontSize: 18 }}>{r.discount}%</div>
                  <div style={{ color: "#4a6a8a", fontSize: 11 }}>أقل من {Math.round(r.days/30)} شهور</div>
                  <div style={{ color: "#3a5a7a", fontSize: 10 }}>({r.days} يوم)</div>
                </div>
              ))}
            </div>
          </div>

          <input
            value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredAutoPromos.length === 0
            ? <div style={{ color: "#4a6a8a", textAlign: "center", padding: 40 }}>✅ لا توجد أصناف تحتاج عروض تلقائية</div>
            : filteredAutoPromos.map((p) => {
                const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                const newPrice = (p.price * (1 - p.autoDiscount / 100)).toFixed(2);
                return (
                  <div key={p.id} style={cardStyle(p.autoDiscount >= 50 ? "#3a0000" : p.autoDiscount >= 25 ? "#3a1500" : "#2a1500")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ color: "#dde8ff", fontWeight: 700, fontSize: 14 }}>{p.name || p.nameAr}</span>
                          <span style={{
                            background: discountColor(p.autoDiscount), color: "#fff",
                            borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900,
                          }}>-{p.autoDiscount}%</span>
                        </div>
                        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                          <span style={{ color: "#4a6a8a" }}>الفئة: <span style={{ color: "#8aaabb" }}>{p.main_category || p.category}</span></span>
                          <span style={{ color: "#4a6a8a" }}>المخزون: <span style={{ color: "#dde8ff" }}>{p.stock}</span></span>
                          <span style={{ color: "#4a6a8a" }}>ينتهي بعد: <span style={{ color: discountColor(p.autoDiscount) }}>{days} يوم</span></span>
                        </div>
                      </div>
                      <div style={{ textAlign: "left", minWidth: 110 }}>
                        <div style={{ color: "#4a6a8a", fontSize: 11, textDecoration: "line-through" }}>{p.price} ر.س</div>
                        <div style={{ color: "#44dd88", fontWeight: 900, fontSize: 18 }}>{newPrice} ر.س</div>
                        <div style={{ color: "#4a6a8a", fontSize: 10 }}>تاريخ: {p.expiry}</div>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── العروض اليدوية ── */}
      {activeTab === "manual" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowPromoForm(true)}>إضافة عرض</Btn>
          </div>

          {activePromos.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#44dd88", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>✅ عروض نشطة ({activePromos.length})</div>
              {activePromos.map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                const newPrice = prod ? (prod.price * (1 - promo.discount / 100)).toFixed(2) : "—";
                const daysLeft = Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={promo.id} style={cardStyle("#1a3a1a")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ color: "#dde8ff", fontWeight: 700 }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                          <span style={{ background: "#ff7744", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>-{promo.discount}%</span>
                        </div>
                        <div style={{ color: "#4a6a8a", fontSize: 11 }}>
                          {promo.start_date} ← {promo.end_date}
                          {promo.note && <span style={{ marginRight: 10, color: "#6a8aaa" }}>• {promo.note}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ color: "#44dd88", fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</div>
                        <div style={{ color: daysLeft <= 3 ? "#ff4444" : "#4a6a8a", fontSize: 11 }}>يتبقى {daysLeft} يوم</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expiredPromos.length > 0 && (
            <div>
              <div style={{ color: "#4a6a8a", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 عروض منتهية ({expiredPromos.length})</div>
              {expiredPromos.slice(0, 5).map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                return (
                  <div key={promo.id} style={{ ...cardStyle(), opacity: 0.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6a8aaa" }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                      <span style={{ color: "#4a6a8a" }}>-{promo.discount}% • انتهى {promo.end_date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {promos.length === 0 && <div style={{ color: "#4a6a8a", textAlign: "center", padding: 40 }}>لا توجد عروض يدوية</div>}
        </div>
      )}

      {/* ── الأصناف المحفزة ── */}
      {activeTab === "incentive" && (
        <div>
          {/* إعداد النسبة */}
          <div style={cardStyle("#1a2a4a")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: "#3a9aff", fontWeight: 700, marginBottom: 4 }}>⚙️ إعدادات العمولة</div>
                <div style={{ color: "#4a6a8a", fontSize: 12 }}>نسبة الصيدلي من مبيعات الأصناف المحفزة</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div>
                  <label style={{ color: "#5a7aaa", fontSize: 11, display: "block", marginBottom: 2 }}>الشهر</label>
                  <input type="month" value={incentiveConfig.month}
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, month: e.target.value }))}
                    style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: "#5a7aaa", fontSize: 11, display: "block", marginBottom: 2 }}>نسبة العمولة %</label>
                  <input type="number" value={incentiveConfig.rate} min="1" max="20"
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, rate: +e.target.value }))}
                    style={{ width: 70, background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: "#dde8ff", fontSize: 13, outline: "none" }} />
                </div>
              </div>
            </div>
          </div>

          {/* أصناف بخصم > 45% تلقائية */}
          <div style={cardStyle("#1a1a2a")}>
            <div style={{ color: "#a78bfa", fontWeight: 700, marginBottom: 10 }}>
              🎯 أصناف بهامش ربح ≥ 45% — تلقائية ({highMarginProducts.length})
            </div>
            {highMarginProducts.length === 0
              ? <div style={{ color: "#4a6a8a", fontSize: 12 }}>لا توجد أصناف بهذا الهامش حالياً</div>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {highMarginProducts.map((p) => {
                    const margin = (((p.price - p.cost) / p.price) * 100).toFixed(0);
                    return (
                      <div key={p.id} style={{ background: "#0a0a1a", border: "1px solid #2a2a4a", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        <span style={{ color: "#dde8ff" }}>{p.name || p.nameAr}</span>
                        <span style={{ color: "#a78bfa", marginRight: 8, fontWeight: 700 }}>{margin}%</span>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* أصناف مضافة يدوياً */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: "#dde8ff", fontWeight: 700 }}>✋ أصناف مضافة يدوياً ({incentiveList.length})</div>
            <Btn icon="plus" size="sm" onClick={() => setShowIncentiveForm(true)}>إضافة صنف</Btn>
          </div>

          <input
            value={incentiveSearch} onChange={(e) => setIncentiveSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: "#dde8ff", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredIncentive.map((item) => {
            const prod = products.find((p) => p.id === item.product_id);
            return (
              <div key={item.id} style={cardStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#dde8ff", fontWeight: 700 }}>{prod?.name || prod?.nameAr || item.product_id}</div>
                    {item.note && <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 2 }}>{item.note}</div>}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    {item.rate && <div style={{ color: "#44dd88", fontWeight: 700 }}>{item.rate}% عمولة</div>}
                    {item.fixed_amount && <div style={{ color: "#3a9aff", fontWeight: 700 }}>{item.fixed_amount} ر.س ثابت</div>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── نسبة الصيدلي هذا الشهر ── */}
          {(() => {
            const incentiveIds = new Set([
              ...incentiveList.map((i) => i.product_id),
              ...highMarginProducts.map((p) => p.id),
            ]);

            // تجميع المبيعات المحفزة لكل صيدلي
            const staffSales = {};
            sales
              .filter((s) => s.date?.startsWith(monthKey) && !s.returned)
              .forEach((s) => {
                const name = s.cashier || s.user || s.created_by || "غير محدد";
                const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
                items.forEach((item) => {
                  if (incentiveIds.has(item.id)) {
                    if (!staffSales[name]) staffSales[name] = { total: 0, items: {} };
                    const amt = (item.price || 0) * (item.qty || 1);
                    staffSales[name].total += amt;
                    // تفاصيل كل صنف
                    const prod = products.find((p) => p.id === item.id);
                    const pName = prod?.name || prod?.nameAr || item.name || item.id;
                    if (!staffSales[name].items[pName]) staffSales[name].items[pName] = 0;
                    staffSales[name].items[pName] += amt;
                  }
                });
              });

            const staffList = Object.entries(staffSales).filter(([, v]) => v.total > 0);
            if (staffList.length === 0) return (
              <div style={{ ...cardStyle(), marginTop: 16, textAlign: "center" }}>
                <div style={{ color: "#4a6a8a", padding: 20 }}>
                  لا توجد مبيعات من الأصناف المحفزة في {monthKey}
                </div>
              </div>
            );

            const totalAllStaff = staffList.reduce((a, [, v]) => a + v.total, 0);

            return (
              <div style={{ ...cardStyle("#1a3a1a"), marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: "#44dd88", fontWeight: 700, fontSize: 14 }}>
                    📊 عمولة الأصناف المحفزة — {monthKey}
                  </div>
                  <div style={{ color: "#4a6a8a", fontSize: 12 }}>
                    إجمالي المبيعات المحفزة: <span style={{ color: "#44dd88", fontWeight: 700 }}>{totalAllStaff.toFixed(2)} ر.س</span>
                  </div>
                </div>

                {staffList.map(([name, data]) => {
                  // نسبة الصيدلي من قائمة المحفزة (لو له نسبة خاصة)
                  const customItem = incentiveList.find((i) => {
                    const prod = products.find((p) => p.id === i.product_id);
                    return prod && (prod.name === name || i.product_id === name);
                  });
                  const rate = incentiveConfig.rate;
                  const commission = (data.total * rate / 100);
                  const pct = totalAllStaff > 0 ? (data.total / totalAllStaff * 100).toFixed(1) : "0";
                  const [showDetails, setShowDetails] = [false, () => {}]; // placeholder

                  return (
                    <div key={name} style={{ padding: "12px 0", borderBottom: "1px solid #0a1a0a" }}>
                      {/* صف الصيدلي */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ color: "#dde8ff", fontWeight: 700, fontSize: 14 }}>👤 {name}</div>
                          <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 2 }}>
                            مبيعات محفزة: <span style={{ color: "#44dd88" }}>{data.total.toFixed(2)} ر.س</span>
                            <span style={{ marginRight: 10, color: "#3a5a7a" }}>({pct}% من الإجمالي)</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ color: "#44dd88", fontWeight: 900, fontSize: 18 }}>{commission.toFixed(2)} ر.س</div>
                          <div style={{ color: "#4a6a8a", fontSize: 11 }}>عمولة {rate}%</div>
                        </div>
                      </div>

                      {/* شريط النسبة */}
                      <div style={{ background: "#080e1a", borderRadius: 4, height: 6, marginBottom: 8 }}>
                        <div style={{ background: "#44dd88", height: "100%", borderRadius: 4, width: `${pct}%`, transition: "width 0.4s" }} />
                      </div>

                      {/* تفاصيل الأصناف */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {Object.entries(data.items).map(([pName, amt]) => (
                          <div key={pName} style={{ background: "#0a1a0a", border: "1px solid #1a3a1a", borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                            <span style={{ color: "#8aaabb" }}>{pName}</span>
                            <span style={{ color: "#44dd88", marginRight: 6, fontWeight: 700 }}>{(amt as number).toFixed(0)} ر.س</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* إجمالي العمولات */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "2px solid #1a3a1a" }}>
                  <span style={{ color: "#dde8ff", fontWeight: 700 }}>إجمالي العمولات المستحقة</span>
                  <span style={{ color: "#44dd88", fontWeight: 900, fontSize: 18 }}>
                    {staffList.reduce((a, [, v]) => a + v.total * incentiveConfig.rate / 100, 0).toFixed(2)} ر.س
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal تعديل قواعد الخصم */}
      <Modal open={showRulesEditor} onClose={() => setShowRulesEditor(false)} title="✏️ تعديل قواعد الخصم التدرجي">
        <div style={{ color: "#4a6a8a", fontSize: 12, marginBottom: 14 }}>
          حدد عدد الأيام ونسبة الخصم لكل مرحلة — يتم الترتيب تلقائياً من الأقل للأكثر
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
          <span style={{ color: "#4a6a9a", fontSize: 12, fontWeight: 700 }}>أقل من (يوم)</span>
          <span style={{ color: "#4a6a9a", fontSize: 12, fontWeight: 700 }}>نسبة الخصم %</span>
          <span/>
        </div>
        {editRules.map((rule, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" value={rule.days} min="1" max="365"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, days: +e.target.value } : r))}
              style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: "#dde8ff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <input type="number" value={rule.discount} min="1" max="100"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, discount: +e.target.value } : r))}
              style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: "#dde8ff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <button onClick={() => setEditRules((p) => p.filter((_, j) => j !== i))}
              style={{ background: "#2a0a0a", border: "none", borderRadius: 6, padding: "8px 12px", color: "#ff7744", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={() => setEditRules((p) => [...p, { days: 60, discount: 10, color: "#f59e0b" }])}
          style={{ background: "#0a1a0a", border: "1px dashed #1a4a1a", borderRadius: 8, padding: "7px 14px", color: "#44dd88", cursor: "pointer", fontSize: 12, width: "100%", marginBottom: 14 }}>
          + إضافة مرحلة
        </button>
        {/* معاينة */}
        <div style={{ background: "#080e1a", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ color: "#4a6a8a", fontSize: 11, marginBottom: 8 }}>معاينة:</div>
          {[...editRules].sort((a, b) => a.days - b.days).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#8aaabb" }}>أقل من {r.days} يوم (~{Math.round(r.days/30)} شهور)</span>
              <span style={{ color: "#ffaa44", fontWeight: 700 }}>خصم {r.discount}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setEditRules([...DEFAULT_RULES])}>إعادة للافتراضي</Btn>
          <Btn variant="ghost" onClick={() => setShowRulesEditor(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            const sorted = [...editRules].sort((a, b) => a.days - b.days);
            // احذف القديم وأضف الجديد
            await supabase.from("promo_rules").delete().eq("pharmacy_id", pharmacyId);
            const rows = sorted.map((r) => ({
              days: r.days,
              discount: r.discount,
              color: r.color || "#ffaa44",
              pharmacy_id: pharmacyId,
            }));
            const { error } = await supabase.from("promo_rules").insert(rows);
            if (error) { showToast("خطأ في الحفظ: " + error.message, "error"); return; }
            setDiscountRules(sorted);
            setShowRulesEditor(false);
            showToast("تم حفظ قواعد الخصم ✓");
          }}>حفظ</Btn>
        </div>
      </Modal>

      {/* Modal إضافة عرض يدوي */}
      <Modal open={showPromoForm} onClose={() => setShowPromoForm(false)} title="➕ إضافة عرض يدوي">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: "#5a7aaa", fontSize: 12, display: "block", marginBottom: 4 }}>الصنف</label>
            <select value={promoForm.product_id}
              onChange={(e) => setPromoForm((p) => ({ ...p, product_id: e.target.value }))}
              style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none" }}>
              <option value="">-- اختر صنفاً --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.nameAr} — {p.price} ر.س</option>
              ))}
            </select>
          </div>
          <Input label="نسبة الخصم %" value={promoForm.discount} onChange={(v) => setPromoForm((p) => ({ ...p, discount: v }))} type="number" placeholder="10" />
          <Input label="تاريخ البداية" value={promoForm.start_date} onChange={(v) => setPromoForm((p) => ({ ...p, start_date: v }))} type="date" />
          <Input label="تاريخ النهاية" value={promoForm.end_date} onChange={(v) => setPromoForm((p) => ({ ...p, end_date: v }))} type="date" />
          <Input label="ملاحظة" value={promoForm.note} onChange={(v) => setPromoForm((p) => ({ ...p, note: v }))} placeholder="وصف العرض..." />
        </div>
        {promoForm.product_id && promoForm.discount && (() => {
          const prod = products.find((p) => p.id === promoForm.product_id);
          if (!prod) return null;
          const newPrice = (prod.price * (1 - +promoForm.discount / 100)).toFixed(2);
          return (
            <div style={{ background: "#0a1a0a", border: "1px solid #1a4a1a", borderRadius: 8, padding: 10, marginTop: 10 }}>
              <span style={{ color: "#4a6a8a", fontSize: 12 }}>السعر بعد الخصم: </span>
              <span style={{ color: "#44dd88", fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</span>
              <span style={{ color: "#4a6a8a", fontSize: 11, marginRight: 8 }}>(بدلاً من {prod.price} ر.س)</span>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowPromoForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={savePromo}>إضافة العرض</Btn>
        </div>
      </Modal>

      {/* Modal إضافة صنف محفز */}
      <Modal open={showIncentiveForm} onClose={() => setShowIncentiveForm(false)} title="⭐ إضافة صنف للقائمة المحفزة">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: "#5a7aaa", fontSize: 12, display: "block", marginBottom: 4 }}>الصنف</label>
            <select value={incentiveForm.product_id}
              onChange={(e) => setIncentiveForm((p) => ({ ...p, product_id: e.target.value }))}
              style={{ width: "100%", background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: "#dde8ff", fontSize: 13, outline: "none" }}>
              <option value="">-- اختر صنفاً --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.nameAr}</option>
              ))}
            </select>
          </div>
          <Input label="نسبة عمولة %" value={incentiveForm.rate} onChange={(v) => setIncentiveForm((p) => ({ ...p, rate: v }))} type="number" placeholder="اتركه فارغ لو ثابت" />
          <Input label="مبلغ ثابت (ر.س)" value={incentiveForm.fixed_amount} onChange={(v) => setIncentiveForm((p) => ({ ...p, fixed_amount: v }))} type="number" placeholder="اتركه فارغ لو نسبة" />
          <Input label="ملاحظة" value={incentiveForm.note} onChange={(v) => setIncentiveForm((p) => ({ ...p, note: v }))} placeholder="..." />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowIncentiveForm(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={saveIncentive}>إضافة</Btn>
        </div>
      </Modal>
    </div>
  );
}
// ==================== TARGET MODULE ====================
function TargetModule({ users, sales, customers, currentUser, pharmacyId, showToast }) {
  const [monthKey, setMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [targets, setTargets] = useState([]); // كل التارجتات لكل الشهور
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [compareWith, setCompareWith] = useState({}); // { [pharmacistName]: otherName }

  const isAdmin = currentUser?.role === "admin";
  const pharmacists = users.filter((u) => u.role === "pharmacist");

  // تحميل كل التارجتات (كل الشهور) مرة واحدة — يسمح بالمقارنة عبر الشهور من غير إعادة تحميل
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("monthly_targets")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .then(({ data }) => setTargets(data || []));
  }, [pharmacyId]);

  const getTarget = (name, mKey) =>
    targets.find((t) => t.pharmacist_name === name && t.month === mKey)?.target_amount || 0;

  const saveTarget = async (name) => {
    if (!editValue || +editValue <= 0) {
      showToast("ادخل قيمة تارجت صحيحة", "error");
      return;
    }
    const row = {
      pharmacy_id: pharmacyId,
      pharmacist_name: name,
      month: monthKey,
      target_amount: +editValue,
    };
    const { data, error } = await supabase
      .from("monthly_targets")
      .upsert([row], { onConflict: "pharmacy_id,pharmacist_name,month" })
      .select();
    if (error) {
      showToast("خطأ: " + error.message, "error");
      return;
    }
    setTargets((prev) => {
      const others = prev.filter((t) => !(t.pharmacist_name === name && t.month === monthKey));
      return [...others, data[0]];
    });
    setEditing(null);
    setEditValue("");
    showToast("تم حفظ التارجت ✓");
  };

  const now = new Date();

  // ===== حساب أداء صيدلي في أي شهر (نعيد استخدامها للشهر الحالي وللمقارنات) =====
  const calcForMonth = (name, mKey) => {
    const [yy, mm] = mKey.split("-").map(Number);
    const daysInM = new Date(yy, mm, 0).getDate();
    const isCurrent = mKey === now.toISOString().slice(0, 7);
    const daysP = isCurrent ? now.getDate() : daysInM;

    const monthSales = sales.filter(
      (s) => (s.created_at || s.date || "").startsWith(mKey) && !s.returned
    );
    const mySales = monthSales.filter((s) => s.cashier_name === name);
    const achieved = mySales.reduce((a, s) => a + (s.total || 0), 0);
    const target = getTarget(name, mKey);

    const simplePct = target > 0 ? (achieved / target) * 100 : 0;
    const dailyAvg = daysP > 0 ? achieved / daysP : 0;
    const projected = dailyAvg * daysInM;
    const paceRequired = target > 0 ? target / daysInM : 0;
    const paceStatus =
      target === 0
        ? "—"
        : dailyAvg >= paceRequired
        ? "على المسار ✅"
        : dailyAvg >= paceRequired * 0.85
        ? "متأخر بسيط ⚠️"
        : "متأخر عن المسار 🔴";

    const invoiceCount = mySales.length;
    let itemsSold = 0;
    mySales.forEach((s) => {
      const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
      itemsSold += items.reduce((a, it) => a + (it.qty || 1), 0);
    });
    const avgItemsPerInvoice = invoiceCount > 0 ? itemsSold / invoiceCount : 0;
    const avgInvoiceValue = invoiceCount > 0 ? achieved / invoiceCount : 0;

    const linkedToCustomer = mySales.filter((s) => s.customer).length;
    const customerRegRate = invoiceCount > 0 ? (linkedToCustomer / invoiceCount) * 100 : 0;

    const newCustomers = customers.filter(
      (c) => (c.created_at || "").startsWith(mKey) && c.created_by === name
    ).length;

    const myCustomers = customers.filter((c) => c.created_by === name);
    const inactiveCustomers = myCustomers.filter((c) => {
      const cSales = sales.filter((s) => s.customer === c.id);
      if (cSales.length === 0) return false;
      const last = cSales.reduce((a, s) => {
        const d = new Date(s.created_at || s.date);
        return d > a ? d : a;
      }, new Date(0));
      const daysSince = (now - last) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    }).length;

    return {
      achieved, target, simplePct, projected, paceStatus, daysP, daysInM, mKey,
      invoiceCount, itemsSold, avgItemsPerInvoice, avgInvoiceValue,
      customerRegRate, newCustomers, inactiveCustomers,
    };
  };

  const calcForPharmacist = (name) => calcForMonth(name, monthKey);

  // ===== أداء يومي خلال الشهر الحالي =====
  const getDailyPerformance = (name, c) => {
    const days = [];
    for (let d = 1; d <= c.daysP; d++) {
      const dayStr = `${monthKey}-${String(d).padStart(2, "0")}`;
      const amt = sales
        .filter(
          (s) =>
            (s.created_at || s.date || "").startsWith(dayStr) &&
            !s.returned &&
            s.cashier_name === name
        )
        .reduce((a, s) => a + (s.total || 0), 0);
      days.push({ day: d, amount: amt });
    }
    return days;
  };

  // ===== مقارنة آخر 6 شهور =====
  const getYearTrend = (name) => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey2 = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("ar", { month: "short" });
      const c2 = calcForMonth(name, mKey2);
      months.push({ label, mKey: mKey2, achieved: c2.achieved, target: c2.target });
    }
    return months;
  };

  const pctColor = (p) => (p >= 100 ? "#44dd88" : p >= 75 ? "#3a9aff" : p >= 50 ? "#ffaa44" : "#ff4444");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🎯 تارجت المبيعات</h2>
          <div style={{ color: "#3a5a8a", fontSize: 12, marginTop: 2 }}>
            تارجت شهري لكل صيدلي + تحليل فني لحظي + مقارنات
          </div>
        </div>
        <Input type="month" value={monthKey} onChange={setMonthKey} style={{ width: 160 }} />
      </div>

      {pharmacists.length === 0 && (
        <div style={{ color: "#4a6a8a", padding: 20 }}>لا يوجد صيادلة مسجلين بدور "pharmacist".</div>
      )}

      {pharmacists.map((u) => {
        const c = calcForPharmacist(u.name);
        const dailyPerf = getDailyPerformance(u.name, c);
        const yearTrend = getYearTrend(u.name);
        const maxDaily = Math.max(...dailyPerf.map((d) => d.amount), 1);
        const maxYearly = Math.max(...yearTrend.map((m) => Math.max(m.achieved, m.target)), 1);
        const otherPharmacists = pharmacists.filter((p) => p.name !== u.name);
        const compareName = compareWith[u.name] || (otherPharmacists[0]?.name ?? "");
        const cOther = compareName ? calcForPharmacist(compareName) : null;

        return (
          <div key={u.id} style={{ background: "#0f1623", border: "1px solid #1d2d4a", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            {/* ===== الهيدر + التارجت ===== */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#dde8ff" }}>{u.name}</div>
                <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 2 }}>صيدلاني</div>
              </div>

              {editing === u.name ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input value={editValue} onChange={setEditValue} type="number" placeholder="قيمة التارجت" style={{ width: 140 }} />
                  <Btn size="sm" variant="success" onClick={() => saveTarget(u.name)}>حفظ</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>إلغاء</Btn>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#4a6a8a", fontSize: 11 }}>التارجت الشهري</div>
                    <div style={{ color: "#8ab0ff", fontWeight: 800, fontSize: 15 }}>
                      {c.target ? c.target.toFixed(0) + " ر.س" : "غير محدد"}
                    </div>
                  </div>
                  {isAdmin && (
                    <Btn size="sm" variant="ghost" icon="edit" onClick={() => { setEditing(u.name); setEditValue(c.target || ""); }}>
                      تعديل
                    </Btn>
                  )}
                </div>
              )}
            </div>

            {/* ===== شريط التقدم ===== */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#8aa0cc" }}>
                  المحقق: <b style={{ color: "#dde8ff" }}>{c.achieved.toFixed(0)} ر.س</b>
                </span>
                <span style={{ color: pctColor(c.simplePct), fontWeight: 800 }}>
                  {c.target ? c.simplePct.toFixed(1) + "%" : "—"}
                </span>
              </div>
              <div style={{ background: "#080e1a", borderRadius: 8, height: 10, overflow: "hidden" }}>
                <div style={{
                  width: Math.min(c.simplePct, 100) + "%",
                  height: "100%",
                  background: pctColor(c.simplePct),
                  transition: "width .3s",
                }} />
              </div>
              {c.target > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: "#4a6a8a" }}>
                    المتوقع نهاية الشهر (Run Rate): <b style={{ color: "#a78bfa" }}>{c.projected.toFixed(0)} ر.س</b>
                  </span>
                  <span style={{ fontWeight: 700 }}>{c.paceStatus}</span>
                </div>
              )}
            </div>

            {/* ===== التحليل الفني — ظاهر لحظيًا بدون أي ضغط ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: "#3a9aff", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📊 التحليل الفني</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                {[
                  { l: "عدد الفواتير", v: c.invoiceCount },
                  { l: "عدد الأصناف المباعة", v: c.itemsSold },
                  { l: "متوسط الأصناف/فاتورة", v: c.avgItemsPerInvoice.toFixed(1) },
                  { l: "متوسط قيمة الفاتورة", v: c.avgInvoiceValue.toFixed(0) + " ر.س" },
                  { l: "نسبة التسجيل على عملاء", v: c.customerRegRate.toFixed(0) + "%" },
                  { l: "عملاء جدد هذا الشهر", v: c.newCustomers },
                  { l: "عملاء سجّلهم وأصبحوا خاملين", v: c.inactiveCustomers },
                ].map((x, i) => (
                  <div key={i} style={{ background: "#080e1a", borderRadius: 10, padding: 12 }}>
                    <div style={{ color: "#4a6a8a", fontSize: 11 }}>{x.l}</div>
                    <div style={{ color: "#dde8ff", fontSize: 16, fontWeight: 800, marginTop: 4 }}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== الأداء خلال الشهر (يوم بيوم) ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: "#44dd88", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                📅 الأداء خلال الشهر (مبيعات يومية)
              </div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70, overflowX: "auto", paddingBottom: 4 }}>
                {dailyPerf.map((d) => (
                  <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 14 }}>
                    <div
                      title={`يوم ${d.day}: ${d.amount.toFixed(0)} ر.س`}
                      style={{
                        width: 8,
                        height: Math.max((d.amount / maxDaily) * 55, 2),
                        background: d.amount > 0 ? "#44dd88" : "#1d2d4a",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                    <span style={{ fontSize: 8, color: "#3a5a8a", marginTop: 3 }}>{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== مقارنة عبر آخر 6 شهور ===== */}
            <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
              <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                📈 مقارنة الأداء عبر آخر 6 شهور
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
                {yearTrend.map((m) => (
                  <div key={m.mKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 65 }}>
                      <div
                        title={`المحقق: ${m.achieved.toFixed(0)} ر.س`}
                        style={{ flex: 1, background: "#3a9aff", height: `${(m.achieved / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }}
                      />
                      {m.target > 0 && (
                        <div
                          title={`التارجت: ${m.target.toFixed(0)} ر.س`}
                          style={{ flex: 1, background: "#4a3a00", height: `${(m.target / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2, border: "1px dashed #ffaa44" }}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: 9, color: "#4a6a8a" }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#3a9aff" }}>■ المحقق</span>
                <span style={{ fontSize: 11, color: "#ffaa44" }}>▢ التارجت</span>
              </div>
            </div>

            {/* ===== مقارنة مع صيدلي آخر ===== */}
            {otherPharmacists.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ color: "#ffaa44", fontSize: 12, fontWeight: 700 }}>⚖️ مقارنة مع صيدلي آخر</div>
                  <select
                    value={compareName}
                    onChange={(e) => setCompareWith((p) => ({ ...p, [u.name]: e.target.value }))}
                    style={{ background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8, padding: "6px 10px", color: "#dde8ff", fontSize: 12, outline: "none" }}
                  >
                    {otherPharmacists.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {cOther && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                    <div style={{ background: "#080e1a", borderRadius: 10, padding: 12 }}>
                      <div style={{ color: "#3a9aff", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{u.name}</div>
                      {[
                        ["المحقق", c.achieved.toFixed(0) + " ر.س"],
                        ["نسبة التارجت", c.target ? c.simplePct.toFixed(1) + "%" : "—"],
                        ["عدد الفواتير", c.invoiceCount],
                        ["متوسط الفاتورة", c.avgInvoiceValue.toFixed(0) + " ر.س"],
                        ["نسبة التسجيل على عملاء", c.customerRegRate.toFixed(0) + "%"],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                          <span style={{ color: "#4a6a8a" }}>{l}</span>
                          <span style={{ color: "#dde8ff", fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ color: "#3a5a8a", fontSize: 18, fontWeight: 900 }}>VS</div>

                    <div style={{ background: "#080e1a", borderRadius: 10, padding: 12 }}>
                      <div style={{ color: "#ffaa44", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{compareName}</div>
                      {[
                        ["المحقق", cOther.achieved.toFixed(0) + " ر.س"],
                        ["نسبة التارجت", cOther.target ? cOther.simplePct.toFixed(1) + "%" : "—"],
                        ["عدد الفواتير", cOther.invoiceCount],
                        ["متوسط الفاتورة", cOther.avgInvoiceValue.toFixed(0) + " ر.س"],
                        ["نسبة التسجيل على عملاء", cOther.customerRegRate.toFixed(0) + "%"],
                      ].map(([l, v], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                          <span style={{ color: "#4a6a8a" }}>{l}</span>
                          <span style={{ color: "#dde8ff", fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ==================== TREASURY MODULE ====================
function TreasuryModule({ sales, creditPayments, purchases, suppliers, pharmacyId, currentUser, showToast, shifts, entries, setEntries }) {
  const [activeTab, setActiveTab] = useState("today");
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [showFixedForm, setShowFixedForm] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const printRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];
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

  // ── حسابات المبيعات مقسمة ──
  const todaySales = sales.filter((s) => s.date === today && !s.returned);
  const todayCash = todaySales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0);
  const todayCard = todaySales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0);
  const todayTransfer = todaySales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0);
  const todayAjil = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayCreditIncome = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todaySalesIncome = todayCash + todayCard + todayTransfer + todayCreditIncome;

  // ── رصيد الخزنة اللحظي من كل السجلات ──
  const calcBalance = (method) => {
    const safe = (entries || []).filter(Boolean);
    // دخل من المبيعات
    const salesIncome = sales.filter((s) => !s.returned && s.payment === method).reduce((a, s) => a + s.total, 0);
    // سداد آجل (كاش دايماً)
    const creditIn = method === "نقدي" ? creditPayments.reduce((a, p) => a + p.amount, 0) : 0;
    // من سجل الخزنة (يشمل المصروفات العادية ومدفوعات الموردين سوا — type === "expense")
    const entryIn = safe.filter((e) => e.type === "income" && e.method === method).reduce((a, e) => a + e.amount, 0);
    const entryOut = safe.filter((e) => e.type === "expense" && e.method === method).reduce((a, e) => a + e.amount, 0);
    return salesIncome + creditIn + entryIn - entryOut;
  };

  const balanceCash = calcBalance("نقدي");
  const balanceCard = calcBalance("بطاقة");
  const balanceTransfer = calcBalance("تحويل");
  const balanceTotal = balanceCash + balanceCard + balanceTransfer;

  // ── تقفيل الشفتات ──
  const todayShifts = shifts.filter((s) => s.start_time?.startsWith(today));
  const getShiftSales = (shiftId) => {
    const shiftSales = todaySales.filter((s) => s.shift === shiftId);
    return {
      cash: shiftSales.filter((s) => s.payment === "نقدي").reduce((a, s) => a + s.total, 0),
      card: shiftSales.filter((s) => s.payment === "بطاقة").reduce((a, s) => a + s.total, 0),
      transfer: shiftSales.filter((s) => s.payment === "تحويل").reduce((a, s) => a + s.total, 0),
      ajil: shiftSales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0),
      total: shiftSales.filter((s) => s.payment !== "آجل").reduce((a, s) => a + s.total, 0),
      count: shiftSales.length,
    };
  };

  // ── حسابات المصروفات ──
  const variableTotal = closingForm.variable_expenses.reduce((a, e) => a + (+e.amount || 0), 0);
  const fixedPaidTotal = fixedExpenses.filter((f) => closingForm.fixed_paid[f.id]).reduce((a, f) => a + f.amount, 0);
  const totalExpenses = (+closingForm.petty || 0) + variableTotal + fixedPaidTotal;
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
  const saveClosing = async () => {
    const rows = [];
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
    setClosingSaved(true);
    showToast("تم حفظ تقفيل اليوم ✓");
  };
  // ── تجميع السجل ──
  const safeEntries = (entries || []).filter(Boolean);
  const groupedByDay = {};
  safeEntries.forEach((e) => {
    if (!groupedByDay[e.date]) groupedByDay[e.date] = [];
    groupedByDay[e.date].push(e);
  });
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => b.localeCompare(a));

  // إجمالي الشهر
  const monthEntries = safeEntries.filter((e) => e.date?.startsWith(monthKey));
  const monthIncome = sales.filter((s) => s.date?.startsWith(monthKey) && !s.returned && s.payment !== "آجل").reduce((a, s) => a + s.total, 0)
    + creditPayments.filter((p) => p.date?.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0)
    + monthEntries.filter((e) => e.type === "income").reduce((a, e) => a + e.amount, 0);
  const monthExpenses = monthEntries.filter((e) => e.type === "expense").reduce((a, e) => a + e.amount, 0);

  const cardStyle = (border = "#1d2d4a") => ({
    background: "#0f1623", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });
  const inputStyle = {
    background: "#080e1a", border: "1px solid #1d2d4a", borderRadius: 8,
    padding: "8px 12px", color: "#dde8ff", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0a101a" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>💰 الخزنة</h2>
          <div style={{ color: "#3a5a8a", fontSize: 12, marginTop: 2 }}>{today}</div>
        </div>
      </div>

      {/* ── رصيد الخزنة اللحظي ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "💵 نقدي", value: balanceCash, color: "#44dd88" },
          { label: "💳 بطاقة", value: balanceCard, color: "#3a9aff" },
          { label: "🏦 تحويل", value: balanceTransfer, color: "#a78bfa" },
          { label: "📦 الإجمالي", value: balanceTotal, color: "#ffaa44" },
        ].map((b) => (
          <div key={b.label} style={{ background: "#0f1623", border: "1px solid #1d2d4a", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ color: "#4a6a8a", fontSize: 11, marginBottom: 4 }}>{b.label}</div>
            <div style={{ color: b.value < 0 ? "#ff4444" : b.color, fontWeight: 900, fontSize: 18 }}>{b.value.toFixed(2)}</div>
            <div style={{ color: "#3a5a8a", fontSize: 10 }}>ر.س</div>
          </div>
        ))}
      </div>

      {/* تنبيهات */}
      {(dueFixed.length > 0 || upcomingLicenses.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: dueFixed.length > 0 && upcomingLicenses.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
          {dueFixed.length > 0 && (
            <div style={{ background: "#1a0800", border: "1px solid #4a2800", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#ffaa44", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⏰ مصاريف ثابتة مستحقة قريباً</div>
              {dueFixed.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#dde8ff" }}>{f.name}</span>
                  <span style={{ color: "#ffaa44", fontWeight: 700 }}>{f.amount} ر.س</span>
                </div>
              ))}
            </div>
          )}
          {upcomingLicenses.length > 0 && (
            <div style={{ background: "#1a0a1a", border: "1px solid #4a1a4a", borderRadius: 12, padding: 12 }}>
              <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>📋 تراخيص قريبة التجديد</div>
              {upcomingLicenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "#dde8ff" }}>{l.name}</span>
                    <span style={{ color: days <= 14 ? "#ff4444" : "#ffaa44" }}>خلال {days} يوم</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#080e1a", borderRadius: 10, padding: 4 }}>
        {[
          { k: "today", l: "📅 تقفيل اليوم" },
          { k: "shifts", l: "🔄 الشفتات" },
          { k: "history", l: "📋 السجل" },
          { k: "fixed", l: "🔒 مصاريف ثابتة" },
          { k: "licenses", l: "📄 التراخيص" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? "#0f1623" : "transparent",
            color: activeTab === t.k ? "#3a9aff" : "#4a6a8a",
            fontSize: 11, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ══════════ تقفيل اليوم ══════════ */}
      {activeTab === "today" && (
        <div>
          {/* الدخل مقسم */}
          <div style={cardStyle("#1a3a1a")}>
            <div style={{ color: "#44dd88", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📥 الدخل</div>

            <div style={rowStyle}>
              <span style={{ color: "#8aaabb", fontSize: 13 }}>💵 مبيعات نقدي{hasCardAdjust && cardDiff !== 0 ? " (بعد التسوية)" : ""}</span>
              <span style={{ color: "#44dd88", fontWeight: 700 }}>{(hasCardAdjust ? cashAfterAdjust - todayCreditIncome : todayCash).toFixed(2)} ر.س</span>
            </div>
            <div style={{ ...rowStyle, alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span style={{ color: "#8aaabb", fontSize: 13 }}>💳 مبيعات بطاقة (النظام)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#3a9aff", fontWeight: 700 }}>{todayCard.toFixed(2)} ر.س</span>
                  <button onClick={() => setEditingCard((v) => !v)}
                    style={{ background: "transparent", border: "1px solid #1d3a6a", borderRadius: 6, padding: "3px 10px", color: "#6aaeff", fontSize: 11, cursor: "pointer" }}>
                    {editingCard ? "إغلاق" : "تعديل"}
                  </button>
                </div>
              </div>
              {editingCard && (
                <div style={{ width: "100%", background: "#080e1a", border: "1px solid #1d3a6a", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
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
                    <div style={{ color: cardDiff > 0 ? "#ff7744" : "#44dd88", fontSize: 12 }}>
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
                <span style={{ color: "#ffaa44", fontSize: 13 }}>⚖️ تسوية فرق البطاقة</span>
                <span style={{ color: cardDiff > 0 ? "#ff7744" : "#44dd88", fontWeight: 700 }}>
                  {cardDiff > 0 ? "−" : "+"}{Math.abs(cardDiff).toFixed(2)} ر.س (كاش)
                </span>
              </div>
            )}
            <div style={rowStyle}>
              <span style={{ color: "#8aaabb", fontSize: 13 }}>🏦 مبيعات تحويل</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{todayTransfer.toFixed(2)} ر.س</span>
            </div>
            <div style={rowStyle}>
              <span style={{ color: "#8aaabb", fontSize: 13 }}>✅ سداد آجل</span>
              <span style={{ color: "#3a9aff", fontWeight: 700 }}>{todayCreditIncome.toFixed(2)} ر.س</span>
            </div>
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={{ color: "#ff7777", fontSize: 13 }}>📋 مديونية اليوم (غير محصلة)</span>
              <span style={{ color: "#ff7777", fontWeight: 700 }}>{todayAjil.toFixed(2)} ر.س</span>
            </div>

            {/* دخل إضافي */}
            <div style={{ marginTop: 8, borderTop: "1px solid #1a3a1a", paddingTop: 10 }}>
              <div style={{ color: "#4a6a8a", fontSize: 11, marginBottom: 6 }}>دخل إضافي (اختياري)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={closingForm.extra_income_note} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income_note: e.target.value }))}
                  placeholder="وصف الدخل..." style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={closingForm.extra_income} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a3a1a" }}>
              <span style={{ color: "#4a6a8a", fontSize: 12, marginLeft: 12 }}>إجمالي الدخل</span>
              <span style={{ color: "#44dd88", fontWeight: 900, fontSize: 16 }}>{totalIncome.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* المصروفات */}
          <div style={cardStyle("#3a1000")}>
            <div style={{ color: "#ff7744", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📤 المصروفات</div>

            <div style={{ ...rowStyle, gap: 12 }}>
              <span style={{ color: "#8aaabb", fontSize: 13, whiteSpace: "nowrap" as const }}>🪙 نثريات</span>
              <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                <input value={closingForm.petty_note} onChange={(e) => setClosingForm((p) => ({ ...p, petty_note: e.target.value }))}
                  placeholder="وصف..." style={{ ...inputStyle, width: 140 }} />
                <input type="number" value={closingForm.petty} onChange={(e) => setClosingForm((p) => ({ ...p, petty: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
              </div>
            </div>

            {closingForm.variable_expenses.map((exp, i) => (
              <div key={i} style={{ ...rowStyle, gap: 8 }}>
                <span style={{ color: "#8aaabb", fontSize: 13, whiteSpace: "nowrap" as const }}>📦 مصروف</span>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <input value={exp.name} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], name: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="اسم المصروف" style={{ ...inputStyle, width: 140 }} />
                  <input type="number" value={exp.amount} onChange={(e) => setClosingForm((p) => {
                    const v = [...p.variable_expenses]; v[i] = { ...v[i], amount: e.target.value }; return { ...p, variable_expenses: v };
                  })} placeholder="0.00" style={{ ...inputStyle, width: 100, textAlign: "left" as const }} />
                  <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: p.variable_expenses.filter((_, j) => j !== i) }))}
                    style={{ background: "#3a0a0a", border: "none", borderRadius: 6, padding: "4px 10px", color: "#ff7744", cursor: "pointer", fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}

            <button onClick={() => setClosingForm((p) => ({ ...p, variable_expenses: [...p.variable_expenses, { name: "", amount: "" }] }))}
              style={{ background: "#1a0800", border: "1px dashed #3a1800", borderRadius: 8, padding: "7px 14px", color: "#ff7744", cursor: "pointer", fontSize: 12, width: "100%", marginTop: 4 }}>
              + إضافة مصروف متغير
            </button>

            {fixedExpenses.length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid #2a1000", paddingTop: 12 }}>
                <div style={{ color: "#ffaa44", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>🔒 مصاريف ثابتة — علّم المدفوع اليوم</div>
                {fixedExpenses.map((f) => {
                  const due = isDueThisMonth(f);
                  return (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", opacity: due ? 1 : 0.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!closingForm.fixed_paid[f.id]}
                        onChange={(e) => setClosingForm((p) => ({ ...p, fixed_paid: { ...p.fixed_paid, [f.id]: e.target.checked } }))}
                        style={{ width: 16, height: 16, accentColor: "#ffaa44" }} />
                      <span style={{ color: "#dde8ff", fontSize: 13 }}>{f.name}</span>
                      <span style={{ fontSize: 10, color: "#7a8aaa", background: "#0a1020", padding: "2px 6px", borderRadius: 5 }}>
                        {recurrenceLabel[f.recurrence || "monthly"]}
                      </span>
                      {!due && <span style={{ fontSize: 10, color: "#4a6a8a" }}>(غير مستحق هذا الشهر)</span>}
                    </label>
                    <span style={{ color: closingForm.fixed_paid[f.id] ? "#ff7744" : "#4a6a8a", fontWeight: 700 }}>{f.amount} ر.س</span>
                  </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a1000" }}>
              <span style={{ color: "#4a6a8a", fontSize: 12, marginLeft: 12 }}>إجمالي المصروفات</span>
              <span style={{ color: "#ff7744", fontWeight: 900, fontSize: 16 }}>{totalExpenses.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* صافي الخزنة */}
          <div style={{ ...cardStyle("#1a2a4a"), textAlign: "center" as const, padding: 20 }}>
            <div style={{ color: "#4a6a8a", fontSize: 13, marginBottom: 6 }}>🏦 صافي الخزنة اليوم</div>
            <div style={{ color: netCash >= 0 ? "#44dd88" : "#ff4444", fontWeight: 900, fontSize: 32, marginBottom: 4 }}>
              {netCash.toFixed(2)} ر.س
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, color: "#4a6a8a" }}>
              <span>نقدي: <b style={{ color: "#44dd88" }}>{cashAfterAdjust.toFixed(0)}</b></span>
              <span>بطاقة: <b style={{ color: "#3a9aff" }}>{cardActual.toFixed(0)}</b></span>
              <span>تحويل: <b style={{ color: "#a78bfa" }}>{todayTransfer.toFixed(0)}</b></span>
            </div>
            {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).length > 0 && (
              <div style={{ color: "#ffaa44", fontSize: 11, marginTop: 8 }}>
                ⚠️ مصاريف ثابتة مستحقة قريبًا وغير مدفوعة: {dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).map((f) => f.name).join("، ")}
                {" "}({dueFixed.filter((f) => !closingForm.fixed_paid[f.id]).reduce((a, f) => a + (+f.amount || 0), 0).toFixed(2)} ر.س)
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            {!closingSaved
              ? <Btn icon="check" onClick={saveClosing}>حفظ تقفيل اليوم</Btn>
              : <div style={{ color: "#44dd88", fontWeight: 700, padding: "10px 16px", fontSize: 13 }}>✅ تم الحفظ</div>
            }
          </div>
        </div>
      )}

      {/* ══════════ تاب الشفتات ══════════ */}
      {activeTab === "shifts" && (
        <div>
          {todayShifts.length === 0 ? (
            <div style={{ color: "#4a6a8a", textAlign: "center" as const, padding: 40 }}>لا توجد شفتات اليوم</div>
          ) : (
            <>
              {todayShifts.map((sh) => {
                const ss = getShiftSales(sh.id);
                return (
                  <div key={sh.id} style={cardStyle("#1a2a3a")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <span style={{ color: "#6aaeff", fontWeight: 700 }}>{sh.id}</span>
                        <span style={{ color: "#4a6a8a", fontSize: 11, marginRight: 10 }}>{sh.user}</span>
                      </div>
                      <div style={{ color: sh.end_time ? "#44dd88" : "#ffaa44", fontSize: 11, fontWeight: 700 }}>
                        {sh.end_time ? "✅ مغلق" : "🟡 مفتوح"}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                      {[
                        { l: "نقدي", v: ss.cash, c: "#44dd88" },
                        { l: "بطاقة", v: ss.card, c: "#3a9aff" },
                        { l: "تحويل", v: ss.transfer, c: "#a78bfa" },
                        { l: "إجمالي", v: ss.total, c: "#ffaa44" },
                      ].map((x) => (
                        <div key={x.l} style={{ background: "#080e14", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                          <div style={{ color: "#4a6a8a", fontSize: 10 }}>{x.l}</div>
                          <div style={{ color: x.c, fontWeight: 700, fontSize: 14 }}>{x.v.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    {ss.ajil > 0 && (
                      <div style={{ marginTop: 8, color: "#ff7777", fontSize: 12 }}>
                        مديونية: {ss.ajil.toFixed(2)} ر.س ({ss.count} فاتورة)
                      </div>
                    )}
                  </div>
                );
              })}

              {/* إجمالي اليوم */}
              <div style={{ ...cardStyle("#2a3a1a"), marginTop: 8 }}>
                <div style={{ color: "#44dd88", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📊 إجمالي اليوم</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[
                    { l: "نقدي", v: todayCash, c: "#44dd88" },
                    { l: "بطاقة", v: todayCard, c: "#3a9aff" },
                    { l: "تحويل", v: todayTransfer, c: "#a78bfa" },
                    { l: "الإجمالي", v: todayCash + todayCard + todayTransfer, c: "#ffaa44" },
                  ].map((x) => (
                    <div key={x.l} style={{ background: "#080e14", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: "#4a6a8a", fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* إجمالي الشهر */}
              <div style={{ ...cardStyle("#1a2a4a"), marginTop: 8 }}>
                <div style={{ color: "#3a9aff", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📅 إجمالي الشهر</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "دخل الشهر", v: monthIncome, c: "#44dd88" },
                    { l: "مصروفات الشهر", v: monthExpenses, c: "#ff7744" },
                    { l: "صافي الشهر", v: monthIncome - monthExpenses, c: monthIncome - monthExpenses >= 0 ? "#3a9aff" : "#ff4444" },
                  ].map((x) => (
                    <div key={x.l} style={{ background: "#080e14", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: "#4a6a8a", fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                      <div style={{ color: "#3a5a8a", fontSize: 10 }}>ر.س</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ السجل ══════════ */}
      {activeTab === "history" && (
        <div>
          {/* ملخص الشهر */}
          <div style={{ ...cardStyle("#1a2a4a"), display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: "#4a6a8a", fontSize: 11 }}>دخل الشهر</div>
              <div style={{ color: "#44dd88", fontWeight: 900, fontSize: 18 }}>{monthIncome.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: "#4a6a8a", fontSize: 11 }}>مصروفات الشهر</div>
              <div style={{ color: "#ff7744", fontWeight: 900, fontSize: 18 }}>{monthExpenses.toFixed(0)} ر.س</div>
            </div>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ color: "#4a6a8a", fontSize: 11 }}>صافي الشهر</div>
              <div style={{ color: monthIncome - monthExpenses >= 0 ? "#3a9aff" : "#ff4444", fontWeight: 900, fontSize: 18 }}>
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
                    <div style={{ color: "#dde8ff", fontWeight: 700 }}>{day}</div>
                    <div style={{ color: "#4a6a8a", fontSize: 11 }}>{dayEnt.length} قيد</div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: "#44dd88", fontWeight: 700 }}>+{dayIncome.toFixed(0)}</div>
                      <div style={{ color: "#4a6a8a", fontSize: 10 }}>دخل</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: "#ff7744", fontWeight: 700 }}>-{dayExp.toFixed(0)}</div>
                      <div style={{ color: "#4a6a8a", fontSize: 10 }}>مصروف</div>
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ color: dayIncome - dayExp >= 0 ? "#3a9aff" : "#ff4444", fontWeight: 900 }}>
                        {(dayIncome - dayExp).toFixed(0)}
                      </div>
                      <div style={{ color: "#4a6a8a", fontSize: 10 }}>صافي</div>
                    </div>
                    <span style={{ color: "#4a6a8a" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: "1px solid #0a101a", paddingTop: 10 }}>
                    {dayEnt.map((e) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                        <div>
                          <span style={{ color: "#7a9aaa" }}>{e.note || e.sub_type}</span>
                          {e.method && <span style={{ color: "#3a5a8a", fontSize: 10, marginRight: 8 }}>({e.method})</span>}
                        </div>
                        <span style={{ color: e.type === "income" ? "#44dd88" : "#ff7744", fontWeight: 700 }}>
                          {e.type === "income" ? "+" : "-"}{e.amount} ر.س
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {sortedDays.length === 0 && <div style={{ color: "#4a6a8a", textAlign: "center" as const, padding: 40 }}>لا توجد قيود مسجلة</div>}
        </div>
      )}

      {/* ══════════ المصاريف الثابتة ══════════ */}
      {activeTab === "fixed" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowFixedForm(true)}>إضافة مصروف ثابت</Btn>
          </div>
          {fixedExpenses.length === 0
            ? <div style={{ color: "#4a6a8a", textAlign: "center" as const, padding: 40 }}>لا توجد مصاريف ثابتة</div>
            : (
              <>
                <div style={{ ...cardStyle("#2a1a00"), display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#ffaa44", fontWeight: 700 }}>إجمالي شهري (متوسط الأقساط)</span>
                  <span style={{ color: "#ff7744", fontWeight: 900, fontSize: 16 }}>{monthFixedTotal.toFixed(2)} ر.س</span>
                </div>
                {fixedExpenses.map((f) => {
                  const due = isDueThisMonth(f);
                  const rec = f.recurrence || "monthly";
                  return (
                  <div key={f.id} style={cardStyle(due ? "#3a2000" : "#1d2d4a")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#dde8ff", fontWeight: 700 }}>{f.name}</span>
                          <span style={{ fontSize: 10, color: "#7a8aaa", background: "#0a1020", padding: "2px 6px", borderRadius: 5 }}>
                            {recurrenceLabel[rec]}
                          </span>
                        </div>
                        <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 3 }}>
                          يوم {f.due_day}{rec !== "monthly" ? ` من شهر الاستحقاق` : " من كل شهر"}
                          {due && Math.abs(+f.due_day - currentDay) <= 3 && <span style={{ color: "#ffaa44", marginRight: 8 }}>⏰ مستحقة قريباً</span>}
                          {!due && <span style={{ color: "#4a6a8a", marginRight: 8 }}>غير مستحقة هذا الشهر</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" as const }}>
                        <div style={{ color: "#ff7744", fontWeight: 900, fontSize: 16 }}>{f.amount} ر.س</div>
                        {rec !== "monthly" && (
                          <div style={{ color: "#4a6a8a", fontSize: 10 }}>≈ {monthlyShare(f).toFixed(2)} ر.س / شهر</div>
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
      {activeTab === "licenses" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowLicenseForm(true)}>إضافة ترخيص</Btn>
          </div>
          {licenses.length === 0
            ? <div style={{ color: "#4a6a8a", textAlign: "center" as const, padding: 40 }}>لا توجد تراخيص</div>
            : licenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                const urgent = days <= 14; const soon = days <= 60;
                return (
                  <div key={l.id} style={cardStyle(urgent ? "#4a0000" : soon ? "#3a2000" : "#1d2d4a")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#dde8ff", fontWeight: 700 }}>{l.name}</div>
                        <div style={{ color: "#4a6a8a", fontSize: 11, marginTop: 3 }}>
                          تجديد: {l.renew_date}{l.note && ` • ${l.note}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "left" as const }}>
                        <div style={{ color: urgent ? "#ff4444" : soon ? "#ffaa44" : "#44dd88", fontWeight: 700 }}>
                          {days <= 0 ? "⚠️ منتهي" : `خلال ${days} يوم`}
                        </div>
                        <div style={{ color: "#a78bfa", fontWeight: 700 }}>{l.amount} ر.س</div>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}
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
// ==================== TAX REPORT ====================
function TaxReport({ sales, purchases, returns = [] }) {
  const [quarter, setQuarter] = useState("Q2-2026");
  const quarters = ["Q1-2026","Q2-2026","Q3-2026","Q4-2026","Q1-2025","Q2-2025"];
  const qMap = { Q1: "01,02,03", Q2: "04,05,06", Q3: "07,08,09", Q4: "10,11,12" };
  const [q, year] = quarter.split("-");
  const months = qMap[q].split(",").map((m) => `${year}-${m}`);
  const filtSales = sales.filter((s) => months.some((m) => s.date.startsWith(m)) && !s.returned);
  const filtPurchases = purchases.filter((p) => months.some((m) => p.date.startsWith(m)));
  const filtReturns = (returns || []).filter((r) => months.some((m) => (r.date || "").startsWith(m)));
  const filtSalesReturns = filtReturns.filter((r) => r.type === "sales");
  const filtPurchaseReturns = filtReturns.filter((r) => r.type === "purchases");
  const salesSubtotal = filtSales.reduce((a, s) => a + (s.subtotal || 0), 0);
  const salesTax = filtSales.reduce((a, s) => a + (s.tax_amount || 0), 0);
  const salesTotal = filtSales.reduce((a, s) => a + (s.total || 0), 0);
  const purchSubtotal = filtPurchases.reduce((a, p) => a + (p.subtotal || 0), 0);
  const purchTax = filtPurchases.reduce((a, p) => a + (p.tax_amount || 0), 0);
  const purchTotal = filtPurchases.reduce((a, p) => a + (p.total || 0), 0);
  const salesReturnsSubtotal = filtSalesReturns.reduce((a, r) => a + (r.subtotal || 0), 0);
  const salesReturnsTax = filtSalesReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const purchReturnsSubtotal = filtPurchaseReturns.reduce((a, r) => a + (r.subtotal || 0), 0);
  const purchReturnsTax = filtPurchaseReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const netSalesTax = salesTax - salesReturnsTax;
  const netPurchTax = purchTax - purchReturnsTax;
  const netTax = netSalesTax - netPurchTax;
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>تقرير ضريبة القيمة المضافة — ربع سنوي</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 22, alignItems: "center" }}>
        <Select label="الربع السنوي" value={quarter} onChange={setQuarter}
          options={quarters.map((q) => ({ v: q, l: `الربع ${q}` }))} style={{ width: 200 }} />
        <div style={{ color: "#3a5a8a", fontSize: 13, marginTop: 20 }}>نسبة الضريبة: 15% (VAT)</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "#0f1623", border: "1px solid #1a3a1a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#44dd88", display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="pos" s={16} /> ضريبة المبيعات (الضريبة المحصلة)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6a8aaa" }}>
              <span>إجمالي المبيعات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{salesSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#88dd44" }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{salesTax.toFixed(2)} ر.س</span>
            </div>
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#ff7744", fontSize: 12 }}>
                <span>قيمة مرتجعات المبيعات (قبل الضريبة)</span>
                <span>{salesReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#ff7744" }}>
                <span>(–) ضريبة مرتجعات المبيعات</span>
                <span style={{ fontWeight: 700 }}>−{salesReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dde8ff", fontWeight: 800, borderTop: "1px solid #1d3a1d", paddingTop: 10 }}>
              <span>صافي ضريبة المخرجات</span>
              <span>{netSalesTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dde8ff", fontWeight: 800 }}>
              <span>إجمالي المبيعات شامل الضريبة</span>
              <span>{salesTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a6a3a", fontSize: 12 }}>عدد الفواتير: {filtSales.length}{filtSalesReturns.length > 0 ? ` · مرتجعات: ${filtSalesReturns.length}` : ""}</div>
          </div>
        </div>
        <div style={{ background: "#0f1623", border: "1px solid #1a2a3a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#6aaeff", display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="purchase" s={16} /> ضريبة المشتريات (ضريبة المدخلات)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6a8aaa" }}>
              <span>إجمالي المشتريات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{purchSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6aaeff" }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{purchTax.toFixed(2)} ر.س</span>
            </div>
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#ff7744", fontSize: 12 }}>
                <span>قيمة مرتجعات المشتريات (قبل الضريبة)</span>
                <span>{purchReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#ff7744" }}>
                <span>(–) ضريبة مرتجعات المشتريات</span>
                <span style={{ fontWeight: 700 }}>−{purchReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dde8ff", fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 10 }}>
              <span>صافي ضريبة المدخلات</span>
              <span>{netPurchTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dde8ff", fontWeight: 800 }}>
              <span>إجمالي المشتريات شامل الضريبة</span>
              <span>{purchTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a5a7a", fontSize: 12 }}>عدد الفواتير: {filtPurchases.length}{filtPurchaseReturns.length > 0 ? ` · مرتجعات: ${filtPurchaseReturns.length}` : ""}</div>
          </div>
        </div>
      </div>
      <div style={{ background: netTax > 0 ? "#0a1a0a" : "#1a0a0a", border: `2px solid ${netTax > 0 ? "#1a6a1a" : "#6a1a1a"}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: netTax > 0 ? "#44dd88" : "#ff7777" }}>
          {netTax > 0 ? "✔️ ضريبة مستحقة الدفع" : "✔️ ضريبة مستردة"} — {quarter}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>صافي ضريبة المبيعات</div>
            <div style={{ color: "#44dd88", fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netSalesTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>صافي ضريبة المشتريات</div>
            <div style={{ color: "#6aaeff", fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netPurchTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>صافي الضريبة</div>
            <div style={{ color: netTax > 0 ? "#44dd88" : "#ff7777", fontSize: 28, fontWeight: 900, marginTop: 4 }}>{netTax.toFixed(2)} ر.س</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, color: "#6a8aaa", fontSize: 13 }}>
          {netTax > 0
            ? `يجب تحويل مبلغ ${netTax.toFixed(2)} ر.س إلى هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`
            : `يحق استرداد مبلغ ${Math.abs(netTax).toFixed(2)} ر.س من هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`}
        </div>
      </div>
    </div>
  );
}

// ==================== REPORTS ====================
function Reports({ sales, purchases, products, suppliers, customers, returns = [], manufacturers = [] }) {
  const [type, setType] = useState("sales");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterManufacturer, setFilterManufacturer] = useState("");
  const [search, setSearch] = useState("");
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(null);
  const [showPrint, setShowPrint] = useState(null);

  // helper: منتجات الشركة المنتجة المختارة
  const mfrProductIds = filterManufacturer
    ? new Set(products.filter((p) => p.manufacturer_id === filterManufacturer).map((p) => p.id))
    : null;

  const filteredSales = sales.filter((s) => {
    const d = s.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterProduct && !s.items.some((i) => i.id === filterProduct)) ok = false;
    if (mfrProductIds && !s.items.some((i) => mfrProductIds.has(i.id))) ok = false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const inId = (s.id || "").toLowerCase().includes(q);
      const inCustomer = (s.customer_name || "").toLowerCase().includes(q);
      const inItems = (s.items || []).some((i) => (i.name || "").toLowerCase().includes(q));
      if (!inId && !inCustomer && !inItems) ok = false;
    }
    return ok;
  });

  const filteredPurchases = purchases.filter((p) => {
    const d = p.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterSupplier && p.supplier !== filterSupplier) ok = false;
    if (mfrProductIds && !(p.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    return ok;
  });

  const filteredReturns = (returns || []).filter((r) => {
    const d = r.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (mfrProductIds && !(r.items || []).some((i) => mfrProductIds.has(i.id))) ok = false;
    return ok;
  });

  // احصائيات شهرية
  const salesByMonth = {};
  filteredSales.forEach((s) => {
    const m = (s.date || s.created_at || "").substring(0, 7);
    if (!m) return;
    if (!salesByMonth[m]) salesByMonth[m] = { count: 0, subtotal: 0, tax: 0, total: 0 };
    salesByMonth[m].count++;
    salesByMonth[m].subtotal += s.subtotal || 0;
    salesByMonth[m].tax += s.taxAmount ?? s.tax_amount ?? 0;
    salesByMonth[m].total += s.total || 0;
  });

  // تقرير الأصناف — مع فلتر الشركة
  const productSales = {};
  filteredSales.forEach((s) =>
    s.items.forEach((i) => {
      if (mfrProductIds && !mfrProductIds.has(i.id)) return;
      if (!productSales[i.id]) productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
      productSales[i.id].qty += i.qty;
      productSales[i.id].revenue += i.price * i.qty;
      productSales[i.id].tax += i.taxable ? i.price * i.qty * TAX_RATE : 0;
    })
  );

  const totalSalesRev = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + s.total, 0);
  const totalSalesTax = filteredSales.filter((s) => !s.returned).reduce((a, s) => a + (s.taxAmount || s.tax_amount || 0), 0);
  const returnedCount = filteredSales.filter((s) => s.returned).length;
  const totalPurchase = filteredPurchases.reduce((a, p) => a + p.total, 0);
  const totalPurchaseTax = filteredPurchases.reduce((a, p) => a + p.taxAmount, 0);

  const returnsSales = filteredReturns.filter((r) => r.type === "sales");
  const returnsPurchases = filteredReturns.filter((r) => r.type === "purchases");
  const totalReturnsSales = returnsSales.reduce((a, r) => a + (r.total || 0), 0);
  const totalReturnsPurchases = returnsPurchases.reduce((a, r) => a + (r.total || 0), 0);
  const totalReturnsTax = filteredReturns.reduce((a, r) => a + (r.tax || 0), 0);
  const isAutoReturn = (r) => (r.reason || "").includes("تلقائي");

  // فلتر الشركة يظهر في: product, purchase, returns
  const showMfrFilter = ["product", "purchase", "returns"].includes(type);

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>التقارير والإحصائيات</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        {["sales", "purchase", "product", "monthly", "returns"].map((t) => (
          <button key={t} onClick={() => setType(t)} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid",
            borderColor: type === t ? "#2a6aef" : "#1d2d4a",
            background: type === t ? "#142a5a" : "transparent",
            color: type === t ? "#6aaeff" : "#4a6a8a",
            fontWeight: type === t ? 700 : 400, cursor: "pointer", fontSize: 13,
          }}>
            {t === "sales" ? "تقرير المبيعات" : t === "purchase" ? "تقرير المشتريات" : t === "product" ? "تقرير الأصناف" : t === "monthly" ? "تقرير شهري" : "تقرير المرتجعات"}
          </button>
        ))}

        <div style={{ marginRight: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {type === "sales" && (
            <Input label="بحث" value={search} onChange={setSearch} placeholder="رقم الفاتورة، العميل، أو اسم الصنف" style={{ width: 220 }} />
          )}
          <Input label="من" value={fromDate} onChange={setFromDate} type="date" style={{ width: 140 }} />
          <Input label="إلى" value={toDate} onChange={setToDate} type="date" style={{ width: 140 }} />

          {type === "purchase" && (
            <Select label="المورد" value={filterSupplier} onChange={setFilterSupplier}
              options={[{ v: "", l: "الكل" }, ...suppliers.map((s) => ({ v: s.id, l: s.name }))]}
              style={{ width: 160 }} />
          )}
          {type === "product" && (
            <Select label="الصنف" value={filterProduct} onChange={setFilterProduct}
              options={[{ v: "", l: "الكل" }, ...products.map((p) => ({ v: p.id, l: p.name }))]}
              style={{ width: 180 }} />
          )}
          {showMfrFilter && manufacturers.length > 0 && (
            <Select label="🏭 الشركة المنتجة" value={filterManufacturer} onChange={setFilterManufacturer}
              options={[{ v: "", l: "الكل" }, ...manufacturers.map((m) => ({ v: m.id, l: m.name }))]}
              style={{ width: 180 }} />
          )}
        </div>
      </div>

      {/* تقرير المبيعات */}
      {type === "sales" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المبيعات (شامل الضريبة)" value={totalSalesRev.toFixed(2) + " ر.س"} icon="money" color="#3a9aff" />
            <StatCard label="ضريبة المبيعات" value={totalSalesTax.toFixed(2) + " ر.س"} icon="tax" color="#88dd44" />
            <StatCard label="عدد الفواتير" value={filteredSales.filter((s) => !s.returned).length} icon="pos" color="#a78bfa" />
            <StatCard label="المرتجعات" value={returnedCount} icon="returns" color="#ff7744" />
          </div>
          <Table
            headers={["رقم الفاتورة", "التاريخ", "العميل", "المجموع", "الضريبة", "الإجمالي شامل الضريبة", "الدفع", "حالة"]}
            rows={filteredSales.map((s) => [
              <span onClick={() => setShowInvoiceDetail(s)} style={{ color: "#6aaeff", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{s.id}</span>,
              s.date,
              s.customer_name || "زبون عادي",
              (s.subtotal || 0).toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>{(s.taxAmount || s.tax_amount || 0).toFixed(2)} ر.س</span>,
              <span style={{ color: "#3a9aff", fontWeight: 700 }}>{(s.total || 0).toFixed(2)} ر.س</span>,
              s.payment,
              s.returned
                ? <Badge color="#3a0a0a" text="#ff7777">مرتجعة</Badge>
                : <Badge color="#0a2a10" text="#44dd88">مكتملة</Badge>,
            ])}
          />
          {filteredSales.length === 0 && <div style={{ textAlign: "center", color: "#4a6a8a", padding: 30 }}>لا توجد فواتير مطابقة للبحث</div>}
        </>
      )}

      {/* تقرير المشتريات */}
      {type === "purchase" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المشتريات (شامل الضريبة)" value={totalPurchase.toFixed(2) + " ر.س"} icon="purchase" color="#fb923c" />
            <StatCard label="ضريبة المشتريات" value={totalPurchaseTax.toFixed(2) + " ر.س"} icon="tax" color="#88dd44" />
            <StatCard label="عدد أوامر الشراء" value={filteredPurchases.length} icon="suppliers" color="#a78bfa" />
          </div>
          <Table
            headers={["رقم الأمر", "التاريخ", "المورد", "المجموع", "الضريبة", "الإجمالي", "الحالة"]}
            rows={filteredPurchases.map((p) => [
              <span style={{ color: "#6aaeff", fontWeight: 700 }}>{p.id}</span>,
              p.date, p.supplierName,
              p.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>{p.taxAmount.toFixed(2)} ر.س</span>,
              <span style={{ color: "#fb923c", fontWeight: 700 }}>{p.total.toFixed(2)} ر.س</span>,
              <Badge color="#0a2a10" text="#44dd88">{p.status}</Badge>,
            ])}
          />
        </>
      )}

      {/* تقرير الأصناف */}
      {type === "product" && (
        <>
          {filterManufacturer && (
            <div style={{ background: "#0a1a3a", border: "1px solid #1d3a6a", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#6aaeff" }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          <Table
            headers={["الصنف", "الشركة المنتجة", "الكمية المباعة", "الإيراد قبل الضريبة", "الضريبة", "الإيراد الكلي"]}
            rows={Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, d]) => {
              const prod = products.find((p) => p.id === id);
              const mfr = manufacturers.find((m) => m.id === prod?.manufacturer_id);
              return [
                <span style={{ fontWeight: 700, color: "#dde8ff" }}>{d.name}</span>,
                mfr ? <Badge color="#0a1a3a" text="#6aaeff">{mfr.name}</Badge> : <span style={{ color: "#3a5a8a", fontSize: 11 }}>—</span>,
                <span style={{ color: "#3a9aff", fontWeight: 700 }}>{d.qty}</span>,
                d.revenue.toFixed(2) + " ر.س",
                <span style={{ color: "#88dd44" }}>{d.tax.toFixed(2)} ر.س</span>,
                <span style={{ color: "#44dd88", fontWeight: 700 }}>{(d.revenue + d.tax).toFixed(2)} ر.س</span>,
              ];
            })}
          />
        </>
      )}

      {/* تقرير شهري */}
      {type === "monthly" && (
        <Table
          headers={["الشهر", "عدد الفواتير", "المبيعات قبل الضريبة", "ضريبة المبيعات", "المبيعات الكلية"]}
          rows={Object.entries(salesByMonth).sort().reverse().map(([m, d]) => [
            <span style={{ fontWeight: 700, color: "#dde8ff" }}>{m}</span>,
            d.count,
            d.subtotal.toFixed(2) + " ر.س",
            <span style={{ color: "#88dd44" }}>{d.tax.toFixed(2)} ر.س</span>,
            <span style={{ color: "#3a9aff", fontWeight: 700 }}>{d.total.toFixed(2)} ر.س</span>,
          ])}
        />
      )}

      {/* تقرير المرتجعات */}
      {type === "returns" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="عدد المرتجعات" value={filteredReturns.length} icon="returns" color="#ff7744" />
            <StatCard label="مرتجعات المبيعات" value={totalReturnsSales.toFixed(2) + " ر.س"} icon="pos" color="#3a9aff" />
            <StatCard label="مرتجعات المشتريات" value={totalReturnsPurchases.toFixed(2) + " ر.س"} icon="purchase" color="#fb923c" />
            <StatCard label="الضريبة المستردة" value={totalReturnsTax.toFixed(2) + " ر.س"} icon="tax" color="#88dd44" />
          </div>
          <Table
            headers={["رقم المرتجع", "التاريخ", "النوع", "العميل / المورد", "السبب", "الإجمالي"]}
            rows={filteredReturns.sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => [
              <span style={{ color: "#6aaeff", fontWeight: 700 }}>{r.id}</span>,
              r.date,
              r.type === "sales"
                ? <Badge color="#0a2040" text="#3a9aff">مرتجع مبيعات</Badge>
                : <Badge color="#1a1000" text="#fb923c">مرتجع مشتريات</Badge>,
              r.type === "sales" ? (r.customer_name || "زبون عادي") : (r.supplier_name || "—"),
              <span>{r.reason || "—"}{isAutoReturn(r) && <span style={{ marginRight: 6 }}><Badge color="#1a0a00" text="#ff7744">تلقائي</Badge></span>}</span>,
              <span style={{ color: "#ff7744", fontWeight: 700 }}>{(r.total || 0).toFixed(2)} ر.س</span>,
            ])}
          />
          {filteredReturns.length === 0 && <div style={{ textAlign: "center", color: "#4a6a8a", padding: 30 }}>لا توجد مرتجعات في هذه الفترة</div>}
        </>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {showInvoiceDetail && (
        <Modal open title={`تفاصيل الفاتورة — ${showInvoiceDetail.id}`} onClose={() => setShowInvoiceDetail(null)} wide>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13, color: "#4a6a8a" }}>
            <span>التاريخ: <span style={{ color: "#dde8ff" }}>{showInvoiceDetail.date}</span></span>
            <span>العميل: <span style={{ color: "#dde8ff" }}>{showInvoiceDetail.customer_name || "زبون عادي"}</span></span>
            <span>طريقة الدفع: <span style={{ color: "#dde8ff" }}>{showInvoiceDetail.payment}</span></span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#080e1a" }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#4a6a9a", fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showInvoiceDetail.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: "#c0d0f0", fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 13, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ padding: "8px 10px", color: "#4a6a8a", fontSize: 13, textAlign: "center" }}>{item.price}</td>
                    <td style={{ padding: "8px 10px", color: "#dde8ff", fontSize: 13, textAlign: "center", fontWeight: 700 }}>{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: "#080e1a", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4a6a8a", marginBottom: 5 }}>
              <span>قبل الضريبة</span><span>{(showInvoiceDetail.subtotal || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#88dd44", marginBottom: 5 }}>
              <span>الضريبة</span><span>{(showInvoiceDetail.taxAmount || showInvoiceDetail.tax_amount || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#dde8ff", fontWeight: 800, fontSize: 16, borderTop: "1px solid #1d2d4a", paddingTop: 8 }}>
              <span>الإجمالي</span><span>{(showInvoiceDetail.total || 0).toFixed(2)} ر.س</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowInvoiceDetail(null)}>إغلاق</Btn>
            <Btn icon="print" onClick={() => setShowPrint(showInvoiceDetail)}>إعادة الطباعة</Btn>
          </div>
        </Modal>
      )}
      {showPrint && <PrintReceipt invoice={showPrint} onClose={() => setShowPrint(null)} />}
    </div>
  );
}
// ==================== SHIFT MODULE ====================
function ShiftModule({ shifts, setShifts, sales, currentUser, showToast, pharmacyId }) {
  const [openCash, setOpenCash] = useState("500");
  const [closeCash, setCloseCash] = useState("");
  const [notes, setNotes] = useState("");

  const currentShift = shifts.find(
  (s) => !s.end_time && s.user === currentUser?.name
);
  const shiftSales = currentShift
    ? sales.filter((s) => s.shift === currentShift.id)
    : [];
  const shiftRevenue = shiftSales.reduce((a, s) => a + s.total, 0);

  const openShift = async () => {
  if (currentShift) {
    showToast("يوجد شفت مفتوح بالفعل", "warn");
    return;
  }
  const sh = {
  id: "SH-" + Date.now(),
  user: currentUser.name,
  role: currentUser.role,
  start_time: new Date().toISOString(),
  end_time: null,
  open_cash: +openCash,
  close_cash: null,
  sales: 0,
  notes: "",
  pharmacy_id: pharmacyId,
};

  const { error } = await supabase.from("shifts").insert(sh);
  if (error) {
    showToast("فشل فتح الشفت: " + error.message, "error");
    return;
  }
  setShifts((p) => [...p, sh]);
  showToast("تم فتح الشفت ✓");
};
  const closeShift = async () => {
  if (!closeCash) {
    showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
    return;
  }
  const updates = {
  end_time: new Date().toISOString(),
  close_cash: +closeCash,
  sales: shiftRevenue,
  notes,
};

  const { error } = await supabase
    .from("shifts")
    .update(updates)
    .eq("id", currentShift.id);

  if (error) {
    showToast("فشل إغلاق الشفت: " + error.message, "error");
    return;
  }
  setShifts((p) =>
    p.map((s) =>
      s.id === currentShift.id ? { ...s, ...updates } : s
    )
  );
  showToast("تم إغلاق الشفت وتسليمه ✓");
};
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        إدارة الشفتات
      </h2>
      {!currentShift ? (
        <div
          style={{
            background: "#0f1623",
            border: "1px solid #1d2d4a",
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
              color: "#dde8ff",
            }}
          >
            فتح شفت جديد
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="النقد الافتتاحي (ر.س)"
              value={openCash}
              onChange={setOpenCash}
              type="number"
              placeholder="500"
            />
            <Btn icon="shift" onClick={openShift} size="lg">
              فتح الشفت
            </Btn>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#0a1a0a",
            border: "1px solid #1a5a1a",
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
                color: "#44dd88",
              }}
            >
              شفت مفتوح ✓
            </h3>
            <Badge color="#0a3a0a" text="#44dd88">
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
              style={{ background: "#080e14", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>بداية الشفت</div>
              <div style={{ color: "#dde8ff", fontSize: 13, marginTop: 4 }}>
                {currentShift.start_time}
              </div>
            </div>
            <div
              style={{ background: "#080e14", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>
                النقد الافتتاحي
              </div>
              <div
                style={{
                  color: "#44dd88",
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {currentShift.open_cash} ر.س
              </div>
            </div>
            <div
              style={{ background: "#080e14", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>مبيعات الشفت</div>
              <div
                style={{
                  color: "#3a9aff",
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftRevenue.toFixed(2)} ر.س
              </div>
            </div>
            <div
              style={{ background: "#080e14", borderRadius: 8, padding: 12 }}
            >
              <div style={{ color: "#3a6a3a", fontSize: 11 }}>عدد الفواتير</div>
              <div
                style={{
                  color: "#a78bfa",
                  fontSize: 16,
                  fontWeight: 700,
                  marginTop: 2,
                }}
              >
                {shiftSales.length}
              </div>
            </div>
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
                background: "#080e14",
                borderRadius: 8,
                color: "#ffaa44",
                fontSize: 13,
              }}
            >
              فرق النقد:{" "}
              {(+closeCash - currentShift.open_cash - shiftRevenue).toFixed(2)}{" "}
              ر.س
            </div>
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
        ]}
        rows={[...shifts].reverse().map((s) => [
          <span style={{ color: "#6aaeff", fontWeight: 700 }}>{s.id}</span>,
          s.user,
          s.start_time,
          s.end_time || "-",
          s.open_cash + " ر.س",
          <span style={{ color: "#3a9aff", fontWeight: 700 }}>
            {(s.sales || 0).toFixed(2)} ر.س
          </span>,
          s.close_cash ? s.close_cash + " ر.س" : "-",
          s.end_time ? (
            <Badge color="#0a2a10" text="#44dd88">
              مغلق
            </Badge>
          ) : (
            <Badge color="#0a2a1a" text="#44ffaa">
              مفتوح
            </Badge>
          ),
        ])}
      />
    </div>
  );
}
