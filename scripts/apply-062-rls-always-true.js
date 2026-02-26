// Apply 062_rls_remove_always_true_policies.sql (uses .env.local DATABASE_URL)
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

const sqlPath = path.join(__dirname, "062_rls_remove_always_true_policies.sql");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set (load from .env.local)");
    process.exit(1);
  }
  const raw = fs.readFileSync(sqlPath, "utf8");
  const statements = raw
    .split(/;\s*\n/)
    .map((s) => s.replace(/--[\s\S]*?(?=\n|$)/g, "").trim())
    .filter((s) => s.length > 2 && !/^\)\s*$/.test(s));

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
      const preview = sql.slice(0, 65).replace(/\s+/g, " ");
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);
      await client.query(sql);
    }
    console.log("\nVerifying policies on notifications and notification_audit_log...");
    const { rows } = await client.query(`
      SELECT tablename, policyname, cmd, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_audit_log')
      ORDER BY tablename, policyname
    `);
    console.table(rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
