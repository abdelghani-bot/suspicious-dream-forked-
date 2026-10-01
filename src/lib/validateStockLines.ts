// lib/validateStockLines.ts
// ═══════════════════════════════════════════════════════════════════════
// شروط الحفظ المشتركة لأي شاشة بتدخّل مخزون: فاتورة شراء (جديدة/تعديل/استكمال مسودة)،
// رصيد افتتاحي، جرد دوري، وتسوية كشف المخزون.
//
// القاعدة لكل سطر بيضيف كمية (qty > 0):
//   1) تاريخ الصلاحية لازم يتدخّل
//   2) التكلفة أكبر من صفر
//   3) سعر البيع أكبر من صفر
//   4) التكلفة مينفعش تعدّي سعر البيع (لو متساويين مسموح — عشان خصم صفر
//      في فاتورة الشراء بيخلي التكلفة = سعر البيع)
// الأسطر اللي كميتها صفر (تصفير/تسوية بالنقص) بتتخطى كل الشروط دي —
// إلا لو الشاشة مررت { requirePositiveQty: true } (فاتورة الشراء): ساعتها
// الكمية لازم تكون أكبر من صفر وإلا السطر بيتعتبر خطأ.
// ═══════════════════════════════════════════════════════════════════════

export type StockLine = {
    name?: string;
    expiry_date?: string | null;
    cost?: number | string | null;
    price?: number | string | null; // سعر البيع
    qty?: number | string | null;   // الكمية اللي هتدخل المخزون (شاملة البونص لو فاتورة شراء)
    paidQty?: number | string | null; // الكمية المدفوعة (من غير بونص) — بتتفحص لما requirePositiveQty مفعّل
    requirePositiveQty?: boolean;     // تحديد على مستوى السطر (بيغلب الخيار العام) — للجرد
};

export type ValidateStockOptions = {
    /** فاتورة الشراء: الكمية المدفوعة (paidQty، أو qty لو مش متبعتة) لازم تكون > 0. */
    requirePositiveQty?: boolean;
};

export function validateStockLines(lines: StockLine[], opts: ValidateStockOptions = {}): string[] {
    const errors: string[] = [];
    lines.forEach((l, idx) => {
        const label = `سطر ${idx + 1} (${l.name || "بدون اسم"})`;

        if (l.requirePositiveQty ?? opts.requirePositiveQty) {
            if (!(Number(l.paidQty ?? l.qty) > 0)) {
                errors.push(`${label}: الكمية لازم تكون أكبر من صفر`);
                return; // مفيش فايدة نكمل باقي الشروط على سطر كميته صفر
            }
        } else if (l.qty !== undefined && l.qty !== null && !(Number(l.qty) > 0)) {
            // سطر كميته صفر أو أقل = مش بيضيف مخزون → مفيش شروط عليه
            return;
        }

        const cost = Number(l.cost);
        const price = Number(l.price);

        if (!l.expiry_date) errors.push(`${label}: تاريخ الصلاحية مطلوب`);
        if (!(cost > 0)) errors.push(`${label}: التكلفة لازم تكون أكبر من صفر`);
        if (!(price > 0)) errors.push(`${label}: سعر البيع لازم يكون أكبر من صفر`);
        if (cost > 0 && price > 0 && cost > price)
            errors.push(`${label}: التكلفة أعلى من سعر البيع`);
    });
    return errors;
}

// تسوية كمية (كشف المخزون): تاريخ الصلاحية مطلوب إلا لو التسوية بتصفّر الكمية
export function validateAdjustment(a: { expiry_date?: string | null; qty?: number | string | null }): string[] {
    const qty = Number(a.qty);
    if (!Number.isFinite(qty) || qty < 0) return ["الكمية غير صحيحة"];
    if (qty > 0 && !a.expiry_date) return ["تاريخ الصلاحية مطلوب للتسوية"];
    return [];
}

// نص جاهز للـ toast: أول 3 أخطاء + عدد الباقي
export function formatValidationToast(errors: string[], max = 3): string {
    const head = errors.slice(0, max).join("\n");
    const rest = errors.length - max;
    return "لا يمكن الحفظ:\n" + head + (rest > 0 ? `\n... و${rest} خطأ آخر` : "");
}
