-- Realtime으로 기사 알림이 오지 않을 때 Supabase SQL Editor에서 실행하세요.
-- 1) notifications 테이블이 Realtime publication에 포함되는지 확인
-- 2) 없으면 추가

-- 확인: supabase_realtime에 포함된 테이블 목록
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- notifications가 목록에 없으면 아래 실행 (이미 있으면 42710 오류 무시)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- 이미 포함된 경우
END $$;

-- 다시 확인
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- (참고) 최근 알림 5건 확인
-- SELECT id, user_id, delivery_id, type, created_at FROM notifications ORDER BY created_at DESC LIMIT 5;
