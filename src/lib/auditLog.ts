import { supabase } from "./supabaseClient";
import { COLORS } from "../theme";

// ==================== AUDIT LOG ====================
// 🆕 دالة عامة لتسجيل أي عملية حساسة (حذف/تعديل سعر/إلغاء فاتورة/تعديل مخزون...) في جدول audit_logs.
// بتتنادى من أي مكان في البرنامج قبل أو بعد تنفيذ العملية مباشرة.
// ملحوظة: فشل تسجيل الـ audit log لا يوقف العملية الأساسية للمستخدم (بنسجل الخطأ في console بس).
export async function logAudit(params: {
  pharmacyId: string;
  userName: string;
  action: "create" | "update" | "delete" | "cancel";
  entityType: string;      // "product" | "invoice" | "customer" | "supplier" | "inventory" ...
  entityId?: string | number | null;
  entityLabel?: string;    // اسم الصنف/العميل وقت العملية (يفيد لو الأصل اتحذف بعدين)
  oldValue?: any;
  newValue?: any;
  description?: string;
}) {
  try {
    await supabase.from("audit_logs").insert({
      pharmacy_id: params.pharmacyId,
      user_name: params.userName || "غير معروف",
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId != null ? String(params.entityId) : null,
      entity_label: params.entityLabel || null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      description: params.description || null,
    });
  } catch (e) {
    console.error("audit log failed:", e);
  }
}



// ==================== مكوّن عرض سجل العمليات (Audit Log Viewer) ====================
export const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: "➕ إضافة", color: COLORS.green, bg: COLORS.greenSoft },
  update: { label: "✏️ تعديل", color: COLORS.gold, bg: COLORS.goldSoft },
  delete: { label: "🗑️ حذف", color: COLORS.red, bg: COLORS.redSoft },
  cancel: { label: "⛔ إلغاء", color: COLORS.red, bg: COLORS.redSoft },
};


export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  product: "صنف", supplier: "مورد", customer: "عميل", invoice: "فاتورة",
  inventory: "مخزون", purchase: "فاتورة شراء", return: "مرتجع",
};
