import { cn } from "@/lib/utils";

export type FilterChipTone = "primary" | "success" | "warning" | "danger" | "info" | "violet";

export interface FilterChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  tone?: FilterChipTone;
  className?: string;
}

export function FilterChip({
  label,
  count,
  active,
  onClick,
  tone = "primary",
  className,
}: FilterChipProps) {
  const toneStyles: Record<FilterChipTone, string> = {
    primary: "border-primary/50 bg-primary/10 text-primary shadow-[0_0_12px_rgba(99,102,241,0.2)] backdrop-blur-md",
    success: "border-success/50 bg-success/10 text-success shadow-[0_0_12px_rgba(45,212,167,0.2)] backdrop-blur-md",
    warning: "border-warning/50 bg-warning/10 text-warning shadow-[0_0_12px_rgba(245,166,35,0.2)] backdrop-blur-md",
    danger: "border-danger/50 bg-danger/10 text-danger shadow-[0_0_12px_rgba(240,85,109,0.2)] backdrop-blur-md",
    info: "border-info/50 bg-info/10 text-info shadow-[0_0_12px_rgba(56,189,248,0.2)] backdrop-blur-md",
    violet: "border-violet/50 bg-violet/10 text-violet shadow-[0_0_12px_rgba(167,139,250,0.2)] backdrop-blur-md",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex flex-1 sm:flex-none justify-center items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        "text-xs font-medium whitespace-nowrap",
        "transition-all duration-200 ease-out",
        active
          ? toneStyles[tone]
          : "border-border/40 bg-surface-2/40 text-muted hover:border-border hover:bg-surface-3/60 hover:text-fg backdrop-blur-sm hover:scale-[1.02]",
        className
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(
          "rounded-md px-1.5 py-0.5 text-[0.6rem] font-semibold tabular-nums transition-colors",
          active ? "bg-black/20 text-fg" : "bg-surface-3/50 text-faint group-hover:bg-surface-4/80 group-hover:text-muted"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
