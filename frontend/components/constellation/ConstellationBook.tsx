/** ConstellationBook - Paginated gallery of trip constellation visualizations with book animation. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Eye } from "lucide-react";
import { Trip, Day, Activity } from "@/lib/api";
import { formatDate, formatDestination } from "@/lib/utils";
import TripConstellation from "./TripConstellation";
import ConstellationRevealOverlay from "./ConstellationRevealOverlay";

interface ConstellationPage {
  trip: Trip;
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
}

interface ConstellationBookProps {
  pages: ConstellationPage[];
}

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
  const [direction, setDirection] = useState<1 | -1>(1);
  const [bookAnimating, setBookAnimating] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const reduce = useReducedMotion();

  const goTo = useCallback(
    (next: number, dir: 1 | -1) => {
      if (next < 0 || next >= pages.length) return;
      setDirection(dir);
      setCurrentIndex(next);
    },
    [pages.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (revealOpen) return;
      if (e.key === "ArrowLeft") goTo(currentIndex - 1, -1);
      else if (e.key === "ArrowRight") goTo(currentIndex + 1, 1);
      else if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, goTo, isOpen, revealOpen]);

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
          <rect x="12" y="8" width="40" height="48" rx="3" stroke="rgb(var(--blue))" strokeWidth="2" fill="none" />
          <line x1="32" y1="8" x2="32" y2="56" stroke="rgb(var(--blue))" strokeWidth="2" />
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

  // Cover
  if (!isOpen) {
    const rand = seededRandom(pages.length * 7 + 42);
    return (
      <div style={{ perspective: "1600px" }} className="relative">
        {/* Page edges peeking out from under the cover (gives stacked-pages feel) */}
        <div
          aria-hidden
          className="absolute -inset-x-1 -bottom-1 top-2 rounded-2xl -z-10"
          style={{
            background:
              "repeating-linear-gradient(180deg, #f6f1e8 0 2px, #e8dfcd 2px 3px)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
          }}
        />
        <button
          onClick={handleOpen}
          className={`w-full rounded-r-2xl rounded-l-md p-8 text-left relative overflow-hidden transition-transform duration-600 ${
            bookAnimating ? "book-open" : ""
          }`}
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgb(var(--blue)), rgb(var(--darkBlue)) 70%)",
            transformOrigin: "left center",
            boxShadow:
              "0 14px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12), inset -6px 0 14px -6px rgba(0,0,0,0.5), inset 6px 0 0 rgba(0,0,0,0.25)",
          }}
        >
          {/* Leather-grain noise */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.35) 1px, transparent 1px)",
              backgroundSize: "3px 3px, 5px 5px",
              backgroundPosition: "0 0, 1px 2px",
            }}
          />
          {/* Spine band with stitching */}
          <div
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-5 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.1) 60%, transparent)",
            }}
          />
          <div aria-hidden className="absolute left-2 top-0 bottom-0 flex flex-col justify-around py-6 pointer-events-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="block w-0.5 h-2 bg-white/20 rounded-full" />
            ))}
          </div>
          {/* Ribbon bookmark */}
          <div
            aria-hidden
            className="absolute right-8 -top-1 w-3 h-16 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgb(var(--pink)), rgb(var(--pink)/0.7))",
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
            }}
          />
          {/* Decorative stars */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" fill="none">
            {Array.from({ length: 14 }).map((_, i) => (
              <circle
                key={i}
                cx={`${rand() * 100}%`}
                cy={`${rand() * 100}%`}
                r={1 + rand() * 1.5}
                fill="white"
                fillOpacity={0.15 + rand() * 0.25}
              />
            ))}
          </svg>
          {/* Gilt embossed frame */}
          <div
            className="absolute inset-4 rounded-lg pointer-events-none"
            style={{
              border: "1px solid rgba(255,220,160,0.35)",
              boxShadow: "inset 0 0 0 3px rgba(255,220,160,0.08)",
            }}
          />
          <div className="relative pl-4">
            <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "rgba(255,220,160,0.7)" }}>
              A collection of
            </p>
            <h3
              className="text-2xl font-semibold tracking-wide mt-1 font-serif"
              style={{
                color: "rgba(255,230,180,0.95)",
                textShadow: "0 1px 0 rgba(0,0,0,0.35)",
              }}
            >
              My Constellations
            </h3>
            <div
              aria-hidden
              className="mt-2 h-px w-24"
              style={{ background: "linear-gradient(90deg, rgba(255,220,160,0.6), transparent)" }}
            />
            <span className="inline-block mt-4 text-xs text-white/70 bg-white/10 rounded-full px-2.5 py-0.5 border border-white/10">
              {pages.length} {pages.length === 1 ? "trip" : "trips"}
            </span>
            <p className="mt-6 text-[11px] italic" style={{ color: "rgba(255,220,160,0.55)" }}>
              Tap to open
            </p>
          </div>
        </button>
      </div>
    );
  }

  // Open
  const page = pages[currentIndex];
  const sortedDays = page.days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pageVariants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (dir: 1 | -1) => ({
          opacity: 0,
          x: dir > 0 ? 40 : -40,
          rotateY: dir > 0 ? 12 : -12,
        }),
        center: { opacity: 1, x: 0, rotateY: 0 },
        exit: (dir: 1 | -1) => ({
          opacity: 0,
          x: dir > 0 ? -40 : 40,
          rotateY: dir > 0 ? -12 : 12,
        }),
      };

  return (
    <div
      className={`relative rounded-r-2xl rounded-l-md overflow-hidden ${bookAnimating ? "book-content-fade-in" : ""}`}
      style={{
        background:
          "linear-gradient(135deg, rgb(var(--warmSurface)), #fefcf9)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow:
          "0 18px 40px rgba(0,0,0,0.18), 0 2px 0 rgba(255,255,255,0.6) inset",
        perspective: "1600px",
      }}
    >
      {/* Stacked page edges under the book */}
      <div
        aria-hidden
        className="absolute -inset-x-1 -bottom-1 top-2 rounded-2xl -z-10"
        style={{
          background:
            "repeating-linear-gradient(180deg, #f6f1e8 0 2px, #e8dfcd 2px 3px)",
        }}
      />
      {/* Paper grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(120,90,50,0.08) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
        }}
      />
      {/* Spine binding */}
      <div
        className="absolute left-0 top-0 bottom-0 w-5 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgb(var(--darkBlue)) 0%, rgb(var(--blue)) 40%, rgba(0,0,0,0.25) 75%, transparent)",
          boxShadow: "inset -2px 0 6px rgba(0,0,0,0.35)",
        }}
      />
      {/* Stitching on spine */}
      <div aria-hidden className="absolute left-[7px] top-0 bottom-0 flex flex-col justify-around py-6 pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="block w-0.5 h-2 bg-white/35 rounded-full" />
        ))}
      </div>
      {/* Center gutter shadow (creates the two-page feel) */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.18), transparent 70%)",
        }}
      />
      {/* Right-edge deckle shadow */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-2 pointer-events-none"
        style={{ background: "linear-gradient(270deg, rgba(0,0,0,0.08), transparent)" }}
      />

      <button
        onClick={handleClose}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-black/5 transition"
      >
        <X className="h-4 w-4 text-black/40" />
      </button>

      <div className="pl-8 pr-5 py-6">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => goTo(currentIndex - 1, -1)}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl hover:bg-black/[0.06] transition disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5 text-black/50" />
            </button>

            <div
              className="flex-1 min-w-0 overflow-hidden"
              style={{ transformStyle: "preserve-3d" }}
            >
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={
                    reduce
                      ? { duration: 0.15 }
                      : { type: "spring", stiffness: 260, damping: 28 }
                  }
                  style={{ transformOrigin: direction > 0 ? "left center" : "right center" }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center"
                >
                  {/* Left page — title & metadata */}
                  <div className="md:pr-4 md:border-r md:border-black/10 text-center md:text-left">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
                      Chapter {currentIndex + 1}
                    </p>
                    <h3 className="text-lg font-semibold text-black/80 mt-1 font-serif leading-tight">
                      {page.trip.name}
                    </h3>
                    <div aria-hidden className="mt-2 h-px w-12 bg-black/15 mx-auto md:mx-0" />
                    <p className="text-[11px] text-black/50 mt-2 italic font-serif">
                      {formatDestination(page.trip.destination)}
                    </p>
                    <p className="text-[10px] text-black/40 mt-0.5">
                      {formatDate(page.trip.start_date)} — {formatDate(page.trip.end_date)}
                    </p>
                    <p className="text-[10px] text-black/30 mt-3 italic hidden md:block">
                      Tap the constellation to replay the reveal.
                    </p>
                  </div>
                  {/* Right page — constellation */}
                  <div className="md:pl-4">
                    <button
                      type="button"
                      onClick={() => setRevealOpen(true)}
                      className="group block w-full relative rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
                      title="View full reveal"
                    >
                      <TripConstellation
                        tripId={page.trip.id}
                        tripName={page.trip.name}
                        days={sortedDays}
                        activitiesByDay={page.activitiesByDay}
                        destination={page.trip.destination}
                      />
                      <span className="pointer-events-none absolute inset-0 rounded-xl flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition">
                        <span className="inline-flex items-center gap-1 text-[10px] text-white font-medium bg-black/55 px-2 py-0.5 rounded-full backdrop-blur-sm">
                          <Eye className="h-3 w-3" />
                          View reveal
                        </span>
                      </span>
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              onClick={() => goTo(currentIndex + 1, 1)}
              disabled={currentIndex === pages.length - 1}
              className="p-2 rounded-xl hover:bg-black/[0.06] transition disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5 text-black/50" />
            </button>
          </div>

          <p className="text-[10px] text-black/30 mt-3 font-serif italic">
            {currentIndex + 1} / {pages.length}
          </p>
        </div>
      </div>

      {revealOpen && (
        <ConstellationRevealOverlay
          tripId={page.trip.id}
          tripName={page.trip.name}
          days={sortedDays}
          activitiesByDay={page.activitiesByDay}
          destination={page.trip.destination}
          onClose={() => setRevealOpen(false)}
        />
      )}
    </div>
  );
}
