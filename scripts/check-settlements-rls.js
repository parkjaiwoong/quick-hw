// One-off: check public.settlements RLS status (load env from .env.local)
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

const queries = {
  rlsEnabled: `
    SELECT relname, relrowsecurity AS rls_enabled, relforcerowsecurity
    FROM pg_class WHERE relname = 'settlements';
  `,
  policies: `
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE tablename = 'settlements';
  `,
  columns: `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settlements'
    ORDER BY ordinal_position;
  `,
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set (load from .env.local)");
    process.exit(1);
  }
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
    console.log("=== public.settlements RLS status ===");
    const rls = await client.query(queries.rlsEnabled);
    console.log(rls.rows);

    console.log("\n=== RLS policies on settlements ===");
    const pol = await client.query(queries.policies);
    console.log(pol.rows.length ? pol.rows : "(no policies)");

    console.log("\n=== settlements columns (sensitive: bank_account, bank_name) ===");
    const col = await client.query(queries.columns);
    console.log(col.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
