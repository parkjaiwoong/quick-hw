# Vercel 배포 스크립트
# 사용법: .\deploy.ps1

Write-Host "=== Vercel 배포 스크립트 ===" -ForegroundColor Green

# 환경 변수 설정
Write-Host "`n1. 환경 변수 설정 중..." -ForegroundColor Yellow
$envVars = @{
    "NEXT_PUBLIC_QUICKSUPABASE_URL" = "https://xzqfrdzzmbkhkddtiune.supabase.co"
    "NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI"
}

Write-Host "`n환경 변수는 배포 후 Vercel 대시보드에서 설정하거나," -ForegroundColor Cyan
Write-Host "다음 명령어로 CLI에서 설정할 수 있습니다:" -ForegroundColor Cyan
Write-Host ""
foreach ($key in $envVars.Keys) {
    Write-Host "vercel env add $key production" -ForegroundColor Gray
}

# 배포 확인
Write-Host "`n2. Vercel 로그인 확인 중..." -ForegroundColor Yellow
$loginCheck = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Vercel에 로그인되어 있지 않습니다." -ForegroundColor Red
    Write-Host "다음 명령어로 로그인하세요: vercel login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 로그인 확인됨: $loginCheck" -ForegroundColor Green

# 배포 실행
Write-Host "`n3. 프로덕션 배포 시작..." -ForegroundColor Yellow
Write-Host "배포 중..." -ForegroundColor Cyan

vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 배포 완료!" -ForegroundColor Green
    Write-Host "`n⚠️  중요: 배포 후 Vercel 대시보드에서 환경 변수를 설정하세요." -ForegroundColor Yellow
    Write-Host "   https://vercel.com > 프로젝트 선택 > Settings > Environment Variables" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ 배포 실패" -ForegroundColor Red
}




