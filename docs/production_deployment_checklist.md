# 실운영 배포 체크리스트 (MVP)

이 문서는 운영 담당자가 **그대로 따라 하면 되는 실행 순서**로 작성되었습니다.

## 1) Supabase 환경변수 체크

**필수 환경변수 (서버 전용)**
- `SUPABASE_SERVICE_ROLE_KEY`: 관리자/백엔드용 키. **절대 클라이언트로 노출 금지**

**필수 환경변수 (공개 가능)**
- `NEXT_PUBLIC_QUICKSUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY`: 공개용 anon 키

**권장 확인**
- 로컬/스테이징/프로덕션 환경별 키 분리
- Vercel/서버의 환경변수에 정확히 등록됐는지 확인
- 누락 시 관리자 기능 및 RPC 동작 실패 가능

## 2) SQL 적용 순서

아래 순서를 그대로 진행합니다.

1. **테이블/컬럼**
   - 기본 스키마 및 referral 관련 테이블
2. **RPC 함수**
   - `scripts/rpc.sql`
3. **RLS 정책**
   - `scripts/rpc.sql`에 포함된 RLS 정책 적용
4. **VIEW / 집계**
   - `scripts/040_monitoring_views.sql`
5. **모니터링 확인**
   - `docs/monitoring_checkpoints.md` 기준으로 쿼리 확인

## 3) 권한/보안 확인 포인트

**anon**
- 읽기 전용 수준 (일반 사용자용)
- 절대 민감 테이블 직접 수정 불가

**authenticated**
- 로그인 사용자 전용
- 자신의 데이터만 접근 가능해야 함 (RLS 확인)

**service_role**
- 관리자/서버 전용 (RLS 우회)
- 오직 서버 환경에서만 사용

**확인 항목**
- 클라이언트에서 `service_role` 사용 금지
- RPC 함수가 `SECURITY DEFINER`인지 확인
- 변경 요청 승인/거절은 반드시 관리자 페이지/서버 액션을 통해서만 가능

## 4) 관리자 페이지 접근 조건

접근 허용 조건(둘 중 하나):
- `profiles.role = "admin"`
- `role_override = "admin"` 쿠키 존재

위 조건이 없으면 `/admin` 이하 페이지는 접근 불가해야 합니다.

## 5) 배포 직후 반드시 확인할 5가지

1. **귀속 정상 여부**
   - 고객이 `/r/{code}` 진입 후 회원가입 → `referring_driver_id`가 정상 기록되는지 확인

2. **기사 변경 승인 흐름**
   - 고객이 변경 요청 → 관리자 승인 → 이후 주문에서 새로운 기사로 연결되는지 확인

3. **주문 스냅샷**
   - 주문 생성 시 `deliveries.referring_rider_id`가 스냅샷으로 저장되는지 확인

4. **RPC 동작**
   - `request_rider_change`, `resolve_rider_for_order` 등 핵심 RPC가 정상 동작하는지 확인

5. **관리자 KPI 집계**
   - `v_admin_kpi_7d` 조회 결과가 정상적으로 집계되는지 확인

---

### 참고 문서
- 모니터링 체크 포인트: `docs/monitoring_checkpoints.md`
- 모니터링 VIEW: `scripts/040_monitoring_views.sql`
