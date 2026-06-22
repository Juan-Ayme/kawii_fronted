"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster — montaje global del sistema de notificaciones.
 *
 * Estilizado con los tokens del @theme (surface-4 para profundidad,
 * shadow-popover, radius-lg, paleta de éxito/error/info coherente con la app).
 *
 * Posición: top-right en desktop, top-center en mobile.
 * Duración default: 4s.
 *
 * Uso:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Listo");
 *   toast.error("Algo falló", { description: "Reintentá en unos segundos" });
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      mobileOffset={{ top: 16, left: 16, right: 16 }}
      duration={4000}
      closeButton
      richColors={false}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            "!bg-surface-4 !text-fg !border !border-border-soft !shadow-popover",
            "!rounded-lg",
            "font-sans",
          ].join(" "),
          title: "!text-h3 !font-semibold !text-fg",
          description: "!text-caption !text-muted",
          actionButton:
            "!bg-primary !text-primary-fg !rounded-md !px-3 !py-1.5 !text-caption !font-semibold",
          cancelButton:
            "!bg-surface-2 !text-fg !rounded-md !px-3 !py-1.5 !text-caption !font-medium",
          closeButton:
            "!bg-surface-3 !text-muted !border-border-soft hover:!bg-surface-2",
          success: "!bg-success/10 !border-success/30",
          error: "!bg-danger/10 !border-danger/30",
          info: "!bg-info/10 !border-info/30",
          warning: "!bg-warning/10 !border-warning/30",
          loading: "!bg-surface-3",
        },
      }}
    />
  );
}
