/**
 * PreferencesSection - Editable user preference form.
 * Likes/dislikes are canonical category chips (drives ML scorer's category_match);
 * travel_style / group_type / interests feed the retrieval encoder.
 */
"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import {
  USER_FACING_CATEGORIES,
  CATEGORY_LABELS,
  TRAVEL_STYLES,
  GROUP_TYPES,
  NAVIA_CATEGORIES,
  type NaviaCategory,
} from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

function timeToHHMM(t: string): string {
  return t.slice(0, 5);
}

function hhmmToTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

const CANONICAL_SET = new Set<string>(NAVIA_CATEGORIES);

function sanitizeCategoryList(xs: string[]): NaviaCategory[] {
  return xs.filter((x): x is NaviaCategory => CANONICAL_SET.has(x));
}

export default function PreferencesSection() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial: UserPreferences = user?.preferences ?? DEFAULT_PREFERENCES;
  const [draft, setDraft] = useState<UserPreferences>(initial);
  const [dietaryText, setDietaryText] = useState(initial.dietary.join(", "));
  const [interestsText, setInterestsText] = useState(
    (initial.interests ?? []).join(", ")
  );

  useEffect(() => {
    if (!user) return;
    const p = user.preferences ?? DEFAULT_PREFERENCES;
    setDraft(p);
    setDietaryText(p.dietary.join(", "));
    setInterestsText((p.interests ?? []).join(", "));
  }, [user]);

  function cancel() {
    const p = user?.preferences ?? DEFAULT_PREFERENCES;
    setDraft(p);
    setDietaryText(p.dietary.join(", "));
    setInterestsText((p.interests ?? []).join(", "));
    setError(null);
    setEditing(false);
  }

  function toggleLike(cat: NaviaCategory) {
    const likes = new Set(sanitizeCategoryList(draft.likes));
    const dislikes = new Set(sanitizeCategoryList(draft.dislikes));
    if (likes.has(cat)) likes.delete(cat);
    else {
      likes.add(cat);
      dislikes.delete(cat);
    }
    setDraft({ ...draft, likes: [...likes], dislikes: [...dislikes] });
  }

  function toggleDislike(cat: NaviaCategory) {
    const likes = new Set(sanitizeCategoryList(draft.likes));
    const dislikes = new Set(sanitizeCategoryList(draft.dislikes));
    if (dislikes.has(cat)) dislikes.delete(cat);
    else {
      dislikes.add(cat);
      likes.delete(cat);
    }
    setDraft({ ...draft, likes: [...likes], dislikes: [...dislikes] });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parseChips = (s: string) =>
        s.split(",").map((x) => x.trim()).filter(Boolean);
      const next: UserPreferences = {
        ...draft,
        likes: sanitizeCategoryList(draft.likes),
        dislikes: sanitizeCategoryList(draft.dislikes),
        dietary: parseChips(dietaryText),
        interests: parseChips(interestsText),
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
  const likesSet = new Set(sanitizeCategoryList(p.likes));
  const dislikesSet = new Set(sanitizeCategoryList(p.dislikes));

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
          <div className="text-xs text-black/40">Travel style</div>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TRAVEL_STYLES.map((s) => {
                const active = draft.travel_style === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        travel_style: active
                          ? null
                          : (s.value as UserPreferences["travel_style"]),
                      })
                    }
                    title={s.hint}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-blue/15 border-blue/40 text-blue"
                        : "bg-white/60 border-black/10 text-black/60 hover:border-blue/30"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80 capitalize">
              {p.travel_style ?? "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Group type</div>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GROUP_TYPES.map((g) => {
                const active = draft.group_type === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        group_type: active
                          ? null
                          : (g.value as UserPreferences["group_type"]),
                      })
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-blue/15 border-blue/40 text-blue"
                        : "bg-white/60 border-black/10 text-black/60 hover:border-blue/30"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80 capitalize">
              {p.group_type ?? "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Likes</div>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {USER_FACING_CATEGORIES.map((cat) => {
                const active = likesSet.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleLike(cat)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700"
                        : "bg-white/60 border-black/10 text-black/60 hover:border-emerald-400/30"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {likesSet.size > 0
                ? [...likesSet].map((c) => CATEGORY_LABELS[c]).join(", ")
                : "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">Dislikes</div>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {USER_FACING_CATEGORIES.map((cat) => {
                const active = dislikesSet.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleDislike(cat)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-700"
                        : "bg-white/60 border-black/10 text-black/60 hover:border-rose-400/30"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {dislikesSet.size > 0
                ? [...dislikesSet].map((c) => CATEGORY_LABELS[c]).join(", ")
                : "—"}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/60 border border-black/6 p-4 sm:col-span-2">
          <div className="text-xs text-black/40">
            Interests (comma-separated — e.g. street food, rooftop bars)
          </div>
          {editing ? (
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="street food, rooftop bars, hidden bookshops"
              className="glass-input mt-1 w-full rounded-lg px-2 py-1 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1 text-sm font-medium text-black/80">
              {(p.interests?.length ?? 0) > 0 ? (p.interests ?? []).join(", ") : "—"}
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
