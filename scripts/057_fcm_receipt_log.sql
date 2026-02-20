-- FCM 수신 확인용 로그 (기사 앱에서 FCM 수신 즉시 API로 저장)
-- Supabase Dashboard → SQL Editor에서 실행
CREATE TABLE IF NOT EXISTS fcm_receipt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  delivery_id UUID,
  source TEXT NOT NULL,  -- 'foreground' | 'background' | 'native'
  raw_data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_fcm_receipt_log_created_at ON fcm_receipt_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fcm_receipt_log_driver_delivery ON fcm_receipt_log(driver_id, delivery_id);

COMMENT ON TABLE fcm_receipt_log IS '기사 앱 FCM 수신 로그. 수신 즉시 DB에 저장해 실제 수신 여부 확인용';
