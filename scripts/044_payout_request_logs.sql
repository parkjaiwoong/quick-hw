-- Payout request status change logs
CREATE TABLE IF NOT EXISTS payout_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_request_id UUID REFERENCES payout_requests(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_request_logs_request ON payout_request_logs(payout_request_id);
CREATE INDEX IF NOT EXISTS idx_payout_request_logs_admin ON payout_request_logs(admin_id);
