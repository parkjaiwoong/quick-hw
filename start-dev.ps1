# 개발 서버 시작 스크립트
# PowerShell 실행 정책 설정 (현재 프로세스에만 적용)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "🚀 퀵HW 개발 서버 시작 중..." -ForegroundColor Green
Write-Host ""

# .env.local 없으면 .env.example 복사 후 그대로 실행 (한 번에 서버까지 뜸)
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "📄 .env.local 생성함 (필요하면 Supabase 등 값만 채우면 됨)" -ForegroundColor Cyan
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

