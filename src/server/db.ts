import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "posttrack.db");
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for durability and performance
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    telegram_chat_id TEXT,
    telegram_username TEXT,
    telegram_link_code TEXT UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_telegram_code ON users(telegram_link_code);

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',
    status_text TEXT,
    origin TEXT,
    destination TEXT,
    last_event_text TEXT,
    last_event_time TEXT,
    auto_check INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    next_check_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, carrier, tracking_number)
  );

  CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
  CREATE INDEX IF NOT EXISTS idx_shipments_auto_check ON shipments(auto_check, next_check_at);

  CREATE TABLE IF NOT EXISTS geo_cache (
    query TEXT PRIMARY KEY COLLATE NOCASE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    display_name TEXT,
    created_at TEXT NOT NULL
  );
`);
