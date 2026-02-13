-- 고객 자주 쓰는 주소 (출발지/도착지) 저장
CREATE TABLE IF NOT EXISTS customer_saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address_type TEXT NOT NULL CHECK (address_type IN ('pickup', 'delivery')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_saved_addresses_user_type
  ON customer_saved_addresses(user_id, address_type);

ALTER TABLE customer_saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved addresses" ON customer_saved_addresses;
CREATE POLICY "Users can view own saved addresses"
  ON customer_saved_addresses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved addresses" ON customer_saved_addresses;
CREATE POLICY "Users can insert own saved addresses"
  ON customer_saved_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved addresses" ON customer_saved_addresses;
CREATE POLICY "Users can delete own saved addresses"
  ON customer_saved_addresses FOR DELETE
  USING (auth.uid() = user_id);
