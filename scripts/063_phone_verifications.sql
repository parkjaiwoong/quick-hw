-- 휴대폰 OTP 인증 테이블
CREATE TABLE IF NOT EXISTS phone_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone varchar(20) NOT NULL,
  code varchar(6) NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires ON phone_verifications(expires_at);

ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- service_role만 접근 허용 (API Route에서 service role key 사용)
CREATE POLICY "service_role_all" ON phone_verifications
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 만료된 레코드 자동 정리 함수 (선택사항)
CREATE OR REPLACE FUNCTION cleanup_expired_phone_verifications()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM phone_verifications WHERE expires_at < now() - interval '1 hour';
END;
$$;
