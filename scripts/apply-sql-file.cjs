/**
 * 로컬 .env.local 의 DATABASE_URL 로 SQL 파일 실행 (여러 문장 허용).
 * 사용: node scripts/apply-sql-file.cjs scripts/077_customer_admin_page_rpcs.sql
 */
const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error("Usage: node scripts/apply-sql-file.cjs <path-to.sql>")
  process.exit(1)
}

const envPath = path.join(__dirname, "..", ".env.local")
const envText = fs.readFileSync(envPath, "utf8")
const line = envText.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))
if (!line) {
  console.error("DATABASE_URL not found in .env.local")
  process.exit(1)
}
let connectionString = line.slice("DATABASE_URL=".length).trim()
/** URL의 sslmode=require 가 Node pg에서 엄격 검증과 겹치면 인증서 체인 오류가 날 수 있음 */
connectionString = connectionString.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "")
const absSql = path.isAbsolute(sqlFile) ? sqlFile : path.join(process.cwd(), sqlFile)
const sql = fs.readFileSync(absSql, "utf8")

const useInsecureTls = /supabase\.co|pooler\.supabase/.test(connectionString)
const ssl = useInsecureTls ? { rejectUnauthorized: false } : undefined

;(async () => {
  const client = new Client({ connectionString, ...(ssl ? { ssl } : {}) })
  try {
    await client.connect()
    await client.query(sql)
    console.log("OK:", absSql)
  } catch (e) {
    console.error(e.message || e)
    process.exit(1)
  } finally {
    await client.end()
  }
})()
