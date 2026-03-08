-- 기사 배송상세/상태 처리 성능 개선용 인덱스
-- deliveries: driver_id+status 복합 인덱스 (나의 배송/수락 가능 목록)
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status ON deliveries(driver_id, status);
