"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, ChartTooltip, useMounted } from "./common";

export interface DonutDatum {
  name: string;
  value: number;
}

export function DonutChart({
  data,
  height = 260,
  valueFormatter,
}: {
  data: DonutDatum[];
  height?: number;
  valueFormatter?: (v: number | string, name: string) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const mounted = useMounted();
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative" style={{ width: height, height }}>
        {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={1.5}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={valueFormatter} />} />
          </PieChart>
        </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-fg">
            {total.toLocaleString("es-PE")}
          </span>
          <span className="text-xs text-muted">total</span>
        </div>
      </div>
      <ul className="flex max-h-[260px] flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted" title={d.name}>
              {d.name}
            </span>
            <span className="font-medium tabular-nums text-fg">
              {d.value.toLocaleString("es-PE")}
            </span>
            <span className="w-12 text-right text-xs tabular-nums text-faint">
              {total ? ((d.value / total) * 100).toFixed(1) : "0"}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
