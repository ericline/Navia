/**
 * Shared utilities for grouping activities by their assigned day.
 * Used across home page cards, trip detail, and profile views.
 */

import { useMemo } from "react";
import type { Activity } from "@/lib/types";

/** Groups activities by day_id, filtering out unscheduled (null day_id) entries. */
export function groupActivitiesByDay(
  activities: Activity[]
): Record<number, Activity[]> {
  const map: Record<number, Activity[]> = {};
  for (const a of activities) {
    if (a.day_id == null) continue;
    (map[a.day_id] ??= []).push(a);
  }
  return map;
}

/** Memoized hook wrapping groupActivitiesByDay for use in React components. */
export function useActivitiesByDay(
  activities: Activity[]
): Record<number, Activity[]> {
  return useMemo(() => groupActivitiesByDay(activities), [activities]);
}
