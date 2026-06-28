import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function HealthBadge({ paraComprar, saludables, compact }: { paraComprar: number; saludables: number; compact?: boolean }) {
  // Solo mostrar la alerta si la cantidad de productos para comprar es MAYOR a la cantidad de productos saludables
  const isWorseThanHealthy = paraComprar > saludables;
  
  if (!isWorseThanHealthy || paraComprar === 0) return null;

  return (
    <span
      className="group inline-flex items-center cursor-help rounded-full text-danger/80 hover:bg-danger/10 hover:px-1.5 hover:py-0.5 transition-all duration-300"
    >
      <AlertTriangle className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />
      <span className={cn(
        "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out font-bold tabular-nums text-danger",
        "max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-1",
        compact ? "text-[0.55rem]" : "text-[0.6rem]"
      )}>
        {paraComprar} reponer
      </span>
    </span>
  );
}
