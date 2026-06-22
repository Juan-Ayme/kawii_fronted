import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { BadgeTone } from "./badge";

const iconTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-muted ring-border-soft",
  primary: "bg-primary/15 text-primary ring-primary/20",
  success: "bg-success/15 text-success ring-success/20",
  warning: "bg-warning/15 text-warning ring-warning/20",
  danger: "bg-danger/15 text-danger ring-danger/20",
  info: "bg-info/15 text-info ring-info/20",
  violet: "bg-violet/15 text-violet ring-violet/20",
};

/**
 * KpiStat — card de métrica destacada.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ LABEL (caption)        [ICON]│
 *   │                              │
 *   │ 1.234.567                    │  ← número en mono tabular
 *   │ sub-text en text-faint       │
 *   └──────────────────────────────┘
 */
export function KpiStat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: BadgeTone;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-soft bg-surface p-4 shadow-card",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
        "transition-shadow duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:shadow-card-hover",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md ring-1",
              iconTones[tone],
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 h-7 w-28 animate-pulse rounded-md bg-surface-3" />
      ) : (
        <p
          className={cn(
            "mt-2 text-h1 font-semibold text-fg",
            "font-mono tabular-nums tracking-tight",
          )}
        >
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="mt-1 text-caption font-normal tracking-normal text-faint">
          {sub}
        </p>
      )}
      {sub && loading && (
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-surface-3/60" />
      )}
    </div>
  );
}
