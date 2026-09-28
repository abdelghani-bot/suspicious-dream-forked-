import { COLORS } from "../theme";

interface MiniTrendProps {
    data?: { label: string; amount: number }[];
    color: string;
    height?: number;
}

export const MiniTrend = ({ data, color, height = 40 }: MiniTrendProps) => {
    if (!data || data.length === 0) return null;
    const values = data.map((d) => d.amount);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 100;
    const toX = (i) => (values.length > 1 ? (i / (values.length - 1)) * w : w / 2);
    const toY = (v) => height - ((v - min) / range) * (height - 8) - 4;
    const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    return (
        <div>
            <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
                <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                {values.map((v, i) => (
                    <circle key={i} cx={toX(i)} cy={toY(v)} r={1.8} fill={color} />
                ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                {data.map((d, i) => (
                    <span key={i} style={{ fontSize: 9, color: COLORS.textDim }}>{d.label}</span>
                ))}
            </div>
        </div>
    );
};
