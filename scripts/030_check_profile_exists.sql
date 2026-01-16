-- kilima1@naver.com 계정의 프로필 존재 여부 간단 확인

-- 프로필이 있는지 확인 (가장 간단한 방법)
SELECT 
  CASE 
    WHEN p.id IS NOT NULL THEN '프로필 있음 ✅'
    ELSE '프로필 없음 ❌'
  END AS status,
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  p.id AS profile_id,
  p.role,
  p.full_name,
  p.phone,
  p.created_at AS profile_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'kilima1@naver.com'
ORDER BY u.created_at DESC
LIMIT 1;

