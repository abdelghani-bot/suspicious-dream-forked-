import { supabase } from "../lib/supabaseClient";
import { getDeviceId } from "../lib/deviceId"; // ⚠️ عدّل المسار لو الملف عندك في مكان تاني

// ==================== AUTH SERVICE (Supabase Auth + Offline Fallback) ====================
// username بيتحوّل لإيميل وهمي داخلياً لأن Supabase Auth بيشتغل بالإيميل.
// كلمة المرور متخزّنة مشفّرة في auth.users — مش plaintext في جدول users.
//
// لو النت مقطوع، بنرجع نتحقق من نسخة محلية مخزّنة في SQLite (hash فقط، مش الباسورد نفسها)
// اتسجلت آخر مرة حصل فيها تسجيل دخول أونلاين ناجح على نفس الجهاز.
//
// لما الدخول بيتم أونلاين، بنخزن كمان access_token/refresh_token مشفّرين (safeStorage) عشان
// نقدر نعمل "silent re-auth" لما النت يرجع بعد جلسة دخلت فيها أوفلاين — من غير ما نطلب
// من المستخدم يدخل الباسورد تاني.
export const authService = {
    async login(username: string, password: string) {
        const cleanUsername = username.trim().toLowerCase();
        const email = `${cleanUsername}@pharmacy.internal`;

        let authResult;
        try {
            authResult = await supabase.auth.signInWithPassword({ email, password });
        } catch (networkError) {
            // فشل الاتصال نفسه (مش رفض من السيرفر) — نجرب الأوفلاين
            return await this._offlineLoginFallback(cleanUsername, password);
        }

        const { data: authData, error: authError } = authResult;

        if (authError) {
            // نفرّق بين "باسورد غلط فعلاً" و"مقدرناش نوصل للسيرفر أصلاً"
            const msg = (authError.message || "").toLowerCase();
            const looksLikeNetworkIssue =
                msg.includes("fetch") || msg.includes("network") || !navigator.onLine;

            if (looksLikeNetworkIssue) {
                return await this._offlineLoginFallback(cleanUsername, password);
            }
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

        if (!authData?.user) {
            throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
        }

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
            await this._cacheForOffline(cleanUsername, password, profile, "active");
            await this._cacheSession(profile.pharmacy_id || "super_admin", authData.session);
            // نخزن pharmacy_id في localStorage عشان syncQueue تقدر توصله بدون ما تحتاج حالة مستخدم كاملة
            localStorage.setItem("current_pharmacy_id", profile.pharmacy_id || "super_admin");
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

        // التحقق من تفعيل الجهاز — كل جهاز جديد لازم يتفعّل بكود قبل ما يدخل النظام
        const deviceId = getDeviceId();
        const { data: deviceStatus, error: deviceError } = await supabase.rpc("check_device_activation", {
            p_pharmacy_id: profile.pharmacy_id,
            p_device_id: deviceId,
        });
        if (deviceError) {
            await supabase.auth.signOut();
            throw new Error("تعذّر التحقق من تفعيل الجهاز، حاول مرة أخرى");
        }
        if (!deviceStatus?.authorized) {
            // منسجلش خروج هنا عمداً — عايزين الجلسة فاضلة عشان activate_device (اللي بينادى من
            // نافذة الكود في شاشة اللوجين) يقدر يشتغل تحت نفس اليوزر، بعد كدة هنعيد try login تاني
            const err: any = new Error("هذا الجهاز غير مفعّل لهذه الصيدلية");
            err.deviceNotAuthorized = true;
            err.pharmacyId = profile.pharmacy_id;
            throw err;
        }

        // تسجيل الدخول نجح أونلاين بالكامل — نحدّث النسخة المحلية عشان تصلح لو النت اتقطع بعدين
        await this._cacheForOffline(cleanUsername, password, profile, accessStatus);
        // وكمان نخزن الـ session tokens نفسها عشان الـ silent re-auth بعدين
        await this._cacheSession(profile.pharmacy_id, authData.session);
        // نخزن pharmacy_id في localStorage عشان syncQueue تقدر توصله بدون ما تحتاج حالة مستخدم كاملة
        localStorage.setItem("current_pharmacy_id", profile.pharmacy_id);

        return { ...profile, readOnly: accessStatus === "readonly" };
    },

    // بيحفظ نسخة محلية بعد أي تسجيل دخول أونلاين ناجح. فشل الحفظ هنا (مثلاً مش جوا Electron)
    // ميوقفش تسجيل الدخول نفسه — هو مجرد تحسين للمرة الجاية.
    async _cacheForOffline(username: string, password: string, profile: any, accessStatus: string) {
        // @ts-ignore
        if (!window.offlineAPI?.cacheCredentials) return;
        try {
            // @ts-ignore
            await window.offlineAPI.cacheCredentials({ username, password, profile, accessStatus });
        } catch (e) {
            console.error("offline credential caching failed:", e);
        }
    },

    // بيحفظ access_token/refresh_token مشفّرين محليًا (safeStorage) عشان نقدر نسترجع
    // جلسة Supabase حقيقية بدون ما نطلب من المستخدم الباسورد تاني.
    async _cacheSession(pharmacyId: string, session: any) {
        // @ts-ignore
        if (!window.offlineAPI?.cacheSession || !session?.refresh_token) return;
        try {
            // @ts-ignore
            await window.offlineAPI.cacheSession({
                pharmacy_id: pharmacyId,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
            });
        } catch (e) {
            console.error("offline session caching failed:", e);
        }
    },

    // بيتنادى لما تسجيل الدخول الأونلاين يفشل بسبب مشكلة شبكة
    async _offlineLoginFallback(username: string, password: string) {
        // @ts-ignore
        if (!window.offlineAPI?.verifyOfflineLogin) {
            throw new Error("لا يوجد اتصال بالإنترنت، ولا تتوفر بيانات دخول محفوظة لهذا الجهاز");
        }

        // @ts-ignore
        const result = await window.offlineAPI.verifyOfflineLogin({ username, password });

        if (!result.success) {
            const messages: Record<string, string> = {
                no_cached_login: "لا يوجد اتصال بالإنترنت، ويجب تسجيل الدخول مرة واحدة أونلاين أولاً على هذا الجهاز",
                wrong_password: "اسم المستخدم أو كلمة المرور غير صحيحة",
                blocked: "انتهت صلاحية الاشتراك. تواصل مع الدعم لتجديد الاشتراك",
                cache_expired: "لا يوجد اتصال بالإنترنت منذ فترة طويلة، يرجى الاتصال بالإنترنت لتجديد الجلسة",
            };
            throw new Error(messages[result.reason] || "تعذّر تسجيل الدخول بدون اتصال بالإنترنت");
        }

        // نخزن pharmacy_id في localStorage حتى في جلسة الأوفلاين، عشان syncQueue تقدر توصله
        localStorage.setItem("current_pharmacy_id", result.profile.pharmacy_id || "super_admin");

        return { ...result.profile, readOnly: result.readOnly, isOfflineSession: true };
    },

    // ==================== SILENT RE-AUTH ====================
    // بتتنادى لما النت يرجع والمستخدم داخل بجلسة أوفلاين (isOfflineSession: true).
    // بتاخد الـ refresh_token المخزّن محليًا وتعمل بيه setSession عشان تحصل على
    // جلسة Supabase فعلية — من غير ما تطلب من المستخدم يدخل الباسورد تاني.
    // بترجع true لو نجحت (يبقى نقدر نمسح isOfflineSession ونبدأ نزامن)، false لو فشلت.
    async attemptSilentReauth(pharmacyId: string): Promise<boolean> {
        // @ts-ignore
        if (!window.offlineAPI?.getCachedSession) return false;
        if (!navigator.onLine) return false;

        try {
            // @ts-ignore
            const cached = await window.offlineAPI.getCachedSession(pharmacyId);
            if (!cached.success || !cached.refresh_token) {
                console.warn("silent re-auth: no cached session available");
                return false;
            }

            const { data, error } = await supabase.auth.setSession({
                access_token: cached.access_token || "",
                refresh_token: cached.refresh_token,
            });

            if (error || !data.session) {
                console.error("silent re-auth failed:", error);
                // الـ refresh_token ممكن يكون بايظ (اتلغى أو انتهت صلاحيته) — نمسحه عشان
                // منحاولش نعيد استخدامه تاني بالغلط
                // @ts-ignore
                await window.offlineAPI.clearCachedSession?.(pharmacyId);
                return false;
            }

            // نجحنا — نحدّث الـ tokens المخزّنة بالجديدة (refresh_token بيتغيّر مع كل تجديد)
            await this._cacheSession(pharmacyId, data.session);
            // تأكيد إن current_pharmacy_id متسجل (احتياطي، من المفروض يكون already موجود)
            localStorage.setItem("current_pharmacy_id", pharmacyId);
            return true;
        } catch (e) {
            console.error("silent re-auth error:", e);
            return false;
        }
    },

    async logout() {
        const pharmacyId = localStorage.getItem("current_pharmacy_id");
        // @ts-ignore
        await window.offlineAPI.clearCachedSession?.(pharmacyId);
        localStorage.removeItem("current_pharmacy_id");
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