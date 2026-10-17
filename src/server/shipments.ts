import crypto from "node:crypto";
import { db } from "./db";
import { getCarrier } from "../carriers/registry";
import { TrackingResult } from "../carriers/types";
import { detectCarriers, AUTO_CARRIER } from "../carriers/detect";
import { accumulateTrackingResult } from "./trackingHistory";

// Ensure cached_result column exists
try {
  db.exec("ALTER TABLE shipments ADD COLUMN cached_result TEXT;");
} catch {
  // column already exists
}

export interface Shipment {
  id: string;
  userId: string;
  carrier: string;
  trackingNumber: string;
  label: string | null;
  status: string;
  statusText: string | null;
  origin: string | null;
  destination: string | null;
  lastEventText: string | null;
  lastEventTime: string | null;
  autoCheck: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  cachedResult: TrackingResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentRow {
  id: string;
  user_id: string;
  carrier: string;
  tracking_number: string;
  label: string | null;
  status: string;
  status_text: string | null;
  origin: string | null;
  destination: string | null;
  last_event_text: string | null;
  last_event_time: string | null;
  auto_check: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  cached_result: string | null;
  created_at: string;
  updated_at: string;
}

export function toShipment(row: ShipmentRow): Shipment {
  let cached: TrackingResult | null = null;
  if (row.cached_result) {
    try {
      cached = JSON.parse(row.cached_result);
    } catch {
      cached = null;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    label: row.label,
    status: row.status,
    statusText: row.status_text,
    origin: row.origin,
    destination: row.destination,
    lastEventText: row.last_event_text,
    lastEventTime: row.last_event_time,
    autoCheck: Boolean(row.auto_check),
    lastCheckedAt: row.last_checked_at,
    nextCheckAt: row.next_check_at,
    cachedResult: cached,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getUserShipments(userId: string): Shipment[] {
  const stmt = db.prepare(`
    SELECT * FROM shipments
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `);
  const rows = stmt.all(userId) as unknown as ShipmentRow[];
  return rows.map(toShipment);
}

export function getShipmentById(id: string, userId: string): Shipment | null {
  const stmt = db.prepare("SELECT * FROM shipments WHERE id = ? AND user_id = ?");
  const row = stmt.get(id, userId) as ShipmentRow | undefined;
  if (!row) return null;
  return toShipment(row);
}

export async function fetchLiveTracking(carrierId: string, trackingNumber: string): Promise<TrackingResult | null> {
  const carrier = getCarrier(carrierId);
  if (!carrier) return null;
  const opts = { delhiveryToken: process.env.DELHIVERY_API_TOKEN };
  try {
    const result = await carrier.track(trackingNumber.trim(), opts);
    return result;
  } catch {
    return null;
  }
}

export async function createShipment(
  userId: string,
  carrier: string,
  trackingNumber: string,
  label?: string
): Promise<Shipment> {
  const cleanCarrier = carrier.trim().toLowerCase();
  const cleanNumber = trackingNumber.trim();
  const cleanLabel = label?.trim() || null;

  if (!cleanCarrier || !cleanNumber) {
    throw new Error("Carrier and tracking number are required.");
  }

  let resolvedCarrier = cleanCarrier;
  let live: TrackingResult | null = null;

  if (cleanCarrier === AUTO_CARRIER || cleanCarrier === "auto") {
    const candidates = detectCarriers(cleanNumber);
    if (candidates.length === 0) {
      throw new Error("Tracking number format was not recognised. Please select a specific carrier from the list.");
    }

    // Try candidate carriers in priority order to find live match
    for (const cand of candidates) {
      const res = await fetchLiveTracking(cand, cleanNumber);
      if (res && res.status !== "unknown") {
        resolvedCarrier = cand;
        live = res;
        break;
      }
      if (res && !live) {
        resolvedCarrier = cand;
        live = res;
      }
    }

    if (!live) {
      resolvedCarrier = candidates[0];
    }
  } else {
    live = await fetchLiveTracking(cleanCarrier, cleanNumber);
  }

  // Check if shipment already exists for this user
  const existingStmt = db.prepare("SELECT * FROM shipments WHERE user_id = ? AND carrier = ? AND tracking_number = ?");
  const existingRow = existingStmt.get(userId, resolvedCarrier, cleanNumber) as ShipmentRow | undefined;
  if (existingRow) {
    if (cleanLabel && cleanLabel !== existingRow.label) {
      const updateStmt = db.prepare("UPDATE shipments SET label = ?, updated_at = ? WHERE id = ?");
      updateStmt.run(cleanLabel, new Date().toISOString(), existingRow.id);
      existingRow.label = cleanLabel;
    }
    return toShipment(existingRow);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const finalLive = live ? accumulateTrackingResult(resolvedCarrier, cleanNumber, live) : null;

  const status = finalLive?.status || "unknown";
  const statusText = finalLive?.statusText || null;
  const origin = finalLive?.origin || null;
  const destination = finalLive?.destination || null;

  let lastEventText: string | null = null;
  let lastEventTime: string | null = null;
  if (finalLive && finalLive.events && finalLive.events.length > 0) {
    const topEvent = finalLive.events[finalLive.events.length - 1];
    lastEventText = topEvent.statusText || topEvent.status;
    lastEventTime = topEvent.timestamp || null;
  }

  // Next check scheduled in 30 minutes if active
  const nextCheck = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const cachedJson = finalLive ? JSON.stringify(finalLive) : null;

  const insertStmt = db.prepare(`
    INSERT INTO shipments (
      id, user_id, carrier, tracking_number, label,
      status, status_text, origin, destination,
      last_event_text, last_event_time, auto_check,
      last_checked_at, next_check_at, cached_result,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    id,
    userId,
    resolvedCarrier,
    cleanNumber,
    cleanLabel,
    status,
    statusText,
    origin,
    destination,
    lastEventText,
    lastEventTime,
    1,
    now,
    nextCheck,
    cachedJson,
    now,
    now
  );

  return {
    id,
    userId,
    carrier: resolvedCarrier,
    trackingNumber: cleanNumber,
    label: cleanLabel,
    status,
    statusText,
    origin,
    destination,
    lastEventText,
    lastEventTime,
    autoCheck: true,
    lastCheckedAt: now,
    nextCheckAt: nextCheck,
    cachedResult: finalLive,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateShipment(
  id: string,
  userId: string,
  updates: { label?: string; autoCheck?: boolean }
): Shipment | null {
  const current = getShipmentById(id, userId);
  if (!current) return null;

  const now = new Date().toISOString();
  const newLabel = updates.label !== undefined ? (updates.label.trim() || null) : current.label;
  const newAutoCheck = updates.autoCheck !== undefined ? (updates.autoCheck ? 1 : 0) : (current.autoCheck ? 1 : 0);

  const stmt = db.prepare(`
    UPDATE shipments
    SET label = ?, auto_check = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `);
  stmt.run(newLabel, newAutoCheck, now, id, userId);

  return getShipmentById(id, userId);
}

export function deleteShipment(id: string, userId: string): boolean {
  const stmt = db.prepare("DELETE FROM shipments WHERE id = ? AND user_id = ?");
  const result = stmt.run(id, userId);
  return Number(result.changes) > 0;
}

export async function syncShipment(id: string, userId: string): Promise<Shipment | null> {
  const shipment = getShipmentById(id, userId);
  if (!shipment) return null;

  const live = await fetchLiveTracking(shipment.carrier, shipment.trackingNumber);
  const now = new Date().toISOString();
  const nextCheck = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  if (!live) {
    const updateStmt = db.prepare(`
      UPDATE shipments
      SET last_checked_at = ?, next_check_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `);
    updateStmt.run(now, nextCheck, now, id, userId);
    return getShipmentById(id, userId);
  }

  // Accumulate tracking result, preserving all older scans and updates
  const finalLive = accumulateTrackingResult(
    shipment.carrier,
    shipment.trackingNumber,
    live,
    shipment.cachedResult
  );

  const status = finalLive.status || shipment.status;
  const statusText = finalLive.statusText || shipment.statusText;
  const origin = finalLive.origin || shipment.origin;
  const destination = finalLive.destination || shipment.destination;

  let lastEventText = shipment.lastEventText;
  let lastEventTime = shipment.lastEventTime;
  if (finalLive.events && finalLive.events.length > 0) {
    const topEvent = finalLive.events[finalLive.events.length - 1];
    lastEventText = topEvent.statusText || topEvent.status;
    lastEventTime = topEvent.timestamp || null;
  }

  const cachedJson = JSON.stringify(finalLive);

  const updateStmt = db.prepare(`
    UPDATE shipments
    SET status = ?, status_text = ?, origin = ?, destination = ?,
        last_event_text = ?, last_event_time = ?, cached_result = ?,
        last_checked_at = ?, next_check_at = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `);

  updateStmt.run(
    status,
    statusText,
    origin,
    destination,
    lastEventText,
    lastEventTime,
    cachedJson,
    now,
    nextCheck,
    now,
    id,
    userId
  );

  return getShipmentById(id, userId);
}
