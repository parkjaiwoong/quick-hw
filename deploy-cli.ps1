# Vercel CLI Deployment Script
# Usage: .\deploy-cli.ps1

Write-Host "=== Vercel CLI Deployment ===" -ForegroundColor Green

# Check login
Write-Host "`n1. Checking Vercel login..." -ForegroundColor Yellow
$loginCheck = vercel whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Not logged in to Vercel." -ForegroundColor Red
    Write-Host "Please login with: vercel login" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: Logged in as: $loginCheck" -ForegroundColor Green

# Check project link
Write-Host "`n2. Checking project link..." -ForegroundColor Yellow
if (-not (Test-Path .vercel)) {
    Write-Host "Linking project..." -ForegroundColor Cyan
    vercel link --yes
}

# Set environment variables
Write-Host "`n3. Setting environment variables..." -ForegroundColor Yellow
$envVars = @{
    "NEXT_PUBLIC_QUICKSUPABASE_URL" = "https://xzqfrdzzmbkhkddtiune.supabase.co"
    "NEXT_PUBLIC_QUICKSUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Mjc1NjgsImV4cCI6MjA4MzEwMzU2OH0.TtjwaofQ2FO7YMJY-Vc41OX4W-gFf3d4SWg9v5-luDA"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6cWZyZHp6bWJraGtkZHRpdW5lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNzU2OCwiZXhwIjoyMDgzMTAzNTY4fQ.eFib4rp78ZUURauZcQ2ljus4BLvb6-FwKHCAvNQloFI"
}

Write-Host "Adding environment variables to Vercel..." -ForegroundColor Cyan
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    Write-Host "  - $key" -ForegroundColor Gray
    Write-Output $value | vercel env add $key production 2>&1 | Out-Null
}

Write-Host "SUCCESS: Environment variables configured" -ForegroundColor Green

# Deploy
Write-Host "`n4. Starting production deployment..." -ForegroundColor Yellow
Write-Host "Deploying... (this may take 2-3 minutes)" -ForegroundColor Cyan

vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS: Deployment completed!" -ForegroundColor Green
    Write-Host "`nIMPORTANT: After deployment, check the following in Vercel dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Check deployed domain" -ForegroundColor Cyan
    Write-Host "   2. Update NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL env var with actual domain" -ForegroundColor Cyan
    Write-Host "   3. Redeploy after updating env vars" -ForegroundColor Cyan
} else {
    Write-Host "`nERROR: Deployment failed" -ForegroundColor Red
    Write-Host "Please deploy manually from Vercel dashboard: https://vercel.com" -ForegroundColor Yellow
}
