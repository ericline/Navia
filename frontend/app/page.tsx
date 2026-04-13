/**
 * Home page — orchestrates trip listing, creation (via HeroWidget),
 * and the bucket list. Delegates all UI to extracted components.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plane } from "lucide-react";
import { TripDetailed, fetchTripsDetailed } from "@/lib/api";
import { isPastTrip, isCurrentOrUpcoming, sortByStartAsc } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  HeroWidget,
  AnimatedRouteGraphic,
  UpcomingTripCard,
  PastTripCard,
  BucketList,
} from "@/components/home";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [trips, setTrips] = useState<TripDetailed[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      return;
    }
    (async () => {
      try {
        setLoadingTrips(true);
        const t = await fetchTripsDetailed();
        setTrips(t);
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, [user]);

  const pastTrips = useMemo(
    () => trips.filter(isPastTrip).sort(sortByStartAsc).reverse(),
    [trips]
  );
  const currentTrips = useMemo(
    () => trips.filter(isCurrentOrUpcoming).sort(sortByStartAsc),
    [trips]
  );

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <HeroWidget />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <HeroWidget />

      {!user ? (
        <AnimatedRouteGraphic />
      ) : (
        <>
          {/* Upcoming Trips */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-black/85">Upcoming</h2>
                {currentTrips.length > 0 && (
                  <span className="text-[11px] text-pink bg-pink/[0.12] rounded-full px-2.5 py-0.5">
                    {currentTrips.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => router.push("/current-trips")}
                className="text-xs text-black/40 hover:text-black/55 transition flex items-center gap-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {loadingTrips ? (
              <div className="glass-subtle bg-warmSurface rounded-2xl p-8 text-center">
                <p className="text-sm text-black/40">Loading trips...</p>
              </div>
            ) : currentTrips.length === 0 ? (
              <div className="glass-subtle bg-warmSurface rounded-2xl p-8 text-center">
                <Plane className="h-8 w-8 text-black/20 mx-auto mb-3" />
                <p className="text-sm text-black/40">No upcoming trips</p>
                <p className="text-xs text-black/25 mt-1">Create your first trip above</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {currentTrips.slice(0, 6).map((t) => (
                  <UpcomingTripCard key={t.id} trip={t} />
                ))}
              </div>
            )}
          </section>

          {/* Past Trips & Bucket List */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <section className="glass bg-coolCard rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-black/75 mb-3 flex items-center gap-2">
                Past Trips
                {pastTrips.length > 0 && (
                  <span className="text-[10px] text-pink bg-pink/[0.12] rounded-full px-2 py-0.5">
                    {pastTrips.length}
                  </span>
                )}
              </h2>

              <div className="space-y-2 pr-1">
                {loadingTrips ? (
                  <p className="text-xs text-black/40">Loading...</p>
                ) : pastTrips.length === 0 ? (
                  <p className="text-xs text-black/30 py-4 text-center">
                    No past trips yet
                  </p>
                ) : (
                  pastTrips.map((t) => (
                    <PastTripCard key={t.id} trip={t} />
                  ))
                )}
              </div>
            </section>

            <BucketList />
          </div>
        </>
      )}
    </main>
  );
}
