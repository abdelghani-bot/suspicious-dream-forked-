// lib/shiftClosingPrint.ts
// ═══════════════════════════════════════════════════════════════════════════
// 🆕 تقرير تقفيل الشفت — الصيدلي بيطبع شفته هو، مش تقفيل اليوم كله.
// ليه ملف مستقل؟ عشان نفس الدالة تتنادى من تاب الشفتات في الخزنة ومن شاشة تقفيل الشفت نفسها
// من غير ما نكرر الحساب (تكرار الحساب هو اللي كان بيعمل فروقات بين الخزنة والداشبورد قبل كده).
// ═══════════════════════════════════════════════════════════════════════════
import { printHTML } from "./printHelper";
import { splitSaleByMethod } from "./treasuryUtils";

// تطبيع الهمزات والمسافات: "آجل" / "أجل" / "اجل" كلهم نفس الشيء (نفس منطق الداشبورد)
const normPay = (v: any) => String(v ?? "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
const isCreditSale = (s: any) => normPay(s?.payment) === "اجل";

const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const fmt = (n: number) => (Number(n) || 0).toFixed(2);
// 🆕 مقارنة "الساعة المكتوبة" بدل Date() الخام: start_time/end_time في الشفت بصيغة فيها "Z" وcreated_at للمرتجع/السداد
// بدون "Z" (ساعة محلية)، فالمقارنة العادية كانت بتطلّع فرق 3 ساعات وتستبعد المرتجع من الشفت.
const ts = (v: any) => {
    if (!v) return NaN;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : new Date(v).getTime();
};

export type ShiftClosingReport = {
    shiftId: string;
    user: string;
    startTime: string;
    endTime: string | null;
    isOpen: boolean;
    count: number; // عدد فواتير الشفت
    cash: number; // نقدي (شامل جزء الكاش من المختلط)
    card: number;
    transfer: number;
    ajilTotal: number; // إجمالي فواتير الآجل المبيعة في الشفت (مش داخل في المبيعات المحصّلة)
    ajilCount: number;
    creditPaid: number; // سداد آجل اتحصّل أثناء الشفت
    returnsCash: number;
    returnsCard: number;
    returnsTransfer: number;
    returnsTotal: number;
    creditReturns: number; // مرتجع فواتير آجل (بيتخصم من المديونية، مفيش فلوس خرجت)
    collected: number; // كاش + شبكة + تحويل + سداد آجل
    net: number; // المحصّل − المرتجعات (نفس تعريف "مبيعات اليوم" في الداشبورد)
    expectedCash: number; // المفروض يكون في الدرج: نقدي + سداد آجل − مرتجع نقدي
};

export function computeShiftClosing({
    shift,
    sales = [],
    creditPayments = [],
    returns = [],
    now = Date.now(),
}: {
    shift: any;
    sales?: any[];
    creditPayments?: any[];
    returns?: any[];
    now?: number;
}): ShiftClosingReport {
    const start = ts(shift.start_time);
    const end = shift.end_time ? ts(shift.end_time) : now;
    const inWindow = (t: any) => {
        const x = ts(t);
        return !isNaN(x) && x >= start && x <= end;
    };

    // فواتير الشفت (بما فيها المرتجعة بالكامل: مرتجعها بيتخصم مرة واحدة من قيود/جدول المرتجعات)
    const shiftSales = (sales || []).filter((s) => s.shift === shift.id);
    const creditSales = shiftSales.filter((s) => isCreditSale(s) && !s.returned);
    const nonCredit = shiftSales.filter((s) => !isCreditSale(s));

    // 🆕 الآجل مش كاش ولا شبكة — بنشيله من التوزيع صراحةً (مايعتمدش على سلوك splitSaleByMethod الافتراضي)
    const sum = (m: string) => nonCredit.reduce((a, s) => a + ((splitSaleByMethod(s) as any)[m] || 0), 0);
    const cash = sum("نقدي");
    const card = sum("بطاقة");
    const transfer = sum("تحويل");

    const ajilTotal = creditSales.reduce((a, s) => a + (s.total || 0), 0);

    // سداد الآجل اللي اتحصّل أثناء الشفت (بوقت السداد). لو السجل مالوش created_at (قديم) بنربطه بفواتير آجل الشفت.
    const creditIds = new Set(creditSales.map((s) => s.id));
    const creditPaid = (creditPayments || [])
        .filter((p) => (p.created_at ? inWindow(p.created_at) : creditIds.has(p.invoice_id)))
        .reduce((a, p) => a + (p.amount || 0), 0);

    // مرتجعات الشفت بوقت المرتجع نفسه (الكاشير هو اللي رجّع الفلوس في شفته)
    const shiftReturns = (returns || []).filter((r) => r && r.type === "sales" && inWindow(r.created_at));
    const refundRows = shiftReturns.filter((r) => r.refund_method !== null); // null = مرتجع آجل
    const byMethod = (m: string) =>
        refundRows
            .filter((r) => {
                const rm = r.refund_method || "نقدي";
                return m === "نقدي" ? rm !== "بطاقة" && rm !== "تحويل" : rm === m;
            })
            .reduce((a, r) => a + (r.total || 0), 0);
    const returnsCash = byMethod("نقدي");
    const returnsCard = byMethod("بطاقة");
    const returnsTransfer = byMethod("تحويل");
    const returnsTotal = returnsCash + returnsCard + returnsTransfer;
    const creditReturns = shiftReturns.filter((r) => r.refund_method === null).reduce((a, r) => a + (r.total || 0), 0);

    const collected = cash + card + transfer + creditPaid;
    return {
        shiftId: shift.id,
        user: shift.user || "",
        startTime: shift.start_time,
        endTime: shift.end_time || null,
        isOpen: !shift.end_time,
        count: shiftSales.length,
        cash, card, transfer,
        ajilTotal, ajilCount: creditSales.length,
        creditPaid,
        returnsCash, returnsCard, returnsTransfer, returnsTotal, creditReturns,
        collected,
        net: collected - returnsTotal,
        expectedCash: cash + creditPaid - returnsCash,
    };
}

type PharmInfo = {
    name?: string; address?: string; taxNumber?: string;
    reportsPrinterName?: string; thermalPrinterName?: string; receiptPaperWidth?: string;
};

const when = (v: any) => (v ? new Date(v).toLocaleString("ar-SA") : "—");

// الصفوف المشتركة بين A4 والإيصال: [الوصف، المبلغ، لون/إشارة]
const rowsOf = (r: ShiftClosingReport) => ({
    income: [
        ["💵 نقدي", r.cash],
        ["💳 بطاقة", r.card],
        ["🏦 تحويل", r.transfer],
        ["سداد آجل (محصّل)", r.creditPaid],
    ] as [string, number][],
    out: [
        ["مرتجع نقدي", r.returnsCash],
        ["مرتجع بطاقة", r.returnsCard],
        ["مرتجع تحويل", r.returnsTransfer],
    ].filter(([, v]) => (v as number) > 0) as [string, number][],
});

export function printShiftClosing(report: ShiftClosingReport, pharm: PharmInfo = {}, mode: "a4" | "receipt" = "a4") {
    const { income, out } = rowsOf(report);
    const title = `تقرير تقفيل شفت — ${esc(report.user)}`;
    const status = report.isOpen ? "⚠️ شفت مفتوح — تقرير مبدئي" : "✅ شفت مُقفل";
    const ajilNote = report.ajilTotal > 0
        ? `آجل مباع في الشفت: ${fmt(report.ajilTotal)} (${report.ajilCount} فاتورة) — غير داخل في المبيعات، بيدخل عند السداد`
        : "";
    const creditRetNote = report.creditReturns > 0 ? `مرتجع فواتير آجل (من المديونية): ${fmt(report.creditReturns)}` : "";

    if (mode === "receipt") {
        const paperWidthMm = pharm.receiptPaperWidth === "58" ? 58 : 80;
        const bodyWidthMm = paperWidthMm - 4;
        const row = (l: string, v: number, sign = "") =>
            `<div class="r"><span>${l}</span><span class="a">${sign}${fmt(v)}</span></div>`;
        const html = `
<html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>
 * { margin:0; padding:0; box-sizing:border-box; font-family:'Courier New', Arial, sans-serif; }
 @page { size:${paperWidthMm}mm auto; margin:0; }
 body { width:${bodyWidthMm}mm; margin:0 auto; color:#000; font-size:12px; padding:3mm 3mm 8mm; }
 .c { text-align:center; } .d { border-top:1px dashed #000; margin:6px 0; }
 h1 { font-size:14px; } .s { font-size:10px; color:#333; }
 .r { display:flex; justify-content:space-between; padding:2px 0; } .a { font-weight:900; font-size:13px; }
 .t { display:flex; justify-content:space-between; font-size:15px; font-weight:900; border-top:1px solid #000; padding-top:5px; margin-top:6px; }
 .m { font-size:9px; color:#333; margin-top:8px; border-top:1px dashed #000; padding-top:6px; }
</style></head><body>
 <div class="c"><h1>${esc(pharm.name || "الصيدلية")}</h1>
  ${pharm.address ? `<div class="s">${esc(pharm.address)}</div>` : ""}
  ${pharm.taxNumber ? `<div class="s">الرقم الضريبي: ${esc(pharm.taxNumber)}</div>` : ""}
  <div class="s" style="font-weight:bold;margin-top:4px">${title}</div>
  <div class="s">${status}</div></div>
 <div class="d"></div>
 <div class="r"><span>الشفت</span><span>${esc(report.shiftId)}</span></div>
 <div class="r"><span>من</span><span>${when(report.startTime)}</span></div>
 <div class="r"><span>إلى</span><span>${report.isOpen ? "الآن" : when(report.endTime)}</span></div>
 <div class="r"><span>عدد الفواتير</span><span class="a">${report.count}</span></div>
 <div class="d"></div>
 ${income.map(([l, v]) => row(l, v)).join("")}
 <div class="r" style="border-top:1px dashed #000;margin-top:3px"><span>إجمالي المحصّل</span><span class="a">${fmt(report.collected)}</span></div>
 ${out.length ? `<div class="d"></div>${out.map(([l, v]) => row(l, v, "-")).join("")}` : ""}
 <div class="t"><span>صافي الشفت</span><span>${fmt(report.net)} ر.س</span></div>
 <div class="r" style="margin-top:6px"><span>المفروض في الدرج (نقدي)</span><span class="a">${fmt(report.expectedCash)}</span></div>
 ${ajilNote || creditRetNote ? `<div class="d"></div><div class="s">${[ajilNote, creditRetNote].filter(Boolean).join("<br>")}</div>` : ""}
 <div class="m c">طُبع بواسطة: ${esc(report.user)} — ${when(Date.now())}</div>
</body></html>`;
        // طابعة الإيصالات الحرارية (نفس إعداد تقفيل اليوم)
        printHTML(html, { deviceName: pharm.thermalPrinterName || undefined });
        return;
    }

    const box = (l: string, v: number | string) => `<div class="box"><div class="lbl">${l}</div><div class="val">${typeof v === "number" ? fmt(v) : v}</div></div>`;
    const tr = (l: string, v: number, sign: string, color: string) =>
        `<tr><td>${l}</td><td style="text-align:left;font-weight:bold;color:${color}">${sign}${fmt(v)}</td></tr>`;
    const html = `
<html dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>
 * { margin:0; padding:0; box-sizing:border-box; font-family:Arial, sans-serif; }
 @page { size:A4; margin:14mm; }
 body { color:#111; font-size:13px; }
 .header { text-align:center; border-bottom:2px solid #222; padding-bottom:10px; margin-bottom:16px; }
 .header h1 { font-size:18px; margin-bottom:4px; } .sub { color:#555; font-size:12px; }
 h2 { font-size:15px; margin:18px 0 8px; border-right:4px solid #0a7a3a; padding-right:8px; }
 table { width:100%; border-collapse:collapse; margin-bottom:10px; }
 th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; } th { background:#f2f2f2; text-align:right; }
 .summary { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
 .box { flex:1; min-width:110px; border:1px solid #ccc; border-radius:6px; padding:10px; text-align:center; }
 .box .lbl { font-size:11px; color:#666; margin-bottom:4px; } .box .val { font-size:16px; font-weight:bold; }
 .total-line { display:flex; justify-content:space-between; font-size:15px; font-weight:bold; border-top:2px solid #222; padding-top:8px; margin-top:8px; }
 .note { color:#7a4b00; background:#fff7e6; border:1px solid #f0d9a8; border-radius:6px; padding:8px 10px; font-size:12px; margin-top:10px; }
 .sign { display:flex; justify-content:space-between; margin-top:40px; font-size:12px; }
 .meta { color:#555; font-size:11px; margin-top:20px; border-top:1px dashed #999; padding-top:8px; }
</style></head><body>
 <div class="header"><h1>${esc(pharm.name || "الصيدلية")}</h1>
  <div class="sub">${esc(pharm.address || "")}${pharm.taxNumber ? " · الرقم الضريبي: " + esc(pharm.taxNumber) : ""}</div>
  <div class="sub" style="margin-top:6px;font-weight:bold">${title}</div>
  <div class="sub">${status}</div></div>
 <div class="summary">
  ${box("الشفت", esc(report.shiftId))}${box("بداية الشفت", when(report.startTime))}${box("نهاية الشفت", report.isOpen ? "الآن" : when(report.endTime))}${box("عدد الفواتير", String(report.count))}
 </div>
 <h2>المحصّل في الشفت</h2>
 <table><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody>
  ${income.map(([l, v]) => tr(l, v, "+", "#0a7a3a")).join("")}
  ${tr("إجمالي المحصّل", report.collected, "", "#111")}
 </tbody></table>
 ${out.length ? `<h2>المرتجعات</h2><table><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${out.map(([l, v]) => tr(l, v, "-", "#a30f0f")).join("")}</tbody></table>` : ""}
 <div class="total-line"><span>صافي الشفت</span><span>${fmt(report.net)} ر.س</span></div>
 <div class="total-line" style="border-top:1px dashed #222"><span>المفروض في الدرج (نقدي + سداد آجل − مرتجع نقدي)</span><span>${fmt(report.expectedCash)} ر.س</span></div>
 ${ajilNote || creditRetNote ? `<div class="note">${[ajilNote, creditRetNote].filter(Boolean).join("<br>")}</div>` : ""}
 <div class="sign"><span>توقيع الصيدلي: ______________</span><span>توقيع المستلم: ______________</span></div>
 <div class="meta">طُبع بواسطة: ${esc(report.user)} — ${when(Date.now())}</div>
</body></html>`;
    printHTML(html, { deviceName: pharm.reportsPrinterName || undefined });
}
