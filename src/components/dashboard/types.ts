import React from "react";
import { TrackingResult } from "../../carriers/types";
import { AUTO_CARRIER } from "../../carriers/detect";

export interface ShipmentItem {
  id: string;
  carrier: string;
  trackingNumber: string;
  label: string | null;
  status: string;
  statusText: string | null;
  origin: string | null;
  destination: string | null;
  lastEventText: string | null;
  lastEventTime: string | null;
  autoCheck: boolean;
  lastCheckedAt: string | null;
  cachedResult: TrackingResult | null;
  createdAt: string;
  updatedAt: string;
}

export const CARRIER_LIST = [
  { id: AUTO_CARRIER, name: "⚡ Auto Detect (Recommended)" },
  { id: "bluedart", name: "Blue Dart" },
  { id: "delhivery", name: "Delhivery" },
  { id: "ekart", name: "Ekart" },
  { id: "xpressbees", name: "XpressBees" },
  { id: "valmo", name: "Valmo (Meesho)" },
  { id: "stcourier", name: "ST Courier" },
  { id: "tpc", name: "The Professional Couriers" },
  { id: "amazon", name: "Amazon Shipping" },
  { id: "shiprocket", name: "Shiprocket" },
];

export function formatCarrierName(carrier: string): string {
  const hit = CARRIER_LIST.find((c) => c.id === carrier.toLowerCase());
  return hit ? hit.name : carrier.toUpperCase();
}

export function formatStatusText(status: string, statusText: string | null): string {
  if (statusText) {
    const st = statusText.toLowerCase();
    const s = status.toLowerCase();
    if (s !== "exception" && (st.includes("exception") || st.includes("delayed") || st.includes("undelivered"))) {
      // Do not display stale exception text if status has transitioned back to normal transit or delivered
    } else {
      return statusText;
    }
  }
  switch (status.toLowerCase()) {
    case "delivered":
      return "Delivered";
    case "out_for_delivery":
      return "Out for Delivery";
    case "in_transit":
      return "In Transit";
    case "picked_up":
      return "Picked Up";
    case "exception":
      return "Delivery Exception";
    case "returned":
      return "Returned";
    case "pending":
      return "Pending";
    default:
      return "Unknown";
  }
}

export function getStatusBadgeStyle(status: string): React.CSSProperties {
  switch (status.toLowerCase()) {
    case "delivered":
      return { background: "rgba(74, 222, 128, 0.12)", color: "#4ade80" };
    case "out_for_delivery":
      return { background: "rgba(251, 191, 36, 0.12)", color: "#fbbf24" };
    case "in_transit":
      return { background: "rgba(192, 133, 50, 0.15)", color: "var(--accent)" };
    case "exception":
    case "returned":
      return { background: "rgba(248, 113, 113, 0.12)", color: "#f87171" };
    default:
      return { background: "var(--color-surface)", color: "var(--text-2)" };
  }
}

export function getStatusDotColor(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "#4ade80";
    case "out_for_delivery":
      return "#fbbf24";
    case "in_transit":
      return "var(--accent)";
    case "exception":
    case "returned":
      return "#f87171";
    default:
      return "var(--text-3)";
  }
}
