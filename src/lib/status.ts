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
    badgeBg: "var(--status-transit-bg, rgba(192, 133, 50, 0.15))",
    badgeBorder: "var(--status-transit-border, rgba(212, 160, 74, 0.35))",
    textColor: "var(--status-transit-text, #d4a04a)",
    dotColor: "var(--status-transit-dot, #d4a04a)",
  },
  delivered: {
    badgeBg: "var(--status-delivered-bg, rgba(74, 222, 128, 0.12))",
    badgeBorder: "var(--status-delivered-border, rgba(74, 222, 128, 0.28))",
    textColor: "var(--status-delivered-text, #4ade80)",
    dotColor: "var(--status-delivered-dot, #4ade80)",
  },
  exception: {
    badgeBg: "var(--status-exception-bg, rgba(248, 113, 113, 0.12))",
    badgeBorder: "var(--status-exception-border, rgba(248, 113, 113, 0.28))",
    textColor: "var(--status-exception-text, #f87171)",
    dotColor: "var(--status-exception-dot, #f87171)",
  },
  neutral: {
    badgeBg: "var(--surface)",
    badgeBorder: "var(--border)",
    textColor: "var(--text-2)",
    dotColor: "var(--text-3)",
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
