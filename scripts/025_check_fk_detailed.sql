-- Foreign Key Constraint 상세 확인
-- 실제로 어떤 테이블을 참조하는지 정확히 확인

-- 1. profiles 테이블의 모든 foreign key constraint 확인
SELECT 
    conname AS constraint_name,
    conrelid::regclass::text AS table_name,
    confrelid::regclass::text AS referenced_table_full,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
ORDER BY conname;

-- 2. profiles_id_fkey가 존재하는지 확인
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.profiles'::regclass
              AND contype = 'f'
              AND conname = 'profiles_id_fkey'
        ) THEN 'EXISTS'
        ELSE 'NOT EXISTS'
    END AS constraint_exists;

-- 3. profiles_id_fkey가 참조하는 테이블 확인
SELECT 
    conname,
    confrelid::regclass::text AS referenced_table_text,
    confrelid::regclass AS referenced_table,
    CASE 
        WHEN confrelid::regclass::text = 'auth.users' THEN '✅ Correct'
        WHEN confrelid::regclass::text LIKE '%users%' THEN '❌ Wrong: ' || confrelid::regclass::text
        ELSE '❌ Unknown: ' || confrelid::regclass::text
    END AS status
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'
  AND conname = 'profiles_id_fkey';

-- 4. auth.users 테이블에 실제로 사용자가 있는지 확인
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 5. profiles 테이블의 스키마 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

