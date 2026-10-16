import React from "react";
import type { ShipmentStatus, TrackingEvent } from "../carriers/types";
import { STATUS_CONFIG, TRACKING_STEPS } from "../lib/status";
import { parseCarrierDate } from "../lib/dates";

// Distinct SVG icon per milestone — visually communicates each stage
const STEP_ICONS: Record<string, React.ReactNode> = {
  // Booked: a parcel box
  pending: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  ),
  // Picked Up: a hand lifting
  picked_up: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 13" />
    </svg>
  ),
  // In Transit: a truck moving
  in_transit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.684-.948V8h2a1 1 0 0 1 1 1v2" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  ),
  // Out for Delivery: a map-pin / navigation
  out_for_delivery: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 2a8 8 0 0 0-8 8c0 1.892.402 3.13 1.5 4.5L12 22l6.5-7.5c1.098-1.37 1.5-2.608 1.5-4.5a8 8 0 0 0-8-8Z" />
    </svg>
  ),
  // Delivered: a home / door
  delivered: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
};

interface JourneyProgressProps {
  status: ShipmentStatus;
  events?: TrackingEvent[];
}

export const JourneyProgress: React.FC<JourneyProgressProps> = ({ status, events }) => {
  const meta = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const isException = status === "exception" || status === "returned";

  // Calculate the latest step reached by checking both overall status and recent events
  const currentStep = React.useMemo(() => {
    let bestIndex = meta.stepIndex >= 0 ? meta.stepIndex : 0;

    if (events && events.length > 0) {
      // Find latest event by timestamp
      const sorted = [...events].map((ev, originalIndex) => ({
        ev,
        time: parseCarrierDate(ev.timestamp)?.getTime() ?? null,
        originalIndex,
      }));

      sorted.sort((a, b) => {
        if (a.time !== null && b.time !== null) return b.time - a.time;
        if (a.time !== null) return -1;
        if (b.time !== null) return 1;
        return b.originalIndex - a.originalIndex;
      });

      const latestEvent = sorted[0]?.ev;
      if (latestEvent && latestEvent.status !== "unknown") {
        const latestIdx = STATUS_CONFIG[latestEvent.status]?.stepIndex ?? -1;
        if (latestIdx >= 0) bestIndex = latestIdx;
      }

      // Check if any event records reached a higher milestone (e.g. out for delivery or delivered)
      for (const item of sorted) {
        const step = STATUS_CONFIG[item.ev.status]?.stepIndex ?? -1;
        if (step > bestIndex) {
          bestIndex = step;
        }
      }
    }

    return bestIndex;
  }, [status, meta.stepIndex, events]);

  const activeLabel = TRACKING_STEPS[currentStep]?.label || meta.label;

  if (isException) {
    return (
      <div className="error-msg" style={{ margin: "24px 0", fontSize: 14 }}>
        <strong>{meta.label}:</strong> A delivery remark or exception was flagged by the carrier. Please check the scan records below.
      </div>
    );
  }

  return (
    <div
      style={{
        margin: "24px 0 28px",
        padding: "20px 20px 18px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      {/* Top micro-header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          fontSize: 12,
          fontFamily: "var(--mono)",
        }}
      >
        <span style={{ color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px", fontSize: 11 }}>
          Shipment Progress
        </span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          {activeLabel}
        </span>
      </div>

      {/* Stepper with independent segments between circles */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {TRACKING_STEPS.map((step, idx) => {
          const isDone = currentStep >= idx;
          const isCurrent = currentStep === idx;
          const isLast = idx === TRACKING_STEPS.length - 1;
          const isSegmentCompleted = currentStep > idx;

          return (
            <React.Fragment key={step.id}>
              {/* Step Node */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                  width: 72,
                }}
              >
                {/* Solid Icon Circle - No line behind it */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isCurrent
                      ? "var(--accent)"
                      : isDone
                      ? "#1e1a12"
                      : "var(--bg-2)",
                    color: isCurrent ? "#0a0906" : isDone ? "var(--accent)" : "var(--text-3)",
                    border: isCurrent
                      ? "2px solid var(--accent)"
                      : isDone
                      ? "1.5px solid var(--accent)"
                      : "1px solid var(--border)",
                    boxShadow: isCurrent ? "0 0 16px rgba(192, 133, 50, 0.45)" : "none",
                    transition: "all var(--transition)",
                  }}
                >
                  {STEP_ICONS[step.id] || STEP_ICONS.pending}
                </div>

                {/* Step Label */}
                <span
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    fontFamily: "var(--mono)",
                    fontWeight: isCurrent ? 600 : 500,
                    color: isCurrent
                      ? "var(--accent)"
                      : isDone
                      ? "var(--text)"
                      : "var(--text-3)",
                    letterSpacing: "0.2px",
                    textAlign: "center",
                    lineHeight: 1.25,
                    width: "100%",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Segment Connector joining Circle A to Circle B */}
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    marginTop: 17, // Mathematically centered with 36px circle: (36 - 2) / 2 = 17
                    marginLeft: 6,
                    marginRight: 6,
                    background: isSegmentCompleted
                      ? "linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)"
                      : "var(--border)",
                    transition: "background 0.3s ease",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
