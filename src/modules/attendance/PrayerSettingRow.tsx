export function PrayerSettingRow({ setting, onSave, ramadan, C }: any) {
  const [local, setLocal] = useState({ ...setting });
  const changed = JSON.stringify(local) !== JSON.stringify(setting);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
      <div style={{ width: 70, fontWeight: 700, color: C.text, fontSize: 14 }}>{setting.prayer_name}</div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: C.muted }}>
        <input type="checkbox" checked={local.is_active} onChange={(e) => setLocal({ ...local, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
        تفعيل
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
        وقت مسموح:
        <input type="number" min={5} max={120} value={local.allowed_minutes} onChange={(e) => setLocal({ ...local, allowed_minutes: +e.target.value })}
          style={{ width: 60, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
        <span style={{ color: C.muted }}>دقيقة</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text }}>
        🌙 رمضان:
        <input type="number" min={5} max={120} value={local.ramadan_allowed_minutes} onChange={(e) => setLocal({ ...local, ramadan_allowed_minutes: +e.target.value })}
          style={{ width: 60, background: ramadan ? "#1a1500" : C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", color: C.text, textAlign: "center", outline: "none" }} />
        <span style={{ color: C.muted }}>دقيقة</span>
      </label>
      {changed && (
        <button onClick={() => onSave(local)} style={{ background: "#0a1a3a", border: "1px solid #1a4a8a", borderRadius: 7, padding: "6px 16px", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          حفظ
        </button>
      )}
    </div>
  );
}
// ==================== LOYALTY POINTS MODULE ====================
