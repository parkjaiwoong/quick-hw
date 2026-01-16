-- 트리거 로그 확인 쿼리
-- 회원가입 후 이 쿼리를 실행하여 트리거가 실행되었는지 확인

-- 최근 트리거 로그
SELECT 
  trigger_name,
  user_id,
  message,
  created_at
FROM public.trigger_logs
ORDER BY created_at DESC
LIMIT 20;

-- 최근 생성된 사용자와 프로필 비교
SELECT 
  u.id AS user_id,
  u.email AS user_email,
  u.created_at AS user_created_at,
  p.id AS profile_id,
  p.email AS profile_email,
  p.created_at AS profile_created_at,
  CASE 
    WHEN p.id IS NULL THEN '프로필 없음 ❌'
    ELSE '프로필 있음 ✅'
  END AS status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

