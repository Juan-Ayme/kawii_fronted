import { cn } from "@/lib/utils";

const base = cn(
  "h-9 rounded-md border border-border-soft bg-surface-2 px-3 text-body text-fg",
  "placeholder:text-faint",
  "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
  "focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25",
  "aria-[invalid=true]:border-danger/70 aria-[invalid=true]:focus:ring-danger/25",
  "disabled:opacity-50 disabled:cursor-not-allowed",
);

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "pr-8 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  /** Texto de ayuda debajo del input (descripción, mensaje de validación). */
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="text-caption text-faint">{hint}</span>}
    </label>
  );
}
