const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const Database = require("better-sqlite3");
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
    `).run(id, evt.payload.pharmacy_id, evt.type, JSON.stringify(evt.payload), evt.timestamp || new Date().toISOString());
        return { id, success: true };
    } catch (err) {
        return { success: false, error: String(err) };
    }
});

ipcMain.handle("offline:getPendingEvents", () => {
    const rows = db.prepare("SELECT * FROM pending_sync_events WHERE synced = 0").all();
    return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
});

ipcMain.handle("offline:markSynced", (event, ids) => {
    const stmt = db.prepare("UPDATE pending_sync_events SET synced = 1 WHERE id = ?");
    const tx = db.transaction((idList) => { for (const id of idList) stmt.run(id); });
    tx(ids);
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