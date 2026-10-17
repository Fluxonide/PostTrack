import React from "react";
import { ShipmentItem } from "./types";
import { JourneyProgress } from "../JourneyProgress";
import { ShipmentMap } from "../ShipmentMap";
import { displayCarrierDate } from "../../lib/dates";

interface ShipmentTimelineModalProps {
  shipment: ShipmentItem | null;
  onClose: () => void;
}

export const ShipmentTimelineModal: React.FC<ShipmentTimelineModalProps> = ({
  shipment,
  onClose,
}) => {
  if (!shipment || !shipment.cachedResult) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          padding: 24,
          borderRadius: "var(--radius)",
          background: "var(--color-bg-2)",
        }}
      >
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="modal-title" style={{ fontSize: 18, fontWeight: 600 }}>
              {shipment.label || shipment.carrier.toUpperCase()} Journey
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--mono)" }}>
              {shipment.trackingNumber}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <JourneyProgress
            events={shipment.cachedResult.events || []}
            status={shipment.cachedResult.status}
          />

          <ShipmentMap
            origin={shipment.origin || undefined}
            destination={shipment.destination || undefined}
            events={shipment.cachedResult.events || []}
            status={shipment.status}
            height={280}
          />

          <div>
            <h4 style={{ fontSize: 14, color: "var(--text)", marginBottom: 12 }}>Activity History</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shipment.cachedResult.events?.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--color-bg)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.statusText || ev.status}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
                      {displayCarrierDate(ev.timestamp).text}
                    </span>
                  </div>
                  {ev.location && (
                    <div style={{ fontSize: 12, color: "var(--accent)" }}>📍 {ev.location}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
