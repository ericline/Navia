"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export type MapMarker = {
  lng: number;
  lat: number;
  name: string;
};

export default function WorldMap({
  markers,
  loading = false,
}: {
  markers: MapMarker[];
  loading?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ backgroundColor: "rgb(149, 184, 209)" }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-xs text-darkBlue/70 bg-lightBlue/80 px-3 py-1.5 rounded-full">
            Loading your travels…
          </p>
        </div>
      )}

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 153 }}
        width={800}
        height={430}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#8A9FAD"
                stroke="rgb(149, 184, 209)"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#7A8F9D" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {markers.map((m, i) => {
          // Use only the first segment (city name) to keep the tooltip short
          const label = m.name.split(",")[0].trim();
          // Approximate text width at 10px font (~6px/char) + padding
          const tooltipW = Math.max(48, label.length * 6 + 18);
          const isHovered = hoveredIdx === i;

          return (
            <Marker key={`${m.lng}-${m.lat}-${i}`} coordinates={[m.lng, m.lat]}>
              <g
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Tooltip — rendered first so it sits behind nothing */}
                {isHovered && (
                  <g
                    transform="translate(0, -26)"
                    style={{ pointerEvents: "none" }}
                  >
                    {/* Background pill */}
                    <rect
                      x={-tooltipW / 2}
                      y={-14}
                      width={tooltipW}
                      height={16}
                      rx={4}
                      fill="white"
                      fillOpacity={0.95}
                      filter="drop-shadow(0 1px 4px rgba(0,0,0,0.18))"
                    />
                    {/* Label */}
                    <text
                      textAnchor="middle"
                      y={-2}
                      fontSize={10}
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fontWeight={500}
                      fill="rgb(43, 65, 98)"
                    >
                      {label}
                    </text>
                    {/* Caret pointing down to the dot */}
                    <polygon
                      points="0,5 -4,-1 4,-1"
                      fill="white"
                      fillOpacity={0.95}
                    />
                  </g>
                )}

                {/* Marker dot */}
                <circle
                  r={hoveredIdx === i ? 6 : 5}
                  fill="rgb(184, 107, 119)"
                  stroke="white"
                  strokeWidth={1.5}
                  style={{ transition: "r 0.1s" }}
                />
              </g>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
}
