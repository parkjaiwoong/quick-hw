-- Rider dashboard RPC (MVP)
-- Provides KPI + customer list for rider

CREATE OR REPLACE FUNCTION rider_dashboard_kpi(p_period TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_total_customers INTEGER := 0;
  v_period_new_customers INTEGER := 0;
  v_period_orders INTEGER := 0;
  v_period_reward NUMERIC := 0;
  v_total_reward NUMERIC := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_period = 'last_month' THEN
    v_start := date_trunc('month', now()) - interval '1 month';
    v_end := date_trunc('month', now());
  ELSIF p_period = 'all' THEN
    v_start := NULL;
    v_end := NULL;
  ELSE
    v_start := date_trunc('month', now());
    v_end := date_trunc('month', now()) + interval '1 month';
  END IF;

  SELECT COUNT(*)
  INTO v_total_customers
  FROM rider_customer_referral r
  WHERE r.rider_id = v_user
    AND r.deleted_at IS NULL;

  IF v_start IS NULL THEN
    v_period_new_customers := v_total_customers;
  ELSE
    SELECT COUNT(*)
    INTO v_period_new_customers
    FROM rider_customer_referral r
    WHERE r.rider_id = v_user
      AND r.deleted_at IS NULL
      AND r.assigned_at >= v_start
      AND r.assigned_at < v_end;
  END IF;

  IF v_start IS NULL THEN
    SELECT COUNT(*)
    INTO v_period_orders
    FROM deliveries d
    WHERE d.referring_rider_id = v_user;
  ELSE
    SELECT COUNT(*)
    INTO v_period_orders
    FROM deliveries d
    WHERE d.referring_rider_id = v_user
      AND d.created_at >= v_start
      AND d.created_at < v_end;
  END IF;

  SELECT COALESCE(SUM(reward_amount), 0)
  INTO v_total_reward
  FROM rider_reward_history rrh
  WHERE rrh.rider_id = v_user
    AND rrh.deleted_at IS NULL;

  IF v_start IS NULL THEN
    v_period_reward := v_total_reward;
  ELSE
    SELECT COALESCE(SUM(reward_amount), 0)
    INTO v_period_reward
    FROM rider_reward_history rrh
    WHERE rrh.rider_id = v_user
      AND rrh.deleted_at IS NULL
      AND rrh.created_at >= v_start
      AND rrh.created_at < v_end;
  END IF;

  RETURN jsonb_build_object(
    'total_customers', v_total_customers,
    'period_new_customers', v_period_new_customers,
    'period_orders', v_period_orders,
    'period_reward', v_period_reward,
    'total_reward', v_total_reward
  );
END;
$$;

CREATE OR REPLACE FUNCTION rider_dashboard_customers(p_period TEXT)
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  last_order_at TIMESTAMPTZ,
  period_order_count BIGINT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_period = 'last_month' THEN
    v_start := date_trunc('month', now()) - interval '1 month';
    v_end := date_trunc('month', now());
  ELSIF p_period = 'all' THEN
    v_start := NULL;
    v_end := NULL;
  ELSE
    v_start := date_trunc('month', now());
    v_end := date_trunc('month', now()) + interval '1 month';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT r.customer_id
    FROM rider_customer_referral r
    WHERE r.rider_id = v_user
      AND r.deleted_at IS NULL
  ),
  orders AS (
    SELECT
      d.customer_id,
      MAX(d.created_at) AS last_order_at,
      COUNT(*) FILTER (
        WHERE v_start IS NULL OR (d.created_at >= v_start AND d.created_at < v_end)
      ) AS period_order_count
    FROM deliveries d
    WHERE d.referring_rider_id = v_user
    GROUP BY d.customer_id
  )
  SELECT
    b.customer_id,
    COALESCE(p.full_name, p.email, b.customer_id::text) AS customer_name,
    o.last_order_at,
    COALESCE(o.period_order_count, 0) AS period_order_count,
    COALESCE(o.last_order_at >= now() - interval '30 days', false) AS is_active
  FROM base b
  LEFT JOIN orders o ON o.customer_id = b.customer_id
  LEFT JOIN profiles p ON p.id = b.customer_id
  ORDER BY COALESCE(o.period_order_count, 0) DESC, o.last_order_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION rider_dashboard_kpi(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rider_dashboard_customers(text) TO authenticated;
