import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getOnboardingSteps,
  syncAutoDetectedSteps,
  updateOnboardingStep,
  seedOnboardingSteps,
  type OnboardingStepRow,
  type StepStatus,
} from "../lib/onboardingAPI";

// ── أيقونات SVG محلية (بدل lucide-react) — نفس الشكل تقريبًا، بدون أي dependency ──
interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}
function Svg({ size = 20, color = "currentColor", strokeWidth = 2, style, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
const CheckCircle2 = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Svg>);
const Circle = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="10" /></Svg>);
const Clock = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Svg>);
const Printer = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Svg>
);
const Wallet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M16 15h2" />
  </Svg>
);
const Truck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </Svg>
);
const Users = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Svg>
);
const ClipboardList = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </Svg>
);
const ShieldCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);
const CalendarDays = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </Svg>
);
const UserSquare2 = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 21a6 6 0 0 0-12 0" />
    <circle cx="12" cy="11" r="4" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Svg>
);
const ChevronLeft = (p: IconProps) => (<Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>);
const ChevronDown = (p: IconProps) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
const Loader2 = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
    </path>
  </Svg>
);

/**
 * OnboardingChecklist — wired version.
 * Reads/writes pharmacy_onboarding_steps via onboardingAPI.ts.
 * Static copy (title/description/icon/cta) stays local since the
 * DB only needs to store status, not display text.
 */

interface StepMeta {
  title: string;
  description: string;
  icon: React.ElementType;
  cta: string;
  // Where the CTA should navigate — wire to your router/section state.
  targetSection?: string;
}

const STEP_META: Record<string, StepMeta> = {
  devices: {
    title: "فحص الأجهزة والأوفلاين",
    description: "الطابعة، قارئ الباركود، إصدار الويندوز، وتثبيت قاعدة البيانات المحلية لتشغيل النظام بدون إنترنت",
    icon: Printer,
    cta: "إعادة الفحص",
  },
  treasury: {
    title: "رصيد الخزينة الافتتاحي",
    description: "تسجيل الرصيد النقدي الموجود فعليًا في الصيدلية عند لحظة التشغيل",
    icon: Wallet,
    cta: "الذهاب للخزينة",
    targetSection: "treasury",
  },
  suppliers: {
    title: "أرصدة الموردين",
    description: "الرصيد الافتتاحي لكل مورد، مع إمكانية التفصيل فاتورة بفاتورة عند الحاجة",
    icon: Truck,
    cta: "الذهاب للموردين",
    targetSection: "suppliers",
  },
  customers: {
    title: "بيانات العملاء",
    description: "استيراد أو إدخال العملاء الحاليين وأرصدة ديونهم إن وُجدت",
    icon: Users,
    cta: "الذهاب للعملاء",
    targetSection: "customers",
  },
  inventory: {
    title: "الجرد والرصيد الافتتاحي",
    description: "مطابقة كل صنف من ملف الجرد بصنف فعلي في النظام قبل الاعتماد النهائي",
    icon: ClipboardList,
    cta: "الذهاب للجرد",
    targetSection: "inventory_count",
  },
  accounts: {
    title: "الحسابات والصلاحيات",
    description: "إنشاء حسابات المستخدمين وتحديد صلاحية كل حساب داخل النظام",
    icon: ShieldCheck,
    cta: "إدارة الحسابات",
    targetSection: "permissions",
  },
  schedule: {
    title: "جدول الدوام والإجازات",
    description: "تحديد الورديات وأيام الإجازة لكل موظف",
    icon: CalendarDays,
    cta: "إعداد الجدول",
    targetSection: "attendance", // جدول الدوام جوه تاب الحضور والانصراف
  },
  employees: {
    title: "بيانات الموظفين والرواتب",
    description: "إدخال بيانات الموظفين وربط حساباتهم لاحتساب الرواتب والحوافز",
    icon: UserSquare2,
    cta: "إدخال البيانات",
    targetSection: "attendance", // مفيش تاب موظفين مستقل حاليًا
  },
};

// Keeps display order stable regardless of DB row order.
const STEP_ORDER = [
  "devices",
  "treasury",
  "suppliers",
  "customers",
  "inventory",
  "accounts",
  "schedule",
  "employees",
];

const STATUS_STYLES: Record<StepStatus, { label: string; text: string; bg: string }> = {
  done: { label: "مكتمل", text: "#1F6E56", bg: "#EAF6F1" },
  in_progress: { label: "قيد التنفيذ", text: "#8A5420", bg: "#FBF1E7" },
  pending: { label: "لم يبدأ", text: "#5B6663", bg: "#F1F3F2" },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle2 size={22} color="#2F9E7A" strokeWidth={2.25} />;
  if (status === "in_progress") return <Clock size={22} color="#C97A2B" strokeWidth={2.25} />;
  return <Circle size={22} color="#B7C1BC" strokeWidth={2} />;
}

interface OnboardingChecklistProps {
  pharmacyId: string;
  currentUserId?: string;
  onNavigate?: (section: string) => void; // بيتوصّل بـ setTab في App.tsx
  onComplete?: () => void; // بتتنادى مرة واحدة لما كل الخطوات تبقى "مكتمل" (percent === 100)
}

export function OnboardingChecklist({
  pharmacyId,
  currentUserId,
  onNavigate,
  onComplete,
}: OnboardingChecklistProps) {
  const [rows, setRows] = useState<OnboardingStepRow[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  async function loadSteps() {
    try {
      setError(null);
      let data = await getOnboardingSteps(pharmacyId);

      // First-ever load for this pharmacy: seed then re-fetch.
      if (data.length === 0) {
        await seedOnboardingSteps(pharmacyId);
        data = await getOnboardingSteps(pharmacyId);
      }

      setRows(data);

      // Reconcile auto-detected steps against real data, then reload.
      await syncAutoDetectedSteps(pharmacyId);
      const refreshed = await getOnboardingSteps(pharmacyId);
      setRows(refreshed);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحميل خطوات الإعداد");
    }
  }

  useEffect(() => {
    loadSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacyId]);

  const orderedSteps = useMemo(() => {
    if (!rows) return [];
    const byKey = new Map(rows.map((r) => [r.step_key, r]));
    return STEP_ORDER.filter((key) => byKey.has(key)).map((key) => byKey.get(key)!);
  }, [rows]);

  const { doneCount, total, percent } = useMemo(() => {
    const done = orderedSteps.filter((s) => s.status === "done").length;
    const total = orderedSteps.length || 1;
    return { doneCount: done, total, percent: Math.round((done / total) * 100) };
  }, [orderedSteps]);

  // لما آخر خطوة تتحدد "مكتمل": نبلّغ App.tsx عشان يخفي عنصر الـ sidebar فورًا (من غير reload)
  const completeNotifiedRef = useRef(false);
  useEffect(() => {
    if (orderedSteps.length === 0) return;
    if (percent === 100) {
      if (!completeNotifiedRef.current) {
        completeNotifiedRef.current = true;
        onComplete?.();
      }
    } else {
      completeNotifiedRef.current = false;
    }
  }, [percent, orderedSteps.length, onComplete]);

  async function handleMarkDone(stepKey: string) {
    setBusyStep(stepKey);
    try {
      await updateOnboardingStep(pharmacyId, stepKey, "done", currentUserId);
      const refreshed = await getOnboardingSteps(pharmacyId);
      setRows(refreshed);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحديث حالة الخطوة");
    } finally {
      setBusyStep(null);
    }
  }

  if (!rows) {
    return (
      <div
        dir="rtl"
        style={{
          fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          color: "#5B6663",
        }}
      >
        <Loader2 size={20} style={{ marginLeft: 8 }} />
        جارِ تحميل خطوات الإعداد...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
        background: "#F7F9F8",
        minHeight: "100%",
        padding: "28px 20px",
        color: "#16241F",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#0F6B5C" }}>
            إعداد الصيدلية
          </h1>
          <p style={{ fontSize: 14, color: "#5B6663", marginTop: 6, lineHeight: 1.6 }}>
            أكمل الخطوات التالية بالترتيب لضمان تشغيل الحساب بشكل صحيح من أول يوم
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              background: "#FBEAEA",
              color: "#A33A3A",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Progress bar */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #DCE5E1",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#16241F" }}>
              {doneCount} من {total} خطوات مكتملة
            </span>
            <span style={{ fontSize: 13, color: "#0F6B5C", fontWeight: 700 }}>{percent}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "#EDF2F0", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                background: "linear-gradient(90deg, #0F6B5C, #2F9E7A)",
                borderRadius: 999,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orderedSteps.map((step, idx) => {
            const meta = STEP_META[step.step_key];
            if (!meta) return null;
            const isExpanded = expandedId === step.step_key;
            const style = STATUS_STYLES[step.status];
            const Icon = meta.icon;
            const isBusy = busyStep === step.step_key;

            return (
              <div
                key={step.step_key}
                style={{ background: "#fff", border: "1px solid #DCE5E1", borderRadius: 12, overflow: "hidden" }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : step.step_key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "right",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: step.status === "pending" ? "#9AA6A1" : "#fff",
                      background: step.status === "pending" ? "#EDF2F0" : "#0F6B5C",
                    }}
                  >
                    {idx + 1}
                  </span>

                  <Icon size={19} color="#5B6663" style={{ flexShrink: 0 }} />

                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#16241F" }}>
                    {meta.title}
                  </span>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 999,
                      color: style.text,
                      background: style.bg,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {style.label}
                  </span>

                  <StatusIcon status={step.status} />

                  {isExpanded ? <ChevronDown size={16} color="#9AA6A1" /> : <ChevronLeft size={16} color="#9AA6A1" />}
                </button>

                {isExpanded && (
                  <div style={{ padding: "0 16px 16px 16px" }}>
                    <p style={{ fontSize: 13.5, color: "#5B6663", lineHeight: 1.7, margin: "0 0 12px 44px" }}>
                      {meta.description}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 0 44px" }}>
                      {step.status === "done" ? (
                        <span style={{ fontSize: 12, color: "#9AA6A1" }}>
                          {step.completed_at ? `تم بتاريخ ${new Date(step.completed_at).toLocaleDateString("ar")}` : "مكتمل"}
                        </span>
                      ) : (
                        <span />
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        {meta.targetSection && (
                          <button
                            onClick={() => onNavigate?.(meta.targetSection!)}
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              padding: "8px 16px",
                              borderRadius: 8,
                              border: "1px solid #0F6B5C",
                              cursor: "pointer",
                              color: "#0F6B5C",
                              background: "#fff",
                            }}
                          >
                            {meta.cta}
                          </button>
                        )}

                        {step.status !== "done" && (
                          <button
                            onClick={() => handleMarkDone(step.step_key)}
                            disabled={isBusy}
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              padding: "8px 16px",
                              borderRadius: 8,
                              border: "none",
                              cursor: isBusy ? "default" : "pointer",
                              color: "#fff",
                              background: "#0F6B5C",
                              opacity: isBusy ? 0.6 : 1,
                            }}
                          >
                            {isBusy ? "جارِ الحفظ..." : "تحديد كمكتمل"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {percent === 100 && (
          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#EAF6F1",
              color: "#1F6E56",
              fontSize: 14,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            الصيدلية جاهزة للتشغيل الفعلي 🎉
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingChecklist;
