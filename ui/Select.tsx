export const Select = ({
  const { C } = useTheme(); label, value, onChange, options, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
    {label && (
      <label style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
        {label}
      </label>
    )}
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
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
    >
      {options.map((o) => (
        <option key={o.v || o} value={o.v || o}>
          {o.l || o}
        </option>
      ))}
    </select>
  </div>
);

