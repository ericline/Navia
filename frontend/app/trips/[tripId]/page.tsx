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
  generateDaysForTrip,
  createDay,
  createActivity,
} from "@/lib/api";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();

  // params.tripId will be a string (in App Router)
  const tripIdParam = params?.tripId;
  const tripId = Array.isArray(tripIdParam)
    ? parseInt(tripIdParam[0], 10)
    : parseInt(tripIdParam as string, 10);

  // Form state for creating a Day
  const [newDayDate, setNewDayDate] = useState("");
  const [newDayName, setNewDayName] = useState("");
  const [newDayNotes, setNewDayNotes] = useState("");

  // Form state for creating an Activity
  const [activityName, setActivityName] = useState("");
  const [activityCategory, setActivityCategory] = useState("");
  const [activityAddress, setActivityAddress] = useState("");
  const [activityDayId, setActivityDayId] = useState<string>(""); // "" = unscheduled
  const [activityDuration, setActivityDuration] = useState<string>(""); // minutes as string input
  const [activityCost, setActivityCost] = useState<string>(""); // cost as string
  const [activityEnergy, setActivityEnergy] = useState("");
  const [activityMustDo, setActivityMustDo] = useState(false);

  const [saving, setSaving] = useState(false);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || Number.isNaN(tripId)) {
      setError("Invalid trip id");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [tripData, daysData, activitiesData] = await Promise.all([
          fetchTrip(tripId),
          fetchDaysForTrip(tripId),
          fetchActivitiesForTrip(tripId),
        ]);
        setTrip(tripData);
        setDays(daysData);
        setActivities(activitiesData);
      } catch (err) {
        console.error(err);
        setError("Failed to load trip details");
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  async function handleGenerateDays() {
    if (!tripId || Number.isNaN(tripId)) return;
    try {
      setSaving(true);
      await generateDaysForTrip(tripId);
      const updatedDays = await fetchDaysForTrip(tripId);
      setDays(updatedDays);
    } catch (err) {
      console.error(err);
      setError("Failed to generate days");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDay(e: React.FormEvent) {
    e.preventDefault();
    if (!tripId || Number.isNaN(tripId)) return;
    if (!newDayDate) return;

    try {
      setSaving(true);
      await createDay({
        trip_id: tripId,
        date: newDayDate,
        name: newDayName || undefined,
        notes: newDayNotes || undefined,
      });
      const updatedDays = await fetchDaysForTrip(tripId);
      setDays(updatedDays);
      setNewDayDate("");
      setNewDayName("");
      setNewDayNotes("");
    } catch (err) {
      console.error(err);
      setError("Failed to create day");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!tripId || Number.isNaN(tripId)) return;
    if (!activityName) return;

    const parsedDuration =
      activityDuration.trim() === ""
        ? null
        : Number.isNaN(Number(activityDuration))
        ? null
        : Number(activityDuration);

    const parsedCost =
      activityCost.trim() === ""
        ? null
        : Number.isNaN(Number(activityCost))
        ? null
        : Number(activityCost);

    const dayIdValue =
      activityDayId === "" ? null : Number.parseInt(activityDayId, 10);

    try {
      setSaving(true);
      await createActivity({
        trip_id: tripId,
        day_id: dayIdValue,
        name: activityName,
        category: activityCategory || undefined,
        address: activityAddress || undefined,
        est_duration_minutes: parsedDuration,
        cost_estimate: parsedCost,
        energy_level: activityEnergy || undefined,
        must_do: activityMustDo,
      });
      const updatedActivities = await fetchActivitiesForTrip(tripId);
      setActivities(updatedActivities);

      // reset form
      setActivityName("");
      setActivityCategory("");
      setActivityAddress("");
      setActivityDayId("");
      setActivityDuration("");
      setActivityCost("");
      setActivityEnergy("");
      setActivityMustDo(false);
    } catch (err) {
      console.error(err);
      setError("Failed to create activity");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
        <div className="w-full max-w-3xl">
          <p className="text-sm text-slate-400">Loading trip…</p>
        </div>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
        <div className="w-full max-w-3xl space-y-4">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-slate-400 underline"
          >
            ← Back to trips
          </button>
          <p className="text-sm text-red-400">
            {error ?? "Trip not found."}
          </p>
        </div>
      </main>
    );
  }

  // Helper: group activities by day_id
  const activitiesByDay: Record<number, Activity[]> = {};
  const unscheduledActivities: Activity[] = [];

  for (const activity of activities) {
    if (activity.day_id == null) {
      unscheduledActivities.push(activity);
    } else {
      if (!activitiesByDay[activity.day_id]) {
        activitiesByDay[activity.day_id] = [];
      }
      activitiesByDay[activity.day_id].push(activity);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-slate-400 underline mb-1"
            >
              ← Back to trips
            </button>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <p className="text-sm text-slate-400">
              {trip.destination} • {trip.start_date} → {trip.end_date} •{" "}
              <span className="italic">{trip.timezone}</span>
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            Trip #{trip.id}
          </span>
        </header>

        {/* Days section */}
        <section className="bg-slate-900 rounded-xl p-4 shadow space-y-4">
          {/* Header + generate button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Days</h2>
              <span className="text-xs text-slate-400">
                {days.length} day{days.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleGenerateDays}
                disabled={saving}
                className="rounded-lg border border-emerald-500 text-emerald-400 px-3 py-1 text-xs hover:bg-emerald-500/10 disabled:opacity-50"
              >
                Generate days from trip dates
              </button>
            </div>
          </div>

          {/* Create Day Form */}
          <form
            onSubmit={handleCreateDay}
            className="grid gap-2 sm:grid-cols-4 items-end bg-slate-950/40 rounded-lg p-3 border border-slate-800"
          >
            <div>
              <label className="block text-xs mb-1">Date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Label (optional)</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={newDayName}
                onChange={(e) => setNewDayName(e.target.value)}
                placeholder="Day 1, Arrival Day..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs mb-1">Notes (optional)</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={newDayNotes}
                onChange={(e) => setNewDayNotes(e.target.value)}
                placeholder="Brief notes for this day"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-4 mt-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              Add day
            </button>
          </form>

          {/* Existing day list + per-day activities */}
          {days.length === 0 ? (
            <p className="text-sm text-slate-400">
              No days created yet. Use the button above.
            </p>
          ) : (
            <div className="space-y-2">
              {days
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                )
                .map((day) => (
                  <div
                    key={day.id}
                    className="rounded-lg border border-slate-800 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {day.name || day.date}
                        </div>
                        <div className="text-xs text-slate-400">
                          {day.date}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">
                        Day ID: {day.id}
                      </span>
                    </div>
                    {day.notes && (
                      <p className="text-xs text-slate-300 mt-2">
                        {day.notes}
                      </p>
                    )}

                    {/* Activities for this day */}
                    <div className="mt-3 border-t border-slate-800 pt-2">
                      <h3 className="text-xs font-semibold text-slate-400 mb-1">
                        Activities
                      </h3>
                      {activitiesByDay[day.id] &&
                      activitiesByDay[day.id].length > 0 ? (
                        <ul className="space-y-1">
                          {activitiesByDay[day.id].map((act) => (
                            <li
                              key={act.id}
                              className="text-xs flex justify-between gap-2"
                            >
                              <div>
                                <span className="font-medium">
                                  {act.name}
                                </span>
                                {act.category && (
                                  <span className="ml-1 text-slate-400">
                                    ({act.category})
                                  </span>
                                )}
                                {act.address && (
                                  <div className="text-[11px] text-slate-500">
                                    {act.address}
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-[11px] text-slate-400">
                                {act.est_duration_minutes && (
                                  <div>{act.est_duration_minutes} min</div>
                                )}
                                {act.cost_estimate != null && (
                                  <div>${act.cost_estimate.toFixed(0)}</div>
                                )}
                                {act.must_do && (
                                  <div className="text-emerald-400">
                                    must-do
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          No activities assigned yet.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Unscheduled activities */}
        <section className="bg-slate-900 rounded-xl p-4 shadow space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Unscheduled activities</h2>
            <span className="text-xs text-slate-400">
              {unscheduledActivities.length} item
              {unscheduledActivities.length === 1 ? "" : "s"}
            </span>
          </div>
          {unscheduledActivities.length === 0 ? (
            <p className="text-sm text-slate-400">
              No unscheduled activities. Once we add AI scheduling, this
              section will be where new suggestions appear.
            </p>
          ) : (
            <ul className="space-y-1">
              {unscheduledActivities.map((act) => (
                <li
                  key={act.id}
                  className="text-xs flex justify-between gap-2 border border-slate-800 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{act.name}</span>
                    {act.category && (
                      <span className="ml-1 text-slate-400">
                        ({act.category})
                      </span>
                    )}
                    {act.address && (
                      <div className="text-[11px] text-slate-500">
                        {act.address}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {act.est_duration_minutes && (
                      <div>{act.est_duration_minutes} min</div>
                    )}
                    {act.cost_estimate != null && (
                      <div>${act.cost_estimate.toFixed(0)}</div>
                    )}
                    {act.must_do && (
                      <div className="text-emerald-400">must-do</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Create Activity section */}
        <section className="bg-slate-900 rounded-xl p-4 shadow space-y-3">
          <h2 className="text-lg font-semibold">Add activity</h2>
          <p className="text-xs text-slate-400">
            You can add an activity to the trip without assigning it to a day
            yet, or tie it to a specific day (still without a time).
          </p>
          <form
            onSubmit={handleCreateActivity}
            className="grid gap-2 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1">Name</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                required
                placeholder="e.g., Reading Terminal Market"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Category (optional)</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityCategory}
                onChange={(e) => setActivityCategory(e.target.value)}
                placeholder="food, museum, hike..."
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Address (optional)</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityAddress}
                onChange={(e) => setActivityAddress(e.target.value)}
                placeholder="City or specific address"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">
                Assign to day (optional)
              </label>
              <select
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityDayId}
                onChange={(e) => setActivityDayId(e.target.value)}
              >
                <option value="">Unscheduled (no day yet)</option>
                {days
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() -
                      new Date(b.date).getTime()
                  )
                  .map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.date} {day.name ? `– ${day.name}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">
                Duration (minutes, optional)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
                placeholder="e.g., 90"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">
                Cost estimate (optional)
              </label>
              <input
                type="number"
                min={0}
                step="1"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityCost}
                onChange={(e) => setActivityCost(e.target.value)}
                placeholder="0 = free"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">
                Energy level (optional)
              </label>
              <select
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={activityEnergy}
                onChange={(e) => setActivityEnergy(e.target.value)}
              >
                <option value="">Not set</option>
                <option value="low">Low (relaxing)</option>
                <option value="medium">Medium</option>
                <option value="high">High (strenuous)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                id="must-do"
                type="checkbox"
                className="h-3 w-3 rounded border-slate-700"
                checked={activityMustDo}
                onChange={(e) => setActivityMustDo(e.target.checked)}
              />
              <label htmlFor="must-do" className="text-xs text-slate-300">
                Mark as must-do
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              Add activity
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
