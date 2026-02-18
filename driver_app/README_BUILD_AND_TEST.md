# 기사 앱 빌드 및 실기기 테스트

## ⚠️ AndroidManifest / 네이티브 변경 후

**AndroidManifest.xml** 이나 **네이티브(Kotlin, Gradle, 리소스)** 설정을 수정했다면 **Hot Reload로 반영되지 않습니다.**

**Kotlin 빌드 오류** (IllegalArgumentException, "different roots", incremental caches): 프로젝트가 D: 드라이브이고 Pub 캐시가 C:에 있으면 증분 컴파일에서 실패할 수 있음. `android/gradle.properties`에 `kotlin.incremental=false`가 설정되어 있으면 해소됨. `flutter clean` 후에는 반드시 `flutter pub get`을 먼저 실행한 뒤 빌드할 것.

- 기기에서 **앱을 완전히 삭제**한 뒤
- **다시 설치**해서 확인하세요.

```bash
# 앱 삭제 후 실행 (실기기 연결 시)
flutter run
```

또는 APK로 설치한 경우: 설정 > 앱 > 언넌 > 저장공간 > 앱 삭제 후 `flutter run` 또는 `adb install ...` 로 재설치.

---

## '다른 앱 위에 표시' 권한 호출 위치

- **호출**: `requestOverlayPermissionWithDialog(context)` (main.dart)
- **위치**: **initState** 안 `WidgetsBinding.instance.addPostFrameCallback` → **800ms 후** 한 번만 호출 (배송 가능 버튼과 무관).
- **동작**: `FlutterOverlayWindow.isPermissionGranted()`로 확인 후, 미허용 시 다이얼로그 → [확인] 시 `FlutterOverlayWindow.requestPermission()`으로 설정 화면 이동.
- 로그: `[오버레이] 권한 체크 시작`, `[오버레이] 현재 권한 상태: true/false` 로 추적 가능.

---

## 1. 빌드

### APK (실기기 테스트용)

```bash
cd driver_app
flutter pub get
flutter build apk --release
```

생성 파일: `build/app/outputs/flutter-apk/app-release.apk`

### App Bundle (Play Store 업로드용)

```bash
flutter build appbundle --release
```

생성 파일: `build/app/outputs/bundle/release/app-release.aab`

---

## 2. 실기기 설치

1. **USB 디버깅** 켜기: 설정 > 개발자 옵션 > USB 디버깅
2. 기기 연결 후:
   ```bash
   flutter install
   ```
   또는 APK 직접 설치:
   ```bash
   adb install build/app/outputs/flutter-apk/app-release.apk
   ```

---

## 3. 권한·설정 확인 (Full Screen Intent 동작을 위해)

1. **알림 권한**  
   - 앱 첫 실행 시 또는 설정 > 앱 > 언넌 > 알림 에서 **알림 허용** 확인.

2. **전체 화면 알림(Full Screen Intent)**  
   - 설정 > 앱 > 언넌 > 알림 에서  
     **"전체 화면 알림"** 또는 **"긴급 알림"** 등이 있으면 **켜기**.  
   - 기기/OS 버전에 따라 이름이 다를 수 있음 (Android 12+).

3. **배터리 최적화**  
   - FCM 수신이 잘 되도록, 필요 시 설정 > 앱 > 언넌 > 배터리 에서  
     **제한 없음** 또는 **최적화 안 함** 으로 설정.

---

## 4. 테스트 시나리오 (배차 수락 Full Screen Intent)

| 순서 | 단계 | 확인 사항 |
|------|------|-----------|
| 1 | 기사를 **배송 가능** 상태로 둠 | 웹/관리자에서 기사 상태 확인 |
| 2 | 고객이 **주문·결제** 완료 | 해당 기사에게 배차 생성·FCM 발송됨 |
| 3 | 기사 앱 **완전 종료** 또는 **다른 앱** 사용 중 | 홈으로 나가거나 다른 앱 실행 |
| 4 | 서버에서 FCM 발송 (`type: new_delivery_request` 또는 `new_delivery`, `delivery_id` 포함) | 로그/서버에서 발송 확인 |
| 5 | **전체 화면 배차 수락 팝업** 표시 | 잠금 화면/다른 앱 위에 팝업 노출, 소리·진동 |
| 6 | **배차 수락** 탭 | 앱이 열리며 해당 배송 수락 처리, 웹뷰에 해당 배송 반영 |
| 7 | (선택) **거절** 탭 | 팝업만 닫히고 앱은 열리지 않음 |

### 포그라운드 동작

- 앱이 **열려 있는** 상태에서 같은 FCM이 오면 **전체 화면 팝업은 뜨지 않고**, 앱 내에서 **진동**만 발생할 수 있음 (의도된 동작).

---

## 5. 문제 해결

- **팝업이 안 뜨는 경우**  
  - 알림 권한, 전체 화면 알림 권한 확인.  
  - 배터리 최적화 해제.  
  - FCM payload에 `type`, `delivery_id` 포함 여부 확인.  
  - `adb logcat` 에서 `DriverFcmService`, `DispatchAccept` 로그 확인.

- **수락 후 앱이 해당 배송으로 안 열리는 경우**  
  - MainActivity → Flutter MethodChannel `getLaunchAcceptDeliveryId` 전달 확인.  
  - 웹뷰 URL `?accept_delivery=ID` 및 웹 쪽 `acceptDelivery(id)` 호출 확인.

자세한 Full Screen Intent 구조는 `android/FULL_SCREEN_INTENT_README.md` 참고.

---

## 6. FCM 수신 로그 확인 (adb logcat)

앱을 **완전히 끈 상태**에서 FCM을 보냈을 때, 수신 여부를 확인하려면 **adb logcat**으로 로그를 봅니다.

### 1) 기기 연결 후 로그 실시간 보기

```bash
# FCM 관련 네이티브 로그만 보기 (앱 종료 상태에서도 찍힘)
adb logcat -s DriverFcmService:D

# 여러 태그 함께 보기
adb logcat DriverFcmService:D flutter:D *:S
```

- **DriverFcmService**: FCM이 도착하면 항상 `onMessageReceived`가 호출되며, 여기서 `Log.d(TAG, ...)` 로그가 찍힙니다. **앱이 꺼져 있어도** 시스템이 서비스를 깨우므로 이 로그는 확인할 수 있습니다.
- **flutter**: Flutter 쪽 `print`/`debugPrint` (백그라운드 핸들러 등)는 **디버그 빌드**에서만 보입니다. 앱이 완전 종료된 뒤 FCM으로 엔진이 다시 뜨는 경우에도 flutter 태그로 나올 수 있습니다.

### 2) 확인 순서

1. **앱 완전 종료**: 최근 앱에서 스와이프로 제거하거나, 설정 > 앱 > 언넌 > 강제 종료.
2. **로그 필터 켜기**: 터미널에서 `adb logcat -s DriverFcmService:D` 실행.
3. **서버/테스트 도구로 FCM 전송** (data만, notification 없이).
4. **로그 확인**:
   - `onMessageReceived: data=...` → FCM이 기기까지 도착함.
   - `Dispatch FCM: type=... delivery_id=...` → 배차 타입으로 처리됨.
   - `skip (not dispatch)` → 배차 타입이 아니라 상위로 넘김.

### 3) 로그 버퍼 지우고 다시 보기

```bash
adb logcat -c
adb logcat -s DriverFcmService:D
```

FCM 보낸 직후 로그만 깔끔하게 볼 때 유용합니다.
