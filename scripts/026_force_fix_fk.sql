-- Foreign Key Constraint 강제 수정
-- 이 스크립트는 profiles 테이블의 foreign key를 강제로 auth.users로 설정합니다

-- 1. 현재 foreign key constraint 확인
SELECT 
    conname AS constraint_name,
    confrelid::regclass::text AS referenced_table_text,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f';

-- 2. 모든 foreign key constraint 삭제 (안전하게)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
          AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- 3. 올바른 foreign key constraint 생성
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 4. 최종 확인 - 반드시 auth.users를 참조해야 함
SELECT 
    conname AS constraint_name,
    confrelid::regclass::text AS referenced_table_text,
    CASE 
        WHEN confrelid::regclass::text = 'auth.users' THEN '✅ Correct - references auth.users'
        ELSE '❌ Wrong - references ' || confrelid::regclass::text
    END AS status,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

-- 5. 테스트: auth.users에 사용자가 있는지 확인
SELECT 
    id,
    email,
    email_confirmed_at IS NOT NULL AS is_confirmed,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 6. 테스트: profiles 테이블에 데이터가 있는지 확인
SELECT COUNT(*) AS profile_count FROM public.profiles;

