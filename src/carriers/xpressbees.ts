import { Carrier, CarrierError, ShipmentStatus, TrackingEvent, TrackingResult } from "./types";
import { carryForwardStatus, overallStatus } from "./normalize";

const XPRESSBEES_ORIGIN = "https://www.xpressbees.com";
const TRACKING_API_URL = `${XPRESSBEES_ORIGIN}/api/tracking`;
const DEFAULT_ALTCHA_CHALLENGE_URL = "https://altcha-api.xbees.in/v1/challenge";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber?: number;
  salt: string;
  signature: string;
}

export interface AltchaSolution {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

interface RawDomesticShipment {
  shippingId: string;
  origin?: string;
  destination?: string;
  status: string;
  shippingDate?: string;
  EDD?: string;
  orderType?: string;
}

interface RawTrackingSummaryResponse {
  domestic?: RawDomesticShipment[];
  international?: unknown[];
  message?: string;
}

interface RawTrackingHistoryItem {
  location?: string;
  shipmentDate?: string;
  isMilestone?: boolean;
  label: string;
}

interface RawTrackingHistoryResponse {
  orderId?: string;
  trackingId?: string;
  orderDate?: string | null;
  data?: RawTrackingHistoryItem[];
  message?: string;
}

/**
 * Fast synchronous SHA-256 implementation to solve Altcha proof-of-work
 * without requiring external npm packages or browser incompatibilities.
 */
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0, j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w: number[] = [];
    for (j = 0; j < 16; j++) w[j] = words[i + j] || 0;
    for (j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const byte = (hash[i] >> (j * 8)) & 255;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }

  return result;
}

function base64Encode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(str)));
}

async function solveAltcha(challengeData: AltchaChallenge): Promise<string> {
  const { algorithm, challenge, maxnumber = 100000, salt, signature } = challengeData;

  // Check if Node.js crypto is available for maximum speed
  let nodeHasher: ((s: string) => string) | null = null;
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const modName = "node:crypto";
      const cryptoMod = await import(/* @vite-ignore */ modName);
      nodeHasher = (s: string) => cryptoMod.createHash("sha256").update(s).digest("hex");
    } catch {
      // Fallback to internal sha256
    }
  }

  const hashFn = nodeHasher || sha256;

  for (let n = 0; n <= maxnumber; n++) {
    if (hashFn(salt + n) === challenge) {
      const solution: AltchaSolution = {
        algorithm,
        challenge,
        number: n,
        salt,
        signature,
      };
      return base64Encode(JSON.stringify(solution));
    }
  }

  throw new CarrierError(`Failed to solve Altcha proof-of-work challenge`, "upstream_error", 502);
}

async function getAltchaPayload(): Promise<string> {
  const res = await fetch(DEFAULT_ALTCHA_CHALLENGE_URL, {
    headers: {
      Accept: "application/json",
      Origin: XPRESSBEES_ORIGIN,
      Referer: `${XPRESSBEES_ORIGIN}/`,
      "User-Agent": UA,
    },
  });

  if (!res.ok) {
    throw new CarrierError(`Altcha challenge failed (${res.status})`, "upstream_error", 502);
  }

  const challenge: AltchaChallenge = await res.json();
  return await solveAltcha(challenge);
}

function mapStatus(text: string): ShipmentStatus {
  const s = text.trim().toLowerCase();
  if (
    (s.includes("delivered") || s === "dlvd") &&
    !s.includes("undelivered") &&
    !s.includes("not delivered") &&
    !s.includes("failed") &&
    !s.includes("return") &&
    !s.includes("rto") &&
    !s.includes("attempt")
  ) {
    return "delivered";
  }
  if (s.includes("outfordelivery") || s.includes("out for delivery") || s === "ofd") return "out_for_delivery";
  if (
    s.includes("rtodelivered") ||
    s.includes("rto delivered") ||
    s.includes("rtointransit") ||
    s.includes("rto in transit") ||
    s.includes("rto") ||
    s.includes("return")
  ) {
    return "returned";
  }
  if (
    s.includes("undelivered") ||
    s.includes("not delivered") ||
    s.includes("failed") ||
    s.includes("delay") ||
    s.includes("delayed") ||
    s.includes("cancel") ||
    s.includes("damaged") ||
    s.includes("exception") ||
    s.includes("lost") ||
    s.includes("held") ||
    s.includes("hold")
  ) {
    return "exception";
  }
  if (
    s.includes("pickdone") ||
    s.includes("picked up") ||
    s.includes("pickup done") ||
    s.includes("outforpickup") ||
    s.includes("out for pickup") ||
    s.includes("pick")
  ) {
    return "picked_up";
  }
  if (
    s.includes("intransit") ||
    s.includes("in transit") ||
    s.includes("destination") ||
    s.includes("reached") ||
    s.includes("hub") ||
    s.includes("dispatched") ||
    s.includes("arrived") ||
    s.includes("bagged")
  ) {
    return "in_transit";
  }
  if (
    s.includes("data received") ||
    s.includes("manifest") ||
    s.includes("created") ||
    s.includes("scheduled")
  ) {
    return "pending";
  }
  return "unknown";
}

export const xpressbees: Carrier = {
  id: "xpressbees",
  name: "XpressBees",
  website: "https://www.xpressbees.com",
  sampleTracking: "1412352002985",
  description: "Direct real-time tracking for XpressBees domestic logistics with Altcha PoW verification.",

  async track(trackingNumber: string): Promise<TrackingResult> {
    const cleaned = trackingNumber.trim();
    if (!cleaned) {
      throw new CarrierError("Tracking number is required.", "invalid_input", 400);
    }

    // 1. Solve Altcha challenge to bypass bot protection
    const altchaPayload = await getAltchaPayload();

    // 2. Query XpressBees summary endpoint
    const postBody = {
      awbNo: cleaned,
      altchaPayload,
    };

    const res = await fetch(TRACKING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: XPRESSBEES_ORIGIN,
        Referer: `${XPRESSBEES_ORIGIN}/shipment/tracking?awbNo=${encodeURIComponent(cleaned)}`,
        "User-Agent": UA,
      },
      body: JSON.stringify(postBody),
    });

    if (res.status === 429) {
      throw new CarrierError("XpressBees rate-limited.", "rate_limited", 429);
    }

    const responseText = await res.text();
    let summary: RawTrackingSummaryResponse;
    try {
      summary = JSON.parse(responseText);
    } catch {
      throw new CarrierError(`XpressBees returned non-JSON response (${res.status})`, "upstream_error", 502);
    }

    if (!res.ok) {
      throw new CarrierError(summary.message || `XpressBees tracking failed (${res.status})`, "not_found", 404);
    }

    const domestic = summary.domestic?.[0];
    if (!domestic && (!summary.international || summary.international.length === 0)) {
      throw new CarrierError(`No tracking details found for XpressBees AWB "${cleaned}".`, "not_found", 404);
    }

    const trackingId = domestic?.shippingId || cleaned;

    // 3. Fetch detailed history timeline
    let history: RawTrackingHistoryResponse | null = null;
    try {
      const historyRes = await fetch(`${TRACKING_API_URL}/${encodeURIComponent(trackingId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Origin: XPRESSBEES_ORIGIN,
          Referer: `${XPRESSBEES_ORIGIN}/shipment/tracking?awbNo=${encodeURIComponent(trackingId)}`,
          "User-Agent": UA,
        },
      });

      if (historyRes.ok) {
        history = await historyRes.json();
      }
    } catch {
      // Timeline history fetch is non-fatal; fallback to domestic summary
    }

    // 4. Construct events array
    const rawEvents: TrackingEvent[] = [];
    if (history?.data && Array.isArray(history.data)) {
      for (const item of history.data) {
        rawEvents.push({
          timestamp: item.shipmentDate || "",
          status: mapStatus(item.label),
          location: item.location || undefined,
          description: item.label || "Status update",
          rawCode: item.label,
        });
      }
    }

    if (rawEvents.length === 0 && domestic) {
      rawEvents.push({
        timestamp: domestic.shippingDate || "",
        status: mapStatus(domestic.status),
        location: domestic.origin || undefined,
        description: domestic.status || "Shipment recorded",
        rawCode: domestic.status,
      });
    }

    const events = carryForwardStatus(rawEvents);
    const calculatedStatus = domestic?.status ? mapStatus(domestic.status) : overallStatus(events);

    return {
      carrier: "xpressbees",
      carrierName: "XpressBees",
      trackingNumber: trackingId,
      status: calculatedStatus,
      origin: domestic?.origin || undefined,
      destination: domestic?.destination || undefined,
      estimatedDelivery: domestic?.EDD || undefined,
      events,
      fetchedAt: new Date().toISOString(),
      raw: {
        summary,
        history,
      },
    };
  },
};
