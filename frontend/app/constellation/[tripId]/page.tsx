/** Public constellation page — shareable trip visualization (no auth required). */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripPublic, fetchTripConstellation } from "@/lib/api";
import { formatDate, formatDestination } from "@/lib/utils";
import { TripConstellation } from "@/components/constellation";

export default function ConstellationPublicPage() {
  const params = useParams();
  const tripIdParam = params?.tripId;
  const tripId = Array.isArray(tripIdParam)
    ? parseInt(tripIdParam[0], 10)
    : parseInt(tripIdParam as string, 10);

  const [data, setData] = useState<TripPublic | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tripId || Number.isNaN(tripId)) {
      setError(true);
      return;
    }
    fetchTripConstellation(tripId)
      .then(setData)
      .catch(() => setError(true));
  }, [tripId]);

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-warmBg">
        <p className="text-sm text-black/40">Constellation not found.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-warmBg">
        <p className="text-sm text-black/40">Loading...</p>
      </main>
    );
  }

  // Generate synthetic days for the constellation (we only have day_count)
  const syntheticDays = Array.from({ length: data.day_count }, (_, i) => ({
    id: i + 1,
    trip_id: data.id,
    date: new Date(
      new Date(data.start_date + "T00:00:00").getTime() + i * 86400000
    )
      .toISOString()
      .split("T")[0],
  }));

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-warmBg px-6 py-12">
      <p className="text-sm text-black/40 mb-2 tracking-wide uppercase">
        Constellation
      </p>
      <h1 className="text-2xl font-bold text-black/80 mb-1">{data.name}</h1>
      <p className="text-sm text-black/45 mb-8">
        {formatDestination(data.destination)} · {formatDate(data.start_date)} —{" "}
        {formatDate(data.end_date)}
      </p>

      <div className="w-full max-w-2xl">
        <TripConstellation
          tripId={data.id}
          tripName={data.name}
          days={syntheticDays}
          destination={data.destination}
          size="reveal"
        />
      </div>

      <a
        href="/"
        className="mt-10 text-sm text-blue/70 hover:text-blue transition"
      >
        Plan your trip on Navia &rarr;
      </a>
    </main>
  );
}
