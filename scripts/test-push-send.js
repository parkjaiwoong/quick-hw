/**
 * push/send API 테스트 — 연결 요청 시 FCM 전송 디버깅용
 * 사용: node scripts/test-push-send.js <driver_id> [delivery_id]
 * 예: node scripts/test-push-send.js f14613a0-5ea3-4982-a426-bbd8655bfa18
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

const driverId = process.argv[2]
const deliveryId = process.argv[3] || '00000000-0000-0000-0000-000000000001'

if (!driverId) {
  console.error('사용법: node scripts/test-push-send.js <driver_id> [delivery_id]')
  console.error('예: node scripts/test-push-send.js f14613a0-5ea3-4982-a426-bbd8655bfa18')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_QUICKSUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const pushSecret = process.env.PUSH_WEBHOOK_SECRET
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}` : 'https://quick-hw.vercel.app'

async function main() {
  console.log('=== push/send 디버그 ===\n')
  console.log('driver_id:', driverId)
  console.log('delivery_id:', deliveryId)
  console.log('baseUrl:', baseUrl)
  console.log('PUSH_WEBHOOK_SECRET:', pushSecret ? '설정됨' : '❌ 없음')
  console.log('FIREBASE_SERVICE_ACCOUNT_JSON:', process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? '설정됨' : '❌ 없음')
  console.log('')

  // 1. driver_fcm_tokens 확인
  if (!url || !key) {
    console.error('NEXT_PUBLIC_QUICKSUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    process.exit(1)
  }
  const supabase = createClient(url, key)
  const { data: tokens, error: tokenErr } = await supabase
    .from('driver_fcm_tokens')
    .select('token, updated_at')
    .eq('user_id', driverId)

  if (tokenErr) {
    console.error('driver_fcm_tokens 조회 실패:', tokenErr.message)
    process.exit(1)
  }
  if (!tokens || tokens.length === 0) {
    console.error('❌ 해당 기사(driver_id)에 FCM 토큰이 없습니다.')
    console.error('   → 기사 앱에서 로그인 후 대시보드가 로드되면 토큰이 등록됩니다.')
    console.error('   → 앱을 열고 "배송 가능" 상태로 두면 토큰이 전달됩니다.')
    process.exit(1)
  }
  console.log('✓ FCM 토큰 있음:', tokens.length, '개, 끝 24자:', tokens[0].token?.slice(-24))

  // 2. push/send API 호출
  if (!pushSecret) {
    console.error('❌ PUSH_WEBHOOK_SECRET이 없어 push/send 호출 불가')
    console.error('')
    console.error('설정 방법:')
    console.error('  1. .env.local에 PUSH_WEBHOOK_SECRET=비밀값 추가')
    console.error('  2. Vercel 배포 시: Project → Settings → Environment Variables 에 추가')
    console.error('  3. FCM 사용 시 FIREBASE_SERVICE_ACCOUNT_JSON도 필수')
    process.exit(1)
  }

  const pushUrl = `${baseUrl}/api/push/send`
  const body = {
    record: {
      user_id: driverId,
      delivery_id: deliveryId,
      title: '테스트 연결 요청',
      message: 'FCM 전송 테스트입니다.',
      type: 'new_delivery_request',
    },
  }

  console.log('\npush/send 호출 중:', pushUrl)
  try {
    const res = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': pushSecret,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    console.log('상태:', res.status, res.statusText)
    console.log('응답:', text)
    if (res.status !== 200) {
      console.error('❌ push/send 실패')
      process.exit(1)
    }
    const json = JSON.parse(text)
    if (json.fcm) console.log('\nFCM 결과:', json.fcm)
    console.log('\n✓ 완료. 기사 앱에서 FCM 수신 확인하세요.')
  } catch (e) {
    console.error('❌ fetch 오류:', e.message)
    process.exit(1)
  }
}

main().catch(console.error)
