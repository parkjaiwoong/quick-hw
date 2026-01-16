-- 최종 트리거 수정 (에러 발생 시에도 계속 진행)

-- 로그 테이블 확인 및 생성
CREATE TABLE IF NOT EXISTS public.trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name TEXT NOT NULL,
  user_id UUID,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 트리거 함수 재생성 (에러 발생 시에도 계속 진행하도록 수정)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role user_role;
BEGIN
  -- 로그 기록 시도 (실패해도 계속 진행)
  BEGIN
    INSERT INTO public.trigger_logs (trigger_name, user_id, message)
    VALUES ('on_auth_user_created', NEW.id, 'Trigger started for user: ' || NEW.id::text);
  EXCEPTION WHEN OTHERS THEN
    -- 로그 실패는 무시
    NULL;
  END;
  
  -- raw_user_meta_data에서 값 추출
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'::user_role);
  
  -- 프로필 생성 (에러 발생 시에도 계속 진행)
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      v_full_name,
      v_phone,
      v_role
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- 성공 로그
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, message)
      VALUES ('on_auth_user_created', NEW.id, 'Profile created successfully');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  EXCEPTION WHEN OTHERS THEN
    -- 에러 로그 기록
    BEGIN
      INSERT INTO public.trigger_logs (trigger_name, user_id, message)
      VALUES ('on_auth_user_created', NEW.id, 'Profile creation error: ' || SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    -- 에러가 발생해도 계속 진행 (RAISE하지 않음)
  END;
  
  -- 배송원인 경우 driver_info도 생성
  IF v_role = 'driver' THEN
    BEGIN
      INSERT INTO public.driver_info (id)
      VALUES (NEW.id)
      ON CONFLICT (id) DO NOTHING;
      
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, message)
        VALUES ('on_auth_user_created', NEW.id, 'Driver info created');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    EXCEPTION WHEN OTHERS THEN
      -- 에러 로그 기록
      BEGIN
        INSERT INTO public.trigger_logs (trigger_name, user_id, message)
        VALUES ('on_auth_user_created', NEW.id, 'Driver info creation error: ' || SQLERRM);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END IF;
  
  RETURN NEW;
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

-- 로그 테이블 확인
SELECT COUNT(*) AS log_count FROM public.trigger_logs;

