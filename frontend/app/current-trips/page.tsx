"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BubbleCard from "@/components/BubbleCard";
import { Trip, fetchTrips } from "@/lib/api";

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
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Current Trips</h1>
        <p className="text-sm text-slate-300 mt-1">
          All active and upcoming trips. (Later this page will support drag-and-drop + AI scheduling.)
        </p>
      </div>

      <BubbleCard title="All Current Trips" subtitle="Click a trip to open its detail page.">
        {loading ? (
          <div className="text-sm text-slate-300">Loading…</div>
        ) : currentTrips.length === 0 ? (
          <div className="text-sm text-slate-300">No current trips yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {currentTrips.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/trips/${t.id}`)}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 flex gap-3 text-left"
              >
                <div className="h-14 w-14 rounded-2xl bg-slate-800/60 border border-white/10 flex items-center justify-center text-xs text-slate-300">
                  Img
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-slate-300/80 truncate">{t.destination}</div>
                  <div className="text-[11px] text-slate-400">{t.start_date} → {t.end_date}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </BubbleCard>
    </main>
  );
}
