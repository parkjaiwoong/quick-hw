-- Realtime으로 기사 알림이 오지 않을 때 Supabase SQL Editor에서 실행하세요.
-- 1) notifications 테이블이 Realtime publication에 포함되는지 확인
-- 2) 없으면 추가

-- 확인: supabase_realtime에 포함된 테이블 목록 (행 수 = 테이블 개수. 2건 = 테이블 2개일 뿐, INSERT 개수 아님)
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

-- 다시 확인 (위와 동일: 테이블 목록만 조회)
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ★ INSERT 여부 확인: 결재 완료 후 이 쿼리로 알림 행이 늘었는지 보세요 (행이 안 늘면 서버에서 INSERT 안 된 것)
-- SELECT id, user_id, delivery_id, type, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;
