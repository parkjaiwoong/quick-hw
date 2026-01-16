# 데이터베이스 설정 가이드

## ⚠️ 중요: 회원가입 오류 해결

"Could not find the table 'public.profiles' in the schema cache" 에러가 발생하는 경우:

### 1. Supabase 대시보드에서 테이블 확인

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **Table Editor** 클릭
4. `profiles` 테이블이 있는지 확인

### 2. 테이블이 없는 경우 SQL 스크립트 실행

**SQL Editor**에서 다음 순서로 실행:

#### 1단계: 스키마 생성
`scripts/001_create_schema.sql` 파일의 내용을 복사하여 실행

#### 2단계: RLS 정책 설정
`scripts/002_row_level_security.sql` 파일의 내용을 복사하여 실행

#### 3단계: INSERT 정책 추가 (중요!)
`scripts/007_fix_profiles_insert_policy.sql` 파일의 내용을 복사하여 실행

또는 직접 실행:

```sql
-- profiles 테이블 INSERT 정책 추가
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- driver_info 테이블 INSERT 정책 추가
DROP POLICY IF EXISTS "Drivers can insert own info" ON driver_info;

CREATE POLICY "Drivers can insert own info"
  ON driver_info FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 3. 테이블 존재 여부 확인

`scripts/008_check_tables.sql` 파일을 실행하여 테이블이 제대로 생성되었는지 확인

### 4. 스키마 캐시 새로고침

Supabase는 때때로 스키마 캐시를 사용합니다. 다음을 시도해보세요:

1. Supabase 대시보드에서 **Settings** > **API**로 이동
2. **Realtime** 섹션에서 **Restart** 클릭 (있는 경우)
3. 또는 프로젝트를 잠시 중지했다가 다시 시작

### 5. 환경 변수 확인

로컬 개발 환경에서 `.env.local` 파일이 있는지 확인:

```env
NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/verify-email
```

### 6. 개발 서버 재시작

환경 변수를 변경한 경우 개발 서버를 재시작하세요:

```bash
# 서버 종료 (Ctrl + C)
# 다시 시작
npm run dev
```

## SQL 스크립트 실행 순서

1. `001_create_schema.sql` - 테이블 생성
2. `002_row_level_security.sql` - RLS 정책 설정
3. `007_fix_profiles_insert_policy.sql` - INSERT 정책 추가 (회원가입 필수!)
4. `003_seed_data.sql` - 초기 데이터 (선택사항)
5. `004_functions.sql` - 함수 생성
6. `005_nearby_driver_allocation.sql` - 배송원 할당 함수
7. `006_additional_features.sql` - 추가 기능 (선택사항)

## 문제 해결

### 테이블이 보이지 않는 경우
- SQL Editor에서 `SELECT * FROM profiles LIMIT 1;` 실행
- 에러가 나면 테이블이 없는 것입니다

### RLS 정책 오류
- `scripts/008_check_tables.sql` 실행하여 정책 확인
- 정책이 없으면 `002_row_level_security.sql` 다시 실행

### 여전히 에러가 발생하는 경우
1. Supabase 프로젝트가 활성화되어 있는지 확인
2. 올바른 프로젝트에 연결되어 있는지 확인 (환경 변수)
3. Supabase 지원팀에 문의

