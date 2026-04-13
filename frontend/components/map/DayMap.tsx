/** DayMap - Interactive Mapbox GL map showing activity markers and driving/walking routes for a single day. */
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Activity, Day } from "@/lib/api";
import { useDayRoutes, RouteSegment } from "@/hooks/useDayRoutes";
import {
  formatTime,
  getCategoryKey,
  CATEGORY_ACCENT_CLASSES,
} from "@/lib/utils";
import { ArrowLeft, Footprints, Car, MapPin } from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Map category keys to hex colors for map markers
const CATEGORY_MARKER_COLORS: Record<string, string> = {
  food: "#fb923c",
  cafe: "#f59e0b",
  bar: "#fb7185",
  museum: "#a855f7",
  park: "#22c55e",
  beach: "#facc15",
  shopping: "#f472b6",
  nightlife: "#818cf8",
  worship: "#2dd4bf",
  wellness: "#34d399",
  transport: "#94a3b8",
  hotel: "#60a5fa",
  entertainment: "#e879f9",
  landmark: "#22d3ee",
  other: "#95b8d1",
};

interface DayMapProps {
  day: Day;
  activities: Activity[];
  tripName: string;
  onBack: () => void;
}

export default function DayMap({
  day,
  activities,
  tripName,
  onBack,
}: DayMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Activities with coordinates, in order
  const mappedActivities = activities.filter(
    (a) => a.lat != null && a.lng != null
  );
  const unmappedActivities = activities.filter(
    (a) => a.lat == null || a.lng == null
  );

  const { routes, loading: routesLoading } = useDayRoutes(activities);

  // Fit bounds once on initial load
  const hasFitRef = useRef(false);

  useEffect(() => {
    if (hasFitRef.current || mappedActivities.length === 0) return;
    const t = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      hasFitRef.current = true;

      if (mappedActivities.length === 1) {
        map.flyTo({
          center: [mappedActivities[0].lng!, mappedActivities[0].lat!],
          zoom: 15,
          duration: 800,
        });
        return;
      }

      const lngs = mappedActivities.map((a) => a.lng!);
      const lats = mappedActivities.map((a) => a.lat!);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, duration: 800 }
      );
    }, 300);
    return () => clearTimeout(t);
  }, [mappedActivities]);

  // Format date for header
  const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );

  function fitAllMarkers() {
    const map = mapRef.current;
    if (!map || mappedActivities.length === 0) return;
    if (mappedActivities.length === 1) {
      map.flyTo({ center: [mappedActivities[0].lng!, mappedActivities[0].lat!], zoom: 15, duration: 600 });
      return;
    }
    const lngs = mappedActivities.map((a) => a.lng!);
    const lats = mappedActivities.map((a) => a.lat!);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 600 }
    );
  }

  function handleActivityClick(idx: number) {
    const deselecting = idx === selectedIdx;
    setSelectedIdx(deselecting ? null : idx);

    if (deselecting) {
      fitAllMarkers();
      return;
    }

    const a = activities[idx];
    if (a.lat != null && a.lng != null) {
      mapRef.current?.flyTo({
        center: [a.lng!, a.lat!],
        zoom: 16,
        duration: 600,
      });
    }
  }

  // Build route GeoJSON for each segment
  const routeFeatures = routes.map((seg, i) => ({
    type: "Feature" as const,
    properties: { mode: seg.mode, index: i },
    geometry: seg.geometry,
  }));

  return (
    <div className="flex flex-col h-screen bg-warmBg">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-black/10 bg-warmBg z-10">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/50"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-black/80 truncate">
            {day.name || dateLabel}
          </h1>
          <p className="text-xs text-black/40 truncate">
            {tripName} &middot; {dateLabel}
          </p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {mappedActivities.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <MapPin className="h-12 w-12 text-black/15 mx-auto mb-3" />
                <p className="text-sm text-black/40">
                  No activities with locations yet.
                </p>
                <p className="text-xs text-black/25 mt-1">
                  Add addresses to your activities to see them on the map.
                </p>
              </div>
            </div>
          ) : (
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: mappedActivities[0]?.lng ?? 0,
                latitude: mappedActivities[0]?.lat ?? 0,
                zoom: 13,
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/light-v11"
            >
              {/* Route lines */}
              {routeFeatures.length > 0 && (
                <Source
                  id="routes"
                  type="geojson"
                  data={{
                    type: "FeatureCollection",
                    features: routeFeatures,
                  }}
                >
                  {/* Driving routes — solid line */}
                  <Layer
                    id="route-driving"
                    type="line"
                    filter={["==", ["get", "mode"], "driving"]}
                    paint={{
                      "line-color": "#94a3b8",
                      "line-width": 3,
                      "line-opacity": 0.7,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                  {/* Walking routes — dashed line */}
                  <Layer
                    id="route-walking"
                    type="line"
                    filter={["==", ["get", "mode"], "walking"]}
                    paint={{
                      "line-color": "#4b86b4",
                      "line-width": 3,
                      "line-opacity": 0.7,
                      "line-dasharray": [2, 2],
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                </Source>
              )}

              {/* Numbered markers */}
              {mappedActivities.map((activity, i) => {
                const globalIdx = activities.indexOf(activity);
                const catKey = getCategoryKey(activity.category);
                const color =
                  CATEGORY_MARKER_COLORS[catKey] ??
                  CATEGORY_MARKER_COLORS.other;
                const isSelected = selectedIdx === globalIdx;

                return (
                  <Marker
                    key={activity.id}
                    longitude={activity.lng!}
                    latitude={activity.lat!}
                    anchor="center"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation();
                      handleActivityClick(globalIdx);
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-full text-white text-xs font-bold cursor-pointer transition-transform"
                      style={{
                        width: isSelected ? 36 : 28,
                        height: isSelected ? 36 : 28,
                        backgroundColor: color,
                        boxShadow: isSelected
                          ? `0 0 0 3px white, 0 0 0 5px ${color}`
                          : `0 2px 6px rgba(0,0,0,0.3)`,
                      }}
                    >
                      {i + 1}
                    </div>
                  </Marker>
                );
              })}
            </Map>
          )}

          {/* Route loading indicator */}
          {routesLoading && mappedActivities.length >= 2 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 rounded-full px-3 py-1 text-xs text-black/50 shadow">
              Loading routes...
            </div>
          )}
        </div>

        {/* Sidebar — activity list */}
        <aside className="hidden md:flex flex-col w-80 border-l border-black/10 bg-warmBg overflow-y-auto scrollbar-thin">
          <div className="p-4 border-b border-black/5">
            <h2 className="text-xs font-semibold text-black/50 uppercase tracking-wide">
              Itinerary
            </h2>
          </div>
          <div className="flex-1 p-3 space-y-1">
            {activities.map((activity, i) => {
              const hasCords = activity.lat != null && activity.lng != null;
              const isSelected = selectedIdx === i;
              const catKey = getCategoryKey(activity.category);
              const accentClass = CATEGORY_ACCENT_CLASSES[catKey];

              // Find route segment from this activity to next
              const segmentAfter = routes.find((r) => r.fromIdx === i);

              return (
                <div key={activity.id}>
                  <button
                    onClick={() => handleActivityClick(i)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition ${
                      isSelected
                        ? "bg-blue/10 ring-1 ring-blue/20"
                        : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Number badge */}
                      {hasCords && (
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold shrink-0 mt-0.5 ${accentClass}`}
                        >
                          {mappedActivities.indexOf(activity) + 1}
                        </span>
                      )}
                      {!hasCords && (
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black/10 text-black/30 text-[10px] shrink-0 mt-0.5">
                          ?
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          {formatTime(activity.start_time) && (
                            <span className="text-[10px] text-black/35 shrink-0">
                              {formatTime(activity.start_time)}
                            </span>
                          )}
                          <span className="text-xs font-medium text-black/80 truncate">
                            {activity.name}
                          </span>
                        </div>
                        {activity.address && (
                          <p className="text-[10px] text-black/30 truncate mt-0.5">
                            {activity.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Travel segment indicator */}
                  {segmentAfter && (
                    <div className="flex items-center gap-2 ml-5 pl-3 py-1.5 border-l-2 border-dashed border-black/10">
                      {segmentAfter.mode === "walking" ? (
                        <Footprints className="h-3 w-3 text-blue/50" />
                      ) : (
                        <Car className="h-3 w-3 text-black/30" />
                      )}
                      <span className="text-[10px] text-black/35">
                        {segmentAfter.durationMinutes} min{" "}
                        {segmentAfter.mode === "walking" ? "walk" : "drive"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {unmappedActivities.length > 0 && mappedActivities.length > 0 && (
              <div className="pt-3 mt-2 border-t border-black/5">
                <p className="text-[10px] text-black/25 mb-2">
                  Missing location ({unmappedActivities.length})
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile bottom sheet for activity list */}
      <MobileActivitySheet
        activities={activities}
        mappedActivities={mappedActivities}
        routes={routes}
        selectedIdx={selectedIdx}
        onSelect={handleActivityClick}
      />
    </div>
  );
}

/* ---------- Mobile bottom sheet ---------- */

function MobileActivitySheet({
  activities,
  mappedActivities,
  routes,
  selectedIdx,
  onSelect,
}: {
  activities: Activity[];
  mappedActivities: Activity[];
  routes: RouteSegment[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="md:hidden border-t border-black/10 bg-warmBg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-black/50">
          {activities.length} activities
        </span>
        <span className="text-[10px] text-black/30">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded && (
        <div className="max-h-[40vh] overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin">
          {activities.map((activity, i) => {
            const hasCords = activity.lat != null && activity.lng != null;
            const isSelected = selectedIdx === i;
            const catKey = getCategoryKey(activity.category);
            const accentClass = CATEGORY_ACCENT_CLASSES[catKey];
            const segmentAfter = routes.find((r) => r.fromIdx === i);

            return (
              <div key={activity.id}>
                <button
                  onClick={() => onSelect(i)}
                  className={`w-full text-left rounded-xl px-3 py-2 transition ${
                    isSelected
                      ? "bg-blue/10 ring-1 ring-blue/20"
                      : "hover:bg-black/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {hasCords ? (
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-bold shrink-0 ${accentClass}`}
                      >
                        {mappedActivities.indexOf(activity) + 1}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black/10 text-black/30 text-[9px] shrink-0">
                        ?
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        {formatTime(activity.start_time) && (
                          <span className="text-[9px] text-black/35">
                            {formatTime(activity.start_time)}
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-black/80 truncate">
                          {activity.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
                {segmentAfter && (
                  <div className="flex items-center gap-1.5 ml-5 pl-2 py-1 border-l-2 border-dashed border-black/10">
                    {segmentAfter.mode === "walking" ? (
                      <Footprints className="h-2.5 w-2.5 text-blue/50" />
                    ) : (
                      <Car className="h-2.5 w-2.5 text-black/30" />
                    )}
                    <span className="text-[9px] text-black/35">
                      {segmentAfter.durationMinutes} min{" "}
                      {segmentAfter.mode === "walking" ? "walk" : "drive"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
