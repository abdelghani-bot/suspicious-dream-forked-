import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { RasdQueue, RasdService } from "../services/rasdService";
import { RasdItemsEditor, RasdItemsEditorBatch, rasdCellStyle } from "../ui/RasdItemsEditor";
import { Btn, Input, Modal, Select } from "../ui/primitives";

// ==================== RASSD SETTINGS ====================
export function RasdSettings({ showToast, products, pharmacyId }) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem("rasd_config");
    return saved
      ? JSON.parse(saved)
      : {
          enabled: false,
          gln: "",
          username: "",
          password: "",
          apiUrl: "", // مثال متوقع: https://rsd.sfda.gov.sa/ws — يحدده SFDA
          uploadIntervalMinutes: 10,
        };
  });
  // 🆕 لو فيه نسخة أحدث محفوظة في السوبابيز (اتعدّلت من جهاز تاني مثلًا)، هات أحدث نسخة
  // بمجرد ما الشاشة تفتح، عشان الأدمن دايمًا يشوف آخر إعداد حقيقي مش نسخة محلية قديمة.
  useEffect(() => {
    if (!pharmacyId) return;
    supabase.from("pharmacy_settings").select("rasd_config").eq("pharmacy_id", pharmacyId).maybeSingle()
      .then(({ data }) => {
        if (data?.rasd_config) {
          setConfig(data.rasd_config);
          localStorage.setItem("rasd_config", JSON.stringify(data.rasd_config));
        }
      });
  }, [pharmacyId]);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ pending: 0, failed: 0 });
  const [flushing, setFlushing] = useState(false);

  // ===== أدوات رصد إضافية: Deactivate / Transfer / PTS =====
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateMode, setDeactivateMode] = useState("out"); // "out" | "cancel"
  const [deactivateItems, setDeactivateItems] = useState([]);
  const [deactivateDr, setDeactivateDr] = useState("30");
  const [deactivateExplanation, setDeactivateExplanation] = useState("");
  const [deactivateBusy, setDeactivateBusy] = useState(false);


  const [showPts, setShowPts] = useState(false);
  const [ptsTab, setPtsTab] = useState("upload"); // "upload" | "download" | "query"
  const [ptsToGln, setPtsToGln] = useState("");
  const [ptsFile, setPtsFile] = useState(null); // { name, base64 }
  const [ptsUploadResult, setPtsUploadResult] = useState(null);
  const [ptsTransferId, setPtsTransferId] = useState("");
  const [ptsDownloadResult, setPtsDownloadResult] = useState(null);
  const [ptsFromGln, setPtsFromGln] = useState("");
  const [ptsQueryToGln, setPtsQueryToGln] = useState("");
  const [ptsGetAll, setPtsGetAll] = useState(false);
  const [ptsTransfers, setPtsTransfers] = useState(null);
  const [ptsBusy, setPtsBusy] = useState(false);

  // ===== عمليات "برقم التشغيلة" (By Batch): قبول / إرجاع / نقل / إلغاء نقل =====
  const [showReturnBatch, setShowReturnBatch] = useState(false);
  const [returnBatchToGln, setReturnBatchToGln] = useState("");
  const [returnBatchItems, setReturnBatchItems] = useState([]);
  const [returnBatchBusy, setReturnBatchBusy] = useState(false);
  const [recallQuery, setRecallQuery] = useState("");
  const [recallResults, setRecallResults] = useState(null);

  // 🔍 بحث عن رقم تشغيلة معين (Recall) في مخزون كل الأصناف — بيرجع كل الأصناف اللي
  // عندها تشغيلة برقم مطابق (تطابق جزئي كمان) عشان تقدر تجمعها بسرعة وترجعها للشركة.
  const searchRecallBatch = () => {
    const q = recallQuery.trim().toLowerCase();
    if (!q) {
      showToast("اكتب رقم التشغيلة اللي عايز تدور عليه", "error");
      return;
    }
    const found = [];
    (products || []).forEach((p) => {
      (p.batches || []).forEach((b) => {
        if (b.qty > 0 && (b.batch_number || "").toLowerCase().includes(q)) {
          found.push({
            productId: p.id,
            name: p.name_ar || p.name,
            gtin: p.gtin || p.barcode,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date || null,
            qty: b.qty,
          });
        }
      });
    });
    setRecallResults(found);
    if (found.length === 0) showToast("مفيش أي صنف عنده تشغيلة بالرقم ده في المخزون الحالي", "warn");
  };

  // إضافة نتيجة بحث الـ Recall كسطر جاهز في نموذج الإرجاع برقم التشغيلة
  const addRecallResultToReturn = (r) => {
    setReturnBatchItems((prev) => [
      ...prev,
      { gtin: r.gtin || "", quantity: r.qty, batch: r.batch_number || "", expiry: r.expiry_date || "" },
    ]);
    showToast(`أُضيف "${r.name}" (${r.qty}) لنموذج الإرجاع`);
  };

  const ensureRasdReady = () => {
    if (!config.apiUrl) {
      showToast("يرجى ضبط رابط رصد (apiUrl) أولاً واحفظ الإعدادات", "error");
      return false;
    }
    RasdService.configure(config);
    return true;
  };

  const submitReturnBatch = async () => {
    if (returnBatchItems.length === 0) {
      showToast("أضف دفعة واحدة على الأقل", "error");
      return;
    }
    if (!returnBatchToGln.trim()) {
      showToast("أدخل GLN الجهة المرتجع لها", "error");
      return;
    }
    if (!ensureRasdReady()) return;
    setReturnBatchBusy(true);
    // بنستخدم عملية Return الحقيقية (ReturnServiceRequest) نفسها، بس العناصر هنا بشكل
    // "دفعة كاملة" (quantity بدل serial) — العملية دي بتقبل الشكلين لأن الـ PRODUCT
    // object نفسه بنفس البنية الثابتة في كل خدمات رصد حسب DTTS-DEF.
    const result = await RasdService.notifyReturn({ toGln: returnBatchToGln.trim(), items: returnBatchItems });
    setReturnBatchBusy(false);
    if (result.success) {
      showToast("تم الإرجاع برقم التشغيلة في رصد ✓");
      setShowReturnBatch(false);
      setReturnBatchItems([]);
      setReturnBatchToGln("");
    } else {
      RasdQueue.enqueue("return", { toGln: returnBatchToGln.trim(), items: returnBatchItems });
      showToast("تعذر الإرجاع الفوري — تم حفظها للمحاولة تلقائيًا لاحقًا: " + result.error, "error");
      setShowReturnBatch(false);
      setReturnBatchItems([]);
      setReturnBatchToGln("");
    }
  };

  const submitDeactivate = async () => {
    if (deactivateItems.length === 0) {
      showToast("أضف صنف واحد على الأقل", "error");
      return;
    }
    if (!ensureRasdReady()) return;
    setDeactivateBusy(true);
    const result =
      deactivateMode === "out"
        ? await RasdService.notifyDeactivate({ dr: deactivateDr, explanation: deactivateExplanation, items: deactivateItems })
        : await RasdService.notifyDeactivateCancel({ items: deactivateItems });
    setDeactivateBusy(false);
    if (result.success) {
      showToast(deactivateMode === "out" ? "تم إخراج الأصناف من رصد ✓" : "تم إلغاء الإخراج ✓");
      setShowDeactivate(false);
      setDeactivateItems([]);
      setDeactivateExplanation("");
    } else {
      showToast("فشلت العملية: " + result.error, "error");
    }
  };

  // ملحوظة: عمليات القبول والنقل/إلغاء النقل (Accept/Transfer/TransferCancel) بتتعمل يدوي
  // من موقع رصد نفسه مش من البرنامج، فمفيش داعي لشاشات/دوال إرسال ليها هنا.

  const handlePtsFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      setPtsFile({ name: file.name, base64 });
    };
    reader.readAsDataURL(file);
  };

  const submitPtsUpload = async () => {
    if (!ptsToGln.trim() || !ptsFile) {
      showToast("أدخل GLN المستلم واختر الملف (zip)", "error");
      return;
    }
    if (!ensureRasdReady()) return;
    setPtsBusy(true);
    const result = await RasdService.ptsUpload({ toGln: ptsToGln.trim(), fileBase64: ptsFile.base64 });
    setPtsBusy(false);
    if (result.success) {
      setPtsUploadResult(result.data);
      showToast("تم رفع الملف ✓");
    } else {
      showToast("فشل الرفع: " + result.error, "error");
    }
  };

  const submitPtsDownload = async () => {
    if (!ptsTransferId.trim()) {
      showToast("أدخل Transfer ID", "error");
      return;
    }
    if (!ensureRasdReady()) return;
    setPtsBusy(true);
    const result = await RasdService.ptsDownload({ transferId: ptsTransferId.trim() });
    setPtsBusy(false);
    if (result.success) {
      setPtsDownloadResult(result.data);
      showToast("تم تنزيل بيانات الملف ✓");
    } else {
      showToast("فشل التنزيل: " + result.error, "error");
    }
  };

  const saveBase64AsFile = (base64, filename) => {
    try {
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("تعذر حفظ الملف محليًا", "error");
    }
  };

  const submitPtsQuery = async () => {
    if (!ensureRasdReady()) return;
    setPtsBusy(true);
    const result = await RasdService.ptsQuery({
      fromGln: ptsFromGln.trim() || undefined,
      toGln: ptsQueryToGln.trim() || undefined,
      getAll: ptsGetAll,
    });
    setPtsBusy(false);
    if (result.success) {
      setPtsTransfers(result.data.transfers || []);
    } else {
      showToast("فشل الاستعلام: " + result.error, "error");
    }
  };

  // تحديث عداد الطابور كل شوية عشان يبان تحديث لحظي
  useEffect(() => {
    const update = () =>
      setQueueStatus({ pending: RasdQueue.pendingCount(), failed: RasdQueue.failedCount() });
    update();
    const t = setInterval(update, 5000);
    return () => clearInterval(t);
  }, []);

  const uploadNow = async () => {
    setFlushing(true);
    RasdService.configure(config);
    await RasdQueue.flush(showToast);
    setQueueStatus({ pending: RasdQueue.pendingCount(), failed: RasdQueue.failedCount() });
    setFlushing(false);
  };

  const save = async () => {
    localStorage.setItem("rasd_config", JSON.stringify(config));
    RasdQueue.stop();
    RasdQueue.start(showToast); // إعادة تشغيل المؤقت بالمدة الجديدة لو اتغيرت
    if (pharmacyId) {
      const { error } = await supabase
        .from("pharmacy_settings")
        .upsert({ pharmacy_id: pharmacyId, rasd_config: config }, { onConflict: "pharmacy_id" });
      if (error) {
        showToast("⚠️ اتحفظ محليًا بس فشل حفظ الإعدادات في قاعدة البيانات: " + error.message, "error");
        return;
      }
    }
    showToast("تم حفظ إعدادات رصد ✓");
  };

  const testConnection = async () => {
    if (!config.username || !config.password || !config.apiUrl) {
      showToast("يرجى إدخال اسم المستخدم وكلمة المرور ورابط الـ API", "error");
      return;
    }
    setTesting(true);
    RasdService.configure(config);
    // رصد SOAP مفيهوش endpoint دخول منفصل، فبنستخدم CheckStatus كاختبار اتصال حقيقي
    const result = await RasdService.checkStatus({
      items: [{ gtin: "00000000000000", serial: "TEST" }],
    });
    setTesting(false);
    // النجاح الحقيقي: لازم يوصل رد XML/SOAP فعلي من رصد (حتى لو Fault زي "منتج غير موجود"
    // أو حتى خطأ auth)، مش مجرد إن الـ fetch "اتبعت من غير Failed to fetch". لو البروكسي
    // نفسه واقع (405/404/502) أو راجع صفحة مش XML، ده لازم يتحسب فشل مش نجاح.
    if (result.success || result.isRealSoapResponse) {
      setConnected(true);
      showToast("الاتصال بسيرفر رصد شغال ✓");
    } else {
      setConnected(false);
      const statusHint = result.httpStatus ? ` (HTTP ${result.httpStatus})` : "";
      showToast("فشل الاتصال: " + result.error + statusHint, "error");
    }
  };

  const Field = ({ label, value, onChange, type = "text", placeholder }) => (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          color: COLORS.textDim,
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
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: "10px 14px",
          color: COLORS.textPrimary,
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
          color: COLORS.textPrimary,
        }}
      >
        إعدادات نظام رصد
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: COLORS.border }}>
        نظام التتبع الإلكتروني للمستحضرات الصيدلانية — هيئة الغذاء والدواء
      </p>

      {/* Status Card */}
      <div
        style={{
          background: config.enabled && connected ? COLORS.greenSoft : COLORS.redSoft,
          border: `1px solid ${
            config.enabled && connected ? COLORS.green : COLORS.gold
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
              background: config.enabled && connected ? COLORS.green : COLORS.gold,
            }}
          />
          <span
            style={{
              color: config.enabled && connected ? COLORS.green : COLORS.gold,
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
            background: config.enabled ? COLORS.blue : COLORS.border,
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
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
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
            color: COLORS.blue,
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
              color: COLORS.textDim,
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
                background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "10px 44px 10px 14px",
                color: COLORS.textPrimary,
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
                color: COLORS.textDim,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {showPassword ? "إخفاء" : "إظهار"}
            </button>
          </div>
        </div>

        <Field
          label="رابط رصد (Base URL بتاع SOAP Web Services — من SFDA)"
          value={config.apiUrl}
          onChange={(v) => setConfig((p) => ({ ...p, apiUrl: v }))}
          placeholder="مثال: https://rsd.sfda.gov.sa/ws"
        />

        <Field
          label="مدة الرفع التلقائي (بالدقايق)"
          value={String(config.uploadIntervalMinutes ?? 10)}
          onChange={(v) => setConfig((p) => ({ ...p, uploadIntervalMinutes: Number(v) || 10 }))}
          type="number"
          placeholder="10"
        />
      </div>

      {/* حالة الطابور */}
      <div
        style={{
          background: COLORS.surfaceAlt,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: COLORS.textDim }}>
          <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{queueStatus.pending}</span>{" "}
          عملية بانتظار الرفع
          {queueStatus.failed > 0 && (
            <>
              {" "}
              — <span style={{ fontWeight: 700, color: COLORS.gold }}>{queueStatus.failed}</span>{" "}
              فشلت نهائيًا (راجعها يدويًا)
            </>
          )}
        </div>
        <Btn onClick={uploadNow} variant="ghost" icon={flushing ? "loading" : "upload"}>
          {flushing ? "جارٍ الرفع..." : "ارفع الآن"}
        </Btn>
      </div>

      {/* أدوات رصد إضافية */}
      <div
        style={{
          background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: COLORS.blue }}>
          أدوات رصد إضافية
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="secondary" icon="x" onClick={() => setShowDeactivate(true)}>
            إخراج / إلغاء إخراج
          </Btn>
          <Btn variant="secondary" icon="upload" onClick={() => setShowPts(true)}>
            PTS رفع/تنزيل/استعلام
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textDim, margin: "16px 0 8px" }}>
          الإرجاع بكمية من دفعة كاملة بدل كل رقم تسلسلي لوحده (القبول والنقل بيتعملوا يدوي من موقع رصد)
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="secondary" icon="check" onClick={() => setShowReturnBatch(true)}>
            الإرجاع برقم التشغيلة
          </Btn>
        </div>
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
          background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${COLORS.border}`,
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
            color: COLORS.gold,
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
              color: COLORS.textDim,
            }}
          >
            <span style={{ color: COLORS.blue, marginTop: 1 }}>•</span>
            {item}
          </div>
        ))}
      </div>

      {/* ===== مودال: إخراج / إلغاء إخراج ===== */}
      {showDeactivate && (
        <Modal
          open
          wide
          onClose={() => setShowDeactivate(false)}
          title="إخراج منتج من رصد (Deactivation)"
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn
              size="sm"
              variant={deactivateMode === "out" ? "primary" : "ghost"}
              onClick={() => setDeactivateMode("out")}
            >
              إخراج جديد
            </Btn>
            <Btn
              size="sm"
              variant={deactivateMode === "cancel" ? "primary" : "ghost"}
              onClick={() => setDeactivateMode("cancel")}
            >
              إلغاء إخراج سابق
            </Btn>
          </div>

          {deactivateMode === "out" && (
            <>
              <Select
                label="سبب الإخراج (DR)"
                value={deactivateDr}
                onChange={setDeactivateDr}
                options={Object.entries(RasdService.DR_REASONS).map(([v, l]) => ({ v, l: `${v} — ${l}` }))}
                style={{ marginBottom: 14 }}
              />
              <Input
                label="توضيح إضافي (اختياري)"
                value={deactivateExplanation}
                onChange={setDeactivateExplanation}
                placeholder="مثال: تلف نتيجة سوء تخزين"
                style={{ marginBottom: 14 }}
              />
            </>
          )}

          <RasdItemsEditor items={deactivateItems} onChange={setDeactivateItems} />

          <Btn
            onClick={submitDeactivate}
            disabled={deactivateBusy}
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            {deactivateBusy
              ? "جارٍ التنفيذ..."
              : deactivateMode === "out"
              ? "تنفيذ الإخراج في رصد"
              : "تنفيذ إلغاء الإخراج"}
          </Btn>
        </Modal>
      )}

      {/* ===== مودال: الإرجاع برقم التشغيلة ===== */}
      {showReturnBatch && (
        <Modal open wide onClose={() => setShowReturnBatch(false)} title="الإرجاع برقم التشغيلة">
          <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14 }}>
            إرجاع كمية من دفعة كاملة للمورد/الجهة دفعة واحدة بدل كل رقم تسلسلي على حدة.
          </div>

          <div
            style={{
              background: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, marginBottom: 8 }}>
              🔍 بحث عن رقم تشغيلة (Recall) في كل المخزون
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={recallQuery}
                onChange={(e) => setRecallQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchRecallBatch()}
                placeholder="رقم التشغيلة المطلوب سحبها/إرجاعها"
                style={{ ...rasdCellStyle, flex: 1 }}
              />
              <Btn size="sm" onClick={searchRecallBatch}>بحث</Btn>
            </div>
            {recallResults && (
              <div style={{ marginTop: 10 }}>
                {recallResults.length === 0 ? (
                  <div style={{ fontSize: 12, color: COLORS.textDim }}>مفيش نتائج</div>
                ) : (
                  recallResults.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 4px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        fontSize: 12,
                      }}
                    >
                      <span>
                        {r.name} — دفعة {r.batch_number} — الكمية بالمخزون: {r.qty}
                        {r.expiry_date ? ` — صلاحية ${r.expiry_date}` : ""}
                      </span>
                      <Btn size="sm" variant="secondary" onClick={() => addRecallResultToReturn(r)}>
                        إضافة للإرجاع
                      </Btn>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <Input
            label="GLN الجهة المرتجع لها"
            value={returnBatchToGln}
            onChange={setReturnBatchToGln}
            placeholder="مثال: 6281234567890"
            style={{ marginBottom: 14 }}
          />
          <RasdItemsEditorBatch items={returnBatchItems} onChange={setReturnBatchItems} />
          <Btn
            onClick={submitReturnBatch}
            disabled={returnBatchBusy}
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            {returnBatchBusy ? "جارٍ التنفيذ..." : "تنفيذ الإرجاع برقم التشغيلة"}
          </Btn>
        </Modal>
      )}

      {/* ===== مودال: PTS رفع/تنزيل/استعلام ===== */}
      {showPts && (
        <Modal
          open
          wide
          onClose={() => setShowPts(false)}
          title="PTS — نقل ملفات مجمّعة (Package Transfer Service)"
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn size="sm" variant={ptsTab === "upload" ? "primary" : "ghost"} onClick={() => setPtsTab("upload")}>
              رفع ملف
            </Btn>
            <Btn size="sm" variant={ptsTab === "download" ? "primary" : "ghost"} onClick={() => setPtsTab("download")}>
              تنزيل ملف
            </Btn>
            <Btn size="sm" variant={ptsTab === "query" ? "primary" : "ghost"} onClick={() => setPtsTab("query")}>
              استعلام
            </Btn>
          </div>

          {ptsTab === "upload" && (
            <div>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 14 }}>
                ارفع ملف zip فيه دفعة بيانات منتجات (GTIN-SN-BN-XD) بدل إرسال كل صنف لوحده — رصد
                هنا ناقل ملفات بس، والتحقق من محتوى الملف مسؤولية الطرفين.
              </div>
              <Input
                label="GLN الجهة المستلمة"
                value={ptsToGln}
                onChange={setPtsToGln}
                placeholder="مثال: 6281234567890"
                style={{ marginBottom: 14 }}
              />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>
                  ملف ZIP
                </label>
                <input type="file" accept=".zip" onChange={handlePtsFilePick} />
                {ptsFile && (
                  <div style={{ fontSize: 12, color: COLORS.green, marginTop: 6 }}>تم اختيار: {ptsFile.name}</div>
                )}
              </div>
              <Btn
                onClick={submitPtsUpload}
                disabled={ptsBusy}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {ptsBusy ? "جارٍ الرفع..." : "رفع الملف"}
              </Btn>
              {ptsUploadResult && (
                <div
                  style={{
                    marginTop: 14,
                    background: COLORS.greenSoft,
                    border: `1px solid ${COLORS.green}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                    color: COLORS.green,
                  }}
                >
                  Transfer ID: {ptsUploadResult.transferId} — MD5: {ptsUploadResult.md5Checksum}
                </div>
              )}
            </div>
          )}

          {ptsTab === "download" && (
            <div>
              <Input
                label="Transfer ID"
                value={ptsTransferId}
                onChange={setPtsTransferId}
                placeholder="مثال: TR-2026-000123"
                style={{ marginBottom: 14 }}
              />
              <Btn
                onClick={submitPtsDownload}
                disabled={ptsBusy}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {ptsBusy ? "جارٍ التنزيل..." : "جلب الملف"}
              </Btn>
              {ptsDownloadResult && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>
                    MD5: {ptsDownloadResult.md5Checksum}
                  </div>
                  <Btn
                    variant="secondary"
                    onClick={() =>
                      saveBase64AsFile(ptsDownloadResult.fileBase64, `rasd_${ptsTransferId.trim()}.zip`)
                    }
                  >
                    حفظ الملف على الجهاز
                  </Btn>
                </div>
              )}
            </div>
          )}

          {ptsTab === "query" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <Input label="من GLN (اختياري)" value={ptsFromGln} onChange={setPtsFromGln} style={{ flex: 1 }} />
                <Input label="إلى GLN (اختياري)" value={ptsQueryToGln} onChange={setPtsQueryToGln} style={{ flex: 1 }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={ptsGetAll} onChange={(e) => setPtsGetAll(e.target.checked)} />
                عرض كل الملفات (شاملة اللي اتنزلت قبل كده)
              </label>
              <Btn
                onClick={submitPtsQuery}
                disabled={ptsBusy}
                style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
              >
                {ptsBusy ? "جارٍ الاستعلام..." : "بحث"}
              </Btn>
              {ptsTransfers && (
                <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                  {ptsTransfers.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12, color: COLORS.textDim }}>لا يوجد ملفات مطابقة</div>
                  )}
                  {ptsTransfers.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderBottom: i < ptsTransfers.length - 1 ? `1px solid ${COLORS.border}` : "none",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>{t.transferId}</div>
                        <div style={{ color: COLORS.textDim }}>
                          من {t.sender} إلى {t.receiver} — {t.sendDate}
                        </div>
                      </div>
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPtsTransferId(t.transferId);
                          setPtsTab("download");
                        }}
                      >
                        تنزيل
                      </Btn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
