# .env.local의 GITHUB_PUSH_TOKEN으로 parkjaiwoong/quick-hw에 push
# 사용: .\push-as-parkjaiwoong.ps1

Set-Location $PSScriptRoot
$ErrorActionPreference = "Stop"

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "오류: $envFile 이 없습니다. GITHUB_PUSH_TOKEN을 넣어 주세요." -ForegroundColor Red
    exit 1
}
$token = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^GITHUB_PUSH_TOKEN=(.+)$') { $token = $matches[1].Trim() }
}
if (-not $token) {
    Write-Host "오류: $envFile 에 GITHUB_PUSH_TOKEN 이 없습니다." -ForegroundColor Red
    exit 1
}

$url = "https://parkjaiwoong:$token@github.com/parkjaiwoong/quick-hw.git"
Write-Host "parkjaiwoong/quick-hw 로 push 중..." -ForegroundColor Cyan
git push $url main
if ($LASTEXITCODE -eq 0) {
    Write-Host "push 완료: https://github.com/parkjaiwoong/quick-hw" -ForegroundColor Green
} else {
    Write-Host "push 실패. 토큰에 repo 권한이 있는지 확인하세요." -ForegroundColor Red
    exit 1
}
