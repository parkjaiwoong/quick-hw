/**
 * Firebase 호출 전 푸시 흐름 점검 스크립트
 * 실행: node scripts/check-push-flow.js (프로젝트 루트에서)
 */
const fs = require('fs')
const path = require('path')
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}
const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('NEXT_PUBLIC_QUICKSUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  console.log('=== 1. notification_audit_log (최근 30분) ===\n')
  const { data: auditRows, error: auditErr } = await supabase
    .from('notification_audit_log')
    .select('id, created_at, delivery_id, event_type, payload')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  if (auditErr) {
    console.log('notification_audit_log 조회 실패:', auditErr.message)
    console.log('테이블이 없을 수 있습니다. scripts/056_notification_audit_log.sql 실행 확인.')
  } else if (!auditRows?.length) {
    console.log('최근 10분 내 audit 로그 없음')
  } else {
    auditRows.forEach((r) => {
      console.log(`${r.created_at} | ${r.event_type} | delivery_id=${r.delivery_id}`)
      if (r.payload && Object.keys(r.payload).length) console.log('  payload:', JSON.stringify(r.payload))
    })
  }

  console.log('\n=== 2. notifications (최근 30분, new_delivery_request/new_delivery) ===\n')
  const { data: notifRows, error: notifErr } = await supabase
    .from('notifications')
    .select('id, created_at, user_id, delivery_id, type, title')
    .in('type', ['new_delivery_request', 'new_delivery'])
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  if (notifErr) {
    console.log('notifications 조회 실패:', notifErr.message)
  } else if (!notifRows?.length) {
    console.log('최근 5분 내 배송 요청 알림 없음')
  } else {
    for (const n of notifRows) {
      const { count } = await supabase
        .from('driver_fcm_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', n.user_id)
      console.log(`${n.created_at} | user_id=${n.user_id?.slice(0, 8)}... | delivery_id=${n.delivery_id} | FCM토큰=${count}개`)
    }
  }

  console.log('\n=== 3. 최근 30분 내 배송 (driver_id 할당된 것 = 기사 연결됨) ===\n')
  const { data: deliveryRows, error: delErr } = await supabase
    .from('deliveries')
    .select('id, created_at, status, driver_id')
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .not('driver_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (delErr) {
    console.log('deliveries 조회 실패:', delErr.message)
  } else if (deliveryRows?.length) {
    deliveryRows.forEach((d) => {
      console.log(`${d.created_at} | delivery_id=${d.id} | driver_id=${d.driver_id?.slice(0, 8)}... | status=${d.status}`)
    })
  } else {
    console.log('기사 연결된 배송 없음')
  }

  console.log('\n=== 4. fcm_receipt_log (최근 30분, 앱에서 FCM 수신 시 저장) ===\n')
  try {
    const { data: receiptRows, error: receiptErr } = await supabase
      .from('fcm_receipt_log')
      .select('id, created_at, driver_id, delivery_id, source')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    if (receiptErr) {
      console.log('fcm_receipt_log 조회 실패:', receiptErr.message)
      console.log('  → scripts/057_fcm_receipt_log.sql 실행 후 테이블 생성 필요')
    } else if (receiptRows?.length) {
      receiptRows.forEach((r) => {
        console.log(`${r.created_at} | driver=${r.driver_id?.slice(0, 8)}... | delivery=${r.delivery_id?.slice(0, 8) || '-'}... | source=${r.source}`)
      })
    } else {
      console.log('최근 30분 내 FCM 수신 로그 없음')
    }
  } catch (_) {}

  console.log('\n=== 완료 ===')
}

main().catch(console.error)
