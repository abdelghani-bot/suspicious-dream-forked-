const { app, BrowserWindow, shell, Menu, ipcMain, safeStorage } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }

    mainWindow.once("ready-to-show", () => mainWindow.show());

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
    // 🆕 فحص دوري كل ساعة — الفحص الأصلي بيحصل مرة واحدة بس عند فتح التطبيق،
    // فالمستخدمين اللي بيسيبوا البرنامج شغّال لأيام مكانوش هيعرفوا بريليز جديد
    // غير لو قفلوا التطبيق وفتحوه تاني. نفس فلسفة الـ setInterval بتاع syncQueue.
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 60 * 60 * 1000);
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 🆕 لوج مؤقت لتشخيص مشكلة عدم وصول إشعار التحديث — يوريك بالظبط فين بيقف autoUpdater
autoUpdater.on("checking-for-update", () => console.log("[autoUpdater] checking-for-update..."));
autoUpdater.on("update-available", (info) => console.log("[autoUpdater] update-available:", info.version));
autoUpdater.on("update-not-available", (info) => console.log("[autoUpdater] update-not-available, current:", app.getVersion(), "latest:", info?.version));
autoUpdater.on("error", (err) => console.error("[autoUpdater] error:", err == null ? "unknown" : (err.stack || err.message || err)));
autoUpdater.on("download-progress", (p) => console.log("[autoUpdater] downloading:", Math.round(p.percent) + "%"));

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

const dbPath = path.join(app.getPath("userData"), "pharmacypro_offline.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS pending_sync_events (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    sync_attempts INTEGER DEFAULT 0,
    last_error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pending_unsynced ON pending_sync_events(synced);

  CREATE TABLE IF NOT EXISTS cached_credentials (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    access_status TEXT NOT NULL,
    last_verified_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cached_session (
    pharmacy_id TEXT PRIMARY KEY,
    access_token_enc BLOB,
    refresh_token_enc BLOB NOT NULL,
    expires_at TEXT,
    cached_at TEXT NOT NULL
  );

  -- 🆕 كاش الفواتير محلياً — منفصل عن pending_sync_events (اللي وظيفته بس إنه يوصّل
  -- التغيير لـ Supabase). ده جدول قراءة سريع، بأعمدة حقيقية وفهرسة، عشان تقدر تفتح/تدور
  -- على فاتورة قديمة وانت أوفلاين من غير ما تعمل JSON.parse على كل صفوف الـ outbox.
  CREATE TABLE IF NOT EXISTS sales_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    patient_name TEXT,
    date TEXT,
    created_at TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal REAL,
    tax_amount REAL,
    discount_amt REAL,
    discount_type TEXT,
    total REAL,
    payment TEXT,
    payment_split TEXT,
    shift_id TEXT,
    returned INTEGER DEFAULT 0,
    cashier_name TEXT,
    cashier_user_id TEXT,
    points_redeemed REAL,
    prescription_img TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sales_cache_pharmacy ON sales_cache(pharmacy_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sales_cache_customer ON sales_cache(customer_id);

  -- 🆕 كاش فواتير الشراء محلياً — نفس فلسفة sales_cache تماماً: جدول قراءة سريعة
  -- بأعمدة حقيقية، منفصل عن pending_sync_events اللي مسؤول عن توصيل التغيير لـ Supabase.
  -- items مخزّنة كـ JSON زي ما هي في sales_cache (بيانات الأصناف/الباتشات/الكميات/التكلفة).
  CREATE TABLE IF NOT EXISTS purchase_invoices_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    invoice_number TEXT,
    invoice_date TEXT,
    created_at TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal REAL,
    discount_amt REAL,
    tax_amount REAL,
    total REAL,
    paid_amount REAL,
    payment_status TEXT DEFAULT 'unpaid',
    notes TEXT,
    created_by TEXT,
    returned INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cache_pharmacy ON purchase_invoices_cache(pharmacy_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cache_supplier ON purchase_invoices_cache(supplier_id);

  -- 🆕 كاش سجلات الجرد محلياً — نفس فلسفة sales_cache/purchase_invoices_cache
  CREATE TABLE IF NOT EXISTS inventory_logs_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    date TEXT,
    type TEXT,
    items TEXT NOT NULL,
    notes TEXT,
    by TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_inventory_logs_cache_pharmacy ON inventory_logs_cache(pharmacy_id, date);

  -- 🆕 كاش الشفتات محلياً — نفس فلسفة sales_cache/purchase_invoices_cache
  CREATE TABLE IF NOT EXISTS shifts_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_id TEXT,
    role TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    open_cash REAL,
    close_cash REAL,
    sales REAL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_shifts_cache_pharmacy ON shifts_cache(pharmacy_id, start_time);
  CREATE INDEX IF NOT EXISTS idx_shifts_cache_open ON shifts_cache(pharmacy_id, end_time);

  -- 🆕 كاش الخزنة الموحّد — كل مصادر treasury_entries (مرتجعات، سداد موردين، فروقات شفت،
  -- تقفيل يومي، مصروفات يدوية) بتكتب وتقرا من هنا. sub_type هو اللي بيميز المصدر.
  CREATE TABLE IF NOT EXISTS treasury_entries_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    type TEXT NOT NULL,
    sub_type TEXT,
    method TEXT,
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_by TEXT,
    ref_id TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_treasury_cache_pharmacy ON treasury_entries_cache(pharmacy_id, date);
  CREATE INDEX IF NOT EXISTS idx_treasury_cache_subtype ON treasury_entries_cache(pharmacy_id, sub_type);

  -- 🆕 كاش المرتجعات محلياً — نفس فلسفة sales_cache
  CREATE TABLE IF NOT EXISTS returns_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    date TEXT,
    type TEXT,
    invoice_id TEXT,
    purchase_invoice_id TEXT,
    supplier_id TEXT,
    customer TEXT,
    customer_name TEXT,
    items TEXT NOT NULL,
    reason TEXT,
    subtotal REAL,
    tax REAL,
    total REAL,
    admin_override INTEGER DEFAULT 0,
    refund_source TEXT,
    refund_shift_id TEXT,
    refund_method TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_returns_cache_pharmacy ON returns_cache(pharmacy_id, date);

  -- 🆕 كاش المنتجات محلياً — schema مرن (data = الصنف كامل كـ JSON زي ما هو من Supabase)
  -- عشان أي عمود تضيفه على جدول products مستقبلًا يشتغل تلقائيًا من غير ما نعدّل هنا.
  -- stock مفصول كعمود حقيقي عشان أحداث المخزون (بيع/شراء/مرتجع) تقدر تعمل
  -- UPDATE ... SET stock = stock + delta مباشرة من غير JSON.parse لكل صف.
  -- ده بديل SQLite لتخزين المنتجات بدل localStorage (عشان حدود الحجم في الكتالوجات الكبيرة).
  CREATE TABLE IF NOT EXISTS products_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    data TEXT NOT NULL,
    stock REAL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_products_cache_pharmacy ON products_cache(pharmacy_id);

  -- 🆕 كاش العملاء محلياً — schema مرن (data = العميل كامل كـ JSON) بنفس فلسفة products_cache،
  -- عشان أي حقل تضيفه على جدول customers مستقبلًا (زي حقول تصنيف العميل) يشتغل تلقائيًا
  -- من غير ما نعدّل هنا. ده جزء من نقل customers من localStorage (عبر useStorage) لـ SQLite
  -- زي باقي الموديولات، تحسبًا لحدود حجم localStorage مع قاعدة عملاء كبيرة.
  CREATE TABLE IF NOT EXISTS customers_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_customers_cache_pharmacy ON customers_cache(pharmacy_id);

  -- 🆕 كاش سدادات الآجل محلياً — عشان شاشة "سداد آجل" ورصيد مديونية العميل يشتغلوا
  -- وانت أوفلاين. نفس منطق treasury_entries_cache: جدول قراءة منفصل عن pending_sync_events.
  CREATE TABLE IF NOT EXISTS credit_payments_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    invoice_id TEXT,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_by TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_credit_payments_cache_pharmacy ON credit_payments_cache(pharmacy_id);
  CREATE INDEX IF NOT EXISTS idx_credit_payments_cache_customer ON credit_payments_cache(pharmacy_id, customer_id);
  -- 🆕 كاش العروض محلياً (promotions_cache) — نفس فلسفة customers_cache: data = العرض
  -- كامل كـ JSON، عشان أي حقل يتضاف على جدول promotions مستقبلاً يشتغل من غير تعديل هنا.
  CREATE TABLE IF NOT EXISTS promotions_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_promotions_cache_pharmacy ON promotions_cache(pharmacy_id);

  -- 🆕 كاش قواعد الخصم التلقائي (promo_rules_cache) — الجدول ده بيتعامل معاه دايمًا
  -- كـ full-replace (زي replace_promo_rules RPC على السيرفر)، فمفيش داعي لـ id مستقر
  -- من السيرفر؛ بنولّد id محلي وقت الكتابة والمصدر الحقيقي هو "كل صفوف الفرع" مش صف بعينه.
  CREATE TABLE IF NOT EXISTS promo_rules_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    days INTEGER NOT NULL,
    discount REAL NOT NULL,
    color TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_promo_rules_cache_pharmacy ON promo_rules_cache(pharmacy_id);

  -- 🆕 كاش إعدادات العروض (promo_settings_cache) — صف واحد لكل صيدلية، نفس منطق upsert
  -- لباقي جداول الإعدادات (onConflict: pharmacy_id)
  CREATE TABLE IF NOT EXISTS promo_settings_cache (
    pharmacy_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  -- 🆕 كاش التارجت الشهري — composite key زي onConflict الأصلي بالظبط
  CREATE TABLE IF NOT EXISTS monthly_targets_cache (
    id TEXT PRIMARY KEY, -- pharmacy_id|pharmacist_name|month
    pharmacy_id TEXT NOT NULL,
    pharmacist_name TEXT NOT NULL,
    month TEXT NOT NULL,
    target_amount REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_targets_cache_key
    ON monthly_targets_cache(pharmacy_id, pharmacist_name, month);

  -- 🆕 كاش إعدادات التحفيز (الفئات المسموحة) — صف واحد لكل صيدلية
  CREATE TABLE IF NOT EXISTS incentive_config_cache (
    pharmacy_id TEXT PRIMARY KEY,
    allowed_categories TEXT,
    updated_at TEXT NOT NULL
  );

  -- 🆕 كاش الـ tiers — id مولّد من العميل دايمًا (يطابق الـ RPC المعدّل)
  CREATE TABLE IF NOT EXISTS incentive_tiers_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    margin_threshold REAL NOT NULL,
    rate REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_incentive_tiers_cache_pharmacy ON incentive_tiers_cache(pharmacy_id);

  -- 🆕 كاش تاريخ حدود الـ tiers — append-only، بيتكتب محليًا بنفس منطق الـ RPC
  -- (بس لو tier جديد أو الـ threshold اتغيّر فعليًا)
  CREATE TABLE IF NOT EXISTS incentive_tier_threshold_history_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    threshold REAL NOT NULL,
    effective_from TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tier_history_cache_pharmacy ON incentive_tier_threshold_history_cache(pharmacy_id, effective_from);

  -- 🆕 كاش استثناءات التحفيز
  CREATE TABLE IF NOT EXISTS incentive_overrides_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    data TEXT NOT NULL, -- { type, tier_id }
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_incentive_overrides_cache_pharmacy ON incentive_overrides_cache(pharmacy_id);
  CREATE INDEX IF NOT EXISTS idx_incentive_overrides_cache_product ON incentive_overrides_cache(pharmacy_id, product_id);

  -- 🆕 كاش أصناف التحفيز (قراءة فقط في الشاشة دي — full-replace بعد كل تحميل أونلاين)
  CREATE TABLE IF NOT EXISTS incentive_products_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_incentive_products_cache_pharmacy ON incentive_products_cache(pharmacy_id);

  -- 🆕 كاش المصنّعين (قراءة فقط هنا برضه — full-replace)
  CREATE TABLE IF NOT EXISTS manufacturers_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    name TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_manufacturers_cache_pharmacy ON manufacturers_cache(pharmacy_id);
  -- 🆕 كاش نقاط الولاء — صف واحد لكل عميل، delta-based زي stock في products_cache
CREATE TABLE IF NOT EXISTS loyalty_points_cache (
  customer_id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 0,
  total_earned REAL NOT NULL DEFAULT 0,
  total_redeemed REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_cache_pharmacy ON loyalty_points_cache(pharmacy_id);

-- 🆕 كاش سجل حركات النقاط — append-only، لتاب "السجل" وانت أوفلاين
CREATE TABLE IF NOT EXISTS loyalty_transactions_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  ref_sale_id TEXT,
  earned_mode TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_cache_pharmacy ON loyalty_transactions_cache(pharmacy_id, created_at);

-- ==================== كاش موديول الحضور والانصراف ====================
-- 🆕 سجلات الحضور اليومية — أعمدة حقيقية عشان فلترة التاريخ (اليوم/الشهر) تبقى سريعة
CREATE TABLE IF NOT EXISTS attendance_logs_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  pharmacist_name TEXT NOT NULL,
  pharmacist_user_id TEXT,
  date TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT,
  shift_id TEXT,
  shift_number INTEGER,
  expected_start TEXT,
  late_minutes REAL DEFAULT 0,
  total_hours REAL,
  total_deductions REAL,
  net_hours REAL,
  auto_closed INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_cache_date ON attendance_logs_cache(pharmacy_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_cache_open ON attendance_logs_cache(pharmacy_id, pharmacist_name, check_out);

-- 🆕 استراحات الصلاة — مرتبطة بسجل حضور معين
CREATE TABLE IF NOT EXISTS prayer_breaks_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  attendance_id TEXT NOT NULL,
  pharmacist_name TEXT,
  date TEXT,
  prayer_name TEXT,
  prayer_time TEXT,
  return_time TEXT,
  allowed_minutes REAL,
  actual_minutes REAL,
  deducted_minutes REAL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prayer_breaks_cache_pharmacy ON prayer_breaks_cache(pharmacy_id, date);
CREATE INDEX IF NOT EXISTS idx_prayer_breaks_cache_attendance ON prayer_breaks_cache(attendance_id);

-- 🆕 جدول الدوام الأسبوعي (عادي/رمضان) لكل صيدلي
CREATE TABLE IF NOT EXISTS work_schedules_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  pharmacist_name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  shift_number INTEGER NOT NULL,
  shift_start TEXT,
  shift_end TEXT,
  is_off INTEGER DEFAULT 0,
  overtime_minutes REAL DEFAULT 0,
  grace_minutes REAL DEFAULT 0,
  is_ramadan INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_work_schedules_cache_pharmacist ON work_schedules_cache(pharmacy_id, pharmacist_name);

-- 🆕 الإجازات الرسمية — schema مرن (data = الصف كامل كـ JSON)
CREATE TABLE IF NOT EXISTS official_holidays_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_official_holidays_cache_pharmacy ON official_holidays_cache(pharmacy_id);

-- 🆕 مجموعات التبديل الدوري — schema مرن (data = الصف كامل كـ JSON، فيها pharmacist_names كمصفوفة)
CREATE TABLE IF NOT EXISTS rotation_schedules_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rotation_schedules_cache_pharmacy ON rotation_schedules_cache(pharmacy_id);

-- 🆕 إعدادات أوقات الصلاة — عدد صفوف صغير جدًا لكل صيدلية (بعدد الصلوات)
CREATE TABLE IF NOT EXISTS prayer_settings_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prayer_settings_cache_pharmacy ON prayer_settings_cache(pharmacy_id);

-- 🆕 فجوات الحضور المشبوهة (heartbeat) اللي محتاجة مراجعة مدير
CREATE TABLE IF NOT EXISTS attendance_gaps_cache (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  data TEXT NOT NULL,
  review_status TEXT DEFAULT 'pending',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_gaps_cache_pharmacy ON attendance_gaps_cache(pharmacy_id, review_status);
-- 🆕 كاش المبيعات الفائتة محلياً (missed_sales_cache) — الداشبورد بيعرض كارت
  -- "الفرص الفائتة" (اليوم + الشهر) وكان بيجيب البيانات دايمًا مباشرة من Supabase
  -- بدون أي fallback أوفلاين. created_at بيتخزن عشان فلتر "اليوم" في الداشبورد
  -- بيعتمد عليه (مش على date) بسبب منطق التقفيل بعد نص الليل.
  CREATE TABLE IF NOT EXISTS missed_sales_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    product_name TEXT,
    price REAL,
    qty REAL,
    reason TEXT,
    notes TEXT,
    cashier TEXT,
    date TEXT NOT NULL,
    created_at TEXT,
    customer_id TEXT,
    customer_name TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_missed_sales_cache_pharmacy_date ON missed_sales_cache(pharmacy_id, date);
`);

ipcMain.handle("app:getVersion", () => app.getVersion());

// ==================== كاش المنتجات محلياً (products_cache) ====================
// جلب كل منتجات فرع معين — بديل SQLite لـ ph_products في localStorage عشان لا نصطدم
// بحد الحجم (5-10MB) في الكتالوجات الكبيرة. data هو الصنف كامل زي ما راجع من Supabase.
ipcMain.handle("offline:getProductsCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM products_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => {
        const parsed = JSON.parse(r.data);
        // stock العمود الحقيقي هو مصدر الحقيقة (بيتحدث لحظيًا بالـ delta)، مش القيمة
        // الجامدة جوه الـ JSON من وقت آخر full sync
        return { ...parsed, stock: r.stock };
    });
});

// full sync/refresh بعد كل تحميل ناجح من Supabase — بيستبدل كل صفوف الفرع دفعة واحدة
// جوه transaction واحدة (سريع حتى لآلاف الأصناف)
ipcMain.handle("offline:upsertProductsCache", (_event, { pharmacyId, products }) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO products_cache (id, pharmacy_id, data, stock, updated_at)
      VALUES (@id, @pharmacy_id, @data, @stock, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data=excluded.data, stock=excluded.stock, updated_at=excluded.updated_at
    `);
        const now = new Date().toISOString();
        const tx = db.transaction((rows) => {
            for (const p of rows) {
                stmt.run({
                    id: p.id,
                    pharmacy_id: pharmacyId,
                    data: JSON.stringify(p),
                    stock: p.stock ?? 0,
                    updated_at: now,
                });
            }
        });
        tx(products || []);
        return { success: true, count: (products || []).length };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// 🆕 تحديث stock بالـ delta لحظيًا (نفس منطق stock = stock + delta بتاع apply_return_process
// وباقي RPCs المخزون) — بينادى عليها بالتوازي مع أي optimistic update لمخزون وانت أوفلاين
// (بيع، شراء، مرتجع)، عشان لو قفلت البرنامج وانت أوفلاين، الكاش المحلي يفضل مطابق للـ state.
ipcMain.handle("offline:applyProductStockDeltaCache", (_event, { pharmacyId, deltas }) => {
    try {
        const stmt = db.prepare(
            "UPDATE products_cache SET stock = stock + ?, updated_at = ? WHERE id = ? AND pharmacy_id = ?"
        );
        const now = new Date().toISOString();
        const tx = db.transaction((rows) => {
            for (const d of rows) stmt.run(d.delta, now, d.id, pharmacyId);
        });
        tx(deltas || []);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// ==================== كاش المبيعات محلياً (sales_cache) ====================
// بتتنادى بالتوازي مع offline:queueEvent وقت completeSale في POS — نفس الفاتورة اللي
// بتتبعت لـ Supabase عبر الطابور، بنحفظ نسخة منها هنا كأعمدة حقيقية عشان تفتح/تتقري فوراً.
ipcMain.handle("offline:insertSaleCache", (_event, invoice) => {
    try {
        db.prepare(`
      INSERT INTO sales_cache (
        id, pharmacy_id, customer_id, customer_name, patient_name, date, created_at,
        items, subtotal, tax_amount, discount_amt, discount_type, total, payment,
        payment_split, shift_id, returned, cashier_name, cashier_user_id,
        points_redeemed, prescription_img, updated_at
      ) VALUES (
        @id, @pharmacy_id, @customer_id, @customer_name, @patient_name, @date, @created_at,
        @items, @subtotal, @tax_amount, @discount_amt, @discount_type, @total, @payment,
        @payment_split, @shift_id, @returned, @cashier_name, @cashier_user_id,
        @points_redeemed, @prescription_img, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        customer_id=excluded.customer_id, customer_name=excluded.customer_name,
        patient_name=excluded.patient_name, items=excluded.items, subtotal=excluded.subtotal,
        tax_amount=excluded.tax_amount, discount_amt=excluded.discount_amt,
        discount_type=excluded.discount_type, total=excluded.total, payment=excluded.payment,
        payment_split=excluded.payment_split, returned=excluded.returned,
        prescription_img=excluded.prescription_img, updated_at=excluded.updated_at
    `).run({
            id: invoice.id,
            pharmacy_id: invoice.pharmacy_id,
            customer_id: invoice.customer || null,
            customer_name: invoice.customer_name || null,
            patient_name: invoice.patient_name || null,
            date: invoice.date || null,
            created_at: invoice.created_at,
            items: JSON.stringify(invoice.items || []),
            subtotal: invoice.subtotal ?? null,
            tax_amount: invoice.tax_amount ?? null,
            discount_amt: invoice.discount_amt ?? null,
            discount_type: invoice.discount_type || null,
            total: invoice.total ?? null,
            payment: invoice.payment || null,
            payment_split: invoice.payment_split ? JSON.stringify(invoice.payment_split) : null,
            shift_id: invoice.shift || null,
            returned: invoice.returned ? 1 : 0,
            cashier_name: invoice.cashier_name || null,
            cashier_user_id: invoice.cashier_user_id || null,
            points_redeemed: invoice.points_redeemed ?? null,
            prescription_img: invoice.prescription_img || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب فواتير عميل/فرع معين — للاستخدام في سجل المبيعات وانت أوفلاين
ipcMain.handle("offline:getSalesCache", (_event, { pharmacyId, customerId, limit }) => {
    let rows;
    if (customerId) {
        rows = db.prepare(
            "SELECT * FROM sales_cache WHERE pharmacy_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT ?"
        ).all(pharmacyId, customerId, limit || 200);
    } else {
        rows = db.prepare(
            "SELECT * FROM sales_cache WHERE pharmacy_id = ? ORDER BY created_at DESC LIMIT ?"
        ).all(pharmacyId, limit || 200);
    }
    return rows.map((r) => ({
        ...r,
        items: r.items ? JSON.parse(r.items) : [],
        payment_split: r.payment_split ? JSON.parse(r.payment_split) : null,
        returned: !!r.returned,
    }));
});

// فتح فاتورة واحدة بالـ id — دي اللي هتستخدمها شاشة "عرض الفاتورة/الوصفة" وقت المراجعة
ipcMain.handle("offline:getSaleById", (_event, saleId) => {
    const r = db.prepare("SELECT * FROM sales_cache WHERE id = ?").get(saleId);
    if (!r) return null;
    return {
        ...r,
        items: r.items ? JSON.parse(r.items) : [],
        payment_split: r.payment_split ? JSON.parse(r.payment_split) : null,
        returned: !!r.returned,
    };
});

// ==================== كاش فواتير الشراء محلياً (purchase_invoices_cache) ====================
// بتتنادى بالتوازي مع offline:queueEvent وقت إتمام فاتورة الشراء في شاشة المشتريات —
// نفس الفاتورة اللي هتتبعت لـ Supabase عبر الطابور، بنحفظ نسخة منها هنا للقراءة الفورية.
ipcMain.handle("offline:insertPurchaseInvoiceCache", (_event, invoice) => {
    try {
        db.prepare(`
      INSERT INTO purchase_invoices_cache (
        id, pharmacy_id, supplier_id, supplier_name, invoice_number, invoice_date,
        created_at, items, subtotal, discount_amt, tax_amount, total, paid_amount,
        payment_status, notes, created_by, returned, updated_at
      ) VALUES (
        @id, @pharmacy_id, @supplier_id, @supplier_name, @invoice_number, @invoice_date,
        @created_at, @items, @subtotal, @discount_amt, @tax_amount, @total, @paid_amount,
        @payment_status, @notes, @created_by, @returned, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        supplier_id=excluded.supplier_id, supplier_name=excluded.supplier_name,
        invoice_number=excluded.invoice_number, invoice_date=excluded.invoice_date,
        items=excluded.items, subtotal=excluded.subtotal, discount_amt=excluded.discount_amt,
        tax_amount=excluded.tax_amount, total=excluded.total, paid_amount=excluded.paid_amount,
        payment_status=excluded.payment_status, notes=excluded.notes,
        returned=excluded.returned, updated_at=excluded.updated_at
    `).run({
            id: invoice.id,
            pharmacy_id: invoice.pharmacy_id,
            supplier_id: invoice.supplier_id || null,
            supplier_name: invoice.supplier_name || null,
            invoice_number: invoice.invoice_number || null,
            invoice_date: invoice.invoice_date || null,
            created_at: invoice.created_at,
            items: JSON.stringify(invoice.items || []),
            subtotal: invoice.subtotal ?? null,
            discount_amt: invoice.discount_amt ?? null,
            tax_amount: invoice.tax_amount ?? null,
            total: invoice.total ?? null,
            paid_amount: invoice.paid_amount ?? null,
            payment_status: invoice.payment_status || "unpaid",
            notes: invoice.notes || null,
            created_by: invoice.created_by || null,
            returned: invoice.returned ? 1 : 0,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب فواتير شراء لفرع/مورّد معين — لسجل المشتريات وانت أوفلاين
ipcMain.handle("offline:getPurchaseInvoicesCache", (_event, { pharmacyId, supplierId, limit }) => {
    let rows;
    if (supplierId) {
        rows = db.prepare(
            "SELECT * FROM purchase_invoices_cache WHERE pharmacy_id = ? AND supplier_id = ? ORDER BY created_at DESC LIMIT ?"
        ).all(pharmacyId, supplierId, limit || 200);
    } else {
        rows = db.prepare(
            "SELECT * FROM purchase_invoices_cache WHERE pharmacy_id = ? ORDER BY created_at DESC LIMIT ?"
        ).all(pharmacyId, limit || 200);
    }
    return rows.map((r) => ({
        ...r,
        items: r.items ? JSON.parse(r.items) : [],
        returned: !!r.returned,
    }));
});

// فتح فاتورة شراء واحدة بالـ id — لشاشة عرض/مراجعة الفاتورة
ipcMain.handle("offline:getPurchaseInvoiceById", (_event, invoiceId) => {
    const r = db.prepare("SELECT * FROM purchase_invoices_cache WHERE id = ?").get(invoiceId);
    if (!r) return null;
    return {
        ...r,
        items: r.items ? JSON.parse(r.items) : [],
        returned: !!r.returned,
    };
});

// ==================== كاش سجلات الجرد محلياً (inventory_logs_cache) ====================
ipcMain.handle("offline:insertInventoryLogCache", (_event, log) => {
    try {
        db.prepare(`
      INSERT INTO inventory_logs_cache (id, pharmacy_id, date, type, items, notes, by, updated_at)
      VALUES (@id, @pharmacy_id, @date, @type, @items, @notes, @by, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        date=excluded.date, type=excluded.type, items=excluded.items,
        notes=excluded.notes, by=excluded.by, updated_at=excluded.updated_at
    `).run({
            id: log.id,
            pharmacy_id: log.pharmacy_id,
            date: log.date || null,
            type: log.type || null,
            items: JSON.stringify(log.items || []),
            notes: log.notes || null,
            by: log.by || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getInventoryLogsCache", (_event, { pharmacyId, limit }) => {
    const rows = db.prepare(
        "SELECT * FROM inventory_logs_cache WHERE pharmacy_id = ? ORDER BY date DESC LIMIT ?"
    ).all(pharmacyId, limit || 200);
    return rows.map((r) => ({ ...r, items: r.items ? JSON.parse(r.items) : [] }));
});

ipcMain.handle("offline:queueEvent", (_event, evt) => {
    try {
        const id = evt.id || randomUUID();
        db.prepare(`
      INSERT INTO pending_sync_events (id, pharmacy_id, event_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, evt.pharmacy_id, evt.type, JSON.stringify(evt.payload), evt.timestamp || new Date().toISOString());
        return { id, success: true, synced: false };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPendingEvents", () => {
    const rows = db.prepare("SELECT * FROM pending_sync_events WHERE synced = 0").all();
    return rows.map((r) => ({
        ...r,
        type: r.event_type,
        timestamp: r.created_at,
        payload: JSON.parse(r.payload)
    }));
});

ipcMain.handle("offline:markSynced", (event, ids) => {
    const stmt = db.prepare("UPDATE pending_sync_events SET synced = 1 WHERE id = ?");
    const tx = db.transaction((idList) => { for (const id of idList) stmt.run(id); });
    tx(ids);
    return { success: true };
});

// ==================== كاش الشفتات محلياً (shifts_cache) ====================
// بتتنادى بالتوازي مع offline:queueEvent وقت فتح/إغلاق الشفت — نفس نمط sales_cache تماماً.
ipcMain.handle("offline:upsertShiftCache", (_event, shift) => {
    try {
        db.prepare(`
      INSERT INTO shifts_cache (
        id, pharmacy_id, user_name, user_id, role, start_time, end_time,
        open_cash, close_cash, sales, notes, updated_at
      ) VALUES (
        @id, @pharmacy_id, @user_name, @user_id, @role, @start_time, @end_time,
        @open_cash, @close_cash, @sales, @notes, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        end_time=excluded.end_time, close_cash=excluded.close_cash,
        sales=excluded.sales, notes=excluded.notes, updated_at=excluded.updated_at
    `).run({
            id: shift.id,
            pharmacy_id: shift.pharmacy_id,
            user_name: shift.user,
            user_id: shift.user_id || null,
            role: shift.role || null,
            start_time: shift.start_time,
            end_time: shift.end_time || null,
            open_cash: shift.open_cash ?? null,
            close_cash: shift.close_cash ?? null,
            sales: shift.sales ?? 0,
            notes: shift.notes || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب كل الشفتات لفرع معين — لسجل الشفتات (Table في الأسفل) وانت أوفلاين
ipcMain.handle("offline:getShiftsCache", (_event, { pharmacyId, limit }) => {
    const rows = db.prepare(
        "SELECT * FROM shifts_cache WHERE pharmacy_id = ? ORDER BY start_time DESC LIMIT ?"
    ).all(pharmacyId, limit || 200);
    return rows;
});

// الشفت المفتوح حالياً لمستخدم معين — بديل عن currentShift = shifts.find(...) في الرندرر
ipcMain.handle("offline:getCurrentOpenShift", (_event, { pharmacyId, userName }) => {
    const row = db.prepare(
        "SELECT * FROM shifts_cache WHERE pharmacy_id = ? AND user_name = ? AND end_time IS NULL LIMIT 1"
    ).get(pharmacyId, userName);
    return row || null;
});

// كل الشفتات المفتوحة اليتيمة (للمدير) — end_time فاضي بغض النظر عن المستخدم
ipcMain.handle("offline:getOpenShifts", (_event, pharmacyId) => {
    return db.prepare(
        "SELECT * FROM shifts_cache WHERE pharmacy_id = ? AND end_time IS NULL"
    ).all(pharmacyId);
});

// ==================== كاش الخزنة الموحّد (treasury_entries_cache) ====================
// نقطة كتابة واحدة يستخدمها كل موديول (مرتجعات، موردين، شفتات، تقفيل يومي، مصروفات يدوية)
ipcMain.handle("offline:upsertTreasuryEntryCache", (_event, entry) => {
    try {
        db.prepare(`
      INSERT INTO treasury_entries_cache (
        id, pharmacy_id, type, sub_type, method, amount, note, date, created_by, ref_id, updated_at
      ) VALUES (
        @id, @pharmacy_id, @type, @sub_type, @method, @amount, @note, @date, @created_by, @ref_id, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type, sub_type=excluded.sub_type, method=excluded.method,
        amount=excluded.amount, note=excluded.note, date=excluded.date,
        ref_id=excluded.ref_id, updated_at=excluded.updated_at
    `).run({
            id: entry.id,
            pharmacy_id: entry.pharmacy_id,
            type: entry.type,
            sub_type: entry.sub_type || null,
            method: entry.method || null,
            amount: entry.amount ?? 0,
            note: entry.note || null,
            date: entry.date,
            created_by: entry.created_by || null,
            ref_id: entry.ref_id || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب قيود الخزنة لفرع معين — تستخدمها شاشة الخزنة، تاب الشفتات، تقفيل اليوم، كلهم من نفس المصدر
ipcMain.handle("offline:getTreasuryEntriesCache", (_event, { pharmacyId, date, subType, limit }) => {
    let rows;
    if (date && subType) {
        rows = db.prepare(
            "SELECT * FROM treasury_entries_cache WHERE pharmacy_id = ? AND date = ? AND sub_type = ? ORDER BY updated_at DESC LIMIT ?"
        ).all(pharmacyId, date, subType, limit || 500);
    } else if (date) {
        rows = db.prepare(
            "SELECT * FROM treasury_entries_cache WHERE pharmacy_id = ? AND date = ? ORDER BY updated_at DESC LIMIT ?"
        ).all(pharmacyId, date, limit || 500);
    } else if (subType) {
        rows = db.prepare(
            "SELECT * FROM treasury_entries_cache WHERE pharmacy_id = ? AND sub_type = ? ORDER BY date DESC LIMIT ?"
        ).all(pharmacyId, subType, limit || 500);
    } else {
        rows = db.prepare(
            "SELECT * FROM treasury_entries_cache WHERE pharmacy_id = ? ORDER BY date DESC LIMIT ?"
        ).all(pharmacyId, limit || 500);
    }
    return rows;
});

// ==================== كاش المرتجعات محلياً (returns_cache) ====================
ipcMain.handle("offline:insertReturnCache", (_event, ret) => {
    try {
        db.prepare(`
      INSERT INTO returns_cache (
        id, pharmacy_id, date, type, invoice_id, purchase_invoice_id, supplier_id,
        customer, customer_name, items, reason, subtotal, tax, total, admin_override,
        refund_source, refund_shift_id, refund_method, updated_at
      ) VALUES (
        @id, @pharmacy_id, @date, @type, @invoice_id, @purchase_invoice_id, @supplier_id,
        @customer, @customer_name, @items, @reason, @subtotal, @tax, @total, @admin_override,
        @refund_source, @refund_shift_id, @refund_method, @updated_at
      )
      ON CONFLICT(id) DO NOTHING
    `).run({
            id: ret.id,
            pharmacy_id: ret.pharmacy_id,
            date: ret.date || null,
            type: ret.type,
            invoice_id: ret.invoice_id || null,
            purchase_invoice_id: ret.purchase_invoice_id || null,
            supplier_id: ret.supplier_id || null,
            customer: ret.customer || null,
            customer_name: ret.customer_name || null,
            items: JSON.stringify(ret.items || []),
            reason: ret.reason || null,
            subtotal: ret.subtotal ?? null,
            tax: ret.tax ?? null,
            total: ret.total ?? null,
            admin_override: ret.admin_override ? 1 : 0,
            refund_source: ret.refund_source || null,
            refund_shift_id: ret.refund_shift_id || null,
            refund_method: ret.refund_method || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getReturnsCache", (_event, { pharmacyId, limit }) => {
    const rows = db.prepare(
        "SELECT * FROM returns_cache WHERE pharmacy_id = ? ORDER BY date DESC LIMIT ?"
    ).all(pharmacyId, limit || 300);
    return rows.map((r) => ({ ...r, items: r.items ? JSON.parse(r.items) : [], admin_override: !!r.admin_override }));
});

// ==================== كاش العملاء محلياً (customers_cache) ====================
// نفس فلسفة products_cache: data = العميل كامل كـ JSON، عشان أي حقل يتضاف مستقبلاً
// يشتغل من غير تعديل هنا. بتتنادى بالتوازي مع queueEvent وقت إضافة/تعديل عميل.
ipcMain.handle("offline:upsertCustomerCache", (_event, customer) => {
    try {
        db.prepare(`
      INSERT INTO customers_cache (id, pharmacy_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data=excluded.data, updated_at=excluded.updated_at
    `).run({
            id: customer.id,
            pharmacy_id: customer.pharmacy_id,
            data: JSON.stringify(customer),
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب كل عملاء فرع معين — للاستخدام عند فتح الشاشة أوفلاين
ipcMain.handle("offline:getCustomersCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM customers_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

ipcMain.handle("offline:deleteCustomerCache", (_event, customerId) => {
    try {
        db.prepare("DELETE FROM customers_cache WHERE id = ?").run(customerId);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// ==================== كاش سدادات الآجل محلياً (credit_payments_cache) ====================
ipcMain.handle("offline:upsertCreditPaymentCache", (_event, payment) => {
    try {
        db.prepare(`
      INSERT INTO credit_payments_cache (
        id, pharmacy_id, invoice_id, customer_id, amount, date, notes, created_by, updated_at
      ) VALUES (
        @id, @pharmacy_id, @invoice_id, @customer_id, @amount, @date, @notes, @created_by, @updated_at
      )
      ON CONFLICT(id) DO NOTHING
    `).run({
            id: payment.id,
            pharmacy_id: payment.pharmacy_id,
            invoice_id: payment.invoice_id || null,
            customer_id: payment.customer_id,
            amount: payment.amount ?? 0,
            date: payment.date,
            notes: payment.notes || null,
            created_by: payment.created_by || null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب سدادات الآجل لفرع معين (أو لعميل معين) — لحساب رصيد المديونية وانت أوفلاين
ipcMain.handle("offline:getCreditPaymentsCache", (_event, { pharmacyId, customerId }) => {
    let rows;
    if (customerId) {
        rows = db.prepare(
            "SELECT * FROM credit_payments_cache WHERE pharmacy_id = ? AND customer_id = ?"
        ).all(pharmacyId, customerId);
    } else {
        rows = db.prepare(
            "SELECT * FROM credit_payments_cache WHERE pharmacy_id = ?"
        ).all(pharmacyId);
    }
    return rows;
});
// ==================== كاش العروض محلياً (promotions_cache) ====================
// نفس فلسفة customers_cache: data = العرض كامل كـ JSON. بتتنادى بالتوازي مع queueEvent
// وقت إضافة/تعديل عرض (PROMOTION_INSERT/PROMOTION_UPDATE)
ipcMain.handle("offline:upsertPromotionCache", (_event, promotion) => {
    try {
        db.prepare(`
      INSERT INTO promotions_cache (id, pharmacy_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data=excluded.data, updated_at=excluded.updated_at
    `).run({
            id: promotion.id,
            pharmacy_id: promotion.pharmacy_id,
            data: JSON.stringify(promotion),
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// جلب كل عروض فرع معين — دي اللي POS/computeAutoPromoForProduct هيقرا منها وهو أوفلاين
ipcMain.handle("offline:getPromotionsCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM promotions_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

ipcMain.handle("offline:deletePromotionCache", (_event, promotionId) => {
    try {
        db.prepare("DELETE FROM promotions_cache WHERE id = ?").run(promotionId);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// 🆕 full sync/refresh للعروض بعد كل تحميل ناجح من Supabase — بديل عن upsert فردي وقت
// الـ loadData، نفس منطق upsertProductsCache (استبدال دفعة واحدة جوه transaction)
ipcMain.handle("offline:refreshPromotionsCache", (_event, { pharmacyId, promotions }) => {
    try {
        const now = new Date().toISOString();
        const tx = db.transaction((rows) => {
            db.prepare("DELETE FROM promotions_cache WHERE pharmacy_id = ?").run(pharmacyId);
            const stmt = db.prepare(`
        INSERT INTO promotions_cache (id, pharmacy_id, data, updated_at)
        VALUES (@id, @pharmacy_id, @data, @updated_at)
      `);
            for (const p of rows) {
                stmt.run({ id: p.id, pharmacy_id: pharmacyId, data: JSON.stringify(p), updated_at: now });
            }
        });
        tx(promotions || []);
        return { success: true, count: (promotions || []).length };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// ==================== كاش قواعد الخصم التلقائي (promo_rules_cache) ====================
// full-replace فقط — نفس منطق replace_promo_rules RPC بالظبط، delete+insert جوه transaction
ipcMain.handle("offline:replacePromoRulesCache", (_event, { pharmacyId, rows }) => {
    try {
        const now = new Date().toISOString();
        const tx = db.transaction((rules) => {
            db.prepare("DELETE FROM promo_rules_cache WHERE pharmacy_id = ?").run(pharmacyId);
            const stmt = db.prepare(`
        INSERT INTO promo_rules_cache (id, pharmacy_id, days, discount, color, updated_at)
        VALUES (@id, @pharmacy_id, @days, @discount, @color, @updated_at)
      `);
            for (const r of rules) {
                stmt.run({
                    id: randomUUID(),
                    pharmacy_id: pharmacyId,
                    days: r.days,
                    discount: r.discount,
                    color: r.color || null,
                    updated_at: now,
                });
            }
        });
        tx(rows || []);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPromoRulesCache", (_event, pharmacyId) => {
    return db.prepare(
        "SELECT days, discount, color FROM promo_rules_cache WHERE pharmacy_id = ? ORDER BY days ASC"
    ).all(pharmacyId);
});

// ==================== كاش إعدادات العروض (promo_settings_cache) ====================
ipcMain.handle("offline:upsertPromoSettingsCache", (_event, { pharmacyId, data }) => {
    try {
        db.prepare(`
      INSERT INTO promo_settings_cache (pharmacy_id, data, updated_at)
      VALUES (@pharmacy_id, @data, @updated_at)
      ON CONFLICT(pharmacy_id) DO UPDATE SET
        data=excluded.data, updated_at=excluded.updated_at
    `).run({ pharmacy_id: pharmacyId, data: JSON.stringify(data), updated_at: new Date().toISOString() });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPromoSettingsCache", (_event, pharmacyId) => {
    const row = db.prepare("SELECT * FROM promo_settings_cache WHERE pharmacy_id = ?").get(pharmacyId);
    return row ? JSON.parse(row.data) : null;
});

// ==================== كاش التارجت الشهري (monthly_targets_cache) ====================
ipcMain.handle("offline:upsertMonthlyTargetCache", (_event, { pharmacyId, row }) => {
    try {
        const id = `${pharmacyId}|${row.pharmacist_name}|${row.month}`;
        db.prepare(`
      INSERT INTO monthly_targets_cache (id, pharmacy_id, pharmacist_name, month, target_amount, updated_at)
      VALUES (@id, @pharmacy_id, @pharmacist_name, @month, @target_amount, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        target_amount=excluded.target_amount, updated_at=excluded.updated_at
    `).run({
            id, pharmacy_id: pharmacyId, pharmacist_name: row.pharmacist_name,
            month: row.month, target_amount: row.target_amount, updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getMonthlyTargetsCache", (_event, pharmacyId) => {
    return db.prepare(
        "SELECT pharmacy_id, pharmacist_name, month, target_amount FROM monthly_targets_cache WHERE pharmacy_id = ?"
    ).all(pharmacyId);
});

// ==================== كاش إعدادات التحفيز (incentive_config_cache) ====================
ipcMain.handle("offline:upsertIncentiveConfigCache", (_event, { pharmacyId, allowedCategories }) => {
    try {
        db.prepare(`
      INSERT INTO incentive_config_cache (pharmacy_id, allowed_categories, updated_at)
      VALUES (@pharmacy_id, @allowed_categories, @updated_at)
      ON CONFLICT(pharmacy_id) DO UPDATE SET
        allowed_categories=excluded.allowed_categories, updated_at=excluded.updated_at
    `).run({
            pharmacy_id: pharmacyId,
            allowed_categories: JSON.stringify(allowedCategories || []),
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getIncentiveConfigCache", (_event, pharmacyId) => {
    const row = db.prepare("SELECT * FROM incentive_config_cache WHERE pharmacy_id = ?").get(pharmacyId);
    return row ? { allowed_categories: JSON.parse(row.allowed_categories || "[]") } : null;
});

// ==================== كاش الـ tiers (incentive_tiers_cache) ====================
ipcMain.handle("offline:upsertIncentiveTierCache", (_event, { id, pharmacyId, threshold, rate }) => {
    try {
        db.prepare(`
      INSERT INTO incentive_tiers_cache (id, pharmacy_id, margin_threshold, rate, updated_at)
      VALUES (@id, @pharmacy_id, @margin_threshold, @rate, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        margin_threshold=excluded.margin_threshold, rate=excluded.rate, updated_at=excluded.updated_at
    `).run({ id, pharmacy_id: pharmacyId, margin_threshold: threshold, rate, updated_at: new Date().toISOString() });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:deleteIncentiveTierCache", (_event, id) => {
    try {
        db.prepare("DELETE FROM incentive_tiers_cache WHERE id = ?").run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getIncentiveTiersCache", (_event, pharmacyId) => {
    const rows = db.prepare(
        "SELECT id, margin_threshold as threshold, rate FROM incentive_tiers_cache WHERE pharmacy_id = ? ORDER BY margin_threshold ASC"
    ).all(pharmacyId);
    return rows;
});

// ==================== كاش تاريخ حدود الـ tiers (append-only) ====================
ipcMain.handle("offline:insertTierThresholdHistoryCache", (_event, { id, pharmacyId, tierId, threshold, effectiveFrom }) => {
    try {
        db.prepare(`
      INSERT INTO incentive_tier_threshold_history_cache (id, pharmacy_id, tier_id, threshold, effective_from)
      VALUES (@id, @pharmacy_id, @tier_id, @threshold, @effective_from)
    `).run({ id, pharmacy_id: pharmacyId, tier_id: tierId, threshold, effective_from: effectiveFrom });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getTierThresholdHistoryCache", (_event, pharmacyId) => {
    return db.prepare(
        "SELECT tier_id, threshold, effective_from FROM incentive_tier_threshold_history_cache WHERE pharmacy_id = ? ORDER BY effective_from ASC"
    ).all(pharmacyId);
});

// ==================== كاش استثناءات التحفيز (incentive_overrides_cache) ====================
ipcMain.handle("offline:upsertIncentiveOverrideCache", (_event, row) => {
    try {
        // id ممكن ييجي فاضي أول مرة (زي منطق onConflict الأصلي) — لو مفيش نولّد واحد محلي
        const id = row.id || randomUUID();
        db.prepare(`
      INSERT INTO incentive_overrides_cache (id, pharmacy_id, product_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @product_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
    `).run({
            id, pharmacy_id: row.pharmacy_id, product_id: row.product_id,
            data: JSON.stringify(row), updated_at: new Date().toISOString(),
        });
        return { success: true, id };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:deleteIncentiveOverrideCache", (_event, id) => {
    try {
        db.prepare("DELETE FROM incentive_overrides_cache WHERE id = ?").run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getIncentiveOverridesCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM incentive_overrides_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

// ==================== كاش أصناف التحفيز (قراءة فقط — full-replace) ====================
ipcMain.handle("offline:refreshIncentiveProductsCache", (_event, { pharmacyId, rows }) => {
    try {
        const now = new Date().toISOString();
        const tx = db.transaction((items) => {
            db.prepare("DELETE FROM incentive_products_cache WHERE pharmacy_id = ?").run(pharmacyId);
            const stmt = db.prepare(`
        INSERT INTO incentive_products_cache (id, pharmacy_id, data, updated_at)
        VALUES (@id, @pharmacy_id, @data, @updated_at)
      `);
            for (const it of items) stmt.run({ id: it.id, pharmacy_id: pharmacyId, data: JSON.stringify(it), updated_at: now });
        });
        tx(rows || []);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getIncentiveProductsCache", (_event, pharmacyId) => {
    return db.prepare("SELECT * FROM incentive_products_cache WHERE pharmacy_id = ?").all(pharmacyId)
        .map((r) => JSON.parse(r.data));
});

// ==================== كاش المصنّعين (قراءة فقط — full-replace) ====================
ipcMain.handle("offline:refreshManufacturersCache", (_event, { pharmacyId, rows }) => {
    try {
        const now = new Date().toISOString();
        const tx = db.transaction((items) => {
            db.prepare("DELETE FROM manufacturers_cache WHERE pharmacy_id = ?").run(pharmacyId);
            const stmt = db.prepare(`
        INSERT INTO manufacturers_cache (id, pharmacy_id, name, updated_at)
        VALUES (@id, @pharmacy_id, @name, @updated_at)
      `);
            for (const m of items) stmt.run({ id: m.id, pharmacy_id: pharmacyId, name: m.name, updated_at: now });
        });
        tx(rows || []);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getManufacturersCache", (_event, pharmacyId) => {
    return db.prepare("SELECT id, name FROM manufacturers_cache WHERE pharmacy_id = ? ORDER BY name").all(pharmacyId);
});

// ==================== كاش نقاط الولاء محلياً (loyalty_points_cache) ====================
ipcMain.handle("offline:getLoyaltyPointsCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM loyalty_points_cache WHERE pharmacy_id = ?").all(pharmacyId);
    const map = {};
    for (const r of rows) {
        map[r.customer_id] = { points: r.points, total_earned: r.total_earned, total_redeemed: r.total_redeemed };
    }
    return map;
});

// full sync/refresh بعد كل تحميل ناجح من Supabase
ipcMain.handle("offline:upsertLoyaltyPointsCache", (_event, { pharmacyId, rows }) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO loyalty_points_cache (customer_id, pharmacy_id, points, total_earned, total_redeemed, updated_at)
      VALUES (@customer_id, @pharmacy_id, @points, @total_earned, @total_redeemed, @updated_at)
      ON CONFLICT(customer_id) DO UPDATE SET
        points=excluded.points, total_earned=excluded.total_earned,
        total_redeemed=excluded.total_redeemed, updated_at=excluded.updated_at
    `);
        const now = new Date().toISOString();
        const tx = db.transaction((list) => {
            for (const r of list) {
                stmt.run({
                    customer_id: r.customer_id, pharmacy_id: pharmacyId,
                    points: r.points || 0, total_earned: r.total_earned || 0,
                    total_redeemed: r.total_redeemed || 0, updated_at: now,
                });
            }
        });
        tx(rows || []);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// 🆕 تحديث فوري بالـ delta (زي apply_loyalty_delta على السيرفر بالظبط) — بتترجع الرصيد
// الجديد عشان الكومبوننت يعمل optimistic update فورًا
ipcMain.handle("offline:applyLoyaltyDeltaCache", (_event, { pharmacyId, customerId, delta }) => {
    try {
        const now = new Date().toISOString();
        const tx = db.transaction(() => {
            const existing = db.prepare(
                "SELECT * FROM loyalty_points_cache WHERE customer_id = ? AND pharmacy_id = ?"
            ).get(customerId, pharmacyId);

            const currentPoints = existing?.points || 0;
            const newPoints = Math.max(0, currentPoints + delta);
            const earnedInc = delta > 0 ? delta : 0;
            const redeemedInc = delta < 0 ? -delta : 0;

            db.prepare(`
        INSERT INTO loyalty_points_cache (customer_id, pharmacy_id, points, total_earned, total_redeemed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(customer_id) DO UPDATE SET
          points = ?, total_earned = total_earned + ?, total_redeemed = total_redeemed + ?, updated_at = ?
      `).run(
                customerId, pharmacyId, newPoints, earnedInc, redeemedInc, now,
                newPoints, earnedInc, redeemedInc, now
            );
            return newPoints;
        });
        return { success: true, points: tx() };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// ==================== كاش سجل حركات النقاط ====================
ipcMain.handle("offline:insertLoyaltyTransactionCache", (_event, row) => {
    try {
        db.prepare(`
      INSERT INTO loyalty_transactions_cache
        (id, pharmacy_id, customer_id, type, amount, ref_sale_id, earned_mode, note, created_at)
      VALUES (@id, @pharmacy_id, @customer_id, @type, @amount, @ref_sale_id, @earned_mode, @note, @created_at)
    `).run({
            id: row.id, pharmacy_id: row.pharmacy_id, customer_id: row.customer_id,
            type: row.type, amount: row.amount, ref_sale_id: row.ref_sale_id || null,
            earned_mode: row.earned_mode || null, note: row.note || null,
            created_at: row.created_at || new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getLoyaltyTransactionsCache", (_event, { pharmacyId, limit }) => {
    return db.prepare(
        "SELECT * FROM loyalty_transactions_cache WHERE pharmacy_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(pharmacyId, limit || 200);
});

// ==================== كاش موديول الحضور والانصراف ====================
// سجلات الحضور — insert وقت check-in، update وقت check-out/auto-close
ipcMain.handle("offline:upsertAttendanceLogCache", (_event, log) => {
    try {
        db.prepare(`
      INSERT INTO attendance_logs_cache (
        id, pharmacy_id, pharmacist_name, pharmacist_user_id, date, check_in, check_out,
        shift_id, shift_number, expected_start, late_minutes, total_hours, total_deductions,
        net_hours, auto_closed, updated_at
      ) VALUES (
        @id, @pharmacy_id, @pharmacist_name, @pharmacist_user_id, @date, @check_in, @check_out,
        @shift_id, @shift_number, @expected_start, @late_minutes, @total_hours, @total_deductions,
        @net_hours, @auto_closed, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        check_out=excluded.check_out, total_hours=excluded.total_hours,
        total_deductions=excluded.total_deductions, net_hours=excluded.net_hours,
        late_minutes=excluded.late_minutes, auto_closed=excluded.auto_closed, updated_at=excluded.updated_at
    `).run({
            id: log.id,
            pharmacy_id: log.pharmacy_id,
            pharmacist_name: log.pharmacist_name,
            pharmacist_user_id: log.pharmacist_user_id || null,
            date: log.date,
            check_in: log.check_in,
            check_out: log.check_out || null,
            shift_id: log.shift_id || null,
            shift_number: log.shift_number || 1,
            expected_start: log.expected_start || null,
            late_minutes: log.late_minutes ?? 0,
            total_hours: log.total_hours ?? null,
            total_deductions: log.total_deductions ?? null,
            net_hours: log.net_hours ?? null,
            auto_closed: log.auto_closed ? 1 : 0,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// سجلات اليوم — لتاب الحضور اليومي
ipcMain.handle("offline:getTodayAttendanceLogsCache", (_event, { pharmacyId, date }) => {
    return db.prepare(
        "SELECT * FROM attendance_logs_cache WHERE pharmacy_id = ? AND date = ? ORDER BY check_in"
    ).all(pharmacyId, date);
});

// نطاق تاريخ (لتقرير يوم معين أو شهر كامل) — لتابي "التقرير اليومي" و"التقرير الشهري"
ipcMain.handle("offline:getAttendanceLogsRangeCache", (_event, { pharmacyId, from, to }) => {
    return db.prepare(
        "SELECT * FROM attendance_logs_cache WHERE pharmacy_id = ? AND date >= ? AND date <= ? ORDER BY date"
    ).all(pharmacyId, from, to);
});

// استراحات الصلاة
ipcMain.handle("offline:upsertPrayerBreakCache", (_event, brk) => {
    try {
        db.prepare(`
      INSERT INTO prayer_breaks_cache (
        id, pharmacy_id, attendance_id, pharmacist_name, date, prayer_name, prayer_time,
        return_time, allowed_minutes, actual_minutes, deducted_minutes, updated_at
      ) VALUES (
        @id, @pharmacy_id, @attendance_id, @pharmacist_name, @date, @prayer_name, @prayer_time,
        @return_time, @allowed_minutes, @actual_minutes, @deducted_minutes, @updated_at
      )
      ON CONFLICT(id) DO NOTHING
    `).run({
            id: brk.id,
            pharmacy_id: brk.pharmacy_id,
            attendance_id: brk.attendance_id,
            pharmacist_name: brk.pharmacist_name || null,
            date: brk.date || null,
            prayer_name: brk.prayer_name || null,
            prayer_time: brk.prayer_time || null,
            return_time: brk.return_time || null,
            allowed_minutes: brk.allowed_minutes ?? null,
            actual_minutes: brk.actual_minutes ?? null,
            deducted_minutes: brk.deducted_minutes ?? null,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPrayerBreaksCache", (_event, { pharmacyId, date }) => {
    return db.prepare(
        "SELECT * FROM prayer_breaks_cache WHERE pharmacy_id = ? AND date = ?"
    ).all(pharmacyId, date);
});

// 🆕 كل استراحات الصلاة لفرع معين من غير فلترة تاريخ — للـ join مع سجلات الحضور في التقرير الشهري
ipcMain.handle("offline:getPrayerBreaksRangeCache", (_event, { pharmacyId, from, to }) => {
    return db.prepare(
        "SELECT * FROM prayer_breaks_cache WHERE pharmacy_id = ? AND date >= ? AND date <= ?"
    ).all(pharmacyId, from, to);
});

// جدول الدوام الأسبوعي
ipcMain.handle("offline:upsertWorkScheduleCache", (_event, row) => {
    try {
        db.prepare(`
      INSERT INTO work_schedules_cache (
        id, pharmacy_id, pharmacist_name, day_of_week, shift_number, shift_start, shift_end,
        is_off, overtime_minutes, grace_minutes, is_ramadan, updated_at
      ) VALUES (
        @id, @pharmacy_id, @pharmacist_name, @day_of_week, @shift_number, @shift_start, @shift_end,
        @is_off, @overtime_minutes, @grace_minutes, @is_ramadan, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        shift_start=excluded.shift_start, shift_end=excluded.shift_end, is_off=excluded.is_off,
        overtime_minutes=excluded.overtime_minutes, grace_minutes=excluded.grace_minutes, updated_at=excluded.updated_at
    `).run({
            id: row.id,
            pharmacy_id: row.pharmacy_id,
            pharmacist_name: row.pharmacist_name,
            day_of_week: row.day_of_week,
            shift_number: row.shift_number,
            shift_start: row.shift_start || null,
            shift_end: row.shift_end || null,
            is_off: row.is_off ? 1 : 0,
            overtime_minutes: row.overtime_minutes ?? 0,
            grace_minutes: row.grace_minutes ?? 0,
            is_ramadan: row.is_ramadan ? 1 : 0,
            updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// 🆕 بيتنادى بعد إعادة كتابة جدول أسبوع صيدلي معين — بيمسح كل الصفوف القديمة بتاعته
// (بنفس pharmacist_name + is_ramadan) ما عدا الصفوف الجديدة اللي لسه اتكتبت (excludeIds)
ipcMain.handle("offline:deleteWorkSchedulesCacheByPharmacist", (_event, { pharmacyId, pharmacistName, isRamadan, excludeIds }) => {
    try {
        const placeholders = (excludeIds || []).map(() => "?").join(",") || "''";
        db.prepare(`
      DELETE FROM work_schedules_cache
      WHERE pharmacy_id = ? AND pharmacist_name = ? AND is_ramadan = ? AND id NOT IN (${placeholders})
    `).run(pharmacyId, pharmacistName, isRamadan ? 1 : 0, ...(excludeIds || []));
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:deleteWorkScheduleCache", (_event, id) => {
    try {
        db.prepare("DELETE FROM work_schedules_cache WHERE id = ?").run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getWorkSchedulesCache", (_event, pharmacyId) => {
    return db.prepare("SELECT * FROM work_schedules_cache WHERE pharmacy_id = ?").all(pharmacyId);
});

// الإجازات الرسمية — schema مرن (JSON)
ipcMain.handle("offline:upsertHolidayCache", (_event, holiday) => {
    try {
        db.prepare(`
      INSERT INTO official_holidays_cache (id, pharmacy_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
    `).run({ id: holiday.id, pharmacy_id: holiday.pharmacy_id, data: JSON.stringify(holiday), updated_at: new Date().toISOString() });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:deleteHolidayCache", (_event, id) => {
    try {
        db.prepare("DELETE FROM official_holidays_cache WHERE id = ?").run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getHolidaysCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM official_holidays_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

// مجموعات التبديل الدوري — schema مرن (JSON)
ipcMain.handle("offline:upsertRotationScheduleCache", (_event, rotation) => {
    try {
        db.prepare(`
      INSERT INTO rotation_schedules_cache (id, pharmacy_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
    `).run({ id: rotation.id, pharmacy_id: rotation.pharmacy_id, data: JSON.stringify(rotation), updated_at: new Date().toISOString() });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:deleteRotationScheduleCache", (_event, id) => {
    try {
        db.prepare("DELETE FROM rotation_schedules_cache WHERE id = ?").run(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getRotationSchedulesCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM rotation_schedules_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

// إعدادات أوقات الصلاة — schema مرن (JSON)
ipcMain.handle("offline:upsertPrayerSettingCache", (_event, setting) => {
    try {
        db.prepare(`
      INSERT INTO prayer_settings_cache (id, pharmacy_id, data, updated_at)
      VALUES (@id, @pharmacy_id, @data, @updated_at)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at
    `).run({ id: setting.id, pharmacy_id: setting.pharmacy_id, data: JSON.stringify(setting), updated_at: new Date().toISOString() });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPrayerSettingsCache", (_event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM prayer_settings_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

// فجوات الحضور المشبوهة (heartbeat)
ipcMain.handle("offline:upsertAttendanceGapCache", (_event, gap) => {
    try {
        db.prepare(`
      INSERT INTO attendance_gaps_cache (id, pharmacy_id, data, review_status, updated_at)
      VALUES (@id, @pharmacy_id, @data, @review_status, @updated_at)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, review_status=excluded.review_status, updated_at=excluded.updated_at
    `).run({
            id: gap.id, pharmacy_id: gap.pharmacy_id, data: JSON.stringify(gap),
            review_status: gap.review_status || "pending", updated_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getUnreviewedAttendanceGapsCache", (_event, pharmacyId) => {
    const rows = db.prepare(
        "SELECT * FROM attendance_gaps_cache WHERE pharmacy_id = ? AND review_status = 'pending'"
    ).all(pharmacyId);
    return rows.map((r) => JSON.parse(r.data));
});

// ==================== كاش المبيعات الفائتة (missed_sales_cache) ====================
// 🆕 upsert جماعي (bulk) لأن الداشبورد بيسجل أكتر من صف فائت مرة واحدة أحيانًا
// (نفس شكل event.payload.records في MISSED_SALES_INSERT)
ipcMain.handle("offline:upsertMissedSalesCache", (_event, { pharmacyId, records }) => {
    try {
        const stmt = db.prepare(`
      INSERT INTO missed_sales_cache (
        id, pharmacy_id, product_name, price, qty, reason, notes, cashier,
        date, created_at, customer_id, customer_name, updated_at
      ) VALUES (
        @id, @pharmacy_id, @product_name, @price, @qty, @reason, @notes, @cashier,
        @date, @created_at, @customer_id, @customer_name, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        product_name=excluded.product_name, price=excluded.price, qty=excluded.qty,
        reason=excluded.reason, notes=excluded.notes, cashier=excluded.cashier,
        date=excluded.date, created_at=excluded.created_at,
        customer_id=excluded.customer_id, customer_name=excluded.customer_name,
        updated_at=excluded.updated_at
    `);
        const now = new Date().toISOString();
        const insertMany = db.transaction((rows) => {
            for (const r of rows) {
                stmt.run({
                    id: r.id, pharmacy_id: pharmacyId, product_name: r.product_name || null,
                    price: r.price ?? null, qty: r.qty ?? null, reason: r.reason || null,
                    notes: r.notes || null, cashier: r.cashier || null, date: r.date,
                    created_at: r.created_at || null, customer_id: r.customer_id || null,
                    customer_name: r.customer_name || null, updated_at: now,
                });
            }
        });
        insertMany(records);
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

// 🆕 مطابق لمنطق todayStartTs في الداشبورد: فلترة بـ created_at >= sinceTs
ipcMain.handle("offline:getTodayMissedSalesCache", (_event, { pharmacyId, sinceIso }) => {
    return db.prepare(
        `SELECT * FROM missed_sales_cache WHERE pharmacy_id = ? AND created_at >= ? ORDER BY id DESC`
    ).all(pharmacyId, sinceIso);
});

ipcMain.handle("offline:getMissedSalesMonthCache", (_event, { pharmacyId, monthKey }) => {
    return db.prepare(
        `SELECT * FROM missed_sales_cache WHERE pharmacy_id = ? AND date >= ? AND date <= ? ORDER BY date DESC`
    ).all(pharmacyId, `${monthKey}-01`, `${monthKey}-31`);
});

// ==================== أوفلاين تسجيل الدخول ====================
// بيحفظ نسخة محلية من بيانات الدخول (hash فقط، مش الباسورد نفسها) بعد أي دخول أونلاين ناجح
ipcMain.handle("offline:cacheCredentials", async (_event, payload) => {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    db.prepare(`
    INSERT INTO cached_credentials (username, password_hash, profile_json, access_status, last_verified_at)
    VALUES (@username, @password_hash, @profile_json, @access_status, @last_verified_at)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      profile_json = excluded.profile_json,
      access_status = excluded.access_status,
      last_verified_at = excluded.last_verified_at
  `).run({
        username: payload.username.trim().toLowerCase(),
        password_hash: passwordHash,
        profile_json: JSON.stringify(payload.profile),
        access_status: payload.accessStatus,
        last_verified_at: new Date().toISOString(),
    });
    return { success: true };
});

// بيتنادى لما signInWithPassword يفشل بسبب مشكلة نت، بيتحقق من النسخة المحلية بدل السيرفر
ipcMain.handle("offline:verifyOfflineLogin", async (_event, payload) => {
    const row = db.prepare("SELECT * FROM cached_credentials WHERE username = ?")
        .get(payload.username.trim().toLowerCase());

    if (!row) {
        return { success: false, reason: "no_cached_login" };
    }

    const passwordMatches = await bcrypt.compare(payload.password, row.password_hash);
    if (!passwordMatches) {
        return { success: false, reason: "wrong_password" };
    }

    if (row.access_status === "blocked") {
        return { success: false, reason: "blocked" };
    }

    // لو آخر تحقق ناجح قديم أكتر من 7 أيام، منسمحش بدخول أوفلاين تاني
    const daysSinceVerified = (Date.now() - new Date(row.last_verified_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerified > 7) {
        return { success: false, reason: "cache_expired" };
    }

    return {
        success: true,
        profile: JSON.parse(row.profile_json),
        readOnly: row.access_status === "readonly",
    };
});

// ==================== كاش الجلسة (silent re-auth) ====================
// بيخزن access_token/refresh_token مشفّرين بـ safeStorage (مربوطة بمفتاح نظام التشغيل
// الخاص بالجهاز/المستخدم) — مش نص عادي في SQLite.
ipcMain.handle("offline:cacheSession", (_event, payload) => {
    if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: "encryption_unavailable" };
    }
    try {
        const refreshEnc = safeStorage.encryptString(payload.refresh_token);
        const accessEnc = payload.access_token
            ? safeStorage.encryptString(payload.access_token)
            : null;

        db.prepare(`
      INSERT INTO cached_session (pharmacy_id, access_token_enc, refresh_token_enc, expires_at, cached_at)
      VALUES (@pharmacy_id, @access_token_enc, @refresh_token_enc, @expires_at, @cached_at)
      ON CONFLICT(pharmacy_id) DO UPDATE SET
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        expires_at = excluded.expires_at,
        cached_at = excluded.cached_at
    `).run({
            pharmacy_id: payload.pharmacy_id,
            access_token_enc: accessEnc,
            refresh_token_enc: refreshEnc,
            expires_at: payload.expires_at ? String(payload.expires_at) : null,
            cached_at: new Date().toISOString(),
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getCachedSession", (_event, pharmacyId) => {
    if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, reason: "encryption_unavailable" };
    }
    const row = db.prepare("SELECT * FROM cached_session WHERE pharmacy_id = ?").get(pharmacyId);
    if (!row) {
        return { success: false, reason: "no_cached_session" };
    }
    try {
        return {
            success: true,
            access_token: row.access_token_enc ? safeStorage.decryptString(row.access_token_enc) : null,
            refresh_token: safeStorage.decryptString(row.refresh_token_enc),
            expires_at: row.expires_at,
        };
    } catch (err) {
        // فك التشفير فشل (مثلاً اتنقل الملف لجهاز تاني) — الكاش بقى عديم الفايدة، نمسحه
        db.prepare("DELETE FROM cached_session WHERE pharmacy_id = ?").run(pharmacyId);
        return { success: false, reason: "decrypt_failed" };
    }
});

ipcMain.handle("offline:clearCachedSession", (_event, pharmacyId) => {
    db.prepare("DELETE FROM cached_session WHERE pharmacy_id = ?").run(pharmacyId);
    return { success: true };
});

autoUpdater.on("update-downloaded", () => {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(
            `window.confirm && confirm("يتوفر تحديث جديد. هل تريد إعادة تشغيل البرنامج الآن لتثبيته؟")`
        ).then((result) => {
            if (result) autoUpdater.quitAndInstall();
        }).catch(() => { });
    }
});
