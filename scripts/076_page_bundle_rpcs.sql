-- 화면별 DB 왕복 축소: 단일 RPC로 묶음 (기사 홈, 수락 가능 배송, 공지, 사고 신고)
-- 적용: Supabase SQL Editor 또는 psql

-- ── 1) 기사 대시보드 홈
CREATE OR REPLACE FUNCTION get_driver_dashboard_home()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_driver_info JSON;
  v_available JSON;
  v_assigned JSON;
  v_recent JSON;
  v_accidents JSON;
  v_rider_code TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  INSERT INTO driver_info (id, vehicle_type, vehicle_number, license_number, is_available)
  VALUES (v_uid, NULL, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;

  SELECT row_to_json(d.*) INTO v_driver_info FROM driver_info d WHERE d.id = v_uid LIMIT 1;

  SELECT r.code INTO v_rider_code FROM riders r WHERE r.id = v_uid LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_available
  FROM (
    SELECT id, pickup_address, delivery_address, distance_km, driver_fee, total_fee, vehicle_type,
           urgency, delivery_option, item_description, package_size, created_at
    FROM deliveries
    WHERE status = 'pending' AND driver_id IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_assigned
  FROM (
    SELECT * FROM deliveries
    WHERE driver_id = v_uid AND status IN ('accepted', 'picked_up', 'in_transit')
    ORDER BY accepted_at DESC NULLS LAST
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_recent
  FROM (
    SELECT id, status, created_at, delivered_at
    FROM deliveries
    WHERE driver_id = v_uid
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_accidents
  FROM (
    SELECT id, status, accident_type FROM accident_reports WHERE driver_id = v_uid
  ) t;

  RETURN json_build_object(
    'driver_info', v_driver_info,
    'rider_code', v_rider_code,
    'available_deliveries', v_available,
    'assigned_deliveries', v_assigned,
    'recent_deliveries', v_recent,
    'accidents', v_accidents
  );
END;
$$;

REVOKE ALL ON FUNCTION get_driver_dashboard_home() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_dashboard_home() TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_dashboard_home() TO service_role;

-- ── 2) 수락 가능 배송 화면
CREATE OR REPLACE FUNCTION get_driver_available_page_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile_role TEXT;
  v_driver_info JSON;
  v_available JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.role INTO v_profile_role FROM profiles p WHERE p.id = v_uid LIMIT 1;

  INSERT INTO driver_info (id, vehicle_type, vehicle_number, license_number, is_available)
  VALUES (v_uid, NULL, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;

  SELECT row_to_json(d.*) INTO v_driver_info FROM driver_info d WHERE d.id = v_uid LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json) INTO v_available
  FROM (
    SELECT id, pickup_address, delivery_address, pickup_location, distance_km, driver_fee, total_fee,
           vehicle_type, urgency, delivery_option, item_description, package_size, created_at
    FROM deliveries
    WHERE status = 'pending' AND driver_id IS NULL
    ORDER BY created_at DESC
    LIMIT 50
  ) x;

  RETURN json_build_object(
    'driver_info', v_driver_info,
    'available_deliveries', v_available,
    'profile_role', v_profile_role
  );
END;
$$;

REVOKE ALL ON FUNCTION get_driver_available_page_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_available_page_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_available_page_data() TO service_role;

-- ── 3) 공지 목록 (p_role_override: 쿠키 역할, NULL이면 profiles.role 사용)
CREATE OR REPLACE FUNCTION get_announcements_page_data(p_role_override TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_eff TEXT;
  v_ann JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.role INTO v_role FROM profiles p WHERE p.id = v_uid LIMIT 1;

  v_eff := COALESCE(NULLIF(TRIM(p_role_override), ''), v_role);

  IF v_eff = 'customer' THEN
    SELECT COALESCE(json_agg(sub.r ORDER BY sub.is_pinned DESC NULLS LAST, sub.created_at DESC), '[]'::json)
    INTO v_ann
    FROM (
      SELECT row_to_json(a.*) AS r, a.is_pinned, a.created_at
      FROM announcements a
      WHERE a.target_audience IN ('customer', 'common')
    ) sub;
  ELSIF v_eff = 'driver' THEN
    SELECT COALESCE(json_agg(sub.r ORDER BY sub.is_pinned DESC NULLS LAST, sub.created_at DESC), '[]'::json)
    INTO v_ann
    FROM (
      SELECT row_to_json(a.*) AS r, a.is_pinned, a.created_at
      FROM announcements a
      WHERE a.target_audience IN ('driver', 'common')
    ) sub;
  ELSE
    SELECT COALESCE(json_agg(sub.r ORDER BY sub.is_pinned DESC NULLS LAST, sub.created_at DESC), '[]'::json)
    INTO v_ann
    FROM (
      SELECT row_to_json(a.*) AS r, a.is_pinned, a.created_at
      FROM announcements a
    ) sub;
  END IF;

  RETURN json_build_object('announcements', COALESCE(v_ann, '[]'::json));
END;
$$;

REVOKE ALL ON FUNCTION get_announcements_page_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_announcements_page_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_announcements_page_data(TEXT) TO service_role;

-- ── 4) 기사 사고 신고 화면
CREATE OR REPLACE FUNCTION get_driver_accident_page_data()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile_role TEXT;
  v_deliveries JSON;
  v_accidents JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.role INTO v_profile_role FROM profiles p WHERE p.id = v_uid LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_deliveries
  FROM (
    SELECT id, pickup_address, delivery_address, status, created_at
    FROM deliveries
    WHERE driver_id = v_uid
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  SELECT COALESCE(json_agg(sub.doc ORDER BY sub.created_at DESC), '[]'::json) INTO v_accidents
  FROM (
    SELECT
      json_build_object(
        'id', ar.id,
        'accident_type', ar.accident_type,
        'accident_description', ar.accident_description,
        'created_at', ar.created_at,
        'status', ar.status,
        'photos', ar.photos,
        'delivery', (
          SELECT json_build_object(
            'id', d.id,
            'pickup_address', d.pickup_address,
            'delivery_address', d.delivery_address
          )
          FROM deliveries d WHERE d.id = ar.delivery_id LIMIT 1
        )
      ) AS doc,
      ar.created_at
    FROM accident_reports ar
    WHERE ar.driver_id = v_uid
  ) sub;

  RETURN json_build_object(
    'deliveries', COALESCE(v_deliveries, '[]'::json),
    'accidents', COALESCE(v_accidents, '[]'::json),
    'profile_role', v_profile_role
  );
END;
$$;

REVOKE ALL ON FUNCTION get_driver_accident_page_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_accident_page_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_accident_page_data() TO service_role;

COMMENT ON FUNCTION get_driver_dashboard_home() IS '기사 대시보드: driver_info 보장 + 대기/담당/최근배송/사고/기사코드 단일 조회';
COMMENT ON FUNCTION get_driver_available_page_data() IS '수락 가능 배송 화면: driver_info + 대기 배송(위치)';
COMMENT ON FUNCTION get_announcements_page_data(TEXT) IS '공지: 역할 오버라이드 + 공지 목록';
COMMENT ON FUNCTION get_driver_accident_page_data() IS '기사 사고 화면: 최근 배송 + 사고 목록';
