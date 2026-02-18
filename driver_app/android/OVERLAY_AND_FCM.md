# 배차 오버레이 및 FCM 안내

앱이 **종료된 상태**에서 FCM 푸시를 받으면 **시스템 오버레이**(다른 앱 위에 뜨는 창)로 배차 정보와 슬라이드 수락 버튼을 표시합니다. 수락 시 오버레이가 닫히고 앱이 포그라운드로 전환되며 WebView에 지정 URL을 로드합니다.

---

## 1. Android 권한 설정

### AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<!-- 다른 앱 위에 오버레이(배차 수락 팝업) 표시 -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
```

- **SYSTEM_ALERT_WINDOW**: 다른 앱 위에 오버레이를 그리기 위해 필요. 선언만으로는 부족하고, **실제 사용 전에 런타임에 “다른 앱 위에 표시” 권한**을 사용자가 허용해야 합니다.
- **POST_NOTIFICATIONS**: Android 13+ 알림 표시.
- **USE_FULL_SCREEN_INTENT**: 오버레이 권한이 없을 때 대체로 사용하는 전체 화면 알림(Full Screen Intent)에 필요.

### 오버레이 권한 허용 방법

- **설정 > 앱 > 언넌 > 알림** 또는 **설정 > 앱 > 언넌 > 다른 앱 위에 표시** 에서 “다른 앱 위에 표시”를 켜야 오버레이가 동작합니다.
- 앱에서 설정 화면을 바로 열려면 Flutter에서 MethodChannel로 `openOverlayPermissionSettings`를 호출하면 됩니다.

---

## 2. FCM 데이터 페이로드 (서버 발송 형식)

### ⚠️ notification 없이 data만 보내기

**백그라운드/앱 종료 시에도 배차 오버레이(또는 Full Screen Intent)가 동작하려면, FCM 메시지는 반드시 notification 필드를 넣지 말고 data 필드만 채워서 보내야 합니다.**

- **notification 포함 시**: Android가 알림을 자동으로 띄우고, 우리 앱의 `DriverFcmService.onMessageReceived`로 메시지가 전달되지 **않을 수 있어** 오버레이가 뜨지 않습니다.
- **data만 보낼 때**: 앱이 백그라운드이거나 종료된 상태에서도 `onMessageReceived`가 호출되어 오버레이 또는 Full Screen Intent가 정상 동작합니다.

서버/관리자에서 푸시 발송 시 **data-only** 메시지로 보내주세요.

---

배차 오버레이를 띄우려면 FCM **data** 필드에 아래 키를 넣어 보냅니다.

| 키 | 필수 | 설명 |
|----|------|------|
| `type` | ✅ | `new_delivery_request` 또는 `new_delivery` |
| `delivery_id` | ✅ | 배차 ID (수락 시 열 URL 등에 사용) |
| `origin_address` 또는 `origin` | 권장 | 출발지 문자열 (오버레이에 표시) |
| `destination_address` 또는 `destination` | 권장 | 도착지 문자열 (오버레이에 표시) |
| `fee` 또는 `price` | 권장 | 요금 문자열 (오버레이에 표시) |

예시 (JSON):

```json
{
  "data": {
    "type": "new_delivery_request",
    "delivery_id": "123",
    "origin_address": "서울시 강남구 역삼동 123",
    "destination_address": "서울시 서초구 서초동 456",
    "fee": "15,000원"
  }
}
```

- `type` + `delivery_id`가 있으면 배차 처리(오버레이 또는 Full Screen Intent)를 시도합니다.
- 출발지/도착지/요금이 없으면 오버레이에는 "-"로 표시됩니다.

---

## 3. 수락 후 WebView에 로드되는 URL

- 오버레이에서 **슬라이드하여 수락**하면:
  - 오버레이가 닫힙니다.
  - MainActivity가 포그라운드로 실행되며, intent에 `open_url` = `"/driver?accept_delivery={delivery_id}"` 가 전달됩니다.
- Flutter는 `getLaunchOpenUrl`로 이 값을 읽어, **WebView에 `(웹 base URL) + open_url`** 을 로드합니다.
- 예: base가 `https://quick-hw.vercel.app` 이면 `https://quick-hw.vercel.app/driver?accept_delivery=123` 이 로드됩니다.
- 서버에서 다른 경로를 열고 싶다면, 네이티브에서 `EXTRA_OPEN_URL`에 원하는 경로(예: `/order/123`)를 넣어 주면 동일한 방식으로 해당 URL이 로드됩니다.

---

## 4. 백그라운드 핸들러 (Flutter / Android)

### 앱이 완전히 종료된 경우

- FCM은 **Android 쪽 DriverFcmService**에서만 수신됩니다. (Flutter 기본 FCM 서비스는 manifest에서 제거되어 있음)
- **오버레이 표시·슬라이드 수락·앱 실행·URL 전달**은 모두 **DriverFcmService + MainActivity**에서 처리합니다.
- Flutter 엔진이 뜨기 전이므로, 이 경로에서는 **Dart 백그라운드 핸들러가 호출되지 않습니다.**

### 앱이 백그라운드에만 있는 경우

- FCM 수신은 동일하게 DriverFcmService에서 처리됩니다.
- 오버레이 권한이 있으면 오버레이를 띄우고, 없으면 Full Screen Intent로 배차 수락 화면을 띄웁니다.
- Flutter 쪽 `firebaseMessagingBackgroundHandler`는 **별도 isolate**에서 호출될 수 있습니다. 이 핸들러는 로그/보조 진동 등에만 사용하고, **배차 UI(오버레이/전체화면)는 네이티브에서만 담당**합니다.

### Flutter 백그라운드 핸들러 등록 (main.dart)

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await _runApp();
}
```

- `firebaseMessagingBackgroundHandler`는 `fcm_service.dart`에 정의되어 있으며, **새 배송 요청(type)** 일 때만 진동 등 보조 동작을 합니다.
- 실제 “배차 수락 창”은 Android 네이티브 오버레이(또는 Full Screen Intent)로만 표시됩니다.

### Entry Point 설정 (`@pragma('vm:entry-point')`)

백그라운드 핸들러는 **별도 isolate(별도 메모리)**에서 실행됩니다. 이때 `@pragma('vm:entry-point')`를 붙이지 않으면 VM이 해당 함수를 최적화·제거해, 네이티브에서 Dart 코드를 찾지 못해 **실행되지 않을 수 있습니다.**  
`fcm_service.dart`의 `firebaseMessagingBackgroundHandler`에는 반드시 아래처럼 붙여 두세요.

```dart
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // ...
}
```

(오버레이 **화면 UI** 자체는 Kotlin에서 그리므로 Dart entry point는 백그라운드 핸들러에만 필요합니다.)

---

## 5. 동작 요약

| 상황 | 동작 |
|------|------|
| 오버레이 권한 있음 + 앱 종료/백그라운드 | FCM 수신 시 **시스템 오버레이** 표시 (출발지/도착지/요금 + 슬라이드 수락) |
| 오버레이 권한 없음 + 앱 종료/백그라운드 | FCM 수신 시 **Full Screen Intent** 로 기존 배차 수락 Activity 표시 |
| 수락 버튼/슬라이드 수락 | 오버레이(또는 Activity) 닫힘 → MainActivity 실행 → Flutter가 `getLaunchOpenUrl` / `getLaunchAcceptDeliveryId` 로 URL 받아 WebView 로드 |

이 문서는 `FULL_SCREEN_INTENT_README.md`의 오버레이 확장으로, 오버레이 UI·권한·FCM 페이로드·백그라운드 처리 흐름을 정리한 것입니다.
