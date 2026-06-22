"use client";

/**
 * Anatomía del cambio en ventas.
 *
 * Descompone matemáticamente Δventas en sus 3 componentes (tickets, unds/ticket,
 * $/und) usando descomposición log-aditiva:
 *
 *     ln(V) = ln(T) + ln(Q) + ln(P)
 *     Δln(V) = Δln(T) + Δln(Q) + Δln(P)   ← EXACTO
 *
 * Responde la pregunta operativa: "¿la caída/subida es por tráfico, canasta
 * o precio?". Es el primer widget que mostrar cuando alguien dice "están
 * bajando las ventas y no sabemos por qué".
 *
 * Datos del endpoint `/analytics/ticket-anatomy`. El backend excluye HOY
 * (parcial) del período actual.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertCircle,
  Microscope,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { money, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getTicketAnatomy } from "@/lib/api";
import type { TicketAnatomy } from "@/lib/types";

type Compare = "previous_period" | "previous_week" | "previous_year";

const DAYS_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 7, label: "7 días" },
  { value: 14, label: "14 días" },
  { value: 30, label: "30 días" },
];

const COMPARE_OPTIONS: ReadonlyArray<{ value: Compare; label: string }> = [
  { value: "previous_period", label: "vs periodo anterior" },
  { value: "previous_week", label: "vs semana pasada" },
  { value: "previous_year", label: "vs año pasado" },
];

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

function fmtPp(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)} pp`;
}

function fmtDateRange(from: string, to: string): string {
  const f = new Date(from + "T00:00:00Z").toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const t = new Date(to + "T00:00:00Z").toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${f} – ${t}`;
}

export function AnatomyCard({ officeId }: { officeId?: number | null }) {
  const [days, setDays] = useState<number>(7);
  const [compare, setCompare] = useState<Compare>("previous_period");

  const q = useQuery({
    queryKey: ["ticket-anatomy", days, compare, officeId ?? "all"],
    queryFn: ({ signal }) => getTicketAnatomy(days, compare, signal, officeId),
    staleTime: 5 * 60_000,
  });

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-primary" />
            Anatomía del cambio
          </span>
        }
        subtitle="¿La caída/subida fue por tráfico, canasta o precio? Descompone Δventas en sus componentes."
        action={
          <div className="flex items-center gap-2 no-print">
            <Selector value={days} onChange={setDays} options={DAYS_OPTIONS} />
            <Selector value={compare} onChange={setCompare} options={COMPARE_OPTIONS} />
          </div>
        }
      />
      <CardBody className="pt-0">
        {q.isError ? (
          <ErrorState error={q.error} />
        ) : q.isLoading ? (
          <LoadingState label="Calculando anatomía…" />
        ) : q.data ? (
          <AnatomyBody data={q.data} />
        ) : null}
      </CardBody>
    </Card>
  );
}

function Selector<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
      className="rounded-md border border-border/40 bg-surface-2 px-2 py-1 text-xs font-medium text-fg transition-colors focus:border-primary focus:outline-none"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AnatomyBody({ data }: { data: TicketAnatomy }) {
  const { current, previous, delta_pct, decomposition_log_pct } = data;
  const ventasDelta = delta_pct.ventas;
  const totalContrib = decomposition_log_pct.total ?? 0;

  // Escala las barras al |max| de las 3 contribuciones para comparar visualmente.
  const contribs = [
    decomposition_log_pct.tickets ?? 0,
    decomposition_log_pct.unds_per_ticket ?? 0,
    decomposition_log_pct.monto_per_und ?? 0,
  ];
  const maxAbs = Math.max(...contribs.map(Math.abs), 1);

  return (
    <div className="space-y-4">
      {/* Cabecera de ventas: monto actual + delta % grande + comparativo */}
      <div className="rounded-lg border border-border/30 bg-surface-2/50 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-faint">
              Ventas — {fmtDateRange(current.from, current.to)}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-fg">
              {money(current.ventas)}
            </p>
          </div>
          <DeltaBig delta={ventasDelta} />
        </div>
        <p className="mt-2 text-xs text-muted">
          vs {money(previous.ventas)}{" "}
          <span className="text-faint">
            ({fmtDateRange(previous.from, previous.to)})
          </span>
        </p>
      </div>

      {/* Descomposición: las 3 barras */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
          ¿Por qué cambió?
        </p>
        <div className="space-y-3">
          <ContribRow
            icon={Users}
            label="Tickets"
            sublabel={`${num(previous.tickets)} → ${num(current.tickets)}`}
            contrib={decomposition_log_pct.tickets}
            maxAbs={maxAbs}
            hint="cantidad de transacciones (proxy de tráfico)"
          />
          <ContribRow
            icon={ShoppingCart}
            label="Unds por ticket"
            sublabel={`${previous.unds_per_ticket.toFixed(2)} → ${current.unds_per_ticket.toFixed(2)}`}
            contrib={decomposition_log_pct.unds_per_ticket}
            maxAbs={maxAbs}
            hint="tamaño de canasta (qué tan llena se va la bolsa)"
          />
          <ContribRow
            icon={DollarSign}
            label="$ por unidad"
            sublabel={`${money(previous.monto_per_und)} → ${money(current.monto_per_und)}`}
            contrib={decomposition_log_pct.monto_per_und}
            maxAbs={maxAbs}
            hint="precio promedio del mix (más caro = mix premium / hay menos baratos)"
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-border/30 pt-2 text-xs">
          <span className="font-semibold text-faint">Σ (suma exacta en log)</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              totalContrib < -0.5
                ? "text-danger"
                : totalContrib > 0.5
                  ? "text-success"
                  : "text-muted",
            )}
          >
            {fmtPp(totalContrib)}
          </span>
        </div>
      </div>

      {/* Alerta de margen: solo cuando se mueve >1pp en cualquier dirección */}
      {delta_pct.margen_pp !== null && Math.abs(delta_pct.margen_pp) >= 1 && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-xs",
            delta_pct.margen_pp < 0
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-success/40 bg-success/10 text-success",
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-bold">
              Margen: {fmtPp(delta_pct.margen_pp)} (
              {previous.margen_pct.toFixed(1)}% → {current.margen_pct.toFixed(1)}%)
            </p>
            <p className="mt-0.5 opacity-80">
              {delta_pct.margen_pp < -3
                ? "Caída fuerte — investigar cambio de mix o de costos."
                : delta_pct.margen_pp < -1
                  ? "Caída moderada — vigilar mix de productos."
                  : delta_pct.margen_pp > 3
                    ? "Mejora fuerte — confirmar que no es por descatalogación de productos low-margin."
                    : "Mejora moderada — confirmar que no se debe a faltantes de baratos."}
            </p>
          </div>
        </div>
      )}

      {/* Sub-métricas auxiliares en una grilla compacta */}
      <div className="grid grid-cols-2 gap-2 border-t border-border/30 pt-3 text-[11px] sm:grid-cols-4">
        <SmallMetric
          label="Unidades"
          curr={num(current.unds)}
          delta={delta_pct.unds}
        />
        <SmallMetric
          label="Ticket prom."
          curr={money(current.ticket_promedio)}
          delta={delta_pct.ticket_promedio}
        />
        <SmallMetric
          label="Descuentos $"
          curr={money(current.descuento_aplicado)}
          delta={null}
        />
        <SmallMetric
          label="Regalos (líneas)"
          curr={num(current.lineas_regalo)}
          delta={null}
        />
      </div>
    </div>
  );
}

function DeltaBig({ delta }: { delta: number | null }) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="text-sm text-faint">—</span>;
  }
  const isDown = delta < -0.5;
  const isUp = delta > 0.5;
  const Icon = isDown ? TrendingDown : isUp ? TrendingUp : Minus;
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold tabular-nums",
        isDown
          ? "bg-danger/15 text-danger"
          : isUp
            ? "bg-success/15 text-success"
            : "bg-muted/15 text-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {delta >= 0 ? "+" : ""}
      {delta.toFixed(1)}%
    </div>
  );
}

function ContribRow({
  icon: Icon,
  label,
  sublabel,
  contrib,
  maxAbs,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  contrib: number | null;
  maxAbs: number;
  hint: string;
}) {
  const c = contrib ?? 0;
  // La barra va de 0% a 50% en cualquier lado (50% del ancho del track total).
  const halfWidth = Math.min(50, (Math.abs(c) / maxAbs) * 50);
  const isNeg = c < -0.05;
  const isPos = c > 0.05;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <Icon
        className={cn(
          "h-4 w-4",
          isNeg ? "text-danger" : isPos ? "text-success" : "text-muted",
        )}
      />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-fg">{label}</p>
          <p className="text-[10px] tabular-nums text-faint">{sublabel}</p>
        </div>
        {/* Barra divergente centrada en el 0 (eje vertical en el medio) */}
        <div className="relative mt-1 h-1.5 rounded-full bg-surface-3/60">
          <div
            className={cn(
              "absolute top-0 h-full",
              isNeg ? "rounded-l-full bg-danger" : "rounded-r-full bg-success",
            )}
            style={{
              [isNeg ? "right" : "left"]: "50%",
              width: `${halfWidth}%`,
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-0.5 bg-border/80" />
        </div>
        <p className="mt-0.5 text-[10px] italic text-faint">{hint}</p>
      </div>
      <span
        className={cn(
          "min-w-[55px] text-right text-xs font-bold tabular-nums",
          isNeg ? "text-danger" : isPos ? "text-success" : "text-muted",
        )}
      >
        {fmtPp(c)}
      </span>
    </div>
  );
}

function SmallMetric({
  label,
  curr,
  delta,
}: {
  label: string;
  curr: string;
  delta: number | null;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-faint">{label}</p>
      <p className="font-semibold tabular-nums text-fg">{curr}</p>
      {delta !== null && Number.isFinite(delta) && (
        <p
          className={cn(
            "tabular-nums",
            delta < -0.5
              ? "text-danger"
              : delta > 0.5
                ? "text-success"
                : "text-muted",
          )}
        >
          {fmtPct(delta)}
        </p>
      )}
    </div>
  );
}
