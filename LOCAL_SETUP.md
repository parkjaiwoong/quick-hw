# 로컬 실행 가이드

## ⚡ 로컬 테스트 한 번에

1. **환경 파일**: 프로젝트 루트에서  
   `Copy-Item .env.example .env.local`  
   또는 `.\start-dev.ps1` 실행(처음 한 번은 .env.local 자동 생성 후 종료됨).
2. **`.env.local` 편집**: Supabase URL·ANON_KEY·SERVICE_ROLE_KEY 등 입력 후 저장.
3. **실행**: `npm run dev` 또는 `.\start-dev.ps1`
4. **접속**: 브라우저에서 http://localhost:3000

---

## 🚀 빠른 시작

### 1단계: 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하세요.

**방법 1: 예제 파일 복사 (권장)**
```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```
또는 **첫 로컬 실행 시** `.\start-dev.ps1` 을 실행하면 `.env.local`이 없을 때 `.env.example`을 복사해 줍니다.

**방법 2: 직접 생성**
프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가:

```env
NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/verify-email
```

### 2단계: 의존성 설치

```bash
npm install
```

또는 pnpm을 사용하는 경우:
```bash
pnpm install
```

### 3단계: 개발 서버 실행

**방법 1: npm 사용**
```bash
npm run dev
```

**방법 2: PowerShell 스크립트 사용 (Windows)**
```powershell
.\start-dev.ps1
```

**방법 3: 다른 포트로 실행**
```bash
npm run dev -- -p 3001
```

### 4단계: 브라우저에서 접속

개발 서버가 시작되면 브라우저에서 다음 주소로 접속하세요:
- **로컬 주소**: http://localhost:3000

---

## 📋 사전 요구사항

- **Node.js**: 18.x 이상 (권장: 20.x)
- **npm** 또는 **pnpm**: 패키지 관리자
- **Supabase 계정**: 데이터베이스 접근 권한

---

## 🔧 문제 해결

### ❌ 포트가 이미 사용 중인 경우

다른 포트로 실행:
```bash
npm run dev -- -p 3001
```

또는 사용 중인 프로세스 종료:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID번호> /F
```

### ❌ 환경 변수 오류

**에러 메시지**: `Missing Supabase environment variables`

**해결 방법**:
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 정확한지 확인 (`.env.local` - 앞에 점 포함)
3. 환경 변수 값이 올바른지 확인
4. 개발 서버 재시작

### ❌ 의존성 설치 오류

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

Windows PowerShell:
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

### ❌ 데이터베이스 연결 오류

1. **Supabase 프로젝트 상태 확인**
   - Supabase 대시보드에서 프로젝트가 활성화되어 있는지 확인
   - URL과 API 키가 올바른지 확인

2. **데이터베이스 스키마 확인**
   - `scripts/` 폴더의 SQL 파일들이 실행되었는지 확인
   - Supabase 대시보드 > SQL Editor에서 스키마 확인

3. **RLS 정책 확인**
   - Row Level Security가 올바르게 설정되었는지 확인

### ❌ 빌드 오류

TypeScript 오류 무시하고 실행하려면 (개발용):
```bash
# next.config.mjs에서 이미 설정되어 있음
npm run dev
```

---

## 📝 추가 정보

### 환경 변수 설명

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEXT_PUBLIC_QUICKSUPABASE_URL` | Supabase 프로젝트 URL | ✅ |
| `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY` | Supabase 공개 API 키 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 역할 키 (서버 전용) | ✅ |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | 로컬 개발용 리다이렉트 URL (예: http://localhost:3000/auth/verify-email) | 권장 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스페이먼츠 클라이언트 키 (결제·계좌연동 테스트 시) | 선택 |
| `TOSS_SECRET_KEY` | 토스페이먼츠 시크릿 키 (결제·계좌연동 테스트 시) | 선택 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키 (배송 요청 지도) | 선택 |

### 개발 서버 명령어

```bash
# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm run start

# 린트 검사
npm run lint
```

### 유용한 링크

- **Supabase 대시보드**: https://supabase.com/dashboard
- **API 설정**: https://supabase.com/dashboard/project/_/settings/api
- **SQL Editor**: https://supabase.com/dashboard/project/_/sql/new

---

## ✅ 실행 확인 체크리스트

- [ ] `.env.local` 파일 생성 완료
- [ ] 환경 변수 모두 설정 완료
- [ ] `npm install` 실행 완료
- [ ] `npm run dev` 실행 성공
- [ ] 브라우저에서 http://localhost:3000 접속 가능
- [ ] Supabase 연결 정상 작동

