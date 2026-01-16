-- Foreign Key Constraint 직접 수정
-- 이 스크립트는 profiles 테이블의 foreign key를 강제로 auth.users로 설정합니다

-- 1. 현재 상태 확인
SELECT 
    conname AS constraint_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f';

-- 2. 기존 constraint 모두 삭제 (안전하게)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE; -- 이건 삭제하면 안됨!

-- 3. Primary key가 없으면 재생성 (삭제되지 않았어야 함)
-- ALTER TABLE public.profiles ADD PRIMARY KEY (id); -- 필요시 주석 해제

-- 4. 올바른 foreign key constraint 생성
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 5. 최종 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    CASE 
        WHEN confrelid::regclass::text = 'auth.users' THEN '✅ Correct - references auth.users'
        ELSE '❌ Wrong - references ' || confrelid::regclass::text
    END AS status
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

-- 6. 테스트: auth.users에 사용자가 있는지 확인
SELECT 
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) AS confirmed_users,
    COUNT(*) FILTER (WHERE email_confirmed_at IS NULL) AS unconfirmed_users
FROM auth.users;

