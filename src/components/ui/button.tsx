import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-soft shadow-card hover:shadow-card-hover",
  secondary:
    "bg-surface-2 text-fg border border-border-soft hover:bg-surface-3 hover:border-border",
  outline:
    "border border-border-soft text-fg hover:bg-surface-2 hover:border-border",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger/90 text-white hover:bg-danger shadow-card",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-caption gap-1.5",
  md: "h-9 px-4 text-body font-medium gap-2",
  icon: "h-9 w-9 justify-center",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-[background,color,box-shadow,transform,border-color]",
        "duration-[var(--duration-fast)] ease-[var(--ease-premium)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-card",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
