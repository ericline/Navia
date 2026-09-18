/**
 * ExportMenu — "Export" button with KML (Google My Maps) / CSV options and a
 * post-download explainer, since Google has no API to write saved lists.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X, ChevronDown } from "lucide-react";
import { ExportFormat, ExportScope, exportGoogleMaps } from "@/lib/api";
import { downloadTextFile } from "@/lib/download";

interface Props {
  scope: ExportScope;
  className?: string;
  compact?: boolean;
}

export default function ExportMenu({ scope, className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function run(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      const { text, filename, contentType } = await exportGoogleMaps(scope, format);
      downloadTextFile(text, filename, contentType || (format === "kml" ? "application/vnd.google-earth.kml+xml" : "text/csv"));
      setOpen(false);
      if (format === "kml") setShowHelp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          compact
            ? "rounded-lg p-1.5 text-black/35 hover:text-blue hover:bg-blue/[0.08] transition"
            : "flex items-center gap-1.5 rounded-xl border border-black/10 hover:bg-black/5 px-3 py-1.5 text-xs text-black/50 transition"
        }
        title="Export to Google Maps"
      >
        <Download className="h-3.5 w-3.5" />
        {!compact && <>Export <ChevronDown className="h-3 w-3" /></>}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-40 w-56 rounded-xl border border-black/10 bg-warmBg shadow-xl p-1 text-xs">
          <button onClick={() => run("kml")} disabled={!!busy} className="w-full text-left rounded-lg px-3 py-2 hover:bg-black/5 text-black/70 flex items-center gap-2">
            {busy === "kml" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 text-black/40" />}
            <span>KML <span className="text-black/40">· for Google My Maps</span></span>
          </button>
          <button onClick={() => run("csv")} disabled={!!busy} className="w-full text-left rounded-lg px-3 py-2 hover:bg-black/5 text-black/70 flex items-center gap-2">
            {busy === "csv" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 text-black/40" />}
            <span>CSV <span className="text-black/40">· spreadsheet</span></span>
          </button>
          {error && <p className="px-3 py-1 text-red-500">{error}</p>}
        </div>
      )}

      {mounted && showHelp && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="glass bg-warmSurface rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-black/80">Your KML downloaded — put it in Google Maps</h3>
              <button onClick={() => setShowHelp(false)} className="p-1 rounded-lg hover:bg-black/5 text-black/40"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[11px] text-black/45">Google doesn’t let apps write to your saved lists directly, so it takes one import on your side:</p>
            <ol className="text-xs text-black/65 space-y-1.5 list-decimal pl-5">
              <li>Open <a href="https://www.google.com/maps/d/" target="_blank" rel="noreferrer" className="text-blue underline">Google My Maps</a> and click <span className="font-medium">Create a new map</span>.</li>
              <li>Click <span className="font-medium">Import</span> under the first layer and choose the .kml file you just downloaded.</li>
              <li>Name the map. It now shows in the Google Maps app under <span className="font-medium">Saved → Maps</span>, with every pin.</li>
            </ol>
            <p className="text-[11px] text-black/40">Tip: each place also has an “Open in Google Maps” link inside Navia if you just want to save one spot the normal way.</p>
            <button onClick={() => setShowHelp(false)} className="w-full rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-sm font-semibold text-white transition">Got it</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
