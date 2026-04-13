/** TripStats - Summary statistics card showing total trips, days, and activities on the profile page. */
"use client";

import { useMemo } from "react";
import { Plane, Calendar, MapPin, CheckCircle } from "lucide-react";
import { Trip } from "@/lib/api";

interface TripStatsProps {
  trips: Trip[];
  totalActivities: number;
  totalDays: number;
}

export default function TripStats({ trips, totalActivities, totalDays }: TripStatsProps) {
  const uniqueDestinations = useMemo(
    () => new Set(trips.map((t) => t.destination)).size,
    [trips]
  );

  const stats = [
    { label: "Total Trips", value: trips.length, icon: Plane },
    { label: "Days Traveled", value: totalDays, icon: Calendar },
    { label: "Destinations", value: uniqueDestinations, icon: MapPin },
    { label: "Activities Planned", value: totalActivities, icon: CheckCircle },
  ];

  return (
    <section className="glass bg-warmSurface rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-black/60 mb-4">Trip Stats</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl bg-white/60 border border-black/6 p-4 flex flex-col items-center text-center"
          >
            <Icon className="h-5 w-5 text-blue/50 mb-2" />
            <div className="text-2xl font-bold text-black/80">{value}</div>
            <div className="text-[11px] text-black/40 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
