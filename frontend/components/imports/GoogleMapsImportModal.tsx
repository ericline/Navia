/**
 * GoogleMapsImportModal — bring a Google Maps saved list into Navia.
 *
 * Step 1  Source: drop a Google Takeout file (CSV / Saved Places.json / KML / KMZ / the
 *         whole zip) or paste a shared list link.
 * Step 2  Preview: rows the backend parsed + resolved via Google Places; untick any.
 * Step 3  Destination: bucket list, an existing trip, or a brand-new trip.
 *         Commits through POST /activities/batch (duplicates skipped server-side).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Upload, Link2, Loader2, CheckCircle2, AlertCircle, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import {
  ActivityBatchResult,
  ActivityCreate,
  BatchTarget,
  ImportPreview,
  Trip,
  createActivitiesBatch,
  fetchTrips,
  previewGoogleMapsFile,
  previewGoogleMapsLink,
} from "@/lib/api";
import { getTodayStr } from "@/lib/utils";

export type ImportTarget = { kind: "bucket" } | { kind: "trip"; tripId: number };

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTarget?: ImportTarget;
  /** Prefill the link field (e.g. a shared list URL handed over from SaveFromLinkDialog). */
  initialUrl?: string;
  onImported?: (result: ActivityBatchResult, target: BatchTarget) => void;
}

const ACCEPT = ".csv,.json,.kml,.kmz,.zip,text/csv,application/json,application/zip";

export default function GoogleMapsImportModal({
  open,
  onClose,
  defaultTarget = { kind: "bucket" },
  initialUrl = "",
  onImported,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [destKind, setDestKind] = useState<"bucket" | "trip" | "new">(defaultTarget.kind);
  const [destTripId, setDestTripId] = useState<string>(defaultTarget.kind === "trip" ? String(defaultTarget.tripId) : "");
  const [newTrip, setNewTrip] = useState({ name: "", destination: "", start_date: getTodayStr(), end_date: getTodayStr() });
  const [showHelp, setShowHelp] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [done, setDone] = useState<ActivityBatchResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setUrl(initialUrl);
    setHint("");
    setPreview(null);
    setChecked([]);
    setError(null);
    setDone(null);
    setDestKind(defaultTarget.kind);
    setDestTripId(defaultTarget.kind === "trip" ? String(defaultTarget.tripId) : "");
    fetchTrips().then(setTrips).catch(() => setTrips([]));
    if (initialUrl) void loadLink(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyPreview(p: ImportPreview) {
    setPreview(p);
    setChecked(p.items.map(() => true));
    if (p.list_name && !newTrip.name) setNewTrip((n) => ({ ...n, name: p.list_name ?? "" }));
    if (p.items.length === 0 && p.warnings.length === 0) setError("No places found in that source.");
  }

  async function loadLink(u: string) {
    if (!/^https?:\/\//i.test(u.trim())) {
      setError("Paste a full Google Maps list link (maps.app.goo.gl/…)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      applyPreview(await previewGoogleMapsLink(u.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that list");
    } finally {
      setLoading(false);
    }
  }

  async function loadFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      applyPreview(await previewGoogleMapsFile(file, file.name, hint || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file");
    } finally {
      setLoading(false);
    }
  }

  function buildTarget(): BatchTarget | null {
    if (destKind === "bucket") return { bucket: true };
    if (destKind === "trip") {
      if (!destTripId) return null;
      return { trip_id: Number(destTripId) };
    }
    if (!newTrip.name.trim() || !newTrip.destination.trim()) return null;
    return { new_trip: { ...newTrip, name: newTrip.name.trim(), destination: newTrip.destination.trim() } };
  }

  async function handleImport() {
    if (!preview) return;
    const target = buildTarget();
    if (!target) {
      setError(destKind === "new" ? "Give the new trip a name and destination." : "Pick a trip.");
      return;
    }
    const items: ActivityCreate[] = preview.items
      .filter((_, i) => checked[i])
      .map((it) => ({
        trip_id: null,
        name: it.name,
        address: it.address ?? undefined,
        lat: it.lat ?? null,
        lng: it.lng ?? null,
        category: it.category ?? undefined,
        notes: it.notes ?? undefined,
        google_place_id: it.google_place_id ?? null,
        source_url: it.source_url ?? null,
        source_platform: "google_maps",
        external_id: it.external_id ?? null,
        must_do: false,
      }));
    if (items.length === 0) {
      setError("Select at least one place.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const result = await createActivitiesBatch(target, items);
      setDone(result);
      onImported?.(result, target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const reduce = useReducedMotion();
  if (!mounted) return null;

  const selectedCount = checked.filter(Boolean).length;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="gm-import"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="glass bg-warmSurface rounded-3xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 24 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue" />
                <h2 className="text-base font-semibold text-black/80">Import from Google Maps</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 transition text-black/40">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {done ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-black/75">
                    Imported {done.created.length} {done.created.length === 1 ? "place" : "places"}
                    {done.trip ? ` into “${done.trip.name}”` : " into your bucket list"}.
                  </p>
                  {done.skipped_duplicates > 0 && (
                    <p className="text-xs text-black/40">{done.skipped_duplicates} already there, skipped.</p>
                  )}
                </div>
              ) : !preview ? (
                <>
                  {/* Source: file */}
                  <div
                    className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                      dragOver ? "border-blue/60 bg-blue/[0.06]" : "border-black/10 bg-white/40"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void loadFile(f);
                    }}
                  >
                    <Upload className="h-5 w-5 text-black/30 mx-auto mb-2" />
                    <p className="text-sm text-black/65">Drop your Google Takeout file here</p>
                    <p className="text-[11px] text-black/35 mt-1">CSV, Saved Places.json, KML/KMZ, or the whole takeout .zip</p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={loading}
                      className="mt-3 rounded-xl border border-black/10 hover:bg-black/5 px-3 py-1.5 text-xs text-black/60 transition"
                    >
                      Choose file
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      className="glass-input flex-1 rounded-xl px-3 py-2 text-xs text-black/80 placeholder:text-black/30"
                      value={hint}
                      onChange={(e) => setHint(e.target.value)}
                      placeholder="City hint for matching (optional), e.g. Tokyo"
                    />
                  </div>

                  {/* Source: link */}
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void loadLink(url); }}>
                    <div className="relative flex-1">
                      <Link2 className="h-3.5 w-3.5 text-black/30 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className="glass-input w-full rounded-xl pl-8 pr-3 py-2 text-sm text-black/85 placeholder:text-black/30"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="…or paste a shared list link (maps.app.goo.gl/…)"
                        inputMode="url"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !url.trim()}
                      className="rounded-xl bg-blue/90 hover:bg-blue px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                    >
                      Read
                    </button>
                  </form>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-black/50">
                      <Loader2 className="h-4 w-4 animate-spin" /> Reading your list…
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowHelp((s) => !s)}
                    className="text-xs text-black/45 hover:text-black/65 flex items-center gap-1 transition"
                  >
                    {showHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    How do I export a list from Google Maps?
                  </button>
                  {showHelp && (
                    <ol className="text-[11px] text-black/50 space-y-1 list-decimal pl-5 bg-black/[0.03] rounded-xl p-3">
                      <li>Go to <span className="font-medium">takeout.google.com</span>, click “Deselect all”, then tick <span className="font-medium">Maps (your places)</span>.</li>
                      <li>Click “Next step” → “Create export”. Google emails you a .zip in a few minutes.</li>
                      <li>Drop that .zip here (or any single list .csv inside it). Starred places are in <span className="font-medium">Saved Places.json</span>.</li>
                      <li>Shortcut: in the Google Maps app, open a list → Share → copy link and paste it above. This reads Google’s public page and can miss items.</li>
                    </ol>
                  )}
                </>
              ) : (
                <>
                  {/* Preview */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-black/75">{preview.list_name ?? "Your list"}</p>
                      <p className="text-[11px] text-black/40">
                        {preview.items.length} places · {preview.items.filter((i) => i.resolved).length} matched to Google Places
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={() => setChecked(preview.items.map(() => true))} className="text-blue hover:underline">All</button>
                      <button onClick={() => setChecked(preview.items.map(() => false))} className="text-black/40 hover:underline">None</button>
                      <button onClick={() => { setPreview(null); setError(null); }} className="text-black/40 hover:underline">Change source</button>
                    </div>
                  </div>
                  {preview.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-amber-700/80 bg-amber-400/10 rounded-lg px-3 py-2 flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
                  <div className="rounded-xl border border-black/8 divide-y divide-black/5 max-h-64 overflow-y-auto bg-white/50">
                    {preview.items.map((it, i) => (
                      <label key={`${it.name}-${i}`} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/80">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5"
                          checked={checked[i] ?? false}
                          onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-black/75 truncate">{it.name}</p>
                          <p className="text-[10px] text-black/40 truncate">{it.address ?? (it.lat != null ? `${it.lat.toFixed(4)}, ${it.lng?.toFixed(4)}` : "No address")}</p>
                        </div>
                        {it.category && <span className="text-[10px] text-black/40 capitalize shrink-0">{it.category}</span>}
                        <span
                          className={`text-[9px] uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0 ${
                            it.resolved ? "text-green-700 bg-green-500/10" : "text-black/40 bg-black/[0.05]"
                          }`}
                          title={it.resolved ? "Matched to a Google Place" : "Name only — you can fix the address later"}
                        >
                          {it.resolved ? "matched" : "name only"}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Destination */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-black/60">Where should these go?</p>
                    <div className="flex flex-wrap gap-2">
                      {(["bucket", "trip", "new"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setDestKind(k)}
                          className={`rounded-full px-3 py-1 text-xs border transition ${
                            destKind === k ? "border-blue/50 bg-blue/[0.08] text-blue" : "border-black/10 text-black/50 hover:bg-black/5"
                          }`}
                        >
                          {k === "bucket" ? "Bucket list" : k === "trip" ? "Existing trip" : "New trip"}
                        </button>
                      ))}
                    </div>
                    {destKind === "trip" && (
                      <select
                        className="glass-input w-full rounded-xl px-3 py-2 text-xs text-black/80"
                        style={{ colorScheme: "light" }}
                        value={destTripId}
                        onChange={(e) => setDestTripId(e.target.value)}
                      >
                        <option value="">Choose a trip…</option>
                        {trips.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.destination}</option>)}
                      </select>
                    )}
                    {destKind === "new" && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="glass-input rounded-xl px-3 py-2 text-xs text-black/80 placeholder:text-black/30 col-span-2"
                          value={newTrip.name}
                          onChange={(e) => setNewTrip((n) => ({ ...n, name: e.target.value }))}
                          placeholder="Trip name"
                        />
                        <div className="relative col-span-2">
                          <MapPin className="h-3.5 w-3.5 text-black/30 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            className="glass-input w-full rounded-xl pl-8 pr-3 py-2 text-xs text-black/80 placeholder:text-black/30"
                            value={newTrip.destination}
                            onChange={(e) => setNewTrip((n) => ({ ...n, destination: e.target.value }))}
                            placeholder="Destination, e.g. Tokyo, Japan"
                          />
                        </div>
                        <input type="date" className="glass-input rounded-xl px-3 py-2 text-xs text-black/80" value={newTrip.start_date}
                          onChange={(e) => setNewTrip((n) => ({ ...n, start_date: e.target.value, end_date: n.end_date < e.target.value ? e.target.value : n.end_date }))} />
                        <input type="date" className="glass-input rounded-xl px-3 py-2 text-xs text-black/80" value={newTrip.end_date} min={newTrip.start_date}
                          onChange={(e) => setNewTrip((n) => ({ ...n, end_date: e.target.value }))} />
                      </div>
                    )}
                  </div>
                </>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-black/8">
              {done ? (
                <button onClick={onClose} className="rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-sm font-semibold text-white transition">Done</button>
              ) : preview ? (
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  className="rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import {selectedCount} {selectedCount === 1 ? "place" : "places"}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
