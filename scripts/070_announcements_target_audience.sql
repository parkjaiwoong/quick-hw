-- 공지사항 대상 구분: 고객용, 기사용, 공통
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'common'
  CHECK (target_audience IN ('customer', 'driver', 'common'));
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON announcements(target_audience);
