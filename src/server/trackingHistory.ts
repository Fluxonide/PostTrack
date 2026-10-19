import { db } from "./db";
import { TrackingResult, TrackingEvent, ShipmentStatus } from "../carriers/types";
import { carryForwardStatus, overallStatus } from "../carriers/normalize";
import { mapStatus as mapDelhiveryStatus } from "../carriers/delhivery";
import { parseCarrierDate, normalizeCarrierDate } from "../lib/dates";

/**
 * Sanitize historical event statuses to ensure real exceptions (like vehicle delayed)
 * are retained for their timeframe, but normal movement scans (like bag received,
 * vehicle arrived, facility arrived) are not falsely marked as exceptions.
 */
export function sanitizeEventStatus(ev: TrackingEvent, carrier?: string): TrackingEvent {
  if (carrier && carrier.toLowerCase() === "delhivery") {
    const recalculated = mapDelhiveryStatus(ev.rawCode, [ev.description, ev.statusText].filter(Boolean).join(" - "));
    if (recalculated !== "unknown") {
      return { ...ev, status: recalculated };
    }
  }

  // Generic check: if status is 'exception' but description explicitly represents regular transit movement
  // without any negative/delay keywords, fix status to in_transit
  if (ev.status === "exception") {
    const desc = (ev.description || ev.statusText || "").toLowerCase();
    const hasDelayOrFailure =
      desc.includes("delayed") ||
      desc.includes("delay") ||
      desc.includes("undelivered") ||
      desc.includes("not delivered") ||
      desc.includes("attempt") ||
      desc.includes("fail") ||
      desc.includes("hold") ||
      desc.includes("held") ||
      desc.includes("misroute") ||
      desc.includes("damage") ||
      desc.includes("lost") ||
      desc.includes("reject") ||
      desc.includes("refuse") ||
      desc.includes("unable") ||
      desc.includes("cancel");

    const hasActiveTransit =
      desc.includes("arrived") ||
      desc.includes("bag") ||
      desc.includes("facility") ||
      desc.includes("hub") ||
      desc.includes("center") ||
      desc.includes("centre") ||
      desc.includes("left for") ||
      desc.includes("departed") ||
      desc.includes("dispatched") ||
      desc.includes("forwarded") ||
      desc.includes("in transit") ||
      desc.includes("weight captured");

    if (!hasDelayOrFailure && hasActiveTransit) {
      return { ...ev, status: "in_transit" };
    }
  }

  return ev;
}

/**
 * Merge two lists of tracking events, preserving all historical checkpoints
 * and deduplicating by timestamp, description, and location.
 */
export function mergeTrackingEvents(
  existing: TrackingEvent[] = [],
  incoming: TrackingEvent[] = [],
  carrier?: string
): TrackingEvent[] {
  const sanitizedExisting = (existing || []).map((e) => sanitizeEventStatus(e, carrier));
  const sanitizedIncoming = (incoming || []).map((e) => sanitizeEventStatus(e, carrier));

  if (!sanitizedExisting || sanitizedExisting.length === 0) return [...(sanitizedIncoming || [])];
  if (!sanitizedIncoming || sanitizedIncoming.length === 0) return [...sanitizedExisting];

  const merged: TrackingEvent[] = [...sanitizedExisting];

  for (const inc of sanitizedIncoming) {
    const incNormTime = normalizeCarrierDate(inc.timestamp) || (inc.timestamp || "").trim();
    const incDesc = (inc.description || inc.statusText || "").trim().toLowerCase();
    const incLoc = (inc.location || "").trim().toLowerCase();

    // Look for duplicate/matching event in existing history
    const matchIndex = merged.findIndex((ex) => {
      const exNormTime = normalizeCarrierDate(ex.timestamp) || (ex.timestamp || "").trim();
      const exDesc = (ex.description || ex.statusText || "").trim().toLowerCase();
      const exLoc = (ex.location || "").trim().toLowerCase();

      // If timestamps match, compare descriptions and locations
      if (incNormTime && exNormTime && incNormTime === exNormTime) {
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
        timestamp: normalizeCarrierDate(inc.timestamp || ex.timestamp) || inc.timestamp || ex.timestamp,
        location: inc.location || ex.location,
        status: inc.status !== "unknown" ? inc.status : ex.status,
        statusText: inc.statusText || ex.statusText,
        description: inc.description || ex.description,
        rawCode: inc.rawCode || ex.rawCode,
      };
    } else {
      // New event found; append it so history is never lost
      merged.push({
        ...inc,
        timestamp: normalizeCarrierDate(inc.timestamp) || inc.timestamp,
      });
    }
  }

  // Sort events chronologically (oldest first to latest last)
  const sorted = merged.sort((a, b) => {
    const timeA = parseCarrierDate(a.timestamp)?.getTime() ?? 0;
    const timeB = parseCarrierDate(b.timestamp)?.getTime() ?? 0;
    const validA = timeA > 0;
    const validB = timeB > 0;

    if (validA && validB) return timeA - timeB;
    if (validA && !validB) return 1;  // timestamped event is newer than untimestamped event
    if (!validA && validB) return -1; // untimestamped event is older than timestamped event
    return 0;
  });

  const normalizedList = sorted.map((e) => {
    const iso = normalizeCarrierDate(e.timestamp);
    return iso ? { ...e, timestamp: iso } : e;
  });

  return carryForwardStatus(normalizedList);
}

/**
 * Merge an incoming TrackingResult with previous historical data.
 * All older events, origins, and destinations are kept permanently.
 */
export function mergeTrackingResults(
  existing: TrackingResult | null | undefined,
  incoming: TrackingResult,
  carrier?: string
): TrackingResult {
  const resolvedCarrier = carrier || incoming.carrier || existing?.carrier;

  if (!existing) {
    const sanitizedEvents = (incoming.events || []).map((e) => sanitizeEventStatus(e, resolvedCarrier));
    const normalizedEvents = sanitizedEvents.map((e) => {
      const iso = normalizeCarrierDate(e.timestamp);
      return iso ? { ...e, timestamp: iso } : e;
    });
    const processedEvents = carryForwardStatus(normalizedEvents);
    let computedStatus: ShipmentStatus;
    if (incoming.status === "delivered" || incoming.status === "returned") {
      computedStatus = incoming.status;
    } else {
      computedStatus = overallStatus(processedEvents, incoming.status);
    }
    return {
      ...incoming,
      status: computedStatus,
      estimatedDelivery: normalizeCarrierDate(incoming.estimatedDelivery) || incoming.estimatedDelivery,
      events: processedEvents,
    };
  }

  const mergedEvents = mergeTrackingEvents(existing.events, incoming.events, resolvedCarrier);

  let computedStatus: ShipmentStatus;
  if (incoming.status === "delivered" || incoming.status === "returned") {
    computedStatus = incoming.status;
  } else {
    computedStatus = overallStatus(mergedEvents, incoming.status, existing.status);
  }

  let computedStatusText = incoming.statusText || existing.statusText;
  if (computedStatus !== "exception" && computedStatusText) {
    const stLower = computedStatusText.toLowerCase();
    if (stLower.includes("exception") || stLower.includes("delayed") || stLower.includes("undelivered")) {
      computedStatusText = undefined;
    }
  }

  const rawEta = incoming.estimatedDelivery || existing.estimatedDelivery;
  return {
    ...incoming,
    status: computedStatus,
    statusText: computedStatusText,
    origin: incoming.origin || existing.origin,
    destination: incoming.destination || existing.destination,
    estimatedDelivery: normalizeCarrierDate(rawEta) || rawEta,
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
    let res: TrackingResult | null = null;
    if (row && row.result_json) {
      res = JSON.parse(row.result_json) as TrackingResult;
    } else {
      // Fallback: check shipments table if not yet in tracking_history_cache
      const shipStmt = db.prepare(`
        SELECT cached_result FROM shipments
        WHERE carrier = ? AND tracking_number = ? AND cached_result IS NOT NULL
        ORDER BY updated_at DESC LIMIT 1
      `);
      const shipRow = shipStmt.get(carrier.toLowerCase(), trackingNumber.trim()) as { cached_result: string } | undefined;
      if (shipRow && shipRow.cached_result) {
        res = JSON.parse(shipRow.cached_result) as TrackingResult;
      }
    }

    if (res && res.events && res.events.length > 0) {
      const sanitized = res.events.map((e) => sanitizeEventStatus(e, carrier));
      const processed = carryForwardStatus(sanitized);
      let computedStatus: ShipmentStatus = res.status;
      if (computedStatus !== "delivered" && computedStatus !== "returned") {
        computedStatus = overallStatus(processed, res.status);
      }
      return {
        ...res,
        status: computedStatus,
        events: processed,
      };
    }
    return res;
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
  let merged = mergeTrackingResults(existingShipmentResult, incoming, carrier);
  merged = mergeTrackingResults(cached, merged, carrier);

  // Persist updated cumulative history
  saveHistoryCache(carrier, trackingNumber, merged);

  return merged;
}
