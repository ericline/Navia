"use client";

import { Day, Activity } from "@/lib/api";
import { getCategoryKey, CATEGORY_NEBULA_COLORS, type CategoryKey } from "@/lib/utils";
import { Plus, Clock, DollarSign, Hash, MapPin } from "lucide-react";
import ActivityCard from "./ActivityCard";

interface DayColumnProps {
  day: Day;
  activities: Activity[];
  isToday: boolean;
  onAddActivity: (dayId: number) => void;
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  onViewMap?: (dayId: number) => void;
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

export default function DayColumn({
  day,
  activities,
  isToday,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onViewMap,
}: DayColumnProps) {
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

  return (
    <div
      className={`flex flex-col min-w-[160px] sm:min-w-[180px] snap-start rounded-2xl border transition-all ${
        isToday
          ? "border-blue/30 shadow-[0_0_16px_rgb(var(--blue)/0.12)]"
          : "border-black/5"
      }`}
      style={{ background: "rgb(var(--warmSurface) / 0.6)" }}
    >
      {/* Header with nebula glow */}
      <div className="relative px-3 pt-3 pb-2 rounded-t-2xl overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
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
                  {totalCost.toFixed(0)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-lightBlue bg-lightBlue/10 rounded-full px-1.5 py-0.5">
                  <Hash className="h-2 w-2" />
                  {activities.length}
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
      <div className="flex-1 px-2 pb-2 space-y-1.5 overflow-y-auto scrollbar-thin max-h-[340px]">
        {activities.map((act) => (
          <ActivityCard
            key={act.id}
            activity={act}
            onEdit={onEditActivity}
            onDelete={onDeleteActivity}
          />
        ))}

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
