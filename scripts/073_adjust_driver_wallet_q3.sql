-- q3@a.a 계정의 지갑/정산 데이터를 조정하여 출금 요청이 가능하도록 함.
-- 실행: Supabase SQL Editor에서 실행하거나, node scripts/run-sql.js @073_adjust_driver_wallet_q3.sql (DATABASE_URL 필요)

DO $$
DECLARE
  v_driver_id UUID;
  v_req RECORD;
  v_sum NUMERIC := 0;
BEGIN
  SELECT id INTO v_driver_id FROM public.profiles WHERE email = 'q3@a.a' LIMIT 1;
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다: email = q3@a.a';
  END IF;

  -- 기사 역할 보장
  UPDATE public.profiles SET role = 'driver' WHERE id = v_driver_id;

  -- driver_wallet: 없으면 생성, 있으면 출금 가능 잔액·최소 출금액 조정
  INSERT INTO public.driver_wallet (driver_id, total_balance, available_balance, pending_balance, min_payout_amount)
  VALUES (v_driver_id, 50000, 50000, 0, 1000)
  ON CONFLICT (driver_id) DO UPDATE SET
    available_balance = GREATEST(public.driver_wallet.available_balance, 50000),
    total_balance = GREATEST(public.driver_wallet.total_balance, 50000),
    min_payout_amount = LEAST(COALESCE(public.driver_wallet.min_payout_amount, 10000), 1000);

  -- 할당 가능 정산이 하나도 없으면 READY+PAID 정산 1건 추가
  SELECT COALESCE(SUM(s.settlement_amount), 0) INTO v_sum
  FROM public.settlements s
  WHERE s.driver_id = v_driver_id
    AND (
      (s.settlement_status = 'READY' AND s.payment_status = 'PAID' AND s.payout_request_id IS NULL AND (s.settlement_locked IS NOT TRUE))
      OR (s.settlement_status = 'CONFIRMED' AND s.payout_request_id IS NULL AND (s.settlement_locked IS NOT TRUE))
    );
  IF v_sum <= 0 THEN
    INSERT INTO public.settlements (
      driver_id,
      settlement_period_start,
      settlement_period_end,
      total_deliveries,
      total_earnings,
      platform_fee_total,
      net_earnings,
      status,
      settlement_status,
      settlement_amount,
      payment_status,
      payout_request_id,
      settlement_locked
    )
    VALUES (
      v_driver_id,
      CURRENT_DATE,
      CURRENT_DATE,
      1,
      50000,
      0,
      50000,
      'pending',
      'READY',
      50000,
      'PAID',
      NULL,
      false
    );
  END IF;

  -- 대기 중인 출금 요청(requested/on_hold/approved)이 있으면 반려 처리 후 잔액 복구
  FOR v_req IN
    SELECT id, requested_amount
    FROM public.payout_requests
    WHERE driver_id = v_driver_id
      AND status IN ('requested', 'on_hold', 'approved')
  LOOP
    UPDATE public.payout_requests
    SET status = 'rejected', notes = COALESCE(notes, '데이터 조정으로 반려'), processed_at = now()
    WHERE id = v_req.id;
    UPDATE public.settlements SET payout_request_id = NULL WHERE payout_request_id = v_req.id;
    UPDATE public.driver_wallet
    SET available_balance = available_balance + COALESCE(v_req.requested_amount, 0)
    WHERE driver_id = v_driver_id;
  END LOOP;

  RAISE NOTICE '조정 완료: driver_id = %', v_driver_id;
END $$;
