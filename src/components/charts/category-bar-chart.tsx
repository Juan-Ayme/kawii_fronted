"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartTooltip,
  GRID_PROPS,
  useMounted,
} from "./common";

/** Bar chart horizontal (categorías en el eje Y) — ideal para rankings. */
export function CategoryBarChart<T>({
  data,
  categoryKey,
  valueKey,
  valueLabel,
  height = 300,
  valueFormatter,
  colorful = false,
}: {
  data: T[];
  categoryKey: string;
  valueKey: string;
  valueLabel: string;
  height?: number;
  valueFormatter?: (v: number | string, name: string) => string;
  colorful?: boolean;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          {...AXIS_PROPS}
          width={140}
          tick={{ fill: "#8a98ae", fontSize: 11 }}
        />
        <Tooltip
          content={<ChartTooltip formatter={valueFormatter} />}
          cursor={{ fill: "#18222f" }}
        />
        <Bar dataKey={valueKey} name={valueLabel} radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={
                colorful
                  ? CHART_COLORS[i % CHART_COLORS.length]
                  : CHART_COLORS[0]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
