/**
 * Web binding of the Navia API client. The platform-agnostic implementation
 * lives in ./core/client (shared with the Expo app); this file binds it to the
 * browser's localStorage token and re-exports each function by name so existing
 * `import { fetchTrips } from "@/lib/api"` calls keep working.
 */

import { createApiClient, googleMapsLink } from "./core/client";

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
  ActivityBatchResult,
  BatchTarget,
  UserPreferences,
  UserOut,
  UserUpdate,
  RecommendedActivity,
  RecommendationResponse,
  ArrangementAssignment,
  Arrangement,
  Collaborator,
  SourcePlatform,
  PlaceCandidate,
  LinkResolveResponse,
  ImportItem,
  ImportPreview,
  ExportScope,
  ExportFormat,
} from "./core/types";

export { DEFAULT_PREFERENCES } from "./core/types";
export { googleMapsLink };
export type { ApiClient, AuthResponse } from "./core/client";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const TOKEN_STORAGE_KEY = "navia_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const api = createApiClient({ baseUrl: API_BASE_URL, getToken: getStoredToken });

// ---------- Named re-exports (backward compatible) ----------
export const {
  login,
  register,
  me,
  refreshToken,
  updateUser,
  fetchTripConstellation,
  fetchTripsDetailed,
  fetchTrips,
  fetchTrip,
  createTrip,
  deleteTrip,
  generateDaysForTrip,
  fetchDaysForTrip,
  createDay,
  updateDay,
  fetchActivitiesForTrip,
  fetchBucketActivities,
  createActivity,
  createActivitiesBatch,
  updateActivity,
  deleteActivity,
  reorderActivities,
  fetchRecommendations,
  placePhotoUrl,
  sendRecommendationFeedback,
  generateArrangements,
  applyArrangement,
  fetchCollaborators,
  addCollaborator,
  removeCollaborator,
  resolveLink,
  previewGoogleMapsLink,
  previewGoogleMapsFile,
  exportGoogleMaps,
} = api;
