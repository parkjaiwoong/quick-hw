# 언넌(기사 앱) APK 빌드 후 public/downloads 로 복사
# 빌드 오류 시: driver_app 에서 flutter clean 후 다시 실행
# 사용: .\build-driver-apk.ps1
# DRIVER_WEB_URL 을 바꾸려면 아래 $driverWebUrl 수정

$ErrorActionPreference = "Stop"
$driverWebUrl = "https://quick-hw.vercel.app/driver"

$env:JAVA_HOME = "D:\Java\jdk-17.0.18+8"
$env:PATH = "D:\tools\flutter\bin;" + $env:PATH

$root = $PSScriptRoot
Set-Location $root

Write-Host "Flutter APK 빌드 중 (--split-per-abi)..." -ForegroundColor Cyan
Set-Location "$root\driver_app"
flutter build apk --dart-define=DRIVER_WEB_URL=$driverWebUrl --split-per-abi
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apkDir = "$root\driver_app\build\app\outputs\flutter-apk"
$destDir = "$root\public\downloads"
$destFile = "$destDir\driver-app.apk"

# arm64-v8a 사용 (대부분 기기), 없으면 fat APK (파일명은 Flutter 버전에 따라 다를 수 있음)
$arm64 = Join-Path $apkDir "app-arm64-v8a-release.apk"
if (-not (Test-Path $arm64)) { $arm64 = Join-Path $apkDir "app-release-arm64-v8a.apk" }
$fat = Join-Path $apkDir "app-release.apk"

if (Test-Path $arm64) {
  Copy-Item $arm64 $destFile -Force
  Write-Host "복사 완료: app-release-arm64-v8a.apk -> public/downloads/driver-app.apk" -ForegroundColor Green
} elseif (Test-Path $fat) {
  Copy-Item $fat $destFile -Force
  Write-Host "복사 완료: app-release.apk -> public/downloads/driver-app.apk" -ForegroundColor Green
} else {
  Write-Host "APK 파일을 찾을 수 없습니다: $apkDir" -ForegroundColor Red
  exit 1
}

$sizeMB = [math]::Round((Get-Item $destFile).Length / 1MB, 2)
Write-Host "용량: $sizeMB MB" -ForegroundColor Gray
Set-Location $root
Write-Host "이제 git add / commit / push 하면 배포에 반영됩니다." -ForegroundColor Cyan
