import React, { useState } from "react";
import { CARRIER_LIST, formatCarrierName } from "./types";
import { detectCarriers, AUTO_CARRIER } from "../../carriers/detect";

interface AddShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (carrier: string, trackingNumber: string, label?: string) => Promise<void>;
  isSubmitting: boolean;
}

export const AddShipmentModal: React.FC<AddShipmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [carrier, setCarrier] = useState(AUTO_CARRIER);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [label, setLabel] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim() || isSubmitting) return;
    await onSubmit(carrier, trackingNumber.trim(), label.trim() || undefined);
    setCarrier(AUTO_CARRIER);
    setTrackingNumber("");
    setLabel("");
  };

  const detected = carrier === AUTO_CARRIER && trackingNumber.trim().length > 3 ? detectCarriers(trackingNumber.trim()) : [];

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: "90%",
          padding: 24,
          borderRadius: "var(--radius)",
          background: "var(--color-bg-2)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="modal-header" style={{ marginBottom: 18 }}>
          <div className="modal-title" style={{ fontSize: 18, fontWeight: 600 }}>
            Track New Shipment
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
              Courier Carrier
            </label>
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--color-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {CARRIER_LIST.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
              Tracking Number / AWB
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 1234567890123"
              required
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--color-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "var(--mono)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {carrier === AUTO_CARRIER && trackingNumber.trim().length > 3 && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: "var(--text-3)" }}>Detected:</span>
                {detected.length > 0 ? (
                  detected.map((c) => (
                    <span
                      key={c}
                      style={{
                        padding: "2px 8px",
                        background: "rgba(192, 133, 50, 0.15)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent)",
                        borderRadius: 4,
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {formatCarrierName(c)}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                    Format not recognized yet — will attempt matching on save
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
              Package Nickname (Optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Mechanical Keyboard"
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--color-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: 8,
              padding: "12px",
              background: "var(--accent)",
              color: "#14120b",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Locating & Adding..." : "Start Tracking"}
          </button>
        </form>
      </div>
    </div>
  );
};
