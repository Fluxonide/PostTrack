import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./ShipmentMap.css";
import { extractJourneyPoints, MapPoint } from "../lib/geocoder";

interface ShipmentMapProps {
  origin?: string;
  destination?: string;
  events?: Array<{
    timestamp?: string;
    location?: string;
    description?: string;
    statusText?: string;
    status?: string;
  }>;
  status?: string;
  height?: string | number;
}

export const ShipmentMap: React.FC<ShipmentMapProps> = ({
  origin,
  destination,
  events,
  height = 360,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract and resolve route coordinates
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    extractJourneyPoints({ origin, destination, events })
      .then((pts) => {
        if (!isCancelled) {
          setPoints(pts);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [origin, destination, events]);

  // Initialize or update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;

    // Cleanup previous map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (points.length === 0) return;

    // Center map around first point or center of India
    const defaultCenter: [number, number] = [points[0].lat, points[0].lng];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 6,
      minZoom: 4,               // Stops zooming out into outer space / repeated world
      maxZoom: 16,              // Stops over-zooming past street level
      zoomDelta: 0.5,           // Gentle step when clicking + or -
      zoomSnap: 0.25,           // Smooth fractional zooming (no sudden jumps)
      wheelPxPerZoomLevel: 160, // Slower, highly controlled mouse wheel zoom (default is 60)
      wheelDebounceTime: 80,    // Absorbs fast trackpad wheel momentum
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Official OpenStreetMap tiles (100% Free, never requires an API key)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: "map-tiles-dark",
    }).addTo(map);

    const latLngs: L.LatLngExpression[] = [];

    // Add markers for all checkpoints
    points.forEach((pt, idx) => {
      latLngs.push([pt.lat, pt.lng]);

      let markerHtml = "";
      if (pt.isLatest) {
        // Glowing gold ring for the latest update
        markerHtml = `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(192, 133, 50, 0.35); animation: mapMarkerPulse 2s infinite;"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: #c08532; border: 2px solid #edecec; box-shadow: 0 0 10px #c08532;"></div>
          </div>
        `;
      } else if (pt.isDestination) {
        // Green destination marker
        markerHtml = `
          <div style="width: 18px; height: 18px; border-radius: 50%; background: #4ade80; border: 2px solid #14120b; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #14120b;"></div>
          </div>
        `;
      } else if (pt.isOrigin) {
        // Amber origin marker
        markerHtml = `
          <div style="width: 18px; height: 18px; border-radius: 50%; background: #d4a04a; border: 2px solid #14120b; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.6);">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #14120b;"></div>
          </div>
        `;
      } else {
        // Intermediate transit hub marker
        markerHtml = `
          <div style="width: 14px; height: 14px; border-radius: 50%; background: #211e15; border: 2px solid #c08532; display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #c08532;"></div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-map-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([pt.lat, pt.lng], { icon: customIcon }).addTo(map);

      // Popup content
      const popupHtml = `
        <div style="font-family: Inter, sans-serif; min-width: 180px; padding: 2px 0;">
          <div style="font-weight: 700; color: #edecec; font-size: 13px; margin-bottom: 3px;">
            ${pt.name}
          </div>
          <div style="font-size: 11px; color: #c08532; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
            ${pt.isLatest ? "📍 Latest Update" : pt.isOrigin ? "🛫 Origin Hub" : pt.isDestination ? "🎯 Destination" : "Transit Milestone"}
          </div>
          ${pt.statusText ? `<div style="font-size: 12px; color: #edecec; margin-bottom: 2px;">${pt.statusText}</div>` : ""}
          ${pt.time ? `<div style="font-size: 10px; color: rgba(237, 236, 236, 0.45); font-family: monospace;">${pt.time}</div>` : ""}
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: "dark-map-popup",
      });

      // Automatically open popup on the latest scan
      if (pt.isLatest) {
        marker.openPopup();
      }
    });

    // Draw route line if multiple points
    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: "#c08532",
        weight: 3,
        opacity: 0.85,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(map);

      // Fit map view to encompass all route markers with comfortable padding
      map.fitBounds(polyline.getBounds(), {
        padding: [45, 45],
        maxZoom: 10,
      });
    } else {
      map.setView(latLngs[0], 9);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [points, loading]);

  const fitRoute = () => {
    if (!mapInstanceRef.current || points.length === 0) return;
    if (points.length === 1) {
      mapInstanceRef.current.setView([points[0].lat, points[0].lng], 9);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 10,
    });
  };

  return (
    <div
      style={{
        background: "var(--color-bg-2)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Map Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--color-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            Live Transit Route
          </span>
          {points.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--accent)",
                background: "var(--color-surface)",
                padding: "2px 8px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--border)",
              }}
            >
              {points.length} {points.length === 1 ? "Checkpoint" : "Checkpoints"}
            </span>
          )}
        </div>

        {points.length > 0 && (
          <button
            type="button"
            onClick={fitRoute}
            title="Reset zoom to fit complete route"
            style={{
              background: "rgba(192, 133, 50, 0.08)",
              border: "1px solid rgba(192, 133, 50, 0.25)",
              color: "var(--accent)",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>⛶</span>
            <span>Fit Route</span>
          </button>
        )}
      </div>

      {/* Map Content Box */}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          background: "var(--color-bg)",
          position: "relative",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: "rgba(20, 18, 11, 0.8)",
              zIndex: 1000,
            }}
          >
            <div className="spinner" style={{ width: 22, height: 22 }} />
            <div style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--mono)" }}>
              Resolving geographic milestones…
            </div>
          </div>
        )}

        {!loading && points.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 20,
              textAlign: "center",
              color: "var(--text-3)",
            }}
          >
            <span style={{ fontSize: 24 }}>📍</span>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>
              No geographic coordinates available for this shipment yet.
            </div>
            <div style={{ fontSize: 11 }}>
              Milestones will appear on the map as soon as regional sorting scans are logged.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
