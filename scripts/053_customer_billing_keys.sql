-- 고객 계좌/카드 연동: 토스 빌링키 저장
-- customerKey = profiles.id (UUID), billingKey = 토스 발급 키

CREATE TABLE IF NOT EXISTS customer_billing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,
  billing_key TEXT NOT NULL,
  card_company TEXT,
  card_number_masked TEXT,
  pg_provider TEXT NOT NULL DEFAULT 'TOSS',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_billing_keys_user ON customer_billing_keys(user_id);

ALTER TABLE customer_billing_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing keys" ON customer_billing_keys;
CREATE POLICY "Users can view own billing keys"
  ON customer_billing_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own billing key" ON customer_billing_keys;
CREATE POLICY "Users can insert own billing key"
  ON customer_billing_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own billing key" ON customer_billing_keys;
CREATE POLICY "Users can update own billing key"
  ON customer_billing_keys FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own billing key" ON customer_billing_keys;
CREATE POLICY "Users can delete own billing key"
  ON customer_billing_keys FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE customer_billing_keys IS '고객별 토스 빌링키(자동결제용). 결제창 requestBillingAuth 후 authKey로 발급한 billingKey 저장';
