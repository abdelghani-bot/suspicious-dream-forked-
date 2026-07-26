const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "pharmacypro_offline.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products_cache (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    name TEXT,
    barcode TEXT,
    price REAL,
    batches TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_sync_events (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    sync_attempts INTEGER DEFAULT 0,
    last_error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_pending_unsynced ON pending_sync_events(synced);
`);

module.exports = db;