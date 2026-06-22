"use client";

/**
 * Rotación Histórica — Productos vendidos en una ventana arbitraria.
 *
 * Responde "¿qué se vendió más en 2024?", "Top productos del Q4", "Alta
 * rotación en marzo-mayo del año pasado", etc.
 *
 * Backend: GET /analytics/rotacion-historica?from&to&office_id
 * SQL:     04h_rotacion_historica.sql (variante PARAMETRIZABLE del 04b)
 *
 * IMPORTANTE: la clasificación NO reusa las 38 reglas del 04b (dependen del
 * presente: stock actual, días sin venta vs HOY, etc.). Usa una cascada
 * adaptada para retrospectiva histórica: Pareto ABC + frecuencia + tendencia
 * intra-ventana.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  FolderTree,
  History,
  Layers,
  Package,
  Search,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  Wallet,
  X,
} from "lucide-react";

import { getRotacionHistorica } from "@/lib/api";
import { dateShort, money, num, pct } from "@/lib/format";
import { useSucursal } from "@/components/sucursal-context";
import { PageHeader } from "@/components/ui/page-header";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { RotacionHistoricaSku } from "@/lib/types";

const RENDER_CAP = 200;

/* ────────────────────────────────────────────────────────────
 * Presets de período: año completo, trimestre, custom.
 * Las fechas se calculan al render (no se cachean) para que se actualicen al
 * cambiar de año/trimestre sin recargar la app.
 * ──────────────────────────────────────────────────────────── */
type Preset = {
  id: string;
  label: string;
  range: () => { from: string; to: string };
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function quarterRange(year: number, q: 1 | 2 | 3 | 4) {
  const fromMonth = (q - 1) * 3 + 1;
  const toMonth = fromMonth + 2;
  const lastDay = new Date(year, toMonth, 0).getDate();
  return {
    from: `${year}-${String(fromMonth).padStart(2, "0")}-01`,
    to: `${year}-${String(toMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

const CURRENT_YEAR = new Date().getFullYear();
const PRESETS: Preset[] = [
  { id: "anio-actual", label: `Año ${CURRENT_YEAR}`, range: () => yearRange(CURRENT_YEAR) },
  { id: "anio-pasado", label: `Año ${CURRENT_YEAR - 1}`, range: () => yearRange(CURRENT_YEAR - 1) },
  { id: "q4-pasado", label: `Q4 ${CURRENT_YEAR - 1}`, range: () => quarterRange(CURRENT_YEAR - 1, 4) },
  { id: "q3-pasado", label: `Q3 ${CURRENT_YEAR - 1}`, range: () => quarterRange(CURRENT_YEAR - 1, 3) },
  {
    id: "ultimos-180d",
    label: "Últimos 180 días",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 180);
      return { from: isoDate(from), to: isoDate(to) };
    },
  },
];

type ParetoFilter = "todos" | "A" | "B" | "C";

/** Palette for department dots & bars — cycling through 12 distinct hues. */
const DEPT_COLORS = [
  { dot: "bg-emerald-400", bar: "bg-emerald-500", text: "text-emerald-400" },
  { dot: "bg-amber-400", bar: "bg-amber-500", text: "text-amber-400" },
  { dot: "bg-blue-400", bar: "bg-blue-500", text: "text-blue-400" },
  { dot: "bg-violet-400", bar: "bg-violet-500", text: "text-violet-400" },
  { dot: "bg-rose-400", bar: "bg-rose-500", text: "text-rose-400" },
  { dot: "bg-cyan-400", bar: "bg-cyan-500", text: "text-cyan-400" },
  { dot: "bg-orange-400", bar: "bg-orange-500", text: "text-orange-400" },
  { dot: "bg-indigo-400", bar: "bg-indigo-500", text: "text-indigo-400" },
  { dot: "bg-pink-400", bar: "bg-pink-500", text: "text-pink-400" },
  { dot: "bg-teal-400", bar: "bg-teal-500", text: "text-teal-400" },
  { dot: "bg-lime-400", bar: "bg-lime-500", text: "text-lime-400" },
  { dot: "bg-fuchsia-400", bar: "bg-fuchsia-500", text: "text-fuchsia-400" },
];

function tendenciaTone(t: string | null): { Icon: typeof TrendingUpIcon | null; color: string } {
  if (!t) return { Icon: null, color: "text-faint" };
  if (t === "Creciendo" || t === "Inicio en 2ª mitad")
    return { Icon: TrendingUpIcon, color: "text-success" };
  if (t === "Decayendo" || t === "Murió en 1ª mitad")
    return { Icon: TrendingDownIcon, color: "text-danger" };
  return { Icon: null, color: "text-muted" };
}

function paretoTone(p: "A" | "B" | "C"): string {
  if (p === "A") return "bg-success/15 text-success border-success/25";
  if (p === "B") return "bg-info/15 text-info border-info/25";
  return "bg-surface-3 text-muted border-border-soft";
}

function shortClasif(clasif: string): string {
  // Elimina la descripción entre paréntesis para mostrar compacto.
  return clasif.split(/[(]/)[0].trim();
}

/* ────────────────────────────────────────────────────────────
 * Taxonomy filter types — hierarchical: dept → cat → subcat
 * ──────────────────────────────────────────────────────────── */
interface TaxFilter {
  dept: string | null;
  cat: string | null;
  subcat: string | null;
}

const EMPTY_FILTER: TaxFilter = { dept: null, cat: null, subcat: null };

/* ────────────────────────────────────────────────────────────
 * Aggregated tree structures built from SKU data
 * ──────────────────────────────────────────────────────────── */
interface SubcatNode {
  name: string;
  skus: number;
  venta_soles: number;
  unds: number;
}

interface CatNode {
  name: string;
  skus: number;
  venta_soles: number;
  unds: number;
  subcats: SubcatNode[];
}

interface DeptNode {
  name: string;
  skus: number;
  venta_soles: number;
  unds: number;
  cats: CatNode[];
}

function buildTree(skus: RotacionHistoricaSku[]): DeptNode[] {
  const deptMap = new Map<string, {
    skus: Set<string>;
    venta: number;
    unds: number;
    cats: Map<string, {
      skus: Set<string>;
      venta: number;
      unds: number;
      subcats: Map<string, { skus: Set<string>; venta: number; unds: number }>;
    }>;
  }>();

  for (const s of skus) {
    const deptName = s.departamento || "(Sin departamento)";
    const catName = s.categoria || "(Sin categoría)";
    const subcatName = s.subcategoria || "(Sin subcategoría)";
    const skuKey = `${s.sucursal}::${s.sku}`;

    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, { skus: new Set(), venta: 0, unds: 0, cats: new Map() });
    }
    const dept = deptMap.get(deptName)!;
    dept.skus.add(skuKey);
    dept.venta += s.vendido_sku_soles;
    dept.unds += s.unds_vendidas;

    if (!dept.cats.has(catName)) {
      dept.cats.set(catName, { skus: new Set(), venta: 0, unds: 0, subcats: new Map() });
    }
    const cat = dept.cats.get(catName)!;
    cat.skus.add(skuKey);
    cat.venta += s.vendido_sku_soles;
    cat.unds += s.unds_vendidas;

    if (!cat.subcats.has(subcatName)) {
      cat.subcats.set(subcatName, { skus: new Set(), venta: 0, unds: 0 });
    }
    const subcat = cat.subcats.get(subcatName)!;
    subcat.skus.add(skuKey);
    subcat.venta += s.vendido_sku_soles;
    subcat.unds += s.unds_vendidas;
  }

  // Convert to sorted arrays (by venta_soles descending)
  const result: DeptNode[] = [];
  for (const [dName, d] of deptMap) {
    const cats: CatNode[] = [];
    for (const [cName, c] of d.cats) {
      const subcats: SubcatNode[] = [];
      for (const [scName, sc] of c.subcats) {
        subcats.push({ name: scName, skus: sc.skus.size, venta_soles: sc.venta, unds: sc.unds });
      }
      subcats.sort((a, b) => b.venta_soles - a.venta_soles);
      cats.push({ name: cName, skus: c.skus.size, venta_soles: c.venta, unds: c.unds, subcats });
    }
    cats.sort((a, b) => b.venta_soles - a.venta_soles);
    result.push({ name: dName, skus: d.skus.size, venta_soles: d.venta, unds: d.unds, cats });
  }
  result.sort((a, b) => b.venta_soles - a.venta_soles);
  return result;
}

/* ──────────────────────────────────────────────────────────── */

export default function RotacionHistoricaPage() {
  const { officeId, sucursalName } = useSucursal();
  const [presetId, setPresetId] = useState<string>("anio-pasado");
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [paretoFilter, setParetoFilter] = useState<ParetoFilter>("todos");
  const [taxFilter, setTaxFilter] = useState<TaxFilter>(EMPTY_FILTER);
  const [search, setSearch] = useState("");

  const range = useMemo(() => {
    if (presetId === "custom" && customRange) return customRange;
    const preset = PRESETS.find((p) => p.id === presetId);
    return preset ? preset.range() : yearRange(CURRENT_YEAR - 1);
  }, [presetId, customRange]);

  const query = useQuery({
    queryKey: ["rotacion-historica", range.from, range.to, officeId],
    queryFn: ({ signal }) =>
      getRotacionHistorica(range.from, range.to, officeId, signal),
    staleTime: 5 * 60_000,
  });

  const tree = useMemo(() => buildTree(query.data?.skus ?? []), [query.data?.skus]);

  const filteredSkus = useMemo<RotacionHistoricaSku[]>(() => {
    const all = query.data?.skus ?? [];
    const s = search.trim().toLowerCase();
    return all.filter((sku) => {
      if (paretoFilter !== "todos" && sku.pareto !== paretoFilter) return false;
      if (taxFilter.dept && sku.departamento !== taxFilter.dept) return false;
      if (taxFilter.cat && sku.categoria !== taxFilter.cat) return false;
      if (taxFilter.subcat && sku.subcategoria !== taxFilter.subcat) return false;
      if (s) {
        const hay =
          sku.sku.toLowerCase().includes(s) ||
          sku.producto.toLowerCase().includes(s) ||
          (sku.categoria ?? "").toLowerCase().includes(s) ||
          (sku.subcategoria ?? "").toLowerCase().includes(s);
        if (!hay) return false;
      }
      return true;
    });
  }, [query.data?.skus, paretoFilter, taxFilter, search]);

  const handleSelectDept = useCallback((dept: string | null) => {
    setTaxFilter((prev) =>
      prev.dept === dept ? EMPTY_FILTER : { dept, cat: null, subcat: null },
    );
  }, []);

  const handleSelectCat = useCallback((dept: string, cat: string | null) => {
    setTaxFilter((prev) =>
      prev.cat === cat ? { dept, cat: null, subcat: null } : { dept, cat, subcat: null },
    );
  }, []);

  const handleSelectSubcat = useCallback((dept: string, cat: string, subcat: string | null) => {
    setTaxFilter((prev) =>
      prev.subcat === subcat ? { dept, cat, subcat: null } : { dept, cat, subcat },
    );
  }, []);

  const hasFilter = taxFilter.dept !== null;

  /** Active filter breadcrumbs */
  const filterBreadcrumbs = useMemo(() => {
    const parts: { label: string; level: "dept" | "cat" | "subcat" }[] = [];
    if (taxFilter.dept) parts.push({ label: taxFilter.dept, level: "dept" });
    if (taxFilter.cat) parts.push({ label: taxFilter.cat, level: "cat" });
    if (taxFilter.subcat) parts.push({ label: taxFilter.subcat, level: "subcat" });
    return parts;
  }, [taxFilter]);

  return (
    <div>
      <PageHeader
        eyebrow="Reportes · Análisis retrospectivo"
        title="Rotación Histórica"
        description={
          sucursalName
            ? `Productos vendidos en la ventana seleccionada — ${sucursalName}`
            : "Productos vendidos en la ventana seleccionada (consolidado de todas las tiendas)"
        }
      />

      {/* ───────────── Selector de ventana ───────────── */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
              <Calendar className="h-3.5 w-3.5" />
              Período
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPresetId(p.id);
                  setCustomRange(null);
                }}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                  presetId === p.id
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border-soft bg-surface-2 text-muted hover:border-border hover:text-fg",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                if (presetId !== "custom") {
                  // Inicializar custom con la ventana actual
                  const cur = PRESETS.find((p) => p.id === presetId)?.range();
                  setCustomRange(cur ?? yearRange(CURRENT_YEAR - 1));
                  setPresetId("custom");
                }
              }}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                presetId === "custom"
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-border-soft bg-surface-2 text-muted hover:border-border hover:text-fg",
              )}
            >
              Custom
            </button>
          </div>

          {presetId === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-muted">
                Desde
                <input
                  type="date"
                  value={customRange?.from ?? ""}
                  onChange={(e) =>
                    setCustomRange((c) => ({
                      from: e.target.value,
                      to: c?.to ?? e.target.value,
                    }))
                  }
                  className="rounded-md border border-border-soft bg-surface-2 px-2 py-1 text-fg"
                />
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                Hasta
                <input
                  type="date"
                  value={customRange?.to ?? ""}
                  onChange={(e) =>
                    setCustomRange((c) => ({
                      from: c?.from ?? e.target.value,
                      to: e.target.value,
                    }))
                  }
                  className="rounded-md border border-border-soft bg-surface-2 px-2 py-1 text-fg"
                />
              </label>
            </div>
          )}

          <div className="rounded-md bg-surface-2 px-3 py-1.5 text-xs">
            <span className="text-faint">Ventana activa: </span>
            <span className="font-semibold text-fg">
              {dateShort(range.from)} → {dateShort(range.to)}
            </span>
            {query.data?.meta && (
              <span className="ml-2 text-faint">
                ({query.data.meta.dias_ventana} días)
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          {/* ───────────── KPIs ───────────── */}
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiStat
              label="SKUs con venta"
              value={num(query.data?.kpis.skus_con_venta)}
              icon={Package}
              tone="primary"
              loading={query.isLoading}
              sub={
                query.data
                  ? `${num(query.data.kpis.skus_pareto_a)} en Pareto A · ${num(query.data.kpis.skus_pareto_b)} en B · ${num(query.data.kpis.skus_pareto_c)} en C`
                  : null
              }
            />
            <KpiStat
              label="Venta total"
              value={money(query.data?.kpis.venta_soles)}
              icon={Wallet}
              tone="success"
              loading={query.isLoading}
              sub="Monto facturado en la ventana"
            />
            <KpiStat
              label="Unidades vendidas"
              value={num(query.data?.kpis.unds_vendidas)}
              icon={BarChart3}
              tone="info"
              loading={query.isLoading}
              sub="Total de unidades (neto de devoluciones)"
            />
            <KpiStat
              label="Top Pareto A"
              value={num(query.data?.kpis.skus_pareto_a)}
              icon={Award}
              tone="warning"
              loading={query.isLoading}
              sub="SKUs que generan el 80% del ingreso"
            />
          </section>

          {/* ───────────── Layout principal ───────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4">
              {/* ── Taxonomy drill-down ── */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-primary" />
                      Taxonomía
                    </span>
                  }
                  subtitle="Explora departamentos, categorías y subcategorías"
                />
                <CardBody className="space-y-2 pt-3">
                  {/* "All" button */}
                  <button
                    onClick={() => setTaxFilter(EMPTY_FILTER)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs transition-all",
                      !hasFilter
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Layers className={cn("h-3.5 w-3.5 shrink-0", !hasFilter ? "text-primary" : "text-faint")} />
                    <span className="flex-1 font-semibold">Todos los departamentos</span>
                    <span className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                      !hasFilter ? "bg-primary/15 text-primary" : "bg-surface-3 text-faint",
                    )}>
                      {num(query.data?.kpis.skus_con_venta ?? 0)}
                    </span>
                  </button>

                  {/* Active filter breadcrumbs */}
                  {hasFilter && (
                    <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
                      {filterBreadcrumbs.map((bc, i) => (
                        <span key={bc.level} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-faint" />}
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                            bc.level === "dept" ? "bg-primary/10 text-primary" :
                            bc.level === "cat" ? "bg-accent/10 text-accent" :
                            "bg-violet/10 text-violet",
                          )}>
                            {bc.label}
                            <button
                              onClick={() => {
                                if (bc.level === "dept") setTaxFilter(EMPTY_FILTER);
                                else if (bc.level === "cat") setTaxFilter((p) => ({ ...p, cat: null, subcat: null }));
                                else setTaxFilter((p) => ({ ...p, subcat: null }));
                              }}
                              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/10"
                              aria-label={`Quitar filtro ${bc.label}`}
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tree */}
                  {query.isLoading ? (
                    <LoadingState label="Cargando…" />
                  ) : (
                    <TaxonomyTree
                      tree={tree}
                      filter={taxFilter}
                      onSelectDept={handleSelectDept}
                      onSelectCat={handleSelectCat}
                      onSelectSubcat={handleSelectSubcat}
                    />
                  )}
                </CardBody>
              </Card>

              {/* ── Clasificación summary ── */}
              <Card>
                <CardHeader title="Por clasificación" />
                <CardBody className="pt-3">
                  {query.isLoading ? (
                    <LoadingState label="Cargando…" />
                  ) : query.data?.por_clasificacion?.length ? (
                    <ul className="space-y-1.5 text-xs">
                      {query.data.por_clasificacion.map((c) => (
                        <li
                          key={c.clasificacion}
                          className="flex items-start justify-between gap-3 rounded px-2 py-1.5 hover:bg-surface-2"
                        >
                          <span className="text-muted leading-tight">
                            {shortClasif(c.clasificacion)}
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold text-primary">
                            {num(c.skus)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-center text-xs text-faint">Sin datos</p>
                  )}
                </CardBody>
              </Card>
            </aside>

            <main>
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Catálogo histórico
                      {hasFilter && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {taxFilter.subcat ?? taxFilter.cat ?? taxFilter.dept}
                          <button
                            onClick={() => setTaxFilter(EMPTY_FILTER)}
                            className="hover:text-primary/70"
                            aria-label="Quitar filtro"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      )}
                    </span>
                  }
                  subtitle={
                    query.data
                      ? `Mostrando ${num(filteredSkus.length)} de ${num(query.data.kpis.skus_con_venta)} SKUs`
                      : "Cargando…"
                  }
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                        <input
                          type="search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar SKU, producto…"
                          className="h-8 w-44 rounded-md border border-border-soft bg-surface-2 pl-8 pr-2 text-xs text-fg placeholder:text-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                      </label>
                      <div className="inline-flex rounded-md border border-border-soft bg-surface-2 p-0.5">
                        {(["todos", "A", "B", "C"] as ParetoFilter[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setParetoFilter(p)}
                            className={cn(
                              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                              paretoFilter === p
                                ? p === "A"
                                  ? "bg-success/15 text-success"
                                  : p === "B"
                                    ? "bg-info/15 text-info"
                                    : p === "C"
                                      ? "bg-surface-3 text-fg"
                                      : "bg-primary/10 text-primary"
                                : "text-muted hover:text-fg",
                            )}
                          >
                            {p === "todos" ? "Todos" : `Pareto ${p}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  }
                />
                <CardBody className="pt-0">
                  {query.isLoading ? (
                    <LoadingState label="Calculando rotación histórica…" />
                  ) : filteredSkus.length === 0 ? (
                    <EmptyState
                      title="Sin SKUs para los filtros actuales"
                      hint="Cambiá la ventana, el departamento o el filtro Pareto."
                      icon={AlertCircle}
                    />
                  ) : (
                    <SkuTable rows={filteredSkus} />
                  )}
                </CardBody>
              </Card>
            </main>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  Taxonomy Drill-Down Tree                                    */
/* ──────────────────────────────────────────────────────────── */

function TaxonomyTree({
  tree,
  filter,
  onSelectDept,
  onSelectCat,
  onSelectSubcat,
}: {
  tree: DeptNode[];
  filter: TaxFilter;
  onSelectDept: (dept: string | null) => void;
  onSelectCat: (dept: string, cat: string | null) => void;
  onSelectSubcat: (dept: string, cat: string, subcat: string | null) => void;
}) {
  // Track which departments and categories are expanded (independent of filter selection)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleDept = useCallback((dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }, []);

  const toggleCat = useCallback((catKey: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) next.delete(catKey);
      else next.add(catKey);
      return next;
    });
  }, []);

  if (tree.length === 0) {
    return <p className="py-4 text-center text-xs text-faint">Sin datos de departamentos</p>;
  }

  const maxVenta = tree[0]?.venta_soles || 1;

  return (
    <div className="space-y-0.5">
      {tree.map((dept, deptIdx) => {
        const isSelectedDept = filter.dept === dept.name;
        const isExpanded = expandedDepts.has(dept.name) || isSelectedDept;
        const colorSet = DEPT_COLORS[deptIdx % DEPT_COLORS.length];
        const barPct = Math.max(4, Math.round((dept.venta_soles / maxVenta) * 100));

        return (
          <div key={dept.name} className="group/dept">
            {/* Department row */}
            <div className={cn(
              "flex items-center rounded-lg transition-all",
              isSelectedDept && !filter.cat ? "bg-primary/8 ring-1 ring-primary/15" : "hover:bg-surface-2",
            )}>
              {/* Expand chevron */}
              <button
                onClick={() => toggleDept(dept.name)}
                className="flex h-8 w-7 shrink-0 items-center justify-center text-faint transition-colors hover:text-fg"
                aria-label={isExpanded ? "Colapsar" : "Expandir"}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                />
              </button>

              {/* Department button */}
              <button
                onClick={() => onSelectDept(dept.name)}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2.5 text-left"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", colorSet.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "truncate text-xs font-medium",
                      isSelectedDept && !filter.cat ? "text-fg" : "text-fg/85",
                    )}>
                      {dept.name}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-faint">
                      {num(dept.skus)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", colorSet.bar)}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted">
                      {money(dept.venta_soles)}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Categories (expandable) */}
            {isExpanded && dept.cats.length > 0 && (
              <div className="animate-tree-expand ml-3 border-l border-border-soft/60 pl-1">
                {dept.cats.map((cat) => {
                  const catKey = `${dept.name}::${cat.name}`;
                  const isSelectedCat = isSelectedDept && filter.cat === cat.name;
                  const isCatExpanded = expandedCats.has(catKey) || isSelectedCat;
                  const catMaxVenta = dept.cats[0]?.venta_soles || 1;
                  const catBarPct = Math.max(4, Math.round((cat.venta_soles / catMaxVenta) * 100));

                  return (
                    <div key={cat.name}>
                      {/* Category row */}
                      <div className={cn(
                        "flex items-center rounded-md transition-all",
                        isSelectedCat && !filter.subcat
                          ? "bg-accent/8 ring-1 ring-accent/15"
                          : "hover:bg-surface-2/70",
                      )}>
                        {/* Expand chevron for subcats */}
                        <button
                          onClick={() => toggleCat(catKey)}
                          className={cn(
                            "flex h-7 w-6 shrink-0 items-center justify-center text-faint transition-colors hover:text-fg",
                            cat.subcats.length === 0 && "invisible",
                          )}
                          aria-label={isCatExpanded ? "Colapsar" : "Expandir"}
                        >
                          <ChevronRight
                            className={cn(
                              "h-2.5 w-2.5 transition-transform duration-200",
                              isCatExpanded && "rotate-90",
                            )}
                          />
                        </button>

                        {/* Category button */}
                        <button
                          onClick={() => onSelectCat(dept.name, cat.name)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-2 text-left"
                        >
                          <ChevronDown className={cn(
                            "h-2.5 w-2.5 shrink-0 transition-colors",
                            isSelectedCat ? "text-accent" : "text-faint",
                          )} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "truncate text-[11px]",
                                isSelectedCat && !filter.subcat
                                  ? "font-semibold text-accent"
                                  : "font-medium text-muted",
                              )}>
                                {cat.name}
                              </span>
                              <span className="shrink-0 text-[10px] tabular-nums text-faint">
                                {num(cat.skus)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-3">
                                <div
                                  className="h-full rounded-full bg-accent/60 transition-all duration-500"
                                  style={{ width: `${catBarPct}%` }}
                                />
                              </div>
                              <span className="shrink-0 text-[9px] tabular-nums text-faint">
                                {money(cat.venta_soles)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Subcategories (expandable) */}
                      {isCatExpanded && cat.subcats.length > 0 && (
                        <div className="animate-tree-expand ml-4 border-l border-border-soft/40 pl-1">
                          {cat.subcats.map((subcat) => {
                            const isSelectedSubcat =
                              isSelectedCat && filter.subcat === subcat.name;
                            const subMaxVenta = cat.subcats[0]?.venta_soles || 1;
                            const subBarPct = Math.max(
                              4,
                              Math.round((subcat.venta_soles / subMaxVenta) * 100),
                            );

                            return (
                              <button
                                key={subcat.name}
                                onClick={() =>
                                  onSelectSubcat(dept.name, cat.name, subcat.name)
                                }
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded-md py-1.5 pl-2 pr-2 text-left transition-all",
                                  isSelectedSubcat
                                    ? "bg-violet/8 ring-1 ring-violet/15"
                                    : "hover:bg-surface-2/50",
                                )}
                              >
                                <span className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  isSelectedSubcat ? "bg-violet" : "bg-surface-3",
                                )} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={cn(
                                      "truncate text-[10px]",
                                      isSelectedSubcat
                                        ? "font-semibold text-violet"
                                        : "text-faint",
                                    )}>
                                      {subcat.name}
                                    </span>
                                    <span className="shrink-0 text-[9px] tabular-nums text-faint">
                                      {num(subcat.skus)}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-surface-3/60">
                                      <div
                                        className="h-full rounded-full bg-violet/50 transition-all duration-500"
                                        style={{ width: `${subBarPct}%` }}
                                      />
                                    </div>
                                    <span className="shrink-0 text-[9px] tabular-nums text-faint">
                                      {money(subcat.venta_soles)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  SKU Table                                                   */
/* ──────────────────────────────────────────────────────────── */

function SkuTable({ rows }: { rows: RotacionHistoricaSku[] }) {
  const shown = rows.slice(0, RENDER_CAP);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-faint">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Producto</th>
            <th className="py-2 px-2">Pareto</th>
            <th className="py-2 px-2 text-right">Unds</th>
            <th className="py-2 px-2 text-right">Vendido S/</th>
            <th className="py-2 px-2 text-right">% Cat</th>
            <th className="py-2 px-2 text-right">Vel u/día</th>
            <th className="py-2 px-2 text-right">Días vendió</th>
            <th className="py-2 pl-2">Tendencia</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => {
            const { Icon: TendIcon, color: tendColor } = tendenciaTone(s.tendencia);
            return (
              <tr
                key={`${s.sucursal}-${s.sku}`}
                className="group border-b border-border/20 transition-colors hover:bg-surface-3/45"
              >
                <td className="py-2.5 pr-2 text-right tabular-nums text-faint">
                  {s.rank_sucursal}
                </td>
                <td className="py-2.5 pr-2 min-w-[220px] max-w-[340px]">
                  <p className="truncate font-semibold text-fg">{s.producto}</p>
                  <p className="font-mono text-[9px] text-faint">
                    {s.sku}
                    {s.categoria ? ` · ${s.categoria}` : ""}
                    {s.subcategoria ? ` · ${s.subcategoria}` : ""}
                  </p>
                </td>
                <td className="py-2.5 px-2">
                  <span
                    className={cn(
                      "inline-block rounded border px-1.5 py-0.5 text-[0.62rem] font-bold",
                      paretoTone(s.pareto),
                    )}
                  >
                    {s.pareto} · {pct(s.pct_acum)}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {num(s.unds_vendidas)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-fg">
                  {money(s.vendido_sku_soles)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {pct(s.pct_en_cat)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {s.velocidad_uds_dia.toFixed(2)}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                  {num(s.dias_con_venta)}{" "}
                  <span className="text-[10px] text-faint">
                    ({pct(s.pct_frecuencia)})
                  </span>
                </td>
                <td className="py-2.5 pl-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px]",
                      tendColor,
                    )}
                  >
                    {TendIcon ? <TendIcon className="h-3 w-3" /> : null}
                    {s.tendencia ?? "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > RENDER_CAP && (
        <p className="mt-3 text-center text-xs text-faint">
          Mostrando los primeros {num(RENDER_CAP)} de {num(rows.length)}. Refiná los filtros para ver el resto.
        </p>
      )}
    </div>
  );
}
