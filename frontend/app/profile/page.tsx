/**
 * Profile page — displays account info, trip statistics, constellation
 * collection, world map of visited places, and user preferences.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { Trip, Day, Activity } from "@/lib/types";
import {
  fetchTrips,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
} from "@/lib/api";
import { isPastTrip, sortByStartAsc } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import WorldMap, { MapMarker } from "@/components/map/WorldMap";
import { ConstellationBook } from "@/components/constellation";
import { TripStats } from "@/components/ui";
import { AccountSection, PreferencesSection } from "@/components/profile";

// Broad administrative place types — drill into activity addresses instead
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
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [constellationPages, setConstellationPages] = useState<
    { trip: Trip; days: Day[]; activitiesByDay: Record<number, Activity[]> }[]
  >([]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?redirect=/profile");
    }
  }, [user, isLoading, router]);

  // Fetch constellation data for all trips
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const allTrips = await fetchTrips();
        const sorted = allTrips.sort(sortByStartAsc);
        const results = await Promise.all(
          sorted.map(async (trip) => {
            const [days, activities] = await Promise.all([
              fetchDaysForTrip(trip.id),
              fetchActivitiesForTrip(trip.id),
            ]);
            const activitiesByDay: Record<number, Activity[]> = {};
            for (const a of activities) {
              if (a.day_id != null) (activitiesByDay[a.day_id] ??= []).push(a);
            }
            return { trip, days, activitiesByDay };
          })
        );
        if (!cancelled) {
          setConstellationPages(results.filter((r) => r.days.length > 0));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Build world map markers from past trip destinations/activities
  useEffect(() => {
    if (!user) return;
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
            const activities = await fetchActivitiesForTrip(trip.id);
            for (const act of activities) {
              if (act.lat != null && act.lng != null) {
                addPoint(act.lng, act.lat, act.address ?? act.name);
              } else if (act.address) {
                const actResult = await geocodePlace(act.address, token);
                if (actResult) {
                  addPoint(actResult.lng, actResult.lat, act.address);
                }
              }
            }
          } else {
            addPoint(result.lng, result.lat, trip.destination);
          }
        }

        setMarkers(points);
      } finally {
        setLoadingMap(false);
      }
    })();
  }, [user]);

  const totalActivities = useMemo(
    () => constellationPages.reduce((sum, p) => {
      return sum + Object.values(p.activitiesByDay).reduce((s, acts) => s + acts.length, 0);
    }, 0),
    [constellationPages]
  );

  const allTripsForStats = useMemo(
    () => constellationPages.map((p) => p.trip),
    [constellationPages]
  );

  const totalDays = useMemo(
    () => constellationPages.reduce((sum, p) => sum + p.days.length, 0),
    [constellationPages]
  );

  const reduce = useReducedMotion();
  const pageVariants: Variants = {
    hidden: {},
    show: { transition: reduce ? {} : { staggerChildren: 0.06, delayChildren: 0.05 } },
  };
  const sectionVariants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: reduce
      ? { opacity: 1, transition: { duration: 0.15 } }
      : { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 28 } },
  };

  if (isLoading || !user) return null;

  return (
    <motion.main
      className="mx-auto max-w-5xl px-6 py-10 space-y-8"
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={sectionVariants}>
        <h1 className="text-3xl font-bold text-black/85 tracking-tight">
          Profile
        </h1>
        <p className="text-black/45 mt-1 text-sm">
        </p>
      </motion.div>

      <motion.div variants={sectionVariants}>
        <AccountSection />
      </motion.div>

      {constellationPages.length > 0 && (
        <motion.div variants={sectionVariants}>
          <TripStats trips={allTripsForStats} totalActivities={totalActivities} totalDays={totalDays} />
        </motion.div>
      )}

      <motion.section
        variants={sectionVariants}
        className="glass bg-warmSurface rounded-2xl p-6"
      >
        <h2 className="text-sm font-semibold text-black/60 mb-4">
          Constellation Collection
        </h2>
        <ConstellationBook pages={constellationPages} />
      </motion.section>

      <motion.section
        variants={sectionVariants}
        className="glass bg-warmSurface rounded-2xl p-6"
      >
        <h2 className="text-sm font-semibold text-black/60 mb-4">
          Places Visited
        </h2>
        <WorldMap markers={markers} loading={loadingMap} />
        {!loadingMap && markers.length === 0 && (
          <p className="text-xs text-black/35 text-center mt-3">
            Complete a past trip to see it marked on the map
          </p>
        )}
      </motion.section>

      <motion.div variants={sectionVariants}>
        <PreferencesSection />
      </motion.div>
    </motion.main>
  );
}
