# 배송 완료 인증 사진 업로드 (delivery-proofs)

기사 앱에서 "배송 완료" 시 촬영한 인증 사진이 **Supabase Storage**에 저장됩니다.

## "Could not find the 'delivery_proof_url' column" / schema cache 오류 시

배송 완료 인증 화면에서 위 메시지가 나오면 **deliveries** 테이블에 컬럼이 없거나 스키마 캐시가 반영되지 않은 상태입니다.

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** → New query
3. 아래 SQL 실행:

```sql
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
```

4. 실행 후 앱에서 다시 시도. 그래도 같은 오류면 **Settings → API**에서 스키마 캐시가 자동 갱신될 때까지 잠시 기다리거나, 대시보드에서 **Table Editor → deliveries** 열어서 `delivery_proof_url` 컬럼이 보이는지 확인하세요.

(또는 `scripts/071_add_delivery_proof_url_column.sql` 실행)

## "파일 업로드에 실패했습니다" / "저장소 권한이 없습니다" 발생 시

### 1. 버킷 생성

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. **Storage** → **New bucket**
3. Name: `delivery-proofs`
4. **Public bucket** 체크 (인증 사진 URL 공개 읽기)
5. Create bucket

### 2. 저장 정책 적용 (SERVICE_ROLE_KEY 없을 때)

환경 변수 `SUPABASE_SERVICE_ROLE_KEY`를 쓰지 않으면, 로그인한 기사만 업로드할 수 있도록 **Storage 정책**이 필요합니다.

1. **SQL Editor**에서 아래 실행 (또는 `scripts/071_delivery_proof_url.sql` 참고):

```sql
-- 기사가 자신이 담당한 배송에만 업로드 가능
CREATE POLICY "Drivers can upload proof for own delivery"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.deliveries WHERE driver_id = auth.uid()
  )
);

-- 공개 읽기 (버킷이 Public이면 필요 없을 수 있음)
CREATE POLICY "Public read delivery proofs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'delivery-proofs');
```

2. 이미 같은 이름 정책이 있으면 먼저 제거 후 실행:
   - Storage → Policies → 해당 정책 삭제  
   또는 SQL: `DROP POLICY "Drivers can upload proof for own delivery" ON storage.objects;`

### 3. SERVICE_ROLE_KEY 사용 (선택)

`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY`를 설정하면 RLS를 거치지 않고 업로드됩니다.  
이 경우 **버킷만 생성**하면 되고, 위 Storage 정책은 없어도 됩니다.  
(키는 대시보드 Settings → API → service_role 에서 확인)
