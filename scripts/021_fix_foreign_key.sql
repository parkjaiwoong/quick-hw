-- Foreign Key Constraint 확인 및 수정
-- profiles 테이블의 foreign key가 올바르게 설정되어 있는지 확인

-- 1. 현재 foreign key constraint 확인
SELECT 
    tc.table_schema, 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'profiles' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- 2. 잘못된 foreign key가 있다면 삭제
-- (public.users를 참조하는 경우)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND confrelid::regclass::text LIKE '%users%'
      AND confrelid::regclass::text NOT LIKE '%auth.users%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped incorrect foreign key constraint: %', constraint_name;
    END IF;
END $$;

-- 3. 올바른 foreign key constraint 재생성 (없는 경우)
DO $$
BEGIN
    -- profiles_id_fkey가 없거나 잘못된 경우
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_id_fkey'
          AND confrelid = 'auth.users'::regclass
    ) THEN
        -- 기존 constraint 삭제 (잘못된 경우)
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
        
        -- 올바른 constraint 생성
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Created correct foreign key constraint: profiles_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists and is correct';
    END IF;
END $$;

-- 4. 최종 확인
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_schema || '.' || ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'profiles' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'id';

