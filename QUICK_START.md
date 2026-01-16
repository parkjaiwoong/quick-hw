# 🚀 빠른 시작 가이드

로컬에서 프로젝트를 실행하는 가장 빠른 방법입니다.

## 1️⃣ 환경 변수 설정

프로젝트 루트에 `.env.local` 파일이 있는지 확인하세요. 없으면 다음 명령어로 생성:

**Windows PowerShell:**
```powershell
@"
NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/verify-email
"@ | Out-File -FilePath .env.local -Encoding utf8
```

**또는 수동으로 생성:**
1. 프로젝트 루트에 `.env.local` 파일 생성
2. 위의 내용을 복사하여 붙여넣기

## 2️⃣ 의존성 설치

```bash
npm install
```

## 3️⃣ 개발 서버 실행

**방법 1: npm 직접 실행**
```bash
npm run dev
```

**방법 2: PowerShell 스크립트 사용 (Windows)**
```powershell
.\start-dev.ps1
```

## 4️⃣ 브라우저에서 접속

개발 서버가 시작되면 브라우저에서 다음 주소로 접속:

👉 **http://localhost:3000**

---

## ✅ 체크리스트

실행 전 확인사항:

- [ ] Node.js 18.x 이상 설치됨 (`node --version`으로 확인)
- [ ] `.env.local` 파일 생성 완료
- [ ] `npm install` 실행 완료
- [ ] 포트 3000이 사용 가능함

---

## ❓ 문제 해결

### 포트가 이미 사용 중인 경우

다른 포트로 실행:
```bash
npm run dev -- -p 3001
```

### 환경 변수 오류

`.env.local` 파일이 프로젝트 루트에 있는지 확인하세요.

### 더 자세한 가이드

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - 상세한 로컬 실행 가이드
- [README.md](./README.md) - 전체 프로젝트 문서
