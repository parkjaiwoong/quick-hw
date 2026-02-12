-- [필수 1회 실행] 배송 옵션 컬럼 추가 (즉시/예약, 차량, 급송, 예약 픽업 일시)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체 복사 후 붙여넣기 → Run
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_option TEXT DEFAULT 'immediate',  -- 'immediate' | 'scheduled'
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'motorcycle',    -- 'motorcycle' | 'car' | 'truck' 등
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'standard',           -- 'standard' | 'express' (즉시 픽업 시)
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;           -- 예약 픽업일시

COMMENT ON COLUMN deliveries.delivery_option IS '즉시 픽업(immediate) 또는 예약 픽업(scheduled)';
COMMENT ON COLUMN deliveries.vehicle_type IS '차량 종류: motorcycle(오토바이), car, truck 등';
COMMENT ON COLUMN deliveries.urgency IS '즉시 픽업 시: standard(기본 3시간 내), express(급송 30분 내)';
COMMENT ON COLUMN deliveries.scheduled_pickup_at IS '예약 픽업일시 (예약 픽업일 때만)';
