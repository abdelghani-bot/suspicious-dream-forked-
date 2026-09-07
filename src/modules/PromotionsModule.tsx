import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
    savePromotions, updatePromotion, deletePromotion,
    replacePromoRules, logPromoPrint, savePromoSettings,
} from "../lib/offlineAPI";
import { COLORS, tint } from "../theme";
import { todayLocal } from "../lib/dateUtils";
import { DEFAULT_AUTO_PROMO_CONFIG, PROMO_TYPES, blankPromoDetails, computeAutoPromoForProduct, computePromoElasticity, describePromo, detectSupplierOfferPattern, getPromoMinRequiredQty, getPromoTypeConfig, isPromoFulfillable } from "../lib/promoUtils";
import { openWhatsApp } from "../lib/whatsapp";
import { trendConfig, vipConfig } from "./CustomersModule";
import { Badge, Btn, Input, Modal, Table } from "../ui/primitives";
import { printHTML } from "../lib/printHelper";

// ==================== بناء HTML ملصقات الرفوف (منفصلة عشان تتستخدم في المعاينة والطباعة الفعلية) ====================
function buildShelfLabelHtml(items, offerName, columns = 2) {
    const labelsHTML = items.map((item) => {
        const priceUnchanged = Math.abs((item.discountedPrice ?? 0) - (item.originalPrice ?? 0)) < 0.001;
        const badgeHTML = !priceUnchanged
            ? `<div class="discount-badge">خصم ${item.discount}%</div>`
            : `<div class="discount-badge promo-text">${item.promoLabel || "عرض خاص"}</div>`;
        const hasDeal = item.dealTotal != null && item.dealQty > 1;
        const pricesHTML = !priceUnchanged
            ? `<div class="prices">
            <div class="old-price-box">
              <div class="old-price-label">السعر قبل</div>
              <div class="old-price">${item.originalPrice.toFixed(2)}</div>
            </div>
            <div class="arrow">◄</div>
            <div class="new-price-box">
              <div class="new-price-label">السعر بعد</div>
              <div class="new-price">${item.discountedPrice.toFixed(2)}</div>
            </div>
          </div>`
            : hasDeal
            ? `<div class="prices">
            <div class="single-price-box">
              <div class="old-price-label">السعر لـ ${item.dealQty} قطع</div>
              <div class="new-price">${item.dealTotal.toFixed(2)}</div>
            </div>
          </div>`
            : `<div class="prices">
            <div class="single-price-box">
              <div class="old-price-label">السعر</div>
              <div class="new-price">${item.originalPrice.toFixed(2)}</div>
            </div>
          </div>`;
        return `
      <div class="label">
        ${offerName ? `<div class="offer-name">${offerName}</div>` : ""}
        <div class="product-name">${item.name}</div>
        ${badgeHTML}
        ${pricesHTML}
        ${item.endDate ? `<div class="end-date">ينتهي العرض: ${item.endDate}</div>` : ""}
      </div>
    `;
    }).join("");

    return `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8"/>
        <title>Shelf Labels</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
          .page {
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            gap: 8mm;
            padding: 10mm;
            width: 210mm;
          }
          .label {
            background: transparent;
            border: 3px solid #e6b800;
            border-radius: 12px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-height: ${Math.round(220 / columns)}mm;
            justify-content: center;
          }
          .offer-name { font-size: 15px; color: #7a6000; font-weight: 900; letter-spacing: 0.5px; background: transparent; border: 1px dashed #cc9900; border-radius: 8px; padding: 3px 12px; text-align: center; }
          .product-name { font-size: 18px; font-weight: 900; color: #1a1a00; text-align: center; line-height: 1.3; }
          .discount-badge { background: #cc0000; color: #fff; font-size: 20px; font-weight: 900; padding: 4px 20px; border-radius: 20px; }
          .discount-badge.promo-text { font-size: 14px; padding: 6px 14px; text-align: center; line-height: 1.3; max-width: 90%; }
          .prices { display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; margin-top: 4px; }
          .single-price-box { background: #1a5c00; border-radius: 10px; padding: 10px 20px; text-align: center; }
          .old-price-box { background: #cc0000; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .old-price-label { color: #ffaaaa; font-size: 11px; margin-bottom: 2px; }
          .old-price { color: #fff; font-size: 22px; font-weight: 900; text-decoration: line-through; text-decoration-color: #ffaaaa; text-decoration-thickness: 3px; }
          .arrow { color: #7a6000; font-size: 22px; }
          .new-price-box { background: #1a5c00; border-radius: 10px; padding: 10px 14px; text-align: center; flex: 1; }
          .new-price-label { color: #aaffaa; font-size: 11px; margin-bottom: 2px; }
          .new-price { color: #fff; font-size: 28px; font-weight: 900; }
          .end-date { font-size: 12px; color: #5a4400; background: #fff3; padding: 3px 10px; border-radius: 6px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="page">${labelsHTML}</div>
      </body>
      </html>
    `;
}

// 🆕 promos/discountRules/autoPromoConfig بقوا جايين كـ props من App (نفس الحالة اللي نقطة البيع
// posPromos/posDiscountRules/posAutoPromoConfig بتقرا منها) — عشان أي إضافة/تعديل/حذف هنا يظهر فورًا
// في نقطة البيع من غير ما تحتاج تعمل ريفريش للصفحة، ويبقى السعر المطبّق هو نفسه المعروض هنا بالظبط.
export function PromotionsModule({
    products, setProducts, sales, purchases, shifts, currentUser, pharmacyId, showToast, enrichedCustomers = [],
    promos, setPromos,
    discountRules, setDiscountRules,
    autoPromoConfig, setAutoPromoConfig,
    canAdd = true, canEdit = true, canDelete = true,
}) {
    const [activeTab, setActiveTab] = useState("auto"); // auto | manual
    const [showPromoForm, setShowPromoForm] = useState(false);
    const [editPromoId, setEditPromoId] = useState(null);
    const [showRulesEditor, setShowRulesEditor] = useState(false);
    const [promoSearch, setPromoSearch] = useState("");
    const [productPickerSearch, setProductPickerSearch] = useState("");

    // ── الشركات المنتجة ──
    const [manufacturers, setManufacturers] = useState([]);

    const DEFAULT_RULES = [
        { days: 90, discount: 50, color: COLORS.red },
        { days: 120, discount: 25, color: COLORS.coral },
        { days: 150, discount: 20, color: COLORS.gold },
        { days: 180, discount: 15, color: COLORS.gold },
    ];
    const [editRules, setEditRules] = useState(DEFAULT_RULES);

    const [showAutoConfig, setShowAutoConfig] = useState(false);
    // 🆕 autoPromoConfig بقى جاي من App (مشترك بين هنا وبين نقطة البيع) — القيمة الافتراضية DEFAULT_AUTO_PROMO_CONFIG أعلى الملف

    const blankPromo = {
        promo_type: "percent",
        product_id: "",
        manufacturer_id: "",
        ...blankPromoDetails,
        start_date: todayLocal(),
        end_date: "",
        note: "",
        offer_name: "", // ← اسم/مناسبة العرض (عروض العيد، اليوم الوطني، رمضان...) يظهر في الطباعة
    };
    const [promoForm, setPromoForm] = useState(blankPromo);
    // وضع الإضافة: صنف واحد أو منتجات شركة كاملة
    const [promoMode, setPromoMode] = useState("single"); // single | company
    const [companyProductIds, setCompanyProductIds] = useState<string[]>([]); // المنتجات المحددة من الشركة
    const [selectedBrand, setSelectedBrand] = useState("");
    const [brandProductIds, setBrandProductIds] = useState/** @type {string[]} */([]);

    // ── سجل الطباعة — عشان تقدر تعيد طباعة أي عرض (تلقائي أو يدوي) لاحقًا ──
    const [printHistory, setPrintHistory] = useState<any[]>([]);
    const [labelPreview, setLabelPreview] = useState<{ items: any[]; offerName?: string; columns: number } | null>(null);
    const [autoOfferName, setAutoOfferName] = useState(""); // اسم/مناسبة العرض التلقائي قبل الطباعة
    const [selectedAutoIds, setSelectedAutoIds] = useState<string[]>([]); // الأصناف المختارة من التلقائي للطباعة

    const today = todayLocal();

    // ── دالة حفظ autoPromoConfig في Supabase ──
    const saveAutoConfig = async (newConfig) => {
        await savePromoSettings({ auto_config: newConfig, updated_at: new Date().toISOString() }, pharmacyId);
    };
     const approveAutoPromo = (productId) => {
    const updated = { ...autoPromoConfig, approvedProductIds: [...(autoPromoConfig.approvedProductIds || []), productId] };
    setAutoPromoConfig(updated);
    saveAutoConfig(updated);
    showToast("تم اعتماد العرض ✓");
};

const stopAutoPromo = (productId) => {
    const updated = { ...autoPromoConfig, approvedProductIds: (autoPromoConfig.approvedProductIds || []).filter((id) => id !== productId) };
    setAutoPromoConfig(updated);
    saveAutoConfig(updated);
    showToast("تم إيقاف العرض");
};
    // تحميل البيانات
    useEffect(() => {
        if (!pharmacyId) return;
        // 🆕 promos/discountRules/autoPromoConfig بقوا مسؤولية App.tsx وحده (posPromos وغيرها) —
        // شيلنا التكرار من هنا عشان منعملش نفس الاستعلام مرتين ومنفوّتش أي offline fallback.
        // فاضل هنا بس manufacturers (كاش مشترك مع TargetModule) و promo_print_log (سجل محلي للموديول ده فقط)
        Promise.all([
            supabase.from("manufacturers").select("id, name").eq("pharmacy_id", pharmacyId).order("name"),
            supabase.from("promo_print_log")
                .select("*")
                .eq("pharmacy_id", pharmacyId)
                .order("created_at", { ascending: false })
                .limit(100),
        ]).then(async ([m, pl]) => {
            if (!m.error && m.data) {
                setManufacturers(m.data);
                try { await window.offlineAPI?.refreshManufacturersCache?.({ pharmacyId, rows: m.data }); }
                catch (err) { console.error("refreshManufacturersCache failed:", err); }
            } else if (m.error) {
                try {
                    const cached = await window.offlineAPI?.getManufacturersCache?.(pharmacyId);
                    if (cached) setManufacturers(cached);
                } catch (err) { console.error("getManufacturersCache failed:", err); }
            }
            // سجل الطباعة — قراءة فقط، مفيش كاش أوفلاين له (متفق عليه قبل كده إنه مش أساسي وقت البيع)
            if (pl.data) setPrintHistory(pl.data);
        });
    }, [pharmacyId]);

    // الأصناف التلقائية (غير دواء + فيها صلاحية قريبة)
    const productEarliestExpiry = useMemo(() => {
        const map = {};
        (purchases || []).forEach((pu) => {
            const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
            items.forEach((item) => {
                const expiry = item.expiry_date || item.expiry;
                if (!expiry || !item.id) return;
                if (!map[item.id] || expiry < map[item.id]) map[item.id] = expiry;
            });
        });
        (products || []).forEach((p) => {
            if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) {
                map[p.id] = p.expiry;
            }
        });
        return map;
    }, [purchases, products]);
const productFirstStocked = useMemo(() => {
        const map = {};
        (purchases || []).forEach((pu) => {
            const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
            items.forEach((item) => {
                if (!item.id) return;
                const d = pu.date || pu.created_at;
                if (!d) return;
                if (!map[item.id] || d < map[item.id]) map[item.id] = d;
            });
        });
        return map;
    }, [purchases]);
    const getProductExpiry = (p) =>
        productEarliestExpiry[p.id] || p.expiry || null;

    const autoPromoProducts = products.reduce((acc, p) => {
        const expiry = getProductExpiry(p);
        // 🆕 نفس الدالة بالظبط اللي بتحسب سعر نقطة البيع (computeAutoPromoForProduct) — مفيش أي اختلاف منطق
        const result = computeAutoPromoForProduct(p, discountRules, expiry, sales, autoPromoConfig, productFirstStocked[p.id] || null);
        if (!result) return acc;

        acc.push({
            ...p, expiry, autoDiscount: result.autoDiscount,
            reasonExpiry: result.reasonExpiry, reasonStagnant: result.reasonStagnant,
            daysSinceLastSale: result.daysSinceLastSale,
        });
        return acc;
    }, []).sort((a, b) => b.autoDiscount - a.autoDiscount);

    // ── دالة طباعة Shelf Label — دلوقتي بتفتح معاينة أول (بدل ما تطبع على طول) ──
    // offerName: اسم/مناسبة العرض (عروض العيد، اليوم الوطني، رمضان...) بيظهر في مكان اسم الصيدلية القديم
    const printShelfLabel = (items: {
        name: string;
        originalPrice: number;
        discountedPrice: number;
        discount: number;
        endDate?: string;
        isAuto?: boolean;
        promoLabel?: string; // نص وصفي للعرض (مهم لأنماط BOGO/الهدية اللي السعر فيها مش بيتغيّر)
    }[], offerName?: string) => {
        setLabelPreview({ items, offerName, columns: 2 });
    };

    // ── تسجيل عملية طباعة في السجل (عشان تقدر تعيد الطباعة لاحقًا سواء كان العرض تلقائي أو يدوي) ──
    const logPrintHistory = async (offerName: string, isAuto: boolean, items: any[]) => {
        const row = {
            pharmacy_id: pharmacyId,
            offer_name: offerName || (isAuto ? "عرض تلقائي" : "عرض يدوي"),
            is_auto: isAuto,
            items,
            created_by: currentUser?.name || currentUser?.email || "",
            created_at: new Date().toISOString(),
        };
        await logPromoPrint(row, pharmacyId);
        // تحديث فوري للـ state المحلي (optimistic) — منستنيش رد السيرفر زي الأصلي، عشان يشتغل أوفلاين
        setPrintHistory((prev) => [{ id: crypto.randomUUID(), ...row }, ...prev]);
    };

    // ── طباعة يدوية لأصناف العروض التلقائية (بعد ما كانت بتتطبع أوتوماتيك) ──
    // بتاخد الأصناف المحددة (أو كل الأصناف لو معدش تحديد) + اسم/مناسبة العرض المكتوبة، وتسجلهم في سجل الطباعة
    const printAutoPromoItems = (items: typeof autoPromoProducts, offerName: string) => {
    if (items.length === 0) return;
    const labelItems = items.map((p) => {
        const priceVat = withVat(p);
        return {
            name: p.name || p.nameAr || "",
            originalPrice: priceVat,
            discountedPrice: parseFloat((priceVat * (1 - p.autoDiscount / 100)).toFixed(2)),
            discount: p.autoDiscount,
            isAuto: true,
        };
    });
    printShelfLabel(labelItems, offerName);
    logPrintHistory(offerName, true, labelItems);
};

    // التحقق من اكتمال الحقول المطلوبة لكل نمط عرض
    const validatePromoForm = () => {
        if (!promoForm.end_date) return "حدد تاريخ نهاية العرض";
        const typeCfg = getPromoTypeConfig(promoForm.promo_type);
        for (const f of typeCfg.fields) {
            if (promoForm[f.key] === "" || promoForm[f.key] === null || promoForm[f.key] === undefined) {
                return `يرجى ملء الحقل: ${f.label}`;
            }
        }
        if (promoMode === "single" && !promoForm.product_id) return "اختر الصنف";
        if (promoMode === "company" && companyProductIds.length === 0) return "اختر منتج واحد على الأقل من منتجات الشركة";
        if (promoMode === "brand" && brandProductIds.length === 0) return "اختر منتج واحد على الأقل من هذا البراند";
        return null;
    };

    // بناء الحقول الرقمية الخاصة بنمط العرض المختار فقط (باقي الحقول الرقمية بتتسجل 0 وحقول النص بتتسجل null، عشان مايحصلش خطأ numeric في supabase)
    const buildPromoDetails = () => {
        const typeCfg = getPromoTypeConfig(promoForm.promo_type);
        const activeFields = new Map(typeCfg.fields.map((f) => [f.key, f]));
        const details = {};
        Object.keys(blankPromoDetails).forEach((key) => {
            const f = activeFields.get(key);
            if (f) {
                details[key] = f.type === "number" ? (+promoForm[key] || 0) : (promoForm[key] || null);
            } else {
                // حقل غير مستخدم في هذا النمط: رقمي يبقى 0، نصي يبقى null (مايبعتش "" لعمود numeric)
                details[key] = typeof blankPromoDetails[key] === "number" ? 0 : null;
            }
        });
        return details;
    };

    // حفظ عرض يدوي (إضافة أو تعديل) — بيدعم كل الأنماط + التطبيق على منتجات شركة كاملة
    const savePromo = async () => {
        const err = validatePromoForm();
        if (err) { showToast(err, "error"); return; }

        const details = buildPromoDetails();
        const baseRow = {
            promo_type: promoForm.promo_type,
            ...details,
            start_date: promoForm.start_date,
            end_date: promoForm.end_date,
            note: promoForm.note,
            offer_name: promoForm.offer_name || null, // ← اسم/مناسبة العرض تظهر في الطباعة
            manufacturer_id: promoMode === "company" ? promoForm.manufacturer_id : null,
            pharmacy_id: pharmacyId,
        };

        if (editPromoId) {
            const row = { ...baseRow, product_id: promoForm.product_id };
            await updatePromotion(editPromoId, pharmacyId, row);
            setPromos((p) => p.map((x) => (x.id === editPromoId ? { ...x, ...row } : x)));
            setEditPromoId(null);
            setPromoForm(blankPromo);
            setShowPromoForm(false);
            showToast("تم تعديل العرض ✓");
            return;
        }

        // منتج واحد أو مجموعة منتجات شركة — نبني سطر لكل منتج، مع id مولّد من العميل
        // (زي customers/sales) عشان الكاش المحلي يقدر يتخزن فورًا حتى لو أوفلاين
        const productIds =
  promoMode === "company" ? companyProductIds :
  promoMode === "brand" ? brandProductIds :
  [promoForm.product_id];
        const rows = productIds.map((pid) => ({ ...baseRow, id: crypto.randomUUID(), product_id: pid }));

        await savePromotions(rows, pharmacyId);
        setPromos((p) => [...p, ...rows]);
        setPromoForm(blankPromo);
        setPromoMode("single");
        setCompanyProductIds([]);
        setBrandProductIds([]);
        setSelectedBrand("");
        setShowPromoForm(false);
        showToast(`تم إضافة ${rows.length > 1 ? rows.length + " عروض" : "العرض"} ✓`);

        // طباعة ليبل الرف — للأنماط اللي ليها سعر وحدة واضح فقط
        const labelItems = productIds.map((pid) => {
    const prod = products.find((p) => p.id === pid);
    if (!prod) return null;
    const desc = describePromo(baseRow, productForLabel(prod)); // ← بنمرر السعر شامل الضريبة
    return {
        name: prod.name || prod.nameAr || "",
        originalPrice: withVat(prod),
        discountedPrice: desc.newUnitPrice,
        discount: baseRow.promo_type === "percent" ? baseRow.discount : 0,
        promoLabel: desc.label,
        dealQty: desc.dealQty,
        dealTotal: desc.dealTotal,
        endDate: promoForm.end_date,
        isAuto: false,
    };
}).filter(Boolean);
        if (labelItems.length) {
            printShelfLabel(labelItems, promoForm.offer_name);
            logPrintHistory(promoForm.offer_name, false, labelItems);
        }
    };

    const dateValidPromos = promos.filter((p) => p.end_date >= today && p.start_date <= today);
    const activePromos = dateValidPromos.filter((p) => isPromoFulfillable(p, products.find((pr) => pr.id === p.product_id), products));
    // 🆕 Pagination — عروض نشطة (كانت كلها بتترسم مرة واحدة، بتقل الأداء لما العدد يكبر)
    const ACTIVE_PROMOS_PAGE_SIZE = 10;
    const [activePromosPage, setActivePromosPage] = useState(1);
    const totalActivePromosPages = Math.max(1, Math.ceil(activePromos.length / ACTIVE_PROMOS_PAGE_SIZE));
    useEffect(() => {
        if (activePromosPage > totalActivePromosPages) setActivePromosPage(1);
    }, [totalActivePromosPages, activePromosPage]);
    const paginatedActivePromos = activePromos.slice(
        (activePromosPage - 1) * ACTIVE_PROMOS_PAGE_SIZE,
        activePromosPage * ACTIVE_PROMOS_PAGE_SIZE
    );
    // 🆕 معامل استجابة كل منتج للعروض القديمة — نفس محرك مخطط السيولة، مصدر واحد في promoUtils.js
    const productElasticity = useMemo(() => computePromoElasticity(sales, products, promos, today), [sales, products, promos, today]);
    const stockBlockedPromos = dateValidPromos.filter((p) => !isPromoFulfillable(p, products.find((pr) => pr.id === p.product_id), products));
    const expiredPromos = promos.filter((p) => p.end_date < today);
    const withVat = (prod) => prod?.taxable ? +(prod.price * 1.15).toFixed(2) : (prod?.price || 0);
    // نستخدمها لما نحتاج نبني منتج "وهمي" سعره شامل الضريبة عشان نمرره لـ describePromo
    // (بدل ما نضرب النتيجة النهائية في 1.15 على حسب نوع العرض، وده أدق خصوصًا لأنماط زي "خصم قيمة ثابتة")
    const productForLabel = (prod) => ({ ...prod, price: withVat(prod) });
    const discountColor = (d) => d >= 50 ? COLORS.red : d >= 25 ? COLORS.coral : d >= 20 ? COLORS.gold : COLORS.gold;

    const cardStyle = (border = COLORS.border) => ({
        background: COLORS.surface, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 12,
    });

    const filteredAutoPromos = autoPromoProducts.filter((p) =>
        !promoSearch || (p.name || p.nameAr || "").includes(promoSearch)
    );
    const pendingAutoPromos = filteredAutoPromos.filter((p) => !(autoPromoConfig.approvedProductIds || []).includes(p.id));
    const approvedAutoPromos = filteredAutoPromos.filter((p) => (autoPromoConfig.approvedProductIds || []).includes(p.id));
    // ═══════════════════════════════════════════════════
    // 🆕 اقتراحات عروض من المورد — مصدرين مختلفين:
    // 1) bonusQty على نفس كارت الصنف (فاتورة شراء فيها كمية مجانية مسجّلة عادي)
    // 2) أصناف اتربطت يدويًا (linked_product_id من فورم الصنف) لأنها كانت كارت عرض
    //    منفصل بالاسم زي "Closeup 3+1" — الكمية بتتستخرج من الاسم لو أمكن، وإلا تتملى يدوي
    // ═══════════════════════════════════════════════════
    const hasActivePromoFor = (productId) =>
        promos.some((p) => p.product_id === productId && (!p.end_date || p.end_date >= today) && p.start_date <= today);

    const supplierSuggestions = useMemo(() => {
        const list = [];
        const seenProductIds = new Set();

        // مصدر 1: bonusQty من فواتير الشراء
        (purchases || []).forEach((pu) => {
            const items = typeof pu.items === "string" ? JSON.parse(pu.items) : pu.items || [];
            items.forEach((item) => {
                const bonusQty = +item.bonusQty || 0;
                const qty = +item.qty || 0;
                if (bonusQty <= 0 || !item.id) return;
                const product = products.find((p) => p.id === item.id);
                if (!product || seenProductIds.has(product.id) || hasActivePromoFor(product.id)) return;
                seenProductIds.add(product.id);
                list.push({ key: "bonus_" + product.id, product, source: "bonus", confidence: "high", buyQty: qty, getQty: bonusQty });
            });
        });

        // مصدر 2: أصناف اتربطت يدويًا كـ"كارت عرض" لصنف أصلي
        products.forEach((linkCard) => {
            const parentId = linkCard.linked_product_id;
            if (!parentId || seenProductIds.has(parentId)) return;
            const parent = products.find((p) => p.id === parentId);
            if (!parent || hasActivePromoFor(parent.id)) return;
            const pattern = detectSupplierOfferPattern(linkCard.name_ar || linkCard.name);
            seenProductIds.add(parentId);
            list.push({
                key: "linked_" + linkCard.id, product: parent, source: "linked",
                sourceCardName: linkCard.name_ar || linkCard.name,
                confidence: pattern.buyQty && pattern.getQty ? "medium" : "low",
                buyQty: pattern.buyQty || "", getQty: pattern.getQty || "",
            });
        });
         // مصدر 3: أصناف اتسجلت كـ"عرض مستقل" صراحة من فاتورة الشراء
products.forEach((p) => {
    if (!p.is_standalone_offer || seenProductIds.has(p.id) || hasActivePromoFor(p.id)) return;
    seenProductIds.add(p.id);
    list.push({ key: "standalone_" + p.id, product: p, source: "standalone", confidence: "high" });
});

        return list;
    }, [purchases, products, promos, today]);

    const suggestionInputStyle = { background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const };
    const [suggestionEdits, setSuggestionEdits] = useState({});
    const defaultSuggestionEndDate = () => { const d = new Date(); d.setDate(d.getDate() + 14); return todayLocal(d); };
    const getSuggestionEdit = (s) => suggestionEdits[s.key] || { buyQty: s.buyQty, getQty: s.getQty, endDate: defaultSuggestionEndDate() };
    const setSuggestionEdit = (key, patch) =>
        setSuggestionEdits((prev) => ({ ...prev, [key]: { ...getSuggestionEdit({ key, buyQty: "", getQty: "" }), ...prev[key], ...patch } }));

    const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
        try { return JSON.parse(localStorage.getItem(`pharmacypro_dismissed_supplier_offers_${pharmacyId}`) || "[]"); } catch { return []; }
    });
    const dismissSuggestion = (key) => {
        setDismissedSuggestions((prev) => {
            const next = [...prev, key];
            try { localStorage.setItem(`pharmacypro_dismissed_supplier_offers_${pharmacyId}`, JSON.stringify(next)); } catch { }
            return next;
        });
    };
    const visibleSuggestions = supplierSuggestions.filter((s) => !dismissedSuggestions.includes(s.key));

    // اعتماد اقتراح → عرض BOGO فعلي في جدول promotions
    const acceptSupplierSuggestion = async (s) => {
    const edit = getSuggestionEdit(s);
    if (!edit.endDate) { showToast("يرجى تحديد تاريخ نهاية العرض", "error"); return; }

    if (s.source === "standalone") {
        const details = {};
        Object.keys(blankPromoDetails).forEach((key) => {
            details[key] = typeof blankPromoDetails[key] === "number" ? 0 : null;
        });
        const row = {
            id: crypto.randomUUID(),
            promo_type: "percent",
            ...details,
            discount: +edit.discount || 0,
            start_date: today, end_date: edit.endDate,
            note: "عرض مورد — صنف عرض مستقل",
            offer_name: "عرض من المورد", manufacturer_id: null,
            pharmacy_id: pharmacyId, product_id: s.product.id,
        };
        await savePromotions([row], pharmacyId);
        setPromos((p) => [...p, row]);
        showToast("تم اعتماد العرض ✓");
        return;
    }

    const buyQty = +edit.buyQty || 0;
    const getQty = +edit.getQty || 0;
    if (buyQty <= 0 || getQty <= 0) { showToast("يرجى تحديد الكمية المطلوبة والمجانية", "error"); return; }
    const details = {};
    Object.keys(blankPromoDetails).forEach((key) => {
        if (key === "buy_qty" || key === "get_qty" || key === "get_discount_percent") return;
        details[key] = typeof blankPromoDetails[key] === "number" ? 0 : null;
    });
    const row = {
        id: crypto.randomUUID(),
        promo_type: "bogo",
        ...details,
        buy_qty: buyQty, get_qty: getQty, get_discount_percent: 100,
        start_date: today, end_date: edit.endDate,
        note: s.source === "bonus" ? "عرض مورد تلقائي (بونص فاتورة شراء)" : `عرض مورد — كارت مرتبط: ${s.sourceCardName || ""}`,
        offer_name: "عرض من المورد", manufacturer_id: null,
        pharmacy_id: pharmacyId, product_id: s.product.id,
    };
    await savePromotions([row], pharmacyId);
    setPromos((p) => [...p, row]);
    showToast("تم اعتماد العرض ✓");
};

    // ── حذف عرض يدوي — دالة واحدة مستخدمة في المكانين (النشطة والمتوقفة مؤقتًا) بدل التكرار ──
    const handleDeletePromo = async (promoId: string) => {
        await deletePromotion(promoId, pharmacyId);
        setPromos((p) => p.filter((x) => x.id !== promoId));
    };
    // ═══════════════════════════════════════════════════
    // 🆕 إرسال العرض لعملاء مستهدفين (مش إرسال عشوائي) — بناءً على تصنيفات العميل:
    // - نمط الشراء: العميل لازم يكون سبق واشترى من نفس فئة الصنف (أو عميل "شامل")، عشان العرض يبقى ذو صلة
    // - الحالة/الاتجاه: العملاء "في خطر" أو الاتجاه "نازل" بيتقدّموا في الترتيب (أولى بالاسترجاع)
    // - قوة العميل (VIP): بعد كده الترتيب حسب قوة العميل (VIP الأول)
    // ═══════════════════════════════════════════════════
    // 🆕 بقت بتاخد أكتر من صنف مرة واحدة (لإرسال عدة عروض دفعة واحدة) — بتجمع كل التصنيفات
    // المرتبطة بالأصناف المختارة وتدوّر على أي عميل مناسب لأي صنف منها (اتحاد مش تقاطع)
    const getMatchedCustomersForProducts = (prods) => {
        const validProds = (prods || []).filter(Boolean);
        if (!validProds.length) return [];
        const cats = [...new Set(validProds.map((p) => p.main_category || p.category || ""))];
        const vipRank = { vip: 0, excellent: 1, good: 2, weak: 3 };
        return enrichedCustomers
            .filter((c) => c.phone && c.stats)
            .filter((c) => c.stats.isComprehensiveBuyer || cats.some((cat) => (c.stats.categorySpend?.[cat] || 0) > 0))
            .sort((a, b) => {
                const pa = a.stats.status === "at_risk" || a.stats.trendDirection === "down" ? 0 : 1;
                const pb = b.stats.status === "at_risk" || b.stats.trendDirection === "down" ? 0 : 1;
                if (pa !== pb) return pa - pb;
                return (vipRank[a.stats.vipLevel] ?? 4) - (vipRank[b.stats.vipLevel] ?? 4);
            });
    };

    const [sendTarget, setSendTarget] = useState(null); // { items: [{promo, product}], matches }
    const [selectedSendIds, setSelectedSendIds] = useState<string[]>([]);
    // 🆕 تحديد أكتر من عرض من قائمة "العروض النشطة" للإرسال دفعة واحدة
    const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);
    const togglePromoSelection = (promoId) => {
        setSelectedPromoIds((prev) => prev.includes(promoId) ? prev.filter((id) => id !== promoId) : [...prev, promoId]);
    };

    // بيقبل إما (promo, product) للإرسال المفرد القديم، أو مصفوفة [{promo, product}, ...] للإرسال الجماعي
    const openSendPanel = (promoOrItems, product) => {
        const items = Array.isArray(promoOrItems) ? promoOrItems : [{ promo: promoOrItems, product }];
        const matches = getMatchedCustomersForProducts(items.map((it) => it.product));
        setSendTarget({ items, matches });
        setSelectedSendIds(matches.map((c) => c.id));
    };

    // 🆕 فتح لوحة الإرسال لكل العروض النشطة المحددة بالـ checkbox دفعة واحدة
    const openBulkSendPanel = () => {
        const items = activePromos
            .filter((promo) => selectedPromoIds.includes(promo.id))
            .map((promo) => ({ promo, product: products.find((p) => p.id === promo.product_id) }));
        if (!items.length) return;
        openSendPanel(items);
    };

    const buildOfferMessage = (items) => {
        const list = (items || []).filter((it) => it.product);
        if (list.length === 0) return `مرحباً {name}! 😊 عندنا عرض خاص يسعدنا زيارتك للاستفادة منه 🎉`;
        if (list.length === 1) {
            const { product, promo } = list[0];
            const desc = describePromo(promo, product);
            const name = product?.name_ar || product?.name || "";
            return `مرحباً {name}! 😊 عندنا عرض خاص على ${name}${desc ? ` — ${desc.label}` : ""}. يسعدنا زيارتك للاستفادة منه 🎉`;
        }
        const lines = list.map(({ product, promo }) => {
            const desc = describePromo(promo, product);
            const name = product?.name_ar || product?.name || "";
            return `• ${name}${desc ? ` — ${desc.label}` : ""}`;
        }).join("\n");
        return `مرحباً {name}! 😊 عندنا عروض خاصة تناسبك:\n${lines}\nيسعدنا زيارتك للاستفادة منها 🎉`;
    };

    const sendToSelected = () => {
        if (!sendTarget) return;
        const list = sendTarget.matches.filter((c) => selectedSendIds.includes(c.id));
        list.forEach((c, i) => {
            const msg = buildOfferMessage(sendTarget.items).replace("{name}", c.name || "");
            setTimeout(() => openWhatsApp(c.phone, msg), i * 600);
        });
        showToast(`جاري إرسال ${sendTarget.items.length > 1 ? `${sendTarget.items.length} عروض` : "العرض"} لـ ${list.length} عميل ✓`);
        setSendTarget(null);
        setSelectedPromoIds([]);
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🏷️ إدارة العروض</h2>
                    <div style={{ color: COLORS.border, fontSize: 12, marginTop: 2 }}>
                        عروض تلقائية حسب الصلاحية + عروض يدوية
                    </div>
                </div>
            </div>

            {/* تنبيه العروض التلقائية — بيظهر بس لو مش واقفين على تاب "تلقائي" أصلاً، عشان مايتكررش نفس الكلام مرتين */}
            {autoPromoProducts.length > 0 && activeTab !== "auto" && (
                <div style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ minWidth: 220 }}>
                        <span style={{ color: COLORS.gold, fontWeight: 700 }}>⚠️ {autoPromoProducts.length} صنف يحتاج عرض تلقائي</span>
                        <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>أصناف غير دوائية بصلاحية أقل من 6 شهور، أو راكدة بدون حركة بيع</div>
                    </div>
                    <button onClick={() => setActiveTab("auto")} style={{ flexShrink: 0, background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 8, padding: "6px 14px", color: COLORS.gold, fontSize: 12, cursor: "pointer" }}>
                        عرض التفاصيل
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 4, overflowX: "auto" }}>
                {[
                    { k: "auto", l: `⏰ تلقائي (${autoPromoProducts.length})` },
                    { k: "supplier", l: `🚚 من المورد (${visibleSuggestions.length})` },
                    { k: "manual", l: `✋ يدوي (${activePromos.length})` },
                    { k: "elasticity", l: "📊 أداء العروض" },
                    { k: "prints", l: `🖨️ سجل الطباعة (${printHistory.length})` },
                ].map((t) => (
                    <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
                        flex: "1 1 130px", whiteSpace: "nowrap", padding: "9px 8px", borderRadius: 8, border: "none",
                        background: activeTab === t.k ? COLORS.surface : "transparent",
                        color: activeTab === t.k ? COLORS.blue : COLORS.textDim,
                        fontSize: 12, fontWeight: activeTab === t.k ? 700 : 400, cursor: "pointer",
                    }}>{t.l}</button>
                ))}
            </div>

            {/* ── العروض التلقائية ── */}
            {activeTab === "auto" && (
                <div>
                    <div style={cardStyle("#1a2a1a")}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ color: COLORS.green, fontWeight: 700 }}>📋 منطق الخصم التدرجي التلقائي</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {canEdit && (
                                    <button onClick={() => setShowAutoConfig((v) => !v)}
                                        style={{ background: "#1a0a2a", border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: 8, padding: "5px 14px", color: COLORS.purple, fontSize: 12, cursor: "pointer" }}>
                                        ⚙️ شرط الإضافة
                                    </button>
                                )}
                                {canEdit && (
                                    <button onClick={() => { setEditRules(discountRules.map(r => ({ ...r }))); setShowRulesEditor(true); }}
                                        style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: "5px 14px", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>
                                        ✏️ تعديل القواعد
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* كارت إعدادات شرط الإضافة التلقائية */}
                        {showAutoConfig && (
                            <div style={{ background: COLORS.purpleSoft, border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                                <div style={{ color: COLORS.purple, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⚙️ شروط الإضافة للقائمة التلقائية</div>

                                {/* الفئات المستثناة */}
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>الفئات المستثناة (لن تظهر في العروض التلقائية):</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {["دواء", "مستلزمات طبية", "مستحضرات تجميل", "أخرى"].map((cat) => {
                                            const excluded = autoPromoConfig.excludeCategories.includes(cat);
                                            return (
                                                <div key={cat} onClick={() => {
                                                    const updated = {
                                                        ...autoPromoConfig,
                                                        excludeCategories: excluded
                                                            ? autoPromoConfig.excludeCategories.filter((c) => c !== cat)
                                                            : [...autoPromoConfig.excludeCategories, cat],
                                                    };
                                                    setAutoPromoConfig(updated);
                                                    saveAutoConfig(updated);
                                                }} style={{
                                                    padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                                                    background: excluded ? COLORS.redSoft : COLORS.greenSoft,
                                                    border: `1px solid ${excluded ? COLORS.red : "#1a4a1a"}`,
                                                    color: excluded ? COLORS.coral : COLORS.green, fontSize: 12
                                                }}>
                                                    {excluded ? "✕ " : "✓ "}{cat}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* الحد الأدنى للخصم */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>أقل خصم يظهر في القائمة:</span>
                                    <input type="number" min="0" max="100" value={autoPromoConfig.minDiscount}
                                        onChange={(e) => {
                                            const updated = { ...autoPromoConfig, minDiscount: +e.target.value };
                                            setAutoPromoConfig(updated);
                                            saveAutoConfig(updated);
                                        }}
                                        style={{ width: 60, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>%</span>
                                </div>

                                {/* اشتراط المخزون */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ color: COLORS.textDim, fontSize: 12 }}>إظهار الأصناف المنتهية المخزون:</span>
                                    <div onClick={() => {
                                        const updated = { ...autoPromoConfig, requireStock: !autoPromoConfig.requireStock };
                                        setAutoPromoConfig(updated);
                                        saveAutoConfig(updated);
                                    }}
                                        style={{
                                            width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                                            background: autoPromoConfig.requireStock ? COLORS.green : COLORS.red,
                                            position: "relative", transition: "background 0.2s"
                                        }}>
                                        <div style={{
                                            width: 14, height: 14, borderRadius: "50%", background: "#fff",
                                            position: "absolute", top: 3,
                                            left: autoPromoConfig.requireStock ? 3 : 19, transition: "left 0.2s"
                                        }} />
                                    </div>
                                    <span style={{ color: autoPromoConfig.requireStock ? COLORS.green : COLORS.coral, fontSize: 11 }}>
                                        {autoPromoConfig.requireStock ? "مخفية" : "ظاهرة"}
                                    </span>
                                </div>

                                {/* ── إعدادات الأصناف الراكدة ── */}
                                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                        <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 700 }}>📦 تضمين الأصناف الراكدة:</span>
                                        <div onClick={() => {
                                            const updated = { ...autoPromoConfig, stagnantEnabled: !autoPromoConfig.stagnantEnabled };
                                            setAutoPromoConfig(updated);
                                            saveAutoConfig(updated);
                                        }}
                                            style={{
                                                width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                                                background: autoPromoConfig.stagnantEnabled ? COLORS.green : COLORS.red,
                                                position: "relative", transition: "background 0.2s"
                                            }}>
                                            <div style={{
                                                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                                                position: "absolute", top: 3,
                                                left: autoPromoConfig.stagnantEnabled ? 3 : 19, transition: "left 0.2s"
                                            }} />
                                        </div>
                                    </div>

                                    {autoPromoConfig.stagnantEnabled && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ color: COLORS.textDim, fontSize: 12, minWidth: 150 }}>مفيش بيع من (يوم):</span>
                                                <input type="number" min="7" value={autoPromoConfig.stagnantNoSaleDays}
                                                    onChange={(e) => {
                                                        const updated = { ...autoPromoConfig, stagnantNoSaleDays: +e.target.value };
                                                        setAutoPromoConfig(updated);
                                                        saveAutoConfig(updated);
                                                    }}
                                                    style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ color: COLORS.textDim, fontSize: 12, minWidth: 150 }}>نافذة حساب معدل البيع (يوم):</span>
                                                <input type="number" min="30" value={autoPromoConfig.stagnantVelocityWindowDays}
                                                    onChange={(e) => {
                                                        const updated = { ...autoPromoConfig, stagnantVelocityWindowDays: +e.target.value };
                                                        setAutoPromoConfig(updated);
                                                        saveAutoConfig(updated);
                                                    }}
                                                    style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span style={{ color: COLORS.textDim, fontSize: 12, minWidth: 150 }}>نسبة خصم الراكد (%):</span>
                                                <input type="number" min="0" max="100" value={autoPromoConfig.stagnantDiscountPercent}
                                                    onChange={(e) => {
                                                        const updated = { ...autoPromoConfig, stagnantDiscountPercent: +e.target.value };
                                                        setAutoPromoConfig(updated);
                                                        saveAutoConfig(updated);
                                                    }}
                                                    style={{ width: 70, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }} />
                                            </div>
                                            <div style={{ color: COLORS.textDim, fontSize: 10 }}>
                                                الصنف يُعتبر راكد لو: مفيش بيع من المدة دي، أو معدل بيعه الحالي هيخلّي مخزونه الحالي ما يخلصش قبل ما ينتهي.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* تفعيل/تعطيل أنماط العروض */}
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>أنماط العروض المفعّلة (تظهر عند إضافة عرض يدوي):</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {PROMO_TYPES.map((t) => {
                                            const enabled = autoPromoConfig.enabledTypes.includes(t.id);
                                            return (
                                                <div key={t.id} onClick={() => {
                                                    const updated = {
                                                        ...autoPromoConfig,
                                                        enabledTypes: enabled
                                                            ? autoPromoConfig.enabledTypes.filter((id) => id !== t.id)
                                                            : [...autoPromoConfig.enabledTypes, t.id],
                                                    };
                                                    setAutoPromoConfig(updated);
                                                    saveAutoConfig(updated);
                                                }} style={{
                                                    padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                                                    background: enabled ? COLORS.greenSoft : COLORS.redSoft,
                                                    border: `1px solid ${enabled ? "#1a4a1a" : COLORS.red}`,
                                                    color: enabled ? COLORS.green : COLORS.coral, fontSize: 12
                                                }}>
                                                    {enabled ? "✓ " : "✕ "}{t.icon} {t.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* أي الأنماط يُسمح بتفعيلها تلقائيًا حسب قرب الصلاحية */}
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 6 }}>الأنماط اللي تظهر في العروض التلقائية (حسب قرب الصلاحية):</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {PROMO_TYPES.filter((t) => t.autoCapable).map((t) => {
                                            const on = autoPromoConfig.autoEligibleTypes.includes(t.id);
                                            return (
                                                <div key={t.id} onClick={() => {
                                                    const updated = {
                                                        ...autoPromoConfig,
                                                        autoEligibleTypes: on
                                                            ? autoPromoConfig.autoEligibleTypes.filter((id) => id !== t.id)
                                                            : [...autoPromoConfig.autoEligibleTypes, t.id],
                                                    };
                                                    setAutoPromoConfig(updated);
                                                    saveAutoConfig(updated);
                                                }} style={{
                                                    padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                                                    background: on ? COLORS.blueSoft : COLORS.surfaceAlt,
                                                    border: `1px solid ${on ? COLORS.blue : COLORS.border}`,
                                                    color: on ? COLORS.blue : COLORS.textDim, fontSize: 12
                                                }}>
                                                    {on ? "✓ " : "✕ "}{t.icon} {t.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ color: COLORS.textDim, fontSize: 10, marginTop: 4 }}>
                                        ملاحظة: أنماط زي BOGO والباقة والهدية لازم تتحدد يدويًا دايمًا، مش قابلة للتفعيل التلقائي.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                            {[...discountRules].sort((a, b) => a.days - b.days).map((r) => (
                                <div key={r.days} style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                                    <div style={{ color: r.color || COLORS.gold, fontWeight: 900, fontSize: 18 }}>{r.discount}%</div>
                                    <div style={{ color: COLORS.textDim, fontSize: 11 }}>أقل من {Math.round(r.days / 30)} شهور</div>
                                    <div style={{ color: COLORS.textDim, fontSize: 10 }}>({r.days} يوم)</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <input
                        value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)}
                        placeholder="🔍 بحث..."
                        style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                    />

                    {/* ── طباعة يدوية للعروض التلقائية — 🆕 اتقسّمت لصفين ثابتين بدل صف واحد مزدحم:
               صف 1: اسم/مناسبة العرض بعرض كامل (بيحتاج مساحة كتابة)
               صف 2: الأزرار بترتيب أولوية ثابت (تحديد ← طباعة/إرسال المحدد ← طباعة الكل)
               كده الأزرار مابتلخبطش مع خانة الكتابة لما الشاشة تضيق ── */}
                    {filteredAutoPromos.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <input
                                value={autoOfferName} onChange={(e) => setAutoOfferName(e.target.value)}
                                placeholder="اسم/مناسبة العرض (مثلاً: عروض العيد)..."
                                style={{ width: "100%", boxSizing: "border-box", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 14px", color: COLORS.textPrimary, fontSize: 13, outline: "none", marginBottom: 8 }}
                            />
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button onClick={() => setSelectedAutoIds(
                                    selectedAutoIds.length === filteredAutoPromos.length ? [] : filteredAutoPromos.map((p) => p.id)
                                )} style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}>
                                    {selectedAutoIds.length === filteredAutoPromos.length ? "إلغاء التحديد" : "تحديد الكل"}
                                </button>
                                <button
                                    disabled={selectedAutoIds.length === 0}
                                    onClick={() => {
                                        printAutoPromoItems(filteredAutoPromos.filter((p) => selectedAutoIds.includes(p.id)), autoOfferName);
                                        setSelectedAutoIds([]);
                                    }}
                                    style={{ background: selectedAutoIds.length ? COLORS.blueSoft : COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: selectedAutoIds.length ? COLORS.blue : COLORS.textDim, fontSize: 12, cursor: selectedAutoIds.length ? "pointer" : "not-allowed" }}>
                                    🖨️ طباعة المحدد ({selectedAutoIds.length})
                                </button>
                                {/* 🆕 إرسال نفس الأصناف المحددة (بنفس checkbox الطباعة) كعروض دفعة واحدة للعملاء المناسبين */}
                                <button
                                    disabled={selectedAutoIds.length === 0}
                                    onClick={() => {
                                        const items = filteredAutoPromos
                                            .filter((p) => selectedAutoIds.includes(p.id))
                                            .map((p) => ({ promo: { promo_type: "percent", discount: p.autoDiscount }, product: p }));
                                        openSendPanel(items);
                                    }}
                                    style={{ background: selectedAutoIds.length ? COLORS.greenSoft : COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: selectedAutoIds.length ? COLORS.green : COLORS.textDim, fontSize: 12, fontWeight: 700, cursor: selectedAutoIds.length ? "pointer" : "not-allowed" }}>
                                    📤 إرسال المحدد للعملاء ({selectedAutoIds.length})
                                </button>
                                <button onClick={() => printAutoPromoItems(filteredAutoPromos, autoOfferName)}
                                    style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 8, padding: "8px 14px", color: COLORS.gold, fontSize: 12, cursor: "pointer" }}>
                                    🖨️ طباعة الكل ({filteredAutoPromos.length})
                                </button>
                            </div>
                        </div>
                    )}

                   {pendingAutoPromos.length === 0 && approvedAutoPromos.length === 0 && (
    <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>✅ لا توجد أصناف تحتاج عروض تلقائية</div>
)}

{pendingAutoPromos.length > 0 && (
    <>
        <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>⏳ بانتظار الاعتماد ({pendingAutoPromos.length})</div>
        {pendingAutoPromos.map((p) => {
            const days = p.expiry ? Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const newPrice = (p.price * (1 - p.autoDiscount / 100)).toFixed(2);
            const checked = selectedAutoIds.includes(p.id);
            return (
                <div key={p.id} style={cardStyle(p.autoDiscount >= 50 ? COLORS.redSoft : p.autoDiscount >= 25 ? COLORS.coralSoft : COLORS.goldSoft)}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", flex: "1 1 220px", gap: 10, minWidth: 0 }}>
                            <input type="checkbox" checked={checked} onChange={() => {
                                setSelectedAutoIds((prev) => checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]);
                            }} style={{ marginTop: 4, cursor: "pointer" }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                                    <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{p.name || p.nameAr}</span>
                                    <span style={{
                                        background: discountColor(p.autoDiscount), color: "#fff",
                                        borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900,
                                    }}>-{p.autoDiscount}%</span>
                                    {p.reasonExpiry && (
                                        <span style={{ background: COLORS.goldSoft, color: COLORS.gold, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>⏰ قرب انتهاء</span>
                                    )}
                                    {p.reasonStagnant && (
                                        <span style={{ background: COLORS.purpleSoft, color: COLORS.purple, border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>📦 راكد</span>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 20, fontSize: 12, flexWrap: "wrap" }}>
                                    <span style={{ color: COLORS.textDim }}>الفئة: <span style={{ color: COLORS.textDim }}>{p.main_category || p.category}</span></span>
                                    <span style={{ color: COLORS.textDim }}>المخزون: <span style={{ color: COLORS.textPrimary }}>{p.stock}</span></span>
                                    {days !== null && (
                                        <span style={{ color: COLORS.textDim }}>ينتهي بعد: <span style={{ color: discountColor(p.autoDiscount) }}>{days} يوم</span></span>
                                    )}
                                    {p.reasonStagnant && (
                                        <span style={{ color: COLORS.textDim }}>
                                            آخر بيع: <span style={{ color: COLORS.purple }}>{p.daysSinceLastSale === null ? "لا يوجد" : `منذ ${p.daysSinceLastSale} يوم`}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: "left", minWidth: 110, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div style={{ color: COLORS.textDim, fontSize: 11, textDecoration: "line-through" }}>{p.price} ر.س</div>
                            <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{newPrice} ر.س</div>
                            {p.expiry && <div style={{ color: COLORS.textDim, fontSize: 10 }}>تاريخ: {p.expiry}</div>}
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => approveAutoPromo(p.id)}
                                    style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                    ✅ اعتماد
                                </button>
                                <button onClick={() => printAutoPromoItems([p], autoOfferName)}
                                    style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer" }}>
                                    🖨️ طباعة
                                </button>
                                <button onClick={() => openSendPanel({ promo_type: "percent", discount: p.autoDiscount }, p)}
                                    style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                                    📤 إرسال
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}
    </>
)}

{approvedAutoPromos.length > 0 && (
    <>
        <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 13, margin: "16px 0 8px" }}>✅ معتمدة ونشطة ({approvedAutoPromos.length})</div>
        {approvedAutoPromos.map((p) => {
            const days = p.expiry ? Math.ceil((new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const newPrice = (p.price * (1 - p.autoDiscount / 100)).toFixed(2);
            const checked = selectedAutoIds.includes(p.id);
            return (
                <div key={p.id} style={cardStyle(p.autoDiscount >= 50 ? COLORS.redSoft : p.autoDiscount >= 25 ? COLORS.coralSoft : COLORS.goldSoft)}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", flex: "1 1 220px", gap: 10, minWidth: 0 }}>
                            <input type="checkbox" checked={checked} onChange={() => {
                                setSelectedAutoIds((prev) => checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]);
                            }} style={{ marginTop: 4, cursor: "pointer" }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                                    <span style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14 }}>{p.name || p.nameAr}</span>
                                    <span style={{
                                        background: discountColor(p.autoDiscount), color: "#fff",
                                        borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900,
                                    }}>-{p.autoDiscount}%</span>
                                    {p.reasonExpiry && (
                                        <span style={{ background: COLORS.goldSoft, color: COLORS.gold, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>⏰ قرب انتهاء</span>
                                    )}
                                    {p.reasonStagnant && (
                                        <span style={{ background: COLORS.purpleSoft, color: COLORS.purple, border: `1px solid ${tint(COLORS.purple, 0.35)}`, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>📦 راكد</span>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 20, fontSize: 12, flexWrap: "wrap" }}>
                                    <span style={{ color: COLORS.textDim }}>الفئة: <span style={{ color: COLORS.textDim }}>{p.main_category || p.category}</span></span>
                                    <span style={{ color: COLORS.textDim }}>المخزون: <span style={{ color: COLORS.textPrimary }}>{p.stock}</span></span>
                                    {days !== null && (
                                        <span style={{ color: COLORS.textDim }}>ينتهي بعد: <span style={{ color: discountColor(p.autoDiscount) }}>{days} يوم</span></span>
                                    )}
                                    {p.reasonStagnant && (
                                        <span style={{ color: COLORS.textDim }}>
                                            آخر بيع: <span style={{ color: COLORS.purple }}>{p.daysSinceLastSale === null ? "لا يوجد" : `منذ ${p.daysSinceLastSale} يوم`}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div style={{ textAlign: "left", minWidth: 110, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <div style={{ color: COLORS.textDim, fontSize: 11, textDecoration: "line-through" }}>{p.price} ر.س</div>
                            <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 18 }}>{newPrice} ر.س</div>
                            {p.expiry && <div style={{ color: COLORS.textDim, fontSize: 10 }}>تاريخ: {p.expiry}</div>}
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => stopAutoPromo(p.id)}
                                    style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>
                                    🗑️ إيقاف
                                </button>
                                <button onClick={() => printAutoPromoItems([p], autoOfferName)}
                                    style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer" }}>
                                    🖨️ طباعة
                                </button>
                                <button onClick={() => openSendPanel({ promo_type: "percent", discount: p.autoDiscount }, p)}
                                    style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>
                                    📤 إرسال
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
       })}
    </>
)}
                </div>
            )}
            {/* ── اقتراحات عروض من المورد ── */}
            {activeTab === "supplier" && (
                <div>
                    <div style={cardStyle(tint(COLORS.blue, 0.35))}>
                        <div style={{ color: COLORS.blue, fontWeight: 700, marginBottom: 4 }}>🚚 عروض جاية من المورد</div>
                        <div style={{ color: COLORS.textDim, fontSize: 12 }}>
                            مقترحة تلقائيًا من فواتير الشراء (بونص على نفس الصنف) أو من أصناف ربطتها يدويًا لأنها كانت كارت عرض منفصل بالاسم.
                            راجع الكمية والتاريخ قبل الاعتماد.
                        </div>
                    </div>

                    {visibleSuggestions.length === 0 && (
                        <div style={{ textAlign: "center", padding: 30, color: COLORS.textDim }}>مفيش اقتراحات عروض من المورد دلوقتي</div>
                    )}

                    {visibleSuggestions.map((s) => {
                        const edit = getSuggestionEdit(s);
                        const p = s.product;
                        return (
                            <div key={s.key} style={cardStyle()}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name_ar || p.name}</div>
                                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                                            {s.source === "bonus" ? "المصدر: بونص فاتورة شراء (نفس كارت الصنف)"
    : s.source === "standalone" ? "المصدر: صنف مسجّل كعرض مستقل"
    : `المصدر: كارت مرتبط بالاسم — "${s.sourceCardName}"`}
                                        </div>
                                        <span style={{
                                            display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 8px",
                                            color: s.confidence === "high" ? COLORS.green : s.confidence === "medium" ? COLORS.gold : COLORS.textDim,
                                            background: s.confidence === "high" ? COLORS.greenSoft : s.confidence === "medium" ? COLORS.goldSoft : COLORS.surfaceAlt,
                                        }}>
                                            {s.confidence === "high" ? "✓ ثقة عالية" : s.confidence === "medium" ? "تحقق قبل الاعتماد" : "محتاج تدخل يدوي"}
                                        </span>
                                    </div>
                                    <span onClick={() => dismissSuggestion(s.key)} style={{ cursor: "pointer", color: COLORS.textDim, fontSize: 12 }}>تجاهل ✕</span>
                                </div>

                               <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
    {s.source !== "standalone" && (
        <>
            <div style={{ width: 100 }}>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>اشتري كمية</div>
                <input type="number" value={edit.buyQty} onChange={(e) => setSuggestionEdit(s.key, { buyQty: e.target.value })} style={suggestionInputStyle} />
            </div>
            <div style={{ width: 100 }}>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>يحصل مجانًا على</div>
                <input type="number" value={edit.getQty} onChange={(e) => setSuggestionEdit(s.key, { getQty: e.target.value })} style={suggestionInputStyle} />
            </div>
        </>
    )}
    {s.source === "standalone" && (
        <div style={{ width: 120 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>نسبة خصم % (اختياري)</div>
            <input type="number" value={edit.discount || 0} onChange={(e) => setSuggestionEdit(s.key, { discount: e.target.value })} style={suggestionInputStyle} />
        </div>
    )}
    <div style={{ width: 150 }}>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>تاريخ نهاية العرض</div>
        <input type="date" value={edit.endDate} onChange={(e) => setSuggestionEdit(s.key, { endDate: e.target.value })} style={suggestionInputStyle} />
    </div>
    {canAdd && <Btn icon="check" onClick={() => acceptSupplierSuggestion(s)}>اعتماد كعرض</Btn>}
</div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* ── العروض اليدوية ── */}
            {activeTab === "manual" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                        {canAdd && <Btn icon="plus" onClick={() => setShowPromoForm(true)}>إضافة عرض</Btn>}
                    </div>

                    {activePromos.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                                <div style={{ color: COLORS.green, fontWeight: 700, fontSize: 13 }}>✅ عروض نشطة ({activePromos.length})</div>
                                {/* 🆕 تحديد عدة عروض وإرسالها للعملاء المناسبين بضغطة واحدة، بدل إرسال كل صنف لوحده */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    {selectedPromoIds.length > 0 && (
                                        <span style={{ fontSize: 12, color: COLORS.textDim }}>{selectedPromoIds.length} عرض محدد</span>
                                    )}
                                    <button
                                        onClick={() => setSelectedPromoIds(selectedPromoIds.length === activePromos.length ? [] : activePromos.map((p) => p.id))}
                                        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: COLORS.textDim, fontSize: 12, cursor: "pointer" }}
                                    >
                                        {selectedPromoIds.length === activePromos.length ? "إلغاء تحديد الكل" : "☑️ تحديد الكل"}
                                    </button>
                                    <button
                                        disabled={selectedPromoIds.length === 0}
                                        onClick={openBulkSendPanel}
                                        style={{ background: selectedPromoIds.length ? COLORS.greenSoft : COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", color: selectedPromoIds.length ? COLORS.green : COLORS.textDim, fontSize: 12, fontWeight: 700, cursor: selectedPromoIds.length ? "pointer" : "not-allowed" }}
                                    >
                                        📤 إرسال العروض المحددة ({selectedPromoIds.length})
                                    </button>
                                </div>
                            </div>
                            {paginatedActivePromos.map((promo) => {
                                const prod = products.find((p) => p.id === promo.product_id);
                                const typeCfg = getPromoTypeConfig(promo.promo_type || "percent");
                                const desc = prod ? describePromo(promo, prod) : null;
                                const daysLeft = Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                                const manufacturer = manufacturers.find((m) => m.id === promo.manufacturer_id);
                                return (
                                    <div key={promo.id} style={cardStyle(COLORS.greenSoft)}>
                                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                                    {/* 🆕 checkbox تحديد العرض للإرسال الجماعي */}
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPromoIds.includes(promo.id)}
                                                        onChange={() => togglePromoSelection(promo.id)}
                                                        style={{ cursor: "pointer" }}
                                                    />
                                                    <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{prod?.name_ar || prod?.name || prod?.nameAr || promo.product_id}</span>
                                                    <span style={{ background: COLORS.coral, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>{typeCfg.icon} {desc?.label}</span>
                                                    {manufacturer && <span style={{ background: COLORS.blueSoft, color: COLORS.blue, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>🏭 {manufacturer.name}</span>}
                                                    {promo.offer_name && <span style={{ background: COLORS.goldSoft, color: COLORS.gold, borderRadius: 20, padding: "2px 10px", fontSize: 11 }}>🎉 {promo.offer_name}</span>}
                                                </div>
                                                <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                                                    {promo.start_date} ← {promo.end_date}
                                                    {promo.note && <span style={{ marginRight: 10, color: COLORS.textDim }}>• {promo.note}</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "left", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                                {(promo.promo_type === "percent" || promo.promo_type === "fixed_amount" || !promo.promo_type) && (
                                                    <div style={{ color: COLORS.green, fontWeight: 900, fontSize: 16 }}>{desc?.newUnitPrice ?? "—"} ر.س</div>
                                                )}
                                                <div style={{ color: daysLeft <= 3 ? COLORS.red : COLORS.textDim, fontSize: 11 }}>يتبقى {daysLeft} يوم</div>
                                                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                                    {prod && (
   
                                                  <button onClick={() => {
                                                    const priceVat = withVat(prod);
                                                    const descVat = describePromo(promo, productForLabel(prod)); // ← نحسب desc تاني على السعر شامل الضريبة
                                                    const labelItem = {
                                                    name: prod.name || prod.nameAr || "",
                                                    originalPrice: priceVat,
                                                    discountedPrice: descVat?.newUnitPrice ?? priceVat,
                                                    discount: promo.promo_type === "percent" ? promo.discount : 0,
                                                     promoLabel: descVat?.label,
                                                    dealQty: descVat?.dealQty,
                                                    dealTotal: descVat?.dealTotal,
                                                    endDate: promo.end_date,
                                                    isAuto: false,
                                                     };
                                                     printShelfLabel([labelItem], promo.offer_name);
                                                     logPrintHistory(promo.offer_name, false, [labelItem]);
                                                     }} style={{ background: COLORS.goldSoft, border: `1px solid ${tint(COLORS.gold, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.gold, fontSize: 11, cursor: "pointer" }}>🖨️ طباعة</button>
                                                    )}
                                                    <button onClick={() => openSendPanel(promo, prod)}
                                                        style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>📤 إرسال للعملاء</button>
                                                    {canEdit && (
                                                        <button onClick={() => {
                                                            setPromoForm({
                                                                ...blankPromoDetails,
                                                                promo_type: promo.promo_type || "percent",
                                                                product_id: promo.product_id,
                                                                manufacturer_id: promo.manufacturer_id || "",
                                                                discount: promo.discount ?? "",
                                                                fixed_amount: promo.fixed_amount ?? "",
                                                                buy_qty: promo.buy_qty ?? "",
                                                                get_qty: promo.get_qty ?? "",
                                                                get_discount_percent: promo.get_discount_percent ?? 100,
                                                                qty_discount_percent: promo.qty_discount_percent ?? "",
                                                                bundle_qty: promo.bundle_qty ?? "",
                                                                bundle_price: promo.bundle_price ?? "",
                                                                gift_product_id: promo.gift_product_id ?? "",
                                                                gift_qty: promo.gift_qty ?? "",
                                                                start_date: promo.start_date,
                                                                end_date: promo.end_date,
                                                                note: promo.note || "",
                                                                offer_name: promo.offer_name || "",
                                                            });
                                                            setPromoMode("single");
                                                            setEditPromoId(promo.id);
                                                            setShowPromoForm(true);
                                                        }} style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>✏️ تعديل</button>
                                                    )}
                                                    {canDelete && (
                                                        <button onClick={() => handleDeletePromo(promo.id)}
                                                            style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>🗑️ حذف</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {totalActivePromosPages > 1 && (
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 12 }}>
                                    <button
                                        disabled={activePromosPage === 1}
                                        onClick={() => setActivePromosPage((p) => Math.max(1, p - 1))}
                                        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", color: activePromosPage === 1 ? COLORS.textDim : COLORS.textPrimary, fontSize: 12, cursor: activePromosPage === 1 ? "not-allowed" : "pointer" }}
                                    >
                                        ▶ السابق
                                    </button>
                                    <span style={{ fontSize: 12, color: COLORS.textDim }}>صفحة {activePromosPage} من {totalActivePromosPages}</span>
                                    <button
                                        disabled={activePromosPage === totalActivePromosPages}
                                        onClick={() => setActivePromosPage((p) => Math.min(totalActivePromosPages, p + 1))}
                                        style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", color: activePromosPage === totalActivePromosPages ? COLORS.textDim : COLORS.textPrimary, fontSize: 12, cursor: activePromosPage === totalActivePromosPages ? "not-allowed" : "pointer" }}
                                    >
                                        التالي ◀
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {stockBlockedPromos.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ color: COLORS.coral, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>⛔ متوقفة مؤقتًا — الكمية لا تكفي ({stockBlockedPromos.length})</div>
                            {stockBlockedPromos.map((promo) => {
                                const prod = products.find((p) => p.id === promo.product_id);
                                const minQty = getPromoMinRequiredQty(promo);
                                const typeCfg = getPromoTypeConfig(promo.promo_type || "percent");
                                const desc = prod ? describePromo(promo, prod) : null;
                                return (
                                    <div key={promo.id} style={cardStyle(COLORS.redSoft)}>
                                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                                    <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{prod?.name_ar || prod?.name || prod?.nameAr || promo.product_id}</span>
                                                    <span style={{ background: COLORS.coral, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>{typeCfg.icon} {desc?.label}</span>
                                                </div>
                                                <div style={{ color: COLORS.coral, fontSize: 11 }}>
                                                    المخزون الحالي: {prod?.stock ?? 0} — محتاج {minQty} على الأقل عشان العرض يفضل شغال
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                                                {canEdit && (
                                                    <button onClick={() => {
                                                        setPromoForm({
                                                            ...blankPromoDetails,
                                                            promo_type: promo.promo_type || "percent",
                                                            product_id: promo.product_id,
                                                            manufacturer_id: promo.manufacturer_id || "",
                                                            discount: promo.discount ?? "",
                                                            fixed_amount: promo.fixed_amount ?? "",
                                                            buy_qty: promo.buy_qty ?? "",
                                                            get_qty: promo.get_qty ?? "",
                                                            get_discount_percent: promo.get_discount_percent ?? 100,
                                                            qty_discount_percent: promo.qty_discount_percent ?? "",
                                                            bundle_qty: promo.bundle_qty ?? "",
                                                            bundle_price: promo.bundle_price ?? "",
                                                            gift_product_id: promo.gift_product_id ?? "",
                                                            gift_qty: promo.gift_qty ?? "",
                                                            start_date: promo.start_date,
                                                            end_date: promo.end_date,
                                                            note: promo.note || "",
                                                            offer_name: promo.offer_name || "",
                                                        });
                                                        setPromoMode("single");
                                                        setEditPromoId(promo.id);
                                                        setShowPromoForm(true);
                                                    }} style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "3px 10px", color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>✏️ تعديل</button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeletePromo(promo.id)}
                                                        style={{ background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red, 0.35)}`, borderRadius: 6, padding: "3px 10px", color: COLORS.red, fontSize: 11, cursor: "pointer" }}>🗑️ حذف</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div style={{ color: COLORS.textDim, fontSize: 10, marginTop: 4 }}>
                                هتشتغل تلقائيًا تاني لو المخزون اتجدد قبل تاريخ الانتهاء — من غير ما تحتاج تعمل حاجة.
                            </div>
                        </div>
                    )}

                    {expiredPromos.length > 0 && (
                        <div>
                            <div style={{ color: COLORS.textDim, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📦 عروض منتهية ({expiredPromos.length})</div>
                            {expiredPromos.slice(0, 5).map((promo) => {
                                const prod = products.find((p) => p.id === promo.product_id);
                                return (
                                    <div key={promo.id} style={{ ...cardStyle(), opacity: 0.6 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: COLORS.textDim }}>{prod?.name || prod?.nameAr || promo.product_id}</span>
                                            <span style={{ color: COLORS.textDim }}>-{promo.discount}% • انتهى {promo.end_date}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {promos.length === 0 && <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>لا توجد عروض يدوية</div>}
                </div>
            )}

            {/* ── 🆕 أداء العروض — معامل استجابة كل منتج جرّبت عليه عروض قبل كده ── */}
            {activeTab === "elasticity" && (
                <div>
                    <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>
                        لكل منتج اتعمله عرض قديم خلص، بنقارن معدل بيعه اليومي وقت العرض مقابل نفس عدد الأيام قبله مباشرة.
                        النسبة دي بتوضحلك مين بيستجيب فعلاً للعروض قبل ما تقرر تعمل عرض جديد.
                    </div>
                    {Object.keys(productElasticity).length === 0 ? (
                        <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>لسه مفيش عروض قديمة خلصت نقيس عليها الاستجابة</div>
                    ) : (
                        <Table
                            headers={["المنتج", "معامل الاستجابة", "التصنيف", "عدد العروض المُقاسة"]}
                            rows={Object.entries(productElasticity)
                                .map(([pid, el]) => ({ pid, el, prod: products.find((p) => p.id === pid) }))
                                .sort((a, b) => b.el.avgRatio - a.el.avgRatio)
                                .map(({ pid, el, prod }) => [
                                    prod?.name || prod?.name_ar || pid,
                                    `×${el.avgRatio.toFixed(1)}`,
                                    <Badge key="l" color={(el.label === "يستجيب جيدًا" ? COLORS.green : el.label === "استجابة متوسطة" ? COLORS.gold : COLORS.red) + "22"} text={el.label === "يستجيب جيدًا" ? COLORS.green : el.label === "استجابة متوسطة" ? COLORS.gold : COLORS.red}>{el.label}</Badge>,
                                    el.sampleCount,
                                ])}
                        />
                    )}
                    <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 10 }}>
                        منتج بعامل واحد بس مقاس عليه رقمه مش موثوق إحصائيًا لسه — كل ما جرّبت عروض أكتر عليه، كل ما الرقم يبقى أدق. المنتجات اللي ماعملهاش عرض قبل كده مش هتظهر هنا خالص.
                    </div>
                </div>
            )}

            {/* ── سجل الطباعة — إعادة طباعة أي عرض سابق (تلقائي أو يدوي) ── */}
            {activeTab === "prints" && (
                <div>
                    {printHistory.length === 0 ? (
                        <div style={{ color: COLORS.textDim, textAlign: "center", padding: 40 }}>لا يوجد عروض متطبوعة بعد</div>
                    ) : (
                        printHistory.map((h) => (
                            <div key={h.id} style={cardStyle(h.is_auto ? COLORS.goldSoft : COLORS.greenSoft)}>
                                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                            <span style={{ color: COLORS.textPrimary, fontWeight: 700 }}>{h.offer_name || (h.is_auto ? "عرض تلقائي" : "عرض يدوي")}</span>
                                            <span style={{
                                                background: h.is_auto ? COLORS.goldSoft : COLORS.blueSoft,
                                                color: h.is_auto ? COLORS.gold : COLORS.blue,
                                                border: `1px solid ${tint(h.is_auto ? COLORS.gold : COLORS.blue, 0.35)}`,
                                                borderRadius: 20, padding: "2px 10px", fontSize: 11,
                                            }}>{h.is_auto ? "⏰ تلقائي" : "✋ يدوي"}</span>
                                            <span style={{ color: COLORS.textDim, fontSize: 11 }}>{(h.items || []).length} صنف</span>
                                        </div>
                                        <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                                            {h.created_at ? new Date(h.created_at).toLocaleString("ar-SA") : ""}
                                            {h.created_by && <span style={{ marginRight: 10 }}>• بواسطة {h.created_by}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => printShelfLabel(h.items || [], h.offer_name)}
                                        style={{ background: COLORS.blueSoft, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 14px", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>
                                        🖨️ إعادة طباعة
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal تعديل قواعد الخصم */}
            <Modal open={showRulesEditor} onClose={() => setShowRulesEditor(false)} title="✏️ تعديل قواعد الخصم التدرجي">
                <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>
                    حدد عدد الأيام ونسبة الخصم لكل مرحلة — يتم الترتيب تلقائياً من الأقل للأكثر
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 700 }}>أقل من (يوم)</span>
                    <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 700 }}>نسبة الخصم %</span>
                    <span />
                </div>
                {editRules.map((rule, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                        <input type="number" value={rule.days} min="1" max="365"
                            onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, days: +e.target.value } : r))}
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
                        <input type="number" value={rule.discount} min="1" max="100"
                            onChange={(e) => setEditRules((p) => p.map((r, j) => j === i ? { ...r, discount: +e.target.value } : r))}
                            style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" as const }} />
                        <button onClick={() => setEditRules((p) => p.filter((_, j) => j !== i))}
                            style={{ background: COLORS.redSoft, border: "none", borderRadius: 6, padding: "8px 12px", color: COLORS.coral, cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                ))}
                <button onClick={() => setEditRules((p) => [...p, { days: 60, discount: 10, color: COLORS.gold }])}
                    style={{ background: COLORS.greenSoft, border: `1px dashed ${tint(COLORS.green, 0.35)}`, borderRadius: 8, padding: "7px 14px", color: COLORS.green, cursor: "pointer", fontSize: 12, width: "100%", marginBottom: 14 }}>
                    + إضافة مرحلة
                </button>
                <div style={{ background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                    <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>معاينة:</div>
                    {[...editRules].sort((a, b) => a.days - b.days).map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                            <span style={{ color: COLORS.textDim }}>أقل من {r.days} يوم (~{Math.round(r.days / 30)} شهور)</span>
                            <span style={{ color: COLORS.gold, fontWeight: 700 }}>خصم {r.discount}%</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <Btn variant="ghost" onClick={() => setEditRules([...DEFAULT_RULES])}>إعادة للافتراضي</Btn>
                    <Btn variant="ghost" onClick={() => setShowRulesEditor(false)}>إلغاء</Btn>
                    <Btn icon="check" onClick={async () => {
                        const sorted = [...editRules].sort((a, b) => a.days - b.days);
                        const rows = sorted.map((r) => ({
                            days: r.days,
                            discount: r.discount,
                            color: r.color || COLORS.gold,
                        }));
                        await replacePromoRules(pharmacyId, rows);
                        setDiscountRules(sorted);
                        setShowRulesEditor(false);
                        showToast("تم حفظ قواعد الخصم ✓");
                    }}>حفظ</Btn>
                </div>
            </Modal>

            {/* Modal إضافة/تعديل عرض يدوي */}
            <Modal open={showPromoForm} onClose={() => { setShowPromoForm(false); setEditPromoId(null); setPromoForm(blankPromo); setPromoMode("single"); setCompanyProductIds([]); setBrandProductIds([]); setSelectedBrand(""); }} title={editPromoId ? "✏️ تعديل عرض يدوي" : "➕ إضافة عرض يدوي"}>

                {/* نمط العرض */}
                <div style={{ marginBottom: 12 }}>
                    <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>نمط العرض</label>
                    <select value={promoForm.promo_type}
                        onChange={(e) => setPromoForm((p) => ({ ...blankPromo, promo_type: e.target.value, product_id: p.product_id, manufacturer_id: p.manufacturer_id, start_date: p.start_date, end_date: p.end_date, note: p.note }))}
                        style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
                        {PROMO_TYPES.filter((t) => autoPromoConfig.enabledTypes.includes(t.id)).map((t) => (
                            <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                        ))}
                    </select>
                </div>

                {/* اختيار: صنف واحد أو منتجات شركة كاملة */}
                {!editPromoId && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {[{ id: "single", label: "🔹 صنف واحد" }, { id: "company", label: "🏭 منتجات شركة" }, { id: "brand", label: "🏷️ منتجات براند" }].map((m) => (
                            <button key={m.id} onClick={() => { setPromoMode(m.id); setCompanyProductIds([]); setBrandProductIds([]); setSelectedBrand(""); }}
                                style={{
                                    flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                                    background: promoMode === m.id ? COLORS.blueSoft : COLORS.surfaceAlt,
                                    border: `1px solid ${promoMode === m.id ? COLORS.blue : COLORS.border}`,
                                    color: promoMode === m.id ? COLORS.blue : COLORS.textDim
                                }}>
                                {m.label}
                            </button>
                        ))}
                    </div>
                )}

               {(promoMode === "single" || editPromoId) && (
    <div style={{ marginBottom: 12 }}>
        <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>الصنف</label>
        <input
            type="text"
            placeholder="ابحث باسم الصنف..."
            value={productPickerSearch}
            onChange={(e) => setProductPickerSearch(e.target.value)}
            style={{ width: "100%", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", marginBottom: 6, boxSizing: "border-box" }}
        />
        <select value={promoForm.product_id}
            onChange={(e) => setPromoForm((p) => ({ ...p, product_id: e.target.value }))}
            style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
            <option value="">-- اختر صنفاً --</option>
            {products
                .filter((p) => !productPickerSearch || (p.name_ar || p.name || p.nameAr || "").includes(productPickerSearch))
                .map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.nameAr} — {p.price} ر.س</option>
                ))}
        </select>
        {/* 🆕 تلميح فوري: هل الصنف ده استجاب للعروض قبل كده؟ */}
        {promoForm.product_id && (() => {
            const el = productElasticity[promoForm.product_id];
            if (!el) return (
                <div style={{ marginTop: 6, fontSize: 12, color: COLORS.textDim }}>❔ لسه مجرّبتش عليه عرض قبل كده — مفيش سجل استجابة.</div>
            );
            const color = el.label === "يستجيب جيدًا" ? COLORS.green : el.label === "استجابة متوسطة" ? COLORS.gold : COLORS.red;
            return (
                <div style={{ marginTop: 6, fontSize: 12, color, fontWeight: 700 }}>
                    {el.label === "ضعيف الاستجابة" ? "⚠️" : "✅"} {el.label} (×{el.avgRatio.toFixed(1)}، من {el.sampleCount} عرض سابق)
                </div>
            );
        })()}
    </div>
)}

{promoMode === "company" && !editPromoId && (
    <div style={{ marginBottom: 12 }}>
        <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>الشركة المصنّعة</label>
        <select value={promoForm.manufacturer_id}
            onChange={(e) => { setPromoForm((p) => ({ ...p, manufacturer_id: e.target.value })); setCompanyProductIds([]); }}
            style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", marginBottom: 10 }}>
            <option value="">-- اختر شركة --</option>
            {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
            ))}
        </select>
        {/* 🆕 تلميح فوري: متوسط استجابة منتجات الشركة دي للعروض قبل كده */}
        {promoForm.manufacturer_id && (() => {
            const companyProductIdsAll = products.filter((p) => p.manufacturer_id === promoForm.manufacturer_id).map((p) => p.id);
            const scored = companyProductIdsAll.map((pid) => productElasticity[pid]).filter(Boolean);
            if (scored.length === 0) return (
                <div style={{ marginBottom: 10, fontSize: 12, color: COLORS.textDim }}>❔ لسه مفيش عروض قديمة على منتجات الشركة دي نقيس عليها.</div>
            );
            const avg = scored.reduce((a, e) => a + e.avgRatio, 0) / scored.length;
            const label = avg >= 1.5 ? "يستجيب جيدًا" : avg <= 1.1 ? "ضعيف الاستجابة" : "استجابة متوسطة";
            const color = label === "يستجيب جيدًا" ? COLORS.green : label === "استجابة متوسطة" ? COLORS.gold : COLORS.red;
            return (
                <div style={{ marginBottom: 10, fontSize: 12, color, fontWeight: 700 }}>
                    {label === "ضعيف الاستجابة" ? "⚠️" : "✅"} متوسط استجابة منتجات الشركة: {label} (×{avg.toFixed(1)}، من {scored.length} صنف له سجل)
                </div>
            );
        })()}

        {promoForm.manufacturer_id && (() => {
            const companyProducts = products.filter((p) => p.manufacturer_id === promoForm.manufacturer_id);
            if (companyProducts.length === 0) {
                return <div style={{ color: COLORS.textDim, fontSize: 12, textAlign: "center", padding: 10 }}>لا توجد منتجات مسجلة لهذه الشركة</div>;
            }
            const allSelected = companyProductIds.length === companyProducts.length;
            return (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 8, maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: COLORS.textDim, fontSize: 12 }}>{companyProductIds.length} من {companyProducts.length} منتج محدد</span>
                        <button onClick={() => setCompanyProductIds(allSelected ? [] : companyProducts.map((p) => p.id))}
                            style={{ background: "transparent", border: "none", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>
                            {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
                        </button>
                    </div>
                    {companyProducts.map((p) => {
                        const checked = companyProductIds.includes(p.id);
                        return (
                            <div key={p.id} onClick={() => setCompanyProductIds((prev) => checked ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer", background: checked ? COLORS.blueSoft : "transparent" }}>
                                <input type="checkbox" checked={checked} readOnly style={{ pointerEvents: "none" }} />
                                <span style={{ fontSize: 12, color: COLORS.textPrimary, flex: 1 }}>{p.name || p.nameAr}</span>
                                <span style={{ fontSize: 11, color: COLORS.textDim }}>{p.price} ر.س</span>
                            </div>
                        );
                    })}
                </div>
            );
        })()}
    </div>
)}

{promoMode === "brand" && !editPromoId && (
    <div style={{ marginBottom: 12 }}>
        <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>البراند</label>
        <select value={selectedBrand}
            onChange={(e) => { setSelectedBrand(e.target.value); setBrandProductIds([]); }}
            style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none", marginBottom: 10 }}>
            <option value="">-- اختر براند --</option>
            {(() => {
                const brandMap = new Map();
                products.forEach((p) => {
                    if (!p.brand_name) return;
                    if (!brandMap.has(p.brand_name)) brandMap.set(p.brand_name, p.brand_name_en || "");
                });
                return [...brandMap.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0], "ar"))
                    .map(([ar, en]) => (
                        <option key={ar} value={ar}>{ar}{en ? ` (${en})` : ""}</option>
                    ));
            })()}
        </select>

        {selectedBrand && (() => {
            const brandProducts = products.filter((p) => p.brand_name === selectedBrand);
            if (brandProducts.length === 0) {
                return <div style={{ color: COLORS.textDim, fontSize: 12, textAlign: "center", padding: 10 }}>لا توجد أصناف مسجلة لهذا البراند</div>;
            }
            const allSelected = brandProductIds.length === brandProducts.length;
            return (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 8, maxHeight: 220, overflowY: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: COLORS.textDim, fontSize: 12 }}>{brandProductIds.length} من {brandProducts.length} منتج محدد</span>
                        <button onClick={() => setBrandProductIds(allSelected ? [] : brandProducts.map((p) => p.id))}
                            style={{ background: "transparent", border: "none", color: COLORS.blue, fontSize: 12, cursor: "pointer" }}>
                            {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
                        </button>
                    </div>
                    {brandProducts.map((p) => {
                        const checked = brandProductIds.includes(p.id);
                        return (
                            <div key={p.id} onClick={() => setBrandProductIds((prev) => checked ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer", background: checked ? COLORS.blueSoft : "transparent" }}>
                                <input type="checkbox" checked={checked} readOnly style={{ pointerEvents: "none" }} />
                                <span style={{ fontSize: 12, color: COLORS.textPrimary, flex: 1 }}>{p.name || p.nameAr}</span>
                                <span style={{ fontSize: 11, color: COLORS.textDim }}>{p.price} ر.س</span>
                            </div>
                        );
                    })}
                </div>
            );
        })()}
    </div>
)}

{/* حقول خاصة بنمط العرض المختار */}
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    {getPromoTypeConfig(promoForm.promo_type).fields.map((f) => (
        f.type === "product_select" ? (
            <div key={f.key} style={{ gridColumn: "1/-1" }}>
                <label style={{ color: COLORS.border, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                <select value={promoForm[f.key]}
                    onChange={(e) => setPromoForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.textPrimary, fontSize: 13, outline: "none" }}>
                    <option value="">-- اختر صنف الهدية --</option>
                    {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name || p.nameAr}</option>
                    ))}
                </select>
            </div>
        ) : (
            <Input key={f.key} label={f.label} value={promoForm[f.key]} onChange={(v) => setPromoForm((p) => ({ ...p, [f.key]: v }))} type={f.type} placeholder={f.placeholder} />
        )
    ))}
    <Input label="تاريخ البداية" value={promoForm.start_date} onChange={(v) => setPromoForm((p) => ({ ...p, start_date: v }))} type="date" />
    <Input label="تاريخ النهاية" value={promoForm.end_date} onChange={(v) => setPromoForm((p) => ({ ...p, end_date: v }))} type="date" />
    <div style={{ gridColumn: "1/-1" }}>
        <Input label="اسم/مناسبة العرض (تظهر في الطباعة)" value={promoForm.offer_name} onChange={(v) => setPromoForm((p) => ({ ...p, offer_name: v }))} placeholder="مثلاً: عروض العيد، اليوم الوطني، عرض رمضان..." />
    </div>
    <div style={{ gridColumn: "1/-1" }}>
        <Input label="ملاحظة" value={promoForm.note} onChange={(v) => setPromoForm((p) => ({ ...p, note: v }))} placeholder="وصف العرض..." />
    </div>
</div>

{/* معاينة السعر — لصنف واحد فقط ولو الحقول مكتملة */}
{promoMode === "single" && promoForm.product_id && (() => {
    const prod = products.find((p) => p.id === promoForm.product_id);
    if (!prod) return null;
    const desc = describePromo({ ...promoForm, discount: +promoForm.discount, fixed_amount: +promoForm.fixed_amount, buy_qty: +promoForm.buy_qty, get_qty: +promoForm.get_qty, get_discount_percent: +promoForm.get_discount_percent, qty_discount_percent: +promoForm.qty_discount_percent, bundle_qty: +promoForm.bundle_qty, bundle_price: +promoForm.bundle_price }, prod);
    return (
        <div style={{ background: COLORS.greenSoft, border: `1px solid ${tint(COLORS.green, 0.35)}`, borderRadius: 8, padding: 10, marginTop: 10 }}>
            <span style={{ color: COLORS.textDim, fontSize: 12 }}>{desc.label}</span>
            {promoForm.promo_type !== "bogo" && promoForm.promo_type !== "free_gift" && (
                <div style={{ marginTop: 4 }}>
                    <span style={{ color: COLORS.green, fontWeight: 900, fontSize: 16 }}>{desc.newUnitPrice} ر.س</span>
                    <span style={{ color: COLORS.textDim, fontSize: 11, marginRight: 8 }}>(بدلاً من {prod.price} ر.س)</span>
                </div>
            )}
        </div>
    );
})()}
{promoMode === "company" && companyProductIds.length > 0 && (
    <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: 10, marginTop: 10, color: COLORS.blue, fontSize: 12 }}>
        هيتم تطبيق العرض على {companyProductIds.length} منتج من هذه الشركة
    </div>
)}
{promoMode === "brand" && brandProductIds.length > 0 && (
    <div style={{ background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue, 0.35)}`, borderRadius: 8, padding: 10, marginTop: 10, color: COLORS.blue, fontSize: 12 }}>
        هيتم تطبيق العرض على {brandProductIds.length} منتج من هذا البراند
    </div>
)}

<div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
    <Btn variant="ghost" onClick={() => { setShowPromoForm(false); setEditPromoId(null); setPromoForm(blankPromo); setPromoMode("single"); setCompanyProductIds([]); setBrandProductIds([]); setSelectedBrand(""); }}>إلغاء</Btn>
    <Btn icon="check" onClick={savePromo}>{editPromoId ? "حفظ التعديل" : "إضافة العرض"}</Btn>
</div>
</Modal>

            {/* 🆕 نافذة إرسال العرض (أو عدة عروض) للعملاء المستهدفين — حسب نمط الشراء + حالة/اتجاه الشراء + قوة العميل */}
            <Modal open={!!sendTarget} onClose={() => setSendTarget(null)} title={sendTarget?.items?.length > 1 ? `📤 إرسال ${sendTarget.items.length} عروض للعملاء المستهدفين` : "📤 إرسال العرض للعملاء المستهدفين"}>
                {sendTarget && (
                    <div>
                        <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 10 }}>
                            {sendTarget.items.length > 1 ? (
                                <>
                                    العروض المرسلة: <b style={{ color: COLORS.textPrimary }}>{sendTarget.items.map((it) => it.product?.name_ar || it.product?.name).filter(Boolean).join("، ")}</b>
                                </>
                            ) : (
                                <>العرض على: <b style={{ color: COLORS.textPrimary }}>{sendTarget.items[0]?.product?.name_ar || sendTarget.items[0]?.product?.name}</b></>
                            )}
                            {" — "}العملاء اللي سبق واشتروا من نفس الفئات، مرتبين حسب الأولوية (في خطر/نازل الأول، وبعدين حسب قوة العميل).
                        </div>

                        {sendTarget.matches.length === 0 && (
                            <div style={{ textAlign: "center", padding: 20, color: COLORS.textDim }}>مفيش عملاء متطابقين مع فئة الصنف ده حاليًا</div>
                        )}

                        {sendTarget.matches.length > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: COLORS.textDim }}>{selectedSendIds.length} من {sendTarget.matches.length} محدد</span>
                                <span
                                    onClick={() => setSelectedSendIds(selectedSendIds.length === sendTarget.matches.length ? [] : sendTarget.matches.map((c) => c.id))}
                                    style={{ cursor: "pointer", color: COLORS.blue, fontSize: 12 }}
                                >
                                    {selectedSendIds.length === sendTarget.matches.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                                </span>
                            </div>
                        )}

                        <div style={{ maxHeight: 320, overflowY: "auto" }}>
                            {sendTarget.matches.map((c) => {
                                const checked = selectedSendIds.includes(c.id);
                                const vip = c.stats ? vipConfig[c.stats.vipLevel] : null;
                                return (
                                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}>
                                        <input type="checkbox" checked={checked} onChange={(e) => {
                                            setSelectedSendIds((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                                        }} />
                                        <span style={{ flex: 1, fontSize: 13 }}>{c.name}</span>
                                        {vip && <span style={{ background: vip.bg, color: vip.color, borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{vip.label}</span>}
                                        {c.stats?.trendDirection && <span style={{ fontSize: 11 }}>{trendConfig[c.stats.trendDirection].icon}</span>}
                                        {c.stats?.status === "at_risk" && <span style={{ fontSize: 11 }}>⚠️</span>}
                                    </label>
                                );
                            })}
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                            <Btn variant="ghost" onClick={() => setSendTarget(null)}>إلغاء</Btn>
                            <Btn icon="whatsapp" onClick={sendToSelected}>إرسال لـ {selectedSendIds.length} عميل</Btn>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 🆕 معاينة ملصقات الرفوف قبل الطباعة الفعلية - بتحكم في عدد الأعمدة */}
            {labelPreview && (
                <Modal
                    open
                    onClose={() => setLabelPreview(null)}
                    title="معاينة طباعة الملصقات"
                    wide
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <label style={{ fontSize: 13, color: COLORS.textDim }}>
                            عدد الملصقات في الصف:
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={4}
                            value={labelPreview.columns}
                            onChange={(e) =>
                                setLabelPreview((p) => ({
                                    ...p,
                                    columns: Math.max(1, Math.min(4, +e.target.value || 1)),
                                }))
                            }
                            style={{
                                width: 60,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: `1px solid ${COLORS.border}`,
                                textAlign: "center",
                            }}
                        />
                        <span style={{ fontSize: 12, color: COLORS.textDim }}>
                            ({labelPreview.items.length} ملصق)
                        </span>
                    </div>

                    <div
                        style={{
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 8,
                            overflow: "auto",
                            height: 500,
                            background: "#525659",
                        }}
                    >
                        <iframe
                            title="label-preview"
                            srcDoc={buildShelfLabelHtml(
                                labelPreview.items,
                                labelPreview.offerName,
                                labelPreview.columns
                            )}
                            style={{
                                width: "210mm",
                                minHeight: "100%",
                                border: "none",
                                background: "#fff",
                                display: "block",
                                margin: "0 auto",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                        <Btn variant="ghost" onClick={() => setLabelPreview(null)}>
                            إلغاء
                        </Btn>
                        <Btn
                            icon="print"
                            onClick={async () => {
                                await printHTML(
                                    buildShelfLabelHtml(
                                        labelPreview.items,
                                        labelPreview.offerName,
                                        labelPreview.columns
                                    )
                                );
                                setLabelPreview(null);
                            }}
                        >
                            طباعة
                        </Btn>
                    </div>
                </Modal>
            )}
        </div>
    );
}
