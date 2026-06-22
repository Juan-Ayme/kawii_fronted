"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  Save,
  EyeOff,
  Sparkles,
  RotateCcw,
  Sliders,
  Building2,
  Wand2,
  History,
  Download,
  Upload,
  Trash2,
  Tag,
} from "lucide-react";
import {
  getExclusions,
  setExclusions,
  getThresholds,
  setThresholds,
  getCompany,
  setCompany,
  getCompanyRecommendations,
  getBackups,
  createManualSnapshot,
  restoreBackup,
  deleteBackup,
  exportConfig,
  importConfig,
  type ThresholdSection,
  type CompanyField,
  type CompanyResponse,
  type CompanyValues,
  type ConfigBackup,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

type Tab = "departments" | "thresholds" | "company" | "backups";

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("departments");

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Departamentos: excluir o marcar estacional. Umbrales: tunear políticas. Empresa: marca y IDs BSale. Respaldos: historial y restauración."
      />

      <Tabs value={tab} onChange={setTab} />

      {tab === "departments" && <DepartmentsPanel />}
      {tab === "thresholds" && <ThresholdsPanel />}
      {tab === "company" && <CompanyPanel />}
      {tab === "backups" && <BackupsPanel />}
    </div>
  );
}

// ───────────────────────────── Tabs ─────────────────────────────

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "departments", label: "Departamentos", icon: EyeOff },
    { id: "thresholds", label: "Umbrales", icon: Sliders },
    { id: "company", label: "Empresa", icon: Building2 },
    { id: "backups", label: "Respaldos", icon: History },
  ];
  return (
    <div className="mb-4 inline-flex rounded-lg border border-border/40 bg-surface-2 p-1">
      {items.map((it) => {
        const active = value === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-surface text-fg shadow-sm"
                : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────── Departamentos panel ───────────────────────

function setEq(a: Set<number>, b: Set<number>) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function DepartmentsPanel() {
  const qc = useQueryClient();

  const cfg = useQuery({
    queryKey: ["config-exclusions"],
    queryFn: ({ signal }) => getExclusions(signal),
  });

  // Estado local: dos sets editables (excluidos / estacionales).
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [seasonal, setSeasonal] = useState<Set<number>>(new Set());
  // Sincroniza con el server durante el render (no useEffect). Re-sincroniza al guardar.
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const dataKey = cfg.data
    ? JSON.stringify([
        [...cfg.data.excluded_departments].sort((a, b) => a - b),
        [...cfg.data.seasonal_departments].sort((a, b) => a - b),
      ])
    : null;
  if (cfg.data && dataKey !== syncedKey) {
    setSyncedKey(dataKey);
    setExcluded(new Set(cfg.data.excluded_departments));
    setSeasonal(new Set(cfg.data.seasonal_departments));
  }

  const mutation = useMutation({
    mutationFn: () =>
      setExclusions({
        excluded_departments: [...excluded],
        excluded_categories: cfg.data?.excluded_categories ?? [],
        seasonal_departments: [...seasonal],
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("matrix"),
      });
      qc.invalidateQueries({ queryKey: ["config-exclusions"] });
    },
  });

  const depts = cfg.data?.departments ?? [];
  const initExcl = new Set(cfg.data?.excluded_departments ?? []);
  const initSeas = new Set(cfg.data?.seasonal_departments ?? []);
  const changed =
    depts.length > 0 && (!setEq(excluded, initExcl) || !setEq(seasonal, initSeas));

  const flip = (
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    id: number,
  ) =>
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const saveBtn = (
    <Button onClick={() => mutation.mutate()} disabled={!changed || mutation.isPending}>
      <Save className="h-4 w-4" />
      {mutation.isPending ? "Guardando…" : "Guardar cambios"}
    </Button>
  );

  if (cfg.isError) return <ErrorState error={cfg.error} />;
  if (cfg.isLoading) return <LoadingState label="Cargando configuración…" />;

  return (
    <Card>
      <CardHeader
        title="Departamentos"
        subtitle={`${excluded.size} excluido(s) · ${seasonal.size} estacional(es)`}
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setExcluded(new Set())}
              disabled={excluded.size === 0}
              title="Incluir todos los departamentos en los cálculos"
            >
              <Ban className="h-4 w-4" /> Quitar exclusiones
            </Button>
            <Button
              onClick={() => setSeasonal(new Set())}
              disabled={seasonal.size === 0}
              title="Quitar la marca estacional de todos"
            >
              <Ban className="h-4 w-4" /> Quitar estacionales
            </Button>
          </div>
        }
      />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-[0.7rem] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-danger/20 text-danger">
              <EyeOff className="h-3 w-3" />
            </span>
            Excluir = se oculta por completo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-violet/20 text-violet">
              <Sparkles className="h-3 w-3" />
            </span>
            Estacional = lógica de campaña
          </span>
          <span className="text-faint">
            (si un depto está excluido + estacional, la exclusión gana → estacional inerte)
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/50">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-faint">
                <th className="py-2 pl-3 text-left">Departamento</th>
                <th className="py-2 px-2 text-center w-28">Excluir</th>
                <th className="py-2 px-2 text-center w-28">Estacional</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => {
                const isExcl = excluded.has(d.id);
                const isSeas = seasonal.has(d.id);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-border/20 hover:bg-surface-2/40"
                  >
                    <td className="py-2 pl-3 text-fg">
                      {d.name}
                      {isExcl && isSeas && (
                        <span className="ml-2 text-[0.62rem] text-faint">
                          (estacional inerte: está excluido)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ToggleChip
                        on={isExcl}
                        onClick={() => flip(setExcluded, d.id)}
                        tone="danger"
                        label="Excluir"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <ToggleChip
                        on={isSeas}
                        onClick={() => flip(setSeasonal, d.id)}
                        tone="violet"
                        label="Estacional"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/30 pt-3">
          <p className="text-xs text-faint">
            {changed ? "Tienes cambios sin guardar." : "Sin cambios pendientes."}
            {mutation.isSuccess && !changed && (
              <span className="ml-2 inline-flex items-center gap-1 text-success">
                <Check className="h-3.5 w-3.5" /> Guardado
              </span>
            )}
          </p>
          {saveBtn}
        </div>
      </CardBody>
    </Card>
  );
}

function ToggleChip({
  on,
  onClick,
  tone,
  label,
}: {
  on: boolean;
  onClick: () => void;
  tone: "danger" | "violet";
  label: string;
}) {
  const onStyles =
    tone === "danger"
      ? "border-danger/40 bg-danger/15 text-danger"
      : "border-violet/40 bg-violet/15 text-violet";
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition-colors",
        on
          ? onStyles
          : "border-border text-faint hover:bg-surface-3 hover:text-muted",
      )}
    >
      {on ? `✓ ${label}` : label}
    </button>
  );
}

// ─────────────────────── Umbrales panel ───────────────────────

function ThresholdsPanel() {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["config-thresholds"],
    queryFn: ({ signal }) => getThresholds(signal),
  });

  // Estado local del formulario. Sincroniza con el server durante el render.
  const [values, setValues] = useState<Record<string, number>>({});
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const dataKey = cfg.data ? JSON.stringify(cfg.data.thresholds) : null;
  if (cfg.data && dataKey !== syncedKey) {
    setSyncedKey(dataKey);
    setValues({ ...cfg.data.thresholds });
  }

  const mutation = useMutation({
    mutationFn: (body: Record<string, number>) => setThresholds(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-thresholds"] });
    },
  });

  if (cfg.isError) return <ErrorState error={cfg.error} />;
  if (cfg.isLoading || !cfg.data) return <LoadingState label="Cargando umbrales…" />;

  const original = cfg.data.thresholds;
  const defaults = cfg.data.defaults;
  const sections = cfg.data.sections;

  const changedKeys = Object.keys(values).filter(
    (k) => values[k] !== original[k],
  );
  const changed = changedKeys.length > 0;

  const restoreSection = (section: ThresholdSection) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const f of section.fields) next[f.key] = defaults[f.key];
      return next;
    });
  };

  const update = (key: string, raw: string) => {
    // Permitir vacío momentáneo (NaN) sin perder el foco; guardar solo si parsea.
    const n = Number(raw);
    if (raw.trim() === "" || Number.isNaN(n)) return;
    setValues((prev) => ({ ...prev, [key]: n }));
  };

  const saveBtn = (
    <Button
      onClick={() =>
        mutation.mutate(
          Object.fromEntries(changedKeys.map((k) => [k, values[k]])),
        )
      }
      disabled={!changed || mutation.isPending}
    >
      <Save className="h-4 w-4" />
      {mutation.isPending ? "Guardando…" : `Guardar (${changedKeys.length})`}
    </Button>
  );

  return (
    <div>
      <div className="mb-4 rounded-lg border border-warning/30 bg-warning-dim/30 px-4 py-3 text-sm text-warning">
        <strong>Heads up:</strong> hoy estos valores se guardan en la base de
        datos pero los SQL de las matrices todavía tienen los números hardcoded.
        Editar aquí persiste el cambio pero aún <em>no</em> afecta los reportes
        — ese conector queda para una siguiente iteración con tests de
        regresión.
      </div>

      <div className="space-y-4">
        {sections.map((sec) => {
          const sectionChanged = sec.fields.some(
            (f) => values[f.key] !== original[f.key],
          );
          const sectionAtDefault = sec.fields.every(
            (f) => values[f.key] === defaults[f.key],
          );
          return (
            <Card key={sec.key}>
              <CardHeader
                title={sec.title}
                subtitle={sec.description}
                action={
                  <Button
                    onClick={() => restoreSection(sec)}
                    disabled={sectionAtDefault}
                    title="Volver a los valores por defecto del sistema"
                  >
                    <RotateCcw className="h-4 w-4" /> Restaurar defaults
                  </Button>
                }
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sec.fields.map((f) => {
                    const current = values[f.key];
                    const def = defaults[f.key];
                    const isChanged = current !== original[f.key];
                    const isDefault = current === def;
                    return (
                      <label key={f.key} className="flex flex-col gap-1.5">
                        <span className="flex items-center justify-between text-caption font-semibold uppercase tracking-[0.08em] text-muted">
                          <span>{f.label}</span>
                          {isChanged && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[0.62rem] normal-case tracking-normal text-primary">
                              editado
                            </span>
                          )}
                        </span>
                        <Input
                          type="number"
                          step="any"
                          value={Number.isFinite(current) ? current : ""}
                          onChange={(e) => update(f.key, e.target.value)}
                        />
                        <span className="text-caption text-faint">
                          {f.help}
                          {!isDefault && (
                            <>
                              {" · "}
                              <button
                                type="button"
                                className="text-primary underline-offset-2 hover:underline"
                                onClick={() =>
                                  setValues((p) => ({ ...p, [f.key]: def }))
                                }
                                title={`Volver a ${def}`}
                              >
                                default: {def}
                              </button>
                            </>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {sectionChanged && (
                  <p className="mt-3 text-xs text-warning">
                    Esta sección tiene cambios sin guardar.
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-3 mt-6 flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-faint">
          {changed
            ? `${changedKeys.length} umbral(es) sin guardar.`
            : "Sin cambios pendientes."}
          {mutation.isSuccess && !changed && (
            <span className="ml-2 inline-flex items-center gap-1 text-success">
              <Check className="h-3.5 w-3.5" /> Guardado
            </span>
          )}
        </p>
        {saveBtn}
      </div>
    </div>
  );
}

// ─────────────────────── Empresa panel ───────────────────────

function CompanyPanel() {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["config-company"],
    queryFn: ({ signal }) => getCompany(signal),
  });

  const [values, setValues] = useState<CompanyValues | null>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [recApplied, setRecApplied] = useState(false);
  const dataKey = cfg.data ? JSON.stringify(cfg.data.company) : null;
  if (cfg.data && dataKey !== syncedKey) {
    setSyncedKey(dataKey);
    setValues({ ...cfg.data.company });
    setRecApplied(false);
  }

  const mutation = useMutation({
    mutationFn: (body: Partial<CompanyValues>) => setCompany(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-company"] });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: () => getCompanyRecommendations(),
    onSuccess: (data) => {
      // Pre-cargo los valores sugeridos en el estado local. No guarda — el
      // usuario revisa, ajusta y aprieta "Guardar" cuando quiera.
      setValues((prev) =>
        prev
          ? {
              ...prev,
              brand_name: data.recommendations.brand_name || prev.brand_name,
              classification_label:
                data.recommendations.classification_label ||
                prev.classification_label,
              offices_tienda: data.recommendations.offices_tienda,
              office_almacen: data.recommendations.office_almacen,
              tipos_venta: data.recommendations.tipos_venta,
              tipos_devolucion: data.recommendations.tipos_devolucion,
              tipos_traslado: data.recommendations.tipos_traslado,
              bsale_warehouse_user_ids:
                data.recommendations.bsale_warehouse_user_ids,
              target_categories: data.recommendations.target_categories,
            }
          : prev,
      );
      setRecApplied(true);
    },
  });

  if (cfg.isError) return <ErrorState error={cfg.error} />;
  if (cfg.isLoading || !cfg.data || !values)
    return <LoadingState label="Cargando configuración de empresa…" />;

  const original = cfg.data.company;
  const sections = cfg.data.sections;
  const catalogs = cfg.data.catalogs;

  const changedKeys = (Object.keys(values) as (keyof CompanyValues)[]).filter(
    (k) => JSON.stringify(values[k]) !== JSON.stringify(original[k]),
  );
  const changed = changedKeys.length > 0;

  const updateField = <K extends keyof CompanyValues>(k: K, v: CompanyValues[K]) =>
    setValues((prev) => (prev ? { ...prev, [k]: v } : prev));

  const saveBtn = (
    <Button
      onClick={() =>
        mutation.mutate(
          Object.fromEntries(
            changedKeys.map((k) => [k, values[k]]),
          ) as Partial<CompanyValues>,
        )
      }
      disabled={!changed || mutation.isPending}
    >
      <Save className="h-4 w-4" />
      {mutation.isPending ? "Guardando…" : `Guardar (${changedKeys.length})`}
    </Button>
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex-1">
          <p className="font-semibold text-fg">
            💡 ¿Empresa nueva? El sistema puede analizar tus datos y sugerir
            todos los IDs por vos.
          </p>
          <p className="mt-1 text-xs text-muted">
            Detecta tipos de venta/devolución/traslado, sucursales que venden
            vs almacén central, almaceneros (por nº de recepciones) y top
            categorías. Te muestra la propuesta — vos revisás y guardás.
          </p>
          {recApplied && !suggestMutation.isPending && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-success">
              <Check className="h-3.5 w-3.5" /> Sugerencias aplicadas al
              formulario (sin guardar). Revisá y apretá Guardar.
            </p>
          )}
          {suggestMutation.isError && (
            <p className="mt-2 text-xs text-danger">
              Error al obtener sugerencias:{" "}
              {String((suggestMutation.error as Error)?.message ?? "")}
            </p>
          )}
        </div>
        <Button
          onClick={() => suggestMutation.mutate()}
          disabled={suggestMutation.isPending}
        >
          <Wand2 className="h-4 w-4" />
          {suggestMutation.isPending ? "Analizando…" : "Sugerir configuración"}
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((sec) => (
          <Card key={sec.key}>
            <CardHeader title={sec.title} subtitle={sec.description} />
            <CardBody>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {sec.fields.map((f) => (
                  <CompanyFieldControl
                    key={f.key}
                    field={f}
                    value={values[f.key as keyof CompanyValues]}
                    onChange={(v) =>
                      updateField(f.key as keyof CompanyValues, v as never)
                    }
                    catalogs={catalogs}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="sticky bottom-3 mt-6 flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-surface/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-faint">
          {changed
            ? `${changedKeys.length} campo(s) sin guardar: ${changedKeys.join(", ")}`
            : "Sin cambios pendientes."}
          {mutation.isSuccess && !changed && (
            <span className="ml-2 inline-flex items-center gap-1 text-success">
              <Check className="h-3.5 w-3.5" /> Guardado
            </span>
          )}
        </p>
        {saveBtn}
      </div>
    </div>
  );
}

function CompanyFieldControl({
  field,
  value,
  onChange,
  catalogs,
}: {
  field: CompanyField;
  value: CompanyValues[keyof CompanyValues];
  onChange: (v: CompanyValues[keyof CompanyValues]) => void;
  catalogs: CompanyResponse["catalogs"];
}) {
  const wrap = (control: React.ReactNode, count?: string) => (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-caption font-semibold uppercase tracking-[0.08em] text-muted">
        <span>{field.label}</span>
        {count && (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.62rem] normal-case tracking-normal text-muted">
            {count}
          </span>
        )}
      </span>
      {control}
      <span className="text-caption text-faint">{field.help}</span>
    </div>
  );

  switch (field.kind) {
    case "text":
      return wrap(
        <Input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />,
      );

    case "single_office": {
      const v = typeof value === "number" ? value : null;
      return wrap(
        <select
          value={v ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className="h-9 rounded-md border border-border-soft bg-surface-2 px-3 text-body text-fg focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="">— (sin almacén central) —</option>
          {catalogs.offices.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.id} — {o.name}
              {!o.is_active ? " (inactiva)" : ""}
            </option>
          ))}
        </select>,
      );
    }

    case "multi_office":
      return wrap(
        <MultiSelectChips
          options={catalogs.offices.map((o) => ({
            id: o.id,
            label: o.name,
            sub: `#${o.id}${!o.is_active ? " · inactiva" : ""}`,
          }))}
          selected={Array.isArray(value) ? (value as number[]) : []}
          onChange={(ids) => onChange(ids as never)}
        />,
        `${(value as number[]).length} seleccionada(s)`,
      );

    case "multi_document_type":
      return wrap(
        <MultiSelectChips
          options={catalogs.document_types.map((d) => ({
            id: d.id,
            label: d.name,
            sub: `#${d.id}${d.code ? ` · ${d.code}` : ""}${
              d.is_credit_note ? " · NC" : ""
            }`,
          }))}
          selected={Array.isArray(value) ? (value as number[]) : []}
          onChange={(ids) => onChange(ids as never)}
        />,
        `${(value as number[]).length} seleccionado(s)`,
      );

    case "multi_user":
      return wrap(
        <MultiSelectChips
          options={catalogs.users.map((u) => ({
            id: u.id,
            label: u.name || `Usuario #${u.id}`,
            sub: `#${u.id}${u.email ? ` · ${u.email}` : ""}${
              !u.is_active ? " · inactivo" : ""
            }`,
          }))}
          selected={Array.isArray(value) ? (value as number[]) : []}
          onChange={(ids) => onChange(ids as never)}
        />,
        `${(value as number[]).length} seleccionado(s)`,
      );

    case "multi_category":
      return wrap(
        <MultiSelectChips
          options={catalogs.categories.map((c) => ({
            id: c.id,
            label: c.name,
            sub: c.department_name,
          }))}
          selected={Array.isArray(value) ? (value as number[]) : []}
          onChange={(ids) => onChange(ids as never)}
        />,
        `${(value as number[]).length} seleccionada(s)`,
      );
  }
}

function MultiSelectChips({
  options,
  selected,
  onChange,
}: {
  options: { id: number; label: string; sub?: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [query, setQuery] = useState("");
  const sel = new Set(selected);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sub ?? "").toLowerCase().includes(q) ||
          String(o.id).includes(q),
      )
    : options;

  const toggle = (id: number) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onChange([...n].sort((a, b) => a - b));
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-surface-2 p-2">
      <Input
        type="text"
        placeholder="Buscar por nombre o ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded border border-border/30 bg-surface/40">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-caption text-faint">
            Sin coincidencias.
          </p>
        ) : (
          filtered.map((o) => {
            const on = sel.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-border/20 px-2.5 py-1.5 text-left text-sm transition-colors last:border-b-0",
                  on
                    ? "bg-primary/10 text-fg"
                    : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{o.label}</span>
                  {o.sub && (
                    <span className="text-[0.65rem] text-faint">{o.sub}</span>
                  )}
                </span>
                {on && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────── Respaldos panel ───────────────────────

const BACKUP_KEY_LABELS: Record<string, string> = {
  excluded_departments: "Departamentos excluidos",
  excluded_categories: "Categorías excluidas",
  seasonal_departments: "Departamentos estacionales",
  thresholds: "Umbrales",
  company: "Empresa (marca + IDs BSale)",
  sales_goals: "Metas de venta",
};

function BackupsPanel() {
  const qc = useQueryClient();
  const [filterKey, setFilterKey] = useState<string>("");
  const [manualLabel, setManualLabel] = useState<string>("");

  const backups = useQuery({
    queryKey: ["config-backups", filterKey],
    queryFn: ({ signal }) => getBackups(filterKey || null, signal),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["config-backups"] });
    qc.invalidateQueries({ queryKey: ["config-exclusions"] });
    qc.invalidateQueries({ queryKey: ["config-thresholds"] });
    qc.invalidateQueries({ queryKey: ["config-company"] });
    qc.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("matrix"),
    });
  };

  const snapshotMut = useMutation({
    mutationFn: (label: string) => createManualSnapshot(label),
    onSuccess: () => {
      setManualLabel("");
      invalidateAll();
    },
  });

  const restoreMut = useMutation({
    mutationFn: (id: number) => restoreBackup(id),
    onSuccess: () => invalidateAll(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteBackup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config-backups"] }),
  });

  const importMut = useMutation({
    mutationFn: ({
      config,
      label,
    }: {
      config: Record<string, unknown>;
      label?: string;
    }) => importConfig(config, label),
    onSuccess: () => invalidateAll(),
  });

  const handleExport = async () => {
    const data = await exportConfig();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = data.exported_at.replace(/[:.]/g, "-").slice(0, 19);
    a.download = `kawii-config-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const config =
        parsed && typeof parsed === "object" && "config" in parsed
          ? (parsed.config as Record<string, unknown>)
          : (parsed as Record<string, unknown>);
      if (!confirm(`¿Aplicar configuración del archivo "${file.name}"? Se hará snapshot de seguridad antes de pisar.`))
        return;
      importMut.mutate({ config, label: `import: ${file.name}` });
    } catch (err) {
      alert(`Error parseando JSON: ${(err as Error).message}`);
    }
  };

  if (backups.isError) return <ErrorState error={backups.error} />;
  if (backups.isLoading || !backups.data)
    return <LoadingState label="Cargando historial de configuración…" />;

  return (
    <div className="space-y-4">
      {/* Acciones globales */}
      <Card>
        <CardHeader
          title="Snapshot manual + Export / Import"
          subtitle="Marcá puntos importantes para volver fácil. Descargá un JSON para tener respaldo afuera de la DB."
        />
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[200px] flex-col gap-1">
              <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
                Etiqueta del snapshot
              </span>
              <Input
                type="text"
                placeholder='ej. "checkpoint estable" o "antes de campaña Q4"'
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
              />
            </label>
            <Button
              onClick={() => snapshotMut.mutate(manualLabel.trim())}
              disabled={!manualLabel.trim() || snapshotMut.isPending}
              title="Guarda el estado actual de TODAS las configuraciones con esta etiqueta"
            >
              <Tag className="h-4 w-4" />
              {snapshotMut.isPending ? "Guardando…" : "Crear snapshot"}
            </Button>
            <Button onClick={handleExport} variant="secondary">
              <Download className="h-4 w-4" /> Exportar JSON
            </Button>
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-soft bg-surface-2 px-3 py-1.5 text-sm font-semibold text-fg",
                "transition-colors hover:bg-surface-3",
              )}
            >
              <Upload className="h-4 w-4" /> Importar JSON
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-faint">
            Cada cambio en /configuracion ya crea un snapshot automático. Estos
            botones son para marcar momentos importantes o tener un respaldo
            fuera de la base de datos.
          </p>
        </CardBody>
      </Card>

      {/* Filtro + Historial */}
      <Card>
        <CardHeader
          title="Historial"
          subtitle={`${backups.data.total} snapshot(s). Manuales nunca se borran; automáticos se retienen los últimos 50 por sección.`}
          action={
            <select
              value={filterKey}
              onChange={(e) => setFilterKey(e.target.value)}
              className="h-9 rounded-md border border-border-soft bg-surface-2 px-3 text-sm text-fg"
            >
              <option value="">Todas las secciones</option>
              {Object.entries(BACKUP_KEY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          }
        />
        <CardBody>
          {backups.data.backups.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">
              Sin snapshots todavía. Hacé un cambio en cualquier tab o creá un
              snapshot manual para empezar el historial.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/50">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-surface-2 text-[10px] font-bold uppercase tracking-wider text-faint">
                    <th className="py-2 pl-3 text-left">Fecha</th>
                    <th className="py-2 px-2 text-left">Sección</th>
                    <th className="py-2 px-2 text-left">Origen</th>
                    <th className="py-2 px-2 text-left">Etiqueta</th>
                    <th className="py-2 pr-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.data.backups.map((b) => (
                    <BackupRow
                      key={b.id}
                      backup={b}
                      onRestore={() => {
                        if (
                          confirm(
                            `¿Restaurar ${BACKUP_KEY_LABELS[b.config_key] ?? b.config_key} al estado del ${new Date(b.changed_at).toLocaleString()}? El estado actual quedará guardado como snapshot para poder revertir.`,
                          )
                        )
                          restoreMut.mutate(b.id);
                      }}
                      onDelete={() => {
                        if (
                          confirm(
                            `¿Borrar este snapshot histórico definitivamente?`,
                          )
                        )
                          deleteMut.mutate(b.id);
                      }}
                      busy={restoreMut.isPending || deleteMut.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BackupRow({
  backup,
  onRestore,
  onDelete,
  busy,
}: {
  backup: ConfigBackup;
  onRestore: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const niceKey = BACKUP_KEY_LABELS[backup.config_key] ?? backup.config_key;
  return (
    <tr className="border-b border-border/20 hover:bg-surface-2/40">
      <td className="py-2 pl-3 align-top text-fg whitespace-nowrap">
        {new Date(backup.changed_at).toLocaleString()}
      </td>
      <td className="py-2 px-2 align-top text-fg">{niceKey}</td>
      <td className="py-2 px-2 align-top text-faint text-xs">
        {backup.is_manual ? (
          <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary">
            <Tag className="h-3 w-3" /> Manual
          </span>
        ) : (
          <span>{backup.source ?? "auto"}</span>
        )}
      </td>
      <td className="py-2 px-2 align-top text-fg text-xs">
        {backup.label ?? "—"}
        {!backup.has_value && (
          <span className="ml-1 text-[0.62rem] text-warning">
            (estado vacío)
          </span>
        )}
      </td>
      <td className="py-2 pr-3 align-top text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onRestore}
            disabled={busy}
            title="Volver a este estado"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={busy}
            title="Borrar este snapshot del historial"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
