import { QRCodeSVG } from "qrcode.react";
import { COLORS, tint } from "./theme";
import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://glcdvwpwxbhutfecljdj.supabase.co";
const supabase = createClient(
  SUPABASE_URL,
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsY2R2d3B3eGJodXRmZWNsamRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE1OTIsImV4cCI6MjA5NTU0NzU5Mn0.w-dLQiFTTPzB0eeA7Asf95hy5x7kjA-OvilneYAIHHA"
);
import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";

// ==================== AUTH SERVICE (Supabase Auth) ====================
// username بيتحوّل لإيميل وهمي داخلياً لأن Supabase Auth بيشتغل بالإيميل.
// كلمة المرور متخزّنة مشفّرة في auth.users — مش plaintext في جدول users.
const authService = {
  async login(username: string, password: string) {
    const email = `${username.trim().toLowerCase()}@pharmacy.internal`;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData?.user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id")
      .eq("auth_user_id", authData.user.id)
      .single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      throw new Error("هذا الحساب غير مفعّل، راجع مدير النظام");
    }
    if (!profile.pharmacy_id) {
      await supabase.auth.signOut();
      throw new Error("هذا المستخدم غير مرتبط بصيدلية");
    }
    return profile;
  },
  async logout() {
    await supabase.auth.signOut();
  },
  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data: profile } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id")
      .eq("auth_user_id", session.user.id)
      .single();
    return profile || null;
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
const BarcodeScanner = forwardRef(({
  onScan,
  placeholder = "امسح أو اكتب الباركود...",
}, forwardedRef) => {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const keyCount = useRef<number>(0);
  const scanTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => ref.current?.focus(),
  }));

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
});
// ==================== LOGIN ====================
const PHARMACY_INTERIOR_BG = "data:image/jpeg;base64,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";
const LOGIN_BG_IMAGE = "data:image/webp;base64,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";

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
        position: "relative",
        backgroundImage: `linear-gradient(rgba(8,12,24,0.45), rgba(8,12,24,0.55)), url(${LOGIN_BG_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
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
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
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
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        backgroundImage: `linear-gradient(rgba(255,255,255,0.70), rgba(255,255,255,0.70)), url(${PHARMACY_INTERIOR_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    />
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
  const [users, setUsers] = useState(INIT_USERS);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // استعادة الجلسة عند تحميل التطبيق + الاستماع لتغيّرات Auth
  useEffect(() => {
    let active = true;
    authService.getCurrentUser().then((u) => {
      if (active) { setCurrentUser(u); setAuthChecked(true); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setCurrentUser(null); }
    });
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const pharmacyId = currentUser?.pharmacy_id || null;
  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("users")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .then(({ data }) => {
        if (data && data.length > 0) setUsers(data);
      });
  }, [pharmacyId]);
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

  // ── صلاحيات الدور الحالي (تتحكم في ظهور الأقسام + ما بداخلها) ──
  const [rolePermissions, setRolePermissions] = useState<Record<string, { can_view: boolean; can_edit: boolean }> | null>(null);
  useEffect(() => {
    if (!pharmacyId || !currentUser?.role) { setRolePermissions(null); return; }
    if (currentUser.role === "admin") { setRolePermissions("admin" as any); return; }
    supabase
      .from("role_permissions")
      .select("section, sub_section, can_view, can_edit")
      .eq("pharmacy_id", pharmacyId)
      .eq("role", currentUser.role)
      .then(({ data }) => {
        const map: Record<string, { can_view: boolean; can_edit: boolean }> = {};
        (data || []).forEach((r: any) => {
          map[permKey(r.section, r.sub_section)] = { can_view: r.can_view, can_edit: r.can_edit };
        });
        setRolePermissions(map);
      });
  }, [pharmacyId, currentUser?.role]);

  // ── الأدمن دايمًا عنده كل الصلاحيات. أثناء التحميل لا نمنع شيء تفاديًا لوميض الواجهة. ──
  const canView = useCallback((section: string, sub?: string) => {
    if (rolePermissions === "admin" || rolePermissions === null) return true;
    const direct = rolePermissions[permKey(section, sub)];
    if (direct) return direct.can_view;
    // لو مفيش صلاحية محفوظة لعنصر فرعي بالذات، استخدم صلاحية القسم العام كافتراضي
    if (sub) return rolePermissions[permKey(section)]?.can_view ?? true;
    return true;
  }, [rolePermissions]);

  const canEdit = useCallback((section: string, sub?: string) => {
    if (rolePermissions === "admin" || rolePermissions === null) return true;
    const direct = rolePermissions[permKey(section, sub)];
    if (direct) return direct.can_edit;
    if (sub) return rolePermissions[permKey(section)]?.can_edit ?? false;
    return false;
  }, [rolePermissions]);

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

  // لو لسه بيتحقق من الجلسة، نعرض شاشة انتظار بسيطة
  if (!authChecked)
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: COLORS.appBg, color: "#888", flexDirection: "column", gap: 12
      }}>
        <div style={{ fontSize: 28 }}>💊</div>
        <div style={{ fontSize: 14 }}>جارٍ التحقق من الجلسة...</div>
      </div>
    );

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
    { label: "التقارير",         color: GROUP_COLORS.reports, ids: ["expiry_report", "reports", "tax_report", "treasury"] },
    { label: "الإدارة",          color: GROUP_COLORS.admin,   ids: ["pharmacy_settings", "permissions", "rasd_settings"] },
  ];

  // إيجاد لون التاب الحالي
  const activeGroup = groups.find(g => g.ids.includes(tab));
  const activeColor = activeGroup?.color || GROUP_COLORS.main;

  // إخفاء مجموعة "الإدارة" بالكامل عن أي مستخدم غير أدمن
  const isAdminUser = currentUser?.role === "admin";
  const visibleGroups = groups.filter((g) => g.label !== "الإدارة" || isAdminUser);

  return visibleGroups.map((group, gi) => (
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
            onClick={async () => {
              await authService.logout();
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
      {tab === "pharmacy_settings" && currentUser?.role === "admin" && (
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
        {tab === "returns" && canView("returns") && (
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
            canViewSalesReturns={canView("returns", "sales")}
            canViewPurchaseReturns={canView("returns", "purchases")}
            canEditSalesReturns={canEdit("returns", "sales")}
            canEditPurchaseReturns={canEdit("returns", "purchases")}
          />
        )}
        {tab === "rasd_settings" && currentUser?.role === "admin" && <RasdSettings showToast={showToast} />}
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
        {tab === "treasury" && canView("treasury") && (
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
            canViewSub={(sub) => canView("treasury", sub)}
            canEditSub={(sub) => canEdit("treasury", sub)}
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
{tab === "permissions" && currentUser?.role === "admin" && (
  <PermissionsModule
    pharmacyId={pharmacyId}
    showToast={showToast}
    users={users}
    setUsers={setUsers}
    currentUser={currentUser}
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
  const [deptTab, setDeptTab] = useState("today"); // "today" | "month" — لكارت مبيعات الأقسام
  const [privacyMode, setPrivacyMode] = useState(true);
  const [expandedAlertGroup, setExpandedAlertGroup] = useState(null);

  // ── فرص ضائعة ──
  const [missedToday, setMissedToday] = useState({ count: 0, value: 0, items: [] });
  const [missedMonth, setMissedMonth] = useState({ count: 0, value: 0, items: [] });
  const [showMissedModal, setShowMissedModal] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const monthKey = today.substring(0, 7);

  useEffect(() => {
    if (!pharmacyId) return;
    const fetchMissed = async () => {
      const { data: todayData } = await supabase
        .from("missed_sales")
        .select("id, product_name, price, qty, reason, notes, cashier, date")
        .eq("date", today)
        .eq("pharmacy_id", pharmacyId)
        .order("id", { ascending: false });
      if (todayData) {
        const value = todayData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedToday({ count: todayData.length, value, items: todayData });
      }
      const { data: monthData } = await supabase
        .from("missed_sales")
        .select("id, product_name, price, qty, reason, notes, cashier, date")
        .gte("date", monthKey + "-01").lte("date", monthKey + "-31")
        .eq("pharmacy_id", pharmacyId)
        .order("date", { ascending: false });
      if (monthData) {
        const value = monthData.reduce((s, r) => s + (r.price || 0) * (r.qty || 1), 0);
        setMissedMonth({ count: monthData.length, value, items: monthData });
      }
    };
    fetchMissed();
  }, [today, monthKey, pharmacyId]);
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

  // ══════════ مبيعات الأقسام (يومي/شهري) — إيراد + ربح لكل قسم ══════════
  const DEPT_PALETTE = [COLORS.blue, COLORS.purple, COLORS.teal, COLORS.gold, COLORS.coral, COLORS.green, COLORS.red];
  const computeDeptStats = (salesArr) => {
    const map = {};
    salesArr.forEach((s) => {
      const items = getSaleItems(s).filter((it) => !it.isMissed);
      items.forEach((it) => {
        const cat = it.category || it.main_category || it.mainCategory ||
          products.find((p) => p.id === it.id)?.main_category ||
          products.find((p) => p.id === it.id)?.category || "أخرى";
        const cost = it.cost ?? products.find((p) => p.id === it.id)?.cost ?? 0;
        const price = it.price ?? 0;
        const qty = it.qty || 0;
        if (!map[cat]) map[cat] = { category: cat, revenue: 0, cost: 0 };
        map[cat].revenue += price * qty;
        map[cat].cost += cost * qty;
      });
    });
    const rows = Object.values(map).map((r) => ({
      ...r,
      profit: r.revenue - r.cost,
      profitPct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
    const totalProfit = rows.reduce((a, r) => a + r.profit, 0);
    return { rows: rows.map((r) => ({ ...r, share: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0 })), totalRevenue, totalProfit };
  };
  const deptStatsToday = computeDeptStats(todaySales);
  const deptStatsMonth = computeDeptStats(monthSales);

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
            { label: "الفرص الضائعة",   val: missed.toFixed(0) + " ر.س", color: VAR.warn, sub: `${missedCnt} صنف مفقود`, onClick: () => setShowMissedModal(true) },
            { label: "متوسط الفاتورة",  val: avgInv.toFixed(1) + " ر.س", color: VAR.text, sub: "ريال", neutral: true },
          ].map((cell, i) => (
            <div
              key={i}
              onClick={cell.onClick}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: cell.neutral ? VAR.surface2 : tint(cell.color, 0.08),
                border: `1px solid ${cell.neutral ? VAR.border : tint(cell.color, 0.3)}`,
                cursor: cell.onClick ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600, marginBottom: 4, letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}>
                {cell.label}
                {cell.onClick && <span style={{ fontSize: 9, opacity: 0.7 }}>↗</span>}
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

  // ── حالة طي/فتح الكروت الكبيرة ──
  const [openCard, setOpenCard] = useState(null); // مفتاح الكارت المفتوح حالياً أو null لو كله مقفول
  const toggleCard = (key) => setOpenCard((prev) => (prev === key ? null : key));

  // غلاف كارت قابل للطي: عنوان + أيقونة + شارة عدد (اختياري) + سهم، والمحتوى يظهر فقط لو الكارت مفتوح
  const CollapsibleCard = ({ cardKey, icon, title, badge, badgeColor, children }) => {
    const isOpen = openCard === cardKey;
    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", gridColumn: isOpen ? "1 / -1" : "auto" }}>
        <div
          onClick={() => toggleCard(cardKey)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 16px", cursor: "pointer", userSelect: "none",
            borderBottom: isOpen ? `1px solid ${VAR.border}` : "none",
          }}
        >
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: VAR.text, flex: 1 }}>{title}</span>
          {badge !== undefined && badge !== null && (
            <span style={{
              background: badgeColor ? `${badgeColor}26` : VAR.surface2,
              color: badgeColor || VAR.muted,
              borderRadius: 99, fontSize: 11, padding: "2px 9px", fontWeight: 700, fontFamily: "monospace",
            }}>
              {badge}
            </span>
          )}
          <span style={{ color: VAR.muted, fontSize: 12, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
        </div>
        {isOpen && <div>{children}</div>}
      </div>
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

      {/* ── الكروت الرئيسية: مضغوطة وتتفتح بالضغط ── */}
      <div style={{ fontSize: 11, fontWeight: 600, color: VAR.muted, letterSpacing: "0.08em", marginBottom: 12 }}>
        نظرة عامة
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 20,
        maxWidth: 1100,
        marginLeft: "auto",
        marginRight: "auto",
      }}>

        {/* 1) المبيعات والفرص */}
        <CollapsibleCard cardKey="sales" icon="📊" title="المبيعات والفرص" badge={salesTab === "today" ? `${todayRev.toFixed(0)} ر.س` : null} badgeColor={VAR.accent}>
          <div style={{ display: "flex", background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 2, gap: 2, margin: "10px 14px 0" }}>
            {SALES_TABS.map((t) => (
              <button
                key={t.key}
                onClick={(e) => { e.stopPropagation(); setSalesTab(t.key); }}
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
          {renderSalesStats()}
        </CollapsibleCard>

        <Modal
          open={showMissedModal}
          onClose={() => setShowMissedModal(false)}
          title={`الفرص الضائعة — ${salesTab === "today" ? "اليوم" : "الشهر"}`}
        >
          {(() => {
            const items = salesTab === "today" ? missedToday.items : missedMonth.items;
            if (!items || items.length === 0) {
              return (
                <div style={{ textAlign: "center", color: VAR.muted, fontSize: 13, padding: "30px 0" }}>
                  لا توجد فرص ضائعة 🎉
                </div>
              );
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: 8, background: VAR.surface2, border: `1px solid ${VAR.border}`, gap: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>{S(item.product_name || "—")}</div>
                      <div style={{ fontSize: 11, color: VAR.muted, marginTop: 3 }}>
                        {S(`الكمية: ${item.qty || 1}`)} · {S(`السبب: ${item.reason || "غير محدد"}`)}
                        {item.cashier ? ` · ${item.cashier}` : ""}
                        {salesTab === "month" && item.date ? ` · ${item.date}` : ""}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: 11, color: VAR.muted, marginTop: 3 }}>{S(`ملاحظة: ${item.notes}`)}</div>
                      )}
                    </div>
                    <div style={{ fontFamily: "monospace", fontWeight: 700, color: VAR.warn, fontSize: 14, whiteSpace: "nowrap" }}>
                      {S(((item.price || 0) * (item.qty || 1)).toFixed(0) + " ر.س")}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Modal>

        {/* مبيعات الأقسام — يومي/شهري مع نسبة وقيمة الربح */}
        <CollapsibleCard
          cardKey="departments"
          icon="🏬"
          title="مبيعات الأقسام"
          badge={`${(deptTab === "today" ? deptStatsToday.totalRevenue : deptStatsMonth.totalRevenue).toFixed(0)} ر.س`}
          badgeColor={VAR.accent2}
        >
          <div style={{ display: "flex", background: VAR.surface2, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 2, gap: 2, margin: "10px 14px 0" }}>
            {[{ key: "today", label: "اليوم" }, { key: "month", label: "الشهر" }].map((t) => (
              <button
                key={t.key}
                onClick={(e) => { e.stopPropagation(); setDeptTab(t.key); }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
                  background: deptTab === t.key ? VAR.accent2 : "transparent",
                  color: deptTab === t.key ? VAR.bg : VAR.muted,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {(() => {
            const stats = deptTab === "today" ? deptStatsToday : deptStatsMonth;
            if (stats.rows.length === 0) {
              return (
                <div style={{ textAlign: "center", color: VAR.muted, fontSize: 12, padding: "24px 0" }}>
                  لا توجد مبيعات مسجّلة {deptTab === "today" ? "اليوم" : "هذا الشهر"} بعد
                </div>
              );
            }
            const overallProfitPct = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
            return (
              <>
                {/* ملخص علوي */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, padding: "14px 14px 6px" }}>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(VAR.accent, 0.08), border: `1px solid ${tint(VAR.accent, 0.28)}` }}>
                    <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>إجمالي الإيراد</div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: VAR.accent }}>{S(stats.totalRevenue.toFixed(0) + " ر.س")}</div>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(COLORS.green, 0.08), border: `1px solid ${tint(COLORS.green, 0.28)}` }}>
                    <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>إجمالي الربح</div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: COLORS.green }}>{S(stats.totalProfit.toFixed(0) + " ر.س")}</div>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: tint(COLORS.gold, 0.08), border: `1px solid ${tint(COLORS.gold, 0.28)}` }}>
                    <div style={{ fontSize: 10, color: VAR.muted, fontWeight: 600 }}>نسبة الربح</div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{overallProfitPct.toFixed(1)}%</div>
                  </div>
                </div>

                {/* كروت زجاجية ملونة لكل قسم — عرض الشريط بنسبة الحصة من الإيراد */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px 14px" }}>
                  {stats.rows.map((r, i) => {
                    const color = DEPT_PALETTE[i % DEPT_PALETTE.length];
                    return (
                      <div
                        key={r.category}
                        style={{
                          position: "relative", borderRadius: 10, overflow: "hidden",
                          background: `linear-gradient(135deg, ${tint(color, 0.16)}, ${tint(color, 0.04)})`,
                          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                          border: `1px solid ${tint(color, 0.32)}`,
                          padding: "10px 12px",
                        }}
                      >
                        {/* شريط تقدّم زجاجي بنسبة الحصة من إجمالي إيراد الفترة */}
                        <div style={{
                          position: "absolute", top: 0, bottom: 0, right: 0,
                          width: `${Math.max(r.share, 3)}%`,
                          background: `linear-gradient(90deg, transparent, ${tint(color, 0.22)})`,
                          transition: "width 0.4s",
                        }} />
                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}` }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{r.category}</span>
                          </div>
                          <span style={{ fontSize: 10, color: VAR.muted, fontFamily: "monospace" }}>{r.share.toFixed(0)}%</span>
                        </div>
                        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color }}>{S(r.revenue.toFixed(0) + " ر.س")}</span>
                          <span style={{ fontSize: 11, color: VAR.muted }}>
                            ربح {S(r.profit.toFixed(0) + " ر.س")}{" "}
                            <span style={{ color: r.profitPct >= 0 ? COLORS.green : COLORS.red, fontWeight: 700 }}>
                              ({r.profitPct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </CollapsibleCard>

        {/* 2) تارجت الشهر */}
        <CollapsibleCard cardKey="target" icon="🎯" title="تارجت الشهر" badge={myTarget ? `${targetProgress.toFixed(0)}%` : null} badgeColor={VAR.accent2}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
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
        </CollapsibleCard>

        {/* 3) مركز التنبيهات */}
        <CollapsibleCard cardKey="alerts" icon="🔔" title="مركز التنبيهات" badge={totalAlertsCount} badgeColor={VAR.danger}>
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
        </CollapsibleCard>

        {/* 4) العروض المتوفرة */}
        <CollapsibleCard cardKey="promos" icon="🏷️" title="العروض المتوفرة" badge={activePromos.length + autoPromoProducts.length} badgeColor={VAR.accent}>
          <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
            {activePromos.length === 0 && autoPromoProducts.length === 0 && (
              <div style={{ padding: "20px 14px", color: VAR.muted, fontSize: 12, textAlign: "center" }}>لا توجد عروض نشطة</div>
            )}
            {/* العروض اليدوية */}
            {activePromos.map((p) => {
              const prod = products.find((pr) => pr.id === p.product_id);
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: `1px solid ${VAR.border}` }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: VAR.text }}>{prod?.name_ar || prod?.name || p.product_id}</div>
                    <div style={{ fontSize: 10, color: VAR.muted }}>حتى {p.end_date}</div>
                  </div>
                  <span style={{ background: COLORS.tealSoft || "rgba(0,200,150,0.12)", color: VAR.accent, borderRadius: 6, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                    خصم {p.discount_percent}%
                  </span>
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
        </CollapsibleCard>

        {/* 5) تغيرات الأسعار */}
        <CollapsibleCard cardKey="prices" icon="💰" title="تغيرات الأسعار" badge={recentPriceChanges.length} badgeColor={VAR.accent2}>
          <div style={{ fontSize: 10, color: VAR.muted, padding: "8px 14px 0" }}>آخر 7 أيام</div>
          <div style={{ maxHeight: 260, overflowY: "auto", padding: "4px 0" }}>
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
        </CollapsibleCard>

        {/* 6) بطاقة الصيدلي */}
        <CollapsibleCard cardKey="shift" icon="👤" title={currentUser?.name || "الصيدلي"} badge={shiftSales.length} badgeColor={VAR.accent}>
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
              <div style={{ fontSize: 10, color: VAR.muted }}>
                {currentShift ? `شفت نشط · بدأ ${new Date(currentShift.start_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : "لا يوجد شفت مفتوح"}
              </div>
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
        </CollapsibleCard>

        {/* 7) خزنة اليوم */}
        <CollapsibleCard cardKey="treasury" icon="💵" title="خزنة اليوم" badge={(todayRev + todayCreditPaid - todayReturnsForDash - todayPettyExpenses).toFixed(0) + " ر.س"} badgeColor={VAR.accent}>
          <div style={{ padding: 16 }}>
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
        </CollapsibleCard>

        {/* 8) إجراءات سريعة */}
        <CollapsibleCard cardKey="actions" icon="⚡" title="إجراءات سريعة">
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
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
        </CollapsibleCard>
      </div>

      {/* ── تايم لاين حركة اليوم — أسفل الداشبورد بعرض كامل ── */}
      <div style={{
        ...card,
        padding: "16px 18px 14px",
        marginTop: 8,
        background: `linear-gradient(135deg, ${VAR.surface}, ${tint(VAR.accent, 0.05)})`,
        border: `1px solid ${tint(VAR.accent, 0.25)}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16 }}>🕐</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: VAR.text }}>حركة اليوم بالساعة</span>
        </div>
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
  const barcodeInputRef = useRef(null);
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
    barcodeInputRef.current?.focus();
  }, [activeTab]);

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
            padding: "6px 16px",
            borderBottom: "1px solid #1d2d4a",
            display: "flex",
            gap: 8,
            flexShrink: 0,
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <BarcodeScanner
              ref={barcodeInputRef}
              onScan={scanBarcode}
              placeholder="امسح باركود الصنف..."
            />
          </div>
          <div style={{ flex: 1.4, minWidth: 0, position: "relative", display: "flex", gap: 6 }}>
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
                flex: 1,
                minWidth: 0,
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
                whiteSpace: "nowrap",
                flexShrink: 0,
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
            padding: "8px 14px",
            borderTop: "1px solid #1d2d4a",
            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          {/* ===== وسيلة الدفع ===== */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
              {[
                { mode: "single", label: "دفعة واحدة" },
                { mode: "split", label: "⇄ تقسيم الدفع" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setInv((p) => ({ ...p, paymentMode: mode }))}
                  style={{
                    flex: 1,
                    padding: "4px 0",
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
                        padding: "5px 0",
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
              padding: "7px 12px",
              marginBottom: 6,
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
              marginBottom: 6,
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
              padding: 7,
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, fontSize: 12, marginBottom: 3 }}>
              <span>قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 3 }}>
              <span>ضريبة 15%</span>
              <span>{taxAmount.toFixed(2)} ر.س</span>
            </div>
            {discountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 3 }}>
                <span>خصم {inv.discountType === "percent" ? `${inv.discount}%` : `${inv.discount} ر.س`}</span>
                <span>- {discountAmt.toFixed(2)} ر.س</span>
              </div>
            )}
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.green, fontSize: 12, marginBottom: 3 }}>
                <span>🌟 نقاط ولاء</span>
                <span>- {pointsToRedeem.toFixed(2)} ر.س</span>
              </div>
            )}
            {missedTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gold, fontSize: 12, marginBottom: 3 }}>
                <span>⚠ فرص ضائعة</span>
                <span>{missedTotal.toFixed(2)} ر.س</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textPrimary, fontSize: 17, fontWeight: 800, borderTop: "1px solid #1d2d4a", paddingTop: 5, marginTop: 3 }}>
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
const getPharmacySettings = async (pharmacyId) => {
  try {
    const { data } = await supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
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
    if (!pharmacyId) return;
    supabase.from("pharmacy_settings").select("*").eq("pharmacy_id", pharmacyId).single()
      .then(({ data }) => { if (data) setPharmSettings(data); });
  }, [pharmacyId]);

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

  const addItem = (p, expiry = "", batch = "") => {
    setItems((prev) => {
      const ex = prev.find((i) => i.id === p.id && (i.expiry_date || "") === expiry);
      if (ex && !expiry)
        return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      if (ex && expiry)
        return prev.map((i) => (i.id === p.id && i.expiry_date === expiry ? { ...i, qty: i.qty + 1 } : i));
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
          expiry_date: expiry,
          batch_number: batch,
          _rowKey: p.id + "_" + Date.now(),
        },
      ];
    });
    setSearchText("");
    setSearchResults([]);
    setShowDropdown(false);
    focusNewItemQty(p);

  };

  // إضافة نفس الصنف كصف جديد مستقل (تاريخ مختلف)
  const addItemAsNew = (p, expiry = "", batch = "") => {
    setItems((prev) => [
      ...prev,
      {
        ...p,
        qty: 1,
        bonusQty: 0,
        discount1: 0,
        discount2: 0,
        receivedCost: p.cost,
        newSalePrice: p.price,
        expiry_date: expiry,
        batch_number: batch,
        _rowKey: p.id + "_" + Date.now(),
      },
    ]);
    setSearchText("");
    setSearchResults([]);
    setShowDropdown(false);
    focusNewItemQty(p);
  };

  const _focusBarcode__ = () => {
    const el = document.querySelector('input[placeholder="امسح باركود الصنف..."]') as HTMLInputElement;
    if (el) el.focus();
  };

  // فوكس على خانة الكمية للصنف المضاف
  const focusNewItemQty = (p) => {
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
    // آخر خانة (expiry_date) → بار الباركود
    if (nextCol >= cols.length) {
      // البحث عن input بار الباركود
      const barcodeInput = document.querySelector('input[placeholder="امسح باركود الصنف..."]') as HTMLInputElement;
      if (barcodeInput) barcodeInput.focus();
      else searchRef.current?.focus();
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
      setPurchases((p) => p.filter((x) => x.id !== po.id)); // نتراجع عن الإضافة المحلية لأن الحفظ فشل
      return; // لا نكمّل تحديث المخزون لأن الفاتورة نفسها لم تُحفظ
    }
    const stockUpdateFailures = [];
    for (const ci of items) {
      const product = products.find((x) => x.id === ci.id);
      if (!product) continue;
      const newStock = product.stock + ci.qty + (ci.bonusQty || 0);
      const { error: stockErr } = await supabase
        .from("products")
        .update({
          stock: newStock,
          cost: ci.receivedCost,
          price: ci.newSalePrice,
          not_available_market: false,
        })
        .eq("id", ci.id)
        .eq("pharmacy_id", pharmacyId);
      if (stockErr) stockUpdateFailures.push(product.name || ci.id);
    }
    if (stockUpdateFailures.length > 0) {
      showToast("⚠️ تم حفظ الفاتورة لكن فشل تحديث مخزون: " + stockUpdateFailures.join("، "), "error");
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
              const expiry = scan.type === "gs1" ? (scan.expiry ? scan.expiry.slice(0, 7) : "") : "";
              const batch = scan.type === "gs1" ? (scan.batch || "") : "";
              const found = products.find((x) => x.barcode === code || x.id === code);
              if (!found) { showToast("الصنف غير موجود: " + code, "error"); return; }
              // إذا كان نفس الصنف موجود بتاريخ مختلف → أضف كصف جديد
              const existSameDate = items.find((i) => i.id === found.id && (i.expiry_date || "") === expiry);
              if (existSameDate || !expiry) {
                addItem(found, expiry, batch);
              } else {
                // نفس الصنف بتاريخ مختلف → صف جديد مستقل
                addItemAsNew(found, expiry, batch);
              }
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
                      onKeyDown={(e) => {
                        // السهام → يتركها للـ browser عشان تنقل بين شهر/سنة
                        if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) return;
                        handleCellKeyDown(e, rowIndex, "expiry_date");
                      }}
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
              ["المادة الفعالة", showProductCard.active_ingredient || showProductCard.activeIngredient],
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
                  .eq("id", showDetail.id)
                  .eq("pharmacy_id", pharmacyId);
                if (error) {
                  showToast("فشل التعديل: " + error.message, "error");
                  return;
                }

                // 🆕 مطابقة المخزون: الفاتورة القديمة أصلاً زوّدت المخزون بكمياتها،
                // فلو الكميات اتغيرت في التعديل، لازم نعدّل الفرق بس على المخزون
                const oldQtyById = {};
                (showDetail.items || []).forEach((i) => {
                  oldQtyById[i.id] = (oldQtyById[i.id] || 0) + i.qty + (i.bonusQty || 0);
                });
                const newQtyById = {};
                editItems.forEach((i) => {
                  newQtyById[i.id] = (newQtyById[i.id] || 0) + i.qty + (i.bonusQty || 0);
                });
                const affectedIds = new Set([...Object.keys(oldQtyById), ...Object.keys(newQtyById)]);
                const stockFailures = [];
                const stockDeltaById = {};
                for (const pid of affectedIds) {
                  const delta = (newQtyById[pid] || 0) - (oldQtyById[pid] || 0);
                  if (delta === 0) continue;
                  const prod = products.find((x) => x.id === pid);
                  if (!prod) continue;
                  const newStock = prod.stock + delta;
                  const { error: stockErr } = await supabase
                    .from("products")
                    .update({ stock: newStock })
                    .eq("id", pid)
                    .eq("pharmacy_id", pharmacyId);
                  if (stockErr) { stockFailures.push(prod.name || pid); continue; }
                  stockDeltaById[pid] = newStock;
                }
                if (stockFailures.length > 0) {
                  showToast("⚠️ تم تعديل الفاتورة لكن فشل تحديث مخزون: " + stockFailures.join("، "), "error");
                }
                if (Object.keys(stockDeltaById).length > 0) {
                  setProducts((prev) =>
                    prev.map((x) => (stockDeltaById[x.id] !== undefined ? { ...x, stock: stockDeltaById[x.id] } : x))
                  );
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
  canViewSalesReturns = true,
  canViewPurchaseReturns = true,
  canEditSalesReturns = true,
  canEditPurchaseReturns = true,
}) {
  const [type, setType] = useState(canViewSalesReturns ? "sales" : "purchases");
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
        {["sales", "purchases"]
          .filter((t) => (t === "sales" ? canViewSalesReturns : canViewPurchaseReturns))
          .map((t) => (
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
      {type === "sales" && canViewSalesReturns && (
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
      {type === "purchases" && canViewPurchaseReturns && (
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

      {(type === "sales" ? canEditSalesReturns : canEditPurchaseReturns) ? (
        <Btn icon="returns" onClick={processReturn} variant="danger">تأكيد الإرجاع</Btn>
      ) : (
        <div style={{ padding: "10px 14px", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textDim, fontSize: 12, textAlign: "center" }}>
          🔒 ليس لديك صلاحية تنفيذ {type === "sales" ? "مرتجع المبيعات" : "مرتجع المشتريات"} — عرض فقط
        </div>
      )}
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
  const [similarSearch, setSimilarSearch] = useState("");
  const [similarProductId, setSimilarProductId] = useState("");
  const [showSimilarDropdown, setShowSimilarDropdown] = useState(false);
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

    const { data: pi } = await supabase.from("product_ingredients").select("*, active_ingredients(name_ar, name_en)").eq("product_id", p.id);
    setSelectedIngredients((pi || []).map((x) => {
      const fromAll = allIngredients.find((a) => a.id === x.ingredient_id);
      return {
        ingredient_id: x.ingredient_id,
        name_ar:
          x.active_ingredients?.name_ar ||
          x.active_ingredients?.name_en ||
          fromAll?.name_ar ||
          fromAll?.name_en ||
          "⚠️ مادة فعالة غير موجودة",
        concentration: x.concentration || "",
        db_id: x.id,
      };
    }));

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
    setSelectedIngredients((prev) => [...prev, { ingredient_id: ing.id, name_ar: ing.name_ar || ing.name_en || "", concentration: "", db_id: null }]);
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
    const { error } = await supabase.from("manufacturers").delete().eq("id", id).eq("pharmacy_id", pharmacyId);
    if (error) { showToast("خطأ: " + error.message, "error"); return; }
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
      const { error } = await supabase.from("products").update(p).eq("id", editing).eq("pharmacy_id", pharmacyId);
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
                const { error } = await supabase.from("products").delete().eq("id", p.id).eq("pharmacy_id", pharmacyId);
                if (error) { showToast("خطأ: " + error.message, "error"); return; }
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

        {/* صنف مثيل */}
        <div style={{ marginTop: 16, borderTop: "1px solid #1d2d4a", paddingTop: 14 }}>
          <div style={{ fontWeight: 700, color: COLORS.blue, marginBottom: 8, fontSize: 14 }}>🔗 صنف مثيل (اختياري)</div>
          <div style={{ position: "relative" }}>
            <input
              value={similarSearch}
              onChange={(e) => { setSimilarSearch(e.target.value); setShowSimilarDropdown(true); setSimilarProductId(""); }}
              onFocus={() => setShowSimilarDropdown(true)}
              placeholder="ابحث عن الصنف الأصلي المثيل له..."
              style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #2a4a7a", borderRadius: 7, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
            />
            {showSimilarDropdown && similarSearch && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #2a4a7a", borderRadius: 7, zIndex: 200, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                {products.filter((p) => (p.name_ar || p.name || "").includes(similarSearch) && p.id !== form.id).slice(0, 8).map((p) => (
                  <div key={p.id} onClick={() => {
                    setSimilarProductId(p.id);
                    setSimilarSearch(p.name_ar || p.name || "");
                    setShowSimilarDropdown(false);
                    // استيراد المواد الفعالة من الصنف المثيل
                    supabase.from("product_ingredients")
                      .select("*, active_ingredients(name_ar, name_en)")
                      .eq("product_id", p.id)
                      .then(({ data }) => {
                        if (data && data.length > 0) {
                          setSelectedIngredients(data.map((x) => {
                            const fromAll = allIngredients.find((a) => a.id === x.ingredient_id);
                            return {
                              ingredient_id: x.ingredient_id,
                              name_ar:
                                x.active_ingredients?.name_ar ||
                                x.active_ingredients?.name_en ||
                                fromAll?.name_ar ||
                                fromAll?.name_en ||
                                "⚠️ مادة فعالة غير موجودة",
                              concentration: x.concentration || "",
                            };
                          }));
                          showToast(`✅ تم استيراد ${data.length} مادة فعالة من ${p.name_ar || p.name}`);
                        }
                      });
                  }}
                    style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.textPrimary, fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {p.name_ar || p.name}
                    {(p.active_ingredient || "") && <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 6 }}>— {p.active_ingredient}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {similarProductId && <div style={{ color: COLORS.green, fontSize: 12, marginTop: 5 }}>✅ المواد الفعالة تم استيرادها تلقائياً</div>}
        </div>

        {/* المواد الفعالة */}
        <div style={{ marginTop: 20, borderTop: "1px solid #1d2d4a", paddingTop: 16 }}>
          <div style={{ fontWeight: 700, color: COLORS.blue, marginBottom: 10, fontSize: 14 }}>🧪 المواد الفعالة</div>
          {selectedIngredients.map((ing) => (
            <div key={ing.ingredient_id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ flex: 1, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #2a4a7a", borderRadius: 7, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, minHeight: 36 }}>{ing.name_ar}</div>
              <input value={ing.concentration} onChange={(e) => updateIngredientConc(ing.ingredient_id, e.target.value)}
                placeholder="التركيز (مثال: 500mg)"
                style={{ width: 170, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #2a4a7a", borderRadius: 7, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", minHeight: 36 }} />
              <Btn size="sm" variant="danger" onClick={() => removeIngredient(ing.ingredient_id)}>✕</Btn>
            </div>
          ))}
          <div style={{ position: "relative", marginTop: 8 }}>
            <input value={ingredientSearch} onChange={(e) => { setIngredientSearch(e.target.value); setShowIngredientDropdown(true); }}
              onFocus={() => setShowIngredientDropdown(true)}
              placeholder="🔍 بحث عن مادة فعالة أو إضافة جديدة..."
              style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid #1d2d4a", borderRadius: 6, padding: "7px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            {showIngredientDropdown && ingredientSearch && (
              <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #2a4a7a", borderRadius: 6, zIndex: 200, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                {filteredIngredients.map((ing) => (
                  <div key={ing.id} onClick={() => addIngredient(ing)}
                    style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.textPrimary, fontSize: 13, borderBottom: `1px solid ${COLORS.border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    {ing.name_ar ? (
                      <>{ing.name_ar} {ing.name_en && <span style={{ color: COLORS.textDim, fontSize: 11 }}>({ing.name_en})</span>}</>
                    ) : (
                      <>{ing.name_en || "—"} <span style={{ color: COLORS.gold, fontSize: 10 }}>(بدون اسم عربي)</span></>
                    )}
                  </div>
                ))}
                <div onClick={addNewIngredient}
                  style={{ padding: "9px 14px", cursor: "pointer", color: COLORS.green, fontSize: 13, fontWeight: 600 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
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
    const okUpdates = [];
    for (const u of updates) {
      const { error: retError } = await supabase.from("purchases").update({ returned_amount: u.returned_amount }).eq("id", u.id).eq("pharmacy_id", pharmacyId);
      if (retError) { showToast("خطأ في تحديث المرتجع: " + retError.message, "error"); continue; }
      okUpdates.push(u);
    }
    setPurchases((prev) =>
      prev.map((p) => {
        const u = okUpdates.find((x) => x.id === p.id);
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

    const stockUpdates = [];
    for (const ri of items) {
      const prod = products.find((x) => x.id === ri.id);
      if (prod) {
        const newStock = prod.stock - ri.returnQty;
        const { error: stockError } = await supabase.from("products")
          .update({ stock: newStock })
          .eq("id", ri.id)
          .eq("pharmacy_id", pharmacyId);
        if (stockError) { showToast(`خطأ في تحديث مخزون ${prod.name || ri.id}: ` + stockError.message, "error"); continue; }
        stockUpdates.push({ id: ri.id, stock: newStock });
      }
    }
    if (stockUpdates.length > 0) {
      setProducts((prev) => prev.map((p) => {
        const u = stockUpdates.find((x) => x.id === p.id);
        return u ? { ...p, stock: u.stock } : p;
      }));
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

  // ========== FIFO للسداد (رصيد أول المدة يُعتبر أقدم دين فيُسدَّد أولاً) ==========
  const processPaymentFIFO = async (supplierId, totalAmount) => {
    let remaining = totalAmount;
    const supplier = suppliers.find((s) => s.id === supplierId);

    // 1) نخصم من رصيد أول المدة أولاً (لأنه أقدم دين على المورد)
    let openingBalance = supplier?.opening_balance || 0;
    if (remaining > 0 && openingBalance > 0) {
      const payToOpening = Math.min(remaining, openingBalance);
      const newOpeningBalance = openingBalance - payToOpening;

      // نخصم من تفاصيل رصيد أول المدة بدءاً بالأقدم (أعلى عدد أيام)
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

      const { error: obError } = await supabase.from("suppliers").update({
        opening_balance: newOpeningBalance,
        opening_balance_details: newDetails,
      }).eq("id", supplierId).eq("pharmacy_id", pharmacyId);
      if (obError) { showToast("خطأ في تحديث رصيد أول المدة: " + obError.message, "error"); return; }
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
      const balance = getPurchaseNetDebt(po); // 🆕 يحسب صافي الدين بعد المرتجعات
      const payment = Math.min(remaining, balance);
      const newPaid = (po.paid || 0) + payment;
      const stillOwed = (po.total - (po.returned_amount || 0)) - newPaid;
      updates.push({ id: po.id, paid: newPaid, payment_status: stillOwed <= 0 ? "مسددة" : "مسددة جزئياً" });
      remaining -= payment;
    }
    const okUpdates = [];
    for (const u of updates) {
      const { error: puError } = await supabase.from("purchases").update({ paid: u.paid, payment_status: u.payment_status }).eq("id", u.id).eq("pharmacy_id", pharmacyId);
      if (puError) { showToast("خطأ في تحديث فاتورة الشراء: " + puError.message, "error"); continue; }
      okUpdates.push(u);
    }
    setPurchases((prev) =>
      prev.map((p) => { const u = okUpdates.find((x) => x.id === p.id); return u ? { ...p, ...u } : p; })
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
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editing).eq("pharmacy_id", pharmacyId);
      if (error) { showToast("فشل التعديل: " + error.message, "error"); return; }
      setSuppliers((p) => p.map((x) => (x.id === editing ? { ...x, ...form, opening_balance: openingBal } : x)));
    } else {
      const { data, error } = await supabase.from("suppliers").insert({ id: form.id, ...payload, pharmacy_id: pharmacyId }).select();
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

              {isExpanded && (
                <>
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
                </>
              )}

              {/* أزرار — تظل ظاهرة دائماً للوصول السريع */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: isExpanded ? 0 : 6 }} onClick={(e) => e.stopPropagation()}>
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
                  const supplierDebt = getSupplierDebt(s.id);
                  if (supplierDebt > 0) {
                    if (currentUser?.role !== "admin") { showToast("❌ لا يمكن حذف مورد عليه مديونية", "error"); return; }
                    if (!window.confirm(`⚠️ على المورد "${s.name}" مديونية ${supplierDebt.toFixed(2)} ر.س
هل أنت متأكد من الحذف؟`)) return;
                  }
                  const { error: delSupError } = await supabase.from("suppliers").delete().eq("id", s.id).eq("pharmacy_id", pharmacyId);
                  if (delSupError) { showToast("خطأ: " + delSupError.message, "error"); return; }
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
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid #1d2d4a", borderRadius: 8,
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
                          cost: p.cost,
                          movement: { class: "manual", label: "إضافة يدوية", color: COLORS.blue },
                          editable: true,
                        }]);
                        setManualProductSearch("");
                        setManualProductSearchOpen(false);
                      }}
                      style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #1a2a3a", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span style={{ fontSize: 13, color: COLORS.textPrimary }}>{p.name || p.nameAr}</span>
                      <span style={{ fontSize: 11, color: COLORS.textDim }}>مخزون: {p.stock || 0}</span>
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

    const { error: salesInsertError } = await supabase.from("sales").insert(paymentRecord);
    if (salesInsertError) {
      showToast("⚠️ تم تسجيل السداد لكن فشل تسجيله في المبيعات: " + salesInsertError.message, "error");
    } else {
      setSales((p) => [...p, paymentRecord]);
    }
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
                const { error } = await supabase.from("customers").delete().eq("id", c.id).eq("pharmacy_id", pharmacyId);
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

  // ── دالة حفظ نسبة العمولة (كانت مفقودة — التعديل كان بيضيع بعد الريفرش) ──
  const saveIncentiveRate = async (newRate: number) => {
    const { error } = await supabase.from("incentive_config").upsert({
      pharmacy_id: pharmacyId,
      rate: newRate,
    }, { onConflict: "pharmacy_id" });
    if (error) { showToast("خطأ في حفظ نسبة العمولة: " + error.message, "error"); return; }
    showToast("تم حفظ نسبة العمولة ✓");
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
      const { error } = await supabase.from("promotions").update(row).eq("id", editPromoId).eq("pharmacy_id", pharmacyId);
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
                            const { error: delPromoError } = await supabase.from("promotions").delete().eq("id", promo.id).eq("pharmacy_id", pharmacyId);
                            if (delPromoError) { showToast("خطأ: " + delPromoError.message, "error"); return; }
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
                    onBlur={(e) => saveIncentiveRate(+e.target.value)}
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
                      const { error: delIncError } = await supabase.from("incentive_products").delete().eq("id", item.id).eq("pharmacy_id", pharmacyId);
                      if (delIncError) { showToast("خطأ: " + delIncError.message, "error"); return; }
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
function TreasuryModule({ sales, creditPayments, purchases, suppliers, pharmacyId, currentUser, showToast, shifts, entries, setEntries, canViewSub = (_sub) => true, canEditSub = (_sub) => true }) {
  const canViewDayClosing = canViewSub("day_closing");
  const canEditDayClosing = canEditSub("day_closing");
  const canViewOverview   = canViewSub("overview");
  const canEditOverview   = canEditSub("overview");
  const [activeTab, setActiveTab] = useState(canViewDayClosing ? "today" : canViewOverview ? "shifts" : "today");
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
      {canViewOverview && (
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
      )}

      {/* تنبيهات */}
      {canViewOverview && (dueFixed.length > 0 || upcomingLicenses.length > 0) && (
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
          { k: "today", l: "📅 تقفيل اليوم", allowed: canViewDayClosing },
          { k: "shifts", l: "🔄 الشفتات", allowed: canViewOverview },
          { k: "history", l: "📋 السجل", allowed: canViewOverview },
          { k: "fixed", l: "🔒 مصاريف ثابتة", allowed: canViewOverview },
          { k: "licenses", l: "📄 التراخيص", allowed: canViewOverview },
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
          <button
            onClick={() => setActiveTab("log")}
            style={{ background: COLORS.blueSoft, border: "1px solid #2a5aaa", borderRadius: 8, padding: "8px 20px", color: COLORS.blue, fontSize: 13, cursor: "pointer" }}
          >
            📋 عرض سجل الأيام
          </button>
        </div>
      )}

      {activeTab === "today" && canViewDayClosing && !closingSaved && (
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
            {!closingSaved && canEditDayClosing && (
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
      {activeTab === "fixed" && canViewOverview && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            {canEditOverview && <Btn icon="plus" onClick={() => setShowFixedForm(true)}>إضافة مصروف ثابت</Btn>}
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
      {activeTab === "licenses" && canViewOverview && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            {canEditOverview && <Btn icon="plus" onClick={() => setShowLicenseForm(true)}>إضافة ترخيص</Btn>}
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

// ── قائمة المدن السعودية لحساب مواقيت الصلاة ──
const SAUDI_CITIES = [
  { id: "riyadh", name: "الرياض", lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", name: "جدة", lat: 21.4858, lng: 39.1925 },
  { id: "makkah", name: "مكة المكرمة", lat: 21.3891, lng: 39.8579 },
  { id: "madinah", name: "المدينة المنورة", lat: 24.5247, lng: 39.5692 },
  { id: "dammam", name: "الدمام", lat: 26.4207, lng: 50.0888 },
  { id: "khobar", name: "الخبر", lat: 26.2172, lng: 50.1971 },
  { id: "dhahran", name: "الظهران", lat: 26.2361, lng: 50.0393 },
  { id: "taif", name: "الطائف", lat: 21.2703, lng: 40.4158 },
  { id: "tabuk", name: "تبوك", lat: 28.3998, lng: 36.5700 },
  { id: "abha", name: "أبها", lat: 18.2164, lng: 42.5053 },
  { id: "khamis_mushait", name: "خميس مشيط", lat: 18.3000, lng: 42.7333 },
  { id: "buraidah", name: "بريدة", lat: 26.3260, lng: 43.9750 },
  { id: "hail", name: "حائل", lat: 27.5114, lng: 41.6900 },
  { id: "najran", name: "نجران", lat: 17.4924, lng: 44.1277 },
  { id: "jazan", name: "جازان", lat: 16.8892, lng: 42.5611 },
  { id: "al_ahsa", name: "الأحساء", lat: 25.3833, lng: 49.5833 },
  { id: "yanbu", name: "ينبع", lat: 24.0896, lng: 38.0618 },
  { id: "qatif", name: "القطيف", lat: 26.5208, lng: 49.9989 },
  { id: "arar", name: "عرعر", lat: 30.9753, lng: 41.0381 },
  { id: "sakaka", name: "سكاكا", lat: 29.9697, lng: 40.2064 },
];

const API_KEY_MAP: Record<string, string> = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
const ACTIVE_PRAYERS = ["الظهر", "العصر", "المغرب", "العشاء"];

async function fetchPrayerTimes(lat = 24.7136, lng = 46.6753) {
  const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const url = `https://api.aladhan.com/v1/timings/${today}?latitude=${lat}&longitude=${lng}&method=4`;
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
  const [prayerCity, setPrayerCity] = useState<string>("riyadh");
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
    if (!pharmacyId) return;
    supabase
      .from("pharmacy_settings")
      .select("prayer_city")
      .eq("pharmacy_id", pharmacyId)
      .single()
      .then(({ data }) => {
        if (data?.prayer_city) setPrayerCity(data.prayer_city);
      });
  }, [pharmacyId]);

  const saveCityAndReload = async (cityId: string) => {
    setPrayerCity(cityId);
    await supabase
      .from("pharmacy_settings")
      .upsert([{ pharmacy_id: pharmacyId, prayer_city: cityId }], { onConflict: "pharmacy_id" });
    const city = SAUDI_CITIES.find((c) => c.id === cityId);
    if (city) {
      try {
        const pt = await fetchPrayerTimes(city.lat, city.lng);
        setPrayerTimes(pt);
        globalToast(`✅ تم تحديث المواقيت حسب ${city.name}`);
      } catch {
        globalToast("تعذّر تحميل مواقيت الصلاة", "error");
      }
    }
  };

  useEffect(() => {
    intervalRef.current = setInterval(checkPrayerAlerts, 30000);
    return () => clearInterval(intervalRef.current);
  }, [prayerTimes, prayerSettings, todayLogs, prayerBreaks]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPharmacists(), loadTodayLogs(), loadPrayerSettings(), loadPrayerBreaks(), loadWorkSchedules()]);
    try {
      const { data: settingsData } = await supabase
        .from("pharmacy_settings")
        .select("prayer_city")
        .eq("pharmacy_id", pharmacyId)
        .single();
      const cityId = settingsData?.prayer_city || "riyadh";
      const city = SAUDI_CITIES.find((c) => c.id === cityId) || SAUDI_CITIES[0];
      setPrayerCity(city.id);
      const pt = await fetchPrayerTimes(city.lat, city.lng);
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
    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("id", id)
      .eq("pharmacy_id", pharmacyId);
    if (error) { globalToast("خطأ: " + error.message, "error"); return; }
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

          {/* اختيار المدينة لحساب مواقيت الصلاة */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 8 }}>🕌 المدينة المعتمدة لحساب مواقيت الصلاة</div>
            <select
              value={prayerCity}
              onChange={(e) => saveCityAndReload(e.target.value)}
              style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none" }}
            >
              {SAUDI_CITIES.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
              تغيير المدينة يعيد حساب مواقيت الصلاة فوراً حسب الإحداثيات الجديدة
            </div>
          </div>

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
  { id: "returns",           label: "المرتجعات",            icon: "↩️", subItems: [
      { id: "sales",     label: "مرتجع المبيعات" },
      { id: "purchases", label: "مرتجع المشتريات" },
    ] },
  { id: "products",          label: "الأصناف والمخزون",    icon: "💊" },
  { id: "suppliers",         label: "الموردون",             icon: "🏭" },
  { id: "customers",         label: "العملاء",              icon: "👥" },
  { id: "loyalty",           label: "نقاط الولاء",         icon: "🌟" },
  { id: "reports",           label: "التقارير",             icon: "📈" },
  { id: "tax_report",        label: "التقرير الضريبي",     icon: "🧾" },
  { id: "promotions",        label: "العروض والخصومات",    icon: "🏷️" },
  { id: "treasury",          label: "الخزنة",              icon: "💰", subItems: [
      { id: "day_closing", label: "تقفيل اليوم" },
      { id: "overview",    label: "محتويات الخزنة (الأرصدة، الشفتات، السجل، المصاريف، التراخيص)" },
    ] },
  { id: "shift",             label: "الشفتات",             icon: "🕐" },
  { id: "target",            label: "تارجت المبيعات",      icon: "🎯" },
  { id: "inventory_count",   label: "الجرد",               icon: "📋" },
  { id: "expiry_report",     label: "تقرير الصلاحيات",    icon: "⚠️" },
  { id: "attendance",        label: "الحضور والانصراف",   icon: "⏱️" },
  { id: "pharmacy_settings", label: "بيانات الصيدلية",    icon: "⚙️" },
  { id: "rasd_settings",     label: "إعدادات رصد",         icon: "🔗" },
];

// ── مفتاح موحّد لتخزين/قراءة صلاحية القسم أو صلاحية عنصر فرعي داخله ──
const permKey = (sectionId, subId = undefined) => (subId ? `${sectionId}::${subId}` : sectionId);

// ── الأدوار الافتراضية ──
const DEFAULT_ROLES = ["pharmacist", "cashier"];

function PermissionsModule({
  pharmacyId,
  showToast,
  users,
  setUsers,
  currentUser,
}: {
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
  users: any[];
  setUsers: (fn: any) => void;
  currentUser?: any;
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // ── المستخدمين (يأتي من الأب الآن، مش state محلي) ──
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
          map[r.role][permKey(r.section, r.sub_section)] = { can_view: r.can_view, can_edit: r.can_edit };
        });
      }
      [...foundRoles].forEach((role) => {
        if (!map[role]) map[role] = {};
        SYSTEM_SECTIONS.forEach((sec) => {
          const defaultPerm = {
            can_view: role === "cashier" ? sec.id === "pos" : true,
            can_edit: role === "cashier" ? sec.id === "pos" : sec.id !== "pharmacy_settings" && sec.id !== "rasd_settings",
          };
          if (!map[role][permKey(sec.id)]) map[role][permKey(sec.id)] = defaultPerm;
          (sec.subItems || []).forEach((sub) => {
            if (!map[role][permKey(sec.id, sub.id)]) map[role][permKey(sec.id, sub.id)] = { ...defaultPerm };
          });
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
        const keys = [permKey(sec.id), ...(sec.subItems || []).map((sub) => permKey(sec.id, sub.id))];
        keys.forEach((k) => {
          if (type === "view_all") rolePerms[k] = { can_view: true, can_edit: rolePerms[k]?.can_edit ?? false };
          else if (type === "edit_all") rolePerms[k] = { can_view: true, can_edit: true };
          else rolePerms[k] = { can_view: false, can_edit: false };
        });
      });
      return { ...prev, [selectedRole]: rolePerms };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const rows: any[] = [];
    SYSTEM_SECTIONS.forEach((sec) => {
      rows.push({
        pharmacy_id: pharmacyId,
        role: selectedRole,
        section: sec.id,
        sub_section: "",
        can_view: perms[selectedRole]?.[permKey(sec.id)]?.can_view ?? true,
        can_edit: perms[selectedRole]?.[permKey(sec.id)]?.can_edit ?? false,
        updated_at: new Date().toISOString(),
      });
      (sec.subItems || []).forEach((sub) => {
        rows.push({
          pharmacy_id: pharmacyId,
          role: selectedRole,
          section: sec.id,
          sub_section: sub.id,
          can_view: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_view ?? true,
          can_edit: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_edit ?? false,
          updated_at: new Date().toISOString(),
        });
      });
    });
    const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "pharmacy_id,role,section,sub_section" });
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
    SYSTEM_SECTIONS.forEach((sec) => {
      defaultPerms[permKey(sec.id)] = { can_view: true, can_edit: false };
      (sec.subItems || []).forEach((sub) => { defaultPerms[permKey(sec.id, sub.id)] = { can_view: true, can_edit: false }; });
    });
    setRoles((p) => [...p, name]);
    setPerms((p) => ({ ...p, [name]: defaultPerms }));
    setSelectedRole(name);
    setAddRoleModal(false);
    setNewRoleName("");
    setDirty(true);
    showToast(`تم إضافة دور "${name}"`);
  };

  // ── إضافة/تعديل مستخدم (عبر Edge Function — لأنها تنشئ/تعدّل حساب Auth حقيقي بـ service_role) ──
  const saveUser = async () => {
    if (!userForm.name || !userForm.username || (userModal === "add" && !userForm.password)) {
      return showToast("يرجى تعبئة جميع الحقول", "error");
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return showToast("الجلسة منتهية، سجّل الدخول من جديد", "error");

    if (userModal === "add") {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          pharmacy_id: pharmacyId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showToast("خطأ في الإضافة: " + (json.error || "غير معروف"), "error");
      setUsers((p) => [...p, json.user]);
      showToast("تم إضافة المستخدم ✓");
    } else {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-update-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          id: selectedUser.id,
          name: userForm.name,
          username: userForm.username,
          ...(userForm.password ? { password: userForm.password } : {}),
          role: userForm.role,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showToast("خطأ في التعديل: " + (json.error || "غير معروف"), "error");
      setUsers((p) => p.map((u) => u.id === selectedUser.id ? { ...u, ...userForm } : u));
      showToast("تم تعديل المستخدم ✓");
    }
    setUserModal(null);
    setUserForm({ name: "", username: "", password: "", role: "pharmacist" });
  };

  // ── حذف مستخدم (عبر Edge Function — عشان يُحذف حساب Auth برضو) ──
  const deleteUser = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return showToast("الجلسة منتهية، سجّل الدخول من جديد", "error");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("خطأ في الحذف: " + (json.error || "غير معروف"), "error");
    setUsers((p) => p.filter((u) => u.id !== id));
    setDeleteConfirm(null);
    showToast("تم حذف المستخدم ✓");
  };

  const roleLabel = (r: string) =>
    r === "pharmacist" ? "صيدلاني" : r === "cashier" ? "كاشير" : r === "admin" ? "مدير" : r;

  const currentRolePerms = perms[selectedRole] || {};
  const viewCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_view).length;
  const editCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_edit).length;

  // حراسة إضافية (طبقة دفاع ثانية): لو وصل لغير أدمن للموديول ده بأي طريقة، يتمنع فورًا
  if (currentUser?.role !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        🔒 هذه الصفحة متاحة لمدير النظام فقط
      </div>
    );
  }

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
                  const p = currentRolePerms[permKey(sec.id)] || { can_view: false, can_edit: false };
                  const hasSubItems = (sec.subItems || []).length > 0;
                  const isExpanded = !!expandedSections[sec.id];
                  return (
                    <div key={sec.id}>
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 120px 120px",
                        padding: "13px 20px", alignItems: "center",
                        borderBottom: (i < SYSTEM_SECTIONS.length - 1 || (hasSubItems && isExpanded)) ? "1px solid #0a1020" : "none",
                        background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                        opacity: !p.can_view ? 0.55 : 1,
                      }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 10, cursor: hasSubItems ? "pointer" : "default" }}
                          onClick={() => hasSubItems && setExpandedSections((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                        >
                          <span style={{ fontSize: 18 }}>{sec.icon}</span>
                          <span style={{ fontSize: 14, color: p.can_view ? VAR.text : VAR.muted, fontWeight: p.can_view ? 600 : 400 }}>{sec.label}</span>
                          {hasSubItems && (
                            <span style={{ color: VAR.muted, fontSize: 11, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▼</span>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_view")} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_view ? "#1a5a30" : "#2a1020", cursor: "pointer", position: "relative" }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_view ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_view ? COLORS.green : COLORS.red, transition: "right 0.2s" }} />
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_edit")} disabled={!p.can_view} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_edit ? "#1a3a6a" : "#1a1a2a", cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_edit ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_edit ? COLORS.blue : "#3a3a5a", transition: "right 0.2s" }} />
                          </button>
                        </div>
                      </div>

                      {/* ── العناصر الفرعية داخل القسم: تتحكم في ما يظهر/يُعدَّل داخل القسم نفسه ── */}
                      {hasSubItems && isExpanded && (
                        <div style={{ background: "#080d18" }}>
                          {sec.subItems.map((sub, si) => {
                            const sp = currentRolePerms[permKey(sec.id, sub.id)] || { can_view: false, can_edit: false };
                            return (
                              <div key={sub.id} style={{
                                display: "grid", gridTemplateColumns: "1fr 120px 120px",
                                padding: "10px 20px 10px 20px", paddingRight: 44, alignItems: "center",
                                borderBottom: (si < sec.subItems.length - 1 || i < SYSTEM_SECTIONS.length - 1) ? "1px solid #0a1020" : "none",
                                opacity: !sp.can_view ? 0.55 : 1,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ color: VAR.muted, fontSize: 12 }}>└</span>
                                  <span style={{ fontSize: 12.5, color: sp.can_view ? VAR.text : VAR.muted }}>{sub.label}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_view")} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: sp.can_view ? "#1a5a30" : "#2a1020", cursor: "pointer", position: "relative" }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_view ? 2 : 19, width: 18, height: 18, borderRadius: "50%", background: sp.can_view ? COLORS.green : COLORS.red, transition: "right 0.2s" }} />
                                  </button>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_edit")} disabled={!sp.can_view} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: sp.can_edit ? "#1a3a6a" : "#1a1a2a", cursor: sp.can_view ? "pointer" : "not-allowed", position: "relative", opacity: sp.can_view ? 1 : 0.4 }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_edit ? 2 : 19, width: 18, height: 18, borderRadius: "50%", background: sp.can_edit ? COLORS.blue : "#3a3a5a", transition: "right 0.2s" }} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
