import React from "react";
import { FaTelegramPlane } from "react-icons/fa";
import { PublicUser } from "../../lib/authContext";

interface DashboardStatsProps {
  totalCount: number;
  activeCount: number;
  deliveredCount: number;
  user: PublicUser | null;
  onOpenTelegramModal: () => void;
}

const statCardStyle: React.CSSProperties = {
  background: "var(--color-bg-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "16px 18px",
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalCount,
  activeCount,
  deliveredCount,
  user,
  onOpenTelegramModal,
}) => {
  return (
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
  );
};
