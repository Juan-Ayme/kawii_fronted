import { TrendingUp, AlertTriangle, Activity, Snail, Skull, type LucideIcon } from "lucide-react";
import { KanbanCol, KanbanTone } from "../types";

export const KANBAN_COLS: {
  id: KanbanCol;
  label: string;
  short: string;
  icon: LucideIcon;
  tone: KanbanTone;
}[] = [
  { id: "comprar",  label: "Comprar / Reponer",   short: "Comprar",  icon: TrendingUp,    tone: "primary" },
  { id: "alertas",  label: "Alertas / Anomalías", short: "Alertas",  icon: AlertTriangle, tone: "danger" },
  { id: "vigilar",  label: "Saludable / Vigilar", short: "Saludable", icon: Activity,     tone: "success" },
  { id: "lentos",   label: "Lentos / Excesos",    short: "Lentos",   icon: Snail,         tone: "warning" },
  { id: "liquidar", label: "Salida / Liquidar",   short: "Liquidar", icon: Skull,         tone: "neutral" },
];

/* Estilos por tono — usados en los tabs Kanban */
export const TAB_TONE_INACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/12 text-primary",
  danger:  "bg-danger/12 text-danger",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  neutral: "bg-surface-3 text-muted",
};
export const TAB_TONE_ACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary text-primary-fg shadow-[0_0_16px_rgba(99,102,241,0.4)]",
  danger:  "bg-danger text-white shadow-[0_0_16px_rgba(240,85,109,0.4)]",
  success: "bg-success text-white shadow-[0_0_16px_rgba(45,212,167,0.4)]",
  warning: "bg-warning text-white shadow-[0_0_16px_rgba(245,166,35,0.4)]",
  neutral: "bg-fg text-bg shadow-sm",
};
export const TAB_ACTIVE_BORDER: Record<KanbanTone, string> = {
  primary: "border-primary/50 bg-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  danger:  "border-danger/50 bg-danger/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  success: "border-success/50 bg-success/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  warning: "border-warning/50 bg-warning/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-sm",
  neutral: "border-border bg-surface-3/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-sm",
};
export const TAB_BADGE_INACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/15 text-primary",
  danger:  "bg-danger/15 text-danger",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  neutral: "bg-surface-3 text-muted",
};
export const TAB_BADGE_ACTIVE: Record<KanbanTone, string> = {
  primary: "bg-primary/25 text-fg",
  danger:  "bg-danger/25 text-fg",
  success: "bg-success/25 text-fg",
  warning: "bg-warning/25 text-fg",
  neutral: "bg-surface-3 text-fg",
};
