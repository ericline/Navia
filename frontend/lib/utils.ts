import { Trip } from "@/lib/api";

export function getTodayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function daysUntil(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Ongoing";
  return `In ${diff} days`;
}

export function isPastTrip(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date + "T00:00:00");
  end.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}

export function isCurrentOrUpcoming(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date + "T00:00:00");
  end.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
}

export function sortByStartAsc(a: Trip, b: Trip) {
  return new Date(a.start_date + "T00:00:00").getTime() - new Date(b.start_date + "T00:00:00").getTime();
}

// ---------- Time formatting ----------

export function formatTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ---------- Constellation color themes ----------

export type ConstellationTheme = {
  star: string;
  line: string;
  glow: string;
};

const WARM_KEYWORDS = ["beach", "tropical", "island", "caribbean", "hawaii", "bali", "mexico", "thailand", "miami", "cancun"];
const COLD_KEYWORDS = ["ski", "snow", "arctic", "nordic", "iceland", "alaska", "alps", "switzerland", "norway", "finland"];

export function getConstellationTheme(destination: string): ConstellationTheme | null {
  const lower = destination.toLowerCase();
  if (WARM_KEYWORDS.some((k) => lower.includes(k))) {
    return { star: "rgb(235, 180, 80)", line: "rgb(215, 165, 75)", glow: "rgb(235, 180, 80)" };
  }
  if (COLD_KEYWORDS.some((k) => lower.includes(k))) {
    return { star: "rgb(180, 210, 240)", line: "rgb(160, 195, 230)", glow: "rgb(180, 210, 240)" };
  }
  return null;
}

// ---------- Location formatting ----------

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC",
};

const US_COUNTRY_SUFFIXES = [
  ", United States of America",
  ", United States",
  ", USA",
  ", US",
];

export function formatDestination(destination: string): string {
  let result = destination;
  for (const suffix of US_COUNTRY_SUFFIXES) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  const parts = result.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const abbr = US_STATE_ABBREVIATIONS[last];
    if (abbr) {
      parts[parts.length - 1] = abbr;
      return parts.join(", ");
    }
  }
  return result;
}

// ---------- Category colors ----------

export type CategoryKey =
  | "food" | "cafe" | "bar" | "museum" | "park" | "beach"
  | "shopping" | "nightlife" | "worship" | "wellness"
  | "transport" | "hotel" | "entertainment" | "landmark" | "other";

const CATEGORY_KEYWORDS: { key: CategoryKey; matches: string[] }[] = [
  { key: "cafe", matches: ["cafe", "coffee", "tea"] },
  { key: "bar", matches: ["bar", "pub", "brewery", "winery"] },
  { key: "food", matches: ["food", "restaurant", "eat", "dining"] },
  { key: "museum", matches: ["museum", "culture", "art", "gallery"] },
  { key: "park", matches: ["park", "hike", "outdoor", "nature", "garden"] },
  { key: "beach", matches: ["beach", "surf"] },
  { key: "shopping", matches: ["store", "shopping", "mall", "market", "bakery"] },
  { key: "nightlife", matches: ["nightclub", "lounge", "karaoke"] },
  { key: "worship", matches: ["temple", "church", "mosque", "synagogue", "shrine"] },
  { key: "wellness", matches: ["spa", "gym", "yoga", "fitness"] },
  { key: "transport", matches: ["airport", "transit", "transportation", "flight", "train", "bus_station", "train_station"] },
  { key: "hotel", matches: ["hotel", "accommodation", "hostel", "stay", "resort"] },
  { key: "entertainment", matches: ["theater", "cinema", "stadium", "concert", "amusement"] },
  { key: "landmark", matches: ["monument", "landmark", "tourist_attraction", "attraction"] },
];

export function getCategoryKey(category?: string | null): CategoryKey {
  if (!category) return "other";
  const lower = category.toLowerCase();
  for (const { key, matches } of CATEGORY_KEYWORDS) {
    if (matches.some((m) => lower.includes(m))) return key;
  }
  return "other";
}

/** Tailwind accent-bar class per category (used on ActivityCard) */
export const CATEGORY_ACCENT_CLASSES: Record<CategoryKey, string> = {
  food: "bg-orange-400",
  cafe: "bg-amber-500",
  bar: "bg-rose-400",
  museum: "bg-purple-400",
  park: "bg-green-500",
  beach: "bg-yellow-400",
  shopping: "bg-pink-400",
  nightlife: "bg-indigo-400",
  worship: "bg-teal-400",
  wellness: "bg-emerald-400",
  transport: "bg-slate-400",
  hotel: "bg-blue-400",
  entertainment: "bg-fuchsia-400",
  landmark: "bg-cyan-400",
  other: "bg-lightBlue",
};

/** RGBA nebula glow color per category (used on DayColumn) */
export const CATEGORY_NEBULA_COLORS: Record<CategoryKey, string> = {
  food: "rgba(251, 146, 60, 0.07)",
  cafe: "rgba(245, 158, 11, 0.06)",
  bar: "rgba(251, 113, 133, 0.06)",
  museum: "rgba(168, 85, 247, 0.06)",
  park: "rgba(34, 197, 94, 0.06)",
  beach: "rgba(250, 204, 21, 0.06)",
  shopping: "rgba(244, 114, 182, 0.06)",
  nightlife: "rgba(129, 140, 248, 0.06)",
  worship: "rgba(45, 212, 191, 0.06)",
  wellness: "rgba(52, 211, 153, 0.06)",
  transport: "rgba(148, 163, 184, 0.06)",
  hotel: "rgba(96, 165, 250, 0.06)",
  entertainment: "rgba(232, 121, 249, 0.06)",
  landmark: "rgba(34, 211, 238, 0.06)",
  other: "rgb(var(--lightBlue) / 0.05)",
};
