"use client";

import {
  Download, Search, Sparkles,
  ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, FolderOpen, Tag, Layers, Filter,
  X, Calendar, Package, Timer, Target, BarChart2, ShieldAlert
} from "lucide-react";
import { useSucursal } from "@/components/sucursal-context";
import { matrixExcelUrl } from "@/lib/api";
import { money, num, pct } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { cn } from "@/lib/utils";

import { useVentasJerarquicas } from "../hooks/useVentasJerarquicas";
import { n, s } from "../utils";
import { KANBAN_COLS, TAB_ACTIVE_BORDER, TAB_TONE_ACTIVE, TAB_TONE_INACTIVE, TAB_BADGE_ACTIVE, TAB_BADGE_INACTIVE } from "../utils/kanbanConfig";
import { ProgressBar, DEPT_COLORS } from "./ProgressBar";
import { ProductListItem } from "./ProductListItem";
import { HealthBadge } from "./HealthBadge";
import { FilterChip } from "./FilterChip";

export function VentasJerarquicasView() {
  const { sucursalName } = useSucursal();
  const state = useVentasJerarquicas(sucursalName);

  const {
    q, allRows, busqueda, setBusqueda, deptoSel, catSel, subcatSel,
    selectedSku, setSelectedSku, expandedDeptos, expandedCats, activeTab, setActiveTab,
    setCurrentPage, ITEMS_PER_PAGE, fStock, setFStock, fDias, setFDias,
    fMesIngreso, setFMesIngreso, fXYZ, setFXYZ, fTendencia, setFTendencia, fCobertura, setFCobertura,
    showFilters, setShowFilters, showAdvancedFilters, setShowAdvancedFilters,
    jerarquia, totalGeneral, mesesDisponibles, clearSelection, tabCounts, tabItems, totalPages, safePage, pageItems,
    hasActiveFilters
  } = state;

  if (q.isError) return <ErrorState error={q.error} />;
  if (q.isLoading) return <LoadingState />;

  return (
    <div className={cn("grid grid-cols-1 gap-4", "lg:grid-cols-[420px_1fr]")}>
      {/* Sidebar: Árbol Jerárquico */}
      <aside className="flex flex-col gap-3">
        <Card className="bg-surface/30 backdrop-blur-xl border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <CardBody className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">Ventas &amp; Catálogo</p>
                <p className="text-[0.6rem] text-faint">90 días · consolidado</p>
              </div>
              <p className="shrink-0 font-mono text-h3 font-semibold tabular-nums tracking-tight text-fg">
                {money(totalGeneral)}
              </p>
            </div>
            <div className="mt-3 flex gap-0.5 overflow-hidden rounded-full h-1.5 opacity-0 animate-[fade-in-up_var(--duration-slow)_var(--ease-premium)_both]">
              {jerarquia.slice(0, 5).map((d, i) => {
                const colors = ["bg-primary", "bg-info", "bg-violet", "bg-success", "bg-warning"];
                return (
                  <div key={d.name} className={cn("h-full transition-all duration-[var(--duration-slow)]", colors[i])} style={{ width: `${d.pct * 100}%` }} title={`${d.name}: ${pct(d.pct * 100)}`} />
                );
              })}
              <div className="h-full bg-surface-3" style={{ width: `${Math.max(0, (1 - jerarquia.slice(0, 5).reduce((a, d) => a + d.pct, 0)) * 100)}%` }} />
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface/30 backdrop-blur-xl border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <CardBody className="p-2">
            <button onClick={clearSelection} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors", "duration-[var(--duration-fast)] ease-[var(--ease-premium)]", deptoSel === null ? "bg-primary/12 text-fg" : "text-fg hover:bg-surface-2")}>
              <span className="flex items-center gap-2">
                <Layers className={cn("h-4 w-4", deptoSel === null ? "text-primary" : "text-faint")} />
                <span className="text-body font-semibold">Todos los productos</span>
              </span>
              <span className="text-caption tabular-nums text-muted">{num(allRows.length)} SKUs</span>
            </button>

            <ul className="mt-1 flex max-h-[65vh] flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
              {jerarquia.map((dept, deptIdx) => {
                const isDeptSel = deptoSel === dept.name;
                const isDeptExpanded = expandedDeptos.has(dept.name);
                const deptTone = DEPT_COLORS[deptIdx % DEPT_COLORS.length];
                return (
                  <li key={dept.name}>
                    <div className={cn("group flex w-full items-start gap-0.5 rounded-xl transition-all border border-transparent", "duration-[var(--duration-fast)] ease-[var(--ease-premium)]", isDeptSel && !catSel ? `${deptTone.bgActive} border-white/10 shadow-sm` : "hover:bg-surface-2")}>
                      <button onClick={() => state.toggleDepto(dept.name)} className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition-all hover:bg-surface-3 hover:text-muted">
                        <ChevronRight className={cn("h-4 w-4 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]", isDeptExpanded && "rotate-90")} />
                      </button>

                      <button onClick={() => state.selectDepto(dept.name)} className="relative flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3 text-left overflow-hidden">
                        <div className="flex items-center justify-between gap-3 w-full mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-sm", deptTone.dot)} />
                            <p className="truncate text-[0.8rem] font-semibold text-fg/90">{dept.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <HealthBadge paraComprar={dept.paraComprar} saludables={dept.saludables} compact={!isDeptSel} />
                            <p className="font-mono text-[0.75rem] tabular-nums font-bold text-fg shrink-0">{money(dept.ventas)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full pl-4.5 mt-0.5 mb-1 pr-1">
                           <ProgressBar pct={dept.pct} tone={deptTone.bar} />
                           <div className="flex items-center gap-1.5 text-[0.65rem] text-faint shrink-0 tabular-nums">
                             <span>{pct(dept.pct * 100)}</span><span>•</span><span>{num(dept.skuCount)} SKUs</span>
                           </div>
                        </div>
                      </button>
                    </div>

                    {isDeptExpanded && dept.cats.length > 0 && (
                      <ul className="ml-3.5 mt-1 mb-2 animate-tree-expand overflow-hidden border-l border-white/5 pl-1.5 flex flex-col gap-0.5">
                        {dept.cats.map((cat) => {
                          const catKey = `${dept.name}::${cat.name}`;
                          const isCatSel = isDeptSel && catSel === cat.name;
                          const isCatExpanded = expandedCats.has(catKey);
                          return (
                            <li key={cat.name}>
                              <div className={cn("group flex w-full items-start gap-0.5 rounded-lg transition-all", "duration-[var(--duration-fast)] ease-[var(--ease-premium)]", isCatSel && !subcatSel ? "bg-info/10 shadow-[inset_3px_0_0_var(--color-info)]" : "hover:bg-surface-2")}>
                                <button onClick={() => state.toggleCat(dept.name, cat.name)} className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-surface-3 hover:text-muted">
                                  <ChevronRight className={cn("h-3 w-3 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]", isCatExpanded && "rotate-90")} />
                                </button>
                                <button onClick={() => state.selectCat(dept.name, cat.name)} className="relative flex min-w-0 flex-1 flex-col justify-center py-2 pr-3 text-left">
                                  <div className="flex items-center justify-between gap-2 w-full mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FolderOpen className={cn("h-3 w-3 shrink-0 transition-colors", isCatSel ? "text-info" : "text-faint")} />
                                      <p className={cn("truncate text-[0.7rem] font-medium transition-colors", isCatSel ? "text-info-fg font-semibold" : "text-fg/80")}>{cat.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <HealthBadge paraComprar={cat.paraComprar} saludables={cat.saludables} compact />
                                      <p className="font-mono text-[0.7rem] tabular-nums font-semibold text-fg/90 shrink-0">{money(cat.ventas)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full pl-5 mb-1.5 pr-1">
                                     <ProgressBar pct={cat.pct} tone="info" />
                                     <div className="flex items-center gap-1.5 text-[0.6rem] text-faint shrink-0 tabular-nums">
                                        <span>{pct(cat.pct * 100)}</span><span>•</span><span>{num(cat.skuCount)} SKUs</span>
                                     </div>
                                  </div>
                                </button>
                              </div>

                              {isCatExpanded && cat.subcats.length > 0 && (
                                <ul className="ml-3 mt-0.5 mb-1 animate-tree-expand overflow-hidden border-l border-white/5 pl-1.5 flex flex-col gap-0.5">
                                  {cat.subcats.map((subcat) => {
                                    const isSubcatSel = isCatSel && subcatSel === subcat.name;
                                    return (
                                      <li key={subcat.name}>
                                        <button onClick={() => state.selectSubcat(dept.name, cat.name, subcat.name)} className={cn("group relative flex w-full flex-col justify-center py-2 pl-4 pr-3 text-left transition-all rounded-md", "duration-[var(--duration-fast)] ease-[var(--ease-premium)]", isSubcatSel ? "bg-violet/10 shadow-[inset_3px_0_0_var(--color-violet)]" : "hover:bg-surface-2")}>
                                          <div className="flex items-center justify-between gap-2 w-full mb-0.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <Tag className={cn("h-3 w-3 shrink-0 transition-colors", isSubcatSel ? "text-violet" : "text-faint")} />
                                              <p className={cn("truncate text-[0.65rem] transition-colors", isSubcatSel ? "text-violet-fg font-semibold" : "text-fg/80 font-medium")}>{subcat.name}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <HealthBadge paraComprar={subcat.paraComprar} saludables={subcat.saludables} compact />
                                              <p className="font-mono text-[0.65rem] tabular-nums font-semibold text-fg/90 shrink-0">{money(subcat.ventas)}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 w-full pl-5 pr-1">
                                            <ProgressBar pct={subcat.pct} tone="violet" />
                                            <div className="flex items-center gap-1 text-[0.55rem] text-faint shrink-0 tabular-nums">
                                              <span>{pct(subcat.pct * 100)}</span><span>•</span><span>{num(subcat.skuCount)} SKUs</span>
                                            </div>
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

      {/* Main Content */}
      <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden bg-surface-2/30 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-[0_12px_48px_rgba(0,0,0,0.4)] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet/5 pointer-events-none" />
        
        {/* Kanban Tabs */}
        <div className="border-b border-white/5 bg-surface-2/40 relative z-10">
          <div className="flex gap-2 overflow-x-auto px-5 py-3 custom-scrollbar">
            {KANBAN_COLS.map((col) => {
              const count = tabCounts[col.id];
              const isActive = activeTab === col.id;
              const Icon = col.icon;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveTab(col.id)}
                  className={cn(
                    "group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-[var(--duration-fast)]",
                    isActive ? TAB_ACTIVE_BORDER[col.tone] : "border-transparent text-muted hover:bg-surface-2 hover:text-fg hover:border-white/10",
                    isActive && "shadow-sm"
                  )}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors", isActive ? TAB_TONE_ACTIVE[col.tone] : TAB_TONE_INACTIVE[col.tone])}>
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className={cn("overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out", isActive ? "max-w-[200px] opacity-100 text-fg" : "max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100")}>
                    <span className="hidden md:inline">{col.label}</span><span className="md:hidden">{col.short}</span>
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-bold tabular-nums", isActive ? TAB_BADGE_ACTIVE[col.tone] : TAB_BADGE_INACTIVE[col.tone])}>
                    {num(count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar superior (Búsqueda, Filtros, Excel) */}
        <div className="flex flex-col gap-3 border-b border-white/5 bg-surface/60 px-5 py-3 relative z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <Input
                placeholder="Buscar SKU o producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="h-10 bg-black/20 pl-9 border-white/10 hover:border-white/20 focus:border-primary focus:ring-primary/30 transition-all rounded-lg shadow-inner text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className={cn("h-10 shrink-0 transition-colors rounded-lg px-4", showFilters ? "border-violet bg-violet text-white shadow-sm shadow-violet/30 hover:bg-violet/90" : hasActiveFilters ? "border-violet/50 bg-violet/20 text-violet hover:bg-violet/30 hover:border-violet/70" : "border-violet/30 bg-violet/10 text-violet hover:bg-violet/20 hover:border-violet/50")}>
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline font-semibold">Filtros</span>
              {hasActiveFilters && <span className={cn("ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold", showFilters ? "bg-white text-violet" : "bg-violet text-white")}>!</span>}
            </Button>
            <a href={matrixExcelUrl("04b", { sucursal: sucursalName ?? undefined })} target="_blank" rel="noopener">
              <Button variant="outline" size="sm" className="h-10 shrink-0 rounded-lg border-success/40 bg-success/12 text-success transition-colors hover:bg-success/25 hover:border-success/60 px-4 font-semibold">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
            </a>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 animate-[fade-in-up_var(--duration-fast)_var(--ease-premium)_both]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Filtros Activos:</span>
              {fStock !== "todos" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">Stock: {fStock === "con_stock" ? "Con stock" : "Agotado"}<button onClick={() => setFStock("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              {fDias !== "todos" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">Estancamiento: &gt;{fDias} días<button onClick={() => setFDias("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              {fMesIngreso.size > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">Meses: {fMesIngreso.size} selec.<button onClick={() => setFMesIngreso(new Set())} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              {fXYZ !== "todos" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">XYZ: {fXYZ}<button onClick={() => setFXYZ("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              {fTendencia !== "todos" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">Tendencia: {fTendencia}<button onClick={() => setFTendencia("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              {fCobertura !== "todos" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">Cobertura: {fCobertura}<button onClick={() => setFCobertura("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button></span>}
              
              <button onClick={() => { setFStock("todos"); setFDias("todos"); setFMesIngreso(new Set()); setFXYZ("todos"); setFTendencia("todos"); setFCobertura("todos"); }} className="ml-auto text-[0.7rem] font-semibold text-danger hover:underline">
                Limpiar todos
              </button>
            </div>
          )}
        </div>

        {/* Panel Lateral de Filtros (Drawer) */}
        {showFilters && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in_var(--duration-fast)_ease-out]" onClick={() => setShowFilters(false)} />
            <div className="relative w-full max-w-sm flex flex-col bg-surface border-l border-white/10 shadow-2xl animate-[slide-in-right_var(--duration-slow)_var(--ease-premium)] h-full overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 p-4 bg-surface/50 backdrop-blur-md">
                <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                  <Filter className="h-5 w-5 text-violet" /> Filtros Avanzados
                </h3>
                <button onClick={() => setShowFilters(false)} className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-fg transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="flex flex-col gap-6">
                  {/* Mes de Ingreso Block */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1 mb-0.5">
                      <div className="flex items-center gap-2 text-faint">
                        <Calendar className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Mes de Ingreso</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 pb-1">
                      <FilterChip label="Todos" active={fMesIngreso.size === 0} onClick={() => setFMesIngreso(new Set())} />
                      {mesesDisponibles.map(ym => {
                        const [y, m] = ym.split("-");
                        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                        const label = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' }).format(d);
                        return (
                          <FilterChip
                            key={ym}
                            label={label.charAt(0).toUpperCase() + label.slice(1)}
                            active={fMesIngreso.has(ym)}
                            onClick={() => setFMesIngreso(prev => { const next = new Set(prev); if (next.has(ym)) next.delete(ym); else next.add(ym); return next; })}
                            tone="violet"
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Cobertura Block */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-faint mb-0.5">
                      <ShieldAlert className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Cobertura</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6">
                      <FilterChip label="Todos" active={fCobertura === "todos"} onClick={() => setFCobertura("todos")} />
                      <FilterChip label="🚨 Crítico (<10 días)" active={fCobertura === "critica_10"} onClick={() => setFCobertura("critica_10")} tone="danger" />
                      <FilterChip label="⚠️ Alerta (10-15 días)" active={fCobertura === "critica"} onClick={() => setFCobertura("critica")} tone="danger" />
                      <FilterChip label="📉 Bajo (15-30 días)" active={fCobertura === "baja"} onClick={() => setFCobertura("baja")} tone="warning" />
                      <FilterChip label="✅ Óptimo (>30 días)" active={fCobertura === "ok"} onClick={() => setFCobertura("ok")} tone="success" />
                    </div>
                  </div>

                  <div className="mt-2 border-t border-white/5 pt-4">
                    <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg transition-colors w-full group">
                      <span className="flex-1 text-left">Búsqueda Avanzada</span>
                      <ChevronRight className={cn("h-4 w-4 transition-transform group-hover:text-fg", showAdvancedFilters && "rotate-90")} />
                    </button>
                  </div>

                  {showAdvancedFilters && (
                    <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 fade-in duration-300 pb-10">
                      {/* Stock Block */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-faint mb-0.5"><Package className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Stock Disponible</span></div>
                        <div className="flex flex-wrap gap-2 pl-6">
                          <FilterChip label="Todos" active={fStock === "todos"} onClick={() => setFStock("todos")} />
                          <FilterChip label="Con stock" active={fStock === "con_stock"} onClick={() => setFStock("con_stock")} tone="success" />
                          <FilterChip label="Agotado" active={fStock === "sin_stock"} onClick={() => setFStock("sin_stock")} tone="danger" />
                        </div>
                      </div>
                      
                      {/* Estancamiento */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-faint mb-0.5"><Timer className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Estancamiento</span></div>
                        <div className="flex flex-wrap gap-2 pl-6">
                          <FilterChip label="Todos" active={fDias === "todos"} onClick={() => setFDias("todos")} />
                          <FilterChip label=">7 días" active={fDias === "7"} onClick={() => setFDias("7")} tone="warning" />
                          <FilterChip label=">15 días" active={fDias === "15"} onClick={() => setFDias("15")} tone="warning" />
                          <FilterChip label=">30 días" active={fDias === "30"} onClick={() => setFDias("30")} tone="danger" />
                        </div>
                      </div>

                      {/* XYZ */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-faint mb-0.5"><Target className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Categorización XYZ</span></div>
                        <div className="flex flex-wrap gap-2 pl-6">
                          <FilterChip label="Todos" active={fXYZ === "todos"} onClick={() => setFXYZ("todos")} />
                          <FilterChip label="X (frecuente)" active={fXYZ === "X"} onClick={() => setFXYZ("X")} tone="success" />
                          <FilterChip label="Y (moderado)" active={fXYZ === "Y"} onClick={() => setFXYZ("Y")} tone="info" />
                          <FilterChip label="Z (esporádico)" active={fXYZ === "Z"} onClick={() => setFXYZ("Z")} tone="warning" />
                        </div>
                      </div>

                      {/* Tendencia */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-faint mb-0.5"><BarChart2 className="h-4 w-4" /> <span className="text-xs font-bold uppercase tracking-wider text-muted">Tendencia</span></div>
                        <div className="flex flex-wrap gap-2 pl-6">
                          <FilterChip label="Todos" active={fTendencia === "todos"} onClick={() => setFTendencia("todos")} />
                          <FilterChip label="↑ Creciendo" active={fTendencia === "creciendo"} onClick={() => setFTendencia("creciendo")} tone="success" />
                          <FilterChip label="→ Estable" active={fTendencia === "estable"} onClick={() => setFTendencia("estable")} tone="info" />
                          <FilterChip label="↓ Bajando" active={fTendencia === "bajando"} onClick={() => setFTendencia("bajando")} tone="danger" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-white/10 p-4 bg-surface/80 backdrop-blur-md flex justify-end gap-3">
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={() => { setFStock("todos"); setFDias("todos"); setFMesIngreso(new Set()); setFXYZ("todos"); setFTendencia("todos"); setFCobertura("todos"); }} className="text-danger hover:bg-danger/10 hover:text-danger">
                    Limpiar
                  </Button>
                )}
                <Button onClick={() => setShowFilters(false)} className="bg-violet hover:bg-violet/90 text-white shadow-md shadow-violet/20">
                  Ver Resultados
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista del tab activo */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent relative z-10">
          {tabItems.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 py-12 text-center text-sm text-faint">
              No hay productos en esta categoría con los filtros actuales.
            </div>
          ) : (
            <div className="flex flex-col py-2">
              {pageItems.map((sku, i) => (
                <ProductListItem
                  key={`${s(sku["Código SKU"])}-${(safePage - 1) * ITEMS_PER_PAGE + i}`}
                  sku={sku}
                  ventas={n(sku["Vendido SKU S/"])}
                  unidades={n(sku["Unds Vend (90d)"])}
                  stock={n(sku["Stock Disp"])}
                  onClick={() => setSelectedSku(sku)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pie de paginación */}
        {tabItems.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-white/5 bg-surface-2/50 backdrop-blur-md px-5 py-3 sm:flex-row sm:items-center sm:justify-between relative z-10">
            <p className="text-xs text-muted">
              Mostrando <span className="font-bold text-fg tabular-nums">{(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, tabItems.length)}</span> de <span className="font-bold text-fg tabular-nums">{num(tabItems.length)}</span> SKUs
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-soft bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-surface-2 px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="px-2 text-xs font-semibold tabular-nums text-fg">{safePage} / {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-surface-2 px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-soft bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40">
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ProductDetailPanel
        row={selectedSku || {}}
        open={!!selectedSku}
        onClose={() => setSelectedSku(null)}
        sucursalName={sucursalName}
      />
    </div>
  );
}
