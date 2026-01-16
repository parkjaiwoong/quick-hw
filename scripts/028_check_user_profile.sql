-- 특정 사용자의 프로필 확인
-- kilima1@naver.com 계정 확인

-- 1. auth.users 테이블 구조 확인 (실행 후 결과 확인)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. auth.users에서 사용자 찾기 (수정된 버전)
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users
WHERE email = 'kilima1@naver.com'
ORDER BY created_at DESC
LIMIT 1;

-- 3. 해당 사용자의 프로필 확인
SELECT 
  p.*,
  CASE 
    WHEN p.id IS NULL THEN '프로필 없음'
    ELSE '프로필 있음'
  END AS profile_status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'kilima1@naver.com'
ORDER BY u.created_at DESC
LIMIT 1;

-- 4. 모든 kilima1@naver.com 계정 확인
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  p.id AS profile_id,
  p.role,
  p.full_name,
  p.created_at AS profile_created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'kilima1@naver.com'
ORDER BY u.created_at DESC;

