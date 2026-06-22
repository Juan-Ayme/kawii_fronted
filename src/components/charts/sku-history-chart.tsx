import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { num, money } from "@/lib/format";

export function SkuHistoryChart({
  points,
}: {
  points: { fecha: string; unds_vendidas: number; monto: number; unds_recibidas: number }[];
}) {
  const totalVendido = points.reduce((s, p) => s + p.unds_vendidas, 0);
  const totalRecibido = points.reduce((s, p) => s + p.unds_recibidas, 0);
  const totalMonto = points.reduce((s, p) => s + p.monto, 0);
  const series = points.map((p) => ({
    fecha: p.fecha,
    vendidas: p.unds_vendidas,
    recibidas: p.unds_recibidas,
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span className="font-semibold text-fg">{num(totalVendido)}</span>{" "}
          <span className="text-muted">unds vendidas</span>
        </span>
        <span>
          <span className="font-semibold text-fg">{money(totalMonto)}</span>{" "}
          <span className="text-muted">ingresos</span>
        </span>
        <span>
          <span className="font-semibold text-fg">{num(totalRecibido)}</span>{" "}
          <span className="text-muted">unds recibidas</span>
        </span>
      </div>
      <TimeSeriesChart
        data={series}
        xKey="fecha"
        height={220}
        series={[
          { key: "vendidas", label: "Ventas (unds)", color: "#22d3ee" },
          { key: "recibidas", label: "Recepciones (unds)", color: "#f5a623" },
        ]}
        xTickFormatter={(v) => {
          const d = new Date(String(v) + "T00:00:00Z");
          return d.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          });
        }}
        valueFormatter={(v) => num(typeof v === "number" ? v : Number(v))}
      />
    </div>
  );
}
