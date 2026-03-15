"use client";

import { Day, Activity } from "@/lib/api";
import { getTodayStr } from "@/lib/utils";

interface ConstellationPathProps {
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
  weekOffset: number;
  visibleCount: number;
  tripName?: string;
}

/* ------------------------------------------------------------------ */
/*  Seeded PRNG — deterministic shapes per seed                        */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------------------------------------------------ */
/*  Procedural constellation generator                                 */
/*  Creates a unique shape for any star count, seeded by an ID so      */
/*  every trip/week gets its own recognizable pattern.                  */
/* ------------------------------------------------------------------ */

function generateConstellationPoints(
  count: number,
  seed: number,
  svgWidth: number,
  svgHeight: number
): { x: number; y: number }[] {
  const rand = seededRandom(seed * 7919 + count * 131);
  const padding = 28;
  const usableW = svgWidth - padding * 2;
  const usableH = svgHeight - padding * 2;

  const points: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    // Spread stars horizontally with some randomness
    const baseX = count === 1 ? 0.5 : i / (count - 1);
    // Create sharp vertical variation — alternate high/low with randomness
    const zigzag = i % 2 === 0 ? 0.2 + rand() * 0.25 : 0.55 + rand() * 0.3;
    // Add horizontal jitter so it doesn't look like a perfect grid
    const jitterX = (rand() - 0.5) * (0.6 / Math.max(count - 1, 1));

    points.push({
      x: padding + Math.max(0, Math.min(1, baseX + jitterX)) * usableW,
      y: padding + zigzag * usableH,
    });
  }

  return points;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function ConstellationPath({
  days,
  activitiesByDay,
  weekOffset,
  visibleCount,
  tripName,
}: ConstellationPathProps) {
  const visibleDays = days.slice(weekOffset, weekOffset + visibleCount);
  if (visibleDays.length === 0) return null;

  const todayStr = getTodayStr();
  const svgWidth = Math.max(visibleDays.length * 120, 400);
  const svgHeight = 90;
  const weekIndex = Math.floor(weekOffset / 7);

  const positions = generateConstellationPoints(
    visibleDays.length,
    weekIndex + (days[0]?.trip_id ?? 0) * 37,
    svgWidth,
    svgHeight
  );

  const nodes = visibleDays.map((day, i) => {
    const acts = activitiesByDay[day.id] ?? [];
    const actCount = acts.length;
    // Star brightness scales with activity density
    const baseRadius = 3.5;
    const radius = Math.min(baseRadius + actCount * 1.5, 12);
    const glowRadius = Math.min(radius + 6 + actCount * 2, 24);
    const glowOpacity = Math.min(0.08 + actCount * 0.04, 0.3);
    const isToday = day.date === todayStr;
    const isPast = day.date < todayStr;
    return {
      cx: positions[i].x,
      cy: positions[i].y,
      radius,
      glowRadius,
      glowOpacity,
      isToday,
      isPast,
      day,
      actCount,
    };
  });

  // Build straight line path segments
  const segments: { from: typeof nodes[0]; to: typeof nodes[0]; index: number }[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    segments.push({ from: nodes[i], to: nodes[i + 1], index: i });
  }

  // Constellation label position — center of bounding box, offset above
  const labelX = nodes.reduce((s, n) => s + n.cx, 0) / nodes.length;
  const minY = Math.min(...nodes.map((n) => n.cy));

  return (
    <div className="w-full overflow-hidden px-2">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: `${svgHeight}px`, minHeight: `${svgHeight}px` }}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Faint background stars */}
        {Array.from({ length: 10 }).map((_, i) => {
          const rand = seededRandom(weekIndex * 1000 + i + 7);
          return (
            <circle
              key={`bg-${i}`}
              cx={rand() * svgWidth}
              cy={rand() * svgHeight}
              r={0.6 + rand() * 0.5}
              fill="rgb(var(--lightBlue))"
              fillOpacity={0.1 + rand() * 0.12}
            />
          );
        })}

        {/* Constellation label */}
        {tripName && (
          <text
            x={labelX}
            y={Math.max(minY - 10, 8)}
            textAnchor="middle"
            fontSize="8"
            fill="rgb(var(--lightBlue))"
            fillOpacity="0.35"
            letterSpacing="1.5"
            fontFamily="system-ui, sans-serif"
            style={{ textTransform: "uppercase" } as React.CSSProperties}
          >
            {tripName}
          </text>
        )}

        {/* Connection lines — straight with style progression */}
        {segments.map(({ from, to, index }) => {
          const bothPastOrToday =
            (from.isPast || from.isToday) && (to.isPast || to.isToday);
          const isCurrentEdge =
            (from.isToday && !to.isPast && !to.isToday) ||
            (to.isToday && !from.isPast && !from.isToday);
          // Style progression: past=solid bright, current=animated, future=dashed dim
          let stroke = "rgb(var(--lightBlue))";
          let strokeWidth = 1.2;
          let strokeOpacity = 0.18;
          let dashArray = "5 5";
          let className = "";

          if (bothPastOrToday) {
            stroke = "rgb(var(--blue))";
            strokeWidth = 2;
            strokeOpacity = 0.6;
            dashArray = "none";
          } else if (isCurrentEdge) {
            stroke = "rgb(var(--blue))";
            strokeWidth = 1.8;
            strokeOpacity = 0.45;
            dashArray = "none";
            className = "constellation-current-edge";
          }

          return (
            <line
              key={`line-${index}`}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeOpacity={strokeOpacity}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              className={className}
            />
          );
        })}

        {/* Star nodes */}
        {nodes.map((node) => (
          <g key={node.day.id}>
            {/* Activity density glow */}
            {node.actCount > 0 && (
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.glowRadius}
                fill={
                  node.isToday || node.isPast
                    ? "rgb(var(--blue))"
                    : "rgb(var(--lightBlue))"
                }
                fillOpacity={node.glowOpacity}
              />
            )}

            {/* Today pulse ring */}
            {node.isToday && (
              <>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 5}
                  fill="rgb(var(--blue))"
                  fillOpacity="0.12"
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 5}
                  fill="none"
                  stroke="rgb(var(--blue))"
                  strokeWidth="1"
                >
                  <animate
                    attributeName="r"
                    from={node.radius + 5}
                    to={node.radius + 22}
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
              className={node.isToday ? "constellation-star-today" : ""}
            />

            {/* Inner highlight */}
            <circle
              cx={node.cx - node.radius * 0.2}
              cy={node.cy - node.radius * 0.2}
              r={node.radius * 0.3}
              fill="white"
              fillOpacity={node.isToday ? 0.55 : node.isPast ? 0.3 : 0.12}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
