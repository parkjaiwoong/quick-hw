/**
 * .env.local 기반 pricing_config 업데이트 (1회 실행)
 * 실행: node scripts/update-pricing-config.js
 */
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) {
    console.error(".env.local not found");
    process.exit(1);
  }
  const content = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_QUICKSUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_QUICKSUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required in .env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const { data: rows, error: selectErr } = await supabase
    .from("pricing_config")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (selectErr) {
    console.error("select error:", selectErr);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.error("pricing_config row not found");
    process.exit(1);
  }

  const { error: updateErr } = await supabase
    .from("pricing_config")
    .update({
      base_fee: 6000,
      per_km_fee: 1000,
      platform_commission_rate: 20,
      min_driver_fee: 4500,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rows[0].id);

  if (updateErr) {
    console.error("update error:", updateErr);
    process.exit(1);
  }

  console.log("pricing_config updated: base_fee=6000, per_km_fee=1000, platform_commission_rate=20, min_driver_fee=4500");
}

main();
