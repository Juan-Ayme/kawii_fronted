// Clasificación de SKUs de las matrices (módulo 04b / 05).
// Mapea las 25+ etiquetas del SQL en grupos accionables con tono de color.
// Adaptado del frontend hermano COYA.

export type Tone = "best" | "good" | "warn" | "bad" | "new" | "neutral";

export interface FilterDef {
  id: string;
  label: string;
  emoji: string;
  match: (clasif: string) => boolean;
  tone: Tone;
}

// Mapeo de cajas → tonos. Mantenemos compatibilidad con los nombres
// anteriores (EXITOSO, ALERTA VISUAL, MUERTO 90D, etc.) por si quedan
// generaciones viejas del SQL cacheadas o se está revisando un export
// histórico. Los nombres ACTUALES (BESTSELLER, STOCK BAJO QUIETO, STOCK
// PARADO, LOTE FRENADO, etc.) son los que disparan en producción.
export const FILTERS: FilterDef[] = [
  { id: "todos", label: "Todos", emoji: "📋", match: () => true, tone: "neutral" },
  {
    id: "mejores",
    label: "Mejores",
    emoji: "🔥",
    match: (c) =>
      c.includes("BESTSELLER ACTIVO") ||      // antes: EXITOSO ACTIVO
      c.includes("EXITOSO ACTIVO") ||         // compat
      c.includes("OPORTUNIDAD PERDIDA") ||    // antes: EXITOSO OLVIDADO (REPONER YA)
      c.includes("EXITOSO OLVIDADO") ||       // compat
      c.includes("ROTACIÓN ACTIVA") ||        // sin cambio
      c.includes("ALTA ROTACIÓN"),            // cubre "ALTA ROTACIÓN" y "ROTACIÓN BAJANDO"
    tone: "best",
  },
  {
    id: "alza",
    label: "En alza",
    emoji: "📈",
    match: (c) =>
      c.includes("VENDIENDO MÁS QUE ANTES") ||  // antes: BAJO VOLUMEN EN ALZA
      c.includes("BAJO VOLUMEN EN ALZA") ||     // compat
      c.includes("BESTSELLER AGOTADO") ||       // P21: antes BESTSELLER EN PAUSA
      c.includes("BESTSELLER EN PAUSA") ||      // compat (pre-P21)
      c.includes("EXITOSO PASADO") ||           // compat
      c.includes("AGOTADO CON DEMANDA") ||      // antes: AGOTADO POTENCIAL ACTIVO
      c.includes("PRODUCTO EMERGENTE"),
    tone: "good",
  },
  {
    id: "alerta",
    label: "Alerta",
    emoji: "👀",
    match: (c) =>
      c.includes("STOCK BAJO QUIETO") ||        // antes: ALERTA VISUAL
      c.includes("ALERTA VISUAL") ||            // compat
      c.includes("STOCK RECIÉN LLEGADO") ||     // antes: REABASTECIDO RECIENTE
      c.includes("LOTE NUEVO VENDIENDO") ||     // antes: REABASTECIDO ACTIVO
      c.includes("RECIÉN REABASTECIDO") ||
      c.includes("REABASTECIDO"),               // compat genérico
    tone: "warn",
  },
  {
    id: "exceso",
    label: "Exceso",
    emoji: "🧊",
    match: (c) => c.includes("EXCESO") || c.includes("STOCK EXCESIVO"),
    tone: "warn",
  },
  {
    id: "ritmo_perdido",
    label: "Ritmo perdido",
    emoji: "📉",
    match: (c) => c.includes("RITMO PERDIDO"),
    tone: "warn",
  },
  {
    id: "baja",
    label: "Baja rotación",
    emoji: "🐢",
    match: (c) => c.includes("BAJA ROTACIÓN"),
    tone: "bad",
  },
  {
    id: "peores",
    label: "Peores",
    emoji: "💀",
    match: (c) =>
      c.includes("STOCK PARADO") ||             // antes: MUERTO 90D
      c.includes("LOTE FRENADO") ||             // antes: SALDO QUEMADO
      c.includes("MUERTO") ||                   // compat
      c.includes("SALDO QUEMADO") ||            // compat
      c.includes("PÉRDIDA"),                     // cubre "PÉRDIDA DE STOCK" y "VENDIÓ Y SE PERDIÓ"
    tone: "bad",
  },
  {
    id: "nuevos",
    label: "Nuevos",
    emoji: "🌱",
    match: (c) =>
      c.includes("PRODUCTO NUEVO") ||           // antes: NUEVO
      c.includes("RECIÉN REABASTECIDO"),
    tone: "new",
  },
];

/** Estilos por tono (Tailwind v4). El color base de superficie usa el token `surface`. */
export const TONE_STYLES: Record<
  Tone,
  { border: string; bg: string; chip: string; text: string }
> = {
  best: {
    border: "border-emerald-500/40",
    bg: "from-emerald-500/10 to-surface",
    chip: "bg-emerald-500/15 text-emerald-300",
    text: "text-emerald-300",
  },
  good: {
    border: "border-cyan-500/40",
    bg: "from-cyan-500/10 to-surface",
    chip: "bg-cyan-500/15 text-cyan-300",
    text: "text-cyan-300",
  },
  warn: {
    border: "border-amber-500/40",
    bg: "from-amber-500/10 to-surface",
    chip: "bg-amber-500/15 text-amber-300",
    text: "text-amber-300",
  },
  bad: {
    border: "border-rose-500/40",
    bg: "from-rose-500/10 to-surface",
    chip: "bg-rose-500/15 text-rose-300",
    text: "text-rose-300",
  },
  new: {
    border: "border-lime-500/40",
    bg: "from-lime-500/10 to-surface",
    chip: "bg-lime-500/15 text-lime-300",
    text: "text-lime-300",
  },
  neutral: {
    border: "border-border",
    bg: "from-surface to-surface",
    chip: "bg-surface-3 text-muted",
    text: "text-muted",
  },
};

export function classifyTone(clasif: string): Tone {
  for (const f of FILTERS) {
    if (f.id === "todos") continue;
    if (f.match(clasif)) return f.tone;
  }
  return "neutral";
}

export type MatrixRow = Record<string, unknown>;

/**
 * Lee la clasificación de una fila. El backend renombra "Clasificación" según
 * CLASSIFICATION_LABEL (ej. "Clasificación HUDEC"), así que buscamos en orden:
 *   1. "Clasificación" exacto
 *   2. cualquier clave que empiece con "clasif" (cubre el rename white-label)
 *   3. heurística: un valor string con pinta de etiqueta de clasificación
 */
export function getClasif(row: MatrixRow): string {
  if (row["Clasificación"] != null) return String(row["Clasificación"]);
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().startsWith("clasif")) {
      const v = row[key];
      if (v != null) return String(v);
    }
  }
  for (const v of Object.values(row)) {
    if (
      typeof v === "string" &&
      /[🔥💎🐢💀🌱👀📈🧊⛔💫📉⏸️✨🪦⚠️✅📦🆕🔄🟢⚖️]|BESTSELLER|MUERTO|STOCK PARADO|LOTE FRENADO|ROTACIÓN|EXCESO|PRODUCTO NUEVO|ALERTA|BAJA|PÉRDIDA|RITMO PERDIDO|OPORTUNIDAD PERDIDA|REABASTECIDO/i.test(v)
    ) {
      return v;
    }
  }
  return "";
}

/** Detecta el nombre real de la columna de clasificación en un set de columnas. */
export function findClasifColumn(columns: string[]): string | null {
  if (columns.includes("Clasificación")) return "Clasificación";
  const byPrefix = columns.find((c) => c.toLowerCase().startsWith("clasif"));
  return byPrefix ?? null;
}

export function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
