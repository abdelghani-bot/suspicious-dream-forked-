import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://glcdvwpwxbhutfecljdj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsY2R2d3B3eGJodXRmZWNsamRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE1OTIsImV4cCI6MjA5NTU0NzU5Mn0.w-dLQiFTTPzB0eeA7Asf95hy5x7kjA-OvilneYAIHHA"
);
import { useState, useEffect, useRef, useCallback } from "react";

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
  const go = () => {
    const usr = users.find((x) => x.username === u && x.password === p);
    if (usr) onLogin(usr);
    else setErr("اسم المستخدم أو كلمة المرور غير صحيحة");
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
  useEffect(() => {
    supabase
      .from("purchases")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data?.length) setPurchases(data);
      });
  }, []);
  const [returnsData, setReturnsData] = useStorage("ph_returns", []);
  const [inventoryLogs, setInventoryLogs] = useStorage(
    "ph_inventory",
    INIT_INVENTORY
  );
  const [shifts, setShifts] = useStorage("ph_shifts", INIT_SHIFTS);
  const [users] = useStorage("ph_users", INIT_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const currentShift = shifts.find(
    (s) => !s.end && s.user === currentUser?.name
  );
  useEffect(() => {
    const loadData = async () => {
      const [p, s, c, sa, pu, ret] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("suppliers").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("purchases").select("*"),
        supabase.from("returns").select("*"),
      ]);
      if (p.data?.length) setProducts(p.data);
      if (s.data?.length) setSuppliers(s.data);
      if (c.data?.length) setCustomers(c.data);
      if (sa.data?.length) setSales(sa.data);
      if (ret.data?.length) setReturnsData(ret.data);
      if (pu.data?.length) setPurchases(pu.data);
    };
    loadData();
  }, []);
  if (!currentUser)
    return (
      <Login
        users={users}
        onLogin={(u) => {
          setCurrentUser(u);
          setTab("dashboard");
        }}
      />
    );

  const TABS = [
    { id: "dashboard", label: "الرئيسية", icon: "dashboard" },
    { id: "pos", label: "نقطة البيع", icon: "pos" },
    { id: "purchase", label: "فواتير الشراء", icon: "purchase" },
    { id: "returns", label: "المرتجعات", icon: "returns" },
    { id: "sales_history", label: "سجل الفواتير", icon: "reports" },
    { id: "rasd_settings", label: "إعدادات رصد", icon: "settings" },
    { id: "expiry_report", label: "تقرير الصلاحيات", icon: "alert" },
    { id: "inventory_count", label: "الجرد", icon: "count" },
    { id: "products", label: "الأصناف", icon: "inventory" },
    { id: "suppliers", label: "الموردون", icon: "suppliers" },
    { id: "customers", label: "العملاء", icon: "customers" },
    { id: "reports", label: "التقارير", icon: "reports" },
    { id: "tax_report", label: "تقرير ضريبي", icon: "tax" },
    { id: "shift", label: "الشفتات", icon: "shift" },
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
              {t.label}
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
        <PharmacySettings showToast={showToast} />
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
            shifts={shifts}
            currentUser={currentUser}
            setTab={setTab}
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
          />
        )}
        {tab === "sales_history" && (
          <SalesHistory
            sales={sales}
            returns={returnsData}
            customers={customers}
            products={products}
          />
        )}
        {tab === "rasd_settings" && <RasdSettings showToast={showToast} />}
        {tab === "expiry_report" && <ExpiryReport products={products} />}
        {tab === "inventory_count" && (
          <InventoryCount
            products={products}
            setProducts={setProducts}
            inventoryLogs={inventoryLogs}
            setInventoryLogs={setInventoryLogs}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
        {tab === "products" && (
          <ProductsModule
            products={products}
            setProducts={setProducts}
            suppliers={suppliers}
            showToast={showToast}
          />
        )}
        {tab === "suppliers" && (
          <SuppliersModule
            suppliers={suppliers}
            setSuppliers={setSuppliers}
            showToast={showToast}
          />
        )}
        {tab === "customers" && (
          <CustomersModule
            customers={customers}
            setCustomers={setCustomers}
            showToast={showToast}
          />
        )}
        {tab === "reports" && (
          <Reports
            sales={sales}
            purchases={purchases}
            products={products}
            suppliers={suppliers}
            customers={customers}
          />
        )}
        {tab === "tax_report" && (
          <TaxReport sales={sales} purchases={purchases} />
        )}
        {tab === "shift" && (
          <ShiftModule
            shifts={shifts}
            setShifts={setShifts}
            sales={sales}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
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
  shifts,
  currentUser,
  setTab,
}) {
  const alerts = useEssentialAlerts(products);
  const [showAlerts, setShowAlerts] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter((s) => s.date === today && !s.returned);
  const todayRev = todaySales.reduce((a, s) => a + s.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const expiringSoon = products.filter((p) => {
    const d = new Date(p.expiry);
    const now = new Date();
    return (d - now) / (1000 * 60 * 60 * 24) < 90 && d > now;
  });
  const monthSales = sales.filter(
    (s) => s.date && s.date.startsWith(today.substring(0, 7)) && !s.returned
  );
  const monthRev = monthSales.reduce((a, s) => a + s.total, 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              color: "#dde8ff",
            }}
          >
            لوحة التحكم
          </h1>
          <p style={{ margin: "4px 0 0", color: "#3a5a8a", fontSize: 13 }}>
            {new Date().toLocaleDateString("ar-SA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Btn onClick={() => setTab("pos")} icon="pos" size="lg">
          نقطة البيع
        </Btn>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard
          label="مبيعات اليوم"
          value={todayRev.toFixed(2) + " ر.س"}
          icon="money"
          color="#3a9aff"
          sub={`${todaySales.length} فاتورة`}
        />
        <StatCard
          label="مبيعات الشهر"
          value={monthRev.toFixed(2) + " ر.س"}
          icon="reports"
          color="#44dd88"
          sub={`${monthSales.length} فاتورة`}
        />
        <StatCard
          label="إجمالي الأصناف"
          value={products.length}
          icon="inventory"
          color="#a78bfa"
        />
        <StatCard
          label="العملاء المسجلون"
          value={customers.length}
          icon="customers"
          color="#fb923c"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {lowStock.length > 0 && (
          <div
            style={{
              background: "#0f1623",
              border: "1px solid #3a2000",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                fontWeight: 700,
                color: "#ffaa44",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IC n="alert" s={16} /> مخزون منخفض ({lowStock.length} صنف)
            </h3>
            {lowStock.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #111a20",
                }}
              >
                <span style={{ fontSize: 13, color: "#c0d0f0" }}>{p.name}</span>
                <Badge color="#3a1500" text="#ffaa44">
                  {p.stock} / {p.minStock}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {expiringSoon.length > 0 && (
          <div
            style={{
              background: "#0f1623",
              border: "1px solid #3a1000",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                fontWeight: 700,
                color: "#ff7744",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IC n="alert" s={16} /> تنتهي قريباً ({expiringSoon.length} صنف)
            </h3>
            {expiringSoon.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #111a20",
                }}
              >
                <span style={{ fontSize: 13, color: "#c0d0f0" }}>{p.name}</span>
                <Badge color="#3a1000" text="#ff7744">
                  {p.expiry}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* كارت تنبيهات الأدوية الأساسية */}
        {alerts.length > 0 && (
          <div
            onClick={() => setShowAlerts(!showAlerts)}
            style={{
              background: "#0f1623",
              border: `1px solid ${showAlerts ? "#f59e0b" : "#3a2000"}`,
              borderRadius: 14,
              padding: 18,
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
          >
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: 14,
                fontWeight: 700,
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                ⚠️ تنبيهات الأدوية الأساسية
              </span>
              <span
                style={{
                  background: "#f59e0b",
                  color: "#000",
                  borderRadius: "50%",
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                {alerts.length}
              </span>
            </h3>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#3a5a8a" }}>
              {showAlerts ? "اضغط للإخفاء ▲" : "اضغط للتفاصيل ▼"}
            </p>
            {showAlerts && (
              <div style={{ marginTop: 10 }}>
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px",
                      marginBottom: 8,
                      borderRadius: 8,
                      backgroundColor:
                        alert.type === "danger" ? "#2a0a0a" : "#2a1a00",
                      borderRight: `4px solid ${
                        alert.type === "danger" ? "#ef4444" : "#f59e0b"
                      }`,
                      color: alert.type === "danger" ? "#fca5a5" : "#fcd34d",
                      fontSize: 13,
                    }}
                  >
                    {alert.type === "danger"
                      ? `🔴 نفاذ المخزون: ${alert.name}`
                      : `🟡 قرب النفاذ: ${alert.name} (المخزون: ${alert.stock})`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* آخر المبيعات */}
        <div
          style={{
            background: "#0f1623",
            border: "1px solid #1d2d4a",
            borderRadius: 14,
            padding: 18,
          }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              fontWeight: 700,
              color: "#dde8ff",
            }}
          >
            آخر المبيعات
          </h3>
          {sales
            .slice(-5)
            .reverse()
            .map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #111a20",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: "#c0d0f0" }}>{s.id}</div>
                  <div style={{ fontSize: 11, color: "#3a5a8a" }}>
                    {s.customer_name || "زبون عادي"}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{ fontSize: 13, fontWeight: 700, color: "#3a9aff" }}
                  >
                    {s.total.toFixed(2)} ر.س
                  </div>
                  <div style={{ fontSize: 11, color: "#3a5a8a" }}>{s.date}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
// ==================== FIFO Helper ====================
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
}) {
  const [invoices, setInvoices] = useState([emptyInvoice()]);
  const [activeTab, setActiveTab] = useState(0);
  const [showPrint, setShowPrint] = useState(null);
  const fileRef = useRef();
  const [fifoResults, setFifoResults] = useState({});
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

  const filtered = products.filter(
    (p) =>
      p.name.includes(inv.search) ||
      p.barcode.includes(inv.search) ||
      p.id.includes(inv.search)
  );

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
      customer: inv.selCustomer?.id || null,
      customer_name: inv.selCustomer?.name || "زبون عادي",
      items: inv.cart.map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: newFifoResults[i.id]?.salePrice ?? i.price,
        taxable: i.taxable,
        dose: i.dose,
        gtin: i.gtin || i.barcode,
        batch: i.batch || null,
        serial: i.serial || null,
        expiry: i.expiry || null,
      })),
      subtotal,
      tax_amount: taxAmount,
      discount_amt: discountAmt,
      total,
      payment: inv.payment,
      shift: currentShift?.id,
      returned: false,
    };

    const { error: saleError } = await supabase.from("sales").insert(invoice);
    if (saleError) {
      showToast("فشل حفظ الفاتورة: " + saleError.message, "error");
      return;
    }

    for (const ci of inv.cart) {
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
        const ci = inv.cart.find((i) => i.id === x.id);
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
        height: "calc(100vh - 100px)",
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
              onChange={(e) =>
                setInv((p) => ({ ...p, search: e.target.value }))
              }
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
                {filtered.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "8px 14px",
                      opacity: p.stock === 0 ? 0.6 : 1,
                      borderBottom: "1px solid #1a2a3a",
                    }}
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
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px" }}>
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
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#dde8ff",
                            minWidth: 20,
                            textAlign: "center",
                          }}
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
const getPharmacySettings = () => {
  try {
    return JSON.parse(localStorage.getItem("pharmacy_settings") || "{}");
  } catch {
    return {};
  }
};

function PharmacySettings({ showToast }) {
  const [settings, setSettings] = useState(() => getPharmacySettings());

  const fields = [
    { key: "nameAr", label: "اسم الصيدلية (عربي)" },
    { key: "nameEn", label: "Pharmacy Name (English)" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "address", label: "العنوان" },
    { key: "vatNumber", label: "الرقم الضريبي" },
    { key: "licenseNumber", label: "رقم الترخيص" },
  ];

  const save = () => {
    localStorage.setItem("pharmacy_settings", JSON.stringify(settings));
    showToast("تم حفظ بيانات الصيدلية ✓");
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        بيانات الصيدلية
      </h2>
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 16,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label
              style={{
                color: "#4a6a8a",
                fontSize: 12,
                display: "block",
                marginBottom: 6,
              }}
            >
              {label}
            </label>
            <input
              value={settings[key] || ""}
              onChange={(e) =>
                setSettings((p) => ({ ...p, [key]: e.target.value }))
              }
              style={{
                width: "100%",
                background: "#080e1a",
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#dde8ff",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}
      >
        <Btn icon="check" onClick={save}>
          حفظ البيانات
        </Btn>
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
  const [showDetail, setShowDetail] = useState(null); // الفاتورة المفتوحة
  const [editItems, setEditItems] = useState([]);
  const [editSupplier, setEditSupplier] = useState("");
  const [editManualSubtotal, setEditManualSubtotal] = useState("");
  const [editManualTax, setEditManualTax] = useState("");
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
          p.name.includes(val) ||
          p.barcode?.includes(val) ||
          p.id?.includes(val)
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
            x.name.includes(searchText)
        );
        if (p) addItem(p);
        else showToast("الصنف غير موجود", "error");
      }
    }
    if (e.key === "Escape") setShowDropdown(false);
  };

  // ✅ الإصلاح: الخصم يُحسب على receivedCost وليس cost الأصلي
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

        // ✅ لما يتغير الخصم، احسب التكلفة من receivedCost الحالية
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
        // ✅ لما يتغير سعر البيع، أعد احتساب التكلفة تلقائياً في نفس الصف
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
      // ✅ لو وصل لآخر عمود في آخر صف، ابدأ صف جديد بالفوكس على البحث
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
  // ✅ يسمح بتعديل الإجمالي والضريبة يدوياً
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
      id: "PO-" + String(purchases.length + 1).padStart(4, "0"),
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
    const { error } = await supabase.from("purchases").insert(po);
    if (error) {
      showToast("فشل الحفظ في السيرفر: " + error.message, "error");
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
        };
      })
    );

    setItems([]);
    setSelSupplier("");
    setManualSubtotal("");
    setManualTax("");
    setShowNew(false);
    showToast("تم حفظ فاتورة الشراء ✓");

    // ==================== رصد ====================
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const gs1Items = items.filter((i) => i.serial);
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
          p.supplierName,
          p.subtotal.toFixed(2) + " ر.س",
          p.taxAmount.toFixed(2) + " ر.س",
          <span style={{ color: "#44dd88", fontWeight: 700 }}>
            {p.total.toFixed(2)} ر.س
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

        {/* ✅ حقل البحث */}
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
                      {/* ✅ أيقونة كارت الصنف */}
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
                    {/* ✅ لما يتغير سعر البيع تتحدث التكلفة تلقائياً */}
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

        {/* ✅ الإجماليات مع إمكانية التعديل اليدوي */}
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

      {/* ✅ كارت الصنف */}
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
      {/* Modal تفاصيل وتعديل الفاتورة */}
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

          {/* الإجماليات */}
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
        p.name.toLowerCase().includes(val.toLowerCase())
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
      s + (type === "purchases" ? i.cost || i.price : i.price) * i.returnQty,
    0
  );
  const returnTax = returnItems.reduce(
    (s, i) =>
      i.taxable
        ? s +
          (type === "purchases" ? i.cost || i.price : i.price) *
            i.returnQty *
            TAX_RATE
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

    // ✅ Fix: String comparison للعميل
    const customer = customers?.find((c) => String(c.id) === selCustomer);

    // ✅ Fix: تحديث المخزون في Supabase
    for (const ri of returnItems) {
      if (ri.returnQty > 0) {
        const prod = products.find((x) => x.id === ri.id);
        if (prod) {
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock: prod.stock + ri.returnQty })
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
        return ri && ri.returnQty > 0
          ? { ...x, stock: x.stock + ri.returnQty }
          : x;
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
    // إرسال حركة المرتجع لرصد
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
                  l: `${x.id} — ${x.date} — ${x.total.toFixed(2)} ر.س`,
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
// ==================== Sales History ======================
function SalesHistory({ sales, returns = [], customers, products }) {
  const [tab, setTab] = useState("sales");
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [selected, setSelected] = useState(null);

  const paymentMethods = ["نقدي", "بطاقة", "تحويل", "آجل"];

  const data = tab === "sales" ? [...sales].reverse() : [...returns].reverse();

  const filtered = data.filter((s) => {
    const matchSearch =
      !search ||
      s.id?.includes(search) ||
      (s.customer_name || "").includes(search);
    const matchCustomer =
      !filterCustomer || String(s.customer) === filterCustomer;
    const matchPayment = !filterPayment || s.payment === filterPayment;
    const matchFrom = !filterFrom || s.date >= filterFrom;
    const matchTo = !filterTo || s.date <= filterTo;
    return matchSearch && matchCustomer && matchPayment && matchFrom && matchTo;
  });

  const totalAmount = filtered.reduce((s, i) => s + (i.total || 0), 0);

  const resetFilters = () => {
    setSearch("");
    setFilterCustomer("");
    setFilterPayment("");
    setFilterFrom("");
    setFilterTo("");
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <h2
          style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#dde8ff" }}
        >
          سجل الفواتير
        </h2>
        <div
          style={{
            background: "#142a5a",
            border: "1px solid #2a6aef",
            borderRadius: 10,
            padding: "6px 16px",
            color: "#6aaeff",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {filtered.length} فاتورة | {totalAmount.toFixed(2)} ر.س
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {[
          { k: "sales", l: "فواتير البيع" },
          { k: "returns", l: "المرتجعات" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => {
              setTab(t.k);
              setSelected(null);
            }}
            style={{
              padding: "9px 22px",
              borderRadius: 9,
              border: "1px solid",
              borderColor: tab === t.k ? "#2a6aef" : "#1d2d4a",
              background: tab === t.k ? "#142a5a" : "transparent",
              color: tab === t.k ? "#6aaeff" : "#4a6a8a",
              fontWeight: tab === t.k ? 700 : 400,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <input
          placeholder="🔍 بحث باسم العميل أو رقم الفاتورة"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 2,
            minWidth: 180,
            background: "#080e1a",
            border: "1px solid #1d2d4a",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#dde8ff",
            fontSize: 13,
            outline: "none",
          }}
        />

        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          style={{
            flex: 1,
            minWidth: 140,
            background: "#080e1a",
            border: "1px solid #1d2d4a",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#dde8ff",
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">كل العملاء</option>
          {(customers || []).map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>

        {tab === "sales" && (
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            style={{
              flex: 1,
              minWidth: 120,
              background: "#080e1a",
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#dde8ff",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="">كل طرق الدفع</option>
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            style={{
              background: "#080e1a",
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "8px 10px",
              color: "#dde8ff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <span style={{ color: "#3a5a8a", fontSize: 12 }}>→</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            style={{
              background: "#080e1a",
              border: "1px solid #1d2d4a",
              borderRadius: 8,
              padding: "8px 10px",
              color: "#dde8ff",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {(search ||
          filterCustomer ||
          filterPayment ||
          filterFrom ||
          filterTo) && (
          <button
            onClick={resetFilters}
            style={{
              background: "transparent",
              border: "1px solid #3a1a1a",
              borderRadius: 8,
              padding: "8px 14px",
              color: "#ff6666",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ✕ مسح الفلاتر
          </button>
        )}
      </div>

      {/* List + Detail */}
      <div style={{ display: "flex", gap: 14 }}>
        {/* List */}
        <div
          style={{
            flex: selected ? "0 0 45%" : "1",
            background: "#0f1623",
            border: "1px solid #1d2d4a",
            borderRadius: 14,
            overflow: "hidden",
            maxHeight: "calc(100vh - 320px)",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "#3a5a8a",
                fontSize: 14,
              }}
            >
              لا توجد فواتير
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelected(selected?.id === s.id ? null : s)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #0a101a",
                  cursor: "pointer",
                  background: selected?.id === s.id ? "#142a5a" : "transparent",
                  transition: "background 0.15s",
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
                      color: selected?.id === s.id ? "#6aaeff" : "#c0d0f0",
                    }}
                  >
                    {s.id}
                  </div>
                  <div style={{ fontSize: 11, color: "#3a5a8a", marginTop: 2 }}>
                    {s.customer_name || "زبون عادي"}
                    {s.payment ? ` • ${s.payment}` : ""}
                    {s.reason ? ` • ${s.reason}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: tab === "returns" ? "#ff7744" : "#3a9aff",
                    }}
                  >
                    {(s.total || 0).toFixed(2)} ر.س
                  </div>
                  <div style={{ fontSize: 11, color: "#3a5a8a" }}>{s.date}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div
            style={{
              flex: "1",
              background: "#0f1623",
              border: "1px solid #1d2d4a",
              borderRadius: 14,
              padding: 18,
              maxHeight: "calc(100vh - 320px)",
              overflowY: "auto",
            }}
          >
            {/* Detail Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: "#dde8ff" }}
                >
                  {selected.id}
                </div>
                <div style={{ fontSize: 12, color: "#3a5a8a", marginTop: 3 }}>
                  {selected.date}
                  {selected.payment ? ` • ${selected.payment}` : ""}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6aaeff",
                    marginTop: 3,
                    fontWeight: 600,
                  }}
                >
                  {selected.customer_name || "زبون عادي"}
                </div>
                {selected.reason && (
                  <div style={{ fontSize: 12, color: "#ffaa44", marginTop: 3 }}>
                    السبب: {selected.reason}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#3a5a8a",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>

            {/* Items Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: 14,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #1d2d4a" }}>
                  {["الصنف", "الكمية", "السعر", "الإجمالي"].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i === 0 ? "right" : "center",
                        padding: "6px 4px",
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
                {(selected.items || []).map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #0a101a" }}>
                    <td style={{ padding: "8px 4px" }}>
                      <div style={{ fontSize: 13, color: "#dde8ff" }}>
                        {item.name}
                      </div>
                      {item.dose && (
                        <div style={{ fontSize: 11, color: "#4a6a8a" }}>
                          ▸ {item.dose}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        color: "#dde8ff",
                        padding: "8px 4px",
                      }}
                    >
                      {item.qty || item.returnQty}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        color: "#2a9aff",
                        padding: "8px 4px",
                      }}
                    >
                      {(item.price || item.cost || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#dde8ff",
                        padding: "8px 4px",
                      }}
                    >
                      {(
                        (item.price || item.cost || 0) *
                        (item.qty || item.returnQty || 0)
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div
              style={{
                background: "#080e1a",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#4a6a8a",
                  fontSize: 12,
                  marginBottom: 5,
                }}
              >
                <span>قبل الضريبة</span>
                <span>{(selected.subtotal || 0).toFixed(2)} ر.س</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#88dd44",
                  fontSize: 12,
                  marginBottom: 5,
                }}
              >
                <span>ضريبة 15%</span>
                <span>
                  {(selected.tax_amount || selected.tax || 0).toFixed(2)} ر.س
                </span>
              </div>
              {selected.discount_amt > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#ffaa44",
                    fontSize: 12,
                    marginBottom: 5,
                  }}
                >
                  <span>خصم</span>
                  <span>- {(selected.discount_amt || 0).toFixed(2)} ر.س</span>
                </div>
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
                  marginTop: 4,
                }}
              >
                <span>الإجمالي</span>
                <span
                  style={{
                    color: tab === "returns" ? "#ff7744" : "#3a9aff",
                  }}
                >
                  {(selected.total || 0).toFixed(2)} ر.س
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
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
function ExpiryReport({ products, onRemoveExpired }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showExpiredDetail, setShowExpiredDetail] = useState(false);

  // ===== flatten الأصناف مع batches =====
  const allItems = products.flatMap((p) => {
    if (p.batches?.length) {
      return p.batches
        .filter((b) => b.expiry_date)
        .map((b) => ({
          ...p,
          expiry: b.expiry_date,
          stock: b.qty,
          cost: b.cost,
          price: b.salePrice,
        }));
    }
    return p.expiry ? [p] : [];
  });

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
// ==================== INVENTORY COUNT ====================
function InventoryCount({
  products,
  setProducts,
  inventoryLogs,
  setInventoryLogs,
  currentUser,
  showToast,
}) {
  const [showNew, setShowNew] = useState(false);
  const [countItems, setCountItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

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

  const saveCount = () => {
    const log = {
      id: "INV-ADJ-" + String(inventoryLogs.length + 1).padStart(3, "0"),
      date: new Date().toISOString().split("T")[0],
      type: "جرد",
      items: countItems.map((i) => ({
        id: i.id,
        systemQty: i.systemQty,
        actualQty: i.actualQty,
        diff: i.actualQty - i.systemQty,
      })),
      notes,
      by: currentUser.name,
    };
    setInventoryLogs((p) => [...p, log]);
    setProducts((p) =>
      p.map((x) => {
        const ci = countItems.find((i) => i.id === x.id);
        return ci ? { ...x, stock: ci.actualQty } : x;
      })
    );
    setShowNew(false);
    setNotes("");
    showToast("تم حفظ الجرد وتحديث المخزون ✓");
  };

  const filtered = countItems.filter(
    (i) => i.name.includes(search) || i.category.includes(search)
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
          <span style={{ color: "#6aaeff", fontWeight: 700 }}>{l.id}</span>,
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

function ProductsModule({ products, setProducts, suppliers, showToast }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const blank = {
    id: "",
    nameAr: "",
    nameEn: "",
    barcode: "",
    mainCategory: "دواء",
    subCategory1: "مستورد",
    subCategory2: "فموي",
    unit: "قرص",
    unitDivision: 1,
    price: "",
    cost: "",
    taxable: true,
    minStock: "",
    maxStock: "",
    activeIngredient: "",
    concentration: "",
    isEssential: false,
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // لما تتغير الفئة الرئيسية، صفّر الفرعية
  const handleMainCategoryChange = (val) => {
    const cat = MAIN_CATEGORIES[val];
    setForm((p) => ({
      ...p,
      mainCategory: val,
      subCategory1: cat.sub1[0] || "",
      subCategory2: cat.sub2[0] || "",
    }));
  };

  const filtered = products.filter((p) => {
    const s = search.toLowerCase();
    return (
      (p.nameAr || p.name || "").includes(search) ||
      (p.nameEn || "").toLowerCase().includes(s) ||
      (p.barcode || "").includes(search) ||
      (p.id || "").includes(search) ||
      (p.mainCategory || p.category || "").includes(search)
    );
  });

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({
      ...blank,
      ...p,
      nameAr: p.nameAr || p.name || "",
      nameEn: p.nameEn || "",
      price: String(p.price),
      cost: String(p.cost),
      minStock: String(p.minStock || ""),
      maxStock: String(p.maxStock || ""),
      unitDivision: p.unitDivision || 1,
      mainCategory: p.mainCategory || "دواء",
      subCategory1: p.subCategory1 || "",
      subCategory2: p.subCategory2 || "",
    });
    setShowForm(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...blank,
      id: "P" + String(products.length + 1).padStart(3, "0"),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nameAr || !form.price) {
      showToast("يرجى ملء الحقول المطلوبة", "error");
      return;
    }
    const p = {
      id: form.id,
      name: form.nameAr,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      barcode: form.barcode,
      mainCategory: form.mainCategory,
      subCategory1: form.subCategory1,
      subCategory2: form.subCategory2,
      category: form.mainCategory, // للتوافق مع الكود القديم
      unit: form.unit,
      unitDivision: +form.unitDivision || 1,
      price: +form.price,
      cost: +form.cost,
      taxable: form.taxable,
      minStock: +form.minStock,
      min_stock: +form.minStock,
      maxStock: +form.maxStock,
      max_stock: +form.maxStock,
      activeIngredient: form.activeIngredient,
      active_ingredient: form.activeIngredient,
      concentration: form.concentration,
      isEssential: form.isEssential,
      is_essential: form.isEssential,
    };

    if (editing) {
      await supabase.from("products").update(p).eq("id", editing);
      setProducts((prev) =>
        prev.map((x) => (x.id === editing ? { ...x, ...p } : x))
      );
    } else {
      await supabase.from("products").insert(p);
      setProducts((prev) => [...prev, { ...p, stock: 0 }]);
    }
    setShowForm(false);
    showToast(editing ? "تم تعديل الصنف" : "تمت إضافة الصنف ✓");
  };

  const currentCat = MAIN_CATEGORIES[form.mainCategory] || {
    sub1: [],
    sub2: [],
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
          إدارة الأصناف
        </h2>
        <Btn icon="plus" onClick={openAdd}>
          إضافة صنف
        </Btn>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم عربي أو إنجليزي أو الباركود أو الفئة..."
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
          marginBottom: 14,
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="إجمالي الأصناف"
          value={products.length}
          icon="inventory"
          color="#3a9aff"
        />
        <StatCard
          label="مخزون منخفض"
          value={products.filter((p) => p.stock <= (p.minStock || 0)).length}
          icon="alert"
          color="#ffaa44"
        />
        <StatCard
          label="أدوية أساسية"
          value={products.filter((p) => p.isEssential).length}
          icon="pill"
          color="#f59e0b"
        />
        <StatCard
          label="قيمة المخزون"
          value={
            products
              .reduce((s, p) => s + (p.cost || 0) * (p.stock || 0), 0)
              .toFixed(0) + " ر.س"
          }
          icon="money"
          color="#a78bfa"
        />
      </div>

      <Table
        headers={[
          "رمز",
          "الصنف",
          "الباركود",
          "الفئة",
          "سعر البيع",
          "التكلفة",
          "الوحدة",
          "الضريبة",
          "أساسي",
          "إجراءات",
        ]}
        rows={filtered.map((p) => [
          <span style={{ color: "#4a6a8a", fontSize: 11 }}>{p.id}</span>,
          <div>
            <div style={{ fontWeight: 700, color: "#dde8ff" }}>
              {p.nameAr || p.name}
            </div>
            {p.nameEn && (
              <div style={{ fontSize: 11, color: "#4a6a8a" }}>{p.nameEn}</div>
            )}
            <div style={{ fontSize: 10, color: "#3a5a8a" }}>
              {p.activeIngredient} {p.concentration}
            </div>
          </div>,
          <span
            style={{ fontSize: 11, color: "#4a6a8a", fontFamily: "monospace" }}
          >
            {p.barcode}
          </span>,
          <div>
            <Badge>{p.mainCategory || p.category}</Badge>
            {p.subCategory2 && (
              <div style={{ fontSize: 10, color: "#3a5a8a", marginTop: 3 }}>
                {p.subCategory1 && p.subCategory1 + " · "}
                {p.subCategory2}
              </div>
            )}
          </div>,
          <span style={{ color: "#3a9aff", fontWeight: 700 }}>
            {p.price} ر.س
          </span>,
          <span style={{ color: "#4a6a8a" }}>{p.cost} ر.س</span>,
          <div style={{ fontSize: 12, color: "#6a8aaa" }}>
            {p.unit}
            {p.unitDivision > 1 && (
              <span style={{ color: "#f59e0b", marginRight: 4 }}>
                ÷{p.unitDivision}
              </span>
            )}
          </div>,
          <Badge
            color={p.taxable ? "#0a2a00" : "#1a1a2a"}
            text={p.taxable ? "#44dd88" : "#4a6a8a"}
          >
            {p.taxable ? "15%" : "معفى"}
          </Badge>,
          p.isEssential ? (
            <Badge color="#2a1a00" text="#f59e0b">
              ⭐ أساسي
            </Badge>
          ) : (
            <span style={{ color: "#4a6a8a", fontSize: 11 }}>—</span>
          ),
          <div style={{ display: "flex", gap: 5 }}>
            <Btn
              size="sm"
              icon="edit"
              variant="secondary"
              onClick={() => openEdit(p)}
            >
              تعديل
            </Btn>
            <Btn
              size="sm"
              icon="trash"
              variant="danger"
              onClick={async () => {
                await supabase.from("products").delete().eq("id", p.id);
                setProducts((prev) => prev.filter((x) => x.id !== p.id));
                showToast("تم حذف الصنف");
              }}
            >
              حذف
            </Btn>
          </div>,
        ])}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "تعديل الصنف" : "إضافة صنف جديد"}
        wide
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          {/* الرمز */}
          <Input
            label="رمز الصنف"
            value={form.id}
            onChange={(v) => F("id", v)}
            placeholder="P001"
          />

          {/* الاسم العربي */}
          <Input
            label="الاسم بالعربي *"
            value={form.nameAr}
            onChange={(v) => F("nameAr", v)}
            placeholder="باراسيتامول"
          />

          {/* الاسم الإنجليزي */}
          <Input
            label="الاسم بالإنجليزي"
            value={form.nameEn}
            onChange={(v) => F("nameEn", v)}
            placeholder="Paracetamol"
          />

          {/* الباركود */}
          <Input
            label="الباركود"
            value={form.barcode}
            onChange={(v) => F("barcode", v)}
            placeholder="رقم الباركود"
          />

          {/* الفئة الرئيسية */}
          <Select
            label="الفئة الرئيسية"
            value={form.mainCategory}
            onChange={handleMainCategoryChange}
            options={Object.keys(MAIN_CATEGORIES)}
          />

          {/* الفئة الفرعية 1 - تظهر فقط للدواء */}
          {currentCat.sub1.length > 0 && (
            <Select
              label="المصدر"
              value={form.subCategory1}
              onChange={(v) => F("subCategory1", v)}
              options={currentCat.sub1}
            />
          )}

          {/* الفئة الفرعية 2 */}
          {currentCat.sub2.length > 0 && (
            <Select
              label="الشكل الصيدلاني"
              value={form.subCategory2}
              onChange={(v) => F("subCategory2", v)}
              options={currentCat.sub2}
            />
          )}

          {/* وحدة القياس */}
          <Input
            label="وحدة البيع"
            value={form.unit}
            onChange={(v) => F("unit", v)}
            placeholder="قرص / كبسولة..."
          />

          {/* تقسيم الوحدة */}
          <Input
            label="تقسيم الوحدة (عدد الأجزاء)"
            value={form.unitDivision === 1 ? "" : String(form.unitDivision)}
            onChange={(v) => F("unitDivision", v ? +v : 1)}
            type="number"
            placeholder="مثال: 50 (اتركه فارغاً = بدون تقسيم)"
          />

          {/* السعر والتكلفة */}
          <Input
            label="سعر البيع *"
            value={form.price}
            onChange={(v) => F("price", v)}
            type="number"
            placeholder="0.00"
          />
          <Input
            label="سعر التكلفة"
            value={form.cost}
            onChange={(v) => F("cost", v)}
            type="number"
            placeholder="0.00"
          />

          {/* الحد الأدنى والأقصى */}
          <Input
            label="الحد الأدنى للمخزون"
            value={form.minStock}
            onChange={(v) => F("minStock", v)}
            type="number"
            placeholder="10"
          />
          <Input
            label="الحد الأقصى للمخزون"
            value={form.maxStock}
            onChange={(v) => F("maxStock", v)}
            type="number"
            placeholder="100"
          />

          {/* المادة الفعالة والتركيز */}
          <Input
            label="المادة الفعالة"
            value={form.activeIngredient}
            onChange={(v) => F("activeIngredient", v)}
            placeholder="Paracetamol"
          />
          <Input
            label="التركيز"
            value={form.concentration}
            onChange={(v) => F("concentration", v)}
            placeholder="500mg"
          />

          {/* الضريبة */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
            }}
          >
            <label style={{ color: "#5a7aaa", fontSize: 13, fontWeight: 600 }}>
              خاضع لضريبة القيمة المضافة 15%
            </label>
            <input
              type="checkbox"
              checked={form.taxable}
              onChange={(e) => F("taxable", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
          </div>

          {/* دواء أساسي */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
            }}
          >
            <label style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>
              ⭐ دواء أساسي (قائمة هيئة الغذاء والدواء)
            </label>
            <input
              type="checkbox"
              checked={form.isEssential}
              onChange={(e) => F("isEssential", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
          </div>
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
            {editing ? "حفظ التعديل" : "إضافة الصنف"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ==================== SUPPLIERS ====================
function SuppliersModule({ suppliers, setSuppliers, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = {
    id: "",
    name: "",
    taxId: "",
    phone: "",
    email: "",
    address: "",
    contact: "",
  };
  const [form, setForm] = useState(blank);
  const F = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...blank,
      id: "S" + String(suppliers.length + 1).padStart(3, "0"),
    });
    setShowForm(true);
  };
  const openEdit = (s) => {
    setEditing(s.id);
    setForm(s);
    setShowForm(true);
  };
  const save = async () => {
    if (!form.name) {
      showToast("يرجى إدخال اسم المورد", "error");
      return;
    }
    if (editing) {
      const { error } = await supabase
        .from("suppliers")
        .update(form)
        .eq("id", editing);
      if (error) {
        showToast("فشل التعديل: " + error.message, "error");
        return;
      }
      setSuppliers((p) => p.map((x) => (x.id === editing ? form : x)));
    } else {
      console.log("inserting supplier:", form);
const { data, error } = await supabase.from("suppliers").insert(form).select();
console.log("result:", data, error);
      if (error) {
        showToast("فشل الإضافة: " + error.message, "error");
        return;
      }
      setSuppliers((p) => [...p, form]);
    }
    setShowForm(false);
    showToast(editing ? "تم تعديل المورد" : "تمت إضافة المورد ✓");
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
          إدارة الموردين
        </h2>
        <Btn icon="plus" onClick={openAdd}>
          إضافة مورد
        </Btn>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 14,
        }}
      >
        {suppliers.map((s) => (
          <div
            key={s.id}
            style={{
              background: "#0f1623",
              border: "1px solid #1d2d4a",
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{ fontWeight: 700, color: "#dde8ff", fontSize: 15 }}
                >
                  {s.name}
                </div>
                <div style={{ color: "#3a6a9a", fontSize: 12, marginTop: 2 }}>
                  رمز: {s.id}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Btn
                  size="sm"
                  icon="edit"
                  variant="secondary"
                  onClick={() => openEdit(s)}
                >
                  تعديل
                </Btn>
                <Btn
                  size="sm"
                  icon="trash"
                  variant="danger"
                  onClick={async () => {
                    await supabase.from("suppliers").delete().eq("id", s.id);
                    setSuppliers((p) => p.filter((x) => x.id !== s.id));
                    showToast("تم حذف المورد");
                  }}
                >
                  حذف
                </Btn>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {s.taxId && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      color: "#3a6a9a",
                      fontSize: 11,
                      width: 100,
                      flexShrink: 0,
                    }}
                  >
                    الرقم الضريبي:
                  </span>
                  <Badge color="#0a2a00" text="#44dd88">
                    {s.taxId}
                  </Badge>
                </div>
              )}
              {s.phone && (
                <div style={{ fontSize: 12, color: "#5a7a9a" }}>
                  <span style={{ color: "#3a5a7a" }}>📞 </span>
                  {s.phone}
                </div>
              )}
              {s.email && (
                <div style={{ fontSize: 12, color: "#5a7a9a" }}>
                  <span style={{ color: "#3a5a7a" }}>✉ </span>
                  {s.email}
                </div>
              )}
              {s.address && (
                <div style={{ fontSize: 12, color: "#5a7a9a" }}>
                  <span style={{ color: "#3a5a7a" }}>📍 </span>
                  {s.address}
                </div>
              )}
              {s.contact && (
                <div style={{ fontSize: 12, color: "#5a7a9a" }}>
                  <span style={{ color: "#3a5a7a" }}>👤 </span>
                  {s.contact}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "تعديل المورد" : "إضافة مورد جديد"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            label="اسم المورد *"
            value={form.name}
            onChange={(v) => F("name", v)}
            placeholder="اسم الشركة أو المورد"
          />
          <Input
            label="الرقم الضريبي (VAT)"
            value={form.taxId}
            onChange={(v) => F("taxId", v)}
            placeholder="300XXXXXXXXX00003"
          />
          <Input
            label="رقم الهاتف"
            value={form.phone}
            onChange={(v) => F("phone", v)}
            placeholder="011XXXXXXX"
          />
          <Input
            label="البريد الإلكتروني"
            value={form.email}
            onChange={(v) => F("email", v)}
            placeholder="info@company.com"
          />
          <Input
            label="العنوان"
            value={form.address}
            onChange={(v) => F("address", v)}
            placeholder="المدينة، الحي..."
          />
          <Input
            label="مسؤول التواصل"
            value={form.contact}
            onChange={(v) => F("contact", v)}
            placeholder="اسم المسؤول"
          />
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
            {editing ? "حفظ التعديل" : "إضافة المورد"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

function CustomersModule({ customers, setCustomers, showToast }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
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

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...blank,
      id: "C" + String(customers.length + 1).padStart(3, "0"),
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
    if (form.category === "family_with_kids" && !form.children_count) {
      showToast("يرجى إدخال عدد الأطفال", "error");
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

  const filtered = customers.filter(
    (c) =>
      c.name.includes(search) ||
      c.phone.includes(search) ||
      c.taxId?.includes(search)
  );

  const categoryLabel = (c) => {
    if (c.category === "family_no_kids") return "أسرة بدون أطفال";
    if (c.category === "family_with_kids")
      return `أسرة مع أطفال (${c.children_count})`;
    return "فرد";
  };

  const categoryColor = (c) => {
    if (c.category === "family_no_kids")
      return { bg: "#0a1a3a", text: "#5a9aff" };
    if (c.category === "family_with_kids")
      return { bg: "#0a2a1a", text: "#44dd88" };
    return { bg: "#1a1a3a", text: "#a78bfa" };
  };

  const ageRanges = [
    "أقل من سنة",
    "1-3 سنوات",
    "4-6 سنوات",
    "7-12 سنة",
    "13-17 سنة",
  ];

  const toggleAge = (age) => {
    const current = form.children_ages || [];
    if (current.includes(age)) {
      F(
        "children_ages",
        current.filter((a) => a !== age)
      );
    } else {
      F("children_ages", [...current, age]);
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
          إدارة العملاء
        </h2>
        <Btn icon="plus" onClick={openAdd}>
          إضافة عميل
        </Btn>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم أو الهاتف أو الرقم الضريبي..."
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
          marginBottom: 14,
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
          gap: 14,
        }}
      >
        {filtered.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#0f1623",
              border: "1px solid #1d2d4a",
              borderRadius: 14,
              padding: 18,
            }}
          >
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
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "#1a2a5a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#5a9aff",
                  }}
                >
                  <IC n="user" s={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#dde8ff" }}>
                    {c.name}
                  </div>
                  <div style={{ color: "#3a6a9a", fontSize: 12 }}>
                    {c.phone}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <Btn
                  size="sm"
                  icon="edit"
                  variant="secondary"
                  onClick={() => openEdit(c)}
                >
                  تعديل
                </Btn>
                <Btn
                  size="sm"
                  icon="trash"
                  variant="danger"
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
                >
                  حذف
                </Btn>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <Badge color={categoryColor(c).bg} text={categoryColor(c).text}>
                {categoryLabel(c)}
              </Badge>
            </div>

            {c.category === "family_with_kids" &&
              c.children_ages?.length > 0 && (
                <div
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {c.children_ages.map((age) => (
                    <Badge key={age} color="#0a1a2a" text="#3a9aff">
                      {age}
                    </Badge>
                  ))}
                </div>
              )}

            {c.taxId && (
              <div style={{ marginBottom: 8 }}>
                <Badge color="#0a2a00" text="#44dd88">
                  رقم ضريبي: {c.taxId}
                </Badge>
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div
                style={{
                  background: "#080e1a",
                  borderRadius: 8,
                  padding: "9px 11px",
                }}
              >
                <div style={{ color: "#3a5a8a", fontSize: 10 }}>
                  إجمالي المشتريات
                </div>
                <div
                  style={{
                    color: "#3a9aff",
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 2,
                  }}
                >
                  {(c.totalSpent || 0).toFixed(2)} ر.س
                </div>
              </div>
              <div
                style={{
                  background: "#080e1a",
                  borderRadius: 8,
                  padding: "9px 11px",
                }}
              >
                <div style={{ color: "#3a5a8a", fontSize: 10 }}>
                  عدد الزيارات
                </div>
                <div
                  style={{
                    color: "#44dd88",
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 2,
                  }}
                >
                  {c.visits || 0}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, color: "#2a4a6a", fontSize: 11 }}>
              آخر زيارة: {c.lastVisit}
            </div>
          </div>
        ))}
      </div>

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
            label="الرقم الضريبي (للشركات)"
            value={form.taxId}
            onChange={(v) => F("taxId", v)}
            placeholder="310XXXXXXXXX003 (اختياري)"
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
                    transition: "all 0.2s",
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
                  الفئات العمرية للأطفال
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ageRanges.map((age) => {
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
                          transition: "all 0.2s",
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
// ==================== REPORTS ====================
function Reports({ sales, purchases, products, suppliers, customers }) {
  const [type, setType] = useState("sales");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  const filteredSales = sales.filter((s) => {
    const d = s.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterProduct && !s.items.some((i) => i.id === filterProduct))
      ok = false;
    return ok;
  });
  const filteredPurchases = purchases.filter((p) => {
    const d = p.date;
    let ok = true;
    if (fromDate && d < fromDate) ok = false;
    if (toDate && d > toDate) ok = false;
    if (filterSupplier && p.supplier !== filterSupplier) ok = false;
    return ok;
  });

  const salesByMonth = {};
  filteredSales.forEach((s) => {
    const m = s.date.substring(0, 7);
    if (!salesByMonth[m])
      salesByMonth[m] = { count: 0, subtotal: 0, tax: 0, total: 0 };
    salesByMonth[m].count++;
    salesByMonth[m].subtotal += s.subtotal;
    salesByMonth[m].tax += s.taxAmount;
    salesByMonth[m].total += s.total;
  });

  const productSales = {};
  filteredSales.forEach((s) =>
    s.items.forEach((i) => {
      if (!productSales[i.id])
        productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
      productSales[i.id].qty += i.qty;
      productSales[i.id].revenue += i.price * i.qty;
      productSales[i.id].tax += i.taxable ? i.price * i.qty * TAX_RATE : 0;
    })
  );

  const totalSalesRev = filteredSales
    .filter((s) => !s.returned)
    .reduce((a, s) => a + s.total, 0);
  const totalSalesTax = filteredSales
    .filter((s) => !s.returned)
    .reduce((a, s) => a + (s.taxAmount || s.tax_amount || 0), 0);
  const returnedCount = filteredSales.filter((s) => s.returned).length;
  const totalPurchase = filteredPurchases.reduce((a, p) => a + p.total, 0);
  const totalPurchaseTax = filteredPurchases.reduce(
    (a, p) => a + p.taxAmount,
    0
  );

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        التقارير والإحصائيات
      </h2>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        {["sales", "purchase", "product", "monthly"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: type === t ? "#2a6aef" : "#1d2d4a",
              background: type === t ? "#142a5a" : "transparent",
              color: type === t ? "#6aaeff" : "#4a6a8a",
              fontWeight: type === t ? 700 : 400,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t === "sales"
              ? "تقرير المبيعات"
              : t === "purchase"
              ? "تقرير المشتريات"
              : t === "product"
              ? "تقرير الأصناف"
              : "تقرير شهري"}
          </button>
        ))}
        <div
          style={{
            marginRight: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Input
            label="من"
            value={fromDate}
            onChange={setFromDate}
            type="date"
            style={{ width: 140 }}
          />
          <Input
            label="إلى"
            value={toDate}
            onChange={setToDate}
            type="date"
            style={{ width: 140 }}
          />
          {type === "purchase" && (
            <Select
              label="المورد"
              value={filterSupplier}
              onChange={setFilterSupplier}
              options={[
                { v: "", l: "الكل" },
                ...suppliers.map((s) => ({ v: s.id, l: s.name })),
              ]}
              style={{ width: 160 }}
            />
          )}
          {type === "product" && (
            <Select
              label="الصنف"
              value={filterProduct}
              onChange={setFilterProduct}
              options={[
                { v: "", l: "الكل" },
                ...products.map((p) => ({ v: p.id, l: p.name })),
              ]}
              style={{ width: 180 }}
            />
          )}
        </div>
      </div>

      {type === "sales" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard
              label="إجمالي المبيعات (شامل الضريبة)"
              value={totalSalesRev.toFixed(2) + " ر.س"}
              icon="money"
              color="#3a9aff"
            />
            <StatCard
              label="ضريبة المبيعات"
              value={totalSalesTax.toFixed(2) + " ر.س"}
              icon="tax"
              color="#88dd44"
            />
            <StatCard
              label="عدد الفواتير"
              value={filteredSales.filter((s) => !s.returned).length}
              icon="pos"
              color="#a78bfa"
            />
            <StatCard
              label="المرتجعات"
              value={returnedCount}
              icon="returns"
              color="#ff7744"
            />
          </div>
          <Table
            headers={[
              "رقم الفاتورة",
              "التاريخ",
              "العميل",
              "المجموع",
              "الضريبة",
              "الإجمالي شامل الضريبة",
              "الدفع",
              "حالة",
            ]}
            rows={filteredSales.map((s) => [
              <span style={{ color: "#6aaeff", fontWeight: 700 }}>{s.id}</span>,
              s.date,
              s.customer_name || "زبون عادي",
              (s.subtotal || 0).toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>
                {(s.taxAmount || s.tax_amount || 0).toFixed(2)} ر.س
              </span>,
              <span style={{ color: "#3a9aff", fontWeight: 700 }}>
                {(s.total || 0).toFixed(2)} ر.س
              </span>,
              s.payment,
              s.returned ? (
                <Badge color="#3a0a0a" text="#ff7777">
                  مرتجعة
                </Badge>
              ) : (
                <Badge color="#0a2a10" text="#44dd88">
                  مكتملة
                </Badge>
              ),
            ])}
          />
        </>
      )}
      {type === "purchase" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard
              label="إجمالي المشتريات (شامل الضريبة)"
              value={totalPurchase.toFixed(2) + " ر.س"}
              icon="purchase"
              color="#fb923c"
            />
            <StatCard
              label="ضريبة المشتريات"
              value={totalPurchaseTax.toFixed(2) + " ر.س"}
              icon="tax"
              color="#88dd44"
            />
            <StatCard
              label="عدد أوامر الشراء"
              value={filteredPurchases.length}
              icon="suppliers"
              color="#a78bfa"
            />
          </div>
          <Table
            headers={[
              "رقم الأمر",
              "التاريخ",
              "المورد",
              "المجموع",
              "الضريبة",
              "الإجمالي",
              "الحالة",
            ]}
            rows={filteredPurchases.map((p) => [
              <span style={{ color: "#6aaeff", fontWeight: 700 }}>{p.id}</span>,
              p.date,
              p.supplierName,
              p.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>
                {p.taxAmount.toFixed(2)} ر.س
              </span>,
              <span style={{ color: "#fb923c", fontWeight: 700 }}>
                {p.total.toFixed(2)} ر.س
              </span>,
              <Badge color="#0a2a10" text="#44dd88">
                {p.status}
              </Badge>,
            ])}
          />
        </>
      )}
      {type === "product" && (
        <Table
          headers={[
            "الصنف",
            "الكمية المباعة",
            "الإيراد قبل الضريبة",
            "الضريبة",
            "الإيراد الكلي",
          ]}
          rows={Object.entries(productSales)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([id, d]) => [
              <span style={{ fontWeight: 700, color: "#dde8ff" }}>
                {d.name}
              </span>,
              <span style={{ color: "#3a9aff", fontWeight: 700 }}>
                {d.qty}
              </span>,
              d.revenue.toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>{d.tax.toFixed(2)} ر.س</span>,
              <span style={{ color: "#44dd88", fontWeight: 700 }}>
                {(d.revenue + d.tax).toFixed(2)} ر.س
              </span>,
            ])}
        />
      )}
      {type === "monthly" && (
        <Table
          headers={[
            "الشهر",
            "عدد الفواتير",
            "المبيعات قبل الضريبة",
            "ضريبة المبيعات",
            "المبيعات الكلية",
          ]}
          rows={Object.entries(salesByMonth)
            .sort()
            .reverse()
            .map(([m, d]) => [
              <span style={{ fontWeight: 700, color: "#dde8ff" }}>{m}</span>,
              d.count,
              d.subtotal.toFixed(2) + " ر.س",
              <span style={{ color: "#88dd44" }}>{d.tax.toFixed(2)} ر.س</span>,
              <span style={{ color: "#3a9aff", fontWeight: 700 }}>
                {d.total.toFixed(2)} ر.س
              </span>,
            ])}
        />
      )}
    </div>
  );
}

// ==================== TAX REPORT ====================
function TaxReport({ sales, purchases }) {
  const [quarter, setQuarter] = useState("Q2-2026");
  const quarters = [
    "Q1-2026",
    "Q2-2026",
    "Q3-2026",
    "Q4-2026",
    "Q1-2025",
    "Q2-2025",
  ];

  const qMap = {
    Q1: "01,02,03",
    Q2: "04,05,06",
    Q3: "07,08,09",
    Q4: "10,11,12",
  };
  const [q, year] = quarter.split("-");
  const months = qMap[q].split(",").map((m) => `${year}-${m}`);

  const filtSales = sales.filter(
    (s) => months.some((m) => s.date.startsWith(m)) && !s.returned
  );
  const filtPurchases = purchases.filter((p) =>
    months.some((m) => p.date.startsWith(m))
  );

  const salesSubtotal = filtSales.reduce((a, s) => a + (s.subtotal || 0), 0);
  const salesTax = filtSales.reduce((a, s) => a + (s.tax_amount || 0), 0);
  const salesTotal = filtSales.reduce((a, s) => a + (s.total || 0), 0);
  const purchSubtotal = filtPurchases.reduce(
    (a, p) => a + (p.subtotal || 0),
    0
  );
  const purchTax = filtPurchases.reduce((a, p) => a + (p.tax_amount || 0), 0);
  const purchTotal = filtPurchases.reduce((a, p) => a + (p.total || 0), 0);
  const netTax = salesTax - purchTax;

  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        تقرير ضريبة القيمة المضافة — ربع سنوي
      </h2>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 22,
          alignItems: "center",
        }}
      >
        <Select
          label="الربع السنوي"
          value={quarter}
          onChange={setQuarter}
          options={quarters.map((q) => ({ v: q, l: `الربع ${q}` }))}
          style={{ width: 200 }}
        />
        <div style={{ color: "#3a5a8a", fontSize: 13, marginTop: 20 }}>
          نسبة الضريبة: 15% (VAT)
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "#0f1623",
            border: "1px solid #1a3a1a",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: 15,
              fontWeight: 700,
              color: "#44dd88",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IC n="pos" s={16} />
            ضريبة المبيعات (الضريبة المحصلة)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#6a8aaa",
              }}
            >
              <span>إجمالي المبيعات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>
                {salesSubtotal.toFixed(2)} ر.س
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#88dd44",
              }}
            >
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{salesTax.toFixed(2)} ر.س</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#dde8ff",
                fontWeight: 800,
                borderTop: "1px solid #1d3a1d",
                paddingTop: 10,
              }}
            >
              <span>إجمالي المبيعات شامل الضريبة</span>
              <span>{salesTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a6a3a", fontSize: 12 }}>
              عدد الفواتير: {filtSales.length}
            </div>
          </div>
        </div>
        <div
          style={{
            background: "#0f1623",
            border: "1px solid #1a2a3a",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: 15,
              fontWeight: 700,
              color: "#6aaeff",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IC n="purchase" s={16} />
            ضريبة المشتريات (ضريبة المدخلات)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#6a8aaa",
              }}
            >
              <span>إجمالي المشتريات قبل الضريبة</span>
              <span style={{ fontWeight: 700 }}>
                {purchSubtotal.toFixed(2)} ر.س
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#6aaeff",
              }}
            >
              <span>ضريبة القيمة المضافة (15%)</span>
              <span style={{ fontWeight: 700 }}>{purchTax.toFixed(2)} ر.س</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#dde8ff",
                fontWeight: 800,
                borderTop: "1px solid #1d2d4a",
                paddingTop: 10,
              }}
            >
              <span>إجمالي المشتريات شامل الضريبة</span>
              <span>{purchTotal.toFixed(2)} ر.س</span>
            </div>
            <div style={{ color: "#3a5a7a", fontSize: 12 }}>
              عدد الفواتير: {filtPurchases.length}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: netTax > 0 ? "#0a1a0a" : "#1a0a0a",
          border: `2px solid ${netTax > 0 ? "#1a6a1a" : "#6a1a1a"}`,
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: 16,
            fontWeight: 800,
            color: netTax > 0 ? "#44dd88" : "#ff7777",
          }}
        >
          {netTax > 0 ? "✔ ضريبة مستحقة الدفع" : "✔ ضريبة مستردة"} — {quarter}
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>ضريبة المبيعات</div>
            <div
              style={{
                color: "#44dd88",
                fontSize: 22,
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              {salesTax.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>
              ضريبة المشتريات
            </div>
            <div
              style={{
                color: "#6aaeff",
                fontSize: 22,
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              {purchTax.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#6a8aaa", fontSize: 13 }}>صافي الضريبة</div>
            <div
              style={{
                color: netTax > 0 ? "#44dd88" : "#ff7777",
                fontSize: 28,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              {netTax.toFixed(2)} ر.س
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 10,
            color: "#6a8aaa",
            fontSize: 13,
          }}
        >
          {netTax > 0
            ? `يجب تحويل مبلغ ${netTax.toFixed(
                2
              )} ر.س إلى هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`
            : `يحق استرداد مبلغ ${Math.abs(netTax).toFixed(
                2
              )} ر.س من هيئة الزكاة والضريبة والجمارك عن الربع ${quarter}`}
        </div>
      </div>
    </div>
  );
}

// ==================== SHIFT MODULE ====================
function ShiftModule({ shifts, setShifts, sales, currentUser, showToast }) {
  const [openCash, setOpenCash] = useState("500");
  const [closeCash, setCloseCash] = useState("");
  const [notes, setNotes] = useState("");

  const currentShift = shifts.find(
    (s) => !s.end && s.user === currentUser.name
  );
  const shiftSales = currentShift
    ? sales.filter((s) => s.shift === currentShift.id)
    : [];
  const shiftRevenue = shiftSales.reduce((a, s) => a + s.total, 0);

  const openShift = () => {
    if (currentShift) {
      showToast("يوجد شفت مفتوح بالفعل", "warn");
      return;
    }
    const sh = {
      id: "SH-" + String(shifts.length + 1).padStart(3, "0"),
      user: currentUser.name,
      role: currentUser.role,
      start: new Date().toLocaleString("ar-SA"),
      end: null,
      openCash: +openCash,
      closeCash: null,
      sales: 0,
      notes: "",
    };
    setShifts((p) => [...p, sh]);
    showToast("تم فتح الشفت ✓");
  };

  const closeShift = () => {
    if (!closeCash) {
      showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
      return;
    }
    setShifts((p) =>
      p.map((s) =>
        s.id === currentShift.id
          ? {
              ...s,
              end: new Date().toLocaleString("ar-SA"),
              closeCash: +closeCash,
              sales: shiftRevenue,
              notes,
            }
          : s
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
                {currentShift.start}
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
                {currentShift.openCash} ر.س
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
              {(+closeCash - currentShift.openCash - shiftRevenue).toFixed(2)}{" "}
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
          s.start,
          s.end || "-",
          s.openCash + " ر.س",
          <span style={{ color: "#3a9aff", fontWeight: 700 }}>
            {(s.sales || 0).toFixed(2)} ر.س
          </span>,
          s.closeCash ? s.closeCash + " ر.س" : "-",
          s.end ? (
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
