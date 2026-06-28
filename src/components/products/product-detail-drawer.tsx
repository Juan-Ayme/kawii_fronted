"use client";

import { useQuery } from "@tanstack/react-query";
import { getProduct } from "@/lib/api";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { Drawer } from "@/components/ui/drawer";
import { LoadingState, ErrorState } from "@/components/ui/states";

export function ProductDetailDrawer({
  productId,
  open,
  onClose,
}: {
  productId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["product", productId],
    queryFn: ({ signal }) => getProduct(productId as number, signal),
    enabled: open && productId !== null,
  });

  const p = detail.data;

  // Si estamos cargando o hay error, mostramos un drawer básico.
  if (detail.isLoading || detail.error || !p) {
    return (
      <Drawer open={open} onClose={onClose} title="Cargando producto...">
        {detail.isLoading ? (
          <LoadingState />
        ) : detail.error ? (
          <ErrorState error={detail.error} />
        ) : null}
      </Drawer>
    );
  }

  // Mapeamos la respuesta del backend a un flat 'row' para el Panel unificado
  const row = {
    "ID Producto": productId,
    Producto: p.name,
    SKU: p.variantes?.[0]?.code ?? "",
    Clasificación: p.category ?? "Sin clasificar",
    Subcategoría: p.subcategory ?? "—",
    Departamento: p.department ?? "—",
    Categoría: p.category ?? "—",
    has_override: p.has_override,
    // Para no romper la visualización, enviamos valores predeterminados (Analytics)
    "Vendido SKU S/": 0,
    "Unds Vend (90d)": 0,
    "Velocidad (uds/día)": 0,
    "Vel últimos 30d": 0,
    "Stock Disp": p.stock_por_sucursal.reduce((acc, s) => acc + s.unidades, 0),
    "Stock Reserv": 0,
    "Stock Almacén": 0,
  };

  return (
    <ProductDetailPanel
      row={row}
      open={open}
      onClose={onClose}
      sucursalName="Todas"
    />
  );
}
