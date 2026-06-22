/* Validación standalone de la cascada TS contra el backend.
 * Uso: npx tsx scripts/validate-cascade.ts <SKU1> [SKU2 …]
 * Requiere que el backend FastAPI esté corriendo en localhost:8000.
 */
import { runCascade, DEFAULT_THRESHOLDS } from "../src/lib/cascade";
import type { SkuDetail } from "../src/lib/types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function check(sku: string) {
  const res = await fetch(`${API}/matrix-sim/sku-detail/${encodeURIComponent(sku)}`);
  if (!res.ok) {
    console.log(`[${sku}] backend error ${res.status}: ${await res.text()}`);
    return;
  }
  const detail = (await res.json()) as SkuDetail;
  console.log(`\n=== ${detail.sku} · ${detail.product_name} ===`);
  for (const row of detail.rows) {
    const run = runCascade(row, DEFAULT_THRESHOLDS);
    console.log(`  ${row.sucursal.padEnd(20)} -> ${run.matched ? run.matched.id : "(sin match)"}`);
    console.log(`    ${run.matched?.label ?? "—"}`);
  }
}

(async () => {
  const skus = process.argv.slice(2);
  if (skus.length === 0) {
    console.error("Uso: tsx scripts/validate-cascade.ts <sku> [sku ...]");
    process.exit(1);
  }
  for (const sku of skus) await check(sku);
})();
