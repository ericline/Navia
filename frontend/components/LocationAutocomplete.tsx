"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2 } from "lucide-react";

type Suggestion = {
  id: string;
  place_name: string;
  text: string;
  place_type: string[];
};

const TYPE_LABELS: Record<string, string> = {
  place: "City",
  locality: "Town",
  region: "Province",
  country: "Country",
  district: "Region",
  poi: "Landmark",
  address: "Address",
  neighborhood: "Neighborhood",
};

/** Default: administrative places + landmarks (home page / bucket list) */
export const PLACE_TYPES = "place,locality,region,country,district,poi";

/** Extended: adds street addresses + neighborhoods (activity address field) */
export const ADDRESS_TYPES = "poi,address,place,locality,neighborhood";

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Search location…",
  className = "",
  containerClassName = "",
  icon,
  types = PLACE_TYPES,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  /** Applied to the outer wrapper div — use for flex sizing (e.g. "flex-1") */
  containerClassName?: string;
  /** Optional icon rendered on the left side of the input */
  icon?: React.ReactNode;
  /** Mapbox feature types to search. Defaults to PLACE_TYPES. Use ADDRESS_TYPES for activity address fields. */
  types?: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Portal requires DOM — mark mounted after hydration
  useEffect(() => { setMounted(true); }, []);

  // Sync if parent clears the value externally
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click — must exclude both the input container AND the portal dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const outsideContainer =
        containerRef.current && !containerRef.current.contains(target);
      const outsideDropdown =
        dropdownRef.current && !dropdownRef.current.contains(target);
      if (outsideContainer && outsideDropdown) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close (and avoid stale position) when user scrolls or resizes
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function computeDropdownPosition() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 9999,
    });
  }

  const search = useCallback(
    async (q: string) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token || q.trim().length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const url = new URL(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
        );
        url.searchParams.set("types", types);
        url.searchParams.set("limit", "8");
        url.searchParams.set("language", "en");
        url.searchParams.set("access_token", token);
        const res = await fetch(url.toString());
        const data = await res.json();
        setSuggestions(data.features ?? []);
        computeDropdownPosition();
        setOpen(true);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [types]
  );

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  }

  function select(s: Suggestion) {
    setQuery(s.place_name);
    onChange(s.place_name);
    setSuggestions([]);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const dropdown = (
    <ul
      ref={dropdownRef}
      style={dropdownStyle}
      className="rounded-xl bg-warmSurface border border-black/8 shadow-xl overflow-hidden"
    >
      {suggestions.map((s, i) => (
        <li key={s.id}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              select(s);
            }}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition ${
              i === activeIdx ? "bg-blue/10" : "hover:bg-black/4"
            }`}
          >
            <MapPin className="h-3 w-3 text-pink/70 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-black/80 truncate">{s.text}</div>
              <div className="text-[11px] text-black/40 truncate">
                {s.place_name}
              </div>
            </div>
            <span className="ml-auto text-[10px] text-blue/60 shrink-0 bg-blue/8 px-1.5 py-0.5 rounded-full">
              {TYPE_LABELS[s.place_type?.[0]] ?? s.place_type?.[0]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          {icon}
        </span>
      )}
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/30 animate-spin z-10" />
      )}
      <input
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            computeDropdownPosition();
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />

      {/* Render via portal so no parent overflow:hidden can clip the dropdown */}
      {mounted && open && suggestions.length > 0
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
