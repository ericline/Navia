/** DayWindowEditor - Small popover for editing a single day's time window (with "default" fallback). */
"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { Day, DayUpdate } from "@/lib/types";

interface Props {
  day: Day;
  defaultStart: string; // "HH:MM:SS" from user prefs
  defaultEnd: string;
  onClose: () => void;
  onUpdateDay: (dayId: number, patch: DayUpdate) => void | Promise<void>;
}

function toHHMM(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function toHHMMSS(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export default function DayWindowEditor({
  day,
  defaultStart,
  defaultEnd,
  onClose,
  onUpdateDay,
}: Props) {
  const [startVal, setStartVal] = useState(
    toHHMM(day.day_start) || toHHMM(defaultStart)
  );
  const [endVal, setEndVal] = useState(
    toHHMM(day.day_end) || toHHMM(defaultEnd)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function save() {
    setError(null);
    if (startVal && endVal && endVal <= startVal) {
      setError("End must be after start.");
      return;
    }
    setSaving(true);
    try {
      await onUpdateDay(day.id, {
        day_start: startVal ? toHHMMSS(startVal) : null,
        day_end: endVal ? toHHMMSS(endVal) : null,
      });
      onClose();
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      await onUpdateDay(day.id, { reset_start: true, reset_end: true });
      onClose();
    } catch {
      setError("Failed to reset.");
    } finally {
      setSaving(false);
    }
  }

  const isCustom = day.day_start != null || day.day_end != null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-xl bg-warmSurface border border-black/10 shadow-xl p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-black/60 uppercase tracking-wide">
          Day window
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-black/5 text-black/40"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] text-black/45">Start</label>
        <input
          type="time"
          value={startVal}
          onChange={(e) => setStartVal(e.target.value)}
          className="glass-input w-full rounded-lg px-2 py-1 text-xs text-black/85"
        />
        <label className="block text-[10px] text-black/45 mt-1">End</label>
        <input
          type="time"
          value={endVal}
          onChange={(e) => setEndVal(e.target.value)}
          className="glass-input w-full rounded-lg px-2 py-1 text-xs text-black/85"
        />
      </div>

      {error && <p className="text-[10px] text-rose-600/90">{error}</p>}

      <div className="flex items-center justify-between gap-1 pt-1">
        <button
          onClick={reset}
          disabled={saving || !isCustom}
          className="flex items-center gap-1 text-[10px] text-black/50 hover:text-black/80 px-1.5 py-1 rounded hover:bg-black/5 transition disabled:opacity-30"
          title="Use preferences default"
        >
          <RotateCcw className="h-3 w-3" />
          Default
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[11px] text-black/50 hover:text-black/80 px-2 py-1 rounded hover:bg-black/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-[11px] font-semibold text-white bg-blue/90 hover:bg-blue px-2 py-1 rounded transition disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
