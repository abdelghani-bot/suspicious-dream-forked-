import { PHARMACY_INTERIOR_BG } from "./Login";

// ==================== PHARMACY SHELF BACKGROUND ====================
// خلفية موحّدة (رفوف + علب أدوية + بلور) — تُستخدم مرة واحدة في الـ wrapper
// الرئيسي عشان تظهر تلقائيًا خلف كل التابات بدون أي تكرار في كل صفحة.
export const SHELF_BOX_COLORS = [
  "#5bc8b0", "#ff9eb5", "#7ec8e3", "#ffd166", "#a8e6cf", "#ff8b94", "#a29bfe",
  "#74b9ff", "#55efc4", "#fd79a8", "#fdcb6e", "#6c5ce7", "#00cec9", "#e17055",
  "#81ecec", "#fab1a0", "#ffeaa7", "#dfe6e9", "#ff7675", "#00b894", "#e84393",
  "#0984e3",
];



export function makeShelfRow(rowIndex: number, topPct: number, count: number) {
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



export function PharmacyShelfBackground() {
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
