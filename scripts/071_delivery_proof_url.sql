-- 배송 완료 시 기사가 올리는 인증 사진 URL
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;

-- Supabase Storage: delivery-proofs 버킷 생성 필요
-- 대시보드 Storage > New bucket > delivery-proofs (Public)
