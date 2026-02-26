# 로컬 전체 테스트 스크립트 - 웹 서버 실행 후 브라우저 열기
# 실행: .\test-local.ps1  또는  npm run test:local:run

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "=== QuickHW Local Test ===" -ForegroundColor Cyan
Write-Host ""

# 1. .env.local 확인
if (-not (Test-Path "$ProjectRoot\.env.local")) {
    if (Test-Path "$ProjectRoot\.env.example") {
        Copy-Item "$ProjectRoot\.env.example" "$ProjectRoot\.env.local"
        Write-Host "[1/5] .env.local created" -ForegroundColor Green
    } else {
        Write-Host "[1/5] .env.example not found - create .env.local manually" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[1/5] .env.local OK" -ForegroundColor Green
}

# 2. npm install
if (-not (Test-Path "$ProjectRoot\node_modules")) {
    Write-Host "[2/5] npm install..." -ForegroundColor Cyan
    Set-Location $ProjectRoot
    npm install
    Write-Host "[2/5] npm install done" -ForegroundColor Green
} else {
    Write-Host "[2/5] node_modules OK" -ForegroundColor Green
}

# 3. 웹 서버 별도 창에서 실행
Write-Host "[3/5] Starting web server (new window)..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$ProjectRoot`" && npm run dev" -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Normal

# 4. 서버 응답 대기
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) {
            Write-Host "[4/5] Web server ready (${waited}s)" -ForegroundColor Green
            break
        }
    } catch { }
    Start-Sleep -Seconds 2
    $waited += 2
}

if ($waited -ge $maxWait) {
    Write-Host "[4/5] Web server timeout" -ForegroundColor Red
    if ($proc -and !$proc.HasExited) { $proc.Kill() }
    exit 1
}

# 5. 브라우저 열기
Write-Host "[5/5] Opening browser http://localhost:3000" -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "=== Local test ready ===" -ForegroundColor Green
Write-Host "  Web: http://localhost:3000" -ForegroundColor White
Write-Host "  Driver app (separate terminal): npm run driver-app:run-emu" -ForegroundColor White
Write-Host "  Stop: Ctrl+C in web server window" -ForegroundColor Gray
Write-Host ""

