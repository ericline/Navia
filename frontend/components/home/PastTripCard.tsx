/**
 * PastTripCard - Compact card for completed trips on the home page.
 * Displays an inline constellation preview.
 */
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TripDetailed } from "@/lib/types";
import { formatDate, formatDestination } from "@/lib/utils";
import { useActivitiesByDay } from "@/hooks/useActivitiesByDay";
import { TripConstellation } from "@/components/constellation";

export default function PastTripCard({ trip }: { trip: TripDetailed }) {
  const router = useRouter();

  const actsByDay = useActivitiesByDay(trip.activities);

  const sortedDays = useMemo(
    () => trip.days.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [trip.days]
  );

  return (
    <button
      onClick={() => router.push(`/trips/${trip.id}`)}
      className="w-full text-left rounded-xl bg-black/[0.03] hover:bg-black/[0.06] transition p-3"
    >
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-pink/30 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-black/65 truncate">{trip.name}</div>
          <div className="text-[11px] text-black/35">
            {formatDestination(trip.destination)} · {formatDate(trip.start_date)} —{" "}
            {formatDate(trip.end_date)}
          </div>
        </div>
      </div>
      {sortedDays.length > 0 && (
        <div className="mt-1.5">
          <TripConstellation
            tripId={trip.id}
            tripName={trip.name}
            days={sortedDays}
            activitiesByDay={actsByDay}
            destination={trip.destination}
            size="compact"
          />
        </div>
      )}
    </button>
  );
}
