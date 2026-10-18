import crypto from "node:crypto";
import http from "node:http";
import { db } from "./db";
import { markDirty, runBackup } from "./dropboxSync";

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_link_code: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  telegramConnected: boolean;
  telegramUsername: string | null;
  createdAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    telegramConnected: Boolean(row.telegram_chat_id),
    telegramUsername: row.telegram_username,
    createdAt: row.created_at,
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(":");
    if (!salt || !keyHex) return false;
    const key = Buffer.from(keyHex, "hex");
    const derived = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(key, derived);
  } catch {
    return false;
  }
}

export function createUser(username: string, email: string, password: string): PublicUser {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    throw new Error("Username must be between 3 and 30 characters.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    throw new Error("Username can only contain alphanumeric characters, underscores, and hyphens.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const existingStmt = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?");
  const existing = existingStmt.get(cleanUsername, cleanEmail) as { id: string } | undefined;
  if (existing) {
    throw new Error("Username or email already in use.");
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  const insertStmt = db.prepare(
    "INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  insertStmt.run(id, cleanUsername, cleanEmail, passwordHash, now);
  markDirty();
  runBackup(true).catch((err) => console.error("[Dropbox] Immediate user backup error:", err));

  return {
    id,
    username: cleanUsername,
    email: cleanEmail,
    telegramConnected: false,
    telegramUsername: null,
    createdAt: now,
  };
}

export function verifyUserLogin(login: string, password: string): PublicUser | null {
  const cleanLogin = login.trim();
  const stmt = db.prepare("SELECT * FROM users WHERE username = ? OR email = ?");
  const row = stmt.get(cleanLogin, cleanLogin.toLowerCase()) as UserRow | undefined;
  if (!row) return null;

  if (!verifyPassword(password, row.password_hash)) {
    return null;
  }

  return toPublicUser(row);
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const now = new Date().toISOString();

  const stmt = db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)");
  stmt.run(token, userId, expiresAt, now);

  return { token, expiresAt };
}

export function getSessionUser(token: string): PublicUser | null {
  if (!token) return null;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `);
  const row = stmt.get(token, now) as UserRow | undefined;
  if (!row) return null;

  return toPublicUser(row);
}

export function deleteSession(token: string): void {
  if (!token) return;
  const stmt = db.prepare("DELETE FROM sessions WHERE token = ?");
  stmt.run(token);
}

export function getAuthUser(req: http.IncomingMessage): PublicUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1].trim();
  return getSessionUser(token);
}
