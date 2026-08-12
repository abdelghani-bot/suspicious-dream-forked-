// ==================== دالة الطباعة الموحدة ====================
// تستخدم في أي مكان محتاج يطبع HTML: الفواتير، التقارير، كشف المخزون، الجرد، تقفيل الخزنة...
// في نسخة الديسكتوب (Electron): بتنادي main process عبر printAPI (نافذة مخفية + webContents.print)
// في نسخة المتصفح (Cloudflare): بترجع للسلوك القديم window.open + window.print تلقائيًا

interface PrintOptions {
    silent?: boolean; // true = يطبع مباشرة من غير ديالوج اختيار طابعة
    paperWidthMM?: number; // 🆕 عرض ورق حراري (58/80مم) - لو مش موجودة يتطبع A4
    deviceName?: string; // 🆕 اسم الطابعة (name مش displayName) المطلوب إجبارها
}

interface PrintResult {
    success: boolean;
    error?: string;
}

export async function printHTML(
    html: string,
    options?: PrintOptions
): Promise<PrintResult> {
    const printAPI = (window as any).printAPI;

    // نسخة الديسكتوب
    if (printAPI?.printHTML) {
        try {
            const result = await printAPI.printHTML(html, {
                silent: false,
                ...options,
            });
            if (!result.success) {
                console.error("فشلت الطباعة:", result.error);
            }
            return result;
        } catch (err) {
            console.error("خطأ أثناء الطباعة:", err);
            return { success: false, error: String(err) };
        }
    }
    // نسخة المتصفح - fallback للسلوك القديم
    const w = window.open("", "_blank", "width=400,height=700");
    if (!w) {
        console.error("فشل فتح نافذة الطباعة - ممكن يكون popup blocker شغال");
        return { success: false, error: "popup_blocked" };
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
    return { success: true };
}
export async function listPrinters(): Promise<
    { name: string; displayName: string; isDefault: boolean }[]
> {
    const printAPI = (window as any).printAPI;
    if (printAPI?.listPrinters) {
        try {
            return await printAPI.listPrinters();
        } catch (err) {
            console.error("فشل جلب قائمة الطابعات:", err);
            return [];
        }
    }
    return []; // نسخة المتصفح - مفيش طابعات نظام متاحة
}
