const IST_OFFSET_MIN = 5 * 60 + 30;
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function fromIst(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  return Date.UTC(y, mo, d, h, mi, s) - IST_OFFSET_MIN * 60_000;
}

function applyMeridiem(h: number, ampm?: string): number {
  if (!ampm) return h;
  const p = ampm.toLowerCase();
  if (p === "pm" && h < 12) return h + 12;
  if (p === "am" && h === 12) return 0;
  return h;
}

const TIME = String.raw`(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?`;
// DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
const RE_DMY_NUM = new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})${TIME}$`, "i");
// DD-MMM-YYYY, DD MMM YYYY, DD MMM, YYYY
const RE_DMY_MON = new RegExp(String.raw`^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s,]+(\d{4})${TIME}$`, "i");
// MMM DD, YYYY (Amazon)
const RE_MDY_MON = new RegExp(String.raw`^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})${TIME}$`, "i");
// DD-MMM, DD MMM, Tue, 20 Oct (no year, e.g. Valmo ETA)
const RE_DM_MON = new RegExp(String.raw`^(?:[A-Za-z]+,?\s+)?(\d{1,2})[-\s]([A-Za-z]{3,4})${TIME}$`, "i");
// MMM DD, Tue, Oct 20 (no year)
const RE_MD_MON = new RegExp(String.raw`^(?:[A-Za-z]+,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})${TIME}$`, "i");
// YYYY-MM-DD HH:mm[:ss] (no zone)
const RE_YMD = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})${TIME}$`, "i");
// Full ISO with zone designator
const RE_ISO_ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
// ISO without zone
const RE_ISO_NAIVE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

export function parseCarrierDate(raw: string | number | Date | undefined | null): Date | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? new Date(raw) : null;

  let s = String(raw).trim().replace(/\s+/g, " ");
  s = s.replace(/^(?:delivery|expected|promised|arriving)\s+by\s+/i, "");
  if (!s) return null;

  // Epoch milliseconds string (e.g. "1792302670000")
  if (/^\d{11,14}$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return new Date(n);
  }

  let m: RegExpMatchArray | null;

  if (RE_ISO_ZONED.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  if ((m = s.match(RE_ISO_NAIVE))) {
    return new Date(fromIst(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0));
  }
  if ((m = s.match(RE_YMD))) {
    return new Date(fromIst(+m[1], +m[2] - 1, +m[3], applyMeridiem(+(m[4] ?? 0), m[7]), +(m[5] ?? 0), +(m[6] ?? 0)));
  }
  if ((m = s.match(RE_DMY_NUM))) {
    return new Date(fromIst(+m[3], +m[2] - 1, +m[1], applyMeridiem(+(m[4] ?? 0), m[7]), +(m[5] ?? 0), +(m[6] ?? 0)));
  }
  if ((m = s.match(RE_DMY_MON))) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo === undefined) return null;
    return new Date(fromIst(+m[3], mo, +m[1], applyMeridiem(+(m[4] ?? 0), m[7]), +(m[5] ?? 0), +(m[6] ?? 0)));
  }
  if ((m = s.match(RE_MDY_MON))) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo === undefined) return null;
    return new Date(fromIst(+m[3], mo, +m[2], applyMeridiem(+(m[4] ?? 0), m[7]), +(m[5] ?? 0), +(m[6] ?? 0)));
  }
  if ((m = s.match(RE_DM_MON))) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 4)] ?? MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo === undefined) return null;
    const year = new Date().getFullYear();
    return new Date(fromIst(year, mo, +m[1], applyMeridiem(+(m[3] ?? 0), m[6]), +(m[4] ?? 0), +(m[5] ?? 0)));
  }
  if ((m = s.match(RE_MD_MON))) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo === undefined) return null;
    const year = new Date().getFullYear();
    return new Date(fromIst(year, mo, +m[2], applyMeridiem(+(m[3] ?? 0), m[6]), +(m[4] ?? 0), +(m[5] ?? 0)));
  }

  const fallback = Date.parse(s);
  if (Number.isFinite(fallback)) return new Date(fallback);

  return null;
}

export function normalizeCarrierDate(raw: string | number | Date | undefined | null): string {
  const d = parseCarrierDate(raw);
  return d ? d.toISOString() : "";
}

export function formatCarrierDate(d: Date, withTime = true): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const month = m.month === "Sept" ? "Sep" : m.month;

  if (!withTime) {
    return `${month} ${m.day}, ${m.year}`;
  }

  const hour = m.hour === "24" ? "00" : m.hour;
  return `${month} ${m.day}, ${m.year} ${hour}:${m.minute}`;
}

export function relativeTime(d: Date, now: Date = new Date()): string {
  const diff = now.getTime() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const min = Math.round(abs / 60_000);
  let phrase: string;
  if (min < 1) phrase = "just now";
  else if (min < 60) phrase = `${min} min`;
  else if (min < 60 * 24) phrase = `${Math.round(min / 60)} h`;
  else if (min < 60 * 24 * 14) phrase = `${Math.round(min / (60 * 24))} d`;
  else phrase = `${Math.round(min / (60 * 24 * 7))} wk`;
  if (phrase === "just now") return phrase;
  return future ? `in ${phrase}` : `${phrase} ago`;
}

export function displayCarrierDate(raw: string | undefined | null): { text: string; date: Date | null } {
  const date = parseCarrierDate(raw);
  return { text: date ? formatCarrierDate(date, true) : (raw ?? "").trim(), date };
}

export function formatEventTime(raw: string | undefined | null): string {
  return displayCarrierDate(raw).text;
}

export function formatEta(raw: string | undefined | null): string {
  const d = parseCarrierDate(raw);
  return d ? formatCarrierDate(d, false) : (raw ?? "").trim();
}

