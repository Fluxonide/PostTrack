import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult, TrackOptions } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";

const TRACK_URL = "https://track.delhivery.com/api/v1/packages/json/";
const PUBLIC_URL = "https://dlv-api.delhivery.com/v3/unified-tracking";
const PUBLIC_ORIGIN = "https://www.delhivery.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function mapStatus(type?: string, text?: string): ShipmentStatus {
  const t = (type || "").toUpperCase();
  const s = (text || "").toLowerCase();

  // 1. Returned / RTO
  if (
    t === "RT" ||
    t === "RTO" ||
    s.includes("returned") ||
    s.includes("return to origin") ||
    s.includes("rto") ||
    s.includes("return to sender")
  ) {
    return "returned";
  }

  // 2. Delivered (ensuring negative phrases like "not delivered" or "undelivered" don't match)
  if (
    t === "DL" ||
    s.includes("successful delivery") ||
    (s.includes("delivered") &&
      !s.includes("not delivered") &&
      !s.includes("undelivered") &&
      !s.includes("failed delivery") &&
      !s.includes("unsuccessful") &&
      !s.includes("return") &&
      !s.includes("rto") &&
      !s.includes("attempt"))
  ) {
    return "delivered";
  }

  // 3. Out for delivery
  if (
    t === "OO" ||
    s.includes("out for delivery") ||
    s.includes("dispatched for delivery") ||
    s.includes("out for del")
  ) {
    return "out_for_delivery";
  }

  // 4. Picked up
  if (
    t === "PP" ||
    t === "PU" ||
    s.includes("picked up") ||
    s.includes("pickup done") ||
    s.includes("pickup completed")
  ) {
    return "picked_up";
  }

  // 5. Clear exceptions / delays / failures
  if (
    s.includes("delayed") ||
    s.includes("delay") ||
    s.includes("undelivered") ||
    s.includes("failed delivery") ||
    s.includes("delivery failed") ||
    s.includes("not delivered") ||
    s.includes("unable to reach") ||
    s.includes("attempted") ||
    s.includes("customer not available") ||
    s.includes("consignee not available") ||
    s.includes("unreachable") ||
    s.includes("refused") ||
    s.includes("rejected") ||
    s.includes("hold") ||
    s.includes("held") ||
    s.includes("misrouted") ||
    s.includes("misroute") ||
    s.includes("damaged") ||
    s.includes("damage") ||
    s.includes("lost") ||
    s.includes("incorrect") ||
    s.includes("address incomplete") ||
    s.includes("cancelled") ||
    s.includes("canceled") ||
    s.includes("door step return")
  ) {
    return "exception";
  }

  // 6. Active transit movement scans
  if (
    t === "IT" ||
    t === "ST" ||
    s.includes("in transit") ||
    s.includes("in_transit") ||
    s.includes("intransit") ||
    s.includes("reached") ||
    s.includes("arrived") ||
    s.includes("connected") ||
    s.includes("manifest") ||
    s.includes("bag") ||
    s.includes("facility") ||
    s.includes("hub") ||
    s.includes("center") ||
    s.includes("centre") ||
    s.includes("vehicle") ||
    s.includes("weight") ||
    s.includes("captured") ||
    s.includes("left for") ||
    s.includes("departed") ||
    s.includes("dispatched") ||
    s.includes("sorted") ||
    s.includes("forwarded") ||
    s.includes("received") ||
    s.includes("scanned") ||
    s.includes("inscan")
  ) {
    return "in_transit";
  }

  // 7. Order creation / pending
  if (
    s.includes("order placed") ||
    s.includes("created") ||
    s.includes("manifested") ||
    s.includes("label created") ||
    s.includes("data received")
  ) {
    return "pending";
  }

  // 8. Fallback on scan type code if no movement keywords matched
  if (t === "UD") return "exception";
  if (t === "IT" || t === "ST") return "in_transit";

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
  hqStatus?: string;
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
      const combinedText = [sc.scan, sc.scanNslRemark].filter(Boolean).join(" - ");
      const timestamp = sc.scanDateTime || sc.scanDate || state.scanDateTime || state.date || d.status?.statusDateTime || "";
      events.push({
        timestamp,
        status: mapStatus(sc.scanType, combinedText),
        location: sc.scannedLocation || sc.cityLocation || undefined,
        description,
        rawCode: sc.scanType || undefined,
      });
    }
  }

  const st = d.status;
  const description = st?.instructions || st?.status;
  if (st?.statusDateTime && description) {
    const combinedStatusText = [d.hqStatus, st.status, st.instructions].filter(Boolean).join(" - ");
    const last = events[events.length - 1];
    const latestKnownLoc = [...events].reverse().find((e) => e.location)?.location;

    if (last && last.description === description) {
      last.timestamp = st.statusDateTime;
      if (!last.location && latestKnownLoc) {
        last.location = latestKnownLoc;
      }
      last.status = mapStatus(st.statusType, combinedStatusText);
    } else {
      events.push({
        timestamp: st.statusDateTime,
        status: mapStatus(st.statusType, combinedStatusText),
        location: latestKnownLoc,
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
  const topStatusText = [d.hqStatus, d.status?.status, d.status?.instructions].filter(Boolean).join(" - ");
  const fallbackStatus = mapStatus(d.status?.statusType, topStatusText);

  return {
    carrier: "delhivery",
    carrierName: "Delhivery",
    trackingNumber: cleaned,
    status: overallStatus(events, fallbackStatus),
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
