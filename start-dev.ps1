# 퀵HW 로컬 개발 서버 실행
# .env.local 이 없으면 .env.example 에서 복사 후 dev 서버 시작

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "[OK] .env.local 을 .env.example 에서 생성했습니다. 필요하면 값을 수정하세요." -ForegroundColor Green
    } else {
        Write-Host "[오류] .env.example 이 없습니다." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path "node_modules")) {
    Write-Host "의존성 설치 중..." -ForegroundColor Yellow
    npm install
}

Write-Host "개발 서버 시작: http://localhost:3000" -ForegroundColor Cyan
npm run dev
