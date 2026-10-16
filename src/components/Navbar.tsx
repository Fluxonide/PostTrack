import React from "react";

interface NavbarProps {
  onOpenCarriers: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCarriers,
  onOpenHistory,
  historyCount,
}) => {
  return (
    <nav>
      <div className="nav-logo">
        <img className="nav-logo-icon" src="/logo.svg" alt="PostTrack" />
        <a href="/" style={{ color: "var(--text)", textDecoration: "none" }}>
          Post<span style={{ color: "var(--accent)" }}>Track</span>
        </a>
        <span className="nav-badge">v1.0</span>
      </div>

      <ul className="nav-links">
        <li>
          <a href="/" className="active">
            Tracker
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
        <li>
          <a
            href="https://github.com/Fluxonide/PostTrack"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </li>
      </ul>
    </nav>
  );
};
