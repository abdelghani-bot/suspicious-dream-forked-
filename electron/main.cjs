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
`);

ipcMain.handle("app:getVersion", () => app.getVersion());

ipcMain.handle("offline:getProducts", (event, pharmacyId) => {
    const rows = db.prepare("SELECT * FROM products_cache WHERE pharmacy_id = ?").all(pharmacyId);
    return rows.map((r) => ({ ...r, batches: r.batches ? JSON.parse(r.batches) : [] }));
});

ipcMain.handle("offline:upsertProduct", (event, product) => {
    db.prepare(`
    INSERT INTO products_cache (id, pharmacy_id, name, barcode, price, batches, updated_at)
    VALUES (@id, @pharmacy_id, @name, @barcode, @price, @batches, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, barcode=excluded.barcode, price=excluded.price,
      batches=excluded.batches, updated_at=excluded.updated_at
  `).run({ ...product, batches: JSON.stringify(product.batches || []) });
    return { success: true };
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
