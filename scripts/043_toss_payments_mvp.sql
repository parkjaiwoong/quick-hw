-- Toss Payments MVP support (test keys)
-- Adds payment statuses and linking fields without changing existing flows.

-- Extend payment_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    RAISE NOTICE 'payment_status type does not exist; skip';
  ELSE
    BEGIN
      ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'READY';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'FAILED';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- payments table additions
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS settlement_id UUID,
  ADD COLUMN IF NOT EXISTS payment_key TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- settlements table additions
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS payment_status payment_status;

-- Extend settlement_status enum with LOCKED
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status') THEN
    BEGIN
      ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'LOCKED';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
