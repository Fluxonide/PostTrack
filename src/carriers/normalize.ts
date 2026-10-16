import type { ShipmentStatus, TrackingEvent } from "./types";

export function carryForwardStatus(events: TrackingEvent[]): TrackingEvent[] {
  let known: ShipmentStatus | null = null;
  return events.map((ev) => {
    if (ev.status !== "unknown") {
      known = ev.status;
      return ev;
    }
    return known ? { ...ev, status: known } : ev;
  });
}

export function overallStatus(
  events: TrackingEvent[],
  ...fallbacks: (ShipmentStatus | undefined | null)[]
): ShipmentStatus {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].status !== "unknown") return events[i].status;
  }
  for (const f of fallbacks) {
    if (f && f !== "unknown") return f;
  }
  return "unknown";
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(?:([a-z]+)|#(\d+)|#x([0-9a-f]+));/gi, (m, name?: string, dec?: string, hex?: string) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? m;
    const cp = dec ? parseInt(dec, 10) : parseInt(hex!, 16);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
  });
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
