/**
 * Genera una API key de demo (ejecutar con Deno).
 *
 *   cd middleware && deno run -A scripts/seed-demo.ts
 *
 * Luego insertar en Supabase SQL Editor con el hash impreso.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const bytes = crypto.getRandomValues(new Uint8Array(24));
const secret = Array.from(bytes)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
const plainKey = `fc_live_${secret}`;
const hash = await sha256Hex(plainKey);

console.log("\n=== API Key (mostrar una sola vez) ===\n");
console.log(plainKey);
console.log("\n=== SQL para api_clients ===\n");
console.log(`INSERT INTO api_clients (organization_id, name, key_prefix, key_hash, status)
VALUES (
  '<TU_ORGANIZATION_UUID>',
  'Integración demo',
  'fc_live_',
  '${hash}',
  'active'
);`);
