import React from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  Eye,
  Flame,
  Gem,
  HelpCircle,
  Leaf,
  Moon,
  Archive,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
  CheckCircle,
  RefreshCcw,
  Skull,
  PauseCircle,
  type LucideIcon,
} from "lucide-react";

export type ClassMeta = {
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  label: string;
};

export function shortClasif(clasif: string): string {
  return clasif.split(/[:(]/)[0].trim() || "—";
}

export function getClassificationMeta(clasif: string): ClassMeta {
  const c = clasif.toUpperCase();
  if (c.includes("BESTSELLER ACTIVO")) return { icon: Flame, colorClass: "text-orange-500", bgClass: "bg-orange-500/15", label: "Bestseller" };
  if (c.includes("BESTSELLER RÁPIDO") || c.includes("BESTSELLER AGOTADO")) return { icon: PauseCircle, colorClass: "text-amber-500", bgClass: "bg-amber-500/15", label: "Agotado BS" };
  if (c.includes("QUIEBRE DE BESTSELLER")) return { icon: AlertTriangle, colorClass: "text-danger", bgClass: "bg-danger/15", label: "Quiebre BS" };
  if (c.includes("OPORTUNIDAD PERDIDA")) return { icon: Gem, colorClass: "text-violet-500", bgClass: "bg-violet-500/15", label: "Oportunidad" };
  if (c.includes("AGOTADO CON DEMANDA") || c.includes("POCO STOCK CON DEMANDA")) return { icon: Sparkles, colorClass: "text-cyan-500", bgClass: "bg-cyan-500/15", label: "Agotado c/dem" };
  if (c.includes("EX-BESTSELLER")) return { icon: TrendingDown, colorClass: "text-warning", bgClass: "bg-warning/15", label: "Ex-Bestseller" };
  if (c.includes("EMERGENTE") || c.includes("VENDIENDO MÁS")) return { icon: TrendingUp, colorClass: "text-success", bgClass: "bg-success/15", label: "Creciendo" };
  if (c.includes("MUERTO") || c.includes("DESCATALOGAR")) return { icon: Skull, colorClass: "text-faint", bgClass: "bg-surface-3", label: "Muerto" };
  if (c.includes("LENTO") || c.includes("BAJA ROTACIÓN")) return { icon: Clock, colorClass: "text-muted", bgClass: "bg-surface-3", label: "Lento" };
  if (c.includes("DEMANDA EXTINTA")) return { icon: Moon, colorClass: "text-faint", bgClass: "bg-surface-3", label: "Extinto" };
  if (c.includes("RECIÉN LLEGADO") || c.includes("NUEVO VENDIENDO") || c.includes("REABASTECIDO")) return { icon: RefreshCcw, colorClass: "text-info", bgClass: "bg-info/15", label: "Reciente" };
  if (c.includes("STOCK PARADO") || c.includes("FRENADO")) return { icon: X, colorClass: "text-danger", bgClass: "bg-danger/15", label: "Stock parado" };
  if (c.includes("STOCK BAJO QUIETO")) return { icon: Eye, colorClass: "text-warning", bgClass: "bg-warning/15", label: "Bajo quieto" };
  if (c.includes("EXCESO")) return { icon: Snowflake, colorClass: "text-info", bgClass: "bg-info/15", label: "Exceso" };
  if (c.includes("ROTACIÓN ACTIVA AL BORDE")) return { icon: Zap, colorClass: "text-orange-500", bgClass: "bg-orange-500/15", label: "Al borde" };
  if (c.includes("ROTACIÓN ACTIVA") || c.includes("ROTACIÓN BAJANDO")) return { icon: Star, colorClass: "text-success", bgClass: "bg-success/15", label: "Rotación OK" };
  if (c.includes("INVENTARIO SANO")) return { icon: CheckCircle, colorClass: "text-success", bgClass: "bg-success/15", label: "Sano" };
  if (c.includes("POCO STOCK")) return { icon: AlertTriangle, colorClass: "text-warning", bgClass: "bg-warning/15", label: "Poco stock" };
  if (c.includes("PRODUCTO NUEVO")) return { icon: Leaf, colorClass: "text-cyan-500", bgClass: "bg-cyan-500/15", label: "Nuevo" };
  if (c.includes("PÉRDIDA DE STOCK")) return { icon: ShieldAlert, colorClass: "text-danger", bgClass: "bg-danger/15", label: "Pérdida" };
  if (c.includes("SALDO DE TEMPORADA") || c.includes("TEMPORADA CERRADA")) return { icon: Archive, colorClass: "text-muted", bgClass: "bg-surface-3", label: "Temporada" };

  return { icon: HelpCircle, colorClass: "text-muted", bgClass: "bg-surface-3", label: shortClasif(clasif) };
}

export function SmoothSparkline({ v90, v30, p30, width = 70, height = 24 }: { v90: number; v30: number; p30: number; width?: number; height?: number }) {
  const max = Math.max(v90, v30, p30, 0.1);
  const min = 0;
  const range = max - min;
  
  const w = width;
  const h = height;
  
  const getY = (val: number) => h - ((val - min) / range) * (h - 2) - 1; // 1px padding top/bottom
  
  const y1 = getY(v90);
  const y2 = getY(v30);
  const y3 = getY(p30);
  
  const cp1x = w / 4;
  const cp2x = (w * 3) / 4;
  
  const path = `M 0,${y1} C ${cp1x},${y1} ${cp1x},${y2} ${w/2},${y2} C ${cp2x},${y2} ${cp2x},${y3} ${w},${y3}`;
  const areaPath = `${path} L ${w},${h} L 0,${h} Z`;
  
  const trendColor = p30 > v90 * 1.1 ? "#2dd4a7" : p30 < v90 * 0.8 ? "#f5a623" : "#38bdf8";
  const reactId = React.useId();
  const id = `grad-${trendColor.replace('#', '')}-${reactId}`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
          <stop offset="100%" stopColor={trendColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={trendColor} strokeWidth="2" strokeLinecap="round" />
      <circle cx={w} cy={y3} r="3" fill={trendColor} className="drop-shadow-sm" />
    </svg>
  );
}

export function ClassificationCell({
  clasificacion,
  severidad,
  vel90d,
  vel30d,
  proy30d,
}: {
  clasificacion: string;
  severidad: string;
  vel90d: number;
  vel30d: number;
  proy30d: number;
}) {
  const meta = getClassificationMeta(clasificacion);
  const Icon = meta.icon;
  const isDanger = severidad.includes("Crítico");
  const isWarning = severidad.includes("Alta");

  return (
    <div className="flex items-center gap-3">
      {/* Icon Badge */}
      <div 
        className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.bgClass)}
        title={clasificacion}
      >
        <Icon className={cn("h-4 w-4", meta.colorClass)} />
        {(isDanger || isWarning) && (
          <div 
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface", 
              isDanger ? "bg-danger" : "bg-warning"
            )}
            title={`Severidad: ${severidad}`}
          />
        )}
      </div>

      {/* Sparkline Chart */}
      <div className="flex flex-col" title={`Histórico: 90d=${vel90d.toFixed(1)}/d, 30d=${vel30d.toFixed(1)}/d | Proyección=${proy30d.toFixed(1)}/d`}>
        <SmoothSparkline v90={vel90d} v30={vel30d} p30={proy30d} />
      </div>
    </div>
  );
}
