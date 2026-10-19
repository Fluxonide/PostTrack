import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";
import { normalizeCarrierDate } from "../lib/dates";

const FEED_URL = "https://www.tpcindia.com/TPCWebService/TrackMobDe.ashx";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mapStatus(text: string): ShipmentStatus {
  const t = text.toLowerCase();
  if (t.includes("delivered") && !t.includes("undelivered") && !t.includes("not delivered")) return "delivered";
  if (t.includes("out for delivery") || t.includes("out for del")) return "out_for_delivery";
  if (t.includes("rto") || t.includes("returned") || t.includes("return to")) return "returned";
  if (
    t.includes("undelivered") ||
    t.includes("not delivered") ||
    t.includes("refused") ||
    t.includes("damage") ||
    t.includes("delay") ||
    t.includes("delayed") ||
    t.includes("hold") ||
    t.includes("address") ||
    t.includes("closed") ||
    t.includes("unable") ||
    t.includes("missed") ||
    t.includes("unclaimed")
  ) {
    return "exception";
  }
  if (t.includes("booked") || t.includes("picked") || t.includes("pickup") || t.includes("pick up")) return "picked_up";
  if (
    t.includes("despatch") ||
    t.includes("dispatch") ||
    t.includes("received") ||
    t.includes("transit") ||
    t.includes("forward") ||
    t.includes("arrived") ||
    t.includes("departed") ||
    t.includes("bagged") ||
    t.includes("connected")
  ) {
    return "in_transit";
  }
  return "unknown";
}

function parseWhen(date: string, time: string | undefined): { display: string; epoch: number } {
  const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { display: [date, time].filter(Boolean).join(" "), epoch: NaN };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const [hh = 0, mm = 0, ss = 0] = (time ?? "").split(":").map((n) => Number(n));
  const epoch = Date.UTC(year, month - 1, day, hh, mm, ss) - 5.5 * 60 * 60 * 1000;
  const display = `${String(day).padStart(2, "0")} ${MONTHS[month - 1] ?? m[2]} ${year}${time ? ` ${time}` : ""}`;
  return { display, epoch };
}

function parseFeed(text: string): TrackingEvent[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !/^Forwarding Details\s*:?\s*$/i.test(b));

  const scans: { event: TrackingEvent; time: number }[] = [];
  for (const block of blocks) {
    const flat = block.replace(/\s+/g, " ");
    const date = flat.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1];
    const time = flat.match(/\bTime\s*:\s*(\d{1,2}:\d{2}(?::\d{2})?)/i)?.[1];
    const city = flat.match(/\bCity\s*:\s*(.*?)\s*(?:\bWayNo\s*:|\bActivity\s*:|$)/i)?.[1]?.trim();
    const activity = flat.match(/\bActivity\s*:\s*(.*?)\s*(?:\bPieces\s*:|\bWeight\s*:|$)/i)?.[1]?.trim();
    if (!activity) continue;

    const when = date ? parseWhen(date, time) : { display: "", epoch: NaN };
    const isoTimestamp = Number.isFinite(when.epoch)
      ? new Date(when.epoch).toISOString()
      : normalizeCarrierDate(when.display) || when.display;
    scans.push({
      time: when.epoch,
      event: {
        timestamp: isoTimestamp,
        status: mapStatus(activity),
        location: city || undefined,
        description: activity,
      },
    });
  }

  const seen = new Set<string>();
  const unique = scans.filter(({ event }) => {
    const key = `${event.timestamp}|${event.description}|${event.location ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.reverse();
  if (unique.every((s) => Number.isFinite(s.time))) {
    unique.sort((a, b) => a.time - b.time);
  }
  return carryForwardStatus(unique.map((s) => s.event));
}

export const tpc: Carrier = {
  id: "tpc",
  name: "The Professional Couriers",
  website: "https://www.tpcindia.com",
  sampleTracking: "PON8334106",
  description: "One of India's largest domestic courier and express cargo companies.",
  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(cleaned)) {
      throw new CarrierError("Invalid Professional Couriers consignment number format.", "invalid_input", 400);
    }

    const url = `${FEED_URL}?podno=${encodeURIComponent(cleaned)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/plain, */*" },
      cache: "no-store",
    });

    if (res.status === 429) throw new CarrierError("Professional Couriers rate-limited", "rate_limited", 429);
    if (!res.ok) {
      throw new CarrierError(`Professional Couriers upstream error (${res.status})`, "upstream_error", 502);
    }

    const text = await res.text();
    if (!/Forwarding Details/i.test(text)) {
      throw new CarrierError("Unexpected Professional Couriers response.", "upstream_error", 502);
    }

    const events = parseFeed(text);
    if (events.length === 0) {
      throw new CarrierError("Tracking number not found", "not_found", 404);
    }
    return {
      carrier: "tpc",
      carrierName: "The Professional Couriers",
      trackingNumber: cleaned,
      status: overallStatus(events),
      events,
      fetchedAt: new Date().toISOString(),
      raw: { source: "mobile-feed", url },
    };
  },
};
