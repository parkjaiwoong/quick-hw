-- 유용한 데이터베이스 함수들

-- 거리 계산 함수 (위도/경도를 이용한 하버사인 공식)
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

-- 배송 요금 계산 함수
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_km DECIMAL)
RETURNS TABLE(
  total_fee DECIMAL,
  base_fee DECIMAL,
  distance_fee DECIMAL,
  driver_fee DECIMAL,
  platform_fee DECIMAL
) AS $$
DECLARE
  config RECORD;
  calculated_base_fee DECIMAL;
  calculated_distance_fee DECIMAL;
  calculated_total_fee DECIMAL;
  calculated_driver_fee DECIMAL;
  calculated_platform_fee DECIMAL;
BEGIN
  -- 요금 설정 가져오기
  SELECT * INTO config FROM pricing_config LIMIT 1;
  
  calculated_base_fee := config.base_fee;
  calculated_distance_fee := distance_km * config.per_km_fee;
  calculated_total_fee := calculated_base_fee + calculated_distance_fee;
  
  -- 플랫폼 수수료 계산
  calculated_platform_fee := calculated_total_fee * (config.platform_commission_rate / 100);
  calculated_driver_fee := calculated_total_fee - calculated_platform_fee;
  
  -- 최소 배송원 수수료 보장
  IF calculated_driver_fee < config.min_driver_fee THEN
    calculated_driver_fee := config.min_driver_fee;
    calculated_platform_fee := calculated_total_fee - calculated_driver_fee;
  END IF;
  
  RETURN QUERY SELECT
    calculated_total_fee,
    calculated_base_fee,
    calculated_distance_fee,
    calculated_driver_fee,
    calculated_platform_fee;
END;
$$ LANGUAGE plpgsql;

-- 배송원 평점 업데이트 함수
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_rating IS NOT NULL AND OLD.driver_rating IS NULL THEN
    UPDATE driver_info
    SET 
      rating = (
        SELECT AVG(customer_rating)::DECIMAL(3,2)
        FROM deliveries
        WHERE driver_id = NEW.driver_id
        AND customer_rating IS NOT NULL
      ),
      total_deliveries = total_deliveries + 1
    WHERE id = NEW.driver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_driver_rating_trigger
AFTER UPDATE ON deliveries
FOR EACH ROW
WHEN (NEW.status = 'delivered')
EXECUTE FUNCTION update_driver_rating();

-- 알림 생성 함수
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_delivery_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, delivery_id, title, message, type)
  VALUES (p_user_id, p_delivery_id, p_title, p_message, p_type)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- 배송 상태 변경 시 알림 자동 생성
CREATE OR REPLACE FUNCTION notify_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- 고객에게 알림
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM create_notification(
        NEW.customer_id,
        NEW.id,
        '배송 상태 업데이트',
        CASE NEW.status
          WHEN 'accepted' THEN '배송원이 배송을 수락했습니다.'
          WHEN 'picked_up' THEN '물품이 픽업되었습니다.'
          WHEN 'in_transit' THEN '배송이 시작되었습니다.'
          WHEN 'delivered' THEN '배송이 완료되었습니다.'
          WHEN 'cancelled' THEN '배송이 취소되었습니다.'
          ELSE '배송 상태가 변경되었습니다.'
        END,
        'delivery_update'
      );
    END IF;
    
    -- 배송원에게 알림
    IF NEW.driver_id IS NOT NULL THEN
      PERFORM create_notification(
        NEW.driver_id,
        NEW.id,
        '배송 상태 업데이트',
        CASE NEW.status
          WHEN 'accepted' THEN '새로운 배송을 수락했습니다.'
          WHEN 'cancelled' THEN '배송이 취소되었습니다.'
          ELSE '배송 상태가 변경되었습니다.'
        END,
        'delivery_update'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_delivery_status_change_trigger
AFTER UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION notify_delivery_status_change();
