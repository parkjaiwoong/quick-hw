-- RLS 정책 무한 재귀 문제 해결 (모든 테이블)
-- 무한 재귀를 일으키는 모든 관리자 정책 삭제

-- 1. profiles 테이블의 관리자 정책 삭제
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 2. driver_info 테이블의 관리자 정책 삭제 (같은 문제)
DROP POLICY IF EXISTS "Admins can view all driver info" ON driver_info;

-- 3. deliveries 테이블의 관리자 정책 확인 (재귀 없으면 유지)
-- deliveries 테이블의 관리자 정책은 profiles를 조회하지만, 
-- profiles 조회 시 다시 deliveries를 조회하지 않으므로 괜찮음

-- 4. 확인: 삭제된 정책 목록
SELECT 
  '정책 삭제 완료' AS status,
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public' 
  AND (
    tablename = 'profiles' OR 
    tablename = 'driver_info'
  )
ORDER BY tablename, policyname;

-- 5. 현재 남아있는 정책 확인
SELECT 
  tablename,
  policyname,
  cmd AS command_type,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'driver_info')
ORDER BY tablename, policyname;

