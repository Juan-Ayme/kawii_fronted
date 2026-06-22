"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Tag,
  Receipt,
  Wallet,
  AlertTriangle,
  Target,
  Save,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import {
  getWeeklyBoard,
  getSalesVsGoal,
  setGoals,
  dailyReportExcelUrl,
  comprasCatalogoExcelUrl,
  getMatrixActionGroups,
} from "@/lib/api";
import { money, num, pct } from "@/lib/format";
import {
  toNum,
  str,
  getClasif,
  classifyTone,
  TONE_STYLES,
  type MatrixRow,
} from "@/lib/matrix-classify";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { PeriodSelect } from "@/components/ui/period-select";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { useSucursal } from "@/components/sucursal-context";
import { cn } from "@/lib/utils";
import type { GoalRow, SalesVsGoal } from "@/lib/types";

const BOARD_PERIODS = [
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
];



function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/* Etiqueta de día corta en UTC para los ejes de los gráficos (BSale etiqueta a
   medianoche UTC; sin esto, en un huso negativo como Lima se corrían un día). */
function dayLabelUTC(v: unknown): string {
  const s = String(v).slice(0, 10);
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export default function TableroSemanalPage() {
  const { officeId, sucursalName } = useSucursal();
  const [days, setDays] = useState(7);

  const board = useQuery({
    queryKey: ["weekly-board", days, officeId],
    queryFn: ({ signal }) => getWeeklyBoard(days, officeId, null, signal),
    staleTime: 60_000,
  });

  // Excel del Informe Diario — solo mes en curso (el backend fuerza el mes actual).
  const downloadDailyReport = () => {
    const url = dailyReportExcelUrl({ office_id: officeId });
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Excel Compras & Catálogo — quiebres reales (venta perdida HOY) + ranking categorías.
  const downloadComprasCatalogo = () => {
    const url = comprasCatalogoExcelUrl({ days, office_id: officeId });
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const data = board.data;
  const k = data?.kpi_resumen;
  const meta = data?.venta_vs_meta;

  // Series para gráficos (coerción a número: la API puede mandar NUMERIC como string).
  const serieTicket = useMemo(
    () =>
      (data?.ticket_promedio.serie_diaria ?? []).map((r) => ({
        dia: String(r.dia).slice(0, 10),
        valor: toNum(r.ticket_promedio),
      })),
    [data],
  );
  const serieTrx = useMemo(
    () =>
      (data?.transacciones.serie_diaria ?? []).map((r) => ({
        dia: String(r.dia).slice(0, 10),
        valor: toNum(r.tickets),
      })),
    [data],
  );
  const catData = useMemo(
    () =>
      (data?.venta_por_categoria ?? [])
        .map((c) => ({
          categoria: c.categoria ?? "—",
          departamento: c.departamento ?? "—",
          ventas: toNum(c.ventas),
          participacion_pct: toNum(c.participacion_pct),
        }))
        .sort((a, b) => b.ventas - a.ventas),
    [data],
  );

  return (
    <div>
      <PageHeader
        title="Tablero Semanal"
        description={`Los 5 KPIs de revisión · ${sucursalName ?? "todas las tiendas"} · el día en curso es parcial`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodSelect value={days} onChange={setDays} options={BOARD_PERIODS} />
            <Button
              variant="secondary"
              onClick={downloadComprasCatalogo}
              disabled={!data}
              title="Excel jerárquico por departamento: SKUs en quiebre HOY + venta por categoría"
            >
              <Download className="h-4 w-4" /> Excel Compras & Catálogo
            </Button>
            <Button
              onClick={downloadDailyReport}
              disabled={!data}
              title="Excel del mes en curso: ticket promedio, transacciones y venta vs meta — todo día a día"
            >
              <Download className="h-4 w-4" /> Excel Informe Diario
            </Button>
          </div>
        }
      />

      {board.isError ? (
        <ErrorState error={board.error} />
      ) : (
        <>
          {/* ─────────── KPIs ─────────── */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiStat
              label="Ticket promedio"
              value={money(k?.ticket_promedio)}
              icon={Tag}
              tone="info"
              loading={board.isLoading}
              sub={`últimos ${days} días`}
            />
            <KpiStat
              label="N° transacciones"
              value={num(k?.transacciones)}
              icon={Receipt}
              tone="primary"
              loading={board.isLoading}
              sub={`últimos ${days} días`}
            />
            <KpiStat
              label="Ventas del período"
              value={money(k?.ventas)}
              icon={Wallet}
              tone="success"
              loading={board.isLoading}
              sub={`últimos ${days} días`}
            />
            <KpiStat
              label="Quiebre con demanda"
              value={num(k?.skus_en_quiebre_con_demanda)}
              icon={AlertTriangle}
              tone="danger"
              loading={board.isLoading}
              sub={`de ${num(k?.skus_en_quiebre)} agotados`}
            />
            <KpiStat
              label="Avance vs meta"
              value={k?.avance_meta_pct == null ? "—" : pct(k.avance_meta_pct)}
              icon={Target}
              tone="warning"
              loading={board.isLoading}
              sub={meta ? `${meta.month} · día ${meta.dias_transcurridos}/${meta.dias_del_mes}` : ""}
            />
          </div>

          {/* ─────────── Ticket promedio + Transacciones (diario) ─────────── */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Ticket promedio diario" subtitle="Valor por ticket (S/)" />
              <CardBody>
                {board.isLoading ? (
                  <LoadingState />
                ) : serieTicket.length === 0 ? (
                  <EmptyState />
                ) : (
                  <TimeSeriesChart
                    data={serieTicket}
                    xKey="dia"
                    series={[{ key: "valor", label: "Ticket promedio" }]}
                    xTickFormatter={dayLabelUTC}
                    valueFormatter={(v) => money(v)}
                  />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="N° de transacciones por día" subtitle="Tickets emitidos (tráfico)" />
              <CardBody>
                {board.isLoading ? (
                  <LoadingState />
                ) : serieTrx.length === 0 ? (
                  <EmptyState />
                ) : (
                  <TimeSeriesChart
                    data={serieTrx}
                    xKey="dia"
                    series={[{ key: "valor", label: "Transacciones", color: "#6366f1" }]}
                    xTickFormatter={dayLabelUTC}
                    valueFormatter={(v) => num(v)}
                  />
                )}
              </CardBody>
            </Card>
          </div>

          {/* ─────────── Venta por categoría ─────────── */}
          <Card className="mb-6">
            <CardHeader
              title="Venta por categoría"
              subtitle={`Participación en ventas · ${sucursalName ?? "todas las tiendas"}`}
            />
            <CardBody>
              {board.isLoading ? (
                <LoadingState />
              ) : catData.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <CategoryBarChart
                    data={catData.slice(0, 10)}
                    categoryKey="categoria"
                    valueKey="ventas"
                    valueLabel="Ventas"
                    valueFormatter={(v) => money(v)}
                    colorful
                  />
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-faint">
                          <th className="py-2 pr-2">Categoría</th>
                          <th className="py-2 px-2 text-right">Ventas</th>
                          <th className="py-2 pl-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catData.map((c, i) => (
                          <tr key={i} className="border-b border-border/20">
                            <td className="py-2 pr-2">
                              <p className="truncate font-medium text-fg">{c.categoria}</p>
                              <p className="text-[9px] text-faint">{c.departamento}</p>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-fg">{money(c.ventas)}</td>
                            <td className="py-2 pl-2 text-right tabular-nums text-muted">{pct(c.participacion_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ─────────── Venta acumulada vs meta ─────────── */}
          <MetaSection meta={meta} loading={board.isLoading} />

          {/* ─────────── SKUs en quiebre ─────────── */}
          <QuiebreCard />
        </>
      )}
    </div>
  );
}

/* ─────────────────────── Venta vs meta ─────────────────────── */
function ritmoTone(ritmo: number | null): { bar: string; text: string } {
  if (ritmo == null) return { bar: "bg-surface-3", text: "text-faint" };
  if (ritmo >= 100) return { bar: "bg-success", text: "text-success" };
  if (ritmo >= 85) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-danger", text: "text-danger" };
}

function ProgressBar({ value, bar }: { value: number | null; bar: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

function MetaRowCard({ row }: { row: GoalRow }) {
  const tone = ritmoTone(row.cumplimiento_vs_ritmo_pct);
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-fg">{row.sucursal}</p>
        <span className={cn("shrink-0 text-xs font-bold tabular-nums", tone.text)}>
          {row.avance_pct == null ? "sin meta" : pct(row.avance_pct)}
        </span>
      </div>
      <div className="my-2">
        <ProgressBar value={row.avance_pct} bar={tone.bar} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>Acum: <b className="text-fg">{money(row.venta_acumulada)}</b></span>
        <span>Meta: <b className="text-fg">{row.meta == null ? "—" : money(row.meta)}</b></span>
        <span>Proy: <b className="text-fg">{row.proyeccion_cierre_mes == null ? "—" : money(row.proyeccion_cierre_mes)}</b></span>
      </div>
    </div>
  );
}

function MetaSection({ meta, loading }: { meta?: SalesVsGoal; loading: boolean }) {
  const sinMeta = meta && meta.global.meta == null;
  return (
    <Card className="mb-6">
      <CardHeader
        title="Venta acumulada vs meta"
        subtitle={
          meta
            ? `${meta.month} · día ${meta.dias_transcurridos} de ${meta.dias_del_mes} · meta ${
                meta.meta_source === "no_configurada" ? "no configurada" : meta.meta_source
              }`
            : "Mes en curso"
        }
        action={<MetaEditor />}
      />
      <CardBody>
        {loading ? (
          <LoadingState />
        ) : !meta ? (
          <EmptyState />
        ) : sinMeta ? (
          <EmptyState
            title="Meta no configurada"
            hint="Usa el botón “Cargar meta” para definir la meta mensual por sucursal y ver el avance."
            icon={Target}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetaRowCard 
              row={{ 
                ...meta.global, 
                sucursal: meta.global.office_id != null ? meta.global.sucursal : "TODAS LAS TIENDAS" 
              }} 
            />
            {meta.global.office_id == null && meta.por_sucursal.map((r) => (
              <MetaRowCard key={r.office_id ?? "g"} row={r} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* Formatea "2026-06" -> "Junio 2026" (es-PE). */
function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  if (!y || !m) return yyyymm;
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Editor de metas (manual). Persiste en la API (PUT /analytics/goals → app_config).
 *
 * Mes FIJO al actual: se removió el picker porque generaba confusión al cargar
 * metas de meses incorrectos. Si necesitás cargar otro mes, agregar un selector
 * acotado (mes actual + siguiente).
 */
function MetaEditor() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const month = currentMonth();
  const [globalInput, setGlobalInput] = useState("");
  const [offInputs, setOffInputs] = useState<Record<number, string>>({});
  const [syncedKey, setSyncedKey] = useState<string | null>(null);

  // Lista de sucursales + metas actuales del mes (SIEMPRE todas las tiendas).
  const q = useQuery({
    queryKey: ["sales-vs-goal-edit", month],
    queryFn: ({ signal }) => getSalesVsGoal(month, null, signal),
    enabled: open,
  });

  // Sincroniza inputs con la data del server (patrón de Configuración: durante render).
  const dataKey = q.data
    ? `${month}:${q.data.global.meta}:${JSON.stringify(
        q.data.por_sucursal.map((r) => [r.office_id, r.meta]),
      )}`
    : null;
  if (q.data && dataKey !== syncedKey) {
    setSyncedKey(dataKey);
    setGlobalInput(q.data.global.meta != null ? String(q.data.global.meta) : "");
    const m: Record<number, string> = {};
    for (const r of q.data.por_sucursal) {
      if (r.office_id != null) m[r.office_id] = r.meta != null ? String(r.meta) : "";
    }
    setOffInputs(m);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const offices: Record<string, number> = {};
      for (const [oid, v] of Object.entries(offInputs)) {
        const n = Number(v);
        if (v !== "" && Number.isFinite(n)) offices[oid] = n;
      }
      const g = Number(globalInput);
      return setGoals({
        month,
        meta_global: globalInput !== "" && Number.isFinite(g) ? g : null,
        offices,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weekly-board"] });
      qc.invalidateQueries({ queryKey: ["sales-vs-goal-edit"] });
    },
  });

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <Target className="h-4 w-4" /> Cargar meta
        <ChevronDown className="h-3 w-3 opacity-60" />
      </Button>
      {open && (
        <>
          {/* Backdrop oscuro (modal real) — el panel queda centrado y NO se cierra al
              tipear en inputs ni al abrir el picker nativo de tipo month. */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-2xl animate-in"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-fg">Meta mensual por sucursal (S/)</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-[11px] text-faint">
              Cargá la meta de cada tienda para el mes en curso. La global se calcula
              como suma si la dejás vacía.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                  Mes
                </span>
                <span className="text-sm font-semibold text-fg">
                  {monthLabel(month)}{" "}
                  <span className="text-[10px] font-normal text-faint">(mes en curso)</span>
                </span>
              </div>
              {q.isLoading ? (
                <LoadingState label="Cargando sucursales…" />
              ) : q.isError ? (
                <ErrorState error={q.error} />
              ) : (q.data?.por_sucursal?.length ?? 0) === 0 ? (
                <EmptyState
                  title="Sin sucursales disponibles"
                  hint="El backend no devolvió sucursales para este mes. Revisá la configuración de oficinas activas."
                  icon={Target}
                />
              ) : (
                <>
                  {(q.data?.por_sucursal ?? []).map(
                    (r) =>
                      r.office_id != null && (
                        <Field key={r.office_id} label={`${r.sucursal} (office ${r.office_id})`}>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={offInputs[r.office_id] ?? ""}
                            onChange={(e) =>
                              setOffInputs((p) => ({ ...p, [r.office_id as number]: e.target.value }))
                            }
                          />
                        </Field>
                      ),
                  )}
                  <Field label="Meta global (opcional — si vacío, suma de tiendas)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="auto"
                      value={globalInput}
                      onChange={(e) => setGlobalInput(e.target.value)}
                    />
                  </Field>
                </>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {mutation.isSuccess ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <Check className="h-3.5 w-3.5" /> Guardado
                  </span>
                ) : (
                  <span className="text-[11px] text-faint">Se aplica al instante.</span>
                )}
                <Button size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending}>
                  <Save className="h-4 w-4" /> Guardar
                </Button>
              </div>
              {mutation.isError && (
                <p className="text-[11px] text-danger">
                  {mutation.error instanceof Error ? mutation.error.message : "Error al guardar"}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────── SKUs en quiebre (Matriz KAWII 90d) ─────────────────────── */
function QuiebreCard() {
  const { sucursalName } = useSucursal();
  const MODULE = "04b";

  const actions = useQuery({
    queryKey: ["matrix-action-groups", MODULE],
    queryFn: ({ signal }) => getMatrixActionGroups(MODULE, signal),
    staleTime: 5 * 60_000,
  });

  const [soloUrgentes, setSoloUrgentes] = useState(true);

  const { rows, urgentesCount } = useMemo(() => {
    if (!actions.data?.groups) return { rows: [] as MatrixRow[], urgentesCount: 0 };
    const allRows = Object.values(actions.data.groups).flat() as MatrixRow[];

    // Filtrar físicos en cero (quiebre real)
    let quiebres = allRows.filter((r: MatrixRow) => toNum(r["Stock Disp"]) <= 0);

    // Filtrar por sucursal
    if (sucursalName) {
      const s = sucursalName.toLowerCase();
      quiebres = quiebres.filter((r: MatrixRow) =>
        str(r["Sucursal"]).toLowerCase().includes(s),
      );
    }

    // Identificar urgentes vs muertos
    let urgentes = 0;
    for (const r of quiebres) {
      const c = getClasif(r).toLowerCase();
      if (c.includes("bestseller") || c.includes("oportunidad")) urgentes++;
    }

    quiebres.sort(
      (a: MatrixRow, b: MatrixRow) =>
        toNum(b["Proyección 30d"]) - toNum(a["Proyección 30d"]) ||
        toNum(b["Unds Vend (90d)"]) - toNum(a["Unds Vend (90d)"]),
    );

    return { rows: quiebres, urgentesCount: urgentes };
  }, [actions.data, sucursalName]);

  const shownRows = useMemo(() => {
    let r = rows;
    if (soloUrgentes) {
      r = r.filter((row: MatrixRow) => {
        const c = getClasif(row).toLowerCase();
        return c.includes("bestseller") || c.includes("oportunidad");
      });
    }
    return r.slice(0, 200);
  }, [rows, soloUrgentes]);

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-danger" /> SKUs en quiebre (Inteligencia Matriz 90d)
          </span>
        }
        subtitle="Analiza los últimos 90 días (independiente del calendario arriba) para detectar verdaderos Bestsellers agotados."
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-danger/15 px-2 py-1 text-xs font-bold text-danger tabular-nums">
              {num(urgentesCount)} urgentes
            </span>
            <span className="rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-muted tabular-nums">
              {num(rows.length)} agotados
            </span>
            <Button
              size="sm"
              variant={soloUrgentes ? "primary" : "secondary"}
              onClick={() => setSoloUrgentes((v) => !v)}
              disabled={actions.isLoading}
            >
              {soloUrgentes ? "Solo urgentes" : "Todos"}
            </Button>
          </div>
        }
      />
      <CardBody className="pt-0">
        {actions.isLoading ? (
          <LoadingState />
        ) : shownRows.length === 0 ? (
          <EmptyState title="Sin quiebres" hint="No hay SKUs agotados con la selección actual." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-faint">
                  <th className="py-2 pr-2">Producto</th>
                  <th className="py-2 px-2">Sucursal</th>
                  <th className="py-2 px-2 min-w-[160px]">Clasificación</th>
                  <th className="py-2 px-2 text-right">Vend 90d</th>
                  <th className="py-2 px-2 text-right">Proy 30d</th>
                  <th className="py-2 pl-2">Última venta</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((s, i) => {
                  const sku = str(s["Código SKU"]);
                  const clasif = getClasif(s);
                  const tone = TONE_STYLES[classifyTone(clasif)];
                  return (
                    <tr
                      key={`${s.Sucursal}-${sku}-${i}`}
                      className="border-b border-border/20 hover:bg-surface-3/40"
                    >
                      <td className="py-2.5 pr-2 min-w-[200px] max-w-[320px]">
                        <p className="truncate font-semibold text-fg">{str(s["Producto"])}</p>
                        <p className="font-mono text-[9px] text-faint">{sku}</p>
                      </td>
                      <td className="py-2.5 px-2 text-muted">{str(s["Sucursal"])}</td>
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
                      <td className="py-2.5 px-2 text-right tabular-nums text-fg font-medium">
                        {num(toNum(s["Unds Vend (90d)"]))}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                        {num(toNum(s["Proyección 30d"]))}
                      </td>
                      <td className="py-2.5 pl-2 text-muted">{str(s["Última Venta"]) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 200 && (
              <p className="mt-3 text-center text-xs text-faint">
                Mostrando 200 de {num(rows.length)}. Revisa la matriz completa para más detalle.
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
