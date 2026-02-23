"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Plane,
  Tag,
} from "lucide-react";
import {
  Activity,
  Day,
  Trip,
  fetchTrips,
  fetchDaysForTrip,
  fetchActivitiesForTrip,
  createTrip,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

type BucketItem = {
  id: string;
  name: string;
  location: string;
  notes: string;
};

function isPastTrip(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date);
  end.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}

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

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Ongoing";
  return `In ${diff} days`;
}

/* ------------------------------------------------------------------ */
/*  Upcoming trip card (expandable)                                    */
/* ------------------------------------------------------------------ */

function UpcomingTripCard({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && days.length === 0 && !loading) {
      try {
        setLoading(true);
        const [d, a] = await Promise.all([
          fetchDaysForTrip(trip.id),
          fetchActivitiesForTrip(trip.id),
        ]);
        setDays(d);
        setActs(a);
      } finally {
        setLoading(false);
      }
    }
  }

  const actsByDay = useMemo(() => {
    const map: Record<number, Activity[]> = {};
    for (const a of acts) {
      if (a.day_id == null) continue;
      (map[a.day_id] ??= []).push(a);
    }
    return map;
  }, [acts]);

  const countdown = daysUntil(trip.start_date);

  return (
    <div className="glass-subtle rounded-2xl overflow-hidden transition-all duration-200 hover:bg-white/[0.06]" style={{ background: '#f0e5c4' }}>
      <button
        onClick={toggle}
        className="w-full text-left p-4 flex items-start gap-4"
      >
        <div className="mt-1.5 h-2 w-2 rounded-full bg-pink/70 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-black/85 truncate">{trip.name}</h3>
            <span className="text-[11px] text-pink shrink-0">
              {countdown}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="h-3 w-3 text-black/50 shrink-0" />
            <span className="text-xs text-black/50 truncate">
              {trip.destination}
            </span>
          </div>
          <div className="text-[11px] text-black/35 mt-1">
            {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-black/30 shrink-0 mt-1 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="border-t border-white/[0.06] pt-3">
            {loading ? (
              <p className="text-xs text-black/40">Loading days...</p>
            ) : days.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-xs text-black/40">
                  No days generated yet
                </p>
                <button
                  onClick={() => router.push(`/trips/${trip.id}`)}
                  className="mt-2 text-xs text-blue/70 hover:text-blue/90 transition"
                >
                  Open trip to generate days →
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {days
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                  )
                  .map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
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

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const router = useRouter();

  const [tripName, setTripName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketLoc, setNewBucketLoc] = useState("");
  const [newBucketNotes, setNewBucketNotes] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("navia_bucket");
    if (raw) {
      try {
        setBucket(JSON.parse(raw));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("navia_bucket", JSON.stringify(bucket));
  }, [bucket]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingTrips(true);
        const t = await fetchTrips();
        setTrips(t);
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, []);

  const pastTrips = useMemo(
    () => trips.filter(isPastTrip).sort(sortByStartAsc).reverse(),
    [trips]
  );
  const currentTrips = useMemo(
    () => trips.filter(isCurrentOrUpcoming).sort(sortByStartAsc),
    [trips]
  );

  async function handleCreateTrip() {
    if (!tripName.trim() || !dest.trim() || !start || !end) return;
    try {
      setCreating(true);
      const trip = await createTrip({
        name: tripName.trim(),
        destination: dest.trim(),
        start_date: start,
        end_date: end,
        timezone: "America/New_York",
      });
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  function addBucket() {
    if (!newBucketName || !newBucketLoc) return;
    setBucket((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newBucketName,
        location: newBucketLoc,
        notes: newBucketNotes,
      },
    ]);
    setNewBucketName("");
    setNewBucketLoc("");
    setNewBucketNotes("");
  }

  function updateBucket(id: string, patch: Partial<BucketItem>) {
    setBucket((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function deleteBucket(id: string) {
    setBucket((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: "#faf8f6" }}
      />

    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* ---- Hero ---- */}
      <section className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden" style={{ background: '#f1ebe6' }}>
        <div className="absolute -top-20 left-1/4 w-80 h-80 bg-lightBlue/8 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 right-1/3 w-60 h-60 bg-blue/6 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative">
          <h1 className="text-3xl md:text-4xl tracking-tight" style={{ color: '#4b86b4' }}>
            Where to next?
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#4b86b4', opacity: 0.65 }}>
            Plan your perfect trip with AI-powered scheduling
          </p>

          <div className="mt-8 space-y-3">
            {/* Trip name */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <input
                className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="Trip name  (e.g., Japan 2026)"
              />
            </div>

            {/* Destination + dates + button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
                <input
                  className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  placeholder="Destination"
                />
              </div>

              <div className="flex gap-3 sm:contents">
                <div className="flex-1 sm:w-36 relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30 pointer-events-none" />
                  <input
                    type="date"
                    className="glass-input w-full rounded-xl pl-10 pr-3 py-3 text-sm text-black/85"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="flex-1 sm:w-36 relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30 pointer-events-none" />
                  <input
                    type="date"
                    className="glass-input w-full rounded-xl pl-10 pr-3 py-3 text-sm text-black/85"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={handleCreateTrip}
                disabled={creating || !tripName.trim() || !dest.trim() || !start || !end}
                className="rounded-xl bg-blue/90 hover:bg-blue px-5 py-3 text-sm font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="sm:hidden">{creating ? "Creating..." : "Start Planning"}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Upcoming Trips ---- */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-black/85">Upcoming</h2>
            {currentTrips.length > 0 && (
              <span className="text-[11px] text-pink bg-pink/[0.12] rounded-full px-2.5 py-0.5">
                {currentTrips.length}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push("/current-trips")}
            className="text-xs text-black/40 hover:text-black/55 transition flex items-center gap-1"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {loadingTrips ? (
          <div className="glass-subtle rounded-2xl p-8 text-center" style={{ background: '#f1ebe6' }}>
            <p className="text-sm text-black/40">Loading trips...</p>
          </div>
        ) : currentTrips.length === 0 ? (
          <div className="glass-subtle rounded-2xl p-8 text-center" style={{ background: '#f1ebe6' }}>
            <Plane className="h-8 w-8 text-black/20 mx-auto mb-3" />
            <p className="text-sm text-black/40">No upcoming trips</p>
            <p className="text-xs text-black/25 mt-1">
              Create your first trip above
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {currentTrips.slice(0, 6).map((t) => (
              <UpcomingTripCard key={t.id} trip={t} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Past Trips & Bucket List ---- */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Past Trips */}
        <section className="glass rounded-2xl p-5" style={{ background: '#e0ebf4' }}>
          <h2 className="text-sm font-semibold text-black/75 mb-3 flex items-center gap-2">
            Past Trips
            {pastTrips.length > 0 && (
              <span className="text-[10px] text-pink bg-pink/[0.12] rounded-full px-2 py-0.5">
                {pastTrips.length}
              </span>
            )}
          </h2>

          <div className="space-y-2 pr-1">
            {loadingTrips ? (
              <p className="text-xs text-black/40">Loading...</p>
            ) : pastTrips.length === 0 ? (
              <p className="text-xs text-black/30 py-4 text-center">
                No past trips yet
              </p>
            ) : (
              pastTrips.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/trips/${t.id}`)}
                  className="w-full text-left rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition p-3 flex items-center gap-3"
                >
                  <div className="h-2 w-2 rounded-full bg-pink/30 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-black/65 truncate">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-black/35">
                      {t.destination} · {formatDate(t.start_date)} —{" "}
                      {formatDate(t.end_date)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Bucket List */}
        <section className="glass rounded-2xl p-5" style={{ background: '#e0ebf4' }}>
          <h2 className="text-sm font-semibold text-black/75 mb-3 flex items-center gap-2">
            Bucket List
            {bucket.length > 0 && (
              <span className="text-[10px] text-blue/50 bg-blue/[0.08] rounded-full px-2 py-0.5">
                {bucket.length}
              </span>
            )}
          </h2>

          <div className="space-y-2 pr-1 mb-3">
            {bucket.length === 0 ? (
              <p className="text-xs text-black/30 py-4 text-center">
                Save ideas for future trips
              </p>
            ) : (
              bucket.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl bg-white/[0.03] p-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        className="bg-transparent text-sm text-black/75 w-full focus:outline-none truncate"
                        value={b.name}
                        onChange={(e) =>
                          updateBucket(b.id, { name: e.target.value })
                        }
                      />
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-black/30 shrink-0" />
                        <input
                          className="bg-transparent text-[11px] text-black/40 w-full focus:outline-none"
                          value={b.location}
                          onChange={(e) =>
                            updateBucket(b.id, { location: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => deleteBucket(b.id)}
                      className="text-black/20 hover:text-blue/70 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    className="mt-1.5 w-full bg-transparent text-[11px] text-black/30 resize-none focus:outline-none"
                    value={b.notes}
                    onChange={(e) =>
                      updateBucket(b.id, { notes: e.target.value })
                    }
                    rows={1}
                    placeholder="Notes..."
                  />
                </div>
              ))
            )}
          </div>

          {/* Add new bucket item */}
          <div className="rounded-xl bg-white/[0.03] p-3 space-y-2">
            <div className="flex gap-2">
              <input
                className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="Activity name"
              />
              <input
                className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
                value={newBucketLoc}
                onChange={(e) => setNewBucketLoc(e.target.value)}
                placeholder="Location"
              />
            </div>
            <div className="flex gap-2">
              <input
                className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
                value={newBucketNotes}
                onChange={(e) => setNewBucketNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <button
                onClick={addBucket}
                className="rounded-lg bg-pink/30 hover:bg-pink/50 border border-pink/40 px-3 py-1.5 text-xs text-pink hover:text-pink transition flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
    </div>
  );
}
