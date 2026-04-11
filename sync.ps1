# WikitDB Project Sync Tool (GitHub)

# 强制设置输出编码为 UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "   WikitDB GitHub Sync Tool " -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan

# 1. Check Git Status
$status = git status --porcelain
if (-not $status) {
    Write-Host "[Info] No changes detected." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    exit
}

Write-Host "[1/3] Staging changes..." -ForegroundColor White
git add .

# 2. Get Commit Message
$date = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host ""
Write-Host "Enter commit message (Press Enter for default):" -ForegroundColor White
$msg = Read-Host "> "

if (-not $msg) {
    $msg = "chore: system optimization and security hardening ($date)"
}

Write-Host ""
Write-Host "[2/3] Committing changes: $msg" -ForegroundColor White
git commit -m $msg

# 3. Push to Remote
Write-Host ""
Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor White
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " SUCCESS: Project synced to GitHub! " -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host " ERROR: Push failed. Check your network or permissions. " -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = [Console]::ReadKey($true)
