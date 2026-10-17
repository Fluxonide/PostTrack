import EventEmitter from "node:events";
import { db } from "./db";
import { carrierRateLimiter } from "./rateLimiter";
import { getCarrier } from "../carriers/registry";
import { CarrierError, TrackingResult, TrackingEvent } from "../carriers/types";
import { ShipmentRow, toShipment } from "./shipments";
import { accumulateTrackingResult } from "./trackingHistory";
import * as dropboxSync from "./dropboxSync";

export interface ShipmentUpdateEvent {
  userId: string;
  shipmentId: string;
  carrier: string;
  trackingNumber: string;
  label: string | null;
  oldStatus: string;
  newStatus: string;
  latestEvent: TrackingEvent | null;
  result: TrackingResult;
}

class AutoCheckWorker extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isRunning = false;
  private lastRunAt: string | null = null;
  private totalChecked = 0;

  public start(intervalMs = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[AutoCheck] Background sync worker started.");

    // Initial check after 3 seconds
    setTimeout(() => {
      this.runCycle().catch((err) => console.error("[AutoCheck] Cycle error:", err));
    }, 3000);

    this.timer = setInterval(() => {
      this.runCycle().catch((err) => console.error("[AutoCheck] Cycle error:", err));
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[AutoCheck] Background sync worker stopped.");
  }

  public getStatus() {
    const now = new Date().toISOString();
    const countStmt = db.prepare(`
      SELECT count(*) as count FROM shipments
      WHERE auto_check = 1 AND status NOT IN ('delivered', 'returned')
      AND (next_check_at IS NULL OR next_check_at <= ?)
    `);
    const countRow = countStmt.get(now) as { count: number } | undefined;

    return {
      isRunning: this.isRunning,
      pendingChecksCount: countRow?.count || 0,
      lastRunAt: this.lastRunAt,
      totalChecked: this.totalChecked,
    };
  }

  public async runCycle(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastRunAt = new Date().toISOString();

    try {
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        SELECT * FROM shipments
        WHERE auto_check = 1 AND status NOT IN ('delivered', 'returned')
        AND (next_check_at IS NULL OR next_check_at <= ?)
        ORDER BY next_check_at ASC
        LIMIT 10
      `);

      const dueShipments = stmt.all(now) as unknown as ShipmentRow[];
      if (dueShipments.length === 0) {
        return;
      }

      for (const row of dueShipments) {
        await this.checkShipment(row);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async checkShipment(row: ShipmentRow): Promise<void> {
    const carrier = getCarrier(row.carrier);
    const now = new Date().toISOString();

    if (!carrier) {
      // Unknown carrier, push check forward
      const pushStmt = db.prepare("UPDATE shipments SET next_check_at = ? WHERE id = ?");
      pushStmt.run(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), row.id);
      return;
    }

    // Acquire rate limit slot
    const allowed = await carrierRateLimiter.waitForSlot(row.carrier, 5000);
    if (!allowed) {
      // Currently cooling down or throttled; defer this check by 3 minutes
      const defer = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      db.prepare("UPDATE shipments SET next_check_at = ? WHERE id = ?").run(defer, row.id);
      return;
    }

    this.totalChecked += 1;
    const opts = { delhiveryToken: process.env.DELHIVERY_API_TOKEN };

    try {
      const live = await carrier.track(row.tracking_number, opts);
      const existingCached: TrackingResult | null = row.cached_result
        ? JSON.parse(row.cached_result)
        : null;

      // Accumulate tracking result, preserving all older scans and updates
      const accumulated = accumulateTrackingResult(
        row.carrier,
        row.tracking_number,
        live,
        existingCached
      );

      const newStatus = accumulated.status || "unknown";
      const topEvent = accumulated.events && accumulated.events.length > 0
        ? accumulated.events[accumulated.events.length - 1]
        : null;
      const newEventText = topEvent
        ? topEvent.description || topEvent.statusText || topEvent.status
        : null;
      const newEventTime = topEvent ? topEvent.timestamp || null : null;

      // Check if there is an update compared to previous state
      const hasStatusChange = newStatus !== row.status && newStatus !== "unknown";
      const hasEventChange =
        newEventText &&
        (newEventText !== row.last_event_text || (newEventTime && newEventTime !== row.last_event_time));

      const isFinished = newStatus === "delivered" || newStatus === "returned";

      // Calculate next check delay
      let nextDelayMs = 30 * 60 * 1000; // default 30 mins
      if (isFinished) {
        nextDelayMs = 0;
      } else if (newStatus === "out_for_delivery") {
        nextDelayMs = 15 * 60 * 1000; // 15 mins
      } else if (newStatus === "pending") {
        nextDelayMs = 45 * 60 * 1000; // 45 mins
      }

      const nextCheckAt = isFinished ? null : new Date(Date.now() + nextDelayMs).toISOString();
      const autoCheckVal = isFinished ? 0 : 1;
      const cachedJson = JSON.stringify(accumulated);

      const updateStmt = db.prepare(`
        UPDATE shipments
        SET status = ?, status_text = ?, origin = ?, destination = ?,
            last_event_text = ?, last_event_time = ?, cached_result = ?,
            auto_check = ?, last_checked_at = ?, next_check_at = ?, updated_at = ?
        WHERE id = ?
      `);

      updateStmt.run(
        newStatus,
        accumulated.statusText || row.status_text,
        accumulated.origin || row.origin,
        accumulated.destination || row.destination,
        newEventText || row.last_event_text,
        newEventTime || row.last_event_time,
        cachedJson,
        autoCheckVal,
        now,
        nextCheckAt,
        now,
        row.id
      );

      if (hasStatusChange || hasEventChange) {
        console.log(`[AutoCheck] Update found for [${row.carrier}] ${row.tracking_number}: ${row.status} -> ${newStatus}`);
        dropboxSync.markDirty();
        this.emit("update", {
          userId: row.user_id,
          shipmentId: row.id,
          carrier: row.carrier,
          trackingNumber: row.tracking_number,
          label: row.label,
          oldStatus: row.status,
          newStatus,
          latestEvent: topEvent,
          result: accumulated,
        } as ShipmentUpdateEvent);
      }
    } catch (err) {
      if (err instanceof CarrierError) {
        if (err.code === "rate_limited") {
          carrierRateLimiter.recordRateLimitHit(row.carrier);
        } else if (err.code === "not_found" && row.cached_result) {
          // Carrier purged or expired this waybill; keep historical record permanently
          console.log(`[AutoCheck] Carrier expired [${row.carrier}] ${row.tracking_number}; preserving archive.`);
          db.prepare("UPDATE shipments SET auto_check = 0, last_checked_at = ?, next_check_at = NULL WHERE id = ?").run(
            now,
            row.id
          );
          dropboxSync.markDirty();
          return;
        }
      }
      // Retry in 10 minutes on error
      const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.prepare("UPDATE shipments SET last_checked_at = ?, next_check_at = ? WHERE id = ?").run(
        now,
        retryAt,
        row.id
      );
    }
  }
}

export const autoCheckWorker = new AutoCheckWorker();
