# 고객 계좌/카드 연동 가이드

## 플로우 요약
- 고객이 **기사 연결 요청** 시 결제 수단(카드/계좌이체/현금)을 선택합니다.
- 카드 선택 시 배송 생성 후 **결제 페이지**(`/customer/delivery/[id]/pay`)로 이동해 토스페이먼츠 **일회성 결제** 또는 **등록된 카드로 결제**를 진행합니다.
- **계좌/카드 연동** 화면: `/customer/account-link` (새 배송 요청 폼의 "계좌/카드 연동" 링크로 이동)

## 구현된 카드 연동 플로우

### 1. 카드 등록 (빌링키 발급)
- **페이지**: `/customer/account-link`
- 고객이 "카드 등록 (토스 결제창)" 버튼 클릭 → 토스 `requestBillingAuth("카드", { customerKey, successUrl, failUrl })` 호출
- 성공 시 토스가 `successUrl`로 리다이렉트: `/customer/account-link/billing-success?authKey=...&customerKey=...`
- **billing-success** 페이지에서 `customerKey === user.id` 검사 후 서버 액션 `issueBillingKeyFromAuth(authKey, customerKey)` 호출
  - 토스 `POST /v1/billing/authorizations/issue`로 빌링키 발급 후 `customer_billing_keys` 테이블에 upsert
- 실패 시 `/customer/account-link?billing=fail&message=...` 로 리다이렉트

### 2. 계좌 연동 페이지 동작
- 등록된 카드가 있으면 카드사·마스킹 번호 표시 및 "카드 연동 해제" 버튼 노출
- 쿼리 `?billing=success` / `?billing=fail` / `?billing=invalid` 에 따라 성공/실패/유효하지 않음 메시지 표시
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` 가 있어야 카드 등록 버튼 사용 가능

### 3. 등록된 카드로 결제
- **페이지**: `/customer/delivery/[id]/pay`
- 등록된 빌링키가 있는 고객에게는 "등록된 카드로 결제" 버튼과 "결제하기"(일회성) 버튼 모두 노출
- "등록된 카드로 결제" 클릭 시:
  - `POST /api/payments/pay-with-billing` body `{ orderId }` 호출
  - 서버에서 `getBillingKeyForPayment(userId)`로 billing_key·customer_key 조회
  - 토스 **카드 자동결제 승인** API `POST /v1/billing/{billingKey}` 호출 (customerKey, amount, orderId, orderName)
  - 응답이 성공이면 payments·orders·settlements 업데이트 후 배송 상세로 리다이렉트

### 4. DB/백엔드
- **테이블**: `customer_billing_keys` (id, user_id, customer_key, billing_key, card_company, card_number_masked, pg_provider, created_at), UNIQUE(user_id)
- **스크립트**: `scripts/053_customer_billing_keys.sql` (테이블 + RLS)
- **서버 액션** (`lib/actions/billing.ts`): `issueBillingKeyFromAuth`, `getCustomerBillingKey`, `getBillingKeyForPayment`, `deleteCustomerBillingKey`
- **API**: `POST /api/billing/issue` (authKey·customerKey로 빌링키 발급·저장), `POST /api/payments/pay-with-billing` (등록 카드로 결제)

### 5. 환경 변수
- `TOSS_SECRET_KEY`: 토스 시크릿 키 (빌링키 발급·빌링 결제용)
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`: 토스 클라이언트 키 (결제창·카드 등록창)
- `NEXT_PUBLIC_APP_URL` 또는 `VERCEL_URL`: successUrl/failUrl 절대 경로용 (계좌 연동 리다이렉트)

### 6. 참고 (토스 정책)
- 자동결제(빌링)는 정기 구독형 서비스에만 사용 가능하다는 안내가 있을 수 있음. 퀵/배달 비구독 결제에 쓰는 것은 토스 측 확인이 필요할 수 있음.
- `customerKey`는 user.id(UUID) 사용으로 토스 규칙 충족.

## 화면 경로 점검
| 화면 | 경로 | 비고 |
|------|------|------|
| 새 배송 요청 | `/customer/new-delivery` | 결제 수단 선택 + "계좌/카드 연동" 링크 있음 |
| 계좌 연동 | `/customer/account-link` | 카드 등록·해제, 성공/실패 메시지 |
| 카드 등록 성공 콜백 | `/customer/account-link/billing-success` | authKey·customerKey로 빌링키 발급·저장 |
| 결제 페이지 | `/customer/delivery/[id]/pay` | 일회성 결제 + 등록된 카드로 결제 옵션 |

위 경로로 이동하는지 한 번씩 클릭해서 확인하면 됩니다.

---

## 로컬에서 테스트하기

### 1. 환경 변수

`.env.local`에 아래를 설정한 뒤 서버를 재시작하세요.

```bash
# Supabase (기존)
NEXT_PUBLIC_QUICKSUPABASE_URL=...
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 토스페이먼츠 (테스트 키 사용)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
# 로컬은 생략해도 됨. 지정하면: NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- 토스 **테스트 키**는 [개발자센터 API 키](https://developers.tosspayments.com/my/api-keys)에서 발급합니다.
- 로컬에서는 `NEXT_PUBLIC_APP_URL`을 넣지 않아도 코드에서 `http://localhost:3000`으로 사용합니다. 다른 포트(예: 3001)를 쓰면 `NEXT_PUBLIC_APP_URL=http://localhost:3001` 로 지정하세요.

### 2. DB 마이그레이션 (최초 1회)

계좌/카드 연동을 쓰려면 `customer_billing_keys` 테이블이 있어야 합니다. Supabase SQL Editor에서 아래 스크립트를 실행하세요.

```bash
# 프로젝트 루트의 스크립트 내용을 복사해 실행
# scripts/053_customer_billing_keys.sql
```

또는 Supabase CLI 사용 시:

```bash
supabase db execute -f scripts/053_customer_billing_keys.sql
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.

### 4. 테스트 시나리오

| 순서 | 화면 | 확인 내용 |
|------|------|-----------|
| 1 | 로그인 | 고객 계정으로 `/auth/login` 로그인 |
| 2 | 계좌 연동 | `/customer/account-link` 이동 → "카드 등록 (토스 결제창)" 노출 여부 |
| 3 | 카드 등록 | 버튼 클릭 → 토스 테스트 결제창 → 테스트 카드로 인증 → `billing-success` 리다이렉트 후 "카드가 등록되었습니다" 메시지 |
| 4 | 등록 카드 표시 | 계좌 연동 페이지에 카드사·마스킹 번호 표시, "카드 연동 해제" 동작 |
| 5 | 등록 카드로 결제 | 새 배송 요청 → 카드 결제 선택 → 결제 페이지에서 "등록된 카드로 결제" 버튼 노출 및 결제 시도 |

토스 테스트 환경에서는 실제 카드 없이 [테스트 카드 정보](https://docs.tosspayments.com/reference/using-api/test-card)로 결제·빌링 인증을 시뮬레이션할 수 있습니다.
