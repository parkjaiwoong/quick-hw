-- 트리거 로그 상세 확인

-- 최근 트리거 로그 (모든 메시지 확인)
SELECT 
  id,
  trigger_name,
  user_id,
  message,
  created_at
FROM public.trigger_logs
ORDER BY created_at DESC
LIMIT 20;

-- 특정 사용자의 트리거 로그 확인
SELECT 
  trigger_name,
  user_id,
  message,
  created_at
FROM public.trigger_logs
WHERE user_id IN (
  SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1
)
ORDER BY created_at DESC;

