import { db } from "./db";
import { TrackingResult, TrackingEvent } from "../carriers/types";

/**
 * Merge two lists of tracking events, preserving all historical checkpoints
 * and deduplicating by timestamp, description, and location.
 */
export function mergeTrackingEvents(
  existing: TrackingEvent[] = [],
  incoming: TrackingEvent[] = []
): TrackingEvent[] {
  if (!existing || existing.length === 0) return [...(incoming || [])];
  if (!incoming || incoming.length === 0) return [...existing];

  const merged: TrackingEvent[] = [...existing];

  for (const inc of incoming) {
    const incTime = (inc.timestamp || "").trim();
    const incDesc = (inc.description || inc.statusText || "").trim().toLowerCase();
    const incLoc = (inc.location || "").trim().toLowerCase();

    // Look for duplicate/matching event in existing history
    const matchIndex = merged.findIndex((ex) => {
      const exTime = (ex.timestamp || "").trim();
      const exDesc = (ex.description || ex.statusText || "").trim().toLowerCase();
      const exLoc = (ex.location || "").trim().toLowerCase();

      // If timestamps match, compare descriptions and locations
      if (incTime && exTime && incTime === exTime) {
        return incDesc === exDesc || (incLoc && incLoc === exLoc);
      }

      // If one timestamp is missing, compare description and location
      if (incDesc === exDesc && (!incLoc || !exLoc || incLoc === exLoc)) {
        return true;
      }

      return false;
    });

    if (matchIndex >= 0) {
      // Upgrade existing event with any richer details from incoming
      const ex = merged[matchIndex];
      merged[matchIndex] = {
        ...ex,
        ...inc,
        timestamp: inc.timestamp || ex.timestamp,
        location: inc.location || ex.location,
        status: inc.status !== "unknown" ? inc.status : ex.status,
        statusText: inc.statusText || ex.statusText,
        description: inc.description || ex.description,
        rawCode: inc.rawCode || ex.rawCode,
      };
    } else {
      // New event found; append it so history is never lost
      merged.push(inc);
    }
  }

  // Sort events chronologically (oldest first to latest last)
  return merged.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (isNaN(tA) || isNaN(tB)) return 0;
    return tA - tB;
  });
}

/**
 * Merge an incoming TrackingResult with previous historical data.
 * All older events, origins, and destinations are kept permanently.
 */
export function mergeTrackingResults(
  existing: TrackingResult | null | undefined,
  incoming: TrackingResult
): TrackingResult {
  if (!existing) return incoming;

  const mergedEvents = mergeTrackingEvents(existing.events, incoming.events);

  return {
    ...incoming,
    status: incoming.status !== "unknown" ? incoming.status : existing.status,
    origin: incoming.origin || existing.origin,
    destination: incoming.destination || existing.destination,
    estimatedDelivery: incoming.estimatedDelivery || existing.estimatedDelivery,
    events: mergedEvents,
  };
}

/**
 * Look up SQLite tracking history cache for a carrier and tracking number.
 */
export function getHistoryCache(carrier: string, trackingNumber: string): TrackingResult | null {
  try {
    const stmt = db.prepare(`
      SELECT result_json FROM tracking_history_cache
      WHERE carrier = ? AND tracking_number = ?
    `);
    const row = stmt.get(carrier.toLowerCase(), trackingNumber.trim()) as { result_json: string } | undefined;
    if (row && row.result_json) {
      return JSON.parse(row.result_json) as TrackingResult;
    }

    // Fallback: check shipments table if not yet in tracking_history_cache
    const shipStmt = db.prepare(`
      SELECT cached_result FROM shipments
      WHERE carrier = ? AND tracking_number = ? AND cached_result IS NOT NULL
      ORDER BY updated_at DESC LIMIT 1
    `);
    const shipRow = shipStmt.get(carrier.toLowerCase(), trackingNumber.trim()) as { cached_result: string } | undefined;
    if (shipRow && shipRow.cached_result) {
      return JSON.parse(shipRow.cached_result) as TrackingResult;
    }
  } catch (err) {
    console.warn("[TrackingHistory] Cache get error:", err);
  }
  return null;
}

/**
 * Save or update the accumulated tracking history in SQLite cache.
 */
export function saveHistoryCache(carrier: string, trackingNumber: string, result: TrackingResult): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO tracking_history_cache (
        carrier, tracking_number, status, origin, destination, result_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(carrier, tracking_number) DO UPDATE SET
        status = excluded.status,
        origin = COALESCE(excluded.origin, tracking_history_cache.origin),
        destination = COALESCE(excluded.destination, tracking_history_cache.destination),
        result_json = excluded.result_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      carrier.toLowerCase(),
      trackingNumber.trim(),
      result.status || "unknown",
      result.origin || null,
      result.destination || null,
      JSON.stringify(result),
      new Date().toISOString()
    );
  } catch (err) {
    console.warn("[TrackingHistory] Cache save error:", err);
  }
}

/**
 * High-level function: Takes fresh incoming tracking result, merges it with both
 * the SQLite persistent history cache and any existing shipment cachedResult,
 * saves the updated cumulative history, and returns the merged result.
 */
export function accumulateTrackingResult(
  carrier: string,
  trackingNumber: string,
  incoming: TrackingResult,
  existingShipmentResult?: TrackingResult | null
): TrackingResult {
  const cached = getHistoryCache(carrier, trackingNumber);

  // Merge with existing shipment result first, then with sqlite global history cache
  let merged = mergeTrackingResults(existingShipmentResult, incoming);
  merged = mergeTrackingResults(cached, merged);

  // Persist updated cumulative history
  saveHistoryCache(carrier, trackingNumber, merged);

  return merged;
}
