"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronRight,
  Wand2,
  Trash2,
  Database,
  Cloud,
  GitMerge,
  AlertTriangle,
  ExternalLink,
  Lightbulb,
  Info,
} from "lucide-react";
import {
  getAudits,
  fixNaming,
  getOrphansWithoutProducts,
} from "@/lib/api";
import { num, dateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { AuditResponse, IssueMeta, IssueSource } from "@/lib/types";

/* ───────────────────────── Labels & defaults ──────────────────────── */

const ISSUE_LABELS: Record<string, string> = {
  naming_mismatches: "Nombres incorrectos",
  orphan_product_types_with_products: "Tipos huérfanos con productos",
  inactive_but_mapped: "Inactivos pero mapeados",
  subcategories_without_product_type: "Subcategorías sin product_type",
  categories_without_subcategories: "Categorías sin subcategorías",
  departments_without_categories: "Departamentos sin categorías",
  duplicate_product_type_names: "Nombres duplicados",
  products_without_classification: "Productos sin clasificar",
};

/** Tono del banner por severidad global. */
const SEVERITY: Record<
  AuditResponse["severity"],
  { icon: typeof ShieldCheck; label: string; cls: string; iconCls: string }
> = {
  ok: {
    icon: ShieldCheck,
    label: "Catálogo saludable",
    cls: "border-success/30 bg-success-dim/40",
    iconCls: "text-success",
  },
  warning: {
    icon: ShieldAlert,
    label: "Hay inconsistencias por revisar",
    cls: "border-warning/30 bg-warning-dim/40",
    iconCls: "text-warning",
  },
  critical: {
    icon: ShieldX,
    label: "Inconsistencias críticas",
    cls: "border-danger/30 bg-danger-dim/40",
    iconCls: "text-danger",
  },
};

/** Estilo + ícono por LADO del sistema donde nace el problema. */
const SOURCE_STYLE: Record<
  IssueSource,
  { icon: typeof Cloud; label: string; short: string; chip: string; dot: string }
> = {
  bsale: {
    icon: Cloud,
    label: "Problema en BSale (ERP)",
    short: "BSale",
    chip: "border-info/40 bg-info/15 text-info",
    dot: "bg-info",
  },
  local_db: {
    icon: Database,
    label: "Problema en tu BD local (taxonomía)",
    short: "BD local",
    chip: "border-violet/40 bg-violet/15 text-violet",
    dot: "bg-violet",
  },
  both: {
    icon: GitMerge,
    label: "Problema en ambos lados",
    short: "Mixto",
    chip: "border-warning/40 bg-warning/15 text-warning",
    dot: "bg-warning",
  },
};

/* ── Fallback meta (cuando el backend no devuelve `meta` por compatibilidad). ─ */
const FALLBACK_META: IssueMeta = {
  source: "both",
  where: "BSale + BD local",
  what: "Inconsistencia detectada.",
  impact: "",
  fix_hint: "",
  fix_link: null,
  row_label: "Item",
};

/* ── Columnas curadas por tipo de issue (en vez de Object.keys() crudo). ─── */
type RowCols = Column<Record<string, unknown>>[];

function colsForIssue(key: string): RowCols | null {
  const txt = (k: string): Column<Record<string, unknown>> => ({
    key: k,
    header: prettyHeader(k),
    render: (r) => fmtCell(r[k]),
  });
  const numRight = (k: string): Column<Record<string, unknown>> => ({
    key: k,
    header: prettyHeader(k),
    align: "right",
    render: (r) => fmtCell(r[k]),
  });

  switch (key) {
    case "naming_mismatches":
      return [
        numRight("id"),
        { key: "current_name", header: "Nombre en BSale", render: (r) => (
          <code className="font-mono text-xs text-danger">{fmtCell(r.current_name)}</code>
        )},
        { key: "expected_name", header: "Esperado por tu BD", render: (r) => (
          <code className="font-mono text-xs text-success">{fmtCell(r.expected_name)}</code>
        )},
        txt("department"),
        txt("category"),
        txt("subcategory"),
        numRight("productos"),
      ];
    case "orphan_product_types_with_products":
      return [numRight("id"), txt("name"), numRight("productos")];
    case "inactive_but_mapped":
      return [
        numRight("id"),
        txt("name"),
        txt("department"),
        txt("category"),
        txt("subcategory"),
        numRight("productos"),
        { key: "ultimo_sync", header: "Último sync", render: (r) =>
          r.ultimo_sync ? dateTime(String(r.ultimo_sync)) : "—" },
      ];
    case "subcategories_without_product_type":
      return [
        numRight("id"),
        txt("subcategory"),
        txt("category"),
        txt("department"),
        { key: "productos_override", header: "Productos por override", align: "right",
          render: (r) => fmtCell(r.productos_override) },
      ];
    case "categories_without_subcategories":
      return [numRight("id"), txt("category"), txt("department")];
    case "departments_without_categories":
      return [numRight("id"), txt("department")];
    case "duplicate_product_type_names":
      return [
        txt("name"),
        numRight("count"),
        { key: "ids", header: "IDs en BSale", render: (r) => (
          <code className="font-mono text-xs">{
            Array.isArray(r.ids) ? r.ids.join(", ") : fmtCell(r.ids)
          }</code>
        )},
      ];
    case "products_without_classification":
      return [
        numRight("id"),
        txt("producto"),
        numRight("bsale_pt_id"),
        { key: "bsale_pt_name", header: "PT en BSale", render: (r) => fmtCell(r.bsale_pt_name) },
        { key: "bsale_pt_active", header: "PT activo BSale", render: (r) =>
          r.bsale_pt_active ? <Badge tone="success">Sí</Badge> : <Badge tone="neutral">No</Badge> },
        { key: "local_mapped", header: "Mapeado en BD", render: (r) =>
          r.local_mapped ? <Badge tone="success">Sí</Badge> : <Badge tone="danger">No</Badge> },
      ];
    default:
      return null; // → cae a auto-derivar columnas con Object.keys
  }
}

function prettyHeader(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/* ─────────────────────────── Página ─────────────────────────── */

export default function AuditoriasPage() {
  const qc = useQueryClient();
  const audits = useQuery({
    queryKey: ["audits"],
    queryFn: ({ signal }) => getAudits(signal),
  });
  const orphans = useQuery({
    queryKey: ["orphans-without-products"],
    queryFn: ({ signal }) => getOrphansWithoutProducts(signal),
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<string | null>(null);

  const fixMut = useMutation({
    mutationFn: (dryRun: boolean) => fixNaming(null, dryRun),
    onSuccess: (data) => {
      if (data.dry_run) {
        setFixResult(
          `Previsualización: ${num(data.totals.candidates)} nombres se corregirían.`,
        );
      } else {
        setFixResult(
          `Listo: ${num(data.totals.fixed)} corregidos, ${num(
            data.totals.failed,
          )} fallidos.`,
        );
        qc.invalidateQueries({ queryKey: ["audits"] });
        qc.invalidateQueries({ queryKey: ["product-types"] });
      }
    },
  });

  const data = audits.data;
  const sev = data ? SEVERITY[data.severity] : null;

  // Categorizar issues por ORIGEN para los 3 KPI cards de arriba.
  const byOrigin = useMemo(() => {
    const out = { bsale: 0, local_db: 0, both: 0 } as Record<IssueSource, number>;
    if (!data) return out;
    if (data.side_counts) {
      out.bsale = data.side_counts.bsale;
      out.local_db = data.side_counts.local_db;
      out.both = data.side_counts.both;
      return out;
    }
    // Fallback si el backend no envía side_counts
    for (const [key, count] of Object.entries(data.summary)) {
      if (count <= 0) continue;
      const src = data.meta?.[key]?.source ?? "both";
      out[src] += count;
    }
    return out;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Auditorías"
        description="Calidad del catálogo: detecta inconsistencias y te dice exactamente dónde nacen — en BSale, en tu BD local, o en ambos."
        actions={
          <Button
            variant="secondary"
            onClick={() => audits.refetch()}
            loading={audits.isFetching}
          >
            Re-ejecutar
          </Button>
        }
      />

      {audits.isLoading ? (
        <LoadingState />
      ) : audits.error ? (
        <ErrorState error={audits.error} />
      ) : data ? (
        <>
          {/* Banner de severidad */}
          {sev && (
            <div
              className={cn(
                "mb-4 flex items-center gap-3 rounded-xl border px-4 py-3",
                sev.cls,
              )}
            >
              <sev.icon className={cn("h-6 w-6", sev.iconCls)} />
              <div>
                <p className="text-sm font-semibold text-fg">{sev.label}</p>
                <p className="text-xs text-muted">
                  Generado: {dateTime(data.generated_at)}
                </p>
              </div>
            </div>
          )}

          {/* KPI cards POR ORIGEN — responden de un vistazo "¿dónde está el problema?" */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OriginCard source="bsale" count={byOrigin.bsale} />
            <OriginCard source="local_db" count={byOrigin.local_db} />
            <OriginCard source="both" count={byOrigin.both} />
          </div>

          {/* Resumen de conteos por tipo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(data.summary).map(([key, count]) => {
              const active = count > 0;
              const meta = data.meta?.[key] ?? FALLBACK_META;
              const style = SOURCE_STYLE[meta.source];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border p-4",
                    active
                      ? "border-warning/30 bg-surface"
                      : "border-border bg-surface/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-2xl font-semibold",
                        active ? "text-fg" : "text-faint",
                      )}
                    >
                      {num(count)}
                    </p>
                    {active && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                          style.chip,
                        )}
                        title={style.label}
                      >
                        <style.icon className="h-3 w-3" />
                        {style.short}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {ISSUE_LABELS[key] ?? key}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Auto-fix de nombres */}
          <Card className="mt-4">
            <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Wand2 className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-fg">
                    Corregir nombres de product_types
                  </p>
                  <p className="text-xs text-muted">
                    Renombra en BSale + BD para cumplir &quot;Categoría /
                    Subcategoría&quot;. {fixResult && <span className="text-success">{fixResult}</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => fixMut.mutate(true)}
                  loading={fixMut.isPending && fixMut.variables === true}
                >
                  Previsualizar
                </Button>
                <Button
                  onClick={() => fixMut.mutate(false)}
                  loading={fixMut.isPending && fixMut.variables === false}
                  disabled={data.summary.naming_mismatches === 0}
                >
                  Aplicar
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Listas de issues — cada sección con origen, descripción, impacto, fix */}
          <div className="mt-4 space-y-2">
            {Object.entries(data.issues).map(([key, items]) => (
              <IssueSection
                key={key}
                issueKey={key}
                title={ISSUE_LABELS[key] ?? key}
                items={items}
                meta={data.meta?.[key] ?? FALLBACK_META}
                open={expanded === key}
                onToggle={() => setExpanded(expanded === key ? null : key)}
              />
            ))}
          </div>

          {/* Huérfanos sin productos */}
          <Card className="mt-4">
            <CardHeader
              title="Tipos huérfanos sin productos"
              subtitle="Candidatos seguros a eliminar (sin mapeo y sin productos)"
              action={
                <Badge tone="neutral">
                  <Trash2 className="h-3 w-3" /> {num(orphans.data?.length)}
                </Badge>
              }
            />
            <CardBody className="pt-0">
              <DataTable
                columns={[
                  { key: "id", header: "ID", align: "right" },
                  { key: "name", header: "Nombre" },
                  {
                    key: "is_active",
                    header: "Estado",
                    render: (r: { is_active: boolean }) =>
                      r.is_active ? (
                        <Badge tone="success">Activo</Badge>
                      ) : (
                        <Badge tone="neutral">Inactivo</Badge>
                      ),
                  },
                ]}
                rows={orphans.data}
                isLoading={orphans.isLoading}
                error={orphans.error}
                emptyTitle="No hay tipos huérfanos sin productos"
                maxHeight="320px"
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/* ─────────────────────── KPI card por ORIGEN ─────────────────────── */

function OriginCard({ source, count }: { source: IssueSource; count: number }) {
  const s = SOURCE_STYLE[source];
  const active = count > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4",
        active ? "bg-surface" : "bg-surface/60 border-border",
        active && source === "bsale" && "border-info/30",
        active && source === "local_db" && "border-violet/30",
        active && source === "both" && "border-warning/30",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg border",
          s.chip,
        )}
      >
        <s.icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-2xl font-semibold leading-tight", active ? "text-fg" : "text-faint")}>
          {num(count)}
        </p>
        <p className="truncate text-xs text-muted">{s.label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────── Sección de un issue ─────────────────────── */

function IssueSection({
  issueKey,
  title,
  items,
  meta,
  open,
  onToggle,
}: {
  issueKey: string;
  title: string;
  items: Array<Record<string, unknown>>;
  meta: IssueMeta;
  open: boolean;
  onToggle: () => void;
}) {
  const style = SOURCE_STYLE[meta.source];
  const hasItems = items.length > 0;

  // Columnas curadas por tipo, fallback a auto-deriva si no las definimos
  const curated = colsForIssue(issueKey);
  const cols: RowCols =
    curated ?? (hasItems
      ? Object.keys(items[0]).map((k) => ({
          key: k,
          header: prettyHeader(k),
          align: typeof items[0][k] === "number" ? "right" : "left",
          render: (r: Record<string, unknown>) => fmtCell(r[k]),
        }))
      : []);

  return (
    <Card>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-faint transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-sm font-medium text-fg">{title}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            style.chip,
          )}
          title={style.label}
        >
          <style.icon className="h-3 w-3" />
          {style.short}
        </span>
        <Badge tone={hasItems ? "warning" : "success"} className="ml-auto">
          {items.length}
        </Badge>
      </button>
      {open && (
        <div className="border-t border-border p-4">
          {/* Bloque pedagógico: dónde está, qué significa, impacto, cómo arreglarlo */}
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg bg-surface-2/40 p-3 text-xs sm:grid-cols-2">
            <FactLine
              icon={style.icon}
              label="¿Dónde está el problema?"
              value={meta.where}
            />
            <FactLine
              icon={Info}
              label="¿Qué pasa?"
              value={meta.what}
            />
            {meta.impact && (
              <FactLine
                icon={AlertTriangle}
                label="Impacto"
                value={meta.impact}
              />
            )}
            {meta.fix_hint && (
              <FactLine
                icon={Lightbulb}
                label="Cómo arreglarlo"
                value={meta.fix_hint}
                action={
                  meta.fix_link ? (
                    <Link
                      href={meta.fix_link}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Ir <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : null
                }
              />
            )}
          </div>

          {/* Datos del issue */}
          {hasItems ? (
            <DataTable columns={cols} rows={items} maxHeight="400px" />
          ) : (
            <EmptyState title="Sin elementos" />
          )}
        </div>
      )}
    </Card>
  );
}

function FactLine({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof Info;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">
          {label}
        </p>
        <p className="text-xs leading-snug text-muted">
          {value}
          {action && <span className="ml-2">{action}</span>}
        </p>
      </div>
    </div>
  );
}
