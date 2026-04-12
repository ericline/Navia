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
  owner_id: number | null;
  owner_name?: string | null;
  owner_email?: string | null;
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
  start_time?: string | null;
  notes?: string | null;
  position: number;
}

export interface ActivityCreate {
  trip_id: number;
  day_id?: number | null;

  name: string;
  category?: string;
  address?: string;

  lat?: number | null;
  lng?: number | null;

  est_duration_minutes?: number | null;
  cost_estimate?: number | null;
  energy_level?: string | null;
  must_do?: boolean;
  start_time?: string | null;
  notes?: string | null;
}

export interface ActivityUpdate {
  day_id?: number | null;
  name?: string;
  category?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  est_duration_minutes?: number | null;
  cost_estimate?: number | null;
  energy_level?: string | null;
  must_do?: boolean;
  start_time?: string | null;
  notes?: string | null;
  unschedule?: boolean;
}

// ---------- User API ----------

export interface UserPreferences {
  max_walking_km: number;
  max_activity_budget: number;
  likes: string[];
  dislikes: string[];
  pace: "relaxed" | "balanced" | "packed";
  day_start: string; // "HH:MM:SS"
  day_end: string;
  dietary: string[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  max_walking_km: 2.0,
  max_activity_budget: 100.0,
  likes: [],
  dislikes: [],
  pace: "balanced",
  day_start: "09:00:00",
  day_end: "21:00:00",
  dietary: [],
};

export interface UserOut {
  id: number;
  name: string;
  email: string;
  birthday: string | null;
  preferences: UserPreferences;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  birthday?: string | null;
  preferences?: UserPreferences;
}

export async function updateUser(data: UserUpdate): Promise<UserOut> {
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

// ---------- Aggregated Trip API ----------

export interface TripDetailed extends Trip {
  days: Day[];
  activities: Activity[];
}

export async function fetchTripsDetailed(): Promise<TripDetailed[]> {
  const res = await fetch(`${API_BASE_URL}/trips/detailed`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("fetchTripsDetailed failed", res.status, await res.text());
    throw new Error("Failed to fetch detailed trips");
  }
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
    let msg = "Failed to create trip";
    try {
      const body = await res.json();
      if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        msg = body.detail[0].msg.replace(/^Value error,\s*/, "");
      } else if (typeof body.detail === "string") {
        msg = body.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
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

export async function reorderActivities(
  orders: { activity_id: number; position: number }[]
): Promise<Activity[]> {
  const res = await fetch(`${API_BASE_URL}/activities/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ orders }),
  });
  if (!res.ok) {
    console.error("reorderActivities failed", res.status, await res.text());
    throw new Error("Failed to reorder activities");
  }
  return res.json();
}

// ---------- AI / Recommendations API ----------

export interface RecommendedActivity {
  name: string;
  category?: string;
  address?: string;
  est_duration_minutes?: number;
  cost_estimate?: number;
  energy_level?: "low" | "medium" | "high";
  must_do?: boolean;
  notes?: string;
}

export interface RecommendationResponse {
  enabled: boolean;
  recommendations: RecommendedActivity[];
}

export async function fetchRecommendations(
  tripId: number
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE_URL}/ai/trips/${tripId}/recommend`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch recommendations");
  }
  return res.json();
}

export interface ArrangementAssignment {
  activity_id: number;
  day_id: number;
  position: number;
  start_time?: string | null;
}

export interface Arrangement {
  name: string;
  description: string;
  assignments: ArrangementAssignment[];
}

export async function generateArrangements(
  tripId: number
): Promise<Arrangement[]> {
  const res = await fetch(`${API_BASE_URL}/ai/trips/${tripId}/arrange`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Failed to generate arrangements" }));
    throw new Error(body.detail ?? "Failed to generate arrangements");
  }
  return res.json();
}

export async function applyArrangement(
  tripId: number,
  assignments: ArrangementAssignment[]
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/ai/trips/${tripId}/apply-arrangement`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ assignments }),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to apply arrangement");
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
