-- Foreign Key Constraint 최종 확인
-- 이 스크립트는 foreign key constraint가 올바르게 설정되었는지 확인합니다

-- 1. profiles 테이블의 foreign key constraint 확인
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

-- 2. auth.users 테이블의 최근 사용자 확인
SELECT 
    id,
    email,
    email_confirmed_at IS NOT NULL AS is_confirmed,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 3;

-- 3. 테스트: 실제로 foreign key가 작동하는지 확인
-- (이 쿼리는 에러가 발생하면 안 됩니다)
SELECT 
    p.id,
    p.email,
    u.email AS auth_email,
    u.email_confirmed_at IS NOT NULL AS is_confirmed
FROM public.profiles p
RIGHT JOIN auth.users u ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 3;

