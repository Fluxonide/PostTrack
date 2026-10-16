import React from "react";
import { FiX, FiTrash2, FiClock, FiArrowRight, FiTag, FiPackage } from "react-icons/fi";
import type { StoredTrackingItem } from "../lib/storage";
import { STATUS_CONFIG } from "../lib/status";
import { relativeTime } from "../lib/dates";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[#17140e] border-l border-[var(--border)] h-full p-5 sm:p-6 flex flex-col shadow-2xl z-10 animate-fade-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FiClock className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-base font-bold text-[var(--text)]">Recent Shipments</h2>
            <span className="text-xs font-mono text-[var(--accent)] bg-[rgba(192,133,50,0.1)] px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[11px] font-mono text-[var(--text-3)] hover:text-rose-400 p-1 transition-colors"
                title="Clear History"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-[var(--text-3)]">
              <FiPackage className="w-10 h-10 mb-3 opacity-30 text-[var(--accent)]" />
              <p className="text-sm font-medium">No recent tracking searches</p>
              <p className="text-xs mt-1">Track any package to automatically save it here.</p>
            </div>
          ) : (
            items.map((item) => {
              const meta = STATUS_CONFIG[item.status] || STATUS_CONFIG.unknown;
              const dateObj = new Date(item.updatedAt);

              return (
                <div
                  key={item.trackingNumber}
                  className="group relative p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[rgba(192,133,50,0.1)] text-[var(--accent)] font-semibold">
                          {item.carrierName || item.carrier}
                        </span>

                        {item.customLabel && (
                          <span className="text-[11px] font-medium text-[var(--text-2)] flex items-center gap-1">
                            <FiTag className="w-2.5 h-2.5 text-[var(--accent)]" />
                            {item.customLabel}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 font-mono text-sm font-bold text-[var(--text)] truncate">
                        {item.trackingNumber}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: meta.badgeBg,
                        color: meta.textColor,
                        border: `1px solid ${meta.badgeBorder}`,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {item.lastEventDescription && (
                    <p className="text-xs text-[var(--text-3)] truncate">
                      {item.lastEventDescription}
                    </p>
                  )}

                  {/* Actions & Timestamp */}
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)] text-[11px] font-mono text-[var(--text-3)]">
                    <span>{relativeTime(dateObj)}</span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRemove(item.trackingNumber)}
                        className="p-1 hover:text-rose-400 text-[var(--text-3)] transition-colors"
                        title="Remove"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          onSelect(item.carrier, item.trackingNumber);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)] text-black font-semibold text-xs hover:brightness-110 transition-all cursor-pointer"
                      >
                        <span>Track</span>
                        <FiArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
