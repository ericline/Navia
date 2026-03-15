"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trip,
  Day,
  Activity,
  ActivityCreate,
  ActivityUpdate,
  fetchTrip,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
  generateDaysForTrip,
  createActivity,
  updateActivity,
  deleteActivity,
  deleteTrip,
} from "@/lib/api";
import { Plus } from "lucide-react";
import TripHeader from "@/components/TripHeader";
import TripCalendarStrip from "@/components/TripCalendarStrip";
import UnscheduledDock from "@/components/UnscheduledDock";
import AddActivityPanel from "@/components/AddActivityPanel";
import TripConstellation from "@/components/TripConstellation";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();

  const tripIdParam = params?.tripId;
  const tripId = Array.isArray(tripIdParam)
    ? parseInt(tripIdParam[0], 10)
    : parseInt(tripIdParam as string, 10);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar strip week pagination
  const [weekOffset, setWeekOffset] = useState(0);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDayId, setPanelDayId] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Constellation reveal overlay (shown on Finish)
  const [showReveal, setShowReveal] = useState(false);

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
  const sortedDays = days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const activitiesByDay: Record<number, Activity[]> = {};
  const unscheduledActivities: Activity[] = [];
  for (const activity of activities) {
    if (activity.day_id == null) {
      unscheduledActivities.push(activity);
    } else {
      (activitiesByDay[activity.day_id] ??= []).push(activity);
    }
  }

  // Refresh activities from server
  async function refreshActivities() {
    setActivities(await fetchActivitiesForTrip(tripId));
  }

  // Handlers
  async function handleDeleteTrip() {
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    try {
      await deleteTrip(tripId);
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Failed to delete trip.");
    }
  }

  function handleFinish() {
    setShowReveal(true);
    // Let the constellation reveal animation play, then navigate
    const totalStars = sortedDays.length;
    const revealDuration = totalStars * 2 * 150 + 1200; // stars + lines + pause
    setTimeout(() => {
      router.push("/");
    }, revealDuration);
  }

  function handleOpenPanel(dayId?: number) {
    setEditingActivity(null);
    setPanelDayId(dayId ?? null);
    setPanelOpen(true);
  }

  function handleEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setPanelDayId(null);
    setPanelOpen(true);
  }

  async function handleDeleteActivity(activityId: number) {
    if (!window.confirm("Delete this activity?")) return;
    try {
      await deleteActivity(activityId);
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to delete activity.");
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
      await updateActivity(id, data);
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to update activity.");
    }
  }

  async function handleScheduleActivity(activityId: number, dayId: number) {
    try {
      await updateActivity(activityId, { day_id: dayId });
      await refreshActivities();
    } catch (err) {
      console.error(err);
      setError("Failed to schedule activity.");
    }
  }

  // Loading / error states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-black/40">Loading trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-red-500">{error ?? "Trip not found."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-6 pb-20">
      <TripHeader
        trip={trip}
        onDelete={handleDeleteTrip}
        onFinish={handleFinish}
      />

      {sortedDays.length > 0 ? (
        <TripCalendarStrip
          days={sortedDays}
          activitiesByDay={activitiesByDay}
          weekOffset={weekOffset}
          onWeekChange={setWeekOffset}
          onAddActivity={handleOpenPanel}
          onEditActivity={handleEditActivity}
          onDeleteActivity={handleDeleteActivity}
          tripName={trip.name}
        />
      ) : (
        <section className="glass bg-warmSurface rounded-2xl p-8 text-center">
          <p className="text-sm text-black/40">
            No days available for this trip.
          </p>
        </section>
      )}

      {/* Floating add button */}
      <button
        onClick={() => handleOpenPanel()}
        className="fixed bottom-16 right-6 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-blue shadow-lg hover:bg-blue/90 transition constellation-star-today"
      >
        <Plus className="h-5 w-5 text-white" />
      </button>

      {/* Unscheduled dock */}
      <UnscheduledDock
        activities={unscheduledActivities}
        days={sortedDays}
        onEditActivity={handleEditActivity}
        onDeleteActivity={handleDeleteActivity}
        onScheduleActivity={handleScheduleActivity}
      />

      {/* Add / Edit activity panel */}
      <AddActivityPanel
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setEditingActivity(null);
        }}
        onCreate={handleCreateActivity}
        onUpdate={handleUpdateActivity}
        tripId={tripId}
        days={sortedDays}
        preselectedDayId={panelDayId}
        editingActivity={editingActivity}
      />

      {/* Constellation reveal overlay */}
      {showReveal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-warmBg constellation-reveal-overlay">
          <p className="text-sm text-black/40 mb-2 tracking-wide uppercase constellation-reveal-title">
            Your constellation
          </p>
          <h2 className="text-2xl font-bold text-black/80 mb-6 constellation-reveal-title">
            {trip.name}
          </h2>
          <div className="w-full max-w-2xl px-8">
            <TripConstellation
              tripId={tripId}
              tripName={trip.name}
              days={sortedDays}
              activitiesByDay={activitiesByDay}
              revealAnimation
            />
          </div>
          <p className="mt-8 text-xs text-black/30 constellation-reveal-title">
            Trip saved
          </p>
        </div>
      )}
    </main>
  );
}
