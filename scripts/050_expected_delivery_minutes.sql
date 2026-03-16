-- 예상 배송 완료 시간(분): 고객이 선택한 예상시간 기준 (급송 30분, 기본 3시간)
-- 관리자 예상시간 초과 화면 및 기사 알림에 사용
-- 오류: Could not find the 'expected_delivery_minutes' column of 'deliveries' → 이 스크립트 실행 필요
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS expected_delivery_minutes INTEGER;

COMMENT ON COLUMN deliveries.expected_delivery_minutes IS '고객 선택 예상시간(분): express=30, standard=180. 수락 시점+이 값으로 예상 완료 시각 산출';

-- 기존 데이터: urgency 컬럼이 있을 때만 backfill (049_delivery_options.sql 선행 적용 시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'urgency'
  ) THEN
    UPDATE deliveries
    SET expected_delivery_minutes = CASE
      WHEN urgency = 'express' THEN 30
      ELSE 180
    END
    WHERE expected_delivery_minutes IS NULL AND status NOT IN ('cancelled');
  END IF;
END $$;
