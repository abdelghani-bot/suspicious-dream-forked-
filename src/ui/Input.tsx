export const Input = ({
  const { C } = useTheme();
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
      <label style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
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
        background: C.bgAlt,
        border: "1px solid #1d2d4a",
        borderRadius: 8,
        padding: "9px 12px",
        color: C.text,
        fontSize: 14,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
      }}
    />
  </div>
);

