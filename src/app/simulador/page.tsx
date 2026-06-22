"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search,
  Package,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Zap,
  RotateCcw,
  Calendar,
  TrendingDown,
  TrendingUp,
  Boxes,
} from "lucide-react";
import {
  getProducts,
  getSkuDetail,
  getSkuHistory,
} from "@/lib/api";
import { money, num, num2, pct, dateShort } from "@/lib/format";
import {
  CASCADE_RULES,
  DEFAULT_THRESHOLDS,
  SECTION_LABELS,
  BUCKET_LABELS,
  runCascade,
  type Section,
  type ActionBucket,
  type Thresholds,
  type RuleDef,
} from "@/lib/cascade";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { PeriodSelect } from "@/components/ui/period-select";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { cn } from "@/lib/utils";
import type { SkuDetailRow } from "@/lib/types";

const HISTORY_PERIODS = [
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 365, label: "1 año" },
  { days: 1460, label: "4 años" },
];

export default function SimuladorPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<number | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [historyDays, setHistoryDays] = useState(180);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["A", "B", "E"]));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(false);
  const [groupBy, setGroupBy] = useState<"section" | "bucket">("bucket");

  // Debounce búsqueda (350ms, igual que /productos)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Búsqueda con autocompletado: cuando hay query, mostrar resultados; selección llena selectedSku
  const products = useQuery({
    queryKey: ["simulador-products", debounced],
    queryFn: ({ signal }) => getProducts({ q: debounced, limit: 8 }, signal),
    enabled: debounced.length >= 2 && !selectedSku,
    placeholderData: keepPreviousData,
  });

  const detail = useQuery({
    queryKey: ["sku-detail", selectedSku],
    queryFn: ({ signal }) => getSkuDetail(selectedSku!, signal),
    enabled: !!selectedSku,
    staleTime: 60_000,
  });

  const history = useQuery({
    queryKey: ["sku-history", selectedSku, historyDays, selectedOffice],
    queryFn: ({ signal }) => getSkuHistory(selectedSku!, historyDays, selectedOffice, signal),
    enabled: !!selectedSku,
    staleTime: 60_000,
  });

  // Auto-select primera sucursal cuando llega data nueva. Patrón "during render"
  // sin useEffect (igual que /configuracion): se detecta cambio en data y se
  // sincroniza el estado sin cascada de re-renders.
  const offices = detail.data?.rows.map((r) => r.office_id).join(",") ?? "";
  const [syncedOffices, setSyncedOffices] = useState("");
  if (detail.data && offices !== syncedOffices) {
    setSyncedOffices(offices);
    if (selectedOffice === null && detail.data.rows.length > 0) {
      setSelectedOffice(detail.data.rows[0].office_id);
    }
  }

  const currentRow: SkuDetailRow | null = useMemo(() => {
    if (!detail.data) return null;
    return detail.data.rows.find((r) => r.office_id === selectedOffice) ?? detail.data.rows[0];
  }, [detail.data, selectedOffice]);

  const cascadeRun = useMemo(
    () => (currentRow ? runCascade(currentRow, thresholds) : null),
    [currentRow, thresholds],
  );

  const pickSku = (sku: string) => {
    setSelectedSku(sku);
    setSelectedOffice(null);
    setSearch("");
    setDebounced("");
  };

  const resetThresholds = () => setThresholds(DEFAULT_THRESHOLDS);

  return (
    <div>
      <PageHeader
        title="Simulador de Cascada"
        description="Buscá un SKU, mirá cómo viaja por las 38 reglas y ajustá los umbrales en vivo para entender qué decide su clasificación."
      />

      {/* ────────── BUSCADOR SKU ────────── */}
      <Card className="mb-5">
        <CardBody>
          <Field label="Buscar SKU (código, nombre o ID)">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-faint">
                <Search className="h-4 w-4" />
              </div>
              <Input
                placeholder="ej. EP-9534, 1000-2, Espátula…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (selectedSku) setSelectedSku(null);
                }}
                className="pl-9"
              />
              {!selectedSku && debounced.length >= 2 && products.data?.items?.length ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
                  {products.data.items.flatMap((p) => {
                    const skus = (p.skus ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                    return skus.slice(0, 3).map((s) => (
                      <button
                        key={`${p.bsale_product_id}-${s}`}
                        onClick={() => pickSku(s)}
                        className="block w-full border-b border-border/40 px-3 py-2 text-left text-xs hover:bg-surface-2"
                      >
                        <p className="truncate font-medium text-fg">{p.name}</p>
                        <p className="text-[10px] text-faint">
                          <span className="font-mono">{s}</span> · {p.department ?? "—"} / {p.category ?? "—"}
                        </p>
                      </button>
                    ));
                  })}
                </div>
              ) : null}
            </div>
          </Field>
          {!selectedSku && (
            <p className="mt-2 text-[11px] text-faint">
              Escribí al menos 2 caracteres para buscar. La cascada solo aplica a SKUs con actividad en la matriz operativa.
            </p>
          )}
        </CardBody>
      </Card>

      {!selectedSku ? (
        <EmptyState
          title="Elegí un SKU"
          hint="Probá con EP-9534 (Espátula), 1000-2 (Taper) o 77204702130714 (Galletas) — son los casos testigo de los fixes recientes."
          icon={Package}
        />
      ) : detail.isLoading || (!detail.data && !detail.isError) ? (
        <LoadingState label="Cargando métricas del SKU desde la matriz operativa…" />
      ) : detail.isError ? (
        <ErrorState error={detail.error} />
      ) : detail.data && currentRow ? (
        <SimulatorBody
          sku={selectedSku}
          productName={detail.data.product_name}
          department={detail.data.department}
          category={detail.data.category}
          subcategory={detail.data.subcategory}
          rows={detail.data.rows}
          currentRow={currentRow}
          selectedOffice={selectedOffice}
          setSelectedOffice={setSelectedOffice}
          thresholds={thresholds}
          setThresholds={setThresholds}
          resetThresholds={resetThresholds}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          openSections={openSections}
          setOpenSections={setOpenSections}
          cascadeRun={cascadeRun!}
          showOnlyRelevant={showOnlyRelevant}
          setShowOnlyRelevant={setShowOnlyRelevant}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          history={history.data}
          historyLoading={history.isLoading}
          historyError={history.error}
          historyDays={historyDays}
          setHistoryDays={setHistoryDays}
        />
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Cuerpo del simulador (separado para mantener el component principal limpio)
// ──────────────────────────────────────────────────────────────────────────────

function SimulatorBody(props: {
  sku: string;
  productName: string | null;
  department: string | null;
  category: string | null;
  subcategory: string | null;
  rows: SkuDetailRow[];
  currentRow: SkuDetailRow;
  selectedOffice: number | null;
  setSelectedOffice: (n: number) => void;
  thresholds: Thresholds;
  setThresholds: React.Dispatch<React.SetStateAction<Thresholds>>;
  resetThresholds: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  openSections: Set<string>;
  setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  cascadeRun: ReturnType<typeof runCascade>;
  showOnlyRelevant: boolean;
  setShowOnlyRelevant: (v: boolean) => void;
  groupBy: "section" | "bucket";
  setGroupBy: (v: "section" | "bucket") => void;
  history: { points: { fecha: string; unds_vendidas: number; monto: number; unds_recibidas: number }[] } | undefined;
  historyLoading: boolean;
  historyError: unknown;
  historyDays: number;
  setHistoryDays: (n: number) => void;
}) {
  const m = props.currentRow;
  const matched = props.cascadeRun.matched;
  const matchedRuleId = matched?.id;

  return (
    <>
      {/* ────────── ENCABEZADO + SUCURSAL ────────── */}
      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-faint">SKU</p>
              <h3 className="mt-0.5 text-lg font-semibold text-fg">
                <span className="font-mono">{props.sku}</span>
                {props.productName && <span className="ml-2 text-muted">· {props.productName}</span>}
              </h3>
              <p className="text-xs text-muted">
                {props.department ?? "—"} / {props.category ?? "—"} / {props.subcategory ?? "—"}
              </p>
            </div>
            {props.rows.length > 1 && (
              <div className="flex gap-1.5">
                {props.rows.map((r) => (
                  <button
                    key={r.office_id}
                    onClick={() => props.setSelectedOffice(r.office_id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      props.selectedOffice === r.office_id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:bg-surface-2",
                    )}
                  >
                    {r.sucursal}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ────────── TARJETAS DE MÉTRICAS CLAVE ────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <MetricMini label="Stock disp." value={num2(m.stock.disponible)} hint={`+${num(m.stock.almacen_central)} en almacén`} icon={Boxes} />
        <MetricMini label="Vendido lifetime" value={num(m.lifetime.unds_vendidas)} hint={`recibió ${num(m.lifetime.unds_recibidas)}`} icon={TrendingUp} />
        <MetricMini label="Sell-through" value={m.lifetime.pct_sellthrough == null ? "—" : pct(m.lifetime.pct_sellthrough)} hint="vendido / recibido" />
        <MetricMini label="Absorción lote" value={m.lote.dias_absorcion_lote == null ? "—" : `${m.lote.dias_absorcion_lote}d`} hint="lote 1ª venta → última venta" icon={Calendar} />
        <MetricMini
          label="Días agotado"
          value={
            m.stock.disponible > 0 || m.lote.dias_desde_ultima_recep == null || m.lote.dias_absorcion_lote == null
              ? "—"
              : `${Math.max(0, m.lote.dias_desde_ultima_recep - m.lote.dias_absorcion_lote)}d`
          }
          hint="desde última venta a hoy"
          icon={TrendingDown}
        />
        <MetricMini label="Días sin venta" value={m.ventas_90d.dias_sin_venta_90d == null ? ">90d" : `${m.ventas_90d.dias_sin_venta_90d}d`} hint="ventana 90d" />
        <MetricMini label="Proy/mes (ciclo)" value={m.proyecciones.proy_mes == null ? "—" : num2(m.proyecciones.proy_mes)} hint="velocidad lote completo" />
        <MetricMini label="Proy post-recep" value={m.proyecciones.proy_post_recep == null ? "—" : num2(m.proyecciones.proy_post_recep)} hint="velocidad lote fresco" />
        <MetricMini label="Cob reciente" value={m.proyecciones.dias_cobertura_reciente == null ? "—" : `${m.proyecciones.dias_cobertura_reciente}d`} hint="al ritmo de 30d" />
        <MetricMini label="Cob post-recep" value={m.proyecciones.cob_post_recep == null ? "—" : `${m.proyecciones.cob_post_recep}d`} hint="al ritmo del lote fresco" />
        <MetricMini label="Última recep." value={m.lote.ultima_recepcion ? dateShort(m.lote.ultima_recepcion) : "—"} hint={m.lote.dias_desde_ultima_recep != null ? `hace ${m.lote.dias_desde_ultima_recep}d` : ""} icon={Calendar} />
      </div>

      {/* ────────── RESULTADO DE LA CASCADA (chip grande arriba) ────────── */}
      <ResultBanner matched={matched} />

      {/* ────────── SLIDERS DE UMBRALES ────────── */}
      <ThresholdsPanel
        thresholds={props.thresholds}
        setThresholds={props.setThresholds}
        resetThresholds={props.resetThresholds}
        showAdvanced={props.showAdvanced}
        setShowAdvanced={props.setShowAdvanced}
      />

      {/* ────────── CASCADA AGRUPADA (por sección técnica o por acción de negocio) ────────── */}
      <Card className="mb-5">
        <CardHeader
          title="Cascada de clasificación"
          subtitle="Cada regla muestra su acción de negocio (chip), qué hace cuando dispara y qué condiciones evaluó."
          action={
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
                {([
                  { v: "bucket", l: "Por acción" },
                  { v: "section", l: "Por sección" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => {
                      props.setGroupBy(opt.v);
                      props.setOpenSections(new Set());
                    }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                      props.groupBy === opt.v ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                    )}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              <Button size="sm" variant={props.showOnlyRelevant ? "primary" : "secondary"} onClick={() => props.setShowOnlyRelevant(!props.showOnlyRelevant)}>
                {props.showOnlyRelevant ? "Solo match y previas" : "Todas las reglas"}
              </Button>
            </div>
          }
        />
        <CardBody className="pt-2">
          <CascadeTree
            cascadeRun={props.cascadeRun}
            matched={matched}
            matchedRuleId={matchedRuleId}
            groupBy={props.groupBy}
            openSections={props.openSections}
            setOpenSections={props.setOpenSections}
            showOnlyRelevant={props.showOnlyRelevant}
          />
        </CardBody>
      </Card>

      {/* ────────── GRÁFICO HISTÓRICO ────────── */}
      <Card className="mb-5">
        <CardHeader
          title="Comportamiento histórico del SKU"
          subtitle={`Ventas diarias (línea) y recepciones (dots) · ${props.selectedOffice ? props.rows.find((r) => r.office_id === props.selectedOffice)?.sucursal : "todas las tiendas"}`}
          action={<PeriodSelect value={props.historyDays} onChange={props.setHistoryDays} options={HISTORY_PERIODS} />}
        />
        <CardBody>
          {props.historyLoading ? (
            <LoadingState />
          ) : props.historyError ? (
            <ErrorState error={props.historyError} />
          ) : !props.history || props.history.points.length === 0 ? (
            <EmptyState title="Sin movimientos" hint="No hay ventas ni recepciones en este rango." />
          ) : (
            <HistoryChart points={props.history.points} />
          )}
        </CardBody>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────

function MetricMini({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-surface-2/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] uppercase tracking-wide text-faint">{label}</p>
        {Icon && <Icon className="h-3 w-3 text-faint" />}
      </div>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className="truncate text-[10px] text-faint">{hint}</p>}
    </div>
  );
}

/* Estilos por bucket: chip + borde de tarjeta. Mapeado a los semantic tokens
 * del proyecto para que dark/light mode funcionen sin esfuerzo. */
const BUCKET_STYLES: Record<ActionBucket, { chip: string; border: string; bg: string; bar: string }> = {
  urgente_comprar: { chip: "bg-danger/20 text-danger",  border: "border-danger/60",  bg: "bg-danger/5",   bar: "bg-danger" },
  reponer:         { chip: "bg-info/20 text-info",      border: "border-info/50",    bg: "bg-info/5",     bar: "bg-info" },
  saludable:       { chip: "bg-success/20 text-success",border: "border-success/50", bg: "bg-success/5",  bar: "bg-success" },
  exceso:          { chip: "bg-warning/20 text-warning",border: "border-warning/50", bg: "bg-warning/5",  bar: "bg-warning" },
  liquidar:        { chip: "bg-violet/20 text-violet",  border: "border-violet/50",  bg: "bg-violet/5",   bar: "bg-violet" },
  descatalogar:    { chip: "bg-surface-3 text-muted",   border: "border-border",     bg: "bg-surface-2/30", bar: "bg-surface-3" },
  esperar:         { chip: "bg-surface-3 text-muted",   border: "border-border",     bg: "bg-surface-2/30", bar: "bg-surface-3" },
  evaluar:         { chip: "bg-warning/15 text-warning",border: "border-warning/40", bg: "bg-warning/5",  bar: "bg-warning" },
};

function BucketChip({ bucket, size = "sm" }: { bucket: ActionBucket; size?: "sm" | "md" }) {
  const s = BUCKET_STYLES[bucket];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold uppercase tracking-wide",
        s.chip,
        size === "md" ? "px-2.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-[10px]",
      )}
    >
      {BUCKET_LABELS[bucket]}
    </span>
  );
}

function ResultBanner({ matched }: { matched: RuleDef | null }) {
  if (!matched) {
    return (
      <Card className="mb-5">
        <CardBody className="flex items-center gap-3">
          <X className="h-5 w-5 text-muted" />
          <div>
            <p className="font-semibold text-fg">Sin match</p>
            <p className="text-xs text-muted">Ninguna regla disparó — caso atípico, revisar manual.</p>
          </div>
        </CardBody>
      </Card>
    );
  }
  const s = BUCKET_STYLES[matched.bucket];
  return (
    <div className={cn("mb-5 rounded-xl border-2 px-4 py-3", s.border, s.bg)}>
      <div className="flex items-start gap-3">
        <Zap className="mt-1 h-5 w-5 shrink-0 text-fg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BucketChip bucket={matched.bucket} size="md" />
            <p className="text-base font-semibold text-fg">{matched.short_name}</p>
            <span className="text-[10px] uppercase text-faint">sección {matched.section} · {matched.id}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{matched.description}</p>
          <p className="mt-1.5 text-xs">
            <span className="text-faint">Acción a tomar:</span>{" "}
            <span className="font-semibold text-fg">{matched.action_verb}</span>
          </p>
          {matched.attrs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {matched.attrs.map((a, i) => (
                <span key={i} className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type RuleState = "match" | "fail" | "skipped" | "would-match";

function CascadeTree({
  cascadeRun,
  matched,
  matchedRuleId,
  groupBy,
  openSections,
  setOpenSections,
  showOnlyRelevant,
}: {
  cascadeRun: ReturnType<typeof runCascade>;
  matched: RuleDef | null;
  matchedRuleId: string | undefined;
  groupBy: "section" | "bucket";
  openSections: Set<string>;
  setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  showOnlyRelevant: boolean;
}) {
  const matchedIndex = cascadeRun.trace.findIndex((t) => t.rule.id === matchedRuleId);
  const stateFor = (ruleId: string, traceMatched: boolean): RuleState => {
    if (matchedRuleId === ruleId) return "match";
    const ruleIndex = cascadeRun.trace.findIndex((t) => t.rule.id === ruleId);
    if (matchedIndex >= 0 && ruleIndex > matchedIndex) return "skipped";
    if (traceMatched) return "would-match";
    return "fail";
  };

  // Construir grupos: por sección (A-F) o por bucket de acción.
  const groups: { key: string; label: string; bucket?: ActionBucket; rules: RuleDef[] }[] = [];
  if (groupBy === "section") {
    for (const sec of ["A", "B", "C", "D", "E", "F"] as Section[]) {
      const rules = CASCADE_RULES.filter((r) => r.section === sec);
      groups.push({ key: sec, label: SECTION_LABELS[sec], rules });
    }
  } else {
    const bucketOrder: ActionBucket[] = ["urgente_comprar", "reponer", "saludable", "exceso", "liquidar", "evaluar", "esperar", "descatalogar"];
    for (const b of bucketOrder) {
      const rules = CASCADE_RULES.filter((r) => r.bucket === b);
      if (rules.length === 0) continue;
      groups.push({ key: b, label: BUCKET_LABELS[b], bucket: b, rules });
    }
  }

  return (
    <>
      {groups.map((g) => {
        const isOpen = openSections.has(g.key);
        const matchHere = matched && g.rules.some((r) => r.id === matched.id);
        return (
          <div key={g.key} className="mb-2 last:mb-0">
            <button
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                matchHere ? "bg-success/10 text-fg" : "bg-surface-2 text-fg hover:bg-surface-3",
              )}
              onClick={() =>
                setOpenSections((prev) => {
                  const n = new Set(prev);
                  if (n.has(g.key)) n.delete(g.key);
                  else n.add(g.key);
                  return n;
                })
              }
            >
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {g.bucket && <span className={cn("h-2.5 w-2.5 rounded-full", BUCKET_STYLES[g.bucket].bar)} />}
                {g.label}
                <span className="text-[10px] text-faint">({g.rules.length})</span>
              </span>
              {matchHere && (
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase text-success">
                  <Check className="mr-0.5 inline h-3 w-3" /> match acá
                </span>
              )}
            </button>
            {isOpen && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-border/40 pl-3">
                {g.rules.map((rule) => {
                  const trace = cascadeRun.trace.find((t) => t.rule.id === rule.id);
                  if (!trace) return null;
                  const state = stateFor(rule.id, trace.result.matched);
                  if (showOnlyRelevant && state === "skipped") return null;
                  return <RuleNode key={rule.id} rule={rule} conditions={trace.result.conditions} state={state} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function RuleNode({
  rule,
  conditions,
  state,
}: {
  rule: RuleDef;
  conditions: ReturnType<RuleDef["evaluate"]>["conditions"];
  state: RuleState;
}) {
  const s = BUCKET_STYLES[rule.bucket];
  const stateBadge = {
    match: { cls: "bg-success text-white", label: "MATCH ✓" },
    "would-match": { cls: "bg-info/30 text-info", label: "WOULD MATCH" },
    fail: { cls: "bg-surface-3 text-faint", label: "no aplica" },
    skipped: { cls: "bg-surface-2 text-faint", label: "skip" },
  }[state];
  const wrapStyles = {
    match: cn("border-2", s.border, s.bg),
    "would-match": "border border-info/40 bg-info/5",
    fail: "border border-border bg-surface-2/30",
    skipped: "border border-border/30 bg-surface-2/10 opacity-55",
  }[state];

  const failed = conditions.filter((c) => !c.pass);
  const passed = conditions.filter((c) => c.pass);
  const ordered = state === "fail" || state === "would-match" ? [...failed, ...passed] : conditions;

  return (
    <div className={cn("rounded-lg px-3 py-2.5 transition-colors", wrapStyles)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", s.bar)} />
            <p className="text-[13px] font-semibold leading-tight text-fg">{rule.short_name}</p>
            <BucketChip bucket={rule.bucket} />
          </div>
          <p className="mt-1 text-xs leading-snug text-muted">{rule.description}</p>
          <p className="mt-0.5 text-[11px] text-faint">
            <span className="text-muted">Si dispara:</span> {rule.action_verb}
          </p>
          {rule.attrs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {rule.attrs.map((a, i) => (
                <span key={i} className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase text-faint">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", stateBadge.cls)}>
          {stateBadge.label}
        </span>
      </div>
      <details className="mt-2" open={state === "match"}>
        <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-faint hover:text-muted">
          Condiciones evaluadas ({passed.length}/{conditions.length} pasan)
        </summary>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {ordered.map((cond, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                cond.pass ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
              )}
              title={`${cond.expr} → ${cond.value}${cond.threshold ? ` (umbral ${cond.threshold})` : ""}`}
            >
              {cond.pass ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
              {cond.expr} = <b>{cond.value}</b>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Panel de sliders de umbrales
// ──────────────────────────────────────────────────────────────────────────────

interface SliderDef {
  key: keyof Thresholds;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  group: "primary" | "advanced";
  hint?: string;
}

const SLIDERS: SliderDef[] = [
  { key: "absorption_fast_days", label: "Absorción rápida ≤", min: 15, max: 200, step: 1, unit: "d", group: "primary", hint: "lote agotado en ≤X días = bestseller real (P25)" },
  { key: "sellthrough_bestseller_pct", label: "Sell-through bestseller ≥", min: 50, max: 95, step: 1, unit: "%", group: "primary" },
  { key: "dsv_active", label: "DSV activo ≤", min: 7, max: 90, step: 1, unit: "d", group: "primary", hint: "días sin venta para ser 'activo'" },
  { key: "dsv_paused", label: "DSV pausado ≤", min: 30, max: 180, step: 1, unit: "d", group: "primary" },
  { key: "fresh_lot_days_active", label: "Lote fresco (recep) ≤", min: 7, max: 90, step: 1, unit: "d", group: "primary", hint: "FIX P24 — ventana del lote fresco" },
  { key: "cob_post_recep_critical", label: "Cob post-recep crítica ≤", min: 5, max: 45, step: 1, unit: "d", group: "primary" },
  { key: "proy_post_recep_high", label: "Proy post-recep alta ≥", min: 10, max: 60, step: 1, unit: "/mes", group: "primary" },
  { key: "alta_rotacion_proy", label: "Alta rotación proy ≥", min: 15, max: 60, step: 1, unit: "/mes", group: "primary" },

  // Avanzados
  { key: "proy_post_recep_low", label: "Proy post-recep media ≥", min: 5, max: 30, step: 1, unit: "/mes", group: "advanced" },
  { key: "cob_critical", label: "Cob crítica ≤", min: 5, max: 45, step: 1, unit: "d", group: "advanced" },
  { key: "cob_sano_min", label: "Cob sano min", min: 15, max: 60, step: 1, unit: "d", group: "advanced" },
  { key: "cob_sano_max", label: "Cob sano max", min: 30, max: 90, step: 1, unit: "d", group: "advanced" },
  { key: "cob_exceso_min", label: "Cob exceso ≥", min: 30, max: 120, step: 1, unit: "d", group: "advanced" },
  { key: "dsv_quiebre_max", label: "DSV quiebre ≤", min: 5, max: 30, step: 1, unit: "d", group: "advanced" },
  { key: "lifetime_min_active", label: "Lifetime activo ≥", min: 10, max: 200, step: 5, group: "advanced" },
  { key: "recent_demand_min", label: "Demanda reciente min", min: 1, max: 20, step: 1, group: "advanced" },
  { key: "emergente_v90_min", label: "Emergente vendido 90d ≥", min: 5, max: 50, step: 1, group: "advanced" },
  { key: "residuo_age_days", label: "Edad residuo > ", min: 90, max: 365, step: 30, unit: "d", group: "advanced" },
  { key: "recien_recep_days", label: "Recién recep ≤", min: 3, max: 21, step: 1, unit: "d", group: "advanced" },
  { key: "dsv_ritmo_perdido", label: "DSV ritmo perdido >", min: 21, max: 90, step: 1, unit: "d", group: "advanced" },
  { key: "decay_factor", label: "Factor decaimiento <", min: 0.3, max: 0.9, step: 0.05, group: "advanced" },
  { key: "growth_factor", label: "Factor crecimiento >", min: 1.1, max: 3, step: 0.1, group: "advanced" },
  { key: "lento_cronico_vel_mes_max", label: "Lento crónico vel <", min: 1, max: 15, step: 1, unit: "/mes", group: "advanced" },
  { key: "lento_cronico_lifetime_max", label: "Lento crónico lifetime <", min: 20, max: 200, step: 10, group: "advanced" },
  { key: "adaptive_min", label: "Umbral adaptivo min", min: 1, max: 10, step: 1, group: "advanced" },
  { key: "adaptive_max", label: "Umbral adaptivo max", min: 5, max: 30, step: 1, group: "advanced" },
  { key: "adaptive_factor", label: "Umbral adaptivo factor", min: 0.1, max: 1, step: 0.05, group: "advanced" },
  { key: "nuevo_max_days", label: "Nuevo ≤", min: 3, max: 21, step: 1, unit: "d", group: "advanced" },
  { key: "nuevo_max_sold", label: "Nuevo vendido <", min: 5, max: 50, step: 1, group: "advanced" },
  { key: "temporada_dsv_min", label: "Temporada DSV >", min: 15, max: 90, step: 1, unit: "d", group: "advanced" },
  { key: "stock_bajo_alto", label: "Stock bajo ≤", min: 1, max: 5, step: 1, group: "advanced" },
  { key: "dsv_bajo_quieto_min", label: "Bajo quieto DSV ≥", min: 7, max: 30, step: 1, unit: "d", group: "advanced" },
  { key: "dsv_bajo_quieto_max", label: "Bajo quieto DSV ≤", min: 30, max: 90, step: 1, unit: "d", group: "advanced" },
  { key: "lote_frenado_age_min", label: "Lote frenado edad ≥", min: 60, max: 180, step: 10, unit: "d", group: "advanced" },
  { key: "lote_frenado_recent_max", label: "Lote frenado proy30 <", min: 1, max: 15, step: 1, group: "advanced" },
  { key: "lento_cronico_age_days", label: "Lento crónico edad ≥", min: 90, max: 365, step: 30, unit: "d", group: "advanced" },
  { key: "lento_cronico_days_since_recep", label: "Lento crónico recep ≥", min: 15, max: 90, step: 5, unit: "d", group: "advanced" },
  { key: "lento_cronico_dsv_min", label: "Lento crónico DSV ≥", min: 3, max: 30, step: 1, unit: "d", group: "advanced" },
  { key: "perdida_consumed_pct", label: "Pérdida consumido ≥", min: 20, max: 90, step: 5, unit: "%", group: "advanced" },
  { key: "perdida_sold_max_pct", label: "Pérdida vendido <", min: 5, max: 50, step: 5, unit: "%", group: "advanced" },
  { key: "vendio_con_perdida_min_pct", label: "Vendió-perdió min ≥", min: 10, max: 40, step: 5, unit: "%", group: "advanced" },
  { key: "vendio_con_perdida_max_pct", label: "Vendió-perdió max <", min: 30, max: 70, step: 5, unit: "%", group: "advanced" },
];

function ThresholdsPanel(props: {
  thresholds: Thresholds;
  setThresholds: React.Dispatch<React.SetStateAction<Thresholds>>;
  resetThresholds: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
}) {
  const update = (key: keyof Thresholds, value: number) =>
    props.setThresholds((prev) => ({ ...prev, [key]: value }));
  const primary = SLIDERS.filter((s) => s.group === "primary");
  const advanced = SLIDERS.filter((s) => s.group === "advanced");

  return (
    <Card className="mb-5">
      <CardHeader
        title="Umbrales editables"
        subtitle="Cambios re-evalúan la cascada al instante. La clasificación arriba se actualiza sola."
        action={
          <Button size="sm" variant="secondary" onClick={props.resetThresholds}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset a default SQL
          </Button>
        }
      />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primary.map((s) => (
            <SliderRow key={s.key} def={s} value={props.thresholds[s.key]} onChange={(v) => update(s.key, v)} />
          ))}
        </div>
        <div className="mt-4 border-t border-border/40 pt-3">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
            onClick={() => props.setShowAdvanced(!props.showAdvanced)}
          >
            {props.showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Avanzado ({advanced.length} umbrales más)
          </button>
          {props.showAdvanced && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {advanced.map((s) => (
                <SliderRow key={s.key} def={s} value={props.thresholds[s.key]} onChange={(v) => update(s.key, v)} />
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function SliderRow({
  def,
  value,
  onChange,
}: {
  def: SliderDef;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div title={def.hint}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-muted">{def.label}</span>
        <span className="text-xs font-semibold tabular-nums text-fg">
          {def.step < 1 ? value.toFixed(2) : value}
          {def.unit && <span className="text-faint">{def.unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Gráfico histórico
// ──────────────────────────────────────────────────────────────────────────────

function HistoryChart({ points }: { points: { fecha: string; unds_vendidas: number; monto: number; unds_recibidas: number }[] }) {
  const totalVendido = points.reduce((s, p) => s + p.unds_vendidas, 0);
  const totalRecibido = points.reduce((s, p) => s + p.unds_recibidas, 0);
  const totalMonto = points.reduce((s, p) => s + p.monto, 0);
  const series = points.map((p) => ({
    fecha: p.fecha,
    vendidas: p.unds_vendidas,
    recibidas: p.unds_recibidas,
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        <span><span className="font-medium text-fg">{num(totalVendido)}</span> <span className="text-muted">unds vendidas</span></span>
        <span><span className="font-medium text-fg">{money(totalMonto)}</span> <span className="text-muted">ingresos</span></span>
        <span><span className="font-medium text-fg">{num(totalRecibido)}</span> <span className="text-muted">unds recibidas</span></span>
      </div>
      <TimeSeriesChart
        data={series}
        xKey="fecha"
        series={[
          { key: "vendidas", label: "Ventas (unds)", color: "#22d3ee" },
          { key: "recibidas", label: "Recepciones (unds)", color: "#f5a623" },
        ]}
        xTickFormatter={(v) => {
          const d = new Date(String(v) + "T00:00:00Z");
          return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });
        }}
        valueFormatter={(v) => num(typeof v === "number" ? v : Number(v))}
      />
    </div>
  );
}
