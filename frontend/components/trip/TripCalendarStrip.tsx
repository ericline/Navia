/** TripCalendarStrip - Week-paginated day selector with drag-and-drop activity reordering via @dnd-kit. */
"use client";

import { useState } from "react";
import { Day, Activity, DayUpdate } from "@/lib/api";
import { getTodayStr } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ConstellationPath from "@/components/constellation/ConstellationPath";
import DayColumn from "./DayColumn";
import ActivityCard from "./ActivityCard";
import { DndContext, DragOverlay, pointerWithin, DragEndEvent, DragStartEvent, DragOverEvent } from "@dnd-kit/core";
import type { Modifier } from "@dnd-kit/core";

/** Snap the DragOverlay center to the pointer so it doesn't drift right of the cursor. */
const snapCenterToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (activatorEvent && draggingNodeRect) {
    const e = activatorEvent as PointerEvent;
    if (typeof e.clientX === "number") {
      return {
        ...transform,
        x: transform.x + (e.clientX - draggingNodeRect.left - draggingNodeRect.width / 2),
        y: transform.y + (e.clientY - draggingNodeRect.top - draggingNodeRect.height / 2),
      };
    }
  }
  return transform;
};

interface TripCalendarStripProps {
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onAddActivity: (dayId: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  tripName?: string;
  onViewDayMap?: (dayId: number) => void;
  onReorderActivities?: (dayId: number, orderedIds: number[]) => void;
  onMoveActivity?: (activityId: number, toDayId: number) => void;
  onUpdateDay?: (dayId: number, patch: DayUpdate) => void | Promise<void>;
  defaultDayStart?: string;
  defaultDayEnd?: string;
}

const MAX_VISIBLE = 14;

/** Find which day an activity belongs to */
function findDayForActivity(
  activityId: number,
  activitiesByDay: Record<number, Activity[]>
): number | null {
  for (const [dayId, acts] of Object.entries(activitiesByDay)) {
    if (acts.some((a) => a.id === activityId)) return Number(dayId);
  }
  return null;
}

/** Extract a day ID from a droppable/sortable ID (either "day-123" or an activity number) */
function resolveDayId(
  overId: string | number,
  activitiesByDay: Record<number, Activity[]>
): number | null {
  const str = String(overId);
  if (str.startsWith("day-")) return Number(str.slice(4));
  return findDayForActivity(Number(overId), activitiesByDay);
}

export default function TripCalendarStrip({
  days,
  activitiesByDay,
  weekOffset,
  onWeekChange,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  tripName,
  onViewDayMap,
  onReorderActivities,
  onMoveActivity,
  onUpdateDay,
  defaultDayStart,
  defaultDayEnd,
}: TripCalendarStripProps) {
  const totalDays = days.length;
  const visibleCount = Math.min(MAX_VISIBLE, totalDays - weekOffset);
  const canGoBack = weekOffset > 0;
  const canGoForward = weekOffset + MAX_VISIBLE < totalDays;

  const todayStr = getTodayStr();

  const visibleDays = days.slice(weekOffset, weekOffset + visibleCount);

  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [overDayId, setOverDayId] = useState<number | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id);
    for (const acts of Object.values(activitiesByDay)) {
      const found = acts.find((a) => a.id === id);
      if (found) { setActiveActivity(found); return; }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) { setOverDayId(null); return; }
    setOverDayId(resolveDayId(over.id, activitiesByDay));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveActivity(null);
    setOverDayId(null);
    if (!over) return;

    const activeId = Number(active.id);
    const sourceDayId = findDayForActivity(activeId, activitiesByDay);
    const targetDayId = resolveDayId(over.id, activitiesByDay);

    // Cross-day move
    if (sourceDayId && targetDayId && sourceDayId !== targetDayId && onMoveActivity) {
      onMoveActivity(activeId, targetDayId);
      return;
    }

    // Same-day reorder
    if (!onReorderActivities || active.id === over.id) return;
    for (const day of days) {
      const dayActivities = activitiesByDay[day.id] ?? [];
      const ids = dayActivities.map((a) => a.id);
      const oldIndex = ids.indexOf(Number(active.id));
      const newIndex = ids.indexOf(Number(over.id));
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...ids];
        reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, Number(active.id));
        onReorderActivities(day.id, reordered);
        break;
      }
    }
  }

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
        onDayClick={onViewDayMap}
      />

      {/* Day columns grid */}
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={`grid gap-3 grid-cols-2 sm:grid-cols-3 ${
          visibleCount <= 4 ? "md:grid-cols-4" :
          visibleCount <= 5 ? "md:grid-cols-5" :
          visibleCount <= 6 ? "md:grid-cols-6" :
          "md:grid-cols-7"
        }`}>
          {visibleDays.map((day) => (
            <div key={day.id}>
              <DayColumn
                day={day}
                activities={activitiesByDay[day.id] ?? []}
                isToday={day.date === todayStr}
                onAddActivity={onAddActivity}
                onEditActivity={onEditActivity}
                onDeleteActivity={onDeleteActivity}
                onViewMap={onViewDayMap}
                isDropTarget={overDayId === day.id && findDayForActivity(activeActivity?.id ?? 0, activitiesByDay) !== day.id}
                onUpdateDay={onUpdateDay}
                defaultDayStart={defaultDayStart}
                defaultDayEnd={defaultDayEnd}
              />
            </div>
          ))}
        </div>
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeActivity && (
            <div className="w-44 opacity-90 rotate-2 scale-105">
              <ActivityCard
                activity={activeActivity}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
