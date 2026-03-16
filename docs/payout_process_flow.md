# 고객 연결 → 기사 배송완료 → 출금 요청 → 관리자 승인 → 기사 출금 프로세스

## 전체 흐름 요약

1. **고객** 배송 요청(기사 연결 요청)
2. **기사** 수락 후 배송 진행 → **배송 완료** 처리
3. **정산** 1건 생성(결제 완료 시 출금 가능 금액 반영)
4. **기사** 출금 요청
5. **관리자** 출금 승인
6. **관리자** 이체 완료 처리 → 기사 계좌로 출금 완료

---

## 단계별 상세

### 1. 고객 배송 요청(기사 연결)

- 고객이 배송 요청 시 `deliveries` 행 생성, 결제(카드/계좌이체/현금) 진행.
- 결제 완료 후 근처 기사에게 알림 → 기사가 수락하면 `deliveries.driver_id`·`accepted_at` 설정.

### 2. 기사 배송 완료

- 기사가 앱에서 **배송 완료** 처리 시:
  - `deliveries.status = 'delivered'`, `delivered_at` 저장.
  - **Server** `updateDeliveryStatus` → `createSettlementForDelivery`(after) 호출.

### 3. 정산 생성 및 지갑 반영

**`createSettlementForDelivery(deliveryId)`** (배송 완료 후 after()에서 실행):

- 해당 배송에 대한 **settlements** 1건 INSERT.
  - `settlement_status`: 결제가 이미 **PAID**이면 `READY`, 아니면 `PENDING`.
  - `payment_status`: 결제 상태(PAID 등).
- **driver_wallet**:
  - `increment_driver_wallet_pending(driver_id, 금액)` → `pending_balance` 증가.
  - 결제가 이미 PAID이면 `move_driver_wallet_pending_to_available` → **pending → available** 이전.
- 현금 결제인 경우: 결제·정산을 PAID로 갱신하지만, **available**로 옮기려면 관리자 **정산 확정**이 필요할 수 있음(구현에 따라 다름).

**관리자 정산 확정(선택):**

- **관리자 > 정산 관리**에서 **정산 확정** 시:
  - `confirmSettlement(settlementId)` → 해당 정산 `settlement_status = 'CONFIRMED'`.
  - `move_driver_wallet_pending_to_available` 호출 → **출금 가능 잔액(available_balance)** 증가.
- 카드/계좌이체로 이미 PAID인 건은 배송 완료 시점에 READY + available 반영되므로, 정산 확정 없이도 출금 요청 가능.

### 4. 기사 출금 요청

- **기사 > 지갑/출금** 또는 **정산** 화면에서 **출금 요청**.
- **`requestPayoutFromDriver`** → **`requestPayout(driverId, amount)`**:
  - LOCKED 정산 있으면 출금 요청 불가.
  - **READY** 또는 **CONFIRMED** 이고 **payment_status = PAID**인 정산이 1건 이상 있어야 함.
  - 이미 **requested / on_hold / approved** 상태인 출금 요청이 있으면 추가 요청 불가.
  - `amount`는 `min_payout_amount` 이상, `available_balance` 이하.
  - **payout_requests** INSERT (status: `requested`), **driver_wallet.available_balance**에서 요청 금액 차감.

### 5. 관리자 출금 승인

- **관리자 > 출금 관리**에서 해당 출금 요청 **승인**.
- **`approvePayout(payoutId)`**:
  - 해당 기사의 **READY(결제완료)** 또는 **CONFIRMED(정산확정)** 이면서 아직 다른 출금에 묶이지 않은 정산들로 요청 금액을 채움.
  - 채울 수 있으면:
    - **payout_requests**: `status = 'approved'`, `payout_status = 'WAITING'`, `approved_at` 등 설정.
    - 해당 **settlements**: `settlement_status = 'CONFIRMED'`, `payout_request_id = payoutId`로 연결.

### 6. 관리자 이체 완료(기사에게 실제 출금)

- **관리자 > 출금 관리**에서 **이체 완료 처리** 클릭.
- **`transferPayout(payoutId, 'MANUAL')`**:
  - **payout_requests**: `status = 'transferred'`, `transferred_at`, `payout_status = 'PAID_OUT'` 등 설정.
  - 해당 **payout_request_id**로 연결된 **settlements**: `settlement_status = 'PAID_OUT'`, `status = 'completed'`.
  - 실제 계좌 이체는 관리자가 별도(뱅킹/PG 등)로 수행한 뒤, 이 버튼으로 “이체 완료”만 기록.

→ 여기까지 완료되면 **기사에게 출금된 것**으로 시스템상 프로세스 종료.

---

## 출금 보류와 보류 이후 처리

### 보류 vs 반려: 어떤 경우에 쓰나?

| 구분 | 의미 | 사용 예시 |
|------|------|-----------|
| **보류** | 당장 승인/반려하지 않고 **검토만 대기**할 때. 나중에 **이 요청 그대로 승인**할 수 있는 경우. | 내부 서류 검토 중, 특정 건만 추가 확인 후 곧 승인 예정, 당일 이체 일정 조율 중 |
| **반려** | 이 출금 요청을 **취소**하고, 금액을 기사 지갑으로 되돌릴 때. 기사가 **뭔가 수정한 뒤 다시 출금 요청**해야 하는 경우. | **계좌번호/은행 정보 오류**, 서류 불비, 출금 불가 사유로 같은 요청으로는 승인 불가한 경우 |

- **계좌번호가 틀렸다면 → 반려**가 맞습니다.  
  사유에 "계좌번호가 일치하지 않습니다. 올바른 계좌로 수정 후 다시 출금 요청해 주세요" 등을 입력하고 **반려**하면, 해당 금액이 기사 **출금 가능 잔액**에 다시 더해지고, 기사가 계좌 정보 수정 후 **새 출금 요청**을 하면 됩니다.  
- **보류**는 "이 요청은 유효한데, 당장만 미루는 것"에 가깝고, **반려**는 "이 요청은 받아들일 수 없으니 취소하고 다시 요청하세요"에 가깝습니다.

### 보류란?

- 관리자가 출금 요청을 **당장 승인/반려하지 않고** 검토할 때 사용합니다.
- **관리자 > 출금 관리**에서 해당 요청에 **보류** 클릭 → 사유 입력 → **`holdPayout(payoutId, reason)`** 실행.
- **payout_requests**: `status = 'on_hold'`, `notes = 사유`, `settlement_status = 'HOLD'`, `settlement_locked = true`.
- 기사 지갑의 **available_balance**는 출금 요청 시점에 이미 차감된 상태이므로, 해당 금액은 이 출금 요청에 묶인 상태로 유지됩니다. (반려 시에만 available 복구)

### 보류 후 기사가 할 작업

- **없습니다.** 보류는 "관리자 검토 대기" 상태일 뿐이며, 기사가 별도로 수정·제출할 것은 없습니다.
- 기사 앱 **지갑/출금 내역**에서는 해당 건이 **보류**로 표시되고, 관리자가 승인하거나 반려할 때까지 대기합니다.

### 보류 이후 관리자가 할 수 있는 것 (재승인 프로세스)

1. **승인**  
   - **관리자 > 출금 관리**에서 보류된 건을 선택 후 **「보류 해제 후 승인」** 클릭.  
   - **`approvePayout(payoutId)`**가 호출되며, **보류(on_hold) 건이면** 먼저 해당 출금 요청을 `status = requested`, `settlement_status = READY`, `settlement_locked = false` 로 되돌린 뒤, 기존과 동일한 승인 로직(정산 할당 → approved)을 수행합니다.  
   - 따라서 **기사가 따로 할 작업 없이** 관리자만 "보류 해제 후 승인"을 누르면 출금 승인까지 이어집니다.

2. **반려**  
   - 보류된 건에 대해 **반려**를 선택하고 사유 입력 → **`rejectPayout(payoutId, reason)`**.  
   - 출금 요청이 `rejected` 처리되고, 해당 금액이 기사 **available_balance**에 다시 더해지며, 기사는 이후 같은 금액으로 다시 출금 요청할 수 있습니다.

정리하면, **출금 보류 이후**에는  
- 기사: 별도 작업 없음.  
- 관리자: **「보류 해제 후 승인」**으로 재승인하거나, **반려**로 출금 요청을 취소하고 금액을 기사 지갑에 되돌리는 두 가지 선택만 있으면 됩니다.

---

## 데이터/상태 정리

| 구분 | 테이블/필드 | 설명 |
|------|-------------|------|
| 배송 | deliveries.status | pending → accepted → picked_up / in_transit → delivered |
| 정산 | settlements | delivery_id별 1건, settlement_status: PENDING → READY/CONFIRMED → PAID_OUT |
| 지갑 | driver_wallet | pending_balance, available_balance (출금 요청 시 available 차감) |
| 출금 요청 | payout_requests | status: requested → approved → transferred (또는 on_hold → 승인/반려, rejected 등) |

---

## 문제점 및 수정 사항

- **approvePayout**: 이전에는 “CONFIRMED 정산 금액”만 검사하고, 실제 할당은 “READY 정산”만 사용해,  
  정산 확정을 하지 않으면 CONFIRMED가 없어 승인 실패하거나, 정산 확정만 하면 READY가 없어 할당 실패하는 모순이 있었음.  
  → **수정**: 출금 할당 대상을 **READY(결제완료) + CONFIRMED(정산확정)** 이면서 `payout_request_id`가 null인 정산으로 통합하고,  
  이 풀에서 요청 금액만큼 순서대로 할당하도록 변경함.  
  따라서 “정산 확정을 하지 않고 결제만 완료(READY)”인 경우에도 출금 승인·이체 완료까지 진행 가능.

---

## 최종: 기사에게 출금되기까지

1. 고객 배송 요청 → 기사 수락 → 기사 배송 완료.
2. 배송 완료 시 정산 1건 생성, 결제 완료 건은 READY + 지갑 available 반영(또는 관리자 정산 확정으로 CONFIRMED + available 반영).
3. 기사가 지갑 화면에서 출금 요청 → `payout_requests` 생성, available 차감.
4. 관리자가 출금 관리에서 **승인** → 해당 정산들과 출금 요청 연결.
5. 관리자가 실제 계좌 이체 후 **이체 완료 처리** → 출금 요청·정산 상태가 이체 완료(PAID_OUT)로 갱신.

이 순서가 모두 끝나면 “기사에게 출금된 것”까지의 프로세스가 완료된 상태입니다.
