/**
 * API client for the Navia backend. All fetch calls to the backend are
 * centralized here. Types are defined in ./types and re-exported for
 * backward-compatible imports.
 */

import type {
  Trip,
  TripCreate,
  TripPublic,
  TripDetailed,
  Day,
  DayCreate,
  DayUpdate,
  Activity,
  ActivityCreate,
  ActivityUpdate,
  UserOut,
  UserUpdate,
  RecommendationResponse,
  Arrangement,
  ArrangementAssignment,
  Collaborator,
} from "./types";

// Re-export all types so existing `import { Trip } from '@/lib/api'` still works
export type {
  Trip,
  TripCreate,
  TripPublic,
  TripDetailed,
  Day,
  DayCreate,
  DayUpdate,
  Activity,
  ActivityCreate,
  ActivityUpdate,
  UserPreferences,
  UserOut,
  UserUpdate,
  RecommendedActivity,
  RecommendationResponse,
  ArrangementAssignment,
  Arrangement,
  Collaborator,
} from "./types";

export { DEFAULT_PREFERENCES } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("navia_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------- User API ----------

/** Update the authenticated user's profile or preferences. */
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

/** Fetch public constellation data for a trip (no auth required). */
export async function fetchTripConstellation(tripId: number): Promise<TripPublic> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/constellation`);
  if (!res.ok) throw new Error("Failed to fetch constellation");
  return res.json();
}

// ---------- Aggregated Trip API ----------

/** Fetch all trips with their days and activities in a single request. */
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

/** Fetch all trips for the authenticated user. */
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

/** Fetch a single trip by ID. */
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

/** Create a new trip. */
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

/** Delete a trip by ID. */
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

/** Auto-generate day entries for a trip based on its date range. */
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

/** Fetch all days belonging to a trip. */
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

/** Create a new day entry. */
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

/** Partially update a day (name, notes, per-day time window). */
export async function updateDay(dayId: number, data: DayUpdate): Promise<Day> {
  const res = await fetch(`${API_BASE_URL}/days/${dayId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Failed to update day" }));
    throw new Error(body.detail ?? "Failed to update day");
  }
  return res.json();
}

// ---------- Activities API ----------

/** Fetch all activities belonging to a trip. */
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

/** Fetch the authenticated user's bucket-list activities (trip_id=null). */
export async function fetchBucketActivities(): Promise<Activity[]> {
  const res = await fetch(`${API_BASE_URL}/activities/bucket`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    console.error("fetchBucketActivities failed", res.status, await res.text());
    throw new Error("Failed to fetch bucket list");
  }
  return res.json();
}

/** Create a new activity. */
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

/** Partially update an activity by ID. */
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

/** Delete an activity by ID. */
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

/** Batch-update activity positions within a day. */
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

/** Request AI-generated activity recommendations for a trip. */
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

/** Build a URL for the backend Google Places photo proxy. */
export function placePhotoUrl(photoReference: string, maxHeightPx = 200): string {
  return `${API_BASE_URL}/ai/places/photo?ref=${encodeURIComponent(photoReference)}&max_h=${maxHeightPx}`;
}

/** Record recommendation feedback (fire-and-forget; errors are logged but swallowed). */
export async function sendRecommendationFeedback(
  tripId: number,
  placeId: number | null,
  signal: "added" | "skipped" | "scheduled" | "deleted" | "must_do"
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/trips/${tripId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ place_id: placeId, signal }),
    });
    if (!res.ok) {
      console.warn("sendRecommendationFeedback non-ok", res.status);
    }
  } catch (err) {
    console.warn("sendRecommendationFeedback failed", err);
  }
}

/** Request AI-generated day arrangements for a trip's activities. */
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

/** Apply a chosen arrangement to a trip (batch-updates activity day/position/time). */
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

/** Fetch all collaborators on a trip. */
export async function fetchCollaborators(tripId: number): Promise<Collaborator[]> {
  const res = await fetch(`${API_BASE_URL}/trips/${tripId}/collaborators`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error("Failed to fetch collaborators");
  return res.json();
}

/** Invite a collaborator to a trip by email. */
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

/** Remove a collaborator from a trip. */
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
