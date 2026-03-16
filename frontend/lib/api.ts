// frontend/lib/api.ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------- Auth helpers ----------

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("navia_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export interface ActivityUpdate {
  day_id?: number | null;
  name?: string;
  category?: string;
  address?: string;
  est_duration_minutes?: number | null;
  cost_estimate?: number | null;
  energy_level?: string | null;
  must_do?: boolean;
  unschedule?: boolean;
}

// ---------- User API ----------

export interface UserUpdate {
  name?: string;
  email?: string;
  birthday?: string | null;
}

export async function updateUser(data: UserUpdate): Promise<{
  id: number;
  name: string;
  email: string;
  birthday: string | null;
}> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Update failed" }));
    throw new Error(err.detail ?? "Update failed");
  }
  return res.json();
}

// ---------- Public API ----------

export interface TripPublic {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  day_count: number;
}

export async function fetchTripConstellation(tripId: number): Promise<TripPublic> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/constellation`);
  if (!res.ok) throw new Error("Failed to fetch constellation");
  return res.json();
}

// ---------- Trip API ----------

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE_URL}/trips/`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("fetchTrips failed", res.status, await res.text());
    throw new Error("Failed to fetch trips");
  }
  return res.json();
}

export async function fetchTrip(id: number): Promise<Trip> {
  const res = await fetch(`${API_BASE_URL}/trips/${id}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("fetchTrip failed", res.status, await res.text());
    throw new Error("Failed to fetch trip");
  }
  return res.json();
}

export async function createTrip(data: TripCreate): Promise<Trip> {
  const res = await fetch(`${API_BASE_URL}/trips/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    console.error("createTrip failed", res.status, await res.text());
    throw new Error("Failed to create trip");
  }
  return res.json();
}

export async function deleteTrip(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/trips/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("deleteTrip failed", res.status, await res.text());
    throw new Error("Failed to delete trip");
  }
}

export async function generateDaysForTrip(tripId: number): Promise<Day[]> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/generate-days`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("generateDaysForTrip failed", res.status, await res.text());
    throw new Error("Failed to generate days");
  }
  return res.json();
}

// ---------- Days API ----------

export async function fetchDaysForTrip(tripId: number): Promise<Day[]> {
  const res = await fetch(`${API_BASE_URL}/days/trip/${tripId}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("fetchDaysForTrip failed", res.status, await res.text());
    throw new Error("Failed to fetch days");
  }
  return res.json();
}

export async function createDay(data: DayCreate): Promise<Day> {
  const res = await fetch(`${API_BASE_URL}/days/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
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
  const res = await fetch(`${API_BASE_URL}/activities/trip/${tripId}`, {
    headers: { ...authHeaders() },
  });
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
    headers: { "Content-Type": "application/json", ...authHeaders() },
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

export async function updateActivity(
  id: number,
  data: ActivityUpdate
): Promise<Activity> {
  const res = await fetch(`${API_BASE_URL}/activities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error("updateActivity failed", res.status, await res.text());
    throw new Error("Failed to update activity");
  }
  return res.json();
}

export async function deleteActivity(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/activities/${id}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("deleteActivity failed", res.status, await res.text());
    throw new Error("Failed to delete activity");
  }
}

// ---------- Collaborators API ----------

export interface Collaborator {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role: string;
}

export async function fetchCollaborators(tripId: number): Promise<Collaborator[]> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/collaborators`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch collaborators");
  return res.json();
}

export async function addCollaborator(
  tripId: number,
  email: string,
  role: string = "editor"
): Promise<Collaborator> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to add collaborator" }));
    throw new Error(err.detail ?? "Failed to add collaborator");
  }
  return res.json();
}

export async function removeCollaborator(tripId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/collaborators/${userId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to remove collaborator" }));
    throw new Error(err.detail ?? "Failed to remove collaborator");
  }
}
