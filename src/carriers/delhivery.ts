import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult, TrackOptions } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";

const TRACK_URL = "https://track.delhivery.com/api/v1/packages/json/";
const PUBLIC_URL = "https://dlv-api.delhivery.com/v3/unified-tracking";
const PUBLIC_ORIGIN = "https://www.delhivery.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function mapStatus(type?: string, text?: string): ShipmentStatus {
  const t = (type || "").toUpperCase();
  const s = (text || "").toLowerCase();

  if (t === "DL" || s.includes("delivered") || s.includes("successful delivery")) return "delivered";
  if (t === "RT" || t === "RTO" || s.includes("returned") || s.includes("return to origin") || s.includes("rto")) return "returned";
  if (t === "UD" || s.includes("undelivered") || s.includes("failed delivery") || s.includes("attempted")) return "exception";
  if (t === "OO" || s.includes("out for delivery") || s.includes("dispatched for delivery")) return "out_for_delivery";
  if (t === "IT" || s.includes("in transit") || s.includes("reached") || s.includes("connected") || s.includes("manifest")) return "in_transit";
  if (t === "PP" || t === "PU" || s.includes("picked up") || s.includes("pickup done")) return "picked_up";
  if (t === "UD" || s.includes("delayed") || s.includes("hold") || s.includes("address")) return "exception";
  if (s.includes("order placed") || s.includes("created")) return "pending";

  return "unknown";
}

interface PublicScan {
  scanDate?: string;
  scanDateTime?: string;
  scanNslRemark?: string;
  cityLocation?: string;
  scanType?: string;
  scan?: string;
  scannedLocation?: string;
}

interface PublicState {
  label?: string;
  date?: string;
  scanDateTime?: string;
  scans?: PublicScan[];
}

interface PublicShipment {
  awb?: string;
  status?: { status?: string; statusDateTime?: string; statusType?: string; instructions?: string };
  trackingStates?: PublicState[];
  destination?: string;
  deliveryDate?: string;
  promiseDeliveryDate?: string;
}

function parsePublicEvents(d: PublicShipment): TrackingEvent[] {
  const events: TrackingEvent[] = [];

  for (const state of d.trackingStates ?? []) {
    for (const sc of state.scans ?? []) {
      const description = sc.scanNslRemark || sc.scan;
      if (!description) continue;
      events.push({
        timestamp: sc.scanDateTime || sc.scanDate || state.scanDateTime || state.date || "",
        status: mapStatus(sc.scanType, sc.scan),
        location: sc.scannedLocation || sc.cityLocation || undefined,
        description,
        rawCode: sc.scanType || undefined,
      });
    }
  }

  const st = d.status;
  const description = st?.instructions || st?.status;
  if (st?.statusDateTime && description) {
    const last = events[events.length - 1];
    if (last && last.description === description) {
      last.timestamp = st.statusDateTime;
    } else {
      events.push({
        timestamp: st.statusDateTime,
        status: mapStatus(st.statusType, st.status),
        description,
        rawCode: st.statusType || undefined,
      });
    }
  }

  return carryForwardStatus(events);
}

async function trackViaPublic(cleaned: string): Promise<TrackingResult> {
  const url = `${PUBLIC_URL}?wbn=${encodeURIComponent(cleaned)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Origin: PUBLIC_ORIGIN,
      Referer: `${PUBLIC_ORIGIN}/tracking`,
    },
    cache: "no-store",
  });

  if (res.status === 429) throw new CarrierError("Delhivery rate-limited", "rate_limited", 429);
  if (!res.ok && res.status !== 400) {
    throw new CarrierError(`Delhivery upstream error (${res.status})`, "upstream_error", 502);
  }

  const body = (await res.json().catch(() => null)) as
    | { statusCode?: number; message?: string; data?: PublicShipment[] }
    | null;

  if (!body) throw new CarrierError("Delhivery returned an unreadable response.", "upstream_error", 502);
  if (res.status === 400 || body.statusCode === 400) {
    throw new CarrierError("Tracking number not found", "not_found", 404);
  }

  const d = body.data?.[0];
  if (!d) throw new CarrierError("Tracking number not found", "not_found", 404);

  const events = parsePublicEvents(d);
  return {
    carrier: "delhivery",
    carrierName: "Delhivery",
    trackingNumber: cleaned,
    status: overallStatus(events, mapStatus(d.status?.statusType, d.status?.status)),
    estimatedDelivery: d.deliveryDate || d.promiseDeliveryDate || undefined,
    destination: d.destination || undefined,
    events,
    fetchedAt: new Date().toISOString(),
    raw: { source: "public", statusType: d.status?.statusType ?? null, message: body.message ?? null },
  };
}

export const delhivery: Carrier = {
  id: "delhivery",
  name: "Delhivery",
  website: "https://www.delhivery.com",
  sampleTracking: "1234567890123",
  description: "India's largest fully integrated logistics services provider.",
  async track(trackingNumber: string, _opts?: TrackOptions): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim();
    if (!/^[0-9]{8,20}$/.test(cleaned)) {
      throw new CarrierError("Invalid Delhivery waybill format.", "invalid_input", 400);
    }
    return trackViaPublic(cleaned);
  },
};
