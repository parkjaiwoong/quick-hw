# Vercel 배포 스크립트 (환경 변수 포함)
# 사용법: .\deploy-vercel.ps1

Write-Host "=== Vercel 배포 스크립트 ===" -ForegroundColor Green

# Vercel 로그인 확인
Write-Host "`n1. Vercel 로그인 확인 중..." -ForegroundColor Yellow
$loginCheck = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vercel에 로그인되어 있지 않습니다." -ForegroundColor Red
    Write-Host "`n로그인을 진행합니다..." -ForegroundColor Yellow
    Write-Host "브라우저에서 로그인을 완료해주세요." -ForegroundColor Cyan
    vercel login
    
    # 로그인 후 다시 확인
    Start-Sleep -Seconds 2
    $loginCheck = vercel whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ 로그인 실패. 수동으로 로그인 후 다시 시도하세요." -ForegroundColor Red
        Write-Host "   vercel login" -ForegroundColor Gray
        exit 1
    }
}

Write-Host "✅ 로그인 확인됨: $loginCheck" -ForegroundColor Green

# 환경 변수 설정
Write-Host "`n2. 환경 변수 설정 중..." -ForegroundColor Yellow

$envVars = @{
    "NEXT_PUBLIC_QUICKSUPABASE_URL" = "https://xzqfrdzzmbkhkddtiune.supabase.co"
    "NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI"
}

Write-Host "환경 변수를 Vercel에 추가합니다..." -ForegroundColor Cyan
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "  - $key" -ForegroundColor Gray
    # 환경 변수 추가 (프로덕션 환경)
    echo $value | vercel env add $key production 2>&1 | Out-Null
}

Write-Host "✅ 환경 변수 설정 완료" -ForegroundColor Green
Write-Host "`n⚠️  참고: NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL은 배포 후 실제 도메인으로 설정하세요." -ForegroundColor Yellow

# 프로젝트 연결 확인
Write-Host "`n3. 프로젝트 연결 확인 중..." -ForegroundColor Yellow
if (-not (Test-Path .vercel)) {
    Write-Host "프로젝트 연결 중..." -ForegroundColor Cyan
    vercel link --yes 2>&1 | Out-Null
}

# 배포 실행
Write-Host "`n4. 프로덕션 배포 시작..." -ForegroundColor Yellow
Write-Host "배포 중... (약 2-3분 소요)" -ForegroundColor Cyan

vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 배포 완료!" -ForegroundColor Green
    Write-Host "`n⚠️  중요: 배포 후 Vercel 대시보드에서 다음을 확인하세요:" -ForegroundColor Yellow
    Write-Host "   1. 배포된 도메인 확인" -ForegroundColor Cyan
    Write-Host "   2. NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL 환경 변수를 실제 도메인으로 업데이트" -ForegroundColor Cyan
    Write-Host "   3. 환경 변수 업데이트 후 재배포" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ 배포 실패" -ForegroundColor Red
    Write-Host "Vercel 대시보드에서 수동으로 배포하세요: https://vercel.com" -ForegroundColor Yellow
}




