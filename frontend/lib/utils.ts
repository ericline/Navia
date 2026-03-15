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

// ---------- Category colors ----------

export type CategoryKey = "food" | "museum" | "hike" | "transport" | "hotel" | "other";

const CATEGORY_KEYWORDS: { key: CategoryKey; matches: string[] }[] = [
  { key: "food", matches: ["food", "restaurant", "eat", "dining"] },
  { key: "museum", matches: ["museum", "culture", "art", "gallery"] },
  { key: "hike", matches: ["hike", "outdoor", "nature", "park"] },
  { key: "transport", matches: ["transportation", "transit", "flight", "train"] },
  { key: "hotel", matches: ["hotel", "accommodation", "hostel", "stay"] },
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
  museum: "bg-purple-400",
  hike: "bg-green-500",
  transport: "bg-slate-400",
  hotel: "bg-blue-400",
  other: "bg-lightBlue",
};

/** RGBA nebula glow color per category (used on DayColumn) */
export const CATEGORY_NEBULA_COLORS: Record<CategoryKey, string> = {
  food: "rgba(251, 146, 60, 0.07)",
  museum: "rgba(168, 85, 247, 0.06)",
  hike: "rgba(34, 197, 94, 0.06)",
  transport: "rgba(148, 163, 184, 0.06)",
  hotel: "rgba(96, 165, 250, 0.06)",
  other: "rgb(var(--lightBlue) / 0.05)",
};
