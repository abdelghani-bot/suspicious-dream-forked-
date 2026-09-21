import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS } from "../theme";
import { normGtin } from "../lib/barcodeUtils";
import { logAudit } from "../lib/auditLog";
import { todayLocal } from "../lib/dateUtils";
import { printHTML } from "../lib/printHelper";
import { queueEvent } from "../lib/offlineAPI";
import { BarcodeScanner } from "../components/BarcodeScanner"; // 🆕 عدّل المسار حسب مكان الملف عندك
import { Badge, Btn, Input, Modal, Select } from "../ui/primitives";

// ═══════════════════════════════════════════════════════════════════════════
// موديول التحويل بين الصيدليات (يدعم الأوفلاين)
//
// • كل الكتابة على السيرفر بتعدّي من RPCs ذرية (send/receive_pharmacy_transfer).
// • أونلاين: الـRPC بيتنفذ فورًا. لو النت قطع في نص العملية أو كان أوفلاين: بنحدّث المخزون المحلي
//   فورًا (زي البيع) ونحط حدث TRANSFER_SEND / TRANSFER_RECEIVE في طابور offlineAPI، والمزامنة
//   بتنفذه لما النت يرجع. الـclient_id (= event.id) بيمنع التكرار لو الحدث اتعاد.
// • القوايم (الشركاء والتحويلات) بتتخزن في localStorage لكل صيدلية عشان الشاشة تفتح أوفلاين.
// • العمليات اللي في الطابور بتظهر بحالتها (⏳ في انتظار المزامنة / ⚠️ فشلت) وبتتصفّى أوتوماتيك
//   لما السيرفر يأكد تنفيذها. لو فشلت (بعد استنفاد المحاولات) المستخدم يضغط "إرجاع المخزون المحلي".
// • إضافة/تعديل/حذف الشركاء والبحث بالـGLN أونلاين بس (عمليات نادرة وفيها حقول بيحددها السيرفر).
// • رصد خارج نطاق الموديول: نقل الملكية بيتم يدوي من موقع رصد نفسه.
// • حسابات الشركاء: سجل صادر/وارد بسعر التكلفة للمقارنة (من غير دفعات). الصافي = صادر − وارد،
//   على التحويلات المستلمة/المسجّلة فقط؛ اللي في الطريق بيظهر منفصل "قيد الاستلام".
// ═══════════════════════════════════════════════════════════════════════════

const TRANSFER_ERRORS = {
    NOT_AUTHENTICATED: "انتهت الجلسة — سجّل دخول تاني",
    EMPTY_TRANSFER: "أضف صنف واحد على الأقل",
    MY_GLN_MISSING: "سجّل GLN صيدليتك من إعدادات الصيدليات الأول",
    SAME_PHARMACY: "الـGLN ده بتاع صيدليتك",
    INVALID_QTY: "كمية غير صحيحة",
    BATCH_REQUIRED: "لازم تحدد الباتش لكل صنف",
    PRODUCT_NOT_FOUND: "الصنف مش موجود",
    PRODUCT_NO_BARCODE: "الصنف ده مالوش باركود",
    BATCH_NOT_FOUND: "الباتش مش موجود (ممكن يكون اتباع أو اتغير)",
    INSUFFICIENT_STOCK: "الكمية أكبر من رصيد الباتش",
    TRANSFER_NOT_RECEIVABLE: "التحويل ده اتستلم قبل كده أو مش موجّه لصيدليتك",
    PARTNER_NOT_FOUND: "الشريك مش موجود",
    PARTNER_GLN_EXISTS: "الـGLN ده مسجل عندك كشريك قبل كده",
    PARTNER_GLN_LOCKED: "مينفعش تغيّر الـGLN لشريك عليه تحويلات",
    PARTNER_HAS_TRANSFERS: "مينفعش تحذف شريك عليه تحويلات",
    NAME_REQUIRED: "اكتب اسم الشريك",
    GLN_REQUIRED: "أدخل الـGLN",
};
const CODES_WITH_DETAIL = ["PRODUCT_NO_BARCODE", "BATCH_NOT_FOUND", "INSUFFICIENT_STOCK", "PRODUCT_NOT_FOUND"];

const errorCodeOf = (err) => Object.keys(TRANSFER_ERRORS).find((k) => (err?.message || "").includes(k));
// خطأ "منطقي" من السيرفر (كمية/باتش/شريك...) = مينفعش نطابره؛ أي خطأ تاني (شبكة...) = نطابر ونحاول بعدين
const isBusinessError = (err) => !!errorCodeOf(err);

const explainTransferError = (err) => {
    const msg = err?.message || "";
    const code = errorCodeOf(err);
    if (!code) return "فشلت العملية: " + msg;
    const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : "";
    return TRANSFER_ERRORS[code] + (detail && CODES_WITH_DETAIL.includes(code) ? ` — ${detail}` : "");
};

// ==================== أدوات ====================
const normBatch = (v) => String(v || "").trim().toUpperCase();
const normExpiry = (v) => String(v || "").slice(0, 10); // الصلاحية بتتخزن وبتتقرأ باليوم YYYY-MM-DD

// أكواد رقمية (GTIN/EAN): مقارنة بعد شيل الأصفار الزيادة. أي كود فيه حروف (زي P006): مقارنة حرفية
// (normGtin بيشيل الحروف، فمينفعش يتستخدم مع الأكواد الداخلية)
const sameCode = (a, b) => {
    const x = String(a || "").trim();
    const y = String(b || "").trim();
    if (!x || !y) return false;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return normGtin(x) === normGtin(y);
    return x === y;
};

const availableBatches = (product) => (product?.batches || []).filter((b) => (+b.qty || 0) > 0);
const sumQty = (batches) => (batches || []).reduce((s, b) => s + (+b.qty || 0), 0);

const pad2 = (n) => String(n).padStart(2, "0");
// التحويلات timestamptz (UTC) — بنحولها لتاريخ محلي عشان فلتر الفترة ما يتزحلقش يوم
const localDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 10);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => (+n || 0).toFixed(2);
const stripNulls = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const newProductId = () => "P" + Date.now() + Math.random().toString(16).slice(2, 6);

const netInfo = (net) => {
    if (net > 0.005) return { text: `أرسلنا أكتر بـ ${money(net)} ر.س`, color: COLORS.gold };
    if (net < -0.005) return { text: `استلمنا أكتر بـ ${money(Math.abs(net))} ر.س`, color: COLORS.blue };
    return { text: "متوازن", color: COLORS.green };
};

// ---- كاش محلي لكل صيدلية (localStorage) ----
const cacheKey = (name, pid) => `pharma_transfer_${name}_${pid}`;
const cacheGet = (name, pid, fallback) => {
    try {
        const v = localStorage.getItem(cacheKey(name, pid));
        return v ? JSON.parse(v) : fallback;
    } catch {
        return fallback;
    }
};
const cacheSet = (name, pid, val) => {
    try {
        localStorage.setItem(cacheKey(name, pid), JSON.stringify(val));
    } catch (e) {
        console.warn("[transfers] cache write failed:", e);
    }
};

const blankPartner = { id: null, name: "", gln: "", phone: "", whatsapp: "", contact: "", tax_id: "", notes: "" };

export function PharmacyTransferModule({
    products,
    setProducts,
    pharmacyId,
    currentUser,
    showToast,
    canAdd = true,
    canEdit = true,
    canDelete = true,
}) {
    const [tab, setTab] = useState("send"); // send | incoming | partners

    const [partners, setPartners] = useState([]);
    const [outgoingTransfers, setOutgoingTransfers] = useState([]);
    const [incomingTransfers, setIncomingTransfers] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // ---- حالة الاتصال ----
    const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
    const [fromCache, setFromCache] = useState(false);
    useEffect(() => {
        const on = () => { setIsOnline(true); setTimeout(() => loadAll(), 1500); };
        const off = () => setIsOnline(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    }, [pharmacyId]);

    // ---- العمليات المعلّقة (إرسال/استلام في الطابور) ----
    // op: { id(=event.id), kind: "send"|"receive", status: "queued"|"failed", error?, created_at,
    //       partner_id?, partner_name?, partner_gln?, transfer_id?, total_cost, lines: [...], changes: [...], created_product_ids? }
    const [pendingOps, setPendingOps] = useState([]);
    const pendingRef = useRef([]);
    const updatePending = (fn) => {
        const next = fn(pendingRef.current);
        pendingRef.current = next;
        setPendingOps(next);
        cacheSet("pending", pharmacyId, next);
    };

    const partnerByGln = (gln) => partners.find((p) => p.gln === gln);
    const opForReceive = (transferId) => pendingOps.find((o) => o.kind === "receive" && o.transfer_id === transferId);

    // ---- تحميل من السيرفر مع رجوع للكاش لو أوفلاين ----
    const loadAll = async () => {
        if (!pharmacyId) return;
        let outRows = null, incRows = null, prtRows = null;
        if (navigator.onLine) {
            try {
                const [outRes, incRes, prtRes] = await Promise.all([
                    supabase.from("pharmacy_transfers").select("*, pharmacy_transfer_items(*)").eq("from_pharmacy_id", pharmacyId).order("date", { ascending: false }),
                    supabase.from("pharmacy_transfers").select("*, pharmacy_transfer_items(*)").eq("to_pharmacy_id", pharmacyId).order("date", { ascending: false }),
                    supabase.from("pharmacy_partners").select("*").eq("pharmacy_id", pharmacyId).order("name", { ascending: true }),
                ]);
                if (!outRes.error) outRows = outRes.data || [];
                if (!incRes.error) incRows = incRes.data || [];
                if (!prtRes.error) prtRows = prtRes.data || [];
            } catch (e) {
                console.warn("[transfers] load failed, using cache:", e);
            }
        }
        const gotAll = outRows && incRows && prtRows;
        setFromCache(!gotAll);

        const out = outRows ?? cacheGet("out", pharmacyId, []);
        const inc = incRows ?? cacheGet("in", pharmacyId, []);
        const prt = prtRows ?? cacheGet("partners", pharmacyId, []);
        setOutgoingTransfers(out);
        setIncomingTransfers(inc);
        setPartners(prt);
        if (outRows) cacheSet("out", pharmacyId, outRows);
        if (incRows) cacheSet("in", pharmacyId, incRows);
        if (prtRows) cacheSet("partners", pharmacyId, prtRows);

        if (gotAll) await reconcilePending(out, inc);
    };

    // تصفية العمليات المعلّقة بناءً على اللي السيرفر أكده
    const reconcilePending = async (outRows, incRows) => {
        const ops = pendingRef.current;
        if (!ops.length) return;
        const deadEvents = (await window.offlineAPI?.getDeadLetterEvents?.()) || [];
        let changed = false;
        const next = [];
        for (const op of ops) {
            if (op.status === "failed") { next.push(op); continue; }

            if (op.kind === "send") {
                if (outRows.some((t) => t.client_id === op.id)) { changed = true; continue; } // السيرفر أكد
            } else {
                const t = incRows.find((x) => x.id === op.transfer_id);
                if (t && t.status === "received") {
                    if (t.received_client_id === op.id) { changed = true; continue; } // إحنا اللي استلمناه
                    // اتستلم من جهاز/مستخدم تاني — حدثنا هيفشل ومخزوننا المحلي مكرر
                    next.push({ ...op, status: "failed", error: "التحويل اتستلم من جهاز أو مستخدم تاني" });
                    changed = true;
                    continue;
                }
            }
            const dead = deadEvents.find((e) => e.id === op.id);
            if (dead) {
                next.push({ ...op, status: "failed", error: dead.last_error || "فشلت المزامنة بعد عدة محاولات" });
                changed = true;
                continue;
            }
            next.push(op); // لسه في الطابور
        }
        if (changed) updatePending(() => next);
    };

    // تحميل أولي من الكاش (فتح فوري) ثم من السيرفر
    useEffect(() => {
        if (!pharmacyId) return;
        pendingRef.current = cacheGet("pending", pharmacyId, []);
        setPendingOps(pendingRef.current);
        setOutgoingTransfers(cacheGet("out", pharmacyId, []));
        setIncomingTransfers(cacheGet("in", pharmacyId, []));
        setPartners(cacheGet("partners", pharmacyId, []));
        loadAll();
    }, [pharmacyId]);

    // متابعة العمليات المعلّقة: كل 30 ثانية لو فيه حاجة في الطابور والنت شغال
    useEffect(() => {
        if (!pharmacyId) return;
        const t = setInterval(() => {
            if (navigator.onLine && pendingRef.current.some((o) => o.status === "queued")) loadAll();
        }, 30000);
        return () => clearInterval(t);
    }, [pharmacyId]);

    // بيانات الصيدلية لترويسة كشف الحساب المطبوع (نفس نمط موديول الموردين)
    const [pharmInfo, setPharmInfo] = useState({ name: "", address: "", taxNumber: "", reportsPrinterName: "" });
    useEffect(() => {
        if (!pharmacyId) return;
        const cached = cacheGet("pharminfo", pharmacyId, null);
        if (cached) setPharmInfo(cached);
        if (!navigator.onLine) return;
        supabase.from("pharmacy_settings")
            .select("name_ar, address, tax_number, reports_printer_name")
            .eq("pharmacy_id", pharmacyId).maybeSingle()
            .then(({ data }) => {
                if (data) {
                    const info = {
                        name: data.name_ar || "",
                        address: data.address || "",
                        taxNumber: data.tax_number || "",
                        reportsPrinterName: data.reports_printer_name || "",
                    };
                    setPharmInfo(info);
                    cacheSet("pharminfo", pharmacyId, info);
                }
            });
    }, [pharmacyId]);

    // ==================== تحديث المخزون المحلي (Optimistic) ====================
    const stockDeltaToCache = (deltas) => {
        const list = Object.entries(deltas).filter(([, d]) => d !== 0).map(([id, delta]) => ({ id, delta }));
        if (list.length) window.offlineAPI?.applyProductStockDeltaCache?.({ pharmacyId, deltas: list });
    };

    // إرسال: خصم الكمية من الباتش المحدد (والباتش بيتشال لو خلص — زي السيرفر)
    const applySendLocal = (sendLines) => {
        const deltas = {};
        sendLines.forEach((l) => { deltas[l.product_id] = (deltas[l.product_id] || 0) - l.qty; });
        setProducts((prev) => prev.map((p) => {
            const mine = sendLines.filter((l) => l.product_id === p.id);
            if (!mine.length) return p;
            const batches = (p.batches || [])
                .map((b) => {
                    const l = mine.find((x) => x.batch_id === b.id);
                    return l ? { ...b, qty: (+b.qty || 0) - l.qty } : b;
                })
                .filter((b) => (+b.qty || 0) > 0);
            return { ...p, batches, stock: sumQty(batches) };
        }));
        stockDeltaToCache(deltas);
    };

    // إرجاع خصم الإرسال (لو العملية فشلت نهائيًا): changes = [{product_id, batch (لقطة الباتش وقت الإرسال), qty}]
    const revertSendLocal = (changes) => {
        const deltas = {};
        changes.forEach((c) => { deltas[c.product_id] = (deltas[c.product_id] || 0) + c.qty; });
        setProducts((prev) => prev.map((p) => {
            const mine = changes.filter((c) => c.product_id === p.id);
            if (!mine.length) return p;
            const batches = [...(p.batches || [])];
            mine.forEach((c) => {
                const idx = batches.findIndex((b) => b.id === c.batch.id);
                if (idx >= 0) batches[idx] = { ...batches[idx], qty: (+batches[idx].qty || 0) + c.qty };
                else batches.push({ ...c.batch, qty: c.qty });
            });
            return { ...p, batches, stock: sumQty(batches) };
        }));
        stockDeltaToCache(deltas);
    };

    // تخطيط الاستلام: نفس قاعدة السيرفر (مطابقة الباركود بعد شيل الأصفار، الأصناف المفعّلة أولًا) +
    // معرّفات باتشات/أصناف جديدة من العميل عشان المخزون المحلي يطابق السيرفر بعد المزامنة
    const planReceive = (transfer) => {
        const items = transfer.pharmacy_transfer_items || [];
        const itemMap = {};
        const changes = []; // { product_id, batch, created }
        const newProducts = []; // أصناف جديدة اتخططت في نفس الاستلام
        const receivedDate = todayLocal();

        items.forEach((it) => {
            const candidates = [...products, ...newProducts]
                .filter((p) => sameCode(p.barcode, it.product_gtin))
                .sort((a, b) => (a.is_disabled ? 1 : 0) - (b.is_disabled ? 1 : 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
            let prod = candidates[0];
            const batchId = crypto.randomUUID();
            const map = { batch_id: batchId };
            let created = false;

            if (!prod) {
                const pid = newProductId();
                prod = {
                    id: pid, name: it.product_name, name_ar: it.product_name, nameAr: it.product_name,
                    barcode: it.product_gtin, price: 0, cost: +it.cost || 0, stock: 0, batches: [],
                    pharmacy_id: pharmacyId, auto_order: false, barcode_status: "linked", is_disabled: false,
                    created_at: new Date().toISOString(), full_ingredients: [], altBarcodes: [],
                };
                newProducts.push(prod);
                map.new_product_id = pid;
                created = true;
            }
            itemMap[it.id] = map;

            const batch = stripNulls({
                id: batchId, qty: +it.qty, cost: +it.cost || 0, date: receivedDate, salePrice: +prod.price || 0,
                expiry_date: it.expiry_date, batch_number: it.batch_number, source_gln: transfer.from_gln, transfer_id: transfer.id,
            });
            changes.push({ product_id: prod.id, batch, created });
            // لو صنف جديد اتضاف لباتشات أكتر من سطر في نفس الاستلام
            if (created) prod.batches = [batch];
            else if (newProducts.some((np) => np.id === prod.id)) prod.batches = [...prod.batches, batch];
        });

        return { itemMap, changes, newProducts };
    };

    const applyReceiveLocal = (changes, newProducts) => {
        const newIds = new Set(newProducts.map((p) => p.id));
        const deltas = {};
        changes.filter((c) => !newIds.has(c.product_id)).forEach((c) => {
            deltas[c.product_id] = (deltas[c.product_id] || 0) + (+c.batch.qty || 0);
        });
        setProducts((prev) => {
            const updated = prev.map((p) => {
                const mine = changes.filter((c) => c.product_id === p.id && !newIds.has(p.id));
                if (!mine.length) return p;
                const batches = [...(p.batches || []), ...mine.map((c) => c.batch)];
                return { ...p, batches, stock: sumQty(batches) };
            });
            const added = newProducts.map((np) => ({ ...np, stock: sumQty(np.batches) }));
            return [...updated, ...added];
        });
        stockDeltaToCache(deltas);
        if (newProducts.length) {
            window.offlineAPI?.upsertProductsCache?.({
                pharmacyId,
                products: newProducts.map((np) => ({ ...np, stock: sumQty(np.batches) })),
            });
        }
    };

    const revertReceiveLocal = (changes, createdIds) => {
        const created = new Set(createdIds || []);
        const batchIds = new Set(changes.map((c) => c.batch.id));
        const deltas = {};
        changes.filter((c) => !created.has(c.product_id)).forEach((c) => {
            deltas[c.product_id] = (deltas[c.product_id] || 0) - (+c.batch.qty || 0);
        });
        setProducts((prev) => prev
            .filter((p) => !created.has(p.id))
            .map((p) => {
                if (!(p.batches || []).some((b) => batchIds.has(b.id))) return p;
                const batches = p.batches.filter((b) => !batchIds.has(b.id));
                return { ...p, batches, stock: sumQty(batches) };
            }));
        stockDeltaToCache(deltas);
    };

    const revertOp = (op) => {
        if (!window.confirm("هيتم إرجاع تأثير العملية دي على المخزون المحلي. متأكد؟")) return;
        if (op.kind === "send") revertSendLocal(op.changes || []);
        else revertReceiveLocal(op.changes || [], op.created_product_ids || []);
        updatePending((ops) => ops.filter((o) => o.id !== op.id));
        showToast("تم إرجاع المخزون المحلي ✓");
    };

    // ==================== كشف حساب الشريك ====================
    const buildStatement = (partner, from, to) => {
        const inRange = (d) => (!from || d >= from) && (!to || d <= to);
        const events = [];
        const push = (t, isOut) => {
            if (t.status === "cancelled") return;
            const date = localDate(t.date);
            if (!inRange(date)) return;
            const n = (t.pharmacy_transfer_items || []).length;
            const localReceive = !isOut && opForReceive(t.id)?.status === "queued";
            events.push({
                key: t.id,
                ts: t.date,
                date,
                label: `${isOut ? "تحويل صادر" : "تحويل وارد"} ${t.id.slice(0, 8)} — ${n} سطر${t.status === "shipped" || localReceive ? " ⏳ قيد الاستلام" : ""}`,
                out: isOut ? +t.total_cost || 0 : 0,
                inn: isOut ? 0 : +t.total_cost || 0,
                pending: t.status === "shipped" || localReceive,
            });
        };
        outgoingTransfers.filter((t) => t.to_gln === partner.gln).forEach((t) => push(t, true));
        incomingTransfers.filter((t) => t.from_gln === partner.gln).forEach((t) => push(t, false));
        // إرساليات لسه في الطابور (مش على السيرفر بعد)
        pendingOps.filter((o) => o.kind === "send" && o.partner_gln === partner.gln).forEach((o) => {
            const date = localDate(o.created_at);
            if (!inRange(date)) return;
            events.push({
                key: o.id, ts: o.created_at, date,
                label: `تحويل صادر (${o.status === "failed" ? "فشل" : "في انتظار المزامنة"}) — ${(o.lines || []).length} سطر ⏳`,
                out: +o.total_cost || 0, inn: 0, pending: true,
            });
        });
        events.sort((a, b) => (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0));

        let running = 0, totalOut = 0, totalIn = 0, pendingOut = 0, pendingIn = 0;
        const rows = events.map((e) => {
            if (e.pending) {
                pendingOut += e.out;
                pendingIn += e.inn;
                return { ...e, balance: running };
            }
            running += e.out - e.inn;
            totalOut += e.out;
            totalIn += e.inn;
            return { ...e, balance: running };
        });
        return { rows, totalOut, totalIn, net: totalOut - totalIn, pendingOut, pendingIn };
    };

    const printPartnerStatement = (partner, from, to) => {
        const { rows, totalOut, totalIn, net, pendingOut, pendingIn } = buildStatement(partner, from, to);
        const rowsHtml = rows.map((r) => `
            <tr style="${r.pending ? "color:#888" : ""}">
                <td>${esc(r.date)}</td>
                <td>${esc(r.label)}</td>
                <td style="text-align:left">${r.out ? money(r.out) : "—"}</td>
                <td style="text-align:left">${r.inn ? money(r.inn) : "—"}</td>
                <td style="text-align:left; font-weight:bold">${money(r.balance)}</td>
            </tr>`).join("");
        const info = netInfo(net);

        const html = `
            <html dir="rtl">
            <head>
                <meta charset="utf-8">
                <title>كشف حساب تحويلات — ${esc(partner.name)}</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; font-family: Arial, sans-serif; }
                    @page { size: A4; margin: 14mm; }
                    body { color:#111; font-size:13px; }
                    .header { text-align:center; border-bottom:2px solid #222; padding-bottom:10px; margin-bottom:16px; }
                    .header h1 { font-size:18px; margin-bottom:4px; }
                    .header .sub { color:#555; font-size:12px; }
                    .meta-row { display:flex; justify-content:space-between; margin-bottom:14px; font-size:12px; color:#333; }
                    table { width:100%; border-collapse:collapse; margin-bottom:10px; }
                    th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; }
                    th { background:#f2f2f2; text-align:right; }
                    .totals { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:2px solid #222; padding-top:8px; margin-top:8px; }
                    .note { color:#555; font-size:11px; margin-top:8px; }
                    .footer-note { color:#555; font-size:11px; margin-top:20px; border-top:1px dashed #999; padding-top:8px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${esc(pharmInfo.name || "الصيدلية")}</h1>
                    <div class="sub">${esc(pharmInfo.address || "")}${pharmInfo.taxNumber ? " · الرقم الضريبي: " + esc(pharmInfo.taxNumber) : ""}</div>
                    <div class="sub" style="margin-top:6px; font-weight:bold;">كشف حساب تحويلات — ${esc(partner.name)}</div>
                </div>
                <div class="meta-row">
                    <span>الفترة: ${esc(from || "البداية")} إلى ${esc(to || "اليوم")}</span>
                    <span>GLN: ${esc(partner.gln)}</span>
                </div>
                <table>
                    <thead><tr><th>التاريخ</th><th>البيان</th><th>صادر (تكلفة)</th><th>وارد (تكلفة)</th><th>الصافي التراكمي</th></tr></thead>
                    <tbody>${rowsHtml || `<tr><td colspan="5" style="text-align:center; color:#888;">لا توجد حركات خلال هذه الفترة</td></tr>`}</tbody>
                </table>
                <div class="totals"><span>إجمالي الصادر: ${money(totalOut)} ر.س</span><span>إجمالي الوارد: ${money(totalIn)} ر.س</span></div>
                <div class="totals"><span>الصافي</span><span>${esc(info.text)}</span></div>
                ${pendingOut || pendingIn ? `<div class="note">قيد الاستلام/المزامنة (غير محسوب في الصافي): صادر ${money(pendingOut)} — وارد ${money(pendingIn)} ر.س</div>` : ""}
                <div class="note">القيم بسعر التكلفة، والحساب على التحويلات المستلمة/المسجّلة فقط.</div>
                <div class="footer-note">تاريخ الطباعة: ${esc(todayLocal())}</div>
            </body>
            </html>`;
        printHTML(html, { deviceName: pharmInfo.reportsPrinterName || undefined });
    };

    // ==================== إدارة الشركاء (أونلاين فقط) ====================
    const [partnerSearch, setPartnerSearch] = useState("");
    const [showPartnerForm, setShowPartnerForm] = useState(false);
    const [partnerForm, setPartnerForm] = useState(blankPartner);
    const [partnerLookup, setPartnerLookup] = useState(null); // { tenant: bool, name }
    const [lookingUp, setLookingUp] = useState(false);
    const [savingPartner, setSavingPartner] = useState(false);
    const PF = (k, v) => setPartnerForm((p) => ({ ...p, [k]: v }));

    const [showStatement, setShowStatement] = useState(null);
    const [statementRange, setStatementRange] = useState({ from: "", to: "" });

    const needOnline = () => {
        if (navigator.onLine) return false;
        showToast("العملية دي محتاجة اتصال بالإنترنت", "error");
        return true;
    };

    const filteredPartners = useMemo(() => {
        const q = partnerSearch.trim().toLowerCase();
        if (!q) return partners;
        return partners.filter((p) =>
            (p.name || "").toLowerCase().includes(q) || (p.gln || "").includes(q) || (p.contact || "").toLowerCase().includes(q) || (p.phone || "").includes(q)
        );
    }, [partners, partnerSearch]);

    const openAddPartner = () => {
        if (needOnline()) return;
        setPartnerForm(blankPartner);
        setPartnerLookup(null);
        setShowPartnerForm(true);
    };

    const openEditPartner = (p) => {
        if (needOnline()) return;
        setPartnerForm({
            id: p.id, name: p.name || "", gln: p.gln || "", phone: p.phone || "", whatsapp: p.whatsapp || "",
            contact: p.contact || "", tax_id: p.tax_id || "", notes: p.notes || "",
        });
        setPartnerLookup(p.linked_pharmacy_id ? { tenant: true, name: p.name } : null);
        setShowPartnerForm(true);
    };

    const lookupGln = async () => {
        const gln = partnerForm.gln.trim();
        if (!gln) { showToast("أدخل الـGLN الأول", "error"); return; }
        if (needOnline()) return;
        setLookingUp(true);
        const { data, error } = await supabase.rpc("find_partner_pharmacy_by_gln", { p_gln: gln });
        setLookingUp(false);
        if (error) { showToast(explainTransferError(error), "error"); return; }
        if (data && data.length > 0) {
            setPartnerLookup({ tenant: true, name: data[0].name });
            if (!partnerForm.name.trim()) PF("name", data[0].name);
        } else {
            setPartnerLookup({ tenant: false });
        }
    };

    const savePartner = async () => {
        if (savingPartner) return;
        if (!partnerForm.gln.trim()) { showToast("أدخل الـGLN", "error"); return; }
        if (!partnerForm.name.trim() && !partnerLookup?.tenant) { showToast("اكتب اسم الشريك", "error"); return; }
        if (needOnline()) return;
        setSavingPartner(true);
        const { data, error } = await supabase.rpc("upsert_pharmacy_partner", {
            p_id: partnerForm.id || null,
            p_name: partnerForm.name.trim() || null,
            p_gln: partnerForm.gln.trim(),
            p_phone: partnerForm.phone.trim() || null,
            p_whatsapp: partnerForm.whatsapp.trim() || null,
            p_contact: partnerForm.contact.trim() || null,
            p_tax_id: partnerForm.tax_id.trim() || null,
            p_notes: partnerForm.notes.trim() || null,
        });
        setSavingPartner(false);
        if (error) { showToast(explainTransferError(error), "error"); return; }

        logAudit({
            pharmacyId, userName: currentUser?.name, action: partnerForm.id ? "update" : "create", entityType: "pharmacy_partner",
            entityId: data, entityLabel: partnerForm.name,
            newValue: { name: partnerForm.name, gln: partnerForm.gln },
            description: `${partnerForm.id ? "تعديل" : "إضافة"} صيدلية شريكة "${partnerForm.name}"`,
        });
        setShowPartnerForm(false);
        showToast(partnerForm.id ? "تم تعديل الشريك ✓" : "تمت إضافة الشريك ✓");
        loadAll();
    };

    const deletePartner = async (p) => {
        if (needOnline()) return;
        if (!window.confirm(`تأكيد حذف الشريك "${p.name}"؟`)) return;
        const { error } = await supabase.rpc("delete_pharmacy_partner", { p_id: p.id });
        if (error) { showToast(explainTransferError(error), "error"); return; }
        logAudit({
            pharmacyId, userName: currentUser?.name, action: "delete", entityType: "pharmacy_partner",
            entityId: p.id, entityLabel: p.name, oldValue: { name: p.name, gln: p.gln },
            description: `حذف صيدلية شريكة "${p.name}"`,
        });
        showToast("تم حذف الشريك");
        loadAll();
    };

    // ==================== إنشاء تحويل صادر ====================
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendPartnerId, setSendPartnerId] = useState("");
    const [lines, setLines] = useState([]); // [{product, batch, qty}]
    const [pickState, setPickState] = useState(null); // {product, candidates, reason}
    const [lineSearch, setLineSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const scannerRef = useRef(null);

    const selectedSendPartner = partners.find((p) => p.id === sendPartnerId) || null;

    useEffect(() => {
        if (showSendModal && sendPartnerId) setTimeout(() => scannerRef.current?.focus(), 150);
    }, [showSendModal, sendPartnerId]);

    const refocusScanner = () => setTimeout(() => scannerRef.current?.focus(), 0);

    const openSend = (partner = null) => {
        setSendPartnerId(partner?.id || "");
        setShowSendModal(true);
    };

    const searchResults = useMemo(() => {
        if (!lineSearch.trim()) return [];
        const q = lineSearch.trim().toLowerCase();
        return products
            .filter((p) => (p.nameAr || p.name || "").toLowerCase().includes(q) || sameCode(p.barcode, lineSearch.trim()))
            .slice(0, 15);
    }, [lineSearch, products]);

    const productLabel = (p) => p.nameAr || p.name;

    // إضافة باتش محدد (أو زيادة كميته لو مضاف قبل كده)
    const addBatchLine = (product, batch, addQty = 1) => {
        if (!batch?.id) {
            showToast(`الباتش ده مالوش معرّف — راجعه من شاشة الجرد: ${productLabel(product)}`, "error");
            return;
        }
        const idx = lines.findIndex((l) => l.batch.id === batch.id);
        if (idx >= 0) {
            const newQty = (+lines[idx].qty || 0) + addQty;
            if (newQty > +batch.qty) {
                showToast(`المتاح في الباتش ${batch.batch_number || "-"} هو ${batch.qty} بس`, "error");
                return;
            }
            setLines(lines.map((l, i) => (i === idx ? { ...l, qty: newQty } : l)));
        } else {
            if (addQty > +batch.qty) {
                showToast(`المتاح في الباتش ${batch.batch_number || "-"} هو ${batch.qty} بس`, "error");
                return;
            }
            setLines([...lines, { product, batch, qty: addQty }]);
        }
    };

    const updateLine = (batchId, patch) => setLines((prev) => prev.map((l) => (l.batch.id === batchId ? { ...l, ...patch } : l)));
    const removeLine = (batchId) => setLines((prev) => prev.filter((l) => l.batch.id !== batchId));

    // ==================== السكانر ====================
    // scan: { type: "gs1", gtin, expiry, batch, serial } | { type: "custom", code, expiry, batch } | { type: "simple", code }
    const handleScan = (scan) => {
        const code = scan.type === "gs1" ? scan.gtin : scan.code;
        const product = products.find((p) => sameCode(p.barcode, code));
        if (!product) {
            showToast(`الصنف مش موجود عندك (${code || "-"})`, "error");
            return;
        }
        const available = availableBatches(product);
        if (available.length === 0) {
            showToast(`مفيش رصيد متاح من "${productLabel(product)}"`, "error");
            return;
        }

        if (scan.batch && scan.expiry) {
            const matches = available.filter(
                (b) => normBatch(b.batch_number) === normBatch(scan.batch) && normExpiry(b.expiry_date) === scan.expiry
            );
            if (matches.length === 1) { addBatchLine(product, matches[0]); return; }
            if (matches.length > 1) {
                // نفس التشغيلة والصلاحية من أكتر من مورد: المستخدم يختار
                setPickState({ product, candidates: matches, reason: "أكتر من باتش بنفس التشغيلة والصلاحية — اختار" });
                return;
            }
            showToast(`التشغيلة ${scan.batch} (${scan.expiry}) مش موجودة في رصيد "${productLabel(product)}"`, "error");
            return;
        }

        // الكود مفيهوش تشغيلة/صلاحية → اختيار يدوي من باتشات الصنف
        setPickState({ product, candidates: available, reason: "الكود مفيهوش تشغيلة/صلاحية — اختار الباتش" });
    };

    const startManualPick = (product) => {
        const available = availableBatches(product);
        if (available.length === 0) {
            showToast(`مفيش رصيد متاح من "${productLabel(product)}"`, "error");
            return;
        }
        setPickState({ product, candidates: available, reason: "اختار الباتش" });
        setLineSearch("");
    };

    const resetSendForm = () => {
        setLines([]);
        setPickState(null);
        setLineSearch("");
        setSendPartnerId("");
    };

    // ==================== إرسال (أونلاين فورًا / أوفلاين في الطابور) ====================
    const submitTransfer = async () => {
        if (submitting) return;
        if (!selectedSendPartner) { showToast("اختار الصيدلية المستقبلة", "error"); return; }
        if (lines.length === 0) { showToast("امسح صنف واحد على الأقل قبل إرسال التحويل", "error"); return; }
        for (const l of lines) {
            const q = +l.qty;
            if (!(q > 0) || q > +l.batch.qty) {
                showToast(`كمية غير صحيحة: "${productLabel(l.product)}" (المتاح ${l.batch.qty})`, "error");
                return;
            }
        }

        setSubmitting(true);
        const eventId = crypto.randomUUID();
        const sendLines = lines.map((l) => ({ product_id: l.product.id, batch_id: l.batch.id, qty: +l.qty }));
        const createdBy = currentUser?.name || currentUser?.id || null;
        const event = {
            id: eventId,
            type: "TRANSFER_SEND",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { partner_id: selectedSendPartner.id, lines: sendLines, notes: null, created_by: createdBy },
        };

        let synced = false;
        if (navigator.onLine) {
            const { error } = await supabase.rpc("send_pharmacy_transfer", {
                p_partner_id: selectedSendPartner.id, p_lines: sendLines, p_notes: null, p_created_by: createdBy, p_client_id: eventId,
            });
            if (!error) synced = true;
            else if (isBusinessError(error)) {
                // خطأ منطقي مؤكد من السيرفر: مفيش تغيير محلي ومفيش طابور
                setSubmitting(false);
                showToast(explainTransferError(error), "error");
                return;
            }
            // غير كده (شبكة/انتهاء جلسة...): نكمل ونحطه في الطابور — الـclient_id بيمنع التكرار
        }

        // تحديث المخزون المحلي (زي البيع)
        applySendLocal(sendLines);

        if (!synced) {
            updatePending((ops) => [{
                id: eventId, kind: "send", status: "queued", created_at: event.timestamp,
                partner_id: selectedSendPartner.id, partner_name: selectedSendPartner.name, partner_gln: selectedSendPartner.gln,
                linked: !!selectedSendPartner.linked_pharmacy_id,
                total_cost: lines.reduce((s, l) => s + (+l.qty) * (+l.batch.cost || 0), 0),
                lines: lines.map((l) => ({
                    product_name: productLabel(l.product), batch_number: l.batch.batch_number || "", expiry_date: l.batch.expiry_date || "",
                    qty: +l.qty, cost: +l.batch.cost || 0,
                })),
                changes: lines.map((l) => ({ product_id: l.product.id, batch: { ...l.batch }, qty: +l.qty })),
            }, ...ops]);
            const r = await queueEvent(event); // بيجرب تاني لو النت رجع، وإلا بيتخزن للمزامنة
            if (r?.synced) { synced = true; }
        }

        setSubmitting(false);
        showToast(
            synced
                ? (selectedSendPartner.linked_pharmacy_id
                    ? `✅ تم إرسال التحويل (${lines.length} سطر) — مستني استلام ${selectedSendPartner.name}`
                    : `✅ تم تسجيل التحويل الصادر (${lines.length} سطر)`)
                : "💾 اتسجل محليًا وهيتزامن لما النت يرجع",
            "success"
        );
        resetSendForm();
        setShowSendModal(false);
        loadAll();
    };

    // ==================== استلام تحويل وارد ====================
    const [receivingId, setReceivingId] = useState(null);

    const receiveTransfer = async (transfer) => {
        if (receivingId) return;
        setReceivingId(transfer.id);

        const plan = planReceive(transfer);
        const eventId = crypto.randomUUID();
        const receivedBy = currentUser?.name || currentUser?.id || null;
        const event = {
            id: eventId,
            type: "TRANSFER_RECEIVE",
            pharmacy_id: pharmacyId,
            timestamp: new Date().toISOString(),
            payload: { transfer_id: transfer.id, received_by: receivedBy, item_map: plan.itemMap },
        };

        let synced = false;
        if (navigator.onLine) {
            const { error } = await supabase.rpc("receive_pharmacy_transfer", {
                p_transfer_id: transfer.id, p_received_by: receivedBy, p_client_id: eventId, p_item_map: plan.itemMap,
            });
            if (!error) synced = true;
            else if (isBusinessError(error)) {
                setReceivingId(null);
                showToast(explainTransferError(error), "error");
                loadAll();
                return;
            }
        }

        applyReceiveLocal(plan.changes, plan.newProducts);

        if (!synced) {
            updatePending((ops) => [{
                id: eventId, kind: "receive", status: "queued", created_at: event.timestamp,
                transfer_id: transfer.id, partner_gln: transfer.from_gln, total_cost: +transfer.total_cost || 0,
                lines: (transfer.pharmacy_transfer_items || []).map((it) => ({
                    product_name: it.product_name, batch_number: it.batch_number || "", expiry_date: it.expiry_date || "", qty: +it.qty, cost: +it.cost || 0,
                })),
                changes: plan.changes,
                created_product_ids: plan.newProducts.map((p) => p.id),
            }, ...ops]);
            const r = await queueEvent(event);
            if (r?.synced) synced = true;
        }

        setReceivingId(null);
        showToast(synced ? "✅ تم استلام التحويل وتحديث المخزون" : "💾 اتسجل الاستلام محليًا وهيتزامن لما النت يرجع", "success");
        loadAll();
    };

    const pendingIncomingCount = incomingTransfers.filter((t) => t.status === "shipped" && !opForReceive(t.id)).length;
    const queuedCount = pendingOps.filter((o) => o.status === "queued").length;
    const failedCount = pendingOps.filter((o) => o.status === "failed").length;

    const statusLabel = (t) => {
        if (t.status === "shipped") return "⏳ لسه مستنية استلام الطرف التاني";
        if (t.status === "received") return "✅ مستلمة";
        if (t.status === "completed") return "✅ مسجّل";
        if (t.status === "cancelled") return "❌ ملغي";
        return t.status;
    };

    // إجماليات كل الشركاء (لشريط الملخص أعلى تاب الشركاء)
    const overall = useMemo(() => {
        let out = 0, inn = 0;
        partners.forEach((p) => {
            const s = buildStatement(p, "", "");
            out += s.totalOut;
            inn += s.totalIn;
        });
        return { out, inn, net: out - inn };
    }, [partners, outgoingTransfers, incomingTransfers, pendingOps]);

    // كارت عملية معلّقة (إرسال أو استلام)
    const PendingCard = ({ op }) => (
        <div style={{
            border: `1px dashed ${op.status === "failed" ? COLORS.red : COLORS.gold}`, borderRadius: 10, padding: 14, marginBottom: 10,
            background: COLORS.surfaceAlt,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                    <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                        {op.kind === "send" ? `إلى ${op.partner_name || "GLN " + op.partner_gln}` : `استلام تحويل ${String(op.transfer_id).slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 12, color: op.status === "failed" ? COLORS.red : COLORS.gold }}>
                        {op.status === "failed"
                            ? `⚠️ فشلت: ${op.error || "خطأ غير معروف"}`
                            : "⏳ في انتظار المزامنة (اتسجل محليًا)"}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textDim }}>
                        {(op.lines || []).length} سطر — {money(op.total_cost)} ر.س
                    </div>
                </div>
                {op.status === "failed" && (
                    <Btn size="sm" variant="danger" onClick={() => revertOp(op)}>إرجاع المخزون المحلي</Btn>
                )}
            </div>
            <div style={{ marginTop: 8 }}>
                {(op.lines || []).map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: COLORS.textDim }}>
                        {l.product_name} — تشغيلة {l.batch_number || "-"} — صلاحية {l.expiry_date || "-"} — كمية {l.qty}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div>
            {/* ===== شريط حالة الاتصال والمزامنة ===== */}
            {(!isOnline || fromCache || queuedCount > 0 || failedCount > 0) && (
                <div style={{
                    marginBottom: 14, padding: "10px 14px", borderRadius: 10, fontSize: 12,
                    background: COLORS.surfaceAlt, border: `1px solid ${failedCount > 0 ? COLORS.red : COLORS.gold}`, color: COLORS.textPrimary,
                }}>
                    {!isOnline && <div>🔌 أوفلاين — التحويل والاستلام بيتسجلوا محليًا ويتزامنوا لما النت يرجع. إضافة الشركاء وتعديلهم محتاجين نت.</div>}
                    {isOnline && fromCache && <div>البيانات المعروضة من آخر تحميل محفوظ (تعذّر التحديث من السيرفر).</div>}
                    {queuedCount > 0 && <div>⏳ {queuedCount} عملية في انتظار المزامنة</div>}
                    {failedCount > 0 && <div style={{ color: COLORS.red }}>⚠️ {failedCount} عملية فشلت — راجعها وأرجع تأثيرها على المخزون المحلي</div>}
                </div>
            )}

            {/* ===== التابات ===== */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 12, flexWrap: "wrap" }}>
                <Btn size="sm" variant={tab === "send" ? "primary" : "ghost"} onClick={() => setTab("send")}>تحويلات صادرة</Btn>
                <Btn size="sm" variant={tab === "incoming" ? "primary" : "ghost"} onClick={() => setTab("incoming")}>
                    تحويلات واردة{pendingIncomingCount > 0 ? ` (${pendingIncomingCount})` : ""}
                </Btn>
                <Btn size="sm" variant={tab === "partners" ? "primary" : "ghost"} onClick={() => setTab("partners")}>الصيدليات الشريكة</Btn>
            </div>

            {/* ===== تحويلات صادرة ===== */}
            {tab === "send" && (
                <div>
                    {canAdd && <Btn icon="plus" onClick={() => openSend()} style={{ marginBottom: 16 }}>تحويل جديد</Btn>}

                    {pendingOps.filter((o) => o.kind === "send").map((op) => <PendingCard key={op.id} op={op} />)}

                    {outgoingTransfers.length === 0 && pendingOps.filter((o) => o.kind === "send").length === 0 && (
                        <div style={{ fontSize: 13, color: COLORS.textDim }}>مفيش تحويلات صادرة لسه</div>
                    )}
                    {outgoingTransfers.map((t) => (
                        <div key={t.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                                        إلى {partnerByGln(t.to_gln)?.name || t.to_name || "GLN " + t.to_gln}
                                    </div>
                                    <div style={{ fontSize: 12, color: COLORS.textDim }}>
                                        GLN {t.to_gln} — {(t.pharmacy_transfer_items || []).length} سطر — {money(t.total_cost)} ر.س — {statusLabel(t)}
                                    </div>
                                </div>
                                <Btn size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                                    {expandedId === t.id ? "إخفاء" : "التفاصيل"}
                                </Btn>
                            </div>
                            {expandedId === t.id && (
                                <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                                    {(t.pharmacy_transfer_items || []).map((it) => (
                                        <div key={it.id} style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>
                                            {it.product_name} — GTIN {it.product_gtin} — تشغيلة {it.batch_number || "-"} — صلاحية {it.expiry_date || "-"} — كمية {it.qty}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ===== تحويلات واردة ===== */}
            {tab === "incoming" && (
                <div>
                    {incomingTransfers.length === 0 && <div style={{ fontSize: 13, color: COLORS.textDim }}>مفيش تحويلات واردة</div>}
                    {incomingTransfers.map((t) => {
                        const op = opForReceive(t.id);
                        if (op) return <PendingCard key={t.id} op={op} />;
                        return (
                            <div key={t.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: COLORS.textPrimary }}>
                                            من {partnerByGln(t.from_gln)?.name || "GLN " + t.from_gln}
                                        </div>
                                        <div style={{ fontSize: 12, color: COLORS.textDim }}>
                                            {(t.pharmacy_transfer_items || []).length} سطر — {money(t.total_cost)} ر.س
                                        </div>
                                    </div>
                                    {t.status === "shipped" ? (
                                        <Btn size="sm" onClick={() => receiveTransfer(t)} disabled={receivingId === t.id}>
                                            {receivingId === t.id ? "جارٍ الاستلام..." : "استلام"}
                                        </Btn>
                                    ) : (
                                        <span style={{ fontSize: 12, color: COLORS.green }}>{statusLabel(t)}</span>
                                    )}
                                </div>
                                <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                                    {(t.pharmacy_transfer_items || []).map((it) => (
                                        <div key={it.id} style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4 }}>
                                            {it.product_name} — تشغيلة {it.batch_number || "-"} — صلاحية {it.expiry_date || "-"} — كمية {it.qty}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {!isOnline && (
                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 8 }}>
                            التحويلات الجديدة اللي أرسلتها صيدليات تانية بتظهر هنا لما النت يشتغل.
                        </div>
                    )}
                </div>
            )}

            {/* ===== الصيدليات الشريكة ===== */}
            {tab === "partners" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
                        <input
                            value={partnerSearch}
                            onChange={(e) => setPartnerSearch(e.target.value)}
                            placeholder="ابحث بالاسم أو الـGLN أو الجوال..."
                            style={{
                                flex: 1, minWidth: 220, maxWidth: 360, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                                borderRadius: 9, padding: "10px 14px", color: COLORS.textPrimary, fontSize: 14, outline: "none", boxSizing: "border-box",
                            }}
                        />
                        {canAdd && <Btn icon="plus" onClick={openAddPartner} disabled={!isOnline}>إضافة شريك</Btn>}
                    </div>

                    {partners.length > 0 && (
                        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 140, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>إجمالي الصادر</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.textPrimary }}>{money(overall.out)} ر.س</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 140, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>إجمالي الوارد</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.textPrimary }}>{money(overall.inn)} ر.س</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 140, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>الصافي</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: netInfo(overall.net).color }}>{netInfo(overall.net).text}</div>
                            </div>
                        </div>
                    )}

                    {partners.length === 0 && (
                        <div style={{ fontSize: 13, color: COLORS.textDim }}>
                            مفيش صيدليات شريكة لسه — أضف صيدلية بالـGLN بتاعها عشان تقدر تحوّل ليها وتتابع حسابها.
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                        {filteredPartners.map((p) => {
                            const s = buildStatement(p, "", "");
                            const info = netInfo(s.net);
                            const hasPending = s.pendingOut > 0 || s.pendingIn > 0;
                            return (
                                <div key={p.id} style={{
                                    background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
                                    borderTop: `3px solid ${info.color}`,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 15 }}>{p.name}</div>
                                            <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 2 }}>GLN: {p.gln}</div>
                                        </div>
                                        {p.linked_pharmacy_id
                                            ? <Badge color={COLORS.greenSoft} text={COLORS.green}>على النظام</Badge>
                                            : <Badge color={COLORS.goldSoft} text={COLORS.gold}>خارجي</Badge>}
                                    </div>

                                    <div style={{ padding: "8px 0", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 10 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: info.color, marginBottom: 6 }}>{info.text}</div>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textDim }}>
                                            <span>صادر: {money(s.totalOut)}</span>
                                            <span>وارد: {money(s.totalIn)}</span>
                                        </div>
                                        {hasPending && (
                                            <div style={{ fontSize: 11, color: COLORS.gold, marginTop: 6 }}>
                                                ⏳ قيد الاستلام/المزامنة — صادر {money(s.pendingOut)} / وارد {money(s.pendingIn)}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                                        {p.phone && <div style={{ fontSize: 11, color: COLORS.textDim }}>📞 {p.phone}</div>}
                                        {p.contact && <div style={{ fontSize: 11, color: COLORS.textDim }}>👤 {p.contact}</div>}
                                        {p.notes && <div style={{ fontSize: 11, color: COLORS.textDim }}>📝 {p.notes}</div>}
                                    </div>

                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {canAdd && (
                                            <Btn size="sm" icon="purchase" onClick={() => openSend(p)} style={{ flex: 1, justifyContent: "center" }}>
                                                تحويل
                                            </Btn>
                                        )}
                                        <Btn size="sm" icon="printer" variant="secondary" onClick={() => { setStatementRange({ from: "", to: "" }); setShowStatement(p); }}>
                                            📄 كشف حساب
                                        </Btn>
                                        {p.whatsapp && (
                                            <button onClick={() => window.open(`https://wa.me/${p.whatsapp}`, "_blank")}
                                                style={{ padding: "6px 10px", background: COLORS.greenSoft, border: `1px solid ${COLORS.green}`, borderRadius: 7, color: COLORS.green, cursor: "pointer", fontSize: 14 }}>
                                                💬
                                            </button>
                                        )}
                                        {canEdit && <Btn size="sm" icon="edit" variant="secondary" onClick={() => openEditPartner(p)} disabled={!isOnline}>تعديل</Btn>}
                                        {canDelete && <Btn size="sm" icon="trash" variant="danger" onClick={() => deletePartner(p)} disabled={!isOnline}>حذف</Btn>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ===== مودال إضافة/تعديل شريك ===== */}
            {showPartnerForm && (
                <Modal open wide onClose={() => setShowPartnerForm(false)} title={partnerForm.id ? "تعديل الشريك" : "إضافة صيدلية شريكة"}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                            <div style={{ flex: 1 }}>
                                <Input
                                    label="GLN الصيدلية *"
                                    value={partnerForm.gln}
                                    onChange={(v) => { PF("gln", v); setPartnerLookup(null); }}
                                    placeholder="مثال: 6281234567890"
                                />
                            </div>
                            <Btn size="sm" variant="secondary" onClick={lookupGln} disabled={lookingUp}>
                                {lookingUp ? "..." : "بحث على النظام"}
                            </Btn>
                        </div>
                        {partnerLookup?.tenant && (
                            <div style={{ fontSize: 13, color: COLORS.green }}>
                                ✅ صيدلية على النظام: {partnerLookup.name} — التحويل ليها بيحتاج استلامها
                            </div>
                        )}
                        {partnerLookup && !partnerLookup.tenant && (
                            <div style={{ fontSize: 13, color: COLORS.gold }}>
                                مش موجودة على النظام — هتتعامل كصيدلية خارجية (تسجيل صادر فقط)، اكتب اسمها
                            </div>
                        )}
                        <Input label="الاسم *" value={partnerForm.name} onChange={(v) => PF("name", v)} placeholder="اسم الصيدلية/الفرع" />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <Input label="رقم الهاتف" value={partnerForm.phone} onChange={(v) => PF("phone", v)} />
                            <Input label="واتساب" value={partnerForm.whatsapp} onChange={(v) => PF("whatsapp", v)} placeholder="9665XXXXXXXX" />
                        </div>
                        <Input label="مسؤول التواصل" value={partnerForm.contact} onChange={(v) => PF("contact", v)} />
                        <Input label="الرقم الضريبي" value={partnerForm.tax_id} onChange={(v) => PF("tax_id", v)} />
                        <Input label="ملاحظات" value={partnerForm.notes} onChange={(v) => PF("notes", v)} placeholder="اختياري" />
                        {partnerForm.id && (
                            <div style={{ fontSize: 11, color: COLORS.textDim }}>
                                الـGLN مقفول التعديل بعد وجود تحويلات مع الشريك (الحركات مربوطة بيه).
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
                        <Btn variant="ghost" onClick={() => setShowPartnerForm(false)}>إلغاء</Btn>
                        <Btn icon="check" onClick={savePartner} disabled={savingPartner}>
                            {savingPartner ? "جارٍ الحفظ..." : partnerForm.id ? "حفظ التعديل" : "إضافة الشريك"}
                        </Btn>
                    </div>
                </Modal>
            )}

            {/* ===== مودال كشف حساب الشريك ===== */}
            {showStatement && (() => {
                const st = buildStatement(showStatement, statementRange.from, statementRange.to);
                const info = netInfo(st.net);
                return (
                    <Modal open wide onClose={() => setShowStatement(null)} title={`كشف حساب تحويلات — ${showStatement.name}`}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                            <div>
                                <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>من تاريخ</label>
                                <input type="date" value={statementRange.from}
                                    onChange={(e) => setStatementRange((p) => ({ ...p, from: e.target.value }))}
                                    style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 12, color: COLORS.textDim, display: "block", marginBottom: 6 }}>إلى تاريخ</label>
                                <input type="date" value={statementRange.to}
                                    onChange={(e) => setStatementRange((p) => ({ ...p, to: e.target.value }))}
                                    style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.textPrimary, fontSize: 13 }} />
                            </div>
                            <Btn size="sm" variant="ghost" onClick={() => setStatementRange({ from: "", to: "" })}>كل الفترة</Btn>
                            <div style={{ flex: 1 }} />
                            <Btn icon="printer" onClick={() => printPartnerStatement(showStatement, statementRange.from, statementRange.to)}>🖨️ طباعة (A4)</Btn>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 120, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>إجمالي الصادر</div>
                                <div style={{ fontSize: 15, fontWeight: 800 }}>{money(st.totalOut)} ر.س</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 120, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>إجمالي الوارد</div>
                                <div style={{ fontSize: 15, fontWeight: 800 }}>{money(st.totalIn)} ر.س</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 120, background: COLORS.surfaceAlt, borderRadius: 10, padding: 12, textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: COLORS.textDim }}>الصافي</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: info.color }}>{info.text}</div>
                            </div>
                        </div>

                        {(st.pendingOut > 0 || st.pendingIn > 0) && (
                            <div style={{ fontSize: 12, color: COLORS.gold, marginBottom: 10 }}>
                                ⏳ قيد الاستلام/المزامنة (غير محسوب في الصافي): صادر {money(st.pendingOut)} — وارد {money(st.pendingIn)} ر.س
                            </div>
                        )}

                        <div style={{ maxHeight: 380, overflowY: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                                        {["التاريخ", "البيان", "صادر", "وارد", "الصافي"].map((h) => (
                                            <th key={h} style={{ textAlign: "right", padding: "6px 8px", color: COLORS.textDim, fontWeight: 600 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {st.rows.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: COLORS.textDim }}>لا توجد حركات خلال هذه الفترة</td></tr>
                                    ) : st.rows.map((r) => (
                                        <tr key={r.key} style={{ borderBottom: `1px solid ${COLORS.border}`, opacity: r.pending ? 0.6 : 1 }}>
                                            <td style={{ padding: "6px 8px" }}>{r.date}</td>
                                            <td style={{ padding: "6px 8px" }}>{r.label}</td>
                                            <td style={{ padding: "6px 8px" }}>{r.out ? money(r.out) : "—"}</td>
                                            <td style={{ padding: "6px 8px" }}>{r.inn ? money(r.inn) : "—"}</td>
                                            <td style={{ padding: "6px 8px", fontWeight: 700 }}>{money(r.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 10 }}>
                            القيم بسعر التكلفة. الصافي الموجب = أرسلنا أكتر، والسالب = استلمنا أكتر.
                        </div>
                    </Modal>
                );
            })()}

            {/* ===== مودال تحويل جديد ===== */}
            {showSendModal && (
                <Modal open wide onClose={() => { setShowSendModal(false); }} title="تحويل صادر جديد">
                    {partners.length === 0 ? (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 10 }}>مفيش صيدليات شريكة لسه — أضف الصيدلية المستقبلة الأول (بيحتاج نت).</div>
                            <Btn icon="plus" onClick={() => { setShowSendModal(false); setTab("partners"); openAddPartner(); }}>إضافة شريك</Btn>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 14 }}>
                            <Select
                                label="الصيدلية المستقبلة"
                                value={sendPartnerId}
                                onChange={setSendPartnerId}
                                options={[
                                    { value: "", label: "اختر الشريك" },
                                    ...partners.map((p) => ({ value: p.id, label: `${p.name} — ${p.linked_pharmacy_id ? "على النظام" : "خارجي"}` })),
                                ]}
                            />
                            {selectedSendPartner && (
                                <div style={{ fontSize: 12, marginTop: 6, color: selectedSendPartner.linked_pharmacy_id ? COLORS.green : COLORS.gold }}>
                                    {selectedSendPartner.linked_pharmacy_id
                                        ? "على النظام — التحويل هيفضل \"مستني استلام\" لحد ما الطرف التاني يستلمه"
                                        : "خارجي — تسجيل صادر فقط (مفيش استلام في النظام)"}
                                </div>
                            )}
                            {!isOnline && (
                                <div style={{ fontSize: 12, marginTop: 6, color: COLORS.gold }}>
                                    🔌 أوفلاين — التحويل هيتسجل محليًا ويتزامن لما النت يرجع
                                </div>
                            )}
                        </div>
                    )}

                    {selectedSendPartner && (
                        <>
                            {/* السكانر: بيحدد الصنف + التشغيلة + الصلاحية */}
                            <div style={{ marginBottom: 8, fontSize: 13, color: COLORS.textDim }}>امسح علبة الصنف (QR / DataMatrix)</div>
                            <BarcodeScanner ref={scannerRef} onScan={handleScan} placeholder="امسح الكود..." />

                            {/* اختيار الباتش (الكود مفيهوش تشغيلة/صلاحية، أو أكتر من باتش مطابق، أو بحث يدوي) */}
                            {pickState && (
                                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, margin: "10px 0", background: COLORS.surfaceAlt }}>
                                    <div style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700 }}>
                                        {productLabel(pickState.product)} — {pickState.reason}
                                    </div>
                                    {pickState.candidates.map((b) => (
                                        <div
                                            key={b.id || `${b.batch_number}-${b.expiry_date}`}
                                            onClick={() => { addBatchLine(pickState.product, b); setPickState(null); refocusScanner(); }}
                                            style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderTop: `1px solid ${COLORS.border}` }}
                                        >
                                            تشغيلة {b.batch_number || "-"} — صلاحية {b.expiry_date || "-"} — متاح {b.qty} — تكلفة {b.cost}
                                        </div>
                                    ))}
                                    <div
                                        onClick={() => { setPickState(null); refocusScanner(); }}
                                        style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", borderTop: `1px solid ${COLORS.border}`, color: COLORS.textDim }}
                                    >
                                        إلغاء
                                    </div>
                                </div>
                            )}

                            {/* بحث يدوي (للأصناف اللي مفيهاش QR) */}
                            <div style={{ margin: "10px 0 6px" }}>
                                <Input label="أو دوّر على صنف يدويًا" value={lineSearch} onChange={setLineSearch} placeholder="بالاسم أو الباركود" />
                            </div>
                            {searchResults.length > 0 && (
                                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 14, maxHeight: 180, overflowY: "auto" }}>
                                    {searchResults.map((p) => (
                                        <div key={p.id} onClick={() => startManualPick(p)}
                                            style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}>
                                            {productLabel(p)} — رصيد {p.stock}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {lines.map((l) => (
                                <div key={l.batch.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13 }}>{productLabel(l.product)}</div>
                                        <div style={{ fontSize: 11, color: COLORS.textDim }}>
                                            تشغيلة {l.batch.batch_number || "-"} — صلاحية {l.batch.expiry_date || "-"} — متاح {l.batch.qty}
                                        </div>
                                    </div>
                                    <input
                                        type="number" min="1" max={l.batch.qty} value={l.qty}
                                        onChange={(e) => updateLine(l.batch.id, { qty: e.target.value })}
                                        style={{ width: 60, padding: 4, borderRadius: 6, border: `1px solid ${COLORS.border}` }}
                                    />
                                    <Btn size="sm" variant="ghost" onClick={() => removeLine(l.batch.id)}>حذف</Btn>
                                </div>
                            ))}
                        </>
                    )}

                    <Btn
                        onClick={submitTransfer}
                        disabled={submitting || lines.length === 0 || !selectedSendPartner}
                        style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
                    >
                        {submitting ? "جارٍ التسجيل..." : "تسجيل التحويل"}
                    </Btn>
                </Modal>
            )}
        </div>
    );
}
