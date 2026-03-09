-- 배송 완료 시 기사가 올리는 인증 사진 URL
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;

-- Supabase Storage: delivery-proofs 버킷 생성 필요
-- 대시보드 Storage > New bucket > delivery-proofs (Public)
-- 아래 정책 적용 시, SERVICE_ROLE 없이도 기사 인증 업로드 가능
-- (기존 정책 있으면: DROP POLICY "Drivers can upload proof for own delivery" ON storage.objects; 등으로 제거 후 실행)

-- storage.objects에 대한 INSERT 정책 (기사가 자신의 배송에만 업로드)
CREATE POLICY "Drivers can upload proof for own delivery"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.deliveries WHERE driver_id = auth.uid()
  )
);

-- SELECT 정책 (공개 읽기 - public 버킷)
CREATE POLICY "Public read delivery proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'delivery-proofs');
