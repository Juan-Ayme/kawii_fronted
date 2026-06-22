"use client";

import { cn } from "@/lib/utils";

export const PERIODS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 365, label: "1 año" },
];

export function PeriodSelect({
  value,
  onChange,
  options = PERIODS,
}: {
  value: number;
  onChange: (days: number) => void;
  options?: { days: number; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className="inline-flex rounded-md border border-border-soft bg-surface-2 p-0.5 shadow-card"
    >
      {options.map((p) => {
        const active = value === p.days;
        return (
          <button
            key={p.days}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(p.days)}
            className={cn(
              "rounded-sm px-3 py-1 text-caption font-semibold",
              "transition-[background,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-primary text-primary-fg shadow-card"
                : "text-muted hover:bg-surface-3/60 hover:text-fg",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
