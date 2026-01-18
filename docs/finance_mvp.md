# 결제/정산/적립금 MVP 설계

## 1) 테이블 설계

### `orders`
- 목적: 주문/배송 흐름 상태 분리 관리
- 주요 컬럼: `delivery_id`, `order_amount`, `customer_adjusted_amount`, `payment_method`, `order_status`
- 상태: `REQUEST → PAID → ASSIGNED → PICKED_UP → DELIVERED → CANCELED`

### `payments`
- 목적: 결제 수단/결제 상태 분리 관리
- 주요 컬럼: `order_id`, `delivery_id`, `customer_id`, `amount`, `payment_method`, `status`
- 상태: `PENDING / PAID / CANCELED / REFUNDED`

### `settlements`
- 목적: 배송 완료 후 정산 대상 관리
- 주요 컬럼: `delivery_id`, `driver_id`, `settlement_amount`, `settlement_status`, `payout_request_id`
- 상태: `NONE / PENDING / CONFIRMED / PAID_OUT / EXCLUDED`

### `driver_wallet`
- 목적: 기사 적립금/출금 가능 금액 관리
- 주요 컬럼: `total_balance`, `available_balance`, `pending_balance`, `min_payout_amount`

### `payout_requests`
- 목적: 기사 출금 요청 관리
- 주요 컬럼: `driver_id`, `requested_amount`, `bank_account`, `status`

## 2) 역할별 화면 목록

### 고객
- 배송 요청 (`/customer/new-delivery`)
- 배송 상태 확인 (`/customer/delivery/[id]`)
- 마이페이지 주문 내역 (`/customer`)
- 결제 정보 확인 (배송 상세 내 `결제 정보` 섹션)

### 기사
- 배송 콜 수신/수락 (`/driver`)
- 배송 상태 변경 (`/driver/delivery/[id]`)
- 정산 내역 (`/driver/settlements`)
- 적립금 지갑 및 출금 요청 (`/driver/wallet`)

### 관리자
- 가격 정책 관리 (`/admin/pricing`)
- 결제 관리 (`/admin/payments`)
- 정산 관리 (`/admin/settlements`)
- 출금 관리 및 엑셀 생성 (`/admin/payouts`, `/api/admin/payouts/export`)

## 3) 상태 흐름 기반 API 설계 (서버 액션 기준)

### 주문/결제
- `createOrderAndPaymentForDelivery(deliveryId, amount, paymentMethod)`
  - 주문 생성 → 결제 생성
  - 카드/계좌이체는 `PAID` 처리, 현금은 `PENDING`
- `syncOrderStatusForDelivery(deliveryId, deliveryStatus)`
  - 배송 상태에 따라 주문 상태 업데이트

### 배송 완료 → 정산 트리거
- `createSettlementForDelivery(deliveryId)`
  - `settlements` 생성 (`PENDING`)
  - `driver_wallet.pending_balance` 증가

### 정산 확정
- `confirmSettlement(settlementId)`
  - `settlement_status = CONFIRMED`
  - `pending_balance → available_balance` 이동

### 출금 요청/완료
- `requestPayout(driverId, amount)`
  - `payout_requests` 생성
  - `available_balance` 차감
- `markPayoutPaid(payoutId)`
  - 출금 요청 `paid` 처리
  - 연결된 `settlement_status = PAID_OUT`

### 취소/환불
- 배송 시작 전 취소: `cancelPaymentForDelivery(deliveryId)` → `CANCELED`
- 배송 시작 후 취소: `refundPaymentForDelivery(deliveryId)` → `REFUNDED` + 정산 `EXCLUDED`

## 4) 관리자 엑셀 생성 로직

- API: `GET /api/admin/payouts/export`
- 대상: `payout_requests` 중 `pending/approved`
- 출력 CSV 컬럼: `기사명 / 은행 / 계좌번호 / 출금액 / 상태`
- 은행 업로드용 파일로 다운로드
