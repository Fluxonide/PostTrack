import React, { useState, useEffect, useRef } from "react";
import { AUTO_CARRIER, detectCarriers } from "../carriers/detect";

interface CarrierTab {
  id: string;
  name: string;
}

const CARRIER_TABS: CarrierTab[] = [
  { id: AUTO_CARRIER, name: "Auto Detect" },
  { id: "bluedart", name: "Blue Dart" },
  { id: "delhivery", name: "Delhivery" },
  { id: "ekart", name: "Ekart" },
  { id: "stcourier", name: "ST Courier" },
  { id: "tpc", name: "TPC" },
  { id: "amazon", name: "Amazon" },
  { id: "shiprocket", name: "Shiprocket" },
];

const CARRIER_NAME_MAP: Record<string, string> = {
  bluedart: "Blue Dart",
  delhivery: "Delhivery",
  ekart: "Ekart Logistics (Flipkart)",
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
    if (initialTracking) setTrackingNumber(initialTracking);
    if (initialCarrier) setCarrier(initialCarrier);
  }, [initialTracking, initialCarrier]);

  useEffect(() => {
    const trimmed = trackingNumber.trim();
    if (!trimmed) {
      setDetectedCandidates([]);
      return;
    }
    setDetectedCandidates(detectCarriers(trimmed));
  }, [trackingNumber]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = trackingNumber.trim();
    if (!cleaned || isLoading) return;
    onSearch(carrier, cleaned);
  };

  const handleSampleClick = (cId: string, sampleNum: string) => {
    setTrackingNumber(sampleNum);
    setCarrier(cId);
    if (inputRef.current) inputRef.current.focus();
    onSearch(cId, sampleNum);
  };

  return (
    <section className="hero">
      <div className="hero-eyebrow">Real-Time Tracking</div>
      <h1>
        Track parcels,<br />
        <span>instantly.</span>
      </h1>
      <p className="hero-sub">
        Direct live multi-carrier tracking for Blue Dart, Delhivery, Ekart, ST Courier, Professional Couriers, Amazon & Shiprocket — all from one place.
      </p>

      <div className="search-wrap">
        <form onSubmit={handleSubmit} className="search-box" style={{ paddingLeft: 12 }}>
          {/* Integrated Carrier Dropdown inside the search bar line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingRight: 10,
              marginRight: 6,
              borderRight: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <select
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              aria-label="Select carrier"
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                background: "transparent",
                color: carrier === AUTO_CARRIER ? "var(--text-2)" : "var(--accent)",
                border: "none",
                outline: "none",
                fontSize: 13,
                fontFamily: "var(--mono)",
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 20px 6px 4px",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23c08532' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 2px center",
              }}
            >
              {CARRIER_TABS.map((tab) => (
                <option
                  key={tab.id}
                  value={tab.id}
                  style={{
                    background: "#14120b",
                    color: "#edecec",
                  }}
                >
                  {tab.name}
                </option>
              ))}
            </select>
          </div>

          <svg
            className="search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            id="search-input"
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder='Enter tracking / AWB / consignment… e.g. "FMPP4307095480"'
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="submit"
            className="search-btn"
            disabled={!trackingNumber.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Tracking…</span>
              </>
            ) : (
              <>
                <span>Track</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Pattern detection label if auto-detect */}
        {carrier === AUTO_CARRIER && detectedCandidates.length > 0 && trackingNumber.trim() && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 12,
              fontFamily: "var(--mono)",
            }}
          >
            <span className="result-prefix">Pattern match</span>
            {detectedCandidates.map((cId) => (
              <span key={cId} className="result-id">
                {CARRIER_NAME_MAP[cId] || cId}
              </span>
            ))}
          </div>
        )}

        {/* Hints */}
        <div className="search-hints">
          <span className="hint-label">Try sample:</span>
          <button
            type="button"
            className="hint-chip"
            onClick={() => handleSampleClick("ekart", "FMPP4307095480")}
          >
            Ekart: FMPP4307095480
          </button>
          <button
            type="button"
            className="hint-chip"
            onClick={() => handleSampleClick("bluedart", "42183920194")}
          >
            Blue Dart: 42183920194
          </button>
          <button
            type="button"
            className="hint-chip"
            onClick={() => handleSampleClick("delhivery", "1234567890123")}
          >
            Delhivery: 1234567890123
          </button>
          <button
            type="button"
            className="hint-chip"
            onClick={() => handleSampleClick("tpc", "PON8334106")}
          >
            TPC: PON8334106
          </button>
          <button
            type="button"
            className="hint-chip"
            onClick={() => handleSampleClick("stcourier", "10987654321")}
          >
            ST Courier: 10987654321
          </button>
        </div>
      </div>
    </section>
  );
};
