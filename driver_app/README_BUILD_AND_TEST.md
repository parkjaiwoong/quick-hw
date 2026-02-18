# 기사 앱 빌드 및 실기기 테스트

## ⚠️ AndroidManifest / 네이티브 변경 후

**AndroidManifest.xml** 이나 **네이티브(Kotlin, Gradle, 리소스)** 설정을 수정했다면 **Hot Reload로 반영되지 않습니다.**

- 기기에서 **앱을 완전히 삭제**한 뒤
- **다시 설치**해서 확인하세요.

```bash
# 앱 삭제 후 실행 (실기기 연결 시)
flutter run
```

또는 APK로 설치한 경우: 설정 > 앱 > 언넌 > 저장공간 > 앱 삭제 후 `flutter run` 또는 `adb install ...` 로 재설치.

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
