-- 트리거 및 함수 상태 확인

-- 1. find_nearby_drivers 함수 확인
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'find_nearby_drivers';

-- 2. notify_nearby_drivers 함수 확인
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'notify_nearby_drivers';

-- 3. 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'deliveries'
ORDER BY trigger_name;

-- 4. driver_info 테이블 구조 확인
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'driver_info'
ORDER BY ordinal_position;

-- 5. 기사 정보 확인 (driver_info 테이블)
SELECT 
  COUNT(*) AS total_drivers,
  COUNT(CASE WHEN is_available = true THEN 1 END) AS available_drivers
FROM driver_info;

-- 5. 배송 요청 확인
SELECT 
  status,
  COUNT(*) as count
FROM deliveries
GROUP BY status
ORDER BY status;

