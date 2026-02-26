// Apply 060_user_point_balance_security_invoker.sql (uses .env.local DATABASE_URL)
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

const sqlPath = path.join(__dirname, "060_user_point_balance_security_invoker.sql");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set (load from .env.local)");
    process.exit(1);
  }
  const raw = fs.readFileSync(sqlPath, "utf8").replace(/--[^\n]*/g, "").trim();
  const sql = raw.endsWith(";") ? raw : raw + ";";

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
    console.log("Setting user_point_balance to SECURITY INVOKER...");
    await client.query(sql);
    const { rows } = await client.query(`
      SELECT relname, reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'user_point_balance'
    `);
    console.log("View options:", rows[0]?.reloptions || "(none)");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
