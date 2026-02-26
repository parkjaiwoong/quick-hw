// Apply 059_enable_rls_public_tables.sql (uses .env.local DATABASE_URL)
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

const sqlPath = path.join(__dirname, "059_enable_rls_public_tables.sql");

function stripComments(s) {
  return s.replace(/--[^\n]*/g, "").trim();
}

/** Split SQL into statements, respecting DO $$ ... END $$; blocks */
function splitSql(raw) {
  const out = [];
  let rest = stripComments(raw);
  while (rest.length) {
    const doMatch = rest.match(/^\s*DO\s+\$\$/i);
    if (doMatch) {
      const endMarker = "END $$;";
      const idx = rest.indexOf(endMarker);
      if (idx === -1) throw new Error("Unclosed DO $$ block");
      out.push(rest.slice(0, idx + endMarker.length).trim());
      rest = rest.slice(idx + endMarker.length);
      continue;
    }
    const semi = rest.search(/;\s*\n/);
    if (semi === -1) {
      if (stripComments(rest).length > 0) out.push(rest.trim() + (rest.trim().endsWith(";") ? "" : ";"));
      break;
    }
    const stmt = rest.slice(0, semi + 1).trim();
    if (stmt.length > 0 && !/^\)\s*$/.test(stmt)) out.push(stmt);
    rest = rest.slice(semi + 1);
  }
  return out.filter((s) => s.length > 1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set (load from .env.local)");
    process.exit(1);
  }
  const raw = fs.readFileSync(sqlPath, "utf8");
  const statements = splitSql(raw);

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
      const sql = statements[i].endsWith(";") ? statements[i] : statements[i] + ";";
      const preview = sql.slice(0, 70).replace(/\s+/g, " ");
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);
      await client.query(sql).catch((err) => {
        if (err.message.includes("does not exist")) {
          console.warn("  (table may not exist, skipping)", err.message.slice(0, 80));
          return;
        }
        throw err;
      });
    }

    console.log("\nVerifying RLS on listed tables...");
    const { rows } = await client.query(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname = ANY(ARRAY['fcm_receipt_log','connection_test','platform_settings','pricing_config','orders','customer','customer_referral','rider','referrals','points','accident_reports','trigger_logs','notification_audit_log'])
      ORDER BY c.relname
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
