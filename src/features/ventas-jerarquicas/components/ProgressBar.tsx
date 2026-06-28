import { cn } from "@/lib/utils";

export type BarTone = "primary" | "info" | "violet" | "success" | "warning" | "accent" | "danger";

export const BAR_COLORS: Record<BarTone, string> = {
  primary: "bg-gradient-to-r from-primary/50 to-primary",
  info: "bg-gradient-to-r from-info/50 to-info",
  violet: "bg-gradient-to-r from-violet/50 to-violet",
  success: "bg-gradient-to-r from-success/50 to-success",
  warning: "bg-gradient-to-r from-warning/50 to-warning",
  accent: "bg-gradient-to-r from-accent/50 to-accent",
  danger: "bg-gradient-to-r from-danger/50 to-danger",
};

/* Palette per department — cycles through visually distinct colors */
export const DEPT_COLORS: {
  dot: string;
  bar: BarTone;
  bgActive: string;
  borderActive: string;
}[] = [
  { dot: "bg-primary",  bar: "primary",  bgActive: "bg-primary/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-primary)]" },
  { dot: "bg-success",  bar: "success",  bgActive: "bg-success/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-success)]" },
  { dot: "bg-info",     bar: "info",     bgActive: "bg-info/10",     borderActive: "shadow-[inset_3px_0_0_var(--color-info)]" },
  { dot: "bg-violet",   bar: "violet",   bgActive: "bg-violet/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-violet)]" },
  { dot: "bg-warning",  bar: "warning",  bgActive: "bg-warning/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-warning)]" },
  { dot: "bg-accent",   bar: "accent",   bgActive: "bg-accent/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-accent)]" },
  { dot: "bg-danger",   bar: "danger",   bgActive: "bg-danger/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-danger)]" },
];

export function ProgressBar({
  pct: fraction,
  tone = "primary",
}: {
  pct: number;
  tone?: BarTone;
}) {
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-pill bg-surface-3">
      <div
        className={cn(
          "h-full rounded-pill transition-all duration-[var(--duration-slow)] ease-[var(--ease-premium)]",
          BAR_COLORS[tone],
        )}
        style={{ width: `${Math.max(fraction * 100, 0.5)}%` }}
      />
    </div>
  );
}
