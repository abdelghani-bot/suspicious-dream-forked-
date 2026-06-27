export function RasdSettings({
  const { C } = useTheme(); showToast }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("rasd_config");
    return saved
      ? JSON.parse(saved)
      : {
          enabled: false,
          gln: "",
          username: "",
          password: "",
          apiUrl: "https://rsd.sfda.gov.sa/api",
        };
  });
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const save = () => {
    // احفظ التوكن الحالي مع الإعدادات
    const configToSave = {
      ...config,
      token: RasdService.token || null,
    };
    localStorage.setItem("rasd_config", JSON.stringify(configToSave));
    showToast("تم حفظ إعدادات رصد ✓");
  };

  const testConnection = async () => {
    if (!config.username || !config.password) {
      showToast("يرجى إدخال اسم المستخدم وكلمة المرور", "error");
      return;
    }
    setTesting(true);
    RasdService.baseUrl = config.apiUrl;
    const result = await RasdService.login(config.username, config.password);
    setTesting(false);
    if (result.success) {
      setConnected(true);
      // احفظ التوكن في config
      setConfig((p) => ({ ...p, token: RasdService.token }));
      showToast("تم الاتصال برصد بنجاح ✓");
    } else {
      setConnected(false);
      showToast("فشل الاتصال: " + result.error, "error");
    }
  };

  const Field = ({ label, value, onChange, type = "text", placeholder }) => (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: C.muted,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: C.bgAlt,
          border: "1px solid #1d2d4a",
          borderRadius: 8,
          padding: "10px 14px",
          color: C.text,
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  return (
    <div>
      <h2
        style={{
          margin: "0 0 6px",
          fontSize: 20,
          fontWeight: 800,
          color: C.text,
        }}
      >
        إعدادات نظام رصد
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>
        نظام التتبع الإلكتروني للمستحضرات الصيدلانية — هيئة الغذاء والدواء
      </p>

      {/* Status Card */}
      <div
        style={{
          background: config.enabled && connected ? "#0a2010" : "#1a0a00",
          border: `1px solid ${
            config.enabled && connected ? "#1a5020" : "#4a2a00"
          }`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: config.enabled && connected ? C.success : C.warning,
            }}
          />
          <span
            style={{
              color: config.enabled && connected ? C.success : C.warning,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {config.enabled && connected
              ? "رصد مفعّل ومتصل"
              : config.enabled
              ? "مفعّل — غير متصل"
              : "رصد غير مفعّل"}
          </span>
        </div>
        {/* Toggle */}
        <div
          onClick={() => setConfig((p) => ({ ...p, enabled: !p.enabled }))}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            background: config.enabled ? C.accent : C.border,
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              right: config.enabled ? 3 : 22,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "right 0.2s",
            }}
          />
        </div>
      </div>

      {/* Form */}
      <div
        style={{
          background: C.surface,
          border: "1px solid #1d2d4a",
          borderRadius: 14,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            margin: "0 0 20px",
            fontSize: 14,
            fontWeight: 700,
            color: C.accent,
          }}
        >
          بيانات الصيدلية
        </h3>

        <Field
          label="رقم GLN (Global Location Number)"
          value={config.gln}
          onChange={(v) => setConfig((p) => ({ ...p, gln: v }))}
          placeholder="مثال: 6281234567890"
        />

        <Field
          label="اسم المستخدم في رصد"
          value={config.username}
          onChange={(v) => setConfig((p) => ({ ...p, username: v }))}
          placeholder="اسم المستخدم"
        />

        <div style={{ marginBottom: 16, position: "relative" }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: C.muted,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            كلمة المرور
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={config.password}
              onChange={(e) =>
                setConfig((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="كلمة المرور"
              style={{
                width: "100%",
                background: C.bgAlt,
                border: "1px solid #1d2d4a",
                borderRadius: 8,
                padding: "10px 44px 10px 14px",
                color: C.text,
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setShowPassword((p) => !p)}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: C.muted,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </div>

        <Field
          label="رابط الـ API"
          value={config.apiUrl}
          onChange={(v) => setConfig((p) => ({ ...p, apiUrl: v }))}
          placeholder="https://rsd.sfda.gov.sa/api"
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <Btn
          onClick={testConnection}
          variant="ghost"
          icon={testing ? "loading" : "check"}
          style={{ flex: 1 }}
        >
          {testing ? "جارٍ الاختبار..." : "اختبار الاتصال"}
        </Btn>
        <Btn onClick={save} icon="check" style={{ flex: 1 }}>
          حفظ الإعدادات
        </Btn>
      </div>

      {/* Instructions */}
      <div
        style={{
          background: C.bgAlt,
          border: "1px solid #1d2d4a",
          borderRadius: 12,
          padding: 16,
          marginTop: 20,
        }}
      >
        <h4
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: C.warning,
          }}
        >
          ⚠️ متطلبات التفعيل
        </h4>
        {[
          "التسجيل في بوابة رصد على rsd.sfda.gov.sa",
          "الحصول على رقم GLN من GS1 السعودية",
          "ماسح ضوئي يقرأ الباركود ثنائي الأبعاد (2D DataMatrix)",
          "التأكد من أن جميع المنتجات لها GTIN مسجل في رصد",
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginBottom: 8,
              fontSize: 12,
              color: C.muted,
            }}
          >
            <span style={{ color: C.accent, marginTop: 1 }}>•</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
// ======================== Expiry Report ==========================
