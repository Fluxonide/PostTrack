import React, { useState, useEffect, useRef } from "react";
import { FiSearch, FiZap, FiX, FiArrowRight, FiCheck } from "react-icons/fi";
import { AUTO_CARRIER, detectCarriers } from "../carriers/detect";

interface CarrierOption {
  id: string;
  name: string;
  sample?: string;
}

const CARRIER_OPTIONS: CarrierOption[] = [
  { id: AUTO_CARRIER, name: "✨ Auto Detect" },
  { id: "bluedart", name: "Blue Dart", sample: "42183920194" },
  { id: "delhivery", name: "Delhivery", sample: "1234567890123" },
  { id: "ekart", name: "Ekart (Flipkart)", sample: "FMPP4307095480" },
  { id: "amazon", name: "Amazon Shipping", sample: "109283746501" },
  { id: "stcourier", name: "ST Courier", sample: "10987654321" },
  { id: "tpc", name: "The Professional Couriers", sample: "PON8334106" },
  { id: "shiprocket", name: "Shiprocket", sample: "SR123456789" },
];

const CARRIER_NAME_MAP: Record<string, string> = {
  bluedart: "Blue Dart",
  delhivery: "Delhivery",
  ekart: "Ekart Logistics",
  amazon: "Amazon Shipping",
  stcourier: "ST Courier",
  tpc: "Professional Couriers",
  shiprocket: "Shiprocket",
};

interface SearchHeroProps {
  onSearch: (carrier: string, trackingNumber: string) => void;
  isLoading: boolean;
  initialTracking?: string;
  initialCarrier?: string;
}

export const SearchHero: React.FC<SearchHeroProps> = ({
  onSearch,
  isLoading,
  initialTracking = "",
  initialCarrier = AUTO_CARRIER,
}) => {
  const [carrier, setCarrier] = useState(initialCarrier);
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [detectedCandidates, setDetectedCandidates] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTracking) {
      setTrackingNumber(initialTracking);
    }
    if (initialCarrier) {
      setCarrier(initialCarrier);
    }
  }, [initialTracking, initialCarrier]);

  // Live carrier detection as user types
  useEffect(() => {
    const trimmed = trackingNumber.trim();
    if (!trimmed) {
      setDetectedCandidates([]);
      return;
    }
    const matches = detectCarriers(trimmed);
    setDetectedCandidates(matches);
  }, [trackingNumber]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = trackingNumber.trim();
    if (!cleaned || isLoading) return;
    onSearch(carrier, cleaned);
  };

  const handleSampleClick = (sampleNum: string, carrierId?: string) => {
    setTrackingNumber(sampleNum);
    if (carrierId) setCarrier(carrierId);
    if (inputRef.current) inputRef.current.focus();
    onSearch(carrierId || AUTO_CARRIER, sampleNum);
  };

  return (
    <div className="w-full max-w-3xl mx-auto pt-8 pb-4 px-4 text-center">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] mb-5 shadow-sm">
        <FiZap className="w-3.5 h-3.5 text-[var(--accent-2)]" />
        <span>Unified Multi-Carrier Tracking Engine</span>
      </div>

      {/* Main Title with golden gradient */}
      <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-3 text-[var(--text)]">
        Track Any Indian & Global <br className="hidden sm:inline" />
        <span className="bg-gradient-to-r from-[#e7af56] via-[#c08532] to-[#d4a04a] bg-clip-text text-transparent">
          Shipment in Real-Time
        </span>
      </h1>

      <p className="text-xs sm:text-sm text-[var(--text-2)] max-w-lg mx-auto mb-7 leading-relaxed">
        Direct live scrape and API intelligence for Blue Dart, Delhivery, Ekart, ST Courier, Professional Couriers, Amazon & Shiprocket.
      </p>

      {/* Search Container Card */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2 sm:p-2.5 transition-all duration-300 shadow-2xl hover:border-[var(--border-hover)] focus-within:border-[rgba(192,133,50,0.5)] focus-within:shadow-[0_0_35px_rgba(192,133,50,0.15)]"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Carrier Select Dropdown */}
          <div className="relative min-w-[160px] sm:min-w-[180px]">
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full bg-[#1a1710] border border-[var(--border)] text-[var(--text)] text-xs sm:text-sm font-medium rounded-xl py-3 px-3.5 pr-8 appearance-none focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
            >
              {CARRIER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#1a1710] text-[#edecec]">
                  {opt.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-3)]">
              <svg className="fill-current h-3 w-3" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>

          {/* Input field */}
          <div className="relative flex-1 flex items-center">
            <FiSearch className="absolute left-3.5 w-4 h-4 text-[var(--text-3)] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking / AWB / consignment number..."
              className="w-full bg-transparent text-[var(--text)] text-sm sm:text-base font-mono pl-10 pr-9 py-3 focus:outline-none placeholder:text-[var(--text-3)] placeholder:font-sans"
              autoFocus
              spellCheck={false}
            />
            {trackingNumber && (
              <button
                type="button"
                onClick={() => {
                  setTrackingNumber("");
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="absolute right-3 p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-all"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!trackingNumber.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#c08532] to-[#d4a04a] text-black font-semibold text-xs sm:text-sm tracking-wide shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Tracking...</span>
              </>
            ) : (
              <>
                <span>Track</span>
                <FiArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Live Detection Feedback Bar */}
        {carrier === AUTO_CARRIER && detectedCandidates.length > 0 && trackingNumber.trim() && (
          <div className="mt-2.5 pt-2 border-t border-[var(--border)] flex items-center justify-between text-left px-2 text-[11px] font-mono text-[var(--text-2)]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[var(--accent)] font-semibold flex items-center gap-1">
                <FiCheck className="w-3 h-3 text-[var(--accent)]" /> Detected pattern:
              </span>
              {detectedCandidates.map((cId) => (
                <span
                  key={cId}
                  className="bg-[rgba(192,133,50,0.12)] border border-[rgba(192,133,50,0.25)] text-[var(--accent)] px-2 py-0.5 rounded-full"
                >
                  {CARRIER_NAME_MAP[cId] || cId}
                </span>
              ))}
            </div>
            <span className="hidden sm:inline text-[var(--text-3)]">Auto-routing active</span>
          </div>
        )}
      </form>

      {/* Quick Test Samples */}
      <div className="mt-4 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap text-xs text-[var(--text-3)] font-mono">
        <span className="text-[11px] text-[var(--text-3)] font-sans">Try sample:</span>
        <button
          onClick={() => handleSampleClick("FMPP4307095480", "ekart")}
          className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          Ekart
        </button>
        <button
          onClick={() => handleSampleClick("42183920194", "bluedart")}
          className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          Blue Dart
        </button>
        <button
          onClick={() => handleSampleClick("1234567890123", "delhivery")}
          className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          Delhivery
        </button>
        <button
          onClick={() => handleSampleClick("PON8334106", "tpc")}
          className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          TPC
        </button>
        <button
          onClick={() => handleSampleClick("10987654321", "stcourier")}
          className="px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          ST Courier
        </button>
      </div>
    </div>
  );
};
