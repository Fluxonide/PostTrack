import fs from "node:fs";
import path from "node:path";
import { getDbPath, checkpointDb, reopenDb, getDbStats } from "./db";

const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN ?? "";
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY ?? "";
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET ?? "";
const DROPBOX_PATH = process.env.DROPBOX_PATH || "/posttrack/posttrack.db";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const DIRTY_DEBOUNCE_MS = 30_000;        // Debounce writes by 30 seconds
const MIN_BACKUP_INTERVAL = 2 * 60_000;   // Minimum 2 minutes between backups

let backupTimer: NodeJS.Timeout | null = null;
let dirtyTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let lastBackupAt = 0;
let lastDbHash: string | null = null;

export function isConfigured(): boolean {
  return Boolean(DROPBOX_REFRESH_TOKEN && DROPBOX_APP_KEY && DROPBOX_APP_SECRET);
}

function getDbFingerprint(): string | null {
  try {
    const stats = getDbStats();
    return `${stats.userCount}:${stats.shipmentCount}:${stats.size}`;
  } catch {
    return null;
  }
}

function hasDbChanged(): boolean {
  const current = getDbFingerprint();
  if (!current) return false;
  if (lastDbHash === null) {
    lastDbHash = current;
    return true;
  }
  return current !== lastDbHash;
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300_000) {
    return cachedAccessToken;
  }

  const creds = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: DROPBOX_REFRESH_TOKEN,
  });

  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dropbox auth failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 14400) * 1000;
  console.log(`[Dropbox] Token refreshed (valid for ${data.expires_in || 14400}s)`);
  return cachedAccessToken;
}

export async function getBackupInfo(): Promise<{
  path: string;
  size: number;
  sizeMB: string;
  modified: string;
  rev: string;
} | null> {
  const token = await getAccessToken();
  try {
    const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: DROPBOX_PATH }),
    });

    if (res.status === 409) return null;
    if (!res.ok) return null;

    const data = (await res.json()) as {
      path_display: string;
      size: number;
      server_modified: string;
      rev: string;
    };

    return {
      path: data.path_display,
      size: data.size,
      sizeMB: (data.size / 1048576).toFixed(2),
      modified: data.server_modified,
      rev: data.rev,
    };
  } catch (err) {
    console.warn("[Dropbox] Metadata fetch error:", err);
    return null;
  }
}

export async function runBackup(force = false): Promise<boolean> {
  if (!isConfigured()) return false;

  if (isBackingUp) {
    console.log("[Dropbox] Backup already in progress — skipping");
    return false;
  }

  if (!force) {
    const elapsed = Date.now() - lastBackupAt;
    if (elapsed < MIN_BACKUP_INTERVAL) {
      return false;
    }
  }

  isBackingUp = true;
  try {
    // 1. Flush SQLite WAL journal into main DB file
    checkpointDb();

    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      console.warn("[Dropbox] Database file not found to backup");
      return false;
    }

    const fileContent = fs.readFileSync(dbPath);
    const token = await getAccessToken();
    const apiArg = JSON.stringify({
      path: DROPBOX_PATH,
      mode: "overwrite",
      autorename: false,
      mute: true,
    });

    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": apiArg,
        "Content-Type": "application/octet-stream",
      },
      body: fileContent,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { size?: number; rev?: string };
    const sizeMB = ((data.size || fileContent.length) / 1048576).toFixed(2);
    lastDbHash = getDbFingerprint();
    lastBackupAt = Date.now();
    console.log(`[Dropbox] Pushed DB snapshot → ${DROPBOX_PATH} (${sizeMB} MB, rev: ${data.rev || "ok"}) ✓`);
    return true;
  } catch (err) {
    console.error("[Dropbox] Backup error:", err);
    return false;
  } finally {
    isBackingUp = false;
  }
}

export async function restoreFromDropbox(): Promise<string | null> {
  const token = await getAccessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_PATH }),
      "Content-Type": "application/octet-stream",
    },
  });

  if (res.status === 409 || res.status === 404) {
    console.log("[Dropbox] No existing backup found on Dropbox (starting fresh)");
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Download failed (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const dbPath = getDbPath();

  // Close active connection before overwriting SQLite file
  try {
    checkpointDb();
  } catch {}

  // Remove temporary WAL and SHM files
  for (const ext of ["-wal", "-shm"]) {
    try {
      if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
    } catch {}
  }

  fs.writeFileSync(dbPath, buffer);
  reopenDb();

  const sizeMB = (buffer.length / 1048576).toFixed(2);
  console.log(`[Dropbox] Restored database from Dropbox → ${dbPath} (${sizeMB} MB) ✓`);
  return dbPath;
}

export async function autoRestore(): Promise<void> {
  if (!isConfigured()) return;

  const dbPath = getDbPath();
  let localSize = 0;
  let stats = { userCount: 0, shipmentCount: 0, size: 0 };

  try {
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      localSize = stat.size;
      stats = getDbStats();
    }
  } catch {}

  try {
    const remoteInfo = await getBackupInfo();
    if (!remoteInfo) {
      console.log("[Dropbox] No remote backup on Dropbox yet — keeping local DB");
      return;
    }

    // On fresh Render rebuilds or redeploys, local DB has 0 users & 0 shipments
    const isFreshLocal = stats.userCount === 0 && stats.shipmentCount === 0;
    const isRemoteBigger = remoteInfo.size > localSize;

    if (isFreshLocal || isRemoteBigger) {
      console.log(
        `[Dropbox] Restoring database from Dropbox (local: ${stats.userCount} users, ${stats.shipmentCount} shipments | remote: ${remoteInfo.sizeMB} MB)...`
      );
      const restored = await restoreFromDropbox();
      if (restored) {
        lastDbHash = getDbFingerprint();
        const newStats = getDbStats();
        console.log(`[Dropbox] Auto-restore completed successfully ✓ (${newStats.userCount} users, ${newStats.shipmentCount} shipments)`);
        return;
      }
    } else {
      console.log(
        `[Dropbox] Sync status: local has ${stats.userCount} users, ${stats.shipmentCount} shipments (${(localSize / 1048576).toFixed(2)} MB) | Dropbox has ${remoteInfo.sizeMB} MB (rev: ${remoteInfo.rev})`
      );
    }
  } catch (err) {
    console.warn("[Dropbox] Auto-restore error (proceeding with local DB):", err);
  }
}

export function markDirty(): void {
  if (!isConfigured()) return;

  if (dirtyTimer) clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(async () => {
    dirtyTimer = null;
    const elapsed = Date.now() - lastBackupAt;
    if (elapsed < MIN_BACKUP_INTERVAL && !isBackingUp) {
      const retryMs = MIN_BACKUP_INTERVAL - elapsed + 1000;
      dirtyTimer = setTimeout(async () => {
        dirtyTimer = null;
        console.log("[Dropbox] Debounced dirty sync → uploading to Dropbox...");
        await runBackup();
      }, retryMs);
      return;
    }
    console.log("[Dropbox] Debounced dirty sync → uploading to Dropbox...");
    await runBackup();
  }, DIRTY_DEBOUNCE_MS);
}

export function startBackupScheduler(): void {
  if (!isConfigured()) return;

  console.log("[Dropbox] Scheduler active — periodic sync every 5 minutes");
  lastDbHash = getDbFingerprint();

  // Run initial push after 30 seconds
  setTimeout(() => {
    runBackup();
  }, 30_000);

  if (backupTimer) clearInterval(backupTimer);
  backupTimer = setInterval(async () => {
    if (dirtyTimer) return;
    if (!hasDbChanged()) return;
    console.log("[Dropbox] Periodic check: database changes detected — syncing...");
    await runBackup();
  }, CHECK_INTERVAL_MS);
}

export function stopBackupScheduler(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  if (dirtyTimer) {
    clearTimeout(dirtyTimer);
    dirtyTimer = null;
  }
}

export function setupShutdownHooks(): void {
  const shutdown = async (signal: string) => {
    console.log(`[Dropbox] Received ${signal} — performing final sync before exit...`);
    stopBackupScheduler();
    try {
      await runBackup(true);
    } catch (err) {
      console.error("[Dropbox] Final shutdown backup failed:", err);
    }
    process.exit(0);
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export async function getStatus(): Promise<{
  configured: boolean;
  lastBackupAt: string | null;
  remoteInfo: unknown;
  localStats: unknown;
}> {
  const configured = isConfigured();
  let remoteInfo = null;
  if (configured) {
    try {
      remoteInfo = await getBackupInfo();
    } catch {}
  }
  return {
    configured,
    lastBackupAt: lastBackupAt ? new Date(lastBackupAt).toISOString() : null,
    remoteInfo,
    localStats: getDbStats(),
  };
}
