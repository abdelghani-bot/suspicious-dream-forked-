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
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

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