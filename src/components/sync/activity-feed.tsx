"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, stagger } from "animejs";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  entityInfo,
  humanizeError,
  parseTs,
  statusInfo,
  summarizeLogEntry,
} from "@/lib/sync-i18n";
import type { SyncLogEntry } from "@/lib/types";

interface Props {
  log: SyncLogEntry[] | undefined;
  isLoading?: boolean;
  limit?: number;
}

/**
 * ActivityFeed — línea de tiempo del sync_log con resúmenes humanizados.
 * Cada entrada:
 *   - emoji + nombre humano de la entidad
 *   - badge de estado traducido
 *   - resumen en español ("3,402 productos descargados · 12 nuevos en 4.5s")
 *   - mensaje de error traducido si lo hubo
 *   - tiempo relativo
 *
 * Las entradas entran en cascada con stagger.
 */
export function ActivityFeed({ log, isLoading, limit = 24 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    return (log ?? [])
      .slice()
      .sort(
        (a, b) => (parseTs(b.started_at) ?? 0) - (parseTs(a.started_at) ?? 0),
      )
      .slice(0, limit);
  }, [log, limit]);

  // Stagger de aparición cada vez que cambia la lista
  useEffect(() => {
    if (!containerRef.current || !rows.length) return;
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      "[data-feed-row]",
    );
    if (!els.length) return;
    const anim = animate(els, {
      opacity: [{ from: 0, to: 1 }],
      translateX: [{ from: -8, to: 0 }],
      duration: 420,
      ease: "outExpo",
      delay: stagger(35),
    });
    return () => {
      anim.pause();
    };
  }, [rows]);

  if (isLoading && !rows.length) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-caption">Leyendo el log…</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border-soft py-10 text-center text-muted">
        <p className="text-h3 font-medium text-fg">Sin actividad aún</p>
        <p className="mt-1 text-caption">
          Cuando dispares una sincronización aparecerán los pasos aquí.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-2">
      {rows.map((entry) => (
        <FeedRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function FeedRow({ entry }: { entry: SyncLogEntry }) {
  const meta = entityInfo(entry.entity);
  const st = statusInfo(entry.status);
  const summary = summarizeLogEntry({
    entity: entry.entity,
    status: entry.status,
    fetched: entry.records_fetched,
    inserted: entry.records_inserted,
    updated: entry.records_updated,
    skipped: entry.records_skipped,
    duracion_s: entry.duracion_s,
    error_message: entry.error_message,
  });

  const isError = st.tone === "danger";
  const isRunning = /running/i.test(entry.status);

  return (
    <div
      data-feed-row
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border bg-surface px-3 py-2.5 opacity-0",
        isError
          ? "border-danger/30 bg-danger-dim/30"
          : isRunning
            ? "border-info/30 bg-info/8"
            : "border-border-soft hover:border-border",
      )}
    >
      {/* Conectores visuales tipo timeline (línea izquierda) */}
      <div
        aria-hidden
        className={cn(
          "absolute left-[18px] top-9 h-[calc(100%-1rem)] w-px",
          isError
            ? "bg-danger/30"
            : isRunning
              ? "bg-info/30"
              : "bg-border-soft",
        )}
      />

      <div
        className={cn(
          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ring-1",
          isError
            ? "bg-danger/15 ring-danger/30"
            : isRunning
              ? "bg-info/15 ring-info/30"
              : st.tone === "success"
                ? "bg-success/15 ring-success/30"
                : "bg-surface-3 ring-border-soft",
        )}
      >
        <span aria-hidden>{meta.emoji}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-fg">{meta.label}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
              st.tone === "success" &&
                "border-success/30 bg-success/12 text-success",
              st.tone === "info" && "border-info/30 bg-info/12 text-info",
              st.tone === "warning" &&
                "border-warning/30 bg-warning/12 text-warning",
              st.tone === "danger" &&
                "border-danger/30 bg-danger/12 text-danger",
              st.tone === "neutral" &&
                "border-border-soft bg-surface-3 text-muted",
              st.tone === "primary" &&
                "border-primary/30 bg-primary/12 text-primary",
              st.tone === "violet" &&
                "border-violet/30 bg-violet/12 text-violet",
            )}
          >
            {st.tone === "success" && <CheckCircle2 className="h-2.5 w-2.5" />}
            {st.tone === "danger" && <XCircle className="h-2.5 w-2.5" />}
            {st.tone === "warning" && (
              <AlertTriangle className="h-2.5 w-2.5" />
            )}
            {isRunning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {st.label}
          </span>
          <span className="ml-auto text-caption text-faint">
            {relativeTime(entry.started_at)}
          </span>
        </div>
        <p className="mt-0.5 text-caption text-muted">{summary}</p>
        {entry.error_message && (
          <p className="mt-1 rounded border border-danger/20 bg-danger/5 px-2 py-1 font-mono text-[10px] text-danger/90">
            {humanizeError(entry.error_message)}
          </p>
        )}
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = parseTs(iso);
  if (d == null) return "—";
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
