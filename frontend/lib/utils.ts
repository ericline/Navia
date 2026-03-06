import { Trip } from "@/lib/api";

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
  const end = new Date(trip.end_date);
  end.setHours(0, 0, 0, 0);
  return end.getTime() < today.getTime();
}

export function isCurrentOrUpcoming(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trip.end_date);
  end.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
}

export function sortByStartAsc(a: Trip, b: Trip) {
  return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
}
