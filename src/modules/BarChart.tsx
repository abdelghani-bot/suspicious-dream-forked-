import { COLORS } from "../theme";

interface BarChartProps {
    title: string;
    data: { label: string; count: number; color: string }[];
    unit?: string;
}

export const BarChart = ({ title, data, unit = "" }: BarChartProps) => {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <div
            style={{
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${COLORS.border}`,
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
                            {unit ? d.count.toLocaleString("ar-SA") : d.count}{unit}
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
