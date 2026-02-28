-- driver_info에 사진 URL 컬럼 추가
ALTER TABLE driver_info
  ADD COLUMN IF NOT EXISTS license_photo_url text,
  ADD COLUMN IF NOT EXISTS vehicle_photo_url text,
  ADD COLUMN IF NOT EXISTS docs_submitted_at timestamptz;

-- 약관 동의 기록 테이블
CREATE TABLE IF NOT EXISTS term_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  terms_version varchar(20) NOT NULL DEFAULT 'v1.0',
  privacy_agreed boolean NOT NULL DEFAULT false,
  service_agreed boolean NOT NULL DEFAULT false,
  insurance_agreed boolean NOT NULL DEFAULT false,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  ip_address varchar(50),
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_term_agreements_user_id ON term_agreements(user_id);
ALTER TABLE term_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON term_agreements FOR ALL TO service_role USING (true) WITH CHECK (true);
