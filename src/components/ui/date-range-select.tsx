"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ─── Date helpers (local time, no UTC conversion) ─── */

/** Today at midnight (no time component). */
function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Number of calendar days between from and to (both inclusive). */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** Given a `days` count (ending today inclusive), return the start date. */
function startDateFromDays(days: number): Date {
  return addDays(todayDate(), -(days - 1));
}

/** Format a date as "15 jun 2026". */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Start of ISO week (Monday). */
function startOfWeek(d: Date): Date {
  const shift = (d.getDay() + 6) % 7; // days since Monday
  return addDays(d, -shift);
}

/* ─── Presets ─── */

interface Preset {
  label: string;
  getFrom: () => Date;
}

const PRESETS: Preset[] = [
  { label: "Últimos 7 días", getFrom: () => addDays(todayDate(), -6) },
  { label: "Últimos 14 días", getFrom: () => addDays(todayDate(), -13) },
  { label: "Últimos 30 días", getFrom: () => addDays(todayDate(), -29) },
  { label: "Esta semana", getFrom: () => startOfWeek(todayDate()) },
  {
    label: "Este mes",
    getFrom: () => {
      const t = todayDate();
      return new Date(t.getFullYear(), t.getMonth(), 1);
    },
  },
  { label: "Últimos 90 días", getFrom: () => addDays(todayDate(), -89) },
  { label: "Últimos 180 días", getFrom: () => addDays(todayDate(), -179) },
  {
    label: "Este año",
    getFrom: () => new Date(todayDate().getFullYear(), 0, 1),
  },
];

/* ─── Calendar grid ─── */

function calendarDays(viewMonth: Date): Date[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // days back to Monday
  const start = addDays(first, -offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));
  return days;
}

const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

/* ─── Component ─── */

export interface DateRangeSelectProps {
  /** Current value as number of days (start → today, inclusive). */
  value: number;
  /** Emits the new days count when the user applies. */
  onChange: (days: number) => void;
  /** Max days allowed (default 365). */
  maxDays?: number;
}

export function DateRangeSelect({
  value,
  onChange,
  maxDays = 365,
}: DateRangeSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewMonth, setViewMonth] = useState(() => {
    const from = startDateFromDays(value);
    return new Date(from.getFullYear(), from.getMonth(), 1);
  });

  // Sync draft when parent value changes.
  useEffect(() => setDraft(value), [value]);

  // When opening, navigate calendar to the from-date month.
  useEffect(() => {
    if (open) {
      const from = startDateFromDays(draft);
      setViewMonth(new Date(from.getFullYear(), from.getMonth(), 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setDraft(value);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, value]);

  const t = todayDate();
  const draftFrom = useMemo(() => startDateFromDays(draft), [draft]);
  const calDaysList = useMemo(() => calendarDays(viewMonth), [viewMonth]);

  /* handlers */

  const handleSelectDate = (d: Date) => {
    if (d > t) return;
    const days = daysBetween(d, t);
    if (days > maxDays || days < 1) return;
    setDraft(days);
  };

  const handlePreset = (p: Preset) => {
    const from = p.getFrom();
    const days = Math.min(daysBetween(from, t), maxDays);
    setDraft(days);
    setViewMonth(new Date(from.getFullYear(), from.getMonth(), 1));
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleDiscard = () => {
    setDraft(value);
    setOpen(false);
  };

  /* labels */

  const buttonFrom = startDateFromDays(value);
  const closedPreset = PRESETS.find(
    (p) => daysBetween(p.getFrom(), t) === value,
  );
  const buttonLabel = closedPreset
    ? closedPreset.label
    : `${fmtDate(buttonFrom)} – ${fmtDate(t)}`;

  const monthLabel = viewMonth.toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () =>
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    );

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2",
          "px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-3",
          open && "ring-2 ring-primary/40",
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-muted" />
        {buttonLabel}
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 flex overflow-hidden rounded-xl",
            "border border-border bg-surface shadow-2xl shadow-black/50 animate-in",
          )}
        >
          {/* Left: presets */}
          <div className="flex w-40 flex-col border-r border-border/60 bg-surface-2/40 py-2">
            {PRESETS.map((p) => {
              const pDays = daysBetween(p.getFrom(), t);
              const active = pDays === draft;
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  className={cn(
                    "px-3 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-primary/15 font-semibold text-primary"
                      : "text-muted hover:bg-surface-3/60 hover:text-fg",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Right: calendar */}
          <div className="flex w-[276px] flex-col p-3">
            {/* Desde / Hasta */}
            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Desde
                </p>
                <div className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs tabular-nums text-fg">
                  {fmtDate(draftFrom)}
                </div>
              </div>
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  Hasta
                </p>
                <div className="rounded-md border border-border/60 bg-surface-3/40 px-2 py-1.5 text-xs tabular-nums text-muted">
                  {fmtDate(t)}{" "}
                  <span className="text-faint">(hoy)</span>
                </div>
              </div>
            </div>

            {/* Month navigation */}
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold capitalize text-fg">
                {monthLabel}
              </p>
              <div className="flex gap-0.5">
                <button
                  onClick={prevMonth}
                  className="rounded-md p-1 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={nextMonth}
                  className="rounded-md p-1 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-faint">
              {DAY_HEADERS.map((d) => (
                <div key={d} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {calDaysList.map((d, i) => {
                const inMonth =
                  d.getMonth() === viewMonth.getMonth();
                const future = d > t;
                const tooFar = daysBetween(d, t) > maxDays;
                const disabled = future || tooFar;
                const isStart = isSameDay(d, draftFrom);
                const isEnd = isSameDay(d, t);
                const inRange = d >= draftFrom && d <= t;
                const single = isStart && isEnd;

                return (
                  <button
                    key={i}
                    disabled={disabled}
                    onClick={() => handleSelectDate(d)}
                    className={cn(
                      "relative py-1.5 text-[11px] leading-none transition-colors",
                      /* base */
                      !inMonth && "text-faint/30",
                      inMonth &&
                        !disabled &&
                        !inRange &&
                        "text-muted hover:bg-surface-3 hover:text-fg",
                      disabled && "cursor-not-allowed opacity-20",
                      /* in range */
                      inRange && inMonth && "bg-primary/10 text-primary",
                      inRange && !inMonth && "bg-primary/5",
                      /* start cap */
                      isStart &&
                        !single &&
                        "rounded-l-full bg-primary !text-primary-fg font-bold",
                      /* end cap */
                      isEnd &&
                        inRange &&
                        !single &&
                        "rounded-r-full bg-primary/25 font-bold",
                      /* single day */
                      single && "rounded-full bg-primary !text-primary-fg font-bold",
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-[10px] tabular-nums text-faint">
                {draft} día{draft !== 1 ? "s" : ""} seleccionado
                {draft !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDiscard}
                >
                  Descartar
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
