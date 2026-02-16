-- Web Push 구독 저장 (탭 종료 후에도 알림 받기)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE push_subscriptions IS '기사 Web Push 구독. 서비스 워커로 탭 종료 후에도 알림 수신';

-- Flutter 앱 FCM 토큰 저장
CREATE TABLE IF NOT EXISTS driver_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_fcm_tokens_user ON driver_fcm_tokens(user_id);

ALTER TABLE driver_fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers manage own FCM token" ON driver_fcm_tokens;
CREATE POLICY "Drivers manage own FCM token"
  ON driver_fcm_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE driver_fcm_tokens IS '기사 Flutter 앱 FCM 토큰. 백그라운드/종료 시 푸시 수신';
