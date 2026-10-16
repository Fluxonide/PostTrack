import React, { useState, useEffect, useCallback } from "react";
import type { TrackingResult } from "./carriers/types";
import { AUTO_CARRIER } from "./carriers/detect";
import { Navbar } from "./components/Navbar";
import { SearchHero } from "./components/SearchHero";
import { TrackingCard } from "./components/TrackingCard";
import { RecentHistory } from "./components/RecentHistory";
import { CarriersModal } from "./components/CarriersModal";
import { showToast } from "./lib/toast";
import {
  getRecentShipments,
  saveShipment,
  updateShipmentLabel,
  removeShipment,
  clearAllShipments,
  StoredTrackingItem,
} from "./lib/storage";

export default function App() {
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recentItems, setRecentItems] = useState<StoredTrackingItem[]>(() => getRecentShipments());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCarriersOpen, setIsCarriersOpen] = useState(false);

  const [activeTrackingNumber, setActiveTrackingNumber] = useState("");
  const [activeCarrier, setActiveCarrier] = useState(AUTO_CARRIER);

  const performLookup = useCallback(async (carrierId: string, trackingNum: string, isSilentRefresh = false) => {
    const cleaned = trackingNum.trim();
    if (!cleaned) return;

    if (isSilentRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const res = await fetch(`/api/track/${encodeURIComponent(carrierId)}/${encodeURIComponent(cleaned)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Shipment could not be located with this carrier.");
      }

      setResult(data as TrackingResult);
      setActiveTrackingNumber(cleaned);
      setActiveCarrier(carrierId);

      // Save to recent
      const latestScan = data.events && data.events.length > 0 ? data.events[data.events.length - 1] : undefined;
      const historyItem: StoredTrackingItem = {
        trackingNumber: cleaned,
        carrier: data.carrier,
        carrierName: data.carrierName || data.carrier,
        status: data.status,
        lastEventDescription: latestScan?.description,
        lastEventTime: latestScan?.timestamp,
        destination: data.destination,
        updatedAt: new Date().toISOString(),
      };
      saveShipment(historyItem);
      setRecentItems(getRecentShipments());

      // Update URL query parameter
      const url = new URL(window.location.href);
      url.searchParams.set("carrier", carrierId);
      url.searchParams.set("track", cleaned);
      window.history.replaceState({}, "", url.toString());

      if (isSilentRefresh) {
        showToast("Tracking data refreshed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error fetching shipment.";
      setError(msg);
      showToast(msg, "error");
      if (!isSilentRefresh) {
        setResult(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get("track") || params.get("tracking");
    const carrierParam = params.get("carrier") || AUTO_CARRIER;

    if (trackParam) {
      performLookup(carrierParam, trackParam);
    }
  }, [performLookup]);

  const handleUpdateLabel = (trackingNumber: string, label: string) => {
    updateShipmentLabel(trackingNumber, label);
    setRecentItems(getRecentShipments());
  };

  const handleRemoveHistoryItem = (trackingNumber: string) => {
    removeShipment(trackingNumber);
    setRecentItems(getRecentShipments());
    showToast("Removed from history");
  };

  const handleClearAllHistory = () => {
    clearAllShipments();
    setRecentItems([]);
    showToast("All recent tracking history cleared");
  };

  const activeSavedItem = recentItems.find(
    (item) => item.trackingNumber.toLowerCase() === activeTrackingNumber.toLowerCase()
  );

  return (
    <>
      <Navbar
        onOpenCarriers={() => setIsCarriersOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={recentItems.length}
      />

      <SearchHero
        onSearch={(carrier, tracking) => performLookup(carrier, tracking)}
        isLoading={isLoading}
        initialTracking={activeTrackingNumber}
        initialCarrier={activeCarrier}
      />

      <main>
        {/* Error notification */}
        {error && !isLoading && (
          <div className="error-msg" style={{ margin: "20px 0" }}>
            <strong>Tracking Notice:</strong> {error}
          </div>
        )}

        {/* Loading card */}
        {isLoading && (
          <div
            className="result-card card-fetching"
            style={{
              padding: "40px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              margin: "24px 0",
            }}
          >
            <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
            <div style={{ fontSize: 14, color: "var(--accent)", fontFamily: "var(--mono)" }}>
              Querying live carrier tracking systems…
            </div>
          </div>
        )}

        {/* Tracking Result Card */}
        {result && !isLoading && (
          <TrackingCard
            result={result}
            onRefresh={() => performLookup(result.carrier, result.trackingNumber, true)}
            isRefreshing={isRefreshing}
            onUpdateLabel={handleUpdateLabel}
            customLabel={activeSavedItem?.customLabel}
          />
        )}
      </main>

      {/* Slide-over Modals */}
      <RecentHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={recentItems}
        onSelect={(carrier, tracking) => performLookup(carrier, tracking)}
        onRemove={handleRemoveHistoryItem}
        onClearAll={handleClearAllHistory}
      />

      <CarriersModal
        isOpen={isCarriersOpen}
        onClose={() => setIsCarriersOpen(false)}
        onSelectSample={(carrier, tracking) => performLookup(carrier, tracking)}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 40px",
          textAlign: "center",
          fontSize: 12,
          fontFamily: "var(--mono)",
          color: "var(--text-3)",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>PostTrack — Open-Source Multi-Carrier Logistics Engine</div>
          <div style={{ display: "flex", gap: 16 }}>
            <span
              onClick={() => setIsCarriersOpen(true)}
              style={{ cursor: "pointer", color: "var(--text-2)" }}
            >
              Supported Carriers
            </span>
            <a
              href="https://github.com/Fluxonide/PostTrack"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--text-2)", textDecoration: "none" }}
            >
              GitHub Source ↗
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
