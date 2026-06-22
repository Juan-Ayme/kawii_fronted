// Formateadores compartidos. El negocio opera en Perú (Lima) → Soles (PEN).

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PEN_COMPACT = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  notation: "compact",
  maximumFractionDigits: 1,
});

const NUM = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "S/ 1,234.50" */
export function money(v: unknown): string {
  const n = toNum(v);
  return n === null ? "—" : PEN.format(n);
}

/** "S/ 1.2 M" — para ejes de gráficos / tarjetas compactas */
export function moneyCompact(v: unknown): string {
  const n = toNum(v);
  return n === null ? "—" : PEN_COMPACT.format(n);
}

/** "1,234" */
export function num(v: unknown): string {
  const n = toNum(v);
  return n === null ? "—" : NUM.format(n);
}

/** "1,234.56" */
export function num2(v: unknown): string {
  const n = toNum(v);
  return n === null ? "—" : NUM2.format(n);
}

/** "12.3%" — recibe un valor ya en porcentaje (no fracción) */
export function pct(v: unknown, digits = 1): string {
  const n = toNum(v);
  return n === null ? "—" : `${n.toFixed(digits)}%`;
}

/** Fecha corta local: "28 may 2026" */
export function dateShort(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Fecha + hora: "28 may 2026, 14:30" */
export function dateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "28 may" — para ejes de series temporales */
export function dayLabel(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

/** Heurística: ¿esta columna/clave representa dinero? */
export function looksLikeMoney(key: string): boolean {
  return /valor|soles|ventas|monto|capital|costo|precio|total.*amount|s\/|revenue|gmroi/i.test(
    key,
  );
}

/** Formato genérico de celda para tablas dinámicas (matrices). */
export function autoCell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") {
    if (looksLikeMoney(key)) return money(value);
    return Number.isInteger(value) ? num(value) : num2(value);
  }
  return String(value);
}
