// ==================== AUTH SERVICE ====================
export const SESSION_KEY = "pharmacy_session";
const authService = {
  async login(username: string, password: string) {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id")
      .eq("username", username)
      .eq("password", password)
      .single();
    if (error || !data) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    if (!data.pharmacy_id) throw new Error("هذا المستخدم غير مرتبط بصيدلية");
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    return data;
  },
  logout() { localStorage.removeItem(SESSION_KEY); },
  getCurrentUser() {
    try {
      const s = localStorage.getItem(SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },
};

