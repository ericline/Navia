"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Trip, Day, Activity } from "@/lib/api";
import { formatDate, formatDestination } from "@/lib/utils";
import TripConstellation from "./TripConstellation";

interface ConstellationPage {
  trip: Trip;
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
}

interface ConstellationBookProps {
  pages: ConstellationPage[];
}

/* Seeded random for decorative cover stars */
function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function ConstellationBook({ pages }: ConstellationBookProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);
  const [bookAnimating, setBookAnimating] = useState(false);

  const goTo = useCallback(
    (next: number, dir: "left" | "right") => {
      if (next < 0 || next >= pages.length || animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrentIndex(next);
        setAnimating(false);
      }, 300);
    },
    [pages.length, animating]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(currentIndex - 1, "left");
      else if (e.key === "ArrowRight") goTo(currentIndex + 1, "right");
      else if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, goTo, isOpen]);

  function handleOpen() {
    if (pages.length === 0) return;
    setBookAnimating(true);
    setIsOpen(true);
    setTimeout(() => setBookAnimating(false), 600);
  }

  function handleClose() {
    setBookAnimating(true);
    setTimeout(() => {
      setIsOpen(false);
      setBookAnimating(false);
    }, 500);
  }

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          className="mb-4 opacity-30"
        >
          <rect
            x="12"
            y="8"
            width="40"
            height="48"
            rx="3"
            stroke="rgb(var(--blue))"
            strokeWidth="2"
            fill="none"
          />
          <line
            x1="32"
            y1="8"
            x2="32"
            y2="56"
            stroke="rgb(var(--blue))"
            strokeWidth="2"
          />
          <circle cx="24" cy="22" r="1.5" fill="rgb(var(--lightBlue))" />
          <circle cx="40" cy="18" r="1" fill="rgb(var(--lightBlue))" />
          <circle cx="22" cy="38" r="1" fill="rgb(var(--lightBlue))" />
          <circle cx="42" cy="34" r="1.5" fill="rgb(var(--lightBlue))" />
          <circle cx="36" cy="44" r="1" fill="rgb(var(--lightBlue))" />
        </svg>
        <p className="text-xs text-black/35">
          Complete your first trip to start your collection
        </p>
      </div>
    );
  }

  // Cover state
  if (!isOpen) {
    const rand = seededRandom(pages.length * 7 + 42);
    return (
      <div style={{ perspective: "1200px" }}>
        <button
          onClick={handleOpen}
          className={`w-full rounded-2xl p-8 text-left relative overflow-hidden transition-transform duration-600 ${
            bookAnimating ? "book-open" : ""
          }`}
          style={{
            background: "linear-gradient(135deg, rgb(var(--darkBlue)), rgb(var(--blue)))",
            transformOrigin: "left center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Decorative stars */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none">
            {Array.from({ length: 8 }).map((_, i) => (
              <circle
                key={i}
                cx={`${rand() * 100}%`}
                cy={`${rand() * 100}%`}
                r={1 + rand() * 1.5}
                fill="white"
                fillOpacity={0.15 + rand() * 0.15}
              />
            ))}
          </svg>
          <div className="relative">
            <h3 className="text-lg font-semibold text-white/90 tracking-wide">
              My Constellations
            </h3>
            <span className="inline-block mt-2 text-xs text-white/50 bg-white/10 rounded-full px-2.5 py-0.5">
              {pages.length} {pages.length === 1 ? "trip" : "trips"}
            </span>
            <p className="mt-6 text-[11px] text-white/30">
              Tap to open
            </p>
          </div>
        </button>
      </div>
    );
  }

  // Open state
  const page = pages[currentIndex];
  const sortedDays = page.days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${bookAnimating ? "book-content-fade-in" : ""}`}
      style={{
        background: "linear-gradient(135deg, rgb(var(--warmSurface)), white)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Spine */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl"
        style={{
          background: "linear-gradient(180deg, rgb(var(--darkBlue)), rgb(var(--blue)))",
        }}
      />

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-black/5 transition"
      >
        <X className="h-4 w-4 text-black/40" />
      </button>

      <div className="pl-5 pr-3 py-5">
        <div className="flex flex-col items-center">
          {/* Navigation row */}
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={() => goTo(currentIndex - 1, "left")}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl hover:bg-black/[0.06] transition disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 text-black/50" />
            </button>

            <div className="flex-1 min-w-0 overflow-hidden">
              <div
                className="transition-all duration-300 ease-out"
                style={{
                  opacity: animating ? 0 : 1,
                  transform: animating
                    ? `translateX(${direction === "right" ? "-20px" : "20px"})`
                    : "translateX(0)",
                }}
              >
                {/* Title */}
                <h3 className="text-sm font-semibold text-black/75 text-center truncate">
                  {page.trip.name}
                </h3>
                <p className="text-[11px] text-black/40 text-center mt-0.5">
                  {formatDestination(page.trip.destination)} · {formatDate(page.trip.start_date)} —{" "}
                  {formatDate(page.trip.end_date)}
                </p>

                {/* Constellation */}
                <div className="mt-3 max-w-md mx-auto">
                  <TripConstellation
                    tripId={page.trip.id}
                    tripName={page.trip.name}
                    days={sortedDays}
                    activitiesByDay={page.activitiesByDay}
                    destination={page.trip.destination}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => goTo(currentIndex + 1, "right")}
              disabled={currentIndex === pages.length - 1}
              className="p-2 rounded-xl hover:bg-black/[0.06] transition disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5 text-black/50" />
            </button>
          </div>

          {/* Page indicator */}
          <p className="text-[10px] text-black/30 mt-3">
            {currentIndex + 1} / {pages.length}
          </p>
        </div>
      </div>
    </div>
  );
}
