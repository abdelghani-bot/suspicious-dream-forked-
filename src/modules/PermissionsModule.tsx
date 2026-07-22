import { useState, useEffect } from "react";
import { SUPABASE_URL, supabase } from "../lib/supabaseClient";
import { COLORS, tint } from "../theme";
import { Btn, Modal } from "../ui/primitives";

// ==================== PERMISSIONS MODULE ====================
// ── أقسام النظام ──
export const SYSTEM_SECTIONS = [
  { id: "dashboard",         label: "الرئيسية",             icon: "📊" },
  { id: "pos",               label: "نقطة البيع",           icon: "🛒" },
  { id: "purchase",          label: "فواتير الشراء",        icon: "📦" },
  { id: "returns",           label: "المرتجعات",            icon: "↩️", subItems: [
      { id: "sales",     label: "مرتجع المبيعات" },
      { id: "purchases", label: "مرتجع المشتريات" },
    ] },
  { id: "products",          label: "الأصناف والمخزون",    icon: "💊" },
  { id: "suppliers",         label: "الموردون",             icon: "🏭", subItems: [
      { id: "purchase_order", label: "طلب شراء" },
      { id: "payment",        label: "سداد" },
    ] },
  { id: "customers",         label: "العملاء",              icon: "👥" },
  { id: "loyalty",           label: "نقاط الولاء",         icon: "🌟" },
  { id: "reports",           label: "التقارير",             icon: "📈", subItems: [
      { id: "sales_report",             label: "تقرير المبيعات" },
      { id: "purchases_report",         label: "تقرير المشتريات" },
      { id: "products_report",          label: "تقرير الأصناف" },
      { id: "monthly_report",           label: "تقرير شهري" },
      { id: "sales_returns_report",     label: "تقرير مرتجع المبيعات" },
      { id: "purchases_returns_report", label: "تقرير مرتجع المشتريات" },
    ] },
  { id: "tax_report",        label: "التقرير الضريبي",     icon: "🧾" },
  { id: "financial_health",  label: "الموقف المالي",        icon: "💵", subItems: [
      { id: "alerts_log",   label: "سجل التنبيهات" },
      { id: "alert_limits", label: "حدود التنبيه" },
      { id: "update_month", label: "تحديث بيانات الشهر الحالي" },
    ] },
  { id: "promotions",        label: "العروض والخصومات",    icon: "🏷️" },
  { id: "treasury",          label: "الخزنة",              icon: "💰", subItems: [
      { id: "day_closing",        label: "تقفيل اليوم" },
      { id: "shifts",             label: "الشفتات" },
      { id: "log",                label: "السجل" },
      { id: "fixed_expenses",     label: "مصاريف ثابتة" },
      { id: "licenses",           label: "التراخيص" },
      { id: "balance_visibility", label: "زر إظهار/إخفاء أرقام الكروت" },
      { id: "opening_balance",    label: "رصيد أول المدة" },
      { id: "balance_settlement", label: "تسوية رصيد الخزنة" },
      { id: "salaries",           label: "الرواتب" },
    ] },
  { id: "shift",             label: "الشفتات",             icon: "🕐" },
  { id: "target",            label: "تارجت المبيعات والتحفيز",      icon: "🎯" },
  { id: "inventory_count",   label: "الجرد",               icon: "📋", subItems: [
      { id: "new_count", label: "بدء جرد جديد" },
      { id: "fix_stock", label: "إصلاح تشغيلات المخزون" },
    ] },
  { id: "expiry_report",     label: "تقرير الصلاحيات",    icon: "⚠️" },
  { id: "inventory_statement", label: "كشف المخزون",      icon: "📦" },
  { id: "attendance",        label: "الحضور والانصراف",   icon: "⏱️", subItems: [
      { id: "checkin",        label: "الحضور" },
      { id: "schedule",       label: "جدول الدوام" },
      { id: "prayers",        label: "الصلوات" },
      { id: "daily_report",   label: "تقرير يومي" },
      { id: "monthly_report", label: "تقرير شهري" },
    ] },
  { id: "pharmacy_settings", label: "بيانات الصيدلية",    icon: "⚙️" },
  { id: "rasd_settings",     label: "إعدادات رصد",         icon: "🔗" },
];



// ── مفتاح موحّد لتخزين/قراءة صلاحية القسم أو صلاحية عنصر فرعي داخله ──
export const permKey = (sectionId, subId = undefined) => (subId ? `${sectionId}::${subId}` : sectionId);



// ── الأدوار الافتراضية ──
export const DEFAULT_ROLES = ["pharmacist", "cashier", "warehouse"];



export function PermissionsModule({
  pharmacyId,
  showToast,
  users,
  setUsers,
  currentUser,
}: {
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
  users: any[];
  setUsers: (fn: any) => void;
  currentUser?: any;
}) {
  const [activeTab, setActiveTab] = useState<"permissions" | "users">("permissions");
  const [perms, setPerms] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean; can_add: boolean; can_delete: boolean }>>>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState("pharmacist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRoleModal, setAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // ── المستخدمين (يأتي من الأب الآن، مش state محلي) ──
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState<"add" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: "", username: "", password: "", role: "pharmacist" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const VAR = { bg: COLORS.surface, border: COLORS.border, text: COLORS.textPrimary, muted: COLORS.textDim, accent: COLORS.blue };

  // ── تحميل الصلاحيات ──
  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("role_permissions").select("*").eq("pharmacy_id", pharmacyId);
      const map: Record<string, Record<string, { can_view: boolean; can_edit: boolean; can_add: boolean; can_delete: boolean }>> = {};
      const foundRoles = new Set<string>(DEFAULT_ROLES);
      if (data) {
        data.forEach((r: any) => {
          foundRoles.add(r.role);
          if (!map[r.role]) map[r.role] = {};
          map[r.role][permKey(r.section, r.sub_section)] = {
            can_view: r.can_view,
            can_edit: r.can_edit,
            can_add: r.can_add ?? r.can_edit,
            can_delete: r.can_delete ?? r.can_edit,
          };
        });
      }
      [...foundRoles].forEach((role) => {
        if (!map[role]) map[role] = {};
        // 🆕 دور "مخزن": يشوف ويعدّل بس في الشراء والأصناف والموردين والجرد،
        // وميشوفش المبيعات/العملاء/الخزنة/التقارير المالية أصلاً.
        const WAREHOUSE_SECTIONS = ["purchase", "products", "suppliers", "returns", "inventory_count", "expiry_report", "inventory_statement"];
        SYSTEM_SECTIONS.forEach((sec) => {
          const canEditDefault = role === "cashier"
            ? sec.id === "pos"
            : role === "warehouse"
              ? WAREHOUSE_SECTIONS.includes(sec.id)
              : sec.id !== "pharmacy_settings" && sec.id !== "rasd_settings";
          const canViewDefault = role === "cashier"
            ? sec.id === "pos"
            : role === "warehouse"
              ? WAREHOUSE_SECTIONS.includes(sec.id)
              : true;
          // ── can_add/can_delete تتبع نفس افتراض can_edit، بنفس المنطق اللي كان
          //    مطبّق ضمنيًا قبل ما تتفصل الصلاحيات لأربعة ──
          const defaultPerm = { can_view: canViewDefault, can_edit: canEditDefault, can_add: canEditDefault, can_delete: canEditDefault };
          if (!map[role][permKey(sec.id)]) map[role][permKey(sec.id)] = defaultPerm;
          (sec.subItems || []).forEach((sub) => {
            if (!map[role][permKey(sec.id, sub.id)]) map[role][permKey(sec.id, sub.id)] = { ...defaultPerm };
          });
        });
      });
      setRoles([...foundRoles]);
      setPerms(map);
      setLoading(false);
    };
    load();
  }, [pharmacyId]);

  // ── تحميل المستخدمين ──
  useEffect(() => {
    if (!pharmacyId || activeTab !== "users") return;
    const load = async () => {
      setUsersLoading(true);
      const { data } = await supabase.from("users").select("*").eq("pharmacy_id", pharmacyId).order("created_at");
      setUsers(data ?? []);
      setUsersLoading(false);
    };
    load();
  }, [pharmacyId, activeTab]);

  const togglePerm = (section: string, type: "can_view" | "can_edit" | "can_add" | "can_delete") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      const current = rolePerms[section] || { can_view: false, can_edit: false, can_add: false, can_delete: false };
      let updated = { ...current };
      if (type === "can_view") {
        updated.can_view = !current.can_view;
        // ── إلغاء العرض يلغي كل الصلاحيات التانية معاه، لأنها كلها محتاجة تشوف القسم الأول ──
        if (!updated.can_view) { updated.can_edit = false; updated.can_add = false; updated.can_delete = false; }
      } else if (type === "can_edit") {
        updated.can_edit = !current.can_edit;
        if (updated.can_edit) updated.can_view = true;
      } else if (type === "can_add") {
        updated.can_add = !current.can_add;
        if (updated.can_add) updated.can_view = true;
      } else {
        updated.can_delete = !current.can_delete;
        if (updated.can_delete) updated.can_view = true;
      }
      return { ...prev, [selectedRole]: { ...rolePerms, [section]: updated } };
    });
    setDirty(true);
  };

  const toggleAll = (type: "view_all" | "edit_all" | "none") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      SYSTEM_SECTIONS.forEach((sec) => {
        const keys = [permKey(sec.id), ...(sec.subItems || []).map((sub) => permKey(sec.id, sub.id))];
        keys.forEach((k) => {
          if (type === "view_all") {
            rolePerms[k] = { can_view: true, can_edit: rolePerms[k]?.can_edit ?? false, can_add: rolePerms[k]?.can_add ?? false, can_delete: rolePerms[k]?.can_delete ?? false };
          } else if (type === "edit_all") {
            rolePerms[k] = { can_view: true, can_edit: true, can_add: true, can_delete: true };
          } else {
            rolePerms[k] = { can_view: false, can_edit: false, can_add: false, can_delete: false };
          }
        });
      });
      return { ...prev, [selectedRole]: rolePerms };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const rows: any[] = [];
    SYSTEM_SECTIONS.forEach((sec) => {
      rows.push({
        pharmacy_id: pharmacyId,
        role: selectedRole,
        section: sec.id,
        sub_section: "",
        can_view: perms[selectedRole]?.[permKey(sec.id)]?.can_view ?? true,
        can_edit: perms[selectedRole]?.[permKey(sec.id)]?.can_edit ?? false,
        can_add: perms[selectedRole]?.[permKey(sec.id)]?.can_add ?? false,
        can_delete: perms[selectedRole]?.[permKey(sec.id)]?.can_delete ?? false,
        updated_at: new Date().toISOString(),
      });
      (sec.subItems || []).forEach((sub) => {
        rows.push({
          pharmacy_id: pharmacyId,
          role: selectedRole,
          section: sec.id,
          sub_section: sub.id,
          can_view: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_view ?? true,
          can_edit: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_edit ?? false,
          can_add: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_add ?? false,
          can_delete: perms[selectedRole]?.[permKey(sec.id, sub.id)]?.can_delete ?? false,
          updated_at: new Date().toISOString(),
        });
      });
    });
    const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "pharmacy_id,role,section,sub_section" });
    setSaving(false);
    if (error) return showToast("خطأ في الحفظ", "error");
    showToast(`تم حفظ صلاحيات ${roleLabel(selectedRole)} ✓`);
    setDirty(false);
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    if (roles.includes(name)) return showToast("الدور موجود بالفعل", "warn");
    const defaultPerms: Record<string, { can_view: boolean; can_edit: boolean; can_add: boolean; can_delete: boolean }> = {};
    SYSTEM_SECTIONS.forEach((sec) => {
      defaultPerms[permKey(sec.id)] = { can_view: true, can_edit: false, can_add: false, can_delete: false };
      (sec.subItems || []).forEach((sub) => { defaultPerms[permKey(sec.id, sub.id)] = { can_view: true, can_edit: false, can_add: false, can_delete: false }; });
    });
    setRoles((p) => [...p, name]);
    setPerms((p) => ({ ...p, [name]: defaultPerms }));
    setSelectedRole(name);
    setAddRoleModal(false);
    setNewRoleName("");
    setDirty(true);
    showToast(`تم إضافة دور "${name}"`);
  };

  // ── إضافة/تعديل مستخدم (عبر Edge Function — لأنها تنشئ/تعدّل حساب Auth حقيقي بـ service_role) ──
  const saveUser = async () => {
    if (!userForm.name || !userForm.username || (userModal === "add" && !userForm.password)) {
      return showToast("يرجى تعبئة جميع الحقول", "error");
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return showToast("الجلسة منتهية، سجّل الدخول من جديد", "error");

    if (userModal === "add") {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: userForm.name,
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          pharmacy_id: pharmacyId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showToast("خطأ في الإضافة: " + (json.error || "غير معروف"), "error");
      setUsers((p) => [...p, json.user]);
      showToast("تم إضافة المستخدم ✓");
    } else {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-update-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          id: selectedUser.id,
          name: userForm.name,
          username: userForm.username,
          ...(userForm.password ? { password: userForm.password } : {}),
          role: userForm.role,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return showToast("خطأ في التعديل: " + (json.error || "غير معروف"), "error");
      setUsers((p) => p.map((u) => u.id === selectedUser.id ? { ...u, ...userForm } : u));
      showToast("تم تعديل المستخدم ✓");
    }
    setUserModal(null);
    setUserForm({ name: "", username: "", password: "", role: "pharmacist" });
  };

  // ── حذف مستخدم (عبر Edge Function — عشان يُحذف حساب Auth برضو) ──
  const deleteUser = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return showToast("الجلسة منتهية، سجّل الدخول من جديد", "error");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return showToast("خطأ في الحذف: " + (json.error || "غير معروف"), "error");
    setUsers((p) => p.filter((u) => u.id !== id));
    setDeleteConfirm(null);
    showToast("تم حذف المستخدم ✓");
  };

  const roleLabel = (r: string) =>
    r === "pharmacist" ? "صيدلاني" : r === "cashier" ? "كاشير" : r === "warehouse" ? "مخزن" : r === "admin" ? "مدير" : r;

  const currentRolePerms = perms[selectedRole] || {};
  const viewCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_view).length;
  const editCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_edit).length;
  const addCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_add).length;
  const deleteCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_delete).length;

  // حراسة إضافية (طبقة دفاع ثانية): لو وصل لغير أدمن للموديول ده بأي طريقة، يتمنع فورًا
  if (currentUser?.role !== "admin") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        🔒 هذه الصفحة متاحة لمدير النظام فقط
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: VAR.text }}>
          🔐 الصلاحيات والمستخدمين
        </h2>
        {activeTab === "permissions" && dirty && (
          <Btn onClick={save} disabled={saving} icon="check">
            {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </Btn>
        )}
        {activeTab === "users" && (
          <Btn onClick={() => { setUserModal("add"); setUserForm({ name: "", username: "", password: "", role: "pharmacist" }); }} icon="plus">
            + إضافة مستخدم
          </Btn>
        )}
      </div>

      {/* ── تبويبين ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "permissions", label: "🔐 الصلاحيات" },
          { id: "users", label: "👤 المستخدمين" },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{
            padding: "8px 20px", borderRadius: 9, border: "1px solid",
            borderColor: activeTab === t.id ? COLORS.blue : VAR.border,
            background: activeTab === t.id ? COLORS.blueSoft : "transparent",
            color: activeTab === t.id ? COLORS.blue : VAR.muted,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── تبويب الصلاحيات ── */}
      {activeTab === "permissions" && (
        loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: VAR.muted }}>جاري التحميل...</div>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ width: 200, flexShrink: 0 }}>
              <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${VAR.border}`, fontSize: 12, color: VAR.muted, fontWeight: 700 }}>الأدوار</div>
                {roles.map((role) => (
                  <button key={role} onClick={() => { setSelectedRole(role); setDirty(false); }} style={{
                    display: "block", width: "100%", padding: "12px 16px", textAlign: "right",
                    background: selectedRole === role ? COLORS.blueSoft : "transparent",
                    borderRight: selectedRole === role ? "3px solid #2a6aef" : "3px solid transparent",
                    border: "none", color: selectedRole === role ? COLORS.blue : VAR.muted,
                    fontSize: 13, fontWeight: selectedRole === role ? 700 : 400, cursor: "pointer",
                  }}>
                    {roleLabel(role)}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddRoleModal(true)} style={{
                width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px dashed ${VAR.border}`,
                background: "transparent", color: VAR.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>+ إضافة دور</button>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { val: viewCount, label: "قسم مرئي", color: VAR.accent },
                  { val: editCount, label: "قابل للتعديل", color: COLORS.green },
                  { val: addCount, label: "قابل للإضافة", color: COLORS.blue },
                  { val: deleteCount, label: "قابل للحذف", color: COLORS.red },
                  { val: SYSTEM_SECTIONS.length - viewCount, label: "قسم مخفي", color: VAR.muted },
                ].map((s, i) => (
                  <div key={i} style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: VAR.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => toggleAll("edit_all")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${tint(COLORS.green,0.35)}`, background: COLORS.greenSoft, color: COLORS.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ تفعيل الكل</button>
                <button onClick={() => toggleAll("view_all")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${tint(COLORS.blue,0.35)}`, background: COLORS.blueSoft, color: VAR.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>👁️ عرض بدون تعديل</button>
                <button onClick={() => toggleAll("none")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid ${tint(COLORS.red,0.35)}`, background: COLORS.redSoft, color: COLORS.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🚫 إخفاء الكل</button>
              </div>

              <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px", padding: "12px 20px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700 }}>القسم</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>عرض 👁️</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>تعديل ✏️</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>إضافة ➕</div>
                  <div style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: "center" }}>حذف 🗑️</div>
                </div>
                {SYSTEM_SECTIONS.map((sec, i) => {
                  const p = currentRolePerms[permKey(sec.id)] || { can_view: false, can_edit: false, can_add: false, can_delete: false };
                  const hasSubItems = (sec.subItems || []).length > 0;
                  const isExpanded = !!expandedSections[sec.id];
                  return (
                    <div key={sec.id}>
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px",
                        padding: "13px 20px", alignItems: "center",
                        borderBottom: (i < SYSTEM_SECTIONS.length - 1 || (hasSubItems && isExpanded)) ? `1px solid ${COLORS.border}` : "none",
                        background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                        opacity: !p.can_view ? 0.55 : 1,
                      }}>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 10, cursor: hasSubItems ? "pointer" : "default" }}
                          onClick={() => hasSubItems && setExpandedSections((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                        >
                          <span style={{ fontSize: 18 }}>{sec.icon}</span>
                          <span style={{ fontSize: 14, color: p.can_view ? VAR.text : VAR.muted, fontWeight: p.can_view ? 600 : 400 }}>{sec.label}</span>
                          {hasSubItems && (
                            <span style={{ color: VAR.muted, fontSize: 11, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▼</span>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_view")} style={{ width: 40, height: 24, borderRadius: 12, border: "none", background: p.can_view ? COLORS.greenSoft : COLORS.redSoft, cursor: "pointer", position: "relative" }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_view ? 3 : 19, width: 18, height: 18, borderRadius: "50%", background: p.can_view ? COLORS.green : COLORS.red, transition: "right 0.2s" }} />
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_edit")} disabled={!p.can_view} style={{ width: 40, height: 24, borderRadius: 12, border: "none", background: p.can_edit ? COLORS.blueSoft : COLORS.surfaceAlt, cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_edit ? 3 : 19, width: 18, height: 18, borderRadius: "50%", background: p.can_edit ? COLORS.blue : COLORS.border, transition: "right 0.2s" }} />
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_add")} disabled={!p.can_view} style={{ width: 40, height: 24, borderRadius: 12, border: "none", background: p.can_add ? COLORS.blueSoft : COLORS.surfaceAlt, cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_add ? 3 : 19, width: 18, height: 18, borderRadius: "50%", background: p.can_add ? COLORS.blue : COLORS.border, transition: "right 0.2s" }} />
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button onClick={() => togglePerm(permKey(sec.id), "can_delete")} disabled={!p.can_view} style={{ width: 40, height: 24, borderRadius: 12, border: "none", background: p.can_delete ? COLORS.redSoft : COLORS.surfaceAlt, cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                            <div style={{ position: "absolute", top: 3, right: p.can_delete ? 3 : 19, width: 18, height: 18, borderRadius: "50%", background: p.can_delete ? COLORS.red : COLORS.border, transition: "right 0.2s" }} />
                          </button>
                        </div>
                      </div>

                      {/* ── العناصر الفرعية داخل القسم: تتحكم في ما يظهر/يُعدَّل داخل القسم نفسه ── */}
                      {hasSubItems && isExpanded && (
                        <div style={{ background: COLORS.surfaceAlt }}>
                          {sec.subItems.map((sub, si) => {
                            const sp = currentRolePerms[permKey(sec.id, sub.id)] || { can_view: false, can_edit: false, can_add: false, can_delete: false };
                            return (
                              <div key={sub.id} style={{
                                display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px",
                                padding: "10px 20px 10px 20px", paddingRight: 44, alignItems: "center",
                                borderBottom: (si < sec.subItems.length - 1 || i < SYSTEM_SECTIONS.length - 1) ? `1px solid ${COLORS.border}` : "none",
                                opacity: !sp.can_view ? 0.55 : 1,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ color: VAR.muted, fontSize: 12 }}>└</span>
                                  <span style={{ fontSize: 12.5, color: sp.can_view ? VAR.text : VAR.muted }}>{sub.label}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_view")} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: sp.can_view ? COLORS.greenSoft : COLORS.redSoft, cursor: "pointer", position: "relative" }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_view ? 2 : 17, width: 16, height: 16, borderRadius: "50%", background: sp.can_view ? COLORS.green : COLORS.red, transition: "right 0.2s" }} />
                                  </button>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_edit")} disabled={!sp.can_view} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: sp.can_edit ? COLORS.blueSoft : COLORS.surfaceAlt, cursor: sp.can_view ? "pointer" : "not-allowed", position: "relative", opacity: sp.can_view ? 1 : 0.4 }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_edit ? 2 : 17, width: 16, height: 16, borderRadius: "50%", background: sp.can_edit ? COLORS.blue : COLORS.border, transition: "right 0.2s" }} />
                                  </button>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_add")} disabled={!sp.can_view} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: sp.can_add ? COLORS.blueSoft : COLORS.surfaceAlt, cursor: sp.can_view ? "pointer" : "not-allowed", position: "relative", opacity: sp.can_view ? 1 : 0.4 }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_add ? 2 : 17, width: 16, height: 16, borderRadius: "50%", background: sp.can_add ? COLORS.blue : COLORS.border, transition: "right 0.2s" }} />
                                  </button>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <button onClick={() => togglePerm(permKey(sec.id, sub.id), "can_delete")} disabled={!sp.can_view} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: sp.can_delete ? COLORS.redSoft : COLORS.surfaceAlt, cursor: sp.can_view ? "pointer" : "not-allowed", position: "relative", opacity: sp.can_view ? 1 : 0.4 }}>
                                    <div style={{ position: "absolute", top: 2, right: sp.can_delete ? 2 : 17, width: 16, height: 16, borderRadius: "50%", background: sp.can_delete ? COLORS.red : COLORS.border, transition: "right 0.2s" }} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {dirty && (
                <div style={{ marginTop: 16 }}>
                  <Btn onClick={save} disabled={saving} icon="check" size="lg" style={{ width: "100%", justifyContent: "center" }}>
                    {saving ? "جارٍ الحفظ..." : `حفظ صلاحيات ${roleLabel(selectedRole)}`}
                  </Btn>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* ── تبويب المستخدمين ── */}
      {activeTab === "users" && (
        <div>
          {usersLoading ? (
            <div style={{ textAlign: "center", color: VAR.muted, padding: 40 }}>جاري التحميل...</div>
          ) : (
            <div style={{ background: VAR.bg, border: `1px solid ${VAR.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", padding: "12px 20px", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: `1px solid ${VAR.border}` }}>
                {["الاسم", "اسم المستخدم", "الدور", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: VAR.muted, fontWeight: 700, textAlign: i === 3 ? "center" : "right" }}>{h}</div>
                ))}
              </div>
              {users.length === 0 ? (
                <div style={{ textAlign: "center", color: VAR.muted, padding: 40 }}>لا يوجد مستخدمين</div>
              ) : (
                users.map((u, i) => (
                  <div key={u.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px",
                    padding: "14px 20px", alignItems: "center",
                    borderBottom: i < users.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    background: i % 2 === 0 ? "transparent" : COLORS.surfaceAlt,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: VAR.text }}>{u.name}</div>
                    <div style={{ fontSize: 13, color: VAR.muted }}>{u.username}</div>
                    <div>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: u.role === "admin" ? COLORS.goldSoft : u.role === "pharmacist" ? COLORS.greenSoft : u.role === "warehouse" ? COLORS.coralSoft : COLORS.blueSoft, color: u.role === "admin" ? COLORS.gold : u.role === "pharmacist" ? COLORS.green : u.role === "warehouse" ? COLORS.coral : COLORS.blue }}>
                        {roleLabel(u.role)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => { setSelectedUser(u); setUserForm({ name: u.name, username: u.username, password: u.password, role: u.role }); setUserModal("edit"); }} style={{ padding: "4px 10px", borderRadius: 6, background: COLORS.blueSoft, border: `1px solid ${tint(COLORS.blue,0.35)}`, color: COLORS.blue, fontSize: 11, cursor: "pointer" }}>تعديل</button>
                      <button onClick={() => setDeleteConfirm(u.id)} style={{ padding: "4px 10px", borderRadius: 6, background: COLORS.redSoft, border: `1px solid ${tint(COLORS.red,0.35)}`, color: COLORS.red, fontSize: 11, cursor: "pointer" }}>حذف</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal إضافة/تعديل مستخدم ── */}
      {userModal && (
        <Modal open onClose={() => setUserModal(null)} title={userModal === "add" ? "إضافة مستخدم جديد" : "تعديل مستخدم"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "الاسم الكامل", key: "name", placeholder: "مثال: أحمد محمد" },
              { label: "اسم المستخدم", key: "username", placeholder: "مثال: ahmed123" },
              { label: "كلمة المرور", key: "password", placeholder: "كلمة المرور" },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>{f.label}</label>
                <input
                  value={userForm[f.key as keyof typeof userForm]}
                  onChange={(e) => setUserForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>الدور</label>
              <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))} style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none" }}>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => setUserModal(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={saveUser} style={{ flex: 1, justifyContent: "center" }}>حفظ</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── تأكيد الحذف ── */}
      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="تأكيد الحذف">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: VAR.muted, fontSize: 14 }}>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, justifyContent: "center", background: COLORS.redSoft, borderColor: "#6a1010", color: COLORS.red }}>حذف</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal إضافة دور ── */}
      {addRoleModal && (
        <Modal open onClose={() => setAddRoleModal(false)} title="إضافة دور جديد">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: VAR.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>اسم الدور</label>
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} placeholder="مثال: مراجع، محاسب..." style={{ width: "100%", background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${VAR.border}`, borderRadius: 8, padding: "10px 14px", color: VAR.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }} />
            </div>
            <div style={{ fontSize: 12, color: VAR.muted, background: COLORS.surfaceAlt, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderRadius: 8, padding: 12 }}>
              💡 سيتم إنشاء الدور بصلاحية عرض لجميع الأقسام بدون تعديل.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setAddRoleModal(false)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={addRole} style={{ flex: 1, justifyContent: "center" }}>إضافة</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
