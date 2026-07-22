import { COLORS } from "../theme";

// ==================== ICONS ====================
export const IC = ({ n, s = 18, style = {} }) => {
  const m = {
    dashboard: "📊",
    pos: "🛒",
    inventory: "💊",
    purchase: "📦",
    returns: "↩️",
    customers: "👥",
    suppliers: "🏭",
    reports: "📈",
    chart: "📈",
    tax: "🧾",
    shift: "🕐",
    count: "📋",
    logout: "🚪",
    cart: "🛒",
    trash: "🗑️",
    plus: "➕",
    minus: "➖",
    search: "🔍",
    check: "✅",
    x: "❌",
    edit: "✏️",
    barcode: "🔢",
    print: "🖨️",
    printer: "🖨️",
    img: "🖼️",
    pill: "💊",
    alert: "⚠️",
    bell: "🔔",
    money: "💰",
    user: "👤",
    eye: "👁️",
    download: "📥",
    tag: "🏷️",
    percent: "%",
    settings: "⚙️",
    tools: "🛠️",
    whatsapp: "💬",
    star: "🌟",
    target: "🎯",
    upload: "📤",
    loading: "⏳",
  };
  return (
    <span
      style={{
        fontSize: s,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontStyle: "normal",
        ...style,
      }}
    >
      {m[n] || ""}
    </span>
  );
};



// ==================== UI COMPONENTS ====================
export const Modal = ({ open, onClose, title, children, wide, zIndex, closeOnBackdrop = true }) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: zIndex || 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(11,38,34,0.35)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
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



export const Toast = ({ msg, type }) => (
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



export const Btn = ({
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



export const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  style = {},
  dir,
  lang,
  inputRef,
  onFocus,
  onBlur,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
    {label && (
      <label style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 600 }}>
        {label}
        {required && <span style={{ color: COLORS.red }}> *</span>}
      </label>
    )}
    <input
      ref={inputRef}
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      lang={lang}
      onFocus={onFocus}
      onBlur={onBlur}
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
        textAlign: dir === "ltr" ? "left" : dir === "rtl" ? "right" : undefined,
      }}
    />
  </div>
);



export const Select = ({ label, value, onChange, options, style = {} }) => (
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



export const Badge = ({ children, color = COLORS.blueSoft, text = COLORS.blue }) => (
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



export const StatCard = ({ label, value, icon, color, sub }) => (
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



export const Table = ({ headers, rows, emptyMsg = "لا توجد بيانات" }) => (
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



// 🆕 Pagination — عنصر عام لتقسيم أي قايمة طويلة لصفحات بدل عرضها كاملة دفعة واحدة.
// totalItems = عدد العناصر الكلي (قبل التقسيم)، pageSize = عدد العناصر في الصفحة، page/onPageChange = التحكم بالصفحة الحالية.
// بيختفي تلقائيًا لو العدد الكلي أقل من أو يساوي pageSize (مفيش داعي لعناصر تحكم لو كل حاجة ظاهرة أصلًا).
export const Pagination = ({ page, onPageChange, totalItems, pageSize }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to = Math.min(clampedPage * pageSize, totalItems);
  const goTo = (p) => onPageChange(Math.min(Math.max(1, p), totalPages));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "12px 4px" }}>
      <div style={{ fontSize: 12, color: COLORS.textDim }}>
        عرض {from}–{to} من {totalItems}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={() => goTo(clampedPage - 1)}
          disabled={clampedPage === 1}
          style={{
            border: `1px solid ${COLORS.border}`, background: COLORS.surface, borderRadius: 8,
            padding: "6px 12px", fontSize: 12, fontWeight: 700, color: clampedPage === 1 ? COLORS.textDim : COLORS.textPrimary,
            cursor: clampedPage === 1 ? "not-allowed" : "pointer", opacity: clampedPage === 1 ? 0.5 : 1,
          }}
        >
          السابق
        </button>
        <span style={{ fontSize: 12, color: COLORS.textPrimary, fontWeight: 700, minWidth: 70, textAlign: "center" }}>
          صفحة {clampedPage} / {totalPages}
        </span>
        <button
          onClick={() => goTo(clampedPage + 1)}
          disabled={clampedPage === totalPages}
          style={{
            border: `1px solid ${COLORS.border}`, background: COLORS.surface, borderRadius: 8,
            padding: "6px 12px", fontSize: 12, fontWeight: 700, color: clampedPage === totalPages ? COLORS.textDim : COLORS.textPrimary,
            cursor: clampedPage === totalPages ? "not-allowed" : "pointer", opacity: clampedPage === totalPages ? 0.5 : 1,
          }}
        >
          التالي
        </button>
      </div>
    </div>
  );
};
