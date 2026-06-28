import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMatrix } from "@/lib/api";
import { Row, KanbanCol, DeptNode } from "../types";
import { getKanbanColumn, n, s } from "../utils";
import { animate, stagger } from "animejs";

export function useVentasJerarquicas(sucursalName: string | null) {
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
        if (fCobertura === "critica_10") return cob <= 10;
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

  useEffect(() => {
    if (busqueda && busqueda.length >= 2) {
      setTimeout(() => {
        setExpandedDeptos((prev) => {
          const next = new Set(prev);
          jerarquia.forEach((d) => next.add(d.name));
          return next;
        });
        setExpandedCats((prev) => {
          const next = new Set(prev);
          jerarquia.forEach((d) => {
            d.cats.forEach((c) => next.add(`${d.name}::${c.name}`));
          });
          return next;
        });
      }, 0);
    }
  }, [busqueda, jerarquia]);

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

  const selectDepto = (name: string) => {
    if (deptoSel === name) {
      setDeptoSel(null);
      setCatSel(null);
      setSubcatSel(null);
    } else {
      setDeptoSel(name);
      setCatSel(null);
      setSubcatSel(null);
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

  const skusFiltrados = useMemo(() => {
    return rowsRelevantesBusqueda.filter((r) => {
        const dMatch = deptoSel ? s(r["Departamento"]) === deptoSel : true;
        const cMatch = catSel ? (s(r["Categoría"]) || "Sin categoría") === catSel : true;
        const sMatch = subcatSel ? (s(r["Subcategoría"]) || "Sin subcategoría") === subcatSel : true;
        return dMatch && cMatch && sMatch;
      })
      .sort((a, b) => ventasDeRow(b) - ventasDeRow(a));
  }, [rowsRelevantesBusqueda, deptoSel, catSel, subcatSel]);

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

  useEffect(() => {
    // eslint-disable-next-line
    setCurrentPage(1);
  }, [activeTab, deptoSel, catSel, subcatSel, busqueda, fStock, fDias, fMesIngreso, fXYZ, fTendencia, fCobertura]);

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

  return {
    q,
    allRows,
    busqueda, setBusqueda,
    deptoSel, setDeptoSel,
    catSel, setCatSel,
    subcatSel, setSubcatSel,
    selectedSku, setSelectedSku,
    expandedDeptos, setExpandedDeptos,
    expandedCats, setExpandedCats,
    activeTab, setActiveTab,
    currentPage, setCurrentPage,
    ITEMS_PER_PAGE,
    fStock, setFStock,
    fDias, setFDias,
    fMesIngreso, setFMesIngreso,
    mesDropdownOpen, setMesDropdownOpen,
    fXYZ, setFXYZ,
    fTendencia, setFTendencia,
    fCobertura, setFCobertura,
    showFilters, setShowFilters,
    showAdvancedFilters, setShowAdvancedFilters,
    jerarquia,
    totalGeneral,
    mesesDisponibles,
    toggleDepto,
    toggleCat,
    selectDepto,
    selectCat,
    selectSubcat,
    clearSelection,
    skusFiltrados,
    tabCounts,
    tabItems,
    totalPages,
    safePage,
    pageItems,
    hasActiveFilters,
    hasActiveAdvancedFilters
  };
}
