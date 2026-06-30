import { QRCodeSVG } from "qrcode.react";
import { COLORS, tint } from "./theme";
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
        background: "rgba(11,38,34,0.35)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 18,
          width: wide ? "92vw" : "580px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(11,38,34,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              color: COLORS.textPrimary,
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "none",
              color: COLORS.textDim,
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
        type === "error" ? COLORS.redSoft : type === "warn" ? COLORS.goldSoft : COLORS.greenSoft,
      border: `1px solid ${
        type === "error" ? COLORS.red : type === "warn" ? COLORS.gold : COLORS.green
      }`,
      borderRadius: 12,
      padding: "13px 28px",
      color:
        type === "error" ? COLORS.red : type === "warn" ? COLORS.gold : COLORS.green,
      fontSize: 15,
      fontWeight: 700,
      boxShadow: "0 10px 30px rgba(11,38,34,0.12)",
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
    primary: COLORS.accent,
    danger: COLORS.redSoft,
    success: COLORS.greenSoft,
    ghost: "transparent",
    secondary: COLORS.surfaceAlt,
  };
  const cl = {
    primary: COLORS.accentText,
    danger: COLORS.red,
    success: COLORS.green,
    ghost: COLORS.textDim,
    secondary: COLORS.textPrimary,
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
            ? COLORS.border
            : variant === "danger"
            ? COLORS.red
            : variant === "success"
            ? COLORS.green
            : variant === "primary"
            ? COLORS.accent
            : COLORS.border
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
      <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>
        {label}
        {required && <span style={{ color: COLORS.red }}> *</span>}
      </label>
    )}
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "9px 12px",
        color: COLORS.textPrimary,
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
      <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>
        {label}
      </label>
    )}
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "9px 12px",
        color: COLORS.textPrimary,
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

const Badge = ({ children, color = COLORS.blueSoft, text = COLORS.blue }) => (
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
      background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${COLORS.border}`,
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
        background: color + "1F",
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
          color: COLORS.textPrimary,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ color: COLORS.textDim, fontSize: 12, marginTop: 4 }}>
        {label}
      </div>
      {sub && (
        <div style={{ color: COLORS.green, fontSize: 11, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  </div>
);

const Table = ({ headers, rows, emptyMsg = "لا توجد بيانات" }) => (
  <div
    style={{
      background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      border: `1px solid ${COLORS.border}`,
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
            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${COLORS.border}` }}
          >
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "11px 16px",
                  textAlign: "right",
                  color: COLORS.textDim,
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
                  color: COLORS.textDim,
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
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                  transition: "background 0.1s",
                }}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: "11px 16px",
                      fontSize: 13,
                      color: COLORS.textPrimary,
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
  const ref = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const keyCount = useRef<number>(0);
  const scanTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleScan = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

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
    keyCount.current = 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setVal(newVal);

    const now = Date.now();
    const timeDiff = now - lastKeyTime.current;
    lastKeyTime.current = now;

    // لو الفرق بين ضغطتين أقل من 100ms → scanner حقيقي
    if (timeDiff < 100) {
      keyCount.current += 1;
    } else {
      keyCount.current = 1;
    }

    // لو اتكتبت 4 حروف أو أكثر بسرعة → امسح تلقائياً بعد 50ms
    if (keyCount.current >= 4) {
      if (scanTimer.current) clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => {
        if (newVal.trim()) handleScan(newVal);
      }, 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (scanTimer.current) clearTimeout(scanTimer.current);
      if (val.trim()) handleScan(val);
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", gap: 8, alignItems: "center" }}>
      <IC n="barcode" s={18} style={{ position: "absolute", right: 10, color: COLORS.textDim }} />
      <input
        ref={ref}
        value={val}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        style={{
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: "9px 12px 9px 40px",
          color: COLORS.textPrimary,
          fontSize: 14,
          outline: "none",
          width: "100%",
          boxSizing: "border-box" as any,
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
        background: COLORS.appBg,
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
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          padding: 40,
          width: 380,
          boxShadow: "0 20px 60px rgba(11,38,34,0.12)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: COLORS.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: COLORS.accentText,
            }}
          >
            <IC n="pill" s={32} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: COLORS.textPrimary,
            }}
          >
            صيدلية برو
          </h1>
          <p style={{ margin: "6px 0 0", color: COLORS.textDim, fontSize: 13 }}>
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
              style={{ color: COLORS.red, fontSize: 13, textAlign: "center" }}
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
            color: COLORS.textDim,
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
    // الفورمات المدعوم: (01)XXXXXX(21)XXXX(10)XXXX(17)XXXXXX
    // نفك الأقواس ونحوّل لمصفوفة [ai, value]
    const bracketFormat = /\((\d{2,4})\)([^(]*)/g;
    let match;
    let foundAny = false;

    while ((match = bracketFormat.exec(raw)) !== null) {
      foundAny = true;
      const ai = match[1];
      const value = match[2].trim();

      if (ai === "01") {
        // GTIN-14: 14 رقم
        result.gtin = value.substring(0, 14);
      } else if (ai === "17") {
        // تاريخ الصلاحية YYMMDD
        const d = value.substring(0, 6);
        result.expiry = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
      } else if (ai === "10") {
        result.batch = value;
      } else if (ai === "21") {
        result.serial = value;
      }
    }

    // fallback: GS1 DataMatrix SFDA format
    if (!foundAny) {
      const s = raw.replace(/[]/g, "");
      let i = 0;
      const FIXED: Record<string, number> = {
        "00": 18, "01": 14, "02": 14,
        "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6,
        "20": 2,
      };
      const varEnd = (from: number): number => {
        for (let j = from; j < s.length - 1; j++) {
          if (s[j] === "") return j;
          const a = s.substring(j, j + 2);
          if (["17","10","21","01","11","00"].includes(a) && j > from) return j;
        }
        return s.length;
      };
      while (i < s.length) {
        if (s[i] === "") { i++; continue; }
        const ai = s.substring(i, i + 2);
        if (ai === "01") {
          result.gtin = s.substring(i + 2, i + 16);
          i += 16;
        } else if (ai === "17") {
          const d = s.substring(i + 2, i + 8);
          result.expiry = `20${d.slice(0,2)}-${d.slice(2,4)}-${d.slice(4,6)}`;
          i += 8;
        } else if (ai === "10") {
          const end = varEnd(i + 2);
          result.batch = s.substring(i + 2, end).trim();
          i = end;
        } else if (ai === "21") {
          const end = varEnd(i + 2);
          result.serial = s.substring(i + 2, end).trim();
          i = end;
        } else if (FIXED[ai] !== undefined) {
          i += 2 + FIXED[ai];
        } else { i++; }
      }
    }
  } catch (e) {
    console.error("GS1 parse error:", e);
  }

  return result;
}
// ==================== PHARMACY SHELF BACKGROUND ====================
// خلفية موحّدة (رفوف + علب أدوية + بلور) — تُستخدم مرة واحدة في الـ wrapper
// الرئيسي عشان تظهر تلقائيًا خلف كل التابات بدون أي تكرار في كل صفحة.
const SHELF_BOX_COLORS = [
  "#5bc8b0", "#ff9eb5", "#7ec8e3", "#ffd166", "#a8e6cf", "#ff8b94", "#a29bfe",
  "#74b9ff", "#55efc4", "#fd79a8", "#fdcb6e", "#6c5ce7", "#00cec9", "#e17055",
  "#81ecec", "#fab1a0", "#ffeaa7", "#dfe6e9", "#ff7675", "#00b894", "#e84393",
  "#0984e3",
];

function makeShelfRow(rowIndex: number, topPct: number, count: number) {
  const boxes = [];
  const startLeft = 1 + (rowIndex % 2);
  const step = (96 - startLeft) / count;
  for (let i = 0; i < count; i++) {
    const color = SHELF_BOX_COLORS[(rowIndex * 7 + i) % SHELF_BOX_COLORS.length];
    const width = 20 + ((i * 5 + rowIndex * 3) % 16);
    const height = width + 10 + ((i + rowIndex) % 5);
    const left = startLeft + i * step;
    const topJitter = (i % 3) * 1;
    boxes.push(
      <div
        key={`shelf-box-${rowIndex}-${i}`}
        style={{
          position: "absolute",
          width,
          height,
          background: color,
          borderRadius: 4,
          boxShadow: "2px 2px 6px rgba(0,0,0,0.12)",
          top: `${topPct + topJitter}%`,
          left: `${left}%`,
        }}
      />
    );
  }
  return boxes;
}

function PharmacyShelfBackground() {
  const shelfTops = [18, 36, 54, 72];
  const boxRowTops = [10, 28, 46, 64];
  const supportLefts = [16, 33, 50, 67, 84];
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        background: "linear-gradient(180deg, #e8f5f3 0%, #d4eeea 40%, #c8e8e3 100%)",
      }}
    >
      {/* الجدار الخلفي */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 58px, rgba(0,160,140,0.08) 58px, rgba(0,160,140,0.08) 62px)",
        }}
      />

      {/* الأعمدة الرأسية */}
      {supportLefts.map((left, i) => (
        <div
          key={`support-${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 5,
            left: `${left}%`,
            background: "linear-gradient(180deg, #9dccc6, #6fb0aa)",
            borderRadius: 3,
          }}
        />
      ))}

      {/* الرفوف */}
      {shelfTops.map((top, i) => (
        <div
          key={`shelf-${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            top: `${top}%`,
            background: "linear-gradient(90deg, #a8d5cf, #7bbfb8, #a8d5cf)",
            borderRadius: 2,
            boxShadow: "0 3px 8px rgba(0,100,90,0.15)",
          }}
        />
      ))}

      {/* علب الأدوية */}
      {boxRowTops.map((top, i) => makeShelfRow(i, top, 29))}

      {/* طبقة ضبابية فوق الرفوف */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          background: "rgba(232,245,243,0.55)",
        }}
      />
    </div>
  );
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
  const [posPromos, setPosPromos] = useState([]);
  const [posDiscountRules, setPosDiscountRules] = useState([
    { days: 90,  discount: 50, color: COLORS.red },
    { days: 120, discount: 25, color: COLORS.coral },
    { days: 150, discount: 20, color: COLORS.gold },
    { days: 180, discount: 15, color: COLORS.gold },
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
    background: COLORS.appBg,
    flexDirection: "column",
    gap: 16,
    fontFamily: "'Tajawal',sans-serif",
  }}>
    <div style={{
      width: 56,
      height: 56,
      borderRadius: 16,
      background: COLORS.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLORS.accentText,
    }}>
      <IC n="pill" s={28} />
    </div>
    <div style={{ color: COLORS.textDim, fontSize: 15 }}>
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

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal',sans-serif",
        position: "relative",
        minHeight: "100vh",
        color: COLORS.textPrimary,
        display: "flex",
      }}
    >
      <PharmacyShelfBackground />
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
        rel="stylesheet"
      />
      {toast && <Toast {...toast} />}

      {/* SIDEBAR */}
      <nav
  style={{
    width: 210,
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderLeft: "1px solid rgba(0,180,160,0.15)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    zIndex: 1,
    top: 0,
    height: "100vh",
    overflowY: "auto",
    borderRight: `1px solid ${COLORS.border}`,
  }}
>
        <div
          style={{
            padding: "20px 16px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: COLORS.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.accentText,
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
                  color: COLORS.textPrimary,
                  lineHeight: 1.2,
                }}
              >
                صيدلية برو
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>نظام متكامل</div>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "8px 10px",
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                  color: COLORS.textPrimary,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {currentUser.name}
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>
                {currentUser.role === "admin" ? "مدير" : "صيدلاني"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "8px 0" }}>
  {(() => {
  const GROUP_COLORS = {
    team:     COLORS.green,
    sales:    COLORS.blue,
    stock:    COLORS.coral,
    reports:  COLORS.purple,
    admin:    COLORS.gold,
    main:     COLORS.accent,
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
              color: isActive ? group.color : COLORS.textDim,
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
                borderRadius: 99, background: COLORS.redSoft, color: COLORS.red,
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

        <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.border}` }}>
          {currentShift ? (
            <div
              style={{
                background: COLORS.greenSoft,
                border: `1px solid ${COLORS.green}`,
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 10,
                color: COLORS.green,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 700 }}>شفت مفتوح</div>
              <div style={{ color: COLORS.green, opacity: 0.8 }}>{currentShift.start}</div>
            </div>
          ) : (
            <div
              style={{
                background: COLORS.goldSoft,
                border: `1px solid ${COLORS.gold}`,
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 10,
                color: COLORS.gold,
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
              background: COLORS.redSoft,
              border: `1px solid ${COLORS.red}`,
              borderRadius: 8,
              color: COLORS.red,
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
  background: `linear-gradient(to bottom, transparent, ${COLORS.border} 20%, ${COLORS.accent} 50%, ${COLORS.border} 80%, transparent)`,
  flexShrink: 0,
  opacity: 0.5,
}} />

      {/* MAIN CONTENT */}
      {tab === "pharmacy_settings" && (
        <PharmacySettings showToast={showToast}
          pharmacyId={pharmacyId}
          />
      )}
      <main
        style={{ flex: 1, overflow: "auto", padding: 24, minHeight: "100vh", position: "relative", zIndex: 1 }}
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
            promos={posPromos}
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
  pharmacyId,
  setTab,
  creditPayments = [],
  treasuryEntries = [],
  promos = [],
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
const [myTarget, setMyTarget] = useState(null);

  useEffect(() => {
    if (!pharmacyId || !currentUser?.name) return;
    supabase
      .from("monthly_targets")
      .select("target_amount")
      .eq("pharmacy_id", pharmacyId)
      .eq("pharmacist_name", currentUser.name)
      .eq("month", monthKey)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error(error); setMyTarget(0); return; }
        setMyTarget(data?.target_amount || 0);
      });
  }, [pharmacyId, currentUser?.name, monthKey]);

  const myMonthSales = sales.filter(
    (s) => (s.created_at || s.date || "").startsWith(monthKey) &&
           !s.returned &&
           s.cashier_name === currentUser?.name
  );
  const myAchieved = myMonthSales.reduce((a, s) => a + (s.total || 0), 0);

  const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const daysLeftInMonth = lastDayOfMonth - new Date().getDate();

  const targetProgress = myTarget > 0 ? Math.min((myAchieved / myTarget) * 100, 100) : 0;
  const targetRemaining = Math.max((myTarget || 0) - myAchieved, 0);
  const requiredDaily = daysLeftInMonth > 0 ? targetRemaining / daysLeftInMonth : targetRemaining;
  // ── حسابات المبيعات ──
  const todaySales    = sales.filter((s) => s.date === today && !s.returned);
  const todayCashSales = todaySales.filter((s) => s.payment !== "آجل" && s.payment !== "تحصيل آجل");
  const todayCreditPaid = creditPayments.filter((p) => p.date === today).reduce((a, p) => a + p.amount, 0);
  const todayReturnsForDash = sales
  .filter((s) => s.returned && s.returnDate === today)
  .reduce((a, s) => a + (s.total || 0), 0);
  const monthReturnsForDash = sales
  .filter((s) => s.returned && s.returnDate?.startsWith(monthKey))
  .reduce((a, s) => a + (s.total || 0), 0);
  const todayRev = todayCashSales.reduce((a, s) => a + s.total, 0);
  const todayAjilTotal = todaySales.filter((s) => s.payment === "آجل").reduce((a, s) => a + s.total, 0);
  const todayAvgInvoice = todayCashSales.length > 0 ? todayRev / todayCashSales.length : 0;

  // ── مبيعات الشبكة اليوم (فواتير بطاقة كاملة + جزء الكارت من الفواتير المختلطة) ──
  const todayNetworkSales = todaySales.reduce((a, s) => {
    if (s.payment === "بطاقة") return a + (s.total || 0);
    if (s.payment === "مختلط" && s.payment_split) return a + (s.payment_split.card || 0);
    return a;
  }, 0);
  // مبيعات الكاش الصافية لعرض منفصل عن الشبكة في كارت خزنة اليوم (todayRev يبقى الإجمالي الشامل ويُستخدم في "صافي اليوم")
  const todayCashOnlySales = todayRev - todayNetworkSales;

  // ── النثريات المسجّلة اليوم من سجل الخزنة ──
  const todayPettyExpenses = (treasuryEntries || [])
    .filter((e) => e.date === today && e.type === "expense" && e.sub_type === "petty")
    .reduce((a, e) => a + (e.amount || 0), 0);

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
    { key: "essential",  icon: "💊", label: "نفاذ/قرب نفاذ دواء أساسي", count: alerts.length,                 color: COLORS.red, tab: "products" },
    { key: "lowstock",   icon: "📦", label: "مخزون منخفض",              count: lowStock.length,               color: COLORS.gold, tab: "products" },
    { key: "expiry",     icon: "⏰", label: "أصناف قرب الانتهاء",        count: expiringSoon.length,           color: COLORS.gold, tab: "products" },
    { key: "supplier",   icon: "🧾", label: "استحقاق مورد قريب/متأخر",   count: supplierDues.length,           color: COLORS.red, tab: "suppliers" },
    { key: "newcust",    icon: "🆕", label: "عملاء جدد هذا الأسبوع",     count: newCustomers.length,           color: COLORS.green, tab: "customers" },
    { key: "lostcust",   icon: "👻", label: "عملاء مختفون",              count: disappearedCustomers.length,   color: COLORS.textDim, tab: "customers" },
    { key: "tax",        icon: "🗂️", label: "موعد الإقرار الضريبي الربعي", count: taxDeadlineInfo.daysLeft <= 14 ? 1 : 0, color: COLORS.gold, tab: "tax_report" },
    { key: "appoint",    icon: "📅", label: "مواعيد مهمة (رخصة/إيجار)",  count: 2,                              color: COLORS.green, tab: "dashboard" },
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
  const currentShift = shifts?.find((s) => !s.end_time && s.user === currentUser?.name) || null;
  const shiftSales   = currentShift
    ? sales.filter((s) => s.shift === currentShift.id && !s.returned)
    : [];
  const shiftReturns = currentShift
    ? sales.filter((s) => s.shift === currentShift.id && s.returned)
    : [];
  const shiftReturnsTotal = shiftReturns.reduce((a, s) => a + (s.total || 0), 0);
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
    bg:       COLORS.appBg,
    surface:  COLORS.surface,
    surface2: COLORS.surfaceAlt,
    border:   COLORS.border,
    accent:   COLORS.accent,
    accent2:  COLORS.blue,
    warn:     COLORS.gold,
    danger:   COLORS.red,
    text:     COLORS.textPrimary,
    muted:    COLORS.textDim,
  };

  const card = {
    background: VAR.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                  <tr key={m.mk} style={{ borderBottom: `1px solid ${VAR.border}`, background: m.mk === monthKey ? COLORS.tealSoft : "transparent" }}>
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
    const returns    = isToday ? todayReturnsForDash : monthReturnsForDash;
    const returnsCnt = isToday
      ? sales.filter((s) => s.returned && s.returnDate === today).length
      : sales.filter((s) => s.returned && s.returnDate?.startsWith(monthKey)).length;

    return (
      <>
        {/* 5 stat cells — كل كارت دلالي بخلفية Soft Tint من لونه */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, padding: "14px 16px" }}>
          {[
            { label: "إجمالي المبيعات", val: rev.toFixed(0) + " ر.س", color: VAR.accent, sub: `${invoices.length} فاتورة` },
            { label: "سداد الآجل",      val: creditPaid.toFixed(0) + " ر.س", color: VAR.accent2, sub: `مديونية ${ajilTotal.toFixed(0)}` },
            { label: "مرتجع المبيعات",  val: returns.toFixed(0) + " ر.س", color: VAR.danger, sub: `${returnsCnt} فاتورة مرتجعة` },
            { label: "الفرص الضائعة",   val: missed.toFixed(0) + " ر.س", color: VAR.warn, sub: `${missedCnt} صنف مفقود` },
            { label: "متوسط الفاتورة",  val: avgInv.toFixed(1) + " ر.س", color: VAR.text, sub: "ريال", neutral: true },
          ].map((cell, i) => (
            <div
              key={i}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: cell.neutral ? VAR.surface2 : tint(cell.color, 0.08),
                border: `1px solid ${cell.neutral ? VAR.border : tint(cell.color, 0.3)}`,
              }}
            >
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

  // ══════════ كارت العروض المتوفرة ══════════
  const activePromos = (promos || []).filter((p) => {
    if (!p.end_date) return false;
    return p.end_date >= today;
  });
  const autoPromoProducts = products.filter((p) => {
    if (!p.expiry_date) return false;
    const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
    return daysLeft > 0 && daysLeft <= 90 && (p.stock ?? 0) > 0;
  });

  // ══════════ كارت تغيير الأسعار ══════════
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recentPriceChanges = (() => {
    const changes: any[] = [];
    const recentPurchases = (purchases || [])
      .filter((po) => po.date >= oneWeekAgo)
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
    const seen = new Set<string>();
    recentPurchases.forEach((po: any) => {
      (po.items || []).forEach((item: any) => {
        if (seen.has(item.id)) return;
        const prod = products.find((p) => p.id === item.id);
        if (!prod) return;
        const newPrice = item.salePrice || item.newSalePrice;
        const oldPrice = prod.price;
        if (!newPrice || !oldPrice) return;
        const diff = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
        if (Math.abs(diff) >= 1) {
          seen.add(item.id);
          changes.push({ name: prod.name_ar || prod.name || item.name || "", oldPrice, newPrice, date: po.date, diff });
        }
      });
    });
    return changes.slice(0, 15);
  })();

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
              background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`,
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
            <div style={{ display: "flex", background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 2, gap: 2 }}>
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
  {myTarget === null ? (
    <div style={{ color: VAR.muted, fontSize: 12 }}>جاري التحميل...</div>
  ) : myTarget === 0 ? (
    <div style={{ color: VAR.muted, fontSize: 12 }}>لم يتم تحديد تارجت لك هذا الشهر</div>
  ) : (
    <>
      <div>
        <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: VAR.accent, lineHeight: 1 }}>
          {S(`${targetProgress.toFixed(0)}%`)}
        </div>
        <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>
          {S(`من ${myTarget.toLocaleString()} ريال`)}
        </div>
      </div>
      <div style={{ height: 6, background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${targetProgress}%`, borderRadius: 99,
          background: `linear-gradient(90deg, ${VAR.accent2}, ${VAR.accent})`,
          boxShadow: "0 0 8px rgba(0,200,150,0.4)",
        }} />
      </div>
      <div style={{ fontSize: 11, color: VAR.muted }}>
        متبقي <strong style={{ color: VAR.warn }}>{S(`${targetRemaining.toFixed(0)} ريال`)}</strong> في {daysLeftInMonth} يوم
      </div>
      <div style={{ borderTop: `1px solid ${VAR.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: VAR.muted, marginBottom: 4 }}>المطلوب يومياً</div>
        <div style={{ fontFamily: "monospace", fontSize: 22, color: VAR.warn, fontWeight: 700 }}>
          {S(requiredDaily.toFixed(0))} <span style={{ fontSize: 12, color: VAR.muted }}>ريال</span>
        </div>
      </div>
    </>
  )}
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
                  : intensity > 0.33 ? VAR.accent2
                  : COLORS.teal;
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

      {/* ── ROW 3: العروض + تغيير الأسعار ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12, marginTop: 20 }}>
        العروض وتحديثات الأسعار
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>

        {/* كارت العروض */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${VAR.border}` }}>
            <span style={{ fontSize: 16 }}>🏷️</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: VAR.accent }}>العروض المتوفرة</span>
            <span style={{ marginRight: "auto", background: VAR.accent, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 8px", fontWeight: 700 }}>
              {activePromos.length + autoPromoProducts.length}
            </span>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {activePromos.length === 0 && autoPromoProducts.length === 0 && (
              <div style={{ padding: "20px 14px", color: VAR.muted, fontSize: 12, textAlign: "center" }}>لا توجد عروض نشطة</div>
            )}
            {/* العروض اليدوية */}
            {activePromos.map((p) => {
              const prod = products.find((x) => x.id === p.product_id);
              const name = prod?.name_ar || prod?.name || p.product_id;
              const discPrice = prod ? Math.round(prod.price * (1 - p.discount / 100) * 100) / 100 : null;
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{name}</div>
                    <div style={{ fontSize: 10, color: VAR.muted }}>ينتهي {p.end_date}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <span style={{ background: COLORS.redSoft || "#fde8e8", color: COLORS.red, borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                      {p.discount}% خصم
                    </span>
                    {discPrice && <div style={{ fontSize: 10, color: VAR.muted, marginTop: 2 }}>السعر: {discPrice} ر.س</div>}
                  </div>
                </div>
              );
            })}
            {/* العروض التلقائية (قرب الصلاحية) */}
            {autoPromoProducts.map((p) => {
              const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{p.name_ar || p.name}</div>
                    <div style={{ fontSize: 10, color: COLORS.gold }}>⏳ صلاحية: {daysLeft} يوم · مخزون: {p.stock}</div>
                  </div>
                  <span style={{ background: COLORS.goldSoft || "#fef3c7", color: COLORS.gold, borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                    تلقائي
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* كارت تغيير الأسعار */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${VAR.border}` }}>
            <span style={{ fontSize: 16 }}>💰</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: VAR.accent2 }}>تغيرات الأسعار</span>
            <span style={{ fontSize: 10, color: VAR.muted, marginRight: "auto" }}>آخر 7 أيام</span>
            <span style={{ background: VAR.accent2, color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 8px", fontWeight: 700 }}>
              {recentPriceChanges.length}
            </span>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {recentPriceChanges.length === 0 && (
              <div style={{ padding: "20px 14px", color: VAR.muted, fontSize: 12, textAlign: "center" }}>لا توجد تغيرات في الأسعار هذا الأسبوع</div>
            )}
            {recentPriceChanges.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: VAR.muted }}>{c.date} · {c.oldPrice} ← {c.newPrice} ر.س</div>
                </div>
                <span style={{
                  background: c.diff > 0 ? (COLORS.redSoft || "#fde8e8") : (COLORS.greenSoft || "#d1fae5"),
                  color: c.diff > 0 ? COLORS.red : COLORS.green,
                  borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700,
                }}>
                  {c.diff > 0 ? "▲" : "▼"} {Math.abs(c.diff)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 4: الشفت الحالي + الخزنة + إجراءات سريعة ── */}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 1, background: VAR.border }}>
            {[
              { label: "فواتير الشفت",           val: shiftSales.length },
              { label: "متوسط الأصناف/فاتورة",   val: avgItemsPerInvoice },
              { label: "عملاء مسجلين",            val: shiftSales.filter((s) => s.customer_id).length + " / " + shiftSales.length },
              { label: "مبيعات الشفت",            val: S(shiftSales.reduce((a, s) => a + s.total, 0).toFixed(0) + " ر.س") },
              { label: "مرتجع الشفت",             val: S(shiftReturnsTotal.toFixed(0) + " ر.س"), color: VAR.danger },
            ].map((stat, i) => (
              <div key={i} style={{ background: VAR.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: VAR.muted }}>{stat.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: stat.color || VAR.text, marginTop: 2 }}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* خزنة اليوم */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, color: VAR.muted, fontWeight: 600, marginBottom: 12 }}>خزنة اليوم</div>
          {[
            { label: "مبيعات كاش",    val: todayCashOnlySales.toFixed(0), type: "in" },
            { label: "شبكة / صراف",   val: todayNetworkSales.toFixed(0),  type: "in" },
            { label: "سداد الآجل",    val: todayCreditPaid.toFixed(0),    type: "in" },
            { label: "مصاريف نثرية",  val: todayPettyExpenses.toFixed(0), type: "out" },
            { label: "مرتجعات",       val: todayReturnsForDash.toFixed(0), type: "out" },
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
              + {S((todayRev + todayCreditPaid - todayReturnsForDash - todayPettyExpenses).toFixed(0))}
            </span>
          </div>
        </div>

        {/* إجراءات سريعة */}
        <div style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: VAR.muted, marginBottom: 2 }}>إجراءات سريعة</div>
          {[
            { icon: "💊", label: "فاتورة بيع جديدة",  tab: "pos",       bg: "rgba(0,200,150,0.15)" },
            { icon: "📦", label: "استلام مشتريات",     tab: "purchase",  bg: "rgba(59,130,246,0.15)" },
            { icon: "🔄", label: "تسجيل مرتجع",        tab: "returns",   bg: "rgba(245,158,11,0.15)" },
            { icon: "🔒", label: "تقفيل الشفت",         tab: "shift",     bg: "rgba(239,68,68,0.15)" },
          ].map((btn) => (
            <button
              key={btn.tab}
              onClick={() => setTab(btn.tab)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`,
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
}

//   ==================== FIFO Helper ====================
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
const CART_ROW_HEIGHT = 49; // ارتفاع تقريبي لكل صف في جدول السلة
const CART_VISIBLE_ROWS = 5; // 🔧 CHANGED: عدد الأصناف الظاهرة قبل ظهور السكرول
const CART_HEADER_HEIGHT = 34; // ارتفاع رأس الجدول (thead)
const CART_AREA_HEIGHT = CART_HEADER_HEIGHT + CART_ROW_HEIGHT * CART_VISIBLE_ROWS; // 🔧 CHANGED

const emptyInvoice = () => ({
  cart: [],
  selCustomer: null,
  payment: "نقدي",
  paymentMode: "single",
  splitPayment: { card: 0, transfer: 0 },
  discount: 0,
  discountType: "percent",
  prescriptionImg: null,
  search: "",
  success: false,
  showJoker: false,
  jokerName: "",
  jokerPrice: "",
  openedAt: Date.now(),
});

// ==================== EFFECTIVE PRICE (عروض تلقائية + يدوية) ====================
function getEffectivePrice(product, promos, discountRules, productEarliestExpiry) {
  const today = new Date().toISOString().split("T")[0];
  // 1. عروض يدوية نشطة
  const manualPromo = (promos || []).find(
    (p) =>
      p.product_id === product.id &&
      p.start_date <= today &&
      p.end_date >= today
  );
  if (manualPromo) {
    return {
      price: +(product.price * (1 - manualPromo.discount / 100)).toFixed(2),
      discountPct: manualPromo.discount,
      source: "manual",
    };
  }
  // 2. عروض تلقائية (غير دواء + صلاحية قريبة)
  const cat = product.main_category || product.category || "";
  if (cat !== "دواء") {
    const expiry = (productEarliestExpiry || {})[product.id] || product.expiry || null;
    const autoPct = calcAutoDiscount(expiry, discountRules);
    if (autoPct > 0) {
      return {
        price: +(product.price * (1 - autoPct / 100)).toFixed(2),
        discountPct: autoPct,
        source: "auto",
      };
    }
  }
  // 3. السعر الأصلي
  return { price: product.price, discountPct: 0, source: null };
}

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
      if (ex.qty + 1 > (prod?.stock || 99)) {
        showToast("لا يوجد مخزون كافٍ", "error");
        return prev;
      }
      return {
        ...prev,
        cart: prev.cart.map((i) =>
          i.id === p.id ? { ...i, qty: i.qty + 1 } : i
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
                background: activeTab === i ? COLORS.blueSoft : "#0a0f1c",
                border: `1px solid ${activeTab === i ? COLORS.blue : COLORS.border}`,
                borderLeft: "none",
                color: activeTab === i ? COLORS.blue : COLORS.textDim,
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
                background: activeTab === i ? COLORS.blueSoft : "#0a0f1c",
                border: `1px solid ${activeTab === i ? COLORS.blue : COLORS.border}`,
                color: COLORS.red,
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
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "1px dashed #1d3a5a",
              color: COLORS.border,
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
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: COLORS.textPrimary,
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
                background: COLORS.goldSoft,
                border: "1px solid #7a4a00",
                color: COLORS.gold,
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
                    color: COLORS.gold,
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
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: COLORS.textPrimary,
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
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid #1d2d4a",
                    borderRadius: 7,
                    padding: "7px 10px",
                    color: COLORS.textPrimary,
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
                      background: COLORS.goldSoft,
                      border: "1px solid #7a4a00",
                      borderRadius: 7,
                      color: COLORS.gold,
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
                      color: COLORS.textDim,
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
                  background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                    color: COLORS.textDim,
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
                    ? COLORS.gold
                    : COLORS.green;
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
                          idx === highlightedIdx ? COLORS.surfaceAlt : "transparent",
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
                              color: COLORS.textPrimary,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {p.nameAr || p.name}
                          </div>
                          <div style={{ fontSize: 10, color: COLORS.textDim }}>
                            {p.mainCategory || p.category} · مخزون: {p.stock}
                            {p.saleUnits > 1 && (
                              <span style={{ color: COLORS.gold }}>
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
                              background: COLORS.goldSoft,
                              border: "1px solid #7a4a00",
                              color: COLORS.gold,
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
                                background: COLORS.blueSoft,
                                border: "1px solid #2a6aef",
                                color: COLORS.blue,
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
                                    <span style={{ textDecoration: "line-through", color: COLORS.textDim, fontSize: 10, marginLeft: 4 }}>{p.price?.toFixed(2)}</span>
                                    <span style={{ color: COLORS.green }}> {eff.price?.toFixed(2)} ر.س</span>
                                    <span style={{ background: COLORS.coral, color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 10, marginRight: 4 }}>-{eff.discountPct}%</span>
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
                      color: COLORS.textDim,
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${inv.selCustomer ? COLORS.blue : COLORS.border}`,
                borderRadius: 8,
                padding: "7px 10px",
                color: COLORS.textPrimary,
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
                  color: COLORS.red,
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
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                    color: COLORS.textDim,
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>
                          {c.name}
                        </div>
                        {(c.phone || c.taxId) && (
                          <div style={{ fontSize: 11, color: COLORS.textDim }}>
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
                          color: COLORS.red,
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
                  <div style={{ padding: 12, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>
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
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "1px dashed #1d3a5a",
              borderRadius: 8,
              color: inv.prescriptionImg ? COLORS.green : COLORS.textDim,
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
                color: COLORS.surfaceAlt,
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
                        color: COLORS.textDim,
                        fontSize: 12,
                        fontWeight: 600,
                        position: "sticky",
                        top: 0,
                        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}</div>
          {item.discountPct > 0 && (
            <div style={{ fontSize: 10, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ background: item.discountSource === "auto" ? COLORS.coral : COLORS.blue, color: "#fff", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>
                -{item.discountPct}% {item.discountSource === "auto" ? "⏰" : "✋"}
              </span>
              {item.originalPrice && item.originalPrice !== item.price && (
                <span style={{ textDecoration: "line-through", color: COLORS.textDim }}>{item.originalPrice?.toFixed(2)}</span>
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
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #1a2a4a", color: COLORS.textDim, fontSize: 11, outline: "none", padding: "2px 0" }}
          />
          {item.expiry && (
            <div style={{ fontSize: 10, color: COLORS.gold, marginTop: 2 }}>ينتهي: {item.expiry}</div>
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
              style={{ width: 22, height: 22, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}
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
              style={{ width: 52, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, color: COLORS.textPrimary, fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", padding: "3px 4px" }}
            />

            <button
              onClick={() => setInv((p) => ({
                ...p,
                cart: p.cart.map((i) => {
                  if (i.id !== item.id) return i;
                  const mx = products.find(x => x.id === i.id)?.stock || 99;
                  return { ...i, qty: Math.min(i.qty + 1, mx) };
                }),
              }))}
              style={{ width: 22, height: 22, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}
            >+</button>
          </div>
        </td>

        <td style={{ textAlign: "center", padding: "8px 4px", color: "#2a9aff", fontSize: 13 }}>
          {displayPrice.toFixed(2)}
        </td>
        <td style={{ textAlign: "center", padding: "8px 4px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 700 }}>
          {displayTotal.toFixed(2)}
        </td>
        <td style={{ textAlign: "center" }}>
          <button
            onClick={() => setInv((p) => ({ ...p, cart: p.cart.filter((i) => i.id !== item.id) }))}
            style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}
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
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                      inv.paymentMode === mode ? COLORS.blue : COLORS.border,
                    background:
                      inv.paymentMode === mode ? COLORS.blueSoft : "transparent",
                    color:
                      inv.paymentMode === mode ? COLORS.blue : COLORS.textDim,
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
                          inv.payment === m ? COLORS.blue : COLORS.border,
                        background:
                          inv.payment === m ? COLORS.blueSoft : "transparent",
                        color: isAjilLocked
                          ? "#2a3a4a"
                          : inv.payment === m
                          ? COLORS.blue
                          : COLORS.textDim,
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
                    <span style={{ color: COLORS.blue, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
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
                      style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 7, padding: "5px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
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
                      style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 7, padding: "5px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
                    />
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 600, width: 44, textAlign: "right" }}>
                      نقدي
                    </span>
                    <div style={{ flex: 1, background: COLORS.greenSoft, border: `1px solid ${isOverpaid ? COLORS.red : "#2a6a2a"}`, borderRadius: 7, padding: "5px 10px", color: isOverpaid ? "#dd4444" : COLORS.green, fontSize: 13, fontWeight: 700 }}>
                      {isOverpaid ? "⚠ تجاوز الإجمالي" : `${cash.toFixed(2)}`}
                    </div>
                    <span style={{ color: COLORS.textDim, fontSize: 11, width: 30 }}>ر.س</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderRadius: 6, background: isOverpaid ? COLORS.redSoft : COLORS.greenSoft, border: `1px solid ${isOverpaid ? COLORS.red : "#2a6a2a"}`, marginTop: 2 }}>
                    <span style={{ color: isOverpaid ? "#dd4444" : COLORS.green, fontSize: 12, fontWeight: 700 }}>
                      {isOverpaid ? `⚠ زيادة ${Math.abs(cash).toFixed(2)} ر.س` : "✓ الحساب مظبوط"}
                    </span>
                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>
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
              background: COLORS.greenSoft,
              border: "1px solid #1a5a30",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ color: COLORS.green, fontSize: 12, fontWeight: 700 }}>
                  🌟 نقاط متاحة: {customerLoyalty.points.toFixed(2)} ر.س
                </div>
                {usePoints && (
                  <div style={{ color: COLORS.green, fontSize: 11, marginTop: 3 }}>
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
                  background: usePoints ? COLORS.green : "transparent",
                  color: usePoints ? "#000" : COLORS.green,
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
                      inv.discountType === type ? COLORS.blueSoft : "transparent",
                    color:
                      inv.discountType === type ? COLORS.blue : COLORS.textDim,
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
            <label style={{ color: COLORS.textDim, fontSize: 12 }}>خصم</label>
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 7,
                padding: "6px 10px",
                color: COLORS.textPrimary,
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
                  color: COLORS.red,
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
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              borderRadius: 10,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, fontSize: 12, marginBottom: 4 }}>
              <span>قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 4 }}>
              <span>ضريبة 15%</span>
              <span>{taxAmount.toFixed(2)} ر.س</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 4 }}>
                <span>خصم {inv.discountType === "percent" ? `${inv.discount}%` : `${inv.discount} ر.س`}</span>
                <span>- {discountAmt.toFixed(2)} ر.س</span>
              </div>
            )}
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 4 }}>
                <span>🌟 نقاط ولاء</span>
                <span>- {pointsToRedeem.toFixed(2)} ر.س</span>
              </div>
            )}
            {missedTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 4 }}>
                <span>⚠ فرص ضائعة</span>
                <span>{missedTotal.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontSize: 18, fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 8, marginTop: 4 }}>
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
        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a",
        borderRadius: 16, padding: 24,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
              {label}
            </label>
            <input
              value={settings[key] || ""}
              onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a", borderRadius: 8,
                padding: "8px 12px", color: COLORS.textPrimary,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div></div>

        {/* حجم الملصق */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
            حجم ملصق الباركود
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {LABEL_SIZES.map((size) => (
              <button
                key={size.id}
                onClick={() => setSettings((p) => ({ ...p, labelSize: size.id }))}
                style={{
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${settings.labelSize === size.id ? COLORS.blue : COLORS.border}`,
                  background: settings.labelSize === size.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                  color: settings.labelSize === size.id ? COLORS.blue : COLORS.textDim,
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
  const [highlightedPurchIdx, setHighlightedPurchIdx] = useState(-1);
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

  const lastKeyTimePurch = useRef<number>(0);
  const keyCountPurch = useRef<number>(0);
  const scanTimerPurch = useRef<ReturnType<typeof setTimeout>>(null);

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
          (p.name_ar||p.name||"").includes(val) ||
          (p.barcode||"").includes(val) ||
          (p.id||"").includes(val)
      )
      .slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
    setHighlightedPurchIdx(-1);

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
    // فوكس على خانة الكمية للصنف المضاف
    setTimeout(() => {
      setItems((prev) => {
        const rowIndex = prev.findIndex((i) => i.id === p.id);
        if (rowIndex !== -1) {
          const qtyCell = document.getElementById(`cell-${rowIndex}-qty`) as HTMLInputElement;
          if (qtyCell) { qtyCell.focus(); qtyCell.select(); }
          else searchRef.current?.focus();
        } else {
          searchRef.current?.focus();
        }
        return prev;
      });
    }, 80);
  };

  const handleSearchKeyDown = (e) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedPurchIdx((prev) => Math.min(prev + 1, searchResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedPurchIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = highlightedPurchIdx >= 0 ? searchResults[highlightedPurchIdx] : searchResults[0];
        if (target) { addItem(target); setHighlightedPurchIdx(-1); }
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) addItem(searchResults[0]);
      else if (searchText.trim()) {
        const p = products.find(
          (x) =>
            x.barcode === searchText ||
            x.id === searchText ||
            (x.name_ar||x.name||"").includes(searchText)
        );
        if (p) addItem(p);
        else showToast("الصنف غير موجود", "error");
      }
    }
    if (e.key === "Escape") { setShowDropdown(false); setHighlightedPurchIdx(-1); }
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
    const nextCol = currentCol + 1;
    // آخر خانة (expiry_date) → خانة البحث
    if (nextCol >= cols.length) {
      searchRef.current?.focus();
      return;
    }
    document.getElementById(`cell-${rowIndex}-${cols[nextCol]}`)?.focus();
  };

  const cellStyle = {
    width: "100%",
    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
    border: "1px solid #1d2d4a",
    borderRadius: 6,
    padding: "4px 8px",
    color: COLORS.textPrimary,
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
            style={{ color: COLORS.blue, fontWeight: 700, cursor: "pointer" }}
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
          <span style={{ color: COLORS.green, fontWeight: 700 }}>
            {(p.total || 0).toFixed(2)} ر.س
          </span>,
          <Badge color={COLORS.greenSoft} text={COLORS.green}>
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

        {/* باركود سكانر منفصل */}
        <div style={{ marginBottom: 8 }}>
          <BarcodeScanner
            onScan={(scan) => {
              const code = scan.type === "gs1" ? scan.gtin : scan.code;
              const found = products.find(
                (x) => x.barcode === code || x.id === code
              );
              if (found) addItem(found);
              else showToast("الصنف غير موجود: " + code, "error");
            }}
            placeholder="امسح باركود الصنف..."
          />
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            ref={searchRef}
            placeholder="🔍 ابحث بالاسم..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{
              width: "100%",
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "1px solid #2a5a9a",
              borderRadius: 8,
              padding: "10px 14px",
              color: COLORS.textPrimary,
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
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 8,
                zIndex: 100,
                maxHeight: 240,
                overflowY: "auto",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            >
              {searchResults.map((p, idx) => {
                const outOfStock = (p.stock ?? 0) <= 0;
                const lowStock = !outOfStock && (p.stock ?? 0) <= (p.min_stock || p.minStock || 0);
                const stockColor = outOfStock ? "#dd4444" : lowStock ? COLORS.gold : COLORS.green;
                const isHighlighted = idx === highlightedPurchIdx;
                return (
                  <div
                    key={p.id}
                    onMouseDown={() => { addItem(p); setHighlightedPurchIdx(-1); }}
                    onMouseEnter={() => setHighlightedPurchIdx(idx)}
                    onMouseLeave={() => setHighlightedPurchIdx(-1)}
                    style={{
                      padding: "9px 14px",
                      cursor: "pointer",
                      background: isHighlighted ? COLORS.surfaceAlt : "transparent",
                      borderBottom: `1px solid ${COLORS.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: stockColor, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a" }}>{p.name_ar || p.name}</span>
                    </div>
                    <span style={{ color: "#2a4a3a", fontSize: 12 }}>
                      {p.barcode} | مخزون: {p.stock ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 4, overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
          >
            <thead>
              <tr style={{ background: COLORS.surfaceAlt }}>
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
                      color: COLORS.textDim,
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
                      color: COLORS.textPrimary,
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {item.name_ar || item.name}
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
                            : COLORS.border,
                        color:
                          item.newSalePrice !== item.price
                            ? "#f0c060"
                            : COLORS.textPrimary,
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
                      text={item.taxable ? COLORS.green : COLORS.textDim}
                    >
                      {item.taxable ? "15%" : "معفى"}
                    </Badge>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: COLORS.blue,
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
                        color: COLORS.red,
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
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                color: COLORS.textDim,
                marginBottom: 8,
              }}
            >
              <span>المجموع قبل الضريبة</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: COLORS.textDim, fontSize: 11 }}>
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
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: COLORS.textDim }}>ر.س</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: COLORS.green,
                marginBottom: 8,
              }}
            >
              <span>ضريبة القيمة المضافة 15%</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: COLORS.textDim, fontSize: 11 }}>
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
                    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid #1d3a6a",
                    borderRadius: 6,
                    padding: "4px 8px",
                    color: COLORS.textPrimary,
                    fontSize: 13,
                    outline: "none",
                    textAlign: "left",
                  }}
                />
                <span style={{ color: COLORS.green }}>ر.س</span>
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
                  color: COLORS.textDim,
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
                color: COLORS.textPrimary,
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
                    <span style={{ color: COLORS.textDim, fontSize: 13 }}>
                      {label}
                    </span>
                    <span
                      style={{
                        color: COLORS.textPrimary,
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
            marginBottom: 10, padding: "6px 10px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8,
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
              <span style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 600 }}>تحديد الكل</span>
            </label>
            <span style={{ color: COLORS.textDim, fontSize: 12 }}>
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
                  background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                  <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>عدد النسخ</span>
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
                      background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                      border: "1px solid #1d3a6a",
                      borderRadius: 6,
                      padding: "4px 8px",
                      color: COLORS.textPrimary,
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
                      background: COLORS.redSoft, color: COLORS.red, fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {printItems.length === 0 && (
              <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20, fontSize: 13 }}>
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
                color: COLORS.textDim,
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
                <tr style={{ background: COLORS.surfaceAlt }}>
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
                        color: COLORS.textDim,
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
                        color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid #1d2d4a",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: COLORS.textPrimary,
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        color: COLORS.blue,
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
                          color: COLORS.red,
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
              background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                      color: COLORS.textDim,
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
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: COLORS.textPrimary,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: COLORS.green,
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
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: "1px solid #1d3a6a",
                        borderRadius: 6,
                        padding: "4px 8px",
                        color: COLORS.textPrimary,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: COLORS.textPrimary,
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
          <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #2a6aef", borderRadius: 16, padding: 28, width: 320, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <h3 style={{ color: COLORS.textPrimary, margin: "0 0 8px" }}>صلاحية مدير مطلوبة</h3>
            <p style={{ color: COLORS.textDim, fontSize: 13, marginBottom: 16 }}>
              الفاتورة أقدم من 14 يوم — أدخل PIN المدير للمتابعة
            </p>
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="PIN..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a",
                borderRadius: 8, padding: "10px 14px", color: COLORS.textPrimary, fontSize: 16,
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
                style={{ flex: 1, padding: "9px 0", background: COLORS.blueSoft, border: "1px solid #2a6aef", borderRadius: 8, color: COLORS.blue, fontWeight: 700, cursor: "pointer" }}
              >
                تأكيد
              </button>
              <button
                onClick={() => { setShowPinModal(false); setAdminPin(""); }}
                style={{ padding: "9px 16px", background: "transparent", border: "1px solid #1d2d4a", borderRadius: 8, color: COLORS.textDim, cursor: "pointer" }}
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
              borderColor: type === t ? COLORS.blue : COLORS.border,
              background: type === t ? COLORS.blueSoft : "transparent",
              color: type === t ? COLORS.blue : COLORS.textDim,
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
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>
              🧾 رقم الفاتورة <span style={{ color: COLORS.red }}>*</span>
              {adminOverride && <span style={{ marginRight: 8, background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 4, padding: "1px 8px", fontSize: 11 }}>🔓 تصريح مدير</span>}
            </label>
            <input
              value={invoiceSearch}
              onChange={(e) => { setInvoiceSearch(e.target.value); setSelInvoice(null); setReturnItems([]); }}
              onFocus={() => setInvoiceSearchOpen(true)}
              onBlur={() => setTimeout(() => setInvoiceSearchOpen(false), 150)}
              placeholder="ابحث برقم الفاتورة أو اسم العميل..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${selInvoice ? COLORS.blue : COLORS.border}`,
                borderRadius: 9, padding: "11px 14px", color: COLORS.textPrimary,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {selInvoice && (
              <div style={{ marginTop: 6, padding: "6px 12px", background: COLORS.greenSoft, border: "1px solid #2a6a2a", borderRadius: 8, fontSize: 12, color: COLORS.green, display: "flex", justifyContent: "space-between" }}>
                <span>
                  ✅ {selInvoice.id} — {selInvoice.date} — {selInvoice.customer_name}
                  {" — "}
                  <strong>{selInvoice.payment === "آجل" ? "آجل (سينزل من مديونية العميل)" : "نقدي (سينزل من الخزنة)"}</strong>
                </span>
                <button onClick={() => { setSelInvoice(null); setInvoiceSearch(""); setReturnItems([]); }}
                  style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>✕</button>
              </div>
            )}
            {invoiceSearchOpen && !selInvoice && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 8,
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{inv.id}</div>
                        <div style={{ fontSize: 11, color: COLORS.textDim }}>
                          {inv.customer_name} · {inv.date} · {(inv.total || 0).toFixed(2)} ر.س
                          {inv.payment === "آجل" && <span style={{ color: COLORS.gold }}> · آجل</span>}
                        </div>
                      </div>
                      {isOld && (
                        <span style={{ fontSize: 10, background: "#2a1000", color: COLORS.gold, borderRadius: 4, padding: "2px 6px" }}>
                          {daysDiff} يوم 🔐
                        </span>
                      )}
                    </div>
                  );
                })}
                {filteredSaleInvoices.length === 0 && (
                  <div style={{ padding: 14, color: COLORS.textDim, textAlign: "center", fontSize: 13 }}>لا توجد فواتير مطابقة</div>
                )}
              </div>
            )}
          </div>

          {/* بحث عميل */}
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, display: "block" }}>👤 العميل</label>
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); if (!e.target.value) setSelCustomer(null); }}
              onFocus={() => setCustomerSearchOpen(true)}
              onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
              placeholder="ابحث بالاسم أو الجوال..."
              style={{
                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${selCustomer ? COLORS.blue : COLORS.border}`,
                borderRadius: 9, padding: "11px 14px", color: COLORS.textPrimary,
                fontSize: 14, outline: "none", boxSizing: "border-box",
              }}
            />
            {customerSearchOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, left: 0, zIndex: 200,
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 8,
                maxHeight: 200, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px #0006",
              }}>
                <div onMouseDown={() => { setSelCustomer(null); setCustomerSearch(""); setCustomerSearchOpen(false); }}
                  style={{ padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #1a2a3a", color: COLORS.textDim, fontSize: 13 }}>
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: 11, color: COLORS.textDim }}>{c.phone}</div>}
                      </div>
                      {c.credit > 0 && (
                        <span style={{ fontSize: 11, background: "#2a1010", color: COLORS.red, borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
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
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
            {selInvoice ? `أصناف فاتورة ${selInvoice.id}` : "الأصناف"}
            {!adminOverride && <span style={{ marginRight: 8, color: COLORS.gold, fontSize: 11 }}>⚠️ سيتم التحقق من الباتش والصلاحية</span>}
          </div>
          {returnItems.map((item, i) => {
            const maxReturnable = Math.max(0, (item.qty || 0) - (item.alreadyReturnedQty || 0));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #0a101a" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    {item.originalBatch && <span>باتش: {item.originalBatch}</span>}
                    {item.originalExpiry && <span style={{ marginRight: 8 }}>صلاحية: {item.originalExpiry}</span>}
                    <span style={{ marginRight: 8 }}>الكمية: {item.qty}</span>
                    {item.alreadyReturnedQty > 0 && (
                      <span style={{ marginRight: 8, color: COLORS.gold }}>سبق إرجاعه: {item.alreadyReturnedQty}</span>
                    )}
                  </div>
                </div>
                <div style={{ color: COLORS.textDim, fontSize: 12, flexShrink: 0 }}>
                  {(type === "purchases" ? item.cost || item.price : item.price).toFixed(2)} ر.س
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.max(0, x.returnQty - 1) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}>-</button>
                  <input type="number" min={0} max={maxReturnable}
                    value={item.returnQty}
                    onChange={(e) => setReturnItems((p) => p.map((x, j) => j === i ? {
                      ...x, returnQty: Math.min(Math.max(0, +e.target.value), maxReturnable)
                    } : x))}
                    style={{ width: 50, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 6px", color: COLORS.textPrimary, fontSize: 13, outline: "none", textAlign: "center" }}
                  />
                  <button onClick={() => setReturnItems((p) => p.map((x, j) => j === i ? { ...x, returnQty: Math.min(x.returnQty + 1, maxReturnable) } : x))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "none", color: COLORS.blue, cursor: "pointer", fontWeight: 700 }}>+</button>
                </div>
                {item.taxable && <Badge color="#0a2a00" text={COLORS.green}>15%</Badge>}
              </div>
            );
          })}
        </div>
      )}

      {/* الإجمالي */}
      {returnTotal > 0 && (
        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 5 }}>
            <span>قبل الضريبة</span><span>{returnSubtotal.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, marginBottom: 5 }}>
            <span>الضريبة المستردة 15%</span><span>{returnTax.toFixed(2)} ر.س</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, fontSize: 16, borderTop: "1px solid #1d2d4a", paddingTop: 8 }}>
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
          color: COLORS.textDim,
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
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: "1px solid #1d2d4a",
          borderRadius: 8,
          padding: "10px 14px",
          color: COLORS.textPrimary,
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
          color: COLORS.textPrimary,
        }}
      >
        إعدادات نظام رصد
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: COLORS.border }}>
        نظام التتبع الإلكتروني للمستحضرات الصيدلانية — هيئة الغذاء والدواء
      </p>

      {/* Status Card */}
      <div
        style={{
          background: config.enabled && connected ? "#0a2010" : COLORS.redSoft,
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
              background: config.enabled && connected ? COLORS.green : COLORS.gold,
            }}
          />
          <span
            style={{
              color: config.enabled && connected ? COLORS.green : COLORS.gold,
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
            background: config.enabled ? COLORS.blue : COLORS.border,
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
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
            color: COLORS.blue,
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
              color: COLORS.textDim,
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "10px 44px 10px 14px",
                color: COLORS.textPrimary,
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
                color: COLORS.textDim,
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
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
            color: COLORS.gold,
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
              color: COLORS.textDim,
            }}
          >
            <span style={{ color: COLORS.blue, marginTop: 1 }}>•</span>
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
  const card = (borderColor = COLORS.border) => ({
    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    border: `1px solid ${borderColor}`,
    borderRadius: 14,
    padding: 16,
  });

  const btn = (bg = COLORS.border) => ({
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
        <tr style={{ background: COLORS.surfaceAlt }}>
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
                color: COLORS.textDim,
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
                color: COLORS.textPrimary,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {p.name}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.textDim, fontSize: 11 }}>
              {p.barcode || "-"}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.coral, fontSize: 13 }}>
              {p.expiry}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13 }}>
              {p.stock}
            </td>
            <td style={{ padding: "8px 12px", color: COLORS.gold, fontSize: 13 }}>
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
              color: COLORS.red,
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
                  style={btn(COLORS.border)}
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
              <span style={{ color: COLORS.border, fontSize: 13 }}>
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
                  color: COLORS.textPrimary,
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
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
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
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                    قيمة التكلفة
                  </span>
                  <span
                    style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13 }}
                  >
                    {costTotal.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
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
                    color: COLORS.textDim,
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
                <h4 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 14 }}>
                  📋 أصناف {monthLabel}
                </h4>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700 }}
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
              color: COLORS.blue,
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
              color: l.items.some((i) => i.diff !== 0) ? COLORS.gold : COLORS.green,
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
                color: COLORS.textDim,
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
                      background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
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
                            color: COLORS.textDim,
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
                            : COLORS.surfaceAlt,
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            color: changed ? COLORS.textPrimary : COLORS.textDim,
                            fontWeight: changed ? 700 : 400,
                          }}
                        >
                          {item.name}
                          {changed && (
                            <span
                              style={{
                                marginRight: 8,
                                fontSize: 11,
                                color: item.diff < 0 ? COLORS.red : COLORS.green,
                              }}
                            >
                              {item.diff < 0 ? "▼ نقص" : "▲ زيادة"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", color: COLORS.textDim }}>
                          {item.systemQty}
                        </td>
                        <td style={{ padding: "8px 14px", color: COLORS.textPrimary }}>
                          {item.actualQty}
                        </td>
                        <td
                          style={{
                            padding: "8px 14px",
                            fontWeight: 700,
                            color:
                              item.diff < 0
                                ? COLORS.red
                                : item.diff > 0
                                ? COLORS.green
                                : COLORS.textDim,
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
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: "1px solid #1d2d4a",
            borderRadius: 8,
            padding: "9px 12px",
            color: COLORS.textPrimary,
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
              <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", position: "sticky", top: 0 }}>
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
                      color: COLORS.textDim,
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
                    background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                  }}
                >
                  <td
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {item.name}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <Badge>{item.category}</Badge>
                  </td>
                  <td style={{ padding: "8px 14px", color: COLORS.textDim }}>
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
                        background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                        border: "1px solid #1d2d4a",
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: COLORS.textPrimary,
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
                          ? COLORS.red
                          : item.actualQty - item.systemQty > 0
                          ? COLORS.green
                          : COLORS.textDim,
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
// نوع العبوة — يصف شكل التعبئة الخارجية المباعة (مستقل عن الشكل الصيدلاني)
const PACKAGE_TYPES = ["كرتونة", "كيس/باكيت", "علبة"];

const MAIN_CATEGORIES = {
  دواء: {
    sub1: ["مستورد", "محلي"],
    sub2: [
      "أقراص",
      "كبسولات",
      "شراب/معلق",
      "قطرة عين",
      "قطرة أذن",
      "قطرة أنف",
      "نقط/قطارة فم",
      "محلول موضعي",
      "كريم/مرهم/جل",
      "أمبولات/حقن",
      "تحاميل",
      "بخاخ/إسبراي",
      "محلول استنشاق",
      "لصقات",
      "أكياس",
      "لا ينطبق",
    ],
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
    mainCategory: "دواء", subCategory1: "مستورد", subCategory2: "أقراص",
    packageType: "", saleUnits: "",
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
      // السعر المخزن قبل الضريبة، نعرضه شامل الضريبة للمستخدم
      price: String(p.taxable ? Math.round((p.price * 1.15) * 100) / 100 : p.price),
      cost: String(p.cost),
      minStock: String(p.min_stock || p.minStock || ""),
      maxStock: String(p.max_stock || p.maxStock || ""),
      saleUnits: p.sale_units || p.unit_division || p.saleUnits || "",
      packageType: p.package_type || p.unit || p.packageType || "",
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
    setForm({ ...blank, id: "P" + Date.now() });
    setBarcodes([{ base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: true }]);
    setSelectedIngredients([]);
    setShowForm(true);
  };

  const addBarcode = () => setBarcodes((prev) => [...prev, { base_barcode: "", batch_number: "", serial_number: "", expiry_date: "", is_primary: false }]);
  const updateBarcode = (i, key, val) => setBarcodes((prev) => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  const removeBarcode = (i) => setBarcodes((prev) => prev.filter((_, idx) => idx !== i));

  // ── سكان GS1 وتوزيع البيانات تلقائياً ──
  const [gs1ScanVal, setGs1ScanVal] = useState("");
  const gs1Ref = useRef(null);
  const handleGs1Scan = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseGS1Barcode(trimmed);
    if (parsed.gtin) {
      // نضيف سطر جديد أو نعدّل الأول الفاضي
      const emptyIdx = barcodes.findIndex((b) => !b.base_barcode);
      const newRow = {
        base_barcode: parsed.gtin,
        batch_number: parsed.batch || "",
        serial_number: parsed.serial || "",
        expiry_date: parsed.expiry || "",
        is_primary: barcodes.length === 0 || emptyIdx === 0,
      };
      if (emptyIdx !== -1) {
        setBarcodes((prev) => prev.map((b, idx) => idx === emptyIdx ? newRow : b));
      } else {
        setBarcodes((prev) => [...prev, { ...newRow, is_primary: false }]);
      }
      setGs1ScanVal("");
      showToast(`✅ تم استخراج الباركود: ${parsed.gtin}${parsed.expiry ? " | صلاحية: " + parsed.expiry : ""}${parsed.batch ? " | تشغيلة: " + parsed.batch : ""}`, "success");
    } else {
      // مش GS1 — حطه كباركود عادي
      const emptyIdx = barcodes.findIndex((b) => !b.base_barcode);
      if (emptyIdx !== -1) {
        updateBarcode(emptyIdx, "base_barcode", trimmed);
      } else {
        setBarcodes((prev) => [...prev, { base_barcode: trimmed, batch_number: "", serial_number: "", expiry_date: "", is_primary: false }]);
      }
      setGs1ScanVal("");
      showToast("تم إضافة الباركود البسيط", "success");
    }
  };

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
      package_type: form.packageType || null,
      sale_units: form.saleUnits ? +form.saleUnits : null,
      // السعر المدخل شامل الضريبة، نحفظ السعر قبل الضريبة
      price: form.taxable ? Math.round((+form.price / 1.15) * 100) / 100 : +form.price,
      cost: +form.cost,
      taxable: form.taxable,
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

  const inputStyle = { background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };

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
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: COLORS.green };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: COLORS.blue };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: COLORS.gold };
    return             { class: "very_slow", label: "بطيء جداً", color: COLORS.red };
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
        style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="إجمالي الأصناف" value={products.length} icon="inventory" color={COLORS.blue} />
        <div onClick={() => setShowLowStock(true)} style={{ cursor: "pointer" }}>
          <StatCard label="مخزون منخفض" value={lowStockList.length} icon="alert" color={COLORS.gold} />
        </div>
        <div onClick={() => setShowSlowProducts(true)} style={{ cursor: "pointer" }}>
          <StatCard label="أصناف بطيئة" value={slowProducts.length} icon="alert" color={COLORS.red} />
        </div>
        <StatCard label="أدوية أساسية" value={products.filter((p) => p.is_essential || p.isEssential).length} icon="pill" color={COLORS.gold} />
        <StatCard label="قيمة المخزون" value={products.reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0).toFixed(0) + " ر.س"} icon="money" color={COLORS.purple} />
      </div>

      {/* ── Table ── */}
      <Table
        headers={["رمز", "الصنف", "الشركة المنتجة", "الباركود", "الفئة", "سعر البيع", "التكلفة", "أساسي", "إجراءات"]}
        rows={filtered.map((p) => {
          const mfr = manufacturers.find((m) => m.id === p.manufacturer_id);
          return [
            <span style={{ color: COLORS.textDim, fontSize: 11 }}>{p.id}</span>,
            <div>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{p.nameAr || p.name}</div>
              {p.nameEn && <div style={{ fontSize: 11, color: COLORS.textDim }}>{p.nameEn}</div>}
              <div style={{ fontSize: 10, color: COLORS.border }}>{p.active_ingredient} {p.concentration}</div>
            </div>,
            mfr ? <Badge color={COLORS.blueSoft} text={COLORS.blue}>{mfr.name}</Badge> : <span style={{ color: COLORS.border, fontSize: 11 }}>—</span>,
            <span style={{ fontSize: 11, color: COLORS.textDim, fontFamily: "monospace" }}>{p.barcode}</span>,
            <div>
              <Badge>{p.mainCategory || p.category}</Badge>
              {p.subCategory2 && <div style={{ fontSize: 10, color: COLORS.border, marginTop: 3 }}>{p.subCategory1 && p.subCategory1 + " · "}{p.subCategory2}</div>}
            </div>,
            <span style={{ color: COLORS.blue, fontWeight: 700 }}>{p.price} ر.س</span>,
            <span style={{ color: COLORS.textDim }}>{p.cost} ر.س</span>,
            (p.is_essential || p.isEssential) ? <Badge color={COLORS.goldSoft} text={COLORS.gold}>⭐ أساسي</Badge> : <span style={{ color: COLORS.textDim, fontSize: 11 }}>—</span>,
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(p.not_available_market) && (
                p.shortage_report_url
                  ? <a href={p.shortage_report_url} target="_blank" rel="noreferrer"><Badge color={COLORS.redSoft} text={COLORS.red}>🚫 غير متوفر</Badge></a>
                  : <Badge color={COLORS.redSoft} text={COLORS.red}>🚫 غير متوفر</Badge>
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
          <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف ناقصة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {lowStockList.map((p) => {
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : "#0d1a2e",
                  border: `1px solid ${isEss ? COLORS.gold : COLORS.border}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? COLORS.gold : COLORS.textPrimary, fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
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
          <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد أصناف بطيئة حاليًا 👍</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {slowProducts.map((p) => {
              const mv = getMovementClass(p.id);
              const isEss = p.is_essential || p.isEssential;
              return (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  background: isEss ? "#2a1200" : COLORS.redSoft,
                  border: `1px solid ${isEss ? COLORS.gold : COLORS.goldSoft}`,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: isEss ? COLORS.gold : COLORS.textPrimary, fontSize: 13 }}>
                      {isEss && "⭐ "}{p.nameAr || p.name}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
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
          <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20 }}>لا توجد شركات مضافة</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {manufacturers.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #0a101a" }}>
                <span style={{ color: COLORS.textPrimary, fontSize: 13 }}>{m.name}</span>
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
            <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>🏭 الشركة المنتجة</div>
            <select value={form.manufacturer_id} onChange={(e) => F("manufacturer_id", e.target.value)} style={inputStyle}>
              <option value="">— اختر الشركة —</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: COLORS.border, marginTop: 4 }}>
              لا تجد الشركة؟ <span onClick={() => setShowMfrModal(true)} style={{ color: COLORS.blue, cursor: "pointer", textDecoration: "underline" }}>أضفها من هنا</span>
            </div>
          </div>

          <Select label="نوع العبوة" value={form.packageType} onChange={(v) => F("packageType", v)} options={["", ...PACKAGE_TYPES]} />
          <Input label="عدد وحدات البيع" value={form.saleUnits} onChange={(v) => F("saleUnits", v)} type="number" placeholder="فارغ = بدون تقسيم" />
          <div style={{ fontSize: 11, color: COLORS.border, gridColumn: "1 / -1", marginTop: -6 }}>
            مثال: عبوة (نوع العبوة) فيها 20 قرص (عدد وحدات البيع) — يُستخدم لحساب سعر الوحدة وتفتيت البيع.
          </div>

          {/* ── حقل السعر مع hint الضريبة ── */}
          <div>
            <Input
              label={`سعر البيع * ${form.taxable ? "(شامل الضريبة 15%)" : ""}`}
              value={form.price}
              onChange={(v) => F("price", v)}
              type="number"
              placeholder="0.00"
            />
            {form.taxable && form.price && +form.price > 0 && (
              <div style={{ fontSize: 11, color: COLORS.green, marginTop: 4, padding: "4px 8px", background: "#0a1a0a", borderRadius: 4 }}>
                قبل الضريبة: {(+form.price / 1.15).toFixed(2)} ر.س &nbsp;·&nbsp; الضريبة: {(+form.price - +form.price / 1.15).toFixed(2)} ر.س
              </div>
            )}
          </div>

          <Input label="سعر التكلفة" value={form.cost} onChange={(v) => F("cost", v)} type="number" placeholder="0.00" />
          <Input label="الحد الأدنى للمخزون" value={form.minStock} onChange={(v) => F("minStock", v)} type="number" placeholder="10" />
          <Input label="الحد الأقصى للمخزون" value={form.maxStock} onChange={(v) => F("maxStock", v)} type="number" placeholder="100" />

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: COLORS.border, fontSize: 13, fontWeight: 600 }}>خاضع لضريبة القيمة المضافة 15%</label>
            <input type="checkbox" checked={form.taxable} onChange={(e) => F("taxable", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: COLORS.gold, fontSize: 13, fontWeight: 600 }}>⭐ دواء أساسي</label>
            <input type="checkbox" checked={form.isEssential} onChange={(e) => F("isEssential", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: "#44aaff", fontSize: 13, fontWeight: 600 }}>🔄 دواء مزمن</label>
            <input type="checkbox" checked={form.isChronic} onChange={(e) => F("isChronic", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <label style={{ color: COLORS.red, fontSize: 13, fontWeight: 600 }}>🚫 غير متوفر بالسوق السعودي</label>
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
          <div style={{ fontWeight: 700, color: COLORS.blue, marginBottom: 10, fontSize: 14 }}>🧪 المواد الفعالة</div>
          {selectedIngredients.map((ing) => (
            <div key={ing.ingredient_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 12px", color: COLORS.textPrimary, fontSize: 13 }}>{ing.name_ar}</div>
              <input value={ing.concentration} onChange={(e) => updateIngredientConc(ing.ingredient_id, e.target.value)}
                placeholder="التركيز (مثال: 500mg)"
                style={{ width: 160, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <Btn size="sm" variant="danger" onClick={() => removeIngredient(ing.ingredient_id)}>✕</Btn>
            </div>
          ))}
          <div style={{ position: "relative", marginTop: 8 }}>
            <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setShowIngredientDropdown(true); }}
              onFocus={() => setShowIngredientDropdown(true)}
              placeholder="🔍 بحث عن مادة فعالة أو إضافة جديدة..."
              style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            {showIngredientDropdown && ingredientSearch && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "#0d1a2e", border: "1px solid #1d2d4a", borderRadius: 6, zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
                {filteredIngredients.map((ing) => (
                  <div key={ing.id} onClick={() => addIngredient(ing)}
                    style={{ padding: "8px 12px", cursor: "pointer", color: COLORS.textPrimary, fontSize: 13, borderBottom: "1px solid #1d2d4a" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = COLORS.border}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    {ing.name_ar} {ing.name_en && <span style={{ color: COLORS.textDim, fontSize: 11 }}>({ing.name_en})</span>}
                  </div>
                ))}
                <div onClick={addNewIngredient}
                  style={{ padding: "8px 12px", cursor: "pointer", color: COLORS.green, fontSize: 13, fontWeight: 600 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = COLORS.border}
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
            <div style={{ fontWeight: 700, color: COLORS.blue, fontSize: 14 }}>📦 الباركودات</div>
            <Btn size="sm" icon="plus" onClick={addBarcode}>إضافة باركود</Btn>
          </div>

          {/* حقل سكان GS1 */}
          <div style={{
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px dashed ${COLORS.borderStrong}`,
            borderRadius: 8, padding: "10px 12px", marginBottom: 12,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 18 }}>📷</span>
            <input
              ref={gs1Ref}
              value={gs1ScanVal}
              onChange={(e) => setGs1ScanVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGs1Scan(gs1ScanVal); }}
              placeholder="امسح QR/باركود الدواء هنا — هيتوزع تلقائياً ↵"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: COLORS.textPrimary, fontSize: 13, fontFamily: "inherit",
              }}
              autoComplete="off"
            />
            <Btn size="sm" onClick={() => handleGs1Scan(gs1ScanVal)}>استخراج</Btn>
          </div>
          {barcodes.map((b, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input value={b.base_barcode} onChange={(e) => updateBarcode(i, "base_barcode", e.target.value)} placeholder="باركود أساسي *"
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${b.is_primary ? COLORS.blue : COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <input value={b.batch_number} onChange={(e) => updateBarcode(i, "batch_number", e.target.value)} placeholder="رقم التشغيلة"
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <input value={b.serial_number} onChange={(e) => updateBarcode(i, "serial_number", e.target.value)} placeholder="الرقم التسلسلي"
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <input value={b.expiry_date} onChange={(e) => updateBarcode(i, "expiry_date", e.target.value)} type="date"
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
              <button onClick={() => setBarcodes((prev) => prev.map((x, idx) => ({ ...x, is_primary: idx === i })))}
                style={{ padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: b.is_primary ? "#1a3a6a" : COLORS.border, color: b.is_primary ? COLORS.blue : COLORS.textDim }}>
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
    green:  { bg: "#0a2010", border: "#1a5020", text: COLORS.green, label: "منتظم" },
    orange: { bg: COLORS.goldSoft, border: "#4a3000", text: COLORS.gold, label: "تأخير بسيط" },
    red:    { bg: COLORS.redSoft, border: "#4a1010", text: COLORS.red, label: "متأخر" },
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
    if (salesDays >= 21) return { class: "fast",      label: "سريع جداً", color: COLORS.green };
    if (salesDays >= 10) return { class: "regular",   label: "منتظم",     color: COLORS.blue };
    if (salesCount >= 5) return { class: "normal",    label: "عادي",      color: "#aaaaaa" };
    if (salesCount >= 1) return { class: "slow",      label: "بطيء",      color: COLORS.gold };
    return             { class: "very_slow", label: "بطيء جداً", color: COLORS.red };
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
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${sc.border}`,
              borderRadius: 14, padding: 18, borderTop: `3px solid ${sc.text}`,
            }}>
              {/* اسم + حالة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 15 }}>{s.name}</div>
                  <div style={{ color: COLORS.border, fontSize: 11, marginTop: 2 }}>رمز: {s.id}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Badge color={sc.bg} text={sc.text}>{sc.label}</Badge>
                  {rating && <span style={{ fontSize: 11, color: COLORS.textDim }}>تنفيذ: {rating.fulfillmentRate}%</span>}
                </div>
              </div>

              {/* تنبيه مرتجع تلقائي */}
              {autoReturnCount > 0 && (
                <div
                  onClick={() => openAutoReturn(s)}
                  style={{
                    background: COLORS.redSoft, border: "1px solid #ff7744",
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

              {/* رصيد أول المدة */}
              {(s.opening_balance || 0) > 0 && (
                <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
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
                    <Badge color="#0a2a00" text={COLORS.green}>{s.taxId}</Badge>
                  </div>
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
                    style={{ padding: "6px 10px", background: COLORS.greenSoft, border: "1px solid #1a5020", borderRadius: 7, color: COLORS.green, cursor: "pointer", fontSize: 14 }}>
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
          <div style={{ marginBottom: 14, padding: "10px 14px", background: COLORS.goldSoft, border: "1px solid #ff7744", borderRadius: 8, fontSize: 12, color: "#ff9a44" }}>
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
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
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
                        style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}
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
              style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
            <span style={{ color: COLORS.textDim, fontSize: 13 }}>يوم</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {["الصنف", "الحركة", "المخزون", "الحد الأدنى", "الكمية المطلوبة", ""].map((h) => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: "right", color: COLORS.textDim, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 11, color: item.movement.color, fontWeight: 700 }}>{item.movement.label}</span></td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13 }}>{item.currentStock}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13 }}>{item.minStock}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <input type="number" min="0" value={item.orderQty}
                        onChange={(e) => setOrderItems((prev) => prev.map((x, j) => j === i ? { ...x, orderQty: +e.target.value } : x))}
                        style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <button onClick={() => setOrderItems((p) => p.filter((_, j) => j !== i))}
                        style={{ background: "transparent", border: "none", color: COLORS.red, cursor: "pointer" }}>
                        <IC n="trash" s={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
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

      {/* ===== Modal السداد ===== */}
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
    style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
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
                  <div key={po.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, border: "1px solid #1d2d4a" }}>
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
                    <Badge color={po.payment_status === "مسددة جزئياً" ? COLORS.goldSoft : "#0a0a1a"} text={po.payment_status === "مسددة جزئياً" ? COLORS.gold : COLORS.textDim}>
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
                      <div style={{ flex: 1, background: "#3a6aff", height: `${(d.purchases / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مشتريات: ${d.purchases.toFixed(0)}`} />
                      <div style={{ flex: 1, background: COLORS.green, height: `${(d.paid / maxVal) * 80}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`مدفوعات: ${d.paid.toFixed(0)}`} />
                    </div>
                    <span style={{ fontSize: 9, color: COLORS.textDim }}>{d.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#3a6aff" }}>■ مشتريات</span>
                <span style={{ fontSize: 11, color: COLORS.green }}>■ مدفوعات</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 8 }}>سجل الدفعات</div>
            {supPayments.length === 0 ? (
              <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>لا توجد دفعات مسجلة</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
                {supPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay) => (
                  <div key={pay.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #0a101a" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>حد الكريدت (ر.س)</label>
              <input type="number" min="0" value={form.credit_limit} onChange={(e) => F("credit_limit", +e.target.value)}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>شروط الدفع (يوم)</label>
              <input type="number" min="0" value={form.payment_terms} onChange={(e) => F("payment_terms", +e.target.value)}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* ── رصيد أول المدة بتفاصيل ── */}
          <div style={{ background: "#0a0e1a", border: "1px solid #2a1a00", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.gold }}>رصيد أول المدة</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                  المجموع: {(form.opening_balance_details || []).reduce((s, d) => s + (d.amount || 0), 0).toFixed(2)} ر.س
                </div>
              </div>
              <button onClick={addOpeningDetail} style={{ background: "#1a2a10", border: "1px solid #2a5020", borderRadius: 7, padding: "6px 12px", color: COLORS.green, fontSize: 12, cursor: "pointer" }}>
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
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
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
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.amount} onChange={(e) => updateOpeningDetail(d.id, "amount", +e.target.value)}
                      placeholder="0"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: COLORS.gold, fontSize: 12, outline: "none" }} />
                    <input type="number" min="0" value={d.due_days} onChange={(e) => updateOpeningDetail(d.id, "due_days", +e.target.value)}
                      placeholder="30"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${d.due_days > 90 ? "#4a1010" : d.due_days > 60 ? "#4a3000" : COLORS.border}`, borderRadius: 6, padding: "7px 10px", color: d.due_days > 90 ? COLORS.red : d.due_days > 60 ? COLORS.gold : COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                    <input value={d.note} onChange={(e) => updateOpeningDetail(d.id, "note", e.target.value)}
                      placeholder="اختياري"
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10, padding: "10px 0", borderTop: "1px solid #1d2d4a" }}>
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
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid", borderColor: selected ? COLORS.blue : COLORS.border, background: selected ? "#0a2040" : "transparent", color: selected ? COLORS.blue : COLORS.textDim, fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400 }}>
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
      <h3 style={{ color: COLORS.textPrimary, marginBottom: 14 }}>💳 مديونية العملاء</h3>
      {creditData.length === 0 ? (
        <div style={{ color: COLORS.border, textAlign: "center", padding: 40 }}>
          لا توجد مديونيات
        </div>
      ) : (
        creditData.map((c) => (
          <div
            key={c.id}
            style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
              <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{c.name}</div>
              <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
                {c.invoiceCount} فاتورة آجل •{" "}
                <span style={{ color: COLORS.red }}>
                  متبقي: {c.totalDebt.toFixed(2)} ر.س
                </span>
              </div>
            </div>
            <button
              onClick={() => onPay(c)}
              style={{
                background: COLORS.greenSoft,
                border: "1px solid #1a4a2a",
                borderRadius: 8,
                padding: "6px 14px",
                color: COLORS.green,
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
    vip: { label: "👑 VIP", color: COLORS.gold, bg: "#2a2000" },
    excellent: { label: "⭐ ممتاز", color: COLORS.blue, bg: COLORS.blueSoft },
    good: { label: "✅ جيد", color: COLORS.green, bg: COLORS.greenSoft },
    weak: { label: "🔴 ضعيف", color: COLORS.red, bg: COLORS.redSoft },
  };

  const statusConfig = {
    new: { label: "🆕 جديد", color: COLORS.green },
    regular: { label: "✅ منتظم", color: COLORS.blue },
    at_risk: { label: "⚠️ في خطر", color: COLORS.gold },
    inactive: { label: "💤 مختفي", color: COLORS.red },
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
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: "1px solid #1d2d4a",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            color: COLORS.textPrimary,
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
              <span style={{ color: COLORS.textDim, fontSize: 12 }}>{d.label}</span>
              <span style={{ color: d.color, fontWeight: 700, fontSize: 13 }}>
                {d.count}
              </span>
            </div>
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 4, height: 8 }}>
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
  const [loyaltyMapC, setLoyaltyMapC] = useState<Record<string, number>>({});

  const loadLoyaltyC = async (customerId: string) => {
    if (loyaltyMapC[customerId] !== undefined) return;
    const { data } = await supabase
      .from("loyalty_points")
      .select("points")
      .eq("customer_id", customerId)
      .eq("pharmacy_id", pharmacyId)
      .single();
    setLoyaltyMapC((p) => ({ ...p, [customerId]: data?.points ?? 0 }));
  };

  const CustomerCard = ({ c }) => {
    const s = c.stats;
    const vip = s ? vipConfig[s.vipLevel] : null;
    const isExpanded = expandedCard === c.id;
    const loyalty = loyaltyMapC[c.id];

    const debt = sales
      .filter((x) => x.customer === c.id && x.payment === "آجل")
      .reduce((sum, x) => sum + (x.total || 0), 0);

    const handleExpand = () => {
      if (!isExpanded) { loadLoyaltyC(c.id); setExpandedCard(c.id); }
      else setExpandedCard(null);
    };

    return (
      <div style={{
        background: COLORS.surface,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${isExpanded ? (vip ? vip.color + "55" : "#3a6aaa") : (vip ? vip.color + "33" : COLORS.border)}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}>
        {/* رأس الكارت — قابل للضغط */}
        <div onClick={handleExpand} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", cursor: "pointer", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: "#1a2a5a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              {c.category === "individual" ? "👤" : c.category === "family_no_kids" ? "👫" : "👨‍👩‍👧"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name}
              </div>
              <div style={{ color: COLORS.border, fontSize: 10 }}>{c.phone}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {vip && <span style={{ background: vip.bg, color: vip.color, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{vip.label}</span>}
            {debt > 0 && <span style={{ background: COLORS.redSoft, color: COLORS.red, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>💳 {debt.toFixed(0)} ر.س</span>}
            <span style={{ color: COLORS.textDim, fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* التفاصيل */}
        {isExpanded && (
          <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
            {/* إحصائيات */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginTop: 10, marginBottom: 8 }}>
              {[
                { label: "إجمالي الزيارات", value: s?.totalVisits || 0, color: COLORS.blue },
                { label: "زيارات الشهر", value: s?.monthlyVisits || 0, color: COLORS.green },
                { label: "متوسط الفاتورة", value: s ? s.avgInvoice.toFixed(0) + " ر.س" : "-", color: COLORS.purple },
                { label: "إجمالي المشتريات", value: s ? s.totalSpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                { label: "مشتريات الشهر", value: s ? s.monthlySpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                { label: "آخر زيارة", value: s ? `${s.daysSinceLast} يوم` : "لم يزر", color: COLORS.textDim },
              ].map((item) => (
                <div key={item.label} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 7, padding: "6px 7px" }}>
                  <div style={{ color: COLORS.border, fontSize: 9 }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* نقاط الولاء */}
            {loyalty !== undefined && loyalty > 0 && (
              <div style={{ background: "#2a2000", border: "1px solid #5a4000", borderRadius: 7, padding: "6px 10px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: COLORS.gold, fontSize: 12 }}>🌟 نقاط الولاء</span>
                <span style={{ color: COLORS.gold, fontWeight: 800, fontSize: 13 }}>{loyalty.toFixed(2)} ر.س</span>
              </div>
            )}

            {/* شريط RFM */}
            {s && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 10 }}>نقاط RFM</span>
                  <span style={{ color: vip?.color, fontSize: 10, fontWeight: 700 }}>{s.rfmScore}/100</span>
                </div>
                <div style={{ background: COLORS.surfaceAlt, borderRadius: 4, height: 4 }}>
                  <div style={{ background: vip?.color || COLORS.textDim, height: "100%", borderRadius: 4, width: `${s.rfmScore}%`, transition: "width 0.5s" }} />
                </div>
              </div>
            )}

            {/* آخر مشتريات */}
            {s?.lastItems?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 4 }}>آخر مشتريات ({s.lastItems.length} صنف):</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.lastItems.map((item, i) => (
                    <span key={i} style={{ background: COLORS.surfaceAlt, color: "#5a9adf", padding: "2px 7px", borderRadius: 5, fontSize: 10 }}>
                      {item.name} × {item.qty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* أزرار */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <button onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 نتمنى أن تكونوا بخير`)}
                style={{ background: COLORS.greenSoft, border: "1px solid #1a4a1a", borderRadius: 7, padding: "5px 10px", color: COLORS.green, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                📱 واتساب
              </button>
              <button onClick={() => openEdit(c)}
                style={{ background: COLORS.blueSoft, border: "1px solid #1d2d4a", borderRadius: 7, padding: "5px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                ✏️ تعديل
              </button>
              <button onClick={async () => {
                if (debt > 0) {
                  if (currentUser?.role !== "admin") { showToast("❌ لا يمكن حذف عميل عليه مديونية", "error"); return; }
                  if (!window.confirm(`⚠️ على ${c.name} مديونية ${debt.toFixed(2)} ر.س
هل أنت متأكد من الحذف؟`)) return;
                }
                const { error } = await supabase.from("customers").delete().eq("id", c.id);
                if (error) { showToast("خطأ في الحذف", "error"); return; }
                setCustomers((p) => p.filter((x) => x.id !== c.id));
                showToast("تم حذف العميل");
              }}
                style={{ background: COLORS.redSoft, border: "1px solid #3a1010", borderRadius: 7, padding: "5px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>
                🗑️ حذف
              </button>
              {debt > 0 && (
                <button onClick={() => openCreditModal && openCreditModal(c)}
                  style={{ background: "#2a1a00", border: "1px solid #5a3000", borderRadius: 7, padding: "5px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                  💳 سداد آجل
                </button>
              )}
            </div>
          </div>
        )}
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
      pharmacy_id: pharmacyId,
      created_by: form.created_by || currentUser?.name || "",
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
    border: `1px solid ${activeTab === tab ? "#3a6aaa" : COLORS.border}`,
    borderRadius: 8,
    padding: "8px 16px",
    color: activeTab === tab ? COLORS.blue : COLORS.textDim,
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
            color: COLORS.blue,
            icon: "👥",
          },
          {
            label: "جديد هذا الشهر",
            value: newCount,
            color: COLORS.green,
            icon: "🆕",
          },
          { label: "عملاء VIP", value: vipCount, color: COLORS.gold, icon: "👑" },
          {
            label: "مختفون",
            value: inactiveCount,
            color: COLORS.red,
            icon: "💤",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: "1px solid #1d2d4a",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ color: item.color, fontWeight: 800, fontSize: 22 }}>
              {item.value}
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 11 }}>{item.label}</div>
          </div>
        ))}
        {/* كارت مديونية العملاء */}
        <div
          onClick={() => setActiveTab("credit")}
          style={{
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: "1px solid #3a1010",
            borderRadius: 12,
            padding: "14px 16px",
            cursor: "pointer",
            gridColumn: "span 4",
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
          <div style={{ color: COLORS.red, fontWeight: 800, fontSize: 18 }}>
            مديونية العملاء
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 11 }}>
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 14px",
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
              }}
            />
            <select
              value={filterVip}
              onChange={(e) => setFilterVip(e.target.value)}
              style={{
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: COLORS.textPrimary,
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "9px 12px",
                color: COLORS.textPrimary,
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
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
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
            <h3 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 15 }}>
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
                  background: COLORS.greenSoft,
                  border: "1px solid #1a4a1a",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: COLORS.green,
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
            <div style={{ color: COLORS.border, textAlign: "center", padding: 40 }}>
              لا يوجد عملاء اليوم
            </div>
          ) : (
            todayCustomers.map((c) => {
              const vip = c.stats ? vipConfig[c.stats.vipLevel] : null;
              return (
                <div
                  key={c.id}
                  style={{
                    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                      <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                        {c.name}
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: 11 }}>
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
                      background: COLORS.greenSoft,
                      border: "1px solid #1a4a1a",
                      borderRadius: 8,
                      padding: "6px 14px",
                      color: COLORS.green,
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
            <h3 style={{ margin: 0, color: COLORS.textPrimary, fontSize: 15 }}>
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
                  background: COLORS.redSoft,
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
                  background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
                  <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                    {c.name}
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>
                    غائب منذ{" "}
                    <span style={{ color: COLORS.red }}>
                      {s?.daysSinceLast} يوم
                    </span>{" "}
                    • إجمالي مشتريات:{" "}
                    <span style={{ color: COLORS.gold }}>
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
                          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          color: COLORS.textDim,
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
                    background: COLORS.greenSoft,
                    border: "1px solid #1a4a1a",
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: COLORS.green,
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
                color: COLORS.purple,
              },
              {
                label: "👫 أسرة بدون أطفال",
                count: customers.filter((c) => c.category === "family_no_kids")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "👨‍👩‍👧 أسرة مع أطفال",
                count: customers.filter(
                  (c) => c.category === "family_with_kids"
                ).length,
                color: COLORS.green,
              },
            ]}
          />
          <BarChart
            title="📊 حالة العملاء"
            data={[
              {
                label: "🆕 جديد",
                count: enriched.filter((c) => c.stats?.status === "new").length,
                color: COLORS.green,
              },
              {
                label: "✅ منتظم",
                count: enriched.filter((c) => c.stats?.status === "regular")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "⚠️ في خطر",
                count: enriched.filter((c) => c.stats?.status === "at_risk")
                  .length,
                color: COLORS.gold,
              },
              {
                label: "💤 مختفي",
                count: enriched.filter((c) => c.stats?.status === "inactive")
                  .length,
                color: COLORS.red,
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
                color: COLORS.gold,
              },
              {
                label: "⭐ ممتاز",
                count: enriched.filter((c) => c.stats?.vipLevel === "excellent")
                  .length,
                color: COLORS.blue,
              },
              {
                label: "✅ جيد",
                count: enriched.filter((c) => c.stats?.vipLevel === "good")
                  .length,
                color: COLORS.green,
              },
              {
                label: "🔴 ضعيف",
                count: enriched.filter((c) => c.stats?.vipLevel === "weak")
                  .length,
                color: COLORS.red,
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
          <div style={{ color: COLORS.green, textAlign: "center", padding: 20 }}>
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
                <tr style={{ background: COLORS.surfaceAlt }}>
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
                        color: COLORS.textDim,
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
                          ? COLORS.blueSoft
                          : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: COLORS.blue,
                        fontWeight: 700,
                      }}
                    >
                      {inv.id}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.textDim }}>
                      {inv.date}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.textPrimary }}>
                      {inv.total.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px", color: COLORS.green }}>
                      {inv.totalPaid.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: COLORS.red,
                        fontWeight: 700,
                      }}
                    >
                      {inv.remaining.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: COLORS.border, fontSize: 11 }}>
                        اختر
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedInvoice && (
              <div
                style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14 }}
              >
                <div
                  style={{ color: COLORS.textPrimary, marginBottom: 10, fontSize: 13 }}
                >
                  سداد فاتورة{" "}
                  <span style={{ color: COLORS.blue }}>{selectedInvoice.id}</span>{" "}
                  • المتبقي:{" "}
                  <span style={{ color: COLORS.red }}>
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
                      background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                      border: "1px solid #1d2d4a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: COLORS.textPrimary,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() =>
                      setPayAmount(String(selectedInvoice.remaining))
                    }
                    style={{
                      background: COLORS.blueSoft,
                      border: "1px solid #1d3a6a",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: COLORS.blue,
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
            <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 8 }}>
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
                      form.category === opt.val ? COLORS.blue : COLORS.border
                    }`,
                    background:
                      form.category === opt.val ? COLORS.blueSoft : COLORS.surfaceAlt,
                    color: form.category === opt.val ? COLORS.blue : COLORS.textDim,
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
                  style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 8 }}
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
                            selected ? COLORS.green : COLORS.border
                          }`,
                          background: selected ? COLORS.greenSoft : COLORS.surfaceAlt,
                          color: selected ? COLORS.green : COLORS.textDim,
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
  const [incentiveConfig, setIncentiveConfig] = useState({
    rate: 5,
    month: new Date().toISOString().slice(0, 7),
    marginThreshold: 45, // ← حد الهامش التلقائي قابل للتعديل
  });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editPromoId, setEditPromoId] = useState(null);
  const [showIncentiveForm, setShowIncentiveForm] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");

  // ── الشركات المنتجة ──
  const [manufacturers, setManufacturers] = useState([]);
  const [incentiveSupplierFilter, setIncentiveSupplierFilter] = useState("");

  // ── تاريخ تغييرات الهامش (لمنع الأثر الرجعي) ──
  const [thresholdHistory, setThresholdHistory] = useState<{ threshold: number; effective_from: string }[]>([]);

  const DEFAULT_RULES = [
    { days: 90,  discount: 50, color: COLORS.red },
    { days: 120, discount: 25, color: COLORS.coral },
    { days: 150, discount: 20, color: COLORS.gold },
    { days: 180, discount: 15, color: COLORS.gold },
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
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoPromoConfig, setAutoPromoConfig] = useState({
    excludeCategories: ["دواء"],
    minDiscount: 0,
    requireStock: true,
  });

  const blankPromo = { product_id: "", discount: "", start_date: new Date().toISOString().split("T")[0], end_date: "", note: "" };
  const [promoForm, setPromoForm] = useState(blankPromo);
  const [incentiveForm, setIncentiveForm] = useState({ rate: "", fixed_amount: "", note: "" });
  const [selectedIncentiveProducts, setSelectedIncentiveProducts] = useState<string[]>([]); // IDs المحددة للإضافة

  const today = new Date().toISOString().split("T")[0];
  const monthKey = incentiveConfig.month;

  // ── دالة حفظ autoPromoConfig في Supabase ──
  const saveAutoConfig = async (newConfig) => {
    await supabase.from("promo_settings").upsert({
      pharmacy_id: pharmacyId,
      auto_config: newConfig,
      updated_at: new Date().toISOString(),
    });
  };

  // ── دالة تغيير الهامش مع حفظ التاريخ ──
  const updateMarginThreshold = async (newThreshold: number) => {
    const now = new Date().toISOString();
    // حفظ في جدول التاريخ
    const { error } = await supabase.from("incentive_threshold_history").insert({
      pharmacy_id: pharmacyId,
      threshold: newThreshold,
      effective_from: now,
      created_by: currentUser?.name || currentUser?.email || "",
    });
    if (error) { showToast("خطأ في حفظ الهامش: " + error.message, "error"); return; }
    // تحديث الـ state
    setThresholdHistory((prev) => [...prev, { threshold: newThreshold, effective_from: now }]);
    setIncentiveConfig((p) => ({ ...p, marginThreshold: newThreshold }));
  };

  // تحميل البيانات
  useEffect(() => {
    if (!pharmacyId) return;
    Promise.all([
      supabase.from("promotions").select("*").eq("pharmacy_id", pharmacyId).order("end_date"),
      supabase.from("incentive_products").select("*").eq("pharmacy_id", pharmacyId),
      supabase.from("incentive_config").select("*").eq("pharmacy_id", pharmacyId).single(),
      // ── الشركات المنتجة مفلترة بالصيدلية ──
      supabase.from("manufacturers").select("id, name").eq("pharmacy_id", pharmacyId).order("name"),
      // ── إعدادات الإضافة التلقائية المحفوظة ──
      supabase.from("promo_settings").select("auto_config").eq("pharmacy_id", pharmacyId).single(),
      // ── تاريخ تغييرات الهامش ──
      supabase.from("incentive_threshold_history")
        .select("threshold, effective_from")
        .eq("pharmacy_id", pharmacyId)
        .order("effective_from", { ascending: true }),
    ]).then(([p, i, c, m, ps, th]) => {
      if (p.data) setPromos(p.data);
      if (i.data) setIncentiveList(i.data);
      if (c.data) setIncentiveConfig((prev) => ({ ...prev, rate: c.data.rate || 5 }));
      if (m.data) setManufacturers(m.data);
      // ── تحميل autoPromoConfig المحفوظ ──
      if (ps.data?.auto_config) {
        setAutoPromoConfig((prev) => ({ ...prev, ...ps.data.auto_config }));
      }
      // ── تحميل تاريخ الهامش + تحديث القيمة الحالية من آخر سجل ──
      if (th.data && th.data.length > 0) {
        setThresholdHistory(th.data);
        const latest = th.data[th.data.length - 1];
        setIncentiveConfig((prev) => ({ ...prev, marginThreshold: latest.threshold }));
      }
    });
  }, [pharmacyId]);

  // الأصناف التلقائية (غير دواء + فيها صلاحية قريبة)
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
    if (autoPromoConfig.excludeCategories.includes(cat)) return false;
    if (autoPromoConfig.requireStock && (p.stock || 0) <= 0) return false;
    const expiry = getProductExpiry(p);
    const disc = calcAutoDiscount(expiry, discountRules);
    return disc > 0 && disc >= autoPromoConfig.minDiscount;
  }).map((p) => {
    const expiry = getProductExpiry(p);
    return { ...p, expiry, autoDiscount: calcAutoDiscount(expiry, discountRules) };
  }).sort((a, b) => b.autoDiscount - a.autoDiscount);

  // ── الأصناف المحفزة — حسب marginThreshold القابل للتعديل ──
  const highMarginProducts = products.filter((p) => {
    const cost = p.cost || 0;
    const price = p.price || 0;
    if (!cost || !price) return false;
    return ((price - cost) / price) * 100 >= incentiveConfig.marginThreshold;
  });

  // ── دالة طباعة Shelf Label ──
  const printShelfLabel = (items: {
    name: string;
    originalPrice: number;
    discountedPrice: number;
    discount: number;
    endDate?: string;
    isAuto?: boolean;
  }[]) => {
    const labelsHTML = items.map((item) => `
      <div class="label">
        <div class="pharmacy-name">PharmacyPro</div>
        <div class="product-name">${item.name}</div>
        <div class="discount-badge">خصم ${item.discount}%</div>
        <div class="prices">
          <div class="old-price-box">
            <div class="old-price-label">السعر قبل</div>
            <div class="old-price">${item.originalPrice.toFixed(2)}</div>
          </div>
          <div class="arrow">◄</div>
          <div class="new-price-box">
            <div class="new-price-label">السعر بعد</div>
            <div class="new-price">${item.discountedPrice.toFixed(2)}</div>
          </div>
        </div>
        ${item.endDate ? `<div class="end-date">ينتهي العرض: ${item.endDate}</div>` : ""}
      </div>
    `).join("");

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8"/>
        <title>Shelf Labels</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
          .page {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8mm;
            padding: 10mm;
            width: 210mm;
          }
          .label {
            background: #FFD700;
            border: 3px solid #e6b800;
            border-radius: 12px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-height: 120mm;
            justify-content: center;
          }
          .pharmacy-name { font-size: 11px; color: #7a6000; font-weight: 600; letter-spacing: 1px; }
          .product-name { font-size: 18px; font-weight: 900; color: #1a1a00; text-align: center; line-height: 1.3; }
          .discount-badge { background: #cc0000; color: #fff; font-size: 20px; font-weight: 900; padding: 4px 20px; border-radius: 20px; }
          .prices { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; margin-top: 4px; }
          .old-price-box { background: #cc0000; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .old-price-label { color: #ffaaaa; font-size: 11px; margin-bottom: 2px; }
          .old-price { color: #fff; font-size: 22px; font-weight: 900; text-decoration: line-through; text-decoration-color: #ffaaaa; text-decoration-thickness: 3px; }
          .arrow { color: #7a6000; font-size: 22px; }
          .new-price-box { background: #1a5c00; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .new-price-label { color: #aaffaa; font-size: 11px; margin-bottom: 2px; }
          .new-price { color: #fff; font-size: 28px; font-weight: 900; }
          .end-date { font-size: 12px; color: #5a4400; background: #fff3; padding: 3px 10px; border-radius: 6px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="page">${labelsHTML}</div>
        <script>
          window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // ── طباعة تلقائية عند دخول صنف جديد للعروض التلقائية ──
  useEffect(() => {
    if (!pharmacyId || autoPromoProducts.length === 0) return;
    const storageKey = `printed_auto_promos_${pharmacyId}`;
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const newItems: typeof autoPromoProducts = [];
    autoPromoProducts.forEach((p) => {
      const prevDiscount = stored[p.id];
      if (prevDiscount === undefined || prevDiscount !== p.autoDiscount) {
        newItems.push(p);
        stored[p.id] = p.autoDiscount;
      }
    });
    if (newItems.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(stored));
    printShelfLabel(
      newItems.map((p) => ({
        name: p.name || p.nameAr || "",
        originalPrice: p.price,
        discountedPrice: parseFloat((p.price * (1 - p.autoDiscount / 100)).toFixed(2)),
        discount: p.autoDiscount,
        isAuto: true,
      }))
    );
  }, [autoPromoProducts, pharmacyId]);

  // حفظ عرض يدوي (إضافة أو تعديل)
  const savePromo = async () => {
    if (!promoForm.product_id || !promoForm.discount || !promoForm.end_date) {
      showToast("يرجى ملء جميع الحقول", "error"); return;
    }
    const row = { ...promoForm, discount: +promoForm.discount, pharmacy_id: pharmacyId };

    if (editPromoId) {
      const { error } = await supabase.from("promotions").update(row).eq("id", editPromoId);
      if (error) { showToast("خطأ: " + error.message, "error"); return; }
      setPromos((p) => p.map((x) => (x.id === editPromoId ? { ...x, ...row } : x)));
      setEditPromoId(null);
      setPromoForm(blankPromo);
      setShowPromoForm(false);
      showToast("تم تعديل العرض ✓");
      return;
    }

    const { data, error } = await supabase.from("promotions").insert([row]).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setPromos((p) => [...p, data[0]]);
    setPromoForm(blankPromo);
    setShowPromoForm(false);
    showToast("تم إضافة العرض ✓");
    const prod = products.find((p) => p.id === promoForm.product_id);
    if (prod) {
      printShelfLabel([{
        name: prod.name || prod.nameAr || "",
        originalPrice: prod.price,
        discountedPrice: parseFloat((prod.price * (1 - +promoForm.discount / 100)).toFixed(2)),
        discount: +promoForm.discount,
        endDate: promoForm.end_date,
        isAuto: false,
      }]);
    }
  };

  // حفظ أصناف محفزة (متعددة)
  const saveIncentive = async () => {
    if (selectedIncentiveProducts.length === 0) { showToast("اختر صنفاً على الأقل", "error"); return; }
    // تصفية الأصناف اللي مضافة مسبقاً
    const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
    const toAdd = selectedIncentiveProducts.filter((id) => !alreadyAdded.has(id));
    if (toAdd.length === 0) { showToast("الأصناف المحددة مضافة مسبقاً", "error"); return; }
    const rows = toAdd.map((product_id) => ({
      product_id,
      rate: incentiveForm.rate || null,
      fixed_amount: incentiveForm.fixed_amount || null,
      note: incentiveForm.note || null,
      pharmacy_id: pharmacyId,
    }));
    const { data, error } = await supabase.from("incentive_products").insert(rows).select();
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
    setIncentiveList((p) => [...p, ...data]);
    setIncentiveForm({ rate: "", fixed_amount: "", note: "" });
    setSelectedIncentiveProducts([]);
    setIncentiveSupplierFilter("");
    setShowIncentiveForm(false);
    showToast(`تم إضافة ${data.length} صنف للقائمة المحفزة ✓`);
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

  const activePromos = promos.filter((p) => p.end_date >= today && p.start_date <= today);
  const expiredPromos = promos.filter((p) => p.end_date < today);

  const discountColor = (d) => d >= 50 ? COLORS.red : d >= 25 ? COLORS.coral : d >= 20 ? COLORS.gold : COLORS.gold;

  const cardStyle = (border = COLORS.border) => ({
    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });

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
          <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>
            عروض تلقائية حسب الصلاحية + عروض يدوية + أصناف محفزة
          </div>
        </div>
      </div>

      {/* تنبيه العروض التلقائية */}
      {autoPromoProducts.length > 0 && (
        <div style={{ background: COLORS.goldSoft, border: "1px solid #4a2800", borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: COLORS.gold, fontWeight: 700 }}>⚠️ {autoPromoProducts.length} صنف يحتاج عرض تلقائي</span>
            <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>أصناف غير دوائية بصلاحية أقل من 6 شهور</div>
          </div>
          <button onClick={() => setActiveTab("auto")} style={{ background: COLORS.goldSoft, border: "1px solid #6a4000", borderRadius: 8, padding: "6px 14px", color: COLORS.gold, fontSize: 12, cursor: "pointer" }}>
            عرض التفاصيل
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 4 }}>
        {[
          { k: "auto", l: `⏰ تلقائي (${autoPromoProducts.length})` },
          { k: "manual", l: `✋ يدوي (${activePromos.length})` },
          { k: "incentive", l: "⭐ أصناف محفزة" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? COLORS.surface : "transparent",
            color: activeTab === t.k ? COLORS.blue : COLORS.textDim,
            fontSize: 12, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── العروض التلقائية ── */}
      {activeTab === "auto" && (
        <div>
          <div style={cardStyle("#1a2a1a")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: COLORS.green, fontWeight: 700 }}>📋 منطق الخصم التدرجي التلقائي</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAutoConfig((v) => !v)}
                  style={{ background: "#1a0a2a", border: "1px solid #4a1a6a", borderRadius: 8, padding: "5px 14px", color: COLORS.purple, fontSize: 12, cursor: "pointer" }}>
                  ⚙️ شرط الإضافة
                </button>
                <button onClick={() => { setEditRules(discountRules.map(r => ({...r}))); setShowRulesEditor(true); }}
                  style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d3a6a", borderRadius: 8, padding: "5px 14px", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>
                  ✏️ تعديل القواعد
                </button>
              </div>
            </div>

            {/* كارت إعدادات شرط الإضافة التلقائية */}
            {showAutoConfig && (
              <div style={{ background: "#0a0a1a", border: "1px solid #2a1a4a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⚙️ شروط الإضافة للقائمة التلقائية</div>

                {/* الفئات المستثناة */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>الفئات المستثناة (لن تظهر في العروض التلقائية):</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["دواء", "مستلزمات طبية", "مستحضرات تجميل", "أخرى"].map((cat) => {
                      const excluded = autoPromoConfig.excludeCategories.includes(cat);
                      return (
                        <div key={cat} onClick={() => {
                          const updated = {
                            ...autoPromoConfig,
                            excludeCategories: excluded
                              ? autoPromoConfig.excludeCategories.filter((c) => c !== cat)
                              : [...autoPromoConfig.excludeCategories, cat],
                          };
                          setAutoPromoConfig(updated);
                          saveAutoConfig(updated);
                        }} style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                          background: excluded ? COLORS.redSoft : "#0a1a0a",
                          border: `1px solid ${excluded ? COLORS.red : "#1a4a1a"}`,
                          color: excluded ? COLORS.coral : COLORS.green, fontSize: 12 }}>
                          {excluded ? "✕ " : "✓ "}{cat}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* الحد الأدنى للخصم */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>أقل خصم يظهر في القائمة:</span>
                  <input type="number" min="0" max="100" value={autoPromoConfig.minDiscount}
                    onChange={(e) => {
                      const updated = { ...autoPromoConfig, minDiscount: +e.target.value };
                      setAutoPromoConfig(updated);
                      saveAutoConfig(updated);
                    }}
                    style={{ width: 60, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>%</span>
                </div>

                {/* اشتراط المخزون */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>إظهار الأصناف المنتهية المخزون:</span>
                  <div onClick={() => {
                    const updated = { ...autoPromoConfig, requireStock: !autoPromoConfig.requireStock };
                    setAutoPromoConfig(updated);
                    saveAutoConfig(updated);
                  }}
                    style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                      background: autoPromoConfig.requireStock ? "#2a6a2a" : COLORS.red,
                      position: "relative", transition: "background 0.2s" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: autoPromoConfig.requireStock ? 3 : 19, transition: "left 0.2s" }} />
                  </div>
                  <span style={{ color: autoPromoConfig.requireStock ? COLORS.green : COLORS.coral, fontSize: 11 }}>
                    {autoPromoConfig.requireStock ? "مخفية" : "ظاهرة"}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {[...discountRules].sort((a,b) => a.days - b.days).map((r) => (
                <div key={r.days} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ color: r.color || COLORS.gold, fontWeight: 900, fontSize: 18 }}>{r.discount}%</div>
                  <div style={{ color: COLORS.textDim, fontSize: 11 }}>أقل من {Math.round(r.days/30)} شهور</div>
                  <div style={{ color: COLORS.textDim, fontSize: 10 }}>({r.days} يوم)</div>
                </div>
              ))}
            </div>
          </div>

          <input
            value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredAutoPromos.length === 0
            ? <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>✅ لا توجد أصناف تحتاج عروض تلقائية</div>
            : filteredAutoPromos.map((p) => {
                const days = Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24));
                const newPrice = (p.price * (1 - p.autoDiscount / 100)).toFixed(2);
                return (
                  <div key={p.id} style={cardStyle(p.autoDiscount >= 50 ? "#3a0000" : p.autoDiscount >= 25 ? "#3a1500" : "#2a1500")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{p.name || p.nameAr}</span>
                          <span style={{
                            background: discountColor(p.autoDiscount), color: "#fff",
                            borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900,
                          }}>-{p.autoDiscount}%</span>
                        </div>
                        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
                          <span style={{ color: COLORS.textDim }}>الفئة: <span style={{ color: COLORS.textDim }}>{p.main_category || p.category}</span></span>
                          <span style={{ color: COLORS.textDim }}>المخزون: <span style={{ color: COLORS.textPrimary }}>{p.stock}</span></span>
                          <span style={{ color: COLORS.textDim }}>ينتهي بعد: <span style={{ color: discountColor(p.autoDiscount) }}>{days} يوم</span></span>
                        </div>
                      </div>
                      <div style={{ textAlign: "left", minWidth: 110 }}>
                        <div style={{ color: COLORS.textDim, fontSize: 11, textDecoration: "line-through" }}>{p.price} ر.س</div>
                        <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{newPrice} ر.س</div>
                        <div style={{ color: COLORS.textDim, fontSize: 10 }}>تاريخ: {p.expiry}</div>
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
              <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>✅ عروض نشطة ({activePromos.length})</div>
              {activePromos.map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                const newPrice = prod ? (prod.price * (1 - promo.discount / 100)).toFixed(2) : "—";
                const daysLeft = Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={promo.id} style={cardStyle(COLORS.greenSoft)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{prod?.name_ar || prod?.name || prod?.nameAr || promo.product_id}</span>
                          <span style={{ background: COLORS.coral, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>-{promo.discount}%</span>
                        </div>
                        <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                          {promo.start_date} ← {promo.end_date}
                          {promo.note && <span style={{ marginRight: 10, color: COLORS.textDim }}>• {promo.note}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</div>
                        <div style={{ color: daysLeft <= 3 ? COLORS.red : COLORS.textDim, fontSize: 11 }}>يتبقى {daysLeft} يوم</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <button onClick={() => {
                            setPromoForm({ product_id: promo.product_id, discount: String(promo.discount), start_date: promo.start_date, end_date: promo.end_date, note: promo.note || "" });
                            setEditPromoId(promo.id);
                            setShowPromoForm(true);
                          }} style={{ background: COLORS.blueSoft, border: "1px solid #1d2d4a", borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>✏️ تعديل</button>
                          <button onClick={async () => {
                            await supabase.from("promotions").delete().eq("id", promo.id);
                            setPromos((p) => p.filter((x) => x.id !== promo.id));
                          }} style={{ background: COLORS.redSoft, border: "1px solid #3a1010", borderRadius: 6, padding: "3px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>🗑️ حذف</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expiredPromos.length > 0 && (
            <div>
              <div style={{ color: COLORS.textDim, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 عروض منتهية ({expiredPromos.length})</div>
              {expiredPromos.slice(0, 5).map((promo) => {
                const prod = products.find((p) => p.id === promo.product_id);
                return (
                  <div key={promo.id} style={{ ...cardStyle(), opacity: 0.6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: COLORS.textDim }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                      <span style={{ color: COLORS.textDim }}>-{promo.discount}% • انتهى {promo.end_date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {promos.length === 0 && <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>لا توجد عروض يدوية</div>}
        </div>
      )}

      {/* ── الأصناف المحفزة ── */}
      {activeTab === "incentive" && (
        <div>
          {/* إعداد النسبة */}
          <div style={cardStyle(COLORS.surfaceAlt)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ color: COLORS.blue, fontWeight: 700, marginBottom: 4 }}>⚙️ إعدادات العمولة</div>
                <div style={{ color: COLORS.textDim, fontSize: 12 }}>نسبة الصيدلي من مبيعات الأصناف المحفزة</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <label style={{ color: COLORS.border, fontSize: 11, display: "block", marginBottom: 2 }}>الشهر</label>
                  <input type="month" value={incentiveConfig.month}
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, month: e.target.value }))}
                    style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }} />
                </div>
                <div>
                  <label style={{ color: COLORS.border, fontSize: 11, display: "block", marginBottom: 2 }}>نسبة العمولة %</label>
                  <input type="number" value={incentiveConfig.rate} min="1" max="20"
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, rate: +e.target.value }))}
                    style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                </div>
                {/* ── خانة حد الهامش التلقائي ── */}
                <div>
                  <label style={{ color: COLORS.border, fontSize: 11, display: "block", marginBottom: 2 }}>حد الهامش التلقائي %</label>
                  <input type="number" value={incentiveConfig.marginThreshold} min="1" max="100"
                    onBlur={(e) => {
                      const val = +e.target.value;
                      if (val !== incentiveConfig.marginThreshold) updateMarginThreshold(val);
                    }}
                    onChange={(e) => setIncentiveConfig((p) => ({ ...p, marginThreshold: +e.target.value }))}
                    style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                </div>
              </div>
            </div>
          </div>

          {/* أصناف بهامش تلقائية — العنوان يعكس القيمة الحالية */}
          <div style={cardStyle("#1a1a2a")}>
            <div style={{ color: COLORS.purple, fontWeight: 700, marginBottom: 10 }}>
              🎯 أصناف بهامش ربح ≥ {incentiveConfig.marginThreshold}% — تلقائية ({highMarginProducts.length})
            </div>
            {highMarginProducts.length === 0
              ? <div style={{ color: COLORS.textDim, fontSize: 12 }}>لا توجد أصناف بهذا الهامش حالياً</div>
              : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {highMarginProducts.map((p) => {
                    const margin = (((p.price - p.cost) / p.price) * 100).toFixed(0);
                    return (
                      <div key={p.id} style={{ background: COLORS.surfaceAlt, border: "1px solid #3a2a6a", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>{p.name_ar || p.name || p.nameAr}</span>
                        <span style={{ color: COLORS.purple, marginRight: 8, fontWeight: 700 }}>{margin}%</span>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* أصناف مضافة يدوياً */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: COLORS.textPrimary, fontWeight: 700 }}>✋ أصناف مضافة يدوياً ({incentiveList.length})</div>
            <Btn icon="plus" size="sm" onClick={() => setShowIncentiveForm(true)}>إضافة صنف</Btn>
          </div>

          <input
            value={incentiveSearch} onChange={(e) => setIncentiveSearch(e.target.value)}
            placeholder="🔍 بحث..."
            style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />

          {filteredIncentive.map((item) => {
            const prod = products.find((p) => p.id === item.product_id);
            return (
              <div key={item.id} style={{ background: COLORS.surfaceAlt, border: "1px solid #1d2d4a", borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 13 }}>{prod?.name_ar || prod?.name || prod?.nameAr || item.product_id}</div>
                    {item.note && <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>{item.note}</div>}
                  </div>
                  <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
                    {item.rate && <span style={{ background: "#1a3a1a", color: COLORS.green, padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{item.rate}% عمولة</span>}
                    {item.fixed_amount && <span style={{ background: "#1a2a3a", color: COLORS.blue, padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700 }}>{item.fixed_amount} ر.س ثابت</span>}
                    <button onClick={async () => {
                      await supabase.from("incentive_products").delete().eq("id", item.id);
                      setIncentiveList((p) => p.filter((x) => x.id !== item.id));
                    }} style={{ background: "transparent", border: "none", color: COLORS.red, fontSize: 11, cursor: "pointer", marginTop: 2 }}>🗑️ حذف</button>
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
            const staffSales = {};
            sales
              .filter((s) => s.date?.startsWith(monthKey) && !s.returned)
              .forEach((s) => {
                const name = s.cashier || s.user || s.created_by || "غير محدد";
                // وقت البيعة بالظبط لتحديد الهامش الساري وقتها
                const saleDateTime = s.created_at || s.date + "T00:00:00.000Z";

                // الهامش الساري وقت البيعة — آخر سجل قبل أو عند وقت البيعة
                const applicableThreshold = thresholdHistory.length > 0
                  ? (thresholdHistory.filter((h) => h.effective_from <= saleDateTime).at(-1)?.threshold ?? incentiveConfig.marginThreshold)
                  : incentiveConfig.marginThreshold;

                // الأصناف ذات الهامش المرتفع بناءً على الهامش الساري وقتها
                const validMarginIds = new Set(
                  products.filter((p) => {
                    const cost = p.cost || 0;
                    const price = p.price || 0;
                    if (!cost || !price) return false;
                    return ((price - cost) / price) * 100 >= applicableThreshold;
                  }).map((p) => p.id)
                );

                // الأصناف اليدوية لا تتأثر بالهامش
                const allIncentiveIds = new Set([
                  ...incentiveList.map((i) => i.product_id),
                  ...validMarginIds,
                ]);

                const items = typeof s.items === "string" ? JSON.parse(s.items) : s.items || [];
                items.forEach((item) => {
                  if (allIncentiveIds.has(item.id)) {
                    if (!staffSales[name]) staffSales[name] = { total: 0, items: {} };
                    const amt = (item.price || 0) * (item.qty || 1);
                    staffSales[name].total += amt;
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
                <div style={{ color: COLORS.textDim, padding: 20 }}>
                  لا توجد مبيعات من الأصناف المحفزة في {monthKey}
                </div>
              </div>
            );

            const totalAllStaff = staffList.reduce((a, [, v]) => a + v.total, 0);

            return (
              <div style={{ ...cardStyle(COLORS.greenSoft), marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 14 }}>
                    📊 عمولة الأصناف المحفزة — {monthKey}
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 12 }}>
                    إجمالي المبيعات المحفزة: <span style={{ color: COLORS.green, fontWeight: 700 }}>{totalAllStaff.toFixed(2)} ر.س</span>
                  </div>
                </div>

                {staffList.map(([name, data]) => {
                  const rate = incentiveConfig.rate;
                  const commission = (data.total * rate / 100);
                  const pct = totalAllStaff > 0 ? (data.total / totalAllStaff * 100).toFixed(1) : "0";
                  return (
                    <div key={name} style={{ padding: "12px 0", borderBottom: "1px solid #0a1a0a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>👤 {name}</div>
                          <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>
                            مبيعات محفزة: <span style={{ color: COLORS.green }}>{data.total.toFixed(2)} ر.س</span>
                            <span style={{ marginRight: 10, color: COLORS.textDim }}>({pct}% من الإجمالي)</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{commission.toFixed(2)} ر.س</div>
                          <div style={{ color: COLORS.textDim, fontSize: 11 }}>عمولة {rate}%</div>
                        </div>
                      </div>
                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 4, height: 6, marginBottom: 8 }}>
                        <div style={{ background: COLORS.green, height: "100%", borderRadius: 4, width: `${pct}%`, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {Object.entries(data.items).map(([pName, amt]) => (
                          <div key={pName} style={{ background: "#0a1a0a", border: "1px solid #1a3a1a", borderRadius: 6, padding: "3px 10px", fontSize: 11 }}>
                            <span style={{ color: COLORS.textDim }}>{pName}</span>
                            <span style={{ color: COLORS.green, marginRight: 6, fontWeight: 700 }}>{(amt as number).toFixed(0)} ر.س</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "2px solid #1a3a1a" }}>
                  <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>إجمالي العمولات المستحقة</span>
                  <span style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>
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
        <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>
          حدد عدد الأيام ونسبة الخصم لكل مرحلة — يتم الترتيب تلقائياً من الأقل للأكثر
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
          <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 700 }}>أقل من (يوم)</span>
          <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 700 }}>نسبة الخصم %</span>
          <span/>
        </div>
        {editRules.map((rule, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" value={rule.days} min="1" max="365"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, days: +e.target.value } : r))}
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <input type="number" value={rule.discount} min="1" max="100"
              onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, discount: +e.target.value } : r))}
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
            <button onClick={() => setEditRules((p) => p.filter((_, j) => j !== i))}
              style={{ background: COLORS.redSoft, border: "none", borderRadius: 6, padding: "8px 12px", color: COLORS.coral, cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button onClick={() => setEditRules((p) => [...p, { days: 60, discount: 10, color: COLORS.gold }])}
          style={{ background: "#0a1a0a", border: "1px dashed #1a4a1a", borderRadius: 8, padding: "7px 14px", color: COLORS.green, cursor: "pointer", fontSize: 12, width: "100%", marginBottom: 14 }}>
          + إضافة مرحلة
        </button>
        <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>معاينة:</div>
          {[...editRules].sort((a, b) => a.days - b.days).map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: COLORS.textDim }}>أقل من {r.days} يوم (~{Math.round(r.days/30)} شهور)</span>
              <span style={{ color: COLORS.gold, fontWeight: 700 }}>خصم {r.discount}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setEditRules([...DEFAULT_RULES])}>إعادة للافتراضي</Btn>
          <Btn variant="ghost" onClick={() => setShowRulesEditor(false)}>إلغاء</Btn>
          <Btn icon="check" onClick={async () => {
            const sorted = [...editRules].sort((a, b) => a.days - b.days);
            await supabase.from("promo_rules").delete().eq("pharmacy_id", pharmacyId);
            const rows = sorted.map((r) => ({
              days: r.days,
              discount: r.discount,
              color: r.color || COLORS.gold,
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

      {/* Modal إضافة/تعديل عرض يدوي */}
      <Modal open={showPromoForm} onClose={() => { setShowPromoForm(false); setEditPromoId(null); setPromoForm(blankPromo); }} title={editPromoId ? "✏️ تعديل عرض يدوي" : "➕ إضافة عرض يدوي"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>الصنف</label>
            <select value={promoForm.product_id}
              onChange={(e) => setPromoForm((p) => ({ ...p, product_id: e.target.value }))}
              style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
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
              <span style={{ color: COLORS.textDim, fontSize: 12 }}>السعر بعد الخصم: </span>
              <span style={{ color: COLORS.green, fontWeight: 900, fontSize: 16 }}>{newPrice} ر.س</span>
              <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 8 }}>(بدلاً من {prod.price} ر.س)</span>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => { setShowPromoForm(false); setEditPromoId(null); setPromoForm(blankPromo); }}>إلغاء</Btn>
          <Btn icon="check" onClick={savePromo}>{editPromoId ? "حفظ التعديل" : "إضافة العرض"}</Btn>
        </div>
      </Modal>

      {/* ── Modal إضافة صنف محفز — مع فلتر الشركة المنتجة وتحديد متعدد ── */}
      <Modal open={showIncentiveForm} onClose={() => { setShowIncentiveForm(false); setIncentiveSupplierFilter(""); setSelectedIncentiveProducts([]); }} title="⭐ إضافة أصناف للقائمة المحفزة">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>

          {/* فلتر الشركة المنتجة */}
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>
              🏭 الشركة المنتجة
            </label>
            <select
              value={incentiveSupplierFilter}
              onChange={(e) => {
                const mId = e.target.value;
                setIncentiveSupplierFilter(mId);
                // تحديد كل أصناف الشركة تلقائياً (ما عدا المضافة مسبقاً)
                const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
                const ids = products
                  .filter((p) => p.manufacturer_id === mId && !alreadyAdded.has(p.id))
                  .map((p) => p.id);
                setSelectedIncentiveProducts(ids);
              }}
              style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
              <option value="">-- اختر شركة --</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <Input label="نسبة عمولة %" value={incentiveForm.rate} onChange={(v) => setIncentiveForm((p) => ({ ...p, rate: v }))} type="number" placeholder="اتركه فارغ لو ثابت" />
          <Input label="مبلغ ثابت (ر.س)" value={incentiveForm.fixed_amount} onChange={(v) => setIncentiveForm((p) => ({ ...p, fixed_amount: v }))} type="number" placeholder="اتركه فارغ لو نسبة" />
          <div style={{ gridColumn: "1/-1" }}>
            <Input label="ملاحظة" value={incentiveForm.note} onChange={(v) => setIncentiveForm((p) => ({ ...p, note: v }))} placeholder="تطبق على جميع الأصناف المضافة..." />
          </div>
        </div>

        {/* قائمة أصناف الشركة مع checkbox */}
        {incentiveSupplierFilter && (() => {
          const alreadyAdded = new Set(incentiveList.map((i) => i.product_id));
          const mfProducts = products.filter((p) => p.manufacturer_id === incentiveSupplierFilter);
          const available = mfProducts.filter((p) => !alreadyAdded.has(p.id));
          const allSelected = available.length > 0 && available.every((p) => selectedIncentiveProducts.includes(p.id));

          return (
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 10, overflow: "hidden" }}>
              {/* Header القائمة */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1d2d4a", background: "#0a1220" }}>
                <div style={{ color: COLORS.blue, fontWeight: 700, fontSize: 13 }}>
                  {mfProducts.length} صنف
                  {alreadyAdded.size > 0 && (
                    <span style={{ color: COLORS.textDim, fontWeight: 400, fontSize: 11, marginRight: 8 }}>
                      ({mfProducts.filter(p => alreadyAdded.has(p.id)).length} مضاف مسبقاً)
                    </span>
                  )}
                </div>
                {available.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSelectedIncentiveProducts(available.map((p) => p.id))}
                      style={{ background: "none", border: "none", color: COLORS.green, fontSize: 12, cursor: "pointer" }}>
                      تحديد الكل
                    </button>
                    <span style={{ color: COLORS.border }}>|</span>
                    <button onClick={() => setSelectedIncentiveProducts([])}
                      style={{ background: "none", border: "none", color: COLORS.coral, fontSize: 12, cursor: "pointer" }}>
                      إلغاء الكل
                    </button>
                  </div>
                )}
              </div>

              {/* الأصناف */}
              <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {mfProducts.length === 0 ? (
                  <div style={{ color: COLORS.textDim, textAlign: "center", padding: 20, fontSize: 13 }}>
                    لا توجد أصناف لهذه الشركة
                  </div>
                ) : (
                  mfProducts.map((p) => {
                    const isAdded = alreadyAdded.has(p.id);
                    const isSelected = selectedIncentiveProducts.includes(p.id);
                    const margin = p.cost && p.price
                      ? (((p.price - p.cost) / p.price) * 100).toFixed(0)
                      : null;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isAdded) return;
                          setSelectedIncentiveProducts((prev) =>
                            isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          );
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderBottom: "1px solid #0d1928",
                          cursor: isAdded ? "default" : "pointer",
                          background: isAdded ? "#0a0f18" : isSelected ? COLORS.surfaceAlt : "transparent",
                          opacity: isAdded ? 0.5 : 1,
                          transition: "background 0.15s",
                        }}>
                        {/* Checkbox */}
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${isAdded ? "#2a3a4a" : isSelected ? COLORS.blue : "#2a3a5a"}`,
                          background: isAdded ? "#1a2a3a" : isSelected ? COLORS.blue : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {(isSelected || isAdded) && (
                            <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>
                          )}
                        </div>

                        {/* اسم الصنف */}
                        <div style={{ flex: 1 }}>
                          <div style={{ color: isAdded ? COLORS.textDim : COLORS.textPrimary, fontSize: 13 }}>
                            {p.name || p.nameAr}
                            {isAdded && <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 8 }}>• مضاف مسبقاً</span>}
                          </div>
                          {margin && (
                            <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>
                              هامش: <span style={{ color: +margin >= incentiveConfig.marginThreshold ? COLORS.purple : COLORS.textDim }}>{margin}%</span>
                            </div>
                          )}
                        </div>

                        {/* السعر */}
                        <div style={{ color: COLORS.textDim, fontSize: 12, textAlign: "left" }}>
                          {p.price} ر.س
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: COLORS.textDim, fontSize: 12 }}>
            {selectedIncentiveProducts.length > 0 && (
              <span style={{ color: COLORS.blue }}>{selectedIncentiveProducts.length} صنف محدد</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setShowIncentiveForm(false); setIncentiveSupplierFilter(""); setSelectedIncentiveProducts([]); }}>إلغاء</Btn>
            <Btn icon="check" onClick={saveIncentive}>
              إضافة {selectedIncentiveProducts.length > 0 ? `(${selectedIncentiveProducts.length})` : ""}
            </Btn>
          </div>
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
  const [expandedTarget, setExpandedTarget] = useState(null);
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

  const pctColor = (p) => (p >= 100 ? COLORS.green : p >= 75 ? COLORS.blue : p >= 50 ? COLORS.gold : COLORS.red);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🎯 تارجت المبيعات</h2>
          <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>
            تارجت شهري لكل صيدلي + تحليل فني لحظي + مقارنات
          </div>
        </div>
        <Input type="month" value={monthKey} onChange={setMonthKey} style={{ width: 160 }} />
      </div>

      {pharmacists.length === 0 && (
        <div style={{ color: COLORS.textDim, padding: 20 }}>لا يوجد صيادلة مسجلين بدور "pharmacist".</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 16 }}>
        {pharmacists.map((u) => {
          const c = calcForPharmacist(u.name);
          const cardColor = pctColor(c.simplePct);
          const isOpen = expandedTarget === u.name;

          return (
            <div key={u.id} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${cardColor}44`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: cardColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    🎯
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.textPrimary }}>{u.name}</div>
                    <div style={{ color: COLORS.textDim, fontSize: 10 }}>صيدلاني</div>
                  </div>
                </div>
                <div style={{ background: cardColor + "22", color: cardColor, fontWeight: 900, fontSize: 13, padding: "3px 10px", borderRadius: 20 }}>
                  {c.target ? c.simplePct.toFixed(0) + "%" : "—"}
                </div>
              </div>

              <div style={{ background: COLORS.surfaceAlt, borderRadius: 8, height: 7, overflow: "hidden" }}>
                <div style={{ width: Math.min(c.simplePct, 100) + "%", height: "100%", background: cardColor, transition: "width .3s" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <div>
                  <div style={{ color: COLORS.textDim, fontSize: 10 }}>التارجت</div>
                  <div style={{ color: "#8ab0ff", fontWeight: 800 }}>{c.target ? c.target.toFixed(0) + " ر.س" : "—"}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: COLORS.textDim, fontSize: 10 }}>المحقق</div>
                  <div style={{ color: COLORS.textPrimary, fontWeight: 800 }}>{c.achieved.toFixed(0)} ر.س</div>
                </div>
              </div>

              {/* تعديل التارجت — ظاهر دايماً */}
              {editing === u.name ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Input value={editValue} onChange={setEditValue} type="number" placeholder="قيمة التارجت" style={{ flex: 1 }} />
                  <Btn size="sm" variant="success" onClick={() => saveTarget(u.name)}>حفظ</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>✕</Btn>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  {isAdmin && (
                    <button
                      onClick={() => { setEditing(u.name); setEditValue(c.target || ""); }}
                      style={{ flex: 1, background: COLORS.blueSoft, border: "1px solid #1d2d4a", borderRadius: 7, padding: "6px 10px", color: COLORS.blue, fontSize: 12, cursor: "pointer", fontWeight: 700 }}
                    >
                      ✏️ تعديل التارجت
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTarget(isOpen ? null : u.name)}
                    style={{ flex: 1, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}
                  >
                    {isOpen ? "▲ إخفاء التفاصيل" : "▼ عرض التفاصيل"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== التفاصيل الموسعة — تظهر تحت الكروت لصيدلي واحد بس ===== */}
      {pharmacists.filter((u) => expandedTarget === u.name).map((u) => {
        const c = calcForPharmacist(u.name);
        const dailyPerf = getDailyPerformance(u.name, c);
        const yearTrend = getYearTrend(u.name);
        const maxDaily = Math.max(...dailyPerf.map((d) => d.amount), 1);
        const maxYearly = Math.max(...yearTrend.map((m) => Math.max(m.achieved, m.target)), 1);
        const otherPharmacists = pharmacists.filter((p) => p.name !== u.name);
        const compareName = compareWith[u.name] || (otherPharmacists[0]?.name ?? "");
        const cOther = compareName ? calcForPharmacist(compareName) : null;

        return (
          <div key={u.id} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.textPrimary }}>📋 تفاصيل {u.name}</div>
                <button onClick={() => setExpandedTarget(null)} style={{ background: "transparent", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 13 }}>✕ إغلاق</button>
              </div>

              {c.target > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 12 }}>
                  <span style={{ color: COLORS.textDim }}>
                    المتوقع نهاية الشهر (Run Rate): <b style={{ color: COLORS.purple }}>{c.projected.toFixed(0)} ر.س</b>
                  </span>
                  <span style={{ fontWeight: 700 }}>{c.paceStatus}</span>
                </div>
              )}

              {/* ===== التحليل الفني ===== */}
              <div style={{ borderTop: "1px solid #161d30", paddingTop: 14 }}>
                <div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📊 التحليل الفني</div>
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
                    <div key={i} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                      <div style={{ color: COLORS.textDim, fontSize: 11 }}>{x.l}</div>
                      <div style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: 800, marginTop: 4 }}>{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== الأداء خلال الشهر ===== */}
              <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
                <div style={{ color: COLORS.green, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
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
                          background: d.amount > 0 ? COLORS.green : COLORS.border,
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                      <span style={{ fontSize: 8, color: COLORS.border, marginTop: 3 }}>{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ===== مقارنة عبر آخر 6 شهور ===== */}
              <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
                <div style={{ color: COLORS.purple, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                  📈 مقارنة الأداء عبر آخر 6 شهور
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
                  {yearTrend.map((m) => (
                    <div key={m.mKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 65 }}>
                        <div
                          title={`المحقق: ${m.achieved.toFixed(0)} ر.س`}
                          style={{ flex: 1, background: COLORS.blue, height: `${(m.achieved / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2 }}
                        />
                        {m.target > 0 && (
                          <div
                            title={`التارجت: ${m.target.toFixed(0)} ر.س`}
                            style={{ flex: 1, background: "#4a3a00", height: `${(m.target / maxYearly) * 65}px`, borderRadius: "3px 3px 0 0", minHeight: 2, border: "1px dashed #ffaa44" }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: 9, color: COLORS.textDim }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: COLORS.blue }}>■ المحقق</span>
                  <span style={{ fontSize: 11, color: COLORS.gold }}>▢ التارجت</span>
                </div>
              </div>

              {/* ===== مقارنة مع صيدلي آخر ===== */}
              {otherPharmacists.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "1px solid #161d30", paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700 }}>⚖️ مقارنة مع صيدلي آخر</div>
                    <select
                      value={compareName}
                      onChange={(e) => setCompareWith((p) => ({ ...p, [u.name]: e.target.value }))}
                      style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8, padding: "6px 10px", color: COLORS.textPrimary, fontSize: 12, outline: "none" }}
                    >
                      {otherPharmacists.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {cOther && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                        <div style={{ color: COLORS.blue, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{u.name}</div>
                        {[
                          ["المحقق", c.achieved.toFixed(0) + " ر.س"],
                          ["نسبة التارجت", c.target ? c.simplePct.toFixed(1) + "%" : "—"],
                          ["عدد الفواتير", c.invoiceCount],
                          ["متوسط الفاتورة", c.avgInvoiceValue.toFixed(0) + " ر.س"],
                          ["نسبة التسجيل على عملاء", c.customerRegRate.toFixed(0) + "%"],
                        ].map(([l, v], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: COLORS.textDim }}>{l}</span>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ color: COLORS.border, fontSize: 18, fontWeight: 900 }}>VS</div>

                      <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12 }}>
                        <div style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{compareName}</div>
                        {[
                          ["المحقق", cOther.achieved.toFixed(0) + " ر.س"],
                          ["نسبة التارجت", cOther.target ? cOther.simplePct.toFixed(1) + "%" : "—"],
                          ["عدد الفواتير", cOther.invoiceCount],
                          ["متوسط الفاتورة", cOther.avgInvoiceValue.toFixed(0) + " ر.س"],
                          ["نسبة التسجيل على عملاء", cOther.customerRegRate.toFixed(0) + "%"],
                        ].map(([l, v], i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: COLORS.textDim }}>{l}</span>
                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
  useEffect(() => {
    if (!pharmacyId) return;
    const alreadyClosed = (entries || []).some(
      (e) => e.date === today && e.pharmacy_id === pharmacyId && e.sub_type === "daily_closing"
    );
    if (alreadyClosed) { setClosingSaved(true); return; }
    supabase
      .from("treasury_entries")
      .select("id")
      .eq("pharmacy_id", pharmacyId)
      .eq("date", today)
      .eq("sub_type", "daily_closing")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setClosingSaved(true);
      });
  }, [entries, today, pharmacyId]);
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

  // ── حسابات المبيعات مقسمة ──
  const todaySales = sales.filter((s) => s.date === today && !s.returned);
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
  const openShifts = ((shifts || []).filter((s) => s.start_time?.startsWith(today))).filter((s) => !s.end_time);

  const saveClosing = async () => {
    // تحقق إن كل شفتات اليوم متقفلة
    if (openShifts.length > 0) {
      showToast(`❌ يوجد ${openShifts.length} شفت مفتوح — أقفل الشفتات أولاً`, "error");
      return;
    }
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
    await supabase.from("treasury_entries").insert({
      type: "closing", sub_type: "daily_closing", method: "نقدي",
      amount: 0, note: "تقفيل اليوم", date: today,
      pharmacy_id: pharmacyId, created_by: currentUser.name,
    });
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

  const cardStyle = (border = COLORS.border) => ({
    background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
  });
  const inputStyle = {
    background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 8,
    padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0a101a" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>💰 الخزنة</h2>
          <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>{today}</div>
        </div>
      </div>

      {/* ── رصيد الخزنة اللحظي ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "💵 نقدي", value: balanceCash, color: COLORS.green },
          { label: "💳 بطاقة", value: balanceCard, color: COLORS.blue },
          { label: "🏦 تحويل", value: balanceTransfer, color: COLORS.purple },
          { label: "📦 الإجمالي", value: balanceTotal, color: COLORS.gold },
        ].map((b) => (
          <div key={b.label} style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 4 }}>{b.label}</div>
            <div style={{ color: b.value < 0 ? COLORS.red : b.color, fontWeight: 900, fontSize: 18 }}>{b.value.toFixed(2)}</div>
            <div style={{ color: COLORS.border, fontSize: 10 }}>ر.س</div>
          </div>
        ))}
      </div>

      {/* تنبيهات */}
      {(dueFixed.length > 0 || upcomingLicenses.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: dueFixed.length > 0 && upcomingLicenses.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
          {dueFixed.length > 0 && (
            <div style={{ background: COLORS.goldSoft, border: "1px solid #4a2800", borderRadius: 12, padding: 12 }}>
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
            <div style={{ background: "#1a0a1a", border: "1px solid #4a1a4a", borderRadius: 12, padding: 12 }}>
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
          { k: "today", l: "📅 تقفيل اليوم" },
          { k: "shifts", l: "🔄 الشفتات" },
          { k: "history", l: "📋 السجل" },
          { k: "fixed", l: "🔒 مصاريف ثابتة" },
          { k: "licenses", l: "📄 التراخيص" },
        ].map((t) => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 8, border: "none",
            background: activeTab === t.k ? COLORS.surface : "transparent",
            color: activeTab === t.k ? COLORS.blue : COLORS.textDim,
            fontSize: 11, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ══════════ تقفيل اليوم ══════════ */}
      {activeTab === "today" && closingSaved && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 24, marginBottom: 8 }}>تم تقفيل يوم {today}</div>
          <div style={{ color: COLORS.textDim, fontSize: 14, marginBottom: 28 }}>جاهز لليوم التالي</div>
          <button
            onClick={() => setActiveTab("log")}
            style={{ background: COLORS.blueSoft, border: "1px solid #2a5aaa", borderRadius: 8, padding: "8px 20px", color: COLORS.blue, fontSize: 13, cursor: "pointer" }}
          >
            📋 عرض سجل الأيام
          </button>
        </div>
      )}

      {activeTab === "today" && !closingSaved && (
        <div>
          {/* تحذير الشفتات المفتوحة */}
          {openShifts.length > 0 && (
            <div style={{ background: "#2a1000", border: "1px solid #8a3000", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
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
                    style={{ background: "transparent", border: "1px solid #1d3a6a", borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                    {editingCard ? "إغلاق" : "تعديل"}
                  </button>
                </div>
              </div>
              {todayReturns > 0 && (
  <div style={rowStyle}>
    <span style={{ color: COLORS.textDim, fontSize: 13 }}>↩️ مرتجعات نقدي</span>
    <span style={{ color: COLORS.red, fontWeight: 700 }}>− {todayReturns.toFixed(2)} ر.س</span>
  </div>
)}
              {editingCard && (
                <div style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d3a6a", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={{ color: COLORS.red, fontSize: 13 }}>📋 مديونية اليوم (غير محصلة)</span>
              <span style={{ color: COLORS.red, fontWeight: 700 }}>{todayAjil.toFixed(2)} ر.س</span>
            </div>

            {/* دخل إضافي */}
            <div style={{ marginTop: 8, borderTop: "1px solid #1a3a1a", paddingTop: 10 }}>
              <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 6 }}>دخل إضافي (اختياري)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={closingForm.extra_income_note} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income_note: e.target.value }))}
                  placeholder="وصف الدخل..." style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={closingForm.extra_income} onChange={(e) => setClosingForm((p) => ({ ...p, extra_income: e.target.value }))}
                  placeholder="0.00" style={{ ...inputStyle, flex: 1, textAlign: "left" as const }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a3a1a" }}>
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
              style={{ background: COLORS.goldSoft, border: "1px dashed #3a1800", borderRadius: 8, padding: "7px 14px", color: COLORS.coral, cursor: "pointer", fontSize: 12, width: "100%", marginTop: 4 }}>
              + إضافة مصروف متغير
            </button>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a1000" }}>
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
            {!closingSaved && (
              <button
                onClick={saveClosing}
                disabled={openShifts.length > 0}
                style={{
                  background: openShifts.length > 0 ? COLORS.surfaceAlt : "#1a4a2a",
                  border: `1px solid ${openShifts.length > 0 ? COLORS.border : "#2a8a4a"}`,
                  borderRadius: 8, padding: "10px 20px",
                  color: openShifts.length > 0 ? COLORS.textDim : COLORS.green,
                  fontSize: 13, fontWeight: 700,
                  cursor: openShifts.length > 0 ? "not-allowed" : "pointer",
                  opacity: openShifts.length > 0 ? 0.5 : 1,
                }}
              >
                {openShifts.length > 0 ? `🔒 أقفل ${openShifts.length} شفت أولاً` : "✅ حفظ تقفيل اليوم"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ تاب الشفتات ══════════ */}
      {activeTab === "shifts" && (
        <div>
          {todayShifts.length === 0 ? (
            <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد شفتات اليوم</div>
          ) : (
            <>
              {todayShifts.map((sh) => {
                const ss = getShiftSales(sh.id);
                return (
                  <div key={sh.id} style={cardStyle("#1a2a3a")}>
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
                    { l: "الإجمالي", v: todayCash + todayCard + todayTransfer, c: COLORS.gold },
                  ].map((x) => (
                    <div key={x.l} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                      <div style={{ color: COLORS.textDim, fontSize: 10 }}>{x.l}</div>
                      <div style={{ color: x.c, fontWeight: 700, fontSize: 16 }}>{x.v.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
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
      {activeTab === "history" && (
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
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: "1px solid #0a101a", paddingTop: 10 }}>
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
      {activeTab === "fixed" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <Btn icon="plus" onClick={() => setShowFixedForm(true)}>إضافة مصروف ثابت</Btn>
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
          <button
            onClick={async () => {
              const { error } = await supabase.from("treasury_entries").insert([{
                type: "expense", sub_type: "fixed", method: "نقدي",
                amount: f.amount, note: f.name, date: today,
                pharmacy_id: pharmacyId, created_by: currentUser.name
              }]);
              if (error) { showToast("خطأ: " + error.message, "error"); return; }
              setEntries((p) => [...p, { type: "expense", sub_type: "fixed", method: "نقدي", amount: f.amount, note: f.name, date: today }]);
              showToast(`تم سداد ${f.name} ✓`);
            }}
            style={{ background: COLORS.greenSoft, border: "1px solid #2a6a2a", borderRadius: 8, padding: "6px 14px", color: COLORS.green, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            💳 سداد
          </button>
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
            ? <div style={{ color: COLORS.textDim, textAlign: "center" as const, padding: 40 }}>لا توجد تراخيص</div>
            : licenses.map((l) => {
                const days = Math.ceil((new Date(l.renew_date) - new Date()) / (1000 * 60 * 60 * 24));
                const urgent = days <= 14; const soon = days <= 60;
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
        <div style={{ color: COLORS.border, fontSize: 13, marginTop: 20 }}>نسبة الضريبة: 15% (VAT)</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1a3a1a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: COLORS.green, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="pos" s={16} /> ضريبة المبيعات (الضريبة المحصلة)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>إجمالي المبيعات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{salesSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{salesTax.toFixed(2)} ر.س</span>
            </div>
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral, fontSize: 12 }}>
                <span>قيمة مرتجعات المبيعات (قبل الضريبة)</span>
                <span>{salesReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtSalesReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral }}>
                <span>(–) ضريبة مرتجعات المبيعات</span>
                <span style={{ fontWeight: 700 }}>−{salesReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, borderTop: "1px solid #1d3a1d", paddingTop: 10 }}>
              <span>صافي ضريبة المخرجات</span>
              <span>{netSalesTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800 }}>
              <span>إجمالي المبيعات شامل الضريبة</span>
              <span>{salesTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a6a3a", fontSize: 12 }}>عدد الفواتير: {filtSales.length}{filtSalesReturns.length > 0 ? ` · مرتجعات: ${filtSalesReturns.length}` : ""}</div>
          </div>
        </div>
        <div style={{ background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1a2a3a", borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: COLORS.blue, display: "flex", alignItems: "center", gap: 8 }}>
            <IC n="purchase" s={16} /> ضريبة المشتريات (ضريبة المدخلات)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim }}>
              <span>إجمالي المشتريات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>{purchSubtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.blue }}>
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{purchTax.toFixed(2)} ر.س</span>
            </div>
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral, fontSize: 12 }}>
                <span>قيمة مرتجعات المشتريات (قبل الضريبة)</span>
                <span>{purchReturnsSubtotal.toFixed(2)} ر.س</span>
              </div>
            )}
            {filtPurchaseReturns.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.coral }}>
                <span>(–) ضريبة مرتجعات المشتريات</span>
                <span style={{ fontWeight: 700 }}>−{purchReturnsTax.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 10 }}>
              <span>صافي ضريبة المدخلات</span>
              <span>{netPurchTax.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800 }}>
              <span>إجمالي المشتريات شامل الضريبة</span>
              <span>{purchTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 12 }}>عدد الفواتير: {filtPurchases.length}{filtPurchaseReturns.length > 0 ? ` · مرتجعات: ${filtPurchaseReturns.length}` : ""}</div>
          </div>
        </div>
      </div>
      <div style={{ background: netTax > 0 ? "#0a1a0a" : COLORS.redSoft, border: `2px solid ${netTax > 0 ? "#1a6a1a" : "#6a1a1a"}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: netTax > 0 ? COLORS.green : COLORS.red }}>
          {netTax > 0 ? "✔️ ضريبة مستحقة الدفع" : "✔️ ضريبة مستردة"} — {quarter}
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي ضريبة المبيعات</div>
            <div style={{ color: COLORS.green, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netSalesTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي ضريبة المشتريات</div>
            <div style={{ color: COLORS.blue, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{netPurchTax.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: COLORS.textDim, fontSize: 13 }}>صافي الضريبة</div>
            <div style={{ color: netTax > 0 ? COLORS.green : COLORS.red, fontSize: 28, fontWeight: 900, marginTop: 4 }}>{netTax.toFixed(2)} ر.س</div>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 10, color: COLORS.textDim, fontSize: 13 }}>
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
            borderColor: type === t ? COLORS.blue : COLORS.border,
            background: type === t ? COLORS.blueSoft : "transparent",
            color: type === t ? COLORS.blue : COLORS.textDim,
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
            <StatCard label="إجمالي المبيعات (شامل الضريبة)" value={totalSalesRev.toFixed(2) + " ر.س"} icon="money" color={COLORS.blue} />
            <StatCard label="ضريبة المبيعات" value={totalSalesTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
            <StatCard label="عدد الفواتير" value={filteredSales.filter((s) => !s.returned).length} icon="pos" color={COLORS.purple} />
            <StatCard label="المرتجعات" value={returnedCount} icon="returns" color={COLORS.coral} />
          </div>
          <Table
            headers={["رقم الفاتورة", "التاريخ", "العميل", "المجموع", "الضريبة", "الإجمالي شامل الضريبة", "الدفع", "حالة"]}
            rows={filteredSales.map((s) => [
              <span onClick={() => setShowInvoiceDetail(s)} style={{ color: COLORS.blue, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{s.id}</span>,
              s.date,
              s.customer_name || "زبون عادي",
              (s.subtotal || 0).toFixed(2) + " ر.س",
              <span style={{ color: COLORS.green }}>{(s.taxAmount || s.tax_amount || 0).toFixed(2)} ر.س</span>,
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{(s.total || 0).toFixed(2)} ر.س</span>,
              s.payment,
              s.returned
                ? <Badge color={COLORS.redSoft} text={COLORS.red}>مرتجعة</Badge>
                : <Badge color={COLORS.greenSoft} text={COLORS.green}>مكتملة</Badge>,
            ])}
          />
          {filteredSales.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد فواتير مطابقة للبحث</div>}
        </>
      )}

      {/* تقرير المشتريات */}
      {type === "purchase" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="إجمالي المشتريات (شامل الضريبة)" value={totalPurchase.toFixed(2) + " ر.س"} icon="purchase" color={COLORS.coral} />
            <StatCard label="ضريبة المشتريات" value={totalPurchaseTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
            <StatCard label="عدد أوامر الشراء" value={filteredPurchases.length} icon="suppliers" color={COLORS.purple} />
          </div>
          <Table
            headers={["رقم الأمر", "التاريخ", "المورد", "المجموع", "الضريبة", "الإجمالي", "الحالة"]}
            rows={filteredPurchases.map((p) => [
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{p.id}</span>,
              p.date, p.supplierName,
              p.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: COLORS.green }}>{p.taxAmount.toFixed(2)} ر.س</span>,
              <span style={{ color: COLORS.coral, fontWeight: 700 }}>{p.total.toFixed(2)} ر.س</span>,
              <Badge color={COLORS.greenSoft} text={COLORS.green}>{p.status}</Badge>,
            ])}
          />
        </>
      )}

      {/* تقرير الأصناف */}
      {type === "product" && (
        <>
          {filterManufacturer && (
            <div style={{ background: COLORS.blueSoft, border: "1px solid #1d3a6a", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: COLORS.blue }}>
              🏭 تصفية بالشركة: {manufacturers.find((m) => m.id === filterManufacturer)?.name}
            </div>
          )}
          <Table
            headers={["الصنف", "الشركة المنتجة", "الكمية المباعة", "الإيراد قبل الضريبة", "الضريبة", "الإيراد الكلي"]}
            rows={Object.entries(productSales).sort((a, b) => b[1].revenue - a[1].revenue).map(([id, d]) => {
              const prod = products.find((p) => p.id === id);
              const mfr = manufacturers.find((m) => m.id === prod?.manufacturer_id);
              return [
                <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{d.name}</span>,
                mfr ? <Badge color={COLORS.blueSoft} text={COLORS.blue}>{mfr.name}</Badge> : <span style={{ color: COLORS.border, fontSize: 11 }}>—</span>,
                <span style={{ color: COLORS.blue, fontWeight: 700 }}>{d.qty}</span>,
                d.revenue.toFixed(2) + " ر.س",
                <span style={{ color: COLORS.green }}>{d.tax.toFixed(2)} ر.س</span>,
                <span style={{ color: COLORS.green, fontWeight: 700 }}>{(d.revenue + d.tax).toFixed(2)} ر.س</span>,
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
            <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{m}</span>,
            d.count,
            d.subtotal.toFixed(2) + " ر.س",
            <span style={{ color: COLORS.green }}>{d.tax.toFixed(2)} ر.س</span>,
            <span style={{ color: COLORS.blue, fontWeight: 700 }}>{d.total.toFixed(2)} ر.س</span>,
          ])}
        />
      )}

      {/* تقرير المرتجعات */}
      {type === "returns" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="عدد المرتجعات" value={filteredReturns.length} icon="returns" color={COLORS.coral} />
            <StatCard label="مرتجعات المبيعات" value={totalReturnsSales.toFixed(2) + " ر.س"} icon="pos" color={COLORS.blue} />
            <StatCard label="مرتجعات المشتريات" value={totalReturnsPurchases.toFixed(2) + " ر.س"} icon="purchase" color={COLORS.coral} />
            <StatCard label="الضريبة المستردة" value={totalReturnsTax.toFixed(2) + " ر.س"} icon="tax" color={COLORS.green} />
          </div>
          <Table
            headers={["رقم المرتجع", "التاريخ", "النوع", "العميل / المورد", "السبب", "الإجمالي"]}
            rows={filteredReturns.sort((a, b) => new Date(b.date) - new Date(a.date)).map((r) => [
              <span style={{ color: COLORS.blue, fontWeight: 700 }}>{r.id}</span>,
              r.date,
              r.type === "sales"
                ? <Badge color="#0a2040" text={COLORS.blue}>مرتجع مبيعات</Badge>
                : <Badge color={COLORS.goldSoft} text={COLORS.coral}>مرتجع مشتريات</Badge>,
              r.type === "sales" ? (r.customer_name || "زبون عادي") : (r.supplier_name || "—"),
              <span>{r.reason || "—"}{isAutoReturn(r) && <span style={{ marginRight: 6 }}><Badge color={COLORS.redSoft} text={COLORS.coral}>تلقائي</Badge></span>}</span>,
              <span style={{ color: COLORS.coral, fontWeight: 700 }}>{(r.total || 0).toFixed(2)} ر.س</span>,
            ])}
          />
          {filteredReturns.length === 0 && <div style={{ textAlign: "center", color: COLORS.textDim, padding: 30 }}>لا توجد مرتجعات في هذه الفترة</div>}
        </>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {showInvoiceDetail && (
        <Modal open title={`تفاصيل الفاتورة — ${showInvoiceDetail.id}`} onClose={() => setShowInvoiceDetail(null)} wide>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 13, color: COLORS.textDim }}>
            <span>التاريخ: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.date}</span></span>
            <span>العميل: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.customer_name || "زبون عادي"}</span></span>
            <span>طريقة الدفع: <span style={{ color: COLORS.textPrimary }}>{showInvoiceDetail.payment}</span></span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: COLORS.textDim, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showInvoiceDetail.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }}>{item.name}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13, textAlign: "center" }}>{item.qty}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textDim, fontSize: 13, textAlign: "center" }}>{item.price}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, textAlign: "center", fontWeight: 700 }}>{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 5 }}>
              <span>قبل الضريبة</span><span>{(showInvoiceDetail.subtotal || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, marginBottom: 5 }}>
              <span>الضريبة</span><span>{(showInvoiceDetail.taxAmount || showInvoiceDetail.tax_amount || 0).toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontWeight: 800, fontSize: 16, borderTop: "1px solid #1d2d4a", paddingTop: 8 }}>
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
function ShiftModule({ shifts, setShifts, sales, currentUser, showToast, pharmacyId, invoices }) {
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

  // ✅ تسجيل حضور تلقائي
  const today = new Date().toISOString().split("T")[0];
  const existing = await supabase
    .from("attendance_logs")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("pharmacist_name", currentUser.name)
    .eq("date", today)
    .is("check_out", null)
    .maybeSingle();

  if (!existing.data) {
  const { error: attError } = await supabase
    .from("attendance_logs")
    .insert({
      pharmacy_id: pharmacyId,
      pharmacist_name: currentUser.name,
      date: today,
      shift_id: sh.id,
      check_in: new Date().toISOString(),
    });
  if (attError) showToast("خطأ في تسجيل الحضور: " + attError.message, "error");
  else showToast("تم فتح الشفت وتسجيل الحضور ✓");
} else {
  showToast("تم فتح الشفت ✓");
}

  showToast("تم فتح الشفت ✓");
};
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
    p.map((s) => (s.id === currentShift.id ? { ...s, ...updates } : s))
  );

  // ✅ تسجيل انصراف تلقائي
  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("attendance_logs")
    .update({ check_out: new Date().toISOString() })
    .eq("pharmacy_id", pharmacyId)
    .eq("pharmacist_name", currentUser.name)
    .eq("date", today)
    .is("check_out", null);

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
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
              color: COLORS.textPrimary,
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
            background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
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
        ])}
      />
    </div>
  );
}
// ── helpers ──────────────────────────────────────────────────────────────────
function isRamadan() {
  const now = new Date();
  const ranges = [
    { start: new Date("2025-03-01"), end: new Date("2025-03-30") },
    { start: new Date("2026-02-18"), end: new Date("2026-03-19") },
  ];
  return ranges.some((r) => now >= r.start && now <= r.end);
}

function fmt(ts: string | null) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function diffMin(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function fmtHours(h: number) {
  if (!h && h !== 0) return "٠:٠٠";
  const hrs = Math.floor(Math.abs(h));
  const mins = Math.round((Math.abs(h) - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, "0")}`;
}

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const API_KEY_MAP: Record<string, string> = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
const ACTIVE_PRAYERS = ["الظهر", "العصر", "المغرب", "العشاء"];

async function fetchPrayerTimes() {
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const url = `https://api.aladhan.com/v1/timings/${today}?latitude=24.7136&longitude=46.6753&method=4`;
  const res = await fetch(url);
  const json = await res.json();
  const timings = json.data.timings;
  const result: Record<string, string> = {};
  Object.entries(API_KEY_MAP).forEach(([en, ar]) => {
    if (!ACTIVE_PRAYERS.includes(ar)) return;
    const [h, m] = (timings[en] as string).split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    result[ar] = d.toISOString();
  });
  if (new Date().getDay() === 5 && result["الظهر"]) {
    result["الجمعة"] = result["الظهر"];
    delete result["الظهر"];
  }
  return result;
}
// ══════════════════════════════════════════════════════
// Component منفصل — ضعه خارج AttendanceModule
// ══════════════════════════════════════════════════════
function WorkScheduleTab({ pharmacists, workSchedules, pharmacyId, todayDow, C, onSaved, globalToast }: any) {
  const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const [selectedPharmacist, setSelectedPharmacist] = useState("");
  const [saving, setSaving] = useState(false);

  // بناء جدول افتراضي أسبوعي
  const emptyWeek = () =>
    Array.from({ length: 7 }, (_, dow) => ({
      day_of_week: dow,
      is_off: dow === 6, // السبت إجازة افتراضياً
      shifts: [
        { shift_number: 1, shift_start: "09:00", shift_end: "21:00", enabled: true },
        { shift_number: 2, shift_start: "15:00", shift_end: "21:00", enabled: false },
      ],
    }));

  const [weekForm, setWeekForm] = useState<any[]>(emptyWeek());

  // لما يختار صيدلي، يحمّل جدوله الموجود
  useEffect(() => {
    if (!selectedPharmacist) { setWeekForm(emptyWeek()); return; }
    const pharmSchedules = workSchedules.filter((s: any) => s.pharmacist_name === selectedPharmacist);
    if (pharmSchedules.length === 0) { setWeekForm(emptyWeek()); return; }

    const newWeek = emptyWeek().map((day) => {
      const daySchedules = pharmSchedules.filter((s: any) => s.day_of_week === day.day_of_week);
      if (daySchedules.length === 0) return day;

      const isOff = daySchedules.every((s: any) => s.is_off);
      const sh1 = daySchedules.find((s: any) => s.shift_number === 1);
      const sh2 = daySchedules.find((s: any) => s.shift_number === 2);

      return {
        ...day,
        is_off: isOff,
        shifts: [
          { shift_number: 1, shift_start: sh1?.shift_start || "09:00", shift_end: sh1?.shift_end || "21:00", enabled: !!sh1 && !isOff },
          { shift_number: 2, shift_start: sh2?.shift_start || "15:00", shift_end: sh2?.shift_end || "21:00", enabled: !!sh2 && !isOff },
        ],
      };
    });
    setWeekForm(newWeek);
  }, [selectedPharmacist, workSchedules]);

  const updateDay = (dow: number, field: string, value: any) => {
    setWeekForm((prev) => prev.map((d) => d.day_of_week === dow ? { ...d, [field]: value } : d));
  };

  const updateShift = (dow: number, shiftNum: number, field: string, value: any) => {
    setWeekForm((prev) => prev.map((d) =>
      d.day_of_week === dow
        ? { ...d, shifts: d.shifts.map((s: any) => s.shift_number === shiftNum ? { ...s, [field]: value } : s) }
        : d
    ));
  };

  const saveWeekSchedule = async () => {
    if (!selectedPharmacist) { globalToast("اختر الصيدلي أولاً"); return; }
    setSaving(true);

    // حذف الجدول القديم للصيدلي
    await supabase.from("work_schedules").delete()
      .eq("pharmacy_id", pharmacyId)
      .eq("pharmacist_name", selectedPharmacist);

    // بناء الصفوف الجديدة
    const rows: any[] = [];
    weekForm.forEach((day) => {
      if (day.is_off) {
        // يوم إجازة — صف واحد
        rows.push({
          pharmacy_id: pharmacyId,
          pharmacist_name: selectedPharmacist,
          day_of_week: day.day_of_week,
          shift_number: 1,
          shift_start: null,
          shift_end: null,
          is_off: true,
        });
      } else {
        day.shifts.forEach((sh: any) => {
          if (!sh.enabled) return;
          rows.push({
            pharmacy_id: pharmacyId,
            pharmacist_name: selectedPharmacist,
            day_of_week: day.day_of_week,
            shift_number: sh.shift_number,
            shift_start: sh.shift_start,
            shift_end: sh.shift_end,
            is_off: false,
          });
        });
      }
    });

    if (rows.length === 0) { globalToast("لا يوجد بيانات للحفظ"); setSaving(false); return; }

    const { error } = await supabase.from("work_schedules").insert(rows);
    setSaving(false);

    if (error) { globalToast("خطأ في الحفظ: " + error.message); return; }
    globalToast(`✓ تم حفظ جدول ${selectedPharmacist}`);
    onSaved();
  };

  const inputStyle: React.CSSProperties = {
    background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 7,
    padding: "5px 8px", color: C.text, fontSize: 12, outline: "none",
  };

  // حساب إجمالي ساعات الأسبوع
  const weeklyHours = weekForm.reduce((total, day) => {
    if (day.is_off) return total;
    return total + day.shifts.filter((s: any) => s.enabled).reduce((sum: number, s: any) => {
      const [sh, sm] = s.shift_start.split(":").map(Number);
      const [eh, em] = s.shift_end.split(":").map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0);
  }, 0);

  return (
    <div>
      {/* اختيار الصيدلي */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>👤 الصيدلي:</label>
          <select
            value={selectedPharmacist}
            onChange={(e) => setSelectedPharmacist(e.target.value)}
            style={{ ...inputStyle, minWidth: 180, padding: "8px 12px", fontSize: 13 }}
          >
            <option value="">اختر صيدلي...</option>
            {pharmacists.map((n: string) => <option key={n} value={n}>{n}</option>)}
          </select>
          {selectedPharmacist && (
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.muted }}>
                إجمالي الأسبوع:
                <strong style={{ color: C.accent, marginRight: 4 }}>{weeklyHours.toFixed(1)} ساعة</strong>
              </span>
              <button
                onClick={saveWeekSchedule}
                disabled={saving}
                style={{ background: COLORS.greenSoft, border: "1px solid #1a5a30", borderRadius: 8, padding: "8px 20px", color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "جاري الحفظ..." : "💾 حفظ الجدول"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* جدول الأسبوع */}
      {selectedPharmacist && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {weekForm.map((day) => {
            const isToday = day.day_of_week === todayDow;
            const dayHours = day.is_off ? 0 : day.shifts.filter((s: any) => s.enabled).reduce((sum: number, s: any) => {
              const [sh, sm] = s.shift_start.split(":").map(Number);
              const [eh, em] = s.shift_end.split(":").map(Number);
              return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
            }, 0);

            return (
              <div key={day.day_of_week} style={{
                borderBottom: `1px solid ${C.border}`,
                background: isToday ? COLORS.surfaceAlt : "transparent",
                padding: "12px 16px",
              }}>
                {/* رأس اليوم */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: day.is_off ? 0 : 10 }}>
                  <div style={{ width: 80, fontWeight: 700, color: isToday ? C.accent : C.text, fontSize: 13 }}>
                    {DAY_NAMES[day.day_of_week]}
                    {isToday && <span style={{ fontSize: 10, color: C.accent, marginRight: 4 }}>← اليوم</span>}
                  </div>

                  {/* زر إجازة */}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: day.is_off ? C.orange : C.muted }}>
                    <input
                      type="checkbox"
                      checked={day.is_off}
                      onChange={(e) => updateDay(day.day_of_week, "is_off", e.target.checked)}
                      style={{ width: 14, height: 14 }}
                    />
                    إجازة
                  </label>

                  {!day.is_off && (
                    <span style={{ marginRight: "auto", fontSize: 11, color: C.muted }}>
                      {dayHours > 0 ? `${dayHours.toFixed(1)} ساعة` : ""}
                    </span>
                  )}
                </div>

                {/* الشفتات */}
                {!day.is_off && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 16 }}>
                    {day.shifts.map((sh: any) => (
                      <div key={sh.shift_number} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* تفعيل الشفت */}
                        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", minWidth: 68, fontSize: 12, color: sh.enabled ? C.text : C.muted }}>
                          <input
                            type="checkbox"
                            checked={sh.enabled}
                            onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "enabled", e.target.checked)}
                            style={{ width: 13, height: 13 }}
                          />
                          شفت {sh.shift_number}
                        </label>

                        {sh.enabled && (
                          <>
                            <span style={{ fontSize: 11, color: C.muted }}>من</span>
                            <input
                              type="time"
                              value={sh.shift_start}
                              onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "shift_start", e.target.value)}
                              style={{ ...inputStyle, width: 100 }}
                            />
                            <span style={{ fontSize: 11, color: C.muted }}>إلى</span>
                            <input
                              type="time"
                              value={sh.shift_end}
                              onChange={(e) => updateShift(day.day_of_week, sh.shift_number, "shift_end", e.target.value)}
                              style={{ ...inputStyle, width: 100 }}
                            />
                            <span style={{ fontSize: 11, color: C.muted }}>
                              {(() => {
                                const [sh_h, sh_m] = sh.shift_start.split(":").map(Number);
                                const [eh, em] = sh.shift_end.split(":").map(Number);
                                const h = ((eh * 60 + em) - (sh_h * 60 + sh_m)) / 60;
                                return h > 0 ? `${h.toFixed(1)} س` : "";
                              })()}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {day.is_off && (
                  <div style={{ paddingRight: 16, fontSize: 12, color: C.orange }}>🏖️ يوم إجازة</div>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: "12px 16px", background: C.bg2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.muted }}>
              إجمالي ساعات الأسبوع:
              <strong style={{ color: C.accent, marginRight: 6 }}>{weeklyHours.toFixed(1)} ساعة</strong>
            </span>
            <button
              onClick={saveWeekSchedule}
              disabled={saving}
              style={{ background: COLORS.greenSoft, border: "1px solid #1a5a30", borderRadius: 8, padding: "9px 24px", color: C.green, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "جاري الحفظ..." : "💾 حفظ جدول الأسبوع"}
            </button>
          </div>
        </div>
      )}

      {/* عرض جداول الصيادلة الموجودة */}
      {workSchedules.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>📋 الجداول المحفوظة</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[...new Set(workSchedules.map((s: any) => s.pharmacist_name))].map((name: any) => {
              const pharmSchedules = workSchedules.filter((s: any) => s.pharmacist_name === name && !s.is_off);
              const totalHours = pharmSchedules.reduce((sum: number, s: any) => {
                if (!s.shift_start || !s.shift_end) return sum;
                const [sh, sm] = s.shift_start.split(":").map(Number);
                const [eh, em] = s.shift_end.split(":").map(Number);
                return sum + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
              }, 0);
              return (
                <div
                  key={name}
                  onClick={() => setSelectedPharmacist(name)}
                  style={{ background: selectedPharmacist === name ? COLORS.blueSoft : C.bg, border: `1px solid ${selectedPharmacist === name ? C.accent : C.border}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{totalHours.toFixed(0)} ساعة / أسبوع</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
function AttendanceModule({ pharmacyId, shifts, setShifts, currentUser, showToast: globalToast }: {
  pharmacyId: string;
  shifts: any[];
  setShifts: (fn: any) => void;
  currentUser: any;
  showToast: (msg: string, type?: string) => void;
}) {
  const [tab, setTab] = useState<"attendance" | "schedule" | "settings" | "report" | "monthly">("attendance");
  const [pharmacists, setPharmacists] = useState<string[]>([]);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string>>({});
  const [prayerSettings, setPrayerSettings] = useState<any[]>([]);
  const [prayerBreaks, setPrayerBreaks] = useState<any[]>([]);
  const [activePrayerPopup, setActivePrayerPopup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState<any>({ pharmacist_name: "", day_of_week: 0, shift_number: 1, shift_start: "09:00", shift_end: "21:00", is_off: false });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const ramadan = isRamadan();
  const intervalRef = useRef<any>(null);

  const today = new Date().toISOString().split("T")[0];
  const todayDow = new Date().getDay();

  // ── ألوان النظام الداكن ──
  const C = {
    bg: COLORS.surface, bg2: COLORS.surfaceAlt, border: COLORS.border,
    text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue,
    green: COLORS.green, red: COLORS.red, orange: COLORS.gold, purple: COLORS.purple,
  };

  useEffect(() => { if (pharmacyId) loadAll(); }, [pharmacyId]);

  useEffect(() => {
    intervalRef.current = setInterval(checkPrayerAlerts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPharmacists(), loadTodayLogs(), loadPrayerSettings(), loadPrayerBreaks(), loadWorkSchedules()]);
    try {
      const pt = await fetchPrayerTimes();
      setPrayerTimes(pt);
    } catch {
      globalToast("تعذّر تحميل مواقيت الصلاة", "error");
    }
    setLoading(false);
  }

  async function loadPharmacists() {
    const { data } = await supabase.from("users").select("name").eq("pharmacy_id", pharmacyId).eq("role", "pharmacist").order("name");
    if (data) setPharmacists(data.map((p: any) => p.name));
  }

  async function loadTodayLogs() {
    const { data } = await supabase.from("attendance_logs").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("check_in");
    if (data) setTodayLogs(data);
  }

  async function loadPrayerSettings() {
    const { data } = await supabase.from("prayer_settings").select("*").eq("pharmacy_id", pharmacyId).order("id");
    if (data) setPrayerSettings(data);
  }

  async function loadPrayerBreaks() {
    const { data } = await supabase.from("prayer_breaks").select("*").eq("pharmacy_id", pharmacyId).eq("date", today).order("prayer_time");
    if (data) setPrayerBreaks(data);
  }

  async function loadWorkSchedules() {
    const { data } = await supabase.from("work_schedules").select("*").eq("pharmacy_id", pharmacyId).order("pharmacist_name");
    if (data) setWorkSchedules(data);
  }

  async function loadReport(date: string) {
    const { data } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).eq("date", date).order("check_in");
    if (data) setReportLogs(data);
  }

  async function loadMonthlyReport(month: string) {
    const { data } = await supabase.from("attendance_logs").select("*, prayer_breaks(*)").eq("pharmacy_id", pharmacyId).gte("date", month + "-01").lte("date", month + "-31").order("date");
    if (data) setMonthlyLogs(data);
  }

  // ── منطق جدول الدوام: إيجاد الشفت المتوقع للصيدلي الآن ──
  function getExpectedShift(pharmacistName: string, dow: number, shiftNumber: number) {
    return workSchedules.find(
      (s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && s.shift_number === shiftNumber && !s.is_off
    );
  }

  function getCurrentShiftNumber(pharmacistName: string) {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todaySchedules = workSchedules.filter((s) => s.pharmacist_name === pharmacistName && s.day_of_week === todayDow && !s.is_off);
    for (const s of todaySchedules) {
      if (nowTime >= s.shift_start && nowTime <= s.shift_end) return s.shift_number;
    }
    // لو مش في وقت شفت، رجّع أقرب شفت
    if (todaySchedules.length > 0) return todaySchedules[0].shift_number;
    return 1;
  }

  function calcLateMinutes(pharmacistName: string, shiftNum: number, checkInTime: string) {
    const schedule = getExpectedShift(pharmacistName, new Date(checkInTime).getDay(), shiftNum);
    if (!schedule) return 0;
    const [expH, expM] = schedule.shift_start.split(":").map(Number);
    const expected = new Date(checkInTime);
    expected.setHours(expH, expM, 0, 0);
    const actual = new Date(checkInTime);
    const diff = Math.round((actual.getTime() - expected.getTime()) / 60000);
    return Math.max(0, diff);
  }

  // ── حضور (مرتبط بالشفت) ──
  async function handleCheckIn(pharmacistName: string) {
    const shiftNum = getCurrentShiftNumber(pharmacistName);
    const existing = todayLogs.find((l) => l.pharmacist_name === pharmacistName && l.shift_number === shiftNum && !l.check_out);
    if (existing) { globalToast(`${pharmacistName} مسجّل بالفعل في شفت ${shiftNum}`, "warn"); return; }

    // إيجاد الشفت المفتوح للمستخدم الحالي
    const openShift = shifts.find((s) => !s.end_time && s.user === pharmacistName);
    const schedule = getExpectedShift(pharmacistName, todayDow, shiftNum);
    const lateMin = calcLateMinutes(pharmacistName, shiftNum, new Date().toISOString());

    const { error } = await supabase.from("attendance_logs").insert({
      pharmacy_id: pharmacyId,
      pharmacist_name: pharmacistName,
      date: today,
      check_in: new Date().toISOString(),
      shift_id: openShift?.id || null,
      shift_number: shiftNum,
      expected_start: schedule?.shift_start || null,
      late_minutes: lateMin,
    });

    if (!error) {
      if (lateMin > 0) globalToast(`⚠️ ${pharmacistName} تأخر ${lateMin} دقيقة`, "warn");
      else globalToast(`✅ تم تسجيل حضور ${pharmacistName} - شفت ${shiftNum}`);
      loadTodayLogs();
    }
  }

  // ── انصراف (مرتبط بقفل الشفت) ──
  async function handleCheckOut(log: any) {
    const now = new Date();
    const totalMinutes = diffMin(log.check_in, now.toISOString());
    const totalHours = totalMinutes / 60;
    const myBreaks = prayerBreaks.filter((b) => b.attendance_id === log.id);
    const totalDeductions = myBreaks.reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0) / 60;
    const netHours = Math.max(0, totalHours - totalDeductions);

    const { error } = await supabase.from("attendance_logs").update({
      check_out: now.toISOString(),
      total_hours: +totalHours.toFixed(2),
      total_deductions: +totalDeductions.toFixed(2),
      net_hours: +netHours.toFixed(2),
    }).eq("id", log.id).eq("pharmacy_id", pharmacyId);

    if (!error) {
      globalToast(`✅ تم تسجيل انصراف ${log.pharmacist_name}`);
      loadTodayLogs();
    }
  }

  // ── حفظ جدول دوام ──
  async function saveSchedule() {
    if (!scheduleForm.pharmacist_name) { globalToast("اختر الصيدلي", "error"); return; }
    const { error } = await supabase.from("work_schedules").upsert({
      ...scheduleForm,
      pharmacy_id: pharmacyId,
      shift_start: scheduleForm.is_off ? null : scheduleForm.shift_start,
      shift_end: scheduleForm.is_off ? null : scheduleForm.shift_end,
    }, { onConflict: "pharmacy_id,pharmacist_name,day_of_week,shift_number" });
    if (!error) {
      globalToast("تم حفظ جدول الدوام ✓");
      loadWorkSchedules();
      setShowScheduleForm(false);
    } else globalToast("خطأ: " + error.message, "error");
  }

  async function deleteSchedule(id: string) {
    await supabase.from("work_schedules").delete().eq("id", id);
    loadWorkSchedules();
    globalToast("تم الحذف ✓");
  }

  const checkPrayerAlerts = useCallback(() => {
    const now = new Date();
    Object.entries(prayerTimes).forEach(([name, isoTime]) => {
      const setting = prayerSettings.find((s) => s.prayer_name === name);
      if (!setting?.is_active) return;
      const pTime = new Date(isoTime);
      const allowed = ramadan ? setting.ramadan_allowed_minutes : setting.allowed_minutes;
      const minutesAfter = (now.getTime() - pTime.getTime()) / 60000;
      if (minutesAfter >= 1 && minutesAfter <= allowed + 5) {
        todayLogs.forEach((log) => {
          if (!log.check_out) {
            const existing = prayerBreaks.find((b) => b.prayer_name === name && b.pharmacist_name === log.pharmacist_name);
            if (!existing) setActivePrayerPopup({ prayer: name, prayerTime: isoTime, log, allowed });
          }
        });
      }
    });
  }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks, ramadan]);

  async function handlePrayerReturn(popup: any) {
    const now = new Date();
    const allowed = popup.allowed;
    const actualMin = diffMin(popup.prayerTime, now.toISOString());
    const deducted = Math.max(0, actualMin - allowed);
    const { error } = await supabase.from("prayer_breaks").insert({
      pharmacy_id: pharmacyId, attendance_id: popup.log.id,
      pharmacist_name: popup.log.pharmacist_name, date: today,
      prayer_name: popup.prayer, prayer_time: popup.prayerTime,
      return_time: now.toISOString(), allowed_minutes: allowed,
      actual_minutes: actualMin, deducted_minutes: deducted,
    });
    if (!error) {
      if (deducted > 0) globalToast(`⚠️ تأخير ${deducted} دقيقة بعد ${popup.prayer}`, "warn");
      else globalToast(`✅ عودة ${popup.log.pharmacist_name} بعد صلاة ${popup.prayer}`);
      setActivePrayerPopup(null);
      loadPrayerBreaks();
    }
  }

  // ── حساب التقرير الشهري لكل صيدلي ──
  function calcMonthlyStats(pharmacistName: string) {
    const logs = monthlyLogs.filter((l) => l.pharmacist_name === pharmacistName);
    const totalNet = logs.reduce((s, l) => s + (l.net_hours || 0), 0);
    const totalLate = logs.reduce((s, l) => s + (l.late_minutes || 0), 0);
    const daysWorked = logs.filter((l) => l.check_out).length;

    // حساب الساعات المطلوبة من جدول الدوام
    const year = parseInt(selectedMonth.split("-")[0]);
    const month = parseInt(selectedMonth.split("-")[1]) - 1;
    let requiredHours = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const daySchedules = workSchedules.filter((s) => s.pharmacist_name === pharmacistName && s.day_of_week === dow && !s.is_off);
      daySchedules.forEach((s) => {
        const [sh, sm] = s.shift_start.split(":").map(Number);
        const [eh, em] = s.shift_end.split(":").map(Number);
        requiredHours += (eh * 60 + em - (sh * 60 + sm)) / 60;
      });
    }

    return { totalNet, totalLate, daysWorked, requiredHours };
  }

  const uniquePharmacists = [...new Set(monthlyLogs.map((l) => l.pharmacist_name))];

  // ── جدول الدوام مجمّع لكل صيدلي ──
  const scheduleByPharmacist: Record<string, any[]> = {};
  workSchedules.forEach((s) => {
    if (!scheduleByPharmacist[s.pharmacist_name]) scheduleByPharmacist[s.pharmacist_name] = [];
    scheduleByPharmacist[s.pharmacist_name].push(s);
  });

  const cardStyle: React.CSSProperties = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const inputStyle: React.CSSProperties = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  if (loading) return <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>جاري التحميل...</div>;

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🕐 الحضور والانصراف</h2>
        <div style={{ fontSize: 12, color: C.muted }}>
          {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {ramadan && <span style={{ marginRight: 8, background: "#f59e0b22", color: COLORS.gold, borderRadius: 4, padding: "2px 8px" }}>🌙 رمضان</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.bg2, borderRadius: 10, padding: 4 }}>
        {[
          { k: "attendance", l: "📋 الحضور" },
          { k: "schedule",   l: "📅 جدول الدوام" },
          { k: "settings",   l: "⚙️ الصلوات" },
          { k: "report",     l: "📊 تقرير يومي" },
          { k: "monthly",    l: "📈 تقرير شهري" },
        ].map((t) => (
          <button key={t.k} onClick={() => {
            setTab(t.k as any);
            if (t.k === "report") loadReport(selectedDate);
            if (t.k === "monthly") loadMonthlyReport(selectedMonth);
          }} style={{
            flex: 1, padding: "9px 4px", borderRadius: 8, border: "none",
            background: tab === t.k ? C.bg : "transparent",
            color: tab === t.k ? C.accent : C.muted,
            fontSize: 11, fontWeight: tab === t.k ? 700 : 400, cursor: "pointer",
          }}>{t.l}</button>
        ))}
      </div>

      {/* ════ TAB: ATTENDANCE ════ */}
      {tab === "attendance" && (
        <div>
          {/* مواقيت الصلاة */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.accent, marginBottom: 10 }}>🕌 مواقيت الصلاة</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(prayerTimes).length === 0
                ? <span style={{ color: C.muted, fontSize: 12 }}>جاري تحميل المواقيت...</span>
                : Object.entries(prayerTimes).map(([name, time]) => {
                  const setting = prayerSettings.find((s) => s.prayer_name === name);
                  const allowed = ramadan ? setting?.ramadan_allowed_minutes : setting?.allowed_minutes;
                  return (
                    <div key={name} style={{ background: C.bg2, border: `1px solid ${setting?.is_active ? "#1a4a8a" : C.border}`, borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 85 }}>
                      <div style={{ fontSize: 11, color: C.muted }}>{name}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{fmt(time)}</div>
                      {setting?.is_active && <div style={{ fontSize: 10, color: C.green }}>مسموح: {allowed} د</div>}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* تسجيل الحضور */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>👤 تسجيل الحضور</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pharmacists.map((name) => {
                const shiftNum = getCurrentShiftNumber(name);
                const activeLog = todayLogs.find((l) => l.pharmacist_name === name && l.shift_number === shiftNum && !l.check_out);
                const doneLog = todayLogs.find((l) => l.pharmacist_name === name && l.shift_number === shiftNum && l.check_out);
                const schedule = getExpectedShift(name, todayDow, shiftNum);

                return (
                  <div key={name} style={{ background: C.bg2, border: `1px solid ${activeLog ? "#1a5a3a" : doneLog ? "#1a3a5a" : C.border}`, borderRadius: 10, padding: "12px 16px", minWidth: 160 }}>
                    <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{name}</div>
                    {schedule && (
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                        شفت {shiftNum}: {schedule.shift_start} - {schedule.shift_end}
                      </div>
                    )}
                    {!activeLog && !doneLog && (
                      <button onClick={() => handleCheckIn(name)} style={{ background: COLORS.greenSoft, border: "1px solid #1a5a30", borderRadius: 7, padding: "6px 14px", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                        ✅ تسجيل حضور
                      </button>
                    )}
                    {activeLog && (
                      <div>
                        <div style={{ fontSize: 11, color: C.green, marginBottom: 6 }}>🟢 حضر {fmt(activeLog.check_in)}</div>
                        {activeLog.late_minutes > 0 && <div style={{ fontSize: 11, color: C.orange, marginBottom: 6 }}>⚠️ تأخر {activeLog.late_minutes} دقيقة</div>}
                        <button onClick={() => handleCheckOut(activeLog)} style={{ background: COLORS.redSoft, border: "1px solid #5a1a1a", borderRadius: 7, padding: "6px 14px", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                          🔴 تسجيل انصراف
                        </button>
                      </div>
                    )}
                    {doneLog && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        <div>🟢 {fmt(doneLog.check_in)}</div>
                        <div>🔴 {fmt(doneLog.check_out)}</div>
                        <div style={{ color: C.accent, fontWeight: 700 }}>صافي: {fmtHours(doneLog.net_hours)} س</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* سجل اليوم */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>📋 سجل اليوم</div>
            {todayLogs.length === 0
              ? <div style={{ color: C.muted, textAlign: "center", padding: 30 }}>لا يوجد حضور مسجّل اليوم</div>
              : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["الصيدلي", "شفت", "الحضور", "التأخير", "الانصراف", "ساعات", "خصومات", "صافي"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "center", color: C.muted, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.map((log) => {
                      const myBreaks = prayerBreaks.filter((b) => b.attendance_id === log.id);
                      const liveDeductions = myBreaks.reduce((s: number, b: any) => s + (b.deducted_minutes || 0), 0);
                      const liveTotal = log.check_out ? log.total_hours : diffMin(log.check_in, new Date().toISOString()) / 60;
                      const liveNet = Math.max(0, liveTotal - liveDeductions / 60);
                      return (
                        <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                          <td style={{ padding: "10px", fontWeight: 700, color: C.text }}>{log.pharmacist_name}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: C.muted }}>{log.shift_number || 1}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                            {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", color: log.check_out ? C.red : C.muted }}>{fmt(log.check_out)}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{fmtHours(liveTotal)}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: liveDeductions > 0 ? C.red : C.muted }}>
                            {liveDeductions > 0 ? `-${liveDeductions} د` : "—"}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: C.accent }}>{fmtHours(liveNet)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

            {/* فترات الصلاة */}
            {prayerBreaks.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>🕌 فترات الصلاة</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {prayerBreaks.map((b) => (
                    <div key={b.id} style={{ background: b.deducted_minutes > 0 ? "#2a1000" : COLORS.greenSoft, border: `1px solid ${b.deducted_minutes > 0 ? "#5a2000" : "#1a5a30"}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                      <strong style={{ color: C.text }}>{b.pharmacist_name}</strong>
                      <span style={{ color: C.muted }}> – {b.prayer_name} · {fmt(b.prayer_time)} ← {fmt(b.return_time)}</span>
                      {b.deducted_minutes > 0
                        ? <span style={{ color: C.red }}> ⚠️ خصم {b.deducted_minutes} د</span>
                        : <span style={{ color: C.green }}> ✅</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "schedule" && (
  <WorkScheduleTab
    pharmacists={pharmacists}
    workSchedules={workSchedules}
    pharmacyId={pharmacyId}
    todayDow={todayDow}
    C={C}
    onSaved={loadWorkSchedules}
    globalToast={globalToast}
  />
)}
      {/* ════ TAB: PRAYER SETTINGS ════ */}
      {tab === "settings" && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14, marginBottom: 4 }}>⚙️ إعدادات وقت الصلوات</div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>التأخير عن الوقت المسموح يُخصم من ساعات العمل</div>
          {prayerSettings.map((s) => (
            <PrayerSettingRow key={s.id} setting={s} onSave={async (updated: any) => {
              await supabase.from("prayer_settings").update({ allowed_minutes: updated.allowed_minutes, ramadan_allowed_minutes: updated.ramadan_allowed_minutes, is_active: updated.is_active, updated_at: new Date().toISOString() }).eq("id", updated.id).eq("pharmacy_id", pharmacyId);
              globalToast("تم حفظ الإعدادات ✓");
              loadPrayerSettings();
            }} ramadan={ramadan} C={C} />
          ))}
        </div>
      )}

      {/* ════ TAB: DAILY REPORT ════ */}
      {tab === "report" && (
        <div>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 13, color: C.text }}>📅 اختر التاريخ:</label>
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); loadReport(e.target.value); }}
              style={{ ...inputStyle, width: "auto" }} />
          </div>

          {reportLogs.length === 0
            ? <div style={{ ...cardStyle, textAlign: "center", color: C.muted, padding: 40 }}>لا يوجد سجلات لهذا اليوم</div>
            : reportLogs.map((log) => (
              <div key={log.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: C.text }}>{log.pharmacist_name}</strong>
                    <span style={{ fontSize: 11, color: C.muted, marginRight: 8 }}>شفت {log.shift_number || 1}</span>
                    {log.expected_start && <span style={{ fontSize: 11, color: C.muted }}>· متوقع: {log.expected_start}</span>}
                  </div>
                  <span style={{ background: COLORS.blueSoft, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                    صافي: {fmtHours(log.net_hours)} س
                  </span>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: C.muted, flexWrap: "wrap" }}>
                  <span>🟢 حضور: <strong style={{ color: C.green }}>{fmt(log.check_in)}</strong></span>
                  <span>🔴 انصراف: <strong style={{ color: C.red }}>{fmt(log.check_out)}</strong></span>
                  <span>⏱ إجمالي: <strong style={{ color: C.text }}>{fmtHours(log.total_hours)}</strong></span>
                  {log.late_minutes > 0 && <span>⚠️ تأخير: <strong style={{ color: C.orange }}>{log.late_minutes} د</strong></span>}
                  {log.total_deductions > 0 && <span>🕌 خصم صلاة: <strong style={{ color: C.red }}>{fmtHours(log.total_deductions)}</strong></span>}
                </div>
                {log.prayer_breaks?.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>فترات الصلاة:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {log.prayer_breaks.map((b: any) => (
                        <div key={b.id} style={{ background: b.deducted_minutes > 0 ? "#2a1000" : COLORS.greenSoft, border: `1px solid ${b.deducted_minutes > 0 ? "#5a2000" : "#1a5a30"}`, borderRadius: 6, padding: "4px 10px", fontSize: 12 }}>
                          {b.prayer_name}: {fmt(b.prayer_time)} ← {fmt(b.return_time)}
                          {b.deducted_minutes > 0 ? <span style={{ color: C.red }}> ⚠️ -{b.deducted_minutes}د</span> : <span style={{ color: C.green }}> ✅</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ════ TAB: MONTHLY REPORT ════ */}
      {tab === "monthly" && (
        <div>
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontWeight: 600, fontSize: 13, color: C.text }}>📅 اختر الشهر:</label>
            <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); loadMonthlyReport(e.target.value); }}
              style={{ ...inputStyle, width: "auto" }} />
          </div>

          {monthlyLogs.length === 0
            ? <div style={{ ...cardStyle, textAlign: "center", color: C.muted, padding: 40 }}>لا يوجد سجلات لهذا الشهر</div>
            : uniquePharmacists.map((name) => {
              const { totalNet, totalLate, daysWorked, requiredHours } = calcMonthlyStats(name);
              const diff = totalNet - requiredHours;
              const pharmLogs = monthlyLogs.filter((l) => l.pharmacist_name === name);
              return (
                <div key={name} style={cardStyle}>
                  {/* رأس الصيدلي */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <strong style={{ fontSize: 15, color: C.text }}>👤 {name}</strong>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ background: COLORS.blueSoft, color: C.accent, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                        فعلي: {fmtHours(totalNet)} س
                      </span>
                      <span style={{ background: diff >= 0 ? COLORS.greenSoft : COLORS.redSoft, color: diff >= 0 ? C.green : C.red, borderRadius: 6, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                        {diff >= 0 ? "+" : ""}{fmtHours(Math.abs(diff))} {diff >= 0 ? "زيادة" : "نقص"}
                      </span>
                    </div>
                  </div>

                  {/* إحصائيات */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "أيام العمل", val: daysWorked + " يوم", color: C.text },
                      { label: "ساعات مطلوبة", val: fmtHours(requiredHours) + " س", color: C.muted },
                      { label: "ساعات فعلية", val: fmtHours(totalNet) + " س", color: C.accent },
                      { label: "إجمالي التأخير", val: totalLate + " د", color: totalLate > 0 ? C.orange : C.muted },
                    ].map((stat) => (
                      <div key={stat.label} style={{ background: C.bg2, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{stat.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* تفاصيل الأيام */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {["التاريخ", "اليوم", "شفت", "الحضور", "التأخير", "الانصراف", "صافي"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "center", color: C.muted, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pharmLogs.map((log) => {
                        const dow = new Date(log.date).getDay();
                        return (
                          <tr key={log.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>{log.date}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: dow === 5 ? C.orange : C.text }}>{DAY_NAMES[dow]}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.muted }}>{log.shift_number || 1}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.green }}>{fmt(log.check_in)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: log.late_minutes > 0 ? C.orange : C.muted }}>
                              {log.late_minutes > 0 ? `${log.late_minutes} د` : "—"}
                            </td>
                            <td style={{ padding: "7px 8px", textAlign: "center", color: C.red }}>{fmt(log.check_out)}</td>
                            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: C.accent }}>{fmtHours(log.net_hours)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      )}

      {/* Prayer Popup */}
      {activePrayerPopup && (
        <div style={{ position: "fixed", inset: 0, background: "#0008", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🕌</div>
            <h3 style={{ margin: "0 0 4px", color: C.text, fontSize: 18 }}>وقت صلاة {activePrayerPopup.prayer}</h3>
            <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 14 }}>{activePrayerPopup.log.pharmacist_name} – الوقت المسموح: {activePrayerPopup.allowed} دقيقة</p>
            <button onClick={() => handlePrayerReturn(activePrayerPopup)}
              style={{ background: COLORS.greenSoft, border: "1px solid #1a5a30", borderRadius: 10, padding: "12px 28px", color: C.green, fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 10 }}>
              ✅ {activePrayerPopup.log.pharmacist_name} – رجع من الصلاة
            </button>
            <button onClick={() => setActivePrayerPopup(null)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 20px", color: C.muted, fontSize: 13, cursor: "pointer" }}>
              تجاهل مؤقتاً
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Prayer Setting Row ──────────────────────────────────────────────────────
function PrayerSettingRow({ setting, onSave, ramadan, C }: any) {
  const [local, setLocal] = useState({ ...setting });
  const changed = JSON.stringify(local) !== JSON.stringify(setting);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <div style={{ width: 70, fontWeight: 700, color: C.text, fontSize: 14 }}>{setting.prayer_name}</div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: C.muted }}>
        <input type="checkbox" checked={local.is_active} onChange={(e) => setLocal({ ...local, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
        تفعيل
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
        وقت مسموح:
        <input type="number" min={5} max={120} value={local.allowed_minutes} onChange={(e) => setLocal({ ...local, allowed_minutes: +e.target.value })}
          style={{ width: 60, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
        <span style={{ color: C.muted }}>دقيقة</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
        🌙 رمضان:
        <input type="number" min={5} max={120} value={local.ramadan_allowed_minutes} onChange={(e) => setLocal({ ...local, ramadan_allowed_minutes: +e.target.value })}
          style={{ width: 60, background: ramadan ? "#1a1500" : C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
        <span style={{ color: C.muted }}>دقيقة</span>
      </label>
      {changed && (
        <button onClick={() => onSave(local)} style={{ background: COLORS.blueSoft, border: "1px solid #1a4a8a", borderRadius: 7, padding: "6px 16px", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          حفظ
        </button>
      )}
    </div>
  );
}
// ==================== LOYALTY POINTS MODULE ====================
function LoyaltyModule({
  customers,
  sales,
  products,
  pharmacyId,
  showToast,
}: {
  customers: any[];
  sales: any[];
  products: any[];
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
}) {
  // ── State ──
  const [tab, setTab] = useState<"customers" | "settings" | "transactions">("customers");
  const [settings, setSettings] = useState<any>({
    mode: "profit",
    profit_rate: 10,
    sales_rate: 3,
    sales_per: 100,
    min_redeem: 10,
    expiry_months: 12,
  });
  const [loyaltyMap, setLoyaltyMap] = useState<Record<string, any>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [redeemModal, setRedeemModal] = useState<any>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [adjustModal, setAdjustModal] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  // ── Load ──
  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const [sRes, pRes, tRes] = await Promise.all([
        supabase.from("loyalty_settings").select("*").eq("pharmacy_id", pharmacyId).maybeSingle(),
        supabase.from("loyalty_points").select("*").eq("pharmacy_id", pharmacyId),
        supabase.from("loyalty_transactions").select("*").eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(200),
      ]);
      if (sRes.data) setSettings(sRes.data);
      if (pRes.data) {
        const map: Record<string, any> = {};
        pRes.data.forEach((r: any) => { map[r.customer_id] = r; });
        setLoyaltyMap(map);
      }
      if (tRes.data) setTransactions(tRes.data);
      setLoading(false);
    };
    load();
  }, [pharmacyId]);

  // ── حساب النقاط المكتسبة من فاتورة ──
  const calcEarnedPoints = (sale: any): number => {
    if (settings.mode === "profit") {
      const items = (() => {
        try { return typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items || []; }
        catch { return []; }
      })();
      const profit = items.reduce((sum: number, it: any) => {
        const cost = it.cost ?? products.find((p: any) => p.id === it.id)?.cost ?? 0;
        return sum + (it.price - cost) * (it.qty || 0);
      }, 0) - (sale.discount_amt ?? sale.discountAmt ?? 0);
      return Math.max(0, profit * (settings.profit_rate / 100));
    } else {
      // sales mode: X ريال لكل Y ريال
      const subtotal = sale.subtotal ?? sale.total ?? 0;
      return Math.floor(subtotal / settings.sales_per) * settings.sales_rate;
    }
  };

  // ── إضافة نقاط لعميل (من فاتورة) ──
  const earnPoints = async (customerId: string, saleId: string, points: number) => {
    if (!customerId || points <= 0) return;
    const current = loyaltyMap[customerId] || { points: 0, total_earned: 0, total_redeemed: 0 };
    const newPoints = (current.points || 0) + points;
    const newEarned = (current.total_earned || 0) + points;

    await supabase.from("loyalty_points").upsert({
      pharmacy_id: pharmacyId,
      customer_id: customerId,
      points: newPoints,
      total_earned: newEarned,
      total_redeemed: current.total_redeemed || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "pharmacy_id,customer_id" });

    await supabase.from("loyalty_transactions").insert({
      pharmacy_id: pharmacyId,
      customer_id: customerId,
      type: "earn",
      amount: points,
      ref_sale_id: saleId,
      earned_mode: settings.mode,
      note: `نقاط مكتسبة من فاتورة ${saleId}`,
    });

    setLoyaltyMap((p) => ({
      ...p,
      [customerId]: { ...current, points: newPoints, total_earned: newEarned },
    }));
  };

  // ── استبدال نقاط ──
const redeemPoints = async () => {
  const amount = parseFloat(redeemAmount);
  if (!amount || amount <= 0) return showToast("أدخل مبلغ صحيح", "error");
  const current = loyaltyMap[redeemModal.id] || {};
  if (amount > (current.points || 0)) return showToast("النقاط غير كافية", "error");
  if (amount < settings.min_redeem) return showToast(`الحد الأدنى للاستبدال ${settings.min_redeem} ريال`, "warn");

  const newPoints = (current.points || 0) - amount;
  const newRedeemed = (current.total_redeemed || 0) + amount;

  // 1. تحديث نقاط العميل
  await supabase.from("loyalty_points").upsert({
    pharmacy_id: pharmacyId,
    customer_id: redeemModal.id,
    points: newPoints,
    total_earned: current.total_earned || 0,
    total_redeemed: newRedeemed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "pharmacy_id,customer_id" });

  // 2. تسجيل المعاملة
  await supabase.from("loyalty_transactions").insert({
    pharmacy_id: pharmacyId,
    customer_id: redeemModal.id,
    type: "redeem",
    amount: -amount,
    note: "استبدال نقدي",
  });

  // 3. خصم من دخل اليوم — تسجيل كمصروف
  const today = new Date().toISOString().split("T")[0];
  // ✅ استبدله بهذا
await supabase.from("treasury_entries").insert({
  pharmacy_id: pharmacyId,
  date: today,
  type: "expense",
  sub_type: "loyalty_redeem",
  amount: amount,
  note: `استبدال نقاط نقدي — ${redeemModal.name}`,
  method: "نقدي",
});

  // 4. تحديث الـ state
  setLoyaltyMap((p) => ({
    ...p,
    [redeemModal.id]: { ...current, points: newPoints, total_redeemed: newRedeemed },
  }));
  setTransactions((p) => [{
    id: Date.now(),
    customer_id: redeemModal.id,
    type: "redeem",
    amount: -amount,
    note: "استبدال نقدي",
    created_at: new Date().toISOString(),
  }, ...p]);

  showToast(`تم صرف ${amount} ريال نقداً للعميل ✓`);
  setRedeemModal(null);
  setRedeemAmount("");
};
  // ── تعديل يدوي ──
  const adjustPoints = async () => {
    const amount = parseFloat(adjustAmount);
    if (!amount) return showToast("أدخل مبلغ", "error");
    const current = loyaltyMap[adjustModal.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
    const newPoints = Math.max(0, (current.points || 0) + amount);

    await supabase.from("loyalty_points").upsert({
      pharmacy_id: pharmacyId,
      customer_id: adjustModal.id,
      points: newPoints,
      total_earned: amount > 0 ? (current.total_earned || 0) + amount : current.total_earned || 0,
      total_redeemed: current.total_redeemed || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "pharmacy_id,customer_id" });

    await supabase.from("loyalty_transactions").insert({
      pharmacy_id: pharmacyId,
      customer_id: adjustModal.id,
      type: "adjust",
      amount,
      note: adjustNote || "تعديل يدوي",
    });

    setLoyaltyMap((p) => ({ ...p, [adjustModal.id]: { ...current, points: newPoints } }));
    setTransactions((p) => [{ id: Date.now(), customer_id: adjustModal.id, type: "adjust", amount, note: adjustNote || "تعديل يدوي", created_at: new Date().toISOString() }, ...p]);
    showToast("تم التعديل ✓");
    setAdjustModal(null);
    setAdjustAmount("");
    setAdjustNote("");
  };

  // ── حفظ الإعدادات ──
  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from("loyalty_settings").upsert({ ...settings, pharmacy_id: pharmacyId, mode_changed_at: new Date().toISOString()}, { onConflict: "pharmacy_id" });
    setSaving(false);
    if (error) return showToast("خطأ في الحفظ", "error");
    showToast("تم حفظ الإعدادات ✓");
  };

  // ── ألوان ──
  const VAR = { bg: COLORS.surface, border: COLORS.border, text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue };

  const typeLabel: Record<string, { label: string; color: string }> = {
    earn:   { label: "مكتسبة",  color: COLORS.green },
    redeem: { label: "مستبدلة", color: COLORS.red },
    adjust: { label: "تعديل",   color: COLORS.gold },
  };

  // ── إحصائيات ──
  const totalPointsInSystem = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.points || 0), 0);
  const totalEverEarned     = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_earned || 0), 0);
  const totalRedeemed       = Object.values(loyaltyMap).reduce((s: number, v: any) => s + (v.total_redeemed || 0), 0);
  const activeMembers       = Object.values(loyaltyMap).filter((v: any) => v.points > 0).length;

  const filtered = customers.filter((c) =>
    (c.name || "").includes(search) || (c.phone || "").includes(search)
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: VAR.muted }}>
      جاري التحميل...
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: VAR.text }}>
          🌟 نقاط الولاء
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          {(["customers", "transactions", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid",
              borderColor: tab === t ? VAR.accent : VAR.border,
              background: tab === t ? COLORS.blueSoft : "transparent",
              color: tab === t ? VAR.accent : VAR.muted,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              {t === "customers" ? "العملاء" : t === "transactions" ? "السجل" : "الإعدادات"}
            </button>
          ))}
        </div>
      </div>

      {/* ── إحصائيات ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "إجمالي النقاط الحالية", value: totalPointsInSystem.toFixed(1) + " ر.س", color: COLORS.blue },
          { label: "إجمالي المكتسبة", value: totalEverEarned.toFixed(1) + " ر.س", color: COLORS.green },
          { label: "إجمالي المستبدلة", value: totalRedeemed.toFixed(1) + " ر.س", color: COLORS.red },
          { label: "أعضاء نشطون", value: activeMembers, color: COLORS.gold },
        ].map((s, i) => (
          <div key={i} style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: VAR.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ════ TAB: CUSTOMERS ════ */}
      {tab === "customers" && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم العميل أو رقم الجوال..."
              style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 14px", color: VAR.text, fontSize: 14, outline: "none", width: 300, boxSizing: "border-box" as any }}
            />
          </div>

          <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                  {["العميل", "النقاط الحالية (ر.س)", "إجمالي مكتسبة", "إجمالي مستبدلة", ""].map((h, i) => (
                    <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: VAR.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#2a3a5a" }}>لا يوجد عملاء</td></tr>
                ) : filtered.map((c, i) => {
                  const lp = loyaltyMap[c.id] || { points: 0, total_earned: 0, total_redeemed: 0 };
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid #0a1020`, background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt }}>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ fontWeight: 700, color: VAR.text, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: VAR.muted }}>{c.phone}</div>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          fontSize: 16, fontWeight: 800,
                          color: lp.points >= settings.min_redeem ? COLORS.green : VAR.muted,
                        }}>
                          {(lp.points || 0).toFixed(2)}
                        </span>
                        {lp.points >= settings.min_redeem && (
                          <span style={{ marginRight: 6, fontSize: 10, background: COLORS.greenSoft, color: COLORS.green, padding: "1px 6px", borderRadius: 10 }}>
                            قابل للاستبدال
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "11px 16px", color: COLORS.green, fontSize: 13 }}>
                        {(lp.total_earned || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "11px 16px", color: COLORS.red, fontSize: 13 }}>
                        {(lp.total_redeemed || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {lp.points >= settings.min_redeem && (
                            <button onClick={() => { setRedeemModal(c); setRedeemAmount(""); }} style={{
                              padding: "5px 12px", borderRadius: 7, border: "1px solid #1a5a30",
                              background: COLORS.greenSoft, color: COLORS.green, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}>
                              استبدال
                            </button>
                          )}
                          <button onClick={() => { setAdjustModal(c); setAdjustAmount(""); setAdjustNote(""); }} style={{
                            padding: "5px 12px", borderRadius: 7, border: `1px solid ${VAR.border}`,
                            background: "transparent", color: VAR.muted, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}>
                            تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════ TAB: TRANSACTIONS ════ */}
      {tab === "transactions" && (
        <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                {["التاريخ", "العميل", "النوع", "المبلغ (ر.س)", "ملاحظة"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: "right", color: VAR.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#2a3a5a" }}>لا يوجد سجلات</td></tr>
              ) : transactions.slice(0, 100).map((t, i) => {
                const customer = customers.find((c) => c.id === t.customer_id);
                const tl = typeLabel[t.type] || { label: t.type, color: VAR.muted };
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid #0a1020`, background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt }}>
                    <td style={{ padding: "10px 16px", color: VAR.muted, fontSize: 12 }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : "-"}
                    </td>
                    <td style={{ padding: "10px 16px", color: VAR.text, fontSize: 13, fontWeight: 600 }}>
                      {customer?.name || t.customer_id}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: tl.color + "22", color: tl.color }}>
                        {tl.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 800, color: t.amount > 0 ? COLORS.green : COLORS.red }}>
                      {t.amount > 0 ? "+" : ""}{(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 16px", color: VAR.muted, fontSize: 12 }}>{t.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════ TAB: SETTINGS ════ */}
      {tab === "settings" && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 20px", color: COLORS.blue, fontSize: 15, fontWeight: 700 }}>
              🔧 آلية احتساب النقاط
            </h3>

            {/* وضع الحساب */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 10 }}>
                طريقة الاحتساب
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { v: "profit", label: "نسبة من الربح 📈", desc: "العميل ياخد نقاط أكثر على المنتجات ذات هامش ربح أعلى" },
                  { v: "sales", label: "نسبة من المبيعات 🛒", desc: "ريال لكل X ريال مشتريات — بسيط وواضح للعميل" },
                ].map((opt) => (
                  <div key={opt.v} onClick={() => setSettings((p: any) => ({ ...p, mode: opt.v }))} style={{
                    flex: 1, padding: 14, borderRadius: 10, border: `2px solid`,
                    borderColor: settings.mode === opt.v ? VAR.accent : VAR.border,
                    background: settings.mode === opt.v ? COLORS.blueSoft : "transparent",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 700, color: settings.mode === opt.v ? VAR.accent : VAR.text, fontSize: 14, marginBottom: 6 }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: VAR.muted }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* إعدادات وضع الربح */}
            {settings.mode === "profit" && (
              <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: VAR.muted, marginBottom: 12 }}>
                  مثال: إذا كان الربح من الفاتورة 50 ريال والنسبة 10% — يكسب العميل 5 ريال نقاط
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, color: VAR.text, whiteSpace: "nowrap" }}>نسبة من الربح:</label>
                  <input
                    type="number" min={1} max={100}
                    value={settings.profit_rate}
                    onChange={(e) => setSettings((p: any) => ({ ...p, profit_rate: +e.target.value }))}
                    style={{ width: 80, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: VAR.muted, fontSize: 13 }}>%</span>
                </div>
              </div>
            )}

            {/* إعدادات وضع المبيعات */}
            {settings.mode === "sales" && (
              <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: VAR.muted, marginBottom: 12 }}>
                  مثال: إذا حدّدت 3 ريال لكل 100 ريال — من يشتري بـ 250 ريال يكسب 6 ريال نقاط
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as any }}>
                  <input
                    type="number" min={0.1}
                    value={settings.sales_rate}
                    onChange={(e) => setSettings((p: any) => ({ ...p, sales_rate: +e.target.value }))}
                    style={{ width: 70, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: VAR.muted, fontSize: 13 }}>ريال لكل</span>
                  <input
                    type="number" min={10}
                    value={settings.sales_per}
                    onChange={(e) => setSettings((p: any) => ({ ...p, sales_per: +e.target.value }))}
                    style={{ width: 80, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "8px 10px", color: VAR.text, fontSize: 14, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ color: VAR.muted, fontSize: 13 }}>ريال مشتريات</span>
                </div>
              </div>
            )}

            {/* إعدادات الاستبدال */}
            <h3 style={{ margin: "20px 0 14px", color: COLORS.blue, fontSize: 14, fontWeight: 700 }}>
              💱 إعدادات الاستبدال
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  الحد الأدنى للاستبدال (ريال)
                </label>
                <input
                  type="number" min={1}
                  value={settings.min_redeem}
                  onChange={(e) => setSettings((p: any) => ({ ...p, min_redeem: +e.target.value }))}
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 12px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  انتهاء النقاط (شهر)
                </label>
                <input
                  type="number" min={1}
                  value={settings.expiry_months}
                  onChange={(e) => setSettings((p: any) => ({ ...p, expiry_months: +e.target.value }))}
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "9px 12px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
            </div>
          </div>

          <Btn onClick={saveSettings} disabled={saving} icon="check" size="lg" style={{ width: "100%", justifyContent: "center" }}>
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </Btn>
        </div>
      )}

      {/* ── Modal: استبدال ── */}
      {redeemModal && (
        <Modal open onClose={() => setRedeemModal(null)} title={`صرف نقدي — ${redeemModal.name}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: VAR.muted, marginBottom: 4 }}>النقاط المتاحة</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.green }}>
                {((loyaltyMap[redeemModal.id]?.points) || 0).toFixed(2)} ر.س
              </div>
            </div>
            <div style={{
  background: COLORS.goldSoft,
  border: "1px solid #7a4a00",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  color: COLORS.gold,
}}>
  ⚠ سيتم خصم المبلغ من دخل اليوم كمصروف
</div>
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                المبلغ المراد استبداله (ر.س)
              </label>
              <input
                type="number" min={settings.min_redeem}
                max={loyaltyMap[redeemModal.id]?.points || 0}
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                placeholder={`الحد الأدنى ${settings.min_redeem} ريال`}
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setRedeemModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={redeemPoints} style={{ flex: 1, justifyContent: "center" }}>تأكيد الاستبدال</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: تعديل ── */}
      {adjustModal && (
        <Modal open onClose={() => setAdjustModal(null)} title={`تعديل نقاط — ${adjustModal.name}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: VAR.muted, marginBottom: 4 }}>النقاط الحالية</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: VAR.accent }}>
                {((loyaltyMap[adjustModal.id]?.points) || 0).toFixed(2)} ر.س
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                المبلغ (موجب للإضافة، سالب للخصم)
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="مثال: 10 أو -5"
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 16, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>سبب التعديل</label>
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="مثال: تعويض عميل..."
                style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setAdjustModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn variant="secondary" onClick={adjustPoints} style={{ flex: 1, justifyContent: "center" }}>حفظ التعديل</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ==================== PERMISSIONS MODULE ====================
// ── أقسام النظام ──
const SYSTEM_SECTIONS = [
  { id: "dashboard",         label: "الرئيسية",             icon: "📊" },
  { id: "pos",               label: "نقطة البيع",           icon: "🛒" },
  { id: "purchase",          label: "فواتير الشراء",        icon: "📦" },
  { id: "returns",           label: "المرتجعات",            icon: "↩️" },
  { id: "products",          label: "الأصناف والمخزون",    icon: "💊" },
  { id: "suppliers",         label: "الموردون",             icon: "🏭" },
  { id: "customers",         label: "العملاء",              icon: "👥" },
  { id: "loyalty",           label: "نقاط الولاء",         icon: "🌟" },
  { id: "reports",           label: "التقارير",             icon: "📈" },
  { id: "tax_report",        label: "التقرير الضريبي",     icon: "🧾" },
  { id: "promotions",        label: "العروض والخصومات",    icon: "🏷️" },
  { id: "treasury",          label: "الخزنة",              icon: "💰" },
  { id: "shift",             label: "الشفتات",             icon: "🕐" },
  { id: "target",            label: "تارجت المبيعات",      icon: "🎯" },
  { id: "inventory_count",   label: "الجرد",               icon: "📋" },
  { id: "expiry_report",     label: "تقرير الصلاحيات",    icon: "⚠️" },
  { id: "attendance",        label: "الحضور والانصراف",   icon: "⏱️" },
  { id: "pharmacy_settings", label: "بيانات الصيدلية",    icon: "⚙️" },
  { id: "rasd_settings",     label: "إعدادات رصد",         icon: "🔗" },
];

// ── الأدوار الافتراضية ──
const DEFAULT_ROLES = ["pharmacist", "cashier"];

function PermissionsModule({
  pharmacyId,
  showToast,
}: {
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"permissions" | "users">("permissions");
  const [perms, setPerms] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean }>>>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState("pharmacist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRoleModal, setAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [dirty, setDirty] = useState(false);

  // ── المستخدمين ──
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState<"add" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: "", username: "", password: "", role: "pharmacist" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const VAR = { bg: COLORS.surface, border: COLORS.border, text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue };

  // ── تحميل الصلاحيات ──
  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("role_permissions").select("*").eq("pharmacy_id", pharmacyId);
      const map: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      const foundRoles = new Set<string>(DEFAULT_ROLES);
      if (data) {
        data.forEach((r: any) => {
          foundRoles.add(r.role);
          if (!map[r.role]) map[r.role] = {};
          map[r.role][r.section] = { can_view: r.can_view, can_edit: r.can_edit };
        });
      }
      [...foundRoles].forEach((role) => {
        if (!map[role]) map[role] = {};
        SYSTEM_SECTIONS.forEach((sec) => {
          if (!map[role][sec.id]) {
            map[role][sec.id] = {
              can_view: role === "cashier" ? sec.id === "pos" : true,
              can_edit: role === "cashier" ? sec.id === "pos" : sec.id !== "pharmacy_settings" && sec.id !== "rasd_settings",
            };
          }
        });
      });
      setRoles([...foundRoles]);
      setPerms(map);
      setLoading(false);
    };
    load();
  }, [pharmacyId]);

  // ── تحميل المستخدمين ──
  useEffect(() => {
    if (!pharmacyId || activeTab !== "users") return;
    const load = async () => {
      setUsersLoading(true);
      const { data } = await supabase.from("users").select("*").eq("pharmacy_id", pharmacyId).order("created_at");
      setUsers(data ?? []);
      setUsersLoading(false);
    };
    load();
  }, [pharmacyId, activeTab]);

  const togglePerm = (section: string, type: "can_view" | "can_edit") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      const current = rolePerms[section] || { can_view: false, can_edit: false };
      let updated = { ...current };
      if (type === "can_view") {
        updated.can_view = !current.can_view;
        if (!updated.can_view) updated.can_edit = false;
      } else {
        updated.can_edit = !current.can_edit;
        if (updated.can_edit) updated.can_view = true;
      }
      return { ...prev, [selectedRole]: { ...rolePerms, [section]: updated } };
    });
    setDirty(true);
  };

  const toggleAll = (type: "view_all" | "edit_all" | "none") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      SYSTEM_SECTIONS.forEach((sec) => {
        if (type === "view_all") rolePerms[sec.id] = { can_view: true, can_edit: rolePerms[sec.id]?.can_edit ?? false };
        else if (type === "edit_all") rolePerms[sec.id] = { can_view: true, can_edit: true };
        else rolePerms[sec.id] = { can_view: false, can_edit: false };
      });
      return { ...prev, [selectedRole]: rolePerms };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const rows = SYSTEM_SECTIONS.map((sec) => ({
      pharmacy_id: pharmacyId,
      role: selectedRole,
      section: sec.id,
      can_view: perms[selectedRole]?.[sec.id]?.can_view ?? true,
      can_edit: perms[selectedRole]?.[sec.id]?.can_edit ?? false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "pharmacy_id,role,section" });
    setSaving(false);
    if (error) return showToast("خطأ في الحفظ", "error");
    showToast(`تم حفظ صلاحيات ${roleLabel(selectedRole)} ✓`);
    setDirty(false);
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    if (roles.includes(name)) return showToast("الدور موجود بالفعل", "warn");
    const defaultPerms: Record<string, { can_view: boolean; can_edit: boolean }> = {};
    SYSTEM_SECTIONS.forEach((sec) => { defaultPerms[sec.id] = { can_view: true, can_edit: false }; });
    setRoles((p) => [...p, name]);
    setPerms((p) => ({ ...p, [name]: defaultPerms }));
    setSelectedRole(name);
    setAddRoleModal(false);
    setNewRoleName("");
    setDirty(true);
    showToast(`تم إضافة دور "${name}"`);
  };

  // ── إضافة/تعديل مستخدم ──
  const saveUser = async () => {
    if (!userForm.name || !userForm.username || !userForm.password) {
      return showToast("يرجى تعبئة جميع الحقول", "error");
    }
    if (userModal === "add") {
      const id = "U" + Date.now();
      const { error } = await supabase.from("users").insert({
        id,
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        pharmacy_id: pharmacyId,
        created_at: new Date().toISOString(),
      });
      if (error) return showToast("خطأ في الإضافة: " + error.message, "error");
      setUsers((p) => [...p, { id, ...userForm, pharmacy_id: pharmacyId, created_at: new Date().toISOString() }]);
      showToast("تم إضافة المستخدم ✓");
    } else {
      const { error } = await supabase.from("users").update({
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
      }).eq("id", selectedUser.id);
      if (error) return showToast("خطأ في التعديل: " + error.message, "error");
      setUsers((p) => p.map((u) => u.id === selectedUser.id ? { ...u, ...userForm } : u));
      showToast("تم تعديل المستخدم ✓");
    }
    setUserModal(null);
    setUserForm({ name: "", username: "", password: "", role: "pharmacist" });
  };

  // ── حذف مستخدم ──
  const deleteUser = async (id: string) => {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return showToast("خطأ في الحذف", "error");
    setUsers((p) => p.filter((u) => u.id !== id));
    setDeleteConfirm(null);
    showToast("تم حذف المستخدم ✓");
  };

  const roleLabel = (r: string) =>
    r === "pharmacist" ? "صيدلاني" : r === "cashier" ? "كاشير" : r === "admin" ? "مدير" : r;

  const currentRolePerms = perms[selectedRole] || {};
  const viewCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_view).length;
  const editCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_edit).length;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: VAR.text }}>
          🔐 الصلاحيات والمستخدمين
        </h2>
        {activeTab === "permissions" && dirty && (
          <Btn onClick={save} disabled={saving} icon="check">
            {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </Btn>
        )}
        {activeTab === "users" && (
          <Btn onClick={() => { setUserModal("add"); setUserForm({ name: "", username: "", password: "", role: "pharmacist" }); }} icon="plus">
            + إضافة مستخدم
          </Btn>
        )}
      </div>

      {/* ── تبويبين ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "permissions", label: "🔐 الصلاحيات" },
          { id: "users", label: "👤 المستخدمين" },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
            padding: "8px 20px", borderRadius: 9, border: "1px solid",
            borderColor: activeTab === t.id ? COLORS.blue : VAR.border,
            background: activeTab === t.id ? "#14233a" : "transparent",
            color: activeTab === t.id ? COLORS.blue : VAR.muted,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── تبويب الصلاحيات ── */}
      {activeTab === "permissions" && (
        loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: VAR.muted }}>جاري التحميل...</div>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ width: 200, flexShrink: 0 }}>
              <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${VAR.border}`, fontSize: 12, color: VAR.muted, fontWeight: 700 }}>الأدوار</div>
                {roles.map((role) => (
                  <button key={role} onClick={() => { setSelectedRole(role); setDirty(false); }} style={{
                    display: "block", width: "100%", padding: "12px 16px", textAlign: "right",
                    background: selectedRole === role ? "#14233a" : "transparent",
                    borderRight: selectedRole === role ? "3px solid #2a6aef" : "3px solid transparent",
                    border: "none", color: selectedRole === role ? COLORS.blue : VAR.muted,
                    fontSize: 13, fontWeight: selectedRole === role ? 700 : 400, cursor: "pointer",
                  }}>
                    {roleLabel(role)}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddRoleModal(true)} style={{
                width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px dashed ${VAR.border}`,
                background: "transparent", color: VAR.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>+ إضافة دور</button>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { val: viewCount, label: "قسم مرئي", color: VAR.accent },
                  { val: editCount, label: "قسم قابل للتعديل", color: COLORS.green },
                  { val: SYSTEM_SECTIONS.length - viewCount, label: "قسم مخفي", color: COLORS.red },
                ].map((s, i) => (
                  <div key={i} style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: VAR.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => toggleAll("edit_all")} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #1a5a30", background: COLORS.greenSoft, color: COLORS.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ تفعيل الكل</button>
                <button onClick={() => toggleAll("view_all")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid #1d3a6a`, background: COLORS.blueSoft, color: VAR.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>👁️ عرض بدون تعديل</button>
                <button onClick={() => toggleAll("none")} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #4a1010", background: COLORS.redSoft, color: COLORS.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🚫 إخفاء الكل</button>
              </div>

              <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", padding: "12px 20px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700 }}>القسم</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>عرض 👁️</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>تعديل ✏️</div>
                </div>
                {SYSTEM_SECTIONS.map((sec, i) => {
                  const p = currentRolePerms[sec.id] || { can_view: false, can_edit: false };
                  return (
                    <div key={sec.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 120px",
                      padding: "13px 20px", alignItems: "center",
                      borderBottom: i < SYSTEM_SECTIONS.length - 1 ? "1px solid #0a1020" : "none",
                      background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                      opacity: !p.can_view ? 0.55 : 1,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{sec.icon}</span>
                        <span style={{ fontSize: 14, color: p.can_view ? VAR.text : VAR.muted, fontWeight: p.can_view ? 600 : 400 }}>{sec.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button onClick={() => togglePerm(sec.id, "can_view")} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_view ? "#1a5a30" : "#2a1020", cursor: "pointer", position: "relative" }}>
                          <div style={{ position: "absolute", top: 3, right: p.can_view ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_view ? COLORS.green : COLORS.red, transition: "right 0.2s" }} />
                        </button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button onClick={() => togglePerm(sec.id, "can_edit")} disabled={!p.can_view} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_edit ? "#1a3a6a" : "#1a1a2a", cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                          <div style={{ position: "absolute", top: 3, right: p.can_edit ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_edit ? COLORS.blue : "#3a3a5a", transition: "right 0.2s" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {dirty && (
                <div style={{ marginTop: 16 }}>
                  <Btn onClick={save} disabled={saving} icon="check" size="lg" style={{ width: "100%", justifyContent: "center" }}>
                    {saving ? "جارٍ الحفظ..." : `حفظ صلاحيات ${roleLabel(selectedRole)}`}
                  </Btn>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── تبويب المستخدمين ── */}
      {activeTab === "users" && (
        <div>
          {usersLoading ? (
            <div style={{ textAlign: "center", color: VAR.muted, padding: 40 }}>جاري التحميل...</div>
          ) : (
            <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", padding: "12px 20px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                {["الاسم", "اسم المستخدم", "الدور", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: i === 3 ? "center" : "right" }}>{h}</div>
                ))}
              </div>
              {users.length === 0 ? (
                <div style={{ textAlign: "center", color: VAR.muted, padding: 40 }}>لا يوجد مستخدمين</div>
              ) : (
                users.map((u, i) => (
                  <div key={u.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px",
                    padding: "14px 20px", alignItems: "center",
                    borderBottom: i < users.length - 1 ? "1px solid #0a1020" : "none",
                    background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: VAR.text }}>{u.name}</div>
                    <div style={{ fontSize: 13, color: VAR.muted }}>{u.username}</div>
                    <div>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: u.role === "admin" ? COLORS.goldSoft : u.role === "pharmacist" ? COLORS.greenSoft : COLORS.blueSoft, color: u.role === "admin" ? COLORS.gold : u.role === "pharmacist" ? COLORS.green : COLORS.blue }}>
                        {roleLabel(u.role)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => { setSelectedUser(u); setUserForm({ name: u.name, username: u.username, password: u.password, role: u.role }); setUserModal("edit"); }} style={{ padding: "4px 10px", borderRadius: 6, background: COLORS.blueSoft, border: "1px solid #1d3a6a", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>تعديل</button>
                      <button onClick={() => setDeleteConfirm(u.id)} style={{ padding: "4px 10px", borderRadius: 6, background: COLORS.redSoft, border: "1px solid #4a1010", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>حذف</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal إضافة/تعديل مستخدم ── */}
      {userModal && (
        <Modal open onClose={() => setUserModal(null)} title={userModal === "add" ? "إضافة مستخدم جديد" : "تعديل مستخدم"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "الاسم الكامل", key: "name", placeholder: "مثال: أحمد محمد" },
              { label: "اسم المستخدم", key: "username", placeholder: "مثال: ahmed123" },
              { label: "كلمة المرور", key: "password", placeholder: "كلمة المرور" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>{f.label}</label>
                <input
                  value={userForm[f.key as keyof typeof userForm]}
                  onChange={(e) => setUserForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>الدور</label>
              <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))} style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none" }}>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => setUserModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={saveUser} style={{ flex: 1, justifyContent: "center" }}>حفظ</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── تأكيد الحذف ── */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="تأكيد الحذف">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: VAR.muted, fontSize: 14 }}>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, justifyContent: "center", background: COLORS.redSoft, borderColor: "#6a1010", color: COLORS.red }}>حذف</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal إضافة دور ── */}
      {addRoleModal && (
        <Modal open onClose={() => setAddRoleModal(false)} title="إضافة دور جديد">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>اسم الدور</label>
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} placeholder="مثال: مراجع، محاسب..." style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }} />
            </div>
            <div style={{ fontSize: 12, color: VAR.muted, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}>
              💡 سيتم إنشاء الدور بصلاحية عرض لجميع الأقسام بدون تعديل.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setAddRoleModal(false)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={addRole} style={{ flex: 1, justifyContent: "center" }}>إضافة</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
