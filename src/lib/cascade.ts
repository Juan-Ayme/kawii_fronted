/*
 * Cascada de clasificación KAWII portada del SQL a TypeScript.
 *
 * Espejo EXACTO de las 38 reglas WHEN…THEN del CASE en
 *   app/kawii_matrix/sql/_matriz_90d_base.sql (líneas ~750–1140)
 *
 * Cada regla declara su sección (A-F), su label/acción y una función pura
 * evaluate(metrics, thresholds) que retorna las condiciones evaluadas con
 * pass/fail para que el simulador muestre exactamente qué pasó.
 *
 * La cascada es ORDER-DEPENDENT: la primera regla que matchea gana.
 *
 * Drift con el SQL → script de paridad en tools/verify_cascade_parity.py
 * corre N SKUs y compara clasificación SQL vs clasificación TS.
 */

import type { SkuDetailRow } from "./types";

export type Section = "A" | "B" | "C" | "D" | "E" | "F";

/** Buckets de acción de negocio — mismos que app/kawii_matrix/service.py:classify_action.
 *  En la UI cada bucket tiene un color/icono. Hacen escaneable la cascada sin leer texto. */
export type ActionBucket =
  | "urgente_comprar"  // rojo · cada día sin stock = venta perdida
  | "reponer"          // verde · pedir más antes de que se acabe
  | "saludable"        // verde tenue · sin acción, todo OK
  | "exceso"           // amarillo · capital atrapado, promocionar
  | "liquidar"         // azul · stock parado, sacar a precio
  | "descatalogar"     // gris · no comprar más, eliminar del catálogo
  | "esperar"          // gris claro · dar tiempo (producto nuevo o recién repuesto)
  | "evaluar"          // ámbar · requiere mirada humana

export const BUCKET_LABELS: Record<ActionBucket, string> = {
  urgente_comprar: "Comprar urgente",
  reponer: "Reponer",
  saludable: "Saludable",
  exceso: "Exceso",
  liquidar: "Liquidar",
  descatalogar: "Descatalogar",
  esperar: "Esperar",
  evaluar: "Evaluar",
};

export const BUCKET_TONE: Record<ActionBucket, string> = {
  urgente_comprar: "danger",
  reponer: "info",
  saludable: "success",
  exceso: "warning",
  liquidar: "info",
  descatalogar: "muted",
  esperar: "muted",
  evaluar: "warning",
};

export interface Thresholds {
  // Sección B: stock=0 con sell-through alto (bestseller real)
  absorption_fast_days: number;
  sellthrough_bestseller_pct: number;
  dsv_active: number;
  dsv_paused: number;
  // Sección C: stock=0 con sell-through bajo (agotado parcial)
  dsv_quiebre_max: number;
  lifetime_min_active: number;
  recent_demand_min: number;
  emergente_v90_min: number;
  residuo_age_days: number;
  // Sección D-E: stock>0
  fresh_lot_days_active: number;
  proy_post_recep_high: number;
  proy_post_recep_low: number;
  cob_post_recep_critical: number;
  cob_critical: number;
  cob_sano_min: number;
  cob_sano_max: number;
  cob_exceso_min: number;
  alta_rotacion_proy: number;
  recien_recep_days: number;
  dsv_ritmo_perdido: number;
  lote_frenado_age_min: number;
  lote_frenado_recent_max: number;
  // Stock bajo quieto
  stock_bajo_alto: number;
  dsv_bajo_quieto_min: number;
  dsv_bajo_quieto_max: number;
  // Tendencia
  decay_factor: number;
  growth_factor: number;
  // Lento crónico
  lento_cronico_age_days: number;
  lento_cronico_days_since_recep: number;
  lento_cronico_dsv_min: number;
  lento_cronico_lifetime_max: number;
  lento_cronico_vel_mes_max: number;
  // Pérdida total
  perdida_consumed_pct: number;
  perdida_sold_max_pct: number;
  vendio_con_perdida_min_pct: number;
  vendio_con_perdida_max_pct: number;
  // Nuevos / temporada
  nuevo_max_days: number;
  nuevo_max_sold: number;
  temporada_dsv_min: number;
  // Categoría umbral adaptativo: GREATEST(adaptive_min, LEAST(adaptive_max, avg_cat * factor))
  adaptive_min: number;
  adaptive_max: number;
  adaptive_factor: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  absorption_fast_days: 45,
  sellthrough_bestseller_pct: 80,
  dsv_active: 30,
  dsv_paused: 60,
  dsv_quiebre_max: 14,
  lifetime_min_active: 50,
  recent_demand_min: 5,
  emergente_v90_min: 15,
  residuo_age_days: 180,
  fresh_lot_days_active: 30,
  proy_post_recep_high: 30,
  proy_post_recep_low: 10,
  cob_post_recep_critical: 15,
  cob_critical: 15,
  cob_sano_min: 30,
  cob_sano_max: 45,
  cob_exceso_min: 45,
  alta_rotacion_proy: 30,
  recien_recep_days: 7,
  dsv_ritmo_perdido: 45,
  lote_frenado_age_min: 90,
  lote_frenado_recent_max: 5,
  stock_bajo_alto: 2,
  dsv_bajo_quieto_min: 16,
  dsv_bajo_quieto_max: 59,
  decay_factor: 0.7,
  growth_factor: 1.5,
  lento_cronico_age_days: 180,
  lento_cronico_days_since_recep: 30,
  lento_cronico_dsv_min: 8,
  lento_cronico_lifetime_max: 60,
  lento_cronico_vel_mes_max: 5,
  perdida_consumed_pct: 50,
  perdida_sold_max_pct: 20,
  vendio_con_perdida_min_pct: 20,
  vendio_con_perdida_max_pct: 50,
  nuevo_max_days: 7,
  nuevo_max_sold: 15,
  temporada_dsv_min: 30,
  adaptive_min: 3,
  adaptive_max: 10,
  adaptive_factor: 0.5,
};

export interface ConditionResult {
  expr: string;
  value: string;
  threshold?: string;
  pass: boolean;
}

export interface RuleEvalResult {
  conditions: ConditionResult[];
  matched: boolean;
}

export interface RuleDef {
  id: string;
  section: Section;
  /** Nombre completo con emoji (igual al SQL — para compatibilidad y export). */
  label: string;
  /** Nombre corto sin emoji, para encabezado escaneable. */
  short_name: string;
  /** Verbo de acción concreto (1-3 palabras). */
  action_verb: string;
  /** Bucket de negocio — define el color/grupo. */
  bucket: ActionBucket;
  /** Una línea que explica CUÁNDO dispara, en lenguaje humano. */
  description: string;
  /** Tags atributos del SKU (ej. ["stock=0", "alta rotación"]) — chips visuales. */
  attrs: string[];
  evaluate: (m: SkuDetailRow, t: Thresholds) => RuleEvalResult;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const c = (expr: string, value: string | number | null | undefined, pass: boolean, threshold?: string): ConditionResult => ({
  expr,
  value: value === null || value === undefined ? "—" : String(value),
  threshold,
  pass,
});

/** GREATEST(adaptive_min, LEAST(adaptive_max, avg_cat * factor)) — espejo del SQL */
function adaptiveProy(avg_cat: number | null, t: Thresholds): number {
  const base = (avg_cat ?? t.adaptive_max) * t.adaptive_factor;
  return Math.max(t.adaptive_min, Math.min(t.adaptive_max, base));
}

/** Sell-through real lifetime = (vendido + consumido + trasladado) / recibido. */
function sellthroughEffectivePct(m: SkuDetailRow): number | null {
  const recv = m.lifetime.unds_recibidas;
  if (!recv || recv <= 0) return null;
  const out = m.lifetime.unds_vendidas + m.lifetime.unds_consumidas + m.lifetime.unds_trasladadas;
  return (out / recv) * 100;
}

/** Velocidad lifetime expresada en unidades/mes (para regla LENTO CRÓNICO). */
function lifetimeVelMonth(m: SkuDetailRow): number {
  const age = m.lifetime.edad_dias ?? 0;
  if (age <= 0) return 0;
  return (m.lifetime.unds_vendidas / age) * 30;
}

// ── Las 38 reglas en orden de cascada ──────────────────────────────────────
export const CASCADE_RULES: RuleDef[] = [
  // ═════ Sección A: Casos especiales ═════
  {
    id: "producto_nuevo",
    section: "A",
    label: "🌱 PRODUCTO NUEVO — ESPERAR",
    short_name: "Producto nuevo",
    action_verb: "Esperar 1 semana",
    bucket: "esperar",
    description: "Llegó hace ≤7 días, todavía no se puede juzgar rotación.",
    attrs: ["recién llegado"],
    evaluate: (m, t) => {
      const first = m.lifetime.primera_recepcion;
      const ageOk = first
        ? (Date.now() - new Date(first).getTime()) / (1000 * 60 * 60 * 24) <= t.nuevo_max_days
        : false;
      const conds = [
        c(`primera_recepción ≤ ${t.nuevo_max_days}d`, first ?? "—", ageOk, `≤${t.nuevo_max_days}d`),
        c(`unds_vendidas < ${t.nuevo_max_sold}`, m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas < t.nuevo_max_sold, `<${t.nuevo_max_sold}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "temporada_cerrada_ok",
    section: "A",
    label: "✅ TEMPORADA CERRADA OK — RECOMPRAR PRÓXIMA CAMPAÑA",
    short_name: "Temporada cerrada",
    action_verb: "Recomprar próxima campaña",
    bucket: "esperar",
    description: "Estacional fuera de campaña, vendió su ciclo y se agotó.",
    attrs: ["estacional", "stock=0"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("departamento estacional", m.is_seasonal_dept ? "sí" : "no", m.is_seasonal_dept),
        c(`dsv_90d > ${t.temporada_dsv_min}`, dsv, dsv > t.temporada_dsv_min, `>${t.temporada_dsv_min}`),
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("vendió alguna vez (lifetime ≥ 1)", m.lifetime.unds_vendidas, m.lifetime.unds_vendidas >= 1, "≥1"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "sobrante_temporada",
    section: "A",
    label: "📦 SALDO DE TEMPORADA — GUARDAR",
    short_name: "Saldo de temporada",
    action_verb: "Guardar (no liquidar)",
    bucket: "esperar",
    description: "Estacional con stock fuera de campaña, guardar para próxima.",
    attrs: ["estacional", "stock>0"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("departamento estacional", m.is_seasonal_dept ? "sí" : "no", m.is_seasonal_dept),
        c(`dsv_90d > ${t.temporada_dsv_min}`, dsv, dsv > t.temporada_dsv_min, `>${t.temporada_dsv_min}`),
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "perdida_total_control_fisico",
    section: "A",
    label: "⛔ PÉRDIDA DE STOCK — REVISAR CONTROL FÍSICO",
    short_name: "Pérdida total",
    action_verb: "Auditar inventario",
    bucket: "evaluar",
    description: "Casi todo el stock se ajustó/perdió (mermas o robos).",
    attrs: ["pérdida", "anomalía"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const cons = m.lifetime.unds_consumidas;
      const sold = m.lifetime.unds_vendidas;
      const trans = m.lifetime.unds_trasladadas;
      const consPct = recv > 0 ? (cons / recv) * 100 : 0;
      const soldPct = recv > 0 ? (sold / recv) * 100 : 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("unds_recibidas_lifetime ≥ 5", recv, recv >= 5, "≥5"),
        c(`consumido ≥ ${t.perdida_consumed_pct}% del recibido`, `${consPct.toFixed(1)}%`, consPct >= t.perdida_consumed_pct, `≥${t.perdida_consumed_pct}%`),
        c(`vendido < ${t.perdida_sold_max_pct}% del recibido`, `${soldPct.toFixed(1)}%`, soldPct < t.perdida_sold_max_pct, `<${t.perdida_sold_max_pct}%`),
        c("consumido > trasladado", `${cons} vs ${trans}`, cons > trans),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "vendio_con_perdida_investigar",
    section: "A",
    label: "⚠️ VENDIÓ Y SE PERDIÓ — INVESTIGAR",
    short_name: "Vendió y se perdió",
    action_verb: "Investigar",
    bucket: "evaluar",
    description: "Hay ventas pero también mermas grandes — revisar inventario.",
    attrs: ["pérdida"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const cons = m.lifetime.unds_consumidas;
      const sold = m.lifetime.unds_vendidas;
      const trans = m.lifetime.unds_trasladadas;
      const soldPct = recv > 0 ? (sold / recv) * 100 : 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("unds_recibidas_lifetime ≥ 5", recv, recv >= 5, "≥5"),
        c("consumido > vendido", `${cons} vs ${sold}`, cons > sold),
        c(`vendido ≥ ${t.vendio_con_perdida_min_pct}% del recibido`, `${soldPct.toFixed(1)}%`, soldPct >= t.vendio_con_perdida_min_pct, `≥${t.vendio_con_perdida_min_pct}%`),
        c(`vendido < ${t.vendio_con_perdida_max_pct}% del recibido`, `${soldPct.toFixed(1)}%`, soldPct < t.vendio_con_perdida_max_pct, `<${t.vendio_con_perdida_max_pct}%`),
        c("consumido > trasladado", `${cons} vs ${trans}`, cons > trans),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },

  // ═════ Sección B: stock=0 con sell-through ≥80% ═════
  {
    id: "bestseller_activo",
    section: "B",
    label: "🔥 BESTSELLER ACTIVO — REPONER YA",
    short_name: "Bestseller activo",
    action_verb: "Reponer urgente",
    bucket: "urgente_comprar",
    description: "Vendió todo RÁPIDO (≤45d) con demanda fuerte y sigue rotando.",
    attrs: ["stock=0", "alta rotación", "lote rápido"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const st = sellthroughEffectivePct(m);
      const abs = m.lote.dias_absorcion_lote;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("recibidas_lifetime ≥ 2", recv, recv >= 2, "≥2"),
        c(`sell-through ≥ ${t.sellthrough_bestseller_pct}%`, st === null ? "—" : `${st.toFixed(1)}%`, st !== null && st >= t.sellthrough_bestseller_pct, `≥${t.sellthrough_bestseller_pct}%`),
        c(`absorción ≤ ${t.absorption_fast_days}d (o NULL)`, abs ?? "NULL", abs === null || abs <= t.absorption_fast_days, `≤${t.absorption_fast_days}d`),
        c(`proy_mes ≥ ${adaptive.toFixed(1)}/mes (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`dsv ≤ ${t.dsv_active}d`, dsv, dsv <= t.dsv_active, `≤${t.dsv_active}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "bestseller_pausado",
    section: "B",
    label: "⏸️ BESTSELLER RÁPIDO AGOTADO 1-2 MESES — REPONER",
    short_name: "Bestseller agotado 1-2m",
    action_verb: "Reponer (confirmar proveedor)",
    bucket: "reponer",
    description: "Vendió todo rápido y lleva 31-60 días sin reposición.",
    attrs: ["stock=0", "lote rápido", "olvidado"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const st = sellthroughEffectivePct(m);
      const abs = m.lote.dias_absorcion_lote;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("recibidas_lifetime ≥ 2", recv, recv >= 2, "≥2"),
        c(`sell-through ≥ ${t.sellthrough_bestseller_pct}%`, st === null ? "—" : `${st.toFixed(1)}%`, st !== null && st >= t.sellthrough_bestseller_pct, `≥${t.sellthrough_bestseller_pct}%`),
        c(`absorción ≤ ${t.absorption_fast_days}d (o NULL)`, abs ?? "NULL", abs === null || abs <= t.absorption_fast_days, `≤${t.absorption_fast_days}d`),
        c(`proy_mes ≥ ${adaptive.toFixed(1)}/mes (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`dsv ≤ ${t.dsv_paused}d`, dsv, dsv <= t.dsv_paused, `≤${t.dsv_paused}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "oportunidad_perdida",
    section: "B",
    label: "💎 OPORTUNIDAD PERDIDA — REPONER YA",
    short_name: "Oportunidad perdida",
    action_verb: "Reponer urgente",
    bucket: "urgente_comprar",
    description: "Lote rápido olvidado >60d sin reabastecer — venta perdida diaria.",
    attrs: ["stock=0", "lote rápido", "olvidado"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const st = sellthroughEffectivePct(m);
      const abs = m.lote.dias_absorcion_lote;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("recibidas_lifetime ≥ 2", recv, recv >= 2, "≥2"),
        c(`sell-through ≥ ${t.sellthrough_bestseller_pct}%`, st === null ? "—" : `${st.toFixed(1)}%`, st !== null && st >= t.sellthrough_bestseller_pct, `≥${t.sellthrough_bestseller_pct}%`),
        c(`absorción ≤ ${t.absorption_fast_days}d (o NULL)`, abs ?? "NULL", abs === null || abs <= t.absorption_fast_days, `≤${t.absorption_fast_days}d`),
        c(`proy_mes ≥ ${adaptive.toFixed(1)}/mes (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "lento_constante",
    section: "B",
    label: "🐢 LENTO PERO CONSTANTE — REPONER POCO",
    short_name: "Lento pero constante",
    action_verb: "Reponer poco",
    bucket: "reponer",
    description: "Nicho que se agotó vendiendo despacio pero seguido.",
    attrs: ["stock=0", "baja rotación"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const st = sellthroughEffectivePct(m);
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("recibidas_lifetime ≥ 2", recv, recv >= 2, "≥2"),
        c(`sell-through ≥ ${t.sellthrough_bestseller_pct}%`, st === null ? "—" : `${st.toFixed(1)}%`, st !== null && st >= t.sellthrough_bestseller_pct, `≥${t.sellthrough_bestseller_pct}%`),
        c(`dsv ≤ ${t.dsv_paused}d`, dsv, dsv <= t.dsv_paused, `≤${t.dsv_paused}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "demanda_extinta",
    section: "B",
    label: "💤 DEMANDA EXTINTA — NO REPONER",
    short_name: "Demanda extinta",
    action_verb: "Descatalogar",
    bucket: "descatalogar",
    description: "Vendió todo pero +60d sin demanda — descatalogar.",
    attrs: ["stock=0", "sin demanda"],
    evaluate: (m, t) => {
      const recv = m.lifetime.unds_recibidas;
      const st = sellthroughEffectivePct(m);
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("recibidas_lifetime ≥ 2", recv, recv >= 2, "≥2"),
        c(`sell-through ≥ ${t.sellthrough_bestseller_pct}%`, st === null ? "—" : `${st.toFixed(1)}%`, st !== null && st >= t.sellthrough_bestseller_pct, `≥${t.sellthrough_bestseller_pct}%`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },

  // ═════ Sección C: stock=0 con sell-through <80% ═════
  {
    id: "quiebre_bestseller",
    section: "C",
    label: "🚨 QUIEBRE DE BESTSELLER — COMPRAR YA",
    short_name: "Quiebre de bestseller",
    action_verb: "Comprar urgente",
    bucket: "urgente_comprar",
    description: "Alta rotación sin stock — cada día sin stock es venta perdida.",
    attrs: ["stock=0", "alta rotación", "quiebre"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`dsv ≤ ${t.dsv_quiebre_max}d`, dsv, dsv <= t.dsv_quiebre_max, `≤${t.dsv_quiebre_max}d`),
        c(`proy_mes ≥ ${adaptive.toFixed(1)}/mes`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "agotado_potencial_activo",
    section: "C",
    label: "✨ AGOTADO CON DEMANDA — REPONER",
    short_name: "Agotado con demanda",
    action_verb: "Reponer",
    bucket: "reponer",
    description: "Vendió ≥50 unds en su vida y la demanda continúa activa.",
    attrs: ["stock=0", "con demanda"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`dsv ≥ 15d`, dsv, dsv >= 15, `≥15d`),
        c(`vendido_lifetime ≥ ${t.lifetime_min_active}`, m.lifetime.unds_vendidas, m.lifetime.unds_vendidas >= t.lifetime_min_active, `≥${t.lifetime_min_active}`),
        c(`vendido_90d ≥ ${t.recent_demand_min}`, m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas >= t.recent_demand_min, `≥${t.recent_demand_min}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "ex_bestseller_enfriado",
    section: "C",
    label: "📉 EX-BESTSELLER ENFRIADO — EVALUAR",
    short_name: "Ex-bestseller enfriado",
    action_verb: "Evaluar",
    bucket: "evaluar",
    description: "Vendía bien antes pero la demanda cayó — ver si vale reabastecer.",
    attrs: ["stock=0", "enfriado"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`dsv ≥ 15d`, dsv, dsv >= 15, `≥15d`),
        c(`vendido_lifetime ≥ ${t.lifetime_min_active}`, m.lifetime.unds_vendidas, m.lifetime.unds_vendidas >= t.lifetime_min_active, `≥${t.lifetime_min_active}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "producto_emergente",
    section: "C",
    label: "🌿 PRODUCTO EMERGENTE — VIGILAR",
    short_name: "Producto emergente",
    action_verb: "Vigilar",
    bucket: "evaluar",
    description: "Vendió bien en 90d pero historial corto — observar antes de reponer fuerte.",
    attrs: ["stock=0", "emergente"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`dsv ≥ 15d`, dsv, dsv >= 15, `≥15d`),
        c(`vendido_90d ≥ ${t.emergente_v90_min}`, m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas >= t.emergente_v90_min, `≥${t.emergente_v90_min}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "residuo_historico",
    section: "C",
    label: "🪦 PRODUCTO MUERTO — DESCATALOGAR",
    short_name: "Producto muerto",
    action_verb: "Descatalogar",
    bucket: "descatalogar",
    description: "Producto antiguo (>180d) prácticamente sin rotación.",
    attrs: ["stock=0", "muerto", "viejo"],
    evaluate: (m, t) => {
      const recv90 = m.lote.unds_recibidas_90d;
      const age = m.lifetime.edad_dias ?? 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("vendido_90d = 0", m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas === 0, "=0"),
        c("recibidas_90d ∈ [1,4]", recv90, recv90 >= 1 && recv90 <= 4, "[1,4]"),
        c(`edad > ${t.residuo_age_days}d`, age, age > t.residuo_age_days, `>${t.residuo_age_days}d`),
        c(`vendido_lifetime < ${t.lifetime_min_active}`, m.lifetime.unds_vendidas, m.lifetime.unds_vendidas < t.lifetime_min_active, `<${t.lifetime_min_active}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "recibido_no_vendido",
    section: "C",
    label: "❓ RECIBIDO Y NO VENDIDO — REVISAR",
    short_name: "Recibido y no vendido",
    action_verb: "Auditar mermas/transferencias",
    bucket: "evaluar",
    description: "Tuvo recepción en 90d pero no se vendió — revisar mermas.",
    attrs: ["stock=0", "anomalía"],
    evaluate: (m, t) => {
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c("vendido_90d = 0", m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas === 0, "=0"),
        c("recibidas_90d > 0", m.lote.unds_recibidas_90d, m.lote.unds_recibidas_90d > 0, ">0"),
        c(`vendido_lifetime < ${t.lifetime_min_active}`, m.lifetime.unds_vendidas, m.lifetime.unds_vendidas < t.lifetime_min_active, `<${t.lifetime_min_active}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "bajo_volumen_agotado",
    section: "C",
    label: "🪦 BAJO VOLUMEN AGOTADO — DESCATALOGAR",
    short_name: "Bajo volumen agotado",
    action_verb: "Descatalogar",
    bucket: "descatalogar",
    description: "Vendió <50 unds en toda su vida.",
    attrs: ["stock=0", "bajo volumen"],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    evaluate: (m, _t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`dsv ≥ 15d`, dsv, dsv >= 15, `≥15d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "agotado_no_prioritario",
    section: "C",
    label: "👻 AGOTADO NO PRIORITARIO",
    short_name: "Agotado no prioritario",
    action_verb: "Sin urgencia",
    bucket: "esperar",
    description: "Sin stock pero rotación muy baja — no es urgente reponer.",
    attrs: ["stock=0", "baja rotación"],
    evaluate: (m, t) => {
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible = 0", m.stock.disponible, m.stock.disponible === 0, "=0"),
        c(`proy_mes < ${adaptive.toFixed(1)}/mes`, proy.toFixed(2), proy < adaptive, `<${adaptive.toFixed(1)}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },

  // ═════ Sección D: stock>0 sin ventas en 90d ═════
  {
    id: "stock_recien_llegado",
    section: "D",
    label: "🔄 STOCK RECIÉN LLEGADO — ESPERAR",
    short_name: "Stock recién llegado",
    action_verb: "Esperar maduración",
    bucket: "esperar",
    description: "Recepción nueva (≤14d) sin ventas todavía — normal, dejar madurar.",
    attrs: ["stock>0", "recién recibido"],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    evaluate: (m, _t) => {
      const ddur = m.lote.dias_desde_ultima_recep;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c("vendido_90d = 0", m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas === 0, "=0"),
        c("recepción ≤ 14d", ddur ?? "—", ddur !== null && ddur <= 14, "≤14d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "stock_parado_90d",
    section: "D",
    label: "💀 STOCK PARADO 90 DÍAS — LIQUIDAR",
    short_name: "Stock parado 90d",
    action_verb: "Liquidar",
    bucket: "liquidar",
    description: "Hay stock pero no se mueve hace 3 meses — capital atrapado.",
    attrs: ["stock>0", "sin ventas 90d", "parado"],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    evaluate: (m, _t) => {
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c("vendido_90d = 0", m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas === 0, "=0"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },

  // ═════ Sección E: stock>0 con ventas ═════
  {
    id: "stock_bajo_quieto",
    section: "E",
    label: "👀 STOCK BAJO QUIETO — VERIFICAR EN TIENDA",
    short_name: "Stock bajo quieto",
    action_verb: "Verificar visibilidad/vencimiento",
    bucket: "evaluar",
    description: "1-2 unds sin movimiento en semanas — chequear visibilidad o vencimiento.",
    attrs: ["stock bajo", "quieto"],
    evaluate: (m, t) => {
      const stk = m.stock.disponible;
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c(`stock ∈ [1, ${t.stock_bajo_alto}]`, stk, stk >= 1 && stk <= t.stock_bajo_alto, `[1,${t.stock_bajo_alto}]`),
        c(`dsv ∈ [${t.dsv_bajo_quieto_min}, ${t.dsv_bajo_quieto_max}]`, dsv, dsv >= t.dsv_bajo_quieto_min && dsv <= t.dsv_bajo_quieto_max, `[${t.dsv_bajo_quieto_min},${t.dsv_bajo_quieto_max}]`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "lote_nuevo_vendiendo_bien",
    section: "E",
    label: "🔄 LOTE NUEVO VENDIENDO BIEN",
    short_name: "Lote nuevo vendiendo bien",
    action_verb: "Mantener (cob alta por dilución)",
    bucket: "saludable",
    description: "Llegó stock grande (≤14d) y ya rota — la cobertura alta es por dilución.",
    attrs: ["stock>0", "lote fresco", "saludable"],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    evaluate: (m, _t) => {
      const ddur = m.lote.dias_desde_ultima_recep;
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const v30 = m.ventas_90d.unds_vendidas_30d;
      const vLifeRecep = m.lifetime.unds_recibidas;
      const passBranchA = v30 >= 2 && ddur !== null && (v30 / Math.max(1, ddur)) * 30 >= 10;
      const passBranchB = m.lifetime.unds_vendidas >= 10 && vLifeRecep > 0 && m.lifetime.unds_vendidas >= vLifeRecep * 0.7;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c("recepción ≤ 14d", ddur ?? "—", ddur !== null && ddur <= 14, "≤14d"),
        c("cob_reciente > 45d", cobR ?? "—", cobR !== null && cobR > 45, ">45d"),
        c("ritmo post-recep ≥10/mes O lifetime ≥70% recibido", passBranchA ? "rama A" : passBranchB ? "rama B" : "ninguna", passBranchA || passBranchB),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "recien_reabastecido",
    section: "E",
    label: "🆕 RECIÉN REABASTECIDO — ESPERAR 1 SEMANA",
    short_name: "Recién reabastecido",
    action_verb: "Esperar 1 semana",
    bucket: "esperar",
    description: "Lote nuevo (≤7d), todavía no se puede evaluar bien.",
    attrs: ["stock>0", "recién recibido"],
    evaluate: (m, t) => {
      const ddur = m.lote.dias_desde_ultima_recep;
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`recepción ≤ ${t.recien_recep_days}d`, ddur ?? "—", ddur !== null && ddur <= t.recien_recep_days, `≤${t.recien_recep_days}d`),
        c("lifetime ≥ 1", m.lifetime.unds_vendidas, m.lifetime.unds_vendidas >= 1, "≥1"),
        c("cob_reciente > 45d", cobR ?? "—", cobR !== null && cobR > 45, ">45d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "alta_rotacion_lote_fresco",
    section: "E",
    label: "🔥 ALTA ROTACIÓN — PRIORIDAD DE COMPRA (lote fresco)",
    short_name: "Alta rotación (lote fresco)",
    action_verb: "Reponer urgente",
    bucket: "urgente_comprar",
    description: "Lote llegó ≤30d y ya vende ≥30/mes con solo ≤15d de cobertura.",
    attrs: ["stock>0", "alta rotación", "lote fresco", "FIX P24"],
    evaluate: (m, t) => {
      const ddur = m.lote.dias_desde_ultima_recep;
      const proyPR = m.proyecciones.proy_post_recep;
      const cobPR = m.proyecciones.cob_post_recep;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`recepción ≤ ${t.fresh_lot_days_active}d`, ddur ?? "—", ddur !== null && ddur <= t.fresh_lot_days_active, `≤${t.fresh_lot_days_active}d`),
        c(`proy_post_recep ≥ ${t.proy_post_recep_high}/mes`, proyPR ?? "—", proyPR !== null && proyPR >= t.proy_post_recep_high, `≥${t.proy_post_recep_high}`),
        c(`cob_post_recep ≤ ${t.cob_post_recep_critical}d`, cobPR ?? "—", cobPR !== null && cobPR <= t.cob_post_recep_critical, `≤${t.cob_post_recep_critical}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "rotacion_activa_al_borde_fresco",
    section: "E",
    label: "⚡ ROTACIÓN ACTIVA AL BORDE — REPONER YA (lote fresco)",
    short_name: "Activa al borde (lote fresco)",
    action_verb: "Pedir ahora",
    bucket: "reponer",
    description: "Lote llegó ≤30d, vende 10-29/mes y quedan ≤15d de stock.",
    attrs: ["stock>0", "lote fresco", "al borde", "FIX P24"],
    evaluate: (m, t) => {
      const ddur = m.lote.dias_desde_ultima_recep;
      const proyPR = m.proyecciones.proy_post_recep;
      const cobPR = m.proyecciones.cob_post_recep;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`recepción ≤ ${t.fresh_lot_days_active}d`, ddur ?? "—", ddur !== null && ddur <= t.fresh_lot_days_active, `≤${t.fresh_lot_days_active}d`),
        c(`proy_post_recep ≥ ${t.proy_post_recep_low}/mes`, proyPR ?? "—", proyPR !== null && proyPR >= t.proy_post_recep_low, `≥${t.proy_post_recep_low}`),
        c(`cob_post_recep ≤ ${t.cob_post_recep_critical}d`, cobPR ?? "—", cobPR !== null && cobPR <= t.cob_post_recep_critical, `≤${t.cob_post_recep_critical}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "ritmo_perdido",
    section: "E",
    label: "📉 RITMO PERDIDO — EVALUAR ANTES DE REPONER",
    short_name: "Ritmo perdido",
    action_verb: "Evaluar (pausar?)",
    bucket: "evaluar",
    description: "Vendía antes pero +45d sin venta — pensar si pausar.",
    attrs: ["stock>0", "ritmo perdido"],
    evaluate: (m, t) => {
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c("vendido_90d > 0", m.ventas_90d.unds_vendidas, m.ventas_90d.unds_vendidas > 0, ">0"),
        c(`dsv > ${t.dsv_ritmo_perdido}d`, dsv, dsv > t.dsv_ritmo_perdido, `>${t.dsv_ritmo_perdido}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "lote_frenado_liquidar",
    section: "E",
    label: "💀 LOTE FRENADO — LIQUIDAR, NO COMPRAR MÁS",
    short_name: "Lote frenado",
    action_verb: "Liquidar",
    bucket: "liquidar",
    description: "Lote viejo (≥90d) con stock que ya casi no rota.",
    attrs: ["stock>0", "frenado", "viejo"],
    evaluate: (m, t) => {
      const age = m.lifetime.edad_dias ?? 0;
      const proy30 = m.proyecciones.proy_30d_reciente ?? 0;
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible ≥ 5", m.stock.disponible, m.stock.disponible >= 5, "≥5"),
        c("proy_mes ≥ 10", proy.toFixed(2), proy >= 10, "≥10"),
        c(`proy_30d_reciente < ${t.lote_frenado_recent_max}`, proy30.toFixed(2), proy30 < t.lote_frenado_recent_max, `<${t.lote_frenado_recent_max}`),
        c(`edad ≥ ${t.lote_frenado_age_min}d`, age, age >= t.lote_frenado_age_min, `≥${t.lote_frenado_age_min}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "rotacion_bajando",
    section: "E",
    label: "🔥📉 ROTACIÓN BAJANDO — REPONER MENOS",
    short_name: "Rotación bajando",
    action_verb: "Reponer menos",
    bucket: "reponer",
    description: "Vende mucho pero menos que antes — usar ritmo nuevo, no histórico.",
    attrs: ["stock>0", "alta rotación", "decay"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const proy = m.proyecciones.proy_mes ?? 0;
      const vR = m.ventas_90d.v_recent_45d;
      const vO = m.ventas_90d.v_old_45d;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${t.alta_rotacion_proy}`, proy.toFixed(2), proy >= t.alta_rotacion_proy, `≥${t.alta_rotacion_proy}`),
        c("cob_reciente < 30d", cobR ?? "—", cobR !== null && cobR < 30, "<30d"),
        c(`tendencia ↓ (recent < old × ${t.decay_factor})`, `${vR.toFixed(0)} vs ${vO.toFixed(0)}`, vR > 0 && vO > 0 && vR < vO * t.decay_factor),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "alta_rotacion",
    section: "E",
    label: "🔥 ALTA ROTACIÓN — PRIORIDAD DE COMPRA",
    short_name: "Alta rotación",
    action_verb: "Reponer urgente",
    bucket: "urgente_comprar",
    description: "Vende ≥30/mes con poco stock — reposición urgente.",
    attrs: ["stock>0", "alta rotación"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${t.alta_rotacion_proy}`, proy.toFixed(2), proy >= t.alta_rotacion_proy, `≥${t.alta_rotacion_proy}`),
        c("cob_reciente < 30d", cobR ?? "—", cobR !== null && cobR < 30, "<30d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "rotacion_activa_al_borde",
    section: "E",
    label: "⚡ ROTACIÓN ACTIVA AL BORDE — REPONER YA",
    short_name: "Activa al borde",
    action_verb: "Pedir ahora",
    bucket: "reponer",
    description: "Vende 10-29/mes con cob ≤15d — pedir ahora.",
    attrs: ["stock>0", "al borde"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const ddur = m.lote.dias_desde_ultima_recep;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`cob_reciente ≤ ${t.cob_critical}d`, cobR ?? "—", cobR !== null && cobR <= t.cob_critical, `≤${t.cob_critical}d`),
        c(`recepción ≤ ${t.fresh_lot_days_active}d`, ddur ?? "—", ddur !== null && ddur <= t.fresh_lot_days_active, `≤${t.fresh_lot_days_active}d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "rotacion_activa_mantener",
    section: "E",
    label: "💫 ROTACIÓN ACTIVA — MANTENER FLUJO",
    short_name: "Rotación activa",
    action_verb: "Reposición regular",
    bucket: "saludable",
    description: "Vende 10-29/mes constante — reposición regular.",
    attrs: ["stock>0", "saludable"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c("cob_reciente < 30d", cobR ?? "—", cobR !== null && cobR < 30, "<30d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "inventario_sano",
    section: "E",
    label: "🟢 INVENTARIO SANO — RITMO NORMAL",
    short_name: "Inventario sano",
    action_verb: "Sin acción",
    bucket: "saludable",
    description: "Stock equilibrado con demanda (cob 30-45d) — todo OK.",
    attrs: ["stock>0", "saludable"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`cob_reciente ∈ [${t.cob_sano_min}, ${t.cob_sano_max}]d`, cobR ?? "—", cobR !== null && cobR >= t.cob_sano_min && cobR <= t.cob_sano_max, `[${t.cob_sano_min},${t.cob_sano_max}]d`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "exceso_demanda_cayendo",
    section: "E",
    label: "🧊📉 EXCESO + DEMANDA CAYENDO — PROMOCIONAR YA",
    short_name: "Exceso + demanda cayendo",
    action_verb: "Promocionar urgente",
    bucket: "liquidar",
    description: "Demasiado stock Y la demanda se enfría — promocionar urgente.",
    attrs: ["stock>0", "exceso", "decay"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const vR = m.ventas_90d.v_recent_45d;
      const vO = m.ventas_90d.v_old_45d;
      const ddur = m.lote.dias_desde_ultima_recep ?? 9999;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`cob_reciente > ${t.cob_exceso_min}d`, cobR ?? "—", cobR !== null && cobR > t.cob_exceso_min, `>${t.cob_exceso_min}d`),
        c(`tendencia ↓ (recent < old × ${t.decay_factor})`, `${vR.toFixed(0)} vs ${vO.toFixed(0)}`, vR > 0 && vO > 0 && vR < vO * t.decay_factor),
        c("recepción > 7d", ddur, ddur > 7, ">7d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "exceso_inventario",
    section: "E",
    label: "🧊 STOCK EXCESIVO — PROMOCIONAR",
    short_name: "Exceso de inventario",
    action_verb: "Promocionar",
    bucket: "exceso",
    description: "Demasiado stock para la demanda actual — capital atrapado.",
    attrs: ["stock>0", "exceso"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const ddur = m.lote.dias_desde_ultima_recep ?? 9999;
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`proy_mes ≥ ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy >= adaptive, `≥${adaptive.toFixed(1)}`),
        c(`cob_reciente > ${t.cob_exceso_min}d`, cobR ?? "—", cobR !== null && cobR > t.cob_exceso_min, `>${t.cob_exceso_min}d`),
        c("recepción > 7d", ddur, ddur > 7, ">7d"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "lento_cronico",
    section: "E",
    label: "🪦 LENTO CRÓNICO — NO REPONER",
    short_name: "Lento crónico",
    action_verb: "No reabastecer",
    bucket: "descatalogar",
    description: "Vende <5/mes en toda su vida — no vale la pena reabastecer.",
    attrs: ["stock>0", "baja rotación", "crónico"],
    evaluate: (m, t) => {
      const age = m.lifetime.edad_dias ?? 0;
      const ddur = m.lote.dias_desde_ultima_recep ?? 9999;
      const dsv = m.ventas_90d.dias_sin_venta_90d ?? 9999;
      const lifeMo = lifetimeVelMonth(m);
      const conds = [
        c("stock_disponible > 0", m.stock.disponible, m.stock.disponible > 0, ">0"),
        c(`edad ≥ ${t.lento_cronico_age_days}d`, age, age >= t.lento_cronico_age_days, `≥${t.lento_cronico_age_days}d`),
        c(`recepción ≥ ${t.lento_cronico_days_since_recep}d`, ddur, ddur >= t.lento_cronico_days_since_recep, `≥${t.lento_cronico_days_since_recep}d`),
        c(`dsv ≥ ${t.lento_cronico_dsv_min}d`, dsv, dsv >= t.lento_cronico_dsv_min, `≥${t.lento_cronico_dsv_min}d`),
        c(`lifetime < ${t.lento_cronico_lifetime_max}`, m.lifetime.unds_vendidas, m.lifetime.unds_vendidas < t.lento_cronico_lifetime_max, `<${t.lento_cronico_lifetime_max}`),
        c(`vel_lifetime_mes < ${t.lento_cronico_vel_mes_max}`, lifeMo.toFixed(2), lifeMo < t.lento_cronico_vel_mes_max, `<${t.lento_cronico_vel_mes_max}`),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "stock_critico_baja_rotacion",
    section: "E",
    label: "⚠️ POCO STOCK CON DEMANDA — REPONER",
    short_name: "Poco stock con demanda",
    action_verb: "Reponer (evitar quiebre)",
    bucket: "reponer",
    description: "Cobertura baja con rotación lenta pero activa — evitar quiebre.",
    attrs: ["stock>0", "stock bajo"],
    evaluate: (m, t) => {
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const vel30 = m.ventas_90d.vel_30d;
      const conds = [
        c("cob_reciente < 30d", cobR ?? "—", cobR !== null && cobR < 30, "<30d"),
        c(`proy_mes < ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy < adaptive, `<${adaptive.toFixed(1)}`),
        c("vel_30d > 0", vel30 ?? "—", vel30 !== null && vel30 > 0, ">0"),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "bajo_volumen_en_alza",
    section: "E",
    label: "📈 VENDIENDO MÁS QUE ANTES — VIGILAR",
    short_name: "Vendiendo más que antes",
    action_verb: "Vigilar (no liquidar)",
    bucket: "evaluar",
    description: "Vende poco pero la tendencia es positiva — observar, no liquidar.",
    attrs: ["stock>0", "en alza"],
    evaluate: (m, t) => {
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const vR = m.ventas_90d.v_recent_45d;
      const vO = m.ventas_90d.v_old_45d;
      const cobR = m.proyecciones.dias_cobertura_reciente;
      const age = m.lifetime.edad_dias ?? 0;
      const recLife = m.lifetime.unds_recibidas;
      const branchGrow = vO > 0 && vR > vO * t.growth_factor;
      const branchStart = vO === 0 && age > 30 && recLife > 0 && m.lifetime.unds_vendidas >= recLife * 0.5;
      const conds = [
        c(`proy_mes < ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy < adaptive, `<${adaptive.toFixed(1)}`),
        c("v_recent_45d > 0", vR.toFixed(0), vR > 0, ">0"),
        c("cob_reciente ≤ 45d", cobR ?? "—", cobR !== null && cobR <= 45, "≤45d"),
        c(`tendencia ↑ (recent > old × ${t.growth_factor}) o reactivación`, branchGrow ? "rama crecimiento" : branchStart ? "rama inicio" : "—", branchGrow || branchStart),
      ];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },
  {
    id: "baja_rotacion",
    section: "E",
    label: "🐢 BAJA ROTACIÓN — PEDIR MENOS",
    short_name: "Baja rotación",
    action_verb: "Pedir menos",
    bucket: "reponer",
    description: "Vende menos de 10/mes — bajar próximo pedido, revisar surtido.",
    attrs: ["stock>0", "baja rotación"],
    evaluate: (m, t) => {
      const adaptive = adaptiveProy(m.categoria_baseline.avg_proy_cat, t);
      const proy = m.proyecciones.proy_mes ?? 0;
      const conds = [c(`proy_mes < ${adaptive.toFixed(1)} (adaptive)`, proy.toFixed(2), proy < adaptive, `<${adaptive.toFixed(1)}`)];
      return { conditions: conds, matched: conds.every((x) => x.pass) };
    },
  },

  // ═════ Sección F: catch-all ═════
  {
    id: "caso_atipico",
    section: "F",
    label: "⚖️ CASO ATÍPICO — REVISAR MANUAL",
    short_name: "Caso atípico",
    action_verb: "Revisar manualmente",
    bucket: "evaluar",
    description: "Ninguna regla anterior disparó — caso atípico, analizar a mano.",
    attrs: ["atípico"],
    evaluate: () => ({ conditions: [c("ninguna regla anterior matcheó", "fallback", true)], matched: true }),
  },
];

export interface CascadeTrace {
  rule: RuleDef;
  result: RuleEvalResult;
}

export interface CascadeRun {
  matched: RuleDef | null;
  trace: CascadeTrace[];
}

/** Corre la cascada en orden y devuelve la primera regla que matchea + traza de TODAS. */
export function runCascade(m: SkuDetailRow, t: Thresholds = DEFAULT_THRESHOLDS): CascadeRun {
  const trace: CascadeTrace[] = [];
  let matched: RuleDef | null = null;
  for (const rule of CASCADE_RULES) {
    const result = rule.evaluate(m, t);
    trace.push({ rule, result });
    if (result.matched && !matched) {
      matched = rule;
      // Seguimos evaluando el resto para mostrarlo como "skipped" en la UI.
    }
  }
  return { matched, trace };
}

export const SECTION_LABELS: Record<Section, string> = {
  A: "A · Casos especiales",
  B: "B · Stock = 0 · sell-through alto",
  C: "C · Stock = 0 · sell-through bajo",
  D: "D · Stock > 0 sin ventas en 90d",
  E: "E · Stock > 0 con ventas",
  F: "F · Catch-all",
};
