/** ActivityCard - Displays a single activity with category accent bar, time, and hover actions (edit/delete). */
"use client";

import { Activity } from "@/lib/api";
import { getCategoryKey, CATEGORY_ACCENT_CLASSES, formatTime } from "@/lib/utils";
import { Star, Clock, DollarSign, Zap, Pencil, Trash2 } from "lucide-react";

function getAccentColor(category?: string | null): string {
  return CATEGORY_ACCENT_CLASSES[getCategoryKey(category)];
}

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: number) => void;
  onToggleMustDo?: (activity: Activity) => void;
}

export default function ActivityCard({
  activity,
  onEdit,
  onDelete,
  onToggleMustDo,
}: ActivityCardProps) {
  const canBeMustDo = !!activity.start_time;
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

      <div className="flex-1 px-3 py-2.5 min-w-0">
        <div>
          <div className="min-w-0">
            {formatTime(activity.start_time) && (
              <span className="text-[11px] text-black/40 leading-none">{formatTime(activity.start_time)}</span>
            )}
            <p className="text-[13px] font-medium text-black/80 leading-snug pr-6 flex items-center gap-1">
              <span>{activity.name}</span>
              {onToggleMustDo ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canBeMustDo) onToggleMustDo(activity);
                  }}
                  disabled={!canBeMustDo}
                  title={
                    canBeMustDo
                      ? activity.must_do
                        ? "Unmark Must-Do"
                        : "Mark as Must-Do"
                      : "Set a start time to enable Must-Do"
                  }
                  className={`inline-flex items-center justify-center shrink-0 rounded transition ${
                    canBeMustDo ? "hover:bg-pink/10" : "cursor-not-allowed"
                  }`}
                >
                  <Star
                    className={`h-3 w-3 transition ${
                      activity.must_do
                        ? "text-pink fill-pink"
                        : canBeMustDo
                          ? "text-black/25 hover:text-pink"
                          : "text-black/10"
                    }`}
                  />
                </button>
              ) : (
                activity.must_do && (
                  <Star className="h-3 w-3 text-pink fill-pink shrink-0" />
                )
              )}
            </p>
          </div>
        </div>

        {/* Edit / Delete — absolutely positioned to avoid layout shift */}
        {(onEdit || onDelete) && (
          <div className="activity-hover-menu absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition bg-white rounded-lg px-0.5 py-0.5 shadow-sm border border-black/10">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(activity);
                }}
                className="rounded p-1 hover:bg-blue/10 text-black/55 hover:text-blue transition"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(activity.id);
                }}
                className="rounded p-1 hover:bg-red-50 text-black/55 hover:text-red-500 transition"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {activity.category && (
          <span className="text-[10px] text-black/35 capitalize">
            {activity.category}
          </span>
        )}

        {activity.address && (
          <p className="text-[11px] text-black/30 leading-snug mt-0.5">
            {activity.address}
          </p>
        )}

        {activity.notes && (
          <p className="text-[10px] text-black/40 mt-0.5 line-clamp-2">
            {activity.notes}
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

