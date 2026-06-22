"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Search,
  Sparkles,
  Activity,
  Flame,
  TrendingUp,
  AlertTriangle,
  Box,
  Snail,
  Skull,
  Sprout,
  ChevronRight,

  FolderOpen,
  Tag,
  Layers,
  Package,
} from "lucide-react";
import { getMatrix, matrixExcelUrl, getSkuHistory } from "@/lib/api";
import { money, moneyCompact, num, pct } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { Drawer } from "@/components/ui/drawer";
import { SkuHistoryChart } from "@/components/charts/sku-history-chart";
import { getClassificationMeta, SmoothSparkline } from "@/components/ui/classification";
import { type BadgeTone } from "@/components/ui/badge";
import { useSucursal } from "@/components/sucursal-context";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/* Bucket de acción derivado de la clasificación. */
type Bucket =
  | "todos"
  | "mejores"
  | "enAlza"
  | "alerta"
  | "exceso"
  | "bajaRot"
  | "peores"
  | "nuevos";

function bucketOf(row: Row): Bucket[] {
  const buckets: Bucket[] = [];
  const clasif = String(row["Clasificación"] || "").toUpperCase();
  const tendencia = String(row["Tendencia"] || "").toUpperCase();

  if (
    clasif.includes("ALTA ROTACIÓN") ||
    clasif.includes("ROTACIÓN ACTIVA") ||
    clasif.includes("INVENTARIO SANO") ||
    clasif.includes("BESTSELLER ACTIVO") ||
    clasif.includes("BESTSELLER RÁPIDO") ||
    clasif.includes("LOTE NUEVO VENDIENDO")
  )
    buckets.push("mejores");
  if (tendencia.includes("CRECIENDO") || tendencia.includes("INICIO"))
    buckets.push("enAlza");
  if (
    clasif.includes("QUIEBRE") ||
    clasif.includes("COMPRAR YA") ||
    clasif.includes("POCO STOCK CON DEMANDA") ||
    clasif.includes("STOCK CRÍTICO") ||
    clasif.includes("REPONER YA")
  )
    buckets.push("alerta");
  if (clasif.includes("EXCESO") || clasif.includes("STOCK EXCESIVO"))
    buckets.push("exceso");
  if (
    clasif.includes("BAJA ROT") ||
    clasif.includes("LENTO") ||
    clasif.includes("STOCK PARADO") ||
    clasif.includes("LOTE FRENADO") ||
    clasif.includes("RITMO PERDIDO")
  )
    buckets.push("bajaRot");
  if (
    clasif.includes("MUERTO") ||
    clasif.includes("DESCATAL") ||
    clasif.includes("MARGINAL") ||
    clasif.includes("DEMANDA EXTINTA") ||
    clasif.includes("EX-BESTSELLER")
  )
    buckets.push("peores");
  if (
    clasif.includes("NUEVO") ||
    clasif.includes("EMERGENTE") ||
    clasif.includes("PRODUCTO NUEVO")
  )
    buckets.push("nuevos");
  return buckets;
}

/* ─────────────────── Tipos para el árbol jerárquico ─────────────────── */

interface SubCatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
}

interface CatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  subcats: SubCatNode[];
}

interface DeptNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  cats: CatNode[];
}



/* ─────────────────────────── SkuHistoryDrawer ─────────────────────────── */
function SkuHistoryDrawer({
  sku,
  open,
  onClose,
}: {
  sku: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { sucursalName } = useSucursal();
  const branchNameStr =
    sucursalName === "Todas" ? null : sucursalName;
  const office_id = branchNameStr ? (branchNameStr === "Magdalena" ? 1 : branchNameStr === "San Miguel" ? 2 : null) : null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["skuHistory", sku, 180, office_id],
    queryFn: ({ signal }) => getSkuHistory(sku!, 180, office_id, signal),
    enabled: !!sku && open,
  });

  return (
    <Drawer open={open} onClose={onClose} title={`Historia del SKU: ${sku}`}>
      {isLoading ? (
        <LoadingState label="Cargando historia..." />
      ) : isError ? (
        <ErrorState error={new Error("Error al cargar la historia del SKU.")} />
      ) : !data || data.points.length === 0 ? (
        <EmptyState title="Sin historia de ventas" hint="No se encontraron datos de ventas para este SKU en los últimos 180 días." />
      ) : (
        <div className="mt-4">
          <SkuHistoryChart points={data.points} />
        </div>
      )}
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function VentasJerarquicasPage() {
  const { sucursalName } = useSucursal();
  const [busqueda, setBusqueda] = useState("");
  const [deptoSel, setDeptoSel] = useState<string | null>(null);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [subcatSel, setSubcatSel] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [bucketSel, setBucketSel] = useState<Bucket>("todos");

  /* Nodos expandidos en el árbol */
  const [expandedDeptos, setExpandedDeptos] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["matrix-04b", sucursalName],
    queryFn: ({ signal }) =>
      getMatrix(
        "04b",
        { sucursal: sucursalName ?? undefined, limit: 10000 },
        signal,
      ),
    staleTime: 5 * 60_000,
  });

  const allRows = useMemo<Row[]>(() => q.data?.rows ?? [], [q.data]);

  /* Toda la página opera sobre la ventana fija de 90 días (matriz 04b).
   * Antes había botones 7d/30d/180d/1año que escalaban linealmente Vendido S/
   * — generaban valores ficticios (180d ≠ 2×90d en la vida real). Se quitaron
   * para no engañar; si gerencia necesita otras ventanas se debe parametrizar
   * la SQL del módulo 04b (no escalar en el frontend). */
  const ventasDeRow = (r: Row) => n(r["Vendido SKU S/"]);
  const unds90 = (r: Row) => n(r["Unds Vend (90d)"]);

  /* ─── Construir árbol jerárquico ─── */
  const jerarquia = useMemo<DeptNode[]>(() => {
    const deptMap = new Map<
      string,
      {
        ventas: number;
        tickets: number;
        skuCount: number;
        catMap: Map<
          string,
          {
            ventas: number;
            tickets: number;
            skuCount: number;
            subcatMap: Map<
              string,
              { ventas: number; tickets: number; skuCount: number }
            >;
          }
        >;
      }
    >();

    for (const r of allRows) {
      const dep = s(r["Departamento"]) || "—";
      const cat = s(r["Categoría"]) || "Sin categoría";
      const subcat = s(r["Subcategoría"]) || "Sin subcategoría";
      const v = ventasDeRow(r);
      const t = unds90(r);

      if (!deptMap.has(dep))
        deptMap.set(dep, { ventas: 0, tickets: 0, skuCount: 0, catMap: new Map() });
      const d = deptMap.get(dep)!;
      d.ventas += v;
      d.tickets += t;
      d.skuCount += 1;

      if (!d.catMap.has(cat))
        d.catMap.set(cat, { ventas: 0, tickets: 0, skuCount: 0, subcatMap: new Map() });
      const c = d.catMap.get(cat)!;
      c.ventas += v;
      c.tickets += t;
      c.skuCount += 1;

      if (!c.subcatMap.has(subcat))
        c.subcatMap.set(subcat, { ventas: 0, tickets: 0, skuCount: 0 });
      const sc = c.subcatMap.get(subcat)!;
      sc.ventas += v;
      sc.tickets += t;
      sc.skuCount += 1;
    }

    const totalVentas = [...deptMap.values()].reduce((a, d) => a + d.ventas, 0);

    return [...deptMap.entries()]
      .sort(([, a], [, b]) => b.ventas - a.ventas)
      .map(([name, d]) => ({
        name,
        ventas: d.ventas,
        tickets: d.tickets,
        skuCount: d.skuCount,
        pct: totalVentas > 0 ? d.ventas / totalVentas : 0,
        cats: [...d.catMap.entries()]
          .sort(([, a], [, b]) => b.ventas - a.ventas)
          .map(([catName, c]) => ({
            name: catName,
            ventas: c.ventas,
            tickets: c.tickets,
            skuCount: c.skuCount,
            pct: d.ventas > 0 ? c.ventas / d.ventas : 0,
            subcats: [...c.subcatMap.entries()]
              .sort(([, a], [, b]) => b.ventas - a.ventas)
              .map(([scName, sc]) => ({
                name: scName,
                ventas: sc.ventas,
                tickets: sc.tickets,
                skuCount: sc.skuCount,
                pct: c.ventas > 0 ? sc.ventas / c.ventas : 0,
              })),
          })),
      }));
  }, [allRows]);

  const totalGeneral = useMemo(
    () => jerarquia.reduce((a, d) => a + d.ventas, 0),
    [jerarquia],
  );

  /* ─── Toggle helpers ─── */
  const toggleDepto = (name: string) => {
    setExpandedDeptos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleCat = (deptName: string, catName: string) => {
    const key = `${deptName}::${catName}`;
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ─── Selection helpers ─── */
  const selectDepto = (name: string) => {
    if (deptoSel === name) {
      setDeptoSel(null);
      setCatSel(null);
      setSubcatSel(null);
    } else {
      setDeptoSel(name);
      setCatSel(null);
      setSubcatSel(null);
      // Auto-expand
      setExpandedDeptos((prev) => new Set(prev).add(name));
    }
  };

  const selectCat = (deptName: string, catName: string) => {
    if (deptoSel === deptName && catSel === catName) {
      setCatSel(null);
      setSubcatSel(null);
    } else {
      setDeptoSel(deptName);
      setCatSel(catName);
      setSubcatSel(null);
      // Auto-expand both
      setExpandedDeptos((prev) => new Set(prev).add(deptName));
      setExpandedCats((prev) => new Set(prev).add(`${deptName}::${catName}`));
    }
  };

  const selectSubcat = (deptName: string, catName: string, subcatName: string) => {
    if (deptoSel === deptName && catSel === catName && subcatSel === subcatName) {
      setSubcatSel(null);
    } else {
      setDeptoSel(deptName);
      setCatSel(catName);
      setSubcatSel(subcatName);
    }
  };

  const clearSelection = () => {
    setDeptoSel(null);
    setCatSel(null);
    setSubcatSel(null);
  };

  /* ─── SKUs filtrados por depto + cat + subcat + búsqueda + bucket ─── */
  const skusFiltrados = useMemo(() => {
    let r = allRows;
    if (deptoSel) r = r.filter((x) => s(x["Departamento"]) === deptoSel);
    if (catSel) r = r.filter((x) => (s(x["Categoría"]) || "Sin categoría") === catSel);
    if (subcatSel)
      r = r.filter(
        (x) => (s(x["Subcategoría"]) || "Sin subcategoría") === subcatSel,
      );
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      r = r.filter(
        (x) =>
          s(x["Producto"]).toLowerCase().includes(b) ||
          s(x["Código SKU"]).toLowerCase().includes(b) ||
          s(x["Categoría"]).toLowerCase().includes(b) ||
          s(x["Subcategoría"]).toLowerCase().includes(b),
      );
    }
    if (bucketSel !== "todos") {
      r = r.filter((x) => bucketOf(x).includes(bucketSel));
    }
    return [...r].sort((a, b) => s(a["Producto"]).localeCompare(s(b["Producto"])));
  }, [allRows, deptoSel, catSel, subcatSel, busqueda, bucketSel]);

  /* Conteos por bucket sobre el universo (depto + cat + subcat + búsqueda, NO bucket) */
  const conteos = useMemo(() => {
    let r = allRows;
    if (deptoSel) r = r.filter((x) => s(x["Departamento"]) === deptoSel);
    if (catSel) r = r.filter((x) => (s(x["Categoría"]) || "Sin categoría") === catSel);
    if (subcatSel)
      r = r.filter(
        (x) => (s(x["Subcategoría"]) || "Sin subcategoría") === subcatSel,
      );
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      r = r.filter(
        (x) =>
          s(x["Producto"]).toLowerCase().includes(b) ||
          s(x["Código SKU"]).toLowerCase().includes(b) ||
          s(x["Categoría"]).toLowerCase().includes(b) ||
          s(x["Subcategoría"]).toLowerCase().includes(b),
      );
    }
    const c: Record<Bucket, number> = {
      todos: r.length,
      mejores: 0,
      enAlza: 0,
      alerta: 0,
      exceso: 0,
      bajaRot: 0,
      peores: 0,
      nuevos: 0,
    };
    for (const row of r) {
      for (const b of bucketOf(row)) c[b]++;
    }
    return c;
  }, [allRows, deptoSel, catSel, subcatSel, busqueda]);
  /* ─── Breadcrumb segments ─── */
  const breadcrumbs: { label: string; onClick: () => void }[] = [];
  breadcrumbs.push({ label: "Todos", onClick: clearSelection });
  if (deptoSel)
    breadcrumbs.push({
      label: deptoSel,
      onClick: () => {
        setCatSel(null);
        setSubcatSel(null);
      },
    });
  if (catSel)
    breadcrumbs.push({
      label: catSel,
      onClick: () => {
        setSubcatSel(null);
      },
    });
  if (subcatSel) breadcrumbs.push({ label: subcatSel, onClick: () => {} });

  return (
    <div>
      {q.isError ? (
        <ErrorState error={q.error} />
      ) : q.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
          {/* ───────────── IZQUIERDA: hero + árbol jerárquico ───────────── */}
          <aside className="flex flex-col gap-3">
            {/* Hero compacto — título de página + ventas totales */}
            <Card>
              <CardBody className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
                      Ventas &amp; Catálogo
                    </p>
                    <p className="text-[0.6rem] text-faint">
                      90 días · consolidado
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-h3 font-semibold tabular-nums tracking-tight text-fg">
                    {money(totalGeneral)}
                  </p>
                </div>
                {/* Mini progress: top 5 deptos */}
                <div className="flex gap-0.5 overflow-hidden rounded-pill">
                  {jerarquia.slice(0, 5).map((d, i) => {
                    const colors = [
                      "bg-primary",
                      "bg-info",
                      "bg-violet",
                      "bg-success",
                      "bg-warning",
                    ];
                    return (
                      <div
                        key={d.name}
                        className={cn("h-1 transition-all duration-[var(--duration-slow)]", colors[i])}
                        style={{ flex: d.pct }}
                        title={`${d.name}: ${pct(d.pct * 100)}`}
                      />
                    );
                  })}
                  <div
                    className="h-1 bg-surface-3"
                    style={{
                      flex: Math.max(
                        0,
                        1 - jerarquia.slice(0, 5).reduce((a, d) => a + d.pct, 0),
                      ),
                    }}
                  />
                </div>
              </CardBody>
            </Card>

            {/* Árbol jerárquico */}
            <Card>
              <CardBody className="p-2">
                {/* Botón "Todos" */}
                <button
                  onClick={clearSelection}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors",
                    "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                    deptoSel === null
                      ? "bg-primary/12 text-fg"
                      : "text-fg hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Layers className={cn("h-4 w-4", deptoSel === null ? "text-primary" : "text-faint")} />
                    <span className="text-body font-semibold">
                      Todos los productos
                    </span>
                  </span>
                  <span className="text-caption tabular-nums text-muted">
                    {num(allRows.length)} SKUs
                  </span>
                </button>

                {/* Departamentos */}
                <ul className="mt-1 flex max-h-[65vh] flex-col gap-0.5 overflow-y-auto pr-1">
                  {jerarquia.map((dept, deptIdx) => {
                    const isDeptSel = deptoSel === dept.name;
                    const isDeptExpanded = expandedDeptos.has(dept.name);
                    const deptTone = DEPT_COLORS[deptIdx % DEPT_COLORS.length];

                    return (
                      <li key={dept.name}>
                        {/* Departamento row */}
                        <div
                          className={cn(
                            "group flex w-full items-center gap-1 rounded-md transition-all",
                            "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                            isDeptSel && !catSel
                              ? `${deptTone.bgActive} ${deptTone.borderActive}`
                              : "hover:bg-surface-2",
                          )}
                        >
                          {/* Expand/collapse chevron */}
                          <button
                            onClick={() => toggleDepto(dept.name)}
                            className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-muted"
                            aria-label={isDeptExpanded ? "Colapsar" : "Expandir"}
                          >
                            <ChevronRight
                              className={cn(
                                "h-3.5 w-3.5 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]",
                                isDeptExpanded && "rotate-90",
                              )}
                            />
                          </button>

                          {/* Dept info (clickable to select) */}
                          <button
                            onClick={() => selectDepto(dept.name)}
                            className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left"
                          >
                            {/* Colored dot indicator */}
                            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", deptTone.dot)} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-body font-medium text-fg">
                                {dept.name}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <ProgressBar pct={dept.pct} tone={deptTone.bar} />
                                <span className="shrink-0 text-[0.6rem] tabular-nums text-faint">
                                  {pct(dept.pct * 100)}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono text-caption tabular-nums font-semibold text-fg">
                                {money(dept.ventas)}
                              </p>
                              <p className="text-[0.6rem] tabular-nums text-faint">
                                {num(dept.skuCount)} SKUs
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Categorías (expandible) */}
                        {isDeptExpanded && dept.cats.length > 0 && (
                          <ul className="ml-3 animate-tree-expand overflow-hidden border-l border-border-soft/50 pl-1">
                            {dept.cats.map((cat) => {
                              const catKey = `${dept.name}::${cat.name}`;
                              const isCatSel =
                                isDeptSel && catSel === cat.name;
                              const isCatExpanded = expandedCats.has(catKey);

                              return (
                                <li key={cat.name}>
                                  {/* Categoría row */}
                                  <div
                                    className={cn(
                                      "group flex w-full items-center gap-1 rounded-md transition-all",
                                      "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                                      isCatSel && !subcatSel
                                        ? "bg-info/8 shadow-[inset_3px_0_0_var(--color-info)]"
                                        : "hover:bg-surface-2",
                                    )}
                                  >
                                    {/* Expand/collapse chevron */}
                                    <button
                                      onClick={() =>
                                        toggleCat(dept.name, cat.name)
                                      }
                                      className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-surface-3 hover:text-muted"
                                      aria-label={
                                        isCatExpanded ? "Colapsar" : "Expandir"
                                      }
                                    >
                                      <ChevronRight
                                        className={cn(
                                          "h-3 w-3 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]",
                                          isCatExpanded && "rotate-90",
                                        )}
                                      />
                                    </button>

                                    {/* Cat info */}
                                    <button
                                      onClick={() =>
                                        selectCat(dept.name, cat.name)
                                      }
                                      className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left"
                                    >
                                      <FolderOpen
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          isCatSel ? "text-info" : "text-faint",
                                        )}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-caption font-medium text-fg">
                                          {cat.name}
                                        </p>
                                        <div className="mt-0.5 flex items-center gap-2">
                                          <ProgressBar pct={cat.pct} tone="info" />
                                          <span className="shrink-0 text-[0.55rem] tabular-nums text-faint">
                                            {pct(cat.pct * 100)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="font-mono text-[0.65rem] tabular-nums font-semibold text-fg">
                                          {money(cat.ventas)}
                                        </p>
                                        <p className="text-[0.55rem] tabular-nums text-faint">
                                          {num(cat.skuCount)} SKUs
                                        </p>
                                      </div>
                                    </button>
                                  </div>

                                  {/* Subcategorías (expandible) */}
                                  {isCatExpanded && cat.subcats.length > 0 && (
                                    <ul className="ml-3 animate-tree-expand overflow-hidden border-l border-border-soft/30 pl-1">
                                      {cat.subcats.map((subcat) => {
                                        const isSubcatSel =
                                          isCatSel &&
                                          subcatSel === subcat.name;

                                        return (
                                          <li key={subcat.name}>
                                            <button
                                              onClick={() =>
                                                selectSubcat(
                                                  dept.name,
                                                  cat.name,
                                                  subcat.name,
                                                )
                                              }
                                              className={cn(
                                                "group flex w-full items-center gap-2 rounded py-1.5 pl-5 pr-3 text-left transition-all",
                                                "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                                                isSubcatSel
                                                  ? "bg-violet/8 shadow-[inset_3px_0_0_var(--color-violet)]"
                                                  : "hover:bg-surface-2",
                                              )}
                                            >
                                              <Tag
                                                className={cn(
                                                  "h-3 w-3 shrink-0",
                                                  isSubcatSel
                                                    ? "text-violet"
                                                    : "text-faint",
                                                )}
                                              />
                                              <div className="min-w-0 flex-1">
                                                <p className="truncate text-[0.65rem] font-medium text-fg">
                                                  {subcat.name}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-2">
                                                  <ProgressBar
                                                    pct={subcat.pct}
                                                    tone="violet"
                                                  />
                                                  <span className="shrink-0 text-[0.5rem] tabular-nums text-faint">
                                                    {pct(subcat.pct * 100)}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="shrink-0 text-right">
                                                <p className="font-mono text-[0.6rem] tabular-nums font-semibold text-fg">
                                                  {money(subcat.ventas)}
                                                </p>
                                                <p className="text-[0.5rem] tabular-nums text-faint">
                                                  {num(subcat.skuCount)} SKUs
                                                </p>
                                              </div>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          </aside>

          {/* ───────────── DERECHA: toolbar + chips + grid ───────────── */}
          <div className="flex flex-col gap-3">
            {/* Toolbar compacto: breadcrumb + search + excel */}
            <div className="flex flex-wrap items-center gap-2">
              <BreadcrumbNav segments={breadcrumbs} />
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto, SKU…"
                    className="h-8 w-48 rounded-md bg-surface pl-8 text-caption focus:w-64 transition-all duration-[var(--duration-base)]"
                  />
                </div>
                <a
                  href={matrixExcelUrl("04b", {
                    sucursal: sucursalName ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener"
                >
                  <Button variant="secondary" size="sm">
                    <Download className="h-3.5 w-3.5" /> Excel
                  </Button>
                </a>
              </div>
            </div>

            {/* Chips de filtro + conteo */}
            <div className="flex flex-wrap items-center gap-1.5">
              <BucketChip active={bucketSel === "todos"} onClick={() => setBucketSel("todos")} Icon={Activity} label="Todos" count={conteos.todos} tone="neutral" />
              <BucketChip active={bucketSel === "mejores"} onClick={() => setBucketSel("mejores")} Icon={Flame} label="Top" count={conteos.mejores} tone="success" />
              <BucketChip active={bucketSel === "enAlza"} onClick={() => setBucketSel("enAlza")} Icon={TrendingUp} label="Alza" count={conteos.enAlza} tone="info" />
              <BucketChip active={bucketSel === "alerta"} onClick={() => setBucketSel("alerta")} Icon={AlertTriangle} label="Alerta" count={conteos.alerta} tone="danger" />
              <BucketChip active={bucketSel === "exceso"} onClick={() => setBucketSel("exceso")} Icon={Box} label="Exceso" count={conteos.exceso} tone="warning" />
              <BucketChip active={bucketSel === "bajaRot"} onClick={() => setBucketSel("bajaRot")} Icon={Snail} label="Lento" count={conteos.bajaRot} tone="warning" />
              <BucketChip active={bucketSel === "peores"} onClick={() => setBucketSel("peores")} Icon={Skull} label="Muerto" count={conteos.peores} tone="neutral" />
              <BucketChip active={bucketSel === "nuevos"} onClick={() => setBucketSel("nuevos")} Icon={Sprout} label="Nuevo" count={conteos.nuevos} tone="info" />
              <span className="ml-1 text-[0.6rem] tabular-nums text-faint">
                {num(skusFiltrados.length)} de {num(conteos.todos)}
              </span>
            </div>

            {/* Grid de producto */}
            {skusFiltrados.length === 0 ? (
              <Card>
                <CardBody>
                  <EmptyState
                    title="Sin productos"
                    hint="Cambiá el filtro, la búsqueda o la selección del árbol."
                  />
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                {skusFiltrados.slice(0, 300).map((sku, i) => (
                  <ProductCard
                    key={`${s(sku["Código SKU"])}-${i}`}
                    sku={sku}
                    ventas={ventasDeRow(sku)}
                    unidades={n(sku["Unds Vend (90d)"])}
                    stock={n(sku["Stock Disp"])}
                    onClick={(code) => setSelectedSku(code)}
                  />
                ))}
              </div>
            )}
            {skusFiltrados.length > 300 && (
              <p className="text-center text-[0.6rem] text-faint">
                Mostrando 300 de {num(skusFiltrados.length)}. Refiná el filtro.
              </p>
            )}
          </div>
        </div>
      )}
      
      <SkuHistoryDrawer
        sku={selectedSku}
        open={!!selectedSku}
        onClose={() => setSelectedSku(null)}
      />
    </div>
  );
}

/* ─────────────────────────── ProgressBar ─────────────────────────── */

type BarTone = "primary" | "info" | "violet" | "success" | "warning" | "accent" | "danger";

const BAR_COLORS: Record<BarTone, string> = {
  primary: "bg-gradient-to-r from-primary/50 to-primary",
  info: "bg-gradient-to-r from-info/50 to-info",
  violet: "bg-gradient-to-r from-violet/50 to-violet",
  success: "bg-gradient-to-r from-success/50 to-success",
  warning: "bg-gradient-to-r from-warning/50 to-warning",
  accent: "bg-gradient-to-r from-accent/50 to-accent",
  danger: "bg-gradient-to-r from-danger/50 to-danger",
};

/* Palette per department — cycles through visually distinct colors */
const DEPT_COLORS: {
  dot: string;
  bar: BarTone;
  bgActive: string;
  borderActive: string;
}[] = [
  { dot: "bg-primary",  bar: "primary",  bgActive: "bg-primary/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-primary)]" },
  { dot: "bg-success",  bar: "success",  bgActive: "bg-success/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-success)]" },
  { dot: "bg-info",     bar: "info",     bgActive: "bg-info/10",     borderActive: "shadow-[inset_3px_0_0_var(--color-info)]" },
  { dot: "bg-violet",   bar: "violet",   bgActive: "bg-violet/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-violet)]" },
  { dot: "bg-warning",  bar: "warning",  bgActive: "bg-warning/10",  borderActive: "shadow-[inset_3px_0_0_var(--color-warning)]" },
  { dot: "bg-accent",   bar: "accent",   bgActive: "bg-accent/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-accent)]" },
  { dot: "bg-danger",   bar: "danger",   bgActive: "bg-danger/10",   borderActive: "shadow-[inset_3px_0_0_var(--color-danger)]" },
];

function ProgressBar({
  pct: fraction,
  tone = "primary",
}: {
  pct: number;
  tone?: BarTone;
}) {
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-pill bg-surface-3">
      <div
        className={cn(
          "h-full rounded-pill transition-all duration-[var(--duration-slow)] ease-[var(--ease-premium)]",
          BAR_COLORS[tone],
        )}
        style={{ width: `${Math.max(fraction * 100, 0.5)}%` }}
      />
    </div>
  );
}

/* ─────────────────────────── BreadcrumbNav ─────────────────────────── */

function BreadcrumbNav({
  segments,
}: {
  segments: { label: string; onClick: () => void }[];
}) {
  return (
    <nav className="flex items-center gap-1" aria-label="Breadcrumb">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-faint" />
            )}
            {isLast ? (
              <span className="text-body font-semibold text-fg">
                {seg.label}
              </span>
            ) : (
              <button
                onClick={seg.onClick}
                className="text-body font-medium text-muted transition-colors duration-[var(--duration-fast)] hover:text-fg"
              >
                {seg.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ─────────────────────────── BucketChip ─────────────────────────── */

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: "border-border-soft bg-surface-2 text-muted",
  primary: "border-primary/30 bg-primary/12 text-primary",
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/30 bg-warning/12 text-warning",
  danger: "border-danger/30 bg-danger/12 text-danger",
  info: "border-info/30 bg-info/12 text-info",
  violet: "border-violet/30 bg-violet/12 text-violet",
};

function BucketChip({
  active,
  onClick,
  Icon,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  tone: BadgeTone;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
        "text-[0.65rem] font-semibold",
        "transition-[background,color,border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
        active
          ? TONE_STYLES[tone] + " shadow-card"
          : "border-border-soft bg-surface text-muted hover:bg-surface-2",
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span
        className={cn(
          "rounded-sm px-1 py-px text-[0.6rem] font-bold tabular-nums",
          active ? "bg-black/20" : "bg-surface-3 text-fg",
        )}
      >
        {num(count)}
      </span>
    </button>
  );
}

/* ─────────────────────────── ProductCard ─────────────────────────── */

function getTrendMock(tendencia: string, clasif: string) {
  const t = tendencia.toUpperCase();
  const c = clasif.toUpperCase();
  if (t.includes("CRECIENDO RÁPIDO") || c.includes("BESTSELLER RÁPIDO")) return [1, 2, 3.5];
  if (t.includes("CRECIENDO") || c.includes("EMERGENTE")) return [1, 1.5, 2];
  if (t.includes("BAJANDO RÁPIDO") || c.includes("EX-BESTSELLER")) return [3, 1.5, 0.5];
  if (t.includes("BAJANDO")) return [2, 1.5, 1];
  if (t.includes("INICIO") || c.includes("NUEVO")) return [0, 1, 2.5];
  if (c.includes("MUERTO") || c.includes("EXTINTA")) return [0.5, 0.1, 0];
  if (c.includes("LENTO") || c.includes("PARADO")) return [1, 0.8, 0.5];
  if (c.includes("BESTSELLER")) return [3, 3, 3.2];
  return [1, 1, 1];
}

function ProductCard({
  sku,
  ventas,
  unidades,
  stock,
  onClick,
}: {
  sku: Row;
  ventas: number;
  unidades: number;
  stock: number;
  onClick?: (skuCode: string) => void;
}) {
  const clasif = String(sku["Clasificación"] || "");
  const tendencia = String(sku["Tendencia"] || "");
  const sucursal = s(sku["Sucursal"]);
  
  const [v90, v30, p30] = getTrendMock(tendencia, clasif);
  const meta = getClassificationMeta(clasif);
  const Icon = meta.icon;
  const isDanger = clasif.toUpperCase().includes("CRÍTICO") || clasif.toUpperCase().includes("QUIEBRE");

  return (
    <div 
      className={cn(
        "group flex flex-col rounded-lg border border-border-soft bg-surface shadow-card transition-[box-shadow,border-color] duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:border-border hover:shadow-card-hover",
        onClick && "cursor-pointer"
      )}
      onClick={() => onClick?.(s(sku["Código SKU"]))}
    >
      {/* Header row: ventas hero + badge */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-body font-semibold text-fg">
            {s(sku["Producto"]) || "—"}
          </p>
          <p className="font-mono text-[0.6rem] text-muted">
            {s(sku["Código SKU"]) || "—"}
          </p>
        </div>
        <p className="shrink-0 font-mono text-body tabular-nums font-bold text-primary">
          {moneyCompact(ventas)}
        </p>
      </div>

      {/* Classification + trend */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <div 
          className={cn("relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.bgClass)}
          title={clasif}
        >
          <Icon className={cn("h-3.5 w-3.5", meta.colorClass)} />
          {isDanger && (
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-surface bg-danger" />
          )}
        </div>
        <div className="flex flex-col flex-1" title={`Tendencia: ${tendencia || 'Estable'}`}>
          <SmoothSparkline v90={v90} v30={v30} p30={p30} width={90} height={20} />
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-auto flex items-center gap-px border-t border-border-soft bg-bg-soft/30">
        <div className="flex flex-1 flex-col items-center py-1.5">
          <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-faint">Ventas</span>
          <span className="font-mono text-[0.7rem] tabular-nums font-semibold text-fg">{money(ventas)}</span>
        </div>
        <div className="h-5 w-px bg-border-soft" />
        <div className="flex flex-1 flex-col items-center py-1.5">
          <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-faint">Vendido</span>
          <span className="font-mono text-[0.7rem] tabular-nums text-fg">{num(unidades)} u</span>
        </div>
        <div className="h-5 w-px bg-border-soft" />
        <div className="flex flex-1 flex-col items-center py-1.5">
          <span className="text-[0.5rem] font-semibold uppercase tracking-wider text-faint">Stock</span>
          <span className={cn(
            "font-mono text-[0.7rem] tabular-nums",
            stock === 0 ? "font-bold text-danger" : "text-fg",
          )}>{num(stock)} u</span>
        </div>
      </div>

      {/* Footer: categoría + sucursal */}
      <div className="flex items-center justify-between gap-2 rounded-b-lg bg-surface-2/50 px-3 py-1.5">
        <p className="truncate text-[0.6rem] text-faint">
          {s(sku["Categoría"])}
          {sku["Subcategoría"] ? ` · ${s(sku["Subcategoría"])}` : ""}
        </p>
        {sucursal && (
          <p className="shrink-0 text-[0.55rem] font-semibold uppercase tracking-wider text-faint">
            {sucursal}
          </p>
        )}
      </div>
    </div>
  );
}
