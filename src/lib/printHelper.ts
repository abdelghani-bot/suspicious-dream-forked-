// ==================== دالة الطباعة الموحدة ====================
// تستخدم في أي مكان محتاج يطبع HTML: الفواتير، التقارير، كشف المخزون، الجرد، تقفيل الخزنة...
// في نسخة الديسكتوب (Electron): بتنادي main process عبر printAPI (نافذة مخفية + webContents.print)
// في نسخة المتصفح (Cloudflare): بترجع للسلوك القديم window.open + window.print تلقائيًا

interface PrintOptions {
    silent?: boolean; // true = يطبع مباشرة من غير ديالوج اختيار طابعة
    paperWidthMM?: number; // 🆕 عرض ورق حراري (58/80مم) - لو مش موجودة يتطبع A4
    paperHeightMM?: number;
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
// ==================== طباعة ZPL مباشرة (Zebra Browser Print) ====================
export function loadZebraScripts() {
    const loadScript = (id: string, src: string) => {
        if (document.getElementById(id)) return;
        const s = document.createElement("script");
        s.id = id;
        s.src = src;
        s.async = false;
        document.body.appendChild(s);
    };
    loadScript("browserprint-sdk", "/browserprint/BrowserPrint-3.1.250.min.js");
    loadScript("browserprint-zebra-sdk", "/browserprint/BrowserPrint-Zebra-1.1.250.min.js");
}

// تحويل صورة Canvas لأوامر رسم ZPL (^GFA) — نفس منطق ملصق الباركود بالظبط
export function canvasToZPLGraphic(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h).data;
    const bytesPerRow = Math.ceil(w / 8);
    const totalBytes = bytesPerRow * h;
    let hex = "";
    for (let y = 0; y < h; y++) {
        for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = byteIdx * 8 + bit;
                let on = 0;
                if (x < w) {
                    const idx = (y * w + x) * 4;
                    const r = imgData[idx], g = imgData[idx + 1], b = imgData[idx + 2], a = imgData[idx + 3];
                    const brightness = (r + g + b) / 3;
                    on = a > 10 && brightness < 128 ? 1 : 0;
                }
                byte = (byte << 1) | on;
            }
            hex += byte.toString(16).padStart(2, "0");
        }
    }
    return { totalBytes, bytesPerRow, hex: hex.toUpperCase() };
}

export function sendZPL(zpl: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        const bp = (window as any).BrowserPrint;
        if (!bp) {
            resolve({ success: false, error: "Zebra Browser Print مش شغال" });
            return;
        }
        bp.getDefaultDevice(
            "printer",
            (device: any) => {
                device.send(
                    zpl,
                    () => resolve({ success: true }),
                    (err: any) => resolve({ success: false, error: String(err) })
                );
            },
            (err: any) => resolve({ success: false, error: String(err) })
        );
    });
}