/**
 * Shared TypeScript interfaces and type definitions for the Navia frontend.
 * All API request/response shapes and domain models live here.
 */

// ---------- Trip ----------

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

export interface TripPublic {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  day_count: number;
}

export interface TripDetailed extends Trip {
  days: Day[];
  activities: Activity[];
}

// ---------- Day ----------

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

// ---------- Activity ----------

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

// ---------- User ----------

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

// ---------- AI / Recommendations ----------

export interface RecommendedActivity {
  name: string;
  category?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  est_duration_minutes?: number;
  cost_estimate?: number;
  energy_level?: "low" | "medium" | "high";
  must_do?: boolean;
  notes?: string;
  // ML pipeline fields (from Google Places data)
  place_id?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  price_level?: number | null;
  photo_reference?: string | null;
  google_place_id?: string | null;
  verified?: boolean;
}

export interface RecommendationResponse {
  enabled: boolean;
  recommendations: RecommendedActivity[];
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

// ---------- Collaborators ----------

export interface Collaborator {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role: string;
}

// ---------- Bucket List ----------

export interface BucketItem {
  id: string;
  name: string;
  location: string;
  notes: string;
}
