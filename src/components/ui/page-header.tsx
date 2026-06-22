import { cn } from "@/lib/utils";

/**
 * PageHeader — bloque superior de cada página.
 *
 * Estructura:
 *   ┌───────────────────────────────────────────────┐
 *   │  EYEBROW (opcional, label)            [actions]│
 *   │  Título grande                                 │
 *   │  Descripción en text-muted                     │
 *   ├───────────────────────────────────────────────┤  ← divider sutil
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  divider = true,
  className,
}: {
  title: string;
  description?: string;
  /** Línea pequeña sobre el título (categoría / sección padre). */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  /** Cuando es true (default) muestra el divider inferior. */
  divider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 pb-5 sm:flex-row sm:items-end sm:justify-between",
        divider && "border-b border-border-soft",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-2 text-caption font-semibold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-display font-semibold text-fg">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-body text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
