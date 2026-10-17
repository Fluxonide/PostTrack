export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  time?: string;
  statusText?: string;
  description?: string;
  isLatest?: boolean;
  isOrigin?: boolean;
  isDestination?: boolean;
  index: number;
}

// Built-in offline coordinates for major Indian logistics hubs and cities
const CITY_COORDINATES: Record<string, [number, number]> = {
  // Metros & Major Logistics Hubs
  delhi: [28.6139, 77.209],
  newdelhi: [28.6139, 77.209],
  ncr: [28.6139, 77.209],
  noida: [28.5355, 77.391],
  gurgaon: [28.4595, 77.0266],
  gurugram: [28.4595, 77.0266],
  faridabad: [28.4089, 77.3178],
  ghaziabad: [28.6692, 77.4538],

  mumbai: [19.076, 72.8777],
  bombay: [19.076, 72.8777],
  thane: [19.2183, 72.9781],
  navimumbai: [19.033, 73.0297],
  pune: [18.5204, 73.8567],
  nagpur: [21.1458, 79.0882],
  nashik: [19.9975, 73.7898],
  aurangabad: [19.8762, 75.3433],

  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mysore: [12.2958, 76.6394],
  mysuru: [12.2958, 76.6394],
  mangalore: [12.9141, 74.856],
  mangaluru: [12.9141, 74.856],
  hubli: [15.3647, 75.124],

  chennai: [13.0827, 80.2707],
  madras: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  madurai: [9.9252, 78.1198],
  tiruchirappalli: [10.7905, 78.7047],
  trichy: [10.7905, 78.7047],
  salem: [11.6643, 78.146],
  pondicherry: [11.9416, 79.8083],
  puducherry: [11.9416, 79.8083],

  hyderabad: [17.385, 78.4867],
  secunderabad: [17.4399, 78.4983],
  visakhapatnam: [17.6868, 83.2185],
  vizag: [17.6868, 83.2185],
  vijayawada: [16.5062, 80.648],
  guntur: [16.3067, 80.4365],

  kolkata: [22.5726, 88.3639],
  calcutta: [22.5726, 88.3639],
  howrah: [22.5958, 88.2636],
  siliguri: [26.7271, 88.3953],
  durgapur: [23.5204, 87.3119],
  asansol: [23.6739, 86.9524],

  ahmedabad: [23.0225, 72.5714],
  surat: [21.1702, 72.8311],
  vadodara: [22.3072, 73.1812],
  rajkot: [22.3039, 70.8022],

  jaipur: [26.9124, 75.7873],
  jodhpur: [26.2389, 73.0243],
  udaipur: [24.5854, 73.7125],
  kota: [25.2138, 75.8648],

  lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319],
  varanasi: [25.3176, 82.9739],
  agra: [27.1767, 78.0081],
  prayagraj: [25.4358, 81.8463],
  allahabad: [25.4358, 81.8463],
  meerut: [28.9845, 77.7064],
  bareilly: [28.367, 79.4304],

  bhopal: [23.2599, 77.4126],
  indore: [22.7196, 75.8577],
  gwalior: [26.2183, 78.1828],
  jabalpur: [23.1815, 79.9864],

  patna: [25.5941, 85.1376],
  gaya: [24.7955, 85.0002],
  muzaffarpur: [26.1226, 85.3906],

  bhubaneswar: [20.2961, 85.8245],
  cuttack: [20.4625, 85.8828],
  rourkela: [22.2604, 84.8536],

  chandigarh: [30.7333, 76.7794],
  ludhiana: [30.901, 75.8573],
  amritsar: [31.634, 74.8723],
  jalandhar: [31.326, 75.5762],

  dehradun: [30.3165, 78.0322],
  haridwar: [29.9457, 78.1642],
  shimla: [31.1048, 77.1734],

  kochi: [9.9312, 76.2673],
  cochin: [9.9312, 76.2673],
  thiruvananthapuram: [8.5241, 76.9366],
  trivandrum: [8.5241, 76.9366],
  kozhikode: [11.2588, 75.7804],
  calicut: [11.2588, 75.7804],
  thrissur: [10.5276, 76.2144],

  guwahati: [26.1445, 91.7362],
  ranchi: [23.3441, 85.3096],
  jamshedpur: [22.8046, 86.2029],
  raipur: [21.2514, 81.6296],
  goa: [15.2993, 74.124],
  panaji: [15.4909, 73.8278],

  // Sikkim & North-East
  sikkim: [27.533, 88.5122],
  gangtok: [27.3389, 88.6065],
  eastsikkim: [27.3389, 88.6065],
  westsikkim: [27.2762, 88.2562],
  northsikkim: [27.7025, 88.5833],
  southsikkim: [27.1667, 88.3667],
  namchi: [27.1667, 88.3667],
  gyalshing: [27.2762, 88.2562],
  mangan: [27.5058, 88.5336],
  pakyong: [27.2389, 88.5889],
  singtam: [27.2344, 88.4989],
  rangpo: [27.1764, 88.5322],
  darjeeling: [27.041, 88.2663],
  kalimpong: [27.0667, 88.4667],
  jalpaiguri: [26.5407, 88.7194],
  shillong: [25.5788, 91.8933],
  agartala: [23.8315, 91.2868],
  imphal: [24.817, 93.9368],
  aizawl: [23.7271, 92.7176],
  kohima: [25.6751, 94.1086],
  dimapur: [25.9095, 93.7266],
  itanagar: [27.0844, 93.6053],

  // J&K / Ladakh / Himachal
  srinagar: [34.0837, 74.7973],
  jammu: [32.7266, 74.857],
  leh: [34.1526, 77.5771],
};

// Common logistics hub abbreviation codes
const HUB_CODE_MAP: Record<string, string> = {
  blr: "bengaluru",
  bom: "mumbai",
  del: "delhi",
  maa: "chennai",
  csk: "chennai",
  ccu: "kolkata",
  hyd: "hyderabad",
  pnq: "pune",
  amd: "ahmedabad",
  vln: "pondicherry",
  vlr: "vellore",
  cok: "kochi",
  gau: "guwahati",
  jai: "jaipur",
  lko: "lucknow",
  pat: "patna",
  bbi: "bhubaneswar",
  ixc: "chandigarh",
  slg: "siliguri",
  gto: "gangtok",
};

// Memory cache for runtime geocoding
const geocodeCache = new Map<string, [number, number] | null>();

export function normalizeCityName(raw: string): string {
  if (!raw) return "";
  let clean = raw.toLowerCase().trim();

  // Replace common punctuation, parentheses, underscores and delimiters with spaces
  clean = clean.replace(/[_/\\,()\-–]/g, " ");

  // Strip logistics buzzwords only as full whole words
  clean = clean.replace(
    /\b(hub|motherhub|branch|facility|sorting|center|centre|gateway|station|office|pl|dc|gw|wh|spc|ipc)\b/gi,
    " "
  );
  clean = clean.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // 1. Check 3-letter hub codes (e.g. BLR, CSK, BOM, SLG)
  for (const t of tokens) {
    if (HUB_CODE_MAP[t]) {
      return HUB_CODE_MAP[t];
    }
  }

  // 2. Check complete joined phrase first (e.g. "eastsikkim", "navimumbai", "newdelhi")
  const joined = tokens.join("");
  if (CITY_COORDINATES[joined]) {
    return joined;
  }

  // 3. Check adjacent 2-word combinations (e.g. "east sikkim", "navi mumbai", "south goa")
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = tokens[i] + tokens[i + 1];
    if (CITY_COORDINATES[pair]) {
      return pair;
    }
  }

  // 4. Check individual tokens in CITY_COORDINATES, skipping standalone directional adjectives
  const DIRECTIONAL = new Set(["north", "south", "east", "west", "central", "upper", "lower"]);
  for (const t of tokens) {
    if (!DIRECTIONAL.has(t) && CITY_COORDINATES[t]) {
      return t;
    }
  }

  // 5. Return full cleaned multi-word name for geocoder; never truncate to a lone ambiguous word
  return tokens.join(" ");
}

export function getOfflineCoordinates(cityName: string): [number, number] | null {
  const norm = normalizeCityName(cityName);
  if (CITY_COORDINATES[norm]) {
    return CITY_COORDINATES[norm];
  }
  return null;
}

export async function resolveCoordinates(cityName: string): Promise<[number, number] | null> {
  if (!cityName || !cityName.trim()) return null;

  // 1. Check offline dictionary for top 60 major Indian logistics hubs (instant 0ms)
  const offline = getOfflineCoordinates(cityName);
  if (offline) return offline;

  // 2. Check memory cache
  const cacheKey = cityName.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  // 3. Dynamic lookup for ANY city, district, town, or postal code via SQLite-backed geocode API
  try {
    const clean = normalizeCityName(cityName) || cityName.trim();
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = (await res.json()) as { lat: number; lng: number };
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        const coords: [number, number] = [data.lat, data.lng];
        geocodeCache.set(cacheKey, coords);
        return coords;
      }
    }
  } catch {
    // Ignore network error on geocoding
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

export async function extractJourneyPoints(params: {
  origin?: string;
  destination?: string;
  events?: Array<{
    timestamp?: string;
    location?: string;
    description?: string;
    statusText?: string;
    status?: string;
  }>;
}): Promise<MapPoint[]> {
  const points: MapPoint[] = [];
  const seenLocations = new Set<string>();

  // 1. Process Origin
  if (params.origin) {
    const coords = await resolveCoordinates(params.origin);
    if (coords) {
      const normKey = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}`;
      seenLocations.add(normKey);
      points.push({
        name: params.origin,
        lat: coords[0],
        lng: coords[1],
        statusText: "Origin Hub",
        description: `Package received at ${params.origin}`,
        isOrigin: true,
        index: 0,
      });
    }
  }

  // 2. Process Events in chronological order (oldest to newest)
  if (params.events && params.events.length > 0) {
    // Clone events; if descending (newest first), reverse them so journey flows in sequence
    const chronologicalEvents = [...params.events];
    // Check if events are descending by comparing timestamps if available
    if (
      chronologicalEvents.length > 1 &&
      chronologicalEvents[0].timestamp &&
      chronologicalEvents[chronologicalEvents.length - 1].timestamp &&
      new Date(chronologicalEvents[0].timestamp) > new Date(chronologicalEvents[chronologicalEvents.length - 1].timestamp)
    ) {
      chronologicalEvents.reverse();
    }

    for (let i = 0; i < chronologicalEvents.length; i++) {
      const ev = chronologicalEvents[i];
      if (!ev.location) continue;

      const coords = await resolveCoordinates(ev.location);
      if (!coords) continue;

      const normKey = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}`;
      // Allow location if it's the latest event or not duplicate of immediately previous
      const isLatest = i === chronologicalEvents.length - 1;

      if (!seenLocations.has(normKey) || isLatest) {
        seenLocations.add(normKey);
        points.push({
          name: ev.location,
          lat: coords[0],
          lng: coords[1],
          time: ev.timestamp,
          statusText: ev.statusText || ev.status || "Milestone Update",
          description: ev.description || ev.statusText,
          isLatest,
          index: points.length,
        });
      }
    }
  }

  // 3. Process Destination if not yet reached
  if (params.destination) {
    const coords = await resolveCoordinates(params.destination);
    if (coords) {
      const normKey = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}`;
      if (!seenLocations.has(normKey)) {
        points.push({
          name: params.destination,
          lat: coords[0],
          lng: coords[1],
          statusText: "Destination Address",
          description: `Final delivery address in ${params.destination}`,
          isDestination: true,
          index: points.length,
        });
      }
    }
  }

  // Ensure points has at least one latest marker
  if (points.length > 0) {
    const hasLatest = points.some((p) => p.isLatest);
    if (!hasLatest) {
      points[points.length - 1].isLatest = true;
    }
  }

  return points;
}
