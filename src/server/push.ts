import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { autoCheckWorker, ShipmentUpdateEvent } from "./autoCheck";
import { db } from "./db";
import { normalizeCarrierDate } from "../lib/dates";

const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || "";
const SERVICE_ACCOUNT_FILE =
  process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim() ||
  path.resolve(process.cwd(), "firebase-service-account.json");

interface DeviceTokenRow {
  token: string;
}

/**
 * Sends the same shipment-update events that power the Telegram bot to the
 * Android app via Firebase Cloud Messaging.
 *
 * Credentials are supplied either as `FIREBASE_SERVICE_ACCOUNT_JSON` (the raw
 * service-account JSON) or as a `firebase-service-account.json` file. Without
 * either, the service stays disabled and the app falls back to its own polling.
 */
class PushService {
  private app: App | null = null;
  private messaging: Messaging | null = null;
  private sentNotificationFingerprints = new Map<string, number>();

  public init(): void {
    if (this.messaging) return;

    try {
      const credentials = this.loadCredentials();
      if (!credentials) {
        console.log(
          "[Push] Firebase credentials not configured. Android push notifications disabled."
        );
        return;
      }

      this.app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(credentials) });
      this.messaging = getMessaging(this.app);

      autoCheckWorker.on("update", (evt: ShipmentUpdateEvent) => {
        this.handleShipmentUpdate(evt).catch((err) => {
          console.error("[Push] Error dispatching update notification:", err);
        });
      });

      console.log("[Push] Firebase Cloud Messaging notifications enabled.");
    } catch (err) {
      console.error("[Push] Failed to initialize Firebase:", err);
    }
  }

  private loadCredentials(): Record<string, unknown> | null {
    if (SERVICE_ACCOUNT_JSON) {
      try {
        return JSON.parse(SERVICE_ACCOUNT_JSON) as Record<string, unknown>;
      } catch (err) {
        console.error("[Push] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON:", err);
        return null;
      }
    }

    if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, "utf8")) as Record<string, unknown>;
      } catch (err) {
        console.error("[Push] Could not read Firebase service account file:", err);
      }
    }

    return null;
  }

  public registerToken(userId: string, token: string, platform = "android"): void {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO device_tokens (token, user_id, platform, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = excluded.updated_at
    `).run(token, userId, platform, now, now);
  }

  public removeToken(token: string): void {
    db.prepare("DELETE FROM device_tokens WHERE token = ?").run(token);
  }

  public removeTokenForUser(userId: string, token: string): void {
    db.prepare("DELETE FROM device_tokens WHERE token = ? AND user_id = ?").run(token, userId);
  }

  public isConfigured(): boolean {
    return this.messaging !== null;
  }

  private async handleShipmentUpdate(evt: ShipmentUpdateEvent): Promise<void> {
    if (!this.messaging) return;

    const eventDesc = (
      evt.latestEvent?.statusText ||
      evt.latestEvent?.description ||
      evt.result.statusText ||
      ""
    ).trim();
    const eventTime = normalizeCarrierDate(evt.latestEvent?.timestamp) || evt.latestEvent?.timestamp || "";
    const dedupeKey = `${evt.shipmentId}:${evt.newStatus}:${eventDesc}:${eventTime}`;

    const lastSentTime = this.sentNotificationFingerprints.get(dedupeKey);
    if (lastSentTime && Date.now() - lastSentTime < 24 * 60 * 60 * 1000) {
      return;
    }
    this.sentNotificationFingerprints.set(dedupeKey, Date.now());

    const rows = db
      .prepare("SELECT token FROM device_tokens WHERE user_id = ?")
      .all(evt.userId) as unknown as DeviceTokenRow[];

    if (rows.length === 0) return;

    const readableEvent = eventDesc || "Shipment updated";
    const body = evt.latestEvent?.location
      ? `${readableEvent} • ${evt.latestEvent.location}`
      : readableEvent;

    const data: Record<string, string> = {
      type: "shipment_update",
      shipmentId: evt.shipmentId,
      carrier: evt.carrier,
      trackingNumber: evt.trackingNumber,
      status: evt.newStatus,
      eventTime,
      eventDescription: readableEvent,
      location: evt.latestEvent?.location || "",
      title: `📦 ${evt.carrier.toUpperCase()}: ${evt.trackingNumber}`,
      body,
    };

    const tokens = rows.map((row) => row.token);

    // FCM allows at most 500 tokens per multicast request.
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const chunk = tokens.slice(offset, offset + 500);

      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: chunk,
          data,
          android: { priority: "high" },
        });

        response.responses.forEach((result, index) => {
          if (result.success) return;

          const code = result.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument"
          ) {
            this.removeToken(chunk[index]);
          } else {
            console.warn(
              `[Push] Failed to notify device ${chunk[index].slice(0, 12)}…:`,
              result.error?.message
            );
          }
        });
      } catch (err) {
        console.error("[Push] FCM multicast failed:", err);
      }
    }
  }
}

export const pushService = new PushService();
