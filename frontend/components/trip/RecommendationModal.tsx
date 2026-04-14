/** RecommendationModal - Fetches and displays AI activity recommendations for a trip. */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { X, Sparkles, Loader2, Star, CheckCircle } from "lucide-react";
import {
  RecommendedActivity,
  fetchRecommendations,
  createActivity,
  sendRecommendationFeedback,
  placePhotoUrl,
} from "@/lib/api";

interface Props {
  open: boolean;
  tripId: number;
  onClose: () => void;
  onAdded: () => void; // called after activities are added so parent can refetch
}

export default function RecommendationModal({
  open,
  tripId,
  onClose,
  onAdded,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [recs, setRecs] = useState<RecommendedActivity[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecs([]);
    setSelected(new Set());
    fetchRecommendations(tripId)
      .then((res) => {
        if (cancelled) return;
        setEnabled(res.enabled);
        setRecs(res.recommendations);
        // Default-select all
        setSelected(new Set(res.recommendations.map((_, i) => i)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tripId]);

  function toggle(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  }

  async function handleAdd() {
    if (selected.size === 0) {
      handleClose();
      return;
    }
    setAdding(true);
    setError(null);
    try {
      for (const idx of selected) {
        const r = recs[idx];
        if (!r) continue;
        await createActivity({
          trip_id: tripId,
          day_id: null,
          name: r.name,
          category: r.category,
          address: r.address,
          lat: r.lat ?? null,
          lng: r.lng ?? null,
          est_duration_minutes: r.est_duration_minutes,
          cost_estimate: r.cost_estimate,
          energy_level: r.energy_level,
          must_do: r.must_do ?? false,
          notes: r.notes,
          google_place_id: r.google_place_id ?? null,
        });
        void sendRecommendationFeedback(tripId, r.place_id ?? null, "added");
      }
      // Fire skipped feedback for recs the user saw but didn't add
      recs.forEach((r, idx) => {
        if (!selected.has(idx)) {
          void sendRecommendationFeedback(tripId, r.place_id ?? null, "skipped");
        }
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add activities");
    } finally {
      setAdding(false);
    }
  }

  function handleClose() {
    // User dismissed the modal without adding anything — mark all rendered recs as skipped
    if (recs.length > 0 && !adding) {
      recs.forEach((r) => {
        void sendRecommendationFeedback(tripId, r.place_id ?? null, "skipped");
      });
    }
    onClose();
  }

  const reduce = useReducedMotion();

  const panelTransition = reduce
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 260, damping: 24 };

  const listVariants: Variants = {
    hidden: {},
    show: {
      transition: reduce
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.035, delayChildren: 0.05 },
    },
  };

  const itemVariants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 4 },
    show: reduce
      ? { opacity: 1, transition: { duration: 0.15 } }
      : { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
    <motion.div
      key="rec-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="glass bg-warmSurface rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
        transition={panelTransition}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue" />
            <h2 className="text-base font-semibold text-black/80">
              Recommended activities
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition text-black/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-black/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating suggestions…
            </div>
          )}

          {!loading && !enabled && (
            <div className="text-center py-10">
              <p className="text-sm text-black/60 font-medium">
                AI suggestions are disabled
              </p>
              <p className="text-xs text-black/40 mt-1">
                Add an <code className="bg-black/5 px-1 rounded">ANTHROPIC_API_KEY</code>{" "}
                to <code className="bg-black/5 px-1 rounded">backend/.env</code> to enable
                recommendations.
              </p>
            </div>
          )}

          {!loading && enabled && recs.length === 0 && !error && (
            <p className="text-center text-sm text-black/40 py-10">
              No suggestions were returned. Try tweaking your preferences.
            </p>
          )}

          {!loading && recs.length > 0 && (
            <motion.ul
              className="space-y-2"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {recs.map((r, idx) => {
                const isSelected = selected.has(idx);
                return (
                  <motion.li key={idx} variants={itemVariants}>
                    <motion.button
                      type="button"
                      onClick={() => toggle(idx)}
                      whileTap={reduce ? undefined : { scale: 0.98 }}
                      className={`w-full text-left rounded-xl border p-3 transition ${
                        isSelected
                          ? "border-blue/40 bg-blue/5"
                          : "border-black/8 bg-white/50 hover:bg-white/70"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue bg-blue"
                              : "border-black/25"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              viewBox="0 0 16 16"
                              className="h-2.5 w-2.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path d="M3 8l3 3 7-7" />
                            </svg>
                          )}
                        </div>
                        {r.photo_reference && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={placePhotoUrl(r.photo_reference, 160)}
                            alt=""
                            loading="lazy"
                            className="h-14 w-14 rounded-lg object-cover shrink-0 bg-black/5"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-black/85">
                              {r.name}
                            </span>
                            {r.verified && (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            )}
                            {r.category && (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue/10 text-blue/80">
                                {r.category}
                              </span>
                            )}
                            {r.must_do && (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600/80">
                                must-do
                              </span>
                            )}
                          </div>
                          {r.address && (
                            <p className="text-xs text-black/50 mt-0.5 truncate">
                              {r.address}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-black/40">
                            {r.rating != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                {r.rating.toFixed(1)}
                                {r.rating_count != null && (
                                  <span className="text-black/30">({r.rating_count.toLocaleString()})</span>
                                )}
                              </span>
                            )}
                            {r.cost_estimate != null && (
                              <span>~${r.cost_estimate}</span>
                            )}
                            {r.est_duration_minutes != null && (
                              <span>{r.est_duration_minutes} min</span>
                            )}
                          </div>
                          {r.notes && (
                            <p className="text-xs text-black/55 mt-1.5 italic">
                              {r.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}

          {error && (
            <p className="mt-3 text-xs text-rose-600/90" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/8 flex items-center justify-between">
          <span className="text-xs text-black/45">
            {recs.length > 0 && `${selected.size} of ${recs.length} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={adding}
              className="px-4 py-2 text-sm text-black/60 rounded-lg hover:bg-black/5 transition"
            >
              Skip
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || loading || selected.size === 0}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-blue/90 hover:bg-blue transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? "Adding…" : `Add ${selected.size || ""}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
