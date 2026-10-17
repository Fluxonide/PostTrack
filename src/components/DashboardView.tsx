import React, { useState, useEffect, useCallback } from "react";
import {
  FaPlus,
  FaSync,
  FaTrash,
  FaTelegramPlane,
  FaCopy,
  FaCheck,
  FaEdit,
  FaBoxOpen,
  FaArrowRight,
  FaClock,
} from "react-icons/fa";
import { useAuth } from "../lib/authContext";
import { showToast } from "../lib/toast";
import { TrackingResult } from "../carriers/types";
import { JourneyProgress } from "./JourneyProgress";
import { detectCarriers, AUTO_CARRIER } from "../carriers/detect";

interface ShipmentItem {
  id: string;
  carrier: string;
  trackingNumber: string;
  label: string | null;
  status: string;
  statusText: string | null;
  origin: string | null;
  destination: string | null;
  lastEventText: string | null;
  lastEventTime: string | null;
  autoCheck: boolean;
  lastCheckedAt: string | null;
  cachedResult: TrackingResult | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardViewProps {
  onOpenTelegramModal: () => void;
  onTrackManual: (carrier: string, trackingNumber: string) => void;
}

const CARRIER_LIST = [
  { id: AUTO_CARRIER, name: "⚡ Auto Detect (Recommended)" },
  { id: "bluedart", name: "Blue Dart" },
  { id: "delhivery", name: "Delhivery" },
  { id: "ekart", name: "Ekart" },
  { id: "xpressbees", name: "XpressBees" },
  { id: "valmo", name: "Valmo (Meesho)" },
  { id: "stcourier", name: "ST Courier" },
  { id: "tpc", name: "The Professional Couriers" },
  { id: "amazon", name: "Amazon Shipping" },
  { id: "shiprocket", name: "Shiprocket" },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenTelegramModal,
  onTrackManual,
}) => {
  const { user, token } = useAuth();
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("all");

  // Add shipment modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCarrier, setNewCarrier] = useState(AUTO_CARRIER);
  const [newTracking, setNewTracking] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state per shipment
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Editing label inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState("");

  // Viewing full details modal
  const [viewingShipment, setViewingShipment] = useState<ShipmentItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/shipments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { shipments: ShipmentItem[] };
        setShipments(data.shipments || []);
      }
    } catch {
      showToast("Failed to load shipments.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const handleAddShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTracking.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          carrier: newCarrier,
          trackingNumber: newTracking.trim(),
          label: newLabel.trim() || undefined,
        }),
      });

      const data = await res.json() as { shipment?: ShipmentItem; message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Failed to add shipment");
      }

      showToast("Shipment added to dashboard!");
      setIsAddOpen(false);
      setNewTracking("");
      setNewLabel("");
      fetchShipments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error adding shipment", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (id: string) => {
    if (!token) return;
    setSyncingId(id);
    try {
      const res = await fetch(`/api/shipments/${id}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Shipment updated with latest carrier scans.");
        await fetchShipments();
      } else {
        showToast("Could not sync with carrier.", "error");
      }
    } catch {
      showToast("Sync request failed.", "error");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!token || shipments.length === 0) return;
    setIsRefreshingAll(true);
    showToast("Refreshing active shipments...");
    try {
      const activeItems = shipments.filter((s) => s.status !== "delivered");
      for (const item of activeItems) {
        await fetch(`/api/shipments/${item.id}/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      await fetchShipments();
      showToast("All active shipments synced!");
    } catch {
      showToast("Some shipments failed to sync.", "error");
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleDelete = async (id: string, trackingNumber: string) => {
    if (!token) return;
    if (!window.confirm(`Remove ${trackingNumber} from your dashboard?`)) return;

    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setShipments((prev) => prev.filter((s) => s.id !== id));
        showToast("Shipment removed.");
      }
    } catch {
      showToast("Error deleting shipment.", "error");
    }
  };

  const handleToggleAutoCheck = async (id: string, current: boolean) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ autoCheck: !current }),
      });
      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) => (s.id === id ? { ...s, autoCheck: !current } : s))
        );
        showToast(!current ? "Auto-check enabled" : "Auto-check paused");
      }
    } catch {
      showToast("Error updating auto-check setting.", "error");
    }
  };

  const handleSaveLabel = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ label: editLabelText }),
      });
      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) => (s.id === id ? { ...s, label: editLabelText.trim() || null } : s))
        );
        setEditingId(null);
        showToast("Label updated.");
      }
    } catch {
      showToast("Error updating label.", "error");
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Stats calculation
  const totalCount = shipments.length;
  const deliveredCount = shipments.filter((s) => s.status === "delivered").length;
  const activeCount = totalCount - deliveredCount;

  // Filtered shipments
  const filteredShipments = shipments.filter((s) => {
    if (filter === "active") return s.status !== "delivered";
    if (filter === "delivered") return s.status === "delivered";
    return true;
  });

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 20px" }}>
      {/* Top Banner / Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div className="stat-card" style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Tracked
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {totalCount}
          </div>
        </div>

        <div className="stat-card" style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active Shipments
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
            {activeCount}
          </div>
        </div>

        <div className="stat-card" style={statCardStyle}>
          <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Delivered
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-success)", marginTop: 4 }}>
            {deliveredCount}
          </div>
        </div>

        <div
          onClick={onOpenTelegramModal}
          style={{
            ...statCardStyle,
            cursor: "pointer",
            border: user?.telegramConnected
              ? "1px solid rgba(74, 222, 128, 0.3)"
              : "1px solid rgba(34, 158, 217, 0.3)",
            background: user?.telegramConnected
              ? "rgba(74, 222, 128, 0.05)"
              : "rgba(34, 158, 217, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Telegram Bot Alerts
            </div>
            <FaTelegramPlane color={user?.telegramConnected ? "var(--color-success)" : "#229ED9"} />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: user?.telegramConnected ? "var(--color-success)" : "#229ED9",
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {user?.telegramConnected ? (
              <>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)" }} />
                <span>Connected {user.telegramUsername ? `(@${user.telegramUsername})` : ""}</span>
              </>
            ) : (
              <span>Connect Telegram ↗</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {/* Filters */}
        <div style={{ display: "flex", gap: 6, background: "var(--color-bg)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
          <button
            onClick={() => setFilter("all")}
            style={filterBtnStyle(filter === "all")}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilter("active")}
            style={filterBtnStyle(filter === "active")}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilter("delivered")}
            style={filterBtnStyle(filter === "delivered")}
          >
            Delivered ({deliveredCount})
          </button>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSyncAll}
            disabled={isRefreshingAll || shipments.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--color-bg-2)",
              color: "var(--text)",
              fontSize: 13,
              cursor: isRefreshingAll ? "not-allowed" : "pointer",
            }}
            title="Refresh active shipments"
          >
            <FaSync className={isRefreshingAll ? "animate-spin" : ""} size={12} />
            <span>Sync All</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "#14120b",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <FaPlus size={12} />
            <span>Add Shipment</span>
          </button>
        </div>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-3)", fontSize: 14 }}>
          Loading your shipments...
        </div>
      ) : filteredShipments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "var(--color-surface)",
            borderRadius: "var(--radius)",
            border: "1px dashed var(--border)",
          }}
        >
          <FaBoxOpen size={48} style={{ color: "var(--text-3)", marginBottom: 14 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            {filter === "all" ? "No tracked shipments yet" : `No ${filter} shipments`}
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 18, maxWidth: 360, margin: "0 auto 18px auto" }}>
            Add your package tracking number to monitor real-time milestones and receive auto Telegram alerts.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              padding: "10px 18px",
              background: "var(--accent)",
              color: "#14120b",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Add Your First Shipment
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredShipments.map((s) => (
            <div
              key={s.id}
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
                    {editingId === s.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={editLabelText}
                          onChange={(e) => setEditLabelText(e.target.value)}
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
                          onClick={() => handleSaveLabel(s.id)}
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
                          onClick={() => setEditingId(null)}
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
                          {s.label || formatCarrierName(s.carrier)}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(s.id);
                            setEditLabelText(s.label || "");
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
                      {s.carrier}
                    </span>
                    <span style={{ color: "var(--text-2)" }}>{s.trackingNumber}</span>
                    <button
                      onClick={() => handleCopy(s.id, s.trackingNumber)}
                      style={{
                        background: "none",
                        border: "none",
                        color: copiedId === s.id ? "var(--color-success)" : "var(--text-3)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      title="Copy tracking number"
                    >
                      {copiedId === s.id ? <FaCheck size={11} /> : <FaCopy size={11} />}
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
                      ...getStatusBadgeStyle(s.status),
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: getStatusDotColor(s.status),
                      }}
                    />
                    <span>{formatStatusText(s.status, s.statusText)}</span>
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
                {(s.origin || s.destination) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)" }}>
                    <span style={{ color: "var(--text)" }}>{s.origin || "Origin"}</span>
                    <FaArrowRight size={10} style={{ color: "var(--text-3)" }} />
                    <span style={{ color: "var(--text)" }}>{s.destination || "Destination"}</span>
                  </div>
                )}

                {s.lastEventText ? (
                  <div style={{ fontSize: 13, color: "var(--text)", display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1 }}>{s.lastEventText}</span>
                    {s.lastEventTime && (
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                        {s.lastEventTime}
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
                    color: s.autoCheck ? "var(--text)" : "var(--text-3)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={s.autoCheck}
                    onChange={() => handleToggleAutoCheck(s.id, s.autoCheck)}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                  <span>Auto-check (Periodic sync & alerts)</span>
                </label>

                {/* Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.cachedResult && (
                    <button
                      onClick={() => setViewingShipment(s)}
                      style={actionBtnStyle}
                      title="View full journey timeline"
                    >
                      <FaClock size={12} />
                      <span>Timeline</span>
                    </button>
                  )}

                  <button
                    onClick={() => onTrackManual(s.carrier, s.trackingNumber)}
                    style={actionBtnStyle}
                    title="Track directly in search page"
                  >
                    <span>Inspect</span>
                  </button>

                  <button
                    onClick={() => handleSync(s.id)}
                    disabled={syncingId === s.id}
                    style={actionBtnStyle}
                    title="Force refresh now"
                  >
                    <FaSync className={syncingId === s.id ? "animate-spin" : ""} size={12} />
                    <span>{syncingId === s.id ? "Syncing..." : "Sync"}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(s.id, s.trackingNumber)}
                    style={{ ...actionBtnStyle, color: "var(--color-error)" }}
                    title="Remove from dashboard"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Shipment Modal */}
      {isAddOpen && (
        <div className="modal-overlay open" onClick={() => setIsAddOpen(false)}>
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
              <button className="modal-close" onClick={() => setIsAddOpen(false)} title="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddShipment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                  Courier Carrier
                </label>
                <select
                  value={newCarrier}
                  onChange={(e) => setNewCarrier(e.target.value)}
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
                  value={newTracking}
                  onChange={(e) => setNewTracking(e.target.value)}
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
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                  Package Nickname (Optional)
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
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
      )}

      {/* Timeline Modal */}
      {viewingShipment && viewingShipment.cachedResult && (
        <div className="modal-overlay open" onClick={() => setViewingShipment(null)}>
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
                  {viewingShipment.label || viewingShipment.carrier.toUpperCase()} Journey
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4, fontFamily: "var(--mono)" }}>
                  {viewingShipment.trackingNumber}
                </div>
              </div>
              <button className="modal-close" onClick={() => setViewingShipment(null)} title="Close">
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              <JourneyProgress events={viewingShipment.cachedResult.events || []} />

              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: 14, color: "var(--text)", marginBottom: 12 }}>Activity History</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {viewingShipment.cachedResult.events?.map((ev, idx) => (
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
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--mono)" }}>{ev.timestamp}</span>
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
      )}
    </div>
  );
};

const statCardStyle: React.CSSProperties = {
  background: "var(--color-bg-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px 18px",
};

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  background: active ? "var(--color-bg-3)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-2)",
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s",
});

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

function formatCarrierName(carrier: string): string {
  const hit = CARRIER_LIST.find((c) => c.id === carrier.toLowerCase());
  return hit ? hit.name : carrier.toUpperCase();
}

function formatStatusText(status: string, statusText: string | null): string {
  if (statusText) return statusText;
  switch (status.toLowerCase()) {
    case "delivered":
      return "Delivered";
    case "out_for_delivery":
      return "Out for Delivery";
    case "in_transit":
      return "In Transit";
    case "picked_up":
      return "Picked Up";
    case "exception":
      return "Delivery Exception";
    case "returned":
      return "Returned";
    case "pending":
      return "Pending";
    default:
      return "Unknown";
  }
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  switch (status.toLowerCase()) {
    case "delivered":
      return { background: "rgba(74, 222, 128, 0.12)", color: "#4ade80" };
    case "out_for_delivery":
      return { background: "rgba(251, 191, 36, 0.12)", color: "#fbbf24" };
    case "in_transit":
      return { background: "rgba(192, 133, 50, 0.15)", color: "var(--accent)" };
    case "exception":
    case "returned":
      return { background: "rgba(248, 113, 113, 0.12)", color: "#f87171" };
    default:
      return { background: "var(--color-surface)", color: "var(--text-2)" };
  }
}

function getStatusDotColor(status: string): string {
  switch (status.toLowerCase()) {
    case "delivered":
      return "#4ade80";
    case "out_for_delivery":
      return "#fbbf24";
    case "in_transit":
      return "var(--accent)";
    case "exception":
    case "returned":
      return "#f87171";
    default:
      return "var(--text-3)";
  }
}
