// src/lib/hierarchy.ts

/** 
 * Nodo genérico de jerarquía.
 * Permite mantener métricas flexibles para Compras y Ventas.
 */
export interface TreeNode {
  name: string;
  // Métricas comunes
  skus: number;
  ventaSoles: number;
  
  // Métricas específicas de Compras
  criticos: number;
  altas: number;
  
  // Métricas específicas de Ventas
  tickets: number;
  paraComprar: number;
  saludables: number;
  pct: number; // % sobre el total
  
  children: TreeNode[];
}

export interface FlatProduct {
  departamento?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  Departamento?: string | null;
  Categoría?: string | null;
  Subcategoría?: string | null;
  
  // Mapeo genérico para sumar métricas
  vendido_sku_soles?: number;
  "Vendido SKU S/"?: number;
  
  // Compras
  severidad?: string;
  
  // Ventas
  Tickets?: number;
  Clasificación?: string;
  
  [key: string]: any;
}

const n = (v: any) => (typeof v === "number" ? v : 0);
const s = (v: any) => (v ? String(v) : "");

/**
 * Construye un árbol jerárquico (Departamento -> Categoría -> Subcategoría) 
 * a partir de un arreglo de productos planos.
 */
export function buildTree(items: FlatProduct[]): TreeNode[] {
  const deptMap = new Map<string, TreeNode>();

  for (const item of items) {
    const dName = s(item.departamento || item.Departamento || "Sin Departamento");
    const cName = s(item.categoria || item.Categoría || "Sin Categoría");
    const scName = s(item.subcategoria || item.Subcategoría || "Sin Subcategoría");

    // Resolver campos métricos
    const venta = n(item.vendido_sku_soles ?? item["Vendido SKU S/"]);
    const tickets = n(item.Tickets);
    
    // Severidades para compras
    const sev = s(item.severidad);
    const isCritico = sev.includes("Crítico") ? 1 : 0;
    const isAlta = sev.includes("Alta") ? 1 : 0;
    
    // Clasificaciones para ventas
    const clasif = s(item.Clasificación).toUpperCase();
    const isComprar = clasif.includes("BESTSELLER ACTIVO") || clasif.includes("AGOTADO CON DEMANDA") || clasif.includes("QUIEBRE DE BESTSELLER") || clasif.includes("POCO STOCK") ? 1 : 0;
    const isSaludable = clasif.includes("INVENTARIO SANO") || clasif.includes("ROTACIÓN ACTIVA") || clasif.includes("EMERGENTE") ? 1 : 0;

    // 1. Get or create Dept
    if (!deptMap.has(dName)) {
      deptMap.set(dName, { name: dName, skus: 0, ventaSoles: 0, criticos: 0, altas: 0, tickets: 0, paraComprar: 0, saludables: 0, pct: 0, children: [] });
    }
    const dNode = deptMap.get(dName)!;
    dNode.skus++;
    dNode.ventaSoles += venta;
    dNode.criticos! += isCritico;
    dNode.altas! += isAlta;
    dNode.tickets! += tickets;
    dNode.paraComprar! += isComprar;
    dNode.saludables! += isSaludable;

    // 2. Get or create Cat
    let cNode = dNode.children.find((c) => c.name === cName);
    if (!cNode) {
      cNode = { name: cName, skus: 0, ventaSoles: 0, criticos: 0, altas: 0, tickets: 0, paraComprar: 0, saludables: 0, pct: 0, children: [] };
      dNode.children.push(cNode);
    }
    cNode.skus++;
    cNode.ventaSoles += venta;
    cNode.criticos! += isCritico;
    cNode.altas! += isAlta;
    cNode.tickets! += tickets;
    cNode.paraComprar! += isComprar;
    cNode.saludables! += isSaludable;

    // 3. Get or create Subcat
    let scNode = cNode.children.find((sc) => sc.name === scName);
    if (!scNode) {
      scNode = { name: scName, skus: 0, ventaSoles: 0, criticos: 0, altas: 0, tickets: 0, paraComprar: 0, saludables: 0, pct: 0, children: [] };
      cNode.children.push(scNode);
    }
    scNode.skus++;
    scNode.ventaSoles += venta;
    scNode.criticos! += isCritico;
    scNode.altas! += isAlta;
    scNode.tickets! += tickets;
    scNode.paraComprar! += isComprar;
    scNode.saludables! += isSaludable;
  }

  // Calculate percentages based on totals
  const tree = Array.from(deptMap.values()).sort((a, b) => b.ventaSoles - a.ventaSoles);
  const totalVentas = tree.reduce((sum, d) => sum + d.ventaSoles, 0);

  const setPct = (node: TreeNode) => {
    node.pct = totalVentas > 0 ? (node.ventaSoles / totalVentas) * 100 : 0;
    node.children.sort((a, b) => b.ventaSoles - a.ventaSoles).forEach(setPct);
  };
  tree.forEach(setPct);

  return tree;
}
