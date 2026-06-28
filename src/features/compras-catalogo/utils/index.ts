import type { ComprasCatalogoSku } from "@/lib/types";
import { Selection, TreeNode } from "../types";

export function buildTree(skus: ComprasCatalogoSku[]): TreeNode[] {
  // Map<dept, Map<cat, Map<subcat, accum>>>
  const deptMap = new Map<string, Map<string, Map<string, TreeNode>>>();

  for (const sku of skus) {
    const d = sku.departamento || "Sin departamento";
    const c = sku.categoria || "Sin categoría";
    const s = sku.subcategoria || "Sin subcategoría";

    if (!deptMap.has(d)) deptMap.set(d, new Map());
    const catMap = deptMap.get(d)!;
    if (!catMap.has(c)) catMap.set(c, new Map());
    const subMap = catMap.get(c)!;
    if (!subMap.has(s))
      subMap.set(s, {
        name: s,
        skus: 0,
        ventaSoles: 0,
        criticos: 0,
        altas: 0,
        children: [],
      });
    const node = subMap.get(s)!;
    node.skus += 1;
    node.ventaSoles += sku.vendido_sku_soles;
    if (sku.severidad.includes("Crítico")) node.criticos += 1;
    if (sku.severidad.includes("Alta")) node.altas += 1;
  }

  // Convertir maps a arrays + agregar totales por nivel.
  const tree: TreeNode[] = [];
  for (const [deptName, catMap] of deptMap.entries()) {
    const cats: TreeNode[] = [];
    for (const [catName, subMap] of catMap.entries()) {
      const subs = [...subMap.values()].sort(
        (a, b) => b.ventaSoles - a.ventaSoles,
      );
      cats.push({
        name: catName,
        skus: subs.reduce((acc, s) => acc + s.skus, 0),
        ventaSoles: subs.reduce((acc, s) => acc + s.ventaSoles, 0),
        criticos: subs.reduce((acc, s) => acc + s.criticos, 0),
        altas: subs.reduce((acc, s) => acc + s.altas, 0),
        children: subs,
      });
    }
    cats.sort((a, b) => b.ventaSoles - a.ventaSoles);
    tree.push({
      name: deptName,
      skus: cats.reduce((acc, c) => acc + c.skus, 0),
      ventaSoles: cats.reduce((acc, c) => acc + c.ventaSoles, 0),
      criticos: cats.reduce((acc, c) => acc + c.criticos, 0),
      altas: cats.reduce((acc, c) => acc + c.altas, 0),
      children: cats,
    });
  }
  return tree.sort((a, b) => b.ventaSoles - a.ventaSoles);
}

export function scopeTitle(sel: Selection): string {
  if (sel.subcat) return sel.subcat;
  if (sel.cat) return sel.cat;
  if (sel.dept) return sel.dept;
  return "Catálogo de decisiones";
}

/* Helper: extrae el "encabezado" de la clasificación sin la descripción larga. */
export function shortClasif(clasif: string): string {
  return clasif.split(/[:(]/)[0].trim() || "—";
}

export function severityChipClass(sev: string): string {
  if (sev.includes("Crítico")) return "bg-danger/15 text-danger border-danger/25";
  if (sev.includes("Alta")) return "bg-warning/15 text-warning border-warning/25";
  return "bg-surface-3 text-muted border-border-soft";
}

export const DEPT_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];
