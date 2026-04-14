/**
 * PreferencesSection - Editable user preference form.
 * Likes/dislikes are canonical category chips (drives ML scorer's category_match);
 * travel_style / group_type / interests feed the retrieval encoder.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  X,
  Clock,
  Compass,
  Heart,
  SlidersHorizontal,
  Footprints,
  DollarSign,
  Utensils,
  Sparkles,
} from "lucide-react";
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

type ChipTone = "blue" | "emerald" | "rose";

const TONE_CLASSES: Record<ChipTone, { active: string; idle: string }> = {
  blue: {
    active:
      "bg-gradient-to-br from-blue/20 to-blue/5 border-blue/40 text-blue/90 shadow-sm",
    idle:
      "bg-white/60 border-black/8 text-black/55 hover:border-blue/30 hover:bg-white/90",
  },
  emerald: {
    active:
      "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-700 shadow-sm",
    idle:
      "bg-white/60 border-black/8 text-black/55 hover:border-emerald-400/30 hover:bg-white/90",
  },
  rose: {
    active:
      "bg-gradient-to-br from-rose-500/20 to-rose-500/5 border-rose-500/40 text-rose-700 shadow-sm",
    idle:
      "bg-white/60 border-black/8 text-black/55 hover:border-rose-400/30 hover:bg-white/90",
  },
};

function PrefChip({
  active,
  onClick,
  tone = "blue",
  title,
  children,
  reduce,
}: {
  active: boolean;
  onClick: () => void;
  tone?: ChipTone;
  title?: string;
  children: ReactNode;
  reduce: boolean;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={title}
      layout={!reduce}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
        active ? t.active : t.idle
      }`}
    >
      {children}
    </motion.button>
  );
}

function SubSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-black/55">
          {icon}
          {title}
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-black/10 to-transparent" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11px] text-black/45 font-medium">{children}</div>;
}

function FieldCard({ children, span }: { children: ReactNode; span?: boolean }) {
  return (
    <div
      className={`rounded-xl bg-white/55 border border-black/6 p-4 backdrop-blur-sm ${
        span ? "sm:col-span-2" : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function PreferencesSection() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion() ?? false;

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
    <section className="glass bg-coolCard rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue/70" />
          <h2 className="text-sm font-semibold text-black/70">Preferences</h2>
        </div>
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

      {/* Pace & timing */}
      <SubSection icon={<Clock className="h-3 w-3" />} title="Pace & timing">
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldCard>
            <FieldLabel>Pace</FieldLabel>
            {editing ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(["relaxed", "balanced", "packed"] as const).map((v) => (
                  <PrefChip
                    key={v}
                    active={draft.pace === v}
                    onClick={() => setDraft({ ...draft, pace: v })}
                    reduce={reduce}
                  >
                    <span className="capitalize">{v}</span>
                  </PrefChip>
                ))}
              </div>
            ) : (
              <div className="mt-1.5 text-sm font-medium text-black/80 capitalize">
                {p.pace}
              </div>
            )}
          </FieldCard>

          <FieldCard>
            <FieldLabel>Day window</FieldLabel>
            {editing ? (
              <div className="flex items-center gap-2 mt-2">
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
              <div className="mt-1.5 text-sm font-medium text-black/80 tabular-nums">
                {timeToHHMM(p.day_start)} — {timeToHHMM(p.day_end)}
              </div>
            )}
          </FieldCard>
        </div>
      </SubSection>

      {/* Style & company */}
      <SubSection icon={<Compass className="h-3 w-3" />} title="Style & company">
        <FieldCard span>
          <FieldLabel>Travel style</FieldLabel>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TRAVEL_STYLES.map((s) => (
                <PrefChip
                  key={s.value}
                  active={draft.travel_style === s.value}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      travel_style:
                        draft.travel_style === s.value
                          ? null
                          : (s.value as UserPreferences["travel_style"]),
                    })
                  }
                  title={s.hint}
                  reduce={reduce}
                >
                  {s.label}
                </PrefChip>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80 capitalize">
              {p.travel_style ?? "—"}
            </div>
          )}
        </FieldCard>

        <FieldCard span>
          <FieldLabel>Group type</FieldLabel>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GROUP_TYPES.map((g) => (
                <PrefChip
                  key={g.value}
                  active={draft.group_type === g.value}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      group_type:
                        draft.group_type === g.value
                          ? null
                          : (g.value as UserPreferences["group_type"]),
                    })
                  }
                  reduce={reduce}
                >
                  {g.label}
                </PrefChip>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80 capitalize">
              {p.group_type ?? "—"}
            </div>
          )}
        </FieldCard>
      </SubSection>

      {/* Taste */}
      <SubSection icon={<Heart className="h-3 w-3" />} title="Taste">
        <FieldCard span>
          <FieldLabel>Likes</FieldLabel>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {USER_FACING_CATEGORIES.map((cat) => (
                <PrefChip
                  key={cat}
                  active={likesSet.has(cat)}
                  onClick={() => toggleLike(cat)}
                  tone="emerald"
                  reduce={reduce}
                >
                  {CATEGORY_LABELS[cat]}
                </PrefChip>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80">
              {likesSet.size > 0
                ? [...likesSet].map((c) => CATEGORY_LABELS[c]).join(", ")
                : "—"}
            </div>
          )}
        </FieldCard>

        <FieldCard span>
          <FieldLabel>Dislikes</FieldLabel>
          {editing ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {USER_FACING_CATEGORIES.map((cat) => (
                <PrefChip
                  key={cat}
                  active={dislikesSet.has(cat)}
                  onClick={() => toggleDislike(cat)}
                  tone="rose"
                  reduce={reduce}
                >
                  {CATEGORY_LABELS[cat]}
                </PrefChip>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80">
              {dislikesSet.size > 0
                ? [...dislikesSet].map((c) => CATEGORY_LABELS[c]).join(", ")
                : "—"}
            </div>
          )}
        </FieldCard>

        <FieldCard span>
          <FieldLabel>Interests</FieldLabel>
          {editing ? (
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="street food, rooftop bars, hidden bookshops"
              className="glass-input mt-2 w-full rounded-lg px-2.5 py-1.5 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80">
              {(p.interests?.length ?? 0) > 0 ? (p.interests ?? []).join(", ") : "—"}
            </div>
          )}
        </FieldCard>

        <FieldCard span>
          <div className="flex items-center gap-1.5">
            <Utensils className="h-3 w-3 text-black/45" />
            <FieldLabel>Dietary restrictions</FieldLabel>
          </div>
          {editing ? (
            <input
              type="text"
              value={dietaryText}
              onChange={(e) => setDietaryText(e.target.value)}
              placeholder="vegetarian, halal"
              className="glass-input mt-2 w-full rounded-lg px-2.5 py-1.5 text-sm text-black/85"
            />
          ) : (
            <div className="mt-1.5 text-sm font-medium text-black/80">
              {p.dietary.length > 0 ? p.dietary.join(", ") : "—"}
            </div>
          )}
        </FieldCard>
      </SubSection>

      {/* Constraints */}
      <SubSection
        icon={<SlidersHorizontal className="h-3 w-3" />}
        title="Constraints"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldCard>
            <FieldLabel>Max walking distance</FieldLabel>
            {editing ? (
              <div className="mt-2 flex items-center gap-2 glass-input rounded-lg px-2.5 py-1.5">
                <Footprints className="h-3.5 w-3.5 text-black/45 shrink-0" />
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.max_walking_km}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      max_walking_km: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-transparent outline-none text-sm text-black/85 tabular-nums"
                />
                <span className="text-xs text-black/40 shrink-0">km</span>
              </div>
            ) : (
              <div className="mt-1.5 text-sm font-medium text-black/80 tabular-nums">
                {p.max_walking_km} km
              </div>
            )}
          </FieldCard>

          <FieldCard>
            <FieldLabel>Max budget per activity</FieldLabel>
            {editing ? (
              <div className="mt-2 flex items-center gap-2 glass-input rounded-lg px-2.5 py-1.5">
                <DollarSign className="h-3.5 w-3.5 text-black/45 shrink-0" />
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
                  className="w-full bg-transparent outline-none text-sm text-black/85 tabular-nums"
                />
                <span className="text-xs text-black/40 shrink-0">USD</span>
              </div>
            ) : (
              <div className="mt-1.5 text-sm font-medium text-black/80 tabular-nums">
                ${p.max_activity_budget}
              </div>
            )}
          </FieldCard>
        </div>
      </SubSection>

      {error && (
        <p className="text-xs text-rose-600/90" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
