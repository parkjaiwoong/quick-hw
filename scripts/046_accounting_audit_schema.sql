-- Accounting-grade audit schema additions (non-destructive)

-- payments table accounting fields
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS pg_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2);

-- settlements table accounting fields
ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- payout_requests (payouts) accounting fields
ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- transfers table (cash flow)
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES payout_requests(id) ON DELETE CASCADE,
  transfer_method TEXT NOT NULL, -- MANUAL / AUTO
  bank_name TEXT,
  account_number TEXT, -- masked
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL, -- SUCCESS / FAILED
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_payout ON transfers(payout_id);

-- unified status audit logs
CREATE TABLE IF NOT EXISTS status_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- payment / settlement / payout / transfer
  entity_id UUID NOT NULL,
  before_status TEXT,
  after_status TEXT NOT NULL,
  reason TEXT,
  actor TEXT NOT NULL, -- SYSTEM / ADMIN
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_audit_logs_entity ON status_audit_logs(entity_type, entity_id);
