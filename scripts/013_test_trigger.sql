-- 트리거 작동 테스트 및 디버깅

-- 1. 트리거 상태 확인
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  n.nspname AS schema_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled'
    WHEN 'D' THEN 'disabled'
    ELSE 'unknown'
  END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname = 'on_auth_user_created';

-- 2. 함수 정의 확인
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'handle_new_user' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. 최근 생성된 사용자 확인
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 4. 최근 생성된 프로필 확인
SELECT 
  id,
  email,
  full_name,
  phone,
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 5. 트리거가 실행되었는지 확인 (로그 확인용)
-- 트리거 실행 로그를 확인하려면 Supabase 로그를 확인하세요

