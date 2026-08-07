import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { queueEvent } from "../lib/offlineAPI";
import { COLORS } from "../theme";
import { Btn } from "../ui/primitives";

export function PharmacySettings({ showToast, pharmacyId }) {
    const [settings, setSettings] = useState({});

    // 🆕 استنساخ الأصناف الأساسية من صيدلية قالب (Template Pharmacy)
    const [templateId, setTemplateId] = useState("");
    const [cloning, setCloning] = useState(false);
    const [confirmClone, setConfirmClone] = useState(false);

    const cloneFromTemplate = async () => {
        if (!templateId.trim()) { showToast("يرجى إدخال معرف صيدلية القالب", "error"); return; }
        if (templateId.trim() === pharmacyId) { showToast("لا يمكن استنساخ الصيدلية من نفسها", "error"); return; }
        setCloning(true);
        const { error } = await supabase.rpc("clone_template_pharmacy", {
            template_id: templateId.trim(),
            new_id: pharmacyId,
        });
        setCloning(false);
        setConfirmClone(false);
        if (error) { showToast("خطأ في الاستنساخ: " + error.message, "error"); return; }
        showToast("تم استنساخ بيانات القالب بنجاح ✓ يُفضّل إعادة تحميل الصفحة لتظهر الأصناف الجديدة");
    };

    useEffect(() => {
        if (!pharmacyId) return;

        // 🆕 fallback أوفلاين: بنقرا النسخة المحفوظة محليًا فورًا (لو موجودة) عشان الفورم
        // ميفضلش فاضي وقت التحميل، وبرضه يبقى عندنا نسخة جاهزة نرجعلها لو الـ fetch فشل تحت.
        let cachedSettings = null;
        try {
            const raw = localStorage.getItem("pharmacy_settings");
            if (raw) {
                cachedSettings = JSON.parse(raw);
                setSettings(cachedSettings);
            }
        } catch (err) {
            console.error("failed to read cached pharmacy_settings:", err);
        }

        supabase
            .from("pharmacy_settings")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    // 🆕 فشل التحميل (غالبًا أوفلاين) — منمسحش الفورم؛ لو عندنا نسخة كاش
                    // فضّلناها فوق، وإلا بيفضل زي ما هو ({}) بدل ما نكتب فوقه بحاجة فاضية.
                    console.error("failed to load pharmacy_settings, keeping cached/local state:", error);
                    if (cachedSettings) {
                        showToast("⚠️ لا يوجد اتصال — تم عرض آخر نسخة محفوظة محليًا من بيانات الصيدلية", "warning");
                    }
                    return;
                }
                if (data) {
                    const fresh = {
                        nameAr: data.name_ar || data.name || "",
                        nameEn: data.name_en || "",
                        phone: data.phone || "",
                        address: data.address || "",
                        vatNumber: data.tax_number || "",
                        licenseNumber: data.license_number || "",
                        labelSize: data.label_size || "50x30",
                        labelDpi: data.label_dpi || "203",
                        barcodeMarginMm: data.barcode_margin_mm ?? 2.5,
                        receiptPaperWidth: data.receipt_paper_width || "80",
                        supportsCardRefund: !!data.supports_card_refund, // 🆕 هل الصيدلية بتقدر ترجّع فلوس شبكة (reversal) فعليًا؟
                    };
                    setSettings(fresh);
                    // 🆕 نحدّث الكاش المحلي بأحدث نسخة من السيرفر كل ما التحميل ينجح،
                    // عشان يفضل مطابق للحقيقي وقت الاستخدام أوفلاين لاحقًا.
                    try {
                        localStorage.setItem("pharmacy_settings", JSON.stringify(fresh));
                    } catch (err) {
                        console.error("failed to cache pharmacy_settings:", err);
                    }
                }
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
        { id: "25x50", label: "25×50 mm (المقاس الفعلي)", w: 25, h: 50 },
        { id: "40x25", label: "40×25 mm (صغير)", w: 40, h: 25 },
        { id: "50x30", label: "50×30 mm (متوسط)", w: 50, h: 30 },
        { id: "58x40", label: "58×40 mm (كبير)", w: 58, h: 40 },
        { id: "60x40", label: "60×40 mm (كبير)", w: 60, h: 40 },
        { id: "76x51", label: "76×51 mm (Zebra 3×2 بوصة)", w: 76.2, h: 50.8 },
    ];

    const PRINTER_DPIS = [
        { id: "203", label: "203 dpi (الأكثر شيوعًا - Zebra GK420t وغيرها)" },
        { id: "300", label: "300 dpi (طابعات دقة أعلى)" },
    ];

    const RECEIPT_WIDTHS = [
        { id: "58", label: "58 مم (طابعة فيش صغيرة)" },
        { id: "80", label: "80 مم (طابعة فيش عادية)" },
        { id: "A4", label: "A4 (طابعة عادية / ليزر)" },
    ];

    // 🆕 تحويل الحفظ لنمط queueEvent: يكتب على الكاش المحلي فورًا (optimistic،
    // بغض النظر عن حالة الاتصال) ثم يبعت PHARMACY_SETTINGS_UPDATE — أونلاين هيتنفذ
    // فورًا، وأوفلاين هيتخزن في طابور SQLite ويتزامن تلقائيًا لما النت يرجع، بدل
    // ما التعديل يضيع زي ما كان بيحصل مع الـ update المباشر.
    const save = async () => {
        if (!pharmacyId) return;

        const updates = {
            name_ar: settings.nameAr,
            name_en: settings.nameEn,
            phone: settings.phone,
            address: settings.address,
            tax_number: settings.vatNumber,
            license_number: settings.licenseNumber,
            updated_at: new Date().toISOString(),
            label_size: settings.labelSize || "50x30",
            label_dpi: settings.labelDpi || "203",
            barcode_margin_mm: settings.barcodeMarginMm != null ? Number(settings.barcodeMarginMm) : 2.5,
            receipt_paper_width: settings.receiptPaperWidth || "80",
            supports_card_refund: !!settings.supportsCardRefund, // 🆕
        };

        // نحدّث الكاش المحلي فورًا (نفس شكل الفورم عشان أي قراءة تالية أوفلاين تلاقيه جاهز)
        try {
            localStorage.setItem("pharmacy_settings", JSON.stringify(settings));
        } catch (err) {
            console.error("failed to cache pharmacy_settings on save:", err);
        }

        const result = await queueEvent({
            id: crypto.randomUUID(),
            type: "PHARMACY_SETTINGS_UPDATE",
            timestamp: new Date().toISOString(),
            pharmacy_id: pharmacyId, // top-level — لازم لـ SQLite NOT NULL (نفس النمط المتكرر في كل الأحداث التانية)
            payload: { pharmacy_id: pharmacyId, updates },
        });

        if (result.synced) {
            showToast("تم حفظ بيانات الصيدلية ✓");
        } else if (result.error) {
            showToast("خطأ في الحفظ: " + result.error, "error");
        } else {
            showToast("⚠️ لا يوجد اتصال — سيتم حفظ بيانات الصيدلية تلقائيًا عند عودة النت");
        }
    };
    return (
        <div>
            <h2 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800 }}>
                بيانات الصيدلية
            </h2>
            <div style={{
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${COLORS.border}`,
                borderRadius: 16, padding: 24,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
            }}>
                {fields.map(({ key, label }) => (
                    <div key={key}>
                        <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                            {label}
                        </label>
                        <input
                            value={settings[key] || ""}
                            onChange={(e) => setSettings((p) => ({ ...p, [key]: e.target.value }))}
                            style={{
                                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                border: `1px solid ${COLORS.border}`, borderRadius: 8,
                                padding: "8px 12px", color: COLORS.textPrimary,
                                fontSize: 13, outline: "none", boxSizing: "border-box",
                            }}
                        />
                    </div>
                ))}

                <div></div>

                {/* حجم الملصق */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
                        حجم ملصق الباركود
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {LABEL_SIZES.map((size) => (
                            <button
                                key={size.id}
                                onClick={() => setSettings((p) => ({ ...p, labelSize: size.id }))}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                    border: `2px solid ${settings.labelSize === size.id ? COLORS.blue : COLORS.border}`,
                                    background: settings.labelSize === size.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                                    color: settings.labelSize === size.id ? COLORS.blue : COLORS.textDim,
                                    fontSize: 13, fontWeight: 600,
                                }}
                            >
                                {size.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* دقة الطابعة الحرارية (DPI) - مهم لو الطابعة نوع تاني غير الافتراضي */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
                        دقة طابعة الباركود (DPI)
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {PRINTER_DPIS.map((d) => (
                            <button
                                key={d.id}
                                onClick={() => setSettings((p) => ({ ...p, labelDpi: d.id }))}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                    border: `2px solid ${(settings.labelDpi || "203") === d.id ? COLORS.blue : COLORS.border}`,
                                    background: (settings.labelDpi || "203") === d.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                                    color: (settings.labelDpi || "203") === d.id ? COLORS.blue : COLORS.textDim,
                                    fontSize: 13, fontWeight: 600,
                                }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* هامش الباركود الجانبي - لو الباركود بيلزق في حواف الملصق زوّد الرقم ده */}
                <div>
                    <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                        هامش الباركود الجانبي (مم)
                    </label>
                    <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={settings.barcodeMarginMm ?? 2.5}
                        onChange={(e) => setSettings((p) => ({ ...p, barcodeMarginMm: e.target.value }))}
                        style={{
                            width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            border: `1px solid ${COLORS.border}`, borderRadius: 8,
                            padding: "8px 12px", color: COLORS.textPrimary,
                            fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                    />
                </div>

                {/* حجم ورق فاتورة نقطة البيع */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
                        نوع طابعة فواتير المبيعات
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {RECEIPT_WIDTHS.map((w) => (
                            <button
                                key={w.id}
                                onClick={() => setSettings((p) => ({ ...p, receiptPaperWidth: w.id }))}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                    border: `2px solid ${(settings.receiptPaperWidth || "80") === w.id ? COLORS.blue : COLORS.border}`,
                                    background: (settings.receiptPaperWidth || "80") === w.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                                    color: (settings.receiptPaperWidth || "80") === w.id ? COLORS.blue : COLORS.textDim,
                                    fontSize: 13, fontWeight: 600,
                                }}
                            >
                                {w.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🆕 دعم رجاعة الشبكة في المرتجعات */}
                <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
                        رجاعة الشبكة في المرتجعات
                    </label>
                    <div
                        onClick={() => setSettings((p) => ({ ...p, supportsCardRefund: !p.supportsCardRefund }))}
                        style={{
                            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                            padding: "10px 14px", borderRadius: 8,
                            border: `2px solid ${settings.supportsCardRefund ? COLORS.blue : COLORS.border}`,
                            background: settings.supportsCardRefund ? COLORS.blueSoft : COLORS.surfaceAlt,
                            maxWidth: 420,
                        }}
                    >
                        <div style={{
                            width: 40, height: 22, borderRadius: 12, position: "relative", flexShrink: 0,
                            background: settings.supportsCardRefund ? COLORS.blue : COLORS.border,
                            transition: "background .15s",
                        }}>
                            <div style={{
                                width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2,
                                right: settings.supportsCardRefund ? 20 : 2, transition: "right .15s",
                            }} />
                        </div>
                        <span style={{ color: settings.supportsCardRefund ? COLORS.blue : COLORS.textDim, fontSize: 13, fontWeight: 600 }}>
                            {settings.supportsCardRefund
                                ? "مفعّل — سيظهر خيار (كاش/شبكة) عند تسجيل مرتجع مبيعات دفعته الأصلي شبكة"
                                : "غير مفعّل — كل مرتجع يُعتبر كاش دايمًا (الوضع الافتراضي)"}
                        </span>
                    </div>
                </div>

                {/* ✅ هنا كانت المشكلة - </div> ناقصة لإغلاق الـ grid */}
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <Btn icon="check" onClick={save}>حفظ البيانات</Btn>
                </div>

            </div>

            {/* 🆕 استنساخ الأصناف من صيدلية قالب — لصيدلية جديدة فاضية بس */}
            <div style={{
                background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, marginTop: 20,
            }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: COLORS.textPrimary }}>
                    🧬 استنساخ أصناف من قالب
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 12.5, color: COLORS.textDim, lineHeight: 1.7 }}>
                    بينسخ الشركات المصنّعة والمواد الفعالة والأصناف من صيدلية قالب لصيدليتك الحالية (المخزون هيبدأ بصفر).
                    استخدمه مرة واحدة بس عند تجهيز صيدلية جديدة فاضية — لو نفّذته أكتر من مرة، الأصناف هتتكرر.
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <label style={{ color: COLORS.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>
                            معرف صيدلية القالب (pharmacy_id)
                        </label>
                        <input
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                            placeholder="مثال: 8f0c1a2e-..."
                            style={{
                                width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                                border: `1px solid ${COLORS.border}`, borderRadius: 8,
                                padding: "8px 12px", color: COLORS.textPrimary,
                                fontSize: 13, outline: "none", boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {!confirmClone ? (
                        <Btn icon="upload" onClick={() => setConfirmClone(true)} disabled={!templateId.trim()}>
                            استنساخ من القالب
                        </Btn>
                    ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                            <Btn icon="check" onClick={cloneFromTemplate} disabled={cloning}>
                                {cloning ? "جارٍ الاستنساخ..." : "تأكيد الاستنساخ"}
                            </Btn>
                            <button
                                onClick={() => setConfirmClone(false)}
                                disabled={cloning}
                                style={{
                                    padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                                    border: `1px solid ${COLORS.border}`, background: "transparent",
                                    color: COLORS.textDim, fontSize: 13, fontWeight: 600,
                                }}
                            >
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>

                {confirmClone && (
                    <p style={{ margin: "12px 0 0", fontSize: 12.5, color: COLORS.red, fontWeight: 600 }}>
                        ⚠️ هيتم إضافة كل أصناف القالب لصيدليتك دلوقتي. متأكد إنك مش عامل الاستنساخ ده قبل كده لنفس الصيدلية؟
                    </p>
                )}
            </div>
        </div>
    );
}
