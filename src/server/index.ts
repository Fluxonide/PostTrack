import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { getCarrier, listCarriers } from "../carriers/registry";
import { detectCarriers, AUTO_CARRIER } from "../carriers/detect";
import { CarrierError, TrackingResult } from "../carriers/types";
import {
  createUser,
  verifyUserLogin,
  createSession,
  getSessionUser,
  deleteSession,
  getAuthUser,
} from "./auth";
import {
  getUserShipments,
  getShipmentById,
  createShipment,
  updateShipment,
  deleteShipment,
  syncShipment,
} from "./shipments";
import { carrierRateLimiter } from "./rateLimiter";
import { autoCheckWorker } from "./autoCheck";
import { telegramService } from "./telegram";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || process.env.WEB_API_PORT || "3001", 10);

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Cache-Control": status === 200 && !res.req?.url?.startsWith("/api/auth") ? "public, s-maxage=120, stale-while-revalidate=300" : "no-store",
  });
  res.end(json);
}

function readJSONBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        return resolve({} as T);
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function serveStatic(pathname: string, res: http.ServerResponse): boolean {
  const distDir = path.resolve(__dirname, "../../dist");
  if (!fs.existsSync(distDir)) return false;

  let filePath = path.join(distDir, pathname);
  if (pathname === "/" || !path.extname(pathname)) {
    filePath = path.join(distDir, "index.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // Fallback to SPA index.html
  const indexPath = path.join(distDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    });
    return res.end();
  }

  const rawUrl = req.url || "/";
  const parsedUrl = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  try {
    // Auth endpoints
    if (pathname === "/api/auth/register" && req.method === "POST") {
      const body = await readJSONBody<{ username?: string; email?: string; password?: string }>(req);
      const { username, email, password } = body;
      if (!username || !email || !password) {
        return sendJSON(res, 400, { error: "bad_request", message: "Username, email, and password are required." });
      }
      try {
        const user = createUser(username, email, password);
        const session = createSession(user.id);
        return sendJSON(res, 201, { user, token: session.token, expiresAt: session.expiresAt });
      } catch (err) {
        return sendJSON(res, 400, { error: "validation_error", message: (err as Error).message });
      }
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await readJSONBody<{ login?: string; password?: string }>(req);
      const { login, password } = body;
      if (!login || !password) {
        return sendJSON(res, 400, { error: "bad_request", message: "Username/email and password are required." });
      }
      const user = verifyUserLogin(login, password);
      if (!user) {
        return sendJSON(res, 401, { error: "unauthorized", message: "Invalid username/email or password." });
      }
      const session = createSession(user.id);
      return sendJSON(res, 200, { user, token: session.token, expiresAt: session.expiresAt });
    }

    if (pathname === "/api/auth/me" && req.method === "GET") {
      const user = getAuthUser(req);
      if (!user) {
        return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      }
      return sendJSON(res, 200, { user });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      const authHeader = req.headers.authorization;
      const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
      if (token) {
        deleteSession(token);
      }
      return sendJSON(res, 200, { ok: true });
    }

    // Shipments endpoints (Protected)
    if (pathname === "/api/shipments" && req.method === "GET") {
      const user = getAuthUser(req);
      if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      const shipments = getUserShipments(user.id);
      return sendJSON(res, 200, { shipments, total: shipments.length });
    }

    if (pathname === "/api/shipments" && req.method === "POST") {
      const user = getAuthUser(req);
      if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      const { carrier, trackingNumber, label } = await readJSONBody<{
        carrier?: string;
        trackingNumber?: string;
        label?: string;
      }>(req);
      if (!carrier || !trackingNumber) {
        return sendJSON(res, 400, { error: "bad_request", message: "Carrier and trackingNumber are required." });
      }
      try {
        const shipment = await createShipment(user.id, carrier, trackingNumber, label);
        telegramService.notifyShipmentAdded(shipment).catch((err) => {
          console.error("[Telegram] Error notifying shipment added:", err);
        });
        return sendJSON(res, 201, { shipment });
      } catch (err) {
        return sendJSON(res, 400, { error: "error", message: (err as Error).message });
      }
    }

    if (pathname.startsWith("/api/shipments/")) {
      const subPath = pathname.slice("/api/shipments/".length);
      const [shipmentId, action] = subPath.split("/");

      if (shipmentId && !action) {
        const user = getAuthUser(req);
        if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });

        if (req.method === "GET") {
          const shipment = getShipmentById(shipmentId, user.id);
          if (!shipment) return sendJSON(res, 404, { error: "not_found", message: "Shipment not found" });
          return sendJSON(res, 200, { shipment });
        }

        if (req.method === "PATCH") {
          const updates = await readJSONBody<{ label?: string; autoCheck?: boolean }>(req);
          const updated = updateShipment(shipmentId, user.id, updates);
          if (!updated) return sendJSON(res, 404, { error: "not_found", message: "Shipment not found" });
          return sendJSON(res, 200, { shipment: updated });
        }

        if (req.method === "DELETE") {
          const ok = deleteShipment(shipmentId, user.id);
          if (!ok) return sendJSON(res, 404, { error: "not_found", message: "Shipment not found" });
          return sendJSON(res, 200, { ok: true });
        }
      }

      if (shipmentId && action === "sync" && req.method === "POST") {
        const user = getAuthUser(req);
        if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
        const synced = await syncShipment(shipmentId, user.id);
        if (!synced) return sendJSON(res, 404, { error: "not_found", message: "Shipment not found" });
        return sendJSON(res, 200, { shipment: synced });
      }
    }

    // Telegram Integration endpoints (Protected)
    if (pathname === "/api/telegram/status" && req.method === "GET") {
      const user = getAuthUser(req);
      if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      return sendJSON(res, 200, {
        botConfigured: telegramService.isConfigured(),
        botUsername: telegramService.getBotUsername(),
        connected: user.telegramConnected,
        telegramUsername: user.telegramUsername,
      });
    }

    if (pathname === "/api/telegram/link-code" && req.method === "POST") {
      const user = getAuthUser(req);
      if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      const linkData = telegramService.generateLinkCode(user.id);
      return sendJSON(res, 200, {
        botConfigured: telegramService.isConfigured(),
        botUsername: telegramService.getBotUsername(),
        ...linkData,
      });
    }

    if (pathname === "/api/telegram/disconnect" && req.method === "POST") {
      const user = getAuthUser(req);
      if (!user) return sendJSON(res, 401, { error: "unauthorized", message: "Not authenticated" });
      const ok = telegramService.disconnect(user.id);
      return sendJSON(res, 200, { ok });
    }

    // Health check
    if (pathname === "/api/health" || pathname === "/health") {
      const uptime = process.uptime();
      const d = Math.floor(uptime / 86400);
      const h = Math.floor((uptime % 86400) / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);
      return sendJSON(res, 200, {
        ok: true,
        status: "healthy",
        service: "PostTrack API",
        uptime: `${d}d ${h}h ${m}m ${s}s`,
        timestamp: new Date().toISOString(),
      });
    }

    // List carriers
    if (pathname === "/api/carriers") {
      const list = listCarriers();
      return sendJSON(res, 200, { carriers: list, total: list.length });
    }

    // Rate limits and worker status
    if (pathname === "/api/limits" || pathname === "/api/system/limits") {
      const stats = carrierRateLimiter.getStats();
      const worker = autoCheckWorker.getStatus();
      return sendJSON(res, 200, { limits: stats, worker });
    }

    // Detect carriers for tracking number
    if (pathname === "/api/detect") {
      const q = parsedUrl.searchParams.get("q") || "";
      const matches = detectCarriers(q);
      return sendJSON(res, 200, { query: q, candidates: matches });
    }

    // Track endpoint: /api/track/:carrier/:tracking
    if (pathname.startsWith("/api/track/")) {
      const parts = pathname.slice("/api/track/".length).split("/").map(decodeURIComponent);
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        return sendJSON(res, 400, { error: "invalid_request", message: "Usage: /api/track/:carrier/:trackingNumber" });
      }

      const [carrierParam, trackingNumber] = parts;
      const cleaned = trackingNumber.trim();
      const opts = { delhiveryToken: process.env.DELHIVERY_API_TOKEN };

      if (carrierParam === AUTO_CARRIER) {
        const candidates = detectCarriers(cleaned);
        if (candidates.length === 0) {
          return sendJSON(res, 400, {
            error: "invalid_input",
            message: "Tracking number format was not recognised. Select a specific carrier from the list.",
          });
        }

        // Try candidate carriers in priority order
        type Outcome =
          | { ok: true; carrier: string; result: TrackingResult }
          | { ok: false; carrier: string; status: number; message: string };

        const outcomes = await Promise.all(
          candidates.map(async (cId): Promise<Outcome> => {
            const c = getCarrier(cId);
            if (!c) return { ok: false, carrier: cId, status: 404, message: "Carrier not found" };
            try {
              const resTrack = await c.track(cleaned, opts);
              return { ok: true, carrier: cId, result: resTrack };
            } catch (err) {
              const status = err instanceof CarrierError ? err.status : 500;
              const msg = err instanceof Error ? err.message : "Error tracking";
              return { ok: false, carrier: cId, status, message: msg };
            }
          }),
        );

        const hit = outcomes.find((o) => o.ok) as { ok: true; carrier: string; result: TrackingResult } | undefined;
        if (hit) {
          const { raw: _raw, ...publicResult } = hit.result;
          return sendJSON(res, 200, { ...publicResult, autoResolved: true });
        }

        return sendJSON(res, 404, {
          error: "not_found",
          message: `No active shipment found across detected carriers (${candidates.join(", ")}).`,
          candidates,
        });
      }

      // Single specific carrier
      const carrier = getCarrier(carrierParam);
      if (!carrier) {
        return sendJSON(res, 404, { error: "carrier_not_supported", carrier: carrierParam });
      }

      carrierRateLimiter.recordRequest(carrierParam);

      try {
        const result = await carrier.track(cleaned, opts);
        const { raw: _raw, ...publicResult } = result;
        return sendJSON(res, 200, publicResult);
      } catch (err) {
        if (err instanceof CarrierError) {
          if (err.code === "rate_limited") {
            carrierRateLimiter.recordRateLimitHit(carrierParam);
          }
          return sendJSON(res, err.status, { error: err.code, message: err.message });
        }
        console.error(`[Carrier Error: ${carrierParam}]`, err);
        return sendJSON(res, 500, { error: "upstream_error", message: "Failed to connect to carrier service." });
      }
    }

    // Static files in production
    if (!pathname.startsWith("/api") && serveStatic(pathname, res)) {
      return;
    }

    sendJSON(res, 404, { error: "not_found", message: "Route not found" });
  } catch (err) {
    console.error("[Server Error]", err);
    sendJSON(res, 500, { error: "internal_error", message: (err as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`[PostTrack Server] Running at http://localhost:${PORT}`);
  autoCheckWorker.start(30000);
  telegramService.init().catch((err) => console.error("[Telegram] Init error:", err));
});
