-- 기사연결요청(새 배송 요청) 화면용 단일 쿼리 RPC
-- profile + pricing_config + 마지막 배송 1건을 한 번에 반환하여 DB 왕복 최소화

-- 고객별 최신 배송 1건 조회용 인덱스 (RPC 내부 쿼리 튜닝)
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_created_desc
  ON deliveries (customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION get_new_delivery_page_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile      JSON;
  v_pricing      JSON;
  v_last_delivery JSON;
BEGIN
  -- 프로필 (해당 사용자)
  SELECT to_jsonb(p.*)
  INTO v_profile
  FROM profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  -- 요금 설정 (최신 1건)
  SELECT to_jsonb(pc.*)
  INTO v_pricing
  FROM pricing_config pc
  ORDER BY pc.created_at DESC NULLS LAST, pc.id DESC
  LIMIT 1;

  -- 해당 고객의 최근 배송 1건 (출발/도착 주소·연락처·메모만)
  SELECT to_jsonb(d.*)
  INTO v_last_delivery
  FROM (
    SELECT
      pickup_address,
      pickup_location,
      pickup_contact_name,
      pickup_contact_phone,
      pickup_notes,
      delivery_address,
      delivery_location,
      delivery_contact_name,
      delivery_contact_phone,
      delivery_notes
    FROM deliveries
    WHERE customer_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1
  ) d;

  RETURN json_build_object(
    'profile'       , v_profile,
    'pricing'       , v_pricing,
    'last_delivery' , v_last_delivery
  );
END;
$$;

COMMENT ON FUNCTION get_new_delivery_page_data(UUID) IS '고객 새 배송 요청 화면용: profile + pricing_config + last_delivery 한 번에 반환';
GRANT EXECUTE ON FUNCTION get_new_delivery_page_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_new_delivery_page_data(UUID) TO service_role;
