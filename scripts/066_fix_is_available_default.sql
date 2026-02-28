-- driver_info.is_available 기본값을 false로 변경
-- 신규 가입 기사는 배송가능 상태가 OFF로 시작해야 함
ALTER TABLE driver_info ALTER COLUMN is_available SET DEFAULT false;
