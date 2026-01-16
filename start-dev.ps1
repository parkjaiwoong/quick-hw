# 개발 서버 시작 스크립트
# PowerShell 실행 정책 설정 (현재 프로세스에만 적용)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "🚀 퀵HW 개발 서버 시작 중..." -ForegroundColor Green
Write-Host ""

# .env.local 파일 확인
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  경고: .env.local 파일이 없습니다!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "다음 단계를 따라주세요:" -ForegroundColor Yellow
    Write-Host "1. .env.local.example 파일을 .env.local로 복사하세요" -ForegroundColor Yellow
    Write-Host "2. 또는 LOCAL_SETUP.md 파일을 참고하여 .env.local 파일을 생성하세요" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "계속하시겠습니까? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "취소되었습니다." -ForegroundColor Red
        exit
    }
}

# node_modules 확인
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 의존성 설치 중..." -ForegroundColor Cyan
    npm install
    Write-Host ""
}

# 개발 서버 시작
Write-Host "🌐 개발 서버를 시작합니다..." -ForegroundColor Green
Write-Host "브라우저에서 http://localhost:3000 으로 접속하세요" -ForegroundColor Cyan
Write-Host ""
npm run dev

