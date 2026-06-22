"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm animate-[fade-in_var(--duration-base)_var(--ease-premium)_both]"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-xl border border-border-soft bg-bg-soft shadow-modal animate-[scale-in_var(--duration-base)_var(--ease-premium)_both]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-4">
          <div>
            <h3 id={titleId} className="text-h3 font-semibold text-fg">
              {title}
            </h3>
            {description && (
              <p id={descriptionId} className="mt-1 text-caption text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted transition-colors duration-[var(--duration-fast)] ease-[var(--ease-premium)] hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
