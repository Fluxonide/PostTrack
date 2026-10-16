import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus, stripTags } from "./normalize";

const CHECK_URL = "https://stcourier.com/track/doCheck";
const RESULT_URL = "https://stcourier.com/track/shipment";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function mapStatus(text: string): ShipmentStatus {
  const t = text.toLowerCase();
  if (t.includes("delivered")) return "delivered";
  if (t.includes("out for delivery")) return "out_for_delivery";
  if (t.includes("returned") || t.includes("rto")) return "returned";
  if (t.includes("undelivered") || t.includes("hold") || t.includes("attempt") || t.includes("missed")) return "exception";
  if (t.includes("picked up") || t.includes("booked")) return "picked_up";
  if (t.includes("in transit") || t.includes("forwarded") || t.includes("dispatched") || t.includes("received")) return "in_transit";
  return "unknown";
}

function parseEvents(html: string): TrackingEvent[] {
  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return [];

  const rows = table[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  const events: TrackingEvent[] = [];

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => stripTags(m[1]));
    if (cells.length < 3) continue;
    const [dateStr, location, description] = cells;
    if (!description || description.toLowerCase().includes("status")) continue;
    events.push({
      timestamp: dateStr.trim(),
      status: mapStatus(description),
      location: location || undefined,
      description,
    });
  }

  return carryForwardStatus(events.reverse());
}

export const stcourier: Carrier = {
  id: "stcourier",
  name: "ST Courier",
  website: "https://stcourier.com",
  sampleTracking: "10987654321",
  description: "Prominent courier network catering extensively to South India.",
  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim();
    if (!/^[0-9]{6,12}$/.test(cleaned)) {
      throw new CarrierError("Invalid ST Courier AWB format.", "invalid_input", 400);
    }

    const checkRes = await fetch(CHECK_URL, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `awb_no=${encodeURIComponent(cleaned)}`,
      cache: "no-store",
    });

    const cookieHeader = checkRes.headers.get("set-cookie");
    if (!cookieHeader) {
      throw new CarrierError("Could not initialize ST Courier session", "upstream_error", 502);
    }
    const sessionCookie = cookieHeader.split(";")[0];

    const resultRes = await fetch(RESULT_URL, {
      method: "GET",
      headers: {
        "User-Agent": UA,
        Cookie: sessionCookie,
      },
      cache: "no-store",
    });

    if (!resultRes.ok) throw new CarrierError("ST Courier tracking request failed", "upstream_error", 502);

    const html = await resultRes.text();
    if (!html.includes("Status of AWB") && !html.includes("AWB No")) {
      throw new CarrierError("Tracking number not found", "not_found", 404);
    }

    const events = parseEvents(html);
    return {
      carrier: "stcourier",
      carrierName: "ST Courier",
      trackingNumber: cleaned,
      status: overallStatus(events),
      events,
      fetchedAt: new Date().toISOString(),
      raw: { source: "stcourier.com" },
    };
  },
};
