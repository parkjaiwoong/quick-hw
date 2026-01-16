-- 관리자 계정 생성 또는 기존 계정을 관리자로 변경
-- 이메일로 관리자 계정 찾아서 role 변경

-- 방법 1: 특정 이메일의 계정을 관리자로 변경
-- 아래 이메일을 원하는 관리자 이메일로 변경하세요
DO $$
DECLARE
  admin_email TEXT := 'admin@example.com'; -- 여기에 관리자 이메일 입력
  user_id UUID;
BEGIN
  -- 사용자 ID 찾기
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = admin_email;
  
  IF user_id IS NULL THEN
    RAISE NOTICE '사용자를 찾을 수 없습니다: %', admin_email;
    RETURN;
  END IF;
  
  -- 프로필이 없으면 생성
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    created_at,
    updated_at
  )
  VALUES (
    user_id,
    admin_email,
    '관리자',
    '',
    'admin',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      updated_at = NOW();
  
  RAISE NOTICE '관리자 권한이 부여되었습니다. 사용자 ID: %, 이메일: %', user_id, admin_email;
END $$;

-- 방법 2: 모든 사용자 확인 및 관리자 계정 찾기
SELECT 
  u.id,
  u.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.role = 'admin' THEN '✅ 관리자'
    ELSE '일반 사용자'
  END AS status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY p.role DESC NULLS LAST, u.created_at DESC;

-- 방법 3: 특정 사용자 ID를 관리자로 변경 (이메일로 찾은 후)
-- 아래 user_id를 실제 사용자 ID로 변경하세요
-- UPDATE public.profiles 
-- SET role = 'admin', updated_at = NOW()
-- WHERE id = '여기에-사용자-ID-입력';

