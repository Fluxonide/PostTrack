import React from "react";
import { FaUser, FaTelegramPlane, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "../lib/authContext";

interface NavbarProps {
  activeView: "tracker" | "dashboard";
  onSelectView: (view: "tracker" | "dashboard") => void;
  onOpenCarriers: () => void;
  onOpenHistory: () => void;
  onOpenAuth: () => void;
  onOpenTelegram: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onSelectView,
  onOpenCarriers,
  onOpenHistory,
  onOpenAuth,
  onOpenTelegram,
  historyCount,
}) => {
  const { user, logout } = useAuth();

  return (
    <nav>
      <div className="nav-logo">
        <img className="nav-logo-icon" src="/logo.svg" alt="PostTrack" />
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectView("tracker");
          }}
          style={{ color: "var(--text)", textDecoration: "none" }}
        >
          Post<span style={{ color: "var(--accent)" }}>Track</span>
        </a>
        <span className="nav-badge">v1.0</span>
      </div>

      <ul className="nav-links">
        <li>
          <a
            onClick={() => onSelectView("tracker")}
            className={activeView === "tracker" ? "active" : ""}
            style={{ cursor: "pointer" }}
          >
            Tracker
          </a>
        </li>
        <li>
          <a
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                onSelectView("dashboard");
              }
            }}
            className={activeView === "dashboard" ? "active" : ""}
            style={{ cursor: "pointer" }}
          >
            Dashboard
          </a>
        </li>
        <li>
          <a onClick={onOpenCarriers} style={{ cursor: "pointer" }}>
            Carriers
          </a>
        </li>
        <li>
          <a onClick={onOpenHistory} style={{ cursor: "pointer" }}>
            Recent {historyCount > 0 ? `(${historyCount})` : ""}
          </a>
        </li>

        {/* User / Auth section */}
        {user ? (
          <li style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <button
              onClick={onOpenTelegram}
              title={user.telegramConnected ? "Telegram Connected" : "Connect Telegram"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: user.telegramConnected
                  ? "rgba(74, 222, 128, 0.12)"
                  : "rgba(34, 158, 217, 0.12)",
                color: user.telegramConnected ? "#4ade80" : "#229ED9",
                border: user.telegramConnected
                  ? "1px solid rgba(74, 222, 128, 0.3)"
                  : "1px solid rgba(34, 158, 217, 0.3)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <FaTelegramPlane size={13} />
              <span>{user.telegramConnected ? "Alerts On" : "Connect Bot"}</span>
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--color-surface)",
                padding: "4px 10px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text)",
              }}
            >
              <FaUser size={11} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 500 }}>{user.username}</span>
              <button
                onClick={logout}
                title="Log Out"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-3)",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <FaSignOutAlt size={12} />
              </button>
            </div>
          </li>
        ) : (
          <li style={{ marginLeft: 8 }}>
            <button
              onClick={onOpenAuth}
              style={{
                padding: "6px 14px",
                background: "var(--accent)",
                color: "#14120b",
                border: "none",
                borderRadius: "var(--radius-pill)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
};
