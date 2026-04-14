/**
 * UpcomingTripCard - Card for a current/upcoming trip on the home page.
 * Clicking anywhere on the card navigates to the trip detail page.
 */
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import type { TripDetailed } from "@/lib/types";
import { formatDate, formatDestination, daysUntil } from "@/lib/utils";
import { useActivitiesByDay } from "@/hooks/useActivitiesByDay";
import { TripConstellation } from "@/components/constellation";

export default function UpcomingTripCard({ trip }: { trip: TripDetailed }) {
  const router = useRouter();

  const actsByDay = useActivitiesByDay(trip.activities);

  const sortedDays = useMemo(
    () => trip.days.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [trip.days]
  );

  return (
    <button
      type="button"
      onClick={() => router.push(`/trips/${trip.id}`)}
      className="glass-subtle bg-warmCard rounded-2xl overflow-hidden w-full text-left p-4 flex items-start gap-4 transition-all duration-200 hover:bg-warmCard/80 hover:scale-[1.01] hover:shadow-md active:scale-[0.995]"
    >
      <div className="mt-1.5 h-2 w-2 rounded-full bg-pink/70 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-black/85 truncate">{trip.name}</h3>
          <span className="text-[11px] text-pink shrink-0">
            {daysUntil(trip.start_date)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <MapPin className="h-3 w-3 text-black/50 shrink-0" />
          <span className="text-xs text-black/50 truncate">
            {formatDestination(trip.destination)}
          </span>
        </div>
        <div className="text-[11px] text-black/35 mt-1">
          {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
        </div>

        {sortedDays.length > 0 && (
          <div className="mt-2">
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
      </div>
    </button>
  );
}
