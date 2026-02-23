"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trip, fetchTrips } from "@/lib/api";
import { MapPin, ChevronRight, Plane } from "lucide-react";

function isCurrentOrUpcoming(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date);
  end.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
}

function sortByStartAsc(a: Trip, b: Trip) {
  return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Ongoing";
  return `In ${diff} days`;
}

export default function CurrentTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setTrips(await fetchTrips());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentTrips = useMemo(
    () => trips.filter(isCurrentOrUpcoming).sort(sortByStartAsc),
    [trips]
  );

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      />
      <div className="fixed inset-0 -z-10 bg-darkBlue/40" />

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white/95 tracking-tight">
            Current Trips
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            All active and upcoming trips
          </p>
        </div>

        <section className="glass rounded-2xl p-6">
          {loading ? (
            <p className="text-sm text-white/40 text-center py-10">
              Loading trips...
            </p>
          ) : currentTrips.length === 0 ? (
            <div className="text-center py-12">
              <Plane className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40">No upcoming trips</p>
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
                  className="glass-subtle rounded-2xl p-4 flex items-start gap-4 text-left hover:bg-white/[0.06] transition group"
                >
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-lightBlue/50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white/90 truncate">
                        {t.name}
                      </span>
                      <span className="text-[11px] text-blue/70 shrink-0">
                        {daysUntil(t.start_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3 w-3 text-white/50 shrink-0" />
                      <span className="text-xs text-white/50 truncate">
                        {t.destination}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/35 mt-1">
                      {formatDate(t.start_date)} — {formatDate(t.end_date)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0 mt-1 group-hover:text-white/50 transition" />
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
