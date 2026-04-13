/** Current trips page — full list of upcoming/active trips with navigation cards. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trip, fetchTrips } from "@/lib/api";
import { MapPin, ChevronRight, Plane } from "lucide-react";
import {
  formatDate,
  daysUntil,
  isCurrentOrUpcoming,
  sortByStartAsc,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export default function CurrentTripsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?redirect=/current-trips");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        setTrips(await fetchTrips());
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const currentTrips = useMemo(
    () => trips.filter(isCurrentOrUpcoming).sort(sortByStartAsc),
    [trips]
  );

  if (isLoading || !user) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-black/85 tracking-tight">
          Current Trips
        </h1>
        <p className="text-black/45 mt-1 text-sm">
          All active and upcoming trips
        </p>
      </div>

      <section className="glass bg-warmSurface rounded-2xl p-6">
        {loading ? (
          <p className="text-sm text-black/40 text-center py-10">
            Loading trips...
          </p>
        ) : currentTrips.length === 0 ? (
          <div className="text-center py-12">
            <Plane className="h-10 w-10 text-black/20 mx-auto mb-3" />
            <p className="text-sm text-black/40">No upcoming trips</p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 text-xs text-blue/70 hover:text-blue/90 transition"
            >
              Plan a new trip →
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {currentTrips.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/trips/${t.id}`)}
                className="glass-subtle bg-warmCard rounded-2xl p-4 flex items-start gap-4 text-left hover:bg-warmCard/80 transition group"
              >
                <div className="mt-1.5 h-2 w-2 rounded-full bg-blue/50 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-black/85 truncate">
                      {t.name}
                    </span>
                    <span className="text-[11px] text-pink shrink-0">
                      {daysUntil(t.start_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3 w-3 text-black/45 shrink-0" />
                    <span className="text-xs text-black/50 truncate">
                      {t.destination}
                    </span>
                  </div>
                  <div className="text-[11px] text-black/35 mt-1">
                    {formatDate(t.start_date)} — {formatDate(t.end_date)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-black/25 shrink-0 mt-1 group-hover:text-black/45 transition" />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
