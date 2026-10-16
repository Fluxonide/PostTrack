import React from "react";
import { FiX, FiExternalLink, FiTruck, FiArrowRight } from "react-icons/fi";
import { listCarriers } from "../carriers/registry";

interface CarriersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (carrier: string, trackingNumber: string) => void;
}

export const CarriersModal: React.FC<CarriersModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  const carriers = listCarriers();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-[#17140e] border border-[var(--border)] rounded-2xl p-6 sm:p-7 shadow-2xl z-10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[rgba(192,133,50,0.12)] border border-[rgba(192,133,50,0.25)] text-[var(--accent)]">
              <FiTruck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text)]">Supported Courier Directory</h2>
              <p className="text-xs text-[var(--text-2)]">
                7 integrated carrier scraping and public API engines
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Carrier Grid */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {carriers.map((c) => (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--surface-hover)] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[var(--text)]">{c.name}</h3>
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Website</span>
                    <FiExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-xs text-[var(--text-2)] mt-1">{c.description}</p>
                {c.sampleTracking && (
                  <div className="mt-2 text-[11px] font-mono text-[var(--text-3)]">
                    Format: <span className="text-[var(--text-2)]">{c.sampleTracking}</span>
                  </div>
                )}
              </div>

              {c.sampleTracking && (
                <button
                  onClick={() => {
                    onSelectSample(c.id, c.sampleTracking!);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(192,133,50,0.12)] border border-[rgba(192,133,50,0.25)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black font-semibold text-xs transition-all cursor-pointer flex-shrink-0"
                >
                  <span>Test Sample</span>
                  <FiArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
