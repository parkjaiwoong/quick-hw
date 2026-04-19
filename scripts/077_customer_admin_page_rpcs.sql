-- 고객 결제/포인트/추천 + 관리자 대시보드: 단일 RPC로 왕복 축소
-- 적용: Supabase SQL Editor 또는 psql (076 이후 실행 권장)
--
-- 주의: 일부 클라이언트에서 PL/pgSQL의 "SELECT … INTO 변수"가 변수명을 릴레이션으로 오인함.
--       모든 결과는 "변수 := (SELECT … 스칼라 서브쿼리)" 형태만 사용합니다.

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
  allow_role BOOLEAN;
  payments_json JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  allow_role := (
    SELECT
      (COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
      OR COALESCE(
        (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
        ''
      ) IN ('customer', 'admin'))
  );

  IF allow_role IS NOT TRUE THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  payments_json := (
    SELECT COALESCE(
      json_agg(row_to_json(t) ORDER BY t.created_at DESC),
      '[]'::json
    )
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
    ) t
  );

  RETURN json_build_object('payments', COALESCE(payments_json, '[]'::json));
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
  allow_role BOOLEAN;
  balance_amt NUMERIC;
  history_json JSON;
  redemptions_json JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  allow_role := (
    SELECT
      (COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
      OR COALESCE(
        (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
        ''
      ) IN ('customer', 'admin'))
  );

  IF allow_role IS NOT TRUE THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  balance_amt := (
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
    FROM points pt
    WHERE pt.user_id = v_uid
  );

  history_json := (
    SELECT COALESCE(
      json_agg(row_to_json(h) ORDER BY h.created_at DESC),
      '[]'::json
    )
    FROM (
      SELECT pt2.*
      FROM points pt2
      WHERE pt2.user_id = v_uid
      ORDER BY pt2.created_at DESC
      LIMIT 50
    ) h
  );

  redemptions_json := (
    SELECT COALESCE(
      json_agg(row_to_json(rn) ORDER BY rn.created_at DESC),
      '[]'::json
    )
    FROM (
      SELECT nn.id, nn.title, nn.message, nn.is_read, nn.created_at
      FROM notifications nn
      WHERE nn.user_id = v_uid
        AND nn.type IN ('point_redemption', 'point_redemption_completed')
      ORDER BY nn.created_at DESC
      LIMIT 20
    ) rn
  );

  RETURN json_build_object(
    'balance', COALESCE(balance_amt, 0),
    'history', COALESCE(history_json, '[]'::json),
    'redemptions', COALESCE(redemptions_json, '[]'::json)
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
  allow_role BOOLEAN;
  referral_json JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  allow_role := (
    SELECT
      (COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') IN ('customer', 'admin')
      OR COALESCE(
        (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
        ''
      ) IN ('customer', 'admin'))
  );

  IF allow_role IS NOT TRUE THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  referral_json := (
    SELECT row_to_json(r.*)
    FROM referrals r
    WHERE r.referred_id = v_uid
    LIMIT 1
  );

  RETURN json_build_object('referral', referral_json);
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
  allow_role BOOLEAN;
  cnt_total_deliveries BIGINT;
  cnt_active_deliveries BIGINT;
  cnt_customers BIGINT;
  cnt_drivers BIGINT;
  cnt_accidents BIGINT;
  cnt_inquiries BIGINT;
  recent_accidents_json JSON;
  recent_inquiries_json JSON;
  recent_deliveries_json JSON;
  cnt_pending_settlement BIGINT;
  cnt_pending_payout BIGINT;
  amt_pending_payout NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  allow_role := (
    SELECT
      (COALESCE(
        (SELECT pr.role::text FROM public.profiles pr WHERE pr.id = v_uid LIMIT 1),
        ''
      ) = 'admin'
      OR COALESCE(NULLIF(trim(COALESCE(p_role_override, '')), ''), '') = 'admin')
  );

  IF allow_role IS NOT TRUE THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;

  cnt_total_deliveries := (SELECT COUNT(*)::bigint FROM deliveries);

  cnt_active_deliveries := (
    SELECT COUNT(*)::bigint
    FROM deliveries d
    WHERE d.status IN ('pending', 'accepted', 'picked_up', 'in_transit')
  );

  cnt_customers := (SELECT COUNT(*)::bigint FROM profiles pr WHERE pr.role = 'customer');
  cnt_drivers := (SELECT COUNT(*)::bigint FROM profiles pr WHERE pr.role = 'driver');

  cnt_accidents := (
    SELECT COUNT(*)::bigint
    FROM accident_reports ar
    WHERE ar.status IN ('reported', 'investigating')
  );

  cnt_inquiries := (
    SELECT COUNT(*)::bigint
    FROM notifications n
    WHERE n.type = 'inquiry' AND COALESCE(n.is_read, false) = false
  );

  recent_accidents_json := (
    SELECT COALESCE(
      json_agg(row_to_json(t) ORDER BY t.created_at DESC),
      '[]'::json
    )
    FROM (
      SELECT ar.id, ar.accident_type, ar.status, ar.created_at
      FROM accident_reports ar
      ORDER BY ar.created_at DESC
      LIMIT 5
    ) t
  );

  recent_inquiries_json := (
    SELECT COALESCE(
      json_agg(row_to_json(t) ORDER BY t.created_at DESC),
      '[]'::json
    )
    FROM (
      SELECT ni.id, ni.title, ni.message, ni.created_at, ni.is_read
      FROM notifications ni
      WHERE ni.type = 'inquiry'
      ORDER BY ni.created_at DESC
      LIMIT 5
    ) t
  );

  recent_deliveries_json := (
    SELECT COALESCE(
      json_agg(row_to_json(t) ORDER BY t.created_at DESC),
      '[]'::json
    )
    FROM (
      SELECT d.id, d.pickup_address, d.delivery_address, d.status, d.created_at
      FROM deliveries d
      ORDER BY d.created_at DESC
      LIMIT 5
    ) t
  );

  cnt_pending_settlement := (
    SELECT COUNT(*)::bigint
    FROM settlements s
    WHERE s.status = 'pending'
  );

  cnt_pending_payout := (
    SELECT COUNT(*)::bigint
    FROM payout_requests pr
    WHERE pr.status IN ('requested', 'on_hold')
  );

  amt_pending_payout := (
    SELECT COALESCE(SUM(pr.requested_amount), 0)
    FROM payout_requests pr
    WHERE pr.status IN ('requested', 'on_hold')
  );

  RETURN json_build_object(
    'total_deliveries', COALESCE(cnt_total_deliveries, 0),
    'active_deliveries', COALESCE(cnt_active_deliveries, 0),
    'customers', COALESCE(cnt_customers, 0),
    'drivers', COALESCE(cnt_drivers, 0),
    'accidents', COALESCE(cnt_accidents, 0),
    'inquiries', COALESCE(cnt_inquiries, 0),
    'recent_accidents', COALESCE(recent_accidents_json, '[]'::json),
    'recent_inquiries', COALESCE(recent_inquiries_json, '[]'::json),
    'recent_deliveries', COALESCE(recent_deliveries_json, '[]'::json),
    'pending_settlement_count', COALESCE(cnt_pending_settlement, 0),
    'pending_payout_count', COALESCE(cnt_pending_payout, 0),
    'pending_payout_amount', COALESCE(amt_pending_payout, 0)
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
