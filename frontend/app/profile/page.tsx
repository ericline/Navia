"use client";

import { useEffect, useState } from "react";
import WorldMap, { MapMarker } from "@/components/WorldMap";
import { fetchTrips, fetchActivitiesForTrip } from "@/lib/api";
import { isPastTrip } from "@/lib/utils";

// Broad administrative types — drill into activity addresses instead of marking the destination itself
const BROAD_TYPES = new Set(["country", "region"]);

async function geocodePlace(
  query: string,
  token: string
): Promise<{ lng: number; lat: number; placeType: string } | null> {
  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    );
    url.searchParams.set("limit", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    return {
      lng: f.center[0],
      lat: f.center[1],
      placeType: f.place_type?.[0] ?? "place",
    };
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const user = {
    name: "Eric Lin",
    email: "eric@example.com",
    birthday: "2002-01-01",
  };

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setLoadingMap(false);
      return;
    }

    (async () => {
      try {
        const allTrips = await fetchTrips();
        const pastTrips = allTrips.filter(isPastTrip);

        const points: MapMarker[] = [];
        const seenKeys = new Set<string>();

        function addPoint(lng: number, lat: number, name: string) {
          // Deduplicate within ~11 km (0.1° grid) to avoid stacked markers
          const key = `${Math.round(lng * 10)},${Math.round(lat * 10)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            points.push({ lng, lat, name });
          }
        }

        for (const trip of pastTrips) {
          if (!trip.destination) continue;

          const result = await geocodePlace(trip.destination, token);
          if (!result) continue;

          if (BROAD_TYPES.has(result.placeType)) {
            // Country or province — mark cities from activity addresses instead
            const activities = await fetchActivitiesForTrip(trip.id);
            for (const act of activities) {
              if (act.lat != null && act.lng != null) {
                // Use pre-stored coordinates if available
                addPoint(act.lng, act.lat, act.address ?? act.name);
              } else if (act.address) {
                const actResult = await geocodePlace(act.address, token);
                if (actResult) {
                  addPoint(actResult.lng, actResult.lat, act.address);
                }
              }
            }
          } else {
            // City, town, locality, landmark — mark the destination directly
            addPoint(result.lng, result.lat, trip.destination);
          }
        }

        setMarkers(points);
      } finally {
        setLoadingMap(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-black/85 tracking-tight">
          Profile
        </h1>
        <p className="text-black/45 mt-1 text-sm">
          Settings and preferences will live here
        </p>
      </div>

      {/* Account */}
      <section className="glass bg-warmSurface rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-black/60">Account</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Name", value: user.name },
            { label: "Email", value: user.email },
            { label: "Birthday", value: user.birthday },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-white/60 border border-black/6 p-4"
            >
              <div className="text-xs text-black/40">{label}</div>
              <div className="mt-1 text-sm font-medium text-black/80">
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* World map */}
      <section className="glass bg-warmSurface rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-black/60 mb-4">
          Places Visited
        </h2>
        <WorldMap markers={markers} loading={loadingMap} />
        {!loadingMap && markers.length === 0 && (
          <p className="text-xs text-black/35 text-center mt-3">
            Complete a past trip to see it marked on the map
          </p>
        )}
      </section>

      {/* Preferences */}
      <section className="glass bg-coolCard rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-black/60 mb-4">
          Preferences
        </h2>
        <p className="text-xs text-black/35 text-center py-6">
          Day start/end time, pacing, budget goals and more — coming soon
        </p>
      </section>
    </main>
  );
}
