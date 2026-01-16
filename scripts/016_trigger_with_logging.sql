-- 로깅이 포함된 트리거 함수
-- 트리거가 실행되는지 확인할 수 있도록 로그 추가

-- 로그 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS public.trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name TEXT NOT NULL,
  user_id UUID,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거 함수 재생성 (로깅 포함)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- 로그 기록
  INSERT INTO public.trigger_logs (trigger_name, user_id, message)
  VALUES ('on_auth_user_created', NEW.id, 'Trigger started');
  
  -- 프로필 생성
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- 로그 기록 (성공)
  INSERT INTO public.trigger_logs (trigger_name, user_id, message)
  VALUES ('on_auth_user_created', NEW.id, 'Profile created successfully');
  
  -- 배송원인 경우 driver_info도 생성
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'customer') = 'driver' THEN
    INSERT INTO public.driver_info (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.trigger_logs (trigger_name, user_id, message)
    VALUES ('on_auth_user_created', NEW.id, 'Driver info created');
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 로그 기록
    INSERT INTO public.trigger_logs (trigger_name, user_id, message)
    VALUES ('on_auth_user_created', NEW.id, 'Error: ' || SQLERRM);
    RAISE;
END;
$$;

-- 트리거 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 트리거 확인
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  n.nspname AS schema_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled ✅'
    WHEN 'D' THEN 'disabled ❌'
    ELSE 'unknown'
  END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE t.tgname = 'on_auth_user_created';

-- 최근 트리거 로그 확인
SELECT * FROM public.trigger_logs
ORDER BY created_at DESC
LIMIT 10;

