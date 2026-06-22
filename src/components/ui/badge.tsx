import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-muted border-border-soft",
  primary: "bg-primary/12 text-primary border-primary/25",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  info: "bg-info/12 text-info border-info/25",
  violet: "bg-violet/12 text-violet border-violet/25",
};

const dotColors: Record<BadgeTone, string> = {
  neutral: "bg-muted",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  violet: "bg-violet",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Mostrar dot indicator antes del texto (estado activo / pulse). */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-caption font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-pill", dotColors[tone])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/** Mapea etiquetas de clasificación de las matrices a un tono de color. */
export function classificationTone(label: string | null | undefined): BadgeTone {
  const L = (label ?? "").toUpperCase();
  if (!L) return "neutral";
  if (L.includes("QUIEBRE") || L.includes("URGENTE")) return "danger";
  if (L.includes("EXCESO")) return "warning";
  if (L.includes("MUERTO") || L.includes("BAJA ROT")) return "warning";
  if (
    L.includes("MARGINAL") ||
    L.includes("RESIDUO") ||
    L.includes("HISTÓRICO") ||
    L.includes("FRACASO")
  )
    return "neutral";
  if (
    L.includes("ALTA ROTACIÓN") ||
    L.includes("ROTACIÓN ACTIVA") ||
    L.includes("SANO") ||
    L.includes("EXITOSO")
  )
    return "success";
  if (L.includes("NUEVO") || L.includes("EMERGENTE")) return "info";
  if (L.includes("POTENCIAL") || L.includes("STOCK PREVIO")) return "primary";
  return "neutral";
}
