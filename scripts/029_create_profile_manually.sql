-- kilima1@naver.com 계정의 프로필 수동 생성
-- 사용자가 존재하지만 프로필이 없는 경우 사용

-- 1. 먼저 사용자 ID 확인
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'kilima1@naver.com';
  v_user_metadata JSONB;
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
BEGIN
  -- 사용자 정보 가져오기
  SELECT 
    id, 
    raw_user_meta_data 
  INTO 
    v_user_id, 
    v_user_metadata
  FROM auth.users
  WHERE email = v_email
  ORDER BY created_at DESC
  LIMIT 1;

  -- 사용자가 존재하지 않으면 종료
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다: %', v_email;
  END IF;

  -- metadata에서 정보 추출
  v_full_name := COALESCE(v_user_metadata->>'full_name', '사용자');
  v_phone := COALESCE(v_user_metadata->>'phone', '');
  v_role := COALESCE(v_user_metadata->>'role', 'customer');

  -- 이미 프로필이 있는지 확인
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE NOTICE '프로필이 이미 존재합니다. 사용자 ID: %', v_user_id;
    RETURN;
  END IF;

  -- 프로필 생성
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_email,
    v_full_name,
    v_phone,
    v_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '프로필이 생성되었습니다. 사용자 ID: %, 이름: %, 역할: %', v_user_id, v_full_name, v_role;

END $$;

-- 2. 생성된 프로필 확인
SELECT 
  p.*,
  u.email_confirmed_at,
  u.created_at AS user_created_at
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'kilima1@naver.com';

