# 빠른 배포 스크립트
# 사용법: .\quick-deploy.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubRepoUrl
)

Write-Host "=== GitHub 푸시 및 Vercel 배포 ===" -ForegroundColor Green

# GitHub 원격 저장소 설정
Write-Host "`n1. GitHub 원격 저장소 설정 중..." -ForegroundColor Yellow
$existingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "기존 원격 저장소 제거 중..." -ForegroundColor Cyan
    git remote remove origin
}

git remote add origin $GitHubRepoUrl
Write-Host "✅ 원격 저장소 설정 완료: $GitHubRepoUrl" -ForegroundColor Green

# 푸시
Write-Host "`n2. GitHub에 푸시 중..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ GitHub 푸시 완료!" -ForegroundColor Green
} else {
    Write-Host "❌ GitHub 푸시 실패" -ForegroundColor Red
    Write-Host "인증이 필요할 수 있습니다. 다음 명령어로 푸시하세요:" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Gray
    exit 1
}

# Vercel 배포
Write-Host "`n3. Vercel 배포 준비..." -ForegroundColor Yellow
if (Get-Command vercel -ErrorAction SilentlyContinue) {
    $loginCheck = vercel whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vercel 로그인 확인됨" -ForegroundColor Green
        Write-Host "배포 중..." -ForegroundColor Cyan
        vercel --prod --yes
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Vercel 배포 완료!" -ForegroundColor Green
            Write-Host "`n⚠️  중요: Vercel 대시보드에서 환경 변수를 설정하세요:" -ForegroundColor Yellow
            Write-Host "   https://vercel.com > 프로젝트 선택 > Settings > Environment Variables" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "필요한 환경 변수:" -ForegroundColor Yellow
            Write-Host "   NEXT_PUBLIC_QUICKSUPABASE_URL=https://xzqfrdzzmbkhkddtiune.supabase.co" -ForegroundColor Gray
            Write-Host "   NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray
            Write-Host "   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray
        } else {
            Write-Host "`n⚠️  Vercel 배포 실패. 수동으로 배포하세요:" -ForegroundColor Yellow
            Write-Host "   vercel --prod" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Vercel에 로그인하세요: vercel login" -ForegroundColor Yellow
        Write-Host "`n또는 Vercel 웹 대시보드에서 GitHub 저장소를 연결하세요:" -ForegroundColor Cyan
        Write-Host "   https://vercel.com > Add New Project > GitHub 저장소 선택" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Vercel CLI가 설치되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host "`nVercel 웹 대시보드에서 배포하세요:" -ForegroundColor Cyan
    Write-Host "   1. https://vercel.com 접속" -ForegroundColor Gray
    Write-Host "   2. Add New Project 클릭" -ForegroundColor Gray
    Write-Host "   3. GitHub 저장소 연결" -ForegroundColor Gray
    Write-Host "   4. 환경 변수 설정 후 Deploy" -ForegroundColor Gray
}

Write-Host "`n✅ 완료!" -ForegroundColor Green

