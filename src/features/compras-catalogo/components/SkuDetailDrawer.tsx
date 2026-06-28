"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, ShoppingCart, Copy, X, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { toast } from "@/lib/toast";
import { getSkuHistory, getPurchaseDecisionsBySku, createPurchaseDecision, type PurchaseDecisionKind } from "@/lib/api";
import { dateShort, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ComprasCatalogoSku } from "@/lib/types";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { getClassificationMeta } from "@/components/ui/classification";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { severityChipClass } from "../utils";

const SkuHistoryChart = dynamic(() => import("@/components/charts/sku-history-chart").then(mod => mod.SkuHistoryChart), { ssr: false });

const HISTORY_PERIODS = [
  { days: 90, label: "90d" },
  { days: 180, label: "180d" },
  { days: 365, label: "1 año" },
] as const;

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
}) {
  const accentClass = accent && {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[accent];
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          accentClass ?? "text-fg",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
      )}
    </div>
  );
}

export function SkuDetailDrawer({
  sku,
  officeId,
  onClose,
}: {
  sku: ComprasCatalogoSku | null;
  officeId: number | null;
  onClose: () => void;
}) {
  const [historyDays, setHistoryDays] = useState<number>(180);
  const [editQty, setEditQty] = useState<number>(0);
  const [qtySyncedFor, setQtySyncedFor] = useState<string | null>(null);
  const open = sku !== null;
  const qc = useQueryClient();

  if (sku && qtySyncedFor !== sku.sku) {
    setQtySyncedFor(sku.sku);
    setEditQty(sku.cantidad_sugerida || 0);
  }

  const history = useQuery({
    queryKey: ["sku-history", sku?.sku, historyDays, officeId],
    queryFn: ({ signal }) => getSkuHistory(sku!.sku, historyDays, officeId, signal),
    enabled: !!sku,
    staleTime: 60_000,
  });

  const decisions = useQuery({
    queryKey: ["purchase-decisions", sku?.sku, officeId],
    queryFn: ({ signal }) => getPurchaseDecisionsBySku(sku!.sku, officeId, signal),
    enabled: !!sku && officeId != null,
    staleTime: 30_000,
  });

  const decide = useMutation({
    mutationFn: (action: PurchaseDecisionKind) => {
      if (!sku || officeId == null) throw new Error("Falta sucursal o SKU");
      const isPurchase = action === "ordenar" || action === "comprar_similar";
      return createPurchaseDecision({
        sku: sku.sku,
        bsale_office_id: officeId,
        decision: action,
        quantity: isPurchase ? editQty : null,
        classification_snapshot: {
          clasificacion: sku.clasificacion,
          severidad: sku.severidad,
          accion: sku.accion,
          stock_disponible: sku.stock_disponible,
          cantidad_sugerida: sku.cantidad_sugerida,
          vendido_sku_soles: sku.vendido_sku_soles,
        },
      });
    },
    onSuccess: (_data, action) => {
      const verb = { ordenar: "Ordenar", comprar_similar: "Comprar similar", posponer: "Posponer", ignorar: "Ignorar" }[action];
      toast.success(`${verb} guardado`, {
        description: action === "ordenar" || action === "comprar_similar" ? `${editQty} uni. · ${sku?.producto ?? ""}` : sku?.producto ?? "",
      });
      qc.invalidateQueries({ queryKey: ["purchase-decisions"] });
    },
    onError: (err: Error) => {
      toast.error("Error guardando decisión", { description: err.message });
    },
  });

  const current = decisions.data?.current ?? null;
  const isPurchaseQtyInvalid = editQty <= 0;
  const decisionLabel: Record<PurchaseDecisionKind, string> = {
    ordenar: "Ordenado",
    comprar_similar: "Comprado similar",
    posponer: "Pospuesto",
    ignorar: "Ignorado",
  };

  const TendenciaIcon =
    sku?.tendencia?.includes("↑") || sku?.tendencia?.toLowerCase().includes("creci")
      ? TrendingUp
      : sku?.tendencia?.includes("↓") || sku?.tendencia?.toLowerCase().includes("deca")
        ? TrendingDown
        : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={sku?.producto ?? ""}
      subtitle={
        sku ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-fg">{sku.sku}</span>
            <span className="text-faint">·</span>
            <span>{sku.sucursal}</span>
            <span className="text-faint">·</span>
            <span className="truncate">
              {[sku.departamento, sku.categoria, sku.subcategoria].filter(Boolean).join(" › ")}
            </span>
          </span>
        ) : null
      }
    >
      {!sku ? null : (
        <div className="space-y-5">
          <div className={cn("rounded-lg border p-4", severityChipClass(sku.severidad))}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {(() => {
                  const meta = getClassificationMeta(sku.clasificacion);
                  const Icon = meta.icon;
                  return (
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", meta.bgClass)}>
                      <Icon className={cn("h-4 w-4", meta.colorClass)} />
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span>{sku.severidad}</span><span className="opacity-60">·</span>
                  <span>{sku.accion}</span><span className="opacity-60">·</span>
                  <span className="font-normal opacity-90">{sku.causal}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed font-medium">{sku.clasificacion}</p>
              </div>
            </div>
          </div>

          {current && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-success/40 bg-success-dim/30 px-3 py-2 text-xs text-success">
              <Check className="h-3.5 w-3.5" />
              <span className="font-semibold">{decisionLabel[current.decision]}</span>
              {current.quantity != null && (<span>· {num(current.quantity)} uni.</span>)}
              <span className="text-faint">· {new Date(current.created_at).toLocaleString()}</span>
              {decisions.data && decisions.data.history.length > 1 && (
                <span className="text-faint">· {decisions.data.history.length - 1} decisión(es) previa(s)</span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-faint">Cantidad a comprar</span>
                <input
                  type="number"
                  min={1}
                  value={editQty || ""}
                  onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                  className="h-9 w-28 rounded-md border border-border-soft bg-surface-2 px-3 text-body text-fg focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
                  aria-invalid={isPurchaseQtyInvalid}
                />
              </label>
              <span className="pb-1 text-[0.62rem] text-faint">
                sugerencia del sistema:{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setEditQty(sku.cantidad_sugerida || 0)}
                  title="Usar la cantidad sugerida"
                >
                  {num(sku.cantidad_sugerida)} uni.
                </button>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => decide.mutate("ordenar")} variant="primary" size="sm" disabled={decide.isPending || officeId == null || isPurchaseQtyInvalid}>
                <ShoppingCart className="h-3.5 w-3.5" /> Ordenar {editQty > 0 ? `${num(editQty)} uni.` : ""}
              </Button>
              <Button onClick={() => decide.mutate("comprar_similar")} variant="secondary" size="sm" disabled={decide.isPending || officeId == null || isPurchaseQtyInvalid}>
                <Copy className="h-3.5 w-3.5" /> Comprar similar
              </Button>
              <Button onClick={() => decide.mutate("posponer")} variant="secondary" size="sm" disabled={decide.isPending || officeId == null}>
                <Clock className="h-3.5 w-3.5" /> Posponer
              </Button>
              <Button onClick={() => decide.mutate("ignorar")} variant="ghost" size="sm" disabled={decide.isPending || officeId == null}>
                <X className="h-3.5 w-3.5" /> Ignorar
              </Button>
            </div>

            {officeId == null && (
              <p className="text-[0.62rem] text-warning">
                Seleccioná una sucursal arriba para poder guardar decisiones.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Stock disponible" value={num(sku.stock_disponible)} accent={sku.stock_disponible === 0 ? "danger" : undefined} hint={sku.stock_almacen > 0 ? `+${num(sku.stock_almacen)} en almacén` : undefined} />
            <Stat label="Velocidad 30d" value={sku.velocidad_30d.toFixed(2)} hint="uds/día" />
            <Stat label="Vendido 90d" value={num(sku.unds_vend_90d)} hint={`${money(sku.vendido_sku_soles)}`} />
            <Stat label="Proyección 30d" value={num(sku.proyeccion_30d)} hint="uds (90d)" />
            <Stat label="Cantidad sugerida" value={sku.cantidad_sugerida > 0 ? num(sku.cantidad_sugerida) : "—"} accent={sku.cantidad_sugerida > 0 ? "primary" : undefined} hint="cobertura 30d" />
            <Stat label="Margen" value={sku.margen_pct !== null ? pct(sku.margen_pct) : "—"} accent={sku.margen_pct === null ? undefined : sku.margen_pct >= 30 ? "success" : sku.margen_pct >= 15 ? "warning" : "danger"} hint={sku.margen_soles !== null ? `${money(sku.margen_soles)} 90d` : undefined} />
            <Stat label="Cobertura" value={String(sku.cobertura_dias ?? "—")} />
            <Stat label="Última venta" value={sku.ultima_venta ? dateShort(sku.ultima_venta) : "—"} hint={sku.dias_sin_vender !== null ? `hace ${sku.dias_sin_vender} días` : undefined} />
          </div>

          {sku.tendencia && sku.tendencia !== "—" && (
            <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs">
              {TendenciaIcon ? <TendenciaIcon className={cn("h-4 w-4", TendenciaIcon === TrendingUp ? "text-success" : "text-danger")} /> : null}
              <span className="font-medium text-fg">Tendencia:</span>
              <span className="text-muted">{sku.tendencia}</span>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-muted">
                <Calendar className="h-3.5 w-3.5" />
                Historial de ventas y recepciones
              </h4>
              <div className="inline-flex rounded-md border border-border-soft bg-surface-2 p-0.5">
                {HISTORY_PERIODS.map((p) => (
                  <button
                    key={p.days}
                    onClick={() => setHistoryDays(p.days)}
                    className={cn("rounded px-2 py-0.5 text-[10px] font-semibold transition-colors", historyDays === p.days ? "bg-primary/15 text-primary" : "text-muted hover:text-fg")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {history.isError ? (
              <ErrorState error={history.error} />
            ) : history.isLoading ? (
              <LoadingState label="Cargando histórico…" />
            ) : !history.data?.points?.length ? (
              <EmptyState title="Sin datos históricos" hint="Este SKU no registra movimientos en el período." />
            ) : (
              <SkuHistoryChart points={history.data.points} />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
