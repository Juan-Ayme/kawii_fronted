"use client";

import { useSyncExternalStore } from "react";

// Paleta y tooltip compartidos para todos los gráficos (Recharts).

const noopSubscribe = () => () => {};

/**
 * Devuelve false durante el render en servidor y true en el cliente, sin
 * efectos. Evita renderizar Recharts durante el prerender (donde el contenedor
 * mide -1 y emite warnings) y previene mismatches de hidratación.
 */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export const CHART_COLORS = [
  "#6366f1", // primary
  "#22d3ee", // accent
  "#2dd4a7", // success
  "#f5a623", // warning
  "#a78bfa", // violet
  "#f0556d", // danger
  "#38bdf8", // info
  "#fb923c",
  "#34d399",
  "#e879f9",
];

export const AXIS_PROPS = {
  stroke: "#5a6577",
  tick: { fill: "#8a98ae", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "#233044" },
} as const;

export const GRID_PROPS = {
  stroke: "#1b2536",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number | string, name: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && label !== "" && (
        <p className="mb-1 font-medium text-fg">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-medium text-fg tabular-nums">
            {formatter
              ? formatter(entry.value ?? "", String(entry.name ?? ""))
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
