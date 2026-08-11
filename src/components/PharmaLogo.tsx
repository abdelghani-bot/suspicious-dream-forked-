import React from "react";

// ============================================================
// PharmaLogo — كومبوننت الشعار الموحّد
// يستبدل أي مكان في الكود بيعمل render لمربع "P" القديم
// (شاشة الدخول، الـ sidebar، أي مكان تاني محتاج الأيقونة)
//
// الاستخدام:
//   import { PharmaLogo } from "./components/PharmaLogo";
//
//   // أيقونة كاملة (خلفية متدرجة + مسحة فرشاة) — لشاشة الدخول والـ app icon
//   <PharmaLogo size={64} variant="tile" />
//
//   // العلامة لوحدها بلون واحد شفاف الخلفية — لهيدر الـ sidebar الضيق
//   <PharmaLogo size={32} variant="mark" />
//
//   // اللوجو الأفقي كامل (أيقونة صغيرة + اسم البرنامج) — لهيدر الصفحات والفواتير
//   <PharmaLogo size={40} variant="horizontal" />
// ============================================================

type PharmaLogoProps = {
    /** ارتفاع الأيقونة بالبكسل. الافتراضي 64 */
    size?: number;
    /**
     * tile: مربع متدرج كامل بالمسحة والشرارة — لشاشة الدخول والـ app icon
     * mark: العلامة لوحدها (بدون المربع الخلفي) بلون واحد — تُستخدم فوق خلفيات ملوّنة بالفعل
     * horizontal: أيقونة صغيرة + نص "PharmaGo 360" بجانبها — لهيدر الصفحات
     */
    variant?: "tile" | "mark" | "horizontal";
    /** يظهر مسحة الفرشاة تحت الأيقونة. اتلغائيًا true في وضع tile فقط، وبيتلغي تلقائيًا لو size < 40 */
    showBrush?: boolean;
    /** لون العلامة في وضع mark (افتراضي: أبيض) */
    markColor?: string;
    className?: string;
};

export const PharmaLogo: React.FC<PharmaLogoProps> = ({
    size = 64,
    variant = "tile",
    showBrush = true,
    markColor = "#FFFFFF",
    className,
}) => {
    const brushEnabled = showBrush && size >= 40 && variant === "tile";

    // ---------- الجلايف الأساسي (الساق + العدسة) ----------
    const Glyph = ({ stroke, innerFill, sheenOpacity }: { stroke: string; innerFill: string; sheenOpacity: number }) => (
        <>
            <circle cx="48" cy="34" r="16" stroke={stroke} strokeWidth="5" fill="none" />
            <circle cx="48" cy="34" r="8" fill={innerFill} />
            <path
                d="M42,27 A8.5,8.5 0 0,0 37.5,33"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity={sheenOpacity}
            />
            <rect x="32" y="20" width="10.5" height="52" rx="5.2" fill={stroke} />
        </>
    );

    // ---------- وضع tile: المربع المتدرج الكامل ----------
    if (variant === "tile") {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                className={className}
                style={{ display: "block", overflow: "visible" }}
            >
                <defs>
                    <linearGradient id="pg-tile" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#0FC7B0" />
                        <stop offset="55%" stopColor="#0BAE9A" />
                        <stop offset="100%" stopColor="#0B8A78" />
                    </linearGradient>
                    <linearGradient id="pg-brush" x1="10" y1="90" x2="90" y2="80" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#CFF7EE" />
                        <stop offset="55%" stopColor="#0FC7B0" />
                        <stop offset="100%" stopColor="#0B8A78" />
                    </linearGradient>
                </defs>

                <rect width="100" height="100" rx="22" fill="url(#pg-tile)" />
                <rect x="0.5" y="0.5" width="99" height="99" rx="21.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />

                {/* شرارة الذكاء */}
                <path
                    d="M18,11.5 L19.6,17.3 L25.5,19 L19.6,20.7 L18,26.5 L16.4,20.7 L10.5,19 L16.4,17.3 Z"
                    fill="#FFFFFF"
                    opacity="0.95"
                />

                <Glyph stroke="#FFFFFF" innerFill="#08211D" sheenOpacity={0.6} />

                {brushEnabled && (
                    <>
                        <path
                            d="M10,94.5 Q22,91.5 32,88.5 Q42,85 50,82
                 Q60,78 70,74.5 Q80,70.5 90,66
                 L90,91.5 Q80,92.7 70,94 Q60,95.2 50,96
                 Q40,96.5 32,96.6 Q22,96.7 10,97 Z"
                            fill="url(#pg-brush)"
                            opacity="0.96"
                        />
                        <path
                            d="M13,95.3 Q35,92 55,86.5 Q73,81.5 87,71"
                            stroke="#FFFFFF"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.35"
                        />
                    </>
                )}
            </svg>
        );
    }

    // ---------- وضع mark: العلامة لوحدها بلون واحد، بدون مربع خلفية ----------
    if (variant === "mark") {
        return (
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                className={className}
                style={{ display: "block", overflow: "visible" }}
            >
                <Glyph stroke={markColor} innerFill="rgba(0,0,0,0.35)" sheenOpacity={0.5} />
            </svg>
        );
    }

    // ---------- وضع horizontal: أيقونة صغيرة + اسم البرنامج ----------
    return (
        <div className={className} style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
            <PharmaLogo size={size} variant="tile" showBrush={false} />
            <span style={{ display: "flex", alignItems: "baseline", fontFamily: "Poppins, sans-serif" }}>
                <span style={{ fontSize: size * 0.5, fontWeight: 800, color: "#0B2622", letterSpacing: "-0.3px" }}>
                    PharmaGo
                </span>
                <span style={{ fontSize: size * 0.5, fontWeight: 600, color: "#0BC4C4", letterSpacing: "-0.3px" }}>
                    {" "}360
                </span>
            </span>
        </div>
    );
};
