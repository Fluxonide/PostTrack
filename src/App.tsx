import React, { useState, useEffect, useCallback } from "react";
import { FiAlertTriangle, FiRefreshCw, FiExternalLink } from "react-icons/fi";
import type { TrackingResult } from "./carriers/types";
import { AUTO_CARRIER } from "./carriers/detect";
import { Navbar } from "./components/Navbar";
import { SearchHero } from "./components/SearchHero";
import { TrackingCard } from "./components/TrackingCard";
import { RecentHistory } from "./components/RecentHistory";
import { CarriersModal } from "./components/CarriersModal";
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
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

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
        throw new Error(data.message || data.error || "Failed to locate shipment.");
      }

      setResult(data as TrackingResult);
      setActiveTrackingNumber(cleaned);
      setActiveCarrier(carrierId);

      // Save to recent history
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

      // Update URL query without full reload
      const url = new URL(window.location.href);
      url.searchParams.set("carrier", carrierId);
      url.searchParams.set("track", cleaned);
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Error fetching shipment updates.",
      });
      if (!isSilentRefresh) {
        setResult(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Check URL parameters on mount
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
  };

  const handleClearAllHistory = () => {
    clearAllShipments();
    setRecentItems([]);
  };

  const activeSavedItem = recentItems.find(
    (item) => item.trackingNumber.toLowerCase() === activeTrackingNumber.toLowerCase()
  );

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-white">
      {/* Ambient background glows */}
      <div className="glow-orb-top" />
      <div className="glow-orb-bottom" />

      {/* Glassmorphic Navbar */}
      <Navbar
        onOpenCarriers={() => setIsCarriersOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={recentItems.length}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-16">
        <SearchHero
          onSearch={(carrier, tracking) => performLookup(carrier, tracking)}
          isLoading={isLoading}
          initialTracking={activeTrackingNumber}
          initialCarrier={activeCarrier}
        />

        {/* Error notification card */}
        {error && !isLoading && (
          <div className="w-full max-w-3xl my-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3.5 text-rose-200 animate-fade-slide-up">
            <FiAlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs sm:text-sm">
              <span className="font-bold text-rose-300">Tracking Notice:</span> {error.message}
              <p className="mt-1 text-xs text-rose-300/70">
                Ensure the consignment number is correct, or manually select your carrier from the dropdown if auto-detect could not resolve it.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="w-full max-w-3xl my-6 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-[var(--border)] rounded-md" />
              <div className="h-6 w-24 bg-[var(--border)] rounded-full" />
            </div>
            <div className="h-8 w-64 bg-[var(--border)] rounded-md" />
            <div className="h-2 w-full bg-[var(--border)] rounded-full my-4" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-[var(--border)] rounded-xl" />
              <div className="h-16 bg-[var(--border)] rounded-xl" />
              <div className="h-16 bg-[var(--border)] rounded-xl" />
            </div>
          </div>
        )}

        {/* Loaded Tracking Result */}
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

      {/* History Slide-over Drawer */}
      <RecentHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        items={recentItems}
        onSelect={(carrier, tracking) => performLookup(carrier, tracking)}
        onRemove={handleRemoveHistoryItem}
        onClearAll={handleClearAllHistory}
      />

      {/* Carriers Directory Modal */}
      <CarriersModal
        isOpen={isCarriersOpen}
        onClose={() => setIsCarriersOpen(false)}
        onSelectSample={(carrier, tracking) => performLookup(carrier, tracking)}
      />

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-6 text-center text-xs font-mono text-[var(--text-3)] bg-[#14120b]/90">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="PostTrack" className="w-4 h-4 opacity-70" />
            <span>PostTrack — Open Multi-Carrier Logistics</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsCarriersOpen(true)}
              className="hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              Supported Carriers
            </button>
            <span>•</span>
            <a
              href="https://github.com/Fluxonide/PostTrack"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--text)] transition-colors"
            >
              GitHub Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
