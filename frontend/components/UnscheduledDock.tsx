"use client";

import { useState } from "react";
import { Activity, Day } from "@/lib/api";
import { ChevronUp, Star, CalendarPlus } from "lucide-react";
import ActivityCard from "./ActivityCard";

interface UnscheduledDockProps {
  activities: Activity[];
  days: Day[];
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  onScheduleActivity: (activityId: number, dayId: number) => void;
}

export default function UnscheduledDock({
  activities,
  days,
  onEditActivity,
  onDeleteActivity,
  onScheduleActivity,
}: UnscheduledDockProps) {
  const [expanded, setExpanded] = useState(false);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const count = activities.length;

  if (count === 0) return null;

  // Days are already sorted by the parent component
  const sortedDays = days;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-2.5 bg-darkBlue/90 backdrop-blur-sm text-white/80 hover:bg-darkBlue/95 transition"
      >
        <div className="flex items-center gap-3">
          <div className="dock-starfield h-5 w-24 rounded-full opacity-60" />
          <span className="text-xs font-medium">
            <span className="inline-flex items-center gap-1">
              <span className="relative">
                <span className="star-twinkle text-sm">{count}</span>
              </span>
              uncharted star{count === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        <ChevronUp
          className={`h-4 w-4 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded tray */}
      {expanded && (
        <div className="bg-darkBlue/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 max-h-[40vh] overflow-y-auto scrollbar-thin slide-in-up">
          <div className="mx-auto max-w-5xl grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((act) => (
              <div key={act.id} className="relative dock-card">
                <Star className="absolute -top-1 -left-1 h-3 w-3 text-lightBlue/40 star-twinkle" />
                <ActivityCard
                  activity={act}
                  onEdit={onEditActivity}
                  onDelete={onDeleteActivity}
                />
                {/* Schedule to a day */}
                <div className="mt-1">
                  {schedulingId === act.id ? (
                    <select
                      className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-[10px] text-white/70"
                      style={{ colorScheme: "dark" }}
                      autoFocus
                      onChange={(e) => {
                        if (e.target.value) {
                          onScheduleActivity(act.id, parseInt(e.target.value, 10));
                        }
                        setSchedulingId(null);
                      }}
                      onBlur={() => setSchedulingId(null)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Pick a day...
                      </option>
                      {sortedDays.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.date}
                          {day.name ? ` – ${day.name}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setSchedulingId(act.id)}
                      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition"
                    >
                      <CalendarPlus className="h-2.5 w-2.5" />
                      Schedule to a day
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
