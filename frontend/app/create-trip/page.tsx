"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createTrip } from "@/lib/api";
import BubbleCard from "@/components/BubbleCard";

export default function CreateTripPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const defaults = useMemo(() => {
    return {
      destination: sp.get("destination") ?? "",
      start_date: sp.get("start") ?? "",
      end_date: sp.get("end") ?? "",
    };
  }, [sp]);

  const [name, setName] = useState("");
  const [destination, setDestination] = useState(defaults.destination);
  const [start, setStart] = useState(defaults.start_date);
  const [end, setEnd] = useState(defaults.end_date);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !destination || !start || !end) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      const trip = await createTrip({
        name,
        destination,
        start_date: start,
        end_date: end,
        timezone: "America/New_York",
      });
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      console.error(err);
      setError("Failed to create trip.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-lightBlue/95">Create Trip</h1>
          <p className="text-sm text-lightBlue/70 mt-1">
            Confirm destination and dates, then create the trip.
          </p>
        </div>

        <BubbleCard
          title="Trip details"
          subtitle="These fields are prefilled from the Home widget when available."
          accent="gold"
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1 text-lightBlue/70">
                Trip Name *
              </label>
              <input
                className="w-full rounded-xl border border-lightBlue/15 bg-darkBlue/40 px-3 py-2 text-sm text-lightBlue/95 placeholder:text-lightBlue/40 focus:outline-none focus:ring-2 focus:ring-honey/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Philadelphia 2026"
                required
              />
            </div>

            <div>
              <label className="block text-xs mb-1 text-lightBlue/70">
                Destination *
              </label>
              <input
                className="w-full rounded-xl border border-lightBlue/15 bg-darkBlue/40 px-3 py-2 text-sm text-lightBlue/95 placeholder:text-lightBlue/40 focus:outline-none focus:ring-2 focus:ring-honey/40"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City, State / Country"
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 text-lightBlue/70">
                  Start Date *
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-lightBlue/15 bg-darkBlue/40 px-3 py-2 text-sm text-lightBlue/95 focus:outline-none focus:ring-2 focus:ring-honey/40"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs mb-1 text-lightBlue/70">
                  End Date *
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-lightBlue/15 bg-darkBlue/40 px-3 py-2 text-sm text-lightBlue/95 focus:outline-none focus:ring-2 focus:ring-honey/40"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-lightBlue/15 bg-white/[0.04] px-4 py-2 text-sm text-lightBlue/80 hover:bg-white/[0.08] transition"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-darkBlue hover:brightness-110 transition disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Trip"}
              </button>
            </div>
          </form>
        </BubbleCard>
      </div>
    </main>
  );
}
