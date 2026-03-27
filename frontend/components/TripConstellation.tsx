"use client";

import { useEffect, useRef, useState } from "react";
import { Day, Activity } from "@/lib/api";
import { getTodayStr, getConstellationTheme } from "@/lib/utils";

type ConstellationSize = "compact" | "default" | "reveal";

const SIZE_CONFIG = {
  compact:  { width: 200, height: 50,  baseR: 2.5, maxR: 7,  bgStars: 0  },
  default:  { width: 400, height: 80,  baseR: 3.5, maxR: 12, bgStars: 8  },
  reveal:   { width: 500, height: 300, baseR: 5,   maxR: 16, bgStars: 15 },
} as const;

interface TripConstellationProps {
  tripId: number;
  tripName: string;
  days: Day[];
  activitiesByDay?: Record<number, Activity[]>;
  /** When true, stars and lines draw in one-by-one with a staggered animation */
  revealAnimation?: boolean;
  /** Display size */
  size?: ConstellationSize;
  /** Destination name — used to pick warm/cold color theme */
  destination?: string;
  /** Called once when reveal animation completes */
  onRevealComplete?: () => void;
  /** Called when a day star is clicked */
  onDayClick?: (dayId: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Seeded PRNG                                                        */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------------------------------------------------ */
/*  Procedural constellation — unique per trip                         */
/* ------------------------------------------------------------------ */

function generateTripConstellation(
  dayCount: number,
  tripId: number,
  width: number,
  height: number
): { x: number; y: number }[] {
  const rand = seededRandom(tripId * 7919 + dayCount * 131);
  const padding = 16;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < dayCount; i++) {
    const baseX = dayCount === 1 ? 0.5 : i / (dayCount - 1);
    // Sharp zigzag with tripId-based variation
    const phase = (tripId % 3) * 0.15;
    const zigzag = i % 2 === 0
      ? 0.15 + phase + rand() * 0.25
      : 0.6 - phase + rand() * 0.25;
    const jitterX = (rand() - 0.5) * (0.5 / Math.max(dayCount - 1, 1));

    points.push({
      x: padding + Math.max(0, Math.min(1, baseX + jitterX)) * usableW,
      y: padding + Math.min(Math.max(zigzag, 0.05), 0.95) * usableH,
    });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function TripConstellation({
  tripId,
  tripName,
  days,
  activitiesByDay = {},
  revealAnimation = false,
  size = "default",
  destination,
  onRevealComplete,
  onDayClick,
}: TripConstellationProps) {
  const compact = size === "compact";
  const cfg = SIZE_CONFIG[size];
  const [revealStep, setRevealStep] = useState(revealAnimation ? 0 : Infinity);
  const [showSparkles, setShowSparkles] = useState(false);
  const revealFiredRef = useRef(false);

  // Staggered reveal: increment step every 150ms
  useEffect(() => {
    if (!revealAnimation) return;
    const total = days.length * 2; // stars + lines
    if (revealStep >= total) {
      if (!revealFiredRef.current) {
        revealFiredRef.current = true;
        setShowSparkles(true);
        onRevealComplete?.();
      }
      return;
    }

    const timer = setTimeout(() => setRevealStep((s) => s + 1), 150);
    return () => clearTimeout(timer);
  }, [revealAnimation, revealStep, days.length, onRevealComplete]);

  // Color theme based on destination
  const theme = destination ? getConstellationTheme(destination) : null;
  const starColor = theme?.star ?? "rgb(var(--blue))";
  const starColorFuture = theme?.line ?? "rgb(var(--lightBlue))";
  const glowColor = theme?.glow ?? undefined;

  if (days.length === 0) return null;

  const todayStr = getTodayStr();
  const sortedDays = days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const svgWidth = cfg.width;
  const svgHeight = cfg.height;

  const positions = generateTripConstellation(
    sortedDays.length,
    tripId,
    svgWidth,
    svgHeight
  );

  const nodes = sortedDays.map((day, i) => {
    const acts = activitiesByDay[day.id] ?? [];
    const actCount = acts.length;
    const baseR = cfg.baseR;
    const radius = Math.min(baseR + actCount * (compact ? 0.8 : 1.5), cfg.maxR);
    const glowR = Math.min(radius + 4 + actCount * 1.5, compact ? 14 : 24);
    const glowOpacity = Math.min(0.06 + actCount * 0.03, 0.25);
    const isToday = day.date === todayStr;
    const isPast = day.date < todayStr;
    const visible = revealStep >= i; // stars appear at step i

    return {
      cx: positions[i].x,
      cy: positions[i].y,
      radius,
      glowR,
      glowOpacity,
      isToday,
      isPast,
      day,
      actCount,
      visible,
    };
  });

  // Label position
  const labelX = nodes.reduce((s, n) => s + n.cx, 0) / nodes.length;
  const minY = Math.min(...nodes.map((n) => n.cy));

  return (
    <div className="w-full">
      <svg
        viewBox={`-20 -20 ${svgWidth + 40} ${svgHeight + 40}`}
        className="w-full"
        style={size === "reveal" ? undefined : { height: `${svgHeight + 40}px`, minHeight: `${svgHeight + 40}px` }}
        fill="none"
        overflow="visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Faint background stars */}
        {cfg.bgStars > 0 &&
          Array.from({ length: cfg.bgStars }).map((_, i) => {
            const rand = seededRandom(tripId * 1000 + i + 3);
            return (
              <circle
                key={`bg-${i}`}
                cx={rand() * svgWidth}
                cy={rand() * svgHeight}
                r={0.5 + rand() * 0.4}
                fill="rgb(var(--lightBlue))"
                fillOpacity={0.1 + rand() * 0.1}
              />
            );
          })}

        {/* Label */}
        {!compact && (
          <text
            x={labelX}
            y={Math.max(minY - 8, 7)}
            textAnchor="middle"
            fontSize="7.5"
            fill="rgb(var(--lightBlue))"
            fillOpacity="0.3"
            letterSpacing="1.5"
            fontFamily="system-ui, sans-serif"
            style={{ textTransform: "uppercase" } as React.CSSProperties}
          >
            {tripName}
          </text>
        )}

        {/* Straight connection lines */}
        {nodes.map((node, i) => {
          if (i === 0) return null;
          const prev = nodes[i - 1];
          // Lines appear after both connected stars are visible
          const lineVisible = revealStep >= nodes.length + i - 1;
          if (!lineVisible && revealAnimation) return null;

          const bothPastOrToday =
            (prev.isPast || prev.isToday) && (node.isPast || node.isToday);
          const isCurrentEdge =
            (prev.isToday && !node.isPast && !node.isToday) ||
            (node.isToday && !prev.isPast && !prev.isToday);

          let stroke = starColorFuture;
          let strokeWidth = compact ? 1.0 : 1.2;
          let strokeOpacity = compact ? 0.35 : 0.25;
          let dashArray = compact ? "3 3" : "5 5";
          let className = "";

          if (bothPastOrToday) {
            stroke = starColor;
            strokeWidth = compact ? 1.8 : 2;
            strokeOpacity = compact ? 0.8 : 0.6;
            dashArray = "none";
          } else if (isCurrentEdge) {
            stroke = starColor;
            strokeWidth = compact ? 1.5 : 1.8;
            strokeOpacity = compact ? 0.6 : 0.45;
            dashArray = "none";
            className = "constellation-current-edge";
          }

          return (
            <line
              key={`line-${i}`}
              x1={prev.cx}
              y1={prev.cy}
              x2={node.cx}
              y2={node.cy}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className={`${className} ${revealAnimation ? "constellation-reveal-line" : ""}`}
            />
          );
        })}

        {/* Star nodes */}
        {nodes.map((node) => {
          if (!node.visible && revealAnimation) return null;

          return (
            <g
              key={node.day.id}
              className={`${revealAnimation ? "constellation-reveal-star" : ""} ${onDayClick ? "constellation-star-clickable" : ""}`}
              style={onDayClick ? { cursor: "pointer", transformOrigin: `${node.cx}px ${node.cy}px` } : undefined}
              onClick={onDayClick ? (e) => { e.stopPropagation(); onDayClick(node.day.id); } : undefined}
            >
              {/* Activity density glow */}
              {node.actCount > 0 && (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.glowR}
                  fill={
                    node.isToday || node.isPast
                      ? (glowColor ?? "rgb(var(--blue))")
                      : starColorFuture
                  }
                  fillOpacity={node.glowOpacity}
                />
              )}

              {/* Today pulse */}
              {node.isToday && !compact && (
                <>
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.radius + 4}
                    fill={starColor}
                    fillOpacity="0.12"
                  />
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.radius + 4}
                    fill="none"
                    stroke={starColor}
                    strokeWidth="1"
                  >
                    <animate
                      attributeName="r"
                      from={node.radius + 4}
                      to={node.radius + 18}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              {/* Star body */}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.radius}
                fill={
                  node.isToday || node.isPast
                    ? starColor
                    : starColorFuture
                }
                fillOpacity={node.isToday ? 1 : node.isPast ? (compact ? 0.9 : 0.8) : (compact ? 0.55 : 0.35)}
                className={node.isToday && !compact ? "constellation-star-today" : ""}
              />

              {/* Inner highlight */}
              {!compact && (
                <circle
                  cx={node.cx - node.radius * 0.2}
                  cy={node.cy - node.radius * 0.2}
                  r={node.radius * 0.3}
                  fill="white"
                  fillOpacity={node.isToday ? 0.55 : node.isPast ? 0.3 : 0.12}
                />
              )}
            </g>
          );
        })}

        {/* Sparkle effect on reveal completion */}
        {showSparkles && (() => {
          const sparkleRand = seededRandom(tripId * 3571);
          const sparkleCount = Math.min(6 + Math.floor(sparkleRand() * 5), 10);
          return Array.from({ length: sparkleCount }).map((_, si) => {
            const nodeIdx = Math.floor(sparkleRand() * nodes.length);
            const node = nodes[nodeIdx];
            const offX = (sparkleRand() - 0.5) * 30;
            const offY = (sparkleRand() - 0.5) * 20;
            return (
              <circle
                key={`sparkle-${si}`}
                cx={node.cx + offX}
                cy={node.cy + offY}
                r={1.2 + sparkleRand() * 1}
                fill="white"
                style={{
                  animation: `constellationSparkle 600ms ease-out ${si * 100}ms both`,
                  transformOrigin: `${node.cx + offX}px ${node.cy + offY}px`,
                }}
              />
            );
          });
        })()}
      </svg>
    </div>
  );
}
