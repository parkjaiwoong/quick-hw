-- Realtime(postgres_changes) 구독을 위해 deliveries, notifications 테이블을
-- supabase_realtime publication에 추가합니다.
-- 이미 추가된 경우(42710: already member) 오류를 무시하고 넘어갑니다.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
