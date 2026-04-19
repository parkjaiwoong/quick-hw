-- 고객 결제/포인트/추천 + 관리자 대시보드: 단일 RPC로 왕복 축소
-- 적용: Supabase SQL Editor 또는 psql (076 이후 실행 권장)

-- ── 고객 공통: 역할(오버라이드 또는 프로필)로 고객 화면 접근 가능 여부
--   TS: roleOverride in ('customer','admin') OR profile.role in ('customer','admin')

CREATE OR REPLACE FUNCTION get_customer_payments_page_data(p_role_override TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $pl$
DECLARE
  v_uid UUID := auth.uid();
  v_ok BOOLEAN;
  v_payments JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  -- IF 조건에서 PL 변수명이 SQL 릴레이션으로 오해되지 않도록, 역할 판별만 단일 SQL로 계산
  SELECT (
    COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
    OR COALESCE(
      (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
      ''
    ) IN ('customer', 'admin')
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.created_at DESC),
    '[]'::json
  )
  INTO v_payments
  FROM (
    SELECT
      p.id,
      p.amount,
      p.status,
      p.payment_method,
      p.pg_provider,
      p.paid_at,
      p.requested_at,
      p.canceled_at,
      p.refunded_at,
      p.refunded_amount,
      p.created_at,
      (
        SELECT json_build_object(
          'id', d.id,
          'pickup_address', d.pickup_address,
          'delivery_address', d.delivery_address,
          'distance_km', d.distance_km,
          'total_fee', d.total_fee,
          'status', d.status
        )
        FROM deliveries d
        WHERE d.id = p.delivery_id
        LIMIT 1
      ) AS delivery
    FROM payments p
    WHERE p.customer_id = v_uid
  ) t;

  RETURN json_build_object('payments', COALESCE(v_payments, '[]'::json));
END;
$pl$;

REVOKE ALL ON FUNCTION get_customer_payments_page_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customer_payments_page_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_payments_page_data(TEXT) TO service_role;


CREATE OR REPLACE FUNCTION get_customer_points_page_data(p_role_override TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $pl$
DECLARE
  v_uid UUID := auth.uid();
  v_ok BOOLEAN;
  v_balance NUMERIC;
  v_history JSON;
  v_redemptions JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT (
    COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
    OR COALESCE(
      (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
      ''
    ) IN ('customer', 'admin')
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN pt.point_type = 'earned' THEN pt.points::numeric
        WHEN pt.point_type IN ('used', 'expired') THEN -pt.points::numeric
        ELSE 0::numeric
      END
    ),
    0
  )
  INTO v_balance
  FROM points pt
  WHERE pt.user_id = v_uid;

  SELECT COALESCE(
    json_agg(row_to_json(h) ORDER BY h.created_at DESC),
    '[]'::json
  )
  INTO v_history
  FROM (
    SELECT pt2.*
    FROM points pt2
    WHERE pt2.user_id = v_uid
    ORDER BY pt2.created_at DESC
    LIMIT 50
  ) h;

  SELECT COALESCE(
    json_agg(row_to_json(rn) ORDER BY rn.created_at DESC),
    '[]'::json
  )
  INTO v_redemptions
  FROM (
    SELECT nn.id, nn.title, nn.message, nn.is_read, nn.created_at
    FROM notifications nn
    WHERE nn.user_id = v_uid
      AND nn.type IN ('point_redemption', 'point_redemption_completed')
    ORDER BY nn.created_at DESC
    LIMIT 20
  ) rn;

  RETURN json_build_object(
    'balance', COALESCE(v_balance, 0),
    'history', COALESCE(v_history, '[]'::json),
    'redemptions', COALESCE(v_redemptions, '[]'::json)
  );
END;
$pl$;

REVOKE ALL ON FUNCTION get_customer_points_page_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customer_points_page_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_points_page_data(TEXT) TO service_role;


CREATE OR REPLACE FUNCTION get_customer_referral_page_data(p_role_override TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $pl$
DECLARE
  v_uid UUID := auth.uid();
  v_ok BOOLEAN;
  v_referral JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT (
    COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
    OR COALESCE(
      (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
      ''
    ) IN ('customer', 'admin')
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT row_to_json(r.*) INTO v_referral
  FROM referrals r
  WHERE r.referred_id = v_uid
  LIMIT 1;

  RETURN json_build_object('referral', v_referral);
END;
$pl$;

REVOKE ALL ON FUNCTION get_customer_referral_page_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customer_referral_page_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_referral_page_data(TEXT) TO service_role;


CREATE OR REPLACE FUNCTION get_admin_dashboard_bundle(p_role_override TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $pl$
DECLARE
  v_uid UUID := auth.uid();
  v_ok BOOLEAN;
  v_total_deliveries BIGINT;
  v_active_deliveries BIGINT;
  v_customers BIGINT;
  v_drivers BIGINT;
  v_accidents BIGINT;
  v_inquiries BIGINT;
  v_recent_accidents JSON;
  v_recent_inquiries JSON;
  v_recent_deliveries JSON;
  v_pending_settlement BIGINT;
  v_pending_payout_count BIGINT;
  v_pending_payout_amount NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT (
    COALESCE(
      (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
      ''
    ) = 'admin'
    OR COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') = 'admin'
  ) INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  SELECT COUNT(*)::bigint INTO v_total_deliveries FROM deliveries;

  SELECT COUNT(*)::bigint INTO v_active_deliveries
  FROM deliveries d
  WHERE d.status IN ('pending', 'accepted', 'picked_up', 'in_transit');

  SELECT COUNT(*)::bigint INTO v_customers FROM profiles pr WHERE pr.role = 'customer';
  SELECT COUNT(*)::bigint INTO v_drivers FROM profiles pr WHERE pr.role = 'driver';

  SELECT COUNT(*)::bigint INTO v_accidents
  FROM accident_reports ar
  WHERE ar.status IN ('reported', 'investigating');

  SELECT COUNT(*)::bigint INTO v_inquiries
  FROM notifications n
  WHERE n.type = 'inquiry' AND COALESCE(n.is_read, false) = false;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.created_at DESC),
    '[]'::json
  )
  INTO v_recent_accidents
  FROM (
    SELECT ar.id, ar.accident_type, ar.status, ar.created_at
    FROM accident_reports ar
    ORDER BY ar.created_at DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.created_at DESC),
    '[]'::json
  )
  INTO v_recent_inquiries
  FROM (
    SELECT ni.id, ni.title, ni.message, ni.created_at, ni.is_read
    FROM notifications ni
    WHERE ni.type = 'inquiry'
    ORDER BY ni.created_at DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.created_at DESC),
    '[]'::json
  )
  INTO v_recent_deliveries
  FROM (
    SELECT d.id, d.pickup_address, d.delivery_address, d.status, d.created_at
    FROM deliveries d
    ORDER BY d.created_at DESC
    LIMIT 5
  ) t;

  SELECT COUNT(*)::bigint INTO v_pending_settlement
  FROM settlements s
  WHERE s.status = 'pending';

  SELECT COUNT(*)::bigint INTO v_pending_payout_count
  FROM payout_requests pr
  WHERE pr.status IN ('requested', 'on_hold');

  SELECT COALESCE(SUM(pr.requested_amount), 0) INTO v_pending_payout_amount
  FROM payout_requests pr
  WHERE pr.status IN ('requested', 'on_hold');

  RETURN json_build_object(
    'total_deliveries', COALESCE(v_total_deliveries, 0),
    'active_deliveries', COALESCE(v_active_deliveries, 0),
    'customers', COALESCE(v_customers, 0),
    'drivers', COALESCE(v_drivers, 0),
    'accidents', COALESCE(v_accidents, 0),
    'inquiries', COALESCE(v_inquiries, 0),
    'recent_accidents', COALESCE(v_recent_accidents, '[]'::json),
    'recent_inquiries', COALESCE(v_recent_inquiries, '[]'::json),
    'recent_deliveries', COALESCE(v_recent_deliveries, '[]'::json),
    'pending_settlement_count', COALESCE(v_pending_settlement, 0),
    'pending_payout_count', COALESCE(v_pending_payout_count, 0),
    'pending_payout_amount', COALESCE(v_pending_payout_amount, 0)
  );
END;
$pl$;

REVOKE ALL ON FUNCTION get_admin_dashboard_bundle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_bundle(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_bundle(TEXT) TO service_role;

COMMENT ON FUNCTION get_customer_payments_page_data(TEXT) IS '고객 결제 내역: 역할 검증 + payments+delivery 단일 조회';
COMMENT ON FUNCTION get_customer_points_page_data(TEXT) IS '고객 포인트: 잔액+내역+교환 알림 단일 조회';
COMMENT ON FUNCTION get_customer_referral_page_data(TEXT) IS '고객 추천: referred_id 기준 referral 1건';
COMMENT ON FUNCTION get_admin_dashboard_bundle(TEXT) IS '관리자 대시보드: 통계+최근목록+정산/출금 대기 단일 조회';
