"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import {
  Activity,
  Arrangement,
  Day,
  applyArrangement,
  generateArrangements,
} from "@/lib/api";

interface Props {
  open: boolean;
  tripId: number;
  days: Day[];
  activities: Activity[];
  onClose: () => void;
  onApplied: () => Promise<void> | void;
}

export default function ArrangementBrowser({
  open,
  tripId,
  days,
  activities,
  onClose,
  onApplied,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [index, setIndex] = useState(0);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArrangements([]);
    setIndex(0);
    generateArrangements(tripId)
      .then((list) => {
        if (cancelled) return;
        setArrangements(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to generate arrangements");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tripId]);

  const prev = useCallback(() => {
    setIndex((i) => (arrangements.length === 0 ? 0 : (i - 1 + arrangements.length) % arrangements.length));
  }, [arrangements.length]);
  const next = useCallback(() => {
    setIndex((i) => (arrangements.length === 0 ? 0 : (i + 1) % arrangements.length));
  }, [arrangements.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, onClose]);

  const activitiesById = useMemo(() => {
    const map = new Map<number, Activity>();
    for (const a of activities) map.set(a.id, a);
    return map;
  }, [activities]);

  const current = arrangements[index];

  // Preview: group current arrangement's assignments by day
  const previewByDay = useMemo(() => {
    const out = new Map<number, { activity: Activity; start_time?: string | null }[]>();
    if (!current) return out;
    for (const day of days) out.set(day.id, []);
    const sorted = [...current.assignments].sort((a, b) => a.position - b.position);
    for (const a of sorted) {
      const activity = activitiesById.get(a.activity_id);
      if (!activity) continue;
      const bucket = out.get(a.day_id) ?? [];
      bucket.push({ activity, start_time: a.start_time });
      out.set(a.day_id, bucket);
    }
    return out;
  }, [current, days, activitiesById]);

  async function handleApply() {
    if (!current) return;
    setApplying(true);
    setError(null);
    try {
      await applyArrangement(tripId, current.assignments);
      await onApplied();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply arrangement");
    } finally {
      setApplying(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass bg-warmSurface rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue" />
            <h2 className="text-base font-semibold text-black/80">
              Auto-arrange
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition text-black/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav bar */}
        {!loading && arrangements.length > 0 && current && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-black/6">
            <button
              onClick={prev}
              disabled={arrangements.length < 2}
              className="p-2 rounded-lg hover:bg-black/5 transition disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 text-black/60" />
            </button>

            <div className="flex-1 text-center px-4">
              <div className="text-sm font-semibold text-black/80">
                {current.name}
              </div>
              <div className="text-xs text-black/50">{current.description}</div>
              <div className="flex items-center justify-center gap-1 mt-2">
                {arrangements.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-4 bg-blue" : "w-1.5 bg-black/15"
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={next}
              disabled={arrangements.length < 2}
              className="p-2 rounded-lg hover:bg-black/5 transition disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4 text-black/60" />
            </button>
          </div>
        )}

        {/* Preview body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-black/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing arrangements…
            </div>
          )}

          {!loading && arrangements.length === 0 && (
            <p className="text-center text-sm text-black/45 py-10">
              {error ?? "No arrangements to preview. Add some unscheduled activities first."}
            </p>
          )}

          {!loading && current && (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 5)}, minmax(0, 1fr))` }}>
              {days.map((day) => {
                const items = previewByDay.get(day.id) ?? [];
                return (
                  <div
                    key={day.id}
                    className="rounded-xl bg-white/55 border border-black/6 p-3 min-h-[120px]"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-black/40 font-medium mb-2">
                      {day.date}
                      {day.name && (
                        <span className="ml-1 text-black/30 normal-case tracking-normal">
                          — {day.name}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {items.length === 0 && (
                        <li className="text-[11px] text-black/30 italic">Empty day</li>
                      )}
                      {items.map(({ activity, start_time }) => (
                        <li
                          key={activity.id}
                          className="rounded-lg bg-white/60 border border-black/5 p-2"
                        >
                          <div className="text-xs font-semibold text-black/80 truncate">
                            {activity.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-black/45">
                            {start_time && <span>{start_time.slice(0, 5)}</span>}
                            {activity.est_duration_minutes != null && (
                              <span>{activity.est_duration_minutes}m</span>
                            )}
                            {activity.category && (
                              <span className="capitalize">{activity.category}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {error && !loading && (
            <p className="mt-3 text-xs text-rose-600/90 text-center" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/8 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 text-sm text-black/60 rounded-lg hover:bg-black/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || loading || !current}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue/90 hover:bg-blue transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applying ? "Applying…" : "Apply this arrangement"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
