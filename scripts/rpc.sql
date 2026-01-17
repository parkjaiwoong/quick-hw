-- RPC + RLS for rider referral (MVP)
-- Preconditions: profiles, deliveries tables exist
-- This file is safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =========================================================
-- Tables (minimal required for RPC)
-- =========================================================
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rider_customer_referral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_via TEXT NOT NULL DEFAULT 'rider_url',
  last_touch_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(customer_id)
);

CREATE TABLE IF NOT EXISTS rider_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  from_rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  to_rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  reason TEXT,
  admin_reason TEXT,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rider_referral_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES riders(id),
  customer_id UUID REFERENCES customers(id),
  session_id TEXT,
  ip_hash TEXT,
  ua_hash TEXT,
  device_fingerprint TEXT,
  path TEXT,
  action TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abuse_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  rider_id UUID REFERENCES riders(id),
  flag_type TEXT NOT NULL,
  detail JSONB,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS referring_rider_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_referral_customer ON rider_customer_referral(customer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rider ON rider_customer_referral(rider_id);
CREATE INDEX IF NOT EXISTS idx_change_customer ON rider_change_history(customer_id);

ALTER TABLE rider_change_history
  ADD COLUMN IF NOT EXISTS admin_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_access_rider ON rider_referral_access_log(rider_id);
CREATE INDEX IF NOT EXISTS idx_access_ip ON rider_referral_access_log(ip_hash);

-- =========================================================
-- RPC: 기사 URL 진입 처리
-- =========================================================
CREATE OR REPLACE FUNCTION rider_url_visit(
  p_code TEXT,
  p_ip TEXT,
  p_ua TEXT,
  p_session_id TEXT,
  p_device_fp TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rider_id UUID;
  v_ip_hash TEXT := encode(extensions.digest(convert_to(COALESCE(p_ip, ''), 'UTF8'), 'sha256'::text), 'hex');
  v_ua_hash TEXT := encode(extensions.digest(convert_to(COALESCE(p_ua, ''), 'UTF8'), 'sha256'::text), 'hex');
  v_existing UUID;
  v_cooldown TIMESTAMPTZ;
  v_recent_count INTEGER := 0;
BEGIN
  SELECT id INTO v_rider_id
  FROM riders
  WHERE code = p_code AND deleted_at IS NULL;

  IF v_rider_id IS NULL THEN
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (NULL, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'blocked', 'invalid_code');
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF v_user IS NULL THEN
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (v_rider_id, NULL, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'visit', 'anonymous');
    RETURN jsonb_build_object('status', 'cookie_only', 'rider_id', v_rider_id);
  END IF;

  IF v_user = v_rider_id THEN
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (v_rider_id, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'blocked', 'self_visit');
    INSERT INTO abuse_flags (customer_id, rider_id, flag_type, detail)
    VALUES (v_user, v_rider_id, 'self_order', jsonb_build_object('reason', 'self_visit'));
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'self_visit');
  END IF;

  SELECT id INTO v_existing
  FROM rider_customer_referral
  WHERE customer_id = v_user AND status = 'active' AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    UPDATE rider_customer_referral SET last_touch_at = now(), updated_at = now()
    WHERE id = v_existing;
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (v_rider_id, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'already_assigned', 'has_active_referral');
    RETURN jsonb_build_object('status', 'already_assigned', 'rider_id', v_rider_id);
  END IF;

  SELECT cooldown_until INTO v_cooldown
  FROM rider_change_history
  WHERE customer_id = v_user
    AND status = 'approved'
    AND cooldown_until IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cooldown IS NOT NULL AND v_cooldown > now() THEN
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (v_rider_id, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'blocked', 'cooldown');
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'cooldown');
  END IF;

  SELECT COUNT(DISTINCT rider_id) INTO v_recent_count
  FROM rider_referral_access_log
  WHERE ip_hash = v_ip_hash
    AND ua_hash = v_ua_hash
    AND created_at > now() - interval '24 hours';

  IF v_recent_count >= 3 THEN
    INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
    VALUES (v_rider_id, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'blocked', 'ip_ua_limit');
    INSERT INTO abuse_flags (customer_id, rider_id, flag_type, detail)
    VALUES (v_user, v_rider_id, 'multi_ip', jsonb_build_object('ip_hash', v_ip_hash, 'ua_hash', v_ua_hash));
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'ip_ua_limit');
  END IF;

  INSERT INTO rider_customer_referral (customer_id, rider_id, assigned_via, last_touch_at)
  VALUES (v_user, v_rider_id, 'rider_url', now());

  INSERT INTO rider_referral_access_log (rider_id, customer_id, session_id, ip_hash, ua_hash, device_fingerprint, path, action, reason)
  VALUES (v_rider_id, v_user, p_session_id, v_ip_hash, v_ua_hash, p_device_fp, '/r/' || p_code, 'assigned', 'first_assignment');

  RETURN jsonb_build_object('status', 'assigned', 'rider_id', v_rider_id);
END;
$$;

CREATE OR REPLACE FUNCTION confirm_customer_referral(
  p_code TEXT,
  p_ip TEXT,
  p_ua TEXT,
  p_session_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN rider_url_visit(p_code, p_ip, p_ua, p_session_id, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION confirm_customer_referral_for_customer(
  p_customer_id UUID,
  p_code TEXT,
  p_ip TEXT,
  p_ua TEXT,
  p_session_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claim.role', true);
  v_rider_id UUID;
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT id INTO v_rider_id FROM riders WHERE code = p_code AND deleted_at IS NULL;
  IF v_rider_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF p_customer_id = v_rider_id THEN
    RETURN jsonb_build_object('status', 'blocked', 'reason', 'self_visit');
  END IF;

  INSERT INTO rider_customer_referral (customer_id, rider_id, assigned_via, last_touch_at)
  VALUES (p_customer_id, v_rider_id, 'signup', now())
  ON CONFLICT (customer_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'assigned', 'rider_id', v_rider_id);
END;
$$;

CREATE OR REPLACE FUNCTION request_rider_change(
  p_to_code TEXT,
  p_reason TEXT,
  p_ip TEXT,
  p_ua TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_current rider_customer_referral%ROWTYPE;
  v_to_rider UUID;
  v_pending UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT * INTO v_current
  FROM rider_customer_referral
  WHERE customer_id = v_user AND status = 'active' AND deleted_at IS NULL;

  IF v_current.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_current_referral');
  END IF;

  SELECT id INTO v_to_rider FROM riders WHERE code = p_to_code AND deleted_at IS NULL;
  IF v_to_rider IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code');
  END IF;

  IF v_to_rider = v_current.rider_id THEN
    RETURN jsonb_build_object('status', 'same_rider');
  END IF;

  SELECT id INTO v_pending
  FROM rider_change_history
  WHERE customer_id = v_user
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pending IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'pending', 'reason', 'already_pending');
  END IF;

  UPDATE rider_customer_referral
  SET updated_at = now()
  WHERE id = v_current.id;

  INSERT INTO rider_change_history (
    customer_id, from_rider_id, to_rider_id, reason, requested_by, status, cooldown_until
  ) VALUES (
    v_user, v_current.rider_id, v_to_rider, p_reason, 'customer', 'pending', NULL
  );

  RETURN jsonb_build_object('status', 'pending', 'rider_id', v_to_rider);
END;
$$;

CREATE OR REPLACE FUNCTION resolve_rider_for_order(
  p_customer_id UUID,
  p_order_at TIMESTAMPTZ DEFAULT now()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id UUID;
BEGIN
  SELECT rider_id INTO v_rider_id
  FROM rider_customer_referral
  WHERE customer_id = p_customer_id
    AND status = 'active'
    AND deleted_at IS NULL
  ORDER BY assigned_at DESC
  LIMIT 1;

  IF v_rider_id = p_customer_id THEN
    INSERT INTO abuse_flags (customer_id, rider_id, flag_type, detail)
    VALUES (p_customer_id, v_rider_id, 'self_order', jsonb_build_object('reason', 'self_order_block'));
    RETURN NULL;
  END IF;

  RETURN v_rider_id;
END;
$$;

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_customer_referral ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_referral_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS riders_admin_all ON riders;
DROP POLICY IF EXISTS customers_admin_all ON customers;
DROP POLICY IF EXISTS referral_customer_read ON rider_customer_referral;
DROP POLICY IF EXISTS referral_rider_read ON rider_customer_referral;
DROP POLICY IF EXISTS referral_admin_all ON rider_customer_referral;
DROP POLICY IF EXISTS change_customer_read ON rider_change_history;
DROP POLICY IF EXISTS change_admin_all ON rider_change_history;
DROP POLICY IF EXISTS access_admin_all ON rider_referral_access_log;
DROP POLICY IF EXISTS abuse_admin_all ON abuse_flags;

CREATE POLICY riders_admin_all ON riders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY customers_admin_all ON customers
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY referral_customer_read ON rider_customer_referral
  FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY referral_rider_read ON rider_customer_referral
  FOR SELECT
  USING (rider_id = auth.uid());

CREATE POLICY referral_admin_all ON rider_customer_referral
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY change_customer_read ON rider_change_history
  FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY change_admin_all ON rider_change_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE rider_change_history
  ADD COLUMN IF NOT EXISTS admin_reason TEXT;

CREATE POLICY access_admin_all ON rider_referral_access_log
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY abuse_admin_all ON abuse_flags
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- =========================================================
-- RPC 권한 (PostgREST schema cache 노출)
-- =========================================================
GRANT EXECUTE ON FUNCTION rider_url_visit(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_customer_referral(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_customer_referral_for_customer(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION request_rider_change(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_rider_for_order(uuid, timestamptz) TO authenticated;
