"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealth, API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ApiStatus() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 30_000,
    retry: false,
  });

  const ok = !isError && data?.status === "ok";
  const state = isLoading ? "loading" : ok ? "ok" : "down";

  const dot =
    state === "ok"
      ? "bg-success"
      : state === "loading"
        ? "bg-warning"
        : "bg-danger";
  const label =
    state === "ok"
      ? "API conectada"
      : state === "loading"
        ? "Conectando…"
        : "API sin conexión";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-caption font-medium text-muted"
      title={`${label} · ${API_BASE_URL}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {state === "ok" && (
          <span
            className="absolute inline-flex h-full w-full rounded-pill bg-success opacity-50 animate-[pulse-dot_2s_var(--ease-premium)_infinite]"
            aria-hidden="true"
          />
        )}
        {state === "loading" && (
          <span
            className="absolute inline-flex h-full w-full rounded-pill bg-warning opacity-60 animate-[pulse-dot_1.4s_var(--ease-premium)_infinite]"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-pill",
            dot,
          )}
          aria-hidden="true"
        />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
