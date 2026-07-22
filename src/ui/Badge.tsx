export const Badge = ({
  const { C } = useTheme(); children, color = "#1a3a6a", text = C.accent }) => (
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

