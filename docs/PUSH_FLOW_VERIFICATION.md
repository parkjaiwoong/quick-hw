# Firebase 호출 전 흐름 점검 가이드

고객 → 기사 연결 요청이 발생했을 때, **Firebase FCM 호출 직전**까지 정상 동작하는지 확인하는 방법입니다.

---

## 1. 전체 흐름

```
고객 배송 요청 (결제 완료)
  ↓
[결제 방법별]
  • 현금: createDelivery() → notifyDriversForDelivery() 바로 호출
  • 카드/계좌이체: payments/confirm → notifyDriversAfterPayment() → notifyDriversForDelivery()
  ↓
notifyDriversForDelivery(deliveryId, pickupLat, pickupLng)
  ↓
  [기사알림-1] 시작
  ↓
  find_nearby_drivers RPC + driver_info (is_available=true) 병합
  ↓
  [기사알림-2] 알림할 기사 목록 (driverIdsToNotify)
  ↓
  notifications 테이블 INSERT
  ↓
  [기사알림-3] INSERT 성공
  ↓
  PUSH_WEBHOOK_SECRET && baseUrl 있으면 → push/send API 호출
  [기사알림-4] push/send 호출 (각 driverId별)
  ↓
push/send API
  ↓
  [push/send] 요청 수신
  ↓
  driver_fcm_tokens 조회
  ↓
  [push/send] FCM 토큰 조회
  ↓
  FIREBASE_SERVICE_ACCOUNT_JSON 있으면 → Firebase Admin으로 FCM 전송
  [push/send] FCM 발송 결과
```

---

## 2. Firebase 호출 전 점검 (Supabase)

### 2-1. notification_audit_log 확인

`notification_audit_log` 테이블에 최근 5분 이내 `insert_ok`가 있으면 `notifyDriversForDelivery`가 정상 실행된 것입니다.

```sql
-- 최근 10분 내 기사 알림 흐름
SELECT id, created_at, delivery_id, event_type, payload
FROM notification_audit_log
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at DESC;
```

**확인할 event_type 순서:**
- `notify_start` → 시작
- `rpc_nearby` → 근처 기사 조회
- `merge_nearby_and_available` → 알림 대상 기사 목록
- `insert_ok` → notifications INSERT 성공 ✅
- `insert_skip` → 알림할 기사 0명 (여기서 멈추면 Firebase까지 안 감)
- `insert_fail` → INSERT 실패
- `rpc_error` → find_nearby_drivers 실패

### 2-2. notifications 테이블 확인

```sql
-- 최근 5분 내 배송 요청 알림
SELECT id, created_at, user_id, delivery_id, type, title
FROM notifications
WHERE type IN ('new_delivery_request', 'new_delivery')
  AND created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```

`user_id`가 기사 ID입니다. 여기 row가 있으면 `insert_ok`까지 흐름이 정상입니다.

### 2-3. driver_fcm_tokens 확인

push/send는 각 `user_id`(기사 ID)로 `driver_fcm_tokens`를 조회합니다.

```sql
-- 알림받은 기사들 중 FCM 토큰 있는지
SELECT n.user_id, n.delivery_id, n.created_at,
       (SELECT count(*) FROM driver_fcm_tokens t WHERE t.user_id = n.user_id) as token_count
FROM notifications n
WHERE n.type IN ('new_delivery_request', 'new_delivery')
  AND n.created_at > now() - interval '5 minutes';
```

`token_count`가 0이면 해당 기사에게 FCM이 전송되지 않습니다. (앱에서 토큰 등록 필요)

---

## 3. Firebase 호출 전 점검 (서버 환경변수)

| 변수 | 용도 | 없으면 |
|------|------|--------|
| `PUSH_WEBHOOK_SECRET` | push/send 인증 + notifyDriversForDelivery에서 push/send 호출 시 사용 | [기사알림-4] push/send 호출 **스킵** ("PUSH_WEBHOOK_SECRET 또는 baseUrl 없음") |
| `NEXT_PUBLIC_APP_URL` 또는 `VERCEL_URL` | push/send API URL (baseUrl) | 위와 동일, push/send 호출 스킵 |
| `SUPABASE_SERVICE_ROLE_KEY` | notifyDriversForDelivery, push/send에서 Supabase 접근 | [기사알림-1] "서비스 키 없음" |
| `NEXT_PUBLIC_QUICKSUPABASE_URL` | Supabase URL | Supabase 호출 실패 |

**push/send까지 가려면** `PUSH_WEBHOOK_SECRET`과 `baseUrl`(NEXT_PUBLIC_APP_URL/VERCEL_URL) 둘 다 필요합니다.

---

## 4. Vercel 로그에서 확인할 키워드

5분 전 고객 요청이 있었다면, Vercel Function 로그에서 아래를 순서대로 찾아보세요.

| 순서 | 로그 키워드 | 의미 |
|------|-------------|------|
| 1 | `[결제확인] 기사 알림 트리거` 또는 `[결제확인-POST] 기사 알림 트리거` | 카드/계좌이체 결제 완료 후 알림 트리거 |
| 2 | `[결제→기사] notifyDriversForDelivery 호출` | notifyDriversForDelivery 진입 |
| 3 | `[기사알림-1] notifyDriversForDelivery 시작` | 알림 플로우 시작 |
| 4 | `[기사알림-2] 근처 기사 수` | 근처/배송가능 기사 조회 |
| 5 | `[기사알림-3] notifications INSERT 성공` | notifications INSERT 완료 ✅ |
| 6 | `[기사알림-4] push/send 호출` | push/send API 호출 완료 (Firebase 직전 단계) |
| 7 | `[push/send] 요청 수신` | push/send API 진입 |
| 8 | `[push/send] FCM 토큰 조회` | driver_fcm_tokens 조회 |
| 9 | `[push/send] FCM 발송 결과` | Firebase 전송 완료 |
| - | `[기사알림-4] PUSH_WEBHOOK_SECRET 또는 baseUrl 없음` | push/send 호출 스킵됨 |
| - | `[push/send] FCM 토큰 없음` | 해당 기사 FCM 토큰 없음 |

---

## 5. 요약 체크리스트

Firebase 호출 전까지 정상인지 확인:

1. [ ] `notification_audit_log`에 `insert_ok` 있음
2. [ ] `notifications` 테이블에 해당 delivery_id, user_id row 있음
3. [ ] `PUSH_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`(또는 VERCEL_URL) 설정됨
4. [ ] Vercel 로그에 `[기사알림-4] push/send 호출` 찍힘
5. [ ] `driver_fcm_tokens`에 해당 기사(user_id) 토큰 있음

위 5개가 모두 충족되면 Firebase 호출 직전까지 정상입니다.  
이후 FCM 미수신은 기기/앱 쪽(토큰, 백그라운드 처리 등)을 확인하세요.

---

## 6. FCM 수신 DB 로그 (fcm_receipt_log)

앱에서 FCM을 수신하면 **즉시** `fcm_receipt_log` 테이블에 저장됩니다.

**테이블 생성** (최초 1회, Supabase SQL Editor에서 실행):

```sql
-- scripts/057_fcm_receipt_log.sql 내용 실행
```

**조회** (최근 30분):

```bash
node scripts/check-push-flow.js
```

또는 Supabase에서:

```sql
SELECT created_at, driver_id, delivery_id, source
FROM fcm_receipt_log
WHERE created_at > now() - interval '30 minutes'
ORDER BY created_at DESC;
```

- `source`: `foreground`(포그라운드 Dart), `background`(백그라운드 Dart), `native`(Kotlin)
- 이 테이블에 row가 있으면 **해당 기기에서 FCM을 실제로 수신**한 것입니다.

**fcm_receipt_log에 데이터가 안 들어올 때 점검:**

| 단계 | 확인 항목 | 조치 |
|------|-----------|------|
| 1 | push/send 호출 여부 | Vercel 로그에서 `[push/send] 요청 수신`, `[push/send] FCM 발송 결과` 확인 |
| 2 | FCM data에 driver_id | push/send는 `driver_id: userId` 포함 전송. driver_id 없으면 앱에서 로그 스킵 |
| 3 | 앱 onMessageReceived | logcat 필터 `DriverFcmService` — "FCM 로그 시도" 또는 "driver_id가 FCM data에 없습니다" 확인 |
| 4 | fcm-receipt-log API | Vercel 로그에서 `[fcm-receipt-log] 저장 완료` 또는 `INSERT 실패` 확인 |
| 5 | fcm_receipt_log 테이블 | Supabase에서 `scripts/057_fcm_receipt_log.sql` 실행 여부 확인 |
| 6 | driver_id FK | driver_id가 profiles(id)에 존재해야 함. 기사가 profiles에 없으면 INSERT 실패 |
