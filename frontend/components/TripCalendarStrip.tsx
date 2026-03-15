"use client";

import { Day, Activity } from "@/lib/api";
import { getTodayStr } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ConstellationPath from "./ConstellationPath";
import DayColumn from "./DayColumn";

interface TripCalendarStripProps {
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onAddActivity: (dayId: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  tripName?: string;
}

const MAX_VISIBLE = 7;

export default function TripCalendarStrip({
  days,
  activitiesByDay,
  weekOffset,
  onWeekChange,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  tripName,
}: TripCalendarStripProps) {
  const totalDays = days.length;
  const visibleCount = Math.min(MAX_VISIBLE, totalDays - weekOffset);
  const canGoBack = weekOffset > 0;
  const canGoForward = weekOffset + MAX_VISIBLE < totalDays;

  const todayStr = getTodayStr();

  const visibleDays = days.slice(weekOffset, weekOffset + visibleCount);

  return (
    <section className="glass bg-warmSurface rounded-2xl p-4 sm:p-6 space-y-3">
      {/* Week pagination header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-black/85">Itinerary</h2>
          <span className="text-xs text-black/40">
            {totalDays} day{totalDays === 1 ? "" : "s"}
            {totalDays > MAX_VISIBLE && (
              <> &middot; Week {Math.floor(weekOffset / MAX_VISIBLE) + 1} of{" "}
              {Math.ceil(totalDays / MAX_VISIBLE)}</>
            )}
          </span>
        </div>

        {totalDays > MAX_VISIBLE && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onWeekChange(Math.max(0, weekOffset - MAX_VISIBLE))}
              disabled={!canGoBack}
              className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/40 hover:text-black/70 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onWeekChange(weekOffset + MAX_VISIBLE)}
              disabled={!canGoForward}
              className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/40 hover:text-black/70 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Constellation path SVG */}
      <ConstellationPath
        days={days}
        activitiesByDay={activitiesByDay}
        weekOffset={weekOffset}
        visibleCount={visibleCount}
        tripName={tripName}
      />

      {/* Day columns grid */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-thin">
        {visibleDays.map((day) => (
          <div key={day.id} className="flex-1 min-w-[160px] sm:min-w-[180px]">
            <DayColumn
              day={day}
              activities={activitiesByDay[day.id] ?? []}
              isToday={day.date === todayStr}
              onAddActivity={onAddActivity}
              onEditActivity={onEditActivity}
              onDeleteActivity={onDeleteActivity}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
