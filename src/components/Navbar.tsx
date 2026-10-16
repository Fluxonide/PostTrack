import React, { useEffect, useState } from "react";
import { FiClock, FiGrid, FiGithub, FiActivity } from "react-icons/fi";

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
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? setApiOnline(true) : setApiOnline(false)))
      .catch(() => setApiOnline(false));
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-[var(--border)] bg-[#14120b]/85 backdrop-blur-xl">
      {/* Brand logo */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.svg"
            alt="PostTrack"
            className="w-8 h-8 rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--text)] flex items-center gap-1.5">
              Post<span className="text-[var(--accent)]">Track</span>
            </span>
          </div>
        </a>
        <span className="hidden xs:inline-block text-[10px] font-mono font-medium text-[var(--accent)] bg-[rgba(192,133,50,0.1)] border border-[rgba(192,133,50,0.22)] px-2 py-0.5 rounded-full tracking-wider uppercase">
          v1.0
        </span>
      </div>

      {/* Navigation action buttons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* API Health indicator */}
        <div
          title={apiOnline ? "Tracking Engine: Active" : "Checking engine connection..."}
          className="hidden md:flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)]"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              apiOnline === true
                ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ade80]"
                : apiOnline === false
                ? "bg-rose-400"
                : "bg-amber-400"
            }`}
          />
          <span className="text-[11px]">
            {apiOnline === true ? "Engine Ready" : apiOnline === false ? "Offline" : "Connecting"}
          </span>
        </div>

        {/* Carriers Modal Button */}
        <button
          onClick={onOpenCarriers}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
        >
          <FiGrid className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="hidden sm:inline">Supported</span> Carriers
        </button>

        {/* History Button */}
        <button
          onClick={onOpenHistory}
          className="relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
        >
          <FiClock className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Recent</span>
          {historyCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-[var(--accent)] text-black">
              {historyCount}
            </span>
          )}
        </button>

        {/* GitHub link */}
        <a
          href="https://github.com/Fluxonide/PostTrack"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all"
          title="GitHub Repository"
        >
          <FiGithub className="w-4 h-4" />
        </a>
      </div>
    </nav>
  );
};
