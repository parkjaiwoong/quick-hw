# DB 인덱스 권장 (기사 지갑/정산 화면 속도 개선)

기사 지갑·정산 화면에서 `driver_id` 기준 조회가 많으므로, 아래 인덱스가 있으면 쿼리 속도가 개선됩니다.  
Supabase 대시보드 → SQL Editor에서 실행하면 됩니다.

```sql
-- driver_wallet: driver_id로 단일 행 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_wallet_driver_id
  ON driver_wallet (driver_id);

-- payout_requests: driver_id + requested_at 정렬
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payout_requests_driver_requested
  ON payout_requests (driver_id, requested_at DESC);

-- settlements: driver_id + 정렬
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlements_driver_period
  ON settlements (driver_id, settlement_period_end DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settlements_driver_created
  ON settlements (driver_id, created_at DESC);

-- deliveries: driver_id로 카운트/필터
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_driver_id
  ON deliveries (driver_id);

-- driver_info: PK가 id라서 단일 행 조회는 이미 최적
-- (추가 인덱스 불필요)
```

`CONCURRENTLY`는 테이블 락 없이 인덱스를 만들 때 사용합니다. 이미 인덱스가 있으면 `IF NOT EXISTS`로 스킵됩니다.
