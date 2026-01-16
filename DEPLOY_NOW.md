# 🚀 즉시 배포 가이드

## ✅ 준비 완료
- ✅ 코드가 GitHub에 푸시됨: https://github.com/a01056214614-ship-it/quick-hw
- ✅ 환경 변수 파일 생성 완료
- ✅ 최신 변경사항 커밋 및 푸시 완료 (커밋: a15fdcc)

## 📋 배포 단계 (웹 대시보드)

브라우저에서 Vercel 새 프로젝트 페이지가 열렸습니다.

### 1단계: 저장소 선택
- "Import Git Repository" 클릭
- `a01056214614-ship-it/quick-hw` 선택
- "Import" 클릭

### 2단계: 프로젝트 설정
- Framework Preset: **Next.js** (자동 감지됨)
- Root Directory: `./` (기본값 유지)
- Build Command: `npm run build` (기본값 유지)
- Output Directory: `.next` (기본값 유지)

### 3단계: 환경 변수 추가 (중요!)

"Environment Variables" 섹션에서 다음 변수들을 추가하세요:

| 변수명 | 값 |
|--------|-----|
| `NEXT_PUBLIC_QUICKSUPABASE_URL` | `https://xzqfrdzzmbkhkddtiune.supabase.co` |
| `NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI` |

**참고**: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`은 배포 완료 후 실제 도메인으로 설정하세요.

### 4단계: 배포 실행
- "Deploy" 버튼 클릭
- 배포 완료까지 약 2-3분 대기

### 5단계: 배포 후 작업
배포가 완료되면:
1. Vercel이 제공하는 도메인 확인 (예: `quick-hw-xxx.vercel.app`)
2. Settings > Environment Variables에서 `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` 추가:
   - 값: `https://your-app-name.vercel.app/auth/verify-email`
3. 환경 변수 업데이트 후 자동 재배포됨

## 🔗 링크
- GitHub: https://github.com/a01056214614-ship-it/quick-hw
- Vercel 대시보드: https://vercel.com/dashboard




