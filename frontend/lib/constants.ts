/** Canonical Navia activity categories — mirrors backend `NAVIA_CATEGORIES`.
 *  These keys are the ONLY values that drive the recommendation scorer's
 *  category_match feature, so the chip selector in preferences must emit
 *  exactly these strings. */

export const NAVIA_CATEGORIES = [
  "food",
  "cafe",
  "bar",
  "museum",
  "park",
  "beach",
  "shopping",
  "nightlife",
  "worship",
  "wellness",
  "transport",
  "hotel",
  "entertainment",
  "landmark",
  "other",
] as const;

export type NaviaCategory = (typeof NAVIA_CATEGORIES)[number];

/** Subset shown in the preferences likes/dislikes selector — excludes
 *  transport/hotel/other which aren't meaningful as an interest. */
export const USER_FACING_CATEGORIES: NaviaCategory[] = [
  "food",
  "cafe",
  "bar",
  "museum",
  "park",
  "beach",
  "shopping",
  "nightlife",
  "worship",
  "wellness",
  "entertainment",
  "landmark",
];

export const CATEGORY_LABELS: Record<NaviaCategory, string> = {
  food: "Food",
  cafe: "Cafes",
  bar: "Bars",
  museum: "Museums & Galleries",
  park: "Parks & Nature",
  beach: "Beaches",
  shopping: "Shopping",
  nightlife: "Nightlife",
  worship: "Worship Sites",
  wellness: "Wellness & Spa",
  transport: "Transport",
  hotel: "Hotels",
  entertainment: "Entertainment",
  landmark: "Landmarks",
  other: "Other",
};

export const TRAVEL_STYLES: { value: string; label: string; hint: string }[] = [
  { value: "adventurous", label: "Adventurous", hint: "Hikes, off-beat spots" },
  { value: "cultural", label: "Cultural", hint: "Museums, history, art" },
  { value: "culinary", label: "Culinary", hint: "Food, markets, tastings" },
  { value: "relaxed", label: "Relaxed", hint: "Slow days, cafes, parks" },
  { value: "nightlife", label: "Nightlife", hint: "Bars, shows, late nights" },
];

export const GROUP_TYPES: { value: string; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
];
