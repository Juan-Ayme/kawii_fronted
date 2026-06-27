"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  LineChart,
  TrendingUp,
  Activity,
  BarChart3,
  Tag,
  Package,
  Box,
  ShoppingCart,
  Target,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { money, num, num2, pct, dateShort, s, n } from "@/lib/format";
import { getSkuHistory, getSubcategories, setProductSubcategory } from "@/lib/api";
import { Drawer } from "@/components/ui/drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiStat } from "@/components/ui/kpi-stat";
import { MetricBar, MetricGauge } from "@/components/ui/metric-gauge";
import {
  getClassificationMeta,
  shortClasif,
} from "@/components/ui/classification";
import { SkuHistoryChart } from "@/components/charts/sku-history-chart";

/* ── Helpers ───────────────────────────────────────────────── */

function generateProductInsight(row: any): { text: string; tone: "success" | "warning" | "danger" | "info" } {
  const rotacion = n(row["% Rotación Stock"]);
  const clasificacion = s(row["Clasificación"]);
  const diasAgotado = n(row["Días Agotado"]);
  const stock = n(row["Stock Almacén"]);
  const sugerencia = s(row["Sugerencia Transferencia"]);

  if (diasAgotado > 7) {
    return {
      tone: "danger",
      text: `Alerta crítica: Este producto lleva ${diasAgotado} días sin stock. Al ser de clasificación ${clasificacion || 'importante'}, esto representa una pérdida de ventas. Se recomienda reabastecer inmediatamente.`,
    };
  }

  if (stock === 0 && diasAgotado === 0) {
    return {
      tone: "warning",
      text: `El producto se acaba de quedar sin stock. Sugerimos revisar si hay órdenes de compra en tránsito para evitar perder ventas en los próximos días.`,
    };
  }

  if (rotacion > 80 && stock > 0) {
    return {
      tone: "success",
      text: `¡Excelente desempeño! Este producto tiene una rotación sumamente saludable (${rotacion}%). El stock actual es bueno, pero mantenlo en vigilancia para evitar futuros quiebres.`,
    };
  }
  
  if (sugerencia && sugerencia.toLowerCase().includes("transferir")) {
    return {
      tone: "info",
      text: `Inventario inmovilizado. El sistema sugiere transferir unidades a otra sucursal para optimizar el espacio y mejorar el flujo de caja, ya que su rotación es de apenas ${rotacion}%.`,
    };
  }

  if (rotacion < 20 && stock > 0) {
    return {
      tone: "warning",
      text: `Atención: Este producto tiene un movimiento muy lento (rotación del ${rotacion}%). Evalúa si hay sobrestock o si requiere alguna promoción comercial para impulsar su salida.`,
    };
  }

  return {
    tone: "info",
    text: `El producto mantiene un comportamiento estable acorde a su clasificación ${clasificacion}. Su rotación es del ${rotacion}% y cuenta con inventario disponible.`,
  };
}

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

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["skuHistory", sku, 180, office_id],
    queryFn: ({ signal }) => getSkuHistory(sku, 180, office_id, signal),
    enabled: open && sku.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const qc = useQueryClient();
  const productId = n(row["ID Producto"] ?? row["product_id"] ?? row["id"]);
  const [edited, setEdited] = useState<string | null>(null);

  const subs = useQuery({
    queryKey: ["subcategories-all"],
    queryFn: ({ signal }) => getSubcategories(undefined, signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (newSubId: number | null) =>
      setProductSubcategory(productId as number, newSubId),
    onSuccess: () => {
      setEdited(null);
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-summary"] });
      // Forzar recarga de los dashboards principales para reflejar el cambio en los árboles
      qc.invalidateQueries({ queryKey: ["matrix-04b"] });
      qc.invalidateQueries({ queryKey: ["compras-catalogo"] });
    },
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const insight = generateProductInsight(row);

  const hasOverride = s(row["Override"]) === "true" || row["has_override"] === true;
  const currentSubId = (() => {
    const current = subs.data?.find((s) => s.name === subcategoria);
    return current ? String(current.id) : "";
  })();
  const subId = edited ?? currentSubId;
  const setSubId = (v: string) => setEdited(v);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-3xl"
    >
      {/* ────────────────────────────────────────────────────
          Section 1: Header
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className="relative mb-6 pb-6 border-b border-border-soft overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-10 -right-10 h-64 w-64 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
        
        {/* Breadcrumb */}
        {(departamento || categoria || subcategoria) && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest text-faint">
            {departamento && <span className="font-semibold text-muted">{departamento}</span>}
            {departamento && categoria && (
              <ChevronRight className="h-3 w-3 text-faint/30" />
            )}
            {categoria && <span className="font-semibold text-muted">{categoria}</span>}
            {categoria && subcategoria && (
              <ChevronRight className="h-3 w-3 text-faint/30" />
            )}
            {subcategoria && <span className="font-bold text-primary">{subcategoria}</span>}
          </div>
        )}

        {/* Product name & SKU */}
        <div>
          <h2 className="text-h1 font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-fg to-fg/70 leading-tight">
            {productName || "—"}
          </h2>
          
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 font-mono text-xs font-semibold text-muted shadow-sm border border-border-soft">
              <Tag className="h-3.5 w-3.5" />
              {sku}
            </span>
            
            {clasificacion && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-sm",
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
                className="shadow-sm"
              >
                {tendencia}
              </Badge>
            )}
          </div>
        </div>

        {/* Resumen Inteligente */}
        <div className={cn(
          "mt-6 flex items-start gap-3 rounded-xl border p-4 shadow-sm relative overflow-hidden",
          insight.tone === "danger" && "bg-danger/10 border-danger/20",
          insight.tone === "warning" && "bg-warning/10 border-warning/20",
          insight.tone === "success" && "bg-success/10 border-success/20",
          insight.tone === "info" && "bg-primary/10 border-primary/20"
        )}>
          <div className={cn(
            "absolute left-0 top-0 w-1 h-full",
            insight.tone === "danger" && "bg-danger",
            insight.tone === "warning" && "bg-warning",
            insight.tone === "success" && "bg-success",
            insight.tone === "info" && "bg-primary"
          )} />
          <div className={cn(
            "rounded-full p-1.5 shadow-sm border mt-0.5",
            insight.tone === "danger" && "bg-danger/20 border-danger/30 text-danger",
            insight.tone === "warning" && "bg-warning/20 border-warning/30 text-warning",
            insight.tone === "success" && "bg-success/20 border-success/30 text-success",
            insight.tone === "info" && "bg-primary/20 border-primary/30 text-primary"
          )}>
             <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className={cn(
              "text-sm font-bold",
              insight.tone === "danger" && "text-danger",
              insight.tone === "warning" && "text-warning",
              insight.tone === "success" && "text-success",
              insight.tone === "info" && "text-primary"
            )}>
              Resumen Inteligente
            </p>
            <p className={cn(
              "mt-1 text-sm font-medium leading-relaxed opacity-90",
              insight.tone === "danger" && "text-danger-fg",
              insight.tone === "warning" && "text-warning-fg",
              insight.tone === "success" && "text-success-fg",
              insight.tone === "info" && "text-fg"
            )}>
              {insight.text}
            </p>
          </div>
        </div>



        {/* Override / Clasificación Manual */}
        {productId > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border-soft bg-surface-2 p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-fg">Reclasificar producto (Override)</p>
              <p className="text-xs text-muted">Asigna una subcategoría específica. Si se deja vacío, heredará del tipo de producto.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                className="flex-1"
                disabled={subs.isLoading}
              >
                <option value="">— Heredar del tipo (sin override) —</option>
                {(subs.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.department_name} / {s.category_name} / {s.name}
                  </option>
                ))}
              </Select>
              <Button
                onClick={() => mutation.mutate(subId === "" ? null : Number(subId))}
                loading={mutation.isPending}
              >
                Guardar
              </Button>
            </div>
            {hasOverride && (
              <button
                onClick={() => {
                  setSubId("");
                  mutation.mutate(null);
                }}
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted hover:text-fg mt-1"
              >
                Quitar override
              </button>
            )}
            {mutation.isError && <p className="text-xs text-danger">Error al actualizar.</p>}
            {mutation.isSuccess && <p className="text-xs text-success">Actualizado.</p>}
          </div>
        )}
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 2: KPI Grid (2 rows × 4 cols)
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={BarChart3}>Indicadores Clave</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Row 1 */}
          <KpiStat
            label="Ventas 90d"
            value={money(row["Vendido SKU S/"])}
            icon={TrendingUp}
            tone="success"
          />
          <KpiStat
            label="Unds Vendidas"
            value={num(row["Unds Vend (90d)"])}
            icon={ShoppingCart}
          />
          <KpiStat
            label="Velocidad"
            value={`${num2(row["Velocidad (uds/día)"])} u/d`}
            icon={Activity}
          />
          <KpiStat
            label="Vel Reciente"
            value={`${num2(row["Vel últimos 30d"])} u/d`}
            icon={LineChart}
            tone={n(row["Vel últimos 30d"]) > n(row["Velocidad (uds/día)"]) ? "success" : "danger"}
          />
          {/* Row 2 */}
          <KpiStat
            label="Stock Disp"
            value={num(row["Stock Disp"])}
            icon={Package}
            tone={n(row["Stock Disp"]) > 0 ? "success" : "danger"}
          />
          <KpiStat
            label="Stock Reserv"
            value={num(row["Stock Reserv"])}
            icon={Box}
          />
          <KpiStat
            label="Stock Almacén"
            value={num(row["Stock Almacén"])}
            icon={Box}
          />
          <KpiStat
            label="Cobertura"
            value={s(row["Cobertura"]) || "—"}
            icon={CalendarDays}
            tone={
              n(row["Cobertura"]) < 15
                ? "danger"
                : n(row["Cobertura"]) < 30
                  ? "warning"
                  : "success"
            }
          />
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 3: Resumen de Salud (Gerencial)
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={Activity}>Salud del Producto</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Main Gauges */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2 px-2 py-6 shadow-sm border border-border-soft relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
              <MetricGauge
                label="Eficiencia de Rotación"
                value={n(row["% Rotación Stock"])}
                max={100}
                suffix="%"
                thresholds={{ danger: 20, warning: 50 }}
                size={150}
              />
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2 px-2 py-6 shadow-sm border border-border-soft relative overflow-hidden">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
              <MetricGauge
                label="Balance Oferta/Demanda"
                value={n(row["% Demanda vs Reposición"])}
                max={200}
                suffix="%"
                thresholds={{ danger: 50, warning: 80 }}
                size={150}
              />
            </div>
          </div>
          
          {/* Secondary Metrics */}
          <div className="lg:col-span-2 flex flex-col gap-3">
             <div className="flex-1 flex flex-col justify-center rounded-xl bg-surface-2 px-5 py-4 shadow-sm border border-border-soft">
               <MetricBar
                 label="Desempeño Lote Actual"
                 value={n(row["Sell-through Lote %"])}
                 max={100}
                 suffix="%"
                 thresholds={{ danger: 30, warning: 60 }}
               />
             </div>
             <div className="flex-1 flex flex-col justify-center rounded-xl bg-surface-2 px-5 py-4 shadow-sm border border-border-soft">
               <MetricBar
                 label="Frecuencia de Ventas"
                 value={n(row["% Frecuencia"])}
                 max={100}
                 suffix="%"
                 thresholds={{ danger: 20, warning: 50 }}
               />
             </div>
             
             {/* Special alert card for Días sin Stock */}
             <div className={cn(
               "flex-1 flex items-center justify-between rounded-xl px-5 py-4 shadow-sm border",
               n(row["Días Agotado"]) > 15 
                 ? "bg-danger/10 border-danger/20 text-danger" 
                 : n(row["Días Agotado"]) > 7 
                   ? "bg-warning/10 border-warning/20 text-warning"
                   : "bg-success/10 border-success/20 text-success"
             )}>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-current/10 p-2.5 shadow-inner">
                    {n(row["Días Agotado"]) > 7 ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Riesgo de Quiebre</p>
                    <p className="text-sm font-bold mt-0.5">
                      {n(row["Días Agotado"]) === 0 
                        ? "Sin quiebres recientes" 
                        : `${n(row["Días Agotado"])} días sin stock`}
                    </p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Section 4: Historial de Ventas
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className={divider}>
        <SectionTitle icon={LineChart}>Historial de Ventas</SectionTitle>
        {historyError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border-soft bg-surface-2 py-10 px-4 text-center">
            <AlertTriangle className="h-6 w-6 text-danger mb-3 opacity-80" />
            <p className="text-sm font-bold text-fg">Error al cargar el historial</p>
            <p className="text-xs text-muted mt-1 max-w-sm">
              Es posible que el código SKU ({sku}) contenga caracteres especiales que el servidor no procesa correctamente (como "/"), o hubo un problema de red.
            </p>
          </div>
        ) : historyData?.points && historyData.points.length > 0 ? (
          <SkuHistoryChart points={historyData.points} />
        ) : historyLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 py-12">
            <div className="flex items-center gap-2 text-caption text-muted">
              <Clock className="h-4 w-4 animate-pulse" />
              Cargando historial…
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-border-soft bg-surface-2 py-12">
            <p className="text-caption text-faint">
              Sin datos de historial para este SKU
            </p>
          </div>
        )}
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Boton Datos Avanzados
          ──────────────────────────────────────────────────── */}
      <motion.div {...sectionMotion(sectionIdx++)} className="flex items-center justify-center pb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "group flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition-all",
            showAdvanced
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border-soft bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg"
          )}
        >
          {showAdvanced ? "Ocultar datos avanzados" : "Ver datos avanzados"}
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", showAdvanced && "rotate-180")} />
        </button>
      </motion.div>

      {/* ────────────────────────────────────────────────────
          Datos Avanzados
          ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {/* ────────────────────────────────────────────────────
                Section 5: Timeline (Línea de Tiempo)
                ──────────────────────────────────────────────────── */}
            <div className={divider}>
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
            </div>

            {/* ────────────────────────────────────────────────────
                Section 6: Participación en Categoría
                ──────────────────────────────────────────────────── */}
            <div className={divider}>
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
            </div>

            {/* ────────────────────────────────────────────────────
                Section 7: Proyección y Forecast
                ──────────────────────────────────────────────────── */}
            <div className="pb-6">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
