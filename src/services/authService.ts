import { supabase } from "../lib/supabaseClient";

// ==================== AUTH SERVICE (Supabase Auth) ====================
// username بيتحوّل لإيميل وهمي داخلياً لأن Supabase Auth بيشتغل بالإيميل.
// كلمة المرور متخزّنة مشفّرة في auth.users — مش plaintext في جدول users.
export const authService = {
  async login(username: string, password: string) {
    const email = `${username.trim().toLowerCase()}@pharmacy.internal`;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData?.user) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id, is_super_admin")
      .eq("auth_user_id", authData.user.id)
      .single();
    if (profileError || !profile) {
      await supabase.auth.signOut();
      throw new Error("هذا الحساب غير مفعّل، راجع مدير النظام");
    }

    // السوبر أدمن بيدخل دايمًا من غير ما يتقيّد بحالة أي صيدلية
    if (profile.is_super_admin) {
      return { ...profile, readOnly: false };
    }

    if (!profile.pharmacy_id) {
      await supabase.auth.signOut();
      throw new Error("هذا المستخدم غير مرتبط بصيدلية");
    }

    const { data: accessStatus, error: statusError } = await supabase.rpc("pharmacy_access_status", {
      p_pharmacy_id: profile.pharmacy_id,
    });
    if (statusError) {
      await supabase.auth.signOut();
      throw new Error("تعذّر التحقق من حالة الاشتراك، حاول مرة أخرى");
    }
    if (accessStatus === "blocked") {
      await supabase.auth.signOut();
      throw new Error("انتهت صلاحية الاشتراك. تواصل مع الدعم لتجديد الاشتراك");
    }

    return { ...profile, readOnly: accessStatus === "readonly" };
  },
  async logout() {
    await supabase.auth.signOut();
  },
  async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await supabase
      .from("users")
      .select("id, name, role, username, pharmacy_id, is_super_admin")
      .eq("auth_user_id", session.user.id)
      .single();
    if (!profile) return null;

    if (profile.is_super_admin) {
      return { ...profile, readOnly: false };
    }
    if (!profile.pharmacy_id) return { ...profile, readOnly: true };

    const { data: accessStatus } = await supabase.rpc("pharmacy_access_status", {
      p_pharmacy_id: profile.pharmacy_id,
    });
    if (accessStatus === "blocked") {
      await supabase.auth.signOut();
      return null;
    }

    return { ...profile, readOnly: accessStatus === "readonly" };
  },
};
