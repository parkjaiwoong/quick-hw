-- Payout transfer execution support (manual/auto)
ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_method TEXT;

CREATE TABLE IF NOT EXISTS payout_transfer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id UUID REFERENCES payout_requests(id) ON DELETE CASCADE,
  transfer_method TEXT NOT NULL, -- MANUAL / AUTO
  executed_by TEXT NOT NULL, -- ADMIN / SYSTEM
  result_status TEXT NOT NULL, -- TRANSFERRED / FAILED / CANCELED
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_transfer_logs_request ON payout_transfer_logs(payout_request_id);
