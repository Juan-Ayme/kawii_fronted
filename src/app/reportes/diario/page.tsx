"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Wallet,
  Receipt,
  Tag,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from "lucide-react";
import { getSalesByDay, getMatrixActionGroups, matrixExcelUrl } from "@/lib/api";
import { money, num } from "@/lib/format";
import {
  getClasif,
  classifyTone,
  str,
  toNum,
  TONE_STYLES,
  type MatrixRow,
} from "@/lib/matrix-classify";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { SkuModal } from "@/components/matrix/sku-modal";
import { AnatomyCard } from "@/components/reportes/anatomy-card";
import { useSucursal } from "@/components/sucursal-context";
import { cn } from "@/lib/utils";
import type { SalesByDay } from "@/lib/types";

const MODULE = "04b";
const RENDER_CAP = 150;

/* ── Helpers de fecha (en UTC, para alinear con cómo el backend etiqueta las fechas) ── */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function dateMinus(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
/* Formatea una fecha "YYYY-MM-DD" en UTC (sin el corrimiento de 1 día que sufre
   toLocaleDateString al parsear una fecha sin hora en un huso negativo como Lima). */
function fmtDay(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function pctDelta(curr: number, prev: number): number | null {
  if (!prev || prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

export default function ReporteDiarioPage() {
  const { officeId, sucursalName } = useSucursal();
  const [selectedSku, setSelectedSku] = useState<MatrixRow | null>(null);

  // Serie de ventas (14d) para el pulso del día
  const byDay = useQuery({
    queryKey: ["sales-by-day", 14, officeId],
    queryFn: ({ signal }) => getSalesByDay(14, signal, officeId),
  });

  // Grupos de acción de la matriz (clasificación ya hecha en el backend)
  const actions = useQuery({
    queryKey: ["matrix-action-groups", MODULE],
    queryFn: ({ signal }) => getMatrixActionGroups(MODULE, signal),
    staleTime: 5 * 60_000,
  });

  /* ── Pulso del día: ayer (último día cerrado) vs día previo vs misma fecha semana pasada ── */
  const pulso = useMemo(() => {
    const serie = byDay.data ?? [];
    if (serie.length === 0) return null;
    const byDate = new Map<string, SalesByDay>();
    for (const r of serie) byDate.set(String(r.dia).slice(0, 10), r);

    const hoy = isoToday();
    // ayer = el día más reciente con datos que sea ANTERIOR a hoy (excluye el parcial de hoy)
    const dias = serie
      .map((r) => String(r.dia).slice(0, 10))
      .filter((d) => d < hoy)
      .sort();
    const ayerDia = dias[dias.length - 1];
    if (!ayerDia) return null;

    const ayer = byDate.get(ayerDia);
    const prev = byDate.get(dateMinus(ayerDia, 1));
    const semana = byDate.get(dateMinus(ayerDia, 7));
    return { ayerDia, ayer, prev, semana };
  }, [byDay.data]);

  /* ── Listas accionables (filtradas por sucursal del selector global) ── */
  const matchSucursal = (rows: MatrixRow[]) => {
    if (!sucursalName) return rows;
    const s = sucursalName.toLowerCase();
    return rows.filter((r) => str(r["Sucursal"]).toLowerCase().includes(s));
  };
  const sortByPriority = (rows: MatrixRow[]) =>
    [...rows].sort(
      (a, b) =>
        toNum(b["Proyección 30d"]) - toNum(a["Proyección 30d"]) ||
        toNum(b["Vendido SKU S/"]) - toNum(a["Vendido SKU S/"]),
    );

  const { compraUrgente, alertasQuiebre } = useMemo(() => {
    const groups = actions.data?.groups ?? {};
    const urgente = groups["urgente_comprar"] ?? [];
    const reponer = groups["reponer"] ?? [];
    return {
      compraUrgente: sortByPriority(matchSucursal([...urgente, ...reponer])),
      alertasQuiebre: sortByPriority(matchSucursal(urgente)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.data, sucursalName]);

  const hoyStr = isoToday();

  // Descarga el Excel RICO del backend (Portada → Índice → Resumen → 1 hoja por
  // Departamento con outline colapsable), el MISMO de Ventas & Catálogo, pero
  // filtrado por acción de negocio. El backend reaplica la clasificación y
  // separa por departamento; respeta la sucursal del selector global.
  const downloadActionExcel = (accion: string) => {
    const url = matrixExcelUrl(MODULE, {
      sucursal: sucursalName || undefined,
      accion,
    });
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div>
      <PageHeader
        title="Reporte Diario"
        description={`Pulso del día y acciones de compra · al ${fmtDay(hoyStr)}${
          sucursalName ? ` · ${sucursalName}` : " · todas las tiendas"
        }`}
        actions={
          <Button onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        }
      />

      {/* ───────────── PULSO DEL DÍA ───────────── */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-fg">
          Pulso del día{pulso?.ayerDia ? ` — ${fmtDay(pulso.ayerDia)}` : ""}
        </h3>
        {byDay.isError ? (
          <ErrorState error={byDay.error} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiStat
              label="Ventas (ayer)"
              value={money(pulso?.ayer?.ventas)}
              icon={Wallet}
              tone="success"
              loading={byDay.isLoading}
              sub={
                <DeltaPair
                  curr={toNum(pulso?.ayer?.ventas)}
                  prevDay={pulso?.prev ? toNum(pulso.prev.ventas) : undefined}
                  prevWeek={pulso?.semana ? toNum(pulso.semana.ventas) : undefined}
                />
              }
            />
            <KpiStat
              label="Tickets (ayer)"
              value={num(pulso?.ayer?.tickets)}
              icon={Receipt}
              tone="primary"
              loading={byDay.isLoading}
              sub={
                <DeltaPair
                  curr={toNum(pulso?.ayer?.tickets)}
                  prevDay={pulso?.prev ? toNum(pulso.prev.tickets) : undefined}
                  prevWeek={pulso?.semana ? toNum(pulso.semana.tickets) : undefined}
                />
              }
            />
            <KpiStat
              label="Ticket promedio (ayer)"
              value={money(pulso?.ayer?.ticket_promedio)}
              icon={Tag}
              tone="info"
              loading={byDay.isLoading}
              sub={
                <DeltaPair
                  curr={toNum(pulso?.ayer?.ticket_promedio)}
                  prevDay={
                    pulso?.prev ? toNum(pulso.prev.ticket_promedio) : undefined
                  }
                  prevWeek={
                    pulso?.semana ? toNum(pulso.semana.ticket_promedio) : undefined
                  }
                />
              }
            />
          </div>
        )}
      </section>

      {/* ───────────── ANATOMÍA DEL CAMBIO ─────────────
          Diagnóstico de tendencia: descompone Δventas en (tráfico × canasta ×
          precio). Es la primera pregunta a responder cuando algo se mueve. */}
      <AnatomyCard officeId={officeId} />

      {/* ───────────── COMPRA URGENTE ───────────── */}
      <Card className="mb-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-success" />
              Compra urgente
            </span>
          }
          subtitle="Productos que venden y están agotados o por agotarse — comprar para no perder venta"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-success/15 px-2 py-1 text-xs font-bold text-success tabular-nums">
                {num(compraUrgente.length)} SKUs
              </span>
              <Button
                onClick={() => downloadActionExcel("urgente_comprar,reponer")}
                disabled={compraUrgente.length === 0}
                className="no-print"
                title="Descargar Excel maquetado por departamento"
              >
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          }
        />
        <CardBody className="pt-0">
          {actions.isError ? (
            <ErrorState error={actions.error} />
          ) : actions.isLoading ? (
            <LoadingState label="Calculando acciones…" />
          ) : (
            <SkuTable rows={compraUrgente} onSelect={setSelectedSku} />
          )}
        </CardBody>
      </Card>

      {/* ───────────── ALERTAS DE QUIEBRE ───────────── */}
      <Card className="mb-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              Alertas de quiebre
            </span>
          }
          subtitle="Lo más crítico: agotados de alta rotación — reposición / transferencia inmediata"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-danger/15 px-2 py-1 text-xs font-bold text-danger tabular-nums">
                {num(alertasQuiebre.length)} SKUs
              </span>
              <Button
                onClick={() => downloadActionExcel("urgente_comprar")}
                disabled={alertasQuiebre.length === 0}
                className="no-print"
                title="Descargar Excel maquetado por departamento"
              >
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          }
        />
        <CardBody className="pt-0">
          {actions.isError ? (
            <ErrorState error={actions.error} />
          ) : actions.isLoading ? (
            <LoadingState label="Calculando alertas…" />
          ) : (
            <SkuTable rows={alertasQuiebre} onSelect={setSelectedSku} />
          )}
        </CardBody>
      </Card>

      {selectedSku && (
        <SkuModal row={selectedSku} onClose={() => setSelectedSku(null)} />
      )}
    </div>
  );
}

/* ── Par de deltas (vs día previo y vs misma fecha semana pasada) ── */
function DeltaPair({
  curr,
  prevDay,
  prevWeek,
}: {
  curr: number;
  prevDay?: number;
  prevWeek?: number;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <DeltaChip label="día previo" delta={prevDay === undefined ? null : pctDelta(curr, prevDay)} />
      <DeltaChip label="sem. pasada" delta={prevWeek === undefined ? null : pctDelta(curr, prevWeek)} />
    </span>
  );
}

function DeltaChip({ label, delta }: { label: string; delta: number | null }) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="text-faint">— {label}</span>;
  }
  const up = delta >= 0;
  const Icon = delta > 0.5 ? TrendingUp : delta < -0.5 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        delta > 0.5 ? "text-success" : delta < -0.5 ? "text-danger" : "text-muted",
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {delta.toFixed(0)}% {label}
    </span>
  );
}

/* ── Tabla de SKUs accionables (click → SkuModal) ── */
function SkuTable({
  rows,
  onSelect,
}: {
  rows: MatrixRow[];
  onSelect: (r: MatrixRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Sin productos en esta categoría para la selección actual. 🎉
      </p>
    );
  }
  const shown = rows.slice(0, RENDER_CAP);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-faint">
            <th className="py-2 pr-2">Producto</th>
            <th className="py-2 px-2">Sucursal</th>
            <th className="py-2 px-2">Clasificación</th>
            <th className="py-2 px-2 text-right">Stock</th>
            <th className="py-2 px-2 text-right">Vend 90d</th>
            <th className="py-2 px-2 text-right">Proy 30d</th>
            <th className="py-2 pl-2 text-right">Vendido S/</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => {
            const clasif = getClasif(row);
            const tone = TONE_STYLES[classifyTone(clasif)];
            return (
              <tr
                key={`${str(row["Sucursal"])}-${str(row["Código SKU"])}-${i}`}
                onClick={() => onSelect(row)}
                className="group cursor-pointer border-b border-border/20 transition-colors hover:bg-surface-3/45"
              >
                <td className="py-2.5 pr-2 min-w-[200px] max-w-[320px]">
                  <p className="truncate font-semibold text-fg group-hover:text-primary">
                    {str(row["Producto"])}
                  </p>
                  <p className="font-mono text-[9px] text-faint">
                    {str(row["Código SKU"])}
                  </p>
                </td>
                <td className="py-2.5 px-2 text-muted">{str(row["Sucursal"])}</td>
                <td className="py-2.5 px-2">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[0.62rem] font-bold leading-tight",
                      tone.chip,
                    )}
                  >
                    {clasif.split(/[:(]/)[0].trim() || "—"}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {num(toNum(row["Stock Disp"]))}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {num(toNum(row["Unds Vend (90d)"]))}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums font-medium text-fg">
                  {num(toNum(row["Proyección 30d"]))}
                </td>
                <td className="py-2.5 pl-2 text-right tabular-nums font-semibold text-fg">
                  {money(toNum(row["Vendido SKU S/"]))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > RENDER_CAP && (
        <p className="mt-3 text-center text-xs text-faint">
          Mostrando los primeros {num(RENDER_CAP)} de {num(rows.length)} (ordenados por prioridad).
        </p>
      )}
    </div>
  );
}
