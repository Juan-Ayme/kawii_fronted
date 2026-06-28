export type Row = Record<string, unknown>;

/* 5 Columnas del Action Board (Kanban) */
export type KanbanCol =
  | "comprar"
  | "alertas"
  | "vigilar"
  | "lentos"
  | "liquidar";

export type KanbanTone = "primary" | "danger" | "success" | "warning" | "neutral";

/* ─────────────────── Tipos para el árbol jerárquico ─────────────────── */
export interface SubCatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
}

export interface CatNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
  subcats: SubCatNode[];
}

export interface DeptNode {
  name: string;
  ventas: number;
  tickets: number;
  skuCount: number;
  pct: number;
  paraComprar: number;
  saludables: number;
  cats: CatNode[];
}
