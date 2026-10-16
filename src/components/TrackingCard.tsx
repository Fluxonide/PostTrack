import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import type { TrackingResult } from "../carriers/types";
import { formatCarrierDate, formatEta, displayCarrierDate } from "../lib/dates";
import { humanStatus } from "../lib/status";
import { showToast } from "../lib/toast";
import { JourneyProgress } from "./JourneyProgress";

interface TrackingCardProps {
  result: TrackingResult;
  onRefresh: () => void;
  isRefreshing: boolean;
  onUpdateLabel?: (trackingNumber: string, label: string) => void;
  customLabel?: string;
}

export const TrackingCard: React.FC<TrackingCardProps> = ({
  result,
  onRefresh,
  isRefreshing,
  onUpdateLabel,
  customLabel,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(customLabel || "");

  const etaText = formatEta(result.estimatedDelivery);

  // Confetti on delivered status
  useEffect(() => {
    if (result.status === "delivered") {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#c08532", "#d4a04a", "#4ade80", "#edecec"],
        });
      } catch {
        /* ignore */
      }
    }
  }, [result.status, result.trackingNumber]);

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg, "success");
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?carrier=${result.carrier}&track=${result.trackingNumber}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shipment ${result.trackingNumber} (${result.carrierName || result.carrier})`,
          text: `Status: ${humanStatus(result.status)}. Track package on PostTrack:`,
          url,
        });
        return;
      } catch {
        /* fallback */
      }
    }
    copyToClipboard(url, "Share link copied to clipboard");
  };

  const handleSaveLabel = () => {
    if (onUpdateLabel) onUpdateLabel(result.trackingNumber, labelInput);
    setIsEditingLabel(false);
    showToast("Package tag updated");
  };

  // Events list: newest first
  const orderedEvents = result.events.slice().reverse();
  const filteredEvents = filterQuery.trim()
    ? orderedEvents.filter(
        (ev) =>
          ev.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
          (ev.location && ev.location.toLowerCase().includes(filterQuery.toLowerCase())) ||
          ev.timestamp.toLowerCase().includes(filterQuery.toLowerCase())
      )
    : orderedEvents;

  return (
    <div style={{ width: "100%", marginTop: 20 }}>
      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-info" style={{ flexWrap: "wrap" }}>
          <span>Carrier:</span>
          <span className="status-count">{result.carrierName || result.carrier}</span>
          <span>•</span>
          <span>AWB:</span>
          <span
            className="result-id"
            onClick={() => copyToClipboard(result.trackingNumber, "Tracking number copied")}
            title="Click to copy"
            style={{ cursor: "pointer" }}
          >
            {result.trackingNumber} 📋
          </span>
          <span>•</span>
          <span>Status:</span>
          <span className="result-id" style={{ textTransform: "uppercase" }}>
            {humanStatus(result.status)}
          </span>

          {customLabel && !isEditingLabel && (
            <>
              <span>•</span>
              <span className="result-prefix">{customLabel}</span>
            </>
          )}
        </div>

        <div className="status-actions">
          <button
            type="button"
            className="export-btn"
            onClick={handleShare}
            title="Copy or share direct link"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>

          {!customLabel && !isEditingLabel && (
            <button
              type="button"
              className="export-btn"
              onClick={() => setIsEditingLabel(true)}
            >
              Tag
            </button>
          )}

          <button
            type="button"
            className="export-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <svg viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Label Edit Inline */}
      {isEditingLabel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            padding: "10px 16px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Add a friendly nickname (e.g. Work Laptop, Sneakers)..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--sans)",
            }}
            autoFocus
          />
          <button
            type="button"
            className="action-btn primary"
            onClick={handleSaveLabel}
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            Save
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setIsEditingLabel(false)}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3 Metric Stat Cards */}
      <div className="modal-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-num" style={{ fontSize: 15, wordBreak: "break-word" }}>
            {result.origin && result.destination ? (
              `${result.origin} → ${result.destination}`
            ) : result.destination ? (
              `To ${result.destination}`
            ) : result.origin ? (
              `From ${result.origin}`
            ) : (
              "Domestic Route"
            )}
          </div>
          <div className="stat-label">Route Details</div>
        </div>

        <div className="stat-card">
          <div className="stat-num" style={{ color: "var(--accent)" }}>
            {etaText || "Scheduled"}
          </div>
          <div className="stat-label">Expected Delivery</div>
        </div>

        <div className="stat-card">
          <div className="stat-num">{result.events.length}</div>
          <div className="stat-label">Total Scan Events</div>
        </div>
      </div>

      {/* Journey Milestones Bar */}
      <JourneyProgress status={result.status} />

      {/* Result Filter Divider */}
      <div className="result-filter-divider">
        <svg
          className="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          className="divider-input"
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter scan records by keyword, city, or status..."
        />

        <div className="filter-divider-meta matches">
          {filteredEvents.length} {filteredEvents.length === 1 ? "SCAN" : "SCANS"}
        </div>

        {filterQuery && (
          <button
            type="button"
            className="filter-divider-clear"
            onClick={() => setFilterQuery("")}
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results List Cards */}
      {filteredEvents.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          No scan records match &ldquo;{filterQuery}&rdquo;
        </div>
      ) : (
        <div className="results-list">
          {filteredEvents.map((ev, idx) => {
            const when = displayCarrierDate(ev.timestamp);
            const isFirst = idx === 0 && !filterQuery;

            return (
              <div
                key={idx}
                className={`result-card ${isFirst ? "card-fetching" : ""}`}
                style={{ cursor: "default" }}
              >
                <div className="result-index">#{String(idx + 1).padStart(2, "0")}</div>

                <div className="result-body">
                  <div className="result-title" style={{ whiteSpace: "normal" }}>
                    {ev.description}
                  </div>

                  <div className="result-meta">
                    <span className="result-id">{humanStatus(ev.status)}</span>
                    {when.text && <span className="result-date">{when.text}</span>}
                    {ev.location && <span className="result-prefix">{ev.location}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
