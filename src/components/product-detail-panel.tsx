"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  Layers,
  LineChart,
  TrendingUp,
  Activity,
  BarChart3,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { money, num, num2, pct, dateShort } from "@/lib/format";
import { getSkuHistory } from "@/lib/api";
import { Drawer } from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricBar } from "@/components/ui/metric-gauge";
import {
  getClassificationMeta,
  shortClasif,
} from "@/components/ui/classification";
import { SkuHistoryChart } from "@/components/charts/sku-history-chart";

/* ── Helpers ───────────────────────────────────────────────── */

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const str = String(v);
  const m = str.match(/-?\d+(\.\d+)?/);
  if (m) {
    const p = parseFloat(m[0]);
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
};

/** Staggered section animation props */
const sectionMotion = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
});

/* ── Props ─────────────────────────────────────────────────── */

interface ProductDetailPanelProps {
  row: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
  sucursalName: string | null;
}

/* ── Section title helper ──────────────────────────────────── */

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <h4 className="text-sm font-semibold text-fg">{children}</h4>
    </div>
  );
}

/* ── KPI mini card ─────────────────────────────────────────── */

function KpiMini({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("px-3 py-2.5", className)}>
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-faint">
        {label}
      </p>
      <p className="mt-1 font-mono tabular-nums text-body font-semibold text-fg">
        {value}
      </p>
    </Card>
  );
}

/* ── Section divider ───────────────────────────────────────── */

const divider = "border-b border-border-soft pb-6 mb-6";

/* ══════════════════════════════════════════════════════════════
   ProductDetailPanel
   ══════════════════════════════════════════════════════════════ */

export function ProductDetailPanel({
  row,
  open,
  onClose,
  sucursalName,
}: ProductDetailPanelProps) {
  /* ── SKU history query ─────────────────────────────────── */
  const sku = s(row["Código SKU"] ?? row["SKU"] ?? row["Código"] ?? row["sku"]);
  const branchNameStr = sucursalName === "Todas" ? null : sucursalName;
  const office_id = branchNameStr
    ? branchNameStr === "Magdalena"
      ? 1
      : branchNameStr === "San Miguel"
        ? 2
        : null
    : null;

  const { data: historyData } = useQuery({
    queryKey: ["skuHistory", sku, 180, office_id],
    queryFn: ({ signal }) => getSkuHistory(sku, 180, office_id, signal),
    enabled: open && sku.length > 0,
    staleTime: 5 * 60_000,
  });

  /* ── Classification meta ───────────────────────────────── */
  const clasificacion = s(row["Clasificación"]);
  const classMeta = getClassificationMeta(clasificacion);
  const ClassIcon = classMeta.icon;

  /* ── Derived values ────────────────────────────────────── */
  const productName = s(row["Descripción"] ?? row["Producto"]);
  const categoria = s(row["Categoría"]);
  const departamento = s(row["Departamento"]);
  const subcategoria = s(row["Subcategoría"]);
  const tendencia = s(row["Tendencia"]);
  const sugerencia = s(row["Sugerencia Transferencia"]);

  let sectionIdx = 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-3xl"
    >
      {/* ────────────────────────────────────────────────────
          Section 1: Header
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        {/* Product name */}
        <h2 className="text-h1 font-bold text-indigo-400 leading-tight">
          {productName || "—"}
        </h2>

        {/* SKU + Categoría badge */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-caption text-muted">{sku}</span>
          {categoria && (
            <Badge tone="primary">{categoria}</Badge>
          )}
        </div>

        {/* Breadcrumb */}
        {(departamento || categoria || subcategoria) && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-caption text-faint">
            {departamento && <span>{departamento}</span>}
            {departamento && categoria && (
              <ChevronRight className="h-3 w-3 text-faint/50" />
            )}
            {categoria && <span>{categoria}</span>}
            {categoria && subcategoria && (
              <ChevronRight className="h-3 w-3 text-faint/50" />
            )}
            {subcategoria && <span>{subcategoria}</span>}
          </div>
        )}

        {/* Classification badge + Tendencia */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {clasificacion && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-semibold",
                classMeta.bgClass,
                classMeta.colorClass,
              )}
            >
              <ClassIcon className="h-3.5 w-3.5" />
              {shortClasif(clasificacion)}
            </span>
          )}
          {tendencia && (
            <Badge
              tone={
                tendencia.includes("↑") || tendencia.toLowerCase().includes("subiendo")
                  ? "success"
                  : tendencia.includes("↓") || tendencia.toLowerCase().includes("bajando")
                    ? "danger"
                    : "neutral"
              }
              dot
            >
              {tendencia}
            </Badge>
          )}
        </div>

        {/* Sugerencia Transferencia alert */}
        {sugerencia && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/8 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-caption font-semibold text-warning">
                Sugerencia de Transferencia
              </p>
              <p className="mt-0.5 text-caption text-warning/80">
                {sugerencia}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 2: KPI Grid (2 rows × 4 cols)
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={BarChart3}>Indicadores Clave</SectionTitle>
        <div className="grid grid-cols-4 gap-2">
          {/* Row 1 */}
          <KpiMini
            label="Ventas 90d"
            value={money(row["Vendido SKU S/"])}
          />
          <KpiMini
            label="Unds Vendidas"
            value={num(row["Unds Vend (90d)"])}
          />
          <KpiMini
            label="Velocidad"
            value={`${num2(row["Velocidad (uds/día)"])} u/d`}
          />
          <KpiMini
            label="Vel Reciente"
            value={`${num2(row["Vel últimos 30d"])} u/d`}
          />
          {/* Row 2 */}
          <KpiMini
            label="Stock Disp"
            value={num(row["Stock Disp"])}
          />
          <KpiMini
            label="Stock Reserv"
            value={num(row["Stock Reserv"])}
          />
          <KpiMini
            label="Stock Almacén"
            value={num(row["Stock Almacén"])}
          />
          <KpiMini
            label="Cobertura"
            value={s(row["Cobertura"]) || "—"}
          />
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 3: Timeline (Línea de Tiempo)
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={CalendarDays}>Línea de Tiempo</SectionTitle>

        {/* Horizontal timeline */}
        <div className="relative flex items-start justify-between px-2">
          {/* Connecting line */}
          <div className="absolute left-6 right-6 top-[9px] h-px bg-border-soft" />

          {[
            { label: "1ª Recepción", key: "1ª Recepción" },
            { label: "Últ. Recepción", key: "Últ. Recepción" },
            { label: "1ª Venta Lote", key: "1ª Venta Lote" },
            { label: "Últ. Venta Lote", key: "Últ. Venta Lote" },
            { label: "Últ. Venta", key: "Fecha Últ. Venta" },
          ].map((dot) => (
            <div
              key={dot.key}
              className="relative z-10 flex flex-col items-center gap-1.5"
            >
              <div className="h-[18px] w-[18px] rounded-full border-2 border-primary/40 bg-primary/20 shadow-[0_0_8px_rgba(99,102,241,0.25)]">
                <div className="m-auto mt-[3px] h-2 w-2 rounded-full bg-primary" />
              </div>
              <p className="max-w-[68px] text-center text-caption leading-tight font-medium text-muted">
                {dot.label}
              </p>
              <p className="text-center text-caption font-mono text-faint">
                {s(row[dot.key]) ? dateShort(row[dot.key]) : "—"}
              </p>
            </div>
          ))}
        </div>

        {/* Derived metrics below timeline */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Edad SKU", key: "Edad SKU (días)", suffix: " días" },
            { label: "Llegó hace", key: "Llegó hace (días)", suffix: " días" },
            { label: "Días Exhibido", key: "Días Exhibido", suffix: " días" },
            { label: "Vida lote", key: "Vida lote (días)", suffix: " días" },
          ].map((m) => (
            <div
              key={m.key}
              className="rounded-lg bg-surface-2 px-3 py-2 text-center"
            >
              <p className="text-caption font-medium text-faint">{m.label}</p>
              <p className="mt-0.5 font-mono text-body font-semibold text-fg">
                {num(row[m.key])}
                <span className="text-caption text-muted">{m.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 4: Diagnóstico de Salud
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={Activity}>Diagnóstico de Salud</SectionTitle>
        <div className="space-y-3">
          <MetricBar
            label="% Rotación Stock"
            value={n(row["% Rotación Stock"])}
            max={100}
            suffix="%"
            thresholds={{ danger: 20, warning: 50 }}
          />
          <MetricBar
            label="% Demanda vs Reposición"
            value={n(row["% Demanda vs Reposición"])}
            max={200}
            suffix="%"
            thresholds={{ danger: 50, warning: 80 }}
          />
          <MetricBar
            label="Sell-through Lote"
            value={n(row["Sell-through Lote %"])}
            max={100}
            suffix="%"
            thresholds={{ danger: 30, warning: 60 }}
          />
          <MetricBar
            label="% Frecuencia"
            value={n(row["% Frecuencia"])}
            max={100}
            suffix="%"
            thresholds={{ danger: 20, warning: 50 }}
          />
          <MetricBar
            label="Días Agotado"
            value={n(row["Días Agotado"])}
            max={90}
            suffix=" días"
            tone={
              n(row["Días Agotado"]) > 15
                ? "danger"
                : n(row["Días Agotado"]) > 7
                  ? "warning"
                  : "success"
            }
          />
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 5: Participación en Categoría
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={Layers}>Participación en Categoría</SectionTitle>
        <div className="space-y-3">
          <div>
            <MetricBar
              label="% S/ en Subcategoría"
              value={n(row["% S/ en Subcat"])}
              max={100}
              suffix="%"
              tone="primary"
            />
            <p className="mt-1 text-caption text-faint">
              Aporta {pct(row["% S/ en Subcat"])} de su Subcategoría
            </p>
          </div>
          <div>
            <MetricBar
              label="% S/ en Categoría"
              value={n(row["% S/ en Cat"])}
              max={100}
              suffix="%"
              tone="primary"
            />
            <p className="mt-1 text-caption text-faint">
              Aporta {pct(row["% S/ en Cat"])} de su Categoría
            </p>
          </div>
          <div>
            <MetricBar
              label="% S/ en Departamento"
              value={n(row["% S/ en Depto"])}
              max={100}
              suffix="%"
              tone="primary"
            />
            <p className="mt-1 text-caption text-faint">
              Aporta {pct(row["% S/ en Depto"])} de su Departamento
            </p>
          </div>
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 6: Proyección y Forecast
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={TrendingUp}>Proyección y Forecast</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Proyección 30d vs Proy 30d (reciente) — comparison */}
          <div className="col-span-2 flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3">
            <div className="flex-1">
              <p className="text-caption font-medium text-faint">
                Proyección 30d
              </p>
              <p className="mt-0.5 font-mono text-h3 font-semibold text-fg">
                {num2(row["Proyección 30d"])}
                <span className="ml-1 text-caption text-muted">uds</span>
              </p>
            </div>
            <div className="h-8 w-px bg-border-soft" />
            <div className="flex-1">
              <p className="text-caption font-medium text-faint">
                Proy 30d (reciente)
              </p>
              <p className="mt-0.5 font-mono text-h3 font-semibold text-fg">
                {num2(row["Proy 30d (reciente)"])}
                <span className="ml-1 text-caption text-muted">uds</span>
              </p>
            </div>
          </div>

          {/* Remaining grid */}
          <ForecastCell
            label="Proy Post-Recep"
            value={num2(row["Proy Post-Recep"])}
            suffix="uds"
          />
          <ForecastCell
            label="Cob Post-Recep"
            value={s(row["Cob Post-Recep"]) || "—"}
          />
          <ForecastCell
            label="Días Absorción Lote"
            value={s(row["Días Absorción Lote"]) || "—"}
          />
          <ForecastCell
            label="Unds Recib (90d)"
            value={num(row["Unds Recib (90d)"])}
            suffix="uds"
          />
          <ForecastCell
            label="Vend Lote Total"
            value={num(row["Vend Lote Total"])}
            suffix="uds"
          />
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 7: Historial de Ventas
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)}>
        <SectionTitle icon={LineChart}>Historial de Ventas</SectionTitle>
        {historyData?.points && historyData.points.length > 0 ? (
          <SkuHistoryChart points={historyData.points} />
        ) : historyData ? (
          <div className="flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 py-12">
            <p className="text-caption text-faint">
              Sin datos de historial para este SKU
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 py-12">
            <div className="flex items-center gap-2 text-caption text-muted">
              <Clock className="h-4 w-4 animate-pulse" />
              Cargando historial…
            </div>
          </div>
        )}
      </motion.div>
    </Drawer>
  );
}

/* ── Forecast cell subcomponent ────────────────────────────── */

function ForecastCell({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <p className="text-caption font-medium text-faint">{label}</p>
      <p className="mt-0.5 font-mono text-body font-semibold text-fg">
        {value}
        {suffix && (
          <span className="ml-1 text-caption font-normal text-muted">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
