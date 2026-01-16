-- 트리거 실행 여부 확인

-- 1. 트리거 로그 확인 (트리거가 실행되었는지)
SELECT * FROM public.trigger_logs
WHERE user_id IN (
  SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at DESC;

-- 2. 최근 사용자 확인
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 1;

-- 3. 트리거 상태 확인
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  n.nspname AS schema_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled ✅'
    WHEN 'D' THEN 'disabled ❌'
    ELSE 'unknown'
  END AS status,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname = 'on_auth_user_created';

-- 4. 수동으로 프로필 생성 테스트 (최근 사용자)
-- 이 쿼리는 실행하지 말고 참고용으로만 사용하세요
-- INSERT INTO public.profiles (id, email, full_name, phone, role)
-- SELECT 
--   id,
--   email,
--   COALESCE(raw_user_meta_data->>'full_name', ''),
--   COALESCE(raw_user_meta_data->>'phone', ''),
--   COALESCE((raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM public.profiles)
-- ORDER BY created_at DESC
-- LIMIT 1;

