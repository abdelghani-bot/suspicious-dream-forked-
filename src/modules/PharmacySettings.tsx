export function PharmacySettings({
  const { C } = useTheme(); showToast, pharmacyId }) {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (!pharmacyId) return;
    supabase
      .from("pharmacy_settings")
      .select("*")
      .eq("pharmacy_id", pharmacyId)
      .single()
      .then(({ data }) => {
        if (data) setSettings({
          nameAr: data.name_ar || data.name || "",
          nameEn: data.name_en || "",
          phone: data.phone || "",
          address: data.address || "",
          vatNumber: data.tax_number || "",
          licenseNumber: data.license_number || "",
          labelSize: data.label_size || "50x30",
        });
      });
  }, [pharmacyId]);

  const fields = [
    { key: "nameAr", label: "اسم الصيدلية (عربي)" },
    { key: "nameEn", label: "Pharmacy Name (English)" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "address", label: "العنوان" },
    { key: "vatNumber", label: "الرقم الضريبي" },
    { key: "licenseNumber", label: "رقم الترخيص" },
  ];

  const LABEL_SIZES = [
    { id: "40x25", label: "40×25 mm (صغير)", w: 40, h: 25 },
    { id: "50x30", label: "50×30 mm (متوسط)", w: 50, h: 30 },
    { id: "58x40", label: "58×40 mm (كبير)", w: 58, h: 40 },
    { id: "60x40", label: "60×40 mm (كبير)", w: 60, h: 40 },
  ];

  const save = async () => {
  if (!pharmacyId) return;
  const { error } = await supabase
    .from("pharmacy_settings")
    .update({
      name_ar: settings.nameAr,
      name_en: settings.nameEn,
      phone: settings.phone,
      address: settings.address,
      tax_number: settings.vatNumber,
      license_number: settings.licenseNumber,
      updated_at: new Date().toISOString(),
      label_size: settings.labelSize || "50x30",
    })
    .eq("pharmacy_id", pharmacyId);

  if (error) {
    showToast("خطأ في الحفظ: " + error.message, "error");
    return;
  }
  localStorage.setItem("pharmacy_settings", JSON.stringify(settings));
  showToast("تم حفظ بيانات الصيدلية ✓");
};
  return (
    <div>
      <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
        بيانات الصيدلية
      </h2>
      <div style={{
        background: C.surface, border: "1px solid #1d2d4a",
        borderRadius: 16, padding: 24,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
      }}>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 6 }}>
              {label}
            </label>
            <input
              value={settings[key] || ""}
              onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
              style={{
                width: "100%", background: C.bgAlt,
                border: "1px solid #1d2d4a", borderRadius: 8,
                padding: "8px 12px", color: C.text,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div></div>

        {/* حجم الملصق */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ color: C.muted, fontSize: 12, display: "block", marginBottom: 8 }}>
            حجم ملصق الباركود
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {LABEL_SIZES.map((size) => (
              <button
                key={size.id}
                onClick={() => setSettings((p) => ({ ...p, labelSize: size.id }))}
                style={{
                  padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${settings.labelSize === size.id ? C.accent : C.border}`,
                  background: settings.labelSize === size.id ? C.surface : C.bgAlt,
                  color: settings.labelSize === size.id ? C.accent : C.muted,
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* ✅ هنا كانت المشكلة - </div> ناقصة لإغلاق الـ grid */}
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn icon="check" onClick={save}>حفظ البيانات</Btn>
        </div>

      </div>
    </div>
  );
}
