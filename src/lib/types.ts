// Tipos de las respuestas de la API KAWII/HUDEC (FastAPI).
// Derivados de los routers del backend (app/routers/*, app/kawii_matrix/*).

// ---- Meta ----
export interface Health {
  status: string;
  db: string;
  db_version: string | null;
  app: string;
  version: string;
  productos_en_bd: number | null;
  timestamp: string;
}

// ---- Paginación genérica ----
export interface Paginated<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

// ---- Analytics ----
export interface Kpis {
  periodo_dias: number;
  ventas: number;
  tickets: number;
  tickets_con_monto: number;
  ticket_promedio: number;
  productos_total: number;
  productos_mapeados: number;
  variantes_total: number;
  stock_valorizado: number;
  sucursales: number;
}

export interface SalesByDay {
  dia: string;
  ventas: number;
  tickets: number;
  ticket_promedio: number | null;
}

// ---- Ticket Anatomy (descomposición del cambio en ventas) ----
// `decomposition_log_pct.tickets` + `unds_per_ticket` + `monto_per_und`
// suman EXACTAMENTE `decomposition_log_pct.total` (escala log).
// Útil para responder "¿la caída fue por tráfico, canasta o precio?".
export interface PeriodMetrics {
  from: string;            // YYYY-MM-DD inclusivo
  to: string;              // YYYY-MM-DD inclusivo
  ventas: number;
  tickets: number;
  unds: number;
  unds_per_ticket: number;
  monto_per_und: number;
  ticket_promedio: number;
  margen_pct: number;      // 0..100
  margen_monto: number;
  descuento_aplicado: number;
  lineas_regalo: number;
  monto_regalo: number;
  unds_regalo: number;
}

export interface TicketAnatomy {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  delta_pct: {
    ventas: number | null;
    tickets: number | null;
    unds: number | null;
    unds_per_ticket: number | null;
    monto_per_und: number | null;
    ticket_promedio: number | null;
    margen_pp: number | null;  // diferencia en puntos porcentuales (no %)
  };
  decomposition_log_pct: {
    tickets: number | null;
    unds_per_ticket: number | null;
    monto_per_und: number | null;
    total: number | null;
  };
  compare: "previous_period" | "previous_week" | "previous_year";
  days: number;
}

export interface SalesByDepartment {
  departamento: string;
  ventas: number;
  tickets: number;
  ticket_promedio_linea: number | null;
}

export interface SalesByCategory {
  departamento: string;
  categoria: string;
  ventas: number;
  tickets: number;
}

export interface SalesBySubcategory {
  departamento: string;
  categoria: string;
  subcategoria: string;
  ventas: number;
  tickets: number;
}

export interface SalesByOffice {
  sucursal: string;
  ventas: number;
  tickets: number;
}

export interface TopProduct {
  bsale_product_id: number;
  producto: string;
  ventas: number;
  unidades: number;
}

// ---- Simulador de cascada (debugger por SKU) ----
/** Métricas crudas del SKU para una sucursal; el frontend evalúa la cascada
 *  con estos números (espejo del SQL de matriz, sin formato display). */
export interface SkuDetailRow {
  sucursal: string;
  office_id: number;
  is_seasonal_dept: boolean;
  stock: { disponible: number; reservado: number; almacen_central: number };
  ventas_90d: {
    unds_vendidas: number;
    unds_vendidas_30d: number;
    dias_con_ventas: number;
    dias_sin_venta_90d: number | null;
    v_recent_45d: number;
    v_old_45d: number;
    vel_30d: number | null;
    dias_con_stock_30d: number;
    ultima_venta_90d: string | null;
  };
  lifetime: {
    unds_vendidas: number;
    ult_venta: string | null;
    unds_recibidas: number;
    primera_recepcion: string | null;
    unds_consumidas: number;
    unds_trasladadas: number;
    pct_sellthrough: number | null;
    edad_dias: number | null;
  };
  lote: {
    primera_recep_90d: string | null;
    ultima_recepcion: string | null;
    dias_desde_ultima_recep: number | null;
    ult_recep_qty: number;
    unds_post_recep: number;
    unds_recibidas_90d: number;
    unds_lote_total: number;
    dias_con_stock: number | null;
    dias_exhibido: number | null;
    dias_con_venta_lote: number;
    ult_venta_lote: string | null;
    pri_venta_lote: string | null;
    dias_absorcion_lote: number | null;
  };
  proyecciones: {
    ventas_dia: number | null;
    proy_mes: number | null;
    proy_30d_reciente: number | null;
    proy_post_recep: number | null;
    dias_cobertura: number | null;
    dias_cobertura_reciente: number | null;
    cob_post_recep: number | null;
    pct_frecuencia: number | null;
    tdpv: number;
    monto_vendido_90d: number;
  };
  categoria_baseline: { avg_proy_cat: number | null };
}

export interface SkuDetail {
  sku: string;
  product_name: string | null;
  department: string | null;
  category: string | null;
  subcategory: string | null;
  rows: SkuDetailRow[];
}

export interface SkuHistoryPoint {
  fecha: string;
  unds_vendidas: number;
  monto: number;
  unds_recibidas: number;
}

export interface SkuHistory {
  sku: string;
  days: number;
  office_id: number | null;
  points: SkuHistoryPoint[];
}

// ---- Tablero Semanal (5 KPIs de gerencia) ----
export interface Stockout {
  sucursal: string | null;
  office_id: number;
  sku: string | null;
  producto: string | null;
  departamento: string | null;
  categoria: string | null;
  stock_disponible: number;
  unds_vendidas_ventana: number;
  unds_vendidas_90d: number;
  ultima_venta: string | null;
  tenia_demanda: boolean;
}

export interface StockoutsResponse {
  total: number;
  con_demanda: number;
  sin_demanda: number;
  returned: number;
  demand_window_days: number;
  skus: Stockout[];
}

/** Fila de "venta acumulada vs meta" (global o por sucursal). */
export interface GoalRow {
  office_id: number | null;
  sucursal: string;
  venta_acumulada: number;
  meta: number | null;
  meta_prorrateada: number | null;
  avance_pct: number | null;
  cumplimiento_vs_ritmo_pct: number | null;
  proyeccion_cierre_mes: number | null;
}

export interface SalesVsGoal {
  month: string;
  meta_source: string;
  dias_transcurridos: number;
  dias_del_mes: number;
  mes_en_curso: boolean;
  global: GoalRow;
  por_sucursal: GoalRow[];
}

export interface WeeklyBoardKpis {
  ticket_promedio: number;
  transacciones: number;
  ventas: number;
  skus_en_quiebre: number;
  skus_en_quiebre_con_demanda: number;
  avance_meta_pct: number | null;
}

export interface WeeklyBoard {
  generado: string;
  periodo_dias: number;
  office_id: number | null;
  nota: string;
  kpi_resumen: WeeklyBoardKpis;
  ticket_promedio: { serie_diaria: { dia: string; ticket_promedio: number | null }[] };
  transacciones: { serie_diaria: { dia: string; tickets: number }[] };
  venta_por_categoria: (SalesByCategory & { participacion_pct: number })[];
  skus_en_quiebre: StockoutsResponse;
  venta_vs_meta: SalesVsGoal;
}

/** Metas configuradas: { "YYYY-MM": { "global": n, "<office_id>": n } }. */
export interface GoalsResponse {
  goals: Record<string, Record<string, number>>;
}

// ---- Productos ----
export interface ProductListItem {
  bsale_product_id: number;
  name: string;
  is_active: boolean | null;
  bsale_product_type_id: number | null;
  product_type_name: string | null;
  subcategory: string | null;
  category: string | null;
  department: string | null;
  has_override: boolean | null;
  skus: string | null;
  variantes_count: number;
}

export interface VariantDetail {
  bsale_variant_id: number;
  code: string | null;
  description: string | null;
  effective_cost: number | null;
  average_cost: number | null;
  latest_cost: number | null;
  cost_source: string | null;
}

export interface ProductStockByOffice {
  sucursal: string;
  unidades: number;
}

export interface ProductDetail {
  bsale_product_id: number;
  name: string;
  is_active: boolean | null;
  bsale_product_type_id: number | null;
  product_type_name: string | null;
  subcategory: string | null;
  category: string | null;
  department: string | null;
  has_override: boolean | null;
  variantes: VariantDetail[];
  stock_por_sucursal: ProductStockByOffice[];
}

export interface OrphanProduct {
  id: number;
  name: string;
  productos: number;
}

export interface ProductsSummary {
  total_productos: number;
  total_variantes: number;
  product_types_total: number;
  product_types_mapeados: number;
  product_types_sin_mapear: number;
  productos_con_override: number;
  productos_huerfanos: OrphanProduct[];
}

// ---- Stock ----
export interface StockLevel {
  bsale_variant_id: number;
  bsale_office_id: number;
  office_name: string | null;
  variant_code: string | null;
  product_name: string | null;
  quantity_available: number;
  quantity_reserved: number | null;
}

export interface StockValuationOffice {
  bsale_office_id: number;
  sucursal: string;
  valor_soles: number;
  unidades: number;
}

export interface StockValuation {
  total_soles: number;
  por_sucursal: StockValuationOffice[];
}

export interface StockTop {
  bsale_variant_id: number;
  code: string | null;
  producto: string;
  unidades: number;
}

export interface StockHistoryPoint {
  snapshot_date: string;
  sucursal: string;
  unidades: number;
}

// ---- Documentos ----
export interface DocumentListItem {
  bsale_document_id: number;
  serial_number: string | null;
  doc_number: string | null;
  emission_date: string | null;
  total_amount: number | null;
  bsale_office_id: number | null;
  office_name: string | null;
  document_type_name: string | null;
  is_credit_note: boolean | null;
}

export interface DocumentDetailLine {
  bsale_variant_id: number | null;
  code: string | null;
  producto: string | null;
  quantity: number;
  net_unit_value: number | null;
  total_amount: number | null;
}

export interface DocumentDetail extends Record<string, unknown> {
  bsale_document_id: number;
  document_type_name: string | null;
  office_name: string | null;
  emission_date: string | null;
  total_amount: number | null;
  detalles: DocumentDetailLine[];
}

export interface DocumentsSummaryType {
  tipo: string | null;
  cantidad: number;
}

export interface DocumentsSummary {
  total_documentos: number;
  total_detalles: number;
  mas_reciente: string | null;
  mas_antiguo: string | null;
  por_tipo: DocumentsSummaryType[];
}

// ---- Taxonomía ----
export interface Department {
  id: number;
  name: string;
  slug: string | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string | null;
  department_id: number;
  department_name?: string;
}

export interface Subcategory {
  id: number;
  name: string;
  slug: string | null;
  category_id: number;
  category_name?: string;
  department_name?: string;
}

export interface TreeSubcat {
  id: number;
  nombre: string;
  productos: number;
}
export interface TreeCat {
  id: number;
  subcategorias: TreeSubcat[];
}
export interface TreeDep {
  id: number;
  categorias: Record<string, TreeCat>;
}
export interface TaxonomyTree {
  arbol: Record<string, TreeDep>;
}

// ---- Product Types (BSale admin) ----
export interface ProductType {
  bsale_product_type_id: number;
  name: string;
  is_active: boolean;
  is_mapped: boolean;
  subcategory_id: number | null;
  synced_at: string | null;
  subcategory: string | null;
  category: string | null;
  category_id: number | null;
  department: string | null;
  department_id: number | null;
  productos: number;
  naming_ok: boolean;
}

export interface ProductTypesResponse {
  total: number;
  items: ProductType[];
}

// ---- Auditorías ----
export interface AuditSummary {
  naming_mismatches: number;
  orphan_product_types_with_products: number;
  inactive_but_mapped: number;
  subcategories_without_product_type: number;
  categories_without_subcategories: number;
  departments_without_categories: number;
  duplicate_product_type_names: number;
  products_without_classification: number;
}

/** Origen del problema dentro del sistema completo (BSale ↔ KAWII). */
export type IssueSource = "bsale" | "local_db" | "both";

/** Metadata por tipo de issue: dónde nace, qué significa, cómo se arregla. */
export interface IssueMeta {
  source: IssueSource;
  where: string;
  what: string;
  impact: string;
  fix_hint: string;
  fix_link: string | null;
  row_label: string;
}

export interface AuditResponse {
  ok: boolean;
  generated_at: string;
  severity: "ok" | "warning" | "critical";
  summary: AuditSummary;
  /** Conteo agregado por LADO del sistema con problemas. */
  side_counts?: { bsale: number; local_db: number; both: number };
  /** Metadata por tipo de issue (origen, descripción, fix). */
  meta?: Record<string, IssueMeta>;
  issues: Record<string, Array<Record<string, unknown>>>;
}

export interface FixNamingResponse {
  ok: boolean;
  operation: string;
  dry_run: boolean;
  timestamp: string;
  totals: { candidates: number; fixed: number; failed: number; skipped: number };
  fixed: Array<Record<string, unknown>>;
  failed: Array<Record<string, unknown>>;
  skipped: Array<Record<string, unknown>>;
  scope: string;
}

// ---- Sync ----
export interface SyncTask {
  task_id: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | string;
  params?: Record<string, unknown>;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  returncode?: number;
  error?: string;
  report_path?: string | null;
}

export interface SyncTriggerResponse {
  ok: boolean;
  message: string;
  task_id: string;
}

export interface SyncLogEntry {
  id: number;
  entity: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  records_fetched: number | null;
  records_inserted: number | null;
  records_updated: number | null;
  records_skipped: number | null;
  error_message: string | null;
  duracion_s: number | null;
}

export interface DataQualityIssue {
  id: number;
  entity: string;
  bsale_id: number | null;
  field: string | null;
  issue_type: string;
  description: string | null;
  created_at: string;
}

// ---- Matrices KAWII ----
export interface MatrixModule {
  id: string;
  name: string;
  description: string;
  endpoint: string;
}

export interface MatrixResponse {
  module: string;
  total: number;
  limit: number | null;
  offset: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface CategoryCount {
  label: string;
  count: number;
}

export interface DistributionResponse {
  module: string;
  label_column: string;
  sucursal_filter: string | null;
  total_skus: number;
  categories: CategoryCount[];
}

export interface TransferResponse {
  module: string;
  total: number;
  transfers: Array<Record<string, unknown>>;
}

export interface ActionGroupsSummary {
  urgente_comprar: number;
  reponer: number;
  saludable: number;
  exceso: number;
  liquidar: number;
  descatalogar: number;
  evaluar: number;
  otro: number;
}

export interface ActionGroupsResponse {
  module: string;
  label_column: string;
  summary: ActionGroupsSummary;
  groups: Record<string, Array<Record<string, unknown>>>;
}

export interface BranchStats {
  total_skus: number;
  urgente: number;
  reponer: number;
  saludable: number;
  descatalogar: number;
  exceso: number;
}

export interface MatrixSummaryResponse {
  total_skus: number;
  by_branch: Record<string, BranchStats>;
  transfers_sugeridas: number;
  tendencia_creciendo: number;
  tendencia_decayendo: number;
}

// ---- Compras & Catálogo (Dashboard de Compras Inteligente) ----
// Endpoint: GET /analytics/compras-catalogo?office_id=<id>
// Mismo universo de SKUs que el Excel `/analytics/compras-catalogo/excel`:
// matriz 04b filtrada a severidades 🔴 Crítico y 🟠 Alta (quiebres reales).
// Enriquecido con margen (variant_costs) y cantidad sugerida a ordenar.
export interface ComprasCatalogoKpis {
  skus_criticos_total: number;
  skus_critico: number;       // severidad 🔴 Crítico
  skus_alta: number;          // severidad 🟠 Alta
  venta_90d_en_riesgo: number;
  unidades_a_reponer: number;
  margen_promedio_pct: number | null;
}

export interface ComprasCatalogoDept {
  departamento: string;
  skus_total: number;
  skus_critico: number;
  skus_alta: number;
  venta_soles: number;
  unidades_reponer: number;
  participacion_pct: number;
}

export interface ComprasCatalogoAccion {
  accion: string;             // "REPONER YA", "COMPRAR YA", "PROMOCIONAR", …
  skus: number;
}

export interface ComprasCatalogoSku {
  sku: string;
  producto: string;
  sucursal: string;
  departamento: string | null;
  categoria: string | null;
  subcategoria: string | null;
  clasificacion: string;      // texto completo de la cascada (con emoji)
  severidad: string;          // "🔴 Crítico" | "🟠 Alta"
  accion: string;             // bucket accionable
  causal: string;             // resumen del "por qué" en una palabra
  stock_disponible: number;
  stock_almacen: number;
  velocidad_30d: number;
  velocidad_90d: number;
  unds_vend_90d: number;
  vendido_sku_soles: number;
  cobertura_dias: string | number | null;
  dias_sin_vender: string | number | null;
  proyeccion_30d: number;
  ultima_venta: string | null;
  tendencia: string | null;
  cantidad_sugerida: number;
  margen_pct: number | null;
  margen_soles: number | null;
  costo_soles: number | null;
}

export interface ComprasCatalogoResponse {
  generado_at: string;
  office_id: number | null;
  sucursal: string | null;
  cobertura_objetivo_dias: number;
  kpis: ComprasCatalogoKpis;
  por_departamento: ComprasCatalogoDept[];
  por_accion: ComprasCatalogoAccion[];
  skus: ComprasCatalogoSku[];
}

// ---- Rotación Histórica (Ventana arbitraria, ej. "Año 2024") ----
// Endpoint: GET /analytics/rotacion-historica?from&to&office_id
// SQL: 04h_rotacion_historica.sql (variante PARAMETRIZABLE del 04b).
// La clasificación NO usa la cascada de 38 reglas (depende del presente);
// usa Pareto ABC + frecuencia + tendencia intra-ventana.
export interface RotacionHistoricaMeta {
  from: string;          // YYYY-MM-DD
  to: string;            // YYYY-MM-DD
  dias_ventana: number;
  office_id: number | null;
  sucursal: string | null;
  generado_at: string;
}

export interface RotacionHistoricaKpis {
  skus_con_venta: number;
  unds_vendidas: number;
  venta_soles: number;
  skus_pareto_a: number;
  skus_pareto_b: number;
  skus_pareto_c: number;
}

export interface RotacionHistoricaDept {
  departamento: string;
  skus_total: number;
  skus_pareto_a: number;
  venta_soles: number;
  unds_vendidas: number;
  participacion_pct: number;
}

export interface RotacionHistoricaPareto {
  pareto: "A" | "B" | "C";
  skus: number;
  etiqueta: string;
}

export interface RotacionHistoricaClasif {
  clasificacion: string;
  skus: number;
}

export interface RotacionHistoricaSku {
  sku: string;
  producto: string;
  sucursal: string;
  departamento: string | null;
  categoria: string | null;
  subcategoria: string | null;
  unds_vendidas: number;
  vendido_sku_soles: number;
  vendido_subcat_soles: number;
  vendido_cat_soles: number;
  vendido_depto_soles: number;
  pct_en_subcat: number;
  pct_en_cat: number;
  pct_en_depto: number;
  velocidad_uds_dia: number;
  dias_con_venta: number;
  pct_frecuencia: number;
  tendencia: string | null;
  unds_primera_mitad: number;
  unds_segunda_mitad: number;
  rank_sucursal: number;
  pct_acum: number;
  pareto: "A" | "B" | "C";
  clasificacion: string;
  primera_venta: string | null;
  ultima_venta: string | null;
}

export interface RotacionHistoricaResponse {
  meta: RotacionHistoricaMeta;
  kpis: RotacionHistoricaKpis;
  por_departamento: RotacionHistoricaDept[];
  por_pareto: RotacionHistoricaPareto[];
  por_clasificacion: RotacionHistoricaClasif[];
  skus: RotacionHistoricaSku[];
}
