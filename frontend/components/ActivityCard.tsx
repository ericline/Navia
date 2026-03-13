"use client";

import { Activity } from "@/lib/api";
import { Star, Clock, DollarSign, Zap, Pencil, Trash2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-400",
  restaurant: "bg-orange-400",
  museum: "bg-purple-400",
  culture: "bg-purple-400",
  hike: "bg-green-500",
  outdoor: "bg-green-500",
  transportation: "bg-slate-400",
  transit: "bg-slate-400",
  hotel: "bg-blue-400",
  accommodation: "bg-blue-400",
};

function getAccentColor(category?: string | null): string {
  if (!category) return "bg-lightBlue";
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-lightBlue";
}

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: number) => void;
}

export default function ActivityCard({
  activity,
  onEdit,
  onDelete,
}: ActivityCardProps) {
  const accentColor = getAccentColor(activity.category);
  const minH = activity.est_duration_minutes
    ? Math.min(40 + activity.est_duration_minutes * 0.3, 80)
    : 40;

  return (
    <div
      className="relative flex rounded-xl bg-white/60 border border-black/5 overflow-hidden group hover:bg-white/80 transition"
      style={{ minHeight: `${minH}px` }}
    >
      {/* Left accent bar */}
      <div className={`w-[3px] shrink-0 ${accentColor}`} />

      <div className="flex-1 px-2.5 py-2 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className="text-xs font-medium text-black/80 leading-tight truncate">
            {activity.name}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            {activity.must_do && (
              <Star className="h-3 w-3 text-pink fill-pink mt-0.5" />
            )}
            {/* Edit / Delete — visible on hover */}
            {(onEdit || onDelete) && (
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(activity);
                    }}
                    className="rounded p-0.5 hover:bg-black/[0.06] text-black/25 hover:text-blue/70 transition"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(activity.id);
                    }}
                    className="rounded p-0.5 hover:bg-red-50 text-black/25 hover:text-red-400 transition"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {activity.category && (
          <span className="text-[10px] text-black/35 capitalize">
            {activity.category}
          </span>
        )}

        {activity.address && (
          <p className="text-[10px] text-black/30 truncate mt-0.5">
            {activity.address}
          </p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {activity.est_duration_minutes != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-black/40 bg-black/[0.04] rounded-full px-1.5 py-0.5">
              <Clock className="h-2.5 w-2.5" />
              {activity.est_duration_minutes}m
            </span>
          )}
          {activity.cost_estimate != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-black/40 bg-black/[0.04] rounded-full px-1.5 py-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {activity.cost_estimate.toFixed(0)}
            </span>
          )}
          {activity.energy_level && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-black/40 bg-black/[0.04] rounded-full px-1.5 py-0.5">
              <Zap className="h-2.5 w-2.5" />
              {activity.energy_level}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { CATEGORY_COLORS, getAccentColor };
