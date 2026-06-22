"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import {
  getProduct,
  getSubcategories,
  setProductSubcategory,
} from "@/lib/api";
import { money, num } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  );
}

export function ProductDetailDrawer({
  productId,
  open,
  onClose,
}: {
  productId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Valor editado por el usuario; null = todavía refleja el dato del servidor.
  const [edited, setEdited] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["product", productId],
    queryFn: ({ signal }) => getProduct(productId as number, signal),
    enabled: open && productId !== null,
  });

  const subs = useQuery({
    queryKey: ["subcategories-all"],
    queryFn: ({ signal }) => getSubcategories(undefined, signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (newSubId: number | null) =>
      setProductSubcategory(productId as number, newSubId),
    onSuccess: () => {
      setEdited(null); // vuelve a derivar del dato fresco
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-summary"] });
    },
  });

  const p = detail.data;

  // Reset de la edición al cambiar de producto (durante el render, sin efecto)
  const [lastPid, setLastPid] = useState(productId);
  if (productId !== lastPid) {
    setLastPid(productId);
    setEdited(null);
  }

  // Subcategoría seleccionada: la editada o, si no, la derivada del producto.
  const derivedSubId = (() => {
    const current = subs.data?.find((s) => s.name === p?.subcategory);
    return current ? String(current.id) : "";
  })();
  const subId = edited ?? derivedSubId;
  const setSubId = (v: string) => setEdited(v);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={p?.name ?? "Producto"}
      subtitle={productId ? `BSale ID ${productId}` : undefined}
    >
      {detail.isLoading ? (
        <LoadingState />
      ) : detail.error ? (
        <ErrorState error={detail.error} />
      ) : p ? (
        <div className="space-y-6">
          {/* Clasificación */}
          <section>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {p.department && <Badge tone="primary">{p.department}</Badge>}
              {p.category && <Badge tone="info">{p.category}</Badge>}
              {p.subcategory && <Badge tone="violet">{p.subcategory}</Badge>}
              {!p.department && <Badge tone="warning">Sin clasificar</Badge>}
              {p.has_override && <Badge tone="success">Override</Badge>}
            </div>
            <Row
              label="Tipo (BSale)"
              value={p.product_type_name ?? "—"}
            />
            <Row
              label="Estado"
              value={
                p.is_active === false ? (
                  <Badge tone="neutral">Inactivo</Badge>
                ) : (
                  <Badge tone="success">Activo</Badge>
                )
              }
            />
          </section>

          {/* Editor de override */}
          <section className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-fg">
              Reclasificar producto
            </p>
            <p className="mb-3 mt-0.5 text-xs text-muted">
              Asigna una subcategoría específica (override). Si lo dejas vacío,
              hereda la del tipo de producto de BSale.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                className="flex-1"
                disabled={subs.isLoading}
              >
                <option value="">— Heredar del tipo (sin override) —</option>
                {(subs.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.department_name} / {s.category_name} / {s.name}
                  </option>
                ))}
              </Select>
              <Button
                onClick={() =>
                  mutation.mutate(subId === "" ? null : Number(subId))
                }
                loading={mutation.isPending}
              >
                <Check className="h-4 w-4" /> Guardar
              </Button>
            </div>
            {p.has_override && (
              <button
                onClick={() => {
                  setSubId("");
                  mutation.mutate(null);
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Quitar override
              </button>
            )}
            {mutation.isError && (
              <p className="mt-2 text-xs text-danger">
                {(mutation.error as Error).message}
              </p>
            )}
            {mutation.isSuccess && (
              <p className="mt-2 text-xs text-success">Clasificación actualizada.</p>
            )}
          </section>

          {/* Variantes */}
          <section>
            <p className="mb-2 text-sm font-semibold text-fg">
              Variantes ({p.variantes.length})
            </p>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variantes.map((v) => (
                    <tr
                      key={v.bsale_variant_id}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-2 font-mono text-xs text-fg">
                        {v.code ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {v.description ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(v.effective_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Stock por sucursal */}
          <section>
            <p className="mb-2 text-sm font-semibold text-fg">
              Stock por sucursal
            </p>
            {p.stock_por_sucursal.length === 0 ? (
              <p className="text-sm text-faint">Sin stock registrado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {p.stock_por_sucursal.map((s) => (
                  <div
                    key={s.sucursal}
                    className="rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <p className="text-xs text-muted">{s.sucursal}</p>
                    <p className="text-lg font-semibold text-fg">
                      {num(s.unidades)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
