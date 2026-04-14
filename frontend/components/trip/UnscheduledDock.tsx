/** UnscheduledDock - Bottom dock with a dual-panel starfield:
 *  left panel shows the trip's uncharted activities (day_id=null, trip_id=this trip),
 *  right panel shows the user's bucket list (trip_id=null). Items can move between
 *  the two via explicit arrow buttons or HTML5 drag-and-drop.
 */
"use client";

import { useState } from "react";
import { Activity, Day, updateActivity } from "@/lib/api";
import {
  ChevronUp,
  Star,
  CalendarPlus,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Bookmark,
} from "lucide-react";
import ActivityCard from "./ActivityCard";
import { useBucketList } from "@/hooks/useBucketList";

interface UnscheduledDockProps {
  tripId: number;
  activities: Activity[];
  days: Day[];
  onEditActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: number) => void;
  onScheduleActivity: (activityId: number, dayId: number) => void;
  onAutoArrange?: () => void;
  /** Called after a bucket↔trip move so the trip page can refetch activities. */
  onActivityChanged?: () => void;
}

type DragPayload =
  | { kind: "uncharted"; activityId: number }
  | { kind: "bucket"; activityId: number };

export default function UnscheduledDock({
  tripId,
  activities,
  days,
  onEditActivity,
  onDeleteActivity,
  onScheduleActivity,
  onAutoArrange,
  onActivityChanged,
}: UnscheduledDockProps) {
  const [expanded, setExpanded] = useState(false);
  const [schedulingId, setSchedulingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<"uncharted" | "bucket" | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    bucket,
    refresh: refreshBucket,
    deleteBucket,
  } = useBucketList();

  const unchartedCount = activities.length;
  const bucketCount = bucket.length;
  const totalCount = unchartedCount + bucketCount;

  if (totalCount === 0) return null;

  const sortedDays = days;

  async function pullFromBucket(activityId: number) {
    if (busy) return;
    setBusy(true);
    try {
      await updateActivity(activityId, { trip_id: tripId });
      await refreshBucket();
      onActivityChanged?.();
    } catch (err) {
      console.warn("pullFromBucket failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function sendToBucket(activityId: number) {
    if (busy) return;
    setBusy(true);
    try {
      await updateActivity(activityId, { to_bucket: true });
      await refreshBucket();
      onActivityChanged?.();
    } catch (err) {
      console.warn("sendToBucket failed", err);
    } finally {
      setBusy(false);
    }
  }

  function onDragStartUncharted(e: React.DragEvent, activityId: number) {
    const payload: DragPayload = { kind: "uncharted", activityId };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragStartBucket(e: React.DragEvent, activityId: number) {
    const payload: DragPayload = { kind: "bucket", activityId };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOverPanel(e: React.DragEvent, target: "uncharted" | "bucket") {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== target) setDropTarget(target);
  }

  async function onDropPanel(e: React.DragEvent, target: "uncharted" | "bucket") {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      if (target === "uncharted" && payload.kind === "bucket") {
        await pullFromBucket(payload.activityId);
      } else if (target === "bucket" && payload.kind === "uncharted") {
        await sendToBucket(payload.activityId);
      }
    } catch {
      // malformed payload — ignore
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-2.5 bg-darkBlue/90 backdrop-blur-sm text-white/80 hover:bg-darkBlue/95 transition"
      >
        <div className="flex items-center gap-3">
          <div className="dock-starfield h-5 w-24 rounded-full opacity-60" />
          <span className="text-xs font-medium inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="star-twinkle text-sm">{unchartedCount}</span>
              uncharted
            </span>
            <span className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1">
              <Bookmark className="h-3 w-3 text-lightBlue/70" />
              <span>{bucketCount} bucket</span>
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
        <div className="bg-darkBlue/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 max-h-[44vh] overflow-y-auto scrollbar-thin slide-in-up">
          <div className="mx-auto max-w-6xl grid gap-4 md:grid-cols-2">
            {/* Left panel — uncharted (this trip) */}
            <div
              onDragOver={(e) => onDragOverPanel(e, "uncharted")}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDropPanel(e, "uncharted")}
              className={`rounded-xl p-3 transition ${
                dropTarget === "uncharted"
                  ? "bg-white/10 outline outline-dashed outline-lightBlue/60"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-white/75">
                  <Star className="h-3 w-3 text-lightBlue star-twinkle" />
                  <span className="text-xs font-medium">
                    Uncharted ({unchartedCount})
                  </span>
                  <span className="text-[10px] text-white/40">this trip</span>
                </div>
                {onAutoArrange && unchartedCount >= 2 && (
                  <button
                    onClick={onAutoArrange}
                    className="flex items-center gap-1 text-[10px] font-medium text-white/80 bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-arrange
                  </button>
                )}
              </div>

              {unchartedCount === 0 ? (
                <div className="text-[11px] text-white/40 text-center py-6 italic">
                  Drag bucket stars here to plan them for this trip
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="relative dock-card group/card"
                      draggable
                      onDragStart={(e) => onDragStartUncharted(e, act.id)}
                    >
                      <Star className="absolute -top-1 -left-1 h-3 w-3 text-lightBlue/40 star-twinkle" />
                      <ActivityCard
                        activity={act}
                        onEdit={onEditActivity}
                        onDelete={onDeleteActivity}
                      />
                      <div className="mt-1 flex items-center justify-between">
                        {schedulingId === act.id ? (
                          <select
                            className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-[10px] text-white/70"
                            style={{ colorScheme: "dark" }}
                            autoFocus
                            onChange={(e) => {
                              if (e.target.value) {
                                onScheduleActivity(
                                  act.id,
                                  parseInt(e.target.value, 10)
                                );
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
                          <>
                            <button
                              onClick={() => setSchedulingId(act.id)}
                              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/75 transition"
                            >
                              <CalendarPlus className="h-2.5 w-2.5" />
                              Schedule
                            </button>
                            <button
                              onClick={() => sendToBucket(act.id)}
                              disabled={busy}
                              title="Send to bucket list"
                              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-lightBlue transition disabled:opacity-40"
                            >
                              <ArrowRight className="h-2.5 w-2.5" />
                              Bucket
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel — bucket list */}
            <div
              onDragOver={(e) => onDragOverPanel(e, "bucket")}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => onDropPanel(e, "bucket")}
              className={`rounded-xl p-3 border-l border-white/10 transition ${
                dropTarget === "bucket"
                  ? "bg-white/10 outline outline-dashed outline-pink/60"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-white/75">
                  <Bookmark className="h-3 w-3 text-pink" />
                  <span className="text-xs font-medium">
                    Bucket List ({bucketCount})
                  </span>
                  <span className="text-[10px] text-white/40">all trips</span>
                </div>
              </div>

              {bucketCount === 0 ? (
                <div className="text-[11px] text-white/40 text-center py-6 italic">
                  Drag uncharted stars here to save for later
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {bucket.map((act) => (
                    <div
                      key={act.id}
                      className="relative dock-card group/card"
                      draggable
                      onDragStart={(e) => onDragStartBucket(e, act.id)}
                    >
                      <Bookmark className="absolute -top-1 -left-1 h-3 w-3 text-pink/70" />
                      <ActivityCard
                        activity={act}
                        onDelete={deleteBucket}
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <button
                          onClick={() => pullFromBucket(act.id)}
                          disabled={busy}
                          title="Pull into this trip"
                          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-lightBlue transition disabled:opacity-40"
                        >
                          <ArrowLeft className="h-2.5 w-2.5" />
                          Pull into trip
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
