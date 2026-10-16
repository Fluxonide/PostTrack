import React, { useState } from "react";
import { FiMapPin, FiClock, FiSearch, FiX } from "react-icons/fi";
import type { TrackingEvent } from "../carriers/types";
import { displayCarrierDate, relativeTime } from "../lib/dates";
import { STATUS_CONFIG } from "../lib/status";

interface TimelineProps {
  events: TrackingEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const [filterQuery, setFilterQuery] = useState("");

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-[var(--text-3)]">
        No tracking scans recorded by courier yet.
      </div>
    );
  }

  // Caller events are oldest first, so we reverse for newest first display
  const ordered = events.slice().reverse();

  const filtered = filterQuery.trim()
    ? ordered.filter(
        (ev) =>
          ev.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
          (ev.location && ev.location.toLowerCase().includes(filterQuery.toLowerCase())) ||
          ev.timestamp.toLowerCase().includes(filterQuery.toLowerCase())
      )
    : ordered;

  return (
    <div className="mt-8 pt-6 border-t border-[var(--border)]">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)] tracking-tight">
            Detailed Scan History
          </h3>
          <span className="text-[11px] font-mono text-[var(--accent)] bg-[rgba(192,133,50,0.1)] border border-[rgba(192,133,50,0.2)] px-2 py-0.5 rounded-full">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>

        {events.length > 3 && (
          <div className="relative w-full sm:w-64">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-3)] pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter scans by location or status..."
              className="w-full text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-7 py-1.5 text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-3)] hover:text-[var(--text)]"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-[var(--text-3)]">
          No events match &ldquo;{filterQuery}&rdquo;
        </div>
      ) : (
        <ol className="relative m-0 p-0 list-none">
          {filtered.map((ev, idx) => {
            const when = displayCarrierDate(ev.timestamp);
            const isLatest = idx === 0 && !filterQuery;
            const meta = STATUS_CONFIG[ev.status] || STATUS_CONFIG.unknown;

            return (
              <li key={idx} className="relative pl-7 pb-6 last:pb-1 group">
                {/* Connecting vertical line */}
                {idx < filtered.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[7px] top-[18px] bottom-0 w-[2px] bg-[var(--border)] group-hover:bg-[rgba(192,133,50,0.25)] transition-colors"
                  />
                )}

                {/* Node icon / dot */}
                <span
                  aria-hidden
                  className={`absolute left-[3px] top-[7px] w-2.5 h-2.5 rounded-full z-10 transition-transform ${
                    isLatest
                      ? "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)] ring-4 ring-[rgba(192,133,50,0.2)]"
                      : "bg-[#211e15] border-2 border-[var(--border-hover)]"
                  }`}
                />

                {/* Event Description */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-medium text-[var(--text)] leading-snug">
                      {ev.description}
                    </span>
                    {ev.status !== "unknown" && ev.status !== "in_transit" && (
                      <span
                        className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: meta.badgeBg,
                          color: meta.textColor,
                          border: `1px solid ${meta.badgeBorder}`,
                        }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>

                  {/* Metadata: Timestamp, Relative time & Location */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-3)] flex-wrap pt-0.5">
                    {when.text && (
                      <span className="text-[var(--text-2)] flex items-center gap-1">
                        <FiClock className="w-3 h-3 text-[var(--text-3)]" />
                        {when.text}
                      </span>
                    )}

                    {when.date && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--accent)] font-medium">
                          {relativeTime(when.date)}
                        </span>
                      </>
                    )}

                    {ev.location && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--text-2)] flex items-center gap-1">
                          <FiMapPin className="w-3 h-3 text-[var(--accent)]" />
                          {ev.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
