"use client";

import { AlertTriangle, Archive, ChevronRight, Download, Home, Layers, Package, Percent, Search, ShoppingCart, SlidersHorizontal, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, num, pct } from "@/lib/format";
import { useSucursal } from "@/components/sucursal-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { LoadingState, EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/data-table";

import { Selection, ROOT_SELECTION } from "../types";
import { useComprasCatalogo } from "../hooks/useComprasCatalogo";
import { scopeTitle } from "../utils";
import { JerarquiaTree, RootNode } from "./HierarchySidebar";
import { SkuTable } from "./SkuTable";
import { SkuDetailDrawer } from "./SkuDetailDrawer";

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "danger" | "warning" | "success" | "primary";
}) {
  const activeClass = tone
    ? {
        danger: "border-danger/40 bg-danger/10 text-danger shadow-[0_0_0_1px_rgba(var(--color-danger),0.1)_inset]",
        warning: "border-warning/40 bg-warning/10 text-warning text-yellow-500 shadow-[0_0_0_1px_rgba(var(--color-warning),0.1)_inset]",
        success: "border-success/40 bg-success/10 text-success shadow-[0_0_0_1px_rgba(var(--color-success),0.1)_inset]",
        primary: "border-primary/40 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(var(--color-primary),0.1)_inset]",
      }[tone]
    : "border-fg/20 bg-fg/5 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset]";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200",
        active
          ? activeClass
          : "border-border-soft bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg",
      )}
    >
      {label}
    </button>
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
      <MiniKpi label="Críticos" value={num(scopeKpis.critico)} accent="danger" />
      <MiniKpi label="Venta 90d (S/)" value={money(scopeKpis.venta)} accent="primary" />
      <MiniKpi label="Unds a reponer" value={num(scopeKpis.reponer)} accent="success" />
    </div>
  );
}

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
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs">
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
            {!isLast && <ChevronRight className="h-3 w-3 text-faint" aria-hidden />}
          </span>
        );
      })}
    </nav>
  );
}

export function ComprasView() {
  const { officeId, sucursalName } = useSucursal();
  const {
    query,
    tree,
    filteredSkus,
    scopeKpis,
    handleAction,
    fSeveridad, setFSeveridad,
    fTendencia, setFTendencia,
    fStockAlmacen, setFStockAlmacen,
    showFilters, setShowFilters,
    selection, setSelection,
    search, setSearch,
    selectedSku, setSelectedSku,
    currentPage, setCurrentPage,
    pageItems, ITEMS_PER_PAGE
  } = useComprasCatalogo(officeId);

  const downloadExcel = () => {
    // Dummy export logic
    console.log("Exporting to Excel");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Catálogo de Compras"
        description={
          officeId == null
            ? "Seleccioná una sucursal para ver las sugerencias de compra."
            : `Sugerencias de reposición algorítmica para ${sucursalName}.`
        }
      />

      {officeId == null ? (
        <EmptyState title="Sucursal no seleccionada" hint="Usa el selector superior para elegir una sucursal y ver las sugerencias." />
      ) : query.isError ? (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-danger text-sm">
          Error al cargar el catálogo. Por favor, intenta de nuevo.
        </div>
      ) : (
        <>
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
                    <span className="font-semibold text-danger">{num(query.data.kpis.skus_critico)}</span> crítico ·{" "}
                    <span className="font-semibold text-warning">{num(query.data.kpis.skus_alta)}</span> alta
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
              sub={query.data ? `Cobertura objetivo · ${query.data.cobertura_objetivo_dias} días` : null}
            />
            <KpiStat
              label="Margen promedio"
              value={
                query.data?.kpis.margen_promedio_pct !== null && query.data?.kpis.margen_promedio_pct !== undefined
                  ? pct(query.data.kpis.margen_promedio_pct)
                  : "—"
              }
              icon={Percent}
              tone="success"
              loading={query.isLoading}
              sub="Ponderado por venta (90d)"
            />
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
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
                  <RootNode total={query.data?.kpis.skus_criticos_total ?? 0} active={!selection.dept && !selection.cat && !selection.subcat} onClick={() => setSelection(ROOT_SELECTION)} />
                  {query.isLoading ? (
                    <LoadingState label="Cargando jerarquía…" />
                  ) : (
                    <JerarquiaTree tree={tree} selection={selection} onSelect={setSelection} />
                  )}
                </CardBody>
              </Card>

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
                        <li key={a.accion} className="flex items-center justify-between rounded px-2 py-1.5 text-muted hover:bg-surface-2">
                          <span className="font-medium text-fg">{a.accion}</span>
                          <span className="tabular-nums font-semibold text-primary">{num(a.skus)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-2 text-center text-xs text-faint">Sin acciones pendientes</p>
                  )}
                </CardBody>
              </Card>
            </aside>

            <main className="flex flex-col gap-4">
              <Breadcrumb selection={selection} onNavigate={setSelection} />

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
                      <Button
                        onClick={() => setShowFilters(true)}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 shrink-0 relative transition-all",
                          (fSeveridad !== "todas" || fTendencia !== "todas" || fStockAlmacen !== "todos")
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60"
                            : "border-border-soft bg-surface-2 hover:bg-surface-3 hover:text-fg text-muted"
                        )}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 mr-2" />
                        <span className="hidden sm:inline font-medium">Filtros</span>
                        {(fSeveridad !== "todas" || fTendencia !== "todas" || fStockAlmacen !== "todos") && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary text-[8px] font-bold text-black flex items-center justify-center border-2 border-surface shadow-sm">
                            {(fSeveridad !== "todas" ? 1 : 0) + (fTendencia !== "todas" ? 1 : 0) + (fStockAlmacen !== "todos" ? 1 : 0)}
                          </span>
                        )}
                      </Button>
                      <div className="w-px h-6 bg-border-soft mx-1 hidden sm:block" />
                      <Button 
                        onClick={downloadExcel} 
                        variant="outline" 
                        size="sm"
                        className="h-8 shrink-0 border-success/40 bg-success/12 text-success transition-colors hover:bg-success/25 hover:border-success/60"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">Exportar</span>
                      </Button>
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
                    <>
                      <SkuTable
                        rows={pageItems}
                        onSelect={setSelectedSku}
                        onAction={handleAction}
                      />
                      {filteredSkus.length > ITEMS_PER_PAGE && (
                        <div className="border-t border-border-soft px-4 py-2">
                          <Pagination
                            total={filteredSkus.length}
                            limit={ITEMS_PER_PAGE}
                            offset={(currentPage - 1) * ITEMS_PER_PAGE}
                            onChange={(newOffset) => setCurrentPage(Math.floor(newOffset / ITEMS_PER_PAGE) + 1)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </CardBody>
              </Card>
            </main>
          </div>
        </>
      )}

      <Drawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filtros Avanzados"
        subtitle="Segmenta tu tabla de compras sugeridas."
        width="sm"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-faint">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Severidad del Quiebre</span>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  <FilterChip label="Todas" active={fSeveridad === "todas"} onClick={() => setFSeveridad("todas")} />
                  <FilterChip label="🔴 Crítico" active={fSeveridad === "critico"} onClick={() => setFSeveridad("critico")} tone="danger" />
                  <FilterChip label="🟠 Alta" active={fSeveridad === "alta"} onClick={() => setFSeveridad("alta")} tone="warning" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-faint">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Tendencia de Demanda</span>
                </div>
                <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Compara los últimos 30 días vs los 90 días históricos.</p>
                <div className="flex flex-wrap gap-2 pl-6">
                  <FilterChip label="Todas" active={fTendencia === "todas"} onClick={() => setFTendencia("todas")} />
                  <FilterChip label="📈 Creciente" active={fTendencia === "creciente"} onClick={() => setFTendencia("creciente")} tone="success" />
                  <FilterChip label="➡️ Estable" active={fTendencia === "estable"} onClick={() => setFTendencia("estable")} tone="primary" />
                  <FilterChip label="📉 Decreciente" active={fTendencia === "decreciente"} onClick={() => setFTendencia("decreciente")} tone="warning" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-faint">
                  <Archive className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">Stock en Almacén Central</span>
                </div>
                <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">¿Tenemos unidades en CD para trasladar inmediatamente?</p>
                <div className="flex flex-wrap gap-2 pl-6">
                  <FilterChip label="Todos" active={fStockAlmacen === "todos"} onClick={() => setFStockAlmacen("todos")} />
                  <FilterChip label="🏢 Con Stock" active={fStockAlmacen === "con_stock"} onClick={() => setFStockAlmacen("con_stock")} tone="success" />
                  <FilterChip label="⚠️ Sin Stock" active={fStockAlmacen === "sin_stock"} onClick={() => setFStockAlmacen("sin_stock")} tone="danger" />
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-border-soft bg-surface-2 p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border-soft bg-surface-1 hover:bg-surface-3 hover:text-fg text-muted"
                onClick={() => {
                  setFSeveridad("todas");
                  setFTendencia("todas");
                  setFStockAlmacen("todos");
                }}
              >
                Limpiar filtros
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setShowFilters(false)}
              >
                Aplicar y cerrar
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <SkuDetailDrawer sku={selectedSku} officeId={officeId} onClose={() => setSelectedSku(null)} />
    </div>
  );
}
