export const StatCard = ({
  const { C } = useTheme(); label, value, icon, color, sub }) => (
  <div
    style={{
      background: C.surface,
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
          color: C.text,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
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

