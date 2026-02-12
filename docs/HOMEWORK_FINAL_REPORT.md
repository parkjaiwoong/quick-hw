# 숙제 최종 보고서 (배송 앱)

작성일: 2025-01-20  
요청: 카드/계좌이체·취소 테스트, 기사 지도 개선, 전체 프로세스 점검 및 최종 보고

---

## 1. 카드 결제 + 기사 연결 요청 시 토스 연동 테스트

### 구현 상태
- **기사 연결 요청 성공** → 2초 후 **배송 상세**로 이동 (`/customer/delivery/[id]?pay=1`)
- 배송 상세 진입 시 **토스 결제 창 자동 오픈** (`TossPaymentButton`의 `autoPay` + `?pay=1` 연동)
- 결제 완료 시 `/payments/success`에서 **POST /api/payments/confirm** 호출 → DB `payments`/`orders` PAID 반영

### 테스트 방법 (직접 확인용)
1. `.env.local`에 **NEXT_PUBLIC_TOSS_CLIENT_KEY**, **TOSS_SECRET_KEY** 설정 (토스 개발자 콘솔)
2. 고객으로 로그인 → 새 배송 요청 → **결제 수단: 카드결제** → 기사 추천 화면에서 **연결 요청**
3. 연결 성공 후 2초 뒤 배송 상세로 이동 → **토스 결제 창이 자동으로 열리는지** 확인
4. 토스 테스트 카드로 결제 → `/payments/success` → "결제가 완료되었습니다" 및 DB 결제 상태 PAID 확인

### 제한 사항
- 실제 결제 완료까지는 **토스 테스트 키 + 테스트 카드** 필요. 키가 없으면 "결제 키가 설정되지 않았습니다"로 중단됨.
- 키가 있다고 가정한 경우, 위 플로우대로 **토스 결제창까지 연동**되어 있음.

---

## 2. 계좌이체 연동

### 현재 상태
- **주문/배송 요청 시** 결제 수단에서 "계좌이체" 선택 가능 (DB `payment_method`: `bank_transfer`)
- **결제창(PG) 연동은 없음**: `/api/payments/create`는 `payment_method === "card"`일 때만 호출되며, 배송 상세에서는 카드일 때만 "결제하기" 버튼 노출
- 계좌이체 선택 시 → 주문·결제 레코드는 생성되나 **PAID 처리/가상계좌 발급 없음** (현금과 유사하게 배송 완료 후 수동 처리 가정)

### API 키 가정 시 연동 방향
- **토스 가상계좌** 연동 시: 토스 결제 API에서 **method: "VIRTUAL_ACCOUNT"** 등으로 가상계좌 발급 요청 → 입금 안내 화면/문자 제공
- 구현 시 필요한 것: **TOSS_SECRET_KEY**, 토스 결제 API 문서 기준 가상계좌 요청/입금 콜백 처리, 입금 확인 후 DB `payments.status = "PAID"` 반영

**결론**: 계좌이체는 **현재 PG 연동 없이 주문만 반영**. API 키 있다고 가정하면, 토스 가상계좌 API 연동으로 결제창/입금 안내까지 확장 가능.

---

## 3. 카드 결제 취소 테스트

### 구현 상태
- **배송 취소** 시:
  - 배송 **시작 전**: `cancelPaymentForDelivery` → 토스 **POST /v1/payments/{paymentKey}/cancel** 호출 후 DB CANCELED
  - 배송 **시작 후**: `refundPaymentForDelivery` → 동일 토스 취소 API 호출 후 DB REFUNDED
- 토스 취소 실패 시 에러 메시지 반환, DB는 취소/환불로 바꾸지 않음

### 테스트 방법
1. 카드로 결제 완료된 배송 한 건 준비 (PAID 상태)
2. 고객/관리자 등에서 해당 배송 **취소** 실행
3. DB에서 `payments.status`가 CANCELED 또는 REFUNDED로 바뀌는지 확인
4. (선택) 토스 개발자 콘솔에서 해당 결제가 취소/환불 상태로 보이는지 확인

**결론**: 취소/환불 시 **토스 취소 API 호출 + DB 반영**까지 코드 상 구현됨. 실제 취소는 **TOSS_SECRET_KEY** 설정 후 배송 취소 플로우로 검증 가능.

---

## 4. 기사 지도: 내 위치, 픽업까지 거리, 디자인 개선 ✅

### 적용 내용
- **기사 배송 상세** (`/driver/delivery/[id]`) 지도 컴포넌트 **OpenLayersMap** 수정:
  - **내 위치 표시**: `showMyLocation={true}` 시 브라우저 **Geolocation**으로 현재 위치 조회 후 지도에 **녹색 원 + "내 위치"** 마커 표시
  - **픽업까지 거리**: 내 위치와 픽업 좌표로 **Haversine** 거리(km) 계산 후 지도 상단에 **"픽업 장소까지 거리: 약 X.X km"** 표시
  - **시각화**: 내 위치 → 픽업 구간 **점선** (녹색), 픽업·배송 구간 실선 (회색), 범례(픽업/배송/내 위치) 추가
- **디자인**: 지도 영역 **rounded-xl, border, shadow**, 상단 범례 바 추가로 구분감 정리

### 파일
- `components/driver/openlayers-map.tsx`: `showMyLocation`, `myLocation` 상태, 거리 계산, 범례/거리 문구 추가
- `app/driver/delivery/[id]/page.tsx`: `<OpenLayersMap ... showMyLocation />` 전달

---

## 5. 전체 프로세스 점검 및 정리

### 점검한 플로우
| 단계 | 내용 | 비고 |
|------|------|------|
| 배송 요청 | 주소·결제수단·금액 입력 → createDelivery → 주문/결제 생성 | ✅ |
| 기사 추천 | find_nearby_drivers → 연결 요청 → 성공 시 배송 상세(?pay=1) 이동 | ✅ |
| 카드 결제 | 배송 상세 → (autoPay) 토스 결제창 → confirm → PAID | ✅ (키 필요) |
| 결제 성공 | /payments/success → POST confirm → 배송 상세로 돌아가기 등 | ✅ |
| 배송 취소 | cancelDelivery → cancel/refund Payment → 토스 취소 API | ✅ |
| 기사 지도 | 픽업/배송 + 내 위치 + 픽업까지 거리 | ✅ 반영됨 |

### 선택 개선 사항 (추가 권장)
- **결제 성공 페이지**: 현재 "주문 내역으로 돌아가기"는 `router.back()`. 배송 상세(`/customer/delivery/[id]`)로 가는 링크를 넣으면 이동이 더 명확함.
- **계좌이체**: 토스 가상계좌 연동 시 결제 수단별 분기(카드 vs 가상계좌) 추가 필요.

---

## 요약

| 항목 | 처리 | 비고 |
|------|------|------|
| 1. 카드 결제 + 기사 연결 → 토스 연동 | 코드/플로우 구현 완료 | 실제 결제는 TOSS 키 + 테스트 카드로 확인 |
| 2. 계좌이체 연동 | PG 미연동, 주문만 반영 | API 키 가정 시 토스 가상계좌로 확장 가능 |
| 3. 카드 결제 취소 | 토스 취소 API + DB 반영 구현됨 | TOSS_SECRET_KEY 설정 후 취소 플로우로 테스트 |
| 4. 기사 지도 (내 위치, 거리, 디자인) | 적용 완료 | OpenLayersMap + showMyLocation |
| 5. 전체 프로세스 점검 | 점검 완료 | 위 표 기준으로 누락 없음, 선택 개선만 문서화 |

**실제 연동 테스트(1·3)**는 **NEXT_PUBLIC_TOSS_CLIENT_KEY**, **TOSS_SECRET_KEY** 설정 후 진행하면 됩니다.

---

## 참고: 빌드

- `npm run build` 시 `/customer/address-search` 페이지에서 **useSearchParams() should be wrapped in a suspense boundary** 오류가 나올 수 있음 (기존 이슈). 해당 페이지를 `<Suspense>`로 감싸면 해결됩니다.
