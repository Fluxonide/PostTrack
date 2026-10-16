import React from "react";

export default function App() {
  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans selection:bg-[var(--accent)] selection:text-white">
      {/* Ambient background glows */}
      <div className="glow-orb-top" />
      <div className="glow-orb-bottom" />

      {/* Sticky glassmorphic navbar matching v2 aesthetic */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 md:px-10 border-b border-[var(--border)] bg-[#14120b]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="PostTrack Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-[var(--text)]">PostTrack</span>
          <span className="text-[10px] font-mono font-medium text-[var(--accent)] bg-[rgba(192,133,50,0.12)] border border-[rgba(192,133,50,0.25)] px-2 py-0.5 rounded-full tracking-wider uppercase">
            v1.0
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-2)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Core Engines Active
          </span>
        </div>
      </nav>

      {/* Foundation hero banner */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] mb-6 shadow-sm">
          <span>⚡ Next-Gen Indian & Global Couriers Tracker</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-[var(--text)]">
          Post<span className="text-[var(--accent)]">Track</span>
        </h1>
        <p className="text-sm md:text-base text-[var(--text-2)] max-w-lg mb-8 leading-relaxed">
          Modern luxury UI/UX tracking with carrier engines for Blue Dart, Delhivery, ST Courier, Professional Couriers, Ekart, Amazon Shipping & Shiprocket.
        </p>
      </main>
    </div>
  );
}
