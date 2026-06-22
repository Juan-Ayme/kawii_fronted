// Cliente HTTP tipado para la API KAWII/HUDEC.
import type {
  ActionGroupsResponse,
  AuditResponse,
  Category,
  ComprasCatalogoResponse,
  DataQualityIssue,
  Department,
  RotacionHistoricaResponse,
  // DistributionResponse,     // usado solo por getMatrixDistribution (comentado)
  // DocumentDetail,           // usado solo por getDocument (comentado)
  // DocumentListItem,         // usado solo por getDocuments (comentado)
  // DocumentsSummary,         // usado solo por getDocumentsSummary (comentado)
  FixNamingResponse,
  Health,
  Kpis,
  MatrixModule,
  MatrixResponse,
  // MatrixSummaryResponse,    // usado solo por getMatrixSummary (comentado)
  Paginated,
  ProductDetail,
  ProductListItem,
  ProductsSummary,
  ProductType,
  ProductTypesResponse,
  SalesByCategory,
  SalesByDay,
  SalesByDepartment,
  SalesVsGoal,
  SkuDetail,
  SkuHistory,
  StockoutsResponse,
  GoalsResponse,
  WeeklyBoard,
  TicketAnatomy,
  SalesByOffice,
  // SalesBySubcategory,       // usado solo por getSalesBySubcategory (comentado)
  // StockHistoryPoint,        // usado solo por getStockHistory (comentado)
  // StockLevel,               // usado solo por getStockLevels (comentado)
  // StockTop,                 // usado solo por getStockTop (comentado)
  StockValuation,
  Subcategory,
  SyncLogEntry,
  SyncTask,
  SyncTriggerResponse,
  TaxonomyTree,
  TopProduct,
  // TransferResponse,         // usado solo por getMatrixTransfers (comentado)
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildQuery(params?: Query): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

interface RequestOptions {
  method?: string;
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, signal } = opts;
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      // ★ Auth: el backend usa cookies httpOnly. `credentials: 'include'`
      //   manda esa cookie en cada request a la API y permite que el
      //   backend setee la cookie de sesión en /auth/login. Requiere CORS
      //   con `allow_credentials=True` (ya está en app/main.py).
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      `No se pudo conectar con la API (${API_BASE_URL}). ¿Está corriendo el backend?`,
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: unknown; error?: unknown })?.detail ??
      (data as { error?: unknown })?.error ??
      data;
    const msg =
      typeof detail === "string"
        ? detail
        : `Error ${res.status} en ${path}`;
    throw new ApiError(res.status, msg, detail);
  }

  return data as T;
}

// ───────────────────────── Meta ─────────────────────────
export const getHealth = (signal?: AbortSignal) =>
  request<Health>("/health", { signal });

// ──────────────────── Config (runtime) ──────────────────
export interface ExclusionsResponse {
  excluded_departments: number[];
  excluded_categories: number[];
  seasonal_departments: number[];
  departments: { id: number; name: string; excluded: boolean; seasonal: boolean }[];
}

export const getExclusions = (signal?: AbortSignal) =>
  request<ExclusionsResponse>("/config/exclusions", { signal });

export const setExclusions = (body: {
  excluded_departments: number[];
  excluded_categories: number[];
  seasonal_departments: number[];
}) =>
  request<Record<string, unknown>>("/config/exclusions", {
    method: "PUT",
    body,
  });

// Umbrales de clasificación (ventanas, tendencia, XYZ, velocidad, cobertura, …).
// El backend devuelve los valores vigentes + los defaults + la metadata de
// secciones para que el frontend renderice el form sin duplicar la lista.
export interface ThresholdField {
  key: string;
  label: string;
  help: string;
}
export interface ThresholdSection {
  key: string;
  title: string;
  description: string;
  fields: ThresholdField[];
}
export interface ThresholdsResponse {
  thresholds: Record<string, number>;
  defaults: Record<string, number>;
  sections: ThresholdSection[];
}

export const getThresholds = (signal?: AbortSignal) =>
  request<ThresholdsResponse>("/config/thresholds", { signal });

export const setThresholds = (thresholds: Record<string, number>) =>
  request<Record<string, unknown>>("/config/thresholds", {
    method: "PUT",
    body: { thresholds },
  });

// Configuración por empresa (marca + IDs operativos de BSale).
// El endpoint devuelve los valores, los defaults, la metadata de form y los
// catálogos BSale (offices/document_types/users/categories) para que la UI
// muestre nombres en vez de IDs crudos en los multi-selects.
export type CompanyFieldKind =
  | "text"
  | "single_office"
  | "multi_office"
  | "multi_document_type"
  | "multi_user"
  | "multi_category";

export interface CompanyField {
  key: string;
  label: string;
  kind: CompanyFieldKind;
  help: string;
}
export interface CompanySection {
  key: string;
  title: string;
  description: string;
  fields: CompanyField[];
}
export interface CompanyValues {
  brand_name: string;
  classification_label: string;
  offices_tienda: number[];
  office_almacen: number | null;
  tipos_venta: number[];
  tipos_devolucion: number[];
  tipos_traslado: number[];
  bsale_warehouse_user_ids: number[];
  target_categories: number[];
}
export interface BsaleOffice {
  id: number;
  name: string;
  is_active: boolean;
}
export interface BsaleDocumentType {
  id: number;
  name: string;
  code: string | null;
  is_credit_note: boolean;
  is_sales_note: boolean;
}
export interface BsaleUser {
  id: number;
  name: string;
  email: string | null;
  is_active: boolean;
}
export interface BsaleCategory {
  id: number;
  name: string;
  department_name: string;
}
export interface CompanyCatalogs {
  offices: BsaleOffice[];
  document_types: BsaleDocumentType[];
  users: BsaleUser[];
  categories: BsaleCategory[];
}
export interface CompanyResponse {
  company: CompanyValues;
  defaults: CompanyValues;
  sections: CompanySection[];
  catalogs: CompanyCatalogs;
}

export const getCompany = (signal?: AbortSignal) =>
  request<CompanyResponse>("/config/company", { signal });

export const setCompany = (company: Partial<CompanyValues>) =>
  request<Record<string, unknown>>("/config/company", {
    method: "PUT",
    body: { company },
  });

// Sugerencias inferidas analizando la DB (movimientos, taxonomía, usuarios).
// Devuelve valores PRE-cargados que el usuario revisa antes de guardar.
export interface CompanyRecommendations {
  recommendations: CompanyValues;
  notes: string[];
}
export const getCompanyRecommendations = (signal?: AbortSignal) =>
  request<CompanyRecommendations>("/config/company/recommendations", { signal });

// ─────────────── Respaldos (app_config_history) ───────────────
// Cada PUT a /config/* guarda un snapshot automático del valor anterior.
// Estos endpoints permiten ver el historial, hacer snapshots manuales con
// etiqueta, restaurar a un punto previo, y exportar/importar JSON completo.

export interface ConfigBackup {
  id: number;
  config_key: string;
  value_preview: string | null;
  has_value: boolean;
  changed_at: string;
  label: string | null;
  source: string | null;
  is_manual: boolean;
}

export interface BackupsResponse {
  total: number;
  backups: ConfigBackup[];
}

export const getBackups = (
  config_key?: string | null,
  signal?: AbortSignal,
) =>
  request<BackupsResponse>("/config/backups", {
    query: { config_key: config_key ?? undefined, limit: 200 },
    signal,
  });

export const createManualSnapshot = (label: string, keys?: string[]) =>
  request<Record<string, unknown>>("/config/backups", {
    method: "POST",
    body: { label, keys: keys ?? null },
  });

export const restoreBackup = (id: number) =>
  request<Record<string, unknown>>(`/config/backups/${id}/restore`, {
    method: "POST",
    body: {},
  });

export const deleteBackup = (id: number) =>
  request<Record<string, unknown>>(`/config/backups/${id}`, {
    method: "DELETE",
  });

export interface ExportResponse {
  exported_at: string;
  keys: string[];
  config: Record<string, unknown>;
}

export const exportConfig = (signal?: AbortSignal) =>
  request<ExportResponse>("/config/export", { signal });

export const importConfig = (
  config: Record<string, unknown>,
  label?: string,
) =>
  request<Record<string, unknown>>("/config/import", {
    method: "POST",
    body: { config, label: label ?? null },
  });

// ─────────────────────── Auth ───────────────────────
export type UserRole = "admin" | "operador" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthUserDetailed extends AuthUser {
  created_at: string;
  last_login_at: string | null;
}

export const login = (username: string, password: string) =>
  request<{ ok: boolean; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: { username, password },
  });

export const logout = () =>
  request<{ ok: boolean }>("/auth/logout", { method: "POST", body: {} });

export const getMe = (signal?: AbortSignal) =>
  request<AuthUser>("/auth/me", { signal });

export const listUsers = (signal?: AbortSignal) =>
  request<{ total: number; users: AuthUserDetailed[] }>("/auth/users", { signal });

export const createUser = (body: {
  username: string;
  password: string;
  role: UserRole;
}) =>
  request<{ ok: boolean; id: number; username: string; role: UserRole }>(
    "/auth/users",
    { method: "POST", body },
  );

export const updateUser = (
  id: number,
  body: { role?: UserRole; is_active?: boolean; password?: string },
) =>
  request<{ ok: boolean; id: number }>(`/auth/users/${id}`, {
    method: "PATCH",
    body,
  });

export const deleteUser = (id: number) =>
  request<{ ok: boolean; deleted_id: number }>(`/auth/users/${id}`, {
    method: "DELETE",
  });

// La API serializa columnas NUMERIC de PostgreSQL como string ("37028.63").
// Estos helpers las devuelven como número real para que `ventas + ventas` sume
// en vez de concatenar y los tipos `number` declarados sean ciertos en runtime.
const toNum = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toNumOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ─────────────────────── Analytics ──────────────────────
// `office_id` opcional en endpoints de analytics: si se pasa, el backend filtra
// por esa sucursal; si no, devuelve el consolidado de las tiendas activas.
export const getKpis = (
  days: number,
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<Kpis>("/analytics/kpis", {
    query: { days, office_id: office_id ?? undefined },
    signal,
  });

export const getSalesByDay = (
  days: number,
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<SalesByDay[]>("/analytics/sales-by-day", {
    query: { days, office_id: office_id ?? undefined },
    signal,
  });

/**
 * Anatomía del cambio: descompone Δventas en (Δtickets × Δunds/ticket × Δ$/und).
 * Útil para diagnosticar si la caída/subida es por tráfico, canasta o precio.
 *
 * El backend excluye el día de HOY (parcial) del período "current".
 */
export const getTicketAnatomy = (
  days: number,
  compare: "previous_period" | "previous_week" | "previous_year" = "previous_period",
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<TicketAnatomy>("/analytics/ticket-anatomy", {
    query: { days, compare, office_id: office_id ?? undefined },
    signal,
  });

export const getSalesByDepartment = (
  days: number,
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<SalesByDepartment[]>("/analytics/sales-by-department", {
    query: { days, office_id: office_id ?? undefined },
    signal,
  }).then((rows) =>
    rows.map((r) => ({
      ...r,
      ventas: toNum(r.ventas),
      ticket_promedio_linea: toNumOrNull(r.ticket_promedio_linea),
    })),
  );

export const getSalesByCategory = (
  days: number,
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<SalesByCategory[]>("/analytics/sales-by-category", {
    query: { days, office_id: office_id ?? undefined },
    signal,
  }).then((rows) => rows.map((r) => ({ ...r, ventas: toNum(r.ventas) })));

// FUNCIÓN COMENTADA (2026-06-20) — no importada por ninguna página.
// El endpoint backend /analytics/sales-by-subcategory también está comentado.
// export const getSalesBySubcategory = (
//   days: number,
//   signal?: AbortSignal,
//   office_id?: number | null,
// ) =>
//   request<SalesBySubcategory[]>("/analytics/sales-by-subcategory", {
//     query: { days, office_id: office_id ?? undefined },
//     signal,
//   }).then((rows) => rows.map((r) => ({ ...r, ventas: toNum(r.ventas) })));

export const getSalesByOffice = (days: number, signal?: AbortSignal) =>
  request<SalesByOffice[]>("/analytics/sales-by-office", {
    query: { days },
    signal,
  });

export const getTopProducts = (
  days: number,
  limit = 20,
  signal?: AbortSignal,
  office_id?: number | null,
) =>
  request<TopProduct[]>("/analytics/top-products", {
    query: { days, limit, office_id: office_id ?? undefined },
    signal,
  });

// ─────────────── Tablero Semanal (5 KPIs de gerencia) ───────────────
/** SKUs en quiebre (stock disponible = 0), con marca de demanda (venta perdida). */
export const getStockouts = (
  params: { office_id?: number | null; demand_window_days?: number; limit?: number } = {},
  signal?: AbortSignal,
) =>
  request<StockoutsResponse>("/analytics/stockouts", {
    query: {
      office_id: params.office_id ?? undefined,
      demand_window_days: params.demand_window_days,
      limit: params.limit,
    },
    signal,
  });

/** Venta acumulada del mes vs meta (manual). `month` = "YYYY-MM" (default: mes en curso). */
export const getSalesVsGoal = (
  month?: string | null,
  office_id?: number | null,
  signal?: AbortSignal,
) =>
  request<SalesVsGoal>("/analytics/sales-vs-goal", {
    query: { month: month ?? undefined, office_id: office_id ?? undefined },
    signal,
  });

/** Tablero consolidado: los 5 KPIs en un solo payload. */
export const getWeeklyBoard = (
  days: number,
  office_id?: number | null,
  month?: string | null,
  signal?: AbortSignal,
) =>
  request<WeeklyBoard>("/analytics/weekly-board", {
    query: { days, office_id: office_id ?? undefined, month: month ?? undefined },
    signal,
  });

/** Metas de venta configuradas (manual), keyed por mes. */
export const getGoals = (signal?: AbortSignal) =>
  request<GoalsResponse>("/analytics/goals", { signal });

/** Carga/actualiza la meta de un mes. */
export const setGoals = (body: {
  month: string;
  meta_global?: number | null;
  offices: Record<string, number>;
}) =>
  request<Record<string, unknown>>("/analytics/goals", { method: "PUT", body });

// ─────────── Simulador de Cascada (debugger por SKU) ───────────
/** Métricas crudas del SKU por sucursal (alimentan la cascada TS). */
export const getSkuDetail = (sku: string, signal?: AbortSignal) =>
  request<SkuDetail>(`/matrix-sim/sku-detail/${encodeURIComponent(sku)}`, { signal });

/** Serie temporal diaria del SKU (ventas + recepciones) para el gráfico. */
export const getSkuHistory = (
  sku: string,
  days = 180,
  office_id?: number | null,
  signal?: AbortSignal,
) =>
  request<SkuHistory>(`/matrix-sim/sku-history/${encodeURIComponent(sku)}`, {
    query: { days, office_id: office_id ?? undefined },
    signal,
  });

/** URL para descargar el Informe Diario (mes en curso, 3 pestañas). */
export function dailyReportExcelUrl(
  params: { office_id?: number | null } = {},
): string {
  const sp = new URLSearchParams();
  if (params.office_id != null) sp.set("office_id", String(params.office_id));
  const qs = sp.toString();
  return `${API_BASE_URL}/analytics/daily-report/excel${qs ? `?${qs}` : ""}`;
}

/** URL para descargar Compras & Catálogo (2 pestañas: quiebres reales + venta por categoría). */
export function comprasCatalogoExcelUrl(
  params: { days?: number; office_id?: number | null } = {},
): string {
  const sp = new URLSearchParams();
  if (params.days) sp.set("days", String(params.days));
  if (params.office_id != null) sp.set("office_id", String(params.office_id));
  const qs = sp.toString();
  return `${API_BASE_URL}/analytics/compras-catalogo/excel${qs ? `?${qs}` : ""}`;
}

/** Dashboard de Compras Inteligente — KPIs + distribución + lista de SKUs en quiebre real.
 *  Mismo universo que el Excel, en JSON. Alimenta la página /compras-catalogo. */
export const getComprasCatalogo = (
  office_id?: number | null,
  signal?: AbortSignal,
) =>
  request<ComprasCatalogoResponse>("/analytics/compras-catalogo", {
    query: { office_id: office_id ?? undefined },
    signal,
  });

// ─────────────────── Decisiones de compra ──────────────────
// Persiste lo que el usuario elige en el modal de Compras & Catálogo
// (Ordenar / Comprar similar / Posponer / Ignorar). Cada decisión se apila
// al historial; la "vigente" es la más reciente por (SKU, sucursal).
export type PurchaseDecisionKind =
  | "ordenar"
  | "comprar_similar"
  | "posponer"
  | "ignorar";

export interface PurchaseDecision {
  id: number;
  bsale_variant_id: number;
  bsale_office_id: number;
  decision: PurchaseDecisionKind;
  quantity: number | null;
  notes: string | null;
  classification_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface PurchaseDecisionHistory {
  current: PurchaseDecision | null;
  history: PurchaseDecision[];
}

export interface CreatePurchaseDecisionBody {
  // Pasar al menos uno: bsale_variant_id (FK real) o sku (display_code).
  bsale_variant_id?: number;
  sku?: string;
  bsale_office_id: number;
  decision: PurchaseDecisionKind;
  quantity?: number | null;
  notes?: string | null;
  classification_snapshot?: Record<string, unknown> | null;
}

export const createPurchaseDecision = (body: CreatePurchaseDecisionBody) =>
  request<{ ok: boolean; id: number; bsale_variant_id: number; created_at: string }>(
    "/purchases/decisions",
    { method: "POST", body },
  );

export const getPurchaseDecisionsBySku = (
  sku: string,
  office_id?: number | null,
  signal?: AbortSignal,
) =>
  request<PurchaseDecisionHistory>(
    `/purchases/decisions/by-sku/${encodeURIComponent(sku)}`,
    { query: { office_id: office_id ?? undefined }, signal },
  );

/** Rotación histórica — productos que vendieron en una ventana arbitraria.
 *  `from`/`to` en formato "YYYY-MM-DD" (inclusivos). Alimenta /rotacion-historica. */
export const getRotacionHistorica = (
  fromIso: string,
  toIso: string,
  office_id?: number | null,
  signal?: AbortSignal,
) =>
  request<RotacionHistoricaResponse>("/analytics/rotacion-historica", {
    query: { from: fromIso, to: toIso, office_id: office_id ?? undefined },
    signal,
  });

// ─────────────────────── Productos ──────────────────────
export interface ProductFilters {
  q?: string;
  department?: string;
  category?: string;
  subcategory?: string;
  mapped_only?: boolean;
  override_only?: boolean;
  unmapped_only?: boolean;
  product_type_id?: number;
  limit?: number;
  offset?: number;
}

export const getProducts = (filters: ProductFilters, signal?: AbortSignal) =>
  request<Paginated<ProductListItem>>("/products", {
    query: filters as Query,
    signal,
  });

export const getProduct = (id: number, signal?: AbortSignal) =>
  request<ProductDetail>(`/products/${id}`, { signal });

export const setProductSubcategory = (
  id: number,
  subcategory_id: number | null,
) =>
  request<Record<string, unknown>>(`/products/${id}/subcategory`, {
    method: "PATCH",
    query: subcategory_id === null ? {} : { subcategory_id },
  });

export const getProductsSummary = (signal?: AbortSignal) =>
  request<ProductsSummary>("/products/stats/summary", { signal });

// ───────────────────────── Stock ────────────────────────
// Único endpoint vivo tras el cleanup: lo usa el Dashboard (DonutChart) Y el
// selector global de sucursal (`sucursal-context.tsx`). El endpoint se movió
// de /stock/valuation a /analytics/stock-valuation; el shape es idéntico.
export const getStockValuation = (signal?: AbortSignal) =>
  request<StockValuation>("/stock/valuation", { signal });

// FUNCIONES COMENTADAS (2026-06-20) — no importadas por ninguna página.
// Sus endpoints backend (/stock/levels, /stock/top, /stock/history) también
// están comentados. Se preservan para reactivar fácilmente.
// export const getStockLevels = (
//   params: { office_id?: number; only_with_stock?: boolean; limit?: number },
//   signal?: AbortSignal,
// ) => request<StockLevel[]>("/stock/levels", { query: params, signal });
//
// export const getStockTop = (limit = 20, signal?: AbortSignal) =>
//   request<StockTop[]>("/stock/top", { query: { limit }, signal });
//
// export const getStockHistory = (
//   days: number,
//   variant_id?: number,
//   signal?: AbortSignal,
// ) =>
//   request<StockHistoryPoint[]>("/stock/history", {
//     query: { days, variant_id },
//     signal,
//   });

// ─────────────────────── Documentos ─────────────────────
// FUNCIONES COMENTADAS (2026-06-20) — el router /documents completo está
// comentado en el backend (ningún endpoint se consumía).
// export interface DocumentFilters {
//   date_from?: string;
//   date_to?: string;
//   document_type_id?: number;
//   office_id?: number;
//   limit?: number;
//   offset?: number;
// }
//
// export const getDocuments = (filters: DocumentFilters, signal?: AbortSignal) =>
//   request<Paginated<DocumentListItem>>("/documents", {
//     query: filters as Query,
//     signal,
//   });
//
// export const getDocument = (id: number, signal?: AbortSignal) =>
//   request<DocumentDetail>(`/documents/${id}`, { signal });
//
// export const getDocumentsSummary = (signal?: AbortSignal) =>
//   request<DocumentsSummary>("/documents/stats/summary", { signal });

// ─────────────────────── Matrices ──────────────────────
export interface MatrixFilters {
  sucursal?: string;
  departamento?: string;
  categoria?: string;
  subcategoria?: string;
  sku?: string;
  clasificacion_contains?: string;
  nivel?: string;
  /** Filtro por ACCIÓN de negocio (buckets coma-separados) — solo para el Excel. */
  accion?: string;
  solo_actividad_90d?: boolean;
  limit?: number;
  offset?: number;
}

export const getMatrixModules = (signal?: AbortSignal) =>
  request<{ modules: MatrixModule[]; endpoints_especiales: Record<string, string> }>(
    "/matrix/",
    { signal },
  );

export const getMatrix = (
  moduleId: string,
  filters: MatrixFilters,
  signal?: AbortSignal,
) =>
  request<MatrixResponse>(`/matrix/${moduleId}`, {
    query: filters as Query,
    signal,
  });

// FUNCIONES COMENTADAS (2026-06-20) — no importadas por ninguna página.
// Sus endpoints backend también están comentados.
// export const getMatrixDistribution = (
//   moduleId: string,
//   sucursal?: string,
//   signal?: AbortSignal,
// ) =>
//   request<DistributionResponse>(`/matrix/${moduleId}/distribution`, {
//     query: { sucursal },
//     signal,
//   });
//
// export const getMatrixTransfers = (moduleId: string, signal?: AbortSignal) =>
//   request<TransferResponse>(`/matrix/${moduleId}/transfers`, { signal });
//
// export const getMatrixSummary = (signal?: AbortSignal) =>
//   request<MatrixSummaryResponse>("/matrix/_/summary", { signal });

export function matrixExcelUrl(
  moduleId: string,
  filters: Partial<MatrixFilters> = {},
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return `${API_BASE_URL}/matrix/${moduleId}/excel${qs ? `?${qs}` : ""}`;
}

// ─────────────────────── Taxonomía ──────────────────────
export const getTaxonomyTree = (signal?: AbortSignal) =>
  request<TaxonomyTree>("/taxonomy/tree", { signal });

export const getDepartments = (signal?: AbortSignal) =>
  request<Department[]>("/taxonomy/departments", { signal });

export const getCategories = (department_id?: number, signal?: AbortSignal) =>
  request<Category[]>("/taxonomy/categories", {
    query: { department_id },
    signal,
  });

export const getSubcategories = (category_id?: number, signal?: AbortSignal) =>
  request<Subcategory[]>("/taxonomy/subcategories", {
    query: { category_id },
    signal,
  });

// taxonomy-admin (mutaciones)
export const createDepartment = (name: string) =>
  request("/taxonomy/departments", { method: "POST", body: { name } });
export const renameDepartment = (id: number, name: string) =>
  request(`/taxonomy/departments/${id}`, { method: "PATCH", body: { name } });
export const deleteDepartment = (id: number, force = false) =>
  request(`/taxonomy/departments/${id}`, { method: "DELETE", query: { force } });

export const createCategory = (department_id: number, name: string) =>
  request("/taxonomy/categories", {
    method: "POST",
    body: { department_id, name },
  });
export const renameCategory = (id: number, name: string) =>
  request(`/taxonomy/categories/${id}`, { method: "PATCH", body: { name } });
export const deleteCategory = (id: number, force = false) =>
  request(`/taxonomy/categories/${id}`, { method: "DELETE", query: { force } });

export const createSubcategory = (category_id: number, name: string) =>
  request("/taxonomy/subcategories", {
    method: "POST",
    body: { category_id, name },
  });
export const renameSubcategory = (id: number, name: string) =>
  request(`/taxonomy/subcategories/${id}`, { method: "PATCH", body: { name } });
export const deleteSubcategory = (id: number, force = false) =>
  request(`/taxonomy/subcategories/${id}`, {
    method: "DELETE",
    query: { force },
  });

// FUNCIÓN COMENTADA (2026-06-20) — no importada por ninguna página.
// El endpoint backend /taxonomy/categories/empty/audit también está comentado.
// export const auditEmptyCategories = (signal?: AbortSignal) =>
//   request<Record<string, unknown>>("/taxonomy/categories/empty/audit", {
//     signal,
//   });

// ───────────────── Product Types (BSale) ────────────────
export interface ProductTypeFilters {
  q?: string;
  only_unmapped?: boolean;
  only_inactive?: boolean;
  limit?: number;
}

export const getProductTypes = (
  filters: ProductTypeFilters,
  signal?: AbortSignal,
) =>
  request<ProductTypesResponse>("/bsale/product-types", {
    query: filters as Query,
    signal,
  });

export const createProductType = (name: string, subcategory_id: number | null) =>
  request("/bsale/product-types", {
    method: "POST",
    body: { name, subcategory_id },
  });

export const updateProductType = (
  id: number,
  body: { name?: string; subcategory_id?: number | null },
  unmap = false,
) =>
  request<{ entity: ProductType }>(`/bsale/product-types/${id}`, {
    method: "PATCH",
    body,
    query: { unmap },
  });

export const deleteProductType = (id: number, force = false) =>
  request(`/bsale/product-types/${id}`, { method: "DELETE", query: { force } });

export const resyncProductType = (id: number) =>
  request(`/bsale/product-types/${id}/resync`, { method: "POST" });

// ─────────────────────── Auditorías ─────────────────────
export const getAudits = (signal?: AbortSignal) =>
  request<AuditResponse>("/audits", { signal });

export const fixNaming = (ids: number[] | null, dry_run: boolean) =>
  request<FixNamingResponse>("/audits/fix-naming", {
    method: "POST",
    body: { ids, dry_run },
  });

export const getOrphansWithoutProducts = (signal?: AbortSignal) =>
  request<Array<{ id: number; name: string; is_active: boolean }>>(
    "/audits/orphans-without-products",
    { signal },
  );

// ───────────────────────── Sync ─────────────────────────
export const triggerIncremental = () =>
  request<Record<string, unknown>>("/sync/incremental", { method: "POST" });

export const triggerFullSync = (body: {
  days: number;
  skip_documents: boolean;
  skip_stock_snapshot: boolean;
}) => request<SyncTriggerResponse>("/sync/run", { method: "POST", body });

export const getSyncTasks = (signal?: AbortSignal) =>
  request<SyncTask[]>("/sync/tasks", { signal });

// FUNCIÓN COMENTADA (2026-06-20) — no importada por ninguna página.
// El endpoint backend /sync/tasks/{id} también está comentado.
// La función getSyncTasks (lista completa) sí se sigue usando.
// export const getSyncTask = (id: string, signal?: AbortSignal) =>
//   request<SyncTask>(`/sync/tasks/${id}`, { signal });

export const getSyncLog = (limit = 30, signal?: AbortSignal) =>
  request<SyncLogEntry[]>("/sync/log", { query: { limit }, signal });

export const getDataQuality = (limit = 100, signal?: AbortSignal) =>
  request<DataQualityIssue[]>("/sync/data-quality", {
    query: { limit },
    signal,
  });

// ── action-groups (lo usan /reportes/tablero y /reportes/diario, ver bloque Matrices arriba) ──
export const getMatrixActionGroups = (moduleId: string, signal?: AbortSignal) =>
  request<ActionGroupsResponse>(`/matrix/${moduleId}/action-groups`, { signal });

