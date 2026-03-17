-- 고객 메인 페이지용 단일 RPC: profile + deliveries(orders,payments) + rider_change_history + 귀속 기사 정보 한 번에 반환
-- DB 왕복 1회로 체감 속도 개선

-- deliveries(customer_id, created_at) 인덱스는 기존 idx_deliveries_customer 등 활용
CREATE INDEX IF NOT EXISTS idx_rider_change_history_customer_created
  ON rider_change_history (customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION get_customer_main_page_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile           JSON;
  v_referring_driver  UUID;
  v_latest_change     JSON;
  v_deliveries        JSON;
  v_referring_code    TEXT;
  v_referring_profile JSON;
BEGIN
  -- 1) 프로필 전체 (role, full_name, referring_driver_id 등)
  SELECT row_to_json(p.*) INTO v_profile
  FROM profiles p WHERE p.id = p_user_id LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN json_build_object('profile', NULL, 'deliveries', '[]', 'latest_change_request', NULL, 'referring_rider_code', NULL, 'referring_profile', NULL);
  END IF;

  BEGIN
    v_referring_driver := ((v_profile::jsonb)->>'referring_driver_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_referring_driver := NULL;
  END;

  -- 3) 최근 기사 변경 요청 1건
  SELECT to_jsonb(r.*)
  INTO v_latest_change
  FROM (
    SELECT rch.id, rch.status, rch.admin_reason, rch.cooldown_until, rch.created_at
    FROM rider_change_history rch
    WHERE rch.customer_id = p_user_id
    ORDER BY rch.created_at DESC
    LIMIT 1
  ) r;

  -- 4) 배송 목록 + orders, payments (Supabase 응답 형태로)
  SELECT json_agg(
    (row_to_json(d.*)::jsonb || jsonb_build_object(
      'orders', COALESCE(
        (SELECT json_agg(json_build_object('order_amount', o.order_amount, 'order_status', o.order_status, 'payment_method', o.payment_method))
         FROM orders o WHERE o.delivery_id = d.id),
        '[]'::json
      ),
      'payments', COALESCE(
        (SELECT json_agg(json_build_object('status', p.status, 'amount', p.amount, 'payment_method', p.payment_method))
         FROM payments p WHERE p.delivery_id = d.id),
        '[]'::json
      )
    ))::json
  )
  INTO v_deliveries
  FROM deliveries d
  WHERE d.customer_id = p_user_id
  ORDER BY d.created_at DESC;

  v_deliveries := COALESCE(v_deliveries, '[]'::json);

  -- 5) 귀속 기사 코드 + 프로필 (referring_driver_id 있을 때만)
  IF v_referring_driver IS NOT NULL THEN
    SELECT r.code INTO v_referring_code FROM riders r WHERE r.id = v_referring_driver LIMIT 1;
    SELECT json_build_object('full_name', p.full_name, 'email', p.email, 'phone', p.phone)
    INTO v_referring_profile
    FROM profiles p WHERE p.id = v_referring_driver LIMIT 1;
  END IF;

  RETURN json_build_object(
    'profile', v_profile,
    'deliveries', v_deliveries,
    'latest_change_request', v_latest_change,
    'referring_rider_code', v_referring_code,
    'referring_profile', v_referring_profile
  );
END;
$$;

COMMENT ON FUNCTION get_customer_main_page_data(UUID) IS '고객 메인 페이지: profile, deliveries(orders,payments), latest_change_request, referring_rider 한 번에 반환';
GRANT EXECUTE ON FUNCTION get_customer_main_page_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_main_page_data(UUID) TO service_role;
