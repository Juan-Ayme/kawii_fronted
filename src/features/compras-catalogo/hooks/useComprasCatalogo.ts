"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { getComprasCatalogo, createPurchaseDecision, type PurchaseDecisionKind } from "@/lib/api";
import type { ComprasCatalogoSku } from "@/lib/types";
import { Selection, TreeNode, SeverityFilter, TendenciaFilter, StockFilter, ROOT_SELECTION } from "../types";
import { buildTree } from "../utils";

export function useComprasCatalogo(officeId: number | null) {
  const [fSeveridad, setFSeveridad] = useState<SeverityFilter>("todas");
  const [fTendencia, setFTendencia] = useState<TendenciaFilter>("todas");
  const [fStockAlmacen, setFStockAlmacen] = useState<StockFilter>("todos");
  const [showFilters, setShowFilters] = useState(false);

  const [selection, setSelection] = useState<Selection>(ROOT_SELECTION);
  const [search, setSearch] = useState("");
  const [selectedSku, setSelectedSku] = useState<ComprasCatalogoSku | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // We reset page if filters change
  const [prevSearch, setPrevSearch] = useState(search);
  const [prevSeverity, setPrevSeverity] = useState(fSeveridad);
  const [prevSelection, setPrevSelection] = useState(selection);
  const [prevTendencia, setPrevTendencia] = useState(fTendencia);
  const [prevStockAlmacen, setPrevStockAlmacen] = useState(fStockAlmacen);

  if (
    search !== prevSearch ||
    fSeveridad !== prevSeverity ||
    selection !== prevSelection ||
    fTendencia !== prevTendencia ||
    fStockAlmacen !== prevStockAlmacen
  ) {
    setPrevSearch(search);
    setPrevSeverity(fSeveridad);
    setPrevSelection(selection);
    setPrevTendencia(fTendencia);
    setPrevStockAlmacen(fStockAlmacen);
    setCurrentPage(1);
  }

  const query = useQuery({
    queryKey: ["compras-catalogo", officeId],
    queryFn: ({ signal }) => getComprasCatalogo(officeId, signal),
    staleTime: 5 * 60_000,
  });

  const tree = useMemo<TreeNode[]>(() => buildTree(query.data?.skus ?? []), [
    query.data?.skus,
  ]);

  const filteredSkus = useMemo<ComprasCatalogoSku[]>(() => {
    const all = query.data?.skus ?? [];
    const s = search.trim().toLowerCase();
    return all.filter((sku) => {
      if (fSeveridad === "critico" && !sku.severidad.includes("Crítico")) return false;
      if (fSeveridad === "alta" && !sku.severidad.includes("Alta")) return false;
      
      if (fTendencia === "creciente" && sku.tendencia !== "Creciente") return false;
      if (fTendencia === "estable" && sku.tendencia !== "Estable") return false;
      if (fTendencia === "decreciente" && sku.tendencia !== "Decreciente") return false;

      if (fStockAlmacen === "con_stock" && sku.stock_almacen <= 0) return false;
      if (fStockAlmacen === "sin_stock" && sku.stock_almacen > 0) return false;

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
  }, [query.data?.skus, fSeveridad, fTendencia, fStockAlmacen, selection, search]);

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

  const qc = useQueryClient();
  const quickAction = useMutation({
    mutationFn: ({ sku, action }: { sku: ComprasCatalogoSku; action: PurchaseDecisionKind }) =>
      createPurchaseDecision({
        sku: sku.sku,
        bsale_office_id: officeId ?? 0,
        decision: action,
        quantity: action === "ordenar" || action === "comprar_similar" ? sku.cantidad_sugerida : null,
        classification_snapshot: {
          clasificacion: sku.clasificacion,
          severidad: sku.severidad,
          accion: sku.accion,
          stock_disponible: sku.stock_disponible,
          cantidad_sugerida: sku.cantidad_sugerida,
        },
      }),
    onSuccess: (_data, vars) => {
      const verb = { ordenar: "Ordenar", comprar_similar: "Comprar similar", posponer: "Posponer", ignorar: "Ignorar" }[vars.action];
      toast.success(`${verb} · ${vars.sku.producto}`, { description: "Decisión guardada." });
      qc.invalidateQueries({ queryKey: ["purchase-decisions"] });
    },
    onError: (err: Error, vars) => {
      toast.error(`Error guardando decisión · ${vars.sku.producto}`, { description: err.message });
    },
  });

  const handleAction = (sku: ComprasCatalogoSku, action: "ordenar" | "posponer" | "ignorar") => {
    if (officeId == null) {
      toast.error("Seleccioná una sucursal antes de decidir compras.");
      return;
    }
    quickAction.mutate({ sku, action });
  };

  const totalPages = Math.max(1, Math.ceil(filteredSkus.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = useMemo(
    () => filteredSkus.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [filteredSkus, safePage]
  );

  return {
    query,
    tree,
    filteredSkus,
    scopeKpis,
    quickAction,
    handleAction,
    fSeveridad, setFSeveridad,
    fTendencia, setFTendencia,
    fStockAlmacen, setFStockAlmacen,
    showFilters, setShowFilters,
    selection, setSelection,
    search, setSearch,
    selectedSku, setSelectedSku,
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    pageItems,
    ITEMS_PER_PAGE
  };
}
