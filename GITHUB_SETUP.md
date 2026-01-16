# GitHub 저장소 생성 및 푸시 가이드

## 현재 상태
✅ Git 저장소 초기화 완료
✅ 파일 커밋 완료
✅ main 브랜치 설정 완료

## 다음 단계

### 1. GitHub에서 저장소 생성

1. https://github.com/new 접속
2. 저장소 이름 입력 (예: `delivery-app`)
3. Public 또는 Private 선택
4. **"Initialize this repository with a README" 체크 해제** (이미 로컬에 파일이 있으므로)
5. "Create repository" 클릭

### 2. 로컬 저장소를 GitHub에 연결

GitHub에서 저장소를 생성한 후, 다음 명령어를 실행하세요:

```powershell
cd D:\ai\v0_ap\delivery-app

# GitHub 저장소 URL로 교체하세요 (예: https://github.com/your-username/delivery-app.git)
git remote add origin https://github.com/your-username/delivery-app.git

# 푸시
git push -u origin main
```

### 3. Vercel에 배포

GitHub 저장소에 푸시한 후:

#### 방법 1: Vercel 웹 대시보드 (권장)
1. https://vercel.com 접속 및 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. 환경 변수 설정:
   - `NEXT_PUBLIC_QUICKSUPABASE_URL` = `https://xzqfrdzzmbkhkddtiune.supabase.co`
   - `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA`
   - `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI`
   - `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` = `https://your-domain.vercel.app/auth/verify-email`
5. Deploy 클릭

#### 방법 2: Vercel CLI
```powershell
vercel login
vercel --prod
```

## 빠른 실행 스크립트

GitHub 저장소를 생성한 후, 다음 명령어를 실행하세요:

```powershell
# 저장소 URL을 입력하세요
$repoUrl = Read-Host "GitHub 저장소 URL을 입력하세요 (예: https://github.com/username/delivery-app.git)"

git remote add origin $repoUrl
git push -u origin main
```




