/**
 * toast — wrapper pre-estilado sobre sonner.
 *
 * Importá esto en lugar de la lib directa para mantener los estilos
 * consistentes con el design system.
 *
 *   import { toast } from "@/lib/toast";
 *   toast.success("Meta guardada");
 *   toast.error("No se pudo guardar", { description: error.message });
 *   const t = toast.loading("Guardando…"); ... toast.dismiss(t);
 */
export { toast } from "sonner";
