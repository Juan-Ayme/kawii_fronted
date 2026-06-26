"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
  type LucideIcon,
} from "lucide-react";
import { getMatrix, matrixExcelUrl } from "@/lib/api";
import { money, moneyCompact, num, num2, pct } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { getClassificationMeta, SmoothSparkline, shortClasif } from "@/components/ui/classification";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { type BadgeTone } from "@/components/ui/badge";
import { useSucursal } from "@/components/sucursal-context";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const str = String(v);
  const m = str.match(/-?\d+(\.\d+)?/);
  if (m) {
    const p = parseFloat(m[0]);
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
};

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
  primary: "bg-primary text-primary-fg shadow-sm shadow-primary/30",
  danger:  "bg-danger text-white shadow-sm shadow-danger/30",
  success: "bg-success text-white shadow-sm shadow-success/30",
  warning: "bg-warning text-white shadow-sm shadow-warning/30",
  neutral: "bg-fg text-bg shadow-sm",
};
const TAB_ACTIVE_BORDER: Record<KanbanTone, string> = {
  primary: "border-primary/50 bg-primary/8 shadow-sm shadow-primary/10",
  danger:  "border-danger/50 bg-danger/8 shadow-sm shadow-danger/10",
  success: "border-success/50 bg-success/8 shadow-sm shadow-success/10",
  warning: "border-warning/50 bg-warning/8 shadow-sm shadow-warning/10",
  neutral: "border-border bg-surface-3/60 shadow-sm",
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

/* ─────────────────── Tipos para el árbol jerárquico ─────────────────── */

interface SubCatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
}

interface CatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
  subcats: SubCatNode[];
}

interface DeptNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
  cats: CatNode[];
}

/* ─── Health helpers ─── */
function HealthBadge({ paraComprar, saludables, compact }: { paraComprar: number; saludables: number; compact?: boolean }) {
  // Solo mostrar la alerta si la cantidad de productos para comprar es MAYOR a la cantidad de productos saludables
  const isWorseThanHealthy = paraComprar > saludables;
  
  if (!isWorseThanHealthy || paraComprar === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/15 px-1.5 py-0.5 text-danger",
        compact ? "text-[0.5rem]" : "text-[0.55rem]",
      )}
      title={`${paraComprar} SKU(s) para reponer vs ${saludables} saludables.`}
    >
      <AlertTriangle className={cn(compact ? "h-2 w-2" : "h-2.5 w-2.5", "animate-pulse")} />
      <span className="font-bold tabular-nums">{paraComprar} {compact ? "" : "para comprar"}</span>
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── FilterChip ─────────────────────────── */
function FilterChip({
  label,
  count,
  active,
  onClick,
  tone = "primary",
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "violet";
}) {
  const toneStyles: Record<string, string> = {
    primary: "border-primary/40 bg-primary/12 text-primary shadow-sm shadow-primary/10",
    success: "border-success/40 bg-success/12 text-success",
    warning: "border-warning/40 bg-warning/12 text-warning",
    danger: "border-danger/40 bg-danger/12 text-danger",
    info: "border-info/40 bg-info/12 text-info",
    violet: "border-violet/40 bg-violet/12 text-violet",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[0.65rem] font-semibold whitespace-nowrap",
        "transition-all duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
        active
          ? toneStyles[tone]
          : "border-border-soft bg-surface text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(
          "rounded-full px-1.5 py-px text-[0.55rem] font-bold tabular-nums",
          active ? "bg-black/15" : "bg-surface-3",
        )}>
          {num(count)}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function VentasJerarquicasPage() {
  const { sucursalName } = useSucursal();
  const [busqueda, setBusqueda] = useState("");
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
  const [fCobertura, setFCobertura] = useState<"todos" | "critica" | "baja" | "ok">("todos");
  const [showFilters, setShowFilters] = useState(false);

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
    let rows = allRows;

    if (fStock !== "todos") {
      rows = rows.filter(r => fStock === "con_stock" ? n(r["Stock Disp"]) > 0 : n(r["Stock Disp"]) <= 0);
    }
    if (fDias !== "todos") {
      const minDias = parseInt(fDias, 10);
      rows = rows.filter(r => n(r["Días sin Vender"]) >= minDias);
    }
    if (fMesIngreso.size > 0) {
      rows = rows.filter(r => {
        const d = s(r["Últ. Recepción"]);
        return d && d.length >= 7 && fMesIngreso.has(d.substring(0, 7));
      });
    }
    if (fXYZ !== "todos") {
      rows = rows.filter(r => s(r["XYZ"]).toUpperCase().startsWith(fXYZ));
    }
    if (fTendencia !== "todos") {
      rows = rows.filter(r => {
        const t = s(r["Tendencia"]).toUpperCase();
        if (fTendencia === "creciendo") return t.includes("CRECIENDO");
        if (fTendencia === "bajando") return t.includes("BAJANDO");
        return t.includes("ESTABLE") || t === "" || (!t.includes("CRECIENDO") && !t.includes("BAJANDO"));
      });
    }
    if (fCobertura !== "todos") {
      rows = rows.filter(r => {
        const cob = n(r["Cobertura"]);
        if (fCobertura === "critica") return cob < 15;
        if (fCobertura === "baja") return cob >= 15 && cob <= 30;
        return cob > 30;
      });
    }
    if (busqueda) {
      const lowerB = busqueda.toLowerCase();
      rows = rows.filter((r) => 
        s(r["Producto"]).toLowerCase().includes(lowerB) ||
        s(r["Código SKU"]).toLowerCase().includes(lowerB) ||
        s(r["Clasificación"]).toLowerCase().includes(lowerB)
      );
    }
    return rows;
  }, [allRows, busqueda, fStock, fDias, fMesIngreso, fXYZ, fTendencia, fCobertura]);

  /* ─── Construir árbol jerárquico ─── */
  const jerarquia = useMemo<DeptNode[]>(() => {
    const deptMap = new Map<
      string,
      {
        ventas: number;
        tickets: number;
        skuCount: number;
        paraComprar: number;
        saludables: number;
        catMap: Map<
          string,
          {
            ventas: number;
            tickets: number;
            skuCount: number;
            paraComprar: number;
            saludables: number;
            subcatMap: Map<
              string,
              { ventas: number; tickets: number; skuCount: number; paraComprar: number; saludables: number; }
            >;
          }
        >;
      }
    >();

    for (const r of rowsRelevantesBusqueda) {
      const dep = s(r["Departamento"]) || "—";
      const cat = s(r["Categoría"]) || "Sin categoría";
      const subcat = s(r["Subcategoría"]) || "Sin subcategoría";
      const v = ventasDeRow(r);
      const t = unds90(r);
      const kanbanCol = getKanbanColumn(r);
      const isComprar = kanbanCol === "comprar" ? 1 : 0;
      const isSaludable = kanbanCol === "vigilar" ? 1 : 0;

      if (!deptMap.has(dep))
        deptMap.set(dep, { ventas: 0, tickets: 0, skuCount: 0, paraComprar: 0, saludables: 0, catMap: new Map() });
      const d = deptMap.get(dep)!;
      d.ventas += v;
      d.tickets += t;
      d.skuCount += 1;
      d.paraComprar += isComprar;
      d.saludables += isSaludable;

      if (!d.catMap.has(cat))
        d.catMap.set(cat, { ventas: 0, tickets: 0, skuCount: 0, paraComprar: 0, saludables: 0, subcatMap: new Map() });
      const c = d.catMap.get(cat)!;
      c.ventas += v;
      c.tickets += t;
      c.skuCount += 1;
      c.paraComprar += isComprar;
      c.saludables += isSaludable;

      if (!c.subcatMap.has(subcat))
        c.subcatMap.set(subcat, { ventas: 0, tickets: 0, skuCount: 0, paraComprar: 0, saludables: 0 });
      const sc = c.subcatMap.get(subcat)!;
      sc.ventas += v;
      sc.tickets += t;
      sc.skuCount += 1;
      sc.paraComprar += isComprar;
      sc.saludables += isSaludable;
    }

    const totalVentas = [...deptMap.values()].reduce((a, d) => a + d.ventas, 0);

    return [...deptMap.entries()]
      .sort(([, a], [, b]) => b.ventas - a.ventas)
      .map(([name, d]) => ({
        name,
        ventas: d.ventas,
        tickets: d.tickets,
        skuCount: d.skuCount,
        paraComprar: d.paraComprar,
        saludables: d.saludables,
        pct: totalVentas > 0 ? d.ventas / totalVentas : 0,
        cats: [...d.catMap.entries()]
          .sort(([, a], [, b]) => b.ventas - a.ventas)
          .map(([catName, c]) => ({
            name: catName,
            ventas: c.ventas,
            tickets: c.tickets,
            skuCount: c.skuCount,
            paraComprar: c.paraComprar,
            saludables: c.saludables,
            pct: d.ventas > 0 ? c.ventas / d.ventas : 0,
            subcats: [...c.subcatMap.entries()]
              .sort(([, a], [, b]) => b.ventas - a.ventas)
              .map(([scName, sc]) => ({
                name: scName,
                ventas: sc.ventas,
                tickets: sc.tickets,
                skuCount: sc.skuCount,
                paraComprar: sc.paraComprar,
                saludables: sc.saludables,
                pct: c.ventas > 0 ? sc.ventas / c.ventas : 0,
              })),
          })),
      }));
  }, [rowsRelevantesBusqueda]);

  const totalGeneral = useMemo(
    () => jerarquia.reduce((a, d) => a + d.ventas, 0),
    [jerarquia],
  );

  // Auto-expandir cuando hay búsqueda
  useEffect(() => {
    if (busqueda && busqueda.length >= 2) {
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
          d.cats.forEach((c) => next.add(`${d.name}::${c.name}`));
        });
        return next;
      });
    }
  }, [busqueda, jerarquia]);

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

  const hasActiveFilters =
    fStock !== "todos" ||
    fDias !== "todos" ||
    fMesIngreso.size > 0 ||
    fXYZ !== "todos" ||
    fTendencia !== "todos" ||
    fCobertura !== "todos";

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

            <Card>
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

                <ul className="mt-1 flex max-h-[65vh] flex-col gap-0.5 overflow-y-auto pr-1">
                  {jerarquia.map((dept, deptIdx) => {
                    const isDeptSel = deptoSel === dept.name;
                    const isDeptExpanded = expandedDeptos.has(dept.name);
                    const deptTone = DEPT_COLORS[deptIdx % DEPT_COLORS.length];

                    return (
                      <li key={dept.name}>
                        <div
                          className={cn(
                            "group flex w-full items-center gap-1 rounded-md transition-all",
                            "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                            isDeptSel && !catSel
                              ? `${deptTone.bgActive} ${deptTone.borderActive}`
                              : "hover:bg-surface-2",
                          )}
                        >
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

                          <button
                            onClick={() => selectDepto(dept.name)}
                            className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left"
                          >
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
                            <div className="flex shrink-0 items-center gap-2">
                              <HealthBadge paraComprar={dept.paraComprar} saludables={dept.saludables} total={dept.skuCount} />
                              <div className="text-right">
                                <p className="font-mono text-caption tabular-nums font-semibold text-fg">
                                  {money(dept.ventas)}
                                </p>
                                <p className="text-[0.6rem] tabular-nums text-faint">
                                  {num(dept.skuCount)} SKUs
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>

                        {isDeptExpanded && dept.cats.length > 0 && (
                          <ul className="ml-3 animate-tree-expand overflow-hidden border-l border-border-soft/50 pl-1">
                            {dept.cats.map((cat) => {
                              const catKey = `${dept.name}::${cat.name}`;
                              const isCatSel =
                                isDeptSel && catSel === cat.name;
                              const isCatExpanded = expandedCats.has(catKey);

                              return (
                                <li key={cat.name}>
                                  <div
                                    className={cn(
                                      "group flex w-full items-center gap-1 rounded-md transition-all",
                                      "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
                                      isCatSel && !subcatSel
                                        ? "bg-info/8 shadow-[inset_3px_0_0_var(--color-info)]"
                                        : "hover:bg-surface-2",
                                    )}
                                  >
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
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <HealthBadge paraComprar={cat.paraComprar} saludables={cat.saludables} total={cat.skuCount} compact />
                                        <div className="text-right">
                                          <p className="font-mono text-[0.65rem] tabular-nums font-semibold text-fg">
                                            {money(cat.ventas)}
                                          </p>
                                          <p className="text-[0.55rem] tabular-nums text-faint">
                                            {num(cat.skuCount)} SKUs
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  </div>

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
                                              <div className="flex shrink-0 items-center gap-1.5">
                                                <HealthBadge paraComprar={subcat.paraComprar} saludables={subcat.saludables} total={subcat.skuCount} compact />
                                                <div className="text-right">
                                                  <p className="font-mono text-[0.6rem] tabular-nums font-semibold text-fg">
                                                    {money(subcat.ventas)}
                                                  </p>
                                                  <p className="text-[0.5rem] tabular-nums text-faint">
                                                    {num(subcat.skuCount)} SKUs
                                                  </p>
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

          <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden bg-surface-2 rounded-xl border border-border-soft">
            {/* Toolbar superior */}
            <div className="flex items-center gap-2 border-b border-border-soft bg-surface px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <Input
                  placeholder="Buscar SKU o producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="h-9 bg-bg pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 shrink-0 transition-colors",
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
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filtros</span>
                {hasActiveFilters && (
                  <span
                    className={cn(
                      "ml-0.5 inline-block h-1.5 w-1.5 rounded-full",
                      showFilters ? "bg-white" : "bg-violet",
                    )}
                    aria-label="Filtros activos"
                  />
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
                  className="h-9 shrink-0 border-success/40 bg-success/12 text-success transition-colors hover:bg-success/25 hover:border-success/60"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
              </a>
            </div>

            {/* Panel de filtros (despliega bajo la toolbar) */}
            {showFilters && (
              <div className="border-b border-border-soft bg-surface/60">
                <div className="flex flex-col gap-3 px-4 py-3 animate-tree-expand">
                  {/* Stock */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">Stock</span>
                    <FilterChip label="Todos" active={fStock === "todos"} onClick={() => setFStock("todos")} />
                    <FilterChip label="Con stock" count={allRows.filter(r => n(r["Stock Disp"]) > 0).length} active={fStock === "con_stock"} onClick={() => setFStock("con_stock")} tone="success" />
                    <FilterChip label="Agotado" count={allRows.filter(r => n(r["Stock Disp"]) <= 0).length} active={fStock === "sin_stock"} onClick={() => setFStock("sin_stock")} tone="danger" />
                  </div>

                  {/* Estancamiento */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">Parado</span>
                    <FilterChip label="Todos" active={fDias === "todos"} onClick={() => setFDias("todos")} />
                    <FilterChip label=">7 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 7).length} active={fDias === "7"} onClick={() => setFDias("7")} tone="warning" />
                    <FilterChip label=">15 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 15).length} active={fDias === "15"} onClick={() => setFDias("15")} tone="warning" />
                    <FilterChip label=">30 días" count={allRows.filter(r => n(r["Días sin Vender"]) >= 30).length} active={fDias === "30"} onClick={() => setFDias("30")} tone="danger" />
                  </div>

                  {/* XYZ */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">XYZ</span>
                    <FilterChip label="Todos" active={fXYZ === "todos"} onClick={() => setFXYZ("todos")} />
                    <FilterChip label="X (frecuente)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("X")).length} active={fXYZ === "X"} onClick={() => setFXYZ("X")} tone="success" />
                    <FilterChip label="Y (moderado)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("Y")).length} active={fXYZ === "Y"} onClick={() => setFXYZ("Y")} tone="info" />
                    <FilterChip label="Z (esporádico)" count={allRows.filter(r => s(r["XYZ"]).toUpperCase().startsWith("Z")).length} active={fXYZ === "Z"} onClick={() => setFXYZ("Z")} tone="warning" />
                  </div>

                  {/* Tendencia */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">Trend</span>
                    <FilterChip label="Todos" active={fTendencia === "todos"} onClick={() => setFTendencia("todos")} />
                    <FilterChip label="↑ Creciendo" count={allRows.filter(r => s(r["Tendencia"]).toUpperCase().includes("CRECIENDO")).length} active={fTendencia === "creciendo"} onClick={() => setFTendencia("creciendo")} tone="success" />
                    <FilterChip label="→ Estable" count={allRows.filter(r => { const t = s(r["Tendencia"]).toUpperCase(); return !t.includes("CRECIENDO") && !t.includes("BAJANDO"); }).length} active={fTendencia === "estable"} onClick={() => setFTendencia("estable")} tone="info" />
                    <FilterChip label="↓ Bajando" count={allRows.filter(r => s(r["Tendencia"]).toUpperCase().includes("BAJANDO")).length} active={fTendencia === "bajando"} onClick={() => setFTendencia("bajando")} tone="danger" />
                  </div>

                  {/* Cobertura */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">Cober.</span>
                    <FilterChip label="Todos" active={fCobertura === "todos"} onClick={() => setFCobertura("todos")} />
                    <FilterChip label="Crítica <15d" count={allRows.filter(r => n(r["Cobertura"]) < 15).length} active={fCobertura === "critica"} onClick={() => setFCobertura("critica")} tone="danger" />
                    <FilterChip label="Baja 15–30d" count={allRows.filter(r => { const c = n(r["Cobertura"]); return c >= 15 && c <= 30; }).length} active={fCobertura === "baja"} onClick={() => setFCobertura("baja")} tone="warning" />
                    <FilterChip label="OK >30d" count={allRows.filter(r => n(r["Cobertura"]) > 30).length} active={fCobertura === "ok"} onClick={() => setFCobertura("ok")} tone="success" />
                  </div>

                  {/* Mes de Ingreso */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-faint w-16 shrink-0">Ingreso</span>
                    <div className="relative">
                      <button
                        onClick={() => setMesDropdownOpen(!mesDropdownOpen)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold transition-all duration-[var(--duration-fast)]",
                          fMesIngreso.size > 0
                            ? "border-violet/40 bg-violet/12 text-violet shadow-sm"
                            : "border-border-soft bg-surface text-muted hover:bg-surface-2",
                        )}
                      >
                        <Calendar className="h-3 w-3" />
                        {fMesIngreso.size === 0 ? "Todos los meses" : `${fMesIngreso.size} meses`}
                        <ChevronRight className={cn("h-2.5 w-2.5 transition-transform", mesDropdownOpen && "rotate-90")} />
                      </button>
                      {mesDropdownOpen && (
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-48 overflow-y-auto rounded-lg border border-border-soft bg-surface shadow-card py-1">
                          {mesesDisponibles.map(ym => {
                            const [y, m] = ym.split("-");
                            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
                            const name = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(d);
                            const label = name.charAt(0).toUpperCase() + name.slice(1);
                            return (
                              <label key={ym} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-xs text-fg">
                                <input type="checkbox" checked={fMesIngreso.has(ym)}
                                  onChange={(e) => { setFMesIngreso(prev => { const next = new Set(prev); if (e.target.checked) next.add(ym); else next.delete(ym); return next; }); }}
                                  className="rounded border-border-soft text-primary focus:ring-primary h-3.5 w-3.5"
                                />
                                {label}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Limpiar */}
                  {hasActiveFilters && (
                    <button
                      onClick={() => { setFStock("todos"); setFDias("todos"); setFMesIngreso(new Set()); setFXYZ("todos"); setFTendencia("todos"); setFCobertura("todos"); }}
                      className="self-start inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/8 px-2.5 py-1 text-[0.65rem] font-semibold text-danger hover:bg-danger/15 transition-colors"
                    >
                      <X className="h-3 w-3" /> Limpiar todos
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tabs de categoría Kanban */}
            <div className="border-b border-border-soft bg-surface-2/40">
              <div className="flex gap-1.5 overflow-x-auto px-2 py-2 custom-scrollbar">
                {KANBAN_COLS.map((col) => {
                  const count = tabCounts[col.id];
                  const isActive = activeTab === col.id;
                  const Icon = col.icon;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setActiveTab(col.id)}
                      className={cn(
                        "group flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-all duration-[var(--duration-fast)]",
                        isActive
                          ? TAB_ACTIVE_BORDER[col.tone]
                          : "border-transparent text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                      aria-pressed={isActive}
                      title={col.label}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                          isActive ? TAB_TONE_ACTIVE[col.tone] : TAB_TONE_INACTIVE[col.tone],
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" strokeWidth={2.25} />
                      </span>
                      <span className={cn(isActive ? "text-fg" : "")}>
                        <span className="hidden md:inline">{col.label}</span>
                        <span className="md:hidden">{col.short}</span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold tabular-nums",
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

            {/* Lista del tab activo (scroll interno) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg/30">
              {tabItems.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 py-12 text-center text-sm text-faint">
                  No hay productos en esta categoría con los filtros actuales.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border-soft/50">
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
              <div className="flex flex-col gap-2 border-t border-border-soft bg-surface px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer group" onClick={onClick}>
      {/* 1. Identificador */}
      <div className="flex w-full sm:w-1/3 min-w-[200px] flex-col justify-center">
        <p className="line-clamp-1 text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors" title={s(sku["Producto"])}>
          {s(sku["Producto"]) || "—"}
        </p>
        <p className="font-mono text-xs text-faint mt-0.5">
          {s(sku["Código SKU"])} <span className="mx-1">·</span> {s(sku["Categoría"])}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={cn("inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", meta.bgClass, meta.colorClass)}>
            <Icon className="h-2.5 w-2.5" /> {shortClasif(clasif)}
          </span>
          {s(sku["XYZ"]) && (
            <span className="inline-flex items-center text-[0.6rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-3 text-muted">
              XYZ: {s(sku["XYZ"]).charAt(0)}
            </span>
          )}
        </div>
      </div>

      {/* 2. Visualización: Sparkline */}
      <div className="flex flex-1 items-center gap-4">
        <div className="w-24 shrink-0 hidden md:block" title={`Tendencia: ${tendencia || 'Estable'}`}>
          <SmoothSparkline v90={v90} v30={v30} p30={p30} width={90} height={20} />
        </div>
      </div>

      {/* 3. Métricas Numéricas Expandidas */}
      <div className="flex items-center gap-4 sm:gap-6 text-right flex-wrap justify-end">
        <div className="flex flex-col w-14">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Ventas</span>
          <span className="font-mono text-xs font-medium text-fg">{moneyCompact(ventas)}</span>
        </div>
        <div className="flex flex-col w-10 hidden lg:flex">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Unds</span>
          <span className="font-mono text-xs font-medium text-fg">{num(unidades)}</span>
        </div>
        <div className="flex flex-col w-12">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Stock</span>
          <span className={cn("font-mono text-xs font-bold", stock === 0 ? "text-danger" : "text-info")}>{num(stock)}</span>
        </div>
        <div className="flex flex-col w-14 hidden xl:flex">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Cobertura</span>
          <span className={cn("font-mono text-xs font-medium", n(sku["Cobertura"]) < 15 ? "text-danger" : "text-fg")}>
            {s(sku["Cobertura"]) || "—"}
          </span>
        </div>
        <div className="flex flex-col w-14 hidden xl:flex">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Veloc.</span>
          <span className="font-mono text-xs font-medium text-fg">{num2(sku["Velocidad (uds/día)"])} u/d</span>
        </div>
        <div className="flex flex-col w-14 hidden 2xl:flex">
          <span className="text-[0.6rem] uppercase tracking-wider text-faint">Sell-thru</span>
          <span className="font-mono text-xs font-medium text-fg">{pct(sku["Sell-through Lote %"])}</span>
        </div>
      </div>

      {/* 4. Acciones */}
      <div className="flex shrink-0 items-center justify-end w-6 text-muted group-hover:text-fg transition-colors">
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>
  );
}
