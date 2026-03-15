"use client";

import { useEffect, useState } from "react";
import { Day, Activity } from "@/lib/api";
import { getTodayStr } from "@/lib/utils";

interface TripConstellationProps {
  tripId: number;
  tripName: string;
  days: Day[];
  activitiesByDay?: Record<number, Activity[]>;
  /** When true, stars and lines draw in one-by-one with a staggered animation */
  revealAnimation?: boolean;
  /** Compact mode for card previews */
  compact?: boolean;
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
  compact = false,
}: TripConstellationProps) {
  const [revealStep, setRevealStep] = useState(revealAnimation ? 0 : Infinity);

  // Staggered reveal: increment step every 150ms
  useEffect(() => {
    if (!revealAnimation) return;
    const total = days.length * 2; // stars + lines
    if (revealStep >= total) return;

    const timer = setTimeout(() => setRevealStep((s) => s + 1), 150);
    return () => clearTimeout(timer);
  }, [revealAnimation, revealStep, days.length]);

  if (days.length === 0) return null;

  const todayStr = getTodayStr();
  const sortedDays = days
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const svgWidth = compact ? 200 : 400;
  const svgHeight = compact ? 50 : 80;

  const positions = generateTripConstellation(
    sortedDays.length,
    tripId,
    svgWidth,
    svgHeight
  );

  const nodes = sortedDays.map((day, i) => {
    const acts = activitiesByDay[day.id] ?? [];
    const actCount = acts.length;
    const baseR = compact ? 2.5 : 3.5;
    const radius = Math.min(baseR + actCount * (compact ? 0.8 : 1.5), compact ? 7 : 12);
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
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: `${svgHeight}px`, minHeight: `${svgHeight}px` }}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Faint background stars */}
        {!compact &&
          Array.from({ length: 8 }).map((_, i) => {
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

          let stroke = "rgb(var(--lightBlue))";
          let strokeWidth = compact ? 0.8 : 1.2;
          let strokeOpacity = 0.18;
          let dashArray = compact ? "3 3" : "5 5";
          let className = "";

          if (bothPastOrToday) {
            stroke = "rgb(var(--blue))";
            strokeWidth = compact ? 1.4 : 2;
            strokeOpacity = 0.6;
            dashArray = "none";
          } else if (isCurrentEdge) {
            stroke = "rgb(var(--blue))";
            strokeWidth = compact ? 1.2 : 1.8;
            strokeOpacity = 0.45;
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
              className={revealAnimation ? "constellation-reveal-star" : ""}
            >
              {/* Activity density glow */}
              {node.actCount > 0 && (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.glowR}
                  fill={
                    node.isToday || node.isPast
                      ? "rgb(var(--blue))"
                      : "rgb(var(--lightBlue))"
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
                    fill="rgb(var(--blue))"
                    fillOpacity="0.12"
                  />
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={node.radius + 4}
                    fill="none"
                    stroke="rgb(var(--blue))"
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
                    ? "rgb(var(--blue))"
                    : "rgb(var(--lightBlue))"
                }
                fillOpacity={node.isToday ? 1 : node.isPast ? 0.8 : 0.35}
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
      </svg>
    </div>
  );
}
