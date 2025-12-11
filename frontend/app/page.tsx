"use client";

import { useEffect, useState } from "react";
import { fetchTrips, createTrip, Trip } from "@/lib/api";
import Link from "next/link";

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTrips();
        setTrips(data);
      } catch (err) {
        setError("Failed to load trips");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const newTrip = await createTrip({
        name,
        destination,
        start_date: startDate,
        end_date: endDate,
        timezone: "America/New_York",
      });

      setTrips((prev) => [...prev, newTrip]);
      setName("");
      setDestination("");
      setStartDate("");
      setEndDate("");
    } catch (err) {
      setError("Failed to create trip");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Navia</h1>
          <p className="text-sm text-slate-400">
            AI-powered travel planner (early prototype)
          </p>
        </header>

        <section className="bg-slate-900 rounded-xl p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Create a trip</h2>
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Trip name</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Japan Spring 2026"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">Destination</label>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                placeholder="Tokyo, Kyoto"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Start date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="sm:col-span-2 mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium hover:bg-emerald-400 transition"
            >
              Save trip
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </section>

        <section className="bg-slate-900 rounded-xl p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Your trips</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-slate-400">
              No trips yet. Create one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {trips.map((trip) => (
                <li
                  key={trip.id}
                  className="rounded-lg border border-slate-800 px-3 py-2 text-sm flex justify-between"
                >
                  <div>
                    <div className="font-medium">{trip.name}</div>
                    <div className="text-slate-400">
                      {trip.destination} • {trip.start_date} → {trip.end_date}
                    </div>
                  </div>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-medium underline"
                  >
                    View details
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
