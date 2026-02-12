-- 귀속 기사 수수료: 배송 완료 시 referring_rider_id 에게 리워드 기록 및 지갑 적립
-- rider_reward_history (delivery 기반), reward_policy_master 사용

-- reward_policy_master (기본 정책)
CREATE TABLE IF NOT EXISTS reward_policy_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_reward_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  company_share_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  customer_reward_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  customer_misc_reward_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- rider_reward_history (delivery 기준, append-only)
CREATE TABLE IF NOT EXISTS rider_reward_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_rate NUMERIC(5,4) NOT NULL,
  reward_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rider_reward_history_rider ON rider_reward_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_reward_history_delivery ON rider_reward_history(delivery_id);

ALTER TABLE rider_reward_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can view own reward history" ON rider_reward_history;
CREATE POLICY "Riders can view own reward history"
  ON rider_reward_history FOR SELECT
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Admins can manage rider reward history" ON rider_reward_history;
CREATE POLICY "Admins can manage rider reward history"
  ON rider_reward_history FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 서비스 역할로만 INSERT (앱에서 정산 시)
-- RLS에서 authenticated INSERT 차단하지 않으면 앱에서 service role로 insert 가능

-- 기본 정책 1건 (없을 때만)
INSERT INTO reward_policy_master (rider_reward_rate, company_share_rate, customer_reward_rate, customer_misc_reward_rate, is_active)
SELECT 0.05, 0, 0, 0, true
WHERE NOT EXISTS (SELECT 1 FROM reward_policy_master WHERE is_active = true AND deleted_at IS NULL);
