import React from "react";
import type { StoredTrackingItem } from "../lib/storage";
import { humanStatus } from "../lib/status";
import { relativeTime, parseCarrierDate } from "../lib/dates";

interface RecentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  items: StoredTrackingItem[];
  onSelect: (carrier: string, trackingNumber: string) => void;
  onRemove: (trackingNumber: string) => void;
  onClearAll: () => void;
}

export const RecentHistory: React.FC<RecentHistoryProps> = ({
  isOpen,
  onClose,
  items,
  onSelect,
  onRemove,
  onClearAll,
}) => {
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const isFinishedA = a.status === "delivered" || a.status === "returned";
      const isFinishedB = b.status === "delivered" || b.status === "returned";

      // Active shipments before completed/delivered shipments
      if (!isFinishedA && isFinishedB) return -1;
      if (isFinishedA && !isFinishedB) return 1;

      const timeA = parseCarrierDate(a.lastEventTime)?.getTime() ?? (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const timeB = parseCarrierDate(b.lastEventTime)?.getTime() ?? (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);

      return timeB - timeA;
    });
  }, [items]);

  if (!isOpen) return null;

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
              Recent Shipments ({items.length})
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
              Packages tracked on this device are automatically saved here
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {items.length > 0 && (
              <button
                type="button"
                className="action-btn"
                onClick={onClearAll}
                style={{ fontSize: 11, padding: "5px 10px" }}
              >
                Clear all
              </button>
            )}
            <button className="modal-close" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
          {items.length === 0 ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              No shipments tracked yet. Enter any tracking number to see it here.
            </div>
          ) : (
            <div className="results-list">
              {sortedItems.map((item, idx) => {
                const dateObj = new Date(item.updatedAt);

                return (
                  <div
                    key={item.trackingNumber}
                    className="result-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="result-index">#{String(idx + 1).padStart(2, "0")}</div>

                    <div className="result-body" style={{ minWidth: 0 }}>
                      <div className="result-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{item.trackingNumber}</span>
                        {item.customLabel && (
                          <span className="result-prefix" style={{ color: "var(--accent)" }}>
                            {item.customLabel}
                          </span>
                        )}
                      </div>

                      <div className="result-meta">
                        <span className="result-id">{item.carrierName || item.carrier}</span>
                        <span className="result-id" style={{ textTransform: "uppercase" }}>
                          {humanStatus(item.status)}
                        </span>
                        <span className="result-date">{relativeTime(dateObj)}</span>
                        {item.destination && (
                          <span className="result-prefix">To {item.destination}</span>
                        )}
                      </div>
                    </div>

                    <div className="result-actions">
                      <button
                        type="button"
                        className="action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.trackingNumber);
                        }}
                        style={{ padding: "6px 10px", fontSize: 11 }}
                        title="Remove"
                      >
                        ✕
                      </button>

                      <button
                        type="button"
                        className="action-btn primary"
                        onClick={() => {
                          onSelect(item.carrier, item.trackingNumber);
                          onClose();
                        }}
                      >
                        Track ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
