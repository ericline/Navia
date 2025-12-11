// frontend/lib/api.ts
const API_BASE_URL = "http://localhost:8000";

// ---------- Types ----------

export interface Trip {
  id: number;
  name: string;
  destination: string;
  start_date: string; // ISO date
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

export interface Day {
  id: number;
  trip_id: number;
  date: string; // ISO date
  name?: string | null;
  notes?: string | null;
}

export interface DayCreate {
  trip_id: number;
  date: string;
  name?: string;
  notes?: string;
}

export interface Activity {
  id: number;
  trip_id: number;
  day_id?: number | null;

  name: string;
  category?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  est_duration_minutes?: number | null;
  cost_estimate?: number | null;
  energy_level?: string | null;
  must_do: boolean;
}

export interface ActivityCreate {
  trip_id: number;
  day_id?: number | null;

  name: string;
  category?: string;
  address?: string;

  est_duration_minutes?: number | null;
  cost_estimate?: number | null;
  energy_level?: string | null;
  must_do?: boolean;
}

// ---------- Trip API ----------

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE_URL}/trips/`);
  if (!res.ok) {
    console.error("fetchTrips failed", res.status, await res.text());
    throw new Error("Failed to fetch trips");
  }
  return res.json();
}

export async function fetchTrip(id: number): Promise<Trip> {
  const res = await fetch(`${API_BASE_URL}/trips/${id}`);
  if (!res.ok) {
    console.error("fetchTrip failed", res.status, await res.text());
    throw new Error("Failed to fetch trip");
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
    console.error("createTrip failed", res.status, await res.text());
    throw new Error("Failed to create trip");
  }
  return res.json();
}

export async function generateDaysForTrip(tripId: number): Promise<Day[]> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/generate-days`, {
    method: "POST",
  });
  if (!res.ok) {
    console.error("generateDaysForTrip failed", res.status, await res.text());
    throw new Error("Failed to generate days");
  }
  return res.json();
}

// ---------- Days API ----------

export async function fetchDaysForTrip(tripId: number): Promise<Day[]> {
  const res = await fetch(`${API_BASE_URL}/days/trip/${tripId}`);
  if (!res.ok) {
    console.error("fetchDaysForTrip failed", res.status, await res.text());
    throw new Error("Failed to fetch days");
  }
  return res.json();
}

export async function createDay(data: DayCreate): Promise<Day> {
  const res = await fetch(`${API_BASE_URL}/days/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error("createDay failed", res.status, await res.text());
    throw new Error("Failed to create day");
  }
  return res.json();
}

// ---------- Activities API ----------

export async function fetchActivitiesForTrip(
  tripId: number
): Promise<Activity[]> {
  const res = await fetch(`${API_BASE_URL}/activities/trip/${tripId}`);
  if (!res.ok) {
    console.error(
      "fetchActivitiesForTrip failed",
      res.status,
      await res.text()
    );
    throw new Error("Failed to fetch activities");
  }
  return res.json();
}

export async function createActivity(
  data: ActivityCreate
): Promise<Activity> {
  const res = await fetch(`${API_BASE_URL}/activities/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      must_do: data.must_do ?? false,
    }),
  });

  if (!res.ok) {
    console.error("createActivity failed", res.status, await res.text());
    throw new Error("Failed to create activity");
  }
  return res.json();
}
