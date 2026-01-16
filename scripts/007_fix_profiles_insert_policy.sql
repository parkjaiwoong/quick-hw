-- profiles 테이블 INSERT 정책 추가 (회원가입 시 프로필 생성 허용)
-- 기존 정책이 있으면 삭제 후 재생성

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- driver_info 테이블 INSERT 정책 추가 (배송원 회원가입 시)
DROP POLICY IF EXISTS "Drivers can insert own info" ON driver_info;

CREATE POLICY "Drivers can insert own info"
  ON driver_info FOR INSERT
  WITH CHECK (auth.uid() = id);

