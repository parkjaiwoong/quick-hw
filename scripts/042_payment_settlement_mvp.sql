-- Payment / settlement / wallet MVP schema

-- ===========================================
-- ENUM (주문/결제/정산 상태 분리)
-- ===========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    CREATE TYPE settlement_status AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'PAID_OUT', 'EXCLUDED');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'REQUEST'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'REQUEST';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'PAID'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'PAID';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'ASSIGNED'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'ASSIGNED';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'PICKED_UP'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'PICKED_UP';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'DELIVERED'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'DELIVERED';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'order_status' AND e.enumlabel = 'CANCELED'
    ) THEN
      ALTER TYPE order_status ADD VALUE 'CANCELED';
    END IF;
  ELSE
    CREATE TYPE order_status AS ENUM ('REQUEST', 'PAID', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELED');
  END IF;
END $$;

-- ===========================================
-- orders (기존 테이블 확장)
-- ===========================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id),
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS customer_adjusted_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS order_status order_status DEFAULT 'REQUEST';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_delivery_unique ON orders(delivery_id);

-- ===========================================
-- payments
-- ===========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'card', 'bank_transfer', 'cash'
  status payment_status NOT NULL DEFAULT 'PENDING',
  pg_provider TEXT,
  pg_tid TEXT,
  canceled_amount NUMERIC(12,2) DEFAULT 0,
  refunded_amount NUMERIC(12,2) DEFAULT 0,
  requested_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- settlements (기존 테이블 확장)
-- ===========================================
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id),
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id),
  ADD COLUMN IF NOT EXISTS settlement_status settlement_status DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payout_request_id UUID,
  ADD COLUMN IF NOT EXISTS excluded_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_settlements_delivery ON settlements(delivery_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status_v2 ON settlements(settlement_status);

-- ===========================================
-- driver_wallet
-- ===========================================
CREATE TABLE IF NOT EXISTS driver_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_settlement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_wallet_driver ON driver_wallet(driver_id);

-- ===========================================
-- payout_requests
-- ===========================================
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  bank_account TEXT,
  bank_name TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_driver ON payout_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

-- ===========================================
-- platform_settings 확장 (지갑/출금 정책)
-- ===========================================
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS driver_wallet_initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_wallet_min_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_payout_cycle_days INTEGER NOT NULL DEFAULT 7;

-- ===========================================
-- Updated_at triggers
-- ===========================================
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_wallet_updated_at BEFORE UPDATE ON driver_wallet
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- wallet update helper functions
-- ===========================================
CREATE OR REPLACE FUNCTION increment_driver_wallet_pending(p_driver_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE driver_wallet
  SET
    pending_balance = pending_balance + p_amount,
    total_balance = total_balance + p_amount,
    last_settlement_at = now()
  WHERE driver_id = p_driver_id;
END;
$$;

CREATE OR REPLACE FUNCTION move_driver_wallet_pending_to_available(p_driver_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE driver_wallet
  SET
    pending_balance = GREATEST(pending_balance - p_amount, 0),
    available_balance = available_balance + p_amount
  WHERE driver_id = p_driver_id;
END;
$$;

-- ===========================================
-- RLS
-- ===========================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- orders: 고객/관리자 조회
DROP POLICY IF EXISTS "Customers can view own orders" ON orders;
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert own orders" ON orders;
CREATE POLICY "Customers can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admins can manage orders" ON orders;
CREATE POLICY "Admins can manage orders"
  ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- payments: 고객/관리자 조회
DROP POLICY IF EXISTS "Customers can view own payments" ON payments;
CREATE POLICY "Customers can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert own payments" ON payments;
CREATE POLICY "Customers can insert own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admins can manage payments" ON payments;
CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- settlements: 기사/관리자 조회
DROP POLICY IF EXISTS "Drivers can view own settlements" ON settlements;
CREATE POLICY "Drivers can view own settlements"
  ON settlements FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admins can manage settlements" ON settlements;
CREATE POLICY "Admins can manage settlements"
  ON settlements FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- driver_wallet: 기사/관리자 조회
DROP POLICY IF EXISTS "Drivers can view own wallet" ON driver_wallet;
CREATE POLICY "Drivers can view own wallet"
  ON driver_wallet FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admins can manage wallets" ON driver_wallet;
CREATE POLICY "Admins can manage wallets"
  ON driver_wallet FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- payout_requests: 기사/관리자
DROP POLICY IF EXISTS "Drivers can view own payout requests" ON payout_requests;
CREATE POLICY "Drivers can view own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Drivers can create own payout requests" ON payout_requests;
CREATE POLICY "Drivers can create own payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admins can manage payout requests" ON payout_requests;
CREATE POLICY "Admins can manage payout requests"
  ON payout_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
