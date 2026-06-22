"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, stagger } from "animejs";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KNOWN_ENTITIES, normalizeEntity, parseTs } from "@/lib/sync-i18n";
import type { SyncLogEntry } from "@/lib/types";

interface Props {
  log: SyncLogEntry[] | undefined;
}

interface EntityCard {
  key: string;
  label: string;
  emoji: string;
  description: string;
  lastEntry: SyncLogEntry | null;
  state: "never" | "ok" | "running" | "error";
}

/**
 * EntityGrid — vista panorámica de TODAS las entidades sincronizables.
 * Cada tarjeta muestra: emoji, nombre humano, último estado, conteo y fecha.
 * El grid completo aparece con stagger usando anime.js.
 */
export function EntityGrid({ log }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Agregamos último log por entidad ──
  const cards: EntityCard[] = useMemo(() => {
    const lastByEntity = new Map<string, SyncLogEntry>();
    for (const e of log ?? []) {
      const key = normalizeEntity(e.entity);
      const prev = lastByEntity.get(key);
      if (!prev || (parseTs(e.started_at) ?? 0) > (parseTs(prev.started_at) ?? 0)) {
        lastByEntity.set(key, e);
      }
    }

    return KNOWN_ENTITIES.map((meta) => {
      const entry = lastByEntity.get(meta.key) ?? null;
      let state: EntityCard["state"] = "never";
      if (entry) {
        if (/ok|success/i.test(entry.status)) state = "ok";
        else if (/running/i.test(entry.status)) state = "running";
        else if (/error|fail/i.test(entry.status)) state = "error";
      }
      return {
        key: meta.key,
        label: meta.label,
        emoji: meta.emoji,
        description: meta.description,
        lastEntry: entry,
        state,
      };
    });
  }, [log]);

  // ── Animación stagger de entrada ──
  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll<HTMLElement>(
      "[data-entity-card]",
    );
    if (!els.length) return;
    const anim = animate(els, {
      opacity: [{ from: 0, to: 1 }],
      translateY: [{ from: 12, to: 0 }],
      duration: 600,
      ease: "outExpo",
      delay: stagger(45),
    });
    return () => {
      anim.pause();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {cards.map((card) => (
        <EntityCardEl key={card.key} card={card} />
      ))}
    </div>
  );
}

function EntityCardEl({ card }: { card: EntityCard }) {
  const ringRef = useRef<HTMLDivElement | null>(null);

  // Halo en cards activas (running)
  useEffect(() => {
    if (card.state !== "running" || !ringRef.current) return;
    const anim = animate(ringRef.current, {
      scale: [{ from: 0.9, to: 1.1 }],
      opacity: [{ from: 0.6, to: 0 }],
      duration: 1600,
      ease: "outQuart",
      loop: true,
    });
    return () => {
      anim.pause();
    };
  }, [card.state]);

  const styles = stateStyles[card.state];

  return (
    <div
      data-entity-card
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-surface p-3 opacity-0",
        styles.container,
      )}
    >
      {card.state === "running" && (
        <div
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-info/15"
        />
      )}

      <div className="relative flex items-center justify-between">
        <span className="text-2xl" aria-hidden>
          {card.emoji}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-caption font-semibold uppercase tracking-[0.06em]",
            styles.badge,
          )}
        >
          <styles.Icon className="h-3 w-3" />
          {styles.label}
        </span>
      </div>

      <div className="relative">
        <p className="truncate text-sm font-semibold text-fg">{card.label}</p>
        <p className="line-clamp-2 text-caption text-muted">
          {card.description}
        </p>
      </div>

      <div className="relative grid grid-cols-2 gap-2 border-t border-border-soft pt-2 text-caption">
        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-faint">
            Descargados
          </p>
          <p className="font-mono tabular-nums text-fg">
            {card.lastEntry?.records_fetched != null
              ? num(card.lastEntry.records_fetched)
              : "—"}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-[0.06em] text-faint">
            Última
          </p>
          <p className="text-fg">
            {card.lastEntry?.started_at
              ? relativeTime(card.lastEntry.started_at)
              : "Nunca"}
          </p>
        </div>
      </div>
    </div>
  );
}

const stateStyles = {
  never: {
    container: "border-border-soft",
    badge: "border-border-soft bg-surface-3 text-muted",
    label: "Pendiente",
    Icon: CircleDashed,
  },
  ok: {
    container: "border-success/25",
    badge: "border-success/30 bg-success/12 text-success",
    label: "OK",
    Icon: CheckCircle2,
  },
  running: {
    container: "border-info/30 ring-1 ring-info/30",
    badge: "border-info/30 bg-info/12 text-info",
    label: "Activa",
    Icon: Loader2,
  },
  error: {
    container: "border-danger/30",
    badge: "border-danger/30 bg-danger/12 text-danger",
    label: "Error",
    Icon: XCircle,
  },
} as const;

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
  });
}
