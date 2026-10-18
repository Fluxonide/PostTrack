import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";

const VALMO_API_BASE = "https://www.valmo.in/api/valmo-web/track-order";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface ValmoSubStatus {
  status: string;
  date: number;
  display_name: string;
  is_complete?: boolean;
  is_current?: boolean;
}

interface ValmoTrackingStep {
  status: string;
  date: number;
  movement_type?: string;
  display_name: string;
  is_complete?: boolean;
  is_current?: boolean;
  sub_status_list?: ValmoSubStatus[];
}

interface ValmoTimelineMilestone {
  status: string;
  date?: number;
  display_name: string;
  is_complete?: boolean;
  is_current?: boolean;
}

interface ValmoMainStatus {
  status: string;
  description: string;
  display_name: string;
}

interface ValmoResponse {
  success: boolean;
  shipment_type?: string;
  request_id?: string;
  tracking_id?: string;
  main_status?: ValmoMainStatus;
  timeline?: ValmoTimelineMilestone[];
  tracking?: ValmoTrackingStep[];
  error?: string;
  message?: string;
}

function mapStatus(statusStr: string): ShipmentStatus {
  const s = statusStr.trim().toUpperCase();
  if (
    s.includes("DELIVERED") &&
    !s.includes("UNDELIVERED") &&
    !s.includes("NOT DELIVERED") &&
    !s.includes("FAILED") &&
    !s.includes("RETURN") &&
    !s.includes("RTO") &&
    !s.includes("ATTEMPT")
  ) {
    return "delivered";
  }
  if (s.includes("OUT_FOR_DELIVERY") || s.includes("OFD")) return "out_for_delivery";
  if (s.includes("RTO") || s.includes("RETURN")) return "returned";
  if (
    s.includes("CANCEL") ||
    s.includes("FAILED") ||
    s.includes("UNDELIVERED") ||
    s.includes("NOT DELIVERED") ||
    s.includes("DELAY") ||
    s.includes("EXCEPTION") ||
    s.includes("LOST") ||
    s.includes("HOLD")
  ) {
    return "exception";
  }
  if (s.includes("PICKED") || s.includes("PICKUP") || s.includes("PICK_UP")) return "picked_up";
  if (s.includes("HUB") || s.includes("TRANSIT") || s.includes("CONFIRMED") || s.includes("DISPATCH") || s.includes("WAY") || s.includes("ARRIVED")) {
    return "in_transit";
  }
  if (s.includes("PLACED") || s.includes("CREATED") || s.includes("MANIFEST")) return "pending";
  return "unknown";
}

function extractLocation(displayName: string): string | undefined {
  const m = displayName.match(/(?:at|Reached|Left)\s+([^,]+?)(?:\s+hub|\s+center|\s+facility|$)/i);
  if (m && m[1]) {
    const loc = m[1].trim();
    if (loc.length > 2 && !/order|partner|shipment/i.test(loc)) {
      return loc;
    }
  }
  return undefined;
}

export const valmo: Carrier = {
  id: "valmo",
  name: "Valmo",
  website: "https://www.valmo.in",
  sampleTracking: "VL0085746010404",
  description: "Meesho's in-house tech-driven logistics and delivery network across India.",

  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim().toUpperCase();
    if (!cleaned) {
      throw new CarrierError("Tracking number is required.", "invalid_input", 400);
    }

    const reqId = Date.now().toString();
    const targetUrl = `${VALMO_API_BASE}?request_id=${encodeURIComponent(reqId)}&tracking_id=${encodeURIComponent(cleaned)}`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        Referer: "https://www.valmo.in/",
      },
    });

    if (res.status === 429) {
      throw new CarrierError("Valmo rate-limited.", "rate_limited", 429);
    }

    const text = await res.text();
    let data: ValmoResponse;
    try {
      data = JSON.parse(text);
    } catch {
      throw new CarrierError(`Valmo returned non-JSON response (${res.status})`, "upstream_error", 502);
    }

    if (!res.ok || data.success === false) {
      const errMsg = data.error || data.message || `No tracking information found for Valmo ID "${cleaned}".`;
      throw new CarrierError(errMsg, "not_found", 404);
    }

    // Unpack tracking events (chronological order)
    const rawEvents: TrackingEvent[] = [];
    let detectedOrigin: string | undefined;
    let detectedDestination: string | undefined;

    if (data.tracking && Array.isArray(data.tracking)) {
      for (const step of data.tracking) {
        if (step.sub_status_list && step.sub_status_list.length > 0) {
          for (const sub of step.sub_status_list) {
            const loc = extractLocation(sub.display_name);
            if (loc && !detectedOrigin) detectedOrigin = loc;
            if (loc) detectedDestination = loc;

            rawEvents.push({
              timestamp: sub.date ? new Date(sub.date).toISOString() : "",
              status: mapStatus(sub.status || sub.display_name),
              location: loc,
              description: sub.display_name || sub.status,
              rawCode: sub.status,
            });
          }
        } else {
          const loc = extractLocation(step.display_name);
          if (loc && !detectedOrigin) detectedOrigin = loc;
          if (loc) detectedDestination = loc;

          rawEvents.push({
            timestamp: step.date ? new Date(step.date).toISOString() : "",
            status: mapStatus(step.status || step.display_name),
            location: loc,
            description: step.display_name || step.status,
            rawCode: step.status,
          });
        }
      }
    }

    // Fallback if no sub-status events are available
    if (rawEvents.length === 0 && data.main_status) {
      rawEvents.push({
        timestamp: new Date().toISOString(),
        status: mapStatus(data.main_status.status || data.main_status.description),
        description: data.main_status.description || data.main_status.display_name,
        rawCode: data.main_status.status,
      });
    }

    const events = carryForwardStatus(rawEvents);
    const mainStatusMapped = data.main_status?.status ? mapStatus(data.main_status.status) : undefined;
    const finalStatus = overallStatus(events, mainStatusMapped);

    // Parse estimated delivery from main_status display_name (e.g. "Delivery by Tue, 20 Oct")
    let estimatedDelivery: string | undefined;
    if (data.main_status?.display_name && /Delivery by/i.test(data.main_status.display_name)) {
      estimatedDelivery = data.main_status.display_name.replace(/Delivery by\s*/i, "").trim();
    }

    return {
      carrier: "valmo",
      carrierName: "Valmo (Meesho)",
      trackingNumber: data.tracking_id || cleaned,
      status: finalStatus,
      origin: detectedOrigin,
      destination: detectedDestination,
      estimatedDelivery,
      events,
      fetchedAt: new Date().toISOString(),
      raw: data,
    };
  },
};
