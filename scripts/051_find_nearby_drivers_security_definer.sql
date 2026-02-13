-- 고객이 find_nearby_drivers RPC를 호출할 때 RLS 때문에 driver_info를 읽지 못하는 문제 해결
-- 함수를 SECURITY DEFINER로 변경하여 호출자(고객)가 아닌 함수 소유자 권한으로 실행되도록 함
-- 참고: 근처 기사 기준 = 출발지(pickup) 기준 반경 max_distance_km(기본 10km) 이내,
--       is_available = true, current_location IS NOT NULL 인 기사만 거리순 정렬

CREATE OR REPLACE FUNCTION find_nearby_drivers(
  pickup_lat FLOAT,
  pickup_lng FLOAT,
  max_distance_km FLOAT DEFAULT 10.0,
  limit_count INT DEFAULT 10
)
RETURNS TABLE(
  driver_id UUID,
  driver_name TEXT,
  driver_phone TEXT,
  current_lat FLOAT,
  current_lng FLOAT,
  distance_km FLOAT,
  rating DECIMAL,
  total_deliveries INT,
  vehicle_type TEXT,
  vehicle_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    di.id,
    COALESCE(p.full_name, '기사')::TEXT as driver_name,
    COALESCE(p.phone, '')::TEXT as driver_phone,
    (di.current_location)[1]::FLOAT as current_lat,
    (di.current_location)[0]::FLOAT as current_lng,
    calculate_distance(
      pickup_lat, 
      pickup_lng, 
      (di.current_location)[1],
      (di.current_location)[0]
    ) as distance_km,
    COALESCE(di.rating, 5.0) as rating,
    COALESCE(di.total_deliveries, 0)::INT as total_deliveries,
    di.vehicle_type::TEXT,
    di.vehicle_number::TEXT
  FROM driver_info di
  LEFT JOIN public.profiles p ON di.id = p.id
  WHERE 
    di.is_available = true
    AND di.current_location IS NOT NULL
    AND calculate_distance(
      pickup_lat, 
      pickup_lng, 
      (di.current_location)[1],
      (di.current_location)[0]
    ) <= max_distance_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION find_nearby_drivers(FLOAT, FLOAT, FLOAT, INT) IS 
  '출발지(pickup_lat, pickup_lng) 기준 반경 max_distance_km 이내 배송가능(is_available=true)이고 위치가 있는 기사 목록. SECURITY DEFINER로 고객 호출 시에도 driver_info 조회 가능.';
