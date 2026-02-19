# 오버레이 버튼 → WebView 세션 끊김 분석

## 현상
- 테스트 버튼(알림 아이콘)으로 오버레이를 띄우면 WebView 세션이 끊기고 로그인 화면으로 튕김
- FCM 핸들러 미작동과 연관 가능성

---

## 1. Main Isolate vs Overlay Isolate 데이터 충돌

### 구조
- **메인 앱**: MainActivity → FlutterEngine(main) → `main()` → `runApp(DriverApp)` → WebView
- **오버레이**: `flutter_overlay_window` 플러그인 → OverlayService → FlutterEngineCache 엔진 → `overlayMain()` → `runApp(OverlayApp)`

두 엔진은 **완전히 분리**됨. 메모리/변수 공유 없음.

### 데이터 전달
- `shareData()`: 메인 → 오버레이 (BasicMessageChannel)
- `overlayListener`: 오버레이에서 `shareData`로 보낸 데이터 수신
- `_overlayChannel` (com.quickhw.driver_app/overlay): **DispatchOverlayActivity에만** 등록됨
  - 플러그인 오버레이(OverlayService) 사용 시 이 채널의 **네이티브 핸들러가 없음**
  - `getPayload` / `accept` / `dismiss` 호출 시 실패 또는 무시

**결론**: 데이터 충돌 없음. 다만 `_overlayChannel`이 플러그인 오버레이에서는 동작하지 않음.

---

## 2. showOverlay 호출 시 앱 전체 Reload 여부

### flutter_overlay_window 동작
- `showOverlay()` → `context.startService(OverlayService)` (새 Activity 아님)
- OverlayService는 **포그라운드 서비스**로 WindowManager에 FlutterView 추가
- MainActivity는 **종료/재시작되지 않음** (서비스 시작만 함)

### 단, 알림 PendingIntent 문제
OverlayService.java:331:
```java
Intent notificationIntent = new Intent(this, FlutterOverlayWindowPlugin.class);
PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, ...);
```
- `FlutterOverlayWindowPlugin`은 **Activity가 아님**
- 알림 탭 시 `ActivityNotFoundException` 가능
- 일부 기기/버전에서 fallback으로 **MainActivity 재시작**할 수 있음 → WebView 초기화 → 세션 끊김

---

## 3. FCM 초기화 시 WebView/세션 초기화 여부

점검 결과:
- `FcmService.initialize()`: `getToken()`, `requestPermission()` 등만 호출
- WebViewController, WebView, 쿠키, 세션을 건드리는 로직 **없음**

**결론**: FCM 초기화는 WebView/세션과 무관.

---

## 4. SharedPreferences 동시 접근 락

### 사용처
- `DriverAvailabilityStorage`: `SharedPreferences` (메인 앱의 AvailabilityChannel에서만 사용)
- 오버레이: `OverlayAlertService`(진동/알림음), `_getOverlayPayload`(MethodChannel/overlayListener) → **SharedPreferences 미사용**

**결론**: 오버레이와 메인 앱이 SharedPreferences를 동시에 쓰지 않음. 락 가능성 낮음.

---

## 5. 추가 원인 후보

### (A) WebView 가시성/visibility
- 오버레이가 올라오면 메인 화면이 가려짐 → WebView `onPause` / visibility 변경 가능
- 웹 앱(Supabase 등)이 visibility 변경 시 세션/연결을 끊거나 로그인 화면으로 리다이렉트할 수 있음

### (B) 거절/수락 시 overlay 닫기 미동작
- 현재 `_dismiss` / `_accept`는 `_overlayChannel.invokeMethod()`만 호출
- 플러그인 오버레이 사용 시 해당 채널에 핸들러가 없어 **실제로 overlay가 닫히지 않음**
- 사용자가 알림 등 다른 경로로 앱에 돌아올 때, 의도치 않은 흐름으로 MainActivity가 새로 뜰 수 있음

### (C) 알림 ContentIntent
- 알림의 ContentIntent가 잘못된 클래스를 가리켜, 탭 시 예외 또는 예기치 않은 Activity 시작 → MainActivity 재생성 가능

---

## 6. 권장 수정 사항

1. **거절/수락 시 `FlutterOverlayWindow.closeOverlay()` 호출**
   - `_dismiss`, `_accept` 내부에서 `_overlayChannel` 호출에 더해 `closeOverlay()` 반드시 호출

2. **수락 시 메인 앱으로 복귀 및 URL 로드**
   - `_overlayChannel`이 없는 환경(플러그인 오버레이)에서는 `url_launcher` 등으로 딥링크 처리
   - 또는 main ↔ overlay 간 BasicMessageChannel로 "accept + URL" 전달 후, 메인에서 `loadRequest` 호출

3. **알림 PendingIntent**
   - 플러그인 수정이 어렵다면, 앱에서 별도 브로드캐스트/알림으로 대체 검토
   - 가능하다면 플러그인 포크에서 ContentIntent를 MainActivity로 변경

4. **웹 앱 측**
   - visibility 변경 시 세션을 끊지 않도록 확인
   - Supabase 등 클라이언트의 reconnect 정책 점검

---

## 7. 적용된 수정

- **_dismiss 시 `FlutterOverlayWindow.closeOverlay()` 호출 추가**
  - 거절 버튼 탭 시 플러그인 오버레이가 확실히 닫히도록 함
  - 알림을 탭하지 않아도 돌아갈 수 있어, 잘못된 ContentIntent로 인한 재시작 가능성 감소
