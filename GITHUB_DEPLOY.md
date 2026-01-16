# GitHub 및 Vercel 배포 가이드

## 1. Git 설치

Git이 설치되어 있지 않습니다. 다음 중 하나의 방법으로 설치하세요:

### 방법 1: Git 공식 사이트에서 설치
1. https://git-scm.com/download/win 접속
2. 다운로드 후 설치
3. 설치 후 터미널 재시작

### 방법 2: Chocolatey로 설치 (관리자 권한 필요)
```powershell
choco install git
```

### 방법 3: winget으로 설치
```powershell
winget install --id Git.Git -e --source winget
```

## 2. Git 저장소 초기화 및 GitHub에 푸시

Git 설치 후 다음 명령어를 실행하세요:

```powershell
# 저장소 초기화
git init

# 파일 추가
git add .

# 커밋
git commit -m "Initial commit: Delivery app"

# GitHub 저장소 생성 (GitHub CLI 사용 시)
gh repo create delivery-app --public --source=. --remote=origin --push

# 또는 수동으로 GitHub에서 저장소 생성 후:
# git remote add origin https://github.com/your-username/delivery-app.git
# git branch -M main
# git push -u origin main
```

## 3. Vercel에 배포

### 방법 1: Vercel CLI 사용
```powershell
# 로그인
vercel login

# 배포
vercel --prod
```

### 방법 2: Vercel 웹 대시보드 사용
1. https://vercel.com 접속
2. "Add New Project" 클릭
3. GitHub 저장소 연결
4. 환경 변수 설정:
   - `NEXT_PUBLIC_QUICKSUPABASE_URL` = `https://xzqfrdzzmbkhkddtiune.supabase.co`
   - `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA`
   - `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI`
   - `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` = `https://your-domain.vercel.app/auth/verify-email`
5. Deploy 클릭

## 자동화 스크립트

Git 설치 후 `setup-github.ps1` 스크립트를 실행하세요.




