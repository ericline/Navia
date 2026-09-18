/** SourceBadge — tiny provenance chip (TikTok / Instagram / Google Maps) linking back to the original post. */
"use client";

import type { SourcePlatform } from "@/lib/types";

const LABEL: Record<Exclude<SourcePlatform, "manual">, { text: string; cls: string }> = {
  tiktok: { text: "TikTok", cls: "text-black/70 bg-black/[0.07]" },
  instagram: { text: "IG", cls: "text-pink bg-pink/[0.12]" },
  google_maps: { text: "Maps", cls: "text-green-700 bg-green-500/10" },
};

export default function SourceBadge({
  platform,
  url,
  className = "",
}: {
  platform?: SourcePlatform | null;
  url?: string | null;
  className?: string;
}) {
  if (!platform || platform === "manual") return null;
  const { text, cls } = LABEL[platform];
  const chip = (
    <span className={`inline-flex items-center text-[9px] font-medium uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0 ${cls} ${className}`}>
      {text}
    </span>
  );
  if (!url) return chip;
  return (
    <a href={url} target="_blank" rel="noreferrer" title={`Open on ${text}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
      {chip}
    </a>
  );
}
