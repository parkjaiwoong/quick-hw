# GitHub 저장소 설정 및 Vercel 배포 스크립트
# 사용법: .\setup-github.ps1

Write-Host "=== GitHub 및 Vercel 배포 설정 ===" -ForegroundColor Green

# Git 설치 확인
Write-Host "`n1. Git 설치 확인 중..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    Write-Host "✅ Git 설치됨: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git이 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "`nGit 설치 방법:" -ForegroundColor Yellow
    Write-Host "1. https://git-scm.com/download/win 에서 다운로드" -ForegroundColor Cyan
    Write-Host "2. 또는 winget install --id Git.Git -e --source winget" -ForegroundColor Cyan
    Write-Host "`nGit 설치 후 이 스크립트를 다시 실행하세요." -ForegroundColor Yellow
    exit 1
}

# Git 저장소 초기화 확인
Write-Host "`n2. Git 저장소 확인 중..." -ForegroundColor Yellow
if (Test-Path .git) {
    Write-Host "✅ Git 저장소가 이미 초기화되어 있습니다." -ForegroundColor Green
} else {
    Write-Host "Git 저장소 초기화 중..." -ForegroundColor Cyan
    git init
    Write-Host "✅ Git 저장소 초기화 완료" -ForegroundColor Green
}

# .gitignore 확인
if (-not (Test-Path .gitignore)) {
    Write-Host "⚠️  .gitignore 파일이 없습니다. 생성 중..." -ForegroundColor Yellow
    # .gitignore는 이미 존재하므로 이 부분은 실행되지 않을 것입니다
}

# 파일 추가
Write-Host "`n3. 파일 추가 중..." -ForegroundColor Yellow
git add .

# 커밋
Write-Host "`n4. 커밋 생성 중..." -ForegroundColor Yellow
$commitMessage = "Initial commit: Delivery app"
try {
    git commit -m $commitMessage
    Write-Host "✅ 커밋 완료" -ForegroundColor Green
} catch {
    Write-Host "⚠️  커밋할 변경사항이 없거나 이미 커밋되어 있습니다." -ForegroundColor Yellow
}

# GitHub CLI 확인
Write-Host "`n5. GitHub CLI 확인 중..." -ForegroundColor Yellow
$useGitHubCLI = $false
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $loginStatus = gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GitHub CLI 로그인됨" -ForegroundColor Green
        $useGitHubCLI = $true
    } else {
        Write-Host "⚠️  GitHub CLI가 설치되어 있지만 로그인되지 않았습니다." -ForegroundColor Yellow
        Write-Host "   다음 명령어로 로그인: gh auth login" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  GitHub CLI가 설치되어 있지 않습니다." -ForegroundColor Yellow
}

# GitHub 저장소 생성
Write-Host "`n6. GitHub 저장소 설정..." -ForegroundColor Yellow
if ($useGitHubCLI) {
    $repoName = Read-Host "GitHub 저장소 이름을 입력하세요 (기본값: delivery-app)"
    if ([string]::IsNullOrWhiteSpace($repoName)) {
        $repoName = "delivery-app"
    }
    
    $isPublic = Read-Host "공개 저장소로 만들까요? (y/n, 기본값: y)"
    if ([string]::IsNullOrWhiteSpace($isPublic) -or $isPublic -eq "y" -or $isPublic -eq "Y") {
        $visibility = "public"
    } else {
        $visibility = "private"
    }
    
    Write-Host "GitHub 저장소 생성 중..." -ForegroundColor Cyan
    gh repo create $repoName --$visibility --source=. --remote=origin --push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GitHub 저장소 생성 및 푸시 완료" -ForegroundColor Green
    } else {
        Write-Host "⚠️  GitHub 저장소 생성 실패. 수동으로 설정하세요." -ForegroundColor Yellow
        Write-Host "   https://github.com/new 에서 저장소 생성 후:" -ForegroundColor Cyan
        Write-Host "   git remote add origin https://github.com/your-username/$repoName.git" -ForegroundColor Gray
        Write-Host "   git branch -M main" -ForegroundColor Gray
        Write-Host "   git push -u origin main" -ForegroundColor Gray
    }
} else {
    Write-Host "`n수동으로 GitHub 저장소를 생성하세요:" -ForegroundColor Yellow
    Write-Host "1. https://github.com/new 접속" -ForegroundColor Cyan
    Write-Host "2. 저장소 이름 입력 (예: delivery-app)" -ForegroundColor Cyan
    Write-Host "3. 저장소 생성 후 다음 명령어 실행:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   git remote add origin https://github.com/your-username/delivery-app.git" -ForegroundColor Gray
    Write-Host "   git branch -M main" -ForegroundColor Gray
    Write-Host "   git push -u origin main" -ForegroundColor Gray
}

# Vercel 배포
Write-Host "`n7. Vercel 배포 준비..." -ForegroundColor Yellow
$deployNow = Read-Host "지금 Vercel에 배포하시겠습니까? (y/n, 기본값: n)"
if ($deployNow -eq "y" -or $deployNow -eq "Y") {
    if (Get-Command vercel -ErrorAction SilentlyContinue) {
        $loginCheck = vercel whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Vercel 로그인 확인됨" -ForegroundColor Green
            Write-Host "배포 중..." -ForegroundColor Cyan
            vercel --prod --yes
        } else {
            Write-Host "⚠️  Vercel에 로그인하세요: vercel login" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Vercel CLI가 설치되어 있지 않습니다." -ForegroundColor Yellow
        Write-Host "   npm install -g vercel 로 설치하세요." -ForegroundColor Cyan
    }
} else {
    Write-Host "`nVercel 배포는 다음 명령어로 실행하세요:" -ForegroundColor Cyan
    Write-Host "   vercel login" -ForegroundColor Gray
    Write-Host "   vercel --prod" -ForegroundColor Gray
    Write-Host "`n또는 Vercel 웹 대시보드에서 GitHub 저장소를 연결하세요." -ForegroundColor Cyan
}

Write-Host "`n✅ 설정 완료!" -ForegroundColor Green




