"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import {
  Activity,
  AlertOctagon,
  Clock,
  Database,
  Loader2,
  Package2,
  Terminal,
  TrendingUp,
} from "lucide-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  KNOWN_ENTITIES,
  entityInfo,
  normalizeEntity,
  parseTs,
  statusInfo,
} from "@/lib/sync-i18n";
import type { SyncLogEntry, SyncTask } from "@/lib/types";
import { useAnimatedNumber } from "./use-animated-number";

interface Props {
  /** La tarea API si existe (null cuando la corrida vino del CLI). */
  task: SyncTask | null;
  log: SyncLogEntry[];
}

/**
 * ActiveMonitor — visualización inmersiva mientras corre una sync.
 * Se anclará a:
 *   - La task RUNNING/QUEUED del API si su started_at es coherente con
 *     actividad reciente en el log, O
 *   - El cluster de log entries activos (status=running) si la corrida
 *     vino del CLI `update_all.py` (no genera task).
 *
 * Detecta tasks huérfanas (RUNNING en memoria + sin actividad de log en
 * los últimos minutos) y muestra una advertencia clara en vez de pegarse
 * en 0%.
 */
export function ActiveMonitor({ task, log }: Props) {
  // ── 1) Marcas de tiempo normalizadas ────────────────────────────────────
  const taskStartMs = useMemo(
    () => parseTs(task?.started_at) ?? parseTs(task?.created_at),
    [task?.started_at, task?.created_at],
  );

  // ── 2) Cluster activo del log ────────────────────────────────────────────
  // Definimos "cluster activo" como: log entries dentro de los últimos 30 min
  // del entry más reciente. Esto agrupa fases de una misma corrida.
  const activeCluster = useMemo(() => {
    if (!log?.length) return null;
    const times = log
      .map((e) => parseTs(e.started_at))
      .filter((t): t is number => t != null);
    if (!times.length) return null;
    const latest = Math.max(...times);
    const WINDOW = 30 * 60_000;
    const startMs = Math.min(...times.filter((t) => latest - t < WINDOW));
    const entries = log.filter((e) => {
      const t = parseTs(e.started_at);
      return t != null && t >= startMs - 1_000;
    });
    return { startMs, latestMs: latest, entries };
  }, [log]);

  // ── 3) ¿Hay alguna fase actualmente "running" en el log? ────────────────
  const hasRunningLog = useMemo(
    () =>
      activeCluster?.entries.some((e) => /running/i.test(e.status)) ?? false,
    [activeCluster],
  );

  // Tick para evaluar "staleness" sin llamar Date.now() en render.
  // Se refresca cada 5s; recomputa effectiveStartMs/isOrphan en consecuencia.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  // ── 4) Inicio efectivo + fuente ─────────────────────────────────────────
  // Si la task tiene timestamps válidos Y coinciden con el cluster (dentro
  // de 10 min de margen), la usamos. Si no, anclamos al cluster del log.
  const { effectiveStartMs, source, isOrphan } = useMemo(() => {
    const latest = activeCluster?.latestMs ?? null;
    const STALE_MS = 60_000;
    const taskCoherent =
      taskStartMs != null &&
      activeCluster &&
      Math.abs(taskStartMs - activeCluster.startMs) < 10 * 60_000;

    if (task && taskCoherent) {
      const stale =
        !hasRunningLog && latest != null && nowTick - latest > STALE_MS;
      return {
        effectiveStartMs: taskStartMs,
        source: "task" as const,
        isOrphan: stale,
      };
    }
    if (activeCluster && hasRunningLog) {
      return {
        effectiveStartMs: activeCluster.startMs,
        source: "log" as const,
        isOrphan: false,
      };
    }
    if (task && taskStartMs != null) {
      return {
        effectiveStartMs: taskStartMs,
        source: "task" as const,
        isOrphan: true,
      };
    }
    return { effectiveStartMs: null, source: "none" as const, isOrphan: false };
  }, [task, taskStartMs, activeCluster, hasRunningLog, nowTick]);

  // ── 5) Logs que pertenecen a esta corrida ────────────────────────────────
  const logsThisRun = useMemo(() => {
    if (!log || effectiveStartMs == null) return [];
    const cutoff = effectiveStartMs - 5_000;
    return log
      .filter((e) => {
        const t = parseTs(e.started_at);
        return t != null && t >= cutoff;
      })
      .sort(
        (a, b) =>
          (parseTs(a.started_at) ?? 0) - (parseTs(b.started_at) ?? 0),
      );
  }, [log, effectiveStartMs]);

  // ── 6) Entidades esperadas según flags de la task ────────────────────────
  const expectedEntities = useMemo(() => {
    const params = (task?.params ?? {}) as Record<string, unknown>;
    const skipDocs = Boolean(params.skip_documents);
    const skipStock = Boolean(params.skip_stock_snapshot);
    return KNOWN_ENTITIES.filter((e) => {
      if (skipDocs && (e.key === "documents" || e.key === "document_details"))
        return false;
      if (skipStock && e.key === "stock_history") return false;
      return true;
    });
  }, [task?.params]);

  // ── 7) Estado de cada fase ───────────────────────────────────────────────
  const phaseStatus = useMemo(() => {
    const seen = new Map<string, SyncLogEntry>();
    for (const e of logsThisRun) {
      seen.set(normalizeEntity(e.entity), e);
    }
    return expectedEntities.map((meta) => {
      const entry = seen.get(meta.key);
      let state: "pending" | "running" | "ok" | "error" = "pending";
      if (entry) {
        if (/running/i.test(entry.status)) state = "running";
        else if (/ok|success/i.test(entry.status)) state = "ok";
        else if (/error|fail/i.test(entry.status)) state = "error";
      }
      return { meta, entry, state };
    });
  }, [expectedEntities, logsThisRun]);

  // Fase activa: PRIMERO los running, luego el último OK/error, luego primer pending.
  const currentPhase = useMemo(() => {
    const running = phaseStatus.find((p) => p.state === "running");
    if (running) return { ...running, _kind: "running" as const };
    const errored = [...phaseStatus]
      .reverse()
      .find((p) => p.state === "error");
    if (errored && isOrphan) return { ...errored, _kind: "error" as const };
    const lastOk = [...phaseStatus].reverse().find((p) => p.state === "ok");
    if (lastOk && phaseStatus.every((p) => p.state !== "pending")) {
      return { ...lastOk, _kind: "done" as const };
    }
    const firstPending = phaseStatus.find((p) => p.state === "pending");
    return firstPending
      ? { ...firstPending, _kind: "pending" as const }
      : phaseStatus[0]
        ? { ...phaseStatus[0], _kind: "pending" as const }
        : null;
  }, [phaseStatus, isOrphan]);

  const completed = phaseStatus.filter((p) => p.state === "ok").length;
  const errored = phaseStatus.filter((p) => p.state === "error").length;
  const total = phaseStatus.length || 1;
  const pct = Math.min(100, Math.round((completed / total) * 100));

  // ── 8) Contadores agregados ──────────────────────────────────────────────
  const totals = useMemo(() => {
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    for (const e of logsThisRun) {
      fetched += e.records_fetched ?? 0;
      inserted += e.records_inserted ?? 0;
      updated += e.records_updated ?? 0;
    }
    return { fetched, inserted, updated };
  }, [logsThisRun]);

  // ── 9) Anillo SVG animado ────────────────────────────────────────────────
  const RADIUS = 78;
  const CIRC = 2 * Math.PI * RADIUS;
  const ringRef = useRef<SVGCircleElement | null>(null);
  const lastPct = useRef(0);

  useEffect(() => {
    if (!ringRef.current) return;
    const startOffset = CIRC - (CIRC * lastPct.current) / 100;
    const endOffset = CIRC - (CIRC * pct) / 100;
    lastPct.current = pct;
    const anim = animate(ringRef.current, {
      strokeDashoffset: [startOffset, endOffset],
      duration: 1100,
      ease: "outExpo",
    });
    return () => {
      anim.pause();
    };
  }, [pct, CIRC]);

  const animPct = useAnimatedNumber(pct, { duration: 1100 });

  // ── 10) Cronómetro ───────────────────────────────────────────────────────
  const elapsedRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!elapsedRef.current) return;
    const tick = () => {
      if (!elapsedRef.current) return;
      if (effectiveStartMs == null) {
        elapsedRef.current.textContent = "—";
        return;
      }
      // Si la corrida ya terminó, congelamos en duración total.
      const endMs =
        !hasRunningLog && source === "log" && activeCluster
          ? activeCluster.latestMs
          : Date.now();
      const s = Math.max(0, Math.floor((endMs - effectiveStartMs) / 1000));
      elapsedRef.current.textContent = formatElapsed(s);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [effectiveStartMs, hasRunningLog, source, activeCluster]);

  // ── 11) Banner de orfandad ───────────────────────────────────────────────
  if (isOrphan && task && source === "task") {
    return <OrphanBanner task={task} />;
  }

  if (!currentPhase) return null;

  const isLive = hasRunningLog || (task?.status === "RUNNING" && !isOrphan);
  const isQueued = task?.status === "QUEUED";
  const isCliRun = source === "log";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-5",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        {/* Anillo de progreso */}
        <div className="relative mx-auto h-48 w-48 shrink-0">
          <svg
            viewBox="0 0 200 200"
            className="h-full w-full -rotate-90"
            aria-hidden
          >
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-accent)" />
              </linearGradient>
            </defs>
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              stroke="var(--color-surface-3)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              ref={ringRef}
              cx="100"
              cy="100"
              r={RADIUS}
              stroke="url(#ringGrad)"
              strokeWidth="10"
              fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-h1 font-semibold tabular-nums text-fg">
              {animPct}%
            </span>
            <span className="mt-1 text-caption font-medium uppercase tracking-[0.1em] text-muted">
              {completed} de {total} fases
            </span>
            {errored > 0 && (
              <span className="mt-1 text-caption font-medium text-danger">
                {errored} con error
              </span>
            )}
          </div>
        </div>

        {/* Detalles */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-caption font-semibold uppercase tracking-[0.08em]",
                isQueued
                  ? "border-warning/30 bg-warning/12 text-warning"
                  : isLive
                    ? "border-info/30 bg-info/12 text-info"
                    : "border-success/30 bg-success/12 text-success",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                {isLive && (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full rounded-pill opacity-60 animate-[pulse-dot_1.4s_var(--ease-premium)_infinite]",
                      isQueued ? "bg-warning" : "bg-info",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-pill",
                    isQueued
                      ? "bg-warning"
                      : isLive
                        ? "bg-info"
                        : "bg-success",
                  )}
                />
              </span>
              {isQueued
                ? "En cola"
                : isLive
                  ? "Sincronizando"
                  : "Recién terminada"}
            </span>
            {isCliRun ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-violet/30 bg-violet/12 px-2 py-0.5 text-caption font-semibold uppercase tracking-[0.08em] text-violet">
                <Terminal className="h-3 w-3" /> CLI
              </span>
            ) : task ? (
              <span className="font-mono text-xs text-faint">
                {task.task_id}
              </span>
            ) : null}
          </div>

          <CurrentPhaseCard
            emoji={currentPhase.meta.emoji}
            label={currentPhase.meta.label}
            description={currentPhase.meta.description}
            kind={currentPhase._kind}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Counter
              label="Tiempo"
              icon={<Clock className="h-3.5 w-3.5" />}
              value={
                <span ref={elapsedRef} className="font-mono tabular-nums">
                  00:00
                </span>
              }
              tone="primary"
            />
            <Counter
              label="Descargados"
              icon={<Database className="h-3.5 w-3.5" />}
              value={num(totals.fetched)}
              tone="info"
            />
            <Counter
              label="Nuevos"
              icon={<Package2 className="h-3.5 w-3.5" />}
              value={num(totals.inserted)}
              tone="success"
            />
            <Counter
              label="Actualizados"
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              value={num(totals.updated)}
              tone="violet"
            />
          </div>

          <PhaseDots phases={phaseStatus} />
        </div>
      </div>
    </div>
  );
}

function OrphanBanner({ task }: { task: SyncTask }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-warning/40 bg-gradient-to-br from-warning/12 via-surface to-surface p-5",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning ring-2 ring-warning/30">
          <AlertOctagon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-[0.12em] text-warning">
            Tarea huérfana detectada
          </p>
          <p className="mt-1 text-h3 font-semibold text-fg">
            Una tarea quedó marcada como RUNNING pero el worker no escribe al
            log
          </p>
          <p className="mt-2 max-w-3xl text-caption text-muted">
            La tarea{" "}
            <span className="font-mono text-fg">{task.task_id}</span> existe en
            memoria del backend pero no hay actividad reciente en{" "}
            <span className="font-mono text-fg">sync_log</span>. Esto suele
            ocurrir cuando el subproceso{" "}
            <span className="font-mono text-fg">update_all.py</span> crasheó o
            cuando reiniciaste FastAPI mientras corría. Las syncs por CLI no
            crean tasks aquí — corre la próxima desde el botón &ldquo;Sync
            completa&rdquo; arriba para limpiar este estado.
          </p>
          {task.params != null && (
            <p className="mt-2 text-caption text-faint">
              Params:{" "}
              <span className="font-mono text-muted">
                {JSON.stringify(task.params)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentPhaseCard({
  emoji,
  label,
  description,
  kind,
}: {
  emoji: string;
  label: string;
  description: string;
  kind: "running" | "ok" | "done" | "error" | "pending";
}) {
  const eyebrow =
    kind === "running"
      ? "Fase actual"
      : kind === "done"
        ? "Última fase completada"
        : kind === "error"
          ? "Última fase con error"
          : kind === "ok"
            ? "Última fase completada"
            : "Próxima fase";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface-2/60 px-4 py-3">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl ring-2",
          kind === "error"
            ? "bg-danger/15 ring-danger/30"
            : kind === "done" || kind === "ok"
              ? "bg-success/15 ring-success/30"
              : "bg-primary/15 ring-primary/30",
        )}
      >
        <span aria-hidden>{emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
          <Activity className="h-3 w-3" />
          {eyebrow}
        </p>
        <p className="truncate text-h3 font-semibold text-fg">{label}</p>
        <p className="truncate text-caption text-muted">{description}</p>
      </div>
      {kind === "running" && (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone: "primary" | "info" | "success" | "violet";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "info"
        ? "text-info"
        : tone === "success"
          ? "text-success"
          : "text-violet";
  return (
    <div className="rounded-lg border border-border-soft bg-surface px-3 py-2">
      <p
        className={cn(
          "flex items-center gap-1 text-caption font-semibold uppercase tracking-[0.08em]",
          toneCls,
        )}
      >
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-mono-md font-semibold tabular-nums text-fg">
        {value}
      </p>
    </div>
  );
}

function PhaseDots({
  phases,
}: {
  phases: { meta: { label: string; emoji: string }; state: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {phases.map((p, i) => {
        const cls =
          p.state === "ok"
            ? "bg-success"
            : p.state === "error"
              ? "bg-danger"
              : p.state === "running"
                ? "bg-info animate-pulse"
                : "bg-surface-3";
        return (
          <div
            key={i}
            title={`${p.meta.label} — ${statusInfo(p.state).label}`}
            className={cn(
              "flex h-1.5 flex-1 min-w-[18px] rounded-full transition-colors",
              cls,
            )}
          />
        );
      })}
    </div>
  );
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${String(rm).padStart(2, "0")}m`;
}

// Silenciamos warning de import indirecto.
void entityInfo;
