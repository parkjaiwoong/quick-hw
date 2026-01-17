# 운영 모니터링 체크 포인트 (MVP)

## 1) 집계 SQL / VIEW
실행 파일: `scripts/040_monitoring_views.sql`

### KPI 카드 기준 (최근 7일)
- `v_admin_kpi_7d.inflow_7d`: 기사 유입 고객 수
- `v_admin_kpi_7d.orders_7d`: 실제 주문 수
- `v_admin_kpi_7d.change_requests_7d`: 기사 변경 요청 수
- `v_admin_kpi_7d.change_approved_7d`: 승인 건수
- `v_admin_kpi_7d.abuse_blocks_7d`: 차단 건수

### 일/주 단위 집계
- `v_rider_inflow_daily`, `v_rider_inflow_weekly`
- `v_rider_orders_daily`, `v_rider_orders_weekly`
- `v_change_approval_daily`, `v_change_approval_weekly`
- `v_abuse_daily`, `v_abuse_weekly`

## 2) 로그 테이블 기준 운영 체크

### 핵심 로그 테이블
- `rider_referral_access_log`: 유입/차단/재접속 흐름
- `rider_change_history`: 변경 요청/승인/거절 흐름
- `abuse_flags`: self_visit / abuse 차단 기록
- `deliveries`: 실제 주문 발생/수익 연결

### 문제 발생 시 “여기부터 본다” 기준
1. **유입 대비 주문이 낮음**
   - `v_rider_inflow_daily` vs `v_rider_orders_daily`
   - 특정 기사 코드 유입만 높고 주문이 없으면 `rider_referral_access_log` 확인

2. **self_visit / 악용 급증**
   - `v_abuse_daily`에서 급증 확인
   - `abuse_flags` detail로 IP/UA 패턴 확인

3. **기사 변경 요청 폭증**
   - `v_change_approval_daily`로 요청 수 확인
   - `rider_change_history`에서 특정 기사로 집중되는지 확인

4. **승인 대기 누적**
   - `rider_change_history` WHERE status='pending'
   - 관리자 응답 지연 여부 확인

## 3) 운영 점검 루틴 (MVP)
- 매일 오전: `v_admin_kpi_7d` 확인
- 주 1회: 기사별 유입 vs 주문 비율 확인
- 이상 징후 시: `rider_referral_access_log` + `abuse_flags` 상세 확인
