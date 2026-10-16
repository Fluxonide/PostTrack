import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus, stripTags } from "./normalize";

const TRACK_URL = "https://www.bluedart.com/trackdartresultthirdparty";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function mapStatus(text: string): ShipmentStatus {
  const t = text.toLowerCase();
  if (t.includes("delivered") && !t.includes("attempted") && !t.includes("undelivered")) return "delivered";
  if (t.includes("out for delivery")) return "out_for_delivery";
  if (t.includes("returned") || t.includes("rto")) return "returned";
  if (t.includes("picked up") || t.includes("pickup")) return "picked_up";
  if (
    t.includes("address incomplete") ||
    t.includes("premises closed") ||
    t.includes("undelivered") ||
    t.includes("attempt") ||
    t.includes("not available") ||
    t.includes("refused") ||
    t.includes("damaged") ||
    t.includes("held") ||
    t.includes("misroute") ||
    t.includes("unclaimed") ||
    t.includes("incorrect") ||
    t.includes("consignee") ||
    t.includes("cod not ready")
  ) {
    return "exception";
  }
  if (
    t.includes("in transit") ||
    t.includes("arrived") ||
    t.includes("connected") ||
    t.includes("shipped") ||
    t.includes("delay") ||
    t.includes("departed") ||
    t.includes("dispatched") ||
    t.includes("bagged") ||
    t.includes("forwarded") ||
    t.includes("received")
  ) {
    return "in_transit";
  }
  return "unknown";
}

function fieldByLabel(html: string, label: string): string | undefined {
  const re = new RegExp(
    `<th[^>]*>\\s*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
    "i",
  );
  const m = html.match(re);
  if (!m) return undefined;
  const v = stripTags(m[1]);
  return v.length ? v : undefined;
}

function parseScans(html: string): TrackingEvent[] {
  const scanSection = html.match(/Status and Scans[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!scanSection) return [];

  const rows = scanSection[1].match(/<tr>[\s\S]*?<\/tr>/gi) ?? [];
  const events: TrackingEvent[] = [];

  for (const row of rows) {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => stripTags(m[1]));
    if (cells.length < 4) continue;
    const [location, description, dateStr, timeStr] = cells;
    if (!description) continue;
    events.push({
      timestamp: `${dateStr} ${timeStr}`.trim(),
      status: mapStatus(description),
      location: location || undefined,
      description,
    });
  }

  return carryForwardStatus(events.reverse());
}

export const bluedart: Carrier = {
  id: "bluedart",
  name: "Blue Dart",
  website: "https://www.bluedart.com",
  sampleTracking: "42183920194",
  description: "Premier express air integrated transportation & distribution in India.",
  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim();
    if (!/^[0-9]{6,20}$/.test(cleaned)) {
      throw new CarrierError("Invalid Blue Dart tracking number format.", "invalid_input", 400);
    }

    const url = `${TRACK_URL}?trackFor=0&trackNo=${encodeURIComponent(cleaned)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });

    if (res.status === 429) throw new CarrierError("Blue Dart rate-limited", "rate_limited", 429);
    if (!res.ok) throw new CarrierError(`Blue Dart upstream error (${res.status})`, "upstream_error", 502);

    const html = await res.text();

    const panelRe = new RegExp(`id="${cleaned}-rdrmv"[\\s\\S]*?(?=<!--\\s*AWB${cleaned}\\s*-->|$)`, "i");
    const panelMatch = html.match(panelRe);
    if (!panelMatch || /Records Not Found/i.test(html)) {
      throw new CarrierError("Tracking number not found", "not_found", 404);
    }
    const panel = panelMatch[0];

    const status = fieldByLabel(panel, "Status");
    const expectedDelivery = fieldByLabel(panel, "Expected Date of Delivery");
    const origin = fieldByLabel(panel, "From");
    const destination = fieldByLabel(panel, "To");
    const events = parseScans(panel);

    return {
      carrier: "bluedart",
      carrierName: "Blue Dart",
      trackingNumber: cleaned,
      status: overallStatus(events, status ? mapStatus(status) : undefined),
      estimatedDelivery: expectedDelivery,
      origin,
      destination,
      events,
      fetchedAt: new Date().toISOString(),
      raw: { source: "scrape", url },
    };
  },
};
