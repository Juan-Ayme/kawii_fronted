export type Selection = {
  dept: string | null;
  cat: string | null;
  subcat: string | null;
};

export const ROOT_SELECTION: Selection = { dept: null, cat: null, subcat: null };

export type TreeNode = {
  name: string;
  skus: number;
  ventaSoles: number;
  criticos: number;
  altas: number;
  children: TreeNode[];
};

export type SeverityFilter = "todas" | "critico" | "alta";

export type TendenciaFilter = "todas" | "creciente" | "estable" | "decreciente";
export type StockFilter = "todos" | "con_stock" | "sin_stock";

export type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};
