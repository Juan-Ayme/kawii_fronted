import { cn } from "@/lib/utils";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-gradient-to-r from-surface via-surface-3 to-surface bg-[length:200%_100%] animate-shimmer rounded",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center space-x-3">
        <Shimmer className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Shimmer className="h-4 w-1/3" />
          <Shimmer className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Shimmer className="h-6 w-16" />
        <Shimmer className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex space-x-4 py-2 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-5 flex-1 bg-surface-3" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex space-x-4 py-3 border-b border-border/40">
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
