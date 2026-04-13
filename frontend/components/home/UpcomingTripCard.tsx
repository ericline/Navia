/**
 * UpcomingTripCard - Expandable card for a current/upcoming trip on the
 * home page. Shows constellation preview, day list on expand.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown } from "lucide-react";
import type { TripDetailed } from "@/lib/types";
import { formatDate, formatDestination, daysUntil } from "@/lib/utils";
import { useActivitiesByDay } from "@/hooks/useActivitiesByDay";
import { TripConstellation } from "@/components/constellation";

export default function UpcomingTripCard({ trip }: { trip: TripDetailed }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const actsByDay = useActivitiesByDay(trip.activities);

  const sortedDays = useMemo(
    () => trip.days.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [trip.days]
  );

  return (
    <div className="glass-subtle bg-warmCard rounded-2xl overflow-hidden transition-all duration-200 hover:bg-warmCard/80">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 flex items-start gap-4"
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

        <ChevronDown
          className={`h-4 w-4 text-black/30 shrink-0 mt-1 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="border-t border-black/[0.06] pt-3">
            {trip.days.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-xs text-black/40">No days generated yet</p>
                <button
                  onClick={() => router.push(`/trips/${trip.id}`)}
                  className="mt-2 text-xs text-blue/70 hover:text-blue/90 transition"
                >
                  Open trip to generate days →
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sortedDays.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2"
                    >
                      <div>
                        <span className="text-xs text-black/65">
                          {d.name || formatDate(d.date)}
                        </span>
                        <span className="text-[10px] text-black/35 ml-2">
                          {d.date}
                        </span>
                      </div>
                      <span className="text-[10px] text-black/40">
                        {actsByDay[d.id]?.length ?? 0} activities
                      </span>
                    </div>
                  ))}
                <button
                  onClick={() => router.push(`/trips/${trip.id}`)}
                  className="w-full mt-2 text-xs text-center text-blue/50 hover:text-blue/70 transition py-1"
                >
                  Open full trip →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
