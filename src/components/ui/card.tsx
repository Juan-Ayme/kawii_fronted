import { cn } from "@/lib/utils";

/**
 * Card primitive — superficie de contenido con borde sutil y sombra suave.
 *
 * Variantes:
 *  - default     : Card estática (lo común).
 *  - interactive : Card clickable con hover-lift (translate-y) + sombra realzada.
 *                  Útil para grids navegables.
 */
export function Card({
  className,
  variant = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "interactive";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-soft bg-surface shadow-card",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
        variant === "interactive" &&
          "cursor-pointer transition-[transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:-translate-y-px hover:shadow-card-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: {
  title?: React.ReactNode;
  /** Línea sobre el título (ej. "REPORTE", "ÚLTIMOS 30 DÍAS"). */
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-1 text-caption font-semibold uppercase tracking-[0.08em] text-faint">
            {eyebrow}
          </p>
        )}
        {title && (
          <h3 className="truncate text-h3 font-semibold text-fg">{title}</h3>
        )}
        {subtitle && (
          <p className="mt-1 text-caption font-normal tracking-normal text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
