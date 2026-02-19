# FCM vs Realtime 알림 경로 비교 점검

## 요약

| 구분 | Realtime (앱 포그라운드) | FCM (앱 백그라운드) |
|------|--------------------------|---------------------|
| **동작 시점** | 앱이 화면에 떠 있을 때만 | 앱이 내려가 있어도 |
| **데이터 소스** | Supabase `notifications` 테이블 INSERT | 서버 push/send API → Firebase → 기기 |
| **진입 경로** | WebView 내 Realtime 구독 | DriverFcmService.onMessageReceived (Kotlin) |
| **오버레이/진동/소리** | ✅ 정상 (JS 실행 중) | ❌ 조건부 (아래 원인 참고) |

---

## 1. Realtime 경로 (포그라운드 – 정상 동작)

### 흐름

```
고객 배송 요청
  → notifyDriversForDelivery()
  → notifications 테이블 INSERT
  → Supabase Realtime (postgres_changes)
  → RealtimeDeliveryNotifications (WebView JS)
  → triggerVibration() + playDingDongSound() + toast
  → FlutterOverlayChannel.postMessage() → Flutter 오버레이
```

### 관련 파일

- `lib/actions/deliveries.ts`: `notifyDriversForDelivery`
- `components/driver/realtime-delivery-notifications.tsx`: Supabase Realtime 구독

### 동작 조건

- 앱이 **포그라운드**여야 함 (WebView JS 실행 중)
- Supabase Realtime 연결 유지
- `notifications` INSERT 시 `type` = `new_delivery_request` 또는 `new_delivery`, `delivery_id` 존재

### 백그라운드에서 안 되는 이유

앱이 백그라운드로 가면:

- WebView 일시정지, JS 실행 중단
- Realtime 연결 끊김 또는 일시 중지
- `FlutterOverlayChannel.postMessage` 호출 불가

---

## 2. FCM 경로 (백그라운드 – 목표 경로)

### 흐름

```
고객 배송 요청
  → notifyDriversForDelivery()
  → push/send API 호출 (PUSH_WEBHOOK_SECRET 필요)
  → driver_fcm_tokens에서 기사 토큰 조회
  → Firebase Admin (data-only 메시지) 전송
  → 기기 수신
  → DriverFcmService.onMessageReceived (Kotlin)
  → DispatchOverlayActivity (오버레이) 또는 FullScreenIntent
```

### 관련 파일

- `app/api/push/send/route.ts`: FCM 발송
- `driver_app/.../DriverFcmService.kt`: FCM 수신 및 오버레이 표시

---

## 3. Firebase 콘솔 테스트 – 백그라운드에서 오버레이 안 뜨는 이유

### 원인

Firebase 콘솔의 "Send test message"는 **기본적으로 notification + data**로 전송합니다.

- 앱이 백그라운드일 때:
  - Android가 **notification**만 처리하고 알림바에 표시
  - `onMessageReceived` 호출되지 않음
  - 따라서 Kotlin 로직(오버레이 등)이 실행되지 않음

### 해결

1. **앱을 포그라운드**에서 테스트
2. 또는 **data-only** 메시지로 테스트 (콘솔에서는 불가 → API/ cURL 사용)

```bash
# data-only 예시 (FCM_TROUBLESHOOTING.md 참고)
# notification 키를 포함하지 않음
```

---

## 4. 고객 요청 시 FCM 오버레이가 안 뜨는 원인 점검

서버는 **data-only**로 보내므로, 이론상 백그라운드에서도 `onMessageReceived`가 호출되어야 합니다.

### 체크리스트

#### 4.1 push/send가 실제로 호출되는지

- `PUSH_WEBHOOK_SECRET` 설정 여부
- `NEXT_PUBLIC_APP_URL` 또는 `VERCEL_URL` 설정 여부
- `deliveries.ts` 로그: `[기사알림-4] push/send 호출`

```typescript
// lib/actions/deliveries.ts:148
if (pushSecret && baseUrl) {
  // push/send 호출
} else {
  console.warn("[기사알림-4] PUSH_WEBHOOK_SECRET 또는 baseUrl 없음 — FCM 직접 호출 스킵")
}
```

#### 4.2 driver_fcm_tokens에 해당 기사 토큰이 있는지

- push/send가 `user_id`(기사 ID)로 `driver_fcm_tokens` 조회
- 없으면 `[push/send] FCM 토큰 없음 — 전송 생략`
- 기사 앱 최초 실행 시 `/api/driver/fcm-token`이 호출되어 토큰이 등록되어야 함

#### 4.3 FCM 발송 성공 여부

- 서버 로그: `[push/send] FCM 발송 결과` (successCount, failureCount)
- 실패 시: `[push/send] FCM 토큰별 실패` 로그

#### 4.4 기기 수신 여부

```bash
adb logcat -s DriverFcmService
```

- `onMessageReceived: data=...` → 기기까지 도달
- `skip (not dispatch)` → type/delivery_id 조건 미충족
- 아무 로그 없음 → FCM이 기기까지 안 옴

#### 4.5 user_id 매칭

- `find_nearby_drivers` 반환 driver_id
- `driver_fcm_tokens.user_id`
- 이 둘이 동일한 기사 ID여야 함

---

## 5. 종모양(NotificationBell)과의 관계

- `NotificationBell`은 레이아웃에서 **사용되지 않음** (Header/BottomNav에 없음)
- “종모양 클릭”이라 함은:
  - Realtime으로 뜬 **배송 알림 카드/토스트**를 클릭하는 흐름
  - 즉, Realtime 경로가 정상 동작할 때 보이는 UI를 의미
- 알림 목록 자체는 `useNotifications` + Supabase Realtime으로 표시되며, FCM과는 별개

---

## 6. 권장 확인 순서

1. **push/send 호출 여부**  
   - `[기사알림-4] push/send 호출` 로그 확인

2. **FCM 토큰 등록**  
   - Supabase `driver_fcm_tokens`에 해당 기사 row 존재 여부
   - 앱에서 `/api/driver/fcm-token` 호출 로그 확인

3. **FCM 발송 결과**  
   - `[push/send] FCM 발송 결과` successCount > 0 여부

4. **기기 수신**  
   - `adb logcat -s DriverFcmService`로 `onMessageReceived` 호출 여부 확인

5. **Firebase 프로젝트 일치**  
   - `google-services.json`의 `project_id`와 FCM 전송에 사용한 프로젝트 동일 여부
   - 앱 패키지 `com.quickhw.driver_app`이 Firebase에 등록되어 있는지 확인
