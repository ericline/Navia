// frontend/lib/api.ts
const API_BASE_URL = "http://localhost:8000";

export interface Trip {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  timezone: string;
}

export interface TripCreate {
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  timezone?: string;
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE_URL}/trips/`);
  if (!res.ok) {
    throw new Error("Failed to fetch trips");
  }
  return res.json();
}

export async function createTrip(data: TripCreate): Promise<Trip> {
  const res = await fetch(`${API_BASE_URL}/trips/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error("Failed to create trip");
  }
  return res.json();
}
