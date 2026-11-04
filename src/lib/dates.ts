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

function istYmd(d: Date): { y: number; mo: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), mo: get("month") - 1, day: get("day") };
}

function shortIstDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
    day: "numeric",
  }).format(d);
}

function monthNumber(name: string | undefined): number | undefined {
  if (!name) return undefined;
  const key = name.toLowerCase();
  return MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)];
}

const DAY_PART = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const MONTH_PART = String.raw`([A-Za-z]{3,9})`;
// "10 - 17th", "10 Oct - 17 Oct", "10th-17th Nov"
const RANGE_DAYS_FIRST = new RegExp(
  String.raw`^${DAY_PART}(?:\s+${MONTH_PART})?\s*(?:-|–|—|to)\s*${DAY_PART}(?:\s+${MONTH_PART})?(?:,?\s*(\d{4}))?$`,
  "i"
);
// "Nov 10 - Nov 17", "Oct 10th - 17th"
const RANGE_MONTH_FIRST = new RegExp(
  String.raw`^${MONTH_PART}\s+${DAY_PART}\s*(?:-|–|—|to)\s*(?:${MONTH_PART}\s+)?${DAY_PART}(?:,?\s*(\d{4}))?$`,
  "i"
);

export interface EtaWindow {
  start: Date | null;
  end: Date;
}

/** Parse carrier ETAs that may be a single date or a delivery window (e.g. "10 - 17th"). */
export function parseEtaWindow(raw: string | null | undefined): EtaWindow | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^(?:estimated|expected|delivery|arriving|arrives|by|on)\s+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const today = istYmd(new Date());

  let m = cleaned.match(RANGE_DAYS_FIRST);
  if (m) {
    const year = m[5] ? Number(m[5]) : today.y;
    const startMonth = monthNumber(m[2]) ?? monthNumber(m[4]) ?? today.mo;
    const endMonth = monthNumber(m[4]) ?? startMonth;
    const start = new Date(fromIst(year, startMonth, Number(m[1])));
    let end = new Date(fromIst(year, endMonth, Number(m[3])));
    if (end.getTime() < start.getTime()) {
      end = new Date(fromIst(year + 1, endMonth, Number(m[3])));
    }
    return { start, end };
  }

  m = cleaned.match(RANGE_MONTH_FIRST);
  if (m) {
    const year = m[5] ? Number(m[5]) : today.y;
    const startMonth = monthNumber(m[1]) ?? today.mo;
    const endMonth = monthNumber(m[3]) ?? startMonth;
    const start = new Date(fromIst(year, startMonth, Number(m[2])));
    let end = new Date(fromIst(year, endMonth, Number(m[4])));
    if (end.getTime() < start.getTime()) {
      end = new Date(fromIst(year + 1, endMonth, Number(m[4])));
    }
    return { start, end };
  }

  const single = parseCarrierDate(cleaned);
  if (single) return { start: single, end: single };

  return null;
}

export interface EtaDisplay {
  rangeText: string;
  daysText: string | null;
  daysRemaining: number | null;
}

/** Human-readable ETA window plus the number of days remaining (negative when overdue). */
export function describeEta(raw: string | null | undefined, now: Date = new Date()): EtaDisplay | null {
  const window = parseEtaWindow(raw);
  if (!window) return null;

  const startParts = window.start ? istYmd(window.start) : null;
  const endParts = istYmd(window.end);
  const todayParts = istYmd(now);

  const isRange =
    startParts !== null &&
    Date.UTC(startParts.y, startParts.mo, startParts.day) !== Date.UTC(endParts.y, endParts.mo, endParts.day);

  const rangeText = isRange && window.start
    ? `${shortIstDate(window.start)} – ${shortIstDate(window.end)}`
    : shortIstDate(window.end);

  const daysRemaining = Math.round(
    (Date.UTC(endParts.y, endParts.mo, endParts.day) - Date.UTC(todayParts.y, todayParts.mo, todayParts.day)) /
      86_400_000
  );

  let daysText: string;
  if (daysRemaining > 1) daysText = `${daysRemaining} days left`;
  else if (daysRemaining === 1) daysText = "1 day left";
  else if (daysRemaining === 0) daysText = "Arrives today";
  else if (daysRemaining === -1) daysText = "1 day overdue";
  else daysText = `${Math.abs(daysRemaining)} days overdue`;

  return { rangeText, daysText, daysRemaining };
}

