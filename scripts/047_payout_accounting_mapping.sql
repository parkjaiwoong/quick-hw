-- Compatibility mapping additions (non-destructive)

-- Extend settlement_status enum to include READY and HOLD
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    BEGIN
      ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'READY';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'HOLD';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- payout_status enum for execution stage
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM ('NONE', 'WAITING', 'PAID_OUT');
  END IF;
END $$;

-- Extend payout_requests with accounting mapping fields
ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS settlement_status settlement_status,
  ADD COLUMN IF NOT EXISTS settlement_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_status payout_status DEFAULT 'NONE';
