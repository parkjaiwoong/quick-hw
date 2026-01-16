-- Reward & referral schema (MVP)

-- ===========================================
-- ENUM
-- ===========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending','paid','cancelled','completed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_status') THEN
    CREATE TYPE reward_status AS ENUM ('pending','confirmed','paid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'point_type') THEN
    CREATE TYPE point_type AS ENUM ('earn','use','adjust');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM ('scheduled','active','ended');
  END IF;
END $$;

-- ===========================================
-- rider / customer
-- ===========================================
CREATE TABLE IF NOT EXISTS rider (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customer (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- customer_referral
-- ===========================================
CREATE TABLE IF NOT EXISTS customer_referral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES rider(id),
  customer_id UUID NOT NULL REFERENCES customer(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(customer_id)
);

-- ===========================================
-- orders
-- ===========================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id),
  order_amount NUMERIC(12,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  referring_rider_id UUID REFERENCES rider(id),
  policy_snapshot_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- reward_policy_master
-- ===========================================
CREATE TABLE IF NOT EXISTS reward_policy_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_reward_rate NUMERIC(5,4) NOT NULL,
  company_share_rate NUMERIC(5,4) NOT NULL,
  customer_reward_rate NUMERIC(5,4) NOT NULL,
  customer_misc_reward_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE reward_policy_master
  ADD COLUMN IF NOT EXISTS customer_misc_reward_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ===========================================
-- rider_reward_policy (override)
-- ===========================================
CREATE TABLE IF NOT EXISTS rider_reward_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES rider(id),
  rider_reward_rate NUMERIC(5,4) NOT NULL,
  active_from TIMESTAMPTZ DEFAULT now(),
  active_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- event_policy
-- ===========================================
CREATE TABLE IF NOT EXISTS event_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_reward_rate NUMERIC(5,4) NOT NULL,
  status event_status NOT NULL DEFAULT 'scheduled',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  stackable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- rider_reward_history (append-only)
-- ===========================================
CREATE TABLE IF NOT EXISTS rider_reward_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  rider_id UUID NOT NULL REFERENCES rider(id),
  reward_rate NUMERIC(5,4) NOT NULL,
  reward_amount NUMERIC(12,2) NOT NULL,
  status reward_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- customer_point_history (append-only)
-- ===========================================
CREATE TABLE IF NOT EXISTS customer_point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customer(id),
  points NUMERIC(12,2) NOT NULL,
  type point_type NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===========================================
-- INDEX
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_referral_customer ON customer_referral(customer_id);
CREATE INDEX IF NOT EXISTS idx_reward_hist_rider ON rider_reward_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_point_hist_customer ON customer_point_history(customer_id);

-- ===========================================
-- RLS ON
-- ===========================================
ALTER TABLE rider_reward_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_point_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_policy_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_reward_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_policy ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS 정책 예시
-- ===========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rider_can_view_own_rewards') THEN
    CREATE POLICY rider_can_view_own_rewards
    ON rider_reward_history
    FOR SELECT
    USING (rider_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_can_view_own_points') THEN
    CREATE POLICY customer_can_view_own_points
    ON customer_point_history
    FOR SELECT
    USING (customer_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_can_view_all_rewards') THEN
    CREATE POLICY admin_can_view_all_rewards
    ON rider_reward_history
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_can_view_all_points') THEN
    CREATE POLICY admin_can_view_all_points
    ON customer_point_history
    FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_can_manage_reward_policies') THEN
    CREATE POLICY admin_can_manage_reward_policies
    ON reward_policy_master
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_can_manage_rider_override') THEN
    CREATE POLICY admin_can_manage_rider_override
    ON rider_reward_policy
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_can_manage_event_policy') THEN
    CREATE POLICY admin_can_manage_event_policy
    ON event_policy
    FOR ALL
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ===========================================
-- Append-only 보장
-- ===========================================
REVOKE UPDATE, DELETE ON rider_reward_history FROM authenticated;
REVOKE UPDATE, DELETE ON customer_point_history FROM authenticated;

-- ===========================================
-- RPC (트랜잭션 처리)
-- ===========================================
CREATE OR REPLACE FUNCTION calculate_rewards_for_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_id UUID;
  v_order_amount NUMERIC(12,2);
  v_rider_id UUID;
  v_base_policy reward_policy_master%ROWTYPE;
  v_event event_policy%ROWTYPE;
  v_rider_rate NUMERIC(5,4);
  v_customer_rate NUMERIC(5,4);
  v_rider_reward NUMERIC(12,2);
  v_customer_points NUMERIC(12,2);
BEGIN
  SELECT customer_id, order_amount INTO v_customer_id, v_order_amount
  FROM orders
  WHERE id = p_order_id AND deleted_at IS NULL;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  SELECT rider_id INTO v_rider_id
  FROM customer_referral
  WHERE customer_id = v_customer_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_rider_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_base_policy
  FROM reward_policy_master
  WHERE is_active = true AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_base_policy.id IS NULL THEN
    RAISE EXCEPTION 'base policy not found';
  END IF;

  v_rider_rate := v_base_policy.rider_reward_rate;

  SELECT * INTO v_event
  FROM event_policy
  WHERE status = 'active'
    AND deleted_at IS NULL
    AND (start_at IS NULL OR start_at <= now())
    AND (end_at IS NULL OR end_at >= now())
  ORDER BY created_at DESC
  LIMIT 1;

  v_customer_rate := v_base_policy.customer_reward_rate + COALESCE(v_base_policy.customer_misc_reward_rate, 0);

  IF v_event.id IS NOT NULL THEN
    IF v_event.stackable THEN
      v_customer_rate := v_customer_rate + v_event.event_reward_rate;
    ELSE
      v_customer_rate := v_event.event_reward_rate;
    END IF;
  END IF;

  v_rider_reward := ROUND(v_order_amount * v_rider_rate, 2);
  v_customer_points := ROUND(v_order_amount * v_customer_rate, 2);

  INSERT INTO rider_reward_history(order_id, rider_id, reward_rate, reward_amount)
  VALUES (p_order_id, v_rider_id, v_rider_rate, v_rider_reward);

  INSERT INTO customer_point_history(order_id, customer_id, points, type, reason)
  VALUES (p_order_id, v_customer_id, v_customer_points, 'earn', 'order_reward');

  UPDATE orders
  SET referring_rider_id = v_rider_id,
      policy_snapshot_id = v_base_policy.id,
      updated_at = now()
  WHERE id = p_order_id;

EXCEPTION WHEN others THEN
  RAISE;
END;
$$;
