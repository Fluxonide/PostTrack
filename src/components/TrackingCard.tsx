import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import type { TrackingResult } from "../carriers/types";
import { formatCarrierDate, formatEta, displayCarrierDate, parseCarrierDate } from "../lib/dates";
import { humanStatus } from "../lib/status";
import { showToast } from "../lib/toast";
import { JourneyProgress } from "./JourneyProgress";
import { useAuth } from "../lib/authContext";

interface TrackingCardProps {
  result: TrackingResult;
  onRefresh: () => void;
  isRefreshing: boolean;
  onUpdateLabel?: (trackingNumber: string, label: string) => void;
  customLabel?: string;
  onOpenAuth?: () => void;
}

export const TrackingCard: React.FC<TrackingCardProps> = ({
  result,
  onRefresh,
  isRefreshing,
  onUpdateLabel,
  customLabel,
  onOpenAuth,
}) => {
  const { user, token } = useAuth();
  const [filterQuery, setFilterQuery] = useState("");
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(customLabel || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveToDashboard = async () => {
    if (!user || !token) {
      onOpenAuth?.();
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carrier: result.carrier,
          trackingNumber: result.trackingNumber,
          label: customLabel || undefined,
        }),
      });
      if (res.ok) {
        setIsSaved(true);
        showToast("Shipment saved to your dashboard!");
      } else {
        showToast("Could not save to dashboard.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

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

  // Events list: ensure newest update is always first
  const orderedEvents = React.useMemo(() => {
    const list = [...result.events];
    const withDates = list.map((ev, originalIndex) => ({
      ev,
      time: parseCarrierDate(ev.timestamp)?.getTime() ?? null,
      originalIndex,
    }));

    const hasValidDates = withDates.some((item) => item.time !== null);

    if (hasValidDates) {
      withDates.sort((a, b) => {
        if (a.time !== null && b.time !== null) return b.time - a.time;
        if (a.time !== null) return -1;
        if (b.time !== null) return 1;
        return b.originalIndex - a.originalIndex;
      });
      return withDates.map((item) => item.ev);
    }

    return list.reverse();
  }, [result.events]);

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
          <button
            type="button"
            onClick={() => copyToClipboard(result.trackingNumber, "Tracking number copied")}
            title="Click to copy tracking number"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span className="result-id">{result.trackingNumber}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--text-3)", verticalAlign: "middle" }}
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
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
            onClick={handleSaveToDashboard}
            disabled={isSaving || isSaved}
            style={
              isSaved
                ? { color: "var(--color-success)", borderColor: "rgba(74, 222, 128, 0.4)" }
                : undefined
            }
            title={user ? "Save package to your dashboard for auto-tracking" : "Sign in to save"}
          >
            {isSaved ? "✓ In Dashboard" : isSaving ? "Saving…" : "+ Save to Dashboard"}
          </button>

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
      <div className="modal-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: 28 }}>
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
      </div>

      {/* Journey Milestones Bar */}
      <JourneyProgress status={result.status} events={result.events} />

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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: isFirst ? 9 : 6,
                      height: isFirst ? 9 : 6,
                      borderRadius: "50%",
                      background: isFirst ? "var(--accent)" : "var(--text-3)",
                      boxShadow: isFirst ? "0 0 10px var(--accent-glow)" : "none",
                      opacity: isFirst ? 1 : 0.45,
                      transition: "all var(--transition)",
                    }}
                  />
                </div>

                <div className="result-body">
                  <div className="result-title" style={{ whiteSpace: "normal" }}>
                    {ev.description}
                  </div>

                  <div className="result-meta">
                    <span className="result-id">{humanStatus(ev.status)}</span>
                    {isFirst && (
                      <span
                        className="result-prefix"
                        style={{
                          color: "var(--accent)",
                          borderColor: "rgba(192, 133, 50, 0.35)",
                          background: "rgba(192, 133, 50, 0.08)",
                          fontWeight: 700,
                        }}
                      >
                        Latest
                      </span>
                    )}
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
