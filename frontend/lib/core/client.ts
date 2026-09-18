/**
 * Platform-agnostic Navia API client.
 *
 * `createApiClient({ baseUrl, getToken })` returns every API function bound to a
 * token provider, so the web app binds it to localStorage and the Expo app binds
 * it to the Keychain. No DOM, Next.js, or `@/` imports in this file.
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
  ActivityBatchResult,
  BatchTarget,
  UserOut,
  UserUpdate,
  RecommendationResponse,
  Arrangement,
  ArrangementAssignment,
  Collaborator,
  LinkResolveResponse,
  ImportPreview,
  ExportScope,
  ExportFormat,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string;
  /** Return the current JWT (or null). May be async on native (Keychain). */
  getToken: () => string | null | Promise<string | null>;
  /** Optional fetch override (tests, RN polyfills). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
}

/** Extract a readable message from a FastAPI error body. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return String(body.detail[0].msg).replace(/^Value error,\s*/, "");
    }
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* non-JSON body */
  }
  return fallback;
}

export function createApiClient(opts: ApiClientOptions) {
  const { baseUrl } = opts;
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await opts.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** JSON request helper. Throws Error(detail) on non-2xx. */
  async function request<T>(
    path: string,
    init: { method?: string; json?: unknown; fallback?: string; raw?: BodyInit; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { ...(await authHeaders()), ...(init.headers ?? {}) };
    let body: BodyInit | undefined = init.raw;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const res = await doFetch(`${baseUrl}${path}`, { method: init.method ?? "GET", headers, body });
    if (!res.ok) {
      throw new Error(await errorMessage(res, init.fallback ?? `Request failed (${res.status})`));
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return {
    baseUrl,

    // ---------- Auth ----------
    login: (email: string, password: string) =>
      request<AuthResponse>("/auth/login", { method: "POST", json: { email, password }, fallback: "Login failed" }),
    register: (name: string, email: string, password: string, birthday: string | null) =>
      request<AuthResponse>("/auth/register", {
        method: "POST", json: { name, email, password, birthday: birthday || null }, fallback: "Registration failed",
      }),
    me: () => request<UserOut>("/auth/me", { fallback: "Invalid token" }),
    refreshToken: () => request<AuthResponse>("/auth/refresh", { method: "POST", fallback: "Refresh failed" }),
    updateUser: (data: UserUpdate) => request<UserOut>("/auth/me", { method: "PATCH", json: data, fallback: "Update failed" }),

    // ---------- Public ----------
    fetchTripConstellation: (tripId: number) =>
      request<TripPublic>(`/trips/${tripId}/constellation`, { fallback: "Failed to fetch constellation" }),

    // ---------- Trips ----------
    fetchTripsDetailed: () => request<TripDetailed[]>("/trips/detailed", { fallback: "Failed to fetch detailed trips" }),
    fetchTrips: () => request<Trip[]>("/trips/", { fallback: "Failed to fetch trips" }),
    fetchTrip: (id: number) => request<Trip>(`/trips/${id}`, { fallback: "Failed to fetch trip" }),
    createTrip: (data: TripCreate) => request<Trip>("/trips/", { method: "POST", json: data, fallback: "Failed to create trip" }),
    deleteTrip: (id: number) => request<void>(`/trips/${id}`, { method: "DELETE", fallback: "Failed to delete trip" }),
    generateDaysForTrip: (tripId: number) =>
      request<Day[]>(`/trips/${tripId}/generate-days`, { method: "POST", fallback: "Failed to generate days" }),

    // ---------- Days ----------
    fetchDaysForTrip: (tripId: number) => request<Day[]>(`/days/trip/${tripId}`, { fallback: "Failed to fetch days" }),
    createDay: (data: DayCreate) => request<Day>("/days/", { method: "POST", json: data, fallback: "Failed to create day" }),
    updateDay: (dayId: number, data: DayUpdate) =>
      request<Day>(`/days/${dayId}`, { method: "PATCH", json: data, fallback: "Failed to update day" }),

    // ---------- Activities ----------
    fetchActivitiesForTrip: (tripId: number) =>
      request<Activity[]>(`/activities/trip/${tripId}`, { fallback: "Failed to fetch activities" }),
    fetchBucketActivities: () => request<Activity[]>("/activities/bucket", { fallback: "Failed to fetch bucket list" }),
    createActivity: (data: ActivityCreate) =>
      request<Activity>("/activities/", {
        method: "POST", json: { ...data, must_do: data.must_do ?? false }, fallback: "Failed to create activity",
      }),
    createActivitiesBatch: (target: BatchTarget, items: ActivityCreate[]) =>
      request<ActivityBatchResult>("/activities/batch", {
        method: "POST", json: { target, items }, fallback: "Failed to import activities",
      }),
    updateActivity: (id: number, data: ActivityUpdate) =>
      request<Activity>(`/activities/${id}`, { method: "PATCH", json: data, fallback: "Failed to update activity" }),
    deleteActivity: (id: number) => request<void>(`/activities/${id}`, { method: "DELETE", fallback: "Failed to delete activity" }),
    reorderActivities: (orders: { activity_id: number; position: number }[]) =>
      request<Activity[]>("/activities/reorder", { method: "PUT", json: { orders }, fallback: "Failed to reorder activities" }),

    // ---------- AI ----------
    fetchRecommendations: (tripId: number) =>
      request<RecommendationResponse>(`/ai/trips/${tripId}/recommend`, { method: "POST", fallback: "Failed to fetch recommendations" }),
    placePhotoUrl: (photoReference: string, maxHeightPx = 200) =>
      `${baseUrl}/ai/places/photo?ref=${encodeURIComponent(photoReference)}&max_h=${maxHeightPx}`,
    sendRecommendationFeedback: async (
      tripId: number,
      placeId: number | null,
      signal: "added" | "skipped" | "scheduled" | "deleted" | "must_do"
    ): Promise<void> => {
      try {
        await request(`/ai/trips/${tripId}/feedback`, { method: "POST", json: { place_id: placeId, signal } });
      } catch (err) {
        console.warn("sendRecommendationFeedback failed", err);
      }
    },
    generateArrangements: (tripId: number) =>
      request<Arrangement[]>(`/ai/trips/${tripId}/arrange`, { method: "POST", fallback: "Failed to generate arrangements" }),
    applyArrangement: (tripId: number, assignments: ArrangementAssignment[]) =>
      request<void>(`/ai/trips/${tripId}/apply-arrangement`, {
        method: "POST", json: { assignments }, fallback: "Failed to apply arrangement",
      }),

    // ---------- Collaborators ----------
    fetchCollaborators: (tripId: number) =>
      request<Collaborator[]>(`/trips/${tripId}/collaborators`, { fallback: "Failed to fetch collaborators" }),
    addCollaborator: (tripId: number, email: string, role = "editor") =>
      request<Collaborator>(`/trips/${tripId}/collaborators`, {
        method: "POST", json: { email, role }, fallback: "Failed to add collaborator",
      }),
    removeCollaborator: (tripId: number, userId: number) =>
      request<void>(`/trips/${tripId}/collaborators/${userId}`, { method: "DELETE", fallback: "Failed to remove collaborator" }),

    // ---------- Links (TikTok / Instagram / Google Maps place) ----------
    resolveLink: (url: string) =>
      request<LinkResolveResponse>("/links/resolve", { method: "POST", json: { url }, fallback: "Couldn't read that link" }),

    // ---------- Google Maps import / export ----------
    previewGoogleMapsLink: (url: string) =>
      request<ImportPreview>("/imports/google-maps/preview", { method: "POST", json: { url }, fallback: "Couldn't read that list" }),
    /** `data` is the raw file contents (File/Blob on web, ArrayBuffer/Uint8Array on native). */
    previewGoogleMapsFile: (data: BodyInit, filename: string, hint?: string) => {
      const qs = new URLSearchParams({ filename });
      if (hint) qs.set("hint", hint);
      return request<ImportPreview>(`/imports/google-maps/preview/file?${qs.toString()}`, {
        method: "POST", raw: data, headers: { "Content-Type": "application/octet-stream" }, fallback: "Couldn't read that file",
      });
    },
    /** Returns the export as text (KML/CSV) plus the suggested filename. */
    exportGoogleMaps: async (scope: ExportScope, format: ExportFormat = "kml") => {
      const qs = new URLSearchParams({ scope: scope.scope, format });
      if (scope.scope === "trip") qs.set("trip_id", String(scope.trip_id));
      const res = await doFetch(`${baseUrl}/exports/google-maps?${qs.toString()}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error(await errorMessage(res, "Export failed"));
      const cd = res.headers.get("content-disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(cd);
      return { text: await res.text(), filename: m?.[1] ?? `navia-export.${format}`, contentType: res.headers.get("content-type") ?? "" };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Universal "open in Google Maps" URL (web, iOS and Android all handle it). */
export function googleMapsLink(lat?: number | null, lng?: number | null, googlePlaceId?: string | null): string | null {
  if (lat == null || lng == null) return null;
  let url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  if (googlePlaceId) url += `&query_place_id=${encodeURIComponent(googlePlaceId)}`;
  return url;
}
