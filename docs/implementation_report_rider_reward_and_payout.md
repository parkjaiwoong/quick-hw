# 귀속 기사 수수료 · 출금 요청 노출 · 프로세스 연결 구현 보고

## 1. 귀속 기사 수수료 로직 (신규 구현)

### 설계
- **트리거**: 배송 완료 시 `createSettlementForDelivery()` 실행 시, `deliveries.referring_rider_id`가 있으면 해당 기사(귀속 기사)에게 수수료 지급.
- **금액**: `총 배송 금액(total_fee) × 기사 리워드 비율(rider_reward_rate)` (기본 5%, `rider_reward_policy`로 기사별 오버라이드 가능).
- **적립**: 귀속 기사 `driver_wallet`에 동일 금액 적립 (pending → 결제 완료 시 available).

### 구현 내용
- **DB**: `scripts/048_rider_reward_settlement.sql`
  - `reward_policy_master`: 기본 정책 (rider_reward_rate 등).
  - `rider_reward_history`: 배송 단위 리워드 이력 (delivery_id, order_id, rider_id, reward_rate, reward_amount, status).
  - RLS: 기사 본인 조회, 관리자 전체.
- **백엔드**: `lib/actions/finance.ts`
  - `createSettlementForDelivery()`: 배송 조회 시 `referring_rider_id` 포함.
  - 신규 내부 함수 `addRiderReferralReward()`: 정책 조회(마스터 + 기사별 오버라이드) → `rider_reward_history` INSERT → 귀속 기사 지갑 `increment_driver_wallet_pending` → 결제 완료 시 `move_driver_wallet_pending_to_available`.
- **실행 순서**: 배송 완료 → 배송 기사 정산(기존) → 귀속 기사 수수료 기록 및 지갑 적립.

### 적용 방법
- Supabase SQL Editor에서 `scripts/048_rider_reward_settlement.sql` 실행.
- `DATABASE_SETUP.md`에 14번 항목으로 반영됨.

---

## 2. 기사 출금 요청(지급 요청) 화면 노출

### 현황
- 출금 요청 기능은 **`/driver/wallet`(적립금 지갑)** 페이지에 있음.
- 하단 네비는 기사일 때 "배송 관리", "정산", "지갑"만 노출되며, "지급 요청"이라는 문구가 없어 찾기 어려울 수 있음.

### 변경 사항
- **기사 대시보드** (`app/driver/page.tsx`)
  - 상단에 **"출금 요청 (지급 요청)"** 카드 추가.
  - 문구: "정산 확정된 금액을 출금하려면 지갑에서 출금 요청을 하세요."
  - 버튼: **"지갑 · 출금 요청 하기"** → `/driver/wallet`, **"정산 내역 보기"** → `/driver/settlements`.
  - 기존 "적립금 지갑" 버튼 문구를 **"적립금 지갑 · 출금"**으로 변경.
- **하단 네비** (`components/layout/bottom-nav.tsx`)
  - 기사 구간 "지갑" 라벨을 **"지갑/출금"**으로 변경.

이제 기사는 대시보드에서 "출금 요청 (지급 요청)" 카드를 통해 지갑 페이지로 들어가 출금 요청을 할 수 있음.

---

## 3. 고객 · 기사 · 관리자 프로세스 연결

### 관리자
- **대시보드** (`app/admin/page.tsx`): "결제 · 정산 · 출금 관리" 카드에 **정산 관리** 링크 추가.
  - 결제 관리 → `/admin/payments`
  - **정산 관리** → `/admin/settlements` (신규 링크)
  - 출금(지급) 관리 → `/admin/payouts`
  - 금액 액션 로그 → `/admin/finance-logs`

### 기사
- 대시보드: 출금 요청 카드, 지갑/정산 내역 링크.
- 하단 네비: 배송 관리, 정산, 지갑/출금 (역할이 기사일 때만 노출).
- 상세: `/driver/delivery/[id]`, `/driver/reward/[id]` 등에서 "메인 화면 이동" 등 기존 연결 유지.

### 고객
- 대시보드: 내 배송, 배송 요청, 추천 기사/기사 변경 등 기존 유지.
- 배송 상세: "메인 화면 이동"으로 고객/기사/관리자 메인 이동 가능.

### 역할 전환
- 헤더 역할 콤보(관리자 로그인 시): 고객/기사/관리자 전환 후 해당 메인으로 이동.
- 로그인 사용자는 홈(`/`) 접속 시 역할별 메인으로 자동 리다이렉트.

---

## 4. 전체 프로세스 요약

| 구간 | 고객 | 기사 | 관리자 |
|------|------|------|--------|
| 진입 | `/r/[코드]` 딥링크/QR → 쿠키 → 가입 시 귀속 | 기사 코드로 소개 링크 공유 | - |
| 주문/배송 | 배송 요청 → 결제 → 주문/결제 생성 | 대기 배송 수락 → 픽업/배송 완료 | 주문·배송 모니터링 |
| 정산 | - | 배송 완료 시 driver_fee + (귀속 시) rider 리워드 적립 | 정산 관리 화면에서 확인 |
| 출금 | - | 지갑 → 출금 요청 | 출금 관리에서 승인/이체 완료 처리 |
| 화면 연결 | 고객 메인, 배송 요청, 내 배송, 상세 | 기사 메인, 지갑/출금, 정산 내역, 출금 요청 카드 | 결제·정산·출금·금액 로그 링크 |

---

## 5. 수정/추가된 파일 목록

- `scripts/048_rider_reward_settlement.sql` (신규)
- `DATABASE_SETUP.md` (048 실행 순서 추가)
- `lib/actions/finance.ts` (귀속 기사 수수료 로직)
- `app/driver/page.tsx` (출금 요청 카드, 버튼 문구)
- `app/driver/wallet/page.tsx` (payout 조회 시 settlement_status, payout_status 포함)
- `components/layout/bottom-nav.tsx` (지갑 → 지갑/출금)
- `app/admin/page.tsx` (정산 관리 링크, 카드 문구)
- `docs/implementation_report_rider_reward_and_payout.md` (본 보고서)
