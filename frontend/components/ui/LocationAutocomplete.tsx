/** LocationAutocomplete - Mapbox Search Box-powered location input with debounced suggestions and POI type filtering. */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2 } from "lucide-react";
import { formatDestination } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Geocoding v5 types (cities, regions — used on home page)           */
/* ------------------------------------------------------------------ */

type GeocodeSuggestion = {
  id: string;
  place_name: string;
  text: string;
  place_type: string[];
  geometry?: { type: string; coordinates: [number, number] };
};

/* ------------------------------------------------------------------ */
/*  Search Box API types (POIs, restaurants, landmarks — activities)    */
/* ------------------------------------------------------------------ */

type SearchBoxSuggestion = {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  feature_type: string;
  poi_category?: string[];
};

/* ------------------------------------------------------------------ */
/*  Unified suggestion used internally                                  */
/* ------------------------------------------------------------------ */

type UnifiedSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  label: string;
  /** Set immediately for geocode results; set after retrieve for search box */
  coordinates?: [number, number];
  /** For search box results that need a retrieve call */
  mapboxId?: string;
  /** Raw POI categories from Mapbox (for auto-categorization) */
  poiCategories?: string[];
};

const GEOCODE_TYPE_LABELS: Record<string, string> = {
  place: "City",
  locality: "Town",
  region: "Province",
  country: "Country",
  district: "Region",
  poi: "Landmark",
  address: "Address",
  neighborhood: "Neighborhood",
};

const POI_CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bar: "Bar",
  hotel: "Hotel",
  museum: "Museum",
  park: "Park",
  monument: "Monument",
  landmark: "Landmark",
  tourist_attraction: "Attraction",
  store: "Store",
  shopping: "Shopping",
  airport: "Airport",
  bus_station: "Transit",
  train_station: "Transit",
  temple: "Temple",
  church: "Church",
  mosque: "Mosque",
  beach: "Beach",
  theater: "Theater",
  cinema: "Cinema",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
  bank: "Bank",
  gas_station: "Gas Station",
  gym: "Gym",
  spa: "Spa",
  nightclub: "Nightclub",
  food: "Food",
  bakery: "Bakery",
  food_and_drink: "Food & Drink",
};

function poiLabel(categories?: string[]): string {
  if (!categories || categories.length === 0) return "Place";
  for (const cat of categories) {
    const normalized = cat.toLowerCase().replace(/\s+/g, "_");
    if (POI_CATEGORY_LABELS[normalized]) return POI_CATEGORY_LABELS[normalized];
  }
  // Capitalize the first category as fallback
  return categories[0].charAt(0).toUpperCase() + categories[0].slice(1);
}

function searchBoxTypeLabel(s: SearchBoxSuggestion): string {
  if (s.feature_type === "poi") return poiLabel(s.poi_category);
  return GEOCODE_TYPE_LABELS[s.feature_type] ?? "Place";
}

/** Default: administrative places + landmarks (home page / bucket list) */
export const PLACE_TYPES = "place,locality,region,country,district,poi";

/** Activity address field — uses Search Box API for full POI coverage */
export const ADDRESS_TYPES = "searchbox";

export default function LocationAutocomplete({
  value,
  onChange,
  onCoordinates,
  onCategory,
  placeholder = "Search location…",
  className = "",
  containerClassName = "",
  icon,
  types = PLACE_TYPES,
}: {
  value: string;
  onChange: (val: string) => void;
  /** Called with [lng, lat] when a suggestion with coordinates is selected */
  onCoordinates?: (coords: [number, number]) => void;
  /** Called with the best POI category string when a search box suggestion is selected */
  onCategory?: (category: string) => void;
  placeholder?: string;
  className?: string;
  /** Applied to the outer wrapper div — use for flex sizing (e.g. "flex-1") */
  containerClassName?: string;
  /** Optional icon rendered on the left side of the input */
  icon?: React.ReactNode;
  /** Mapbox feature types to search. Defaults to PLACE_TYPES. Use ADDRESS_TYPES for activity address fields. */
  types?: string;
}) {
  const useSearchBox = types === "searchbox";

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<UnifiedSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

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

  /* ---- Search Box API (for activity addresses) ---- */

  const searchBoxSuggest = useCallback(async (q: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
      url.searchParams.set("q", q);
      url.searchParams.set("language", "en");
      url.searchParams.set("limit", "8");
      url.searchParams.set("session_token", sessionTokenRef.current);
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      const data = await res.json();
      const items: SearchBoxSuggestion[] = data.suggestions ?? [];
      setSuggestions(
        items.map((s) => ({
          id: s.mapbox_id,
          title: s.name,
          subtitle: formatDestination(s.full_address || s.place_formatted || ""),
          label: searchBoxTypeLabel(s),
          mapboxId: s.mapbox_id,
          poiCategories: s.poi_category,
        }))
      );
      computeDropdownPosition();
      setOpen(true);
      setActiveIdx(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function searchBoxRetrieve(mapboxId: string): Promise<[number, number] | null> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return null;
    try {
      const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}`);
      url.searchParams.set("session_token", sessionTokenRef.current);
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      const data = await res.json();
      const coords = data.features?.[0]?.geometry?.coordinates;
      // Rotate session token after a retrieve completes a search cycle
      sessionTokenRef.current = crypto.randomUUID();
      return coords ?? null;
    } catch {
      return null;
    }
  }

  /* ---- Geocoding v5 (for home page / place search) ---- */

  const geocodeSearch = useCallback(
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
        const features: GeocodeSuggestion[] = data.features ?? [];
        setSuggestions(
          features.map((s) => ({
            id: s.id,
            title: s.text,
            subtitle: formatDestination(s.place_name),
            label: GEOCODE_TYPE_LABELS[s.place_type?.[0]] ?? s.place_type?.[0],
            coordinates: s.geometry?.coordinates,
          }))
        );
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

  /* ---- Shared handlers ---- */

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => (useSearchBox ? searchBoxSuggest(q) : geocodeSearch(q)),
      300
    );
  }

  async function select(s: UnifiedSuggestion) {
    const displayText = formatDestination(s.subtitle || s.title);
    setQuery(displayText);
    onChange(displayText);

    // Pass POI category for auto-categorization
    if (s.poiCategories && s.poiCategories.length > 0) {
      onCategory?.(s.poiCategories[0]);
    }

    if (s.coordinates) {
      onCoordinates?.(s.coordinates);
    } else if (s.mapboxId) {
      // Retrieve full details for Search Box suggestions
      const coords = await searchBoxRetrieve(s.mapboxId);
      if (coords) onCoordinates?.(coords);
    }

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
              <div className="text-sm text-black/80 truncate">{s.title}</div>
              <div className="text-[11px] text-black/40 truncate">
                {s.subtitle}
              </div>
            </div>
            <span className="ml-auto text-[10px] text-blue/60 shrink-0 bg-blue/8 px-1.5 py-0.5 rounded-full">
              {s.label}
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
