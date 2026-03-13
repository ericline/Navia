"use client";

import { Day, Activity } from "@/lib/api";

interface ConstellationPathProps {
  days: Day[];
  activitiesByDay: Record<number, Activity[]>;
  weekOffset: number;
  visibleCount: number;
}

function getTodayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// Seeded pseudo-random to get consistent shapes per week offset
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Pre-defined constellation templates for different day counts (2-7 stars)
// Each is an array of {x, y} positions normalized to [0,1] range
// These are inspired by real constellation shapes
const CONSTELLATION_TEMPLATES: Record<number, { x: number; y: number }[]> = {
  // 2 stars: simple diagonal
  2: [
    { x: 0.2, y: 0.65 },
    { x: 0.8, y: 0.35 },
  ],
  // 3 stars: triangle (like Triangulum)
  3: [
    { x: 0.15, y: 0.7 },
    { x: 0.5, y: 0.2 },
    { x: 0.85, y: 0.6 },
  ],
  // 4 stars: kite / diamond (like Southern Cross)
  4: [
    { x: 0.1, y: 0.5 },
    { x: 0.38, y: 0.2 },
    { x: 0.62, y: 0.7 },
    { x: 0.9, y: 0.35 },
  ],
  // 5 stars: W shape (like Cassiopeia)
  5: [
    { x: 0.08, y: 0.35 },
    { x: 0.27, y: 0.7 },
    { x: 0.48, y: 0.25 },
    { x: 0.7, y: 0.65 },
    { x: 0.92, y: 0.3 },
  ],
  // 6 stars: dipper shape (like Big Dipper)
  6: [
    { x: 0.06, y: 0.55 },
    { x: 0.2, y: 0.3 },
    { x: 0.36, y: 0.45 },
    { x: 0.52, y: 0.25 },
    { x: 0.72, y: 0.6 },
    { x: 0.94, y: 0.4 },
  ],
  // 7 stars: arc + fork (like Big Dipper full)
  7: [
    { x: 0.04, y: 0.45 },
    { x: 0.17, y: 0.7 },
    { x: 0.31, y: 0.3 },
    { x: 0.46, y: 0.55 },
    { x: 0.6, y: 0.2 },
    { x: 0.76, y: 0.6 },
    { x: 0.94, y: 0.35 },
  ],
};

// Get a varied constellation shape for a given week, with slight random perturbation
function getNodePositions(
  count: number,
  weekIndex: number,
  svgWidth: number,
  svgHeight: number
) {
  const template = CONSTELLATION_TEMPLATES[count] ?? CONSTELLATION_TEMPLATES[7]!.slice(0, count);
  const rand = seededRandom(weekIndex * 7919 + count * 131);

  // Apply small random offsets to make each week feel unique,
  // but keep the overall shape recognizable
  const padding = 30;
  const usableW = svgWidth - padding * 2;
  const usableH = svgHeight - padding * 2;

  return template.map((pt) => {
    const jitterX = (rand() - 0.5) * 0.08;
    const jitterY = (rand() - 0.5) * 0.1;
    return {
      x: padding + (pt.x + jitterX) * usableW,
      y: padding + (pt.y + jitterY) * usableH,
    };
  });
}

export default function ConstellationPath({
  days,
  activitiesByDay,
  weekOffset,
  visibleCount,
}: ConstellationPathProps) {
  const visibleDays = days.slice(weekOffset, weekOffset + visibleCount);
  if (visibleDays.length === 0) return null;

  const todayStr = getTodayStr();
  const svgWidth = Math.max(visibleDays.length * 120, 400);
  const svgHeight = 80;
  const weekIndex = Math.floor(weekOffset / 7);

  const positions = getNodePositions(
    visibleDays.length,
    weekIndex,
    svgWidth,
    svgHeight
  );

  const nodes = visibleDays.map((day, i) => {
    const actCount = activitiesByDay[day.id]?.length ?? 0;
    const radius = Math.min(4 + actCount * 1.2, 10);
    const isToday = day.date === todayStr;
    const isPast = day.date < todayStr;
    return {
      cx: positions[i].x,
      cy: positions[i].y,
      radius,
      isToday,
      isPast,
      day,
    };
  });

  // Build bezier path segments between consecutive nodes
  const pathSegments: string[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const midX = (a.cx + b.cx) / 2;
    // Control point offset perpendicular to the line
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Alternate curve direction for organic feel
    const sign = i % 2 === 0 ? -1 : 1;
    const perpScale = len * 0.15 * sign;
    const ctrlX = midX + (-dy / len) * perpScale;
    const ctrlY = (a.cy + b.cy) / 2 + (dx / len) * perpScale;
    pathSegments.push(
      `M ${a.cx} ${a.cy} Q ${ctrlX} ${ctrlY} ${b.cx} ${b.cy}`
    );
  }

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
        {Array.from({ length: 8 }).map((_, i) => {
          const rand = seededRandom(weekIndex * 1000 + i);
          return (
            <circle
              key={`bg-${i}`}
              cx={rand() * svgWidth}
              cy={rand() * svgHeight}
              r={0.8}
              fill="rgb(var(--lightBlue))"
              fillOpacity={0.15 + rand() * 0.15}
            />
          );
        })}

        {/* Connection lines */}
        {pathSegments.map((d, i) => {
          const fromNode = nodes[i];
          const toNode = nodes[i + 1];
          const bothPastOrToday =
            (fromNode.isPast || fromNode.isToday) &&
            (toNode.isPast || toNode.isToday);

          return (
            <path
              key={i}
              d={d}
              stroke={
                bothPastOrToday
                  ? "rgb(var(--blue))"
                  : "rgb(var(--lightBlue))"
              }
              strokeWidth={bothPastOrToday ? 2 : 1.5}
              strokeOpacity={bothPastOrToday ? 0.55 : 0.2}
              strokeDasharray={bothPastOrToday ? "none" : "4 4"}
              strokeLinecap="round"
            />
          );
        })}

        {/* Star nodes */}
        {nodes.map((node) => (
          <g key={node.day.id}>
            {node.isToday && (
              <>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.radius + 4}
                  fill="rgb(var(--blue))"
                  fillOpacity="0.12"
                />
                {/* Pulse ring — use SVG animate for correct centering */}
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
                    to={node.radius + 20}
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
            <circle
              cx={node.cx}
              cy={node.cy}
              r={node.radius}
              fill={
                node.isToday || node.isPast
                  ? "rgb(var(--blue))"
                  : "rgb(var(--lightBlue))"
              }
              fillOpacity={node.isToday ? 1 : node.isPast ? 0.8 : 0.4}
              className={node.isToday ? "constellation-star-today" : ""}
            />
            {/* Inner highlight */}
            <circle
              cx={node.cx - node.radius * 0.25}
              cy={node.cy - node.radius * 0.25}
              r={node.radius * 0.3}
              fill="white"
              fillOpacity={node.isToday ? 0.5 : node.isPast ? 0.3 : 0.15}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
