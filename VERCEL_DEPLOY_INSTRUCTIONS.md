# Vercel 배포 완료 가이드

## ✅ 완료된 작업
1. ✅ Git 저장소 초기화
2. ✅ 파일 커밋
3. ✅ GitHub에 푸시 완료: https://github.com/a01056214614-ship-it/quick-hw.git

## 🚀 Vercel 배포 방법

### 방법 1: Vercel 웹 대시보드 (권장)

1. **Vercel 접속 및 로그인**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **프로젝트 추가**
   - "Add New Project" 또는 "New Project" 클릭
   - GitHub 저장소 목록에서 `a01056214614-ship-it/quick-hw` 선택
   - "Import" 클릭

3. **프로젝트 설정**
   - Framework Preset: Next.js (자동 감지됨)
   - Root Directory: `./` (기본값)
   - Build Command: `npm run build` (기본값)
   - Output Directory: `.next` (기본값)
   - Install Command: `npm install` (기본값)

4. **환경 변수 설정** (중요!)
   - "Environment Variables" 섹션으로 이동
   - 다음 변수들을 추가하세요:

   ```
   NEXT_PUBLIC_QUICKSUPABASE_URL
   값: https://xzqfrdzzmbkhkddtiune.supabase.co
   ```

   ```
   NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY
   값: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA
   ```

   ```
   SUPABASE_SERVICE_ROLE_KEY
   값: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI
   ```

   ```
   NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
   값: https://your-app-name.vercel.app/auth/verify-email
   ```
   (배포 후 실제 도메인으로 변경 필요)

5. **배포 실행**
   - "Deploy" 버튼 클릭
   - 배포가 완료될 때까지 대기 (약 2-3분)

6. **배포 후 작업**
   - 배포가 완료되면 Vercel이 도메인을 제공합니다 (예: `quick-hw-xxx.vercel.app`)
   - `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` 환경 변수를 실제 도메인으로 업데이트
   - Settings > Environment Variables에서 수정 후 재배포

### 방법 2: Vercel CLI 사용

터미널에서 다음 명령어 실행:

```powershell
# Vercel 로그인
vercel login

# 프로덕션 배포
vercel --prod
```

환경 변수는 Vercel 대시보드에서 설정하거나 CLI로 추가:
```powershell
vercel env add NEXT_PUBLIC_QUICKSUPABASE_URL production
vercel env add NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL production
```

## 📝 참고사항

- GitHub 저장소에 코드가 푸시되어 있으므로, Vercel이 자동으로 변경사항을 감지하고 재배포합니다.
- 환경 변수는 프로덕션, 프리뷰, 개발 환경별로 설정할 수 있습니다.
- 첫 배포 후 Supabase 데이터베이스 스키마를 설정하는 것을 잊지 마세요!

## 🔗 링크

- GitHub 저장소: https://github.com/a01056214614-ship-it/quick-hw
- Vercel 대시보드: https://vercel.com/dashboard




