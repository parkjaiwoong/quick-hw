# 기사 앱 FCM 페이로드 규격 (오버레이용)

오버레이(배차 수락 팝업)를 띄우려면 **`notification` 키를 넣지 말고, `data` 키만 사용**하고 **Android에서 `priority: "high"`** 를 설정해야 합니다.

- `notification` 이 있으면 Android가 시스템 트레이 알림을 먼저 처리하고, 앱의 `onMessageReceived` / Flutter 백그라운드 핸들러가 호출되지 않을 수 있습니다.
- **data-only** + **priority: high** 로 보내면 앱이 백그라운드/종료 상태여도 `onMessageReceived` 가 호출되고, Flutter에서 오버레이를 띄울 수 있습니다.

---

## 현재 서버 구현 확인

`app/api/push/send/route.ts` 에서는 이미 **notification 없이 data만** 전송하고 있습니다.

- `messaging.sendEachForMulticast({ data: { ... }, android: { priority: "high" } })` 만 사용
- **`notification` 키는 포함되어 있지 않음** → 오버레이 요구사항 충족

---

## 서버 개발자용 FCM JSON 샘플

### 1) Firebase Admin SDK (Node.js) 사용 시

```js
const res = await getMessaging().sendEachForMulticast({
  tokens: ["<FCM_DEVICE_TOKEN>"],
  data: {
    type: "new_delivery_request",
    delivery_id: "<delivery_uuid>",
    title: "신규 배차 요청",
    body: "배송 요청이 도착했습니다.",
    url: "https://your-domain.com/driver/delivery/<delivery_uuid>",
  },
  android: {
    priority: "high",
  },
  // notification 필드는 절대 넣지 않음
})
```

### 2) FCM HTTP v1 API (REST) 사용 시

**POST** `https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`

**Headers:** `Authorization: Bearer <OAuth2_ACCESS_TOKEN>`, `Content-Type: application/json`

**Body (JSON):**

```json
{
  "message": {
    "token": "<FCM_DEVICE_TOKEN>",
    "data": {
      "type": "new_delivery_request",
      "delivery_id": "<delivery_uuid>",
      "title": "신규 배차 요청",
      "body": "배송 요청이 도착했습니다.",
      "url": "https://your-domain.com/driver/delivery/<delivery_uuid>"
    },
    "android": {
      "priority": "high"
    }
  }
}
```

**주의:** `message` 안에 **`notification` 키를 넣지 마세요.**

---

## data 키 규격 (앱과 약속)

| 키 (snake_case) | 필수 | 설명 |
|-----------------|------|------|
| `type` | 권장 | `new_delivery_request` 또는 `new_delivery` |
| `delivery_id` | **필수** | 배송 ID (오버레이 수락 시 사용) |
| `title` | 선택 | 제목 (오버레이 제목에 활용 가능) |
| `body` | 선택 | 본문 |
| `url` | 선택 | 수락 후 열 URL |

- 모든 `data` 값은 **문자열**로 보내야 합니다.
- 앱은 `delivery_id` / `deliveryId`, `origin_address` / `origin` 등 snake_case·camelCase 둘 다 파싱합니다.

---

## 잘못된 예 (오버레이 안 뜸)

```json
{
  "message": {
    "token": "<FCM_DEVICE_TOKEN>",
    "notification": {
      "title": "신규 배차",
      "body": "배송 요청이 도착했습니다."
    },
    "data": { ... }
  }
}
```

`notification` 이 있으면 Android가 알림을 시스템이 처리해 버려서 앱의 백그라운드 핸들러가 동작하지 않을 수 있습니다. **data만** 보내야 합니다.

---

## 요약

- **notification 키:** 포함하지 않음  
- **data 키:** `type`, `delivery_id`, `title`, `body`, `url` (모두 문자열)  
- **android.priority:** `"high"`  
- 현재 `app/api/push/send/route.ts` 는 위 규격을 이미 따르고 있음.
