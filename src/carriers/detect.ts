export const AUTO_CARRIER = "auto";

const CANDIDATES: { id: string; pattern: RegExp; skipInAuto?: boolean }[] = [
  // Four letters + ten digits: Ekart / Flipkart (e.g. "FMPP4307095480")
  { id: "ekart", pattern: /^[A-Z]{4}[0-9]{10}$/i },
  // Letter prefix + digits: TPC consignment numbers (e.g. "CHE123456789")
  { id: "tpc", pattern: /^[A-Z]{2,5}[0-9]{4,15}$/i },
  // Digit-only shapes, most-specific length ranges first
  { id: "amazon", pattern: /^[0-9]{10,18}$/ },
  // XpressBees (13-15 digits, typically starting with 14 or 1)
  { id: "xpressbees", pattern: /^14[0-9]{11,13}$/ },
  // Delhivery (11-14 digits)
  { id: "delhivery", pattern: /^[0-9]{11,14}$/ },
  // XpressBees generic (13-15 digits)
  { id: "xpressbees", pattern: /^[0-9]{13,15}$/ },
  // Blue Dart (numeric, 6 to 20 digits)
  { id: "bluedart", pattern: /^[0-9]{6,20}$/ },
  // ST Courier (numeric, 6 to 11 digits)
  { id: "stcourier", pattern: /^[0-9]{6,11}$/ },
  // Shiprocket (alphanumeric AWB)
  { id: "shiprocket", pattern: /^[A-Za-z0-9-]{6,30}$/ },
];

export function detectCarriers(trackingNumber: string): string[] {
  const id = trackingNumber.trim();
  if (!id) return [];
  const matches = CANDIDATES.filter((c) => !c.skipInAuto && c.pattern.test(id)).map((c) => c.id);
  return Array.from(new Set(matches));
}
