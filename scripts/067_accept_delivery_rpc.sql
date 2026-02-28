-- 배송 수락 원자적 처리 RPC
-- SECURITY DEFINER: RLS 우회하여 실행 (driver_id IS NULL 행 UPDATE 허용)
-- 동시 수락 시 PostgreSQL 행 잠금으로 첫 번째 기사만 성공, 나머지는 'already_taken' 반환
CREATE OR REPLACE FUNCTION accept_delivery(
  p_delivery_id UUID,
  p_driver_id   UUID
)
RETURNS TEXT   -- 'ok' | 'already_taken' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE deliveries
  SET
    driver_id   = p_driver_id,
    status      = 'accepted',
    accepted_at = NOW()
  WHERE id        = p_delivery_id
    AND driver_id IS NULL
    AND status    = 'pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    RETURN 'ok';
  END IF;

  -- 이미 다른 기사가 수락했거나 존재하지 않는 배송
  IF EXISTS (SELECT 1 FROM deliveries WHERE id = p_delivery_id) THEN
    RETURN 'already_taken';
  END IF;

  RETURN 'not_found';
END;
$$;

-- 인증된 모든 사용자(기사)가 호출 가능
GRANT EXECUTE ON FUNCTION accept_delivery(UUID, UUID) TO authenticated;
