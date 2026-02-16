# 배송 요청 푸시 알림 설정 (Web Push + FCM)

기사가 **앱/탭을 닫아도** 배송 요청 알림을 받으려면 아래 설정이 필요합니다.

---

## 1. DB 테이블

이미 적용된 경우 생략. 미적용 시 Supabase SQL Editor에서 실행:

```sql
-- scripts/054_push_and_fcm_tables.sql 내용 실행
```

---

## 2. Web Push (브라우저·웹 탭 종료 후에도 알림)

### 2.1 VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

나온 **public key**와 **private key**를 환경 변수에 넣습니다.

### 2.2 환경 변수 (.env.local / Vercel)

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID 공개 키 (클라이언트에 노출) |
| `VAPID_PUBLIC_KEY` | VAPID 공개 키 (서버에서 web-push 설정용, 보통 위와 동일) |
| `VAPID_PRIVATE_KEY` | VAPID 비공개 키 (서버 전용, 노출 금지) |
| `PUSH_WEBHOOK_SECRET` | 웹훅 인증용 비밀 (아래 Supabase 웹훅에서 사용) |

### 2.3 Supabase Database Webhook (필수)

배송 요청 시 DB에 알림이 INSERT되면 우리 API를 호출해 푸시를 보내야 합니다.

1. **Supabase Dashboard** → **Database** → **Webhooks** → **Create a new webhook**
2. **Table**: `notifications`
3. **Events**: `Insert`
4. **HTTP Request**  
   - **URL**: `https://(당신의 도메인)/api/push/send`  
     예: `https://quick-hw.vercel.app/api/push/send`
   - **HTTP Headers**  
     - `Content-Type`: `application/json`  
     - `x-webhook-secret`: `(PUSH_WEBHOOK_SECRET 값)`
   - **HTTP Params**: Body에 Supabase가 자동으로 넣는 payload 사용 (별도 설정 없음)

Supabase는 INSERT 시 다음 형태로 POST합니다:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "record": {
    "id": "...",
    "user_id": "...",
    "delivery_id": "...",
    "title": "새로운 배송 요청",
    "message": "...",
    "type": "new_delivery_request"
  }
}
```

`/api/push/send`는 `record.user_id`, `record.title`, `record.message`, `record.delivery_id`를 사용하며,  
`type`이 `new_delivery_request` 또는 `new_delivery`일 때만 Web Push를 전송합니다.

---

## 3. Flutter 앱 FCM (기사 앱 백그라운드/종료 시)

### 3.1 Firebase 프로젝트

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성 또는 기존 프로젝트 선택
2. **Android** 앱 등록: 패키지명 `com.quickhw.driver_app`
3. **google-services.json** 다운로드 → `driver_app/android/app/` 에 넣기
4. (iOS 사용 시) **iOS** 앱 등록 후 **GoogleService-Info.plist** → `driver_app/ios/Runner/` 에 넣기

### 3.2 Flutter 의존성

`driver_app/pubspec.yaml`에 이미 추가됨:

- `firebase_core`
- `firebase_messaging`

### 3.3 FCM 토큰 등록

기사 앱에서 로그인 후 FCM 토큰을 서버에 보냅니다.  
`POST /api/driver/fcm-token` (인증 필요, body: `{ "token": "..." }`)  
→ 서버는 `driver_fcm_tokens` 테이블에 저장합니다.

### 3.4 서버에서 FCM 전송 (선택)

FCM으로도 보내려면 Next.js 서버에 Firebase Admin SDK 설정이 필요합니다.

1. Firebase Console → 프로젝트 설정 → 서비스 계정 → 키 생성 → JSON 파일 다운로드
2. 환경 변수 `FIREBASE_SERVICE_ACCOUNT_JSON`에 JSON **한 줄 문자열**로 넣거나,  
   또는 JSON 파일 경로를 `GOOGLE_APPLICATION_CREDENTIALS`로 지정
3. `/api/push/send`는 `driver_fcm_tokens`에 해당 `user_id`의 토큰이 있으면 Web Push와 함께 FCM도 전송합니다.

---

## 요약

| 상황 | 필요한 설정 |
|------|-------------|
| 웹에서 탭만 닫은 경우 | VAPID 키 + `PUSH_WEBHOOK_SECRET` + Supabase Webhook → `/api/push/send` |
| Flutter 앱 백그라운드/종료 | Firebase 프로젝트 + 기사 앱 FCM 토큰 등록 + (선택) Firebase Admin으로 전송 |
