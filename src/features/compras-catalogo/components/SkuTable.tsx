import React from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, num, pct } from "@/lib/format";
import type { ComprasCatalogoSku } from "@/lib/types";
import { ClassificationCell } from "@/components/ui/classification";

export function SkuTable({
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
          {rows.map((s) => (
            <SkuTableRow
              key={`${s.sucursal}-${s.sku}`}
              s={s}
              onSelect={onSelect}
              onAction={onAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SkuTableRow = React.memo(function SkuTableRow({
  s,
  onSelect,
  onAction,
}: {
  s: ComprasCatalogoSku;
  onSelect: (sku: ComprasCatalogoSku) => void;
  onAction: (
    sku: ComprasCatalogoSku,
    action: "ordenar" | "posponer" | "ignorar",
  ) => void;
}) {
  return (
    <tr
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
  );
});
