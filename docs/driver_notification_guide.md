# 기사 앱/웹 "신규 요청 알림"이 안 올 때

고객이 기사 연결 요청·결제를 했는데 기사 화면에 **띵동/진동/알림이 안 온다**면, 아래 두 가지를 구분해서 확인하세요.

---

## 로그로 흐름 검증 (고객 요청 → 기사 수신 UI/진동/소리)

테스트 시 **서버 로그**와 **기사 측 로그**를 아래 순서대로 확인하면, 어느 단계에서 끊기는지 바로 알 수 있습니다.

| 단계 | 위치 | 로그 태그 | 확인 내용 |
|------|------|-----------|-----------|
| 1 | 결제 확정 API | `[결제확인]` / `[결제확인-POST]` | `기사 알림 트리거` { deliveryId } → `기사 알림 완료` |
| 2 | 결제→기사 | `[결제→기사]` | `notifyDriversAfterPayment 시작` → `notifyDriversForDelivery 호출` (좌표 있음) |
| 3 | 알림 생성 | `[기사알림-1]` | `notifyDriversForDelivery 시작` { deliveryId, pickupLat, pickupLng } |
| 4 | 알림 생성 | `[기사알림-2]` | 근처 기사 수 / 배송가능 기사로 대체, driverIds 배열 |
| 5 | 알림 생성 | `[기사알림-3]` | `notifications INSERT 성공` { deliveryId, driverCount, driverIds } |
| 6 | 푸시 전송 | `[기사알림-4]` | 각 driverId별 `push/send 호출` { status, body } (실패 시 `push/send 호출 실패`) |
| 7 | push/send API | `[push/send]` | `요청 수신` { **source**: `webhook` \| `server`, userId, deliveryId } → `FCM 토큰 조회` → `FCM 발송 결과` |
| 8 | 기사 웹(Realtime) | `[기사-Realtime]` | 브라우저 콘솔: `INSERT 수신` { notificationId, deliveryId, type } → `UI/진동/소리 실행` { deliveryId } |
| 9 | 기사 Flutter 앱 | FCM 로그 | 포그라운드: `[FCM] 📩 포그라운드 메시지 수신` / 백그라운드: `[FCM] 🔔 백그라운드 메시지 수신` (logcat) |

**정상 시나리오**: 1→2→3→4→5→6→7 까지 서버에서 순서대로 출력되고, 8은 기사가 **웹/WebView**로 대시를 열어 둔 경우, 9는 **Flutter 앱**으로 FCM 토큰이 등록된 경우 각각 확인됩니다.  
**끊기는 단계**에서 로그가 없거나 에러가 나오면, 해당 단계(결제 redirect vs POST, 서비스 키, 근처 기사 0명, 웹훅/직접 push 미설정, FCM 토큰 없음, Realtime 미구독 등)를 위 표와 가이드 아래 항목으로 점검하면 됩니다.

---

## 웹훅·백그라운드 수신 확인 (기사 앱 백그라운드 시 UI/소리/진동)

### 웹훅이 호출되는지 확인

`notifications` INSERT 시 **Supabase Database Webhook**이 `/api/push/send`를 호출하면, 서버 로그에 **source: webhook** 이 찍힙니다.

- **서버 로그** (Vercel Functions 또는 로컬 터미널)에서 `[push/send] 요청 수신` 다음에 **`source: "webhook"`** 이 있으면 웹훅 경로로 들어온 요청입니다.
- **`source: "server"`** 는 우리 서버가 `notifyDriversForDelivery` 안에서 직접 `/api/push/send`를 호출한 경우입니다.
- 웹훅을 설정했다면 INSERT 한 건당 웹훅 1회 + 서버 직접 1회가 될 수 있어, 같은 기사에게 **webhook** 로그와 **server** 로그가 둘 다 나올 수 있습니다. 둘 중 하나만 나와도 FCM은 전송된 것입니다.

**웹훅이 안 나올 때**: Supabase Dashboard → Database → Webhooks 에서 `notifications` 테이블 **Insert** 이벤트로 `https://(도메인)/api/push/send` 가 등록돼 있는지, 헤더 `x-webhook-secret` 값이 `PUSH_WEBHOOK_SECRET`과 동일한지 확인하세요.

### 백그라운드에서 기사 앱이 수신·소리·진동하는지 확인

기사가 **배송 가능** 상태에서 앱을 **홈으로 내리거나 다른 앱**으로 보낸 뒤, 고객이 배송 요청·결제를 하면:

1. **기기 시스템 알림**: 알림창(트레이)에 "새로운 배송 요청" 등이 떠야 하고, **소리**와 **진동**이 나야 합니다. (FCM의 `notification` + Android 채널 `delivery_request` 사용)
2. **Flutter 백그라운드 로그**: Android는 `adb logcat | grep FCM` 또는 Android Studio Logcat에서 `[FCM]` 필터 시  
   `[FCM] 🔔 백그라운드 메시지 수신 (배송가능 시 UI/소리/진동 확인)`  
   `[FCM]   delivery_id: ...`  
   `[FCM] 🔔 백그라운드 진동 실행`  
   이 순서로 나오면 백그라운드 핸들러까지 도달한 것입니다.
3. 알림을 **탭**하면 앱이 열리고 해당 배송 화면으로 이동할 수 있어야 합니다.

**백그라운드에서 소리/진동이 안 날 때**:  
- 기사 앱을 한 번이라도 실행해 두면 `MainActivity`에서 `delivery_request` 알림 채널이 생성됩니다.  
- 기기 설정 → 앱 → 언넌(기사 앱) → 알림 → **배송 요청 알림** 채널이 있고, 소리/진동이 켜져 있는지 확인하세요.

---

## 결제 완료 후 기사 앱 로그가 안 나올 때

고객이 결제까지 했는데 **기사 앱(Flutter) 로그에 `[FCM] 📩 포그라운드 메시지 수신` 등이 전혀 안 뜨면**, 알림이 **기사 앱까지 도달하지 않은** 상태입니다.

1. **Supabase Database Webhook**이 `notifications` INSERT 시 `/api/push/send`를 호출하도록 설정돼 있는지 확인하세요. 없으면 FCM이 전송되지 않습니다.
2. **Vercel** 환경 변수에 `FIREBASE_SERVICE_ACCOUNT_JSON`, `PUSH_WEBHOOK_SECRET`이 설정돼 있는지 확인하세요.
3. 해당 기사의 **FCM 토큰**이 `driver_fcm_tokens`에 저장돼 있는지(기사가 앱에서 한 번이라도 로그인했는지) 확인하세요.
4. **Realtime**은 WebView(React) 쪽이라 Flutter 로그에는 안 찍힙니다. Realtime으로 오는 알림은 기사 웹 화면의 "알림 N건 수신" 등으로만 확인 가능합니다.

---

## 결제 완료 → 기사 화면 UI/소리/진동 점검 (흐름 요약)

1. **고객 결제 완료** → `POST /api/payments/confirm` → `notifyDriversAfterPayment(deliveryId)` 호출  
2. **서버** → `notifyDriversForDelivery()` → 근처/배송가능 기사에게 **`notifications` 테이블 INSERT**  
3. **기사 앱에 도달하는 경로 두 가지**
   - **앱을 열어 둔 상태**: **Supabase Realtime**이 `notifications` INSERT를 구독 → WebView(React)에서 **모달 + 띵동 소리 + 진동** (한 번 터치 후 소리 재생 가능). Flutter 앱은 **포그라운드 FCM 수신 시 네이티브 진동** 추가로 수행.
   - **앱을 닫은 상태**: **Supabase Database Webhook**이 `notifications` INSERT 시 **`/api/push/send`** 호출 → **FCM** 전송 → 기기 시스템 알림 + 탭 시 앱 열림.

**UI/소리/진동이 안 될 때 확인할 것**

| 순서 | 확인 항목 | 조치 |
|------|-----------|------|
| 1 | Realtime에 `notifications` 포함 여부 | Supabase SQL Editor에서 `scripts/055_verify_realtime_notifications.sql` 실행 |
| 2 | 기사가 배송 가능인지 | 기사 대시에서 "배송 가능" 토글 켜기 |
| 3 | 웹훅으로 FCM 전송되는지 | Supabase Database Webhooks에서 `notifications` INSERT → `https://(도메인)/api/push/send`, 헤더 `x-webhook-secret` = `PUSH_WEBHOOK_SECRET` |
| 4 | Flutter 앱 진동 | Android: `AndroidManifest.xml`에 `VIBRATE` 권한, 앱에서 포그라운드 FCM 수신 시 진동 (이미 반영됨) |
| 5 | WebView 소리 | 기사 화면에서 **한 번 터치** 후 배송 요청 시 띵동 재생 (자동재생 정책) |

---

## 1. 기사 화면(웹 또는 앱)을 **열어 둔 상태**인데도 안 올 때

이때는 **Supabase Realtime**으로 알림이 옵니다. 브라우저/앱이 `notifications` 테이블 INSERT를 구독하고 있어야 띵동·진동·팝업이 뜹니다.

### 확인할 것

1. **Realtime publication 적용 여부**  
   Supabase에서 `notifications` 테이블이 Realtime에 포함돼 있어야 합니다.
   - **Supabase Dashboard** → **SQL Editor**에서 **`scripts/055_verify_realtime_notifications.sql`** 내용 실행 (포함 여부 확인 + 없으면 추가)
   - 또는 **Database** → **Replication**에서 `supabase_realtime`에 **`public.notifications`** 가 있는지 확인
   - 기사 웹(`/driver`)에서 "실시간 알림 연결 실패" 배너가 보이면 Realtime 미포함이므로 위 스크립트 실행

2. **알림을 받을 기사 조건**  
   배송 요청 시 "근처 기사" 또는 "배송 가능(is_available)인 기사"에게만 `notifications`가 INSERT됩니다.
   - 기사가 **배송 가능** 토글이 켜져 있는지 확인
   - 테스트 시 같은 지역(근처)이거나, 근처 기사가 없으면 "배송 가능한 전체 기사"에게 가므로, 해당 기사가 한 명이라도 있으면 그 기사에게 INSERT됨

3. **모바일에서 확인 (F12 없음)**  
   기사 웹(`/driver`) 화면 **맨 위**를 보세요.
   - **「실시간 알림 연결됨」** (초록 점 + 문구) → 구독은 된 상태.
   - **「알림 N건 수신」** → 고객이 요청·결제한 뒤 이 숫자가 **1 이상으로 늘어나면** 이벤트는 도착한 것입니다. 모달/소리/진동만 확인하면 됨.
   - **연결됨인데 "알림 0건 수신"이 계속이면** → Realtime 이벤트가 기사 앱까지 안 오는 상황. (같은 Wi‑Fi/네트워크, Supabase Realtime publication, 필터 `user_id` 확인.)
   - **「실시간 알림 연결 중…」** 이 계속 보이면 → 구독이 안 된 상태. 새로고침 후 다시 확인.
   - **「실시간 알림 연결 실패」** (노란 배너) → Realtime 설정 문제. PC에서 Supabase SQL 실행 또는 관리자 문의.
   - **PC에서만** F12 → Console로 상세 로그 확인 가능.

4. **DB에는 알림 row가 있는데 띵동/진동/모달이 안 뜰 때 (이벤트는 오는데 UI·소리만 막힌 경우)**  
   - **브라우저 알림 권한**: "알림 허용" 배너가 보이면 **알림 허용** 버튼을 눌러 주세요. 다른 앱(카카오 등) 사용 중에도 시스템 알림을 받을 수 있습니다.
   - **소리(자동재생 정책)**: 기사 화면에서 **한 번이라도 화면을 터치**해 두면, 그 다음부터 새 배송 요청 시 띵동 소리가 납니다. (브라우저는 사용자 제스처 후에만 소리 재생을 허용합니다.)
   - **포커스/탭 전환**: 카카오 등 다른 앱 갔다가 돌아오면 Realtime이 끊겨 "연결 실패"로 바뀔 수 있습니다. 기사 앱으로 돌아오면 자동으로 재연결을 시도하고, 그동안 온 미확인 요청이 있으면 모달로 한 건 표시됩니다.

5. **개발 환경에서 UI/진동/소리 반복 테스트 (10~20회)**  
   - 기사 웹(`/driver`) 로그인 후 **「실시간 알림 연결됨」**이 보일 때까지 대기.
   - 화면을 **한 번 터치**해 두어 소리 재생이 허용된 뒤, **「테스트 알림 (개발)」** 버튼을 10~20회 눌러 보세요.
   - 매번 **모달 표시**, **진동**(기기 지원 시), **띵동 소리**, **토스트**가 나오는지 확인.
   - 실패한 회차가 있으면: 해당 시점의 화면(포커스/탭 전환 여부), 브라우저 콘솔 오류, 기기(실기/에뮬레이터)를 기록해 두면 원인 파악에 도움이 됩니다.

6. **지도에 "내 위치"가 안 나올 때 (실시간 알림과 별개)**  
   배송 상세 지도에서 "내 위치"는 브라우저 **위치 권한**과 GPS/네트워크에 따라 표시됩니다.  
   - 오류 메시지가 보이면: **위치 다시 가져오기** 버튼으로 재시도하세요.  
   - "위치 권한이 거부되었습니다" → 브라우저(또는 기기) 설정에서 이 사이트의 **위치** 권한을 허용해 주세요.  
   - "위치 조회 시간이 초과" → 실내/지하에서는 GPS가 느릴 수 있습니다. 창가나 야외에서 다시 시도하세요.  
   - HTTPS가 아닌 주소(http)로 접속하면 일부 브라우저에서는 위치가 동작하지 않을 수 있습니다.

---

## 2. 기사 앱/웹을 **완전히 닫은 상태**에서도 알림 받고 싶을 때 (카카오 픽처럼)

탭을 닫거나 앱을 종료한 뒤에는 **JavaScript가 돌지 않기 때문에** Realtime만으로는 알림을 줄 수 없습니다.  
**카카오 픽·퀵배송 앱처럼** "앱을 닫아도 알림이 오고, 탭하면 해당 화면이 열리게" 하려면 **푸시 알림(Web Push 또는 FCM)** 설정이 필요합니다.

| 사용하는 것 | 필요한 설정 |
|-------------|-------------|
| **기사 웹** (브라우저 탭 닫음) | Web Push: VAPID 키 + Supabase **Database Webhook** → `/api/push/send` 호출 |
| **기사 앱** (Flutter, 앱 종료/백그라운드) | FCM: Firebase 설정 + 같은 **Database Webhook** + FCM 토큰 등록 |

즉, **앱/탭을 닫아도** 소리·진동을 받으려면:

1. **Supabase Database Webhook**을 반드시 설정해야 합니다.  
   - `notifications` 테이블에 **INSERT**될 때  
   - 우리 서버의 **`https://(도메인)/api/push/send`** 를 호출하도록 설정  
   - 자세한 절차: **`docs/push_notifications_setup.md`** 참고

2. **기사 웹**만 쓸 때:  
   - VAPID 공개/비공개 키 발급 후 환경 변수 설정  
   - 기사가 `/driver` 접속 시 "알림 허용" 후 한 번이라도 로드되어야 Web Push 구독이 등록됨

3. **기사 Flutter 앱**을 쓸 때:  
   - Firebase 프로젝트 + `FIREBASE_SERVICE_ACCOUNT_JSON` 환경 변수  
   - 앱에서 로그인 후 FCM 토큰을 `/api/driver/fcm-token`으로 등록  
   - 푸시 알림을 **탭했을 때** 해당 배송 상세 화면(`/driver/delivery/[id]`)으로 열리도록 앱에서 딥링크 처리하면, "앱을 닫아도 알림 → 탭하면 모달/상세처럼 해당 화면" 동작을 만들 수 있습니다.

요약하면, **"앱 화면을 닫더라도 소리·진동·모달처럼 보이게"** 하려면 **Webhook + Web Push 또는 FCM**이 필요하고, 알림 탭 시 해당 배송 화면으로 여는 처리를 하면 카카오 픽과 비슷한 흐름이 됩니다.  
이 설정이 없으면 **화면을 열어 둔 상태에서만** Realtime으로 띵동·진동·모달이 동작합니다.

---

## 빠른 체크리스트

| 확인 항목 | 설명 |
|-----------|------|
| Realtime publication | Supabase에서 `notifications` 테이블이 Realtime에 포함되어 있는지 |
| 기사 배송 가능 | 기사가 "배송 가능" 상태인지 |
| 웹훅 설정 | Supabase Webhook으로 `notifications` INSERT 시 `/api/push/send` 호출되는지 |
| 탭 닫았을 때 (웹) | VAPID 키 + `PUSH_WEBHOOK_SECRET` 설정, 기사가 알림 허용 후 /driver 접속했는지 |
| 앱 닫았을 때 (Flutter) | `FIREBASE_SERVICE_ACCOUNT_JSON` 설정, 앱에서 FCM 토큰 등록했는지 |

상세 설정 절차는 **`docs/push_notifications_setup.md`** 를 참고하세요.

---

## 모바일에서 확인하는 방법 (F12 없이)

스마트폰에서는 개발자 도구(F12)를 쓸 수 없습니다. **기사 웹 화면만 보면 됩니다.**

1. 기사로 로그인 후 **배송 관리(기사 메인)** 화면을 엽니다.
2. 화면 **맨 위**에 실시간 알림 상태가 표시됩니다.
   - **초록색 「실시간 알림 연결됨」** → 정상. 배송 요청 시 띵동·진동이 옵니다.
   - **회색 「실시간 알림 연결 중…」** → 잠시 기다리거나 페이지를 새로고침한 뒤 다시 확인.
   - **노란색 「실시간 알림 연결 실패」** → 설정 문제입니다. PC에서 Supabase 설정을 확인하거나 관리자에게 문의하세요.

PC에 USB로 연결한 뒤 Chrome **원격 디버깅**을 사용하면 모바일 브라우저의 콘솔 로그도 볼 수 있지만, 보통은 위 화면 표시만 보면 됩니다.
