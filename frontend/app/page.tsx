"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
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
import {
  formatDate,
  daysUntil,
  isPastTrip,
  isCurrentOrUpcoming,
  sortByStartAsc,
} from "@/lib/utils";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import DatePicker from "@/components/DatePicker";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type BucketItem = {
  id: string;
  name: string;
  location: string;
  notes: string;
};

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

  return (
    <div className="glass-subtle bg-warmCard rounded-2xl overflow-hidden transition-all duration-200 hover:bg-warmCard/80">
      <button
        onClick={toggle}
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
          <div className="border-t border-black/[0.06] pt-3">
            {loading ? (
              <p className="text-xs text-black/40">Loading days...</p>
            ) : days.length === 0 ? (
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
                {days
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime()
                  )
                  .map((d) => (
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

/* ------------------------------------------------------------------ */
/*  Hero widget (shown to everyone)                                    */
/* ------------------------------------------------------------------ */

function HeroWidget() {
  const router = useRouter();
  const { user } = useAuth();

  const [tripName, setTripName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleStartPlanning() {
    if (!tripName.trim() || !dest.trim() || !start || !end) return;

    if (!user) {
      // Save form state for after login
      sessionStorage.setItem(
        "pendingTrip",
        JSON.stringify({ name: tripName.trim(), destination: dest.trim(), start_date: start, end_date: end })
      );
      router.push("/login?redirect=/");
      return;
    }

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

  // Restore pending trip form after login
  useEffect(() => {
    if (!user) return;
    const raw = sessionStorage.getItem("pendingTrip");
    if (!raw) return;
    sessionStorage.removeItem("pendingTrip");
    try {
      const p = JSON.parse(raw);
      setTripName(p.name ?? "");
      setDest(p.destination ?? "");
      setStart(p.start_date ?? "");
      setEnd(p.end_date ?? "");
    } catch {}
  }, [user]);

  const ready = tripName.trim() && dest.trim() && start && end;

  return (
    <section className="glass bg-warmSurface rounded-3xl p-8 md:p-10 relative overflow-hidden">
      <div className="absolute -top-20 left-1/4 w-80 h-80 bg-lightBlue/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-16 right-1/3 w-60 h-60 bg-blue/6 rounded-full blur-[60px] pointer-events-none" />

      <div className="relative">
        <h1 className="text-3xl md:text-4xl tracking-tight text-blue">
          Where to next?
        </h1>
        <p className="mt-2 text-sm text-blue/65">
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
            <LocationAutocomplete
              value={dest}
              onChange={setDest}
              placeholder="Destination"
              containerClassName="flex-1"
              className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
              icon={<MapPin className="h-4 w-4 text-black/40" />}
            />

            <div className="flex gap-3 sm:contents">
              <DatePicker
                value={start}
                onChange={setStart}
                placeholder="Start date"
                className="flex-1 sm:w-36 w-full rounded-xl px-3 py-3"
              />
              <DatePicker
                value={end}
                onChange={setEnd}
                placeholder="End date"
                className="flex-1 sm:w-36 w-full rounded-xl px-3 py-3"
              />
            </div>

            <button
              onClick={handleStartPlanning}
              disabled={creating || !ready}
              className="rounded-xl bg-blue/90 hover:bg-blue px-5 py-3 text-sm font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{creating ? "Creating..." : "Start Planning"}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!user && (
          <p className="mt-4 text-xs text-black/35 text-center">
            You&apos;ll be asked to sign in or create an account to save your trip.
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated Route Graphic (shown to unauthenticated users)           */
/* ------------------------------------------------------------------ */

function AnimatedRouteGraphic() {
  return (
    <section className="glass bg-warmSurface rounded-2xl overflow-hidden">
      <style>{`
        @keyframes naviaDrawPath {
          from { stroke-dashoffset: 1; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes naviaFlowDash {
          from { stroke-dashoffset: 0.12; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes naviaPulseRing {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes naviaFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .navia-path-draw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }
        .navia-p1 { animation: naviaDrawPath 1.4s ease-out 0.3s forwards; }
        .navia-p2 { animation: naviaDrawPath 1.6s ease-out 1.5s forwards; }
        .navia-p3 { animation: naviaDrawPath 1.8s ease-out 2.9s forwards; }

        .navia-flow {
          stroke-dasharray: 0.05 0.07;
          stroke-dashoffset: 0.05;
          opacity: 0;
        }
        .navia-f1 { animation: naviaFlowDash 1s linear 1.7s infinite, naviaFadeIn 0.3s ease-out 1.7s forwards; }
        .navia-f2 { animation: naviaFlowDash 1s linear 3.1s infinite, naviaFadeIn 0.3s ease-out 3.1s forwards; }
        .navia-f3 { animation: naviaFlowDash 1s linear 4.7s infinite, naviaFadeIn 0.3s ease-out 4.7s forwards; }

        .navia-ring {
          fill: none;
          stroke: rgb(75,134,180);
          stroke-width: 1.5px;
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
        }
        .navia-r1 { animation: naviaPulseRing 2s ease-out 0.3s infinite; }
        .navia-r2 { animation: naviaPulseRing 2s ease-out 1.5s infinite; }
        .navia-r3 { animation: naviaPulseRing 2s ease-out 2.9s infinite; }
        .navia-r4 { animation: naviaPulseRing 2s ease-out 4.7s infinite; }

        .navia-dot  { opacity: 0; }
        .navia-d1   { animation: naviaFadeIn 0.4s ease-out 0.3s  forwards; }
        .navia-d2   { animation: naviaFadeIn 0.4s ease-out 1.5s  forwards; }
        .navia-d3   { animation: naviaFadeIn 0.4s ease-out 2.9s  forwards; }
        .navia-d4   { animation: naviaFadeIn 0.4s ease-out 4.7s  forwards; }

        .navia-label {
          opacity: 0;
          font-family: system-ui, sans-serif;
        }
        .navia-l1 { animation: naviaFadeIn 0.4s ease-out 0.5s forwards; }
        .navia-l2 { animation: naviaFadeIn 0.4s ease-out 1.7s forwards; }
        .navia-l3 { animation: naviaFadeIn 0.4s ease-out 3.1s forwards; }
        .navia-l4 { animation: naviaFadeIn 0.4s ease-out 4.9s forwards; }

        .navia-flight-label {
          opacity: 0;
          font-family: system-ui, sans-serif;
        }
        .navia-fl1 { animation: naviaFadeIn 0.4s ease-out 1.7s forwards; }
        .navia-fl2 { animation: naviaFadeIn 0.4s ease-out 3.1s forwards; }
        .navia-fl3 { animation: naviaFadeIn 0.4s ease-out 4.7s forwards; }

        .navia-plane { opacity: 0; animation: naviaFadeIn 0.4s ease-out 0.3s forwards; }

        .navia-grid-line { opacity: 0; animation: naviaFadeIn 1s ease-out 0.1s forwards; }
      `}</style>

      <div className="px-8 pt-8 pb-3">
        <svg viewBox="0 0 760 172" className="w-full h-48" fill="none">
          <defs>
            <pattern id="naviaGrid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="rgb(75,134,180)" fillOpacity="0.1" />
            </pattern>
            {/* Hidden path used by the plane's animateMotion */}
            <path id="naviaFullRoute" d="M 75,135 C 112,52 183,52 218,118 C 263,28 348,28 393,80 C 474,8 590,8 658,108" />
          </defs>

          {/* Dot grid background */}
          <rect width="760" height="172" fill="url(#naviaGrid)" />

          {/* Latitude lines */}
          <line x1="0" y1="22"  x2="760" y2="22"  stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <line x1="0" y1="72"  x2="760" y2="72"  stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <line x1="0" y1="122" x2="760" y2="122" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />

          {/* Longitude curves (slight bow to suggest globe projection) */}
          <path d="M 130,0 C 132,57 132,115 130,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 298,0 C 300,57 301,115 298,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 478,0 C 479,57 480,115 478,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />
          <path d="M 632,0 C 633,57 633,115 632,172" stroke="rgb(75,134,180)" strokeOpacity="0.08" strokeWidth="1" className="navia-grid-line" />

          {/* City halos (soft glow behind each dot) */}
          <circle cx="75"  cy="135" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d1" />
          <circle cx="218" cy="118" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d2" />
          <circle cx="393" cy="80"  r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d3" />
          <circle cx="658" cy="108" r="22" fill="rgb(75,134,180)" fillOpacity="0.07" className="navia-dot navia-d4" />

          {/* Faint static guide paths */}
          <path d="M 75,135 C 112,52 183,52 218,118"  stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />
          <path d="M 218,118 C 263,28 348,28 393,80"  stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />
          <path d="M 393,80 C 474,8 590,8 658,108"    stroke="rgb(149,184,209)" strokeWidth="1.5" strokeOpacity="0.2" strokeDasharray="5 6" />

          {/* Animated draw paths */}
          <path pathLength="1" d="M 75,135 C 112,52 183,52 218,118" stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p1" />
          <path pathLength="1" d="M 218,118 C 263,28 348,28 393,80" stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p2" />
          <path pathLength="1" d="M 393,80 C 474,8 590,8 658,108"   stroke="rgb(75,134,180)" strokeWidth="2.5" strokeLinecap="round" className="navia-path-draw navia-p3" />

          {/* Flowing gold dash overlays */}
          <path pathLength="1" d="M 75,135 C 112,52 183,52 218,118" stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f1" />
          <path pathLength="1" d="M 218,118 C 263,28 348,28 393,80" stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f2" />
          <path pathLength="1" d="M 393,80 C 474,8 590,8 658,108"   stroke="#fee595" strokeWidth="2.5" strokeLinecap="round" className="navia-flow navia-f3" />

          {/* Flight duration labels near arc midpoints */}
          <text x="147" y="56"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl1">5h 30m</text>
          <text x="306" y="36"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl2">7h</text>
          <text x="534" y="22"  textAnchor="middle" fontSize="8.5" fill="rgb(75,134,180)" fillOpacity="0.45" letterSpacing="0.3" className="navia-flight-label navia-fl3">11h 30m</text>

          {/* Pulse rings */}
          <circle cx="75"  cy="135" r="8" className="navia-ring navia-r1" />
          <circle cx="218" cy="118" r="8" className="navia-ring navia-r2" />
          <circle cx="393" cy="80"  r="8" className="navia-ring navia-r3" />
          <circle cx="658" cy="108" r="8" className="navia-ring navia-r4" />

          {/* City dots */}
          <circle cx="75"  cy="135" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d1" />
          <circle cx="218" cy="118" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d2" />
          <circle cx="393" cy="80"  r="5" fill="rgb(75,134,180)" className="navia-dot navia-d3" />
          <circle cx="658" cy="108" r="5" fill="rgb(75,134,180)" className="navia-dot navia-d4" />

          {/* City labels */}
          <text x="75"  y="157" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l1">San Francisco</text>
          <text x="218" y="138" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l2">New York</text>
          <text x="393" y="100" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l3">London</text>
          <text x="658" y="128" textAnchor="middle" fontSize="9.5" fill="rgb(75,134,180)" fillOpacity="0.65" className="navia-label navia-l4">Tokyo</text>

          {/* Animated plane traveling the full route */}
          <g className="navia-plane">
            <animateMotion dur="18s" repeatCount="indefinite" begin="0.3s" rotate="auto">
              <mpath href="#naviaFullRoute" />
            </animateMotion>
            {/* rotate(90) pre-aligns the shape so "right" matches the path tangent direction */}
            <g transform="rotate(90)">
              <path d="M0,-7 L4.5,5 L0,2.5 L-4.5,5 Z" fill="rgb(43,65,98)" fillOpacity="0.55" />
              <ellipse rx="1.8" ry="3" cy="-2" fill="rgb(43,65,98)" fillOpacity="0.3" />
            </g>
          </g>
        </svg>
      </div>

      <p className="text-center text-xs text-black/30 pb-6 tracking-wide">
        Your journey, mapped in Navia.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketLoc, setNewBucketLoc] = useState("");
  const [newBucketNotes, setNewBucketNotes] = useState("");

  // Load bucket list from localStorage
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

  // Fetch trips only when logged in
  useEffect(() => {
    if (!user) {
      setTrips([]);
      return;
    }
    (async () => {
      try {
        setLoadingTrips(true);
        const t = await fetchTrips();
        setTrips(t);
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, [user]);

  const pastTrips = useMemo(
    () => trips.filter(isPastTrip).sort(sortByStartAsc).reverse(),
    [trips]
  );
  const currentTrips = useMemo(
    () => trips.filter(isCurrentOrUpcoming).sort(sortByStartAsc),
    [trips]
  );

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

  // During auth init, show a minimal layout
  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <HeroWidget />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      {/* ---- Hero ---- */}
      <HeroWidget />

      {/* ---- Content gated behind auth ---- */}
      {!user ? (
        <AnimatedRouteGraphic />
      ) : (
        <>
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
              <div className="glass-subtle bg-warmSurface rounded-2xl p-8 text-center">
                <p className="text-sm text-black/40">Loading trips...</p>
              </div>
            ) : currentTrips.length === 0 ? (
              <div className="glass-subtle bg-warmSurface rounded-2xl p-8 text-center">
                <Plane className="h-8 w-8 text-black/20 mx-auto mb-3" />
                <p className="text-sm text-black/40">No upcoming trips</p>
                <p className="text-xs text-black/25 mt-1">Create your first trip above</p>
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
            <section className="glass bg-coolCard rounded-2xl p-5">
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
                      className="w-full text-left rounded-xl bg-black/[0.03] hover:bg-black/[0.06] transition p-3 flex items-center gap-3"
                    >
                      <div className="h-2 w-2 rounded-full bg-pink/30 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-black/65 truncate">{t.name}</div>
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
            <section className="glass bg-coolCard rounded-2xl p-5">
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
                    <div key={b.id} className="rounded-xl bg-black/[0.03] p-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <input
                            className="bg-transparent text-sm text-black/75 w-full focus:outline-none truncate"
                            value={b.name}
                            onChange={(e) => updateBucket(b.id, { name: e.target.value })}
                          />
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 text-black/30 shrink-0" />
                            <LocationAutocomplete
                              value={b.location}
                              onChange={(val) => updateBucket(b.id, { location: val })}
                              containerClassName="flex-1 min-w-0"
                              className="bg-transparent text-[11px] text-black/40 w-full focus:outline-none"
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
                        onChange={(e) => updateBucket(b.id, { notes: e.target.value })}
                        rows={1}
                        placeholder="Notes..."
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Add new bucket item */}
              <div className="rounded-xl bg-black/[0.03] p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    placeholder="Activity name"
                  />
                  <LocationAutocomplete
                    value={newBucketLoc}
                    onChange={setNewBucketLoc}
                    placeholder="Location"
                    containerClassName="flex-1"
                    className="glass-input w-full rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
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
                    className="rounded-lg bg-pink/30 hover:bg-pink/50 border border-pink/40 px-3 py-1.5 text-xs text-pink transition flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
