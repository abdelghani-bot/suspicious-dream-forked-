export function AlertRow({
  text, badge, color, VAR }) {
  const { C } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 0", gap: 10, fontSize: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, color: C.text }}>{text}</div>
      <div style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: `${color}1f`, color, fontWeight: 600 }}>{badge}</div>
    </div>
  );
}
