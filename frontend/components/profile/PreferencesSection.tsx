/**
 * PreferencesSection - Editable user preference form (pace, budget, walking
 * distance, day window, likes/dislikes, dietary restrictions). Reads and
 * writes preferences via the AuthContext.
 */
"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

function timeToHHMM(t: string): string {
  return t.slice(0, 5);
}

function hhmmToTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

export default function PreferencesSection() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial: UserPreferences = user?.preferences ?? DEFAULT_PREFERENCES;
  const [draft, setDraft] = useState<UserPreferences>(initial);
  const [likesText, setLikesText] = useState(initial.likes.join(", "));
  const [dislikesText, setDislikesText] = useState(initial.dislikes.join(", "));
  const [dietaryText, setDietaryText] = useState(initial.dietary.join(", "));

  useEffect(() => {
    if (!user) return;
    const p = user.preferences ?? DEFAULT_PREFERENCES;
    setDraft(p);
    setLikesText(p.likes.join(", "));
    setDislikesText(p.dislikes.join(", "));
    setDietaryText(p.dietary.join(", "));
  }, [user]);

  function cancel() {
    const p = user?.preferences ?? DEFAULT_PREFERENCES;
    setDraft(p);
    setLikesText(p.likes.join(", "));
    setDislikesText(p.dislikes.join(", "));
    setDietaryText(p.dietary.join(", "));
    setError(null);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parseChips = (s: string) =>
        s.split(",").map((x) => x.trim()).filter(Boolean);
      const next: UserPreferences = {
        ...draft,
        likes: parseChips(likesText),
        dislikes: parseChips(dislikesText),
        dietary: parseChips(dietaryText),
        day_start: hhmmToTime(draft.day_start),
        day_end: hhmmToTime(draft.day_end),
      };
      if (next.day_end <= next.day_start) {
        throw new Error("Day end must be after day start.");
      }
      await updateUser({ preferences: next });
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const p = editing ? draft : initial;

  return (
    <section className="glass bg-coolCard rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black/60">Preferences</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue/80 hover:text-blue font-medium px-3 py-1 rounded-lg hover:bg-blue/10 transition"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={saving}
              className="p-1.5 rounded-lg bg-blue/10 hover:bg-blue/20 transition disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5 text-blue" />
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="p-1.5 rounded-lg hover:bg-black/5 transition"
            >
              <X className="h-3.5 w-3.5 text-black/40" />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/60 border border-black/6 p-4">
          <div className="text-xs text-black/40">Max walking distance (km)</div>
          {editing ? (
            <input
              type="number"
              min={0}
              step={0.1}
              value={draft.max_walking_km}
              onChange={(e) =>
                setDraft({ ...draft, max_walking_km: parseFloat(e.target.value) || 0 })
              }
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {p.max_walking_km} km
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4">
          <div className="text-xs text-black/40">Max budget per activity (USD)</div>
          {editing ? (
            <input
              type="number"
              min={0}
              step={1}
              value={draft.max_activity_budget}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  max_activity_budget: parseFloat(e.target.value) || 0,
                })
              }
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              ${p.max_activity_budget}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4">
          <div className="text-xs text-black/40">Pace</div>
          {editing ? (
            <select
              value={draft.pace}
              onChange={(e) =>
                setDraft({ ...draft, pace: e.target.value as UserPreferences["pace"] })
              }
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            >
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Packed</option>
            </select>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80 capitalize">
              {p.pace}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4">
          <div className="text-xs text-black/40">Day window</div>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="time"
                value={timeToHHMM(draft.day_start)}
                onChange={(e) =>
                  setDraft({ ...draft, day_start: hhmmToTime(e.target.value) })
                }
                className="glass-input rounded-lg px-2 py-1 text-sm text-black/85 flex-1"
              />
              <span className="text-xs text-black/40">to</span>
              <input
                type="time"
                value={timeToHHMM(draft.day_end)}
                onChange={(e) =>
                  setDraft({ ...draft, day_end: hhmmToTime(e.target.value) })
                }
                className="glass-input rounded-lg px-2 py-1 text-sm text-black/85 flex-1"
              />
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {timeToHHMM(p.day_start)} — {timeToHHMM(p.day_end)}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Likes (comma-separated)</div>
          {editing ? (
            <input
              type="text"
              value={likesText}
              onChange={(e) => setLikesText(e.target.value)}
              placeholder="food, museums, hiking"
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {p.likes.length > 0 ? p.likes.join(", ") : "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Dislikes (comma-separated)</div>
          {editing ? (
            <input
              type="text"
              value={dislikesText}
              onChange={(e) => setDislikesText(e.target.value)}
              placeholder="nightclubs, long lines"
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {p.dislikes.length > 0 ? p.dislikes.join(", ") : "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Dietary restrictions (comma-separated)</div>
          {editing ? (
            <input
              type="text"
              value={dietaryText}
              onChange={(e) => setDietaryText(e.target.value)}
              placeholder="vegetarian, halal"
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {p.dietary.length > 0 ? p.dietary.join(", ") : "—"}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600/90" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
