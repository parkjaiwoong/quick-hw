-- 가까운 배송원 찾기 및 자동 할당 시스템

-- 거리 계산 함수 (위도/경도를 이용한 하버사인 공식)
-- 이 함수가 없으면 find_nearby_drivers 함수가 작동하지 않습니다.
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 FLOAT, lon1 FLOAT,
  lat2 FLOAT, lon2 FLOAT
)
RETURNS FLOAT AS $$
DECLARE
  earth_radius FLOAT := 6371; -- km
  dlat FLOAT;
  dlon FLOAT;
  a FLOAT;
  c FLOAT;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);
  
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 가까운 배송원 찾기 함수 (거리순 정렬)
-- PostGIS 없이 기본 PostgreSQL POINT 타입 사용
-- POINT 타입: (x, y) = (longitude, latitude)
-- 인덱스 접근: point[0] = x (longitude), point[1] = y (latitude)
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
    (di.current_location)[1] as current_lat,  -- POINT[1] = y (latitude)
    (di.current_location)[0] as current_lng,  -- POINT[0] = x (longitude)
    calculate_distance(
      pickup_lat, 
      pickup_lng, 
      (di.current_location)[1],  -- latitude
      (di.current_location)[0]   -- longitude
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
      (di.current_location)[1],  -- latitude
      (di.current_location)[0]   -- longitude
    ) <= max_distance_km
  ORDER BY distance_km ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- 배송 생성 시 가까운 배송원들에게 알림 보내기
-- PostGIS 없이 기본 PostgreSQL POINT 타입 사용
CREATE OR REPLACE FUNCTION notify_nearby_drivers()
RETURNS TRIGGER AS $$
DECLARE
  nearby_driver RECORD;
  pickup_lat FLOAT;
  pickup_lng FLOAT;
BEGIN
  -- 새로운 배송 요청이 생성되고 상태가 pending일 때만 실행
  IF NEW.status = 'pending' AND OLD.id IS NULL THEN
    -- pickup_location에서 좌표 추출 (PostGIS 없이)
    -- POINT 타입: (x, y) = (longitude, latitude)
    pickup_lat := (NEW.pickup_location)[1];  -- POINT[1] = y (latitude)
    pickup_lng := (NEW.pickup_location)[0];  -- POINT[0] = x (longitude)
    
    -- 가까운 배송원들 찾기 (반경 10km 이내)
    FOR nearby_driver IN 
      SELECT * FROM find_nearby_drivers(
        pickup_lat,
        pickup_lng,
        10.0,
        5
      )
    LOOP
      -- 각 배송원에게 알림 생성
      INSERT INTO notifications (user_id, delivery_id, title, message, type)
      VALUES (
        nearby_driver.driver_id,
        NEW.id,
        '새로운 배송 요청',
        format(
          '픽업 위치에서 %.1f km 거리에 새로운 배송 요청이 있습니다.',
          nearby_driver.distance_km
        ),
        'new_delivery_request'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하면 먼저 삭제)
DROP TRIGGER IF EXISTS notify_nearby_drivers_trigger ON deliveries;

CREATE TRIGGER notify_nearby_drivers_trigger
AFTER INSERT ON deliveries
FOR EACH ROW
EXECUTE FUNCTION notify_nearby_drivers();

-- 배송원이 배송을 수락할 때 다른 알림들을 읽음 처리
CREATE OR REPLACE FUNCTION mark_other_notifications_read()
RETURNS TRIGGER AS $$
BEGIN
  -- 배송이 수락되면 같은 배송에 대한 다른 배송원들의 알림을 읽음 처리
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE notifications
    SET is_read = true
    WHERE delivery_id = NEW.id
    AND user_id != NEW.driver_id
    AND type = 'new_delivery'
    AND is_read = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_other_notifications_read_trigger ON deliveries;

CREATE TRIGGER mark_other_notifications_read_trigger
AFTER UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION mark_other_notifications_read();
