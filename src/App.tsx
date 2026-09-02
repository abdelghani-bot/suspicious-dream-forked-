import { QRCodeSVG } from "qrcode.react";
import { COLORS, tint, SHADOW } from "./theme";
import * as XLSX from "xlsx";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Login } from "./components/Login";
import { PharmacyShelfBackground } from "./components/PharmacyShelfBackground";
import { SuperAdminPanel } from "./components/SuperAdminPanel";
import { INIT_CUSTOMERS, INIT_PRODUCTS, INIT_PURCHASES, INIT_SALES, INIT_SUPPLIERS, INIT_USERS } from "./data/seedData";
import { useEssentialAlerts } from "./hooks/useEssentialAlerts";
import { useStorage } from "./hooks/useStorage";
import { logAudit } from "./lib/auditLog";
import { emptyInvoice } from "./lib/posConstants";
import { DEFAULT_AUTO_PROMO_CONFIG, getEffectivePrice } from "./lib/promoUtils";
import { AttendanceModule } from "./modules/AttendanceModule";
import { AuditLogModule } from "./modules/AuditLogModule";
import { CustomersModule, computeCustomerStats } from "./modules/CustomersModule";
import { Dashboard } from "./modules/Dashboard";
import { ExpiryReport } from "./modules/ExpiryReport";
import { FinancialHealthModule } from "./modules/FinancialHealthModule";
import { InventoryCount } from "./modules/InventoryCount";
import { InventoryStatement } from "./modules/InventoryStatement";
import { LoyaltyModule } from "./modules/LoyaltyModule";
import { POS } from "./modules/POS";
import { PermissionsModule, SYSTEM_SECTIONS, permKey } from "./modules/PermissionsModule";
import { PharmacySettings } from "./modules/PharmacySettings";
import { ProductsModule } from "./modules/ProductsModule";
import { PromotionsModule } from "./modules/PromotionsModule";
import { PurchaseModule } from "./modules/PurchaseModule";
import { RasdSettings } from "./modules/RasdSettings";
import { Reports } from "./modules/Reports";
import { ReturnsModule } from "./modules/ReturnsModule";
import { ShiftModule } from "./modules/ShiftModule";
import { SuppliersModule } from "./modules/SuppliersModule";
import { TargetModule } from "./modules/TargetModule";
import { TaxReport } from "./modules/TaxReport";
import { TreasuryModule } from "./modules/TreasuryModule";
import { authService } from "./services/authService";
import { RasdQueue } from "./services/rasdService";
import { IC, Toast } from "./ui/primitives";
import { supabase } from "./lib/supabaseClient";
import { initOfflineSync } from "./lib/offlineAPI";
import { PharmaLogo } from "./components/PharmaLogo";

// ==================== MAIN APP ====================
export default function PharmacyPro() {
    // جوه الكومبوننت الرئيسي:
    useEffect(() => {
        initOfflineSync();
    }, []);
    const [products, setProducts] = useStorage("ph_products", INIT_PRODUCTS);
    const [suppliers, setSuppliers] = useStorage("ph_suppliers", INIT_SUPPLIERS);
    const [customers, setCustomers] = useStorage("ph_customers", INIT_CUSTOMERS);
    const [sales, setSales] = useStorage("ph_sales", INIT_SALES);
    const [purchases, setPurchases] = useStorage("ph_purchases", INIT_PURCHASES);
    // 🆕 أصناف الجوكر المعلقة — كل صنف جوكر اتسجل في فاتورة بيع بفئته الرئيسية، بيفضل هنا لحد ما يدخل
    // طلب شراء تلقائي لمورد نفس الفئة، أو يتربط بصنف حقيقي بعد إضافته في شاشة الأصناف
    const [jokerPendingItems, setJokerPendingItems] = useStorage("ph_joker_pending", []);
    const [creditPayments, setCreditPayments] = useState([]);

    // 🆕 تصنيف العملاء (VIP/نمط الشراء/الاتجاه) محسوب مرة واحدة هنا، ومتبعت لأي موديول محتاجه
    // (قسم العملاء وقسم العروض) بدل ما كل موديول يحسبه لوحده بمنطق منفصل.
    const enrichedCustomers = useMemo(() => {
        const KIDS_COSMETICS_CATS = ["مستلزمات أطفال", "كوزمتك عادي", "كوزمتك طبي"];
        return (customers || []).map((c) => {
            const stats = computeCustomerStats(c, sales, creditPayments);
            const missedKidsCosmetics =
                c.category === "family_with_kids" &&
                !!stats &&
                !KIDS_COSMETICS_CATS.some((cat) => (stats.categorySpend?.[cat] || 0) > 0);
            return { ...c, stats, missedKidsCosmetics };
        });
    }, [customers, sales, creditPayments]);
    const [returnsData, setReturnsData] = useStorage("ph_returns", []);
    const [inventoryLogs, setInventoryLogs] = useState([]);
    const [manufacturers, setManufacturers] = useState([]);
    const [users, setUsers] = useState(INIT_USERS);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [authChecked, setAuthChecked] = useState(false);
    // 🆕 لو حساب السوبر أدمن نفسه مربوط بصيدلية (pharmacy_id)، الفلاج ده بيسمح له
    // بالدخول على واجهة الصيدلية العادية بدل ما يفضل محبوس جوه لوحة السوبر أدمن بس
    const [viewAsPharmacy, setViewAsPharmacy] = useState(false);

    // استعادة الجلسة عند تحميل التطبيق + الاستماع لتغيّرات Auth
    useEffect(() => {
        let active = true;
        authService.getCurrentUser().then((u) => {
            if (active) { setCurrentUser(u); setAuthChecked(true); }
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) { setCurrentUser(null); }
        });
        return () => { active = false; listener?.subscription?.unsubscribe(); };
    }, []);

    const pharmacyId = currentUser?.pharmacy_id || null;
    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("users")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .then(({ data }) => {
                if (data && data.length > 0) setUsers(data);
            });
    }, [pharmacyId]);
    const [shifts, setShifts] = useState([]);
    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("shifts")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .order("start_time", { ascending: false })
            .then(({ data }) => {
                if (data) setShifts(data);
            });
    }, [pharmacyId]);
    const [treasuryEntries, setTreasuryEntries] = useState([]);
    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("treasury_entries")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .order("date", { ascending: false })
            .then(({ data }) => {
                if (data) setTreasuryEntries(data);
            });
    }, [pharmacyId]);
    // 🆕 مصدر واحد لإعدادات نقاط الولاء — بتتحمّل مرة واحدة هنا وتتمرر لـ POS وLoyaltyModule
    // كـ prop، عشان أي تحديث (زي حفظ الإعدادات من موديول الولاء) ينعكس فورًا في POS من
    // غير ما يحتاج إعادة تشغيل أو fetch إضافي وقت البيع (مهم للاعتماد عليها أوفلاين).
    const [loyaltySettings, setLoyaltySettings] = useState(null);
    useEffect(() => {
        if (!pharmacyId) return;
        supabase
            .from("loyalty_settings")
            .select("*")
            .eq("pharmacy_id", pharmacyId)
            .maybeSingle()
            .then(({ data }) => {
                if (data) setLoyaltySettings(data);
            });
    }, [pharmacyId]);
    const [tab, setTab] = useState("dashboard");
    const [toast, setToast] = useState(null);

    // ── صلاحيات الدور الحالي (تتحكم في ظهور الأقسام + ما بداخلها) ──
    const [rolePermissions, setRolePermissions] = useState<Record<string, { can_view: boolean; can_edit: boolean; can_add: boolean; can_delete: boolean }> | null>(null);
    useEffect(() => {
        if (!pharmacyId || !currentUser?.role) { setRolePermissions(null); return; }
        if (currentUser.role === "admin") { setRolePermissions("admin" as any); return; }
        supabase
            .from("role_permissions")
            .select("section, sub_section, can_view, can_edit, can_add, can_delete")
            .eq("pharmacy_id", pharmacyId)
            .eq("role", currentUser.role)
            .then(({ data }) => {
                const map: Record<string, { can_view: boolean; can_edit: boolean; can_add: boolean; can_delete: boolean }> = {};
                (data || []).forEach((r: any) => {
                    map[permKey(r.section, r.sub_section)] = {
                        can_view: r.can_view,
                        can_edit: r.can_edit,
                        can_add: r.can_add,
                        can_delete: r.can_delete,
                    };
                });
                setRolePermissions(map);
            });
    }, [pharmacyId, currentUser?.role]);

    // ── الأدمن دايمًا عنده كل الصلاحيات. أثناء التحميل لا نمنع شيء تفاديًا لوميض الواجهة. ──
    const canView = useCallback((section: string, sub?: string) => {
        if (rolePermissions === "admin" || rolePermissions === null) return true;
        const direct = rolePermissions[permKey(section, sub)];
        if (direct) return direct.can_view;
        // لو مفيش صلاحية محفوظة لعنصر فرعي بالذات، استخدم صلاحية القسم العام كافتراضي
        if (sub) return rolePermissions[permKey(section)]?.can_view ?? true;
        return true;
    }, [rolePermissions]);

    // ── إضافة عنصر جديد (منتج/مورد/عميل/... حسب القسم) ──
    const canAdd = useCallback((section: string, sub?: string) => {
        if (rolePermissions === "admin" || rolePermissions === null) return true;
        const direct = rolePermissions[permKey(section, sub)];
        if (direct) return direct.can_add;
        if (sub) return rolePermissions[permKey(section)]?.can_add ?? false;
        return false;
    }, [rolePermissions]);

    // ── حذف عنصر موجود ──
    const canDelete = useCallback((section: string, sub?: string) => {
        if (rolePermissions === "admin" || rolePermissions === null) return true;
        const direct = rolePermissions[permKey(section, sub)];
        if (direct) return direct.can_delete;
        if (sub) return rolePermissions[permKey(section)]?.can_delete ?? false;
        return false;
    }, [rolePermissions]);

    const canEdit = useCallback((section: string, sub?: string) => {
        if (rolePermissions === "admin" || rolePermissions === null) return true;
        const direct = rolePermissions[permKey(section, sub)];
        if (direct) return direct.can_edit;
        if (sub) return rolePermissions[permKey(section)]?.can_edit ?? false;
        return false;
    }, [rolePermissions]);

    const [posInvoices, setPosInvoices] = useState([emptyInvoice()]);
    const [posActiveTab, setPosActiveTab] = useState(0);

    // ═══════════════════════════════════════════════════
    // 🆕 حفظ سلة نقطة البيع (بكل تابات الفواتير المفتوحة) في localStorage —
    // عشان لو الجهاز فصل أو المتصفح قفل فجأة أثناء العمل على فاتورة بيع، ترجع تلاقيها
    // تاني بمجرد ما تفتح البرنامج، مش بس عند التنقل بين التابات.
    // ═══════════════════════════════════════════════════
    const posDraftKey = `pharmacypro_pos_draft_${pharmacyId}`;
    const posDraftRestoredRef = useRef(false);
    const [posDraftHydrated, setPosDraftHydrated] = useState(false);

    useEffect(() => {
        if (posDraftRestoredRef.current || !pharmacyId) return;
        posDraftRestoredRef.current = true;
        try {
            const raw = localStorage.getItem(posDraftKey);
            if (raw) {
                const draft = JSON.parse(raw);
                if (Array.isArray(draft) && draft.some((inv) => inv?.cart?.length > 0)) {
                    setPosInvoices(draft);
                    showToast("↩️ تم استرجاع فاتورة/فواتير بيع لم تكتمل");
                }
            }
        } catch { }
        // 🆕 مهم: منفعّلش حفظ المسودة إلا بعد ما نخلّص محاولة الاسترجاع دي فعليًا،
        // عشان تأثير الحفظ (تحت) ميشتغلش بحالة قديمة فاضية ويمسح المسودة قبل لما تتقرأ في الواجهة.
        setPosDraftHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pharmacyId]);

    useEffect(() => {
        if (!pharmacyId || !posDraftHydrated) return;
        try {
            const hasItems = posInvoices.some((inv) => inv?.cart?.length > 0);
            if (hasItems) {
                localStorage.setItem(posDraftKey, JSON.stringify(posInvoices));
            } else {
                localStorage.removeItem(posDraftKey);
            }
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [posInvoices, pharmacyId, posDraftHydrated]);

    // ═══════════════════════════════════════════════════
    // 🆕 فاتورة الشراء الجاري إدخالها — رفعناها هنا (بدل ما تكون state محلي جوه PurchaseModule)
    // عشان ماتضيعش خالص لما الصيدلي يتنقّل بين التابات (مثلاً يروح نقطة البيع ويرجع).
    // PurchaseModule بيتقفل ويتفتح تاني كل مرة تتغير فيها التاب، لكن دلوقتي البيانات هنا
    // في App نفسه اللي مش بيتقفل، فمش بتتأثر خالص — أضمن من أي حفظ في localStorage.
    // بنحتفظ كمان بنسخة احتياطية في localStorage تحسبًا لفصل الجهاز أو إغلاق المتصفح فجأة —
    // وبنستخدم نفس أسلوب "بوابة الاسترجاع" اللي استخدمناه في نقطة البيع، عشان pharmacyId
    // مش معروف أول ما الصفحة تفتح (لسه بيتحمّل من الـ session)، فمينفعش نقرأ localStorage
    // كـ initializer عادي — لازم نستنى لحد ما pharmacyId يتحدد فعليًا بعد تسجيل الدخول.
    // ═══════════════════════════════════════════════════
    const purchaseDraftKey = `pharmacypro_purchase_draft_${pharmacyId}`;
    const [purchShowNew, setPurchShowNew] = useState(false);
    const [purchItems, setPurchItems] = useState([]);
    const [purchSelSupplier, setPurchSelSupplier] = useState("");
    const [purchManualSubtotal, setPurchManualSubtotal] = useState("");
    const [purchManualTax, setPurchManualTax] = useState("");
    const purchDraftRestoredRef = useRef(false);
    const [purchDraftHydrated, setPurchDraftHydrated] = useState(false);

    useEffect(() => {
        if (purchDraftRestoredRef.current || !pharmacyId) return;
        purchDraftRestoredRef.current = true;
        try {
            const raw = localStorage.getItem(purchaseDraftKey);
            if (raw) {
                const draft = JSON.parse(raw);
                if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
                    setPurchItems(draft.items);
                    setPurchSelSupplier(draft.selSupplier || "");
                    setPurchManualSubtotal(draft.manualSubtotal || "");
                    setPurchManualTax(draft.manualTax || "");
                    setPurchShowNew(true);
                    showToast("↩️ تم استرجاع مسودة فاتورة شراء لم تكتمل");
                }
            }
        } catch { }
        // 🆕 مهم: منفعّلش الحفظ إلا بعد محاولة الاسترجاع دي، عشان تأثير الحفظ (تحت)
        // ميشتغلش بحالة قديمة فاضية ويمسح المسودة قبل ما تتقرأ فعليًا.
        setPurchDraftHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pharmacyId]);

    useEffect(() => {
        if (!pharmacyId || !purchDraftHydrated) return;
        try {
            if (purchShowNew && purchItems.length > 0) {
                localStorage.setItem(purchaseDraftKey, JSON.stringify({
                    items: purchItems, selSupplier: purchSelSupplier, manualSubtotal: purchManualSubtotal, manualTax: purchManualTax,
                }));
            } else {
                localStorage.removeItem(purchaseDraftKey);
            }
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [purchItems, purchSelSupplier, purchManualSubtotal, purchManualTax, purchShowNew, pharmacyId, purchDraftHydrated]);

    const [posPromos, setPosPromos] = useState([]);
    const [posDiscountRules, setPosDiscountRules] = useState([
        { days: 90, discount: 50, color: COLORS.red },
        { days: 120, discount: 25, color: COLORS.coral },
        { days: 150, discount: 20, color: COLORS.gold },
        { days: 180, discount: 15, color: COLORS.gold },
    ]);
    // 🆕 إعدادات العروض التلقائية (استبعاد فئات + شرط مخزون + أقل خصم + إعدادات الراكد) — نفس الحالة
    // بيقرا منها تبويب "العروض" وبتتطبق فعليًا في نقطة البيع (getEffectivePrice)
    const [posAutoPromoConfig, setPosAutoPromoConfig] = useState(DEFAULT_AUTO_PROMO_CONFIG);
    const posProductEarliestExpiry = useMemo(() => {
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
            if (p.expiry && (!map[p.id] || p.expiry < map[p.id])) map[p.id] = p.expiry;
        });
        return map;
    }, [purchases, products]);
    const posProductFirstStocked = useMemo(() => {
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
    // تحميل العروض وقواعد الخصم وإعدادات العروض التلقائية للـ POS
    // 🆕 كل استعلام هنا بيتحقق من error بشكل صريح (زي loadData الرئيسية بالظبط)، لأن
    // supabase-js مش بيرمي على فشل الشبكة — بيرجع { data: null, error }. لو فشل، بنقرا
    // آخر نسخة معروفة من الكاش المحلي (SQLite) بدل ما نسيب الـ POS من غير عروض/قواعد خصم
    // خالص. ولو نجح، بنعمل mirror فوري للكاش عشان يبقى جاهز للمرة الجاية اللي هتحصل أوفلاين.
    useEffect(() => {
        if (!pharmacyId) return;

        supabase.from("promotions").select("*").eq("pharmacy_id", pharmacyId).order("end_date")
            .then(async ({ data, error }) => {
                if (!error && data) {
                    setPosPromos(data);
                    try {
                        await window.offlineAPI?.refreshPromotionsCache?.({ pharmacyId, promotions: data });
                    } catch (err) {
                        console.error("refreshPromotionsCache failed:", err);
                    }
                } else {
                    try {
                        const cached = await window.offlineAPI?.getPromotionsCache?.(pharmacyId);
                        if (cached && cached.length > 0) setPosPromos(cached);
                    } catch (err) {
                        console.error("getPromotionsCache failed:", err);
                    }
                }
            });

        supabase.from("promo_rules").select("*").eq("pharmacy_id", pharmacyId).order("days")
            .then(async ({ data, error }) => {
                if (!error && data && data.length > 0) {
                    setPosDiscountRules(data);
                    try {
                        await window.offlineAPI?.replacePromoRulesCache?.({ pharmacyId, rows: data });
                    } catch (err) {
                        console.error("replacePromoRulesCache failed:", err);
                    }
                } else if (error) {
                    try {
                        const cached = await window.offlineAPI?.getPromoRulesCache?.(pharmacyId);
                        if (cached && cached.length > 0) setPosDiscountRules(cached);
                    } catch (err) {
                        console.error("getPromoRulesCache failed:", err);
                    }
                }
            });

        supabase.from("promo_settings").select("auto_config").eq("pharmacy_id", pharmacyId).maybeSingle()
            .then(async ({ data, error }) => {
                if (!error && data?.auto_config) {
                    setPosAutoPromoConfig((prev) => ({ ...prev, ...data.auto_config }));
                    try {
                        await window.offlineAPI?.upsertPromoSettingsCache?.({ pharmacyId, data: { auto_config: data.auto_config } });
                    } catch (err) {
                        console.error("upsertPromoSettingsCache failed:", err);
                    }
                } else if (error) {
                    try {
                        const cached = await window.offlineAPI?.getPromoSettingsCache?.(pharmacyId);
                        if (cached?.auto_config) setPosAutoPromoConfig((prev) => ({ ...prev, ...cached.auto_config }));
                    } catch (err) {
                        console.error("getPromoSettingsCache failed:", err);
                    }
                }
            });
    }, [pharmacyId]);
    const [isLoading, setIsLoading] = useState(false);
    const showToast = useCallback((msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // إخراج الأصناف منتهية الصلاحية من المخزون الفعلي (يستخدمها تقرير الصلاحيات)
    // بيشيل بس التشغيلات (batches) المنتهية المحددة من كل صنف، وبيحدّث الكمية
    // الإجمالية للصنف تبعًا لذلك، وبيسجّل العملية في سجل العمليات (audit log).
    const handleRemoveExpiredStock = useCallback(
        async (expiredItems) => {
            if (!expiredItems || expiredItems.length === 0) return;
            const totalQty = expiredItems.reduce((s, i) => s + (i.stock || 0), 0);
            const confirmed = window.confirm(
                `هيتم إخراج ${expiredItems.length} تشغيلة منتهية الصلاحية (إجمالي ${totalQty} وحدة) من المخزون نهائيًا. هل تريد المتابعة؟`
            );
            if (!confirmed) return;

            // تجميع التشغيلات المنتهية حسب الصنف
            const byProduct = {};
            expiredItems.forEach((i) => {
                if (!byProduct[i.productId]) byProduct[i.productId] = [];
                byProduct[i.productId].push(i);
            });

            const updates = Object.keys(byProduct).map((productId) => {
                const prod = products.find((x) => x.id === productId);
                const toRemove = byProduct[productId];
                const remainingBatches = (prod?.batches || []).filter(
                    (b) =>
                        !toRemove.some(
                            (r) =>
                                (r.expiry || "") === (b.expiry_date || "") &&
                                (r.batchNumber || null) === (b.batch_number || null)
                        )
                );
                const newStock = remainingBatches.reduce((s, b) => s + (b.qty || 0), 0);
                return { productId, prod, remainingBatches, newStock, removedQty: toRemove.reduce((s, r) => s + (r.stock || 0), 0) };
            });

            try {
                await Promise.all(
                    updates.map((u) =>
                        supabase
                            .from("products")
                            .update({ stock: u.newStock, batches: u.remainingBatches })
                            .eq("id", u.productId)
                            .eq("pharmacy_id", pharmacyId)
                    )
                );

                setProducts((prev) =>
                    prev.map((x) => {
                        const u = updates.find((uu) => uu.productId === x.id);
                        return u ? { ...x, stock: u.newStock, batches: u.remainingBatches } : x;
                    })
                );

                await Promise.all(
                    updates.map((u) =>
                        logAudit({
                            pharmacyId,
                            userName: currentUser?.name,
                            action: "update",
                            entityType: "product",
                            entityId: u.productId,
                            entityLabel: u.prod?.name,
                            description: `إخراج ${u.removedQty} وحدة منتهية الصلاحية من المخزون (تقرير الصلاحيات)`,
                            oldValue: { stock: u.prod?.stock, batches: u.prod?.batches },
                            newValue: { stock: u.newStock, batches: u.remainingBatches },
                        })
                    )
                );

                // إبلاغ رصد (SFDA) بإخراج الأصناف المنتهية — عن طريق نفس طابور رصد المستخدم
                // في باقي العمليات (بيع/إرجاع)، عشان لو رصد واقع أو مفيش نت دلوقتي، العملية
                // هتترفع تلقائيًا أول ما الاتصال يرجع، من غير ما توقف إخراج المخزون المحلي.
                let rasdQueued = false;
                try {
                    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
                    if (rasdConfig.enabled) {
                        const rasdItems = expiredItems
                            .map((i) => {
                                const prod = products.find((x) => x.id === i.productId);
                                const gtin = prod?.gtin || prod?.barcode;
                                if (!gtin) return null;
                                return { gtin, quantity: i.stock, batch: i.batchNumber || undefined, expiry: i.expiry };
                            })
                            .filter(Boolean);
                        if (rasdItems.length > 0) {
                            RasdQueue.enqueue("deactivate", {
                                dr: "20", // سحب بسبب انتهاء الصلاحية
                                explanation: "إخراج تلقائي من تقرير الصلاحيات",
                                items: rasdItems,
                            });
                            rasdQueued = true;
                        }
                    }
                } catch (e) {
                    console.error("rasd deactivate enqueue failed:", e);
                }

                showToast(
                    `✓ تم إخراج ${totalQty} وحدة منتهية الصلاحية من المخزون` +
                    (rasdQueued ? " — وتم إرسال إشعار الإخراج لرصد" : "")
                );
            } catch (e) {
                showToast("❌ حصل خطأ أثناء إخراج الأصناف المنتهية: " + (e?.message || ""), "error");
            }
        },
        [products, pharmacyId, currentUser, showToast]
    );

    // تشغيل الرفع التلقائي الدوري لعمليات رصد المتراكمة (Queue)
    useEffect(() => {
        RasdQueue.start(showToast);
        return () => RasdQueue.stop();
    }, [showToast]);

    const currentShift = shifts.find(
        (s) => !s.end_time && s.user === currentUser?.name
    );

    // ══════════════════════════════════════════════════════════════════
    // 🆕 تحميل بيانات الصيدلية من Supabase — مع الحفاظ على النسخة المحلية
    // (localStorage عن طريق useStorage) لو التحميل فشل بسبب انقطاع النت.
    // قبل كده كان أول حاجة بتحصل هي مسح كل الـ state بـ setProducts([]) ...إلخ،
    // فلو الفetch فشل أوفلاين، الشاشة كانت بتفضل فاضية تمامًا حتى لو عندنا
    // نسخة قديمة سليمة محفوظة على القرص. دلوقتي منمسحش أي حاجة قبل ما نعرف
    // نتيجة التحميل، ولو فشل بنسيب الحالة الحالية (المسترجعة من localStorage
    // تلقائيًا عند فتح الصفحة) زي ما هي، بدل ما نفرغها.
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const loadData = async () => {
            if (!pharmacyId) return;
            setIsLoading(true);

            try {
                const [p, s, c, sa, pu, ret, cp, inv, mfr, rasdRow, allProdIng, jkp, altBc] = await Promise.all([
                    supabase.from("products").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("suppliers").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("customers").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("sales").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("purchases").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("returns").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("credit_payments").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("inventory_logs").select("*").eq("pharmacy_id", pharmacyId).order("date", { ascending: false }),
                    supabase.from("manufacturers").select("*").eq("pharmacy_id", pharmacyId),
                    supabase.from("pharmacy_settings").select("rasd_config").eq("pharmacy_id", pharmacyId).maybeSingle(),
                    // 🆕 كل صفوف تركيبة الأصناف (مش بس المادة الأولى) عشان البحث والعرض يشملوا التركيبة كاملة
                    supabase.from("product_ingredients").select("product_id, concentration, active_ingredients(name_ar, name_en)").eq("pharmacy_id", pharmacyId),
                    // 🆕 أصناف الجوكر المعلقة (لسه محتاجة تدخل طلب شراء أو تترربط بصنف حقيقي)
                    supabase.from("joker_pending_items").select("*").eq("pharmacy_id", pharmacyId),
                    // 🆕 الباركودات البديلة البسيطة (مش دفعات GS1) لكل الأصناف — نفس نمط product_ingredients
                    supabase.from("product_alt_barcodes").select("product_id, barcode").eq("pharmacy_id", pharmacyId),
                ]);

                // 🆕 مهم جدًا: عميل Supabase مش بيرمي (throw) لما الطلب يفشل بسبب مشكلة نت —
                // بيرجع { data: null, error: {...} } عادي. لو مانتحققش من error هنا، هنكمل
                // ونمسح الحالة بـ (p.data ?? []) رغم إننا أوفلاين فعليًا. أول خطأ حقيقي بيوقفنا
                // فورًا (بنرميه إحنا يدويًا) عشان الـ catch تحت يمسكه ويحافظ على النسخة المحلية.
                const results = { p, s, c, sa, pu, ret, cp, inv, mfr, allProdIng, jkp, altBc };
                for (const [key, res] of Object.entries(results)) {
                    if (res?.error) {
                        throw new Error(`فشل تحميل ${key}: ${res.error.message || res.error}`);
                    }
                }

                // 🆕 نبني خريطة: product_id → قائمة كل المواد الفعالة (مش بس أول واحدة زي الحقل القديم products.active_ingredient)
                const ingredientsByProduct = {};
                (allProdIng.data ?? []).forEach((row) => {
                    const nm = row.active_ingredients?.name_ar || row.active_ingredients?.name_en || "";
                    if (!nm) return;
                    const label = row.concentration ? `${nm} ${row.concentration}` : nm;
                    (ingredientsByProduct[row.product_id] ||= []).push(label);
                });
                // 🆕 نفس نمط ingredientsByProduct بالظبط، بس للباركودات البديلة —
                // خريطة product_id → قائمة أرقام باركود إضافية (غير الـ GTIN الرئيسي)
                const altBarcodesByProduct = {};
                (altBc.data ?? []).forEach((row) => {
                    (altBarcodesByProduct[row.product_id] ||= []).push(row.barcode);
                });
                // 🆕 مرآة إعدادات رصد من السوبابيز (مصدر الحقيقة) لـ localStorage عشان كل الأماكن
                // اللي بتقرا الإعداد بشكل sync (طابور رصد، حفظ الفواتير، ...) تشتغل بأحدث نسخة
                // من غير ما تحتاج تتحول كلها لـ async.
                if (rasdRow?.data?.rasd_config) {
                    localStorage.setItem("rasd_config", JSON.stringify(rasdRow.data.rasd_config));
                }
                setProducts(
                    (p.data ?? []).map((row) => ({
                        ...row,
                        // ── توحيد الأسماء بين الداتابيز (snake_case) والكود (camelCase) ──
                        // ملاحظة: نحتفظ بالحقول الخام (row.*) كما هي بجانب النسخة المُعدّلة،
                        // فأي كود قديم يقرأ snake_case مباشرة يستمر في العمل بدون كسر.
                        saleUnits: row.sale_units || row.unit_division || null,
                        packageType: row.package_type || row.unit || "",
                        dosageForm: row.dosage_form || "",
                        // 🆕 التركيبة كاملة (كل المواد الفعالة)، مع رجوع للحقل القديم لو الصنف لسه مسجل بالطريقة القديمة بس
                        full_ingredients: ingredientsByProduct[row.id] || (row.active_ingredient ? [`${row.active_ingredient}${row.concentration ? " " + row.concentration : ""}`] : []),
                        full_ingredients_text: (ingredientsByProduct[row.id] || (row.active_ingredient ? [`${row.active_ingredient}${row.concentration ? " " + row.concentration : ""}`] : [])).join(" + "),
                        // 🆕 الباركودات البديلة البسيطة المسجلة لنفس الصنف — يستخدمها السكانر في
                        // POS/الجرد كخطوة مطابقة إضافية لو الباركود الرئيسي (barcode/gtin) مطابقش
                        altBarcodes: altBarcodesByProduct[row.id] || [],
                    }))
                );
                // 🆕 full sync للكاش المحلي (SQLite بدل localStorage) — بيتحدث بنفس بيانات
                // Supabase الطازجة كل ما التحميل ينجح، عشان لو قفلت البرنامج أوفلاين تلاقي
                // آخر نسخة معروفة من كل الأصناف، من غير حدود حجم localStorage.
                try {
                    await window.offlineAPI?.upsertProductsCache?.({ pharmacyId, products: p.data ?? [] });
                } catch (err) {
                    console.error("upsertProductsCache failed:", err);
                }
                setSuppliers(s.data ?? []);
                setCustomers(c.data ?? []);
                setSales(
                    (sa.data ?? []).map((row) => ({
                        ...row,
                        returnDate: row.return_date ?? row.returnDate ?? undefined,
                    }))
                );
                setReturnsData(ret.data ?? []);
                setCreditPayments(cp.data ?? []);
                setInventoryLogs(inv.data ?? []);
                setManufacturers(mfr.data ?? []);
                setJokerPendingItems(jkp.data ?? []);
                setPurchases(
                    (pu.data ?? []).map((item) => ({
                        ...item,
                        supplierName: item.supplier_name,
                        taxAmount: item.tax_amount ?? 0,
                        subtotal: item.subtotal ?? 0,
                        total: item.total ?? 0,
                        items: item.items ?? [],
                    }))
                );
            } catch (err) {
                // 🆕 فشل التحميل (غالبًا مشكلة نت/أوفلاين) — منمسحش أي state هنا.
                // products/suppliers/customers/sales/purchases/returnsData/jokerPendingItems
                // أصلاً محفوظين في localStorage عن طريق useStorage ومسترجعين تلقائيًا
                // من أول render، فبيفضلوا زي ما هما (آخر نسخة معروفة). باقي الحالات
                // (inventoryLogs, manufacturers, creditPayments) مش متخزنة محليًا فهتفضل فاضية.
                console.error("loadData failed, keeping cached local state:", err);
                showToast("⚠️ لا يوجد اتصال بالإنترنت — يتم استخدام آخر نسخة محفوظة محليًا", "warning");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [pharmacyId]);

    // ✅ تم نقل هذا البلوك لفوق الـ early returns لتفادي خطأ React #310
    // (الـ hooks لازم تتنفذ بنفس الترتيب في كل render، مش بشكل شرطي)
    const essentialAlerts = useEssentialAlerts(products);
    const tabAlertCounts = useMemo(() => {
        const lowStockCount = products.filter((p) => p.stock <= (p.min_stock || p.minStock || 0)).length;
        const expiringCount = products.filter((p) => {
            if (!p.expiry) return false;
            const diff = (new Date(p.expiry) - new Date()) / (1000 * 60 * 60 * 24);
            return diff < 90 && diff > 0;
        }).length;
        const supplierDueCount = (suppliers || []).filter((s) => {
            const supPurchases = (purchases || []).filter((p) => p.supplier === s.id && p.payment_status !== "مسددة");
            return supPurchases.some((po) => {
                const due = new Date(po.date);
                due.setDate(due.getDate() + (s.payment_terms || 30));
                const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
                return daysLeft <= 5;
            });
        }).length;
        const disappearedCount = (customers || []).filter((c) => {
            if (!c.lastVisit) return false;
            const days = (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
            return days > 45 && days < 365 && (c.visits || 0) > 0;
        }).length;
        const newCustomersCount = (customers || []).filter((c) => {
            if (!c.created_at) return false;
            const days = (new Date() - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
            return days <= 7;
        }).length;
        // 🆕 عملاء متأخرين في سداد مديونية الآجل (حسب فترة السداد الخاصة بكل عميل)
        const customerOverdueCount = (customers || []).filter((c) => {
            const ajilSales = (sales || []).filter((s) => s.customer === c.id && s.payment === "آجل");
            if (ajilSales.length === 0) return false;
            const terms = c.payment_terms || 30;
            return ajilSales.some((inv) => {
                const totalPaid = (creditPayments || [])
                    .filter((p) => p.invoice_id === inv.id)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);
                const remaining = (inv.total || 0) - totalPaid;
                if (remaining <= 0.01) return false;
                const due = new Date(inv.created_at || inv.date);
                due.setDate(due.getDate() + terms);
                const daysLeft = Math.floor((due - new Date()) / (1000 * 60 * 60 * 24));
                return daysLeft < 0;
            });
        }).length;
        const now = new Date();
        const quarterEndMonth = [2, 5, 8, 11].find((m) => m >= now.getMonth()) ?? 2;
        const qEnd = new Date(now.getFullYear(), quarterEndMonth + 1, 0);
        const taxDaysLeft = Math.ceil((qEnd - now) / (1000 * 60 * 60 * 24));
        return {
            products: lowStockCount + expiringCount + essentialAlerts.length,
            suppliers: supplierDueCount,
            customers: disappearedCount + newCustomersCount + customerOverdueCount,
            tax_report: taxDaysLeft <= 14 ? 1 : 0,
        };
    }, [products, suppliers, purchases, customers, essentialAlerts, sales, creditPayments]);

    // لو لسه بيتحقق من الجلسة، نعرض شاشة انتظار بسيطة
    if (!authChecked)
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100vh", background: COLORS.appBg, color: "#888", flexDirection: "column", gap: 12
            }}>
                <div style={{ fontSize: 28 }}>💊</div>
                <div style={{ fontSize: 14 }}>جارٍ التحقق من الجلسة...</div>
            </div>
        );

    if (!currentUser)
        return (
            <Login
                users={users}
                onLogin={async (username, password) => {
                    const u = await authService.login(username, password);
                    setCurrentUser(u);
                    setTab("dashboard");
                }}
            />
        );

    if (currentUser.is_super_admin && !viewAsPharmacy) {
        return (
            <SuperAdminPanel
                currentUser={currentUser}
                onLogout={async () => {
                    await authService.logout();
                    setCurrentUser(null);
                }}
                onEnterPharmacy={currentUser.pharmacy_id ? () => setViewAsPharmacy(true) : undefined}
            />
        );
    }

    if (isLoading) return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.appBg,
            flexDirection: "column",
            gap: 16,
            fontFamily: "'Tajawal',sans-serif",
        }}>
            <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: COLORS.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.accentText,
            }}>
                <IC n="pill" s={28} />
            </div>
            <div style={{ color: COLORS.textDim, fontSize: 15 }}>
                جاري تحميل البيانات...
            </div>
        </div>
    );

    const TABS = [
        // ── الرئيسية ──
        { id: "dashboard", label: "الرئيسية", icon: "dashboard" },

        // ── الفريق والالتزام ──
        { id: "shift", label: "الشفتات", icon: "shift" },
        { id: "attendance", label: "الحضور والانصراف", icon: "shift" },

        // ── العملاء والمبيعات ──
        { id: "customers", label: "العملاء", icon: "customers" },
        { id: "loyalty", label: "نقاط الولاء", icon: "star" },
        { id: "pos", label: "نقطة البيع", icon: "pos" },
        { id: "sales_returns", label: "مرتجع المبيعات", icon: "returns" },
        { id: "promotions", label: "العروض", icon: "tag" },
        { id: "target", label: "🎯 تارجت المبيعات والتحفيز", icon: "target" },

        // ── المخزون والموردين ──
        { id: "purchase", label: "فواتير الشراء", icon: "purchase" },
        { id: "products", label: "الأصناف", icon: "inventory" },
        { id: "suppliers", label: "الموردون", icon: "suppliers" },
        { id: "purchase_returns", label: "مرتجع المشتريات", icon: "returns" },
        { id: "inventory_count", label: "الجرد", icon: "count" },
        { id: "inventory_statement", label: "كشف المخزون", icon: "inventory" },

        // ── التقارير ──
        { id: "expiry_report", label: "تقرير تواريخ الصلاحية", icon: "alert" },
        { id: "reports", label: "التقارير", icon: "reports" },
        { id: "tax_report", label: "تقرير ضريبي", icon: "tax" },

        // ── الإدارة ──
        { id: "financial_health", label: "الموقف المالي", icon: "money" },
        { id: "treasury", label: "الخزنة", icon: "money" },
        { id: "pharmacy_settings", label: "بيانات الصيدلية", icon: "settings" },
        { id: "permissions", label: "الصلاحيات", icon: "settings" },
        { id: "rasd_settings", label: "إعدادات رصد", icon: "settings" },
        { id: "audit_log", label: "سجل العمليات", icon: "reports" },
    ];

    return (
        <div
            dir="rtl"
            className={currentUser?.readOnly ? "app-readonly" : ""}
            style={{
                fontFamily: "'Tajawal',sans-serif",
                position: "relative",
                minHeight: "100vh",
                color: COLORS.textPrimary,
                display: "flex",
            }}
        >
            {currentUser?.readOnly && (
                <style>{`
          .app-readonly .content-area button:not(.readonly-allow) {
            pointer-events: none !important;
            opacity: 0.45 !important;
            cursor: not-allowed !important;
            filter: grayscale(40%);
          }
        `}</style>
            )}
            {currentUser?.readOnly && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: "#f59e0b",
                        color: "#1a1a1a",
                        textAlign: "center",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    ⚠️ انتهت الفترة التجريبية — وضع القراءة فقط. تواصل مع الدعم لتجديد الاشتراك وتفعيل الإضافة والتعديل.
                </div>
            )}
            <PharmacyShelfBackground />
            <link
                href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
                rel="stylesheet"
            />
            {toast && <Toast {...toast} />}

            {/* SIDEBAR */}
            <nav
                style={{
                    width: 210,
                    background: "rgba(255,255,255,0.6)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderLeft: "1px solid rgba(0,180,160,0.15)",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    position: "sticky",
                    zIndex: 1,
                    top: 0,
                    height: "100vh",
                    overflowY: "auto",
                    borderRight: `1px solid ${COLORS.border}`,
                }}
            >
                <div
                    style={{
                        padding: "20px 16px 16px",
                        borderBottom: `1px solid ${COLORS.border}`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: COLORS.accent,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: COLORS.accentText,
                                flexShrink: 0,
                            }}
                        >
                            <PharmaLogo size={20} variant="mark" markColor={COLORS.accent} />
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: COLORS.textPrimary,
                                    lineHeight: 1.2,
                                }}
                            >
                                فارماجو 360
                            </div>
                            <div style={{ fontSize: 10, color: COLORS.textDim }}>نظام متكامل</div>
                        </div>
                    </div>
                    <div
                        style={{
                            marginTop: 12,
                            padding: "8px 10px",
                            background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <IC n="user" s={14} />
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: COLORS.textPrimary,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {currentUser.name}
                            </div>
                            <div style={{ fontSize: 10, color: COLORS.textDim }}>
                                {currentUser.role === "admin" ? "مدير" : "صيدلاني"}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, padding: "8px 0" }}>
                    {(() => {
                        const GROUP_COLORS = {
                            team: COLORS.green,
                            sales: COLORS.blue,
                            stock: COLORS.coral,
                            reports: COLORS.purple,
                            admin: COLORS.gold,
                            main: COLORS.accent,
                        };

                        const groups = [
                            { label: null, color: GROUP_COLORS.main, ids: ["dashboard"] },
                            { label: "الفريق والالتزام", color: GROUP_COLORS.team, ids: ["shift", "attendance"] },
                            { label: "العملاء والمبيعات", color: GROUP_COLORS.sales, ids: ["customers", "loyalty", "pos", "sales_returns", "promotions", "target"] },
                            { label: "المخزون والموردين", color: GROUP_COLORS.stock, ids: ["purchase", "products", "suppliers", "purchase_returns", "inventory_count", "inventory_statement"] },
                            { label: "التقارير", color: GROUP_COLORS.reports, ids: ["expiry_report", "reports", "tax_report", "financial_health", "treasury"] },
                            { label: "الإدارة", color: GROUP_COLORS.admin, ids: ["pharmacy_settings", "permissions", "rasd_settings", "audit_log"] },
                        ];

                        // ── ربط معرّف التاب في السايدبار بمعرّف القسم/الفرعي في نظام الصلاحيات (SYSTEM_SECTIONS) ──
                        const SIDEBAR_TAB_PERM: Record<string, [string, string?]> = {
                            sales_returns: ["returns", "sales"],
                            purchase_returns: ["returns", "purchases"],
                        };
                        const canViewSidebarTab = (id: string) => {
                            const [section, sub] = SIDEBAR_TAB_PERM[id] || [id, undefined];
                            return canView(section, sub);
                        };

                        // إيجاد لون التاب الحالي
                        const activeGroup = groups.find(g => g.ids.includes(tab));
                        const activeColor = activeGroup?.color || GROUP_COLORS.main;

                        // إخفاء مجموعة "الإدارة" بالكامل عن أي مستخدم غير أدمن، وفلترة باقي التابات حسب صلاحيات role_permissions
                        const isAdminUser = currentUser?.role === "admin";
                        const visibleGroups = groups
                            .filter((g) => g.label !== "الإدارة" || isAdminUser)
                            .map((g) => ({ ...g, ids: g.ids.filter((id) => canViewSidebarTab(id)) }))
                            .filter((g) => g.ids.length > 0);

                        return visibleGroups.map((group, gi) => (
                            <div key={gi}>
                                {group.label && (
                                    <div style={{
                                        padding: "10px 16px 4px",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: group.color,
                                        opacity: 0.7,
                                        letterSpacing: "0.05em",
                                        marginTop: 4,
                                    }}>
                                        {group.label}
                                    </div>
                                )}
                                {group.ids.map((id) => {
                                    const t = TABS.find((x) => x.id === id);
                                    if (!t) return null;
                                    const isActive = tab === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setTab(t.id)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                padding: "9px 16px",
                                                width: "100%",
                                                background: isActive ? `${group.color}18` : "transparent",
                                                borderRight: isActive ? `3px solid ${group.color}` : "3px solid transparent",
                                                borderTop: "none",
                                                borderBottom: "none",
                                                borderLeft: "none",
                                                color: isActive ? group.color : COLORS.textDim,
                                                fontSize: 12,
                                                fontWeight: isActive ? 700 : 400,
                                                cursor: "pointer",
                                                textAlign: "right",
                                                transition: "all 0.12s",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 9,
                                                    flexShrink: 0,
                                                    background: isActive
                                                        ? `linear-gradient(145deg, ${group.color}, ${group.color}cc)`
                                                        : `linear-gradient(145deg, ${group.color}22, ${group.color}0d)`,
                                                    boxShadow: isActive
                                                        ? `0 3px 8px ${group.color}55, inset 0 1px 0 rgba(255,255,255,0.25)`
                                                        : `inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.04)`,
                                                    color: isActive ? "#fff" : group.color,
                                                    transition: "all 0.15s",
                                                }}
                                            >
                                                <IC n={t.icon} s={15} sw={2.1} />
                                            </span>
                                            <span style={{ flex: 1 }}>{t.label}</span>
                                            {tabAlertCounts[t.id] > 0 && (
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px",
                                                    borderRadius: 99, background: COLORS.redSoft, color: COLORS.red,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontFamily: "monospace",
                                                }}>
                                                    {tabAlertCounts[t.id]}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ));
                    })()}
                </div>

                <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.border}` }}>
                    {currentShift ? (
                        <div
                            style={{
                                background: COLORS.greenSoft,
                                border: `1px solid ${COLORS.green}`,
                                borderRadius: 8,
                                padding: "8px 10px",
                                marginBottom: 10,
                                color: COLORS.green,
                                fontSize: 11,
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>شفت مفتوح</div>
                            <div style={{ color: COLORS.green, opacity: 0.8 }}>{currentShift.start}</div>
                        </div>
                    ) : (
                        <div
                            style={{
                                background: COLORS.goldSoft,
                                border: `1px solid ${COLORS.gold}`,
                                borderRadius: 8,
                                padding: "8px 10px",
                                marginBottom: 10,
                                color: COLORS.gold,
                                fontSize: 11,
                            }}
                        >
                            لا يوجد شفت مفتوح
                        </div>
                    )}
                    {currentUser.is_super_admin && viewAsPharmacy && (
                        <button
                            onClick={() => {
                                setViewAsPharmacy(false);
                                setTab("dashboard");
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                width: "100%",
                                padding: "9px 10px",
                                background: COLORS.greenSoft,
                                border: `1px solid ${COLORS.green}`,
                                borderRadius: 8,
                                color: COLORS.green,
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 8,
                                cursor: "pointer",
                            }}
                        >
                            <IC n="user" s={14} />
                            رجوع للوحة السوبر أدمن
                        </button>
                    )}
                    <button
                        onClick={async () => {
                            await authService.logout();
                            setCurrentUser(null);
                            setTab("dashboard");
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "9px 10px",
                            background: COLORS.redSoft,
                            border: `1px solid ${COLORS.red}`,
                            borderRadius: 8,
                            color: COLORS.red,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        <IC n="logout" s={15} />
                        خروج
                    </button>
                </div>
            </nav>
            {/* GRADIENT DIVIDER */}
            <div style={{
                width: 1,
                background: `linear-gradient(to bottom, transparent, ${COLORS.border} 20%, ${COLORS.accent} 50%, ${COLORS.border} 80%, transparent)`,
                flexShrink: 0,
                opacity: 0.5,
            }} />

            {/* MAIN CONTENT */}
            <div className="content-area" style={{ display: "contents" }}>
                {tab === "pharmacy_settings" && currentUser?.role === "admin" && (
                    <PharmacySettings showToast={showToast}
                        pharmacyId={pharmacyId}
                    />
                )}
                <main
                    style={{ flex: 1, overflow: "auto", padding: 24, minHeight: "100vh", position: "relative", zIndex: 1 }}
                >
                    {tab === "dashboard" && (
                        <Dashboard
                            products={products}
                            sales={sales}
                            purchases={purchases}
                            customers={customers}
                            suppliers={suppliers}
                            shifts={shifts}
                            currentUser={currentUser}
                            pharmacyId={pharmacyId}
                            setTab={setTab}
                            creditPayments={creditPayments}
                            treasuryEntries={treasuryEntries}
                            promos={posPromos}
                            returnsData={returnsData}
                        />
                    )}
                    {tab === "pos" && canView("pos") && (
                        <POS
                            products={products}
                            setProducts={setProducts}
                            customers={customers}
                            sales={sales}
                            setSales={setSales}
                            shifts={shifts}
                            setShifts={setShifts}
                            currentUser={currentUser}
                            currentShift={currentShift}
                            showToast={showToast}
                            invoices={posInvoices}
                            setInvoices={setPosInvoices}
                            activeTab={posActiveTab}
                            setActiveTab={setPosActiveTab}
                            pharmacyId={pharmacyId}
                            suppliers={suppliers}
                            jokerPendingItems={jokerPendingItems}
                            setJokerPendingItems={setJokerPendingItems}
                            promos={posPromos}
                            discountRules={posDiscountRules}
                            productEarliestExpiry={posProductEarliestExpiry}
                            productFirstStocked={posProductFirstStocked}
                            autoPromoConfig={posAutoPromoConfig}
                            loyaltySettings={loyaltySettings}
                            onLoyaltySettingsChange={setLoyaltySettings}
                            setPurchases={setPurchases}
                        />
                    )}
                    {tab === "purchase" && canView("purchase") && (
                        <PurchaseModule
                            products={products}
                            setProducts={setProducts}
                            suppliers={suppliers}
                            purchases={purchases}
                            setPurchases={setPurchases}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            items={purchItems} setItems={setPurchItems}
                            selSupplier={purchSelSupplier} setSelSupplier={setPurchSelSupplier}
                            manualSubtotal={purchManualSubtotal} setManualSubtotal={setPurchManualSubtotal}
                            manualTax={purchManualTax} setManualTax={setPurchManualTax}
                            showNew={purchShowNew} setShowNew={setPurchShowNew}
                            canAdd={canAdd("purchase")}
                            canEdit={canEdit("purchase")}
                            jokerPendingItems={jokerPendingItems}
                            setJokerPendingItems={setJokerPendingItems}
                        />
                    )}
                    {tab === "sales_returns" && canView("returns", "sales") && (
                        <ReturnsModule
                            fixedType="sales"
                            products={products}
                            setProducts={setProducts}
                            sales={sales}
                            setSales={setSales}
                            purchases={purchases}
                            setPurchases={setPurchases}
                            customers={customers}
                            suppliers={suppliers}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            setTreasuryEntries={setTreasuryEntries}
                            setReturnsData={setReturnsData}
                            entries={treasuryEntries}
                            shifts={shifts}
                            canViewSalesReturns={canView("returns", "sales")}
                            canViewPurchaseReturns={canView("returns", "purchases")}
                            canEditSalesReturns={canEdit("returns", "sales")}
                            canEditPurchaseReturns={canEdit("returns", "purchases")}
                        />
                    )}
                    {tab === "purchase_returns" && canView("returns", "purchases") && (
                        <ReturnsModule
                            fixedType="purchases"
                            products={products}
                            setProducts={setProducts}
                            sales={sales}
                            setSales={setSales}
                            purchases={purchases}
                            setPurchases={setPurchases}
                            customers={customers}
                            suppliers={suppliers}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            setTreasuryEntries={setTreasuryEntries}
                            setReturnsData={setReturnsData}
                            canViewSalesReturns={canView("returns", "sales")}
                            canViewPurchaseReturns={canView("returns", "purchases")}
                            canEditSalesReturns={canEdit("returns", "sales")}
                            canEditPurchaseReturns={canEdit("returns", "purchases")}
                        />
                    )}
                    {tab === "rasd_settings" && currentUser?.role === "admin" && <RasdSettings showToast={showToast} products={products} pharmacyId={pharmacyId} />}
                    {tab === "audit_log" && currentUser?.role === "admin" && (
                        <AuditLogModule pharmacyId={pharmacyId} showToast={showToast} />
                    )}
                    {tab === "expiry_report" && canView("expiry_report") && <ExpiryReport products={products} onRemoveExpired={handleRemoveExpiredStock} />}
                    {tab === "inventory_statement" && canView("inventory_statement") && (
                        <InventoryStatement
                            products={products}
                            setProducts={setProducts}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            canEdit={canEdit("inventory_statement")}
                        />
                    )}
                    {tab === "inventory_count" && canView("inventory_count") && (
                        <InventoryCount
                            products={products}
                            setProducts={setProducts}
                            inventoryLogs={inventoryLogs}
                            setInventoryLogs={setInventoryLogs}
                            currentUser={currentUser}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            purchases={purchases}
                            canAddSub={(sub) => canAdd("inventory_count", sub)}
                            canEditSub={(sub) => canEdit("inventory_count", sub)}
                        />
                    )}
                    {tab === "products" && canView("products") && (
                        <ProductsModule
                            products={products}
                            setProducts={setProducts}
                            suppliers={suppliers}
                            sales={sales}
                            purchases={purchases}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            canAdd={canAdd("products")}
                            canDelete={canDelete("products")}
                            canEdit={canEdit("products")}
                            jokerPendingItems={jokerPendingItems}
                            setJokerPendingItems={setJokerPendingItems}
                        />
                    )}
                    {tab === "suppliers" && canView("suppliers") && (
                        <SuppliersModule
                            suppliers={suppliers}
                            setSuppliers={setSuppliers}
                            purchases={purchases}
                            setPurchases={setPurchases}
                            products={products}
                            setProducts={setProducts}
                            sales={sales}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            setTreasuryEntries={setTreasuryEntries}
                            treasuryEntries={treasuryEntries}
                            creditPayments={creditPayments}
                            canAdd={canAdd("suppliers")}
                            canDelete={canDelete("suppliers")}
                            canEdit={canEdit("suppliers")}
                            canEditSub={(sub) => canEdit("suppliers", sub)}
                            jokerPendingItems={jokerPendingItems}
                            setJokerPendingItems={setJokerPendingItems}
                        />
                    )}
                    {tab === "customers" && canView("customers") && (
                        <CustomersModule
                            customers={customers}
                            setCustomers={setCustomers}
                            showToast={showToast}
                            sales={sales}
                            setSales={setSales}
                            creditPayments={creditPayments}
                            setCreditPayments={setCreditPayments}
                            currentUser={currentUser}
                            pharmacyId={pharmacyId}
                            canAdd={canAdd("customers")}
                            canDelete={canDelete("customers")}
                            canEdit={canEdit("customers")}
                        />
                    )}
                    {tab === "reports" && canView("reports") && (
                        <Reports
                            sales={sales}
                            purchases={purchases}
                            products={products}
                            suppliers={suppliers}
                            customers={customers}
                            returns={returnsData}
                            manufacturers={manufacturers}
                            pharmacyId={pharmacyId}
                            treasuryEntries={treasuryEntries}
                            creditPayments={creditPayments}
                            setTab={setTab}
                        />
                    )}
                    {tab === "tax_report" && canView("tax_report") && (
                        <TaxReport sales={sales} purchases={purchases} returns={returnsData} />
                    )}
                    {tab === "financial_health" && canView("financial_health") && (
                        <FinancialHealthModule
                            sales={sales}
                            purchases={purchases}
                            products={products}
                            customers={customers}
                            suppliers={suppliers}
                            creditPayments={creditPayments}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            showToast={showToast}
                            canEditFinance={canEdit("financial_health")}
                        />
                    )}
                    {tab === "promotions" && canView("promotions") && (
                        <PromotionsModule
                            products={products}
                            setProducts={setProducts}
                            sales={sales}
                            purchases={purchases}
                            shifts={shifts}
                            currentUser={currentUser}
                            pharmacyId={pharmacyId}
                            showToast={showToast}
                            promos={posPromos}
                            setPromos={setPosPromos}
                            discountRules={posDiscountRules}
                            setDiscountRules={setPosDiscountRules}
                            autoPromoConfig={posAutoPromoConfig}
                            setAutoPromoConfig={setPosAutoPromoConfig}
                            enrichedCustomers={enrichedCustomers}
                            canAdd={canAdd("promotions")}
                            canEdit={canEdit("promotions")}
                            canDelete={canDelete("promotions")}
                        />
                    )}
                    {tab === "target" && canView("target") && (
                        <TargetModule
                            users={users}
                            sales={sales}
                            customers={customers}
                            products={products}
                            currentUser={currentUser}
                            pharmacyId={pharmacyId}
                            showToast={showToast}
                            returns={returnsData}
                            canAdd={canAdd("target")}
                            canEdit={canEdit("target")}
                            canDelete={canDelete("target")}
                        />
                    )}
                    {tab === "treasury" && canView("treasury") && (
                        <TreasuryModule
                            sales={sales}
                            creditPayments={creditPayments}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}
                            users={users}
                            showToast={showToast}
                            suppliers={suppliers}
                            shifts={shifts}
                            entries={treasuryEntries}
                            setEntries={setTreasuryEntries}
                            returns={returnsData}
                            products={products}
                            canViewSub={(sub) => canView("treasury", sub)}
                            canEditSub={(sub) => canEdit("treasury", sub)}
                            canAddSub={(sub) => canAdd("treasury", sub)}
                            canDeleteSub={(sub) => canDelete("treasury", sub)}
                        />
                    )}
                    {tab === "shift" && canView("shift") && (
                        <ShiftModule
                            shifts={shifts}
                            setShifts={setShifts}
                            sales={sales}
                            currentUser={currentUser}
                            showToast={showToast}
                            pharmacyId={pharmacyId}
                            invoices={posInvoices}
                            returns={returnsData}
                            entries={treasuryEntries}
                            setEntries={setTreasuryEntries}
                        />
                    )}
                    {tab === "attendance" && canView("attendance") && (
                        <AttendanceModule
                            pharmacyId={pharmacyId}
                            shifts={shifts}
                            setShifts={setShifts}
                            currentUser={currentUser}
                            users={users}
                            showToast={showToast}
                            canViewSub={(sub) => canView("attendance", sub)}
                            canEditSub={(sub) => canEdit("attendance", sub)}
                        />
                    )}
                    {tab === "loyalty" && canView("loyalty") && (
                        <LoyaltyModule
                            customers={customers}
                            sales={sales}
                            products={products}
                            pharmacyId={pharmacyId}
                            currentUser={currentUser}   // 🆕 مطلوب لـ created_by في insertTreasuryEntry (redeemPoints)
                            showToast={showToast}
                            loyaltySettings={loyaltySettings}
                            onLoyaltySettingsChange={setLoyaltySettings}
                        />
                    )}
                    {tab === "permissions" && currentUser?.role === "admin" && (
                        <PermissionsModule
                            pharmacyId={pharmacyId}
                            showToast={showToast}
                            users={users}
                            setUsers={setUsers}
                            currentUser={currentUser}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
