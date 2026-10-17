import crypto from "node:crypto";
import { db } from "./db";
import { autoCheckWorker, ShipmentUpdateEvent } from "./autoCheck";
import type { Shipment } from "./shipments";
import { parseCarrierDate } from "../lib/dates";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface TelegramStatus {
  botConfigured: boolean;
  botUsername: string | null;
  connected: boolean;
  telegramUsername: string | null;
}

class TelegramService {
  private botUsername: string | null = process.env.TELEGRAM_BOT_USERNAME || null;
  private isPolling = false;
  private lastUpdateId = 0;
  private pollAbortController: AbortController | null = null;

  public async init(): Promise<void> {
    if (!BOT_TOKEN) {
      console.log("[Telegram] No TELEGRAM_BOT_TOKEN in environment. Telegram notifications disabled.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/getMe`);
      const data = await res.json() as { ok: boolean; result?: { username: string; first_name: string } };

      if (data.ok && data.result) {
        this.botUsername = data.result.username;
        console.log(`[Telegram] Bot authenticated as @${this.botUsername}`);
        this.startPolling();
      } else {
        console.error("[Telegram] Failed to authenticate bot:", data);
      }
    } catch (err) {
      console.error("[Telegram] Error initializing Telegram bot:", err);
    }

    // Subscribe to auto-check shipment updates
    autoCheckWorker.on("update", (evt: ShipmentUpdateEvent) => {
      this.handleShipmentUpdate(evt).catch((err) => {
        console.error("[Telegram] Error dispatching update notification:", err);
      });
    });
  }

  public getBotUsername(): string | null {
    return this.botUsername;
  }

  public isConfigured(): boolean {
    return Boolean(BOT_TOKEN);
  }

  public generateLinkCode(userId: string): { code: string; deepLink: string; command: string } {
    const code = "pt_" + crypto.randomBytes(6).toString("hex");

    const stmt = db.prepare("UPDATE users SET telegram_link_code = ? WHERE id = ?");
    stmt.run(code, userId);

    const botUser = this.botUsername || "YourPostTrackBot";
    const deepLink = `https://t.me/${botUser}?start=${code}`;
    const command = `/start ${code}`;

    return { code, deepLink, command };
  }

  public disconnect(userId: string): boolean {
    const stmt = db.prepare(`
      UPDATE users
      SET telegram_chat_id = NULL, telegram_username = NULL, telegram_link_code = NULL
      WHERE id = ?
    `);
    const result = stmt.run(userId);
    return Number(result.changes) > 0;
  }

  public async sendMessage(chatId: string, text: string, options: { parseMode?: "Markdown" | "HTML" } = {}): Promise<boolean> {
    if (!BOT_TOKEN) return false;

    try {
      const res = await fetch(`${API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parseMode || "Markdown",
          disable_web_page_preview: true,
        }),
      });

      const data = await res.json() as { ok: boolean; description?: string };
      if (!data.ok) {
        console.warn(`[Telegram] Failed to send message to ${chatId}:`, data.description);
      }
      return data.ok;
    } catch (err) {
      console.error(`[Telegram] Error sending message to ${chatId}:`, err);
      return false;
    }
  }

  private async handleShipmentUpdate(evt: ShipmentUpdateEvent): Promise<void> {
    // Find the user's telegram chat_id
    const stmt = db.prepare("SELECT telegram_chat_id, username FROM users WHERE id = ?");
    const user = stmt.get(evt.userId) as { telegram_chat_id: string | null; username: string } | undefined;

    if (!user || !user.telegram_chat_id) {
      return;
    }

    const carrierName = evt.carrier.toUpperCase();
    const displayName = evt.label ? `*${escapeMarkdown(evt.label)}* (${carrierName})` : `*${carrierName}*`;
    const statusEmoji = getStatusEmoji(evt.newStatus);
    const readableStatus = formatStatus(evt.newStatus);
    const oldReadableStatus = formatStatus(evt.oldStatus);

    let message = `${statusEmoji} *Shipment Update*\n\n`;
    message += `📦 Package: ${displayName}\n`;
    message += `🔖 Tracking: \`${escapeMarkdown(evt.trackingNumber)}\`\n`;

    if (evt.newStatus !== evt.oldStatus && evt.oldStatus && evt.oldStatus !== "unknown") {
      message += `📊 Status: *${readableStatus}* _(was: ${oldReadableStatus})_\n`;
    } else {
      message += `📊 Status: *${readableStatus}*\n`;
    }

    if (evt.result.origin || evt.result.destination) {
      const route = [evt.result.origin, evt.result.destination].filter((s): s is string => Boolean(s)).map(escapeMarkdown).join(" ➔ ");
      message += `🗺️ Route: ${route}\n`;
    }

    if (evt.latestEvent) {
      const eventText =
        evt.latestEvent.description ||
        evt.latestEvent.statusText ||
        formatStatus(evt.latestEvent.status);
      const formattedTime = formatDateTime(evt.latestEvent.timestamp);
      const eventTime = formattedTime ? `\n🕒 ${escapeMarkdown(formattedTime)}` : "";
      const eventLoc = evt.latestEvent.location ? `\n📍 ${escapeMarkdown(evt.latestEvent.location)}` : "";
      message += `\n💬 *Latest Milestone*:\n${escapeMarkdown(eventText)}${eventLoc}${eventTime}\n`;
    }

    await this.sendMessage(user.telegram_chat_id, message, { parseMode: "Markdown" });
  }

  public async notifyShipmentAdded(shipment: Shipment): Promise<void> {
    const stmt = db.prepare("SELECT telegram_chat_id, username FROM users WHERE id = ?");
    const user = stmt.get(shipment.userId) as { telegram_chat_id: string | null; username: string } | undefined;

    if (!user || !user.telegram_chat_id) {
      return;
    }

    const carrierName = shipment.carrier.toUpperCase();
    const displayName = shipment.label ? `*${escapeMarkdown(shipment.label)}* (${carrierName})` : `*${carrierName}*`;
    const readableStatus = formatStatus(shipment.status);
    const statusEmoji = getStatusEmoji(shipment.status);

    let message = `📦 *New Shipment Added to Tracking!*\n\n`;
    message += `🏷️ Package: ${displayName}\n`;
    message += `🚚 Carrier: *${carrierName}*\n`;
    message += `🔖 Tracking: \`${escapeMarkdown(shipment.trackingNumber)}\`\n`;
    message += `📊 Status: ${statusEmoji} *${readableStatus}*\n`;

    if (shipment.origin || shipment.destination) {
      const route = [shipment.origin, shipment.destination].filter((s): s is string => Boolean(s)).map(escapeMarkdown).join(" ➔ ");
      message += `🗺️ Route: ${route}\n`;
    }

    if (shipment.lastEventText) {
      const formattedTime = formatDateTime(shipment.lastEventTime);
      const timeStr = formattedTime ? ` _(${escapeMarkdown(formattedTime)})_` : "";
      message += `\n💬 *Latest Milestone*:\n${escapeMarkdown(shipment.lastEventText)}${timeStr}\n`;
    }

    message += `\n🔔 _You will automatically receive live notifications here whenever new scans or milestones occur!_`;

    await this.sendMessage(user.telegram_chat_id, message, { parseMode: "Markdown" });
  }

  private startPolling(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop().catch((err) => {
      console.error("[Telegram] Fatal polling error:", err);
      this.isPolling = false;
    });
  }

  private async pollLoop(): Promise<void> {
    while (this.isPolling) {
      try {
        const url = `${API_BASE}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
        const res = await fetch(url);
        const data = await res.json() as {
          ok: boolean;
          result?: Array<{
            update_id: number;
            message?: {
              chat: { id: number; username?: string; first_name?: string };
              text?: string;
            };
          }>;
        };

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            if (update.message && update.message.text) {
              await this.processIncomingMessage(update.message);
            }
          }
        }
      } catch {
        // Sleep on error before retrying poll
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  private async processIncomingMessage(msg: {
    chat: { id: number; username?: string; first_name?: string };
    text?: string;
  }): Promise<void> {
    const text = (msg.text || "").trim();
    const chatId = String(msg.chat.id);
    const tgUsername = msg.chat.username || msg.chat.first_name || null;

    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const code = parts[1]?.trim();

      if (!code) {
        // Just /start without code
        const userStmt = db.prepare("SELECT username FROM users WHERE telegram_chat_id = ?");
        const existing = userStmt.get(chatId) as { username: string } | undefined;

        if (existing) {
          await this.sendMessage(
            chatId,
            `👋 *Welcome back, ${escapeMarkdown(existing.username)}!*\n\nYour Telegram account is connected to PostTrack. You will automatically receive live updates whenever your tracked shipments have new activity.\n\nCommands:\n• /status — View active tracked shipments\n• /disconnect — Disconnect account`
          );
        } else {
          await this.sendMessage(
            chatId,
            `👋 *Welcome to PostTrack Bot!*\n\nTo link this chat with your PostTrack dashboard, go to your web dashboard, click *Connect Telegram*, and click the link or send:\n\`/start <your_link_code>\``
          );
        }
        return;
      }

      // Link code provided
      const userStmt = db.prepare("SELECT * FROM users WHERE telegram_link_code = ?");
      const user = userStmt.get(code) as { id: string; username: string } | undefined;

      if (!user) {
        await this.sendMessage(
          chatId,
          `⚠️ *Link Code Invalid or Expired*\n\nPlease generate a fresh code from your PostTrack dashboard (*Connect Telegram*) and try again.`
        );
        return;
      }

      // Link chat ID to this user
      const updateStmt = db.prepare(`
        UPDATE users
        SET telegram_chat_id = ?, telegram_username = ?, telegram_link_code = NULL
        WHERE id = ?
      `);
      updateStmt.run(chatId, tgUsername, user.id);

      await this.sendMessage(
        chatId,
        `🎉 *Successfully Connected!*\n\nYour Telegram is now linked to PostTrack account *${escapeMarkdown(user.username)}*.\n\nWhenever your parcels receive updates, you'll get immediate real-time notifications right here! 🚀`
      );
      return;
    }

    if (text === "/status") {
      const userStmt = db.prepare("SELECT * FROM users WHERE telegram_chat_id = ?");
      const user = userStmt.get(chatId) as { id: string; username: string } | undefined;

      if (!user) {
        await this.sendMessage(
          chatId,
          `❌ You haven't connected your PostTrack account yet. Use the link code from your dashboard to connect.`
        );
        return;
      }

      const countStmt = db.prepare("SELECT count(*) as total, sum(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered FROM shipments WHERE user_id = ?");
      const counts = countStmt.get(user.id) as { total: number; delivered: number | null } | undefined;
      const total = counts?.total || 0;
      const delivered = counts?.delivered || 0;
      const active = total - delivered;

      await this.sendMessage(
        chatId,
        `📊 *PostTrack Status for ${escapeMarkdown(user.username)}*\n\n📦 *Active Shipments*: ${active}\n✅ *Delivered*: ${delivered}\n📈 *Total Tracked*: ${total}`
      );
      return;
    }

    if (text === "/disconnect") {
      const updateStmt = db.prepare(`
        UPDATE users
        SET telegram_chat_id = NULL, telegram_username = NULL
        WHERE telegram_chat_id = ?
      `);
      const res = updateStmt.run(chatId);

      if (Number(res.changes) > 0) {
        await this.sendMessage(chatId, `🔌 Your Telegram account has been disconnected from PostTrack.`);
      } else {
        await this.sendMessage(chatId, `ℹ️ No connected PostTrack account found.`);
      }
      return;
    }

    // Default help response
    await this.sendMessage(
      chatId,
      `🤖 *PostTrack Bot Commands*:\n\n• /status — Check active tracked parcels\n• /disconnect — Unlink your Telegram account`
    );
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "✅";
    case "out_for_delivery":
      return "🚚";
    case "in_transit":
      return "📦";
    case "picked_up":
      return "📤";
    case "exception":
      return "⚠️";
    case "returned":
      return "↩️";
    case "pending":
      return "⏳";
    default:
      return "ℹ️";
  }
}

function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "out_for_delivery":
      return "Out for Delivery";
    case "in_transit":
      return "In Transit";
    case "picked_up":
      return "Picked Up";
    case "delivered":
      return "Delivered";
    case "exception":
      return "Exception / Delayed";
    case "returned":
      return "Returned to Origin";
    case "pending":
      return "Pending Pickup";
    default:
      return "In Progress";
  }
}

function formatDateTime(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Indian carriers report timestamps already in IST (often naive ISO strings without timezone).
  // parseCarrierDate parses them properly in IST instead of misinterpreting them as UTC.
  const parsed = parseCarrierDate(trimmed) || new Date(trimmed);
  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Remove trailing milliseconds or T if parsing wasn't exact
  return trimmed.replace(/T/, " ").replace(/\.\d+.*$/, "");
}

export const telegramService = new TelegramService();

