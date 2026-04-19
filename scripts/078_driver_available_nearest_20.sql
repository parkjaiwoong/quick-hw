-- 기사 수락 가능 배송: 기사 current_location ↔ 픽업 pickup_location 거리 가까운 순 최대 20건
-- POINT (x=경도, y=위도) 가정 — 앱의 parsePoint / haversineKm 와 동일 축
-- 적용: Supabase SQL Editor
--
-- Supabase 일부 클라이언트는 $$ … $$ 안의 세미콜론을 잘못 분리할 수 있어,
-- 본문은 $func$ 태그 + SELECT … INTO 대신 := (서브쿼리) 형태로 작성했습니다.

CREATE OR REPLACE FUNCTION get_driver_available_page_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid UUID := auth.uid();
  v_profile_role TEXT;
  v_driver_info JSON;
  v_available JSON;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  v_profile_role := (SELECT p.role FROM profiles p WHERE p.id = v_uid LIMIT 1);

  INSERT INTO driver_info (id, vehicle_type, vehicle_number, license_number, is_available)
  VALUES (v_uid, NULL, NULL, NULL, false)
  ON CONFLICT (id) DO NOTHING;

  v_driver_info := (SELECT row_to_json(d.*) FROM driver_info d WHERE d.id = v_uid LIMIT 1);

  v_available := (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        sub.id,
        sub.pickup_address,
        sub.delivery_address,
        sub.pickup_location,
        sub.distance_km,
        sub.driver_fee,
        sub.total_fee,
        sub.vehicle_type,
        sub.urgency,
        sub.delivery_option,
        sub.item_description,
        sub.package_size,
        sub.created_at
      FROM (
        SELECT
          d.id,
          d.pickup_address,
          d.delivery_address,
          d.pickup_location,
          d.distance_km,
          d.driver_fee,
          d.total_fee,
          d.vehicle_type,
          d.urgency,
          d.delivery_option,
          d.item_description,
          d.package_size,
          d.created_at,
          CASE
            WHEN di.current_location IS NULL OR d.pickup_location IS NULL THEN NULL
            ELSE (
              6371.0 * acos(
                LEAST(
                  1::double precision,
                  GREATEST(
                    -1::double precision,
                    cos(radians((di.current_location)[1]::double precision))
                    * cos(radians((d.pickup_location)[1]::double precision))
                    * cos(
                      radians((d.pickup_location)[0]::double precision)
                      - radians((di.current_location)[0]::double precision)
                    )
                    + sin(radians((di.current_location)[1]::double precision))
                    * sin(radians((d.pickup_location)[1]::double precision))
                  )
                )
              )
            )
          END AS sort_km
        FROM deliveries d
        INNER JOIN driver_info di ON di.id = v_uid
        WHERE d.status = 'pending' AND d.driver_id IS NULL
      ) sub
      ORDER BY sub.sort_km NULLS LAST, sub.created_at DESC
      LIMIT 20
    ) t
  );

  RETURN json_build_object(
    'driver_info', v_driver_info,
    'available_deliveries', v_available,
    'profile_role', v_profile_role
  );
END;
$func$;

REVOKE ALL ON FUNCTION get_driver_available_page_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_driver_available_page_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_driver_available_page_data() TO service_role;

COMMENT ON FUNCTION get_driver_available_page_data() IS '수락 가능 배송: 기사 위치 기준 픽업 거리 가까운 순 최대 20건';
