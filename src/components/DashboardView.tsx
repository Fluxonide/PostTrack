import React, { useState, useEffect, useCallback } from "react";
import { FaPlus, FaSync, FaBoxOpen } from "react-icons/fa";
import { useAuth } from "../lib/authContext";
import { showToast } from "../lib/toast";
import { ShipmentItem } from "./dashboard/types";
import { DashboardStats } from "./dashboard/DashboardStats";
import { ShipmentCard } from "./dashboard/ShipmentCard";
import { AddShipmentModal } from "./dashboard/AddShipmentModal";
import { ShipmentTimelineModal } from "./dashboard/ShipmentTimelineModal";

interface DashboardViewProps {
  onOpenTelegramModal: () => void;
  onTrackManual: (carrier: string, trackingNumber: string) => void;
}

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

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenTelegramModal,
  onTrackManual,
}) => {
  const { user, token } = useAuth();
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("all");

  // Modals & action states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
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

  const handleAddShipment = async (carrier: string, trackingNumber: string, label?: string) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ carrier, trackingNumber, label }),
      });

      const data = await res.json() as { shipment?: ShipmentItem; message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Failed to add shipment");
      }

      showToast("Shipment added to dashboard!");
      setIsAddOpen(false);
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

  const handleSaveLabel = async (id: string, newLabel: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ label: newLabel }),
      });
      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) => (s.id === id ? { ...s, label: newLabel.trim() || null } : s))
        );
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
      <DashboardStats
        totalCount={totalCount}
        activeCount={activeCount}
        deliveredCount={deliveredCount}
        user={user}
        onOpenTelegramModal={onOpenTelegramModal}
      />

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
          <button onClick={() => setFilter("all")} style={filterBtnStyle(filter === "all")}>
            All ({totalCount})
          </button>
          <button onClick={() => setFilter("active")} style={filterBtnStyle(filter === "active")}>
            Active ({activeCount})
          </button>
          <button onClick={() => setFilter("delivered")} style={filterBtnStyle(filter === "delivered")}>
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
            <ShipmentCard
              key={s.id}
              shipment={s}
              isSyncing={syncingId === s.id}
              copied={copiedId === s.id}
              onSync={handleSync}
              onDelete={handleDelete}
              onToggleAutoCheck={handleToggleAutoCheck}
              onSaveLabel={handleSaveLabel}
              onViewTimeline={setViewingShipment}
              onInspect={onTrackManual}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      {/* Add Shipment Modal */}
      <AddShipmentModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAddShipment}
        isSubmitting={isSubmitting}
      />

      {/* Timeline Modal */}
      <ShipmentTimelineModal
        shipment={viewingShipment}
        onClose={() => setViewingShipment(null)}
      />
    </div>
  );
};
