/* API route de paridad: dada una lista de SKUs, consulta el backend para
 * obtener sus métricas crudas y corre la cascada TS contra cada uno. Devuelve
 * la clasificación por SKU y sucursal, en formato compacto para que el script
 * tools/verify_cascade_parity.py compare contra la clasificación del SQL.
 *
 * GET  /api/simulator-eval?sku=EP-9534         (un solo SKU)
 * POST /api/simulator-eval  body: { skus: ["EP-9534", "1000-2", ...] }  (batch)
 */
import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api";
import { runCascade, DEFAULT_THRESHOLDS } from "@/lib/cascade";
import type { SkuDetail } from "@/lib/types";

async function classifySku(sku: string) {
  const url = `${API_BASE_URL}/matrix-sim/sku-detail/${encodeURIComponent(sku)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return { sku, error: `backend ${res.status}: ${await res.text()}` };
  }
  const detail = (await res.json()) as SkuDetail;
  const offices = detail.rows.map((r) => {
    const run = runCascade(r, DEFAULT_THRESHOLDS);
    return {
      sucursal: r.sucursal,
      office_id: r.office_id,
      matched_id: run.matched?.id ?? null,
      matched_label: run.matched?.label ?? null,
    };
  });
  return { sku: detail.sku, product_name: detail.product_name, offices };
}

export async function GET(req: NextRequest) {
  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku) return NextResponse.json({ error: "param ?sku required" }, { status: 400 });
  return NextResponse.json(await classifySku(sku));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { skus?: string[] };
  const skus = body.skus ?? [];
  const results = await Promise.all(skus.map(classifySku));
  return NextResponse.json({ count: results.length, results });
}
