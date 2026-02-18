# 배차 수락 Full Screen Intent (Android)

새 배송 요청(Order) 시 **앱이 꺼져 있거나 다른 앱을 사용 중이어도** 화면 전체에 **배차 수락 팝업**이 뜨도록 구현했습니다.

## 구조

1. **DriverFcmService** (Kotlin)  
   - FCM 수신 시 `type == "new_delivery_request"` 또는 `"new_delivery"` 이고 `delivery_id` 가 있으면  
   - **Full Screen Intent** 로 알림을 띄워 `DispatchAcceptActivity` 를 실행합니다.  
   - `FlutterFirebaseMessagingService` 를 상속해, 필요 시 Flutter 쪽 백그라운드 로직도 호출됩니다.

2. **DispatchAcceptActivity** (Kotlin)  
   - 잠금 화면/다른 앱 위에 전체 화면으로 표시됩니다.  
   - `showWhenLocked`, `turnScreenOn`, `FLAG_SHOW_WHEN_LOCKED` 등으로 화면을 켜고 잠금 화면 위에 표시합니다.  
   - **배차 수락** → `MainActivity` 를 띄우며 `accept_delivery_id` 로 전달.  
   - **거절** → 액티비티만 종료.

3. **MainActivity**  
   - `getLaunchAcceptDeliveryId` MethodChannel 로 Flutter 에 `delivery_id` 전달.  
   - Flutter 는 `?accept_delivery=ID` 로 웹뷰를 로드하고, 웹에서 `acceptDelivery(id)` 호출.

4. **권한 (AndroidManifest)**  
   - `USE_FULL_SCREEN_INTENT`  
   - `POST_NOTIFICATIONS` (Android 13+)  
   - `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`

## Android 12+ / 14+

- **USE_FULL_SCREEN_INTENT** 는 기본 허용이 아닐 수 있습니다.  
- 필요 시 **설정 > 앱 > 언넌 > 알림** 에서 “전체 화면 알림” 또는 “긴급 알림” 등을 켜야 할 수 있습니다.  
- 2024년 10월 이후 Play 정책에 따라, 알림/배차 같은 용도는 앱 내에서 권한 요청 또는 설정 이동 유도가 필요할 수 있습니다.

## 테스트

1. 기사를 배송 가능으로 두고, 고객이 주문/결제까지 완료합니다.  
2. 서버에서 해당 기사에게 FCM (`type: new_delivery_request`, `delivery_id` 포함) 을 보냅니다.  
3. 기사 앱을 **완전 종료** 하거나 **다른 앱**을 켠 상태에서 위 FCM 이 오면, 전체 화면 배차 수락 팝업이 떠야 합니다.  
4. **배차 수락** → 앱이 열리며 해당 배송이 수락 처리됩니다.

**빌드 절차·실기기 설치·권한 확인·상세 시나리오**는 프로젝트 루트의 [README_BUILD_AND_TEST.md](../README_BUILD_AND_TEST.md) 참고.
