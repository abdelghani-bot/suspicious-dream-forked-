const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

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
    encrypted_refresh_token BLOB NOT NULL,
    encrypted_access_token BLOB,
    expires_at INTEGER,
    updated_at TEXT NOT NULL
  );
module.exports = db;