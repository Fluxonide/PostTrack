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

export const STATUS_CONFIG: Record<ShipmentStatus, StatusMeta> = {
  delivered: {
    label: "Delivered",
    badgeBg: "rgba(74, 222, 128, 0.12)",
    badgeBorder: "rgba(74, 222, 128, 0.28)",
    textColor: "#4ade80",
    dotColor: "#4ade80",
    stepIndex: 4,
  },
  out_for_delivery: {
    label: "Out For Delivery",
    badgeBg: "rgba(212, 160, 74, 0.14)",
    badgeBorder: "rgba(212, 160, 74, 0.35)",
    textColor: "#d4a04a",
    dotColor: "#d4a04a",
    stepIndex: 3,
  },
  in_transit: {
    label: "In Transit",
    badgeBg: "rgba(96, 165, 250, 0.12)",
    badgeBorder: "rgba(96, 165, 250, 0.28)",
    textColor: "#60a5fa",
    dotColor: "#60a5fa",
    stepIndex: 2,
  },
  picked_up: {
    label: "Picked Up",
    badgeBg: "rgba(192, 132, 252, 0.12)",
    badgeBorder: "rgba(192, 132, 252, 0.28)",
    textColor: "#c084fc",
    dotColor: "#c084fc",
    stepIndex: 1,
  },
  pending: {
    label: "Order Created",
    badgeBg: "rgba(237, 236, 236, 0.08)",
    badgeBorder: "rgba(237, 236, 236, 0.15)",
    textColor: "rgba(237, 236, 236, 0.7)",
    dotColor: "rgba(237, 236, 236, 0.5)",
    stepIndex: 0,
  },
  exception: {
    label: "Delivery Exception",
    badgeBg: "rgba(248, 113, 113, 0.12)",
    badgeBorder: "rgba(248, 113, 113, 0.28)",
    textColor: "#f87171",
    dotColor: "#f87171",
    stepIndex: -1,
  },
  returned: {
    label: "Returned to Origin",
    badgeBg: "rgba(251, 191, 36, 0.12)",
    badgeBorder: "rgba(251, 191, 36, 0.28)",
    textColor: "#fbbf24",
    dotColor: "#fbbf24",
    stepIndex: -1,
  },
  unknown: {
    label: "Status Pending",
    badgeBg: "rgba(237, 236, 236, 0.06)",
    badgeBorder: "rgba(237, 236, 236, 0.12)",
    textColor: "rgba(237, 236, 236, 0.5)",
    dotColor: "rgba(237, 236, 236, 0.4)",
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
