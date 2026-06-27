export const Login = ({ users, onLogin }) => {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const go = async () => {
    setErr("");
    try {
      await onLogin(u, p);
    } catch (e) {
      setErr(e.message || "اسم المستخدم أو كلمة المرور غير صحيحة");
    }
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#060c16",
        fontFamily: "'Tajawal',sans-serif",
      }}
      dir="rtl"
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: "#0f1623",
          border: "1px solid #1d2d4a",
          borderRadius: 20,
          padding: 40,
          width: 380,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "#8ab0ff",
            }}
          >
            <IC n="pill" s={32} />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: "#dde8ff",
            }}
          >
            صيدلية برو
          </h1>
          <p style={{ margin: "6px 0 0", color: "#3a5a8a", fontSize: 13 }}>
            نظام إدارة صيدلية متكامل
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label="اسم المستخدم"
            value={u}
            onChange={setU}
            placeholder="أدخل اسم المستخدم"
          />
          <Input
            label="كلمة المرور"
            value={p}
            onChange={setP}
            type="password"
            placeholder="أدخل كلمة المرور"
          />
          {err && (
            <div
              style={{ color: "#ff7777", fontSize: 13, textAlign: "center" }}
            >
              {err}
            </div>
          )}
          <Btn
            size="lg"
            onClick={go}
            style={{ marginTop: 4, justifyContent: "center" }}
          >
            دخول النظام
          </Btn>
        </div>
        <p
          style={{
            textAlign: "center",
            color: "#2a4a6a",
            fontSize: 11,
            marginTop: 20,
          }}
        >
          admin/admin123 — ahmed/123456
        </p>
      </div>
    </div>
  );
};
// ==================== RASSD SERVICE ====================

const RasdService = {
  baseUrl: "https://rsd.sfda.gov.sa/api", // غير للـ URL الصح من رصد
  token: null,

  // تسجيل الدخول والحصول على token
  async login(username, password) {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      this.token = data.token;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // إرسال حركة لرصد
  async sendTransaction(type, items, glnFrom, glnTo) {
    // type: "receipt" | "dispense" | "return"
    try {
      if (!this.token) {
        const cfg = JSON.parse(localStorage.getItem("rasd_config") || "{}");
        this.token = cfg.token;
      }
      const payload = {
        transactionType: type,
        fromGLN: glnFrom,
        toGLN: glnTo,
        date: new Date().toISOString(),
        items: items.map((i) => ({
          gtin: i.gtin,
          serial: i.serial,
          batch: i.batch,
          expiry: i.expiry,
          qty: i.qty,
        })),
      };

      const res = await fetch(`${this.baseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { success: res.ok, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // التحقق من صلاحية الدواء
  async verifyProduct(gtin, serial) {
    try {
      const res = await fetch(
        `${this.baseUrl}/products/verify?gtin=${gtin}&serial=${serial}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );
      const data = await res.json();
      return { success: res.ok, data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
// ==================== RASSD BARCODE PARSER ====================

