"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import WorldMap, { MapMarker } from "@/components/WorldMap";
import ConstellationBook from "@/components/ConstellationBook";
import TripStats from "@/components/TripStats";
import {
  Trip,
  Day,
  Activity,
  fetchTrips,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
} from "@/lib/api";
import { isPastTrip, sortByStartAsc } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

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
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [constellationPages, setConstellationPages] = useState<
    { trip: Trip; days: Day[]; activitiesByDay: Record<number, Activity[]> }[]
  >([]);

  // Redirect to login if not authenticated
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

  const [editingField, setEditingField] = useState<"name" | "email" | "birthday" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const { updateUser } = useAuth();

  function startEdit(field: "name" | "email" | "birthday") {
    setEditingField(field);
    setEditError(null);
    if (field === "birthday") {
      setEditValue(user?.birthday ?? "");
    } else {
      setEditValue(user?.[field] ?? "");
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingField || !user) return;
    if (editingField === "name" && !editValue.trim()) {
      setEditError("Name cannot be empty");
      return;
    }
    if (editingField === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editValue)) {
      setEditError("Invalid email format");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const data: Record<string, string | null> = {};
      if (editingField === "birthday") {
        data.birthday = editValue || null;
      } else {
        data[editingField] = editValue;
      }
      await updateUser(data);
      setEditingField(null);
      setEditValue("");
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  // Compute stats from constellation data
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

  if (isLoading || !user) return null;

  const formattedBirthday = user.birthday
    ? new Date(user.birthday + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const accountFields: { key: "name" | "email" | "birthday"; label: string; value: string }[] = [
    { key: "name", label: "Name", value: user.name },
    { key: "email", label: "Email", value: user.email },
    { key: "birthday", label: "Birthday", value: formattedBirthday },
  ];

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
          {accountFields.map(({ key, label, value }) => (
            <div
              key={key}
              className="rounded-xl bg-white/60 border border-black/6 p-4 group"
            >
              <div className="text-xs text-black/40 flex items-center justify-between">
                {label}
                {editingField !== key && (
                  <button
                    onClick={() => startEdit(key)}
                    className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-black/5"
                  >
                    <Pencil className="h-3 w-3 text-black/30" />
                  </button>
                )}
              </div>
              {editingField === key ? (
                <div className="mt-1">
                  <input
                    type={key === "birthday" ? "date" : key === "email" ? "email" : "text"}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="glass-input w-full rounded-lg px-2 py-1 text-sm text-black/85"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  {editError && (
                    <p className="text-[10px] text-red-500 mt-1">{editError}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="p-1 rounded-lg bg-blue/10 hover:bg-blue/20 transition disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5 text-blue" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 rounded-lg hover:bg-black/5 transition"
                    >
                      <X className="h-3.5 w-3.5 text-black/40" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm font-medium text-black/80">
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trip Stats */}
      {constellationPages.length > 0 && (
        <TripStats trips={allTripsForStats} totalActivities={totalActivities} totalDays={totalDays} />
      )}

      {/* Constellation Book */}
      <section className="glass bg-warmSurface rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-black/60 mb-4">
          Constellation Collection
        </h2>
        <ConstellationBook pages={constellationPages} />
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
