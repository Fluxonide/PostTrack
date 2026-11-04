import type { ShipmentStatus } from "../carriers/types";

export function humanStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface StatusMeta {
  label: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  dotColor: string;
  stepIndex: number;
}

/**
 * Single shared palette for every status surface in the app.
 * All active journey states share one "in transit" colour so a shipment never
 * changes colour just because a carrier reports a slightly different scan name.
 */
export const STATUS_PALETTE = {
  transit: {
    badgeBg: "rgba(192, 133, 50, 0.15)",
    badgeBorder: "rgba(212, 160, 74, 0.35)",
    textColor: "#d4a04a",
    dotColor: "#d4a04a",
  },
  delivered: {
    badgeBg: "rgba(74, 222, 128, 0.12)",
    badgeBorder: "rgba(74, 222, 128, 0.28)",
    textColor: "#4ade80",
    dotColor: "#4ade80",
  },
  exception: {
    badgeBg: "rgba(248, 113, 113, 0.12)",
    badgeBorder: "rgba(248, 113, 113, 0.28)",
    textColor: "#f87171",
    dotColor: "#f87171",
  },
  neutral: {
    badgeBg: "rgba(237, 236, 236, 0.06)",
    badgeBorder: "rgba(237, 236, 236, 0.12)",
    textColor: "rgba(237, 236, 236, 0.5)",
    dotColor: "rgba(237, 236, 236, 0.4)",
  },
} as const;

export type StatusPaletteKey = keyof typeof STATUS_PALETTE;

export function statusPaletteKey(status: string): StatusPaletteKey {
  switch (status.toLowerCase()) {
    case "delivered":
      return "delivered";
    case "exception":
    case "returned":
      return "exception";
    case "picked_up":
    case "in_transit":
    case "out_for_delivery":
      return "transit";
    default:
      return "neutral";
  }
}

export const STATUS_CONFIG: Record<ShipmentStatus, StatusMeta> = {
  delivered: {
    label: "Delivered",
    ...STATUS_PALETTE.delivered,
    stepIndex: 4,
  },
  out_for_delivery: {
    label: "Out For Delivery",
    ...STATUS_PALETTE.transit,
    stepIndex: 3,
  },
  in_transit: {
    label: "In Transit",
    ...STATUS_PALETTE.transit,
    stepIndex: 2,
  },
  picked_up: {
    label: "Picked Up",
    ...STATUS_PALETTE.transit,
    stepIndex: 1,
  },
  pending: {
    label: "Order Created",
    ...STATUS_PALETTE.neutral,
    stepIndex: 0,
  },
  exception: {
    label: "Delivery Exception",
    ...STATUS_PALETTE.exception,
    stepIndex: -1,
  },
  returned: {
    label: "Returned to Origin",
    ...STATUS_PALETTE.exception,
    stepIndex: -1,
  },
  unknown: {
    label: "Status Pending",
    ...STATUS_PALETTE.neutral,
    stepIndex: -1,
  },
};

export const TRACKING_STEPS = [
  { id: "pending", label: "Booked" },
  { id: "picked_up", label: "Picked Up" },
  { id: "in_transit", label: "In Transit" },
  { id: "out_for_delivery", label: "Out for Delivery" },
  { id: "delivered", label: "Delivered" },
];
