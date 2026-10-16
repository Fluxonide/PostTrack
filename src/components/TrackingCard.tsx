import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  FiCopy,
  FiCheck,
  FiShare2,
  FiRefreshCw,
  FiMapPin,
  FiCalendar,
  FiTag,
  FiExternalLink,
  FiTruck,
} from "react-icons/fi";
import type { TrackingResult } from "../carriers/types";
import { STATUS_CONFIG } from "../lib/status";
import { formatEta } from "../lib/dates";
import { JourneyProgress } from "./JourneyProgress";
import { Timeline } from "./Timeline";

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
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(customLabel || "");

  const meta = STATUS_CONFIG[result.status] || STATUS_CONFIG.unknown;
  const etaText = formatEta(result.estimatedDelivery);

  // Trigger celebration confetti when package is marked as Delivered!
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
        // Safe fallback
      }
    }
  }, [result.status, result.trackingNumber]);

  const copyToClipboard = (text: string, type: "tracking" | "link") => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === "tracking") {
        setCopiedTracking(true);
        setTimeout(() => setCopiedTracking(false), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?carrier=${result.carrier}&track=${result.trackingNumber}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Shipment ${result.trackingNumber} (${result.carrierName || result.carrier})`,
          text: `Status: ${meta.label}. Track package on PostTrack:`,
          url,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    copyToClipboard(url, "link");
  };

  const handleSaveLabel = () => {
    if (onUpdateLabel) {
      onUpdateLabel(result.trackingNumber, labelInput);
    }
    setIsEditingLabel(false);
  };

  const latestScan = result.events[result.events.length - 1];

  return (
    <div className="relative w-full max-w-3xl mx-auto my-6 bg-[#1a1710] border border-[var(--border)] rounded-2xl p-5 sm:p-7 shadow-2xl transition-all overflow-hidden group">
      {/* Golden left accent glow bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)] opacity-80" />

      {/* Top Bar: Carrier info & Status badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono font-semibold text-[var(--accent)] bg-[rgba(192,133,50,0.12)] border border-[rgba(192,133,50,0.25)] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {result.carrierName || result.carrier}
            </span>

            {/* Custom package label */}
            {customLabel && !isEditingLabel && (
              <span className="text-xs font-mono text-[var(--text-2)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1">
                <FiTag className="w-3 h-3 text-[var(--accent)]" />
                {customLabel}
              </span>
            )}
          </div>

          {/* Tracking Number and Copy */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text)]">
              {result.trackingNumber}
            </h2>
            <button
              onClick={() => copyToClipboard(result.trackingNumber, "tracking")}
              className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
              title="Copy Tracking Number"
            >
              {copiedTracking ? (
                <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FiCopy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wide uppercase shadow-sm"
            style={{
              backgroundColor: meta.badgeBg,
              color: meta.textColor,
              border: `1px solid ${meta.badgeBorder}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: meta.dotColor }}
            />
            {meta.label}
          </div>

          <span className="text-[11px] font-mono text-[var(--text-3)]">
            Updated {new Date(result.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Label Edit Inline Row */}
      {isEditingLabel ? (
        <div className="my-3 flex items-center gap-2 p-2 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <FiTag className="w-4 h-4 text-[var(--accent)] ml-1" />
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Add a label (e.g., Laptop, Birthday Gift)..."
            className="flex-1 bg-transparent text-xs text-[var(--text)] focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleSaveLabel}
            className="px-3 py-1 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditingLabel(false)}
            className="px-2 py-1 text-xs text-[var(--text-3)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Milestone Journey Progress */}
      <JourneyProgress status={result.status} />

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
        {/* Origin & Destination */}
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1 flex items-center gap-1">
            <FiMapPin className="w-3 h-3 text-[var(--accent)]" /> Route
          </span>
          <div className="text-xs sm:text-sm font-medium text-[var(--text)] truncate">
            {result.origin && result.destination ? (
              <span>
                {result.origin} → {result.destination}
              </span>
            ) : result.destination ? (
              <span>To {result.destination}</span>
            ) : result.origin ? (
              <span>From {result.origin}</span>
            ) : (
              <span className="text-[var(--text-3)]">Domestic Network</span>
            )}
          </div>
        </div>

        {/* Expected Delivery */}
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1 flex items-center gap-1">
            <FiCalendar className="w-3 h-3 text-[var(--accent)]" /> Expected Delivery
          </span>
          <div className="text-xs sm:text-sm font-medium text-[var(--text)]">
            {etaText ? (
              <span className="text-emerald-400 font-semibold">{etaText}</span>
            ) : (
              <span className="text-[var(--text-3)]">Standard Schedule</span>
            )}
          </div>
        </div>

        {/* Latest Activity */}
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] mb-1 flex items-center gap-1">
            <FiTruck className="w-3 h-3 text-[var(--accent)]" /> Latest Activity
          </span>
          <div className="text-xs sm:text-sm font-medium text-[var(--text)] truncate" title={latestScan?.description}>
            {latestScan?.description || "In transit with courier"}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between gap-2 pt-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
            title="Share Tracking Link"
          >
            {copiedLink ? (
              <>
                <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <FiShare2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Share Link</span>
              </>
            )}
          </button>

          {/* Add Label Button */}
          {!customLabel && !isEditingLabel && (
            <button
              onClick={() => setIsEditingLabel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
            >
              <FiTag className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Add Tag</span>
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-all cursor-pointer disabled:opacity-40"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--accent)]" : ""}`} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Connected Detailed Timeline */}
      <Timeline events={result.events} />
    </div>
  );
};
