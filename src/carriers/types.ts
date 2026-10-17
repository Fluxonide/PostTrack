export type ShipmentStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned"
  | "unknown";

export interface TrackingEvent {
  timestamp: string;
  status: ShipmentStatus;
  location?: string;
  description: string;
  rawCode?: string;
  statusText?: string;
}

export interface TrackingResult {
  carrier: string;
  carrierName?: string;
  trackingNumber: string;
  status: ShipmentStatus;
  statusText?: string;
  estimatedDelivery?: string;
  origin?: string;
  destination?: string;
  events: TrackingEvent[];
  fetchedAt: string;
  raw?: unknown;
}

export interface TrackOptions {
  delhiveryToken?: string;
}

export interface CarrierMeta {
  id: string;
  name: string;
  website: string;
  privateOnly?: boolean;
  sampleTracking?: string;
  description: string;
}

export interface Carrier {
  id: string;
  name: string;
  website: string;
  privateOnly?: boolean;
  sampleTracking?: string;
  description: string;
  track(trackingNumber: string, opts?: TrackOptions): Promise<TrackingResult>;
}

export class CarrierError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "not_found" | "rate_limited" | "upstream_error" | "invalid_input",
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "CarrierError";
  }
}
