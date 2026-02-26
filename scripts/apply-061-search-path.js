// Apply 061_function_search_path_fix.sql (uses .env.local DATABASE_URL)
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
const { Client } = require("pg");

const sqlPath = path.join(__dirname, "061_function_search_path_fix.sql");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set (load from .env.local)");
    process.exit(1);
  }
  const raw = fs.readFileSync(sqlPath, "utf8");
  const statements = raw
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  const url = new URL(connectionString.replace(/^postgresql:\/\//, "https://"));
  const client = new Client({
    host: url.hostname,
    port: url.port || 6543,
    database: url.pathname.slice(1).replace(/\?.*/, "") || "postgres",
    user: url.username,
    password: url.password,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i] + ";";
      const match = sql.match(/ALTER FUNCTION public\.(\w+)/);
      console.log(`[${i + 1}/${statements.length}] ${match ? match[1] : "?"}...`);
      await client.query(sql);
    }
    console.log("\nVerifying: functions with search_path set");
    const { rows } = await client.query(`
      SELECT p.proname AS name, p.proconfig AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'increment_driver_wallet_pending','move_driver_wallet_pending_to_available',
          'calculate_rewards_for_order','update_updated_at_column','calculate_distance',
          'find_nearby_drivers','notify_nearby_drivers','mark_other_notifications_read'
        )
      ORDER BY p.proname
    `);
    console.table(rows.map((r) => ({ name: r.name, config: (r.config || []).join(", ") })));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
