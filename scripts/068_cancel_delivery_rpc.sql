-- 배송 취소 원자적 처리 RPC
-- SECURITY DEFINER: RLS 우회하여 실행
-- 취소 ↔ 기사 수락 동시 발생 시 race condition 방지:
--   취소는 status IN ('pending','accepted') 조건으로만 UPDATE
--   기사 수락 RPC는 status='pending' 조건으로만 UPDATE
--   → 둘 다 PostgreSQL 행 잠금으로 한 쪽만 성공
CREATE OR REPLACE FUNCTION cancel_delivery(
  p_delivery_id UUID,
  p_customer_id UUID
)
RETURNS TEXT   -- 'ok' | 'not_owner' | 'not_cancellable' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows    INTEGER;
  v_status  TEXT;
  v_owner   UUID;
BEGIN
  -- 소유자 및 현재 상태 확인
  SELECT status, customer_id INTO v_status, v_owner
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;  -- 행 잠금 획득 (기사 수락 RPC와 상호 배타적)

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_owner <> p_customer_id THEN
    RETURN 'not_owner';
  END IF;

  -- 취소 가능 상태: pending, accepted 만 허용
  -- (picked_up, in_transit, delivered, cancelled 는 불가)
  IF v_status NOT IN ('pending', 'accepted') THEN
    RETURN 'not_cancellable';
  END IF;

  UPDATE deliveries
  SET
    status       = 'cancelled',
    cancelled_at = NOW()
  WHERE id = p_delivery_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    RETURN 'ok';
  END IF;

  RETURN 'not_cancellable';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_delivery(UUID, UUID) TO authenticated;
