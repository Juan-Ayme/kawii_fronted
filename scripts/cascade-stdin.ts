/* Lee un JSON de SkuDetail por stdin, corre la cascada y emite a stdout la
 * clasificación por sucursal. Uso desde el script de paridad Python:
 *   cat sku-detail.json | npx tsx scripts/cascade-stdin.ts
 */
import { runCascade, DEFAULT_THRESHOLDS } from "../src/lib/cascade";
import type { SkuDetail } from "../src/lib/types";

(async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const detail = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as SkuDetail;
  const out = {
    sku: detail.sku,
    offices: detail.rows.map((row) => {
      const run = runCascade(row, DEFAULT_THRESHOLDS);
      return {
        sucursal: row.sucursal,
        office_id: row.office_id,
        matched_id: run.matched?.id ?? null,
        matched_label: run.matched?.label ?? null,
      };
    }),
  };
  process.stdout.write(JSON.stringify(out));
})();
