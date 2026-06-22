"use client";

/**
 * Compras & Catálogo — Dashboard de Compras Inteligente.
 *
 * Mismo universo que el Excel `/analytics/compras-catalogo/excel`:
 * matriz 04b filtrada a severidades 🔴 Crítico y 🟠 Alta (quiebres reales).
 *
 * Esta versión es SOLO LECTURA: los botones Ordenar/Posponer/Ignorar son
 * visuales y disparan un toast informativo. La persistencia de decisiones
 * se evaluará en una fase posterior (requiere nueva tabla + endpoints POST).
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Folder,
  FolderOpen,
  Home,
  Layers,
  Package,
  Percent,
  Search,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Flame,
  Gem,
  Snowflake,
  Zap,
  Star,
  Eye,
  Leaf,
  Moon,
  Archive,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  CheckCircle,
  RefreshCcw,
  Skull,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";

import {
  comprasCatalogoExcelUrl,
  getComprasCatalogo,
  getSkuHistory,
  getPurchaseDecisionsBySku,
  createPurchaseDecision,
  type PurchaseDecisionKind,
} from "@/lib/api";
import { dateShort, money, num, pct } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ClassificationCell, getClassificationMeta } from "@/components/ui/classification";
import { useSucursal } from "@/components/sucursal-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { Drawer } from "@/components/ui/drawer";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { SkuHistoryChart } from "@/components/charts/sku-history-chart";
import { cn } from "@/lib/utils";
import type { ComprasCatalogoSku } from "@/lib/types";

/* ────────────────────────────────────────────────────────────
 * Selección jerárquica — qué nodo del árbol Depto/Cat/Subcat está activo.
 * Cuando `subcat` está set, también lo están `cat` y `dept`.
 * Cuando `cat` está set pero `subcat` no, se filtra por toda la categoría.
 * Cuando solo `dept` está set, se filtra por todo el departamento.
 * Cuando los 3 son null, se muestra TODO.
 * ──────────────────────────────────────────────────────────── */
type Selection = {
  dept: string | null;
  cat: string | null;
  subcat: string | null;
};

const ROOT_SELECTION: Selection = { dept: null, cat: null, subcat: null };

/* Nodo del árbol jerárquico construido en cliente desde la lista de SKUs. */
type TreeNode = {
  name: string;
  skus: number;
  ventaSoles: number;
  criticos: number;
  altas: number;
  children: TreeNode[];
};

const RENDER_CAP = 150;

type SeverityFilter = "todas" | "critico" | "alta";

/* ────────────────────────────────────────────────────────────
 * Color por severidad — coincide con _classify_severidad_accion_causal
 * del backend (🔴 Crítico = danger, 🟠 Alta = warning).
 * ──────────────────────────────────────────────────────────── */
function severityChipClass(sev: string): string {
  if (sev.includes("Crítico")) return "bg-danger/15 text-danger border-danger/25";
  if (sev.includes("Alta")) return "bg-warning/15 text-warning border-warning/25";
  return "bg-surface-3 text-muted border-border-soft";
}


/* Color del bullet point del departamento (para la barra de distribución). */
const DEPT_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

/* Helper: extrae el "encabezado" de la clasificación sin la descripción larga. */
function shortClasif(clasif: string): string {
  return clasif.split(/[:(]/)[0].trim() || "—";
}

export default function ComprasCatalogoPage() {
  const { officeId, sucursalName } = useSucursal();
  const [severity, setSeverity] = useState<SeverityFilter>("todas");
  const [selection, setSelection] = useState<Selection>(ROOT_SELECTION);
  const [search, setSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState<ComprasCatalogoSku | null>(null);

  const query = useQuery({
    queryKey: ["compras-catalogo", officeId],
    queryFn: ({ signal }) => getComprasCatalogo(officeId, signal),
    staleTime: 5 * 60_000,
  });

  // Árbol jerárquico Depto → Cat → Subcat construido sobre todos los SKUs
  // (independiente del filtro de severidad/búsqueda para que la sidebar muestre
  // SIEMPRE el universo completo del que se está sub-seleccionando).
  const tree = useMemo<TreeNode[]>(() => buildTree(query.data?.skus ?? []), [
    query.data?.skus,
  ]);

  // Filtrado en cliente: severidad + selección jerárquica + búsqueda.
  const filteredSkus = useMemo<ComprasCatalogoSku[]>(() => {
    const all = query.data?.skus ?? [];
    const s = search.trim().toLowerCase();
    return all.filter((sku) => {
      if (severity === "critico" && !sku.severidad.includes("Crítico")) return false;
      if (severity === "alta" && !sku.severidad.includes("Alta")) return false;
      if (selection.dept && sku.departamento !== selection.dept) return false;
      if (selection.cat && sku.categoria !== selection.cat) return false;
      if (selection.subcat && sku.subcategoria !== selection.subcat) return false;
      if (s) {
        const hay =
          sku.sku.toLowerCase().includes(s) ||
          sku.producto.toLowerCase().includes(s) ||
          (sku.categoria ?? "").toLowerCase().includes(s);
        if (!hay) return false;
      }
      return true;
    });
  }, [query.data?.skus, severity, selection, search]);

  // KPIs locales del nivel seleccionado (recalculados sobre el subset jerárquico,
  // ignorando severidad/búsqueda para que reflejen el "size" del nodo).
  const scopeKpis = useMemo(() => {
    const all = query.data?.skus ?? [];
    const subset = all.filter((sku) => {
      if (selection.dept && sku.departamento !== selection.dept) return false;
      if (selection.cat && sku.categoria !== selection.cat) return false;
      if (selection.subcat && sku.subcategoria !== selection.subcat) return false;
      return true;
    });
    return {
      total: subset.length,
      critico: subset.filter((s) => s.severidad.includes("Crítico")).length,
      alta: subset.filter((s) => s.severidad.includes("Alta")).length,
      venta: subset.reduce((acc, s) => acc + s.vendido_sku_soles, 0),
      reponer: subset.reduce((acc, s) => acc + s.cantidad_sugerida, 0),
    };
  }, [query.data?.skus, selection]);

  // Acción rápida desde las filas de la tabla (sin abrir el drawer): solo
  // para ordenar con la cantidad sugerida. Para "comprar similar" o
  // cantidad custom hay que abrir el drawer.
  const qc = useQueryClient();
  const quickAction = useMutation({
    mutationFn: ({
      sku,
      action,
    }: {
      sku: ComprasCatalogoSku;
      action: PurchaseDecisionKind;
    }) =>
      createPurchaseDecision({
        sku: sku.sku,
        bsale_office_id: officeId ?? 0,
        decision: action,
        quantity:
          action === "ordenar" || action === "comprar_similar"
            ? sku.cantidad_sugerida
            : null,
        classification_snapshot: {
          clasificacion: sku.clasificacion,
          severidad: sku.severidad,
          accion: sku.accion,
          stock_disponible: sku.stock_disponible,
          cantidad_sugerida: sku.cantidad_sugerida,
        },
      }),
    onSuccess: (_data, vars) => {
      const verb = {
        ordenar: "Ordenar",
        comprar_similar: "Comprar similar",
        posponer: "Posponer",
        ignorar: "Ignorar",
      }[vars.action];
      toast.success(`${verb} · ${vars.sku.producto}`, {
        description: "Decisión guardada.",
      });
      qc.invalidateQueries({ queryKey: ["purchase-decisions"] });
    },
    onError: (err: Error, vars) => {
      toast.error(`Error guardando decisión · ${vars.sku.producto}`, {
        description: err.message,
      });
    },
  });

  const handleAction = (
    sku: ComprasCatalogoSku,
    action: "ordenar" | "posponer" | "ignorar",
  ) => {
    if (officeId == null) {
      toast.error("Seleccioná una sucursal antes de decidir compras.");
      return;
    }
    quickAction.mutate({ sku, action });
  };

  const downloadExcel = () => {
    const url = comprasCatalogoExcelUrl({ office_id: officeId });
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
        eyebrow="Reportes · Dashboard de compras"
        title="Compras & Catálogo"
        description={
          sucursalName
            ? `SKUs en quiebre real para ${sucursalName} — productos que generan venta perdida HOY.`
            : "SKUs en quiebre real (consolidado de todas las tiendas) — productos que generan venta perdida HOY."
        }
        actions={
          <Button onClick={downloadExcel} variant="secondary">
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
        }
      />

      {query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          {/* ───────────── KPIs ───────────── */}
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiStat
              label="SKUs en quiebre"
              value={num(query.data?.kpis.skus_criticos_total)}
              icon={AlertTriangle}
              tone="danger"
              loading={query.isLoading}
              sub={
                query.data ? (
                  <span>
                    <span className="font-semibold text-danger">
                      {num(query.data.kpis.skus_critico)}
                    </span>{" "}
                    crítico ·{" "}
                    <span className="font-semibold text-warning">
                      {num(query.data.kpis.skus_alta)}
                    </span>{" "}
                    alta
                  </span>
                ) : null
              }
            />
            <KpiStat
              label="Venta 90d en riesgo"
              value={money(query.data?.kpis.venta_90d_en_riesgo)}
              icon={Wallet}
              tone="warning"
              loading={query.isLoading}
              sub="Histórico potencialmente perdido si no se repone"
            />
            <KpiStat
              label="Unidades a reponer"
              value={num(query.data?.kpis.unidades_a_reponer)}
              icon={Package}
              tone="primary"
              loading={query.isLoading}
              sub={
                query.data
                  ? `Cobertura objetivo · ${query.data.cobertura_objetivo_dias} días`
                  : null
              }
            />
            <KpiStat
              label="Margen promedio"
              value={
                query.data?.kpis.margen_promedio_pct !== null &&
                query.data?.kpis.margen_promedio_pct !== undefined
                  ? pct(query.data.kpis.margen_promedio_pct)
                  : "—"
              }
              icon={Percent}
              tone="success"
              loading={query.isLoading}
              sub="Ponderado por venta (90d)"
            />
          </section>

          {/* ───────────── Layout principal ───────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            {/* ─── SIDEBAR jerárquica: Depto → Cat → Subcat ─── */}
            <aside className="flex flex-col gap-4">
              <Card className="overflow-hidden">
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Jerarquía
                    </span>
                  }
                  subtitle="Click para profundizar · doble click para limpiar"
                />
                <CardBody className="space-y-1 px-2 pt-2">
                  <RootNode
                    total={query.data?.kpis.skus_criticos_total ?? 0}
                    active={
                      !selection.dept && !selection.cat && !selection.subcat
                    }
                    onClick={() => setSelection(ROOT_SELECTION)}
                  />
                  {query.isLoading ? (
                    <LoadingState label="Cargando jerarquía…" />
                  ) : (
                    <JerarquiaTree
                      tree={tree}
                      selection={selection}
                      onSelect={setSelection}
                    />
                  )}
                </CardBody>
              </Card>

              {/* Por acción (breakdown) — sigue siendo útil como referencia rápida */}
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-warning" />
                      Por acción sugerida
                    </span>
                  }
                />
                <CardBody className="pt-3">
                  {query.isLoading ? (
                    <LoadingState label="Cargando…" />
                  ) : query.data?.por_accion.length ? (
                    <ul className="space-y-1.5 text-xs">
                      {query.data.por_accion.map((a) => (
                        <li
                          key={a.accion}
                          className="flex items-center justify-between rounded px-2 py-1.5 text-muted hover:bg-surface-2"
                        >
                          <span className="font-medium text-fg">{a.accion}</span>
                          <span className="tabular-nums font-semibold text-primary">
                            {num(a.skus)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-center text-xs text-faint">
                      Sin acciones pendientes
                    </p>
                  )}
                </CardBody>
              </Card>
            </aside>

            {/* ─── MAIN: breadcrumb + KPIs locales + tabla ─── */}
            <main className="flex flex-col gap-4">
              {/* Breadcrumb navegacional */}
              <Breadcrumb
                selection={selection}
                onNavigate={setSelection}
              />

              {/* Mini-KPIs del nivel seleccionado (cambian al navegar) */}
              {(selection.dept || selection.cat || selection.subcat) && (
                <ScopeStats scopeKpis={scopeKpis} />
              )}

              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      {scopeTitle(selection)}
                    </span>
                  }
                  subtitle={
                    query.data
                      ? `Mostrando ${num(filteredSkus.length)} de ${num(query.data.kpis.skus_criticos_total)} SKUs`
                      : "Cargando…"
                  }
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Búsqueda */}
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
                      {/* Pestañas de severidad */}
                      <div className="inline-flex rounded-md border border-border-soft bg-surface-2 p-0.5">
                        <SeverityTab
                          active={severity === "todas"}
                          onClick={() => setSeverity("todas")}
                        >
                          Todas
                        </SeverityTab>
                        <SeverityTab
                          active={severity === "critico"}
                          onClick={() => setSeverity("critico")}
                          accent="danger"
                        >
                          🔴 Crítico
                        </SeverityTab>
                        <SeverityTab
                          active={severity === "alta"}
                          onClick={() => setSeverity("alta")}
                          accent="warning"
                        >
                          🟠 Alta
                        </SeverityTab>
                      </div>
                    </div>
                  }
                />
                <CardBody className="pt-0">
                  {query.isLoading ? (
                    <LoadingState label="Calculando SKUs en quiebre…" />
                  ) : filteredSkus.length === 0 ? (
                    <EmptyState
                      title="Sin SKUs para los filtros actuales"
                      hint="Probá cambiar la severidad, navegá a otro nivel o limpiá la búsqueda."
                    />
                  ) : (
                    <SkuTable
                      rows={filteredSkus}
                      onSelect={setSelectedSku}
                      onAction={handleAction}
                    />
                  )}
                </CardBody>
              </Card>
            </main>
          </div>
        </>
      )}

      {/* Drawer de detalle SKU — gráfico histórico + métricas + acciones */}
      <SkuDetailDrawer
        sku={selectedSku}
        officeId={officeId}
        onClose={() => setSelectedSku(null)}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

function SeverityTab({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: "danger" | "warning";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? accent === "danger"
            ? "bg-danger/15 text-danger"
            : accent === "warning"
              ? "bg-warning/15 text-warning"
              : "bg-primary/10 text-primary"
          : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Helpers de jerarquía: construir y navegar el árbol Depto → Cat → Subcat
 * ════════════════════════════════════════════════════════════════════════ */

function buildTree(skus: ComprasCatalogoSku[]): TreeNode[] {
  // Map<dept, Map<cat, Map<subcat, accum>>>
  const deptMap = new Map<string, Map<string, Map<string, TreeNode>>>();

  for (const sku of skus) {
    const d = sku.departamento || "Sin departamento";
    const c = sku.categoria || "Sin categoría";
    const s = sku.subcategoria || "Sin subcategoría";

    if (!deptMap.has(d)) deptMap.set(d, new Map());
    const catMap = deptMap.get(d)!;
    if (!catMap.has(c)) catMap.set(c, new Map());
    const subMap = catMap.get(c)!;
    if (!subMap.has(s))
      subMap.set(s, {
        name: s,
        skus: 0,
        ventaSoles: 0,
        criticos: 0,
        altas: 0,
        children: [],
      });
    const node = subMap.get(s)!;
    node.skus += 1;
    node.ventaSoles += sku.vendido_sku_soles;
    if (sku.severidad.includes("Crítico")) node.criticos += 1;
    if (sku.severidad.includes("Alta")) node.altas += 1;
  }

  // Convertir maps a arrays + agregar totales por nivel.
  const tree: TreeNode[] = [];
  for (const [deptName, catMap] of deptMap.entries()) {
    const cats: TreeNode[] = [];
    for (const [catName, subMap] of catMap.entries()) {
      const subs = [...subMap.values()].sort(
        (a, b) => b.ventaSoles - a.ventaSoles,
      );
      cats.push({
        name: catName,
        skus: subs.reduce((acc, s) => acc + s.skus, 0),
        ventaSoles: subs.reduce((acc, s) => acc + s.ventaSoles, 0),
        criticos: subs.reduce((acc, s) => acc + s.criticos, 0),
        altas: subs.reduce((acc, s) => acc + s.altas, 0),
        children: subs,
      });
    }
    cats.sort((a, b) => b.ventaSoles - a.ventaSoles);
    tree.push({
      name: deptName,
      skus: cats.reduce((acc, c) => acc + c.skus, 0),
      ventaSoles: cats.reduce((acc, c) => acc + c.ventaSoles, 0),
      criticos: cats.reduce((acc, c) => acc + c.criticos, 0),
      altas: cats.reduce((acc, c) => acc + c.altas, 0),
      children: cats,
    });
  }
  return tree.sort((a, b) => b.ventaSoles - a.ventaSoles);
}

function scopeTitle(sel: Selection): string {
  if (sel.subcat) return sel.subcat;
  if (sel.cat) return sel.cat;
  if (sel.dept) return sel.dept;
  return "Catálogo de decisiones";
}

/* ════════════════════════════════════════════════════════════════════════
 * Sidebar: árbol jerárquico expandible
 * ════════════════════════════════════════════════════════════════════════ */

function RootNode({
  total,
  active,
  onClick,
}: {
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Home className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-faint group-hover:text-fg")} />
      <span className="flex-1 truncate text-xs font-semibold">
        Todos los departamentos
      </span>
      <span
        className={cn(
          "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          active ? "bg-primary/20 text-primary" : "bg-surface-3 text-muted",
        )}
      >
        {num(total)}
      </span>
    </button>
  );
}

function JerarquiaTree({
  tree,
  selection,
  onSelect,
}: {
  tree: TreeNode[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  if (tree.length === 0) {
    return <p className="py-2 text-center text-xs text-faint">Sin datos</p>;
  }
  const max = tree[0]?.ventaSoles || 1;
  return (
    <ul className="space-y-0.5">
      {tree.map((dept, i) => (
        <DeptRow
          key={dept.name}
          node={dept}
          colorIdx={i}
          maxVenta={max}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function DeptRow({
  node,
  colorIdx,
  maxVenta,
  selection,
  onSelect,
}: {
  node: TreeNode;
  colorIdx: number;
  maxVenta: number;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isOpen = selection.dept === node.name;
  const widthPct = Math.max(4, Math.round((node.ventaSoles / maxVenta) * 100));
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isOpen
              ? ROOT_SELECTION
              : { dept: node.name, cat: null, subcat: null },
          )
        }
        className={cn(
          "group block w-full rounded-md px-2.5 py-2 text-left transition-colors",
          isOpen ? "bg-primary/10" : "hover:bg-surface-2",
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-faint transition-transform duration-[var(--duration-fast)]",
              isOpen && "rotate-90 text-primary",
            )}
          />
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              DEPT_COLORS[colorIdx % DEPT_COLORS.length],
            )}
          />
          <span
            className={cn(
              "flex-1 truncate font-semibold",
              isOpen ? "text-fg" : "text-fg",
            )}
          >
            {node.name}
          </span>
          <span className="shrink-0 text-faint tabular-nums">{num(node.skus)}</span>
        </div>
        <div className="mt-1 ml-5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                DEPT_COLORS[colorIdx % DEPT_COLORS.length],
              )}
              style={{ width: `${widthPct}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted">
            {money(node.ventaSoles)}
          </span>
        </div>
      </button>

      {/* Categorías */}
      {isOpen && node.children.length > 0 && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border-soft pl-2 animate-[fade-in_var(--duration-fast)_var(--ease-premium)_both]">
          {node.children.map((cat) => (
            <CatRow
              key={cat.name}
              dept={node.name}
              node={cat}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CatRow({
  dept,
  node,
  selection,
  onSelect,
}: {
  dept: string;
  node: TreeNode;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isOpen = selection.cat === node.name && selection.dept === dept;
  const isActive = isOpen && !selection.subcat;
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isOpen
              ? { dept, cat: null, subcat: null }
              : { dept, cat: node.name, subcat: null },
          )
        }
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-primary/15 text-primary" : "hover:bg-surface-2 text-muted",
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-faint transition-transform duration-[var(--duration-fast)]",
            isOpen && "rotate-90 text-primary",
          )}
        />
        {isOpen ? (
          <FolderOpen className="h-3 w-3 shrink-0 text-primary" />
        ) : (
          <Folder className="h-3 w-3 shrink-0 text-faint group-hover:text-fg" />
        )}
        <span
          className={cn(
            "flex-1 truncate text-[11px] font-medium",
            isActive ? "text-primary" : "text-fg",
          )}
        >
          {node.name}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-faint">
          {num(node.skus)}
        </span>
      </button>

      {/* Subcategorías */}
      {isOpen && node.children.length > 0 && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border-soft pl-2 animate-[fade-in_var(--duration-fast)_var(--ease-premium)_both]">
          {node.children.map((sub) => (
            <SubcatRow
              key={sub.name}
              dept={dept}
              cat={node.name}
              node={sub}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function SubcatRow({
  dept,
  cat,
  node,
  selection,
  onSelect,
}: {
  dept: string;
  cat: string;
  node: TreeNode;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const isActive =
    selection.subcat === node.name &&
    selection.cat === cat &&
    selection.dept === dept;
  return (
    <li>
      <button
        onClick={() =>
          onSelect(
            isActive
              ? { dept, cat, subcat: null }
              : { dept, cat, subcat: node.name },
          )
        }
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isActive ? "bg-primary/15 text-primary" : "hover:bg-surface-2 text-muted",
        )}
      >
        <Tag
          className={cn(
            "h-3 w-3 shrink-0",
            isActive ? "text-primary" : "text-faint group-hover:text-fg",
          )}
        />
        <span
          className={cn(
            "flex-1 truncate text-[11px]",
            isActive ? "font-semibold text-primary" : "text-fg",
          )}
        >
          {node.name}
        </span>
        {/* Indicador de criticidad: dot rojo si tiene SKUs críticos */}
        {node.criticos > 0 && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
            title={`${node.criticos} críticos`}
          />
        )}
        <span className="shrink-0 text-[10px] tabular-nums text-faint">
          {num(node.skus)}
        </span>
      </button>
    </li>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Breadcrumb navegacional + KPIs locales del nivel
 * ════════════════════════════════════════════════════════════════════════ */

function Breadcrumb({
  selection,
  onNavigate,
}: {
  selection: Selection;
  onNavigate: (s: Selection) => void;
}) {
  const crumbs: { label: string; target: Selection; icon?: typeof Home }[] = [
    { label: "Todos", target: ROOT_SELECTION, icon: Home },
  ];
  if (selection.dept) {
    crumbs.push({
      label: selection.dept,
      target: { dept: selection.dept, cat: null, subcat: null },
    });
  }
  if (selection.cat) {
    crumbs.push({
      label: selection.cat,
      target: { dept: selection.dept, cat: selection.cat, subcat: null },
    });
  }
  if (selection.subcat) {
    crumbs.push({
      label: selection.subcat,
      target: { ...selection },
    });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs"
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const Icon = c.icon;
        return (
          <span key={i} className="flex items-center gap-1">
            <button
              onClick={() => onNavigate(c.target)}
              disabled={isLast}
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
                isLast
                  ? "font-semibold text-fg cursor-default"
                  : "text-muted hover:bg-surface-3 hover:text-fg",
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span className="truncate max-w-[180px]">{c.label}</span>
            </button>
            {!isLast && (
              <ChevronRight className="h-3 w-3 text-faint" aria-hidden />
            )}
          </span>
        );
      })}
    </nav>
  );
}

function ScopeStats({
  scopeKpis,
}: {
  scopeKpis: {
    total: number;
    critico: number;
    alta: number;
    venta: number;
    reponer: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MiniKpi label="SKUs en el nivel" value={num(scopeKpis.total)} />
      <MiniKpi
        label="Críticos"
        value={num(scopeKpis.critico)}
        accent="danger"
      />
      <MiniKpi
        label="Venta 90d (S/)"
        value={money(scopeKpis.venta)}
        accent="primary"
      />
      <MiniKpi
        label="Unds a reponer"
        value={num(scopeKpis.reponer)}
        accent="success"
      />
    </div>
  );
}

function MiniKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "danger" | "warning" | "primary" | "success";
}) {
  const colorClass = accent
    ? {
        danger: "text-danger",
        warning: "text-warning",
        primary: "text-primary",
        success: "text-success",
      }[accent]
    : "text-fg";
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className={cn("mt-0.5 text-base font-bold tabular-nums", colorClass)}>
        {value}
      </p>
    </div>
  );
}

function SkuTable({
  rows,
  onSelect,
  onAction,
}: {
  rows: ComprasCatalogoSku[];
  onSelect: (sku: ComprasCatalogoSku) => void;
  onAction: (
    sku: ComprasCatalogoSku,
    action: "ordenar" | "posponer" | "ignorar",
  ) => void;
}) {
  const shown = rows.slice(0, RENDER_CAP);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-faint">
            <th className="py-2 pr-2">Producto</th>
            <th className="py-2 px-2">Clasif.</th>
            <th className="py-2 px-2 text-right">Stock</th>
            <th className="py-2 px-2 text-right">Vendido 90d</th>
            <th className="py-2 px-2 text-right">Sugerido</th>
            <th className="py-2 px-2 text-right">Margen</th>
            <th className="py-2 pl-2 text-center no-print">Acción</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr
              key={`${s.sucursal}-${s.sku}`}
              className="group border-b border-border/20 transition-colors hover:bg-surface-3/45"
            >
              <td
                className="cursor-pointer py-2.5 pr-2 min-w-[220px] max-w-[340px]"
                onClick={() => onSelect(s)}
                title="Ver detalle"
              >
                <p className="truncate font-semibold text-fg group-hover:text-primary">
                  {s.producto}
                </p>
                <p className="font-mono text-[9px] text-faint">
                  {s.sku}
                  {s.subcategoria ? ` · ${s.subcategoria}` : ""}
                </p>
              </td>
              <td className="py-2.5 px-2">
                <ClassificationCell
                  clasificacion={s.clasificacion}
                  severidad={s.severidad}
                  vel90d={s.velocidad_90d}
                  vel30d={s.velocidad_30d}
                  proy30d={s.proyeccion_30d}
                />
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                <span
                  className={cn(
                    s.stock_disponible === 0 ? "font-bold text-danger" : "text-muted",
                  )}
                >
                  {num(s.stock_disponible)}
                </span>
                {s.stock_almacen > 0 && (
                  <span className="ml-1 text-[10px] text-faint" title="Stock en almacén central">
                    (+{num(s.stock_almacen)})
                  </span>
                )}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums text-muted">
                {num(s.unds_vend_90d)}
                {s.vendido_sku_soles > 0 && (
                  <span className="block text-[10px] text-faint">
                    {money(s.vendido_sku_soles)}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-primary">
                {s.cantidad_sugerida > 0 ? num(s.cantidad_sugerida) : "—"}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">
                {s.margen_pct !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      s.margen_pct >= 30
                        ? "text-success"
                        : s.margen_pct >= 15
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {pct(s.margen_pct)}
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="py-2.5 pl-2 text-center no-print">
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={() => onAction(s, "ordenar")}
                    className="rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
                    title={`Ordenar ${s.cantidad_sugerida} uni.`}
                  >
                    Ordenar
                  </button>
                  <button
                    onClick={() => onAction(s, "posponer")}
                    className="rounded p-1 text-faint hover:bg-surface-2 hover:text-warning"
                    title="Posponer"
                  >
                    <Clock className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onAction(s, "ignorar")}
                    className="rounded p-1 text-faint hover:bg-surface-2 hover:text-danger"
                    title="Ignorar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > RENDER_CAP && (
        <p className="mt-3 text-center text-xs text-faint">
          Mostrando los primeros {num(RENDER_CAP)} de {num(rows.length)}. Refiná con filtros para ver el resto.
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Drawer de detalle SKU — Fase 3.
 *
 * Lateral derecho (slide-in). Trae:
 *   - Banner de severidad + clasificación completa + causal
 *   - 8 stats clave (stock, velocidad, ventas, proyección, margen…)
 *   - Gráfico de ventas + recepciones (180 días por defecto, reusa /matrix-sim/sku-history)
 *   - 3 botones de acción (Ordenar / Posponer / Ignorar) — visuales por ahora
 *
 * El gráfico solo se carga cuando el drawer está abierto (lazy via `enabled`).
 * ──────────────────────────────────────────────────────────── */

const HISTORY_PERIODS = [
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 365, label: "1 año" },
] as const;

function SkuDetailDrawer({
  sku,
  officeId,
  onClose,
}: {
  sku: ComprasCatalogoSku | null;
  officeId: number | null;
  onClose: () => void;
}) {
  const [historyDays, setHistoryDays] = useState<number>(180);
  const [editQty, setEditQty] = useState<number>(0);
  const [qtySyncedFor, setQtySyncedFor] = useState<string | null>(null);
  const open = sku !== null;
  const qc = useQueryClient();

  // Sincroniza el input de cantidad cuando cambia el SKU del drawer.
  if (sku && qtySyncedFor !== sku.sku) {
    setQtySyncedFor(sku.sku);
    setEditQty(sku.cantidad_sugerida || 0);
  }

  // Lazy fetch: solo cuando el drawer está abierto + tenemos sku válido.
  const history = useQuery({
    queryKey: ["sku-history", sku?.sku, historyDays, officeId],
    queryFn: ({ signal }) =>
      getSkuHistory(sku!.sku, historyDays, officeId, signal),
    enabled: !!sku,
    staleTime: 60_000,
  });

  // Decisión vigente + historial del SKU en esta sucursal.
  const decisions = useQuery({
    queryKey: ["purchase-decisions", sku?.sku, officeId],
    queryFn: ({ signal }) =>
      getPurchaseDecisionsBySku(sku!.sku, officeId, signal),
    enabled: !!sku && officeId != null,
    staleTime: 30_000,
  });

  const decide = useMutation({
    mutationFn: (action: PurchaseDecisionKind) => {
      if (!sku || officeId == null) throw new Error("Falta sucursal o SKU");
      const isPurchase = action === "ordenar" || action === "comprar_similar";
      return createPurchaseDecision({
        sku: sku.sku,
        bsale_office_id: officeId,
        decision: action,
        quantity: isPurchase ? editQty : null,
        classification_snapshot: {
          clasificacion: sku.clasificacion,
          severidad: sku.severidad,
          accion: sku.accion,
          stock_disponible: sku.stock_disponible,
          cantidad_sugerida: sku.cantidad_sugerida,
          vendido_sku_soles: sku.vendido_sku_soles,
        },
      });
    },
    onSuccess: (_data, action) => {
      const verb = {
        ordenar: "Ordenar",
        comprar_similar: "Comprar similar",
        posponer: "Posponer",
        ignorar: "Ignorar",
      }[action];
      toast.success(`${verb} guardado`, {
        description:
          action === "ordenar" || action === "comprar_similar"
            ? `${editQty} uni. · ${sku?.producto ?? ""}`
            : sku?.producto ?? "",
      });
      qc.invalidateQueries({ queryKey: ["purchase-decisions"] });
    },
    onError: (err: Error) => {
      toast.error("Error guardando decisión", { description: err.message });
    },
  });

  const current = decisions.data?.current ?? null;
  const isPurchaseQtyInvalid = editQty <= 0;
  const decisionLabel: Record<PurchaseDecisionKind, string> = {
    ordenar: "Ordenado",
    comprar_similar: "Comprado similar",
    posponer: "Pospuesto",
    ignorar: "Ignorado",
  };

  const TendenciaIcon =
    sku?.tendencia?.includes("↑") || sku?.tendencia?.toLowerCase().includes("creci")
      ? TrendingUp
      : sku?.tendencia?.includes("↓") || sku?.tendencia?.toLowerCase().includes("deca")
        ? TrendingDown
        : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={sku?.producto ?? ""}
      subtitle={
        sku ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-fg">{sku.sku}</span>
            <span className="text-faint">·</span>
            <span>{sku.sucursal}</span>
            <span className="text-faint">·</span>
            <span className="truncate">
              {[sku.departamento, sku.categoria, sku.subcategoria]
                .filter(Boolean)
                .join(" › ")}
            </span>
          </span>
        ) : null
      }
    >
      {!sku ? null : (
        <div className="space-y-5">
          {/* ─── Banner severidad + clasificación ─── */}
          <div
            className={cn(
              "rounded-lg border p-4",
              severityChipClass(sku.severidad),
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {(() => {
                  const meta = getClassificationMeta(sku.clasificacion);
                  const Icon = meta.icon;
                  return (
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", meta.bgClass)}>
                      <Icon className={cn("h-4 w-4", meta.colorClass)} />
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span>{sku.severidad}</span>
                  <span className="opacity-60">·</span>
                  <span>{sku.accion}</span>
                  <span className="opacity-60">·</span>
                  <span className="font-normal opacity-90">{sku.causal}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed font-medium">{sku.clasificacion}</p>
              </div>
            </div>
          </div>

          {/* ─── Decisión vigente (si existe) ─── */}
          {current && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-success/40 bg-success-dim/30 px-3 py-2 text-xs text-success">
              <Check className="h-3.5 w-3.5" />
              <span className="font-semibold">
                {decisionLabel[current.decision]}
              </span>
              {current.quantity != null && (
                <span>· {num(current.quantity)} uni.</span>
              )}
              <span className="text-faint">
                · {new Date(current.created_at).toLocaleString()}
              </span>
              {decisions.data && decisions.data.history.length > 1 && (
                <span className="text-faint">
                  · {decisions.data.history.length - 1} decisión(es) previa(s)
                </span>
              )}
            </div>
          )}

          {/* ─── Acciones — cantidad editable + 4 botones ─── */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-faint">
                  Cantidad a comprar
                </span>
                <input
                  type="number"
                  min={1}
                  value={editQty || ""}
                  onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                  className="h-9 w-28 rounded-md border border-border-soft bg-surface-2 px-3 text-body text-fg focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  aria-invalid={isPurchaseQtyInvalid}
                />
              </label>
              <span className="pb-1 text-[0.62rem] text-faint">
                sugerencia del sistema:{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setEditQty(sku.cantidad_sugerida || 0)}
                  title="Usar la cantidad sugerida"
                >
                  {num(sku.cantidad_sugerida)} uni.
                </button>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => decide.mutate("ordenar")}
                variant="primary"
                size="sm"
                disabled={
                  decide.isPending || officeId == null || isPurchaseQtyInvalid
                }
                title={
                  officeId == null
                    ? "Seleccioná una sucursal arriba"
                    : isPurchaseQtyInvalid
                      ? "Ingresá una cantidad > 0"
                      : `Ordenar ${editQty} uni.`
                }
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Ordenar {editQty > 0 ? `${num(editQty)} uni.` : ""}
              </Button>
              <Button
                onClick={() => decide.mutate("comprar_similar")}
                variant="secondary"
                size="sm"
                disabled={
                  decide.isPending || officeId == null || isPurchaseQtyInvalid
                }
                title="Compré un producto igual / equivalente"
              >
                <Copy className="h-3.5 w-3.5" />
                Comprar similar
              </Button>
              <Button
                onClick={() => decide.mutate("posponer")}
                variant="secondary"
                size="sm"
                disabled={decide.isPending || officeId == null}
              >
                <Clock className="h-3.5 w-3.5" /> Posponer
              </Button>
              <Button
                onClick={() => decide.mutate("ignorar")}
                variant="ghost"
                size="sm"
                disabled={decide.isPending || officeId == null}
              >
                <X className="h-3.5 w-3.5" /> Ignorar
              </Button>
            </div>

            {officeId == null && (
              <p className="text-[0.62rem] text-warning">
                Seleccioná una sucursal arriba para poder guardar decisiones.
              </p>
            )}
          </div>

          {/* ─── Grid de stats clave ─── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Stock disponible"
              value={num(sku.stock_disponible)}
              accent={sku.stock_disponible === 0 ? "danger" : undefined}
              hint={
                sku.stock_almacen > 0
                  ? `+${num(sku.stock_almacen)} en almacén`
                  : undefined
              }
            />
            <Stat
              label="Velocidad 30d"
              value={sku.velocidad_30d.toFixed(2)}
              hint="uds/día"
            />
            <Stat
              label="Vendido 90d"
              value={num(sku.unds_vend_90d)}
              hint={`${money(sku.vendido_sku_soles)}`}
            />
            <Stat
              label="Proyección 30d"
              value={num(sku.proyeccion_30d)}
              hint="uds (90d)"
            />
            <Stat
              label="Cantidad sugerida"
              value={sku.cantidad_sugerida > 0 ? num(sku.cantidad_sugerida) : "—"}
              accent={sku.cantidad_sugerida > 0 ? "primary" : undefined}
              hint="cobertura 30d"
            />
            <Stat
              label="Margen"
              value={sku.margen_pct !== null ? pct(sku.margen_pct) : "—"}
              accent={
                sku.margen_pct === null
                  ? undefined
                  : sku.margen_pct >= 30
                    ? "success"
                    : sku.margen_pct >= 15
                      ? "warning"
                      : "danger"
              }
              hint={
                sku.margen_soles !== null ? `${money(sku.margen_soles)} 90d` : undefined
              }
            />
            <Stat
              label="Cobertura"
              value={String(sku.cobertura_dias ?? "—")}
            />
            <Stat
              label="Última venta"
              value={sku.ultima_venta ? dateShort(sku.ultima_venta) : "—"}
              hint={
                sku.dias_sin_vender !== null
                  ? `hace ${sku.dias_sin_vender} días`
                  : undefined
              }
            />
          </div>

          {/* ─── Tendencia + icono ─── */}
          {sku.tendencia && sku.tendencia !== "—" && (
            <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
              {TendenciaIcon ? (
                <TendenciaIcon
                  className={cn(
                    "h-4 w-4",
                    TendenciaIcon === TrendingUp ? "text-success" : "text-danger",
                  )}
                />
              ) : null}
              <span className="font-medium text-fg">Tendencia:</span>
              <span className="text-muted">{sku.tendencia}</span>
            </div>
          )}

          {/* ─── Gráfico histórico ─── */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-muted">
                <Calendar className="h-3.5 w-3.5" />
                Historial de ventas y recepciones
              </h4>
              <div className="inline-flex rounded-md border border-border-soft bg-surface-2 p-0.5">
                {HISTORY_PERIODS.map((p) => (
                  <button
                    key={p.days}
                    onClick={() => setHistoryDays(p.days)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
                      historyDays === p.days
                        ? "bg-primary/15 text-primary"
                        : "text-muted hover:text-fg",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {history.isError ? (
              <ErrorState error={history.error} />
            ) : history.isLoading ? (
              <LoadingState label="Cargando histórico…" />
            ) : !history.data?.points?.length ? (
              <EmptyState
                title="Sin datos históricos"
                hint="Este SKU no registra movimientos en el período."
              />
            ) : (
              <SkuHistoryChart points={history.data.points} />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────── */

/** Stat card pequeña para el drawer (variante simplificada de KpiStat). */
function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
}) {
  const accentClass = accent && {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[accent];
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          accentClass ?? "text-fg",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
      )}
    </div>
  );
}

