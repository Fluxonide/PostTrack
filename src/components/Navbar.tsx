import React, { useEffect, useState } from "react";
import {
  FaUser,
  FaTelegramPlane,
  FaSignOutAlt,
  FaSun,
  FaMoon,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { useAuth } from "../lib/authContext";
import { useTheme } from "../lib/themeContext";

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
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu when the viewport grows back to desktop size.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 641px)");
    const handleChange = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Close on Escape or when tapping outside the menu.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".nav-mobile-menu") || target.closest(".nav-mobile-toggle")) return;
      setMobileOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav>
      <div className="nav-logo">
        <img className="nav-logo-icon" src="/logo.svg" alt="PostTrack" />
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectView("tracker");
            closeMobile();
          }}
          style={{ color: "var(--text)", textDecoration: "none" }}
        >
          Post<span style={{ color: "var(--accent)" }}>Track</span>
        </a>
        <span className="nav-badge">v1.0</span>
      </div>

      <div className="nav-actions">
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
                    ? "var(--status-delivered-bg, rgba(74, 222, 128, 0.12))"
                    : "rgba(34, 158, 217, 0.12)",
                  color: user.telegramConnected ? "var(--status-delivered-text, #4ade80)" : "#0284c7",
                  border: user.telegramConnected
                    ? "1px solid var(--status-delivered-border, rgba(74, 222, 128, 0.3))"
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
                  color: "var(--accent-contrast, #ffffff)",
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

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: "var(--radius-pill)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--accent)",
            cursor: "pointer",
            transition: "all var(--transition)",
            flexShrink: 0,
          }}
        >
          {theme === "dark" ? <FaSun size={15} /> : <FaMoon size={15} />}
        </button>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="nav-mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="nav-mobile-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className={activeView === "tracker" ? "active" : ""}
            onClick={() => {
              onSelectView("tracker");
              closeMobile();
            }}
          >
            Tracker
          </button>
          <button
            type="button"
            role="menuitem"
            className={activeView === "dashboard" ? "active" : ""}
            onClick={() => {
              closeMobile();
              if (!user) {
                onOpenAuth();
              } else {
                onSelectView("dashboard");
              }
            }}
          >
            Dashboard
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMobile();
              onOpenCarriers();
            }}
          >
            Carriers
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMobile();
              onOpenHistory();
            }}
          >
            Recent {historyCount > 0 ? `(${historyCount})` : ""}
          </button>

          <div className="nav-mobile-divider" />

          {user ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMobile();
                  onOpenTelegram();
                }}
              >
                <FaTelegramPlane size={13} />
                {user.telegramConnected ? "Telegram Alerts On" : "Connect Telegram"}
              </button>
              <div className="nav-mobile-user">
                <span>
                  <FaUser size={11} style={{ color: "var(--accent)" }} />
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    logout();
                  }}
                  title="Log Out"
                >
                  <FaSignOutAlt size={12} />
                  Log out
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="nav-mobile-signin"
              onClick={() => {
                closeMobile();
                onOpenAuth();
              }}
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </nav>
  );
};
