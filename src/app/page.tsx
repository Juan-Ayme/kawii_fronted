"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Package, Receipt, Store, Wallet } from "lucide-react";
import {
  getKpis,
  getSalesByDay,
  getSalesByDepartment,
  getSalesByOffice,
  getStockValuation,
  getTopProducts,
} from "@/lib/api";
import { money, moneyCompact, num, dayLabel } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { PeriodSelect } from "@/components/ui/period-select";
import { KpiStat } from "@/components/ui/kpi-stat";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { useSucursal } from "@/components/sucursal-context";
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
  // Breakdown comparativo: NO se filtra por sucursal (es la vista cruzada).
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

  const topCols: Column<TopProduct>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (r) => (
        <span className="line-clamp-1 font-medium text-fg">{r.producto}</span>
      ),
    },
    {
      key: "unidades",
      header: "Unidades",
      align: "right",
      render: (r) => num(r.unidades),
    },
    {
      key: "ventas",
      header: "Ventas",
      align: "right",
      render: (r) => (
        <span className="font-medium text-fg">{money(r.ventas)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen operativo de ventas, inventario y catálogo (tiendas Magdalena y Asamblea)."
        actions={<PeriodSelect value={days} onChange={setDays} />}
      />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label={`Ventas (${days}d)`}
          value={money(k?.ventas)}
          icon={Wallet}
          tone="success"
          loading={kpis.isLoading}
          sub={kpis.isError ? "—" : `${num(k?.tickets)} tickets`}
        />
        <KpiStat
          label="Ticket promedio"
          value={money(k?.ticket_promedio)}
          icon={Receipt}
          tone="primary"
          loading={kpis.isLoading}
          sub={`${num(k?.tickets_con_monto)} con monto`}
        />
        <KpiStat
          label="Stock valorizado"
          value={money(k?.stock_valorizado)}
          icon={Coins}
          tone="warning"
          loading={kpis.isLoading}
          sub="al costo efectivo"
        />
        <KpiStat
          label="Productos"
          value={num(k?.productos_total)}
          icon={Package}
          tone="info"
          loading={kpis.isLoading}
          sub={`${num(k?.productos_mapeados)} clasificados`}
        />
      </div>

      {kpis.isError && <ErrorState error={kpis.error} className="mt-4" />}

      {/* Ventas por día */}
      <Card className="mt-4">
        <CardHeader
          title="Ventas por día"
          subtitle={`Evolución de ingresos en los últimos ${days} días`}
        />
        <CardBody>
          {byDay.isError ? (
            <ErrorState error={byDay.error} />
          ) : byDay.data && byDay.data.length === 0 ? (
            <EmptyState title="Sin ventas en el período" />
          ) : (
            <TimeSeriesChart
              data={byDay.data ?? []}
              xKey="dia"
              series={[{ key: "ventas", label: "Ventas" }]}
              xTickFormatter={dayLabel}
              valueFormatter={(v) => money(v)}
            />
          )}
        </CardBody>
      </Card>

      {/* Departamentos + Stock por sucursal */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ventas por departamento" subtitle={`${days} días`} />
          <CardBody>
            {byDept.isError ? (
              <ErrorState error={byDept.error} />
            ) : byDept.data && byDept.data.length === 0 ? (
              <EmptyState />
            ) : (
              <CategoryBarChart
                data={(byDept.data ?? []).slice(0, 8)}
                categoryKey="departamento"
                valueKey="ventas"
                valueLabel="Ventas"
                colorful
                valueFormatter={(v) => money(v)}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Stock valorizado por sucursal"
            subtitle={valuation.data ? money(valuation.data.total_soles) : "—"}
          />
          <CardBody>
            {valuation.isError ? (
              <ErrorState error={valuation.error} />
            ) : (
              <DonutChart
                data={(valuation.data?.por_sucursal ?? []).map((o) => ({
                  name: o.sucursal,
                  value: Math.round(o.valor_soles),
                }))}
                valueFormatter={(v) => money(v)}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Top productos + ventas por sucursal */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Top productos"
            subtitle={`Los más vendidos en ${days} días`}
          />
          <CardBody className="pt-0">
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

        <Card>
          <CardHeader title="Ventas por sucursal" subtitle={`${days} días`} />
          <CardBody className="space-y-3">
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
                  <div key={o.sucursal}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted">{o.sucursal}</span>
                      <span className="font-medium text-fg">
                        {moneyCompact(o.ventas)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${(o.ventas / max) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-faint">
                      {num(o.tickets)} tickets
                    </p>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
