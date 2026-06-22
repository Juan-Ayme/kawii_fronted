"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { entityInfo, humanizeError, parseTs } from "@/lib/sync-i18n";
import type { SyncLogEntry } from "@/lib/types";

interface Props {
  log: SyncLogEntry[] | undefined;
}

/**
 * ErrorPanel — pasa el sync_log y extrae SOLO las fases que fallaron,
 * traducidas a humano. Card colapsable; expandida muestra el mensaje
 * técnico completo con botón copiar.
 *
 * Aparece ANTES del feed para que el usuario vea los errores sin scrollear.
 */
export function ErrorPanel({ log }: Props) {
  const errors = useMemo(() => {
    if (!log) return [];
    return log
      .filter((e) => /error|fail/i.test(e.status))
      .sort(
        (a, b) =>
          (parseTs(b.started_at) ?? 0) - (parseTs(a.started_at) ?? 0),
      );
  }, [log]);

  // Agrupamos por entidad ANTES de cualquier return para no romper hook order
  const grouped = useMemo(() => {
    const map = new Map<string, SyncLogEntry[]>();
    for (const e of errors) {
      const k = e.entity;
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries()).map(([entity, entries]) => ({
      entity,
      entries,
      latest: entries[0],
    }));
  }, [errors]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!containerRef.current || !errors.length) return;
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      "[data-error-row]",
    );
    if (!els.length) return;
    const anim = animate(els, {
      opacity: [{ from: 0, to: 1 }],
      translateY: [{ from: 8, to: 0 }],
      duration: 420,
      ease: "outExpo",
      delay: stagger(60),
    });
    return () => {
      anim.pause();
    };
  }, [errors]);

  if (!errors.length) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/25 bg-success/8 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-semibold text-fg">Sin fases con error</p>
          <p className="text-caption text-muted">
            Las últimas sincronizaciones cerraron limpias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.08em] text-danger">
        <AlertOctagon className="h-3.5 w-3.5" />
        {num(errors.length)} fase{errors.length === 1 ? "" : "s"} con error
        {grouped.length !== errors.length && (
          <span className="text-faint">
            · {num(grouped.length)} entidad
            {grouped.length === 1 ? "" : "es"} afectada
            {grouped.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {grouped.map((g) => (
        <ErrorRow key={g.entity} entity={g.entity} entries={g.entries} />
      ))}
    </div>
  );
}

function ErrorRow({
  entity,
  entries,
}: {
  entity: string;
  entries: SyncLogEntry[];
}) {
  const [open, setOpen] = useState(false);
  const meta = entityInfo(entity);
  const latest = entries[0];
  const humanMsg = humanizeError(latest.error_message);
  const technical = latest.error_message ?? "";
  const count = entries.length;

  return (
    <div
      data-error-row
      className={cn(
        "rounded-lg border border-danger/30 bg-danger-dim/40 opacity-0",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-base ring-1 ring-danger/30">
          <span aria-hidden>{meta.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-fg">{meta.label}</span>
            {count > 1 && (
              <span className="inline-flex items-center rounded-pill border border-danger/30 bg-danger/12 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                {num(count)}× falló
              </span>
            )}
            <span className="ml-auto text-caption text-faint">
              {relativeTime(latest.started_at)}
            </span>
          </div>
          <p className="mt-0.5 text-caption text-danger/90">{humanMsg}</p>
        </div>
        {technical ? (
          open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
          )
        ) : null}
      </button>

      {open && technical && (
        <div className="border-t border-danger/20 px-3 py-2">
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-caption font-semibold uppercase tracking-[0.08em] text-faint">
              Mensaje técnico
            </span>
            <CopyButton text={technical} />
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-danger/20 bg-bg-soft px-2 py-1.5 font-mono text-[10px] leading-relaxed text-danger/90">
            {technical}
          </pre>
          {count > 1 && (
            <details className="mt-2 text-caption text-faint">
              <summary className="cursor-pointer text-muted">
                Ver las otras {count - 1} repeticiones
              </summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {entries.slice(1).map((e) => (
                  <li key={e.id} className="font-mono text-[10px]">
                    {relativeTime(e.started_at)} · {humanizeError(e.error_message)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard no disponible */
        }
      }}
      className="inline-flex items-center gap-1 rounded border border-border-soft px-1.5 py-0.5 text-[10px] text-muted hover:border-border hover:text-fg"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function relativeTime(iso: string): string {
  const t = parseTs(iso);
  if (t == null) return "—";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  return `hace ${days}d`;
}
