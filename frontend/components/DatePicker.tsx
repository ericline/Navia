"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string; // ISO "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const [viewYear, setViewYear] = useState(() =>
    value ? parseInt(value.split("-")[0]) : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? parseInt(value.split("-")[1]) - 1 : today.getMonth()
  );

  useEffect(() => { setMounted(true); }, []);

  // Sync view to value when it changes externally
  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split("-")[0]));
      setViewMonth(parseInt(value.split("-")[1]) - 1);
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = rect.top > spaceBelow;
    setPopoverStyle({
      position: "fixed",
      ...(above
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      left: rect.left,
      width: Math.max(rect.width, 288),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    const iso = [
      viewYear,
      String(viewMonth + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
    onChange(iso);
    setOpen(false);
  }

  // Build calendar grid cells (nulls = empty leading/trailing slots)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const popover =
    mounted && open
      ? createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="glass bg-warmSurface rounded-2xl p-4 shadow-xl"
          >
            {/* Month / year nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/40 hover:text-black/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-black/75 select-none">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/40 hover:text-black/70"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-black/30 py-1 select-none"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="h-8 w-8 mx-auto" />;
                const iso = [
                  viewYear,
                  String(viewMonth + 1).padStart(2, "0"),
                  String(day).padStart(2, "0"),
                ].join("-");
                const isSelected = iso === value;
                const isToday = iso === todayStr;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={[
                      "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition select-none",
                      isSelected
                        ? "bg-blue text-white font-semibold shadow-sm"
                        : isToday
                        ? "border border-blue/35 text-blue/80 font-medium hover:bg-blue/10"
                        : "text-black/65 hover:bg-black/[0.06]",
                    ].join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`glass-input flex items-center gap-2 text-left ${className}`}
      >
        <Calendar className="h-4 w-4 text-black/30 shrink-0" />
        <span className={`text-sm ${value ? "text-black/85" : "text-black/30"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>
      {popover}
    </>
  );
}
