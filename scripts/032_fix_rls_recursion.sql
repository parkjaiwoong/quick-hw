-- RLS 정책 무한 재귀 문제 해결
-- profiles 테이블의 관리자 정책이 무한 재귀를 일으키고 있음

-- 1. 기존 관리자 정책 삭제
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 2. 간단한 해결책: 관리자 정책 제거
-- 모든 사용자는 자신의 프로필만 조회할 수 있도록 함
-- 관리자가 모든 프로필을 조회해야 하는 경우, Service Role을 사용하거나
-- 별도의 관리자 전용 함수를 만들어야 함

-- 3. 현재 활성화된 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

-- 참고: 관리자가 모든 프로필을 조회해야 하는 경우
-- Server Action에서 Service Role을 사용하여 조회하도록 하세요

