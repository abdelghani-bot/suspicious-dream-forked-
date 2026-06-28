export function PermissionsModule({
  const { C } = useTheme();
  pharmacyId,
  showToast,
}: {
  pharmacyId: string;
  showToast: (msg: string, type?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"permissions" | "users">("permissions");
  const [perms, setPerms] = useState<Record<string, Record<string, { can_view: boolean; can_edit: boolean }>>>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState("pharmacist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addRoleModal, setAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [dirty, setDirty] = useState(false);

  // ── المستخدمين ──
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState<"add" | "edit" | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: "", username: "", password: "", role: "pharmacist" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const VAR = { bg: C.surface, border: C.border, text: C.text, muted: C.muted, accent: C.accent };

  // ── تحميل الصلاحيات ──
  useEffect(() => {
    if (!pharmacyId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("role_permissions").select("*").eq("pharmacy_id", pharmacyId);
      const map: Record<string, Record<string, { can_view: boolean; can_edit: boolean }>> = {};
      const foundRoles = new Set<string>(DEFAULT_ROLES);
      if (data) {
        data.forEach((r: any) => {
          foundRoles.add(r.role);
          if (!map[r.role]) map[r.role] = {};
          map[r.role][r.section] = { can_view: r.can_view, can_edit: r.can_edit };
        });
      }
      [...foundRoles].forEach((role) => {
        if (!map[role]) map[role] = {};
        SYSTEM_SECTIONS.forEach((sec) => {
          if (!map[role][sec.id]) {
            map[role][sec.id] = {
              can_view: role === "cashier" ? sec.id === "pos" : true,
              can_edit: role === "cashier" ? sec.id === "pos" : sec.id !== "pharmacy_settings" && sec.id !== "rasd_settings",
            };
          }
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

  const togglePerm = (section: string, type: "can_view" | "can_edit") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      const current = rolePerms[section] || { can_view: false, can_edit: false };
      let updated = { ...current };
      if (type === "can_view") {
        updated.can_view = !current.can_view;
        if (!updated.can_view) updated.can_edit = false;
      } else {
        updated.can_edit = !current.can_edit;
        if (updated.can_edit) updated.can_view = true;
      }
      return { ...prev, [selectedRole]: { ...rolePerms, [section]: updated } };
    });
    setDirty(true);
  };

  const toggleAll = (type: "view_all" | "edit_all" | "none") => {
    setPerms((prev) => {
      const rolePerms = { ...(prev[selectedRole] || {}) };
      SYSTEM_SECTIONS.forEach((sec) => {
        if (type === "view_all") rolePerms[sec.id] = { can_view: true, can_edit: rolePerms[sec.id]?.can_edit ?? false };
        else if (type === "edit_all") rolePerms[sec.id] = { can_view: true, can_edit: true };
        else rolePerms[sec.id] = { can_view: false, can_edit: false };
      });
      return { ...prev, [selectedRole]: rolePerms };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const rows = SYSTEM_SECTIONS.map((sec) => ({
      pharmacy_id: pharmacyId,
      role: selectedRole,
      section: sec.id,
      can_view: perms[selectedRole]?.[sec.id]?.can_view ?? true,
      can_edit: perms[selectedRole]?.[sec.id]?.can_edit ?? false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "pharmacy_id,role,section" });
    setSaving(false);
    if (error) return showToast("خطأ في الحفظ", "error");
    showToast(`تم حفظ صلاحيات ${roleLabel(selectedRole)} ✓`);
    setDirty(false);
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    if (roles.includes(name)) return showToast("الدور موجود بالفعل", "warn");
    const defaultPerms: Record<string, { can_view: boolean; can_edit: boolean }> = {};
    SYSTEM_SECTIONS.forEach((sec) => { defaultPerms[sec.id] = { can_view: true, can_edit: false }; });
    setRoles((p) => [...p, name]);
    setPerms((p) => ({ ...p, [name]: defaultPerms }));
    setSelectedRole(name);
    setAddRoleModal(false);
    setNewRoleName("");
    setDirty(true);
    showToast(`تم إضافة دور "${name}"`);
  };

  // ── إضافة/تعديل مستخدم ──
  const saveUser = async () => {
    if (!userForm.name || !userForm.username || !userForm.password) {
      return showToast("يرجى تعبئة جميع الحقول", "error");
    }
    if (userModal === "add") {
      const id = "U" + Date.now();
      const { error } = await supabase.from("users").insert({
        id,
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        pharmacy_id: pharmacyId,
        created_at: new Date().toISOString(),
      });
      if (error) return showToast("خطأ في الإضافة: " + error.message, "error");
      setUsers((p) => [...p, { id, ...userForm, pharmacy_id: pharmacyId, created_at: new Date().toISOString() }]);
      showToast("تم إضافة المستخدم ✓");
    } else {
      const { error } = await supabase.from("users").update({
        name: userForm.name,
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
      }).eq("id", selectedUser.id);
      if (error) return showToast("خطأ في التعديل: " + error.message, "error");
      setUsers((p) => p.map((u) => u.id === selectedUser.id ? { ...u, ...userForm } : u));
      showToast("تم تعديل المستخدم ✓");
    }
    setUserModal(null);
    setUserForm({ name: "", username: "", password: "", role: "pharmacist" });
  };

  // ── حذف مستخدم ──
  const deleteUser = async (id: string) => {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return showToast("خطأ في الحذف", "error");
    setUsers((p) => p.filter((u) => u.id !== id));
    setDeleteConfirm(null);
    showToast("تم حذف المستخدم ✓");
  };

  const roleLabel = (r: string) =>
    r === "pharmacist" ? "صيدلاني" : r === "cashier" ? "كاشير" : r === "admin" ? "مدير" : r;

  const currentRolePerms = perms[selectedRole] || {};
  const viewCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_view).length;
  const editCount = SYSTEM_SECTIONS.filter((s) => currentRolePerms[s.id]?.can_edit).length;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>
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
            borderColor: activeTab === t.id ? C.accent : C.border,
            background: activeTab === t.id ? "#14233a" : "transparent",
            color: activeTab === t.id ? C.accent : C.muted,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── تبويب الصلاحيات ── */}
      {activeTab === "permissions" && (
        loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: C.muted }}>جاري التحميل...</div>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ width: 200, flexShrink: 0 }}>
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 700 }}>الأدوار</div>
                {roles.map((role) => (
                  <button key={role} onClick={() => { setSelectedRole(role); setDirty(false); }} style={{
                    display: "block", width: "100%", padding: "12px 16px", textAlign: "right",
                    background: selectedRole === role ? "#14233a" : "transparent",
                    borderRight: selectedRole === role ? "3px solid #2a6aef" : "3px solid transparent",
                    border: "none", color: selectedRole === role ? C.accent : C.muted,
                    fontSize: 13, fontWeight: selectedRole === role ? 700 : 400, cursor: "pointer",
                  }}>
                    {roleLabel(role)}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddRoleModal(true)} style={{
                width: "100%", padding: "9px 14px", borderRadius: 10, border: `1px dashed ${C.border}`,
                background: "transparent", color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>+ إضافة دور</button>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { val: viewCount, label: "قسم مرئي", color: C.accent },
                  { val: editCount, label: "قسم قابل للتعديل", color: C.success },
                  { val: SYSTEM_SECTIONS.length - viewCount, label: "قسم مخفي", color: C.danger },
                ].map((s, i) => (
                  <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button onClick={() => toggleAll("edit_all")} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #1a5a30", background: C.successBg, color: C.success, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✅ تفعيل الكل</button>
                <button onClick={() => toggleAll("view_all")} style={{ padding: "6px 14px", borderRadius: 7, border: `1px solid #1d3a6a`, background: C.infoBg, color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>👁️ عرض بدون تعديل</button>
                <button onClick={() => toggleAll("none")} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #4a1010", background: C.dangerBg, color: C.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🚫 إخفاء الكل</button>
              </div>

              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", padding: "12px 20px", background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>القسم</div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textAlign: "center" }}>عرض 👁️</div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textAlign: "center" }}>تعديل ✏️</div>
                </div>
                {SYSTEM_SECTIONS.map((sec, i) => {
                  const p = currentRolePerms[sec.id] || { can_view: false, can_edit: false };
                  return (
                    <div key={sec.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 120px",
                      padding: "13px 20px", alignItems: "center",
                      borderBottom: i < SYSTEM_SECTIONS.length - 1 ? "1px solid #0a1020" : "none",
                      background: i % 2 === 0 ? "transparent" : C.bgAlt,
                      opacity: !p.can_view ? 0.55 : 1,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{sec.icon}</span>
                        <span style={{ fontSize: 14, color: p.can_view ? C.text : C.muted, fontWeight: p.can_view ? 600 : 400 }}>{sec.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button onClick={() => togglePerm(sec.id, "can_view")} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_view ? C.successBorder : "#2a1020", cursor: "pointer", position: "relative" }}>
                          <div style={{ position: "absolute", top: 3, right: p.can_view ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_view ? C.success : C.danger, transition: "right 0.2s" }} />
                        </button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button onClick={() => togglePerm(sec.id, "can_edit")} disabled={!p.can_view} style={{ width: 48, height: 26, borderRadius: 13, border: "none", background: p.can_edit ? "#1a3a6a" : "#1a1a2a", cursor: p.can_view ? "pointer" : "not-allowed", position: "relative", opacity: p.can_view ? 1 : 0.4 }}>
                          <div style={{ position: "absolute", top: 3, right: p.can_edit ? 3 : 22, width: 20, height: 20, borderRadius: "50%", background: p.can_edit ? C.accent : "#3a3a5a", transition: "right 0.2s" }} />
                        </button>
                      </div>
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
            <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>جاري التحميل...</div>
          ) : (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px", padding: "12px 20px", background: C.bgAlt, borderBottom: `1px solid ${C.border}` }}>
                {["الاسم", "اسم المستخدم", "الدور", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.muted, fontWeight: 700, textAlign: i === 3 ? "center" : "right" }}>{h}</div>
                ))}
              </div>
              {users.length === 0 ? (
                <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>لا يوجد مستخدمين</div>
              ) : (
                users.map((u, i) => (
                  <div key={u.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 120px",
                    padding: "14px 20px", alignItems: "center",
                    borderBottom: i < users.length - 1 ? "1px solid #0a1020" : "none",
                    background: i % 2 === 0 ? "transparent" : C.bgAlt,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>{u.username}</div>
                    <div>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700, background: u.role === "admin" ? C.warningBg : u.role === "pharmacist" ? C.successBg : C.infoBg, color: u.role === "admin" ? C.warning : u.role === "pharmacist" ? C.success : C.accent }}>
                        {roleLabel(u.role)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => { setSelectedUser(u); setUserForm({ name: u.name, username: u.username, password: u.password, role: u.role }); setUserModal("edit"); }} style={{ padding: "4px 10px", borderRadius: 6, background: C.infoBg, border: "1px solid #1d3a6a", color: C.accent, fontSize: 11, cursor: "pointer" }}>تعديل</button>
                      <button onClick={() => setDeleteConfirm(u.id)} style={{ padding: "4px 10px", borderRadius: 6, background: C.dangerBg, border: "1px solid #4a1010", color: C.danger, fontSize: 11, cursor: "pointer" }}>حذف</button>
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
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>{f.label}</label>
                <input
                  value={userForm[f.key as keyof typeof userForm]}
                  onChange={(e) => setUserForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>الدور</label>
              <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))} style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none" }}>
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
            <div style={{ color: C.muted, fontSize: 14 }}>هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, justifyContent: "center" }}>إلغاء</Btn>
              <Btn onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1, justifyContent: "center", background: C.dangerBg, borderColor: "#6a1010", color: C.danger }}>حذف</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal إضافة دور ── */}
      {addRoleModal && (
        <Modal open onClose={() => setAddRoleModal(false)} title="إضافة دور جديد">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>اسم الدور</label>
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} placeholder="مثال: مراجع، محاسب..." style={{ width: "100%", background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" as any }} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, background: C.bgAlt, borderRadius: 8, padding: 12 }}>
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
