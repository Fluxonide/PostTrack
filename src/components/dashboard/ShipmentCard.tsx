import React, { useState } from "react";
import {
  FaSync,
  FaTrash,
  FaCopy,
  FaCheck,
  FaEdit,
  FaArrowRight,
  FaClock,
} from "react-icons/fa";
import {
  ShipmentItem,
  formatCarrierName,
  formatStatusText,
  getStatusBadgeStyle,
  getStatusDotColor,
} from "./types";

interface ShipmentCardProps {
  shipment: ShipmentItem;
  isSyncing: boolean;
  copied: boolean;
  onSync: (id: string) => void;
  onDelete: (id: string, trackingNumber: string) => void;
  onToggleAutoCheck: (id: string, current: boolean) => void;
  onSaveLabel: (id: string, newLabel: string) => void;
  onViewTimeline: (shipment: ShipmentItem) => void;
  onInspect: (carrier: string, trackingNumber: string) => void;
  onCopy: (id: string, text: string) => void;
}

const actionBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  background: "var(--color-surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-2)",
  fontSize: 12,
  cursor: "pointer",
};

export const ShipmentCard: React.FC<ShipmentCardProps> = ({
  shipment,
  isSyncing,
  copied,
  onSync,
  onDelete,
  onToggleAutoCheck,
  onSaveLabel,
  onViewTimeline,
  onInspect,
  onCopy,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [labelText, setLabelText] = useState(shipment.label || "");

  const handleSave = () => {
    onSaveLabel(shipment.id, labelText);
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: "var(--color-bg-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color 0.2s",
      }}
    >
      {/* Row 1: Label / Tracking / Carrier / Status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {isEditing ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                  placeholder="Package nickname"
                  autoFocus
                  style={{
                    padding: "4px 8px",
                    background: "var(--color-bg)",
                    border: "1px solid var(--accent)",
                    borderRadius: 6,
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                />
                <button
                  onClick={handleSave}
                  style={{
                    padding: "4px 8px",
                    background: "var(--accent)",
                    color: "#14120b",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    color: "var(--text-3)",
                    border: "none",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                  {shipment.label || formatCarrierName(shipment.carrier)}
                </span>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setLabelText(shipment.label || "");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-3)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Edit label"
                >
                  <FaEdit size={12} />
                </button>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "var(--mono)" }}>
            <span
              style={{
                padding: "2px 6px",
                background: "var(--color-surface)",
                borderRadius: 4,
                color: "var(--accent)",
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              {shipment.carrier}
            </span>
            <span style={{ color: "var(--text-2)" }}>{shipment.trackingNumber}</span>
            <button
              onClick={() => onCopy(shipment.id, shipment.trackingNumber)}
              style={{
                background: "none",
                border: "none",
                color: copied ? "var(--color-success)" : "var(--text-3)",
                cursor: "pointer",
                padding: 0,
              }}
              title="Copy tracking number"
            >
              {copied ? <FaCheck size={11} /> : <FaCopy size={11} />}
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: "var(--radius-pill)",
              fontSize: 12,
              fontWeight: 600,
              ...getStatusBadgeStyle(shipment.status),
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: getStatusDotColor(shipment.status),
              }}
            />
            <span>{formatStatusText(shipment.status, shipment.statusText)}</span>
          </span>
        </div>
      </div>

      {/* Row 2: Route & Latest Event */}
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: 8,
          padding: "10px 14px",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {(shipment.origin || shipment.destination) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
            <span style={{ color: "var(--text)" }}>{shipment.origin || "Origin"}</span>
            <FaArrowRight size={10} style={{ color: "var(--text-3)" }} />
            <span style={{ color: "var(--text)" }}>{shipment.destination || "Destination"}</span>
          </div>
        )}

        {shipment.lastEventText ? (
          <div style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ flex: 1 }}>{shipment.lastEventText}</span>
            {shipment.lastEventTime && (
              <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                {shipment.lastEventTime}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
            No recent carrier milestone recorded yet.
          </div>
        )}
      </div>

      {/* Row 3: Action Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          paddingTop: 4,
        }}
      >
        {/* Auto Check Toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            color: shipment.autoCheck ? "var(--text)" : "var(--text-3)",
          }}
        >
          <input
            type="checkbox"
            checked={shipment.autoCheck}
            onChange={() => onToggleAutoCheck(shipment.id, shipment.autoCheck)}
            style={{ cursor: "pointer", accentColor: "var(--accent)" }}
          />
          <span>Auto-check (Periodic sync & alerts)</span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {shipment.cachedResult && (
            <button
              onClick={() => onViewTimeline(shipment)}
              style={actionBtnStyle}
              title="View full journey timeline"
            >
              <FaClock size={12} />
              <span>Timeline</span>
            </button>
          )}

          <button
            onClick={() => onInspect(shipment.carrier, shipment.trackingNumber)}
            style={actionBtnStyle}
            title="Track directly in search page"
          >
            <span>Inspect</span>
          </button>

          <button
            onClick={() => onSync(shipment.id)}
            disabled={isSyncing}
            style={actionBtnStyle}
            title="Force refresh now"
          >
            <FaSync className={isSyncing ? "animate-spin" : ""} size={12} />
            <span>{isSyncing ? "Syncing..." : "Sync"}</span>
          </button>

          <button
            onClick={() => onDelete(shipment.id, shipment.trackingNumber)}
            style={{ ...actionBtnStyle, color: "var(--color-error)" }}
            title="Remove from dashboard"
          >
            <FaTrash size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
