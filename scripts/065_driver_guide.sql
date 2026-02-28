-- 기사 온보딩 가이드 완료 시각 컬럼 추가
ALTER TABLE driver_info
  ADD COLUMN IF NOT EXISTS guide_completed_at timestamptz;
