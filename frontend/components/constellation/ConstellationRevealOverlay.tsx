/**
 * ConstellationRevealOverlay - Full-screen reveal of a trip's constellation
 * with share-image and copy-link actions. Extracted from the trip-detail
 * page so the profile book can replay reveals.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2, X } from "lucide-react";
import type { Day, Activity } from "@/lib/api";
import TripConstellation from "./TripConstellation";

interface Props {
  tripId: number;
  tripName: string;
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
  destination?: string;
  onClose: () => void;
  onDayClick?: (dayId: number) => void;
  subtitle?: string;
}

const COLOR_MAP: Record<string, string> = {
  "rgb(var(--blue))": "rgb(75,134,180)",
  "rgb(var(--lightBlue))": "rgb(149,184,209)",
  "rgb(var(--darkBlue))": "rgb(43,65,98)",
  "rgb(var(--pink))": "rgb(184,107,119)",
};

export default function ConstellationRevealOverlay({
  tripId,
  tripName,
  days,
  activitiesByDay,
  destination,
  onClose,
  onDayClick,
  subtitle = "Your constellation",
}: Props) {
  const [revealDone, setRevealDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShareImage = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const svgEl = document.querySelector<SVGSVGElement>(
        ".constellation-reveal-overlay svg"
      );
      if (!svgEl) return;

      const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
      let svgString = new XMLSerializer().serializeToString(svgClone);

      for (const [cssVar, resolved] of Object.entries(COLOR_MAP)) {
        svgString = svgString.replaceAll(cssVar, resolved);
      }

      const viewBox = svgEl.getAttribute("viewBox")?.split(" ").map(Number) ?? [
        0, 0, 500, 300,
      ];
      const padding = 40;
      const canvasW = viewBox[2] + padding * 2;
      const canvasH = viewBox[3] + padding * 2;

      const canvas = document.createElement("canvas");
      canvas.width = canvasW * 2;
      canvas.height = canvasH * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);

      ctx.fillStyle = "rgb(250, 248, 246)";
      ctx.fillRect(0, 0, canvasW, canvasH);

      const img = new Image();
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, padding, padding, viewBox[2], viewBox[3]);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tripName, canvasW / 2, canvasH - 12);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) return;
        const file = new File([pngBlob], `${tripName}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
          } catch {}
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(pngBlob);
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }, "image/png");
    },
    [tripName]
  );

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const liveUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/constellation/${tripId}`
        : `/constellation/${tripId}`;
    await navigator.clipboard.writeText(liveUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-warmBg constellation-reveal-overlay cursor-pointer"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 p-2 rounded-xl bg-black/5 hover:bg-black/10 text-black/60 transition z-10"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-sm text-black/40 mb-2 tracking-wide uppercase constellation-reveal-title">
        {subtitle}
      </p>
      <h2 className="text-2xl font-bold text-black/80 mb-6 constellation-reveal-title">
        {tripName}
      </h2>
      <div className="w-full max-w-2xl px-8">
        <TripConstellation
          tripId={tripId}
          tripName={tripName}
          days={days}
          activitiesByDay={activitiesByDay}
          destination={destination}
          size="reveal"
          revealAnimation
          onRevealComplete={() => setRevealDone(true)}
          onDayClick={onDayClick}
        />
      </div>
      <div
        className="mt-4 flex flex-col items-center gap-3 transition-opacity duration-500"
        style={{ opacity: revealDone ? 1 : 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareImage}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue/90 hover:bg-blue text-xs font-semibold text-white transition"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Image
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/[0.06] hover:bg-black/[0.10] text-xs text-black/50 transition"
          >
            {linkCopied ? "Link copied!" : "Copy Link"}
          </button>
        </div>
        <p className="text-[11px] text-black/25">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
