# Referral 연결/검증 가이드 (MVP)

## 1) RPC 검증용 시나리오
`docs/rpc_validation.sql` 참고.  
순서: 기사 유입 → 귀속 확정 → 재접속 → 변경 요청 → self_visit → IP/UA 차단

## 2) Server Actions 연결 가이드

### 호출 위치
- `/r/{code}` 페이지: `handleRiderUrlAccess(code)`
- 회원가입/로그인 완료 시: `confirmReferralFromCookie()`
- 고객 기사 변경 요청 폼: `requestRiderChange(formData)`
- 주문 생성(Server Action): `resolveRiderForOrder(customerId)`

### 흐름 다이어그램 (텍스트)
1. 사용자가 `/r/{code}` 접속  
2. `handleRiderUrlAccess` → RPC `rider_url_visit`  
3. 비로그인: 쿠키 저장 → `/auth/signup` 이동  
4. 로그인/회원가입 완료 시 `confirmReferralFromCookie` → 귀속 확정  
5. 주문 생성 시 `resolveRiderForOrder` → `deliveries.referring_rider_id` 저장  
6. 고객이 변경 요청 시 `requestRiderChange` → RPC `request_rider_change`

### 에러 처리 타입
- `invalid_code`: 잘못된 코드
- `blocked/self_visit`: 자기 코드 접근 차단
- `blocked/ip_ua_limit`: 반복 접근 차단
- `cooldown`: 변경 쿨타임
- `already_assigned`: 기존 귀속 유지

클라이언트 처리:
- `blocked/*` → 안내 문구 표시 + 일반 홈 이동
- `cooldown` → 남은 시간 안내
- `invalid_code` → 재입력 유도

## 3) 성능 기준 체크 포인트

### 주문 생성 시 왕복
- `resolve_rider_for_order` 1회 RPC + `deliveries.insert` 1회
  - 총 2회 (MVP 기준 허용)

### 단일 RPC로 끝나는 경로
- `/r/{code}` 접근 처리: `rider_url_visit` 단일 RPC
- 변경 요청: `request_rider_change` 단일 RPC

### UI await 병목 회피
- `/r/{code}` 페이지는 RPC 후 즉시 redirect  
- 로그인 완료 후 `confirmReferralFromCookie`는 비동기 처리 + 실패 무시 가능

## 4) 이후 UI 최소 범위 제안
- 고객 기사 변경 요청 폼 1개 (코드 + 사유 입력)
- 관리자 승인 화면 테이블 1개 (요청 리스트, 승인/거절)
- 기사 귀속 상태 표시 1줄 (현재 귀속 기사 코드)
