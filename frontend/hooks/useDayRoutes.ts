"use client";

import { useEffect, useState } from "react";
import { Activity } from "@/lib/api";

export interface RouteSegment {
  fromIdx: number;
  toIdx: number;
  mode: "walking" | "driving";
  durationMinutes: number;
  geometry: GeoJSON.LineString;
}

const MAPBOX_DIRECTIONS_URL =
  "https://api.mapbox.com/directions/v5/mapbox";
const WALK_THRESHOLD_SECONDS = 25 * 60; // 25 minutes

async function fetchRoute(
  profile: "walking" | "driving",
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  token: string
): Promise<{ durationSeconds: number; geometry: GeoJSON.LineString } | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${MAPBOX_DIRECTIONS_URL}/${profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      durationSeconds: route.duration,
      geometry: route.geometry,
    };
  } catch {
    return null;
  }
}

export function useDayRoutes(activities: Activity[]) {
  const [routes, setRoutes] = useState<RouteSegment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // Only include activities with coordinates
    const mapped = activities
      .map((a, i) => ({ idx: i, lat: a.lat!, lng: a.lng! }))
      .filter((a) => a.lat != null && a.lng != null);

    if (mapped.length < 2) {
      setRoutes([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const segments: RouteSegment[] = [];

      for (let i = 0; i < mapped.length - 1; i++) {
        const from = mapped[i];
        const to = mapped[i + 1];

        // Try walking first
        const walkResult = await fetchRoute("walking", from, to, token);

        if (cancelled) return;

        if (walkResult && walkResult.durationSeconds <= WALK_THRESHOLD_SECONDS) {
          segments.push({
            fromIdx: from.idx,
            toIdx: to.idx,
            mode: "walking",
            durationMinutes: Math.round(walkResult.durationSeconds / 60),
            geometry: walkResult.geometry,
          });
        } else {
          // Either walk failed or exceeds threshold — use driving
          const driveResult = await fetchRoute("driving", from, to, token);
          if (cancelled) return;

          if (driveResult) {
            segments.push({
              fromIdx: from.idx,
              toIdx: to.idx,
              mode: "driving",
              durationMinutes: Math.round(driveResult.durationSeconds / 60),
              geometry: driveResult.geometry,
            });
          } else if (walkResult) {
            // Fallback to walking result if driving also failed
            segments.push({
              fromIdx: from.idx,
              toIdx: to.idx,
              mode: "walking",
              durationMinutes: Math.round(walkResult.durationSeconds / 60),
              geometry: walkResult.geometry,
            });
          }
        }
      }

      if (!cancelled) {
        setRoutes(segments);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activities]);

  return { routes, loading };
}
