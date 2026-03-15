/**
 * .env.local 의 DB 정보로 delivery_proof_url 컬럼 추가 (1회 실행)
 * 실행: node scripts/run-add-delivery-proof-url.js
 */
const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(p)) {
    console.error(".env.local not found")
    process.exit(1)
  }
  const content = fs.readFileSync(p, "utf8")
  const env = {}
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].replace(/^["']|["']$/g, "").trim()
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const host = env.DB_HOST || env.PGHOST
  const port = parseInt(env.DB_PORT || env.PGPORT || "6543", 10)
  const user = env.DB_USER || env.PGUSER
  const password = env.DB_PASSWORD || env.PGPASSWORD
  const database = env.DB_NAME || env.PGDATABASE || "postgres"
  if (!host || !user || !password) {
    console.error("DB_HOST, DB_USER, DB_PASSWORD (or DATABASE_URL) required in .env.local")
    process.exit(1)
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    await client.query(`
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
    `)
    console.log("OK: deliveries.delivery_proof_url column added or already exists.")
  } catch (e) {
    console.error("Error:", e.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
