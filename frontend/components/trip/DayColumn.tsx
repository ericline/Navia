/** DayColumn - Renders a single day's activity list with add button and today highlight. */
"use client";

import { useState } from "react";
import { Day, Activity, DayUpdate } from "@/lib/api";
import { getCategoryKey, CATEGORY_NEBULA_COLORS, type CategoryKey } from "@/lib/utils";
import { Plus, Clock, DollarSign, MapPin, GripVertical } from "lucide-react";
import ActivityCard from "./ActivityCard";
import DayWindowEditor from "./DayWindowEditor";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface DayColumnProps {
  day: Day;
  activities: Activity[];
  isToday: boolean;
  onAddActivity: (dayId: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  onViewMap?: (dayId: number) => void;
  isDropTarget?: boolean;
  defaultDayStart?: string;
  defaultDayEnd?: string;
  onUpdateDay?: (dayId: number, patch: DayUpdate) => void | Promise<void>;
}

function formatWindowChip(
  day: Day,
  defaultStart: string,
  defaultEnd: string
): { label: string; isCustom: boolean } {
  const start = day.day_start ?? defaultStart;
  const end = day.day_end ?? defaultEnd;
  const isCustom = day.day_start != null || day.day_end != null;
  return {
    label: `${start.slice(0, 5)}–${end.slice(0, 5)}`,
    isCustom,
  };
}

function getNebulaColor(activities: Activity[]): string {
  if (activities.length === 0) return CATEGORY_NEBULA_COLORS.other;

  const counts: Partial<Record<CategoryKey, number>> = {};
  for (const a of activities) {
    const key = getCategoryKey(a.category);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const dominant = (Object.entries(counts) as [CategoryKey, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
  return CATEGORY_NEBULA_COLORS[dominant];
}

function getDayLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getShortDate(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function SortableActivityCard({
  activity,
  onEdit,
  onDelete,
}: {
  activity: Activity;
  onEdit: (a: Activity) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
  });
  const reduce = useReducedMotion();
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-0.5"
      layout={!reduce && !isDragging ? "position" : false}
      layoutId={reduce ? undefined : `activity-${activity.id}`}
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2.5 shrink-0 cursor-grab active:cursor-grabbing text-black/20 hover:text-black/40 touch-none"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <div className="flex-1 min-w-0">
        <ActivityCard activity={activity} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </motion.div>
  );
}

export default function DayColumn({
  day,
  activities,
  isToday,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onViewMap,
  isDropTarget,
  defaultDayStart = "09:00:00",
  defaultDayEnd = "21:00:00",
  onUpdateDay,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.id}` });
  const [windowEditorOpen, setWindowEditorOpen] = useState(false);
  const windowChip = formatWindowChip(day, defaultDayStart, defaultDayEnd);
  const nebulaColor = getNebulaColor(activities);
  const totalMinutes = activities.reduce(
    (sum, a) => sum + (a.est_duration_minutes || 0),
    0
  );
  const totalCost = activities.reduce(
    (sum, a) => sum + (a.cost_estimate || 0),
    0
  );
  const totalHours = (totalMinutes / 60).toFixed(1);
  const showDropIndicator = isOver || isDropTarget;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border-2 transition-all ${
        showDropIndicator
          ? "border-blue/50 bg-blue/5 shadow-[0_0_20px_rgb(var(--blue)/0.15)]"
          : isToday
            ? "border-blue/30 shadow-[0_0_16px_rgb(var(--blue)/0.12)]"
            : "border-black/5"
      }`}
      style={showDropIndicator ? undefined : { background: "rgb(var(--warmSurface) / 0.6)" }}
    >
      {/* Header with nebula glow */}
      <div className="relative px-3 pt-3 pb-2 rounded-t-2xl">
        <div
          className="absolute inset-0 pointer-events-none rounded-t-2xl overflow-hidden"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${nebulaColor}, transparent 70%)`,
          }}
        />

        <div className="relative text-center">
          <div
            className={`text-xs font-medium ${
              isToday ? "text-blue" : "text-black/50"
            }`}
          >
            {getDayLabel(day.date)}
          </div>
          <div
            className={`text-sm font-semibold ${
              isToday ? "text-blue" : "text-black/75"
            }`}
          >
            {getShortDate(day.date)}
          </div>
          {day.name && (
            <div className="text-[10px] text-black/35 truncate mt-0.5">
              {day.name}
            </div>
          )}

          {onUpdateDay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWindowEditorOpen((v) => !v);
              }}
              className={`inline-flex items-center gap-0.5 text-[9px] rounded-full px-1.5 py-0.5 mt-1 transition ${
                windowChip.isCustom
                  ? "text-blue bg-blue/10 hover:bg-blue/15"
                  : "text-black/35 bg-black/[0.04] hover:bg-black/[0.08]"
              }`}
              title={windowChip.isCustom ? "Custom day window" : "Default day window"}
            >
              <Clock className="h-2 w-2" />
              {windowChip.label}
            </button>
          )}
          {windowEditorOpen && onUpdateDay && (
            <DayWindowEditor
              day={day}
              defaultStart={defaultDayStart}
              defaultEnd={defaultDayEnd}
              onClose={() => setWindowEditorOpen(false)}
              onUpdateDay={onUpdateDay}
            />
          )}

          {/* Orbital pebbles */}
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            {activities.length > 0 ? (
              <>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-lightBlue bg-lightBlue/10 rounded-full px-1.5 py-0.5">
                  <Clock className="h-2 w-2" />
                  {totalHours}h
                </span>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-lightBlue bg-lightBlue/10 rounded-full px-1.5 py-0.5">
                  <DollarSign className="h-2 w-2" />
                  ${totalCost.toFixed(0)}
                </span>
                {onViewMap && (
                  <button
                    onClick={() => onViewMap(day.id)}
                    className="inline-flex items-center gap-0.5 text-[9px] text-blue/50 hover:text-blue bg-blue/5 hover:bg-blue/10 rounded-full px-1.5 py-0.5 transition"
                  >
                    <MapPin className="h-2 w-2" />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => onAddActivity(day.id)}
                className="text-lightBlue/40 hover:text-lightBlue/70 transition star-twinkle"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity cards */}
      <div className="flex-1 px-2 pb-2 space-y-1.5">
        <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {activities.map((act) => (
              <SortableActivityCard
                key={act.id}
                activity={act}
                onEdit={onEditActivity}
                onDelete={onDeleteActivity}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        <button
          onClick={() => onAddActivity(day.id)}
          className="w-full flex items-center justify-center gap-1 rounded-xl border border-dashed border-black/10 hover:border-blue/30 hover:bg-blue/5 py-2 text-[10px] text-black/30 hover:text-blue/60 transition"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
    </div>
  );
}
