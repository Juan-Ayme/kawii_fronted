"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Coins, Package, Receipt, Store, Wallet, TrendingUp, BarChart3, PieChart, Trophy } from "lucide-react";
import {
  getKpis,
  getSalesByDay,
  getSalesByDepartment,
  getSalesByOffice,
  getStockValuation,
  getTopProducts,
} from "@/lib/api";
import { money, moneyCompact, num, dayLabel } from "@/lib/format";
import { DateRangeSelect } from "@/components/ui/date-range-select";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, EmptyState } from "@/components/ui/states";
const TimeSeriesChart = dynamic(() => import("@/components/charts/time-series-chart").then(mod => mod.TimeSeriesChart), { ssr: false });
const CategoryBarChart = dynamic(() => import("@/components/charts/category-bar-chart").then(mod => mod.CategoryBarChart), { ssr: false });
const DonutChart = dynamic(() => import("@/components/charts/donut-chart").then(mod => mod.DonutChart), { ssr: false });
import { useSucursal } from "@/components/sucursal-context";
import { MetricGauge } from "@/components/ui/metric-gauge";
import type { TopProduct } from "@/lib/types";

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const { officeId } = useSucursal();

  const kpis = useQuery({
    queryKey: ["kpis", days, officeId],
    queryFn: ({ signal }) => getKpis(days, signal, officeId),
  });
  const byDay = useQuery({
    queryKey: ["sales-by-day", days, officeId],
    queryFn: ({ signal }) => getSalesByDay(days, signal, officeId),
  });
  const byDept = useQuery({
    queryKey: ["sales-by-department", days, officeId],
    queryFn: ({ signal }) => getSalesByDepartment(days, signal, officeId),
  });
  const byOffice = useQuery({
    queryKey: ["sales-by-office", days],
    queryFn: ({ signal }) => getSalesByOffice(days, signal),
  });
  const valuation = useQuery({
    queryKey: ["stock-valuation"],
    queryFn: ({ signal }) => getStockValuation(signal),
  });
  const top = useQuery({
    queryKey: ["top-products", days, officeId],
    queryFn: ({ signal }) => getTopProducts(days, 10, signal, officeId),
  });

  const k = kpis.data;

  // Enhance Top Products Table to look more like a Leaderboard
  const topCols: Column<TopProduct>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-muted ring-1 ring-border-soft">
             #
          </div>
          <span className="line-clamp-1 font-semibold text-fg">{r.producto}</span>
        </div>
      ),
    },
    {
      key: "unidades",
      header: "Unds",
      align: "right",
      render: (r) => (
        <span className="inline-flex items-center justify-center rounded-md bg-surface-3 px-2 py-1 text-xs font-medium text-muted">
          {num(r.unidades)}
        </span>
      ),
    },
    {
      key: "ventas",
      header: "Ingresos",
      align: "right",
      render: (r) => (
        <span className="font-bold text-success drop-shadow-sm">{money(r.ventas)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-2">
        <div className="shrink-0 z-50">
           <DateRangeSelect value={days} onChange={setDays} />
        </div>
      </div>

      {kpis.isError && <ErrorState error={kpis.error} className="mt-4" />}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-rows-auto">
        
        {/* ROW 1: KPIs & Gauge */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <KpiStat
            label={`Ingresos Brutos (${days}d)`}
            value={money(k?.ventas)}
            icon={Wallet}
            tone="success"
            loading={kpis.isLoading}
            sub={kpis.isError ? "—" : `${num(k?.tickets)} tickets totales`}
          />
          <KpiStat
            label="Stock Valorizado"
            value={money(k?.stock_valorizado)}
            icon={Coins}
            tone="warning"
            loading={kpis.isLoading}
            sub="Basado en costo efectivo"
          />
        </div>

        <div className="md:col-span-3">
           <Card className="group relative flex h-full items-center justify-center overflow-hidden bg-surface-2 hover:bg-surface-3 transition-colors duration-500">
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="flex flex-col items-center justify-center p-6 w-full h-full">
                 <MetricGauge 
                   value={k?.ticket_promedio || 0} 
                   max={(k?.ticket_promedio || 0) * 1.5 || 50} 
                   label="Ticket Promedio" 
                   suffix="" 
                   tone="primary" 
                   thresholds={{danger: 10, warning: 15}}
                   size={140}
                 />
                 <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{num(k?.tickets_con_monto)} ventas con monto</span>
                 </div>
              </div>
           </Card>
        </div>

        {/* Time Series Hero */}
        <div className="md:col-span-6">
          <Card className="h-full flex flex-col group overflow-hidden relative">
            <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <CardHeader
              title={<span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Dinámica de Ventas</span>}
              subtitle={`Flujo de ingresos de los últimos ${days} días`}
            />
            <CardBody className="flex-1 relative z-10 pt-0 pb-6">
              {byDay.isError ? (
                <ErrorState error={byDay.error} />
              ) : byDay.data && byDay.data.length === 0 ? (
                <EmptyState title="Sin ventas en el período" />
              ) : (
                <TimeSeriesChart
                  data={byDay.data ?? []}
                  xKey="dia"
                  series={[{ key: "ventas", label: "Ventas", color: "var(--color-primary)" }]}
                  xTickFormatter={dayLabel}
                  valueFormatter={(v) => money(v)}
                  height={220}
                />
              )}
            </CardBody>
          </Card>
        </div>


        {/* ROW 2: Departments & Donut */}
        <div className="md:col-span-7">
          <Card className="h-full flex flex-col group relative overflow-hidden">
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
            <CardHeader 
               title={<span className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-accent" /> Desempeño por Depto</span>} 
               subtitle={`Ranking departamental en ${days} días`} 
            />
            <CardBody className="flex-1 relative z-10">
              {byDept.isError ? (
                <ErrorState error={byDept.error} />
              ) : byDept.data && byDept.data.length === 0 ? (
                <EmptyState />
              ) : (
                <CategoryBarChart
                  data={(byDept.data ?? []).slice(0, 6)}
                  categoryKey="departamento"
                  valueKey="ventas"
                  valueLabel="Ventas"
                  colorful
                  valueFormatter={(v) => money(v)}
                  height={260}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="md:col-span-5">
          <Card className="h-full flex flex-col group overflow-hidden relative">
            <CardHeader
              title={<span className="flex items-center gap-2"><PieChart className="h-5 w-5 text-warning" /> Capital por Sucursal</span>}
              subtitle={valuation.data ? `Total: ${money(valuation.data.total_soles)}` : "—"}
            />
            <CardBody className="flex-1 flex items-center justify-center relative z-10">
              {valuation.isError ? (
                <ErrorState error={valuation.error} />
              ) : (
                <DonutChart
                  data={(valuation.data?.por_sucursal ?? []).map((o) => ({
                    name: o.sucursal,
                    value: Math.round(o.valor_soles),
                  }))}
                  valueFormatter={(v) => money(v)}
                  height={220}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ROW 3: Top Products & Office Bars */}
        <div className="md:col-span-7">
          <Card className="h-full">
            <CardHeader
              title={<span className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Leaderboard de Productos</span>}
              subtitle={`Items más calientes (${days} días)`}
            />
            <CardBody className="pt-0 pb-2 px-2 sm:px-4">
              <DataTable
                columns={topCols}
                rows={top.data}
                isLoading={top.isLoading}
                error={top.error}
                rowKey={(r) => r.bsale_product_id}
                emptyTitle="Sin ventas en el período"
              />
            </CardBody>
          </Card>
        </div>

        <div className="md:col-span-5 flex flex-col gap-4">
           {/* Add a KPI for products here to fill the gap and keep Bento layout tight */}
           <KpiStat
             label="Catálogo Activo"
             value={num(k?.productos_total)}
             icon={Package}
             tone="info"
             loading={kpis.isLoading}
             sub={`${num(k?.productos_mapeados)} items mapeados (taxonomía)`}
           />
           <Card className="flex-1 overflow-hidden relative group">
              <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-violet/10 blur-3xl" />
              <CardHeader title={<span className="flex items-center gap-2"><Store className="h-5 w-5 text-violet" /> Rendimiento Sucursales</span>} subtitle={`Facturación en ${days} días`} />
              <CardBody className="space-y-4 pt-2 relative z-10">
                {byOffice.isError ? (
                  <ErrorState error={byOffice.error} />
                ) : (byOffice.data ?? []).length === 0 ? (
                  <EmptyState icon={Store} />
                ) : (
                  (byOffice.data ?? []).map((o) => {
                    const max = Math.max(
                      ...(byOffice.data ?? []).map((x) => x.ventas),
                      1,
                    );
                    return (
                      <div key={o.sucursal} className="group/bar relative">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium tracking-wide text-fg">{o.sucursal}</span>
                          <div className="flex items-center gap-3">
                             <span className="font-mono text-xs text-muted">{num(o.tickets)} trx</span>
                             <span className="font-bold text-fg">
                               {moneyCompact(o.ventas)}
                             </span>
                          </div>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-surface-3 shadow-inner">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet to-fuchsia-500 shadow-[0_0_12px_rgba(167,139,250,0.6)] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                            style={{ width: `${(o.ventas / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
           </Card>
        </div>

      </div>
    </div>
  );
}
