import React from "react";
import { listCarriers } from "../carriers/registry";

interface CarriersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (carrier: string, trackingNumber: string) => void;
}

export const CarriersModal: React.FC<CarriersModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  const carriers = listCarriers();

  return (
    <div className={`modal-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ fontSize: 16 }}>
              Supported Courier Directory
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              Direct integrations and real-time scrapers for 8 couriers
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
          <div className="results-list">
            {carriers.map((c) => (
              <div
                key={c.id}
                className="result-card"
                style={{
                  cursor: "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="result-body" style={{ minWidth: 0 }}>
                  <div className="result-title">
                    {c.name}{" "}
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="paste-link"
                      style={{ fontSize: 11, marginLeft: 8 }}
                    >
                      Website ↗
                    </a>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-2)",
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }}
                  >
                    {c.description}
                  </div>
                  {c.sampleTracking && (
                    <div className="result-meta">
                      <span className="result-prefix">Format</span>
                      <span className="result-date" style={{ color: "var(--accent)" }}>
                        {c.sampleTracking}
                      </span>
                    </div>
                  )}
                </div>

                {c.sampleTracking && (
                  <button
                    type="button"
                    className="action-btn primary"
                    onClick={() => {
                      onSelectSample(c.id, c.sampleTracking!);
                      onClose();
                    }}
                    style={{ marginLeft: 16, flexShrink: 0 }}
                  >
                    Test Sample ↗
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
