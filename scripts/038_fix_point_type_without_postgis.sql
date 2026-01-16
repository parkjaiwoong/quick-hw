-- PostGIS 없이 기본 PostgreSQL POINT 타입 사용
-- ST_Y, ST_X 대신 기본 POINT 타입의 인덱스 접근 사용

-- find_nearby_drivers 함수 수정 (PostGIS 없이)
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
  total_deliveries INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    di.id,
    COALESCE(p.full_name, '기사') as driver_name,
    COALESCE(p.phone, '') as driver_phone,
    (di.current_location)[0] as current_lat,  -- PostgreSQL 기본 POINT 타입: [0] = y (latitude)
    (di.current_location)[1] as current_lng,  -- PostgreSQL 기본 POINT 타입: [1] = x (longitude)
    calculate_distance(
      pickup_lat, 
      pickup_lng, 
      (di.current_location)[0],  -- latitude
      (di.current_location)[1]   -- longitude
    ) as distance_km,
    COALESCE(di.rating, 5.0) as rating,
    COALESCE(di.total_deliveries, 0) as total_deliveries
  FROM driver_info di
  LEFT JOIN public.profiles p ON di.id = p.id
  WHERE 
    di.is_available = true
    AND di.current_location IS NOT NULL
    AND calculate_distance(
      pickup_lat, 
      pickup_lng, 
      (di.current_location)[0],  -- latitude
      (di.current_location)[1]   -- longitude
    ) <= max_distance_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- notify_nearby_drivers 트리거 함수도 수정
CREATE OR REPLACE FUNCTION notify_nearby_drivers()
RETURNS TRIGGER AS $$
DECLARE
  nearby_drivers RECORD;
  pickup_lat FLOAT;
  pickup_lng FLOAT;
BEGIN
  -- pickup_location에서 좌표 추출 (PostGIS 없이)
  pickup_lat := (NEW.pickup_location)[0];  -- latitude
  pickup_lng := (NEW.pickup_location)[1];  -- longitude
  
  -- 가까운 배송원 찾기
  FOR nearby_drivers IN 
    SELECT driver_id 
    FROM find_nearby_drivers(pickup_lat, pickup_lng, 10.0, 5)
  LOOP
    -- 알림 생성
    INSERT INTO notifications (user_id, delivery_id, title, message, type)
    VALUES (
      nearby_drivers.driver_id,
      NEW.id,
      '새로운 배송 요청',
      CONCAT('근처에 새로운 배송 요청이 있습니다. 거리: ', 
             ROUND(calculate_distance(pickup_lat, pickup_lng, 
                   (SELECT (current_location)[0] FROM driver_info WHERE id = nearby_drivers.driver_id),
                   (SELECT (current_location)[1] FROM driver_info WHERE id = nearby_drivers.driver_id))::numeric, 1), 
             'km'),
      'new_delivery_request'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경 사항 확인
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname IN ('find_nearby_drivers', 'notify_nearby_drivers');

