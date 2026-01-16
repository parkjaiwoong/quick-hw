# Vercel 배포 가이드

## 1. Vercel 로그인

터미널에서 다음 명령어 실행:
```bash
vercel login
```

브라우저에서 로그인 방법 선택 (GitHub, GitLab, Email 등)

## 2. 프로젝트 배포

```bash
vercel --prod
```

## 3. 환경 변수 설정

배포 후 Vercel 대시보드(https://vercel.com)에서 프로젝트 선택 > Settings > Environment Variables에서 다음 변수들을 추가하세요:

```
NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co
NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://your-domain.vercel.app/auth/verify-email
```

**중요**: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`은 배포된 도메인으로 변경하세요.

## 4. 환경 변수 설정 후 재배포

환경 변수 설정 후 자동으로 재배포되거나, 수동으로 재배포:
```bash
vercel --prod
```

## CLI로 환경 변수 설정 (선택사항)

```bash
vercel env add NEXT_PUBLIC_QUICKSUPABASE_URL production
vercel env add NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL production
```

각 명령어 실행 시 값을 입력하세요.




