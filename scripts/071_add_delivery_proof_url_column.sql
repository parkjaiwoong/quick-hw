-- "Could not find the 'delivery_proof_url' column" 오류 해결용
-- Supabase 대시보드 → SQL Editor → 이 파일 내용 붙여넣기 → Run

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;

COMMENT ON COLUMN deliveries.delivery_proof_url IS '배송 완료 인증 사진 URL (Storage delivery-proofs)';
