-- RLS 정책 확인 및 테스트
-- kilima1@naver.com 계정의 프로필 조회 권한 확인

-- 1. profiles 테이블의 RLS 정책 확인
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

-- 2. 현재 활성화된 RLS 정책 확인
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- 3. 프로필이 실제로 존재하는지 확인 (RLS 무시하고 확인)
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM public.profiles
WHERE email = 'kilima1@naver.com';

