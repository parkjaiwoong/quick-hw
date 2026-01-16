-- Foreign Key Constraint가 실제로 어떤 테이블을 참조하는지 확인

-- 1. 현재 foreign key constraint의 상세 정보 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname LIKE '%id%';

-- 2. 만약 잘못된 테이블을 참조하고 있다면 (예: public.users 또는 users)
-- 다음 쿼리로 확인:
SELECT 
    conname,
    confrelid::regclass::text AS referenced_table_text
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

-- 3. 참조 테이블이 'auth.users'가 아니라면, 강제로 수정
DO $$
DECLARE
    current_ref_table TEXT;
BEGIN
    -- 현재 참조하는 테이블 확인
    SELECT confrelid::regclass::text INTO current_ref_table
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND conname = 'profiles_id_fkey';
    
    RAISE NOTICE 'Current referenced table: %', current_ref_table;
    
    -- auth.users가 아니면 삭제하고 재생성
    IF current_ref_table IS NULL OR current_ref_table != 'auth.users' THEN
        RAISE NOTICE 'Foreign key references wrong table. Dropping and recreating...';
        
        -- 기존 constraint 삭제
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
        
        -- 올바른 constraint 생성
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key constraint recreated successfully!';
    ELSE
        RAISE NOTICE 'Foreign key constraint is correct (references auth.users)';
    END IF;
END $$;

-- 4. 최종 확인
SELECT 
    conname AS constraint_name,
    confrelid::regclass AS referenced_table,
    CASE 
        WHEN confrelid::regclass::text = 'auth.users' THEN '✅ Correct'
        ELSE '❌ Wrong table: ' || confrelid::regclass::text
    END AS status
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

