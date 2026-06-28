import { KanbanCol, Row } from "../types";

export const s = (v: unknown): string => (v == null ? "" : String(v));

export const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const str = String(v);
  const m = str.match(/-?\d+(\.\d+)?/);
  if (m) {
    const p = parseFloat(m[0]);
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
};

export function getKanbanColumn(row: Row): KanbanCol {
  const clasif = String(row["Clasificación"] || "").toUpperCase();
  
  if (
    clasif.includes("BESTSELLER ACTIVO") ||
    clasif.includes("BESTSELLER RÁPIDO AGOTADO") ||
    clasif.includes("OPORTUNIDAD PERDIDA") ||
    clasif.includes("QUIEBRE DE BESTSELLER") ||
    clasif.includes("AGOTADO CON DEMANDA") ||
    clasif.includes("ALTA ROTACIÓN POR LOTE") ||
    clasif.includes("ALTA ROTACIÓN") ||
    clasif.includes("ROTACIÓN ACTIVA AL BORDE") ||
    clasif.includes("POCO STOCK CON DEMANDA")
  ) {
    return "comprar";
  }

  if (
    clasif.includes("PÉRDIDA DE STOCK") ||
    clasif.includes("VENTAS CON PÉRDIDA") ||
    clasif.includes("VENDIÓ Y SE PERDIÓ") ||
    clasif.includes("STOCK BAJO QUIETO") ||
    clasif.includes("RITMO PERDIDO") ||
    clasif.includes("EX-BESTSELLER ENFRIADO") ||
    clasif.includes("CASO ATÍPICO")
  ) {
    return "alertas";
  }

  if (
    clasif.includes("PRODUCTO NUEVO") ||
    clasif.includes("EMERGENTE") ||
    clasif.includes("STOCK RECIÉN LLEGADO") ||
    clasif.includes("LOTE NUEVO VENDIENDO") ||
    clasif.includes("RECIÉN REABASTECIDO") ||
    clasif.includes("ROTACIÓN ACTIVA") ||
    clasif.includes("INVENTARIO SANO") ||
    clasif.includes("VENDIENDO MÁS") ||
    clasif.includes("RECIBIDO Y NO VENDIDO")
  ) {
    return "vigilar";
  }

  if (
    clasif.includes("LENTO PERO CONSTANTE") ||
    clasif.includes("BAJA ROTACIÓN") ||
    clasif.includes("EXCESO") ||
    clasif.includes("STOCK EXCESIVO") ||
    clasif.includes("ROTACIÓN BAJANDO")
  ) {
    return "lentos";
  }

  // Fallback a liquidar
  return "liquidar";
}
