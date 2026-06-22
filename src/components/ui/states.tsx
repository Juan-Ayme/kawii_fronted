import { AlertTriangle, Inbox, Loader2, WifiOff } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-5 w-5 animate-spin text-muted", className)}
      aria-hidden="true"
    />
  );
}

/**
 * LoadingState — placeholder centrado mientras se hace fetch.
 *
 * Usa fade-in para que aparezca con transición suave en lugar de "pop".
 */
export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted",
        "animate-[fade-in_var(--duration-base)_var(--ease-premium)_both]",
      )}
    >
      <Spinner className="h-6 w-6" />
      <p className="text-caption font-medium tracking-normal">{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  const isConn = error instanceof ApiError && error.status === 0;
  const message =
    error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/30 bg-danger-dim/40 px-6 py-12 text-center",
        "animate-[fade-in_var(--duration-base)_var(--ease-premium)_both]",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-danger/15 ring-4 ring-danger/10">
        {isConn ? (
          <WifiOff className="h-7 w-7 text-danger" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-7 w-7 text-danger" aria-hidden="true" />
        )}
      </div>
      <div>
        <p className="text-h3 font-semibold text-fg">
          {isConn ? "No hay conexión con la API" : "Error al cargar los datos"}
        </p>
        <p className="mt-1.5 max-w-md text-body text-muted">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Sin datos",
  hint,
  icon: Icon = Inbox,
}: {
  title?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-14 text-center",
        "animate-[fade-in_var(--duration-base)_var(--ease-premium)_both]",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-surface-3 ring-4 ring-surface-2/60">
        <Icon className="h-7 w-7 text-faint" />
      </div>
      <div>
        <p className="text-h3 font-semibold text-fg">{title}</p>
        {hint && (
          <p className="mt-1 max-w-sm text-body text-muted">{hint}</p>
        )}
      </div>
    </div>
  );
}
