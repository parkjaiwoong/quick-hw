# FCM 테스트 시 메시지가 안 올 때

## 1. Firebase Console에서 보낼 때

**문제**: Firebase Console "Send test message"는 기본적으로 **notification + data** 조합입니다.  
앱이 백그라운드면 Android가 notification만 처리하고 `onMessageReceived`가 호출되지 않을 수 있습니다.

**해결**:
- **앱을 포그라운드(화면에 띄운 상태)**로 두고 테스트
- 또는 **data-only** 메시지를 보내야 함 → Firebase Console만으로는 data-only 전송이 어려우므로 **서버 API** 사용 권장

---

## 2. data 페이로드 형식 (필수)

DriverFcmService는 아래 조건을 만족해야 배차 오버레이를 띄웁니다:

| 키 | 값 예시 |
|----|---------|
| `type` | `new_delivery_request` 또는 `new_delivery` |
| `delivery_id` | 아무 문자열 (예: `test123`) |

이 두 개가 없으면 "skip" 처리되고, Dart 쪽으로만 전달됩니다.  
**테스트용이라면 반드시 포함**하세요.

---

## 3. 토큰 확인

- 로그에 찍힌 토큰을 **그대로 복사** (앞뒤 공백, 줄바꿈 없이)
- 토큰 형식: `xxxxxxxxx:APA91b...` (길게 이어짐)
- 토큰은 재시작·재설치 시 바뀔 수 있으므로 **최신 토큰** 사용

---

## 4. 네이티브 수신 여부 확인

메시지가 앱까지 도달했는지 확인:

```bash
# Kotlin (DriverFcmService) + Dart FCM 로그 모두 보기
adb logcat -s DriverFcmService:I FCM_BG:D FCM_FG:D flutter:I

# Kotlin만 보기
adb logcat -s DriverFcmService
```

**중요**: 앱이 백그라운드일 때 FCM 로그는 `flutter run` 터미널에 안 나옵니다. 반드시 `adb logcat`으로 확인하세요.

- `FCM onMessageReceived 진입` → 메시지 수신됨
- `skip (not dispatch)` → type/delivery_id 없음 (Dart로는 전달됨)
- 아무 로그 없음 → FCM이 아예 도달 안 함 (토큰/프로젝트/네트워크 점검)

---

## 5. data-only 테스트 (cURL 예시)

```bash
# 1) Firebase 프로젝트 서비스 계정 JSON에서 access token 발급
# 2) 아래 JSON으로 POST

curl -X POST "https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "여기에_FCM_토큰_전체_붙여넣기",
      "data": {
        "type": "new_delivery_request",
        "delivery_id": "test123"
      },
      "android": {
        "priority": "high"
      }
    }
  }'
```

**주의**: `notification` 키를 넣지 마세요.

---

## 6. 프로젝트/앱 일치 여부

- `google-services.json`의 `project_id`가 FCM 전송에 사용한 Firebase 프로젝트와 같아야 함
- 앱 패키지명 `com.quickhw.driver_app`이 Firebase Console에 등록돼 있어야 함
