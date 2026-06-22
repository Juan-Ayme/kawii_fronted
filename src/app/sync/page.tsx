"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  triggerIncremental,
  triggerFullSync,
  getSyncTasks,
  getSyncLog,
  getDataQuality,
} from "@/lib/api";
import { num, dateTime } from "@/lib/format";
import {
  describeTaskParams,
  entityInfo,
  humanizeError,
  parseTs,
  statusInfo,
} from "@/lib/sync-i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { HealthBanner } from "@/components/sync/health-banner";
import { ActiveMonitor } from "@/components/sync/active-monitor";
import { EntityGrid } from "@/components/sync/entity-grid";
import { ActivityFeed } from "@/components/sync/activity-feed";
import { ErrorPanel } from "@/components/sync/error-panel";

import type { SyncTask } from "@/lib/types";

export default function SyncPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState(7);
  const [skipDocs, setSkipDocs] = useState(false);
  const [skipStock, setSkipStock] = useState(false);
  const [incrMsg, setIncrMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  // ── Tareas (polling cuando hay actividad) ──
  const tasks = useQuery({
    queryKey: ["sync-tasks"],
    queryFn: ({ signal }) => getSyncTasks(signal),
    refetchInterval: (query) => {
      const data = query.state.data as SyncTask[] | undefined;
      const active = data?.some(
        (t) => t.status === "RUNNING" || t.status === "QUEUED",
      );
      return active ? 3000 : 15000;
    },
  });

  // ── Task RUNNING/QUEUED del API (si existe) ──
  const activeTask = useMemo(
    () =>
      tasks.data?.find(
        (t) => t.status === "RUNNING" || t.status === "QUEUED",
      ) ?? null,
    [tasks.data],
  );

  // Log: arrancamos polling rápido si hay task activa O actividad reciente
  // (la inicial es 20s; el effect de abajo lo acelera cuando detecta logs RUNNING)
  const log = useQuery({
    queryKey: ["sync-log"],
    queryFn: ({ signal }) => getSyncLog(80, signal),
    refetchInterval: (q) => {
      if (activeTask) return 2500;
      const data = q.state.data as { status: string }[] | undefined;
      const liveLog = data?.some((r) => /running/i.test(r.status));
      return liveLog ? 2500 : 20000;
    },
  });

  // ── ¿Hay corrida activa? (task API o log CLI) ──
  // CLI run: log entries con status=running. Mostramos el monitor igual,
  // pasándole task=null para que se ancle al cluster del log.
  const liveLog = useMemo(
    () => (log.data ?? []).some((r) => /running/i.test(r.status)),
    [log.data],
  );
  const hasActiveRun = Boolean(activeTask) || liveLog;

  const dq = useQuery({
    queryKey: ["data-quality"],
    queryFn: ({ signal }) => getDataQuality(60, signal),
    refetchInterval: hasActiveRun ? 5000 : false,
  });

  // ── Mutaciones ──
  const incrMut = useMutation({
    mutationFn: () => triggerIncremental(),
    onSuccess: (data) => {
      const huerfanos = (data as { productos_huerfanos?: number })
        .productos_huerfanos;
      setIncrMsg({
        kind: "ok",
        text: `Sync incremental lista${
          huerfanos != null ? ` · ${num(huerfanos)} productos huérfanos detectados` : ""
        }.`,
      });
      qc.invalidateQueries({ queryKey: ["sync-log"] });
      qc.invalidateQueries({ queryKey: ["sync-tasks"] });
      qc.invalidateQueries({ queryKey: ["products-summary"] });
      qc.invalidateQueries({ queryKey: ["product-types"] });
    },
    onError: (e) =>
      setIncrMsg({ kind: "err", text: humanizeError((e as Error).message) }),
  });

  const fullMut = useMutation({
    mutationFn: () =>
      triggerFullSync({
        days,
        skip_documents: skipDocs,
        skip_stock_snapshot: skipStock,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sync-tasks"] });
      qc.invalidateQueries({ queryKey: ["sync-log"] });
    },
  });

  // ── Estadísticas resumen ──
  const stats = useMemo(() => {
    const rows = log.data ?? [];
    let okCount = 0;
    let errCount = 0;
    let runCount = 0;
    let last: string | null = null;
    let lastMs = 0;
    for (const r of rows) {
      if (/ok|success/i.test(r.status)) okCount++;
      else if (/running/i.test(r.status)) runCount++;
      else if (/error|fail/i.test(r.status)) errCount++;
      const t = parseTs(r.started_at) ?? 0;
      if (t > lastMs) {
        lastMs = t;
        last = r.started_at;
      }
    }
    return { okCount, errCount, runCount, last };
  }, [log.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Sincronización en tiempo real"
        title="Sync con BSale"
        description="Dispara descargas de catálogo, ventas y stock. Sigue cada fase con detalle: qué se descarga, qué se inserta y dónde falla."
      />

      {/* ── 1) Health/Conexión ── */}
      <HealthBanner />

      {/* ── 2) Acciones rápidas ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Incremental */}
        <ActionCard
          tone="primary"
          icon={<Zap className="h-5 w-5" />}
          title="Sync incremental"
          subtitle="Refresca catálogo (tipos + productos + variantes) en segundos."
          meta={[
            { label: "Duración aprox.", value: "< 30 s" },
            { label: "Modifica", value: "Catálogo" },
          ]}
          action={
            <Button onClick={() => incrMut.mutate()} loading={incrMut.isPending}>
              <Zap className="h-4 w-4" /> Ejecutar ahora
            </Button>
          }
          message={incrMsg}
        />

        {/* Full */}
        <ActionCard
          tone="violet"
          icon={<RefreshCw className="h-5 w-5" />}
          title="Sync completa"
          subtitle="Descarga ventana de documentos, stock y costos. Corre en segundo plano."
          meta={[
            { label: "Duración aprox.", value: "1 – 15 min" },
            {
              label: "Fases",
              value: `${10 - (skipDocs ? 2 : 0) - (skipStock ? 1 : 0)} entidades`,
            },
          ]}
          action={
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Días hacia atrás">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) || 1)}
                    className="w-24"
                  />
                </Field>
                <Toggle
                  label="Omitir documentos"
                  checked={skipDocs}
                  onChange={setSkipDocs}
                />
                <Toggle
                  label="Omitir snapshot de stock"
                  checked={skipStock}
                  onChange={setSkipStock}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => fullMut.mutate()}
                loading={fullMut.isPending}
              >
                <RefreshCw className="h-4 w-4" /> Encolar sync completa
              </Button>
              {fullMut.isSuccess && (
                <p className="rounded-md border border-success/30 bg-success/10 px-3 py-1.5 text-xs text-success">
                  Encolada con éxito · tarea{" "}
                  <span className="font-mono">{fullMut.data?.task_id}</span>
                </p>
              )}
              {fullMut.isError && (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
                  {humanizeError((fullMut.error as Error).message)}
                </p>
              )}
            </div>
          }
        />
      </div>

      {/* ── 3) Monitor activo (task API o sync por CLI) ── */}
      {hasActiveRun && (
        <div className="mt-4">
          <ActiveMonitor task={activeTask} log={log.data ?? []} />
        </div>
      )}

      {/* ── 3.5) Panel de errores (siempre visible si hay errores) ── */}
      <div className="mt-4">
        <Card>
          <CardHeader
            title="Diagnóstico de errores"
            subtitle="Qué fases fallaron en la última sincronización y por qué."
            action={
              <Badge tone={stats.errCount > 0 ? "danger" : "success"}>
                <AlertTriangle className="h-3 w-3" /> {num(stats.errCount)}
              </Badge>
            }
          />
          <CardBody>
            <ErrorPanel log={log.data} />
          </CardBody>
        </Card>
      </div>

      {/* ── 4) Resumen de logs ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Fases OK (últimas 80)"
          value={num(stats.okCount)}
          tone="success"
        />
        <MiniStat
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Fases con error"
          value={num(stats.errCount)}
          tone={stats.errCount > 0 ? "danger" : "neutral"}
        />
        <MiniStat
          icon={<Sparkles className="h-4 w-4" />}
          label="Fases en curso"
          value={num(stats.runCount)}
          tone={stats.runCount > 0 ? "info" : "neutral"}
        />
        <MiniStat
          icon={<History className="h-4 w-4" />}
          label="Última sincronización"
          value={stats.last ? dateTime(stats.last) : "—"}
          tone="primary"
          mono={false}
        />
      </div>

      {/* ── 5) Grid de entidades ── */}
      <Card className="mt-4">
        <CardHeader
          title="Entidades sincronizables"
          subtitle="Un vistazo a todo lo que viaja desde BSale hacia tu base de datos."
          action={
            <Badge tone="info">
              <Database className="h-3 w-3" /> en vivo
            </Badge>
          }
        />
        <CardBody>
          <EntityGrid log={log.data} />
        </CardBody>
      </Card>

      {/* ── 6) Tareas + feed lado a lado ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Tareas de la sesión"
            subtitle="Sync disparadas desde esta pestaña"
            action={
              <Badge tone="primary">
                <ListChecks className="h-3 w-3" /> {num(tasks.data?.length ?? 0)}
              </Badge>
            }
          />
          <CardBody className="space-y-2">
            <TaskList tasks={tasks.data ?? []} loading={tasks.isLoading} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Actividad en tiempo real"
            subtitle="Cada fase del log, traducida a humano"
            action={
              hasActiveRun ? (
                <Badge tone="info" dot>
                  Polling cada 2.5s
                </Badge>
              ) : (
                <Badge tone="neutral">Inactivo</Badge>
              )
            }
          />
          <CardBody>
            <div className="max-h-[560px] overflow-y-auto pr-1">
              <ActivityFeed
                log={log.data}
                isLoading={log.isLoading}
                limit={40}
              />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── 7) Calidad de datos ── */}
      <Card className="mt-4">
        <CardHeader
          title="Incidencias de calidad"
          subtitle="Problemas detectados por el sync (productos sin campos, precios negativos, etc.)"
          action={
            <Badge tone={(dq.data?.length ?? 0) > 0 ? "warning" : "success"}>
              <ShieldAlert className="h-3 w-3" /> {num(dq.data?.length ?? 0)}
            </Badge>
          }
        />
        <CardBody>
          <DataQualityList
            issues={dq.data ?? []}
            loading={dq.isLoading}
            error={dq.error}
          />
        </CardBody>
      </Card>
    </div>
  );
}

// ─────────────────────────── Subcomponentes ───────────────────────────

function ActionCard({
  tone,
  icon,
  title,
  subtitle,
  meta,
  action,
  message,
}: {
  tone: "primary" | "violet";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  action: React.ReactNode;
  message?: { kind: "ok" | "err"; text: string } | null;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface p-5",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
        tone === "primary" ? "border-primary/25" : "border-violet/25",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl",
          tone === "primary" ? "bg-primary/15" : "bg-violet/15",
        )}
      />
      <div className="relative space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg ring-1",
              tone === "primary"
                ? "bg-primary/15 text-primary ring-primary/30"
                : "bg-violet/15 text-violet ring-violet/30",
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 font-semibold text-fg">{title}</h3>
            <p className="text-caption text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {meta.map((m) => (
            <div
              key={m.label}
              className="rounded-md border border-border-soft bg-surface-2 px-2 py-1 text-caption"
            >
              <span className="text-faint">{m.label}: </span>
              <span className="font-medium text-fg">{m.value}</span>
            </div>
          ))}
        </div>

        <div>{action}</div>

        {message && (
          <p
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs",
              message.kind === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-caption font-medium transition-colors",
        checked
          ? "border-primary/40 bg-primary/12 text-primary"
          : "border-border-soft bg-surface-2 text-muted hover:border-border hover:text-fg",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-3 w-6 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute h-2.5 w-2.5 rounded-full bg-fg transition-transform",
            checked ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
  mono = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "success" | "danger" | "info" | "neutral" | "primary";
  mono?: boolean;
}) {
  const ring =
    tone === "success"
      ? "ring-success/30 text-success"
      : tone === "danger"
        ? "ring-danger/30 text-danger"
        : tone === "info"
          ? "ring-info/30 text-info"
          : tone === "primary"
            ? "ring-primary/30 text-primary"
            : "ring-border-soft text-muted";
  return (
    <div
      className={cn(
        "rounded-xl border border-border-soft bg-surface px-3 py-3",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
      )}
    >
      <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md ring-1",
            ring,
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-h3 font-semibold text-fg",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TaskList({
  tasks,
  loading,
}: {
  tasks: SyncTask[];
  loading: boolean;
}) {
  if (loading && !tasks.length) {
    return (
      <div className="rounded-md border border-dashed border-border-soft py-6 text-center text-caption text-muted">
        Cargando…
      </div>
    );
  }
  if (!tasks.length) {
    return (
      <div className="rounded-md border border-dashed border-border-soft py-6 text-center">
        <p className="text-sm font-medium text-fg">Sin tareas todavía</p>
        <p className="mt-1 text-caption text-muted">
          Dispara una sync incremental o completa para empezar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {tasks.slice(0, 12).map((t) => {
        const st = statusInfo(t.status);
        const isLive = t.status === "RUNNING" || t.status === "QUEUED";
        return (
          <div
            key={t.task_id}
            className={cn(
              "rounded-lg border bg-surface-2/40 px-3 py-2 text-caption",
              isLive ? "border-info/30 ring-1 ring-info/20" : "border-border-soft",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={st.tone} dot={isLive}>
                {st.label}
              </Badge>
              <span className="font-mono text-faint">{t.task_id}</span>
              {t.returncode != null && t.returncode !== 0 && (
                <Badge tone="danger">exit {t.returncode}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted">{describeTaskParams(t.params)}</p>
            <p className="mt-1 text-faint">
              {t.started_at ? (
                <>Inició {dateTime(t.started_at)}</>
              ) : t.created_at ? (
                <>Encolada {dateTime(t.created_at)}</>
              ) : null}
              {t.finished_at && ` · Terminó ${dateTime(t.finished_at)}`}
            </p>
            {t.error && (
              <p className="mt-1 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-danger">
                {humanizeError(t.error)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DataQualityList({
  issues,
  loading,
  error,
}: {
  issues: { id: number; entity: string; issue_type: string; field: string | null; description: string | null; created_at: string }[];
  loading: boolean;
  error: unknown;
}) {
  if (loading) {
    return <p className="text-caption text-muted">Cargando…</p>;
  }
  if (error) {
    return (
      <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-danger">
        {humanizeError((error as Error).message)}
      </p>
    );
  }
  if (!issues.length) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-md border border-dashed border-success/30 bg-success/5 px-4 py-6 text-center">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-semibold text-fg">
            Sin incidencias de calidad
          </p>
          <p className="text-caption text-muted">
            BSale entregó datos limpios en la última sincronización.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {issues.slice(0, 30).map((i) => {
        const ent = entityInfo(i.entity);
        return (
          <div
            key={i.id}
            className="rounded-lg border border-warning/25 bg-warning-dim/30 px-3 py-2"
          >
            <div className="flex items-start gap-2">
              <span className="text-xl" aria-hidden>
                {ent.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-fg">
                    {ent.label}
                  </span>
                  <Badge tone="warning">{i.issue_type}</Badge>
                  {i.field && (
                    <span className="font-mono text-[10px] text-faint">
                      campo: {i.field}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-caption text-muted">
                  {i.description ?? "Sin descripción del backend."}
                </p>
                <p className="mt-1 text-[10px] text-faint">
                  Detectado {dateTime(i.created_at)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
