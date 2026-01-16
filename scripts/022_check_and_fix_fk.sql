-- Foreign Key Constraint 확인 및 강제 수정
-- 이 스크립트는 profiles 테이블의 foreign key를 올바르게 설정합니다

-- 1. 현재 foreign key constraint 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname LIKE '%id%';

-- 2. 모든 profiles 관련 foreign key constraint 삭제
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
          AND contype = 'f'
          AND conname LIKE '%id%'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
        RAISE NOTICE 'Dropped constraint: %', r.conname;
    END LOOP;
END $$;

-- 3. 올바른 foreign key constraint 재생성
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 4. 최종 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

-- 5. auth.users 테이블에 실제로 사용자가 있는지 확인 (테스트용)
SELECT COUNT(*) AS user_count FROM auth.users;

