import { COLORS, tint } from "../theme";
import { openWhatsApp } from "../lib/whatsapp";
import { MiniTrend } from "./MiniTrend";
import { vipConfig, trendConfig } from "./customerConfig";

interface CustomerCardProps {
    c: any;
    isExpanded: boolean;
    loyalty?: number;
    canEdit?: boolean;
    canDelete?: boolean;
    onToggle: (c: any) => void;
    onEdit: (c: any) => void;
    onDelete: (c: any) => void;
    onOpenCredit: (c: any) => void;
}

export const CustomerCard = ({
    c, isExpanded, loyalty, canEdit, canDelete, onToggle, onEdit, onDelete, onOpenCredit,
}: CustomerCardProps) => {
    const s = c.stats;
    const vip = s ? vipConfig[s.vipLevel] : null;

    // المتبقي فعلياً بعد خصم المسدد (نفس منطق CreditTab)
    const debt = c.stats?.debtRemaining || 0;

    return (
        <div style={{
            background: COLORS.surface,
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            border: `1px solid ${isExpanded ? (vip ? vip.color + "55" : COLORS.blue) : (vip ? vip.color + "33" : COLORS.border)}`,
            borderRadius: 12,
            overflow: "hidden",
            transition: "border-color 0.2s",
        }}>
            {/* رأس الكارت — قابل للضغط */}
            <div onClick={() => onToggle(c)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", cursor: "pointer", gap: 8,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 8, background: "#1a2a5a",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, flexShrink: 0,
                    }}>
                        {c.category === "individual" ? "👤" : c.category === "family_no_kids" ? "👫" : "👨‍👩‍👧"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.name}
                        </div>
                        <div style={{ color: COLORS.textDim, fontSize: 10, fontWeight: 600 }}>{c.phone}</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {vip && <span style={{ background: vip.bg, color: vip.color, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{vip.label}</span>}
                    {s?.trendDirection && s.activeMonthsCount >= 2 && (
                        <span title={trendConfig[s.trendDirection].label} style={{ background: trendConfig[s.trendDirection].bg, color: trendConfig[s.trendDirection].color, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>
                            {trendConfig[s.trendDirection].icon}
                        </span>
                    )}
                    {debt > 0 && <span style={{ background: COLORS.redSoft, color: COLORS.red, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>💳 {debt.toFixed(0)} ر.س</span>}
                    {s?.isOverdue && <span style={{ background: COLORS.redSoft, color: COLORS.red, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>⏰ متأخر {s.daysOverdue} يوم</span>}
                    {c.missedKidsCosmetics && <span style={{ background: COLORS.goldSoft, color: COLORS.gold, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>🎁 فرصة عرض</span>}
                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
            </div>

            {/* التفاصيل */}
            {isExpanded && (
                <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
                    {/* إحصائيات */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginTop: 10, marginBottom: 8 }}>
                        {[
                            { label: "إجمالي الزيارات", value: s?.totalVisits || 0, color: COLORS.blue },
                            { label: "زيارات الشهر", value: s?.monthlyVisits || 0, color: COLORS.green },
                            { label: "متوسط الفاتورة", value: s ? s.avgInvoice.toFixed(0) + " ر.س" : "-", color: COLORS.purple },
                            { label: "إجمالي المشتريات", value: s ? s.totalSpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                            { label: "مشتريات الشهر", value: s ? s.monthlySpent.toFixed(0) + " ر.س" : "-", color: COLORS.gold },
                            { label: "آخر زيارة", value: s ? `${s.daysSinceLast} يوم` : "لم يزر", color: COLORS.textDim },
                            { label: "نمط الشراء", value: s?.buyerType ? (s.buyerType === "شامل" ? "🌐 شامل" : s.buyerType) : "-", color: s?.buyerType === "شامل" ? COLORS.green : COLORS.blue },
                        ].map((item) => (
                            <div key={item.label} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 7, padding: "6px 7px" }}>
                                <div style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 600 }}>{item.label}</div>
                                <div style={{ color: item.color, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* نقاط الولاء */}
                    {loyalty !== undefined && loyalty > 0 && (
                        <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 7, padding: "6px 10px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: COLORS.gold, fontSize: 12 }}>🌟 نقاط الولاء</span>
                            <span style={{ color: COLORS.gold, fontWeight: 800, fontSize: 13 }}>{loyalty.toFixed(2)} ر.س</span>
                        </div>
                    )}

                    {/* شريط RFM */}
                    {s && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ color: COLORS.textDim, fontSize: 10 }}>نقاط RFM</span>
                                <span style={{ color: vip?.color, fontSize: 10, fontWeight: 700 }}>{s.rfmScore}/100</span>
                            </div>
                            <div style={{ background: COLORS.surfaceAlt, borderRadius: 4, height: 4 }}>
                                <div style={{ background: vip?.color || COLORS.textDim, height: "100%", borderRadius: 4, width: `${s.rfmScore}%`, transition: "width 0.5s" }} />
                            </div>
                        </div>
                    )}

                    {/* اتجاه الشراء الشهري */}
                    {s?.monthlyTrend && (
                        <div style={{ background: COLORS.surfaceAlt, borderRadius: 7, padding: "8px 10px", marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ color: COLORS.textDim, fontSize: 10 }}>اتجاه الشراء (آخر 6 شهور)</span>
                                <span style={{ color: trendConfig[s.trendDirection].color, fontSize: 10, fontWeight: 700 }}>
                                    {trendConfig[s.trendDirection].label}
                                </span>
                            </div>
                            <MiniTrend data={s.monthlyTrend} color={trendConfig[s.trendDirection].color} />
                        </div>
                    )}

                    {/* آخر مشتريات */}
                    {s?.lastItems?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 4 }}>آخر مشتريات ({s.lastItems.length} صنف):</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {s.lastItems.map((item, i) => (
                                    <span key={i} style={{ background: COLORS.blueSoft, color: COLORS.blue, padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600 }}>
                                        {item.name} × {item.qty}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* أزرار */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        <button onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 نتمنى أن تكونوا بخير`)}
                            style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.green, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                            📱 واتساب
                        </button>
                        {c.missedKidsCosmetics && (
                            <button onClick={() => openWhatsApp(c.phone, `مرحباً ${c.name}! 😊 عندنا عروض على مستلزمات الأطفال والعناية بالبشرة، تحب نبعتلك التفاصيل؟`)}
                                style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                                🎁 ابعت عرض
                            </button>
                        )}
                        {canEdit && (
                            <button onClick={() => onEdit(c)}
                                style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "5px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                                ✏️ تعديل
                            </button>
                        )}
                        {canDelete && (
                            <button onClick={() => onDelete(c)}
                                style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>
                                🗑️ حذف
                            </button>
                        )}
                        {debt > 0 && (
                            <button onClick={() => onOpenCredit(c)}
                                style={{ background: "#2a1a00", border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 7, padding: "5px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                                💳 سداد آجل
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
