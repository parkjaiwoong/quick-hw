-- 기사 알림 흐름 감사 로그 (INSERT 안 된 이유 등 Supabase에서 조회용)
-- ★ Supabase Dashboard → SQL Editor에서 이 파일 내용 전체 붙여넣고 "Run" 한 번 실행하면 테이블 생성됨
-- 생성 후 아래 조회로 최근 원인 확인 가능:
--   SELECT * FROM notification_audit_log ORDER BY created_at DESC LIMIT 30;

CREATE TABLE IF NOT EXISTS notification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_notification_audit_log_created_at ON notification_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_delivery_id ON notification_audit_log(delivery_id);

COMMENT ON TABLE notification_audit_log IS '기사 알림(notifyDriversForDelivery) 단계별 기록. event_type: notify_start, rpc_nearby, rpc_error, fallback_available, insert_skip, insert_ok, insert_fail, push_done';

-- ★ 최근 흐름 조회 (INSERT 안 된 이유 확인)
-- SELECT id, created_at, delivery_id, event_type, payload FROM notification_audit_log ORDER BY created_at DESC LIMIT 30;
