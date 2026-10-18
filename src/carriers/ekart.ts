import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";

const BASE = "https://www.ekartlogistics.com";
const PAGE_URL = `${BASE}/ekartlogistics-web/shipmenttrack`;
const API_URL = `${BASE}/ekartlogistics-web-routes-api/ekartlogistics-web-proxy/trackings/v2`;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function mapStatus(text: string): ShipmentStatus {
  const t = text.toLowerCase();
  if (t.includes("rto") || t.includes("return")) return "returned";
  if (
    t.includes("undelivered") ||
    t.includes("not delivered") ||
    t.includes("attempt") ||
    t.includes("refused") ||
    t.includes("rejected") ||
    t.includes("delay") ||
    t.includes("delayed") ||
    t.includes("cancel") ||
    t.includes("lost") ||
    t.includes("damage") ||
    t.includes("hold")
  ) {
    return "exception";
  }
  if (t.includes("out for delivery")) return "out_for_delivery";
  if (t.includes("delivered") && !t.includes("undelivered") && !t.includes("not delivered")) return "delivered";
  if (t.includes("pickup") || t.includes("picked")) return "picked_up";
  if (
    t.includes("received") ||
    t.includes("dispatched") ||
    t.includes("in transit") ||
    t.includes("arrived") ||
    t.includes("reached") ||
    t.includes("hub")
  ) {
    return "in_transit";
  }
  if (t.includes("created") || t.includes("manifest")) return "pending";
  return "unknown";
}

function toIso(ms: number | undefined): string | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms).toISOString();
}

function titleCase(s: string | undefined): string | undefined {
  const v = s?.trim();
  if (!v) return undefined;
  return v.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function sessionCookies(res: Response): string | undefined {
  const raw: string[] = res.headers.getSetCookie?.() ?? [];
  const headers = raw.length ? raw : (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
  const pairs = headers
    .map((h) => h.split(";")[0].trim())
    .filter((p) => /^session(\.sig)?=/.test(p));
  return pairs.length ? pairs.join("; ") : undefined;
}

interface EkartScan {
  date?: number;
  city?: string;
  statusDetails?: string;
}

interface EkartShipment {
  expectedDeliveryDate?: number;
  sourceCity?: string;
  destinationCity?: string;
  faShipment?: boolean;
  reachedNearestHub?: boolean;
  shipmentTrackingDetails?: EkartScan[];
}

function parseEvents(scans: EkartScan[] | undefined): TrackingEvent[] {
  if (!Array.isArray(scans)) return [];
  const events: TrackingEvent[] = [];
  for (const s of scans) {
    const description = (s.statusDetails ?? "").trim();
    if (!description) continue;
    events.push({
      timestamp: toIso(s.date) ?? "",
      status: mapStatus(description),
      location: titleCase(s.city),
      description,
    });
  }
  return carryForwardStatus(events);
}

export const ekart: Carrier = {
  id: "ekart",
  name: "Ekart (Flipkart)",
  website: "https://ekartlogistics.com",
  sampleTracking: "FMPP4307095480",
  description: "Flipkart's dedicated in-house logistics and supply chain arm.",
  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim().toUpperCase();
    if (!/^[A-Z]{2,6}[0-9]{6,14}$/.test(cleaned)) {
      throw new CarrierError("Invalid Ekart tracking ID format.", "invalid_input", 400);
    }

    const pageUrl = `${PAGE_URL}/${encodeURIComponent(cleaned)}`;
    const pageRes = await fetch(pageUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });
    if (pageRes.status === 429) throw new CarrierError("Ekart rate-limited", "rate_limited", 429);
    if (!pageRes.ok) throw new CarrierError(`Ekart upstream error (${pageRes.status})`, "upstream_error", 502);

    const html = await pageRes.text();
    const token = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/i)?.[1];
    const cookies = sessionCookies(pageRes);
    if (!token || !cookies) {
      throw new CarrierError("Ekart did not issue a tracking session.", "upstream_error", 502);
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "X-User-Agent": `${UA} EKCL/website/1`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "csrf-token": token,
        Cookie: cookies,
        Origin: BASE,
        Referer: pageUrl,
      },
      body: JSON.stringify({ tracking_ids: cleaned }),
      cache: "no-store",
    });

    if (res.status === 429) throw new CarrierError("Ekart rate-limited", "rate_limited", 429);
    if (!res.ok) throw new CarrierError(`Ekart upstream error (${res.status})`, "upstream_error", 502);

    const data = (await res.json().catch(() => null)) as
      | (Record<string, EkartShipment> & { csrfError?: unknown })
      | null;
    if (!data) throw new CarrierError("Ekart returned an unreadable response.", "upstream_error", 502);
    if (data.csrfError) throw new CarrierError("Ekart rejected the tracking session.", "upstream_error", 502);

    const shipment = data[cleaned];
    if (!shipment) throw new CarrierError("Tracking number not found", "not_found", 404);

    const events = parseEvents(shipment.shipmentTrackingDetails);
    const status = overallStatus(events);
    if (!events.length && status === "unknown") {
      throw new CarrierError("Tracking number not found", "not_found", 404);
    }

    return {
      carrier: "ekart",
      carrierName: "Ekart (Flipkart)",
      trackingNumber: cleaned,
      status,
      estimatedDelivery: toIso(shipment.expectedDeliveryDate),
      origin: titleCase(shipment.sourceCity),
      destination: titleCase(shipment.destinationCity),
      events,
      fetchedAt: new Date().toISOString(),
      raw: {
        source: "ekartlogistics.com",
        faShipment: shipment.faShipment ?? null,
        reachedNearestHub: shipment.reachedNearestHub ?? null,
      },
    };
  },
};
