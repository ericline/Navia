/**
 * Hook encapsulating all data fetching, derived state, and CRUD handlers
 * for the trip detail page. Keeps the page component focused on UI/layout.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Trip, Day, Activity, ActivityCreate, ActivityUpdate } from "@/lib/types";
import {
  fetchTrip,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
  generateDaysForTrip,
  createActivity,
  updateActivity as apiUpdateActivity,
  deleteActivity as apiDeleteActivity,
  deleteTrip as apiDeleteTrip,
  reorderActivities,
} from "@/lib/api";

export function useTripData(tripId: number) {
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard against React Strict Mode double-firing the generate call
  const generatingRef = useRef(false);

  // Fetch trip data + auto-generate days if none exist
  useEffect(() => {
    if (!tripId || Number.isNaN(tripId)) {
      setError("Invalid trip id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tripData, daysData, activitiesData] = await Promise.all([
          fetchTrip(tripId),
          fetchDaysForTrip(tripId),
          fetchActivitiesForTrip(tripId),
        ]);
        if (cancelled) return;
        setTrip(tripData);
        setActivities(activitiesData);

        if (daysData.length === 0 && !generatingRef.current) {
          generatingRef.current = true;
          try {
            await generateDaysForTrip(tripId);
            if (cancelled) return;
            const freshDays = await fetchDaysForTrip(tripId);
            if (cancelled) return;
            setDays(freshDays);
          } finally {
            generatingRef.current = false;
          }
        } else {
          setDays(daysData);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load trip details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  // Derived data
  const sortedDays = useMemo(
    () => days.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [days]
  );

  const { activitiesByDay, unscheduledActivities } = useMemo(() => {
    const byDay: Record<number, Activity[]> = {};
    const unscheduled: Activity[] = [];
    for (const activity of activities) {
      if (activity.day_id == null) {
        unscheduled.push(activity);
      } else {
        (byDay[activity.day_id] ??= []).push(activity);
      }
    }
    for (const dayId of Object.keys(byDay)) {
      byDay[Number(dayId)].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return { activitiesByDay: byDay, unscheduledActivities: unscheduled };
  }, [activities]);

  async function refreshActivities() {
    setActivities(await fetchActivitiesForTrip(tripId));
  }

  async function handleDeleteTrip() {
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    try {
      await apiDeleteTrip(tripId);
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Failed to delete trip.");
    }
  }

  async function handleCreateActivity(data: ActivityCreate) {
    try {
      await createActivity(data);
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to create activity.");
    }
  }

  async function handleUpdateActivity(id: number, data: ActivityUpdate) {
    try {
      await apiUpdateActivity(id, data);
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to update activity.");
    }
  }

  async function handleDeleteActivity(activityId: number) {
    if (!window.confirm("Delete this activity?")) return;
    try {
      await apiDeleteActivity(activityId);
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to delete activity.");
    }
  }

  async function handleReorderActivities(_dayId: number, orderedIds: number[]) {
    // Optimistic local update
    setActivities((prev) => {
      const updated = [...prev];
      orderedIds.forEach((id, index) => {
        const act = updated.find((a) => a.id === id);
        if (act) act.position = index;
      });
      return updated;
    });
    try {
      const orders = orderedIds.map((id, index) => ({ activity_id: id, position: index }));
      await reorderActivities(orders);
    } catch (err) {
      console.error(err);
      await refreshActivities();
    }
  }

  async function handleScheduleActivity(activityId: number, dayId: number) {
    try {
      await apiUpdateActivity(activityId, { day_id: dayId });
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to schedule activity.");
    }
  }

  return {
    trip,
    days,
    activities,
    sortedDays,
    activitiesByDay,
    unscheduledActivities,
    loading,
    error,
    refreshActivities,
    handleDeleteTrip,
    handleCreateActivity,
    handleUpdateActivity,
    handleDeleteActivity,
    handleReorderActivities,
    handleScheduleActivity,
  };
}
