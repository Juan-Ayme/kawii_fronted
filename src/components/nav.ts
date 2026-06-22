import {
  LayoutDashboard,
  Package,
  // Boxes,    // usado solo por enlace /stock (comentado)
  // Receipt,  // usado solo por enlace /ventas (comentado)
  // Table2,   // usado solo por enlace /matrices (comentado)
  LayoutGrid,
  FolderTree,
  Tags,
  ShieldCheck,
  RefreshCw,
  Activity,
  CalendarClock,
  Gauge,
  Settings,
  ShoppingCart,
  History,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Análisis",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/productos", label: "Productos", icon: Package },
      // ENLACES COMENTADOS (2026-06-20) — apuntan a páginas que no existen en src/app/.
      // Reactivar cuando se creen las páginas correspondientes.
      // { href: "/stock", label: "Stock", icon: Boxes },
      // { href: "/ventas", label: "Ventas", icon: Receipt },
      { href: "/ventas-jerarquicas", label: "Ventas & Catálogo", icon: LayoutGrid },
      // { href: "/matrices", label: "Matrices KAWII", icon: Table2 },
    ],
  },
  {
    title: "Reportes",
    items: [
      { href: "/reportes/tablero", label: "Tablero Semanal", icon: Gauge },
      { href: "/reportes/diario", label: "Reporte Diario", icon: CalendarClock },
      { href: "/compras-catalogo", label: "Compras & Catálogo", icon: ShoppingCart },
      { href: "/rotacion-historica", label: "Rotación Histórica", icon: History },
      { href: "/simulador", label: "Simulador Cascada", icon: Activity },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/taxonomia", label: "Taxonomía", icon: FolderTree },
      { href: "/product-types", label: "Product Types", icon: Tags },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/auditorias", label: "Auditorías", icon: ShieldCheck },
      { href: "/sync", label: "Sincronización", icon: RefreshCw },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
