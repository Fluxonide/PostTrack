import type { ShipmentStatus } from "../carriers/types";

export interface StoredTrackingItem {
  trackingNumber: string;
  carrier: string;
  carrierName: string;
  status: ShipmentStatus;
  lastEventDescription?: string;
  lastEventTime?: string;
  destination?: string;
  customLabel?: string;
  updatedAt: string;
}

const STORAGE_KEY = "posttrack:recent_shipments_v1";
const MAX_HISTORY = 30;

export function getRecentShipments(): StoredTrackingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredTrackingItem[];
  } catch {
    return [];
  }
}

export function saveShipment(item: StoredTrackingItem): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentShipments();
    const filtered = current.filter(
      (s) => s.trackingNumber.toLowerCase() !== item.trackingNumber.toLowerCase()
    );
    const updated = [item, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save shipment to localStorage", err);
  }
}

export function updateShipmentLabel(trackingNumber: string, label: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentShipments();
    const updated = current.map((s) =>
      s.trackingNumber.toLowerCase() === trackingNumber.toLowerCase()
        ? { ...s, customLabel: label.trim() || undefined }
        : s
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to update label", err);
  }
}

export function removeShipment(trackingNumber: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentShipments();
    const updated = current.filter(
      (s) => s.trackingNumber.toLowerCase() !== trackingNumber.toLowerCase()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to remove shipment", err);
  }
}

export function clearAllShipments(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear shipments", err);
  }
}
