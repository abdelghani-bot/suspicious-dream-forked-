import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, SHADOW } from "../theme";

// ==================== SUPER ADMIN PANEL ====================
export function computeAccessStatus(pharmacy: any): "full" | "readonly" | "blocked" {
  const now = new Date();
  if (pharmacy.subscription_status === "suspended") return "blocked";

  if (pharmacy.subscription_status === "active") {
    const subEnds = pharmacy.subscription_ends_at ? new Date(pharmacy.subscription_ends_at) : null;
    if (!subEnds || now < subEnds) return "full";
    const graceEnds = new Date(subEnds.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (now < graceEnds) return "readonly";
    return "blocked";
  }

  if (pharmacy.subscription_status === "trial") {
    const trialEnds = pharmacy.trial_ends_at ? new Date(pharmacy.trial_ends_at) : null;
    if (!trialEnds || now < trialEnds) return "full";
    const graceEnds = new Date(trialEnds.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (now < graceEnds) return "readonly";
    return "blocked";
  }

  return "blocked";
}



export const ACCESS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  full:     { label: "✅ نشط",         bg: "#dcfce7", color: "#166534" },
  readonly: { label: "⏳ قراءة فقط",   bg: "#fef3c7", color: "#92400e" },
  blocked:  { label: "🚫 موقوف",       bg: "#fee2e2", color: "#991b1b" },
};



export function SuperAdminPanel({ currentUser, onLogout, onEnterPharmacy }: { currentUser: any; onLogout: () => void; onEnterPharmacy?: () => void }) {
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const loadPharmacies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pharmacies")
      .select("id, name, name_en, phone, subscription_plan, subscription_status, trial_ends_at, subscription_ends_at, created_at")
      .order("created_at", { ascending: false });
    if (error) setMsg({ text: "تعذّر تحميل الصيدليات: " + error.message, type: "err" });
    setPharmacies(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPharmacies(); }, []);

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const updatePharmacy = async (id: string, patch: Record<string, any>, successText: string) => {
    setBusyId(id);
    const { error } = await supabase.from("pharmacies").update(patch).eq("id", id);
    setBusyId(null);
    if (error) { showMsg("فشل التحديث: " + error.message, "err"); return; }
    showMsg(successText, "ok");
    await loadPharmacies();
  };

  const suspend = (id: string) => updatePharmacy(id, { subscription_status: "suspended" }, "تم إيقاف الصيدلية");

  // تفعيل الاشتراك المدفوع: يحدد تاريخ انتهاء سنة من الآن (أو من تاريخ الانتهاء الحالي لو لسه ساري)
  const activate = (p: any) => {
    const base = p.subscription_ends_at && new Date(p.subscription_ends_at) > new Date() ? new Date(p.subscription_ends_at) : new Date();
    const next = new Date(base);
    next.setFullYear(next.getFullYear() + 1);
    updatePharmacy(p.id, { subscription_status: "active", subscription_ends_at: next.toISOString() }, "تم تفعيل الاشتراك لمدة سنة");
  };

  const extendTrial7 = (p: any) => {
    const base = p.trial_ends_at && new Date(p.trial_ends_at) > new Date() ? new Date(p.trial_ends_at) : new Date();
    const next = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    updatePharmacy(p.id, { subscription_status: "trial", trial_ends_at: next.toISOString() }, "تم تمديد الفترة التجريبية 7 أيام");
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: COLORS.appBg, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.textPrimary }}>لوحة تحكم السوبر أدمن</div>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>مرحبًا {currentUser?.name} — إدارة اشتراكات كل الصيدليات</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {currentUser?.pharmacy_id && onEnterPharmacy && (
            <button
              onClick={onEnterPharmacy}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: COLORS.greenSoft || "#dcfce7", color: COLORS.green || "#166534",
                fontWeight: 700, cursor: "pointer",
              }}
            >
              الدخول كصيدلية
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: COLORS.redSoft || "#fee2e2", color: COLORS.red || "#991b1b",
              fontWeight: 700, cursor: "pointer",
            }}
          >
            خروج
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontWeight: 700,
          background: msg.type === "ok" ? "#dcfce7" : "#fee2e2",
          color: msg.type === "ok" ? "#166534" : "#991b1b",
        }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.textDim }}>جارٍ التحميل...</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: SHADOW?.card || "0 1px 4px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.surfaceAlt, textAlign: "right" }}>
                <th style={{ padding: 12 }}>الصيدلية</th>
                <th style={{ padding: 12 }}>الحالة</th>
                <th style={{ padding: 12 }}>وضع الوصول</th>
                <th style={{ padding: 12 }}>نهاية التجربة</th>
                <th style={{ padding: 12 }}>نهاية الاشتراك</th>
                <th style={{ padding: 12 }}>تاريخ الإنشاء</th>
                <th style={{ padding: 12 }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {pharmacies.map((p) => {
                const status = computeAccessStatus(p);
                const badge = ACCESS_BADGE[status];
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: 12 }}>{p.subscription_status || "—"}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.color, fontWeight: 700 }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      {p.trial_ends_at ? new Date(p.trial_ends_at).toLocaleDateString("ar-EG") : "—"}
                    </td>
                    <td style={{ padding: 12 }}>
                      {p.subscription_ends_at ? new Date(p.subscription_ends_at).toLocaleDateString("ar-EG") : "—"}
                    </td>
                    <td style={{ padding: 12, color: COLORS.textDim }}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("ar-EG") : "—"}
                    </td>
                    <td style={{ padding: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => extendTrial7(p)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#e0f2fe", color: "#075985", fontWeight: 700, cursor: "pointer" }}
                      >
                        +7 أيام تجربة
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => activate(p)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#dcfce7", color: "#166534", fontWeight: 700, cursor: "pointer" }}
                      >
                        تفعيل (+سنة)
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => suspend(p.id)}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#991b1b", fontWeight: 700, cursor: "pointer" }}
                      >
                        إيقاف
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pharmacies.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: COLORS.textDim }}>لا توجد صيدليات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
