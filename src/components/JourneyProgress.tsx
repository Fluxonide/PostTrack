import React from "react";
import type { ShipmentStatus } from "../carriers/types";
import { STATUS_CONFIG, TRACKING_STEPS } from "../lib/status";

interface JourneyProgressProps {
  status: ShipmentStatus;
}

export const JourneyProgress: React.FC<JourneyProgressProps> = ({ status }) => {
  const meta = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const currentStep = meta.stepIndex;
  const isException = status === "exception" || status === "returned";

  if (isException) {
    return (
      <div className="error-msg" style={{ margin: "24px 0", fontSize: 14 }}>
        <strong>{meta.label}:</strong> A delivery remark or exception was flagged by the carrier. Please check the scan records below.
      </div>
    );
  }

  return (
    <div style={{ margin: "32px 0 36px", padding: "0 10px" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Background track line */}
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: 14,
            height: 2,
            background: "var(--border)",
            zIndex: 0,
          }}
        />

        {/* Active progress line */}
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 14,
            height: 2,
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)",
            width:
              currentStep <= 0
                ? "0%"
                : `calc(${Math.min(100, (currentStep / (TRACKING_STEPS.length - 1)) * 100)}% - 30px)`,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            zIndex: 0,
          }}
        />

        {/* Steps */}
        {TRACKING_STEPS.map((step, idx) => {
          const isDone = currentStep >= idx;
          const isCurrent = currentStep === idx;

          return (
            <div
              key={step.id}
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 64,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--mono)",
                  background: isCurrent
                    ? "var(--accent)"
                    : isDone
                    ? "rgba(192, 133, 50, 0.2)"
                    : "var(--bg-2)",
                  color: isCurrent ? "#000" : isDone ? "var(--accent)" : "var(--text-3)",
                  border: isCurrent
                    ? "2px solid var(--accent)"
                    : isDone
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                  boxShadow: isCurrent ? "0 0 16px var(--accent-glow)" : "none",
                  transition: "all var(--transition)",
                }}
              >
                {isDone ? "✓" : idx + 1}
              </div>

              <span
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent
                    ? "var(--accent)"
                    : isDone
                    ? "var(--text)"
                    : "var(--text-3)",
                  letterSpacing: "0.3px",
                  textAlign: "center",
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
