import React from "react";
import { ChevronRight, Banknote, Package, Box, Target, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { moneyCompact, num, num2, pct } from "@/lib/format";
import { getClassificationMeta, SmoothSparkline, shortClasif } from "@/components/ui/classification";
import { Row } from "../types";
import { s, n } from "../utils";

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

export const ProductListItem = React.memo(function ProductListItem({
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
});
