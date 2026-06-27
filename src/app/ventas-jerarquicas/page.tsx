"use client";

import { useMemo, useState, useEffect, useCallback, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { animate, stagger } from "animejs";
import {
  Download,
  Search,
  Sparkles,
  Activity,
  TrendingUp,
  AlertTriangle,
  Snail,
  Skull,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  Tag,
  Layers,
  Filter,
  X,
  Calendar,
  Clock,
  Package,
  Timer,
  Target,
  BarChart2,
  ShieldAlert,
  Banknote,
  Box,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { getMatrix, matrixExcelUrl } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { getClassificationMeta, SmoothSparkline, shortClasif } from "@/components/ui/classification";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { type BadgeTone } from "@/components/ui/badge";
import { useSucursal } from "@/components/sucursal-context";
import { cn } from "@/lib/utils";
import { s, n, money, moneyCompact, num, num2, pct } from "@/lib/format";
import { FilterChip } from "@/components/ui/filter-chip";
import { buildTree, TreeNode } from "@/lib/hierarchy";

type Row = Record<string, unknown>;


/* 5 Columnas del Action Board (Kanban) */
export type KanbanCol =
  | "comprar"
  | "alertas"
  | "vigilar"
  | "lentos"
  | "liquidar";

type KanbanTone = "primary" | "danger" | "success" | "warning" | "neutral";

export const KANBAN_COLS: {
  id: KanbanCol;
  label: string;
  short: string;
  icon: LucideIcon;
  tone: KanbanTone;
}[] = [
  { id: "comprar",  label: "Comprar / Reponer",   short: "Comprar",  icon: TrendingUp,    tone: "primary" },
  { id: "alertas",  label: "Alertas / Anomalías", short: "Alertas",  icon: AlertTriangle, tone: "danger" },
  { id: "vigilar",  label: "Saludable / Vigilar", short: "Saludable", icon: Activity,     tone: "success" },
  { id: "lentos",   label: "Lentos / Excesos",    short: "Lentos",   icon: Snail,         tone: "warning" },
  { id: "liquidar", label: "Salida / Liquidar",   short: "Liquidar", icon: Skull,         tone: "neutral" },
];

/* Estilos por tono — usados en los tabs Kanban */
const TAB_TONE_INACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/12 text-primary",
  danger:  "bg-danger/12 text-danger",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  neutral: "bg-surface-3 text-muted",
};
const TAB_TONE_ACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary text-primary-fg shadow-[0_0_16px_rgba(99,102,241,0.4)]",
  danger:  "bg-danger text-white shadow-[0_0_16px_rgba(240,85,109,0.4)]",
  success: "bg-success text-white shadow-[0_0_16px_rgba(45,212,167,0.4)]",
  warning: "bg-warning text-white shadow-[0_0_16px_rgba(245,166,35,0.4)]",
  neutral: "bg-fg text-bg shadow-sm",
};
const TAB_ACTIVE_BORDER: Record<KanbanTone, string> = {
  primary: "border-primary/50 bg-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  danger:  "border-danger/50 bg-danger/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  success: "border-success/50 bg-success/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  warning: "border-warning/50 bg-warning/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  neutral: "border-border bg-surface-3/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-sm",
};
const TAB_BADGE_INACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/15 text-primary",
  danger:  "bg-danger/15 text-danger",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  neutral: "bg-surface-3 text-muted",
};
const TAB_BADGE_ACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/25 text-fg",
  danger:  "bg-danger/25 text-fg",
  success: "bg-success/25 text-fg",
  warning: "bg-warning/25 text-fg",
  neutral: "bg-surface-3 text-fg",
};

export function getKanbanColumn(row: Row): KanbanCol {
  const clasif = String(row["Clasificación"] || "").toUpperCase();
  
  if (
    clasif.includes("BESTSELLER ACTIVO") ||
    clasif.includes("BESTSELLER RÁPIDO AGOTADO") ||
    clasif.includes("OPORTUNIDAD PERDIDA") ||
    clasif.includes("QUIEBRE DE BESTSELLER") ||
    clasif.includes("AGOTADO CON DEMANDA") ||
    clasif.includes("ALTA ROTACIÓN POR LOTE") ||
    clasif.includes("ALTA ROTACIÓN") ||
    clasif.includes("ROTACIÓN ACTIVA AL BORDE") ||
    clasif.includes("POCO STOCK CON DEMANDA")
  ) {
    return "comprar";
  }

  if (
    clasif.includes("PÉRDIDA DE STOCK") ||
    clasif.includes("VENTAS CON PÉRDIDA") ||
    clasif.includes("VENDIÓ Y SE PERDIÓ") ||
    clasif.includes("STOCK BAJO QUIETO") ||
    clasif.includes("RITMO PERDIDO") ||
    clasif.includes("EX-BESTSELLER ENFRIADO") ||
    clasif.includes("CASO ATÍPICO")
  ) {
    return "alertas";
  }

  if (
    clasif.includes("PRODUCTO NUEVO") ||
    clasif.includes("EMERGENTE") ||
    clasif.includes("STOCK RECIÉN LLEGADO") ||
    clasif.includes("LOTE NUEVO VENDIENDO") ||
    clasif.includes("RECIÉN REABASTECIDO") ||
    clasif.includes("ROTACIÓN ACTIVA") ||
    clasif.includes("INVENTARIO SANO") ||
    clasif.includes("VENDIENDO MÁS") ||
    clasif.includes("RECIBIDO Y NO VENDIDO")
  ) {
    return "vigilar";
  }

  if (
    clasif.includes("LENTO PERO CONSTANTE") ||
    clasif.includes("BAJA ROTACIÓN") ||
    clasif.includes("EXCESO") ||
    clasif.includes("STOCK EXCESIVO") ||
    clasif.includes("ROTACIÓN BAJANDO")
  ) {
    return "lentos";
  }

  // Fallback a liquidar
  return "liquidar";
}



/* ─── Health helpers ─── */
function HealthBadge({ paraComprar, saludables, compact }: { paraComprar: number; saludables: number; compact?: boolean }) {
  // Solo mostrar la alerta si la cantidad de productos para comprar es MAYOR a la cantidad de productos saludables
  const isWorseThanHealthy = paraComprar > saludables;
  
  if (!isWorseThanHealthy || paraComprar === 0) return null;

  return (
    <span
      className="group inline-flex items-center cursor-help rounded-full text-danger/80 hover:bg-danger/10 hover:px-1.5 hover:py-0.5 transition-all duration-300"
    >
      <AlertTriangle className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />
      <span className={cn(
        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out font-bold tabular-nums text-danger",
        "max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-1",
        compact ? "text-[0.55rem]" : "text-[0.6rem]"
      )}>
        {paraComprar} reponer
      </span>
    </span>
  );
}



/* ═══════════════════════════════════════════════════════════════════════ */

export default function VentasJerarquicasPage() {
  const { sucursalName } = useSucursal();
  const [busqueda, setBusqueda] = useState("");
  const deferredBusqueda = useDeferredValue(busqueda);
  const [deptoSel, setDeptoSel] = useState<string | null>(null);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [subcatSel, setSubcatSel] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<Row | null>(null);

  /* Nodos expandidos en el árbol */
  const [expandedDeptos, setExpandedDeptos] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  /* Tab del Kanban activo */
  const [activeTab, setActiveTab] = useState<KanbanCol>("comprar");

  /* Paginación dentro del tab */
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  /* Filtros avanzados */
  const [fStock, setFStock] = useState<"todos" | "con_stock" | "sin_stock">("todos");
  const [fDias, setFDias] = useState<"todos" | "7" | "15" | "30">("todos");
  const [fMesIngreso, setFMesIngreso] = useState<Set<string>>(new Set());
  const [mesDropdownOpen, setMesDropdownOpen] = useState(false);
  const [fXYZ, setFXYZ] = useState<"todos" | "X" | "Y" | "Z">("todos");
  const [fTendencia, setFTendencia] = useState<"todos" | "creciendo" | "estable" | "bajando">("todos");
  const [fCobertura, setFCobertura] = useState<"todos" | "critica_10" | "critica" | "baja" | "ok">("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const q = useQuery({
    queryKey: ["matrix-04b", sucursalName],
    queryFn: ({ signal }) =>
      getMatrix(
        "04b",
        { sucursal: sucursalName ?? undefined },
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

  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set<string>();
    for (const r of allRows) {
      const d = s(r["Últ. Recepción"]);
      if (d && d.length >= 7) {
        setMeses.add(d.substring(0, 7)); // Extrae "YYYY-MM"
      }
    }
    return Array.from(setMeses).sort().reverse();
  }, [allRows]);

  const rowsRelevantesBusqueda = useMemo(() => {
    const dBusq = deferredBusqueda ? deferredBusqueda.toLowerCase() : "";

    return allRows.filter((r) => {
      // 1. Stock
      if (fStock !== "todos") {
        const sd = n(r["Stock Disp"]);
        if (fStock === "con_stock" && sd <= 0) return false;
        if (fStock === "sin_stock" && sd > 0) return false;
      }
      
      // 2. Dias
      if (fDias !== "todos") {
        const minDias = parseInt(fDias, 10);
        if (n(r["Días sin Vender"]) < minDias) return false;
      }
      
      // 3. Mes Ingreso
      if (fMesIngreso.size > 0) {
        const d = s(r["Últ. Recepción"]);
        if (!d || d.length < 7 || !fMesIngreso.has(d.substring(0, 7))) return false;
      }
      
      // 4. XYZ
      if (fXYZ !== "todos") {
        if (!s(r["XYZ"]).toUpperCase().startsWith(fXYZ)) return false;
      }
      
      // 5. Tendencia
      if (fTendencia !== "todos") {
        const t = s(r["Tendencia"]).toUpperCase();
        if (fTendencia === "creciendo" && !t.includes("CRECIENDO")) return false;
        if (fTendencia === "bajando" && !t.includes("BAJANDO")) return false;
        if (fTendencia === "estable" && (t.includes("CRECIENDO") || t.includes("BAJANDO"))) return false;
      }
      
      // 6. Cobertura
      if (fCobertura !== "todos") {
        const cob = n(r["Cobertura"]);
        if (fCobertura === "critica_10" && cob > 10) return false;
        if (fCobertura === "critica" && cob >= 15) return false;
        if (fCobertura === "baja" && (cob < 15 || cob > 30)) return false;
        if (fCobertura === "ok" && cob <= 30) return false;
      }
      
      // 7. Búsqueda (Costo elevado de evaluación de string, al final)
      if (dBusq) {
        if (
          !s(r["Producto"]).toLowerCase().includes(dBusq) &&
          !s(r["Código SKU"]).toLowerCase().includes(dBusq) &&
          !s(r["Clasificación"]).toLowerCase().includes(dBusq)
        ) {
          return false;
        }
      }
      
      return true;
    });
  }, [allRows, deferredBusqueda, fStock, fDias, fMesIngreso, fXYZ, fTendencia, fCobertura]);

  /* ─── Construir árbol jerárquico ─── */
  const jerarquia = useMemo<TreeNode[]>(() => {
    return buildTree(rowsRelevantesBusqueda);
  }, [rowsRelevantesBusqueda]);

  const totalGeneral = useMemo(
    () => jerarquia.reduce((a, d) => a + d.ventaSoles, 0),
    [jerarquia]
  );

  // Auto-expandir cuando hay búsqueda
  useEffect(() => {
    if (deferredBusqueda && deferredBusqueda.length >= 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedDeptos((prev) => {
        const next = new Set(prev);
        jerarquia.forEach((d) => next.add(d.name));
        return next;
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedCats((prev) => {
        const next = new Set(prev);
        jerarquia.forEach((d) => {
          d.children.forEach((c) => {
            next.add(`${d.name}::${c.name}`);
          });
        });
        return next;
      });
    }
  }, [deferredBusqueda, jerarquia]);

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

  /* ─── SKUs filtrados por depto + cat + subcat + búsqueda ─── */
  const skusFiltrados = useMemo(() => {
    return rowsRelevantesBusqueda.filter((r) => {
        const dMatch = deptoSel ? s(r["Departamento"]) === deptoSel : true;
        const cMatch = catSel ? (s(r["Categoría"]) || "Sin categoría") === catSel : true;
        const sMatch = subcatSel ? (s(r["Subcategoría"]) || "Sin subcategoría") === subcatSel : true;
        return dMatch && cMatch && sMatch;
      })
      .sort((a, b) => ventasDeRow(b) - ventasDeRow(a));
  }, [rowsRelevantesBusqueda, deptoSel, catSel, subcatSel]);

  /* ─── Conteos por tab y items del tab activo ─── */
  const tabCounts = useMemo(() => {
    const counts: Record<KanbanCol, number> = {
      comprar: 0, alertas: 0, vigilar: 0, lentos: 0, liquidar: 0,
    };
    for (const r of skusFiltrados) {
      counts[getKanbanColumn(r)] += 1;
    }
    return counts;
  }, [skusFiltrados]);

  const tabItems = useMemo(
    () => skusFiltrados.filter((r) => getKanbanColumn(r) === activeTab),
    [skusFiltrados, activeTab],
  );

  const totalPages = Math.max(1, Math.ceil(tabItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(
    () => tabItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [tabItems, safePage],
  );

  /* Reset de página cuando cambia el tab o los filtros */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [activeTab, deptoSel, catSel, subcatSel, busqueda, fStock, fDias, fMesIngreso, fXYZ, fTendencia, fCobertura]);

  /* AnimeJS Stagger effect */
  useEffect(() => {
    animate(".product-list-item", {
      translateY: [20, 0],
      opacity: [0, 1],
      delay: stagger(40, { start: 50 }),
      easing: "outElastic(1, .8)",
      duration: 600,
    });
  }, [pageItems, activeTab]);

  const hasActiveAdvancedFilters =
    fXYZ !== "todos" ||
    fTendencia !== "todos" ||
    fCobertura !== "todos";

  const hasActiveFilters =
    fStock !== "todos" ||
    fDias !== "todos" ||
    fMesIngreso.size > 0 ||
    hasActiveAdvancedFilters;

  return (
    <div>
      {q.isError ? (
        <ErrorState error={q.error} />
      ) : q.isLoading ? (
        <LoadingState />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            "lg:grid-cols-[420px_1fr]",
          )}
        >
          <aside className="flex flex-col gap-3">
            <Card className="bg-surface/30 backdrop-blur-xl border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
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
                <div className="mt-3 flex gap-0.5 overflow-hidden rounded-full h-1.5 opacity-0 animate-[fade-in-up_var(--duration-slow)_var(--ease-premium)_both]">
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
                        className={cn("h-full transition-all duration-[var(--duration-slow)]", colors[i])}
                        style={{ width: `${d.pct * 100}%` }}
                        title={`${d.name}: ${pct(d.pct * 100)}`}
                      />
                    );
                  })}
                  <div
                    className="h-full bg-surface-3"
                    style={{
                      width: `${Math.max(
                        0,
                        (1 - jerarquia.slice(0, 5).reduce((a, d) => a + d.pct, 0)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="bg-surface/30 backdrop-blur-xl border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <CardBody className="p-2">
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

                <ul className="mt-1 flex max-h-[65vh] flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
                  {jerarquia.map((dept, deptIdx) => {
                    const isDeptSel = deptoSel === dept.name;
                    const isDeptExpanded = expandedDeptos.has(dept.name);
                    const deptTone = DEPT_COLORS[deptIdx % DEPT_COLORS.length];

                    return (
                      <li key={dept.name}>
                        <div
                          className={cn(
                            "group flex w-full items-start gap-0.5 rounded-xl transition-all border border-transparent",
                            "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                            isDeptSel && !catSel
                              ? `${deptTone.bgActive} border-white/10 shadow-sm`
                              : "hover:bg-surface-2",
                          )}
                        >
                          <button
                            onClick={() => toggleDepto(dept.name)}
                            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition-all hover:bg-surface-3 hover:text-muted"
                            aria-label={isDeptExpanded ? "Colapsar" : "Expandir"}
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]",
                                isDeptExpanded && "rotate-90",
                              )}
                            />
                          </button>

                          <button
                            onClick={() => selectDepto(dept.name)}
                            className="relative flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3 text-left overflow-hidden"
                          >
                            <div className="flex items-center justify-between gap-3 w-full mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full shadow-sm", deptTone.dot)} />
                                <p className="truncate text-[0.8rem] font-semibold text-fg/90">
                                  {dept.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <p className="text-sm font-mono font-semibold text-fg group-hover:text-primary transition-colors">{moneyCompact(dept.ventaSoles)}</p>
                                <p className="text-[10px] text-faint">{pct(dept.pct)}</p>
                              </div>
                            </div>
                            
                            <div className="pl-6 flex items-center gap-2 h-6 opacity-90 group-hover:opacity-100 transition-opacity">
                               <HealthBadge paraComprar={dept.paraComprar ?? 0} saludables={dept.saludables ?? 0} />
                            </div>
                          </button>
                        </div>

                        {isDeptExpanded && dept.children.length > 0 && (
                          <ul className="pl-3 mt-1.5 flex flex-col gap-1 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border-soft">
                            {dept.children.map((cat) => {
                              const catKey = `${dept.name}::${cat.name}`;
                              const isCatSel = isDeptSel && catSel === cat.name;
                              const isCatExpanded = expandedCats.has(catKey);

                              return (
                                <li key={cat.name}>
                                  <div
                                    className={cn(
                                      "group flex w-full items-start gap-0.5 rounded-lg transition-all",
                                      "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                                      isCatSel && !subcatSel
                                        ? "bg-info/10 shadow-[inset_3px_0_0_var(--color-info)]"
                                        : "hover:bg-surface-2",
                                    )}
                                  >
                                    <button
                                      onClick={() => toggleCat(dept.name, cat.name)}
                                      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-surface-3 hover:text-muted"
                                      aria-label={isCatExpanded ? "Colapsar" : "Expandir"}
                                    >
                                      <ChevronRight
                                        className={cn(
                                          "h-3 w-3 transition-transform duration-[var(--duration-base)] ease-[var(--ease-premium)]",
                                          isCatExpanded && "rotate-90",
                                        )}
                                      />
                                    </button>

                                    <button
                                      onClick={() => selectCat(dept.name, cat.name)}
                                      className="relative flex min-w-0 flex-1 flex-col justify-center py-2 pr-3 text-left"
                                    >
                                      <div className="flex items-center justify-between gap-2 w-full mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FolderOpen className={cn("h-3 w-3 shrink-0 transition-colors", isCatSel ? "text-info" : "text-faint")} />
                                          <p className={cn("truncate text-[0.7rem] font-medium transition-colors", isCatSel ? "text-info-fg font-semibold" : "text-fg/80")}>
                                            {cat.name}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <p className="text-xs font-mono font-medium text-fg group-hover:text-primary transition-colors">{moneyCompact(cat.ventaSoles)}</p>
                                            <p className="text-[9px] text-faint">{pct(cat.pct)}</p>
                                        </div>
                                      </div>
                                      
                                      <div className="pl-[22px] flex items-center gap-2 h-5 opacity-80 group-hover:opacity-100 transition-opacity">
                                        <HealthBadge paraComprar={cat.paraComprar ?? 0} saludables={cat.saludables ?? 0} />
                                      </div>
                                    </button>
                                  </div>

                                  {isCatExpanded && cat.children.length > 0 && (
                                    <ul className="pl-3 mt-1 flex flex-col gap-0.5 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border-soft/60">
                                      {cat.children.map((subcat) => {
                                        const isSubcatSel = isCatSel && subcatSel === subcat.name;

                                        return (
                                          <li key={subcat.name}>
                                            <button
                                              onClick={() => selectSubcat(dept.name, cat.name, subcat.name)}
                                              className={cn(
                                                "group relative flex w-full flex-col justify-center py-2 pl-4 pr-3 text-left transition-all rounded-md",
                                                "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                                                isSubcatSel
                                                  ? "bg-violet/10 shadow-[inset_3px_0_0_var(--color-violet)]"
                                                  : "hover:bg-surface-2",
                                              )}
                                            >
                                              <div className="flex items-center justify-between gap-2 w-full mb-0.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <Tag className={cn("h-3 w-3 shrink-0 transition-colors", isSubcatSel ? "text-violet" : "text-faint")} />
                                                  <p className={cn("truncate text-[0.65rem] transition-colors", isSubcatSel ? "text-violet-fg font-semibold" : "text-fg/80 font-medium")}>
                                                    {subcat.name}
                                                  </p>
                                                </div>
                                                <div className="text-right">
                                                  <p className="text-[11px] font-mono font-medium text-fg">{moneyCompact(subcat.ventaSoles)}</p>
                                                  <p className="text-[9px] text-faint">{pct(subcat.pct)}</p>
                                                </div>
                                              </div>
                                              
                                              <div className="flex items-center gap-2 w-full pl-5 pr-1">
                                                <ProgressBar pct={subcat.pct} tone="violet" />
                                                <div className="flex items-center gap-1 text-[0.55rem] text-faint shrink-0 tabular-nums">
                                                  <span>{pct(subcat.pct * 100)}</span>
                                                  <span>•</span>
                                                  <span>{num(subcat.skus)} SKUs</span>
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

          <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden bg-surface-2/30 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-[0_12px_48px_rgba(0,0,0,0.4)] relative">
                        {/* Ambient glow behind main area */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet/5 pointer-events-none" />
            
            {/* Tabs de categoría Kanban (Segmented Control style) */}
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
                        isActive
                          ? TAB_ACTIVE_BORDER[col.tone]
                          : "border-transparent text-muted hover:bg-surface-2 hover:text-fg hover:border-white/10",
                        isActive && "shadow-sm"
                      )}
                      aria-pressed={isActive}
                      title={col.label}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive ? TAB_TONE_ACTIVE[col.tone] : TAB_TONE_INACTIVE[col.tone],
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <span
                        className={cn(
                          "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
                          isActive
                            ? "max-w-[200px] opacity-100 text-fg"
                            : "max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100"
                        )}
                      >
                        <span className="hidden md:inline">{col.label}</span>
                        <span className="md:hidden">{col.short}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-bold tabular-nums",
                          isActive ? TAB_BADGE_ACTIVE[col.tone] : TAB_BADGE_INACTIVE[col.tone],
                        )}
                      >
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
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-10 shrink-0 transition-colors rounded-lg px-4",
                    showFilters
                      ? "border-violet bg-violet text-white shadow-sm shadow-violet/30 hover:bg-violet/90"
                      : hasActiveFilters
                        ? "border-violet/50 bg-violet/20 text-violet hover:bg-violet/30 hover:border-violet/70"
                        : "border-violet/30 bg-violet/10 text-violet hover:bg-violet/20 hover:border-violet/50",
                  )}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-pressed={showFilters}
                  title="Filtros avanzados"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline font-semibold">Filtros</span>
                  {hasActiveFilters && (
                    <span
                      className={cn(
                        "ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-bold",
                        showFilters ? "bg-white text-violet" : "bg-violet text-white",
                      )}
                      aria-label="Filtros activos"
                    >
                      !
                    </span>
                  )}
                </Button>
                <a
                  href={matrixExcelUrl("04b", {
                    sucursal: sucursalName ?? undefined,
                  })}
                  target="_blank"
                  rel="noopener"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 rounded-lg border-success/40 bg-success/12 text-success transition-colors hover:bg-success/25 hover:border-success/60 px-4 font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Excel</span>
                  </Button>
                </a>
              </div>

              {/* Active Filters Badges */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 animate-[fade-in-up_var(--duration-fast)_var(--ease-premium)_both]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Filtros Activos:</span>
                  {fStock !== "todos" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      Stock: {fStock === "con_stock" ? "Con stock" : "Agotado"}
                      <button onClick={() => setFStock("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {fDias !== "todos" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      Estancamiento: &gt;{fDias} días
                      <button onClick={() => setFDias("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {fMesIngreso.size > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      Meses: {fMesIngreso.size} selec.
                      <button onClick={() => setFMesIngreso(new Set())} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {fXYZ !== "todos" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      XYZ: {fXYZ}
                      <button onClick={() => setFXYZ("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {fTendencia !== "todos" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      Tendencia: {fTendencia}
                      <button onClick={() => setFTendencia("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {fCobertura !== "todos" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 pl-2 pr-1 py-1 text-xs text-fg shadow-sm border border-white/5">
                      Cobertura: {fCobertura}
                      <button onClick={() => setFCobertura("todos")} className="rounded-full p-0.5 hover:bg-surface-active"><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  
                  <button 
                    onClick={() => { setFStock("todos"); setFDias("todos"); setFMesIngreso(new Set()); setFXYZ("todos"); setFTendencia("todos"); setFCobertura("todos"); }}
                    className="ml-auto text-[0.7rem] font-semibold text-danger hover:underline"
                  >
                    Limpiar todos
                  </button>
                </div>
              )}
            </div>

            {/* Panel Lateral de Filtros (Drawer) */}
            {showFilters && (
              <div className="absolute inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fade-in_var(--duration-fast)_ease-out]" 
                  onClick={() => setShowFilters(false)}
                />
                
                {/* Panel lateral */}
                <div className="relative w-full max-w-sm flex flex-col bg-surface border-l border-white/10 shadow-2xl animate-[slide-in-right_var(--duration-slow)_var(--ease-premium)] h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/10 p-4 bg-surface/50 backdrop-blur-md">
                    <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                      <Filter className="h-5 w-5 text-violet" />
                      Filtros Avanzados
                    </h3>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="p-2 rounded-full hover:bg-white/10 text-muted hover:text-fg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    <div className="flex flex-col gap-6">
                      
                                            {/* Mes de Ingreso Block (Básico) */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1 mb-0.5">
                          <div className="flex items-center gap-2 text-faint">
                            <Calendar className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted">Mes de Ingreso</span>
                          </div>
                          <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Filtra los productos por su fecha de lanzamiento o primer ingreso al sistema.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-6 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 pb-1">
                          <FilterChip 
                            label="Todos" 
                            active={fMesIngreso.size === 0} 
                            onClick={() => setFMesIngreso(new Set())} 
                          />
                          {mesesDisponibles.map(ym => {
                            const [y, m] = ym.split("-");
                            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                            const name = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' }).format(d);
                            const label = name.charAt(0).toUpperCase() + name.slice(1);
                            return (
                              <FilterChip
                                key={ym}
                                label={label}
                                count={allRows.filter(r => { const c = r["Primer Ingreso"]; return typeof c === "string" && c.startsWith(ym); }).length}
                                active={fMesIngreso.has(ym)}
                                onClick={() => setFMesIngreso(prev => {
                                  const next = new Set(prev);
                                  if (next.has(ym)) next.delete(ym);
                                  else next.add(ym);
                                  return next;
                                })}
                                tone="violet"
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Cobertura Block (Básico) */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1 mb-0.5">
                          <div className="flex items-center gap-2 text-faint">
                            <ShieldAlert className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider text-muted">Cobertura</span>
                          </div>
                          <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Días de inventario restante. Ayuda a identificar quiebres de stock inminentes.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-6">
                          <FilterChip label="Todos" active={fCobertura === "todos"} onClick={() => setFCobertura("todos")} />
                          <FilterChip label="🚨 Crítico (Menos de 10 días)" count={allRows.filter(r => n(r["Cobertura"]) <= 10).length} active={fCobertura === "critica_10"} onClick={() => setFCobertura("critica_10")} tone="danger" />
                          <FilterChip label="⚠️ Alerta (Entre 10 y 15 días)" count={allRows.filter(r => n(r["Cobertura"]) < 15 && n(r["Cobertura"]) > 10).length} active={fCobertura === "critica"} onClick={() => setFCobertura("critica")} tone="danger" />
                          <FilterChip label="📉 Bajo (Entre 15 y 30 días)" count={allRows.filter(r => { const c = n(r["Cobertura"]); return c >= 15 && c <= 30; }).length} active={fCobertura === "baja"} onClick={() => setFCobertura("baja")} tone="warning" />
                          <FilterChip label="✅ Óptimo (Más de 30 días)" count={allRows.filter(r => n(r["Cobertura"]) > 30).length} active={fCobertura === "ok"} onClick={() => setFCobertura("ok")} tone="success" />
                        </div>
                      </div>
                      {/* Separator / Búsqueda Avanzada Toggle */}
                      <div className="mt-2 border-t border-white/5 pt-4">
                        <button
                          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                          className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-fg transition-colors w-full group"
                        >
                          <span className="flex-1 text-left">Búsqueda Avanzada</span>
                          <ChevronRight className={cn("h-4 w-4 transition-transform group-hover:text-fg", showAdvancedFilters && "rotate-90")} />
                        </button>
                      </div>

                                            
                      {/* Búsqueda Avanzada */}
                      {showAdvancedFilters && (
                        <div className="flex flex-col gap-6 animate-in slide-in-from-top-4 fade-in duration-300 pb-10">
                          {/* Stock Block */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 mb-0.5">
                              <div className="flex items-center gap-2 text-faint">
                                <Package className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted">Stock Disponible</span>
                              </div>
                              <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Muestra únicamente los productos que actualmente tienen o no inventario físico en el almacén.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              <FilterChip label="Todos" active={fStock === "todos"} onClick={() => setFStock("todos")} />
                              <FilterChip label="Con stock" count={allRows.filter(r => n(r["Stock Disp"]) > 0).length} active={fStock === "con_stock"} onClick={() => setFStock("con_stock")} tone="success" />
                              <FilterChip label="Agotado" count={allRows.filter(r => n(r["Stock Disp"]) <= 0).length} active={fStock === "sin_stock"} onClick={() => setFStock("sin_stock")} tone="danger" />
                            </div>
                          </div>

                          {/* Estancamiento Block */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 mb-0.5">
                              <div className="flex items-center gap-2 text-faint">
                                <Timer className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted">Estancamiento</span>
                              </div>
                              <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Días consecutivos sin registrar ninguna venta. Útil para identificar productos "hueso".</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              <FilterChip label="Todos" active={fDias === "todos"} onClick={() => setFDias("todos")} />
                              <FilterChip label=">7 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 7).length} active={fDias === "7"} onClick={() => setFDias("7")} tone="warning" />
                              <FilterChip label=">15 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 15).length} active={fDias === "15"} onClick={() => setFDias("15")} tone="warning" />
                              <FilterChip label=">30 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 30).length} active={fDias === "30"} onClick={() => setFDias("30")} tone="danger" />
                            </div>
                          </div>

                          {/* XYZ */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 mb-0.5">
                              <div className="flex items-center gap-2 text-faint">
                                <Target className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted">Categorización XYZ</span>
                              </div>
                              <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Clasificación por predictibilidad de ventas. X = estable, Y = estacional, Z = errático.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              <FilterChip label="Todos" active={fXYZ === "todos"} onClick={() => setFXYZ("todos")} />
                              <FilterChip label="X (frecuente)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("X")).length} active={fXYZ === "X"} onClick={() => setFXYZ("X")} tone="success" />
                              <FilterChip label="Y (moderado)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("Y")).length} active={fXYZ === "Y"} onClick={() => setFXYZ("Y")} tone="info" />
                              <FilterChip label="Z (esporádico)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("Z")).length} active={fXYZ === "Z"} onClick={() => setFXYZ("Z")} tone="warning" />
                            </div>
                          </div>

                          {/* Tendencia */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1 mb-0.5">
                              <div className="flex items-center gap-2 text-faint">
                                <BarChart2 className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted">Tendencia</span>
                              </div>
                              <p className="text-[0.65rem] text-faint/80 pl-6 leading-tight">Dirección de la curva de ventas comparando el mes actual contra el histórico reciente.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-6">
                              <FilterChip label="Todos" active={fTendencia === "todos"} onClick={() => setFTendencia("todos")} />
                              <FilterChip label="↑ Creciendo" count={allRows.filter(r => s(r["Tendencia"]).toUpperCase().includes("CRECIENDO")).length} active={fTendencia === "creciendo"} onClick={() => setFTendencia("creciendo")} tone="success" />
                              <FilterChip label="→ Estable" count={allRows.filter(r => { const t = s(r["Tendencia"]).toUpperCase(); return !t.includes("CRECIENDO") && !t.includes("BAJANDO"); }).length} active={fTendencia === "estable"} onClick={() => setFTendencia("estable")} tone="info" />
                              <FilterChip label="↓ Bajando" count={allRows.filter(r => s(r["Tendencia"]).toUpperCase().includes("BAJANDO")).length} active={fTendencia === "bajando"} onClick={() => setFTendencia("bajando")} tone="danger" />
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
            {/* Lista del tab activo (scroll interno) */}
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
                      ventas={ventasDeRow(sku)}
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
                  Mostrando <span className="font-bold text-fg tabular-nums">
                    {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, tabItems.length)}
                  </span> de <span className="font-bold text-fg tabular-nums">{num(tabItems.length)}</span> SKUs
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-soft bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Primera página"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-surface-2 px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </button>
                  <span className="px-2 text-xs font-semibold tabular-nums text-fg">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-surface-2 px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Página siguiente"
                  >
                    Siguiente <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-soft bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Última página"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <ProductDetailPanel
        row={selectedSku || {}}
        open={!!selectedSku}
        onClose={() => setSelectedSku(null)}
        sucursalName={sucursalName}
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

/* (Removed unused BreadcrumbNav and BucketChip) */

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

/* ─────────────────────────── ProductListItem (Data-Row) ─────────────────────────── */

function ProductListItem({
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
  onClick?: () => void;
}) {
  const clasif = String(sku["Clasificación"] || "");
  const tendencia = String(sku["Tendencia"] || "");
  const meta = getClassificationMeta(clasif);
  const Icon = meta.icon;
  
  const [v90, v30, p30] = getTrendMock(tendencia, clasif);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 hover:bg-surface-3/40 hover:shadow-lg transition-all duration-300 ease-out cursor-pointer group rounded-xl mx-2 my-1 border border-transparent hover:border-white/5 relative overflow-hidden" onClick={onClick}>
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* 1. Identificador */}
      <div className="flex w-full sm:w-1/3 min-w-[200px] flex-col justify-center relative z-10">
        <p className="line-clamp-1 text-sm font-semibold text-fg group-hover:text-primary transition-colors duration-300" title={s(sku["Producto"])}>
          {s(sku["Producto"]) || "—"}
        </p>
        <p className="font-mono text-[0.65rem] text-faint mt-1">
          {s(sku["Código SKU"])} <span className="mx-1 text-border">|</span> <span className="text-muted">{s(sku["Categoría"])}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-2">
          <span className={cn("inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/5 shadow-sm", meta.bgClass, meta.colorClass)}>
            <Icon className="h-2.5 w-2.5" /> {shortClasif(clasif)}
          </span>
          {s(sku["XYZ"]) && (
            <span className="inline-flex items-center text-[0.6rem] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface-3 text-muted border border-white/5 shadow-sm">
              XYZ: {s(sku["XYZ"]).charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* 2. Visualización: Sparkline */}
      <div className="flex flex-1 items-center gap-4 relative z-10">
        <div className="w-24 shrink-0 hidden md:block opacity-70 group-hover:opacity-100 transition-opacity duration-300" title={`Tendencia: ${tendencia || 'Estable'}`}>
          <SmoothSparkline v90={v90} v30={v30} p30={p30} width={90} height={24} />
        </div>
      </div>

      {/* 3. Métricas Numéricas Expandidas (Re-diseñadas con Iconos) */}
      <div className="flex items-center gap-3 sm:gap-5 text-right flex-wrap justify-end relative z-10">
        <div className="flex flex-col w-20 items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <Banknote className="h-3 w-3 group-hover/metric:text-primary transition-colors" /> Ventas
          </span>
          <span className="font-mono text-[0.85rem] font-medium text-fg bg-surface-3/40 backdrop-blur-sm px-2 py-0.5 rounded text-right w-full border border-white/5 shadow-inner">
            {moneyCompact(ventas)}
          </span>
        </div>
        <div className="flex flex-col w-16 hidden lg:flex items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <Package className="h-3 w-3 group-hover/metric:text-info transition-colors" /> Unds
          </span>
          <span className="font-mono text-[0.8rem] font-medium text-fg">{num(unidades)}</span>
        </div>
        <div className="flex flex-col w-16 items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <Box className="h-3 w-3 group-hover/metric:text-warning transition-colors" /> Stock
          </span>
          <span className={cn("font-mono text-[0.85rem] font-bold px-2 py-0.5 rounded w-full text-right shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] backdrop-blur-sm", stock === 0 ? "bg-danger/20 text-danger border border-danger/20" : "bg-info/20 text-info border border-info/20")}>
            {num(stock)}
          </span>
        </div>
        <div className="flex flex-col w-16 hidden xl:flex items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <Target className="h-3 w-3 group-hover/metric:text-danger transition-colors" /> Cobert.
          </span>
          <span className={cn("font-mono text-[0.8rem] font-medium", n(sku["Cobertura"]) < 15 ? "text-danger drop-shadow-[0_0_8px_rgba(240,85,109,0.5)]" : "text-fg")}>
            {s(sku["Cobertura"]) || "—"}
          </span>
        </div>
        <div className="flex flex-col w-16 hidden xl:flex items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <TrendingUp className="h-3 w-3 group-hover/metric:text-success transition-colors" /> Veloc.
          </span>
          <span className="font-mono text-[0.8rem] font-medium text-fg">{num2(sku["Velocidad (uds/día)"])} u/d</span>
        </div>
        <div className="flex flex-col w-16 hidden 2xl:flex items-end group/metric">
          <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest text-faint mb-0.5">
            <Activity className="h-3 w-3 group-hover/metric:text-accent transition-colors" /> S-thru
          </span>
          <span className="font-mono text-[0.8rem] font-medium text-fg">{pct(sku["Sell-through Lote %"])}</span>
        </div>
      </div>

      {/* 4. Acciones */}
      <div className="flex shrink-0 items-center justify-end w-6 text-faint group-hover:text-primary transition-all group-hover:translate-x-1 duration-300 relative z-10">
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>
  );
}
