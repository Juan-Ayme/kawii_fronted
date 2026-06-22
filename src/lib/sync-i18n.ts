// Traducciones y metadata para la página de sincronización.
// El log del backend está en inglés/snake_case; aquí lo humanizamos.

import type { BadgeTone } from "@/components/ui/badge";

export interface EntityInfo {
  label: string;
  emoji: string;
  description: string;
  /** Orden esperado dentro de un sync full (para calcular % avance). */
  order: number;
}

// Las claves coinciden con la columna `entity` de la tabla sync_log que
// `update_all.py` escribe. El orden refleja el flujo real del script.
const ENTITIES: Record<string, EntityInfo> = {
  taxonomy: {
    label: "Taxonomía",
    emoji: "🗂️",
    description: "Departamentos, categorías y subcategorías locales",
    order: 1,
  },
  offices: {
    label: "Sucursales",
    emoji: "🏪",
    description: "Tiendas físicas registradas en BSale",
    order: 2,
  },
  users: {
    label: "Usuarios",
    emoji: "👤",
    description: "Cajeros / vendedores de BSale",
    order: 3,
  },
  product_types: {
    label: "Tipos de producto",
    emoji: "🏷️",
    description: "Categorías BSale (mapean a la taxonomía local)",
    order: 4,
  },
  document_types: {
    label: "Tipos de documento",
    emoji: "📑",
    description: "Boletas, facturas, NC y NV",
    order: 5,
  },
  variants: {
    label: "Productos + variantes",
    emoji: "🎨",
    description: "Catálogo maestro y SKUs (talla / color)",
    order: 6,
  },
  product_type_attributes: {
    label: "Atributos por tipo",
    emoji: "🧩",
    description: "Atributos disponibles por categoría BSale",
    order: 7,
  },
  variant_attribute_values: {
    label: "Atributos por variante",
    emoji: "🧷",
    description: "Valor de cada atributo por SKU",
    order: 8,
  },
  stock_levels: {
    label: "Stock actual",
    emoji: "📊",
    description: "Inventario disponible por sucursal",
    order: 9,
  },
  variant_costs: {
    label: "Costos por variante",
    emoji: "💵",
    description: "Costo promedio y último por SKU",
    order: 10,
  },
  stock_history: {
    label: "Snapshot de stock",
    emoji: "📈",
    description: "Foto diaria del inventario (omisible)",
    order: 11,
  },
  receptions: {
    label: "Recepciones",
    emoji: "📥",
    description: "Mercadería que entró a las sucursales",
    order: 12,
  },
  consumptions: {
    label: "Consumos",
    emoji: "📤",
    description: "Mercadería que salió del inventario",
    order: 13,
  },
  documents: {
    label: "Documentos",
    emoji: "🧾",
    description: "Boletas, facturas y notas (omisible)",
    order: 14,
  },
  document_details: {
    label: "Detalle de documentos",
    emoji: "📋",
    description: "Líneas de venta por documento",
    order: 15,
  },
  // Alias / nombres alternativos
  products: {
    label: "Productos",
    emoji: "📦",
    description: "Catálogo maestro de productos",
    order: 6,
  },
  prices: {
    label: "Precios",
    emoji: "💰",
    description: "Lista de precios vigentes",
    order: 10,
  },
  costs: {
    label: "Costos",
    emoji: "💵",
    description: "Costos por variante",
    order: 10,
  },
  huerfanos: {
    label: "Productos huérfanos",
    emoji: "🔍",
    description: "Verificación de productos sin tipo asignado",
    order: 16,
  },
};

// Alias de entidades — el backend a veces usa nombre alterno.
const ENTITY_ALIASES: Record<string, string> = {
  costs: "variant_costs",
  snapshot_stock_history: "stock_history",
};

export function normalizeEntity(raw: string): string {
  const k = raw.toLowerCase().replace(/\s+/g, "_");
  return ENTITY_ALIASES[k] ?? k;
}

export function entityInfo(entity: string): EntityInfo {
  const key = normalizeEntity(entity);
  return (
    ENTITIES[key] ?? {
      label: entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      emoji: "⚙️",
      description: "",
      order: 99,
    }
  );
}

// Lista canónica de entidades que SÍ esperamos ver en una sync full.
// Excluimos alias (costs, prices, products, huerfanos, document_details).
const _CANONICAL_KEYS = new Set([
  "taxonomy",
  "offices",
  "users",
  "product_types",
  "document_types",
  "variants",
  "product_type_attributes",
  "variant_attribute_values",
  "stock_levels",
  "variant_costs",
  "stock_history",
  "receptions",
  "consumptions",
  "documents",
]);

export const KNOWN_ENTITIES = Object.entries(ENTITIES)
  .filter(([k]) => _CANONICAL_KEYS.has(k))
  .map(([key, info]) => ({ key, ...info }))
  .sort((a, b) => a.order - b.order);

// ─────────────── Timestamp parsing ───────────────
/**
 * Parsea timestamps ISO del backend.
 *
 * Problema real: `/sync/tasks` devuelve strings NAIVE (`"2026-06-21T14:44:38"`)
 * mientras que `/sync/log` devuelve TZ-aware con sufijo `Z`. Si dejamos que
 * `new Date()` los parsee tal cual, los naive se interpretan como hora LOCAL
 * y desaparece la comparación con los aware (UTC). Tratamos los naive como UTC.
 */
export function parseTs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const safe = hasTz ? iso : iso + "Z";
  const t = new Date(safe).getTime();
  return Number.isFinite(t) ? t : null;
}

// ─────────────────────── Estados ───────────────────────
export interface StatusInfo {
  label: string;
  tone: BadgeTone;
  description: string;
}

const STATUSES: Record<string, StatusInfo> = {
  ok: { label: "OK", tone: "success", description: "Sincronizado sin errores" },
  success: { label: "Completado", tone: "success", description: "Tarea finalizada con éxito" },
  running: { label: "En progreso", tone: "info", description: "Descargando y guardando datos…" },
  queued: { label: "En cola", tone: "warning", description: "Esperando para empezar" },
  failed: { label: "Falló", tone: "danger", description: "Hubo un error durante la sincronización" },
  error: { label: "Error", tone: "danger", description: "Hubo un error" },
  warning: { label: "Con avisos", tone: "warning", description: "Terminó pero con advertencias" },
  skipped: { label: "Omitida", tone: "neutral", description: "Se saltó esta fase" },
};

export function statusInfo(status: string | null | undefined): StatusInfo {
  if (!status) return { label: "—", tone: "neutral", description: "" };
  const key = status.toLowerCase();
  return (
    STATUSES[key] ?? {
      label: status,
      tone: /ok|success/i.test(status) ? "success" : "neutral",
      description: "",
    }
  );
}

// ─────────────── Traducción de errores ───────────────
/** Convierte un mensaje técnico a algo legible en español. */
export function humanizeError(raw: string | null | undefined): string {
  if (!raw) return "Error desconocido";
  const msg = String(raw);

  if (/econn|connection refused|connect\s+timeout/i.test(msg))
    return "No se pudo conectar al servicio de BSale.";
  if (/timeout|timed out|etimedout/i.test(msg))
    return "El servicio remoto tardó demasiado en responder.";
  if (/unauthor|401|forbid|403/i.test(msg))
    return "Las credenciales fueron rechazadas por BSale.";
  if (/not found|404/i.test(msg))
    return "Un recurso solicitado no existe en BSale (404).";
  if (/duplicate|unique.*constraint|conflict/i.test(msg))
    return "Hay datos duplicados que rompen una restricción única.";
  if (/foreign key|fk constraint/i.test(msg))
    return "Una referencia entre tablas quedó inválida.";
  if (/rate.?limit|too many requests|429/i.test(msg))
    return "BSale bloqueó la sincronización por exceso de requests.";
  if (/network|enotfound|getaddrinfo/i.test(msg))
    return "Problema de red al alcanzar el origen.";
  if (/database|psql|postgres|sql/i.test(msg))
    return "Error en la base de datos local.";

  // Recorto mensajes muy largos
  return msg.length > 200 ? msg.slice(0, 197) + "…" : msg;
}

// ─────────────── Resumen de actividad ───────────────
/** Genera un resumen "humano" para una entrada del sync_log. */
export function summarizeLogEntry(opts: {
  entity: string;
  status: string;
  fetched: number | null;
  inserted: number | null;
  updated: number | null;
  skipped: number | null;
  duracion_s: number | null;
  error_message: string | null;
}): string {
  const e = entityInfo(opts.entity).label.toLowerCase();
  const ok = /ok|success/i.test(opts.status);

  if (!ok && opts.error_message) {
    return `${humanizeError(opts.error_message)}`;
  }
  if (!ok) {
    return `La sincronización de ${e} no terminó bien.`;
  }

  const parts: string[] = [];
  if (opts.fetched != null && opts.fetched > 0) {
    parts.push(`${formatN(opts.fetched)} ${e} descargados`);
  }
  const ins = opts.inserted ?? 0;
  const upd = opts.updated ?? 0;
  if (ins > 0 && upd > 0) parts.push(`${formatN(ins)} nuevos y ${formatN(upd)} actualizados`);
  else if (ins > 0) parts.push(`${formatN(ins)} nuevos`);
  else if (upd > 0) parts.push(`${formatN(upd)} actualizados`);

  if (opts.skipped != null && opts.skipped > 0) {
    parts.push(`${formatN(opts.skipped)} ignorados`);
  }
  if (opts.duracion_s != null && opts.duracion_s > 0) {
    parts.push(`en ${formatDur(opts.duracion_s)}`);
  }

  if (parts.length === 0) return `Sin cambios en ${e}.`;
  return parts.join(" · ").replace(/^./, (c) => c.toUpperCase());
}

function formatN(n: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(n);
}

function formatDur(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

// ─────────────── Friendly task labels ───────────────
export function describeTaskParams(params: Record<string, unknown> | undefined): string {
  if (!params) return "—";
  const days = params.days;
  const skipDocs = params.skip_documents;
  const skipStock = params.skip_stock_snapshot;
  const bits: string[] = [];
  if (days != null) bits.push(`Últimos ${days} días`);
  if (skipDocs) bits.push("sin documentos");
  if (skipStock) bits.push("sin snapshot");
  return bits.join(" · ") || "—";
}
