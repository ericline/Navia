/**
 * SaveFromLinkDialog — paste a TikTok / Instagram / Google Maps link, let the
 * backend resolve it to place candidates, pick one (or search manually), and
 * save it to the bucket list or a trip.
 *
 * Two modes:
 *  - "save" (default): creates the activity itself; shows a destination picker.
 *  - "pick": hands the chosen place back via `onPick` (used by AddActivityPanel
 *    to prefill its form) and creates nothing.
 */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Link2, Loader2, Search, MapPin, Star, ListChecks, ExternalLink } from "lucide-react";
import {
  Activity,
  ActivityCreate,
  LinkResolveResponse,
  PlaceCandidate,
  Trip,
  createActivity,
  fetchTrips,
  placePhotoUrl,
  resolveLink,
} from "@/lib/api";
import LocationAutocomplete, { ADDRESS_TYPES } from "@/components/ui/LocationAutocomplete";

export interface LinkPick {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  google_place_id?: string | null;
  notes?: string | null;
  source_url: string;
  source_platform: "tiktok" | "instagram" | "google_maps" | "manual";
  external_id?: string | null;
}

export type LinkTarget = { kind: "bucket" } | { kind: "trip"; tripId: number };

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "save" | "pick";
  defaultTarget?: LinkTarget;
  initialUrl?: string;
  onSaved?: (activity: Activity, target: LinkTarget) => void;
  onPick?: (pick: LinkPick) => void;
  /** Called when the link turns out to be a Google Maps *list* (use the importer). */
  onOpenImport?: (url: string) => void;
}

const PLATFORM_LABEL: Record<LinkResolveResponse["platform"], string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  google_maps: "Google Maps",
  unknown: "Link",
};

const CONFIDENCE_STYLE: Record<PlaceCandidate["confidence"], string> = {
  high: "text-green-700 bg-green-500/10",
  medium: "text-blue bg-blue/10",
  low: "text-black/40 bg-black/[0.05]",
};

function looksLikeUrl(s: string) {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

export default function SaveFromLinkDialog({
  open,
  onClose,
  mode = "save",
  defaultTarget = { kind: "bucket" },
  initialUrl = "",
  onSaved,
  onPick,
  onOpenImport,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResolveResponse | null>(null);
  const [selected, setSelected] = useState<number>(-1); // -1 = manual
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCoords, setManualCoords] = useState<[number, number] | null>(null);
  const [manualCategory, setManualCategory] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [target, setTarget] = useState<string>(defaultTarget.kind === "bucket" ? "bucket" : String(defaultTarget.tripId));
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => setMounted(true), []);

  // Reset when (re)opened
  useEffect(() => {
    if (!open) return;
    setUrl(initialUrl);
    setResult(null);
    setError(null);
    setSelected(-1);
    setManualName("");
    setManualAddress("");
    setManualCoords(null);
    setManualCategory("");
    setThumbOk(true);
    setTarget(defaultTarget.kind === "bucket" ? "bucket" : String(defaultTarget.tripId));
    if (mode === "save") {
      fetchTrips().then(setTrips).catch(() => setTrips([]));
    }
    if (initialUrl && looksLikeUrl(initialUrl)) void doResolve(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Paste-to-resolve: as soon as a URL lands in the box, look it up.
  async function doResolve(raw: string) {
    const u = raw.trim();
    if (!looksLikeUrl(u)) {
      setError("Paste a full link starting with https://");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(-1);
    try {
      const res = await resolveLink(u);
      setResult(res);
      setThumbOk(true);
      if (res.candidates.length > 0) setSelected(0);
      else if (res.mentions.length > 0) setManualName(res.mentions[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that link");
    } finally {
      setLoading(false);
    }
  }

  function buildPick(): LinkPick | null {
    if (!result) return null;
    const notes = result.caption ? result.caption.slice(0, 300) : null;
    if (selected >= 0 && result.candidates[selected]) {
      const c = result.candidates[selected];
      return {
        name: c.name,
        address: c.address ?? null,
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        category: c.category ?? null,
        google_place_id: c.google_place_id ?? null,
        notes,
        source_url: result.source_url,
        source_platform: result.platform === "unknown" ? "manual" : result.platform,
        external_id: result.external_id ?? null,
      };
    }
    if (!manualName.trim()) return null;
    return {
      name: manualName.trim(),
      address: manualAddress || null,
      lat: manualCoords?.[1] ?? null,
      lng: manualCoords?.[0] ?? null,
      category: manualCategory || null,
      google_place_id: null,
      notes,
      source_url: result.source_url,
      source_platform: result.platform === "unknown" ? "manual" : result.platform,
      external_id: result.external_id ?? null,
    };
  }

  async function handleConfirm() {
    const pick = buildPick();
    if (!pick) {
      setError("Choose a place or type a name.");
      return;
    }
    if (mode === "pick") {
      onPick?.(pick);
      onClose();
      return;
    }
    const tgt: LinkTarget = target === "bucket" ? { kind: "bucket" } : { kind: "trip", tripId: Number(target) };
    const payload: ActivityCreate = {
      trip_id: tgt.kind === "bucket" ? null : tgt.tripId,
      day_id: null,
      name: pick.name,
      address: pick.address ?? undefined,
      lat: pick.lat,
      lng: pick.lng,
      category: pick.category ?? undefined,
      notes: pick.notes ?? undefined,
      google_place_id: pick.google_place_id ?? null,
      source_url: pick.source_url,
      source_platform: pick.source_platform,
      external_id: pick.external_id ?? null,
      must_do: false,
    };
    setSaving(true);
    setError(null);
    try {
      const created = await createActivity(payload);
      onSaved?.(created, tgt);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const reduce = useReducedMotion();
  if (!mounted) return null;

  const isList = result?.link_kind === "list";
  const canConfirm = !!result && !isList && (selected >= 0 || manualName.trim().length > 0);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="save-link"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="glass bg-warmSurface rounded-3xl w-full max-w-xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 24 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue" />
                <h2 className="text-base font-semibold text-black/80">
                  {mode === "pick" ? "Fill from a link" : "Save from a link"}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition text-black/40">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <p className="text-xs text-black/45">
                Paste a TikTok, Instagram, or Google Maps link. Navia finds the place in the video and adds it as a spot.
              </p>

              <form
                className="flex gap-2"
                onSubmit={(e) => { e.preventDefault(); void doResolve(url); }}
              >
                <input
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-sm text-black/85 placeholder:text-black/30"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (looksLikeUrl(pasted)) {
                      e.preventDefault();
                      setUrl(pasted.trim());
                      void doResolve(pasted);
                    }
                  }}
                  placeholder="https://www.tiktok.com/@…/video/…"
                  autoFocus
                  inputMode="url"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="rounded-xl bg-blue/90 hover:bg-blue px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find
                </button>
              </form>

              {error && <p className="text-xs text-red-500">{error}</p>}

              {result && (
                <div className="space-y-3">
                  {/* Source preview */}
                  <div className="flex gap-3 rounded-xl bg-black/[0.03] p-3">
                    {result.thumbnail_url && thumbOk && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.thumbnail_url}
                        alt=""
                        className="h-16 w-12 rounded-lg object-cover shrink-0 bg-black/5"
                        onError={() => setThumbOk(false)}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-blue/70 bg-blue/[0.08] rounded-full px-2 py-0.5">
                          {PLATFORM_LABEL[result.platform]}
                        </span>
                        {result.hint_city && (
                          <span className="text-[10px] text-black/40 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {result.hint_city}
                          </span>
                        )}
                        <a
                          href={result.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-black/30 hover:text-blue transition"
                          title="Open original"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {result.title && <p className="text-xs font-medium text-black/70 mt-1 truncate">{result.title}</p>}
                      {result.caption && (
                        <p className="text-[11px] text-black/45 mt-0.5 line-clamp-3 whitespace-pre-line">{result.caption}</p>
                      )}
                    </div>
                  </div>

                  {result.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-amber-700/80 bg-amber-400/10 rounded-lg px-3 py-2">{w}</p>
                  ))}

                  {isList ? (
                    <div className="rounded-xl border border-blue/20 bg-blue/[0.05] p-4 text-center space-y-2">
                      <ListChecks className="h-5 w-5 text-blue mx-auto" />
                      <p className="text-sm text-black/70">This is a Google Maps list, not a single place.</p>
                      {onOpenImport && (
                        <button
                          onClick={() => { onOpenImport(result.source_url); onClose(); }}
                          className="rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-xs font-semibold text-white transition"
                        >
                          Import the whole list
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {result.candidates.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-black/60">Is it one of these?</p>
                          {result.candidates.map((c, i) => (
                            <button
                              key={`${c.google_place_id ?? c.name}-${i}`}
                              type="button"
                              onClick={() => setSelected(i)}
                              className={`w-full text-left flex gap-3 rounded-xl border p-3 transition ${
                                selected === i
                                  ? "border-blue/50 bg-blue/[0.06]"
                                  : "border-black/8 bg-white/50 hover:bg-white/80"
                              }`}
                            >
                              {c.photo_reference ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={placePhotoUrl(c.photo_reference, 120)}
                                  alt=""
                                  className="h-14 w-14 rounded-lg object-cover shrink-0 bg-black/5"
                                />
                              ) : (
                                <div className="h-14 w-14 rounded-lg bg-black/[0.04] flex items-center justify-center shrink-0">
                                  <MapPin className="h-4 w-4 text-black/25" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-black/80 truncate">{c.name}</p>
                                  <span className={`text-[9px] uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0 ${CONFIDENCE_STYLE[c.confidence]}`}>
                                    {c.confidence === "high" ? "tagged" : c.confidence === "medium" ? "likely" : "maybe"}
                                  </span>
                                </div>
                                {c.address && <p className="text-[11px] text-black/40 truncate">{c.address}</p>}
                                <div className="flex items-center gap-2 mt-1">
                                  {c.category && <span className="text-[10px] text-black/40 capitalize">{c.category}</span>}
                                  {c.rating != null && (
                                    <span className="text-[10px] text-black/40 flex items-center gap-0.5">
                                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                      {c.rating.toFixed(1)}
                                      {c.rating_count != null && <span className="text-black/25"> ({c.rating_count})</span>}
                                    </span>
                                  )}
                                  {c.matched_text && c.matched_text !== c.name && (
                                    <span className="text-[10px] text-black/30 truncate">from “{c.matched_text}”</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Manual fallback */}
                      <div
                        className={`rounded-xl border p-3 space-y-2 transition ${
                          selected === -1 ? "border-blue/50 bg-blue/[0.06]" : "border-black/8 bg-white/40"
                        }`}
                        onFocusCapture={() => setSelected(-1)}
                      >
                        <p className="text-xs font-medium text-black/60">
                          {result.candidates.length > 0 ? "None of these — search manually" : "Search for the place"}
                        </p>
                        <input
                          className="glass-input w-full rounded-lg px-3 py-1.5 text-xs text-black/80 placeholder:text-black/30"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder={result.mentions[0] ? `e.g. ${result.mentions[0]}` : "Place name"}
                        />
                        <LocationAutocomplete
                          value={manualAddress}
                          onChange={setManualAddress}
                          onCoordinates={(coords) => setManualCoords(coords)}
                          onCategory={(cat) => { if (!manualCategory) setManualCategory(cat); }}
                          types={ADDRESS_TYPES}
                          placeholder={result.hint_city ? `Search near ${result.hint_city}…` : "Search address / POI…"}
                          className="glass-input w-full rounded-lg px-3 py-1.5 text-xs text-black/80 placeholder:text-black/30"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {result && !isList && (
              <div className="flex items-center gap-2 px-6 py-4 border-t border-black/8">
                {mode === "save" && (
                  <select
                    className="glass-input rounded-xl px-3 py-2 text-xs text-black/80 flex-1"
                    style={{ colorScheme: "light" }}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="bucket">Bucket list</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || saving}
                  className="ml-auto rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "pick" ? "Use this place" : "Save spot"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
