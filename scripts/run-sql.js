/**
 * .env.local의 DATABASE_URL로 SQL 실행
 * 사용: node scripts/run-sql.js "CREATE TABLE ..."
 * 또는: node scripts/run-sql.js < scripts/057_fcm_receipt_log.sql
 */
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL 없음');
  process.exit(1);
}

async function main() {
  const pg = await import('pg');
  const opts = { connectionString: dbUrl };
  if (dbUrl.includes('supabase')) {
    opts.ssl = { rejectUnauthorized: false };
  }
  const client = new pg.default.Client(opts);
  await client.connect();
  try {
    const sql = process.argv[2] || fs.readFileSync(path.join(__dirname, '057_fcm_receipt_log.sql'), 'utf8');
    await client.query(sql);
    console.log('SQL 실행 완료');
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
