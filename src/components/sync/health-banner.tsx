"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { animate, stagger, utils } from "animejs";
import {
  Database,
  ServerCrash,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { getHealth, API_BASE_URL, ApiError } from "@/lib/api";
import { dateTime, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAnimatedNumber } from "./use-animated-number";

/**
 * HealthBanner — el "corazón" de la página de sync.
 * Muestra el estado de conexión a la API, la base de datos, la versión
 * y la cantidad de productos en BD. Todo con animaciones inmersivas:
 *   - Pulso radial en el ícono cuando hay conexión.
 *   - Contador animado para "productos en BD".
 *   - Barra de heartbeat (líneas que ondulan) cuando está OK.
 */
export function HealthBanner() {
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ["health-banner"],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 10_000,
    retry: 1,
  });

  const ok = !isError && data?.status === "ok";
  const productos = useAnimatedNumber(data?.productos_en_bd ?? 0, { duration: 1200 });

  // ── Heartbeat (líneas verticales animadas) ──
  const beatRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ok || !beatRef.current) return;
    const bars = beatRef.current.querySelectorAll<HTMLElement>("[data-beat-bar]");
    if (!bars.length) return;
    const anim = animate(bars, {
      scaleY: [
        { from: 0.25, to: 1.0 },
        { to: 0.4 },
        { to: 0.85 },
        { to: 0.3 },
      ],
      duration: 1800,
      ease: "inOutSine",
      loop: true,
      delay: stagger(80),
    });
    return () => {
      anim.pause();
    };
  }, [ok]);

  // ── Halo radial ──
  const haloRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ok || !haloRef.current) return;
    const anim = animate(haloRef.current, {
      scale: [{ from: 0.85, to: 1.15 }],
      opacity: [{ from: 0.55, to: 0 }],
      duration: 2200,
      ease: "outQuart",
      loop: true,
    });
    return () => {
      anim.pause();
    };
  }, [ok]);

  // ── Estado base ──
  const state: "ok" | "loading" | "down" = isLoading
    ? "loading"
    : ok
      ? "ok"
      : "down";

  const stateColor =
    state === "ok"
      ? "text-success"
      : state === "loading"
        ? "text-warning"
        : "text-danger";
  const stateBg =
    state === "ok"
      ? "bg-success/12 border-success/30"
      : state === "loading"
        ? "bg-warning/12 border-warning/30"
        : "bg-danger/12 border-danger/30";
  const StateIcon =
    state === "ok" ? CheckCircle2 : state === "loading" ? Loader2 : ServerCrash;
  const stateLabel =
    state === "ok"
      ? "API conectada"
      : state === "loading"
        ? "Buscando conexión…"
        : "Sin conexión";

  const dbName = data?.db ?? "—";
  const dbVersion = data?.db_version ?? null;
  const appVersion = data?.version ?? null;
  const lastCheck = data?.timestamp ?? null;

  const apiHost = (() => {
    try {
      return new URL(API_BASE_URL).host;
    } catch {
      return API_BASE_URL;
    }
  })();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-5",
        "animate-[fade-in-up_var(--duration-base)_var(--ease-premium)_both]",
        state === "ok" &&
          "border-success/25 from-success/8 via-surface to-surface",
        state === "loading" &&
          "border-warning/25 from-warning/8 via-surface to-surface",
        state === "down" &&
          "border-danger/30 from-danger/10 via-surface to-surface",
      )}
    >
      {/* Halo radial detrás del ícono */}
      {state === "ok" && (
        <div
          ref={haloRef}
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full bg-success/30 blur-2xl"
        />
      )}

      <div className="relative grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        {/* ── Bloque izquierdo: ícono + estado ── */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl border",
              stateBg,
            )}
          >
            <StateIcon
              className={cn(
                "h-7 w-7",
                stateColor,
                state === "loading" && "animate-spin",
              )}
            />
          </div>
          <div>
            <p
              className={cn(
                "text-caption font-semibold uppercase tracking-[0.12em]",
                stateColor,
              )}
            >
              Estado de la API
            </p>
            <p className="text-h2 font-semibold text-fg">{stateLabel}</p>
            <p className="mt-0.5 text-xs text-muted">{apiHost}</p>
          </div>
        </div>

        {/* ── Datos: DB + versión + productos ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FactCell
            label="Base de datos"
            value={dbName}
            sub={dbVersion ? `PostgreSQL ${dbVersion}` : "—"}
            icon={<Database className="h-3.5 w-3.5" />}
            tone={state === "ok" ? "ok" : "off"}
          />
          <FactCell
            label="Productos en BD"
            value={ok ? num(productos) : "—"}
            sub={lastCheck ? `Verif. ${dateTime(lastCheck)}` : "Sin datos"}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            tone={state === "ok" ? "ok" : "off"}
          />
          <FactCell
            label="Versión backend"
            value={appVersion ?? "—"}
            sub={data?.app ?? "kawii-api"}
            icon={<span className="font-mono text-[10px]">v</span>}
            tone={state === "ok" ? "ok" : "off"}
          />
        </div>

        {/* ── Heartbeat decorativo ── */}
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          {state === "ok" ? (
            <div ref={beatRef} className="flex items-center gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  data-beat-bar
                  className="block h-10 w-[3px] origin-center rounded-full bg-success/70"
                />
              ))}
            </div>
          ) : state === "loading" ? (
            <span className="text-caption font-medium text-warning">
              Comprobando…
            </span>
          ) : (
            <span className="text-caption font-medium text-danger">
              {isErrorAsApi(error) || "Sin respuesta"}
            </span>
          )}
        </div>
      </div>

      {state === "down" && (
        <p className="relative mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          No se pudo contactar al backend en{" "}
          <span className="font-mono">{API_BASE_URL}</span>. Verifica que el
          servicio esté corriendo (uvicorn / docker).
        </p>
      )}
    </div>
  );
}

function FactCell({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone: "ok" | "off";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border-soft bg-surface-2/60 p-3",
        tone === "off" && "opacity-60",
      )}
    >
      <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
        <span className="text-muted">{icon}</span> {label}
      </p>
      <p className="mt-1 truncate font-mono text-mono-md font-semibold text-fg tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-caption text-faint">{sub}</p>
      )}
    </div>
  );
}

function isErrorAsApi(e: unknown): string | null {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return null;
}

// Silenciamos warning de import no usado (utils es indirecto).
void utils;
