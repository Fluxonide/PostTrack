import React, { useState, useEffect, useRef } from "react";
import { AUTO_CARRIER } from "../carriers/detect";

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
  { id: "xpressbees", name: "XpressBees" },
  { id: "valmo", name: "Valmo (Meesho)" },
];

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTracking) setTrackingNumber(initialTracking);
    if (initialCarrier) setCarrier(initialCarrier);
  }, [initialTracking, initialCarrier]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = trackingNumber.trim();
    if (!cleaned || isLoading) return;
    onSearch(carrier, cleaned);
  };


  return (
    <section className="hero">
      <div className="hero-eyebrow">Real-Time Tracking</div>
      <h1>
        Track parcels,<br />
        <span>instantly.</span>
      </h1>
      <p className="hero-sub">
        Direct live multi-carrier tracking for Blue Dart, Delhivery, Ekart, XpressBees, Valmo, ST Courier, Professional Couriers, Amazon & Shiprocket — all from one place.
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


      </div>
    </section>
  );
};
