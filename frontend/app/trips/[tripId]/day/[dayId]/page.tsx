"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trip,
  Day,
  Activity,
  fetchTrip,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
} from "@/lib/api";
import DayMap from "@/components/DayMap";

export default function DayMapPage() {
  const params = useParams();
  const router = useRouter();

  const tripId = Number(
    Array.isArray(params?.tripId) ? params.tripId[0] : params?.tripId
  );
  const dayId = Number(
    Array.isArray(params?.dayId) ? params.dayId[0] : params?.dayId
  );

  const [trip, setTrip] = useState<Trip | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || !dayId || isNaN(tripId) || isNaN(dayId)) {
      setError("Invalid trip or day id");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tripData, daysData, activitiesData] = await Promise.all([
          fetchTrip(tripId),
          fetchDaysForTrip(tripId),
          fetchActivitiesForTrip(tripId),
        ]);
        if (cancelled) return;

        setTrip(tripData);

        const targetDay = daysData.find((d) => d.id === dayId);
        if (!targetDay) {
          setError("Day not found");
          setLoading(false);
          return;
        }
        setDay(targetDay);

        // Get activities for this day, sorted by start_time
        const dayActivities = activitiesData
          .filter((a) => a.day_id === dayId)
          .sort((a, b) => {
            if (!a.start_time && !b.start_time) return 0;
            if (!a.start_time) return 1;
            if (!b.start_time) return -1;
            return a.start_time.localeCompare(b.start_time);
          });
        setActivities(dayActivities);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load day data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, dayId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-black/40">Loading day map...</p>
      </div>
    );
  }

  if (error || !trip || !day) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-red-500">{error ?? "Not found"}</p>
      </div>
    );
  }

  return (
    <DayMap
      day={day}
      activities={activities}
      tripName={trip.name}
      onBack={() => router.push(`/trips/${tripId}`)}
    />
  );
}
