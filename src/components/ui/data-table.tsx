import { cn } from "@/lib/utils";
import { LoadingState, ErrorState, EmptyState } from "./states";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyHint?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, i: number) => string | number;
  maxHeight?: string;
  /** Filas con fondo alterno (subtleza). Default: false. */
  zebra?: boolean;
}

const alignClass = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  error,
  emptyTitle,
  emptyHint,
  onRowClick,
  rowKey,
  maxHeight,
  zebra = false,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} />;
  if (isLoading && !rows) return <LoadingState />;
  if (rows && rows.length === 0)
    return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div
      className="relative overflow-auto rounded-xl border border-border-soft bg-surface shadow-card"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-body">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur-sm">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "border-b border-border-soft px-3 py-2.5 text-caption font-semibold uppercase tracking-[0.06em] text-muted whitespace-nowrap",
                  alignClass[c.align ?? "left"],
                  c.headerClassName,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((row, i) => (
            <tr
              key={rowKey ? rowKey(row, i) : i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-border-soft/60 last:border-0",
                "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                zebra && i % 2 === 1 && "bg-surface-2/35",
                onRowClick && "cursor-pointer hover:bg-surface-3/50",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 text-fg/90",
                    alignClass[c.align ?? "left"],
                    c.className,
                  )}
                >
                  {c.render
                    ? c.render(row)
                    : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isLoading && rows && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/40 backdrop-blur-[1px]">
          <LoadingState />
        </div>
      )}
    </div>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2 text-caption text-muted">
      <span className="tabular-nums">
        {from.toLocaleString("es-PE")}–{to.toLocaleString("es-PE")} de{" "}
        <span className="font-semibold text-fg">{total.toLocaleString("es-PE")}</span>
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
          className={cn(
            "rounded-md border border-border-soft bg-surface px-2.5 py-1",
            "transition-[background,box-shadow,color] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
            "hover:bg-surface-3 hover:text-fg",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface",
          )}
        >
          Anterior
        </button>
        <button
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
          className={cn(
            "rounded-md border border-border-soft bg-surface px-2.5 py-1",
            "transition-[background,box-shadow,color] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
            "hover:bg-surface-3 hover:text-fg",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface",
          )}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
