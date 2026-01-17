-- RPC Validation сценарии (MVP)
-- 전제: scripts/rpc.sql 실행 완료
-- 참고: 테스트 계정 UUID는 실제 값으로 교체

-- =========================================================
-- 0) 테스트 전용 데이터 준비
-- =========================================================
-- 기사(라이더) 2명, 고객 1명
-- 예시 UUID는 교체
-- rider A
INSERT INTO profiles (id, email, full_name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'riderA@test.com', '기사A', 'driver')
ON CONFLICT (id) DO NOTHING;

-- rider B
INSERT INTO profiles (id, email, full_name, role) VALUES
  ('22222222-2222-2222-2222-222222222222', 'riderB@test.com', '기사B', 'driver')
ON CONFLICT (id) DO NOTHING;

-- customer
INSERT INTO profiles (id, email, full_name, role) VALUES
  ('33333333-3333-3333-3333-333333333333', 'customer@test.com', '고객C', 'customer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO riders (id, code) VALUES
  ('11111111-1111-1111-1111-111111111111', 'RIDER_A'),
  ('22222222-2222-2222-2222-222222222222', 'RIDER_B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id) VALUES
  ('33333333-3333-3333-3333-333333333333')
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 1) 기사 → 고객 유입 → 귀속 확정
-- =========================================================
-- auth.uid() 세팅이 필요한 경우, Supabase SQL Editor에서는 "Set role" 대신
-- 실제 로그인 세션에서 RPC 호출로 테스트 권장.
-- 아래는 개념적 실행 순서
SELECT rider_url_visit('RIDER_A', '1.2.3.4', 'UA-TEST', 'sess-001', 'fp-001');
-- 기대: status = 'assigned'

-- =========================================================
-- 2) 동일 고객 재접속 시 귀속 유지
-- =========================================================
SELECT rider_url_visit('RIDER_A', '1.2.3.4', 'UA-TEST', 'sess-001', 'fp-001');
-- 기대: status = 'already_assigned'

-- =========================================================
-- 3) 기사 변경 요청 성공 케이스
-- =========================================================
SELECT request_rider_change('RIDER_B', '기사 변경 요청 테스트', '1.2.3.4', 'UA-TEST');
-- 기대: status = 'changed'

-- =========================================================
-- 4) 기사 변경 요청 실패 (쿨타임)
-- =========================================================
SELECT request_rider_change('RIDER_A', '쿨타임 테스트', '1.2.3.4', 'UA-TEST');
-- 기대: status = 'cooldown'

-- =========================================================
-- 5) self_visit 차단
-- =========================================================
-- 기사A가 자기 코드 접근 (auth.uid = 기사A)
SELECT rider_url_visit('RIDER_A', '1.2.3.4', 'UA-TEST', 'sess-002', 'fp-002');
-- 기대: status = 'blocked', reason = 'self_visit'

-- =========================================================
-- 6) IP/UA 반복 접근 차단
-- =========================================================
-- 동일 IP/UA로 서로 다른 기사 코드 3회 이상 접근
SELECT rider_url_visit('RIDER_A', '9.9.9.9', 'UA-REPEAT', 'sess-003', 'fp-003');
SELECT rider_url_visit('RIDER_B', '9.9.9.9', 'UA-REPEAT', 'sess-004', 'fp-003');
SELECT rider_url_visit('RIDER_A', '9.9.9.9', 'UA-REPEAT', 'sess-005', 'fp-003');
-- 이후 접근
SELECT rider_url_visit('RIDER_B', '9.9.9.9', 'UA-REPEAT', 'sess-006', 'fp-003');
-- 기대: status = 'blocked', reason = 'ip_ua_limit'

