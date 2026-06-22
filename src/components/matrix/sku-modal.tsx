"use client";

import { useEffect } from "react";
import {
  X,
  Store,
  Package,
  Layers,
  Tag,
  ShoppingBag,
  Boxes,
  Gauge,
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  classifyTone,
  getClasif,
  str,
  toNum,
  TONE_STYLES,
  type MatrixRow,
} from "@/lib/matrix-classify";
import { money } from "@/lib/format";

function fmt(v: unknown, suffix = ""): string {
  if (v === null || v === undefined || v === "" || v === "NULL") return "—";
  const n = Number(v);
  if (Number.isFinite(n)) {
    const s = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(n);
    return s + suffix;
  }
  return String(v);
}

function TrendIcon({ tendencia }: { tendencia: string }) {
  if (tendencia.includes("Creciendo"))
    return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (tendencia.includes("Decayendo"))
    return <TrendingDown className="h-3.5 w-3.5 text-danger" />;
  return <Activity className="h-3.5 w-3.5 text-muted" />;
}

export function SkuModal({
  row,
  onClose,
}: {
  row: MatrixRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const clasif = getClasif(row);
  const tone = TONE_STYLES[classifyTone(clasif)];
  const ventas = toNum(row["Vendido SKU S/"]);
  const tendencia = str(row["Tendencia"]);
  const sugTrans = str(row["Sugerencia Transferencia"]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      style={{ animation: "fade-in-up 0.18s ease-out" }}
      onClick={onClose}
    >
      <div
        className={`relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-gradient-to-br ${tone.bg} ${tone.border} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg border border-border bg-bg/80 p-2 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Encabezado */}
        <div className="border-b border-border p-6">
          <div className="mb-3 flex items-start gap-3">
            <div className={`shrink-0 rounded-xl p-3 ${tone.chip}`}>
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <h2 className="text-xl font-bold leading-tight text-fg">
                {str(row["Producto"])}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded bg-bg px-2 py-0.5 font-mono">
                  SKU {str(row["Código SKU"])}
                </span>
                <span className="flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  {str(row["Sucursal"])}
                </span>
              </div>
            </div>
          </div>
          {clasif && (
            <div
              className={`inline-block rounded-lg px-3 py-1.5 text-sm font-bold ${tone.chip}`}
            >
              {clasif}
            </div>
          )}
        </div>

        <Section title="Ubicación en catálogo" icon={<Layers className="h-4 w-4" />}>
          <Field label="Departamento" value={str(row["Departamento"])} icon={<Tag className="h-3.5 w-3.5" />} />
          <Field label="Categoría" value={str(row["Categoría"])} icon={<Tag className="h-3.5 w-3.5" />} />
          <Field label="Subcategoría" value={str(row["Subcategoría"])} icon={<Tag className="h-3.5 w-3.5" />} />
        </Section>

        <Section title="Comportamiento de ventas (90d)" icon={<ShoppingBag className="h-4 w-4" />}>
          <Field label="Vendido SKU" value={money(ventas)} highlight />
          <Field label="Unidades vendidas" value={fmt(row["Unds Vend (90d)"], " u")} />
          <Field label="% en Subcategoría" value={fmt(row["% S/ en Subcat"], " %")} />
          <Field label="% en Categoría" value={fmt(row["% S/ en Cat"], " %")} />
          <Field label="% en Departamento" value={fmt(row["% S/ en Depto"], " %")} />
          <Field label="Días con venta" value={fmt(row["Días con Venta"])} />
          <Field label="Días sin vender" value={fmt(row["Días sin Vender"])} />
          <Field label="% Frecuencia" value={fmt(row["% Frecuencia"], " %")} />
        </Section>

        <Section title="Inventario" icon={<Boxes className="h-4 w-4" />}>
          <Field label="Stock disponible" value={fmt(row["Stock Disp"], " u")} highlight />
          <Field label="Stock reservado" value={fmt(row["Stock Reserv"], " u")} />
          <Field label="Recibido (90d)" value={fmt(row["Unds Recib (90d)"], " u")} />
          <Field label="Vendido del lote" value={fmt(row["Vend Lote Total"], " u")} />
          <Field label="Cobertura" value={str(row["Cobertura"])} />
          <Field label="% Rotación stock" value={fmt(row["% Rotación Stock"], " %")} />
        </Section>

        <Section title="Velocidad y proyecciones" icon={<Gauge className="h-4 w-4" />}>
          <Field label="Velocidad (uds/día)" value={fmt(row["Velocidad (uds/día)"])} />
          <Field label="Velocidad últimos 30d" value={fmt(row["Vel últimos 30d"])} />
          <Field label="Proyección 30d" value={fmt(row["Proyección 30d"], " u")} />
          <Field label="Proy. 30d reciente" value={fmt(row["Proy 30d (reciente)"], " u")} />
          <Field label="% Demanda vs Reposición" value={fmt(row["% Demanda vs Reposición"], " %")} />
          <Field label="Clasificación XYZ" value={str(row["XYZ"])} />
        </Section>

        <Section title="Histórico" icon={<Calendar className="h-4 w-4" />}>
          <Field label="Edad SKU" value={fmt(row["Edad SKU (días)"], " días")} />
          <Field label="1ª recepción" value={str(row["1ª Recepción"])} />
          <Field label="Última recepción" value={str(row["Últ. Recepción"])} />
          <Field label="Días desde últ. recep." value={fmt(row["Días desde Últ. Recep"], " d")} />
          <Field label="1ª venta del lote" value={str(row["1ª Venta Lote"])} />
          <Field label="Última venta del lote" value={str(row["Últ. Venta Lote"])} />
          <Field label="Última venta (90d)" value={str(row["Últ. Venta (90d)"])} />
        </Section>

        <Section title="Tendencia y acción sugerida" icon={<Sparkles className="h-4 w-4" />}>
          <Field
            label="Tendencia"
            value={tendencia}
            icon={<TrendIcon tendencia={tendencia} />}
            highlight
          />
          {sugTrans !== "—" && (
            <div className="col-span-full flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-dim/40 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-wide text-warning">
                  Sugerencia de transferencia
                </p>
                <p className="mt-0.5 text-sm text-fg">{sugTrans}</p>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border p-6 last:border-b-0">
      <div className="mb-3 flex items-center gap-2 text-muted">
        {icon}
        <h3 className="text-[0.78rem] font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-3 ${
        highlight
          ? "border-primary/25 bg-primary/10"
          : "border-border bg-bg/50"
      }`}
    >
      <span className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-faint">
        {icon}
        {label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${highlight ? "text-primary" : "text-fg"}`}
      >
        {value}
      </span>
    </div>
  );
}
