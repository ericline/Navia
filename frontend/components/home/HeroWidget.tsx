/**
 * HeroWidget - Trip creation form displayed prominently on the home page.
 * Handles both authenticated (immediate create) and unauthenticated
 * (session storage + redirect to login) flows.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronRight, Tag } from "lucide-react";
import { createTrip } from "@/lib/api";
import LocationAutocomplete from "@/components/ui/LocationAutocomplete";
import DatePicker from "@/components/ui/DatePicker";
import { useAuth } from "@/contexts/AuthContext";

export default function HeroWidget() {
  const router = useRouter();
  const { user } = useAuth();

  const [tripName, setTripName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
  }, [start, end]);

  async function handleStartPlanning() {
    if (!tripName.trim() || !dest.trim() || !start || !end) return;

    if (new Date(end) < new Date(start)) {
      setFormError("End date must be on or after the start date.");
      return;
    }

    if (!user) {
      // Persist form data so it survives the login redirect
      sessionStorage.setItem(
        "pendingTrip",
        JSON.stringify({ name: tripName.trim(), destination: dest.trim(), start_date: start, end_date: end })
      );
      router.push("/login?redirect=/");
      return;
    }

    try {
      setCreating(true);
      setFormError(null);
      const trip = await createTrip({
        name: tripName.trim(),
        destination: dest.trim(),
        start_date: start,
        end_date: end,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.push(`/trips/${trip.id}?recommend=1`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create trip.");
    } finally {
      setCreating(false);
    }
  }

  // Restore pending trip form after login redirect
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
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
            <input
              className="glass-input w-full rounded-xl pl-10 pr-4 py-3 text-sm text-black/85 placeholder:text-black/30"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              placeholder="Trip name  (e.g., Japan 2026)"
            />
          </div>

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
                minDate={start || undefined}
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

          {formError && (
            <p className="text-xs text-rose-600/90 pl-1" role="alert">
              {formError}
            </p>
          )}
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
