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
  deleteTrip,
} from "@/lib/api";
import { MapPin, Calendar, Trash2, CheckCircle } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function ActivityRow({ act }: { act: Activity }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className="text-xs font-medium text-white/80">{act.name}</span>
        {act.category && (
          <span className="text-[11px] text-white/40 ml-1.5">
            ({act.category})
          </span>
        )}
        {act.address && (
          <div className="text-[11px] text-white/35 mt-0.5">{act.address}</div>
        )}
      </div>
      <div className="text-right text-[11px] text-white/40 shrink-0 space-y-0.5">
        {act.est_duration_minutes && (
          <div>{act.est_duration_minutes} min</div>
        )}
        {act.cost_estimate != null && (
          <div>${act.cost_estimate.toFixed(0)}</div>
        )}
        {act.must_do && <div className="text-blue/60">must-do</div>}
      </div>
    </div>
  );
}

const inputClass =
  "glass-input w-full rounded-xl px-3 py-2 text-sm text-white/90 placeholder:text-white/30";
const labelClass = "block text-xs mb-1 text-white/50";
const selectClass =
  "glass-input block w-full rounded-xl px-3 py-2 text-sm text-white/90";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();

  const tripIdParam = params?.tripId;
  const tripId = Array.isArray(tripIdParam)
    ? parseInt(tripIdParam[0], 10)
    : parseInt(tripIdParam as string, 10);

  const [newDayDate, setNewDayDate] = useState("");
  const [newDayName, setNewDayName] = useState("");
  const [newDayNotes, setNewDayNotes] = useState("");

  const [activityName, setActivityName] = useState("");
  const [activityCategory, setActivityCategory] = useState("");
  const [activityAddress, setActivityAddress] = useState("");
  const [activityDayId, setActivityDayId] = useState<string>("");
  const [activityDuration, setActivityDuration] = useState<string>("");
  const [activityCost, setActivityCost] = useState<string>("");
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
      setDays(await fetchDaysForTrip(tripId));
    } catch (err) {
      console.error(err);
      setError("Failed to generate days");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tripId || Number.isNaN(tripId) || !newDayDate) return;
    try {
      setSaving(true);
      await createDay({
        trip_id: tripId,
        date: newDayDate,
        name: newDayName || undefined,
        notes: newDayNotes || undefined,
      });
      setDays(await fetchDaysForTrip(tripId));
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

  async function handleCreateActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tripId || Number.isNaN(tripId) || !activityName) return;

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
      setActivities(await fetchActivitiesForTrip(tripId));
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
    router.push("/current-trips");
  }

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/background.jpg')" }}
        />
        <div className="fixed inset-0 -z-10 bg-darkBlue/40" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-white/40">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="relative min-h-screen">
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/background.jpg')" }}
        />
        <div className="fixed inset-0 -z-10 bg-darkBlue/40" />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-sm text-red-400">{error ?? "Trip not found."}</p>
        </main>
      </div>
    );
  }

  const activitiesByDay: Record<number, Activity[]> = {};
  const unscheduledActivities: Activity[] = [];
  for (const activity of activities) {
    if (activity.day_id == null) {
      unscheduledActivities.push(activity);
    } else {
      (activitiesByDay[activity.day_id] ??= []).push(activity);
    }
  }

  const sortedDays = days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      />
      <div className="fixed inset-0 -z-10 bg-darkBlue/40" />

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white/95 tracking-tight">
              {trip.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-white/40" />
                <span className="text-sm text-white/50">{trip.destination}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-white/40" />
                <span className="text-sm text-white/50">
                  {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/35">
              {trip.timezone}
            </span>
            <button
              onClick={handleDeleteTrip}
              className="flex items-center gap-1.5 rounded-xl border border-red-400/20 text-red-400/60 hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400/80 px-3 py-1.5 text-xs transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 rounded-xl bg-blue/90 hover:bg-blue px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Finish
            </button>
          </div>
        </div>

        {/* Days section */}
        <section className="glass rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white/90">Days</h2>
              <span className="text-xs text-white/40">
                {days.length} day{days.length === 1 ? "" : "s"}
              </span>
            </div>
            <button
              onClick={handleGenerateDays}
              disabled={saving}
              className="rounded-xl border border-blue/25 text-blue/70 px-4 py-2 text-xs font-medium hover:bg-blue/10 hover:border-blue/40 transition disabled:opacity-50"
            >
              Generate days from dates
            </button>
          </div>

          {/* Create Day Form */}
          <form
            onSubmit={handleCreateDay}
            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 grid gap-3 sm:grid-cols-4 items-end"
          >
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                className={inputClass}
                value={newDayDate}
                onChange={(e) => setNewDayDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Label (optional)</label>
              <input
                className={inputClass}
                value={newDayName}
                onChange={(e) => setNewDayName(e.target.value)}
                placeholder="Day 1, Arrival..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes (optional)</label>
              <input
                className={inputClass}
                value={newDayNotes}
                onChange={(e) => setNewDayNotes(e.target.value)}
                placeholder="Brief notes for this day"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] px-3 py-2 text-xs font-medium text-white/60 transition disabled:opacity-50"
            >
              Add day
            </button>
          </form>

          {/* Day list */}
          {days.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">
              No days yet — generate from trip dates or add one manually.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedDays.map((day) => (
                <div
                  key={day.id}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-white/90">
                        {day.name || formatDate(day.date)}
                      </span>
                      <span className="text-xs text-white/35 ml-2">
                        {day.date}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/30">
                      {(activitiesByDay[day.id] ?? []).length} activities
                    </span>
                  </div>
                  {day.notes && (
                    <p className="text-xs text-white/40 mt-1.5">{day.notes}</p>
                  )}
                  {activitiesByDay[day.id]?.length > 0 && (
                    <div className="mt-3 border-t border-white/[0.05] pt-3 space-y-2">
                      {activitiesByDay[day.id].map((act) => (
                        <ActivityRow key={act.id} act={act} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Unscheduled activities */}
        <section className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white/90">
              Unscheduled
            </h2>
            <span className="text-xs text-white/40">
              {unscheduledActivities.length} item
              {unscheduledActivities.length === 1 ? "" : "s"}
            </span>
          </div>
          {unscheduledActivities.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">
              No unscheduled activities — AI scheduling suggestions will appear
              here.
            </p>
          ) : (
            <div className="space-y-2">
              {unscheduledActivities.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5"
                >
                  <ActivityRow act={act} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add Activity */}
        <section className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white/90">
              Add activity
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Schedule to a specific day or leave unscheduled for later.
            </p>
          </div>

          <form
            onSubmit={handleCreateActivity}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                required
                placeholder="e.g., Reading Terminal Market"
              />
            </div>

            <div>
              <label className={labelClass}>Category (optional)</label>
              <input
                className={inputClass}
                value={activityCategory}
                onChange={(e) => setActivityCategory(e.target.value)}
                placeholder="food, museum, hike..."
              />
            </div>

            <div>
              <label className={labelClass}>Address (optional)</label>
              <input
                className={inputClass}
                value={activityAddress}
                onChange={(e) => setActivityAddress(e.target.value)}
                placeholder="City or specific address"
              />
            </div>

            <div>
              <label className={labelClass}>Assign to day (optional)</label>
              <select
                className={selectClass}
                style={{ colorScheme: "dark" }}
                value={activityDayId}
                onChange={(e) => setActivityDayId(e.target.value)}
              >
                <option value="">Unscheduled</option>
                {sortedDays.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.date}
                    {day.name ? ` – ${day.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Duration (min, optional)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
                placeholder="e.g., 90"
              />
            </div>

            <div>
              <label className={labelClass}>Cost estimate (optional)</label>
              <input
                type="number"
                min={0}
                step="1"
                className={inputClass}
                value={activityCost}
                onChange={(e) => setActivityCost(e.target.value)}
                placeholder="0 = free"
              />
            </div>

            <div>
              <label className={labelClass}>Energy level (optional)</label>
              <select
                className={selectClass}
                style={{ colorScheme: "dark" }}
                value={activityEnergy}
                onChange={(e) => setActivityEnergy(e.target.value)}
              >
                <option value="">Not set</option>
                <option value="low">Low (relaxing)</option>
                <option value="medium">Medium</option>
                <option value="high">High (strenuous)</option>
              </select>
            </div>

            <div className="flex items-center gap-2.5 mt-1">
              <input
                id="must-do"
                type="checkbox"
                className="h-3.5 w-3.5 rounded"
                checked={activityMustDo}
                onChange={(e) => setActivityMustDo(e.target.checked)}
              />
              <label htmlFor="must-do" className="text-xs text-white/60">
                Mark as must-do
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="sm:col-span-2 mt-1 rounded-xl bg-blue/90 hover:bg-blue px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add activity"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
